// --- 1. HARİTA AYARLARI ---
var map = L.map('map').setView([39.8667, 32.7347], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

var markersLayer = L.layerGroup().addTo(map);
var allPlaces = []; 
let currentUser = null; 
let editingPlaceId = null; // Düzenleme modu için değişken

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

// --- 4. AKIŞ, YORUMLAR, DÜZENLEME VE SİLME ---
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
        
        // Yorumları Güvenli Hale Getir
        let commentsList = place.comments;
        if (typeof commentsList === 'string') {
            try { commentsList = JSON.parse(commentsList); } 
            catch (e) { commentsList = []; }
        } else if (!Array.isArray(commentsList)) {
            commentsList = [];
        }

        // --- BUTONLAR (SİLME VE DÜZENLEME) ---
        let actionBtns = '';
        if (currentUser && (currentUser.isAdmin || currentUser.userId === place.user_id)) {
            actionBtns = `
            <div style="position:absolute; top:15px; right:15px; display:flex; gap:5px; z-index:5;">
                <button class="btn-action btn-edit" onclick="editPlace(${place.id}, event)" title="Düzenle">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deletePlace(${place.id}, event)" title="Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`;
        }

        // Yorum HTML'i
        let commentsHtml = '';
        if(commentsList.length > 0) {
            commentsList.forEach(c => {
                const avatar = c.avatar || `https://ui-avatars.com/api/?name=${c.sender}&background=random&size=24`;
                commentsHtml += `
                    <div class="comment-item">
                        <img src="${avatar}" class="comment-avatar">
                        <div>
                            <span class="comment-user">${c.sender}</span>
                            <span class="comment-text">${c.text}</span>
                        </div>
                    </div>
                `;
            });
        }

        const card = document.createElement('div');
        card.className = 'feed-card';
        card.style.position = 'relative'; 
        card.innerHTML = `
            ${actionBtns}
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
                
                <div class="comments-section">
                    ${commentsHtml}
                </div>
                
                <form onsubmit="postComment(${place.id}, event)" class="comment-form">
                    <input type="text" name="commentText" placeholder="Yorum yaz..." autocomplete="off">
                    <button type="submit"><i class="fa-regular fa-paper-plane"></i></button>
                </form>

                <div class="card-footer">
                    <span><i class="fa-solid fa-location-arrow"></i> Haritada Git</span>
                </div>
            </div>
        `;
        
        // Tıklama olayları (Butonlara tıklayınca haritaya gitmesin)
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-action') && !e.target.closest('.comment-form') && !e.target.tagName.match(/INPUT|BUTTON/)) {
                map.flyTo([place.geometry.coordinates[1], place.geometry.coordinates[0]], 17);
                place.marker.openPopup();
            }
        });

        feedContainer.appendChild(card);
    });
}

// --- DÜZENLEME FONKSİYONU ---
function editPlace(id, event) {
    event.stopPropagation(); // Karta tıklamayı engelle
    
    const place = allPlaces.find(p => p.id === id);
    if(!place) return;

    // Formu doldur
    document.getElementById('placeName').value = place.name;
    document.getElementById('placeDesc').value = place.description;
    document.getElementById('placeCategory').value = place.type || 'diger';
    
    // Koordinatları al (Hata vermemesi için)
    document.getElementById('clickedLat').value = place.geometry.coordinates[1];
    document.getElementById('clickedLng').value = place.geometry.coordinates[0];

    // Düzenleme Moduna Geç
    editingPlaceId = id;
    document.querySelector('#addPlacePanel h3').textContent = "Mekanı Düzenle"; // Başlığı değiştir
    document.querySelector('#placeForm button[type="submit"]').textContent = "Güncelle";
    
    showPanel('addPlacePanel');
}

// YORUM GÖNDERME
function postComment(placeId, event) {
    event.preventDefault();
    event.stopPropagation(); 

    const input = event.target.commentText;
    const text = input.value;

    fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId, text })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            input.value = ''; 
            loadPlaces(); 
        } else {
            showToast(data.error || "Giriş yapmalısın!", "error");
        }
    });
}

// SİLME
function deletePlace(id, event) {
    event.stopPropagation();
    if(!confirm("Bu gönderiyi silmek istediğine emin misin?")) return;

    fetch(`/api/places/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            showToast("Gönderi silindi 🗑️", "success");
            loadPlaces();
        } else {
            showToast("Hata: " + data.error, "error");
        }
    });
}

function getIconUrl(type) {
    return icons[type] ? icons[type].options.iconUrl : icons['diger'].options.iconUrl;
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

// --- 6. ETKİLEŞİMLER VE FORM YÖNETİMİ ---
map.on('click', function(e) {
    fetch('/api/check-auth').then(r => r.json()).then(data => {
        if (data.loggedIn) {
            resetForm(); // Tıklayınca formu temizle (önceki düzenleme kalmasın)
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

// FORM GÖNDERME (POST ve PUT Ayırımı)
document.getElementById('placeForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    
    // EĞER DÜZENLEME MODUNDAYSAK (PUT)
    if (editingPlaceId) {
        fetch(`/api/places/${editingPlaceId}`, { 
            method: 'PUT', 
            body: formData 
        })
        .then(r => r.json())
        .then(d => {
            if(d.success) { 
                showToast("Mekan Güncellendi! 📝"); 
                resetForm(); // Formu sıfırla
                loadPlaces(); 
            } else { showToast("Hata: " + d.error, "error"); }
        });
    } 
    // EĞER YENİ EKLEME MODUNDAYSAK (POST)
    else {
        if(!document.getElementById('clickedLat').value) { showToast("Lütfen haritada bir yere tıkla!", "error"); return; }
        fetch('/api/places', { method: 'POST', body: formData })
        .then(r => r.json()).then(d => {
            if(d.success) { 
                showToast("Paylaşıldı 🎉"); 
                resetForm();
                loadPlaces(); 
            } else { showToast("Hata: " + d.error, "error"); }
        });
    }
});

// Formu temizleyen yardımcı fonksiyon
function resetForm() {
    document.getElementById('placeForm').reset();
    editingPlaceId = null;
    const titleEl = document.querySelector('#addPlacePanel h3');
    const btnEl = document.querySelector('#placeForm button[type="submit"]');
    
    // Başlık ve butonu eski haline getir (HTML yapısına göre)
    if(titleEl) titleEl.textContent = "Yeni Mekan Ekle";
    if(btnEl) btnEl.textContent = "Paylaş";
    
    showPanel('defaultAction');
}

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(Object.fromEntries(new FormData(this))) })
    .then(r => r.json()).then(d => {
        if(d.success) {
            updateUserStatus(true, d);
            showPanel('defaultAction');
            showToast(`Hoş geldin, ${d.userName}! 👋`);
            loadPlaces(); 
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
        renderFeed(allPlaces); 
    } else {
        currentUser = null;
        container.innerHTML = `<button onclick="showPanel('loginPanel')">Giriş Yap</button>`;
        renderFeed(allPlaces); 
    }
}

function openProfile() {
    if(!currentUser) return;
    document.getElementById('profileName').textContent = currentUser.userName;
    const avatarUrl = currentUser.profilePic ? currentUser.profilePic : `https://ui-avatars.com/api/?name=${currentUser.userName}&background=random&size=128`;
    const avatarImg = document.getElementById('profileAvatar');
    avatarImg.src = avatarUrl;
    avatarImg.style.objectFit = "cover";

    const myPlaces = allPlaces.filter(p => p.user_id === currentUser.userId);
    document.getElementById('myPostCount').textContent = myPlaces.length;
    
    const myFeed = document.getElementById('myFeedContent');
    myFeed.innerHTML = '';
    
    if(myPlaces.length === 0) {
        myFeed.innerHTML = '<p style="text-align:center; color:#999; font-size:0.9rem; padding:10px;">Henüz bir paylaşımın yok.</p>';
    } else {
        myPlaces.forEach(place => {
            const div = document.createElement('div');
            div.className = 'feed-card';
            div.style.padding = "10px";
            div.style.position = "relative";
            
            // Profilde de silme butonu olsun
            div.innerHTML = `
                <button class="btn-action btn-delete" onclick="deletePlace(${place.id}, event)" title="Sil" style="position:absolute; top:5px; right:5px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <div class="card-icon" style="width:35px; height:35px; font-size:1rem;"><img src="${getIconUrl(place.type)}" style="height:20px;"></div>
                <div class="card-content">
                    <h4 style="margin:0; font-size:0.95rem;">${place.name}</h4>
                    <small style="color:#666;">${place.formatted_time}</small>
                </div>`;
            myFeed.appendChild(div);
        });
    }
    showPanel('profilePanel');
}

function logout() { fetch('/api/logout').then(() => window.location.reload()); }

loadPlaces();
fetch('/api/check-auth').then(r => r.json()).then(d => { 
    updateUserStatus(d.loggedIn, d); 
});