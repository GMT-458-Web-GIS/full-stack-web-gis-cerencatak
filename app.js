const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs'); 
const session = require('express-session');
const pool = require('./config/db');

const app = express();
const port = 3000;

// --- 1. ARA YAZILIMLAR (MIDDLEWARE) ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- 2. OTURUM AYARLARI ---
// Not: Bu kısım mutlaka rotalardan (GET/POST) önce tanımlanmalıdır.
app.use(session({
    secret: 'student-save-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Localhost üzerinde false olmalı
        maxAge: 24 * 60 * 60 * 1000 // 1 gün
    }
}));

// --- 3. DOSYA YÜKLEME AYARLARI ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: 'public/uploads/' });

// --- 4. ROTALAR (API) ---

// Mekanları Getir
app.get('/api/places', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, description, type, media_url, 
            ST_AsGeoJSON(geom)::json as geometry FROM places
        `);
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
    try {
        await pool.query(
            `INSERT INTO places (name, description, type, media_url, geom) 
             VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))`,
            [name, description, category, mediaUrl, lng, lat]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Kaydedilemedi" });
    }
});

// Yeni Öğrenci Kaydı
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, studentId, email, password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        await pool.query(
            `INSERT INTO users (first_name, last_name, student_id, email, password_hash) 
             VALUES ($1, $2, $3, $4, $5)`,
            [firstName, lastName, studentId, email, hashedPassword]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        console.error("Kayıt Hatası:", err);
        res.status(500).json({ success: false, error: "Kayıt veritabanına eklenemedi." });
    }
});

// Kullanıcı Girişi
app.post('/api/login', async (req, res) => {
    const { loginId, password } = req.body;
    try {
        const userQuery = 'SELECT * FROM users WHERE email = $1 OR student_id = $2';
        const result = await pool.query(userQuery, [loginId, loginId]);

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: "Öğrenci bulunamadı." });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (isMatch) {
            req.session.userId = user.id;
            req.session.userName = user.first_name;
            res.json({ success: true, userName: user.first_name });
        } else {
            res.status(401).json({ success: false, error: "Hatalı şifre!" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Sunucu hatası." });
    }
});

// Oturum Kontrolü
app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ loggedIn: true, userName: req.session.userName });
    } else {
        res.json({ loggedIn: false });
    }
});

// Çıkış Yap
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// --- 5. SUNUCU BAŞLAT ---
app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde hazır!`);
});