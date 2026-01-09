# 📍 Hacettepe Social
## Full-Stack Web GIS Project

Bu proje, **GMT 458 – Web GIS** dersi final ödevi kapsamında geliştirilmiş, **konum tabanlı bir kampüs etkileşim platformudur**.  
Uygulama, kampüs içerisindeki anlık durumları **coğrafi (spatial) veriler** ile birleştirerek kullanıcıya sunmayı amaçlamaktadır.

Canlı ortamda çalışan, kullanıcı rolleri olan, API tabanlı ve mekansal veri yönetimi içeren **tam kapsamlı bir Web GIS uygulamasıdır**.

---

## 🎯 Proje Kapsamında Gerçekleştirilen Teknik Maddeler

Ödev yönergesinde belirtilen kriterler doğrultusunda projede aşağıdaki teknik gereksinimler eksiksiz olarak hayata geçirilmiştir.

---

## 1. Hosting on AWS 

- Uygulama tamamen **AWS EC2** bulut sunucusu üzerinde host edilmektedir.
- Sunucu süreç yönetimi **PM2 (Process Manager)** ile sağlanmaktadır.
- Proje canlı (live) olarak aşağıdaki adresten erişilebilir: http://63.177.100.32:3000

---

## 2. Authentication 

Kullanıcı kimlik doğrulama ve yetkilendirme süreçleri aşağıdaki şekilde uygulanmıştır:

- Kullanıcılar sisteme **Sign-up / Login** mekanizması ile giriş yapmaktadır.
- Kayıt sırasında **profil fotoğrafı yükleme** desteği mevcuttur.
- Güvenlik amacıyla:
  - Şifreler veritabanında **bcrypt** kullanılarak **hash’lenmiş** şekilde saklanmaktadır.
- Oturum yönetimi ve yetkilendirme kontrolü:
  - **express-session** kullanılarak sağlanmıştır.

---
![alt text](<Ekran görüntüsü 2026-01-10 004031.png>)
![alt text](<Ekran görüntüsü 2026-01-10 004043.png>)

## 3. CRUD Operations

Coğrafi bir **Point katmanı (places tablosu)** üzerinde tüm CRUD işlemleri başarıyla uygulanmıştır.

### Create
- Harita üzerine tıklanarak yeni **mekan / durum bildirimi** oluşturulabilmektedir.
![alt text](<Ekran görüntüsü 2026-01-10 004436.png>)
![alt text](<Ekran görüntüsü 2026-01-10 004500.png>)
### Read
- Mekanlar hem:
  - Harita üzerinde
  - Liste görünümünde
  dinamik olarak görüntülenmektedir.

### Update
- Kullanıcılar:
  - Profil bilgilerini
  - Profil fotoğraflarını
  güncelleyebilmektedir.

### Delete
- Paylaşımlar:
  - İlgili kullanıcı tarafından
  - veya **Admin** tarafından
  silinebilmektedir.

### Filtreleme
- Kullanıcılar verileri kategori bazlı filtreleyebilmektedir:
  - Yemek
  - Sosyal
  - Ulaşım
  - vb.

---

## 4. API Development 

Uygulama, **RESTful API** mimarisi ile geliştirilmiştir ve hem:

- **Spatial (mekansal)**
- **Non-spatial (mekansal olmayan)**

verileri expose eden bir yapıdadır.

### Minimum Teknik Gereksinimler

GET    /api/places  
POST   /api/places  
POST   /api/update-avatar  
DELETE /api/places/:id  

- GET /api/places  
  Mekansal (spatial) veri döndürür.

- POST /api/places  
  Yeni spatial feature oluşturur.

- POST /api/update-avatar  
  Mevcut öznitelikleri günceller.

- DELETE /api/places/:id  
  Spatial feature siler.

### API Dokümantasyonu

- API dokümantasyonu **Swagger UI** entegrasyonu ile sağlanmıştır.
- Dokümantasyona aşağıdaki adresten erişilebilir:

/api-docs

---

## 5. Managing Different User Types

Sistemde **rol, sahiplik ve yetkilendirme kuralları** tanımlanmıştır.

### Öğrenci (User)
- Kendi paylaşımlarını:
  - Oluşturabilir
  - Güncelleyebilir
  - Silebilir

### Yönetici (Admin)
- Tüm içerikleri:
  - Denetleyebilir
  - Gerekli durumlarda silebilir

### Ziyaretçi (Guest)
- Harita üzerindeki verileri görüntüleyebilir.
- Paylaşım yapamaz.
- İçerik eklemek için giriş zorunludur.

---

## 6. Managing Source-Code 

- Proje kaynak kodları **GitHub** üzerinden yönetilmektedir.
- Proje süresince:
  - Farklı günlerde yapılmış
  - En az **5 adet anlamlı (concise) commit**
  bulunmaktadır.
- Versiyon kontrolü ve proje gelişimi düzenli olarak takip edilmiştir.

---

## 🛠️ Teknolojik Altyapı

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL
- PostGIS (Relational Spatial Database)

### GIS & Mapping
- Leaflet.js

### Frontend / UI
- HTML5
- CSS3
- FontAwesome
- Google Fonts

---

## 📌 Özet

**Hacettepe Social**, Web GIS dersinin tüm teknik gereksinimlerini karşılayan;

- Canlı ortamda çalışan
- Mekansal veri kullanan
- Kullanıcı rolleri içeren
- API tabanlı
- Ölçeklenebilir


---
Ceren ÇATAK
2210674041
GMT 458 – Web GIS Final Project
