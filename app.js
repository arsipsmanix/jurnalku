// ==========================================
// KONFIGURASI
// ==========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzh6Rw5kB0osFXDFHYLzanmnkSdgFVh2zwOtT6x42TmdZlXchsUq5zWduMLgOZ6ZW4ooQ/exec";

let globalStudents = []; // Menyimpan data siswa kelas aktif
let presensiState = {};  // Menyimpan status H/S/I/A
let globalRekapCache = null; // Menyimpan data rekap sementara untuk fitur Edit
let currentEditingJurnalId = null; // KTP untuk mengingat ID Jurnal saat mode Edit

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
    try {
        // 1. Sembunyikan semua section
        const sections = ['home', 'presensi', 'nilai-maju', 'penilaian', 'rekap'];
        sections.forEach(id => {
            const sec = document.getElementById(id);
            if (sec) {
                sec.classList.add('hide-section');
            }
        });

        // 2. Tampilkan section yang dituju
        const targetSection = document.getElementById(tabId);
        if (targetSection) {
            targetSection.classList.remove('hide-section');
        }

        // 3. Reset warna & style semua tombol navigasi
        document.querySelectorAll('button[onclick^="switchTab"]').forEach(btn => {
            btn.classList.remove('text-blue-600', 'bg-blue-50', 'font-bold');
            if(btn.classList.contains('w-1/5')) {
                btn.classList.add('text-gray-500'); // warna icon bawah
            } else {
                btn.classList.add('text-gray-700'); // warna text sidebar
            }
        });

        // 4. Beri efek "Aktif"/Nyala pada tombol yang sedang diklik (Sidebar & Bottom bar)
        document.querySelectorAll(`button[onclick="switchTab('${tabId}')"]`).forEach(btn => {
            btn.classList.remove('text-gray-500', 'text-gray-700');
            btn.classList.add('text-blue-600', 'font-bold');
            if (btn.classList.contains('text-left')) {
                btn.classList.add('bg-blue-50');
            }
        });

        // 5. Otomatis load data rekap jika tab rekap diklik
        if (tabId === 'rekap') {
            loadRekapData();
        }

        // Scroll mulus ke atas
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Navigasi Error:", error);
    }
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
        
        // Panggil fungsi tarik data rekap di latar belakang untuk fitur Edit
        fetchRekapForEdit(idKelas);
    } catch (e) {
        alert("Gagal memuat data siswa.");
    }
    showLoading(false);
}

async function fetchRekapForEdit(idKelas) {
    try {
        const res = await fetch(`${GAS_URL}?action=getRekap`);
        const json = await res.json();
        if(json.status === "success") {
            globalRekapCache = json.data;
            checkExistingJurnal(); // Cek langsung barangkali form tanggal/jam sudah terisi
        }
    } catch(e) {
        console.error("Gagal load rekap untuk edit", e);
    }
}

function checkExistingJurnal() {
    if (!globalRekapCache || !globalRekapCache.jurnal) return;
    
    const idKelas = document.getElementById('global-kelas').value;
    const tanggal = document.getElementById('jurnal-tanggal').value;
    const jamKe = document.getElementById('jurnal-jam').value ? document.getElementById('jurnal-jam').value.trim() : '';

    if (!idKelas || !tanggal || !jamKe) {
        currentEditingJurnalId = null; // Reset KTP
        return;
    }

    // Cari data jurnal yang cocok (Kelas, Tanggal, Jam)
    const existingJurnal = globalRekapCache.jurnal.find(j => {
        let tglSheet = "";
        if (j.tanggal) {
            // Konversi aman dari jebakan UTC: pecah tanggal berdasarkan waktu lokal laptop/HP
            const d = new Date(j.tanggal);
            tglSheet = d.getFullYear() + '-' + 
                       String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(d.getDate()).padStart(2, '0');
        }
        return String(j.id_kelas) === String(idKelas) && 
               tglSheet === tanggal && 
               String(j.jam_ke).trim() === jamKe;
    });

    if (existingJurnal) {
        // JURNAL KETEMU! Simpan ID-nya untuk mode Update
        currentEditingJurnalId = existingJurnal.id_jurnal;

        // Isi form materinya
        document.getElementById('jurnal-materi').value = existingJurnal.materi_tp || "";
        document.getElementById('jurnal-aktivitas').value = existingJurnal.aktivitas || "";
        document.getElementById('jurnal-catatan').value = existingJurnal.catatan || "";

        // Cari & nyalakan presensi untuk jurnal ini
        const existingPresensi = globalRekapCache.presensi.filter(p => String(p.id_jurnal) === String(existingJurnal.id_jurnal));
        
        if (existingPresensi.length > 0) {
            existingPresensi.forEach(p => {
                if(presensiState[p.id_siswa] !== undefined) {
                    setPresensi(p.id_siswa, p.status);
                }
            });
        }
    } else {
        // JIKA TIDAK KETEMU! Kosongkan ID dan bersihkan form ke default (H)
        currentEditingJurnalId = null;
        
        document.getElementById('jurnal-materi').value = "";
        document.getElementById('jurnal-aktivitas').value = "";
        document.getElementById('jurnal-catatan').value = "";
        
        globalStudents.forEach(siswa => {
            setPresensi(siswa.id_siswa, 'H');
        });
    }
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
            <div class="bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between gap-2">
                <div class="w-1/2">
                    <p class="text-xs font-bold text-gray-500">${index+1}. ${siswa.id_siswa}</p>
                    <p class="text-sm font-semibold text-gray-800 truncate">${siswa.nama_siswa}</p>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" id="nilai-${siswa.id_siswa}" placeholder="0" class="w-16 p-1 text-center border rounded font-bold text-emerald-600 outline-none focus:border-emerald-500">
                    <label class="flex items-center gap-1 cursor-pointer bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        <input type="checkbox" id="check-belum-${siswa.id_siswa}" onchange="toggleBelum('${siswa.id_siswa}')" class="rounded text-red-500 focus:ring-0">
                        <span class="text-[10px] font-bold text-red-500 select-none">Belum</span>
                    </label>
                </div>
            </div>
        `;
    });
}

// Handler saat centang "Belum" diklik
function toggleBelum(idSiswa) {
    const isChecked = document.getElementById(`check-belum-${idSiswa}`).checked;
    const inputNilai = document.getElementById(`nilai-${idSiswa}`);
    
    if (isChecked) {
        inputNilai.value = 0;
        inputNilai.disabled = true;
        inputNilai.classList.add('bg-gray-100', 'text-gray-400');
    } else {
        inputNilai.value = '';
        inputNilai.disabled = false;
        inputNilai.classList.remove('bg-gray-100', 'text-gray-400');
    }
}
// ==========================================
// FUNGSI PENGIRIMAN DATA (POST)
// ==========================================
async function submitJurnalPresensi() {
    const idKelas = document.getElementById('global-kelas').value;
    if(!idKelas) return alert("Pilih kelas dulu!");

    const btn = document.getElementById('btn-simpan-jurnal');
    if(btn) {
        btn.disabled = true;
        btn.classList.add('bg-gray-400', 'cursor-not-allowed');
        btn.innerText = 'Menyimpan...';
    }

    const payload = {
        action: "saveJurnalPresensi",
        id_jurnal: currentEditingJurnalId, // PENTING: Mencegah double entry
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

    try {
        showLoading(true);
        await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
        alert("Jurnal dan Presensi berhasil disimpan!");
        
        // Setelah sukses save, tarik rekap terbaru agar update presensi selanjutnya aman
        fetchRekapForEdit(idKelas);
    } catch (e) {
        alert("Gagal simpan: " + e);
    } finally {
        showLoading(false);
        if(btn) {
            btn.disabled = false;
            btn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            btn.innerText = 'Simpan';
        }
    }
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

    const jenis = document.getElementById('penilaian-jenis').value; // TUGAS / UH
    const arrNilai = [];
    
    globalStudents.forEach(siswa => {
        const isBelum = document.getElementById(`check-belum-${siswa.id_siswa}`).checked;
        const nilaiInput = document.getElementById(`nilai-${siswa.id_siswa}`).value;

        if (isBelum) {
            arrNilai.push({ 
                id_siswa: siswa.id_siswa, 
                nilai: 0, 
                keterangan: jenis === 'TUGAS' ? 'Belum Mengumpulkan' : 'Belum Ulangan' 
            });
        } else if (nilaiInput !== "") {
            arrNilai.push({ 
                id_siswa: siswa.id_siswa, 
                nilai: parseInt(nilaiInput),
                keterangan: 'Lengkap'
            });
        }
    });

    if(arrNilai.length === 0) return alert("Belum ada nilai atau centangan yang diisi!");

    const payload = {
        action: "savePenilaian",
        tanggal: new Date().toISOString().split('T')[0],
        id_kelas: idKelas,
        jenis: jenis,
        nama_penilaian: document.getElementById('penilaian-judul').value,
        data_nilai: arrNilai
    };

    showLoading(true);
    await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
    showLoading(false);
    alert(`Data Penilaian ${jenis} berhasil disimpan!`);
}
// Inisialisasi awal
window.onload = () => {
    setLiveDate();
    loadKelas();
};
// ==========================================
// FUNGSI REKAP LENGKAP & EXPORT EXCEL
// ==========================================
async function loadRekapData() {
    const idKelas = document.getElementById('global-kelas').value;
    if (!idKelas) return alert("Pilih kelas di atas dulu!");

    showLoading(true);
    try {
        const res = await fetch(`${GAS_URL}?action=getRekap`);
        const json = await res.json();
        
        if(json.status === "success") {
            const allJurnal = json.data.jurnal || [];
            const allPresensi = json.data.presensi || [];
            const allMaju = json.data.nilaiMaju || [];
            const allTugasUh = json.data.tugasUh || [];

            // ------------------------------------------
            // 0. RENDER REKAP MATERI (Tampil Paling Atas)
            // ------------------------------------------
            const tbodyMateri = document.getElementById('table-rekap-materi');
            tbodyMateri.innerHTML = '';

            const jurnalKelas = allJurnal.filter(j => String(j.id_kelas) === String(idKelas));

            if (jurnalKelas.length === 0) {
                tbodyMateri.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-gray-400">Belum ada entri jurnal materi untuk kelas ini.</td></tr>`;
            } else {
                jurnalKelas.forEach(j => {
                    const tglFormat = j.tanggal ? new Date(j.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) : '-';
                    tbodyMateri.innerHTML += `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="p-2 font-medium text-gray-700 whitespace-nowrap">${tglFormat}</td>
                            <td class="p-2 text-center font-semibold text-indigo-600 whitespace-nowrap">${j.jam_ke || '-'}</td>
                            <td class="p-2 font-bold text-gray-800">${j.materi_tp || '-'}</td>
                            <td class="p-2 text-gray-600">${j.aktivitas || '-'}</td>
                        </tr>
                    `;
                });
            }

            // ------------------------------------------
            // 1. RENDER REKAP PRESENSI
            // ------------------------------------------
            const tbodyPresensi = document.getElementById('table-rekap-presensi');
            tbodyPresensi.innerHTML = '';

            globalStudents.forEach(siswa => {
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

            // ------------------------------------------
            // 2. RENDER REKAP NILAI MAJU
            // ------------------------------------------
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

            // ------------------------------------------
            // 3. RENDER REKAP TUGAS & UH
            // ------------------------------------------
            const headerTugaUh = document.getElementById('header-rekap-tugauh');
            const tbodyTugaUh = document.getElementById('table-rekap-tugauh');
            
            const nilaiKelas = allTugasUh.filter(n => String(n.id_kelas) === String(idKelas));

            const itemPenilaianMap = {};
            nilaiKelas.forEach(n => {
                const tglFormat = n.tanggal ? new Date(n.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '';
                const key = `${n.jenis}: ${n.nama_penilaian} (${tglFormat})`;
                itemPenilaianMap[key] = true;
            });

            const daftarItem = Object.keys(itemPenilaianMap);

            headerTugaUh.innerHTML = `<th class="p-2 min-w-[120px]">Nama</th>`;
            daftarItem.forEach(item => {
                headerTugaUh.innerHTML += `<th class="p-2 text-center min-w-[90px] bg-blue-50/50">${item}</th>`;
            });

            tbodyTugaUh.innerHTML = '';
            globalStudents.forEach(siswa => {
                let rowHtml = `<tr class="border-b hover:bg-gray-50"><td class="p-2 font-medium text-gray-800 truncate max-w-[120px]">${siswa.nama_siswa}</td>`;
                
                daftarItem.forEach(itemKey => {
                    const record = nilaiKelas.find(n => {
                        const tglFormat = n.tanggal ? new Date(n.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '';
                        const key = `${n.jenis}: ${n.nama_penilaian} (${tglFormat})`;
                        return String(n.id_siswa) === String(siswa.id_siswa) && key === itemKey;
                    });

                    const nilaiVal = record && record.nilai !== "" ? record.nilai : "-";
                    rowHtml += `<td class="p-2 text-center font-semibold text-gray-700">${nilaiVal}</td>`;
                });

                rowHtml += `</tr>`;
                tbodyTugaUh.innerHTML += rowHtml;
            });

        }
    } catch (e) {
        alert("Gagal memuat data rekap.");
    }
    showLoading(false);
}

// ------------------------------------------
// FUNGSI EXPORT EMPAT REKAP KE EXCEL (.XLSX)
// ------------------------------------------
function exportToExcel() {
    const idKelas = document.getElementById('global-kelas').value || "Kelas";
    const wb = XLSX.utils.book_new();

    // 1. Sheet Jurnal Materi
    const wsMateri = XLSX.utils.table_to_sheet(document.getElementById('table-materi-export'));
    XLSX.utils.book_append_sheet(wb, wsMateri, "Jurnal Materi");

    // 2. Sheet Presensi
    const wsPresensi = XLSX.utils.table_to_sheet(document.getElementById('table-presensi-export'));
    XLSX.utils.book_append_sheet(wb, wsPresensi, "Rekap Kehadiran");

    // 3. Sheet Nilai Maju
    const wsMaju = XLSX.utils.table_to_sheet(document.getElementById('table-maju-export'));
    XLSX.utils.book_append_sheet(wb, wsMaju, "Nilai Maju");

    // 4. Sheet Tugas & UH
    const wsTugas = XLSX.utils.table_to_sheet(document.getElementById('table-tugauh-export'));
    XLSX.utils.book_append_sheet(wb, wsTugas, "Tugas & UH");

    // Download File .xlsx
    const fileName = `Rekap_Jurnalku_${idKelas}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
