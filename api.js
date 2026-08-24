/**
 * Konfigurasi sumber data. Ganti API_URL dengan URL deployment Web App
 * Google Apps Script Anda, misalnya: https://script.google.com/macros/s/AKfy.../exec
 */
export const API_URL = 'https://script.google.com/macros/s/AKfycbx86xiEASPQfR5B2XvP8svJfcYxq265If3bxBW0CDWzBt5JRzeNHsK-AGw92srVLkEH/exec';
export const AUTO_REFRESH_MS = 30_000;
export const USE_DEMO_WHEN_UNAVAILABLE = true;

const aliases = {
  id: ['id', 'timestamp', 'nomor', 'no', 'kodepelamar', 'applicantid'],
  name: ['namalengkap', 'nama', 'nama pelamar', 'fullname', 'name'],
  whatsapp: ['nomorwhatsappaktif', 'nomorwhatsapp', 'whatsapp', 'nohp', 'nomorhp', 'phone', 'telepon'],
  email: ['alamatelektronikaktif', 'alamateemailaktif', 'alamatemailaktif', 'email', 'e-mail', 'mail'],
  position: ['posisiyangdilamar', 'posisi', 'posisidilamar', 'position', 'jabatan'],
  branch: [
    'cabang', 'cabangpenempatan', 'lokasipenempatan', 'lokasi', 'branch',
    'cabangyangdituju', 'cabangdituju', 'cabangtujuan', 'tujuancabang',
    'cabangyangdilamar', 'pilihcabang', 'pilihcabangpenempatan',
    'cabangataulokasi', 'cabangataulokasiyangdituju', 'cabangataulokasitujuan',
    'cabangataulokasipenempatan', 'cabangataulokasikerja',
  ],
  education: ['pendidikanterakhir', 'pendidikan', 'lasteducation', 'education'],
  maritalStatus: ['statuspernikahan', 'statusmenikah', 'maritalstatus'],
  religion: ['agama', 'religion'],
  gender: ['jeniskelamin', 'gender', 'sex'],
  mbti: ['tipekepribadianmbtianda', 'mbti', 'tipekepribadian', 'personalitytype'],
  address: ['alamat', 'alamatlengkap', 'address'],
  birthPlaceDate: ['tempattanggallahir', 'tempattgllahir', 'ttl', 'birthplaceanddate', 'tanggallahir'],
  experience: ['pengalamankerja', 'pengalaman', 'workexperience', 'experience'],
  skills: ['keahlian', 'skill', 'skills', 'kompetensi'],
  certificate: ['sertifikat', 'certification', 'certificates'],
  expectedSalary: ['ekspektasigaji', 'gajiyangdiharapkan', 'expectedsalary'],
  availability: ['kesediaanmulai', 'mulaibekerja', 'availability', 'tanggalmulaikerja'],
  photoUrl: ['foto', 'fotodiri', 'photo', 'photourl', 'pasfoto'],
  cvUrl: ['cv', 'uploadcv', 'filecv', 'curriculumvitae', 'uploadfilecv', 'uploadberkascv', 'uploadcurriculumvitae', 'berkascv', 'filecurriculumvitae'],
  mbtiFileUrl: ['uploadmbti', 'filembti', 'hasilmbti', 'mbtifile'],
  appliedAt: ['tanggalmelamar', 'waktupengisian', 'timestamp', 'appliedat', 'tanggaldaftar', 'createdat'],
};

function keyOf(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getValue(source, possibleKeys) {
  const normalized = new Map(Object.entries(source || {}).map(([key, value]) => [keyOf(key), value]));
  for (const key of possibleKeys) {
    const value = normalized.get(keyOf(key));
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

// Google Form terkadang mengubah pertanyaan panjang menjadi header seperti
// "cabangAtauLokasiYangDituju". Fallback ini menangkap variasi cabang tersebut
// tanpa mengambil kolom alamat atau domisili sebagai cabang penempatan.
function getBranchValue(source) {
  const directValue = getValue(source, aliases.branch);
  if (directValue) return directValue;

  const matchingEntry = Object.entries(source || {}).find(([key, value]) => {
    const normalizedKey = keyOf(key);
    const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
    const isBranchQuestion = normalizedKey.includes('cabang')
      || (normalizedKey.includes('lokasi') && /(tuju|penempatan|kerja|lamar)/.test(normalizedKey));
    return hasValue && isBranchQuestion;
  });
  return matchingEntry ? String(matchingEntry[1]).trim() : '';
}

function getCvValue(source) {
  const directValue = getValue(source, aliases.cvUrl);
  if (directValue) return directValue;

  const matchingEntry = Object.entries(source || {}).find(([key, value]) => {
    const normalizedKey = keyOf(key);
    const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
    return hasValue && (normalizedKey.includes('cv') || normalizedKey.includes('curriculumvitae'));
  });
  return matchingEntry ? String(matchingEntry[1]).trim() : '';
}

function getGoogleDriveFileId(value = '') {
  const text = String(value).trim();
  const fromPath = text.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  const fromQuery = text.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  const direct = text.match(/^([a-zA-Z0-9_-]{20,})$/);
  return fromPath?.[1] || fromQuery?.[1] || direct?.[1] || '';
}

function cleanCategory(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function titleCase(value) {
  return cleanCategory(value).toLocaleLowerCase('id-ID').replace(/(^|[\s/-])([\p{L}])/gu, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('id-ID')}`);
}

/**
 * Menggabungkan penulisan posisi yang berbeda di Google Form ke satu jobdesk.
 * Nilai ini dipakai seluruh aplikasi: tabel, filter, pencarian, statistik, dan ekspor.
 */
function normalizePosition(value) {
  const text = cleanCategory(value);
  const compact = keyOf(text);
  if (!text) return '';

  // Pemetaan berbasis kata yang sudah dinormalisasi (tanpa spasi/tanda baca).
  // Satu jabatan selalu tampil sebagai satu pilihan filter di seluruh dashboard.
  if (compact === 'ob' || compact.includes('officeboy')) return 'Office Boy';
  if (compact.includes('adminwarehouse') || compact.includes('admingudang')) return 'Admin Gudang';
  if (compact.includes('dataanalis') || compact.includes('dataanalyst')) return 'Data Analyst';
  if (compact.includes('staffadministrasi') || compact.includes('administrasistaf') || compact === 'administrasi' || compact === 'admin') return 'Staff Administrasi';
  if (compact.includes('adminteknisi') || compact.includes('technicaladmin')) return 'Admin Teknisi';
  if (compact.includes('teknisi') || compact.includes('technician') || compact.includes('technical')) return 'Teknisi';
  if (compact.includes('pemagangan') || compact.includes('magang') || compact.includes('intern')) return 'Tenaga Pemagangan';
  if (compact === 'hr' || compact.includes('hrga') || compact.includes('staffhrd') || compact.includes('staffhr')) return 'Human Resources Officer';
  if (compact.includes('spvdelivery') || compact.includes('supervisordelivery')) return 'SPV Delivery';
  if (compact.includes('salesexecutive') || compact === 'sales') return 'Sales Executive';
  if (compact.includes('financestaff') || compact === 'finance') return 'Finance Staff';
  return titleCase(text);
}

/** Normalisasi setiap nilai filter agar pilihan tidak terduplikasi karena kapitalisasi/spasi. */
function normalizeCategory(field, value) {
  const text = cleanCategory(value);
  const compact = keyOf(text);
  if (!text) return '';

  if (field === 'position') return normalizePosition(text);
  if (field === 'mbti') return compact.toUpperCase();

  if (field === 'gender') {
    if (compact.includes('laki') || compact === 'pria' || compact === 'male') return 'Laki-laki';
    if (compact.includes('perempuan') || compact === 'wanita' || compact === 'female') return 'Perempuan';
  }

  if (field === 'maritalStatus') {
    if (compact.includes('belummenikah') || compact === 'single') return 'Belum Menikah';
    if (compact === 'menikah' || compact === 'kawin' || compact === 'married') return 'Menikah';
    if (compact.includes('cerai')) return 'Cerai';
  }

  if (field === 'religion') {
    const religions = { islam: 'Islam', kristen: 'Kristen', katolik: 'Katolik', hindu: 'Hindu', buddha: 'Buddha', konghucu: 'Konghucu' };
    if (religions[compact]) return religions[compact];
  }

  if (field === 'education') {
    if (/^[sd]\d$/.test(compact)) return compact.toUpperCase();
    if (compact === 'smasmk' || compact === 'smk') return 'SMA/SMK';
  }

  return titleCase(text);
}

/** Normalizes flexible column names from a Google Sheet JSON response. */
export function normalizeApplicant(record, index = 0) {
  const raw = record && typeof record === 'object' ? record : {};
  const applicant = {};
  Object.entries(aliases).forEach(([field, possibleKeys]) => {
    applicant[field] = String(getValue(raw, possibleKeys) ?? '').trim();
  });
  applicant.branch = getBranchValue(raw);
  applicant.cvUrl = getCvValue(raw);
  applicant.cvFileId = getGoogleDriveFileId(applicant.cvUrl);
  ['position', 'branch', 'education', 'maritalStatus', 'religion', 'mbti', 'gender'].forEach(field => {
    applicant[field] = normalizeCategory(field, applicant[field]);
  });
  applicant.id = applicant.id || `applicant-${index + 1}`;
  applicant.name = applicant.name || 'Tanpa nama';
  applicant.raw = raw;
  return applicant;
}

function unwrapResponse(json) {
  if (typeof json === 'string') {
    try { return unwrapResponse(JSON.parse(json)); }
    catch { throw new Error('Endpoint mengirim teks, bukan JSON pelamar yang valid. Periksa fungsi doGet() di Apps Script.'); }
  }
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.results)) return json.results;
  if (Array.isArray(json?.pelamar)) return json.pelamar;
  if (Array.isArray(json?.records)) return json.records;
  if (Array.isArray(json?.values)) return json.values;
  if (json?.error) throw new Error(`Apps Script: ${json.error}`);
  if (json && typeof json === 'object') return [json];
  throw new Error('Respons API bukan berupa daftar data pelamar.');
}

async function readJsonResponse(response) {
  const body = (await response.text()).replace(/^\uFEFF/, '').trim();
  if (!body) throw new Error('Endpoint tidak mengembalikan data.');
  try { return JSON.parse(body); }
  catch { throw new Error('Endpoint belum mengembalikan JSON. Pastikan doGet() memakai ContentService.MimeType.JSON, bukan CSV.'); }
}

export async function fetchApplicants() {
  if (!API_URL || API_URL.includes('PASTE_GOOGLE')) {
    if (USE_DEMO_WHEN_UNAVAILABLE) return { data: demoApplicants.map(normalizeApplicant), isDemo: true };
    throw new Error('API_URL belum diatur di api.js.');
  }

  // Parameter waktu memastikan browser dan Apps Script tidak menggunakan respons cache lama.
  const requestUrl = new URL(API_URL);
  requestUrl.searchParams.set('_ts', String(Date.now()));
  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`API tidak dapat diakses (HTTP ${response.status}).`);

  const list = unwrapResponse(await readJsonResponse(response));
  return { data: list.map(normalizeApplicant), isDemo: false };
}

/** Mengambil isi file CV PDF lewat endpoint Apps Script yang memverifikasi file terhadap databasePelamar. */
export async function fetchCvPdf(applicant) {
  if (!applicant?.cvFileId) throw new Error('Tautan CV Google Drive tidak ditemukan atau bukan file Drive yang valid.');
  const requestUrl = new URL(API_URL);
  requestUrl.searchParams.set('action', 'cv');
  requestUrl.searchParams.set('fileId', applicant.cvFileId);
  requestUrl.searchParams.set('_ts', String(Date.now()));

  const response = await fetch(requestUrl, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'follow' });
  if (!response.ok) throw new Error(`File CV tidak dapat diambil (HTTP ${response.status}).`);
  const payload = await readJsonResponse(response);
  if (!payload?.success || !payload?.base64) throw new Error(payload?.error || 'File CV tidak tersedia.');
  if (payload.mimeType !== 'application/pdf') throw new Error('File CV bukan PDF sehingga tidak dapat dilampirkan ke laporan PDF.');
  return payload;
}

/** Sample data is only used until a real API_URL is supplied. */
const demoApplicants = [
  { timestamp: '2026-07-31T09:18:00+07:00', namaLengkap: 'Ayu Lestari', nomorWhatsappAktif: '0812-9001-2244', alamatEmailAktif: 'ayu.lestari@email.com', posisiYangDilamar: 'Human Resources Officer', cabang: 'Jakarta Pusat', pendidikanTerakhir: 'S1 Psikologi', statusPernikahan: 'Belum Menikah', agama: 'Islam', jenisKelamin: 'Perempuan', tipeKepribadianMbtiAnda: 'ENFJ', alamat: 'Cempaka Putih, Jakarta Pusat', tempatTanggalLahir: 'Bandung, 12 Mei 2001', pengalamanKerja: 'HR Intern — PT Karya Mandiri (2023–2025)', keahlian: 'Recruitment, interview, Excel', sertifikat: 'HR Fundamental Certificate', ekspektasiGaji: 'Rp6.500.000', kesediaanMulai: '2 minggu', uploadMbti: 'https://drive.google.com/', uploadCv: 'https://drive.google.com/' },
  { timestamp: '2026-07-31T08:42:00+07:00', namaLengkap: 'Rizky Pratama', nomorWhatsappAktif: '0857-3121-8988', alamatEmailAktif: 'rizky.pratama@email.com', posisiYangDilamar: 'IT Support', cabang: 'Surabaya', pendidikanTerakhir: 'D3 Teknik Informatika', statusPernikahan: 'Belum Menikah', agama: 'Islam', jenisKelamin: 'Laki-laki', tipeKepribadianMbtiAnda: 'ISTP', alamat: 'Sukolilo, Surabaya', tempatTanggalLahir: 'Surabaya, 28 Januari 2000', pengalamanKerja: 'IT Support — CV Digital Solusi (2021–2025)', keahlian: 'Troubleshooting, Windows, Network', sertifikat: 'MTCNA', ekspektasiGaji: 'Rp5.800.000', kesediaanMulai: 'Segera' },
  { timestamp: '2026-07-30T13:05:00+07:00', namaLengkap: 'Citra Ramadhani', nomorWhatsappAktif: '0813-7784-1250', alamatEmailAktif: 'citra.r@email.com', posisiYangDilamar: 'Finance Staff', cabang: 'Bandung', pendidikanTerakhir: 'S1 Akuntansi', statusPernikahan: 'Menikah', agama: 'Islam', jenisKelamin: 'Perempuan', tipeKepribadianMbtiAnda: 'ISFJ', alamat: 'Antapani, Bandung', tempatTanggalLahir: 'Garut, 8 Agustus 1998', pengalamanKerja: 'Account Payable Staff — PT Arta Kencana (2020–2026)', keahlian: 'Accurate, Excel, pajak dasar', sertifikat: 'Brevet A & B', ekspektasiGaji: 'Rp7.200.000', kesediaanMulai: '30 hari' },
  { timestamp: '2026-07-30T10:11:00+07:00', namaLengkap: 'Dimas Saputra', nomorWhatsappAktif: '0821-5542-9930', alamatEmailAktif: 'dimas.saputra@email.com', posisiYangDilamar: 'Sales Executive', cabang: 'Jakarta Selatan', pendidikanTerakhir: 'SMA/SMK', statusPernikahan: 'Belum Menikah', agama: 'Kristen', jenisKelamin: 'Laki-laki', tipeKepribadianMbtiAnda: 'ESTP', alamat: 'Tebet, Jakarta Selatan', tempatTanggalLahir: 'Bekasi, 19 Maret 2002', pengalamanKerja: 'Sales Representative — PT Ritel Makmur (2022–2026)', keahlian: 'Negotiation, CRM, public speaking', sertifikat: 'Sales Excellence Workshop', ekspektasiGaji: 'Rp5.500.000', kesediaanMulai: 'Segera' },
  { timestamp: '2026-07-29T15:30:00+07:00', namaLengkap: 'Nadia Salsabila', nomorWhatsappAktif: '0812-3330-6961', alamatEmailAktif: 'nadia.s@email.com', posisiYangDilamar: 'Graphic Designer', cabang: 'Yogyakarta', pendidikanTerakhir: 'S1 Desain Komunikasi Visual', statusPernikahan: 'Belum Menikah', agama: 'Islam', jenisKelamin: 'Perempuan', tipeKepribadianMbtiAnda: 'INFP', alamat: 'Sleman, DI Yogyakarta', tempatTanggalLahir: 'Yogyakarta, 21 Juni 2001', pengalamanKerja: 'Freelance Graphic Designer (2021–sekarang)', keahlian: 'Figma, Adobe Illustrator, branding', sertifikat: 'UI/UX Design Bootcamp', ekspektasiGaji: 'Rp6.000.000', kesediaanMulai: '2 minggu' },
  { timestamp: '2026-07-29T11:03:00+07:00', namaLengkap: 'Fajar Maulana', nomorWhatsappAktif: '0819-7505-7402', alamatEmailAktif: 'fajar.m@email.com', posisiYangDilamar: 'Warehouse Supervisor', cabang: 'Semarang', pendidikanTerakhir: 'S1 Manajemen', statusPernikahan: 'Menikah', agama: 'Islam', jenisKelamin: 'Laki-laki', tipeKepribadianMbtiAnda: 'ESTJ', alamat: 'Pedurungan, Semarang', tempatTanggalLahir: 'Semarang, 5 Februari 1994', pengalamanKerja: 'Warehouse Lead — PT Logistik Cepat (2016–2026)', keahlian: 'Inventory, leadership, WMS', sertifikat: 'K3 Umum', ekspektasiGaji: 'Rp8.000.000', kesediaanMulai: '30 hari' },
  { timestamp: '2026-07-28T14:21:00+07:00', namaLengkap: 'Grace Olivia', nomorWhatsappAktif: '0852-1121-4433', alamatEmailAktif: 'grace.olivia@email.com', posisiYangDilamar: 'Customer Service', cabang: 'Jakarta Pusat', pendidikanTerakhir: 'D3 Komunikasi', statusPernikahan: 'Belum Menikah', agama: 'Katolik', jenisKelamin: 'Perempuan', tipeKepribadianMbtiAnda: 'ESFJ', alamat: 'Kelapa Gading, Jakarta Utara', tempatTanggalLahir: 'Jakarta, 17 September 2000', pengalamanKerja: 'Customer Care — PT Hubungi Kami (2020–2026)', keahlian: 'Customer handling, Zendesk', sertifikat: 'Customer Service Excellence', ekspektasiGaji: 'Rp6.000.000', kesediaanMulai: '2 minggu' },
  { timestamp: '2026-07-28T09:17:00+07:00', namaLengkap: 'Bagas Wicaksono', nomorWhatsappAktif: '0822-4439-7761', alamatEmailAktif: 'bagas.w@email.com', posisiYangDilamar: 'IT Support', cabang: 'Bandung', pendidikanTerakhir: 'S1 Sistem Informasi', statusPernikahan: 'Belum Menikah', agama: 'Islam', jenisKelamin: 'Laki-laki', tipeKepribadianMbtiAnda: 'INTP', alamat: 'Cimahi, Jawa Barat', tempatTanggalLahir: 'Cimahi, 30 Oktober 1999', pengalamanKerja: 'Junior Network Engineer — PT Netlink (2021–2026)', keahlian: 'Network, Linux, helpdesk', sertifikat: 'CCNA', ekspektasiGaji: 'Rp7.000.000', kesediaanMulai: '1 bulan' },
  { timestamp: '2026-07-27T16:44:00+07:00', namaLengkap: 'Siska Maharani', nomorWhatsappAktif: '0817-2850-2019', alamatEmailAktif: 'siska.m@email.com', posisiYangDilamar: 'Finance Staff', cabang: 'Surabaya', pendidikanTerakhir: 'S1 Akuntansi', statusPernikahan: 'Belum Menikah', agama: 'Hindu', jenisKelamin: 'Perempuan', tipeKepribadianMbtiAnda: 'INTJ', alamat: 'Wonokromo, Surabaya', tempatTanggalLahir: 'Denpasar, 11 November 1999', pengalamanKerja: 'Finance Admin — PT Surya Dana (2020–2026)', keahlian: 'Reconciliation, Excel, SAP', sertifikat: 'Microsoft Excel Expert', ekspektasiGaji: 'Rp6.800.000', kesediaanMulai: '14 hari' },
  { timestamp: '2026-07-27T08:56:00+07:00', namaLengkap: 'Kevin Wijaya', nomorWhatsappAktif: '0818-9001-3722', alamatEmailAktif: 'kevin.w@email.com', posisiYangDilamar: 'Sales Executive', cabang: 'Medan', pendidikanTerakhir: 'S1 Manajemen', statusPernikahan: 'Belum Menikah', agama: 'Buddha', jenisKelamin: 'Laki-laki', tipeKepribadianMbtiAnda: 'ENTJ', alamat: 'Medan Petisah, Medan', tempatTanggalLahir: 'Medan, 14 April 1998', pengalamanKerja: 'Business Development — PT Nusantara Niaga (2019–2026)', keahlian: 'B2B sales, presentation, CRM', sertifikat: 'Digital Sales Course', ekspektasiGaji: 'Rp7.500.000', kesediaanMulai: '1 bulan' },
  { timestamp: '2026-07-26T12:20:00+07:00', namaLengkap: 'Maya Paramita', nomorWhatsappAktif: '0813-7099-8092', alamatEmailAktif: 'maya.p@email.com', posisiYangDilamar: 'Human Resources Officer', cabang: 'Yogyakarta', pendidikanTerakhir: 'S1 Psikologi', statusPernikahan: 'Menikah', agama: 'Islam', jenisKelamin: 'Perempuan', tipeKepribadianMbtiAnda: 'INFJ', alamat: 'Bantul, DI Yogyakarta', tempatTanggalLahir: 'Solo, 22 Desember 1996', pengalamanKerja: 'Recruiter — PT Mitra Sejahtera (2018–2026)', keahlian: 'Talent sourcing, HRIS, assessment', sertifikat: 'Certified Talent Acquisition', ekspektasiGaji: 'Rp7.500.000', kesediaanMulai: '30 hari' },
  { timestamp: '2026-07-25T10:09:00+07:00', namaLengkap: 'Andi Kurniawan', nomorWhatsappAktif: '0856-6220-7723', alamatEmailAktif: 'andi.k@email.com', posisiYangDilamar: 'Warehouse Supervisor', cabang: 'Jakarta Selatan', pendidikanTerakhir: 'D3 Logistik', statusPernikahan: 'Menikah', agama: 'Islam', jenisKelamin: 'Laki-laki', tipeKepribadianMbtiAnda: 'ISTJ', alamat: 'Ciputat, Tangerang Selatan', tempatTanggalLahir: 'Tangerang, 2 Juli 1995', pengalamanKerja: 'Warehouse Coordinator — PT Distribusi Utama (2017–2026)', keahlian: 'Stock opname, FIFO, leadership', sertifikat: 'Forklift Operator', ekspektasiGaji: 'Rp7.800.000', kesediaanMulai: '30 hari' },
];
