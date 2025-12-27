/// 1. Haritayı Beytepe Kampüsü'ne odakla
var map = L.map('map').setView([39.8667, 32.7347], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// 2. Kategori Bazlı İkon Tanımlamaları
const icons = {
    yemek: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    calisma: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    indirim: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    ulasim: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    sosyal: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    saglik: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    hizmet: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    idari: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png', iconSize: [25, 41], iconAnchor: [12, 41] })
};

// Global Marker Listesi (Filtreleme için)
let allMarkers = [];

// 3. HTML'deki Modal Elemanları
const modal = document.getElementById('placeModal');
const form = document.getElementById('placeForm');
const latInput = document.getElementById('clickedLat');
const lngInput = document.getElementById('clickedLng');

function closeModal() {
    modal.style.display = 'none';
    form.reset(); 
}

// 4. Haritaya Tıklama Olayı
// map.js içindeki tıklama olayını korumaya alalım
map.on('click', function(e) {
    // Oturum kontrolü
    fetch('/api/check-auth')
        .then(res => res.json())
        .then(data => {
            if (data.loggedIn) {
                latInput.value = e.latlng.lat;
                lngInput.value = e.latlng.lng;
                document.getElementById('placeModal').style.display = 'block';
            } else {
                alert("Mekan eklemek için lütfen öğrenci girişi yapın! 🎓");
                openLoginModal();
            }
        });
});

// 5. Form Gönderildiğinde (Kaydet)
form.addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(form);
    const category = document.getElementById('category').value;

    fetch('/api/places', {
        method: 'POST',
        body: formData 
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert("Mekan başarıyla kaydedildi!");
            
            const name = document.getElementById('placeName').value;
            const desc = document.getElementById('placeDesc').value;
            const lat = latInput.value;
            const lng = lngInput.value;

            // Yeni marker oluştur ve listeye ekle
            createMarker(name, desc, category, data.mediaUrl, [lat, lng]);

            closeModal();
        }
    })
    .catch(err => console.error("Hata:", err));
});

// 6. Marker Oluşturma Yardımcı Fonksiyonu
function createMarker(name, description, category, mediaUrl, coords) {
    let popupContent = `<b>${name}</b> <small>(${category})</small><br>${description}`;
    
    if (mediaUrl) {
        if(mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm')) {
            popupContent += `<br><video src="${mediaUrl}" width="200" controls style="margin-top:10px;"></video>`;
        } else {
            popupContent += `<br><img src="${mediaUrl}" width="200" style="margin-top:10px; border-radius:5px;">`;
        }
    }

    const marker = L.marker(coords, { icon: icons[category] || icons.idari })
                    .addTo(map)
                    .bindPopup(popupContent);
    
    // Filtreleme için sakla
    allMarkers.push({ marker, category });
}

// 7. Filtreleme Fonksiyonu
function filterMarkers() {
    const selected = document.getElementById('filterCategory').value;
    
    allMarkers.forEach(item => {
        if (selected === 'all' || item.category === selected) {
            map.addLayer(item.marker);
        } else {
            map.removeLayer(item.marker);
        }
    });
}

// 8. Mevcut Mekanları Veritabanından Yükle

// map.js içindeki loadPlaces fonksiyonu:
function loadPlaces() {
    fetch('/api/places')
      .then(res => res.json())
      .then(data => {
        data.forEach(place => {
            const coords = place.geometry.coordinates;
            // Veritabanındaki sütun adımız 'type'
            const category = place.type || 'diger'; 
            
            createMarker(place.name, place.description, category, place.media_url, [coords[1], coords[0]]);
        });
      });
}
// Uygulamayı başlat
loadPlaces();

// Kayıt Modalı Fonksiyonları
function openRegisterModal() {
    document.getElementById('registerModal').style.display = 'block';
}

function closeRegisterModal() {
    document.getElementById('registerModal').style.display = 'none';
    document.getElementById('registerForm').reset();
}

// Kayıt Formu Submit
document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
        if(result.success) {
            alert("Harika! Artık kayıtlı bir öğrencisin. Şimdi giriş yapabilirsin.");
            closeRegisterModal();
        } else {
            alert("Hata: " + result.error);
        }
    })
    .catch(err => console.error("Kayıt hatası:", err));
});


// --- map.js sonuna eklenecek Login ve UI yönetimi ---

const authPanel = document.getElementById('authPanel');

function openLoginModal() { document.getElementById('loginModal').style.display = 'block'; }
function closeLoginModal() { document.getElementById('loginModal').style.display = 'none'; }

// Giriş Formu Gönderme
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
        if(result.success) {
            updateUI(true, result.userName);
            closeLoginModal();
        } else {
            alert("Hata: " + result.error);
        }
    });
});

// Arayüzü Güncelle (Hoş geldin mesajı göster)
function updateUI(loggedIn, userName) {
    if (loggedIn) {
        authPanel.innerHTML = `
            <span style="color:white; margin-right:15px;">Hoş geldin, <b>${userName}</b>!</span>
            <button class="btn-auth" onclick="logout()">Çıkış Yap</button>
        `;
    } else {
        authPanel.innerHTML = `
            <button class="btn-auth" onclick="openLoginModal()">Giriş Yap</button>
            <button class="btn-auth" onclick="openRegisterModal()">Kayıt Ol</button>
        `;
    }
}

// Çıkış Yapma Fonksiyonu
function logout() {
    fetch('/api/logout').then(() => {
        window.location.reload(); // Sayfayı yenile ve oturumu kapat
    });
}

// SAYFA YÜKLENDİĞİNDE: Oturumu kontrol et
fetch('/api/check-auth')
    .then(res => res.json())
    .then(data => {
        if (data.loggedIn) updateUI(true, data.userName);
    });


// Sayfa açıldığında oturum açık mı kontrol et
fetch('/api/check-auth')
    .then(res => res.json())
    .then(data => {
        if (data.loggedIn) {
            updateUI(true, data.userName);
        }
    });    