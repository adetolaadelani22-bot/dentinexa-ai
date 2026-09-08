/**
 * DentiNexa AI — "Book Your First Visit" form
 * -----------------------------------------------------------------
 * FORMSPREE SETUP (required for real email delivery):
 * 1. Create a free form at https://formspree.io and copy your endpoint,
 *    e.g. https://formspree.io/f/abcdwxyz
 * 2. Paste it below as FORMSPREE_ENDPOINT.
 * 3. In your Formspree dashboard, turn on "Autoresponse" and set the
 *    patient-facing email to:
 *      Subject: DentiNexa AI — Your Appointment Request Has Been Received
 *      Body: We have received your appointment request. Our reception
 *            team will review it and contact you to confirm your visit.
 *    (Formspree needs a real endpoint + dashboard config for this —
 *    it can't be done from JavaScript alone, and no API secret belongs
 *    in this file.)
 *
 * Until a real endpoint is configured, submissions still work end-to-end
 * in this demo — they're saved locally so you can see the full reception
 * workflow — but no real email is sent. See the on-screen note if that
 * happens.
 * -----------------------------------------------------------------
 */
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID'; // TODO: replace with your real Formspree endpoint

const TOTAL_STEPS = 6;
let currentStep = 1;

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('dateOfBirth').max = new Date().toISOString().slice(0, 10);
  document.getElementById('preferredDate').min = new Date().toISOString().slice(0, 10);

  await loadDentistOptions();
  wireStepNav();
  wireEmergencyModal();
  wireForm();
  updateStepUI();
});

async function loadDentistOptions() {
  const select = document.getElementById('preferredDentist');
  try {
    const json = await Api.get('/dentists');
    const dentists = json.data || [];
    select.innerHTML = '<option value="">No preference</option>' +
      dentists.map(d => `<option value="${d.id}">${escapeHtml(d.full_name)} — ${escapeHtml(d.specialty || 'General')}</option>`).join('');
  } catch (err) {
    select.innerHTML = '<option value="">No preference</option>';
    showToast('Dentist availability could not be loaded. You can continue with no preference.', 'warning', 6000);
  }
}

function wireStepNav() {
  document.getElementById('step-next-btn').addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    if (currentStep === TOTAL_STEPS - 1) renderReviewSummary();
    currentStep = Math.min(currentStep + 1, TOTAL_STEPS);
    updateStepUI();
  });
  document.getElementById('step-back-btn').addEventListener('click', () => {
    currentStep = Math.max(currentStep - 1, 1);
    updateStepUI();
  });
}

function wireEmergencyModal() {
  const modal = document.getElementById('emergency-modal');
  const trigger = document.getElementById('emergency-trigger-btn');
  const closeBtn = document.getElementById('emergency-modal-close');
  const cancelBtn = document.getElementById('emergency-cancel-btn');
  const form = document.getElementById('emergency-form');
  if (!modal || !trigger || !form) return;

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    form.reset();
  };

  trigger.addEventListener('click', () => {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  });

  [closeBtn, cancelBtn].filter(Boolean).forEach(btn => btn.addEventListener('click', closeModal));
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const emergencyType = document.getElementById('emergencyType').value.trim();
    const emergencySeverity = document.getElementById('emergencySeverity').value.trim();
    const emergencyDescription = document.getElementById('emergencyDescription').value.trim();
    const emergencyPreferredContact = document.getElementById('emergencyPreferredContact').value.trim();
    const emergencyConsent = document.getElementById('emergencyConsent').checked;

    if (!emergencyConsent) {
      showToast('Please confirm that you need urgent dental triage before sending this request.', 'warning', 6000);
      return;
    }

    const emergency = {
      urgent: true,
      type: emergencyType || 'Urgent dental issue',
      severity: emergencySeverity || 'Same-day review requested',
      description: emergencyDescription || 'Urgent care requested',
      preferredContact: emergencyPreferredContact || 'Not provided',
      submittedAt: new Date().toISOString()
    };

    document.getElementById('isEmergency').value = 'true';
    document.getElementById('emergencySummary').value = JSON.stringify(emergency);
    document.getElementById('service').value = 'Emergency Dentistry';
    if (!document.getElementById('reasonForVisit').value.trim()) {
      document.getElementById('reasonForVisit').value = emergency.description;
    }

    showToast('Urgent care details saved. Reception will prioritize this request.', 'warning', 6000);
    closeModal();
  });
}

function updateStepUI() {
  document.querySelectorAll('.step-panel').forEach(p => {
    p.classList.toggle('active', Number(p.dataset.step) === currentStep);
  });
  document.querySelectorAll('.stepper-item').forEach(item => {
    const step = Number(item.dataset.step);
    item.classList.toggle('active', step === currentStep);
    item.classList.toggle('completed', step < currentStep);
  });

  document.getElementById('step-back-btn').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  document.getElementById('step-counter').textContent = `Step ${currentStep} of ${TOTAL_STEPS}`;

  const isLastStep = currentStep === TOTAL_STEPS;
  document.getElementById('step-next-btn').classList.toggle('hidden', isLastStep);
  document.getElementById('step-submit-btn').classList.toggle('hidden', !isLastStep);

  // Scroll the card into view on step change so long forms don't leave the user stranded
  document.querySelector('.booking-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------------- Validation ---------------- */

const REQUIRED_BY_STEP = {
  1: ['firstName', 'lastName', 'dateOfBirth', 'phone', 'email'],
  2: ['emergencyContactName', 'emergencyContactPhone'],
  3: [],
  4: ['reasonForVisit'],
  5: ['service', 'preferredDate', 'preferredTime'],
  6: ['consent']
};

function validateStep(step) {
  clearStepErrors(step);
  let valid = true;
  const panel = document.querySelector(`.step-panel[data-step="${step}"]`);

  (REQUIRED_BY_STEP[step] || []).forEach(name => {
    const input = panel.querySelector(`[name="${name}"]`);
    if (!input) return;

    if (input.type === 'checkbox') {
      if (!input.checked) { setError(name, 'Please confirm this to continue.'); valid = false; }
      return;
    }
    if (!input.value.trim()) {
      setError(name, 'This field is required.');
      valid = false;
    }
  });

  // Field-specific format checks
  if (step === 1) {
    const email = document.getElementById('email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('email', 'Please enter a valid email address.');
      valid = false;
    }
    const phone = document.getElementById('phone').value.trim();
    if (phone && !/^[+\d][\d\s\-()]{6,18}$/.test(phone)) {
      setError('phone', 'Please enter a valid phone number.');
      valid = false;
    }
    const dob = document.getElementById('dateOfBirth').value;
    if (dob && new Date(dob) > new Date()) {
      setError('dateOfBirth', 'Date of birth can\'t be in the future.');
      valid = false;
    }
  }

  if (step === 2) {
    const ecPhone = document.getElementById('emergencyContactPhone').value.trim();
    if (ecPhone && !/^[+\d][\d\s\-()]{6,18}$/.test(ecPhone)) {
      setError('emergencyContactPhone', 'Please enter a valid phone number.');
      valid = false;
    }
  }

  if (step === 5) {
    const date = document.getElementById('preferredDate').value;
    if (date && new Date(date) < new Date(new Date().toDateString())) {
      setError('preferredDate', 'Please choose today or a future date.');
      valid = false;
    }
  }

  return valid;
}

function setError(fieldName, message) {
  const field = document.getElementById(`field-${fieldName}`);
  if (!field) return;
  field.classList.add('has-error');
  const errEl = field.querySelector('.field-error');
  if (errEl) errEl.textContent = message;
}

function clearStepErrors(step) {
  const panel = document.querySelector(`.step-panel[data-step="${step}"]`);
  panel.querySelectorAll('.field').forEach(f => f.classList.remove('has-error'));
}

/* ---------------- Review summary (step 6) ---------------- */

function renderReviewSummary() {
  const form = document.getElementById('first-visit-form');
  const data = Object.fromEntries(new FormData(form).entries());
  const dentistLabel = document.getElementById('preferredDentist').selectedOptions[0]?.textContent || 'No preference';

  let emergencyDetails = null;
  if (data.emergencySummary) {
    try {
      emergencyDetails = JSON.parse(data.emergencySummary);
    } catch (err) {
      emergencyDetails = null;
    }
  }

  const groups = [
    { title: 'Personal', items: [
      ['Name', [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')],
      ['Date of birth', data.dateOfBirth ? formatDate(data.dateOfBirth) : '—'],
      ['Phone', data.phone], ['Email', data.email], ['Address', data.address || '—']
    ]},
    { title: 'Emergency contact', items: [
      ['Name', data.emergencyContactName], ['Phone', data.emergencyContactPhone],
      ['Relationship', data.emergencyContactRelationship || '—']
    ]},
    { title: 'Appointment', items: [
      ['Service', data.service], ['Preferred dentist', dentistLabel],
      ['Preferred date', data.preferredDate ? formatDate(data.preferredDate) : '—'],
      ['Preferred time', data.preferredTime ? formatTime(data.preferredTime) : '—'],
      ['Reason for visit', data.reasonForVisit]
    ]}
  ];

  if (emergencyDetails) {
    groups.push({
      title: 'Urgent dental care',
      items: [
        ['Urgent', 'Yes'],
        ['Issue type', emergencyDetails.type || '—'],
        ['Severity', emergencyDetails.severity || '—'],
        ['Description', emergencyDetails.description || '—'],
        ['Preferred contact', emergencyDetails.preferredContact || '—']
      ]
    });
  }

  document.getElementById('review-summary').innerHTML = groups.map(g => `
    <div class="review-group">
      <h4>${g.title}</h4>
      <div class="review-grid">
        ${g.items.map(([label, value]) => `
          <div class="review-item">
            <span class="review-label">${escapeHtml(label)}</span>
            <span class="review-value">${escapeHtml(value || '—')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

/* ---------------- Submission ---------------- */

function wireForm() {
  document.getElementById('first-visit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(6)) return;

    const submitBtn = document.getElementById('step-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = data.consent === 'on';
    data.isEmergency = data.isEmergency === 'true';

    let reference = null;
    let formspreeSent = false;

    // 1) Try the real Formspree endpoint, so patient + reception emails go out for real once configured
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, _replyto: data.email })
      });
      formspreeSent = res.ok;
    } catch (err) {
      formspreeSent = false; // no working endpoint configured yet, or offline — fall through to local demo path
    }

    // 2) Always record the request locally too, so reception's dashboard has something to review
    //    in this frontend-only build (this is the "no backend yet" stand-in for a real database).
    try {
      const json = await Api.post('/first-visit-requests', data);
      reference = json.data.id;
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit request';
      return;
    }

    if (!formspreeSent) {
      showToast('Demo mode: request saved locally. Add a real Formspree endpoint in js/booking.js to send real emails.', 'warning', 6000);
    }

    showSuccessScreen(data, reference);
  });
}

function showSuccessScreen(data, reference) {
  document.getElementById('booking-form-view').classList.add('hidden');
  const successView = document.getElementById('booking-success-view');
  successView.classList.remove('hidden');

  document.getElementById('success-date').textContent = data.preferredDate ? formatDate(data.preferredDate) : '—';
  document.getElementById('success-time').textContent = data.preferredTime ? formatTime(data.preferredTime) : '—';
  document.getElementById('success-reference').textContent = reference || '—';

  successView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
