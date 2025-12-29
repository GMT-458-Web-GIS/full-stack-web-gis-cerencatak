const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs'); 
const session = require('express-session');
const pool = require('./config/db');

const app = express();
const port = 3000;

// --- SWAGGER DOKÜMANTASYON AYARLARI ---
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Hacettepe Social API',
            version: '1.0.0',
            description: 'Hacettepe Social Projesi için API Servis Dokümantasyonu',
            contact: {
                name: 'Geliştirici',
                email: 'cerencatak@hacettepe.edu.tr'
            }
        },
        servers: [
            { url: 'http://localhost:3000', description: 'Local Sunucu' },
            // NOT: Buradaki IP adresini AWS'deki güncel IP adresinle değiştirmeyi unutma!
            { url: 'http://35.174.192.176:3000', description: 'AWS Canlı Sunucu' } 
        ]
    },
    // Bu dosyadaki yorumları okuyacak
    apis: ['./app.js'], 
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// --- 1. ARA YAZILIMLAR ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- 2. OTURUM AYARLARI ---
app.use(session({
    secret: 'student-save-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// --- 3. DOSYA YÜKLEME ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: 'public/uploads/' });

// --- 4. ROTALAR ---

/**
 * @swagger
 * /api/places:
 * get:
 * summary: Tüm mekanları ve yorumları listeler
 * description: Harita üzerindeki pinleri, detaylarını ve ilişkili yorumları getirir.
 * responses:
 * 200:
 * description: Başarılı, mekan listesi döndü.
 */
app.get('/api/places', async (req, res) => {
    try {
        const query = `
            SELECT p.id, p.name, p.description, p.type, p.media_url, p.user_id,
            to_char(p.created_at, 'DD.MM.YYYY HH24:MI') as formatted_time,
            ST_AsGeoJSON(p.geom)::json as geometry,
            COALESCE(
                json_agg(
                    json_build_object(
                        'text', c.comment_text,
                        'sender', u.first_name,
                        'avatar', u.profile_pic
                    ) ORDER BY c.created_at ASC
                ) FILTER (WHERE c.id IS NOT NULL),
                '[]'::json
            ) as comments
            FROM places p
            LEFT JOIN comments c ON p.id = c.place_id
            LEFT JOIN users u ON c.user_id = u.id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `;
        
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Veri çekme hatası');
    }
});

/**
 * @swagger
 * /api/places:
 * post:
 * summary: Yeni bir mekan ekler
 * description: Harita üzerinde seçilen konuma yeni bir yer bildirimi yapar.
 * requestBody:
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * name:
 * type: string
 * description:
 * type: string
 * category:
 * type: string
 * lat:
 * type: number
 * lng:
 * type: number
 * mediaFile:
 * type: string
 * format: binary
 * responses:
 * 200:
 * description: Mekan başarıyla eklendi.
 * 401:
 * description: Giriş yapmalısınız.
 */
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

/**
 * @swagger
 * /api/places/{id}:
 * delete:
 * summary: Bir mekanı siler
 * description: Sadece admin veya gönderiyi paylaşan kişi silebilir.
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: integer
 * responses:
 * 200:
 * description: Silme başarılı.
 * 403:
 * description: Yetkisiz işlem.
 */
app.delete('/api/places/:id', async (req, res) => {
    const placeId = req.params.id;
    const userId = req.session.userId;
    const isAdmin = req.session.isAdmin; 

    if (!userId) return res.status(401).json({ success: false, error: "Oturum kapalı." });

    try {
        const checkQuery = await pool.query("SELECT user_id FROM places WHERE id = $1", [placeId]);
        
        if (checkQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Mekan bulunamadı." });
        }

        const postOwnerId = checkQuery.rows[0].user_id;

        if (isAdmin || postOwnerId === userId) {
            await pool.query("DELETE FROM places WHERE id = $1", [placeId]);
            res.json({ success: true });
        } else {
            res.status(403).json({ success: false, error: "Bunu silmeye yetkin yok!" });
        }

    } catch (err) {
        console.error("Silme hatası:", err);
        res.status(500).json({ success: false, error: "Sunucu hatası." });
    }
});

/**
 * @swagger
 * /api/places/{id}:
 * put:
 * summary: Mekan bilgilerini günceller
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: integer
 * requestBody:
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * name:
 * type: string
 * description:
 * type: string
 * category:
 * type: string
 * responses:
 * 200:
 * description: Güncelleme başarılı.
 */
app.put('/api/places/:id', upload.none(), async (req, res) => {
    const placeId = req.params.id;
    const { name, description, category } = req.body;
    const userId = req.session.userId;
    const isAdmin = req.session.isAdmin;

    if (!userId) return res.status(401).json({ success: false, error: "Oturum kapalı." });

    try {
        const checkQuery = await pool.query("SELECT user_id FROM places WHERE id = $1", [placeId]);
        if (checkQuery.rows.length === 0) return res.status(404).json({ success: false, error: "Mekan bulunamadı." });
        
        const postOwnerId = checkQuery.rows[0].user_id;
        
        if (isAdmin || postOwnerId === userId) {
            await pool.query(
                "UPDATE places SET name = $1, description = $2, type = $3 WHERE id = $4",
                [name, description, category, placeId]
            );
            res.json({ success: true });
        } else {
            res.status(403).json({ success: false, error: "Yetkisiz işlem!" });
        }
    } catch (err) {
        console.error("Güncelleme hatası:", err);
        res.status(500).json({ success: false, error: "Sunucu hatası." });
    }
});

/**
 * @swagger
 * /api/register:
 * post:
 * summary: Yeni kullanıcı kaydı
 * requestBody:
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * firstName:
 * type: string
 * lastName:
 * type: string
 * studentId:
 * type: string
 * email:
 * type: string
 * password:
 * type: string
 * profilePic:
 * type: string
 * format: binary
 * responses:
 * 201:
 * description: Kayıt başarılı.
 */
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
        res.status(500).json({ success: false, error: "Kayıt yapılamadı." });
    }
});

/**
 * @swagger
 * /api/login:
 * post:
 * summary: Kullanıcı girişi
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * loginId:
 * type: string
 * description: Email veya Öğrenci No
 * password:
 * type: string
 * responses:
 * 200:
 * description: Giriş başarılı.
 */
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
            
            res.json({ 
                success: true, 
                userName: user.first_name, 
                userId: user.id, 
                profilePic: user.profile_pic,
                isAdmin: user.is_admin 
            });
        } else {
            res.status(401).json({ success: false, error: "Şifre hatalı." });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Sunucu hatası." });
    }
});

// Oturum Kontrol
app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            loggedIn: true, 
            userName: req.session.userName, 
            userId: req.session.userId,
            profilePic: req.session.profilePic,
            isAdmin: req.session.isAdmin 
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// Profil Resmi Güncelleme
app.post('/api/update-avatar', upload.single('profilePic'), async (req, res) => {
    if (!req.session.userId || !req.file) return res.status(400).json({ success: false });
    const newProfilePic = `/uploads/${req.file.filename}`;
    await pool.query("UPDATE users SET profile_pic = $1 WHERE id = $2", [newProfilePic, req.session.userId]);
    req.session.profilePic = newProfilePic;
    res.json({ success: true, newUrl: newProfilePic });
});

app.get('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

// 24 Saat Temizlik
setInterval(async () => {
    await pool.query("DELETE FROM places WHERE created_at < NOW() - INTERVAL '24 hours'");
}, 60 * 60 * 1000);

/**
 * @swagger
 * /api/comments:
 * post:
 * summary: Mekana yorum yap
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * placeId:
 * type: integer
 * text:
 * type: string
 * responses:
 * 200:
 * description: Yorum eklendi.
 */
app.post('/api/comments', async (req, res) => {
    const { placeId, text } = req.body;
    const userId = req.session.userId;

    if (!userId) return res.status(401).json({ success: false, error: "Giriş yapmalısın." });
    if (!text || text.trim() === "") return res.status(400).json({ success: false, error: "Boş yorum olmaz." });

    try {
        await pool.query(
            "INSERT INTO comments (place_id, user_id, comment_text) VALUES ($1, $2, $3)",
            [placeId, userId, text]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Yorum eklenemedi." });
    }
});

app.listen(port, () => console.log(`Sunucu http://localhost:${port} adresinde hazır!`));