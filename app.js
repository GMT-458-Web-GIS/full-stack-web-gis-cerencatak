const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs'); 
const session = require('express-session');
const pool = require('./config/db');

const app = express();
const port = 3000;

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

// Mekanları Getir
// Mekanları ve Yorumları Getir (Gelişmiş Sorgu)
app.get('/api/places', async (req, res) => {
    try {
        // app.js içinde GET /api/places rotasındaki SQL sorgusu:

          const query = `
              SELECT p.id, p.name, p.description, p.type, p.media_url, p.user_id,
              to_char(p.created_at, 'DD.MM.YYYY HH24:MI') as formatted_time,
              ST_AsGeoJSON(p.geom)::json as geometry,
              
              -- DÜZELTME BURADA: '[]' yerine '[]'::json yazdık 👇
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

// Yeni Mekan Ekle
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

// GÖNDERİ SİLME (YENİ)
app.delete('/api/places/:id', async (req, res) => {
    const placeId = req.params.id;
    const userId = req.session.userId;
    const isAdmin = req.session.isAdmin; // Session'dan admin bilgisini al

    if (!userId) return res.status(401).json({ success: false, error: "Oturum kapalı." });

    try {
        // Önce gönderiyi kimin attığını bulalım
        const checkQuery = await pool.query("SELECT user_id FROM places WHERE id = $1", [placeId]);
        
        if (checkQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Mekan bulunamadı." });
        }

        const postOwnerId = checkQuery.rows[0].user_id;

        // KURAL: Ya admin olmalı YA DA gönderinin sahibi olmalı
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


// --- app.js içine, DELETE bloğunun altına ekle ---

// Mekan Güncelleme (EDİT)
app.put('/api/places/:id', upload.none(), async (req, res) => {
    const placeId = req.params.id;
    const { name, description, category } = req.body;
    const userId = req.session.userId;
    const isAdmin = req.session.isAdmin;

    if (!userId) return res.status(401).json({ success: false, error: "Oturum kapalı." });

    try {
        // Mekan kimin? Kontrol et.
        const checkQuery = await pool.query("SELECT user_id FROM places WHERE id = $1", [placeId]);
        if (checkQuery.rows.length === 0) return res.status(404).json({ success: false, error: "Mekan bulunamadı." });
        
        const postOwnerId = checkQuery.rows[0].user_id;
        
        // Admin veya Sahibi ise güncelle
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

// Kayıt Ol
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

// Giriş Yap (Admin Bilgisi Eklendi)
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
            req.session.isAdmin = user.is_admin; // Session'a kaydet
            
            res.json({ 
                success: true, 
                userName: user.first_name, 
                userId: user.id, 
                profilePic: user.profile_pic,
                isAdmin: user.is_admin // Frontend'e gönder
            });
        } else {
            res.status(401).json({ success: false, error: "Şifre hatalı." });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Sunucu hatası." });
    }
});

// Oturum Kontrol (Admin Bilgisi Eklendi)
app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            loggedIn: true, 
            userName: req.session.userName, 
            userId: req.session.userId,
            profilePic: req.session.profilePic,
            isAdmin: req.session.isAdmin // Frontend'e gönder
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

// Yorum Yapma API'si
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