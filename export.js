import { fetchCvPdf } from './api.js';
import { formatCurrency, formatDate, initials, showToast } from './utils.js';

const BRAND = {
  primary: [50, 104, 232],
  primaryDark: [32, 84, 206],
  text: [24, 36, 60],
  muted: [113, 128, 154],
  line: [232, 237, 245],
  surfaceSoft: [248, 250, 255],
  primarySoft: [234, 240, 255],
  white: [255, 255, 255],
};

function exportRows(records) {
  return records.map((record, index) => ({
    No: index + 1,
    Nama: record.name || '—',
    Posisi: record.position || '—',
    Cabang: record.branch || '—',
    WhatsApp: record.whatsapp || '—',
    Email: record.email || '—',
    MBTI: record.mbti || '—',
    Pendidikan: record.education || '—',
    'Status Pernikahan': record.maritalStatus || '—',
    Agama: record.religion || '—',
    Gender: record.gender || '—',
    'Ekspektasi Gaji': formatCurrency(record.expectedSalary),
    'Gaji Terakhir': formatCurrency(record.lastSalary),
    'Pengalaman Kerja': record.experience || '—',
    'Tautan CV': record.cvUrl || '—',
    'Tanggal Melamar': formatDate(record.appliedAt),
  }));
}

function filename(extension, records = []) {
  const date = new Date().toISOString().slice(0, 10);
  if (records.length === 1) {
    const name = String(records[0].name || 'pelamar').toLocaleLowerCase('id-ID')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `pelamar-${name || 'individu'}-${date}.${extension}`;
  }
  return `pelamar-hrd-${date}.${extension}`;
}

export function exportExcel(records) {
  if (!records.length) return showToast('Tidak ada data yang dapat diekspor.', 'error');
  if (!window.XLSX) return showToast('Pustaka ekspor Excel belum dimuat. Periksa koneksi internet.', 'error');
  const sheet = window.XLSX.utils.json_to_sheet(exportRows(records));
  sheet['!cols'] = [6, 24, 25, 20, 18, 28, 10, 24, 18, 16, 14, 18, 18, 34, 18, 42].map(width => ({ wch: width }));
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, sheet, 'Pelamar');
  window.XLSX.writeFile(workbook, filename('xlsx', records));
  showToast(`${records.length} data pelamar diekspor ke Excel.`, 'success');
}

function base64ToUint8Array(value) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function downloadPdf(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * Mengambil file CV (base64) dari Apps Script SEBELUM laporan dibuat, supaya status
 * lampiran yang ditampilkan di laporan mencerminkan hasil sebenarnya, bukan label statis.
 */
async function tryFetchCv(applicant) {
  if (!applicant.cvUrl) return { status: 'none' };
  if (!applicant.cvFileId) {
    return { status: 'error', message: 'Tautan CV tidak dikenali sebagai file Google Drive yang valid.' };
  }
  if (!window.PDFLib?.PDFDocument) {
    return { status: 'error', message: 'Pustaka lampiran PDF belum dimuat. Periksa koneksi internet.' };
  }
  try {
    const cv = await fetchCvPdf(applicant);
    return { status: 'ok', cv };
  } catch (error) {
    return { status: 'error', message: error.message || 'CV tidak dapat diambil.' };
  }
}

async function mergeCvIntoReport(reportBytes, cv) {
  const report = await window.PDFLib.PDFDocument.load(reportBytes);
  const cvDocument = await window.PDFLib.PDFDocument.load(base64ToUint8Array(cv.base64));
  const cvPages = await report.copyPages(cvDocument, cvDocument.getPageIndices());
  cvPages.forEach(page => report.addPage(page));
  return report.save();
}

function cvColumnLabel(record, cvResult) {
  if (!record.cvUrl) return '—';
  if (!cvResult) return 'Tersedia';
  if (cvResult.status === 'ok') return 'Terlampir';
  if (cvResult.status === 'error') return `Gagal: ${cvResult.message}`;
  return '—';
}

/** Mencoba memuat foto profil sebagai data URL untuk disisipkan ke PDF. Best-effort:
 * banyak URL foto (mis. link Google Drive) diblokir CORS dari browser, jadi jika gagal
 * kita diam-diam kembali ke avatar gender/inisial. Dibatasi timeout 5 detik supaya link
 * yang macet/diblokir tidak membuat proses ekspor menggantung lama. */
async function tryLoadPhotoDataUrl(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, { mode: 'cors', signal: controller.signal });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function exportMultiPdf(records) {
  const jsPDF = window.jspdf?.jsPDF;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Laporan Pelamar HRD', 14, 15);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100);
  pdf.text(`Dibuat: ${formatDate(new Date(), true)}  |  Total: ${records.length} pelamar`, 14, 21);
  pdf.autoTable({
    startY: 27,
    head: [['No', 'Nama', 'Posisi', 'Cabang', 'WhatsApp', 'MBTI', 'Ekspektasi Gaji', 'Gaji Terakhir', 'Pengalaman Kerja', 'CV', 'Tanggal Melamar']],
    body: records.map((record, index) => [
      index + 1,
      record.name || '—',
      record.position || '—',
      record.branch || '—',
      record.whatsapp || '—',
      record.mbti || '—',
      record.expectedSalary ? formatCurrency(record.expectedSalary) : '—',
      record.lastSalary ? formatCurrency(record.lastSalary) : '—',
      record.experience || '—',
      cvColumnLabel(record, null),
      formatDate(record.appliedAt),
    ]),
    styles: { font: 'helvetica', fontSize: 6.8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: BRAND.primary, textColor: 255 },
    alternateRowStyles: { fillColor: BRAND.surfaceSoft },
    columnStyles: { 8: { cellWidth: 55 }, 9: { cellWidth: 32 } },
    margin: { left: 14, right: 14 },
  });
  downloadPdf(pdf.output('arraybuffer'), filename('pdf', records));
  showToast(`${records.length} data pelamar diekspor ke PDF.`, 'success');
}

// ---- Layout laporan profil satu halaman untuk ekspor individu ----

const PAGE_W = 210;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function setColor(pdf, method, rgb) { pdf[method](rgb[0], rgb[1], rgb[2]); }

const GENDER_COLORS = {
  'Laki-laki': BRAND.primaryDark,
  Perempuan: [199, 87, 142],
};

/**
 * Menggambar avatar siluet bergender saat pelamar tidak punya foto profil.
 * Laki-laki: siluet bahu tegas (kotak). Perempuan: rambut + rok melebar.
 * Dipangkas rapi ke dalam lingkaran avatar memakai clip path jsPDF, bukan sekadar ditumpuk.
 */
function drawGenderAvatar(pdf, cx, cy, size, gender) {
  const isFemale = gender === 'Perempuan';
  setColor(pdf, 'setFillColor', GENDER_COLORS[gender]);
  pdf.circle(cx, cy, size / 2, 'F');

  pdf.saveGraphicsState();
  pdf.circle(cx, cy, size / 2, 'S');
  pdf.clip();
  pdf.discardPath();

  setColor(pdf, 'setFillColor', BRAND.white);
  const headR = size * 0.155;
  const headCy = cy - size * 0.14;
  pdf.circle(cx, headCy, headR, 'F');

  if (isFemale) {
    const hairR = headR * 0.62;
    pdf.circle(cx - headR * 0.88, headCy + headR * 0.42, hairR, 'F');
    pdf.circle(cx + headR * 0.88, headCy + headR * 0.42, hairR, 'F');

    const shoulderY = cy + size * 0.06;
    const hemY = cy + size * 0.42;
    const shoulderHalf = size * 0.155;
    const hemHalf = size * 0.30;
    pdf.lines(
      [
        [shoulderHalf * 2, 0],
        [hemHalf - shoulderHalf, hemY - shoulderY],
        [-(hemHalf * 2), 0],
      ],
      cx - shoulderHalf, shoulderY, [1, 1], 'F', true,
    );
  } else {
    const shoulderY = cy + size * 0.08;
    const shoulderHalf = size * 0.20;
    pdf.roundedRect(cx - shoulderHalf, shoulderY, shoulderHalf * 2, size * 0.32, size * 0.05, size * 0.05, 'F');
  }
  pdf.restoreGraphicsState();
}

function drawHeader(pdf, applicant, photoDataUrl) {
  setColor(pdf, 'setFillColor', BRAND.primary);
  pdf.rect(0, 0, PAGE_W, 46, 'F');

  const avatarSize = 24;
  const avatarX = MARGIN;
  const avatarY = 11;
  if (photoDataUrl) {
    try {
      pdf.saveGraphicsState();
      pdf.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F');
      pdf.addImage(photoDataUrl, 'JPEG', avatarX, avatarY, avatarSize, avatarSize, undefined, 'FAST');
      pdf.restoreGraphicsState();
    } catch {
      photoDataUrl = null;
    }
  }
  if (!photoDataUrl) {
    if (GENDER_COLORS[applicant.gender]) {
      drawGenderAvatar(pdf, avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize, applicant.gender);
    } else {
      setColor(pdf, 'setFillColor', BRAND.primaryDark);
      pdf.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      setColor(pdf, 'setTextColor', BRAND.white);
      pdf.text(initials(applicant.name), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 4.5, { align: 'center' });
    }
  }

  const textX = avatarX + avatarSize + 8;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  setColor(pdf, 'setTextColor', [210, 222, 255]);
  pdf.text('PROFIL PELAMAR', textX, 14);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(19);
  setColor(pdf, 'setTextColor', BRAND.white);
  pdf.text(applicant.name || 'Tanpa nama', textX, 24);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  setColor(pdf, 'setTextColor', [220, 229, 255]);
  pdf.text(`${applicant.position || 'Posisi belum diisi'}  •  ${applicant.branch || 'Cabang belum diisi'}`, textX, 32);

  pdf.setFontSize(8.5);
  setColor(pdf, 'setTextColor', [196, 210, 255]);
  pdf.text(`Tanggal melamar: ${formatDate(applicant.appliedAt, true)}`, textX, 39);

  return 54;
}

function drawHighlightCards(pdf, applicant, startY) {
  const cards = [
    { label: 'EKSPEKTASI GAJI', value: formatCurrency(applicant.expectedSalary) },
    { label: 'GAJI TERAKHIR', value: formatCurrency(applicant.lastSalary) },
    { label: 'KESEDIAAN MULAI', value: applicant.availability || '—' },
  ];
  const gap = 6;
  const cardW = (CONTENT_W - gap * 2) / 3;
  const cardH = 20;
  cards.forEach((card, index) => {
    const x = MARGIN + index * (cardW + gap);
    setColor(pdf, 'setFillColor', BRAND.primarySoft);
    pdf.roundedRect(x, startY, cardW, cardH, 2.5, 2.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    setColor(pdf, 'setTextColor', BRAND.primaryDark);
    pdf.text(card.label, x + 5, startY + 7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11.5);
    setColor(pdf, 'setTextColor', BRAND.text);
    const valueText = pdf.splitTextToSize(String(card.value), cardW - 10)[0] || '—';
    pdf.text(valueText, x + 5, startY + 15.5);
  });
  return startY + cardH + 10;
}

function drawSectionTitle(pdf, title, y) {
  setColor(pdf, 'setFillColor', BRAND.primary);
  pdf.rect(MARGIN, y - 3.6, 2.2, 5.2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  setColor(pdf, 'setTextColor', BRAND.text);
  pdf.text(title, MARGIN + 5, y);
  return y + 7;
}

/** Menggambar satu field label+value dan mengembalikan tinggi (mm) yang terpakai. */
function drawField(pdf, x, y, width, label, value) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  setColor(pdf, 'setTextColor', BRAND.muted);
  pdf.text(label.toUpperCase(), x, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  setColor(pdf, 'setTextColor', BRAND.text);
  const lines = pdf.splitTextToSize(String(value || '—'), width);
  pdf.text(lines, x, y + 5);
  return 5 + lines.length * 4.6 + 5;
}

/** Menyusun field dalam grid 2 kolom, mengembalikan y setelah baris terakhir. */
function drawFieldGrid(pdf, fields, startY) {
  const colW = (CONTENT_W - 10) / 2;
  let leftY = startY;
  let rightY = startY;
  fields.forEach((field, index) => {
    const isLeft = index % 2 === 0;
    const x = isLeft ? MARGIN : MARGIN + colW + 10;
    const y = isLeft ? leftY : rightY;
    const used = drawField(pdf, x, y, colW, field.label, field.value);
    if (isLeft) leftY += used; else rightY += used;
  });
  return Math.max(leftY, rightY);
}

/** Field lebar penuh (mis. paragraf pengalaman kerja) dengan wrap otomatis. */
function drawFullField(pdf, label, value, startY) {
  return startY + drawField(pdf, MARGIN, startY, CONTENT_W, label, value);
}

function drawDivider(pdf, y) {
  setColor(pdf, 'setDrawColor', BRAND.line);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + 6;
}

async function buildProfilePdf(applicant, cvResult) {
  const jsPDF = window.jspdf?.jsPDF;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const photoDataUrl = await tryLoadPhotoDataUrl(applicant.photoUrl);

  let y = drawHeader(pdf, applicant, photoDataUrl);
  y = drawHighlightCards(pdf, applicant, y);

  y = drawSectionTitle(pdf, 'Informasi Kontak', y);
  y = drawFieldGrid(pdf, [
    { label: 'WhatsApp', value: applicant.whatsapp },
    { label: 'Email', value: applicant.email },
    { label: 'Alamat', value: applicant.address },
    { label: 'Tempat & Tanggal Lahir', value: applicant.birthPlaceDate },
  ], y);
  y = drawDivider(pdf, y + 2);

  y = drawSectionTitle(pdf, 'Pendidikan & Pengalaman', y);
  y = drawFieldGrid(pdf, [
    { label: 'Pendidikan Terakhir', value: applicant.education },
    { label: 'Tipe MBTI', value: applicant.mbti },
  ], y);
  y = drawFullField(pdf, 'Pengalaman Kerja', applicant.experience, y + 1);
  y = drawFullField(pdf, 'Keahlian', applicant.skills, y);
  y = drawFullField(pdf, 'Sertifikat', applicant.certificate, y);
  y = drawDivider(pdf, y + 1);

  y = drawSectionTitle(pdf, 'Data Pribadi', y);
  y = drawFieldGrid(pdf, [
    { label: 'Jenis Kelamin', value: applicant.gender },
    { label: 'Status Pernikahan', value: applicant.maritalStatus },
    { label: 'Agama', value: applicant.religion },
    { label: 'Cabang Penempatan', value: applicant.branch },
  ], y);

  // Status lampiran CV di bagian bawah laporan.
  y = drawDivider(pdf, y + 1);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  setColor(pdf, 'setTextColor', BRAND.muted);
  pdf.text('STATUS CV', MARGIN, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const cvNote = !applicant.cvUrl ? 'Tidak ada CV yang diunggah.'
    : cvResult?.status === 'ok' ? `CV terlampir pada halaman berikutnya (${cvResult.cv.fileName}).`
    : cvResult?.status === 'error' ? `CV tidak dapat dilampirkan: ${cvResult.message}`
    : 'Status CV tidak diketahui.';
  setColor(pdf, 'setTextColor', BRAND.text);
  const cvLines = pdf.splitTextToSize(cvNote, CONTENT_W);
  pdf.text(cvLines, MARGIN, y + 5);

  // Footer.
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  setColor(pdf, 'setTextColor', BRAND.muted);
  pdf.text(`Laporan dibuat otomatis oleh Dashboard HRD Wujud Unggul • ${formatDate(new Date(), true)}`, MARGIN, 290);

  return pdf;
}

async function exportSinglePdf(applicant) {
  const cvResult = await tryFetchCv(applicant);
  const pdf = await buildProfilePdf(applicant, cvResult);
  let reportBytes = pdf.output('arraybuffer');
  let cvMessage = '';

  if (cvResult.status === 'ok') {
    try {
      reportBytes = await mergeCvIntoReport(reportBytes, cvResult.cv);
      cvMessage = ` dengan lampiran CV (${cvResult.cv.fileName})`;
    } catch (error) {
      console.warn('CV gagal digabungkan ke laporan:', error);
      cvMessage = ' tanpa lampiran CV';
      showToast(error.message || 'CV tidak dapat digabungkan ke laporan; laporan utama tetap dibuat.', 'info');
    }
  } else if (cvResult.status === 'error') {
    cvMessage = ' tanpa lampiran CV';
    console.warn('CV tidak dapat dilampirkan:', cvResult.message);
    showToast(cvResult.message, 'info');
  }

  downloadPdf(reportBytes, filename('pdf', [applicant]));
  showToast(`Laporan pelamar diekspor ke PDF${cvMessage}.`, 'success');
}

export async function exportPdf(records) {
  if (!records.length) return showToast('Tidak ada data yang dapat diekspor.', 'error');
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) return showToast('Pustaka ekspor PDF belum dimuat. Periksa koneksi internet.', 'error');

  if (records.length === 1) return exportSinglePdf(records[0]);
  return exportMultiPdf(records);
}