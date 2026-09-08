/** DentiNexa AI — shared UI helpers used across every page */

function showToast(message, type = 'success', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 200ms ease';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function extractErrorMessage(err) {
  if (err && err.message) return err.message;
  if (err && err.networkError) return 'Unable to reach the server. Please check your connection.';
  return 'Something went wrong. Please try again.';
}

/* ---- Theme (light / dark) ---- */
function initTheme() {
  const saved = localStorage.getItem('dc_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeToggleIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dc_theme', next);
  updateThemeToggleIcon(next);
}

function updateThemeToggleIcon(theme) {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const root = typeof appRoot === 'function' ? appRoot() : './';
  const icon = theme === 'dark' ? 'icon-moon.svg' : 'icon-sun.svg';
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  btn.innerHTML = `<img src="${root}assets/icons/${icon}" alt="" width="20" height="20">`;
  btn.setAttribute('aria-label', label);
}

document.addEventListener('DOMContentLoaded', initTheme);

/* ---- Formatting helpers ---- */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${period}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function statusBadgeClass(status) {
  const map = {
    pending: 'badge-warning',
    confirmed: 'badge-blue',
    checked_in: 'badge-teal',
    ready: 'badge-alert',
    urgent: 'badge-danger',
    emergency: 'badge-danger',
    completed: 'badge-emerald',
    cancelled: 'badge-gray',
    no_show: 'badge-danger',
    request_received: 'badge-warning',
    reviewed: 'badge-blue',
    converted: 'badge-emerald',
    unpaid: 'badge-warning',
    paid: 'badge-emerald',
    overdue: 'badge-danger',
    active: 'badge-emerald',
    suspended: 'badge-danger'
  };
  return map[status] || 'badge-gray';
}

function statusLabel(status) {
  return (status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/* ---- Skeleton loader helper ---- */
function skeletonRows(count = 3, height = 56) {
  return Array.from({ length: count }).map(() =>
    `<div class="skeleton" style="height:${height}px;margin-bottom:10px;"></div>`
  ).join('');
}
