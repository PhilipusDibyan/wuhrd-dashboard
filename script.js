import { AUTO_REFRESH_MS, fetchApplicants } from './api.js';
import { FILTERS, debounce, escapeHtml, formatDate, getUniqueValues, initials, isToday, isUrl, paginate, showToast, sortRecords, toSearchText } from './utils.js';
import { closeApplicantModal, initModal, openApplicantModal } from './modal.js';
import { renderCharts } from './chart.js';
import { exportExcel, exportPdf } from './export.js';
import { initTheme } from './theme.js';

const state = {
  all: [], filtered: [], page: 1, perPage: 10,
  sort: { field: 'appliedAt', direction: 'desc' },
  isLoading: false, isDemo: false, pendingExportFormat: null,
};

const $ = id => document.getElementById(id);
const dom = {
  body: $('applicantBody'), loading: $('tableLoading'), empty: $('emptyState'), pagination: $('pagination'),
  summary: $('resultSummary'), search: $('searchInput'), searchClear: $('searchClear'), perPage: $('perPage'),
  filterPanel: $('filterPanel'), filterToggle: $('filterToggle'), activeFilterCount: $('activeFilterCount'), activeFilterList: $('activeFilterList'),
  refresh: $('refreshButton'), lastUpdated: $('lastUpdated'), apiNotice: $('apiNotice'), syncStatus: $('syncStatus'),
};

function selectedFilters() {
  return Object.fromEntries(FILTERS.map(([field, id]) => [field, $(id)?.value || '']));
}

function filterRecords() {
  const query = dom.search.value.trim().toLocaleLowerCase('id-ID');
  const filters = selectedFilters();
  const filtered = state.all.filter(record => {
    const matchesSearch = !query || toSearchText(record).includes(query);
    const matchesFilters = Object.entries(filters).every(([field, value]) => !value || record[field] === value);
    return matchesSearch && matchesFilters;
  });
  state.filtered = sortRecords(filtered, state.sort.field, state.sort.direction);
}

function renderFilterOptions() {
  FILTERS.forEach(([field, id, label]) => {
    const select = $(id);
    if (!select) return;
    const selected = select.value;
    const values = getUniqueValues(state.all, field);
    select.innerHTML = `<option value="">Semua ${label.toLowerCase()}</option>${values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
    select.value = values.includes(selected) ? selected : '';
  });
}

function renderMetrics() {
  const data = state.filtered;
  const distinct = field => new Set(data.map(item => item[field]).filter(Boolean)).size;
  $('metricTotal').textContent = data.length.toLocaleString('id-ID');
  $('metricTotalNote').textContent = data.length === state.all.length ? 'Semua kandidat' : `Dari ${state.all.length} kandidat`;
  $('metricToday').textContent = data.filter(item => isToday(item.appliedAt)).length.toLocaleString('id-ID');
  $('metricPosition').textContent = distinct('position').toLocaleString('id-ID');
  $('metricBranch').textContent = distinct('branch').toLocaleString('id-ID');
  $('metricMbti').textContent = distinct('mbti').toLocaleString('id-ID');
  $('sidebarCount').textContent = state.all.length.toLocaleString('id-ID');
}

function candidateAvatar(record) {
  if (isUrl(record.photoUrl)) return `<span class="avatar"><img src="${escapeHtml(record.photoUrl)}" alt="" /></span>`;
  return `<span class="avatar">${escapeHtml(initials(record.name))}</span>`;
}

function renderTable() {
  const pageData = paginate(state.filtered, state.page, state.perPage);
  state.page = pageData.page;
  dom.loading.classList.toggle('hidden', !state.isLoading || state.all.length > 0);
  dom.empty.classList.toggle('hidden', state.isLoading || state.filtered.length > 0);
  dom.body.innerHTML = pageData.items.map((record, index) => {
    const absoluteNumber = (pageData.page - 1) * state.perPage + index + 1;
    const recordIndex = state.all.indexOf(record);
    return `<tr>
      <td class="number-column">${absoluteNumber}</td>
      <td class="candidate-column"><div class="candidate-cell">${candidateAvatar(record)}<div class="candidate-info"><div class="candidate-name" title="${escapeHtml(record.name)}">${escapeHtml(record.name)}</div><div class="candidate-email" title="${escapeHtml(record.email || 'Email tidak diisi')}">${escapeHtml(record.email || 'Email tidak diisi')}</div></div></div></td>
      <td class="position-column"><span class="position-tag" title="${escapeHtml(record.position || '—')}">${escapeHtml(record.position || '—')}</span></td>
      <td class="branch-column"><span class="branch-value" title="${escapeHtml(record.branch || '—')}">${escapeHtml(record.branch || '—')}</span></td><td class="whatsapp-column">${escapeHtml(record.whatsapp || '—')}</td>
      <td class="mbti-column"><span class="mbti-tag">${escapeHtml(record.mbti || '—')}</span></td><td class="date-column">${formatDate(record.appliedAt)}</td>
      <td class="action-column"><button class="detail-button" data-detail-index="${recordIndex}" type="button"><i class="fa-regular fa-eye"></i> Detail</button></td>
    </tr>`;
  }).join('');
  const start = state.filtered.length ? (pageData.page - 1) * state.perPage + 1 : 0;
  const end = Math.min(pageData.page * state.perPage, state.filtered.length);
  dom.summary.textContent = state.isLoading ? 'Memuat data pelamar…' : `Menampilkan ${start}–${end} dari ${state.filtered.length} pelamar`;
  renderPagination(pageData.page, pageData.totalPages);
  renderSortControls();
}

function paginationModel(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

function renderPagination(current, total) {
  if (total <= 1) { dom.pagination.innerHTML = ''; return; }
  const pages = paginationModel(current, total).map(value => value === '…'
    ? '<span class="page-ellipsis">…</span>'
    : `<button class="page-button ${value === current ? 'active' : ''}" data-page="${value}" type="button" aria-label="Halaman ${value}">${value}</button>`).join('');
  dom.pagination.innerHTML = `<button class="page-button" data-page="${current - 1}" type="button" ${current === 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya"><i class="fa-solid fa-chevron-left"></i></button>${pages}<button class="page-button" data-page="${current + 1}" type="button" ${current === total ? 'disabled' : ''} aria-label="Halaman berikutnya"><i class="fa-solid fa-chevron-right"></i></button>`;
}

function renderSortControls() {
  document.querySelectorAll('.sort-button').forEach(button => {
    const active = button.dataset.sort === state.sort.field;
    button.classList.toggle('active', active);
    const icon = button.querySelector('i');
    if (icon) icon.className = `fa-solid ${active ? (state.sort.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`;
  });
}

function renderActiveFilters() {
  const selected = selectedFilters();
  const query = dom.search.value.trim();
  const chips = [];
  if (query) chips.push(`<span class="filter-chip">Pencarian: ${escapeHtml(query)} <button type="button" data-clear-search aria-label="Hapus pencarian"><i class="fa-solid fa-xmark"></i></button></span>`);
  FILTERS.forEach(([field, id, label]) => {
    if (selected[field]) chips.push(`<span class="filter-chip">${label}: ${escapeHtml(selected[field])} <button type="button" data-clear-filter="${id}" aria-label="Hapus filter ${escapeHtml(label)}"><i class="fa-solid fa-xmark"></i></button></span>`);
  });
  dom.activeFilterList.innerHTML = chips.join('');
  dom.activeFilterCount.textContent = chips.length;
  dom.searchClear.classList.toggle('hidden', !query);
}

function renderData() {
  filterRecords();
  renderMetrics();
  renderTable();
  renderActiveFilters();
  renderCharts(state.filtered);
}

function applyFilters({ resetPage = true } = {}) {
  if (resetPage) state.page = 1;
  renderData();
}

function resetFilters() {
  dom.search.value = '';
  FILTERS.forEach(([, id]) => { if ($(id)) $(id).value = ''; });
  state.page = 1;
  applyFilters({ resetPage: false });
}

function setLoading(loading) {
  state.isLoading = loading;
  dom.refresh.classList.toggle('is-loading', loading);
  dom.refresh.disabled = loading;
  if (loading && state.all.length === 0) renderTable();
}

function renderConnectionStatus(isDemo) {
  dom.apiNotice.classList.toggle('hidden', !isDemo);
  dom.syncStatus.innerHTML = isDemo
    ? '<span class="status-dot" style="background:#e4a536"></span><span>Mode demo</span>'
    : '<span class="status-dot"></span><span>Tersinkronisasi</span>';
}

async function loadApplicants({ silent = false } = {}) {
  if (state.isLoading) return;
  setLoading(true);
  try {
    const { data, isDemo } = await fetchApplicants();
    state.all = data;
    state.isDemo = isDemo;
    renderFilterOptions();
    renderConnectionStatus(isDemo);
    dom.lastUpdated.textContent = `Diperbarui ${new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
    if (!silent) showToast(isDemo ? 'Menampilkan data contoh. Hubungkan URL API untuk data aktual.' : `${data.length} pelamar berhasil disinkronkan.`, isDemo ? 'info' : 'success');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Data pelamar tidak dapat dimuat.', 'error');
    dom.syncStatus.innerHTML = '<span class="status-dot" style="background:#dc5b5b"></span><span>Gagal sinkronisasi</span>';
  } finally {
    setLoading(false);
    renderData();
  }
}

function closeMobileNav() {
  $('sidebar').classList.remove('open');
  $('mobileBackdrop').classList.remove('open');
}

function closeExportMenus() {
  document.querySelectorAll('.export-popover').forEach(menu => menu.classList.remove('open'));
  document.querySelectorAll('[data-export-menu]').forEach(button => button.setAttribute('aria-expanded', 'false'));
}

async function exportAll(format) {
  closeExportMenus();
  if (format === 'excel') return exportExcel(state.filtered);
  if (format === 'pdf') return exportPdf(state.filtered);
}

function closeReportPicker() {
  const backdrop = $('reportPickerBackdrop');
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  state.pendingExportFormat = null;
}

function openReportPicker(format) {
  closeExportMenus();
  if (!state.filtered.length) return showToast('Tidak ada pelamar pada hasil filter saat ini.', 'error');

  const formatName = format === 'excel' ? 'Excel' : 'PDF';
  state.pendingExportFormat = format;
  $('reportPickerTitle').textContent = `Pilih pelamar untuk ${formatName}`;
  $('reportPickerDescription').textContent = `Laporan ${formatName} akan memuat satu pelamar, termasuk ekspektasi gajinya.`;
  $('confirmIndividualExport').innerHTML = `<i class="fa-solid fa-file-export"></i> Ekspor ${formatName}`;
  $('reportApplicantSelect').innerHTML = state.filtered.map(record => {
    const index = state.all.indexOf(record);
    const identity = [record.position, record.branch, record.email].filter(Boolean).join(' · ');
    return `<option value="${index}">${escapeHtml(record.name)}${identity ? ` — ${escapeHtml(identity)}` : ''}</option>`;
  }).join('');

  const backdrop = $('reportPickerBackdrop');
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  $('reportApplicantSelect').focus();
}

async function confirmIndividualExport() {
  const format = state.pendingExportFormat;
  const index = Number($('reportApplicantSelect').value);
  const applicant = state.all[index];
  if (!format || !applicant) return showToast('Pelamar untuk laporan belum dipilih.', 'error');
  const confirmButton = $('confirmIndividualExport');
  confirmButton.disabled = true;
  try {
    if (format === 'excel') exportExcel([applicant]);
    if (format === 'pdf') await exportPdf([applicant]);
    closeReportPicker();
  } finally {
    confirmButton.disabled = false;
  }
}

function initEvents() {
  dom.search.addEventListener('input', debounce(() => applyFilters(), 200));
  dom.searchClear.addEventListener('click', () => { dom.search.value = ''; applyFilters(); dom.search.focus(); });
  FILTERS.forEach(([, id]) => $(id)?.addEventListener('change', () => applyFilters()));
  $('resetFilters').addEventListener('click', resetFilters);
  $('clearFiltersTop').addEventListener('click', resetFilters);
  $('emptyReset').addEventListener('click', resetFilters);
  dom.activeFilterList.addEventListener('click', event => {
    const filterButton = event.target.closest('[data-clear-filter]');
    if (filterButton) { $(filterButton.dataset.clearFilter).value = ''; applyFilters(); return; }
    if (event.target.closest('[data-clear-search]')) { dom.search.value = ''; applyFilters(); dom.search.focus(); }
  });
  $('filterToggle').addEventListener('click', () => {
    const collapsed = dom.filterPanel.classList.toggle('collapsed');
    $('filterToggle').setAttribute('aria-expanded', String(!collapsed));
  });
  dom.perPage.addEventListener('change', () => { state.perPage = Number(dom.perPage.value); state.page = 1; renderTable(); });
  dom.pagination.addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    renderTable();
    document.querySelector('.table-wrap')?.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.querySelector('.applicant-table thead').addEventListener('click', event => {
    const button = event.target.closest('[data-sort]');
    if (!button) return;
    const field = button.dataset.sort;
    state.sort = state.sort.field === field ? { field, direction: state.sort.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: field === 'appliedAt' ? 'desc' : 'asc' };
    applyFilters();
  });
  dom.body.addEventListener('click', event => {
    const button = event.target.closest('[data-detail-index]');
    if (button) openApplicantModal(state.all[Number(button.dataset.detailIndex)]);
  });
  dom.refresh.addEventListener('click', () => loadApplicants());
  $('exportExcel').addEventListener('click', () => exportAll('excel'));
  $('exportPdf').addEventListener('click', () => exportAll('pdf'));
  document.querySelector('.export-actions').addEventListener('click', event => {
    const toggle = event.target.closest('[data-export-menu]');
    if (toggle) {
      const menu = $(`${toggle.dataset.exportMenu}ExportMenu`);
      const willOpen = !menu.classList.contains('open');
      closeExportMenus();
      menu.classList.toggle('open', willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
      return;
    }
    const all = event.target.closest('[data-export-all]');
    if (all) return exportAll(all.dataset.exportAll);
    const individual = event.target.closest('[data-export-individual]');
    if (individual) openReportPicker(individual.dataset.exportIndividual);
  });
  $('closeReportPicker').addEventListener('click', closeReportPicker);
  $('cancelReportPicker').addEventListener('click', closeReportPicker);
  $('confirmIndividualExport').addEventListener('click', confirmIndividualExport);
  $('reportPickerBackdrop').addEventListener('click', event => { if (event.target === $('reportPickerBackdrop')) closeReportPicker(); });
  document.addEventListener('click', event => { if (!event.target.closest('.export-actions')) closeExportMenus(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeExportMenus(); closeReportPicker(); } });
  $('closeNotice').addEventListener('click', () => dom.apiNotice.classList.add('hidden'));
  $('mobileMenu').addEventListener('click', () => { $('sidebar').classList.add('open'); $('mobileBackdrop').classList.add('open'); });
  $('mobileBackdrop').addEventListener('click', closeMobileNav);
  document.querySelectorAll('.side-nav a').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('.side-nav a').forEach(item => item.classList.remove('active'));
    link.classList.add('active'); closeMobileNav();
  }));
  window.addEventListener('beforeunload', closeApplicantModal);
}

function init() {
  initTheme();
  initModal();
  initEvents();
  loadApplicants();
  window.setInterval(() => loadApplicants({ silent: true }), AUTO_REFRESH_MS);
}

init();
