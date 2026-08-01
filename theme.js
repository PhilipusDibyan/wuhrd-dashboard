const THEME_KEY = 'talentflow-theme';

function iconMarkup(isDark) { return isDark ? 'fa-solid fa-sun' : 'fa-regular fa-moon'; }

function paintButtons(isDark) {
  document.querySelectorAll('#themeToggle i, #themeToggleSide i').forEach(icon => { icon.className = iconMarkup(isDark); });
  const sideText = document.querySelector('#themeToggleSide span');
  if (sideText) sideText.textContent = isDark ? 'Tema terang' : 'Tema gelap';
}

export function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  paintButtons(isDark);
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: isDark ? 'dark' : 'light' } }));
}

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved || preferred);
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  };
  document.getElementById('themeToggle')?.addEventListener('click', toggle);
  document.getElementById('themeToggleSide')?.addEventListener('click', toggle);
}
