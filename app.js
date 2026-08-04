// ==========================================
// KONFIGURASI
// ==========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzh6Rw5kB0osFXDFHYLzanmnkSdgFVh2zwOtT6x42TmdZlXchsUq5zWduMLgOZ6ZW4ooQ/exec";

let globalStudents = []; // Menyimpan data siswa kelas aktif
let presensiState = {};  // Menyimpan status H/S/I/A

// ==========================================
// UI HELPERS
// ==========================================
function setLiveDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('id-ID', options);
    
    // Set default tanggal form jurnal ke hari ini (YYYY-MM-DD)
    const todayISO = new Date().toISOString().split('T')[0];
    if(document.getElementById('jurnal-tanggal')) {
        document.getElementById('jurnal-tanggal').value = todayISO;
    }
}

function switchTab(tabId) {
    const sections = ['home', 'presensi', 'nilai-maju', 'penilaian', 'rekap'];
    sections.forEach(id => {
        document.getElementById(id).classList.add('hide-section');
    });
    document.getElementById(tabId).classList.remove('hide-section');
}

function showLoading(show) {
    const el = document.getElementById('loading-indicator');
    if(show) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

// ==========================================
// FUNGSI TARIK DATA (GET)
// ==========================================
async function loadKelas() {
    showLoading(true);
    try {
        const res = await fetch(`${GAS_URL}?action=getKelas`);
        const json = await res.json();
        const selectKelas = document.getElementById('global-kelas');
        
        json.data.forEach(kelas => {
            const opt = document.createElement('option');
            opt.value = kelas.id_kelas;
            opt.textContent = kelas.nama_kelas;
            selectKelas.appendChild(opt);
        });
    } catch (e) {
        alert("Gagal memuat kelas. Cek koneksi internet.");
    }
    showLoading(false);
}

async function loadSiswa() {
    const idKelas = document.getElementById('global-kelas').value;
    if (!idKelas) return;

    showLoading(true);
    try {
        const res = await fetch(`${GAS_URL}?action=getSiswa&id_kelas=${idKelas}`);
        const json = await res.json();
        globalStudents = json.data;
        
        renderPresensi();
        renderNilaiMaju();
        renderPenilaian();
    } catch (e) {
        alert("Gagal memuat data siswa.");
    }
    showLoading(false);
}

// ==========================================
// FUNGSI RENDER FORM (UPDATE ADA TAMBAHAN 'R')
// ==========================================
function renderPresensi() {
    const container = document.getElementById('list-presensi');
    container.innerHTML = '';
    presensiState = {};

    globalStudents.forEach((siswa, index) => {
        presensiState[siswa.id_siswa] = 'H'; // Default Hadir
        const no = index + 1;
        
        // Aku sedikit kecilkan ukuran tombol jadi w-7 h-7 agar 5 tombol muat sejajar dengan rapi di layar HP
        container.innerHTML += `
            <div class="bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between">
                <div class="w-[45%]">
                    <p class="text-xs font-bold text-gray-500">${no}. ${siswa.id_siswa}</p>
                    <p class="text-sm font-semibold text-gray-800 truncate">${siswa.nama_siswa}</p>
                </div>
                <div class="flex gap-1 w-[55%] justify-end">
                    <button onclick="setPresensi('${siswa.id_siswa}', 'H')" id="btn-H-${siswa.id_siswa}" class="w-7 h-7 rounded bg-green-500 text-white font-bold text-[11px]">H</button>
                    <button onclick="setPresensi('${siswa.id_siswa}', 'S')" id="btn-S-${siswa.id_siswa}" class="w-7 h-7 rounded bg-gray-200 text-gray-600 font-bold text-[11px]">S</button>
                    <button onclick="setPresensi('${siswa.id_siswa}', 'I')" id="btn-I-${siswa.id_siswa}" class="w-7 h-7 rounded bg-gray-200 text-gray-600 font-bold text-[11px]">I</button>
                    <button onclick="setPresensi('${siswa.id_siswa}', 'A')" id="btn-A-${siswa.id_siswa}" class="w-7 h-7 rounded bg-gray-200 text-gray-600 font-bold text-[11px]">A</button>
                    <button onclick="setPresensi('${siswa.id_siswa}', 'R')" id="btn-R-${siswa.id_siswa}" class="w-7 h-7 rounded bg-gray-200 text-gray-600 font-bold text-[11px]">R</button>
                </div>
            </div>
        `;
    });
}

function setPresensi(idSiswa, status) {
    presensiState[idSiswa] = status;
    const statuses = ['H', 'S', 'I', 'A', 'R'];
    
    // Reset warna semua tombol siswa ini
    statuses.forEach(s => {
        const btn = document.getElementById(`btn-${s}-${idSiswa}`);
        // Tambahkan warna purple-500 di dalam daftar reset
        btn.classList.remove('bg-green-500', 'bg-yellow-400', 'bg-blue-400', 'bg-red-500', 'bg-purple-500', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-600');
    });

    // Beri warna tombol yang aktif
    const activeBtn = document.getElementById(`btn-${status}-${idSiswa}`);
    activeBtn.classList.remove('bg-gray-200', 'text-gray-600');
    activeBtn.classList.add('text-white');
    
    if(status === 'H') activeBtn.classList.add('bg-green-500');
    if(status === 'S') activeBtn.classList.add('bg-yellow-400'); // Kuning untuk Sakit
    if(status === 'I') activeBtn.classList.add('bg-blue-400');   // Biru untuk Izin
    if(status === 'A') activeBtn.classList.add('bg-red-500');    // Merah untuk Alfa
    if(status === 'R') activeBtn.classList.add('bg-purple-500'); // Ungu untuk Rekom
}
function renderNilaiMaju() {
    const container = document.getElementById('list-nilai-maju');
    container.innerHTML = '';
    
    globalStudents.forEach((siswa, index) => {
        container.innerHTML += `
            <div class="bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between">
                <div class="w-1/2">
                    <p class="text-sm font-semibold text-gray-800 truncate">${index+1}. ${siswa.nama_siswa}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="submitNilaiMaju('${siswa.id_siswa}', 5)" class="bg-amber-100 text-amber-700 active:bg-amber-500 active:text-white px-3 py-1 rounded-full font-bold text-sm transition-colors border border-amber-300">+5</button>
                    <button onclick="submitNilaiMaju('${siswa.id_siswa}', 10)" class="bg-amber-100 text-amber-700 active:bg-amber-500 active:text-white px-3 py-1 rounded-full font-bold text-sm transition-colors border border-amber-300">+10</button>
                </div>
            </div>
        `;
    });
}

function renderPenilaian() {
    const container = document.getElementById('list-penilaian');
    container.innerHTML = '';
    
    globalStudents.forEach((siswa, index) => {
        container.innerHTML += `
            <div class="bg-white p-2 rounded-lg border shadow-sm flex items-center justify-between">
                <p class="text-sm font-semibold text-gray-800 w-2/3 truncate">${index+1}. ${siswa.nama_siswa}</p>
                <input type="number" id="nilai-${siswa.id_siswa}" placeholder="0" class="w-16 p-1 text-center border rounded font-bold text-emerald-600 outline-none focus:border-emerald-500">
            </div>
        `;
    });
}

// ==========================================
// FUNGSI PENGIRIMAN DATA (POST)
// ==========================================
async function submitJurnalPresensi() {
    const idKelas = document.getElementById('global-kelas').value;
    if(!idKelas) return alert("Pilih kelas dulu!");

    const payload = {
        action: "saveJurnalPresensi",
        tanggal: document.getElementById('jurnal-tanggal').value,
        id_kelas: idKelas,
        jam_ke: document.getElementById('jurnal-jam').value,
        materi_tp: document.getElementById('jurnal-materi').value,
        aktivitas: document.getElementById('jurnal-aktivitas').value,
        catatan: document.getElementById('jurnal-catatan').value,
        data_presensi: Object.keys(presensiState).map(id => ({
            id_siswa: id,
            status: presensiState[id]
        }))
    };

    showLoading(true);
    await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
    showLoading(false);
    alert("Jurnal dan Presensi berhasil disimpan!");
}

async function submitNilaiMaju(idSiswa, poin) {
    const todayISO = new Date().toISOString().split('T')[0];
    
    const payload = {
        action: "saveNilaiMaju",
        tanggal: todayISO,
        id_siswa: idSiswa,
        poin: poin
    };

    // Optimistic UI (Langsung kasih notifikasi tanpa nunggu loading lama)
    alert(`Berhasil menambah +${poin} poin!`); 
    await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
}

async function submitPenilaian() {
    const idKelas = document.getElementById('global-kelas').value;
    if(!idKelas) return alert("Pilih kelas dulu!");

    const arrNilai = [];
    globalStudents.forEach(siswa => {
        const nilaiInput = document.getElementById(`nilai-${siswa.id_siswa}`).value;
        if(nilaiInput !== "") {
            arrNilai.push({ id_siswa: siswa.id_siswa, nilai: parseInt(nilaiInput) });
        }
    });

    if(arrNilai.length === 0) return alert("Belum ada nilai yang diinput!");

    const payload = {
        action: "savePenilaian",
        tanggal: new Date().toISOString().split('T')[0],
        id_kelas: idKelas,
        jenis: document.getElementById('penilaian-jenis').value,
        nama_penilaian: document.getElementById('penilaian-judul').value,
        data_nilai: arrNilai
    };

    showLoading(true);
    await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
    showLoading(false);
    alert("Data penilaian berhasil disimpan!");
}

// Inisialisasi awal
window.onload = () => {
    setLiveDate();
    loadKelas();
};
async function loadRekapData() {
    const idKelas = document.getElementById('global-kelas').value;
    if (!idKelas) return alert("Pilih kelas di atas dulu!");

    showLoading(true);
    try {
        const res = await fetch(`${GAS_URL}?action=getRekap`);
        const json = await res.json();
        
        if(json.status === "success") {
            const allPresensi = json.data.presensi;
            const allMaju = json.data.nilaiMaju;

            // 1. Render Rekap Presensi
            const tbodyPresensi = document.getElementById('table-rekap-presensi');
            tbodyPresensi.innerHTML = '';

            globalStudents.forEach(siswa => {
                // Hitung jumlah H/S/I/A/R per siswa
                const presensiSiswa = allPresensi.filter(p => String(p.id_siswa) === String(siswa.id_siswa));
                const count = { H: 0, S: 0, I: 0, A: 0, R: 0 };
                presensiSiswa.forEach(p => {
                    if (count[p.status] !== undefined) count[p.status]++;
                });

                tbodyPresensi.innerHTML += `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="p-2 font-medium text-gray-800 truncate max-w-[120px]">${siswa.nama_siswa}</td>
                        <td class="p-2 text-center font-bold text-green-600">${count.H}</td>
                        <td class="p-2 text-center font-bold text-yellow-600">${count.S}</td>
                        <td class="p-2 text-center font-bold text-blue-600">${count.I}</td>
                        <td class="p-2 text-center font-bold text-red-600">${count.A}</td>
                        <td class="p-2 text-center font-bold text-purple-600">${count.R}</td>
                    </tr>
                `;
            });

            // 2. Render Rekap Nilai Maju
            const tbodyMaju = document.getElementById('table-rekap-maju');
            tbodyMaju.innerHTML = '';

            globalStudents.forEach(siswa => {
                const majuSiswa = allMaju.filter(m => String(m.id_siswa) === String(siswa.id_siswa));
                const totalPoin = majuSiswa.reduce((sum, item) => sum + Number(item.poin || 0), 0);

                tbodyMaju.innerHTML += `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="p-2 font-medium text-gray-800 truncate max-w-[150px]">${siswa.nama_siswa}</td>
                        <td class="p-2 text-right font-extrabold text-amber-600">+${totalPoin}</td>
                    </tr>
                `;
            });
        }
    } catch (e) {
        alert("Gagal memuat data rekap.");
    }
    showLoading(false);
}

// Otomatis load rekap saat tab Rekap diklik
const originalSwitchTab = switchTab;
switchTab = function(tabId) {
    originalSwitchTab(tabId);
    if (tabId === 'rekap') {
        loadRekapData();
    }
};
