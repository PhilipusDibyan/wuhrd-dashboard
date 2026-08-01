export const FILTERS = [
  ['position', 'filterPosition', 'Posisi'], ['branch', 'filterBranch', 'Cabang'], ['education', 'filterEducation', 'Pendidikan'],
  ['maritalStatus', 'filterMarital', 'Status menikah'], ['religion', 'filterReligion', 'Agama'], ['mbti', 'filterMbti', 'MBTI'], ['gender', 'filterGender', 'Gender'],
];

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

export function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}

export function getUniqueValues(records, field) {
  return [...new Set(records.map(record => String(record[field] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
}

export function countBy(records, field, limit = Infinity) {
  const counts = new Map();
  records.forEach(record => {
    const value = String(record[field] || '').trim() || 'Tidak diisi';
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'id')).slice(0, limit);
}

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.valueOf())) return direct;
  const match = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year.length === 2 ? `20${year}` : year), Number(month) - 1, Number(day));
  }
  return null;
}

export function formatDate(value, withTime = false) {
  const date = parseDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(date);
}

export function isToday(value) {
  const date = parseDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

export function debounce(callback, wait = 200) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => callback(...args), wait); };
}

export function sortRecords(records, field, direction = 'asc') {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...records].sort((a, b) => {
    if (field === 'appliedAt') return multiplier * ((parseDate(a[field])?.valueOf() || 0) - (parseDate(b[field])?.valueOf() || 0));
    return multiplier * String(a[field] || '').localeCompare(String(b[field] || ''), 'id', { numeric: true, sensitivity: 'base' });
  });
}

export function paginate(records, page, perPage) {
  const totalPages = Math.max(1, Math.ceil(records.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return { page: safePage, totalPages, items: records.slice((safePage - 1) * perPage, safePage * perPage) };
}

export function isUrl(value = '') {
  try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol); } catch { return false; }
}

export function toSearchText(record) {
  return [record.name, record.whatsapp, record.email, record.position, record.branch, record.mbti].join(' ').toLocaleLowerCase('id-ID');
}

export function showToast(message, type = 'info') {
  const host = document.getElementById('toastContainer');
  if (!host) return;
  const icon = type === 'error' ? 'fa-circle-exclamation' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
  host.append(toast);
  window.setTimeout(() => toast.remove(), 4_500);
}
