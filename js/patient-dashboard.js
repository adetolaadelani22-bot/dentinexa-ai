let CURRENT_USER = null;
let PREVIOUSLY_READY_IDS = new Set(); // appointment ids already alerted this session
let DISMISSED_READY_IDS = new Set(JSON.parse(sessionStorage.getItem('dc_dismissed_ready') || '[]'));
let READY_POLL_INTERVAL = null;

document.addEventListener('DOMContentLoaded', async () => {
  CURRENT_USER = bootDashboard(['patient']);
  if (!CURRENT_USER) return;

  if (CURRENT_USER.patientId) {
    const banner = document.getElementById('patient-id-banner');
    document.getElementById('profile-patient-id').textContent = CURRENT_USER.patientId;
    if (banner) banner.style.display = 'flex';
  }

  wireSidebarNav();
  wireRecordTabs();
  wireBookingButtons();
  wireProfileForm();
  wireNotificationPrompt();

  await Promise.all([
    loadAppointments(),
    loadRecordsAndBilling(),
    loadProfile()
  ]);

  // Quietly re-check appointment status every 8s so the patient finds out
  // the moment the dentist marks them "ready" — no manual refresh needed.
  READY_POLL_INTERVAL = setInterval(pollAppointmentsForReadyAlert, 8000);
});

function wireNotificationPrompt() {
  const banner = document.getElementById('notif-permission-banner');
  const btn = document.getElementById('enable-notif-btn');
  if (!('Notification' in window)) return; // unsupported browser, skip silently

  if (Notification.permission === 'default') {
    banner.classList.remove('hidden');
  }
  btn.addEventListener('click', async () => {
    const result = await Notification.requestPermission();
    banner.classList.add('hidden');
    if (result === 'granted') {
      showToast('Notifications enabled — we\'ll alert you the moment it\'s your turn.', 'success');
    }
  });
}

/** Lightweight background refresh — keeps the table, stats, and ready-alert banner all in sync. */
async function pollAppointmentsForReadyAlert() {
  try {
    const json = await Api.get('/appointments');
    const appointments = json.data || [];
    renderAppointmentsTable(appointments);
    renderOverviewStats(appointments);
    handleReadyAppointments(appointments);
  } catch (err) { /* silent — don't interrupt the patient over a background poll failure */ }
}

function handleReadyAppointments(appointments) {
  const readyNow = appointments.filter(a => a.status === 'ready');

  // Fire a toast + browser notification the first time we see a *new* ready appointment this session
  readyNow.forEach(a => {
    if (!PREVIOUSLY_READY_IDS.has(a.id)) {
      PREVIOUSLY_READY_IDS.add(a.id);
      if (!DISMISSED_READY_IDS.has(a.id)) {
        showToast(`It's your turn! ${a.dentist_name || 'Your dentist'} is ready to see you.`, 'success', 7000);
        sendBrowserNotification(a);
      }
    }
  });

  const visibleReady = readyNow.filter(a => !DISMISSED_READY_IDS.has(a.id));
  renderReadyAlertBanner(visibleReady);

  const navDot = document.getElementById('nav-alert-dot');
  if (navDot) navDot.classList.toggle('hidden', visibleReady.length === 0);
}

function sendBrowserNotification(appt) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification('DentiNexa AI — It\'s your turn', {
    body: `${appt.dentist_name || 'Your dentist'} is ready to see you now.`,
    tag: `dc-ready-${appt.id}`
  });
  n.onclick = () => { window.focus(); n.close(); };
}

function renderReadyAlertBanner(readyAppointments) {
  const container = document.getElementById('ready-alert-container');
  if (!container) return;

  if (readyAppointments.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = readyAppointments.map(a => `
    <div class="ready-alert" role="alert">
      <div class="ready-alert-icon">
        <img src="../assets/icons/icon-bell.svg" alt="" width="22" height="22">
      </div>
      <div class="ready-alert-body">
        <strong>It's your turn — ${escapeHtml(a.dentist_name || 'your dentist')} is ready for you</strong>
        <span>Please head to the treatment room now.</span>
      </div>
      <div class="ready-alert-actions">
        <button class="btn btn-solid-light btn-sm" onclick="dismissReadyAlert(${a.id})">Got it</button>
      </div>
    </div>
  `).join('');
}

function dismissReadyAlert(appointmentId) {
  DISMISSED_READY_IDS.add(appointmentId);
  sessionStorage.setItem('dc_dismissed_ready', JSON.stringify([...DISMISSED_READY_IDS]));
  const container = document.getElementById('ready-alert-container');
  if (container) container.innerHTML = '';
  const navDot = document.getElementById('nav-alert-dot');
  if (navDot) navDot.classList.add('hidden');
}

function wireSidebarNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
      const target = document.getElementById(link.dataset.tab);
      if (target) target.classList.remove('hidden');
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
    });
  });
}

function wireRecordTabs() {
  document.querySelectorAll('#panel-records .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#panel-records .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.record-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(btn.dataset.target).classList.remove('hidden');
    });
  });
}

async function loadAppointments() {
  try {
    const json = await Api.get('/appointments');
    const appointments = json.data || [];
    renderAppointmentsTable(appointments);
    renderOverviewStats(appointments);
    handleReadyAppointments(appointments);
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

function renderAppointmentsTable(appointments) {
  const tbody = document.getElementById('appointments-table-body');
  if (appointments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No appointments yet — book your first visit.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = appointments.map(a => `
    <tr>
      <td>${formatDate(a.appointment_date)}</td>
      <td>${formatTime(a.appointment_time)}</td>
      <td>${escapeHtml(a.dentist_name || 'Unassigned')}</td>
      <td>${escapeHtml(a.reason || '—')}</td>
      <td><span class="badge ${statusBadgeClass(a.status)}">${statusLabel(a.status)}</span></td>
      <td>
        ${['pending','confirmed'].includes(a.status) ? `
          <button class="btn btn-ghost btn-sm" onclick="cancelAppointment(${a.id})">Cancel</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function renderOverviewStats(appointments) {
  const upcoming = appointments
    .filter(a => ['pending', 'confirmed', 'checked_in', 'ready'].includes(a.status))
    .sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));

  const nextEl = document.getElementById('stat-next-appt');
  const nextSubEl = document.getElementById('stat-next-appt-sub');
  if (upcoming.length > 0) {
    nextEl.textContent = formatDate(upcoming[0].appointment_date);
    nextSubEl.textContent = `${formatTime(upcoming[0].appointment_time)} with ${upcoming[0].dentist_name || 'a dentist'}`;
  } else {
    nextEl.textContent = '—';
    nextSubEl.textContent = 'No upcoming visits';
  }

  document.getElementById('stat-total-visits').textContent = appointments.filter(a => a.status === 'completed').length;

  const listEl = document.getElementById('overview-upcoming-list');
  if (upcoming.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Nothing on the calendar yet.</div>`;
  } else {
    listEl.innerHTML = upcoming.slice(0, 4).map(a => `
      <div class="flex justify-between items-center" style="padding:12px 0;border-bottom:1px solid var(--border);">
        <div>
          <strong>${formatDate(a.appointment_date)}</strong> · ${formatTime(a.appointment_time)}
          <div class="text-muted text-sm">${escapeHtml(a.dentist_name || 'Unassigned')} — ${escapeHtml(a.reason || 'General visit')}</div>
        </div>
        <span class="badge ${statusBadgeClass(a.status)}">${statusLabel(a.status)}</span>
      </div>
    `).join('');
  }
}

async function cancelAppointment(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    await Api.patch(`/appointments/${id}/status`, { status: 'cancelled' });
    showToast('Appointment cancelled', 'success');
    loadAppointments();
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function loadRecordsAndBilling() {
  try {
    const json = await Api.get(`/patients/${CURRENT_USER.id}`);
    const { records, prescriptions, invoices } = json.data;

    const clinicalBody = document.getElementById('clinical-notes-body');
    clinicalBody.innerHTML = records.length ? records.map(r => `
      <tr>
        <td>${formatDate(r.created_at.slice(0,10))}</td>
        <td>${escapeHtml(r.dentist_name || '—')}</td>
        <td>${escapeHtml(r.diagnosis || '—')}</td>
        <td>${escapeHtml(r.assessment || '—')}</td>
        <td>${escapeHtml(r.plan || '—')}</td>
      </tr>
    `).join('') : `<tr><td colspan="5"><div class="empty-state">No clinical notes yet.</div></td></tr>`;

    const presBody = document.getElementById('prescriptions-body');
    presBody.innerHTML = prescriptions.length ? prescriptions.map(p => `
      <tr>
        <td>${formatDate(p.created_at.slice(0,10))}</td>
        <td>${escapeHtml(p.medication)}</td>
        <td>${escapeHtml(p.dosage || '—')}</td>
        <td>${escapeHtml(p.instructions || '—')}</td>
      </tr>
    `).join('') : `<tr><td colspan="4"><div class="empty-state">No prescriptions on file.</div></td></tr>`;

    const invBody = document.getElementById('invoices-body');
    invBody.innerHTML = invoices.length ? invoices.map(i => `
      <tr>
        <td>${formatDate(i.created_at.slice(0,10))}</td>
        <td>${escapeHtml(i.description || 'Dental services')}</td>
        <td>${formatCurrency(i.amount)}</td>
        <td><span class="badge ${statusBadgeClass(i.status)}">${statusLabel(i.status)}</span></td>
      </tr>
    `).join('') : `<tr><td colspan="4"><div class="empty-state">No invoices yet.</div></td></tr>`;

    document.getElementById('stat-balance').textContent = formatCurrency(
      invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.amount, 0)
    );
    document.getElementById('stat-prescriptions').textContent = prescriptions.length;
  } catch (err) {
    showToast(extractErrorMessage(err), 'error');
  }
}

async function loadProfile() {
  try {
    const json = await Api.get(`/patients/${CURRENT_USER.id}`);
    const p = json.data.profile;
    if (!p) return;
    const form = document.getElementById('profile-form');
    if (p.date_of_birth) form.dateOfBirth.value = p.date_of_birth;
    if (p.gender) form.gender.value = p.gender;
    if (p.address) form.address.value = p.address;
    if (p.emergency_contact_name) form.emergencyContactName.value = p.emergency_contact_name;
    if (p.emergency_contact_phone) form.emergencyContactPhone.value = p.emergency_contact_phone;
    if (p.allergies) form.allergies.value = p.allergies;
    if (p.current_medications) form.currentMedications.value = p.current_medications;
    if (p.medical_history) form.medicalHistory.value = p.medical_history;
    if (p.dental_history) form.dentalHistory.value = p.dental_history;
  } catch (err) { /* non-fatal */ }
}

function wireProfileForm() {
  const form = document.getElementById('profile-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await Api.put(`/patients/${CURRENT_USER.id}/profile`, data);
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  });
}

function wireBookingButtons() {
  ['book-appointment-btn', 'book-appointment-btn-2'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', openBookingModal);
  });
}

async function openBookingModal() {
  let dentistOptions = '<option value="">No preference</option>';
  try {
    const json = await Api.get('/dentists');
    dentistOptions += (json.data || []).map(d => `<option value="${d.id}">${escapeHtml(d.full_name)} — ${escapeHtml(d.specialty || 'General')}</option>`).join('');
  } catch (err) { /* fall back to no-preference only */ }

  const overlay = openModal(`
    <div class="modal-header">
      <h2>Book an appointment</h2>
      <button class="modal-close" aria-label="Close">&times;</button>
    </div>
    <form id="booking-form">
      <div class="field">
        <label for="booking-dentist">Preferred dentist</label>
        <select id="booking-dentist" name="dentistId">${dentistOptions}</select>
      </div>
      <div class="field">
        <label for="booking-date">Date</label>
        <input type="date" id="booking-date" name="appointmentDate" required min="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="field">
        <label for="booking-time">Time</label>
        <input type="time" id="booking-time" name="appointmentTime" required>
      </div>
      <div class="field">
        <label for="booking-reason">Reason for visit</label>
        <textarea id="booking-reason" name="reason" placeholder="e.g. Tooth sensitivity, routine cleaning…"></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Request appointment</button>
    </form>
  `);

  overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.post('/appointments', data);
      showToast('Appointment requested — you\'ll see it as pending until confirmed.', 'success');
      closeModal(overlay);
      loadAppointments();
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  });
}

/* ---------------- Documents: download history + upload & AI analysis ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  const downloadBtn = document.getElementById('download-history-btn');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadMedicalHistory);

  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('document-upload-input');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault(); dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFileSelected(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
    });
  }
  renderStoredDocuments();
});

/** Print-based "PDF" export — no external library needed, works fully offline. */
async function downloadMedicalHistory() {
  if (!CURRENT_USER) return;
  let profile = {}, records = [], prescriptions = [];
  try {
    const json = await Api.get(`/patients/${CURRENT_USER.id}`);
    profile = json.data.profile || {};
    records = json.data.records || [];
    prescriptions = json.data.prescriptions || [];
  } catch (err) { /* proceed with whatever we have */ }

  const win = window.open('', '_blank');
  if (!win) { showToast('Please allow pop-ups to download your history.', 'error'); return; }

  win.document.write(`
    <html><head><title>DentiNexa AI — Medical History</title>
    <style>
      body { font-family: -apple-system, Arial, sans-serif; color: #1B2422; max-width: 720px; margin: 40px auto; padding: 0 20px; }
      h1 { color: #0F6E64; margin-bottom: 0; } .sub { color: #6E7A76; margin-top: 4px; }
      h2 { color: #0F6E64; font-size: 1rem; border-bottom: 1px solid #E3E9E7; padding-bottom: 6px; margin-top: 28px; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #F2F5F4; font-size: 0.92rem; }
      .label { color: #6E7A76; } .disclaimer { margin-top: 40px; font-size: 0.78rem; color: #6E7A76; border-top: 1px solid #E3E9E7; padding-top: 12px; }
      @media print { body { margin: 0; padding: 20px; } }
    </style></head><body>
      <h1>DentiNexa AI</h1>
      <p class="sub">Medical &amp; Dental History Summary</p>
      <h2>Patient</h2>
      <div class="row"><span class="label">Name</span><strong>${escapeHtml(CURRENT_USER.fullName)}</strong></div>
      <div class="row"><span class="label">Patient ID</span><strong>${escapeHtml(CURRENT_USER.patientId || 'Not yet assigned')}</strong></div>
      <div class="row"><span class="label">Date of birth</span><strong>${escapeHtml(profile.date_of_birth || '—')}</strong></div>
      <h2>Medical information</h2>
      <div class="row"><span class="label">Allergies</span><strong>${escapeHtml(profile.allergies || 'None recorded')}</strong></div>
      <div class="row"><span class="label">Current medications</span><strong>${escapeHtml(profile.current_medications || 'None recorded')}</strong></div>
      <div class="row"><span class="label">Medical history</span><strong>${escapeHtml(profile.medical_history || 'None recorded')}</strong></div>
      <div class="row"><span class="label">Dental history</span><strong>${escapeHtml(profile.dental_history || 'None recorded')}</strong></div>
      <h2>Clinical notes (${records.length})</h2>
      ${records.map(r => `<div class="row"><span class="label">${formatDate((r.created_at||'').slice(0,10))}</span><strong>${escapeHtml(r.diagnosis || r.assessment || 'Note')}</strong></div>`).join('') || '<p class="sub">None on file.</p>'}
      <h2>Prescriptions (${prescriptions.length})</h2>
      ${prescriptions.map(p => `<div class="row"><span class="label">${escapeHtml(p.medication)}</span><strong>${escapeHtml(p.dosage || '')}</strong></div>`).join('') || '<p class="sub">None on file.</p>'}
      <p class="disclaimer">Generated by DentiNexa AI on ${new Date().toLocaleDateString()}. This is a prototype export from a frontend-only demo build — in production this would be generated from a secure clinical database.</p>
      <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  win.document.close();
}

/* ---------------- Upload & AI-assisted analysis (simulated — no real model) ---------------- */

function docsStorageKey() { return `dc_documents_${CURRENT_USER.id}`; }
function loadStoredDocuments() { return JSON.parse(localStorage.getItem(docsStorageKey()) || '[]'); }
function saveStoredDocuments(docs) { localStorage.setItem(docsStorageKey(), JSON.stringify(docs)); }

function handleFileSelected(file) {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    showToast('Please choose a JPG, PNG, or PDF file.', 'error');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast('File is too large — please keep it under 8MB.', 'error');
    return;
  }

  const label = document.getElementById('upload-dropzone-label');
  label.innerHTML = `<span class="ai-analyzing"><span class="spinner"></span> Uploading ${escapeHtml(file.name)}…</span>`;

  const reader = new FileReader();
  reader.onload = () => {
    const doc = {
      id: 'doc-' + Date.now(), name: file.name, size: file.size, type: file.type,
      uploadedAt: new Date().toISOString(), dataUrl: reader.result, analysis: null
    };
    const docs = loadStoredDocuments();
    docs.unshift(doc);
    saveStoredDocuments(docs);
    label.textContent = 'Click to choose a file — JPG, PNG, or PDF';
    document.getElementById('document-upload-input').value = '';
    renderStoredDocuments();
    showToast('File uploaded (stored locally in this browser only).', 'success');
  };
  reader.onerror = () => showToast('Could not read that file — please try again.', 'error');
  reader.readAsDataURL(file);
}

function renderStoredDocuments() {
  const container = document.getElementById('uploaded-documents-list');
  if (!container || !CURRENT_USER) return;
  const docs = loadStoredDocuments();

  if (docs.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">No documents uploaded yet.</p>`;
    return;
  }

  container.innerHTML = docs.map(d => `
    <div class="doc-card">
      ${d.type.startsWith('image/') ? `<img src="${d.dataUrl}" class="doc-thumb" alt="">` : `<div class="doc-thumb flex items-center justify-center text-sm">PDF</div>`}
      <div class="doc-meta">
        <div class="doc-name">${escapeHtml(d.name)}</div>
        <div class="doc-sub">${(d.size / 1024).toFixed(0)} KB · uploaded ${formatDate(d.uploadedAt.slice(0,10))}</div>
        ${d.analysis ? `
          <div class="ai-analysis-result">
            <div class="ai-analysis-badge">🤖 AI-Assisted Analysis</div>
            ${escapeHtml(d.analysis)}
            <div class="text-sm text-muted mt-8">This does not replace professional dental diagnosis.</div>
          </div>` : ''}
      </div>
      <div class="doc-actions">
        ${!d.analysis ? `<button class="btn btn-sm btn-secondary" onclick="analyzeDocument('${d.id}')">Analyze with AI</button>` : ''}
        <a class="btn btn-sm btn-ghost" href="${d.dataUrl}" download="${escapeHtml(d.name)}">Download</a>
        <button class="btn btn-sm btn-ghost" onclick="deleteDocument('${d.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function deleteDocument(id) {
  saveStoredDocuments(loadStoredDocuments().filter(d => d.id !== id));
  renderStoredDocuments();
}

/** Simulated analysis — no real model runs here. Mirrors the honesty pattern used in the landing-page chat demo. */
const ANALYSIS_TEMPLATES = [
  "This looks like a routine dental photo. No obvious signs of swelling or discoloration are apparent, but image-based review can't replace an in-person exam — worth flagging anything unusual to your dentist at your next visit.",
  "The image appears to show a dental X-ray or chart. Structures look broadly typical, though fine detail review (e.g. small areas of decay) is best done by your dentist on the original file, not a compressed preview.",
  "This document looks like a prescription or clinical note. Consider bringing the original to your next visit so your dentist can confirm medication history against your chart."
];
function analyzeDocument(id) {
  const docs = loadStoredDocuments();
  const doc = docs.find(d => d.id === id);
  if (!doc) return;
  renderAnalyzingState(id);
  setTimeout(() => {
    doc.analysis = ANALYSIS_TEMPLATES[Math.floor(Math.random() * ANALYSIS_TEMPLATES.length)];
    saveStoredDocuments(docs);
    renderStoredDocuments();
  }, 1100);
}
function renderAnalyzingState(id) {
  const btn = document.querySelector(`button[onclick="analyzeDocument('${id}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Analyzing…'; }
}
