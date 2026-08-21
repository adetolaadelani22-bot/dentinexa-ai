let CURRENT_USER = null;
let PATIENTS_CACHE = [];

document.addEventListener('DOMContentLoaded', async () => {
  CURRENT_USER = bootDashboard(['dentist']);
  if (!CURRENT_USER) return;

  wireSidebarNav();
  wireClinicalForm();
  wirePrescriptionForm();

  await Promise.all([loadSchedule(), loadPatients()]);
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

async function loadSchedule() {
  try {
    const json = await Api.get('/dentists/me/schedule');
    const appointments = json.data || [];

    const today = new Date().toISOString().slice(0, 10);
    const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    document.getElementById('stat-today-count').textContent = appointments.filter(a => a.appointment_date === today).length;
    document.getElementById('stat-week-count').textContent = appointments.filter(a => a.appointment_date <= weekFromNow).length;
    document.getElementById('stat-pending-count').textContent = appointments.filter(a => a.status === 'pending').length;

    const tbody = document.getElementById('schedule-table-body');
    tbody.innerHTML = appointments.length ? appointments.map(a => `
      <tr>
        <td>${formatDate(a.appointment_date)}</td>
        <td>${formatTime(a.appointment_time)}</td>
        <td>${escapeHtml(a.patient_name)}</td>
        <td>${escapeHtml(a.reason || '—')}</td>
        <td><span class="badge ${statusBadgeClass(a.status)}">${statusLabel(a.status)}</span></td>
        <td>
          ${a.status === 'pending' ? `<button class="btn btn-sm btn-secondary" onclick="setAppointmentStatus(${a.id},'confirmed')">Confirm</button>` : ''}
          ${a.status === 'confirmed' ? `<button class="btn btn-sm btn-secondary" onclick="setAppointmentStatus(${a.id},'checked_in')">Check in</button>` : ''}
          ${a.status === 'checked_in' ? `<button class="btn btn-sm btn-primary" onclick="setAppointmentStatus(${a.id},'ready')"><img src="../assets/icons/icon-bell.svg" alt="" width="13" height="13" class="inline-icon"> Call patient in</button>` : ''}
          ${a.status === 'ready' ? `<button class="btn btn-sm btn-primary" onclick="setAppointmentStatus(${a.id},'completed')">Complete visit</button>` : ''}
        </td>
      </tr>
    `).join('') : `<tr><td colspan="6"><div class="empty-state">No upcoming appointments.</div></td></tr>`;
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function setAppointmentStatus(id, status) {
  try {
    await Api.patch(`/appointments/${id}/status`, { status });
    showToast(status === 'ready' ? 'Patient notified — they\'ll see an alert on their dashboard.' : 'Appointment updated', 'success');
    loadSchedule();
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function loadPatients() {
  try {
    const json = await Api.get('/patients');
    PATIENTS_CACHE = json.data || [];

    const tbody = document.getElementById('patients-table-body');
    tbody.innerHTML = PATIENTS_CACHE.length ? PATIENTS_CACHE.map(p => `
      <tr>
        <td>${escapeHtml(p.full_name)}</td>
        <td>${escapeHtml(p.email)}</td>
        <td>${escapeHtml(p.phone || '—')}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewPatient(${p.id})">View records</button></td>
      </tr>
    `).join('') : `<tr><td colspan="4"><div class="empty-state">No patients yet.</div></td></tr>`;

    const options = '<option value="">Select a patient…</option>' + PATIENTS_CACHE.map(p => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`).join('');
    document.getElementById('note-patient').innerHTML = options;
    document.getElementById('rx-patient').innerHTML = options;
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function viewPatient(id) {
  try {
    const json = await Api.get(`/patients/${id}`);
    const { user, profile, records, prescriptions } = json.data;
    const overlay = openModal(`
      <div class="modal-header">
        <h2>${escapeHtml(user.full_name)}</h2>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <p class="text-sm text-muted mb-16">${escapeHtml(user.email)} · ${escapeHtml(user.phone || 'No phone on file')}</p>
      <h4>Allergies</h4>
      <p class="text-sm mb-16">${escapeHtml(profile?.allergies || 'None recorded')}</p>
      <h4>Medical history</h4>
      <p class="text-sm mb-16">${escapeHtml(profile?.medical_history || 'None recorded')}</p>
      <h4>Dental history</h4>
      <p class="text-sm mb-16">${escapeHtml(profile?.dental_history || 'None recorded')}</p>
      <h4>Recent clinical notes (${records.length})</h4>
      <ul class="mb-16">
        ${records.slice(0,3).map(r => `<li class="text-sm mb-8">${formatDate(r.created_at.slice(0,10))} — ${escapeHtml(r.diagnosis || r.assessment || 'Note')}</li>`).join('') || '<li class="text-sm text-muted">None yet</li>'}
      </ul>
      <h4>Prescriptions (${prescriptions.length})</h4>
      <ul>
        ${prescriptions.slice(0,3).map(p => `<li class="text-sm mb-8">${escapeHtml(p.medication)} — ${escapeHtml(p.dosage || '')}</li>`).join('') || '<li class="text-sm text-muted">None yet</li>'}
      </ul>
    `);
    overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

function wireClinicalForm() {
  const form = document.getElementById('clinical-note-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await Api.post('/patients/clinical-notes', data);
      showToast('Clinical note saved', 'success');
      form.reset();
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  });
}

function wirePrescriptionForm() {
  const form = document.getElementById('prescription-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await Api.post('/patients/prescriptions', data);
      showToast('Prescription saved', 'success');
      form.reset();
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  });
}
