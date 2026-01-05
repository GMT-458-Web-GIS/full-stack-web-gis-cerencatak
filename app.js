const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs'); 
const session = require('express-session');
const crypto = require('crypto');
const pool = require('./config/db');

// --- SWAGGER ---
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const app = express();
const port = 3000;

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- ARA YAZILIMLAR ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- OTURUM ---
app.use(session({
    secret: 'student-save-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// --- DOSYA YÜKLEME ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: 'public/uploads/' });

// --- ROTALAR ---

// 1. MEKANLARI LİSTELE
app.get('/api/places', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT places.*, 
                   ST_AsGeoJSON(places.geom)::json as geometry,
                   CONCAT(users.first_name, ' ', users.last_name) as user_name, 
                   users.profile_pic 
            FROM places 
            LEFT JOIN users ON places.user_id = users.id 
            ORDER BY places.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("API Hatası:", err);
        res.status(500).json({ error: 'Veritabanı hatası' });
    }
});

// 2. YENİ MEKAN EKLE
app.post('/api/places', upload.single('mediaFile'), async (req, res) => {
    const { name, description, lat, lng, category } = req.body;
    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const userId = req.session.userId; 
    if (!userId) return res.status(401).json({ success: false, error: "Giriş yapmalısın!" });
    try {
        await pool.query(
            `INSERT INTO places (name, description, type, media_url, geom, user_id) 
             VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7)`,
            [name, description, category, mediaUrl, lng, lat, userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Kaydedilemedi" });
    }
});

// 3. MEKAN SİL
app.delete('/api/places/:id', async (req, res) => {
    const placeId = req.params.id;
    const userId = req.session.userId;
    const isAdmin = req.session.isAdmin; 
    if (!userId) return res.status(401).json({ success: false, error: "Oturum kapalı." });
    try {
        const checkQuery = await pool.query("SELECT user_id FROM places WHERE id = $1", [placeId]);
        if (checkQuery.rows.length === 0) return res.status(404).json({ success: false, error: "Bulunamadı." });
        const postOwnerId = checkQuery.rows[0].user_id;
        if (isAdmin || postOwnerId === userId) {
            await pool.query("DELETE FROM places WHERE id = $1", [placeId]);
            res.json({ success: true });
        } else {
            res.status(403).json({ success: false, error: "Yetkisiz!" });
        }
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 4. KAYIT OL
app.post('/api/register', upload.single('profilePic'), async (req, res) => {
    const { firstName, lastName, studentId, email, password } = req.body;
    const profilePic = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await pool.query(
            `INSERT INTO users (first_name, last_name, student_id, email, password_hash, profile_pic) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [firstName, lastName, studentId, email, hashedPassword, profilePic]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// 5. GİRİŞ YAP
app.post('/api/login', async (req, res) => {
    const { loginId, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1 OR student_id = $2', [loginId, loginId]);
        if (result.rows.length === 0) return res.status(401).json({ success: false, error: "Kullanıcı yok." });
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (isMatch) {
            req.session.userId = user.id;
            req.session.userName = user.first_name;
            req.session.profilePic = user.profile_pic;
            req.session.isAdmin = user.is_admin; 
            res.json({ success: true, userName: user.first_name, userId: user.id, profilePic: user.profile_pic, isAdmin: user.is_admin });
        } else {
            res.status(401).json({ success: false, error: "Şifre hatalı." });
        }
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// 6. ŞİFREMİ UNUTTUM (Geliştirici/Terminal Modu - Google Engelini Aşmak İçin)
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length === 0) {
            return res.json({ success: true, message: "İşlem tamamlandı, lütfen sistem loglarını kontrol edin." });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expireTime = new Date(Date.now() + 3600000); 

        await pool.query("UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3", [token, expireTime, email]);

        const resetLink = `http://63.177.100.32:3000/reset-password.html?token=${token}`;

        // 🔥 TERMİNALE YAZDIRMA (Sunum sırasında buradan kopyalayacaksın)
        console.log("\n" + "=".repeat(50));
        console.log("📩 [GELİŞTİRİCİ MESAJI] ŞİFRE SIFIRLAMA LİNKİ");
        console.log(`📧 E-posta: ${email}`);
        console.log(`🔗 Link: ${resetLink}`);
        console.log("=".repeat(50) + "\n");

        res.json({ success: true, message: "Sıfırlama linki oluşturuldu. Sunucu loglarını (Terminal) kontrol ediniz." });

    } catch (err) {
        console.error("Sistem Hatası:", err);
        res.status(500).json({ success: false, error: "Bir hata oluştu." });
    }
});

// 7. ŞİFREYİ SIFIRLA
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const result = await pool.query("SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()", [token]);
        
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, error: "Link geçersiz veya süresi dolmuş." });
        }

        const user = result.rows[0];
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query("UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2", [hashedPassword, user.id]);

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ loggedIn: true, userName: req.session.userName, userId: req.session.userId, profilePic: req.session.profilePic, isAdmin: req.session.isAdmin });
    } else {
        res.json({ loggedIn: false });
    }
});

app.post('/api/update-avatar', upload.single('profilePic'), async (req, res) => {
    if (!req.session.userId || !req.file) return res.status(400).json({ success: false });
    const newProfilePic = `/uploads/${req.file.filename}`;
    await pool.query("UPDATE users SET profile_pic = $1 WHERE id = $2", [newProfilePic, req.session.userId]);
    req.session.profilePic = newProfilePic;
    res.json({ success: true, newUrl: newProfilePic });
});

app.get('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

setInterval(async () => {
    await pool.query("DELETE FROM places WHERE created_at < NOW() - INTERVAL '24 hours'");
}, 60 * 60 * 1000);

app.listen(port, () => console.log(`Sunucu http://localhost:${port} adresinde hazır!`));