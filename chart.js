import { countBy } from './utils.js';

const chartInstances = {};
let latestRecords = [];
const palette = ['#3973e8', '#856be8', '#33ad9a', '#e79a36', '#d95b8e', '#5d89bd', '#d06cb9', '#92a84f'];

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function buildChart(id, type, source, field, options = {}) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;
  chartInstances[id]?.destroy();
  const entries = countBy(source, field, options.limit || Infinity);
  const labels = entries.map(([label]) => label);
  const values = entries.map(([, value]) => value);
  const color = css('--text');
  const muted = css('--muted');
  const line = css('--line');
  chartInstances[id] = new window.Chart(canvas, {
    type,
    data: { labels, datasets: [{ data: values, backgroundColor: type === 'bar' ? palette[0] : palette, borderColor: type === 'bar' ? palette[0] : css('--surface'), borderWidth: type === 'bar' ? 0 : 3, borderRadius: type === 'bar' ? 6 : 0, maxBarThickness: 28 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: type !== 'bar', position: 'bottom', labels: { color, boxWidth: 9, boxHeight: 9, padding: 15, font: { family: 'Inter', size: 10 } } },
        tooltip: { backgroundColor: css('--sidebar'), padding: 10, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' }, displayColors: type !== 'bar' },
      },
      scales: type === 'bar' ? {
        x: { grid: { color: line, drawBorder: false }, ticks: { color: muted, font: { family: 'Inter', size: 10 }, precision: 0 }, border: { display: false } },
        y: { grid: { display: false }, ticks: { color: muted, font: { family: 'Inter', size: 10 } }, border: { display: false } },
      } : {},
      indexAxis: options.horizontal ? 'y' : 'x',
      cutout: type === 'doughnut' ? '66%' : undefined,
    },
  });
}

export function renderCharts(records) {
  latestRecords = records || [];
  if (!window.Chart) return;
  buildChart('positionChart', 'bar', latestRecords, 'position', { limit: 5, horizontal: true });
  buildChart('branchChart', 'bar', latestRecords, 'branch', { limit: 6 });
  buildChart('mbtiChart', 'doughnut', latestRecords, 'mbti', { limit: 8 });
  buildChart('genderChart', 'doughnut', latestRecords, 'gender');
}

window.addEventListener('themechange', () => { if (latestRecords.length || Object.keys(chartInstances).length) renderCharts(latestRecords); });
