import { fetchCvPdf } from './api.js';
import { formatDate, showToast } from './utils.js';

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
    'Ekspektasi Gaji': record.expectedSalary || '—',
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
  sheet['!cols'] = [6, 24, 25, 20, 18, 28, 10, 24, 18, 16, 14, 18, 18, 42].map(width => ({ wch: width }));
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

async function mergeCvIntoReport(reportBytes, applicant) {
  if (!window.PDFLib?.PDFDocument) throw new Error('Pustaka lampiran PDF belum dimuat. Periksa koneksi internet.');
  const cv = await fetchCvPdf(applicant);
  const report = await window.PDFLib.PDFDocument.load(reportBytes);
  const cvDocument = await window.PDFLib.PDFDocument.load(base64ToUint8Array(cv.base64));
  const cvPages = await report.copyPages(cvDocument, cvDocument.getPageIndices());
  cvPages.forEach(page => report.addPage(page));
  return { bytes: await report.save(), fileName: cv.fileName };
}

export async function exportPdf(records) {
  if (!records.length) return showToast('Tidak ada data yang dapat diekspor.', 'error');
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) return showToast('Pustaka ekspor PDF belum dimuat. Periksa koneksi internet.', 'error');
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
    head: [['No', 'Nama', 'Posisi', 'Cabang', 'WhatsApp', 'MBTI', 'Ekspektasi Gaji', 'CV', 'Tanggal Melamar']],
    body: records.map((record, index) => [index + 1, record.name || '—', record.position || '—', record.branch || '—', record.whatsapp || '—', record.mbti || '—', record.expectedSalary || '—', record.cvUrl ? (records.length === 1 ? 'Dilampirkan bila PDF' : 'Tersedia') : '—', formatDate(record.appliedAt)]),
    styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 2.2 },
    headStyles: { fillColor: [50, 104, 232], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 253] },
    margin: { left: 14, right: 14 },
  });
  let reportBytes = pdf.output('arraybuffer');
  let cvMessage = '';
  if (records.length === 1 && records[0].cvUrl) {
    try {
      const merged = await mergeCvIntoReport(reportBytes, records[0]);
      reportBytes = merged.bytes;
      cvMessage = ` dengan lampiran CV (${merged.fileName})`;
    } catch (error) {
      console.warn('CV tidak dapat dilampirkan:', error);
      cvMessage = ' tanpa lampiran CV';
      showToast(error.message || 'CV tidak dapat dilampirkan; laporan utama tetap dibuat.', 'info');
    }
  }
  downloadPdf(reportBytes, filename('pdf', records));
  showToast(`${records.length} data pelamar diekspor ke PDF${cvMessage}.`, 'success');
}
