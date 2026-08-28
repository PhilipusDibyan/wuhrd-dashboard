/******************************************************
 * KONFIGURASI
 * Script ini harus terikat (bound) pada Google Sheet
 * yang memiliki sheet Form Responses 1.
 ******************************************************/
const SOURCE_SHEET = 'Form Responses 1';
const TARGET_SHEET = 'databasePelamar';

/******************************************************
 * SINKRONISASI GOOGLE FORM -> databasePelamar
 * Jalankan sekali secara manual untuk mengisi awal.
 * Selanjutnya dipanggil otomatis oleh trigger form submit.
 ******************************************************/
function syncPelamar() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30_000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const source = ss.getSheetByName(SOURCE_SHEET);
    if (!source) throw new Error(`Sheet sumber "${SOURCE_SHEET}" tidak ditemukan.`);

    const target = ss.getSheetByName(TARGET_SHEET) || ss.insertSheet(TARGET_SHEET);
    const values = source.getDataRange().getValues();
    if (!values.length) return;

    const headers = values[0].map(convertHeader);
    const rows = values.slice(1);

    // Hanya hapus isi agar format, lebar kolom, dan filter target tidak hilang.
    target.clearContents();
    target.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (rows.length) target.getRange(2, 1, rows.length, headers.length).setValues(rows);

    // Bersihkan sisa baris lama bila data Form berkurang.
    const lastUsedRow = rows.length + 1;
    if (target.getLastRow() > lastUsedRow) {
      target.getRange(lastUsedRow + 1, 1, target.getLastRow() - lastUsedRow, headers.length).clearContent();
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

/******************************************************
 * PASANG TRIGGER OTOMATIS — jalankan SATU KALI manual
 * Membuat trigger saat Google Form mengirim respons baru.
 ******************************************************/
function installSyncTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'syncPelamar'
      && trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('syncPelamar')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  syncPelamar(); // sinkronisasi awal setelah trigger terpasang
}

/******************************************************
 * UBAH HEADER GOOGLE FORM MENJADI camelCase
 ******************************************************/
function convertHeader(text) {
  const cleanText = String(text)
    .replace(/^\d+\.\s*/, '')      // hapus nomor di awal
    .replace(/\(.*?\)/g, '')       // hapus keterangan dalam kurung
    .trim()
    .replace(/[^\w\s]/g, '');

  return cleanText.split(/\s+/).filter(Boolean).map((word, index) => {
    const normalized = word.toLowerCase();
    return index === 0 ? normalized : normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }).join('');
}

/******************************************************
 * API GET — dipanggil dashboard melalui fetch()
 ******************************************************/
function doGet(e) {
  try {
    if (e?.parameter?.action === 'cv') return getCvPdf(e.parameter.fileId);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_SHEET);
    if (!sheet) throw new Error(`Sheet "${TARGET_SHEET}" tidak ditemukan. Jalankan syncPelamar().`);

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow <= 1 || !lastColumn) return jsonResponse([]);

    const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    const headers = values.shift().map(header => String(header).trim());
    const result = values
      .filter(row => row.some(value => value !== '' && value !== null))
      .map(row => headers.reduce((record, header, index) => {
        record[header] = row[index] instanceof Date ? row[index].toISOString() : row[index];
        return record;
      }, {}));

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

/******************************************************
 * FILE CV PDF — khusus laporan individu dashboard
 * File harus berupa PDF dari Google Drive dan harus tercatat
 * pada salah satu kolom CV di databasePelamar.
 ******************************************************/
function getCvPdf(fileId) {
  if (!fileId) throw new Error('ID file CV tidak dikirim.');
  if (!isReferencedCvFile(fileId)) {
    throw new Error('File CV tidak tercatat pada databasePelamar. Jalankan syncPelamar() ulang jika data Form baru saja masuk.');
  }

  let file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (error) {
    throw new Error('File CV tidak dapat diakses. Pastikan file tidak dihapus dan akun pemilik Apps Script punya izin membukanya.');
  }

  const blob = file.getBlob();
  const mimeType = blob.getContentType();
  const maximumBytes = 8 * 1024 * 1024;
  const bytes = blob.getBytes();

  if (mimeType !== MimeType.PDF) throw new Error(`File CV berformat ${mimeType}, bukan PDF, sehingga tidak dapat dilampirkan.`);
  if (bytes.length > maximumBytes) throw new Error('Ukuran CV melebihi batas 8 MB untuk laporan PDF.');

  return jsonResponse({
    success: true,
    fileName: file.getName(),
    mimeType: 'application/pdf',
    base64: Utilities.base64Encode(bytes),
  });
}

// Mencocokkan fileId yang diminta dashboard dengan kolom CV di databasePelamar.
// getDisplayValues() hanya membaca TEKS yang tampil di sel — jika sel berupa smart
// chip / rich-text link (teks tampilan berbeda dari URL aslinya), teks itu tidak
// memuat ID Drive. Karena itu kita juga mengambil RichTextValue setiap sel CV dan
// membaca link URL-nya secara langsung sebagai fallback.
function isReferencedCvFile(fileId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return false;

  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  const headers = values[0];
  const cvColumns = headers.map((header, index) => {
    const normalized = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
    return (normalized.includes('cv') || normalized.includes('curriculumvitae')) ? index : -1;
  }).filter(index => index >= 0);

  if (!cvColumns.length) return false;

  const lastRow = values.length; // termasuk header
  for (const column of cvColumns) {
    for (let row = 1; row < lastRow; row++) {
      const cellText = values[row][column];
      if (extractDriveFileIds(cellText).includes(fileId)) return true;

      // Fallback: baca link URL dari rich text jika teks sel tidak mengandung ID langsung.
      const richText = sheet.getRange(row + 1, column + 1).getRichTextValue();
      const linkUrl = richText && richText.getLinkUrl();
      if (linkUrl && extractDriveFileIds(linkUrl).includes(fileId)) return true;
    }
  }
  return false;
}

// Mengembalikan SEMUA ID Drive yang ditemukan pada sebuah teks (bisa berisi
// beberapa link CV dipisah koma/baris baru jika Google Form mengizinkan multi-upload).
function extractDriveFileIds(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  const ids = new Set();
  const patterns = [
    /\/(?:file\/d|d)\/([a-zA-Z0-9_-]{20,})/g,
    /[?&]id=([a-zA-Z0-9_-]{20,})/g,
    /thumbnail\?id=([a-zA-Z0-9_-]{20,})/g,
  ];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) ids.add(match[1]);
  });
  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) ids.add(text);
  return [...ids];
}

/******************************************************
 * API POST — opsional untuk menambah data dari website
 ******************************************************/
function doPost(e) {
  try {
    // doPost hanya menerima parameter e saat dipanggil melalui HTTP POST.
    // Menjalankannya dari tombol Run di editor Apps Script tidak menyediakan e.postData.
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        error: 'doPost harus dipanggil melalui HTTP POST, bukan dijalankan manual dari Apps Script.',
      });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_SHEET);
    if (!sheet) throw new Error(`Sheet "${TARGET_SHEET}" tidak ditemukan.`);

    const data = JSON.parse(e.postData.contents || '{}');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(header => header === 'timestamp' ? new Date() : (data[header] ?? ''));
    sheet.appendRow(row);

    return jsonResponse({ success: true, message: 'Data berhasil disimpan.' });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
