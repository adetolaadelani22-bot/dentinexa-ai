let ALL_APPOINTMENTS = [];
let ALL_PATIENTS = [];
let ALL_REQUESTS = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = bootDashboard(['receptionist']);
  if (!user) return;

  wireSidebarNav();
  document.getElementById('book-for-patient-btn').addEventListener('click', openBookForPatientModal);
  document.getElementById('appointment-search').addEventListener('input', (e) => renderAppointments(e.target.value));

  await Promise.all([loadAppointments(), loadPatients(), loadRequests()]);
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

async function loadAppointments() {
  try {
    const json = await Api.get('/appointments');
    ALL_APPOINTMENTS = json.data || [];

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('stat-today').textContent = ALL_APPOINTMENTS.filter(a => a.appointment_date === today).length;
    document.getElementById('stat-pending').textContent = ALL_APPOINTMENTS.filter(a => a.status === 'pending').length;
    document.getElementById('stat-checked-in').textContent = ALL_APPOINTMENTS.filter(a => a.status === 'checked_in').length;

    renderAppointments('');
    renderUrgentAlerts();
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

function renderUrgentAlerts() {
  const container = document.getElementById('urgent-alert-container');
  if (!container) return;

  const urgentAppointments = (ALL_APPOINTMENTS || []).filter(a => ['urgent', 'emergency'].includes(String(a.status || '').toLowerCase()));
  const urgentRequests = (ALL_REQUESTS || []).filter(r =>
    r?.isUrgent || r?.emergency || ['urgent', 'emergency'].includes(String(r?.status || '').toLowerCase())
  );

  const urgentItems = [
    ...urgentAppointments.map(a => ({
      title: 'Emergency appointment',
      detail: `${a.patient_name || 'Patient'} • ${formatDate(a.appointment_date)} • ${formatTime(a.appointment_time)}`
    })),
    ...urgentRequests.map(r => ({
      title: 'Urgent intake request',
      detail: `${[r.firstName, r.lastName].filter(Boolean).join(' ') || 'Patient'} • ${r.service || 'Care request'} • ${r.preferredDate ? formatDate(r.preferredDate) : 'ASAP'}`
    }))
  ];

  if (!urgentItems.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = urgentItems.map(item => `
    <div class="emergency-alert">
      <div class="emergency-alert-icon">!</div>
      <div class="emergency-alert-body">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </div>
    </div>
  `).join('');
}

function renderAppointments(filterText) {
  const tbody = document.getElementById('appt-table-body');
  const filtered = ALL_APPOINTMENTS.filter(a =>
    !filterText || a.patient_name.toLowerCase().includes(filterText.toLowerCase())
  );
  tbody.innerHTML = filtered.length ? filtered.map(a => `
    <tr>
      <td>${formatDate(a.appointment_date)}</td>
      <td>${formatTime(a.appointment_time)}</td>
      <td>${escapeHtml(a.patient_name)}</td>
      <td>${escapeHtml(a.dentist_name || 'Unassigned')}</td>
      <td><span class="badge ${statusBadgeClass(a.status)}">${statusLabel(a.status)}</span></td>
      <td>
        ${a.status === 'pending' ? `<button class="btn btn-sm btn-secondary" onclick="updateStatus(${a.id},'confirmed')">Confirm</button>` : ''}
        ${a.status === 'confirmed' ? `<button class="btn btn-sm btn-secondary" onclick="updateStatus(${a.id},'checked_in')">Check in</button>` : ''}
        ${a.status === 'checked_in' ? `<button class="btn btn-sm btn-primary" onclick="updateStatus(${a.id},'ready')"><img src="../assets/icons/icon-bell.svg" alt="" width="13" height="13" class="inline-icon"> Call patient in</button>` : ''}
        ${['pending','confirmed'].includes(a.status) ? `<button class="btn btn-sm btn-ghost" onclick="updateStatus(${a.id},'cancelled')">Cancel</button>` : ''}
      </td>
    </tr>
  `).join('') : `<tr><td colspan="6"><div class="empty-state">No matching appointments.</div></td></tr>`;
}

async function updateStatus(id, status) {
  try {
    await Api.patch(`/appointments/${id}/status`, { status });
    showToast(status === 'ready' ? 'Patient notified — they\'ll see an alert on their dashboard.' : 'Appointment updated', 'success');
    loadAppointments();
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function loadPatients() {
  try {
    const json = await Api.get('/patients');
    ALL_PATIENTS = json.data || [];
    const tbody = document.getElementById('patients-table-body');
    tbody.innerHTML = ALL_PATIENTS.length ? ALL_PATIENTS.map(p => `
      <tr><td>${escapeHtml(p.full_name)}</td><td>${escapeHtml(p.email)}</td><td>${escapeHtml(p.phone || '—')}</td></tr>
    `).join('') : `<tr><td colspan="3"><div class="empty-state">No patients yet.</div></td></tr>`;
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function openBookForPatientModal() {
  let dentistOptions = '<option value="">No preference</option>';
  try {
    const json = await Api.get('/dentists');
    dentistOptions += (json.data || []).map(d => `<option value="${d.id}">${escapeHtml(d.full_name)}</option>`).join('');
  } catch (err) {
    showToast('Dentist list could not be loaded. You can still book without assigning a dentist.', 'warning', 6000);
  }

  const patientOptions = ALL_PATIENTS.map(p => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`).join('');

  const overlay = openModal(`
    <div class="modal-header">
      <h2>Book appointment for patient</h2>
      <button class="modal-close" aria-label="Close">&times;</button>
    </div>
    <form id="reception-booking-form">
      <div class="field">
        <label for="rb-patient">Patient</label>
        <select id="rb-patient" name="patientId" required><option value="">Select a patient…</option>${patientOptions}</select>
      </div>
      <div class="field">
        <label for="rb-dentist">Dentist</label>
        <select id="rb-dentist" name="dentistId">${dentistOptions}</select>
      </div>
      <div class="field">
        <label for="rb-date">Date</label>
        <input type="date" id="rb-date" name="appointmentDate" required min="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="field">
        <label for="rb-time">Time</label>
        <input type="time" id="rb-time" name="appointmentTime" required>
      </div>
      <div class="field">
        <label for="rb-reason">Reason</label>
        <textarea id="rb-reason" name="reason" data-voice-input></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Book appointment</button>
    </form>
  `);

  overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#reception-booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.post('/appointments', data);
      showToast('Appointment booked', 'success');
      closeModal(overlay);
      loadAppointments();
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  });
}

/* ---------------- New Requests ("Book Your First Visit" intake) ---------------- */

async function loadRequests() {
  try {
    const json = await Api.get('/first-visit-requests');
    ALL_REQUESTS = json.data || [];
    renderRequestsTable();
    renderUrgentAlerts();

    const pendingCount = ALL_REQUESTS.filter(r => r.status === 'request_received').length;
    const dot = document.getElementById('requests-alert-dot');
    if (dot) dot.classList.toggle('hidden', pendingCount === 0);
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

function renderRequestsTable() {
  const tbody = document.getElementById('requests-table-body');
  if (ALL_REQUESTS.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No new requests yet. They'll show up here as soon as a patient uses "Book Your First Visit."</div></td></tr>`;
    return;
  }
  tbody.innerHTML = ALL_REQUESTS.map(r => `
    <tr>
      <td>${escapeHtml((r.submittedAt || '').slice(0, 16))}</td>
      <td>${escapeHtml([r.firstName, r.lastName].filter(Boolean).join(' '))}</td>
      <td>${escapeHtml(r.service || '—')}</td>
      <td>${r.preferredDate ? formatDate(r.preferredDate) : '—'}${r.preferredTime ? ' · ' + formatTime(r.preferredTime) : ''}</td>
      <td><span class="badge ${statusBadgeClass(r.status)}">${statusLabel(r.status)}</span></td>
      <td>
        ${r.status === 'request_received' ? `<button class="btn btn-sm btn-secondary" onclick="openCreateAccountModal('${r.id}')">Review &amp; create account</button>` : ''}
        ${r.status === 'converted' ? `<span class="text-sm text-muted">Account created</span>` : ''}
      </td>
    </tr>
  `).join('');
}

function openCreateAccountModal(requestId) {
  const req = ALL_REQUESTS.find(r => r.id === requestId);
  if (!req) return;

  const overlay = openModal(`
    <div class="modal-header">
      <h2>Create patient account</h2>
      <button class="modal-close" aria-label="Close">&times;</button>
    </div>
    <p class="text-sm text-muted mb-16">
      Pulled directly from ${escapeHtml(req.firstName || 'the patient')}'s "Book Your First Visit" submission —
      review and edit anything below before creating the account.
    </p>
    <form id="create-account-form">
      <input type="hidden" name="requestId" value="${escapeHtml(req.id)}">
      <div class="field-row">
        <div class="field"><label>Full name</label><input type="text" name="fullName" value="${escapeHtml([req.firstName, req.middleName, req.lastName].filter(Boolean).join(' '))}" required></div>
        <div class="field"><label>Date of birth</label><input type="date" name="dateOfBirth" value="${escapeHtml(req.dateOfBirth || '')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(req.email || '')}" required></div>
        <div class="field"><label>Phone</label><input type="tel" name="phone" value="${escapeHtml(req.phone || '')}"></div>
      </div>
      <div class="field"><label>Address</label><input type="text" name="address" value="${escapeHtml(req.address || '')}"></div>
      <div class="field-row">
        <div class="field"><label>Emergency contact</label><input type="text" name="emergencyContactName" value="${escapeHtml(req.emergencyContactName || '')}"></div>
        <div class="field"><label>Emergency phone</label><input type="tel" name="emergencyContactPhone" value="${escapeHtml(req.emergencyContactPhone || '')}"></div>
      </div>
      <div class="field"><label>Allergies</label><textarea name="allergies">${escapeHtml(req.allergies || '')}</textarea></div>
      <div class="field"><label>Medical history</label><textarea name="medicalHistory">${escapeHtml(req.medicalHistory || '')}</textarea></div>
      <div class="field"><label>Dental history / previous treatment</label><textarea name="previousDentalTreatment">${escapeHtml(req.previousDentalTreatment || '')}</textarea></div>
      <div class="card" style="padding:12px 16px;margin-bottom:16px;background:var(--teal-100);border:none;">
        <p class="text-sm" style="margin:0;color:var(--teal-700);">
          Creating this account will also generate a unique Patient ID and confirm their requested appointment
          (${req.preferredDate ? formatDate(req.preferredDate) : 'date TBD'}${req.preferredTime ? ' · ' + formatTime(req.preferredTime) : ''}).
        </p>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Create account &amp; confirm appointment</button>
    </form>
  `);

  overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#create-account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const json = await Api.post('/patients/from-request', data);
      closeModal(overlay);
      showAccountCreatedModal(json.data);
      loadRequests();
      loadPatients();
      loadAppointments();
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  });
}

function showAccountCreatedModal({ patientId, tempPassword, user }) {
  const summary = `Patient ID: ${patientId}\nName: ${user.fullName}\nEmail: ${user.email}\nTemporary password: ${tempPassword}`;
  const overlay = openModal(`
    <div class="modal-header">
      <h2>✅ Patient account created</h2>
      <button class="modal-close" aria-label="Close">&times;</button>
    </div>
    <p class="text-sm text-muted mb-16">Share these details with ${escapeHtml(user.fullName)} so they can log in to the patient portal.</p>
    <div class="card" style="padding:16px;font-family:var(--font-mono);font-size:0.85rem;white-space:pre-wrap;">${escapeHtml(summary)}</div>
    <p class="text-sm text-muted mt-16">Their requested appointment has been confirmed and now appears on the schedule.</p>
    <button class="btn btn-primary btn-block mt-16" id="copy-account-btn">Copy to clipboard</button>
  `);
  overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#copy-account-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(summary);
      showToast('Copied to clipboard', 'success');
    } catch (e) {
      showToast('Could not copy automatically — please copy manually.', 'error');
    }
  });
}
