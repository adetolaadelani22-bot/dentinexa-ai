document.addEventListener('DOMContentLoaded', async () => {
  const user = bootDashboard(['admin']);
  if (!user) return;

  wireSidebarNav();
  document.getElementById('add-staff-btn').addEventListener('click', openAddStaffModal);

  await Promise.all([loadStats(), loadUsers(), loadAuditLogs()]);
});

function wireSidebarNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
      document.getElementById(link.dataset.tab).classList.remove('hidden');
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

async function loadStats() {
  try {
    const json = await Api.get('/admin/stats');
    const s = json.data;
    document.getElementById('stat-patients').textContent = s.totalPatients;
    document.getElementById('stat-dentists').textContent = s.totalDentists;
    document.getElementById('stat-upcoming').textContent = s.upcomingAppointments;
    document.getElementById('stat-outstanding').textContent = formatCurrency(s.outstanding);

    const breakdown = document.getElementById('status-breakdown');
    if (s.appointmentsByStatus.length === 0) {
      breakdown.innerHTML = '<p class="text-muted">No appointment data yet.</p>';
    } else {
      const total = s.appointmentsByStatus.reduce((sum, r) => sum + r.count, 0);
      breakdown.innerHTML = s.appointmentsByStatus.map(r => `
        <div class="mb-16">
          <div class="flex justify-between text-sm mb-8">
            <span>${statusLabel(r.status)}</span><span class="text-muted">${r.count}</span>
          </div>
          <div class="arch-progress"><span style="--pct:${Math.round((r.count/total)*100)}%"></span></div>
        </div>
      `).join('');
    }
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function loadUsers() {
  try {
    const json = await Api.get('/admin/users');
    const users = json.data || [];
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = users.length ? users.map(u => `
      <tr>
        <td>${escapeHtml(u.full_name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge badge-blue">${escapeHtml(u.role)}</span></td>
        <td><span class="badge ${statusBadgeClass(u.status)}">${statusLabel(u.status)}</span></td>
        <td>${formatDate(u.created_at.slice(0,10))}</td>
        <td>
          ${u.status === 'active'
            ? `<button class="btn btn-sm btn-ghost" onclick="setUserStatus(${u.id},'suspended')">Suspend</button>`
            : `<button class="btn btn-sm btn-secondary" onclick="setUserStatus(${u.id},'active')">Reactivate</button>`}
        </td>
      </tr>
    `).join('') : `<tr><td colspan="6"><div class="empty-state">No users found.</div></td></tr>`;
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function setUserStatus(id, status) {
  try {
    await Api.patch(`/admin/users/${id}/status`, { status });
    showToast(`User ${status === 'active' ? 'reactivated' : 'suspended'}`, 'success');
    loadUsers();
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function loadAuditLogs() {
  try {
    const json = await Api.get('/admin/audit-logs');
    const logs = json.data || [];
    const tbody = document.getElementById('audit-table-body');
    tbody.innerHTML = logs.length ? logs.map(l => `
      <tr>
        <td class="font-mono text-sm">${l.created_at}</td>
        <td>${escapeHtml(l.full_name || 'Unknown')}</td>
        <td><span class="badge badge-gray">${escapeHtml(l.action)}</span></td>
        <td class="text-sm text-muted">${escapeHtml(l.details || '—')}</td>
      </tr>
    `).join('') : `<tr><td colspan="4"><div class="empty-state">No activity recorded yet.</div></td></tr>`;
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

function openAddStaffModal() {
  const overlay = openModal(`
    <div class="modal-header">
      <h2>Add staff account</h2>
      <button class="modal-close" aria-label="Close">&times;</button>
    </div>
    <form id="add-staff-form">
      <div class="field">
        <label for="staff-role">Role</label>
        <select id="staff-role" name="role" required>
          <option value="dentist">Dentist</option>
          <option value="receptionist">Receptionist</option>
          <option value="admin">Administrator</option>
        </select>
      </div>
      <div class="field">
        <label for="staff-name">Full name</label>
        <input type="text" id="staff-name" name="fullName" required>
      </div>
      <div class="field">
        <label for="staff-email">Email</label>
        <input type="email" id="staff-email" name="email" required>
      </div>
      <div class="field">
        <label for="staff-phone">Phone</label>
        <input type="tel" id="staff-phone" name="phone">
      </div>
      <div class="field">
        <label for="staff-password">Temporary password</label>
        <input type="text" id="staff-password" name="password" required minlength="8" value="Welcome@2026">
        <p class="field-hint">The staff member logs in with this immediately — no separate sign-up needed. You'll get a copy-ready summary after creating the account.</p>
      </div>

      <div id="dentist-only-fields">
        <div class="field">
          <label for="staff-specialty">Specialty</label>
          <input type="text" id="staff-specialty" name="specialty" placeholder="e.g. Orthodontics & General Dentistry">
        </div>
        <div class="field">
          <label for="staff-years">Years of experience</label>
          <input type="number" id="staff-years" name="yearsExperience" min="0" max="60">
        </div>
        <div class="field">
          <label for="staff-bio">Short bio</label>
          <textarea id="staff-bio" name="bio" placeholder="Shown to patients on the booking page and public site." data-voice-input></textarea>
        </div>
        <p class="field-hint mb-16">This dentist will immediately appear in the patient booking dropdown and the public "Meet the team" section once created.</p>
      </div>

      <button type="submit" class="btn btn-primary btn-block">Create account</button>
    </form>
  `);

  const roleSelect = overlay.querySelector('#staff-role');
  const dentistFields = overlay.querySelector('#dentist-only-fields');
  const syncDentistFields = () => dentistFields.classList.toggle('hidden', roleSelect.value !== 'dentist');
  roleSelect.addEventListener('change', syncDentistFields);
  syncDentistFields();

  overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#add-staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.post('/admin/users', data);
      closeModal(overlay);
      loadUsers();
      loadStats();
      showCredentialsHandoff(data);
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  });
}

/** Shown right after account creation so the admin can hand off login details to the new staff member. */
function showCredentialsHandoff(data) {
  const summary = `Role: ${data.role}\nName: ${data.fullName}\nEmail: ${data.email}\nTemporary password: ${data.password}`;
  const overlay = openModal(`
    <div class="modal-header">
      <h2>✅ Account created</h2>
      <button class="modal-close" aria-label="Close">&times;</button>
    </div>
    <p class="text-sm text-muted mb-16">Share these details with ${escapeHtml(data.fullName)} so they can log in right away — no separate sign-up required.</p>
    <div class="card" style="padding:16px;font-family:var(--font-mono);font-size:0.85rem;white-space:pre-wrap;">${escapeHtml(summary)}</div>
    ${data.role === 'dentist' ? `<p class="text-sm text-muted mt-16">${escapeHtml(data.fullName)} is now bookable — patients will see them in the "Preferred dentist" list immediately.</p>` : ''}
    <button class="btn btn-primary btn-block mt-16" id="copy-creds-btn">Copy to clipboard</button>
  `);
  overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#copy-creds-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(summary);
      showToast('Copied to clipboard', 'success');
    } catch (e) {
      showToast('Could not copy automatically — please copy manually.', 'error');
    }
  });
}
