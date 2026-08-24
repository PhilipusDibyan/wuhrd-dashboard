# Wujud Unggul — Dashboard HRD

Dashboard rekrutmen responsif berbasis HTML5, CSS3, dan JavaScript murni. Data dibaca sebagai JSON dari Google Apps Script; tidak ada jQuery, PapaParse, atau CSV.

## Isi proyek

```
dashboard-hrd/
├── index.html
├── style.css
├── script.js       # State aplikasi, pencarian, filter, tabel, pagination
├── api.js          # Konfigurasi API + normalisasi nama kolom Google Sheet
├── utils.js        # Utilitas umum
├── modal.js        # Detail lengkap pelamar
├── chart.js        # Statistik Chart.js
├── export.js       # Ekspor Excel dan PDF
├── theme.js        # Dark mode yang tersimpan
└── apps-script/
    └── Code.gs     # Endpoint contoh Google Apps Script
```

## Menghubungkan Google Sheet

1. Buat atau buka Google Sheet, lalu beri nama sheet `databasePelamar`.
2. Gunakan baris pertama sebagai header. Dashboard mengenali nama umum seperti `namaLengkap`, `posisiYangDilamar`, `nomorWhatsappAktif`, `alamatEmailAktif`, `cabang`, `pendidikanTerakhir`, `statusPernikahan`, `agama`, `jenisKelamin`, `tipeKepribadianMbtiAnda`, `alamat`, `pengalamanKerja`, `sertifikat`, `uploadMbti`, `uploadCv`, dan `timestamp`.
3. Di Google Sheet pilih **Extensions → Apps Script**, lalu salin isi `apps-script/Code.gs`. Script tersebut dibuat untuk Google Sheet yang sama (bound script), jadi tidak perlu mengisi Spreadsheet ID.
4. Jalankan `installSyncTrigger` **satu kali** dari Apps Script dan setujui izin. Ini memasang trigger agar setiap respons Form baru otomatis disalin ke `databasePelamar`; jalankan `syncPelamar` manual hanya jika ingin sinkronisasi sewaktu-waktu.
5. Pilih **Deploy → Manage deployments**, lalu edit atau buat deployment **Web app**. Beri akses pembaca yang sesuai (untuk dashboard publik, pilih akses yang mengizinkan pengguna dashboard), kemudian salin URL `/exec`.
6. Ganti nilai `API_URL` di `api.js` jika URL deployment Anda berubah. Proyek ini sudah diatur ke endpoint yang diberikan saat ini.
7. Buka `index.html` melalui web server statis atau hosting seperti GitHub Pages/Netlify. Jangan gunakan URL `/dev` Apps Script untuk produksi.

Contoh konfigurasi di `api.js`:

```js
export const API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Setelah URL diatur, dashboard otomatis mengambil JSON saat halaman dibuka dan menyegarkan data setiap 30 detik. Setiap request diberi parameter waktu dan `cache: 'no-store'`, sehingga perubahan pada Google Sheet tidak memakai respons cache lama.

## Fitur

- Ringkasan total pelamar, pelamar hari ini, posisi, cabang, dan MBTI
- Pencarian realtime dengan debounce
- Filter posisi, cabang, pendidikan, status pernikahan, agama, MBTI, dan gender
- Normalisasi kategori otomatis: variasi kapitalisasi/spasi atau nama ekuivalen seperti `officeboy`/`OFFICE BOY`, `Data Analis`/`Data Analyst`, serta `Admin Gudang`/`Admin Warehouse` tampil sebagai satu pilihan filter
- Sorting, pagination, tabel responsif, dan modal detail lengkap
- Grafik posisi, cabang, MBTI, dan gender yang mengikuti filter aktif
- Ekspor hasil filter ke Excel dan PDF
- Pilihan ekspor semua hasil filter atau laporan satu pelamar; kedua format menyertakan ekspektasi gaji
- Laporan PDF per individu dapat melampirkan CV PDF dari Google Form. File harus berada di Google Drive, tercatat di kolom CV (`uploadCv`/variasinya), berukuran maksimal 8 MB, dan deployment Apps Script harus diperbarui.
- Dark mode tersimpan di browser
- Sinkronisasi ulang manual dan otomatis setiap 30 detik

Library Chart.js, SheetJS, jsPDF, dan AutoTable dimuat dari CDN. Selain library ekspor/grafik tersebut, aplikasi berjalan dengan JavaScript murni.
