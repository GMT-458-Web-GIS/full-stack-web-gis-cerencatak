const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const pool = require('./config/db');

const app = express();
const port = 3000;


const bcrypt = require('bcryptjs');
const session = require('express-session');

// Session (Oturum) ayarları
app.use(session({
    secret: 'hacettepe-gizli-anahtar', // Güvenlik için rastgele bir metin
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Geliştirme aşamasında false, canlıda true olur
}));

// API: Kullanıcı Kaydı (Register)
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    try {
        // 1. Şifreyi şifrele (Hashle)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // 2. Veritabanına kaydet
        const query = 'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id';
        const result = await pool.query(query, [username, email, hashedPassword]);
        
        res.status(201).json({ success: true, message: "Kayıt başarılı!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Kullanıcı adı veya e-posta zaten kullanımda." });
    }
});

// 1. Dosya Yükleme Ayarları (Multer)
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/'); // Dosyaların kaydedileceği yer
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Maksimum 10MB
});

// 2. Middleware (Ara Yazılımlar)
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Ana Sayfa Yönlendirmesi
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 4. API: Tüm mekanları getir (Filtreleme için 'type' sütunu dahil)
app.get('/api/places', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, description, type, media_url, 
            ST_AsGeoJSON(geom)::json as geometry 
            FROM places
        `); // 'type' verisi filtreleme için kritik
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Sunucu hatası');
    }
});

// 5. API: Yeni mekan kaydet (CRUD - Create)
// upload.single('mediaFile') -> index.html'deki input name ile aynı olmalı
app.post('/api/places', upload.single('mediaFile'), async (req, res) => {
    const { name, description, lat, lng, category } = req.body; 
    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const query = `
            INSERT INTO places (name, description, type, media_url, geom) 
            VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))
            RETURNING id;
        `;
        // PostGIS için sıralama: [lng, lat]
        const values = [name, description, category, mediaUrl, lng, lat]; 
        
        const result = await pool.query(query, values);
        res.status(201).json({ 
            success: true, 
            id: result.rows[0].id, 
            mediaUrl: mediaUrl 
        });
    } catch (err) {
        console.error("Veritabanı kayıt hatası:", err);
        res.status(500).json({ error: "Veritabanına kaydedilemedi" });
    }
});

// 6. Sunucuyu Başlatma
app.listen(port, () => {
    console.log(`--------------------------------------------------`);
    console.log(`Student-Save Sunucusu Hazır!`);
    console.log(`Adres: http://localhost:${port}`);
    console.log(`--------------------------------------------------`);
});