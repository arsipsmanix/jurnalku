// Ganti dengan URL Web App dari Google Apps Script yang baru saja kamu deploy
const GAS_URL = "https://script.google.com/macros/s/AKfycbzh6Rw5kB0osFXDFHYLzanmnkSdgFVh2zwOtT6x42TmdZlXchsUq5zWduMLgOZ6ZW4ooQ/exec";

// Set Tanggal Live di Header Mobile
function setLiveDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date().toLocaleDateString('id-ID', options);
    document.getElementById('current-date').textContent = today;
}

// Logika Perpindahan Tab (SPA Navigation)
function switchTab(tabId) {
    // Sembunyikan semua section
    const sections = ['home', 'presensi', 'nilai', 'rekap'];
    sections.forEach(id => {
        document.getElementById(id).classList.add('hide-section');
    });

    // Tampilkan section yang dipilih
    document.getElementById(tabId).classList.remove('hide-section');

    // Update warna active state di Bottom Navigation (Mobile)
    if (window.innerWidth < 768) {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach((btn, index) => {
            if (sections[index] === tabId) {
                btn.classList.replace('text-gray-400', 'text-blue-600');
            } else {
                btn.classList.replace('text-blue-600', 'text-gray-400');
            }
        });
    }
}

// Inisialisasi saat aplikasi pertama dibuka
window.onload = () => {
    setLiveDate();
};