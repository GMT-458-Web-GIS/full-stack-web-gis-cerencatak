const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// 1. Statik Dosyaları Tanımlama
// 'public' klasörü içindeki HTML, CSS ve JS dosyalarının dışarıya sunulmasını sağlar.
app.use(express.static('public'));

// 2. JSON Desteği
// Sunucunun gelen karmaşık verileri (JSON) anlamasını sağlar.
app.use(express.json());

// 3. Ana Sayfa Yönlendirmesi
// Tarayıcıya http://localhost:3000 yazıldığında 'public/index.html' dosyasını açar.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 4. Sunucuyu Başlatma
app.listen(port, () => {
  console.log(`--------------------------------------------------`);
  console.log(`Student-Save Sunucusu Hazır!`);
  console.log(`Adres: http://localhost:${port}`);
  console.log(`--------------------------------------------------`);
});