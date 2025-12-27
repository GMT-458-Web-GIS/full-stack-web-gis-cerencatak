// --- 1. HARİTA AYARLARI ---
var map = L.map('map').setView([39.8667, 32.7347], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

var markersLayer = L.layerGroup().addTo(map);
var allPlaces = []; 
let currentUser = null; 

// --- 2. İKONLAR ---
const icons = {
    yemek: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    calisma: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    ulasim: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    sosyal: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    indirim: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', iconSize: [25, 41], iconAnchor: [12, 41] }),
    diger: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png', iconSize: [25, 41], iconAnchor: [12, 41] })
};

// --- 3. UI YÖNETİMİ ---
function showPanel(panelId) {
    ['defaultAction', 'addPlacePanel', 'loginPanel', 'registerPanel', 'profilePanel'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    const panel = document.getElementById(panelId);
    if(panel) {
        panel.style.display = 'block';
        if(panelId === 'addPlacePanel') document.getElementById('placeName').focus();
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast-notification show ${type}`;
    setTimeout(() => { toast.className = 'toast-notification'; }, 3000);
}

// --- 4. AKIŞ VE SİLME BUTONU ---
function renderFeed(places) {
    const feedContainer = document.getElementById('feedContent');
    feedContainer.innerHTML = ''; 

    if(places.length === 0) {
        feedContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Henüz hiç paylaşım yok. İlk sen ol! 👇</div>';
        return;
    }

    places.forEach(place => {
        const category = place.type || 'diger';
        const time = place.formatted_time || 'Az önce';
        
        // SİLME BUTONU MANTIĞI:
        // Eğer giriş yapmışsak VE (Kullanıcı Adminse VEYA Mekan bizimse)
        let deleteBtn = '';
        if (currentUser && (currentUser.isAdmin || currentUser.userId === place.user_id)) {
            deleteBtn = `<button class="btn-delete" onclick="deletePlace(${place.id}, event)" title="Sil">
                            <i class="fa-solid fa-trash"></i>
                         </button>`;
        }

        const card = document.createElement('div');
        card.className = 'feed-card';
        card.style.position = 'relative'; // Silme butonu için
        card.innerHTML = `
            ${deleteBtn}
            <div class="card-icon">
                <img src="${getIconUrl(category)}" style="height:30px;">
            </div>
            <div class="card-content">
                <div class="card-header">
                    <span><strong>Mekan Bildirimi</strong> &bull; ${time}</span>
                </div>
                <h4 style="margin:0 0 5px 0; color:#c0392b;">${place.name}</h4>
                <p class="card-text">${place.description}</p>
                ${place.media_url ? `<img src="${place.media_url}" class="card-image">` : ''}
                <div class="card-footer">
                    <span><i class="fa-regular fa-comment"></i> Yorum Yap</span>
                    <span><i class="fa-solid fa-share"></i> Git</span>
                </div>
            </div>
        `;
        
        // Karta tıklayınca git (Silme butonuna basınca gitmesin diye event kontrolü gerekir ama basit tutuyoruz)
        card.addEventListener('click', (e) => {
            // Eğer tıklanan şey silme butonu değilse git
            if (!e.target.closest('.btn-delete')) {
                map.flyTo([place.geometry.coordinates[1], place.geometry.coordinates[0]], 17);
                place.marker.openPopup();
            }
        });

        feedContainer.appendChild(card);
    });
}

function getIconUrl(type) {
    return icons[type] ? icons[type].options.iconUrl : icons['diger'].options.iconUrl;
}

// SİLME FONKSİYONU
function deletePlace(id, event) {
    event.stopPropagation(); // Karta tıklamayı engelle
    if(!confirm("Bu gönderiyi silmek istediğine emin misin?")) return;

    fetch(`/api/places/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            showToast("Gönderi silindi 🗑️", "success");
            loadPlaces(); // Listeyi yenile
        } else {
            showToast("Hata: " + data.error, "error");
        }
    });
}

// --- 5. VERİLERİ YÜKLE ---
function loadPlaces() {
    fetch('/api/places')
      .then(res => res.json())
      .then(data => {
        markersLayer.clearLayers();
        allPlaces = [];
        
        data.forEach(place => {
            const coords = [place.geometry.coordinates[1], place.geometry.coordinates[0]];
            const category = place.type || 'diger';
            const icon = icons[category] || icons['diger'];
            
            const marker = L.marker(coords, { icon: icon })
                .bindPopup(`<b>${place.name}</b><br>${place.description}`);
            
            markersLayer.addLayer(marker);
            allPlaces.push({ ...place, marker: marker, category: category });
        });

        // Kullanıcı verisi geldikten sonra feed'i render et
        // (Eğer currentUser null ise butonlar görünmez, auth check sonrası tekrar render ederiz)
        renderFeed(allPlaces);
      });
}

function filterFeed(category, btn) {
    document.querySelectorAll('.story-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    markersLayer.clearLayers();
    const filtered = category === 'all' ? allPlaces : allPlaces.filter(p => p.category === category);
    filtered.forEach(p => markersLayer.addLayer(p.marker));
    renderFeed(filtered);
}

// --- 6. ETKİLEŞİMLER ---
map.on('click', function(e) {
    fetch('/api/check-auth').then(r => r.json()).then(data => {
        if (data.loggedIn) {
            document.getElementById('clickedLat').value = e.latlng.lat;
            document.getElementById('clickedLng').value = e.latlng.lng;
            showPanel('addPlacePanel');
            showToast("Konum seçildi. Formu doldur! 👇", "success");
        } else {
            showToast("Önce giriş yapmalısın! 🔒", "error");
            showPanel('loginPanel');
        }
    });
});

document.getElementById('placeForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if(!document.getElementById('clickedLat').value) { showToast("Lütfen haritada bir yere tıkla!", "error"); return; }
    const formData = new FormData(this);
    fetch('/api/places', { method: 'POST', body: formData }).then(r => r.json()).then(d => {
        if(d.success) { 
            showToast("Paylaşıldı 🎉"); 
            showPanel('defaultAction'); 
            this.reset(); 
            loadPlaces(); 
        } else { showToast("Hata: " + d.error, "error"); }
    });
});

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(Object.fromEntries(new FormData(this))) })
    .then(r => r.json()).then(d => {
        if(d.success) {
            updateUserStatus(true, d);
            showPanel('defaultAction');
            showToast(`Hoş geldin, ${d.userName}! 👋`);
            loadPlaces(); // Giriş yapınca silme butonlarını görmek için listeyi yenile
        } else { showToast(d.error, "error"); }
    });
});

document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    fetch('/api/register', { method: 'POST', body: new FormData(this) })
    .then(r => r.json()).then(d => {
        if(d.success) { showToast("Kayıt başarılı! Giriş yap.", "success"); showPanel('loginPanel'); } 
        else { showToast(d.error, "error"); }
    });
});

// Profil Resmi Değiştirme
const avatarInput = document.getElementById('updateAvatarInput');
if(avatarInput) {
    avatarInput.addEventListener('change', function() {
        if(this.files[0]) {
            const fd = new FormData(); fd.append('profilePic', this.files[0]);
            fetch('/api/update-avatar', { method: 'POST', body: fd }).then(r => r.json()).then(d => {
                if(d.success) {
                    if(currentUser) currentUser.profilePic = d.newUrl;
                    updateUserStatus(true, currentUser);
                    showToast("Güncellendi! 📸", "success");
                }
            });
        }
    });
}

function updateUserStatus(loggedIn, userData) {
    const container = document.getElementById('userStatus');
    if(loggedIn) {
        currentUser = userData;
        const avatarUrl = userData.profilePic ? userData.profilePic : `https://ui-avatars.com/api/?name=${userData.userName}&background=random`;
        container.innerHTML = `<button onclick="openProfile()"><img src="${avatarUrl}" class="user-avatar" style="object-fit:cover;">${userData.userName}</button>`;
        renderFeed(allPlaces); // Admin girişi yapıldıysa butonları göstermek için tekrar render et
    } else {
        currentUser = null;
        container.innerHTML = `<button onclick="showPanel('loginPanel')">Giriş Yap</button>`;
        renderFeed(allPlaces); // Çıkış yapıldıysa butonları gizle
    }
}

function openProfile() {
    if(!currentUser) return;
    document.getElementById('profileName').textContent = currentUser.userName;
    const avatarUrl = currentUser.profilePic ? currentUser.profilePic : `https://ui-avatars.com/api/?name=${currentUser.userName}&background=random&size=128`;
    document.getElementById('profileAvatar').src = avatarUrl;
    
    const myPlaces = allPlaces.filter(p => p.user_id === currentUser.userId);
    document.getElementById('myPostCount').textContent = myPlaces.length;
    
    const myFeed = document.getElementById('myFeedContent');
    myFeed.innerHTML = '';
    
    // Profildeki "Kendi Gönderilerim" listesinde de silme butonu olsun
    myPlaces.forEach(place => {
        const div = document.createElement('div');
        div.className = 'feed-card';
        div.style.padding = "10px";
        div.style.position = "relative";
        div.innerHTML = `
            <button class="btn-delete" onclick="deletePlace(${place.id}, event)" title="Sil" style="top:5px; right:5px;">
                <i class="fa-solid fa-trash"></i>
            </button>
            <div class="card-icon" style="width:35px; height:35px; font-size:1rem;"><img src="${getIconUrl(place.type)}" style="height:20px;"></div>
            <div class="card-content">
                <h4 style="margin:0; font-size:0.95rem;">${place.name}</h4>
                <small style="color:#666;">${place.formatted_time}</small>
            </div>`;
        myFeed.appendChild(div);
    });
    showPanel('profilePanel');
}

function logout() { fetch('/api/logout').then(() => window.location.reload()); }

loadPlaces();
fetch('/api/check-auth').then(r => r.json()).then(d => { 
    updateUserStatus(d.loggedIn, d); 
});