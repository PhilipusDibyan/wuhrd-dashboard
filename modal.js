import { escapeHtml, formatCurrency, formatDate, initials, isUrl } from './utils.js';

const detailGroups = [
  {
    title: 'Informasi kontak', icon: 'fa-address-card', fields: [
      ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['address', 'Alamat', true], ['birthPlaceDate', 'Tempat & tanggal lahir'],
    ],
  },
  {
    title: 'Profil lamaran', icon: 'fa-briefcase', fields: [
      ['position', 'Posisi yang dilamar'], ['branch', 'Cabang penempatan'], ['appliedAt', 'Tanggal melamar'], ['availability', 'Kesediaan mulai kerja'], ['expectedSalary', 'Ekspektasi gaji'], ['lastSalary', 'Gaji terakhir'],
    ],
  },
  {
    title: 'Pendidikan & pengalaman', icon: 'fa-graduation-cap', fields: [
      ['education', 'Pendidikan terakhir'], ['experience', 'Pengalaman kerja', true], ['skills', 'Keahlian', true], ['certificate', 'Sertifikat', true, true],
    ],
  },
  {
    title: 'Data pribadi', icon: 'fa-user', fields: [
      ['gender', 'Jenis kelamin'], ['maritalStatus', 'Status pernikahan'], ['religion', 'Agama'], ['mbti', 'Tipe MBTI'],
    ],
  },
  {
    title: 'Dokumen', icon: 'fa-folder-open', fields: [
      ['cvUrl', 'Curriculum Vitae', false, true], ['mbtiFileUrl', 'Hasil MBTI', false, true],
    ],
  },
];

const modal = () => document.getElementById('modalBackdrop');
const body = () => document.getElementById('modalBody');

function humanizeKey(key) {
  return String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, char => char.toUpperCase());
}

function fileLinksMarkup(value) {
  const links = String(value).split(/[\s,]+/).filter(Boolean).filter(isUrl);
  if (!links.length) return escapeHtml(value);
  if (links.length === 1) {
    return `<a class="file-link" href="${escapeHtml(links[0])}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka dokumen</a>`;
  }
  return links.map((link, index) => `<a class="file-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Dokumen ${index + 1}</a>`).join(' &nbsp; ');
}

function valueMarkup(applicant, key, isFile = false) {
  const value = applicant[key];
  if (!value) return '—';
  if (isFile) return fileLinksMarkup(value);
  if (key === 'appliedAt') return escapeHtml(formatDate(value, true));
  if (key === 'expectedSalary' || key === 'lastSalary') return escapeHtml(formatCurrency(value));
  return escapeHtml(value);
}

function sectionMarkup(group, applicant) {
  const rows = group.fields.map(([key, label, full, isFile]) => `
    <div class="detail-item ${full ? 'full' : ''}">
      <dt>${escapeHtml(label)}</dt><dd>${valueMarkup(applicant, key, isFile)}</dd>
    </div>`).join('');
  return `<section class="detail-section"><h3><i class="fa-solid ${group.icon}"></i>${group.title}</h3><dl class="detail-grid">${rows}</dl></section>`;
}

function rawDataMarkup(applicant) {
  const canonicalValues = new Set(Object.entries(applicant)
    .filter(([key, value]) => !['raw', 'id', 'photoUrl'].includes(key) && value)
    .map(([, value]) => String(value).trim()));
  const extras = Object.entries(applicant.raw || {}).filter(([, value]) => {
    const plain = String(value ?? '').trim();
    return plain && !canonicalValues.has(plain) && typeof value !== 'object';
  });
  if (!extras.length) return '';
  return `<section class="detail-section"><details class="other-data"><summary>Data formulir lainnya (${extras.length})</summary><dl class="detail-grid">${extras.map(([key, value]) => `<div class="detail-item"><dt>${escapeHtml(humanizeKey(key))}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></details></section>`;
}

function avatarMarkup(applicant) {
  const photo = isUrl(applicant.photoUrl) ? `<img src="${escapeHtml(applicant.photoUrl)}" alt="Foto ${escapeHtml(applicant.name)}" />` : initials(applicant.name);
  return `<span class="avatar">${photo}</span>`;
}

export function openApplicantModal(applicant) {
  if (!applicant) return;
  const host = body();
  const backdrop = modal();
  if (!host || !backdrop) return;
  host.innerHTML = `
    <div class="profile-hero">
      ${avatarMarkup(applicant)}
      <div><h3>${escapeHtml(applicant.name)}</h3><p>${escapeHtml(applicant.position || 'Posisi belum diisi')} · ${escapeHtml(applicant.branch || 'Cabang belum diisi')}</p></div>
    </div>
    ${detailGroups.map(group => sectionMarkup(group, applicant)).join('')}
    ${rawDataMarkup(applicant)}`;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  backdrop.querySelector('.close-modal')?.focus();
}

export function closeApplicantModal() {
  const backdrop = modal();
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export function initModal() {
  modal()?.querySelector('.close-modal')?.addEventListener('click', closeApplicantModal);
  modal()?.addEventListener('click', event => { if (event.target === modal()) closeApplicantModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeApplicantModal(); });
}