// 1. Haritayı Hacettepe Beytepe Kampüsü koordinatlarıyla başlat

var map = L.map('map').setView([39.8658, 32.7339], 15);

// 2. Altlık haritayı (OpenStreetMap) ekle
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 3. Kampüsün ortasına bir marker (işaretçi) ekle
var marker = L.marker([39.8658, 32.7339]).addTo(map);

// İşaretçiye tıklandığında açılacak mesaj
marker.bindPopup("<b>Hacettepe Üniversitesi</b><br>Beytepe Kampüsü").openPopup();