/**
 * Call this at the top of every dashboard page.
 * Guards the route, fills in the sidebar user card, wires logout/theme/mobile nav.
 */
function bootDashboard(allowedRoles) {
  const user = requireAuth(allowedRoles);
  if (!user) return null;

  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-avatar');
  const patientIdEl = document.getElementById('sidebar-patient-id');
  if (nameEl) nameEl.textContent = user.fullName;
  if (roleEl) roleEl.textContent = user.role;
  if (avatarEl) avatarEl.textContent = initialsOf(user.fullName);
  if (patientIdEl) patientIdEl.textContent = user.patientId ? user.patientId : '';

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => Api.auth.logout());

  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  const themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  return user;
}

function initialsOf(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function initTabs(root = document) {
  root.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.tabs');
      const panelId = btn.dataset.tab;
      group.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const panelsContainer = group.nextElementSibling ? group.parentElement : root;
      root.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const target = document.getElementById(panelId);
      if (target) target.classList.add('active');
    });
  });
}

function openModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  if (typeof initVoiceInputs === 'function') initVoiceInputs(overlay); // pick up any data-voice-input fields inside this modal
  return overlay;
}
function closeModal(overlay) {
  if (overlay) overlay.remove();
}
