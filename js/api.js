/**
 * DentiNexa AI — MOCK API Client
 * -------------------------------------------------------------
 * This is a FRONTEND-ONLY build. There is no server behind this.
 * All "API" calls below read/write localStorage instead of fetch().
 * Swap this file out for the real js/api.js (which talks to the
 * Express backend) when you're ready to connect the two.
 * -------------------------------------------------------------
 */

/** Works out the relative path back to the frontend root from wherever the current page lives. */
function appRoot() {
  return location.pathname.match(/\/(patient|dentist|receptionist|admin)\//) ? '../' : './';
}

const DB_KEY = 'dc_mock_db';

function seedDatabase() {
  if (localStorage.getItem(DB_KEY)) return;

  const db = {
    users: [
      { id: 1, fullName: 'System Administrator', email: 'admin@dentcare.ai', phone: '+2348000000001', password: 'Demo@1234', role: 'admin', status: 'active', createdAt: '2026-08-01' },
      { id: 2, fullName: 'Dr. Amaka Obi', email: 'dr.amaka@dentcare.ai', phone: '+2348000000002', password: 'Demo@1234', role: 'dentist', status: 'active', createdAt: '2026-08-01',
        specialty: 'Orthodontics & General Dentistry', bio: 'Dr. Amaka specializes in orthodontics and preventive dental care with a patient-first approach.', yearsExperience: 8 },
      { id: 3, fullName: 'Grace Adeyemi', email: 'reception@dentcare.ai', phone: '+2348000000003', password: 'Demo@1234', role: 'receptionist', status: 'active', createdAt: '2026-08-01' },
      { id: 4, fullName: 'John Doe', email: 'patient@dentcare.ai', phone: '+2348000000004', password: 'Demo@1234', role: 'patient', status: 'active', createdAt: '2026-08-01', patientId: 'DCA-000001' }
    ],
    patientProfiles: {
      4: { dateOfBirth: '1992-04-15', gender: 'male', address: '', emergencyContactName: '', emergencyContactPhone: '',
           allergies: 'None known', currentMedications: 'None', medicalHistory: 'No significant medical history', dentalHistory: 'Routine cleanings, one filling (2021)' }
    },
    appointments: [
      { id: 1, patientId: 4, dentistId: 2, appointmentDate: futureDateStr(2), appointmentTime: '10:00', reason: 'Routine checkup and cleaning', status: 'confirmed', createdAt: nowStr() }
    ],
    medicalRecords: [],
    prescriptions: [],
    invoices: [],
    firstVisitRequests: [],
    auditLogs: [
      { id: 1, userId: 4, action: 'REGISTER', details: 'Demo account seeded', createdAt: nowStr() }
    ],
    nextIds: { user: 5, appointment: 2, record: 1, prescription: 1, invoice: 1, audit: 2, request: 1, patientSeq: 2 }
  };
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/** DCA-000124 style — sequential and human-readable, but only unique within this browser's local data (see README). */
function generatePatientId(db) {
  const seq = db.nextIds.patientSeq++;
  return 'DCA-' + String(seq).padStart(6, '0');
}

function futureDateStr(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return d.toISOString().slice(0, 10);
}
function nowStr() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
function loadDB() {
  const db = JSON.parse(localStorage.getItem(DB_KEY));
  return migrateDB(db);
}

/** Backfills fields added after a browser's local data was first seeded, so old saved sessions don't crash. */
function migrateDB(db) {
  let changed = false;
  if (!db.firstVisitRequests) { db.firstVisitRequests = []; changed = true; }
  if (!db.nextIds) { db.nextIds = {}; changed = true; }
  if (db.nextIds.request === undefined) { db.nextIds.request = 1; changed = true; }
  if (db.nextIds.patientSeq === undefined) { db.nextIds.patientSeq = 1; changed = true; }
  if (changed) localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function fail(message) { const e = new Error(message); e.success = false; e.message = message; throw e; }

seedDatabase();

/* ---------------- Session (mirrors the real TokenStore) ---------------- */
const TokenStore = {
  getUser() {
    const raw = localStorage.getItem('dc_user');
    return raw ? JSON.parse(raw) : null;
  },
  set(user) { localStorage.setItem('dc_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('dc_user'); }
};

function publicUser(u) {
  return { id: u.id, fullName: u.fullName, email: u.email, role: u.role, patientId: u.patientId || null };
}

/* ---------------- Mock Api surface (same shape as the real one) ---------------- */
const Api = {
  auth: {
    async login(email, password) {
      await delay();
      const db = loadDB();
      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user || user.password !== password) fail('Invalid email or password');
      if (user.status !== 'active') fail('This account has been suspended. Contact the clinic administrator.');
      TokenStore.set(publicUser(user));
      return publicUser(user);
    },
    async register({ fullName, email, phone, password }) {
      await delay();
      const db = loadDB();
      if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        fail('An account with this email already exists');
      }
      const user = { id: db.nextIds.user++, fullName, email: email.toLowerCase(), phone: phone || '', password, role: 'patient', status: 'active', createdAt: nowStr().slice(0,10) };
      db.users.push(user);
      db.patientProfiles[user.id] = { dateOfBirth: '', gender: '', address: '', emergencyContactName: '', emergencyContactPhone: '', allergies: '', currentMedications: '', medicalHistory: '', dentalHistory: '' };
      saveDB(db);
      TokenStore.set(publicUser(user));
      return publicUser(user);
    },
    isLoggedIn() { return !!TokenStore.getUser(); },
    currentUser() { return TokenStore.getUser(); },
    logout() {
      TokenStore.clear();
      window.location.href = appRoot() + 'login.html';
    }
  },

  async get(path) { await delay(); return route('GET', path); },
  async post(path, body) { await delay(); return route('POST', path, body); },
  async patch(path, body) { await delay(); return route('PATCH', path, body); },
  async put(path, body) { await delay(); return route('PUT', path, body); }
};

function delay(ms = 220) { return new Promise(r => setTimeout(r, ms)); }

/* ---------------- Tiny mock router: mirrors the real REST endpoints ---------------- */
function route(method, path, body) {
  const db = loadDB();
  const me = TokenStore.getUser();

  // GET /dentists  (public)
  if (method === 'GET' && path === '/dentists') {
    const rows = db.users.filter(u => u.role === 'dentist' && u.status === 'active').map(u => ({
      id: u.id, full_name: u.fullName, email: u.email, specialty: u.specialty, bio: u.bio, years_experience: u.yearsExperience
    }));
    return { success: true, data: rows };
  }

  // POST /first-visit-requests  (public — no account needed, this is the "Book Your First Visit" flow)
  if (method === 'POST' && path === '/first-visit-requests') {
    const reference = 'REQ-' + String(db.nextIds.request++).padStart(6, '0');
    const request = {
      id: reference,
      status: 'request_received', // distinct from 'confirmed' — reception must review before it becomes a real appointment
      submittedAt: nowStr(),
      ...body
    };
    db.firstVisitRequests.push(request);
    saveDB(db);
    return { success: true, data: request };
  }

  if (!me) fail('Not authenticated');

  // GET /appointments (scoped by role)
  if (method === 'GET' && path === '/appointments') {
    let rows = db.appointments;
    if (me.role === 'patient') rows = rows.filter(a => a.patientId === me.id);
    if (me.role === 'dentist') rows = rows.filter(a => a.dentistId === me.id);
    return { success: true, data: rows.map(a => decorateAppointment(db, a)).sort(sortByDateTime) };
  }

  // POST /appointments
  if (method === 'POST' && path === '/appointments') {
    const patientId = ['receptionist', 'admin'].includes(me.role) && body.patientId ? Number(body.patientId) : me.id;
    const appt = {
      id: db.nextIds.appointment++, patientId, dentistId: body.dentistId ? Number(body.dentistId) : null,
      appointmentDate: body.appointmentDate, appointmentTime: body.appointmentTime,
      reason: body.reason || '', status: 'pending', createdAt: nowStr()
    };
    db.appointments.push(appt);
    saveDB(db);
    return { success: true, data: decorateAppointment(db, appt) };
  }

  // PATCH /appointments/:id/status
  let m = path.match(/^\/appointments\/(\d+)\/status$/);
  if (method === 'PATCH' && m) {
    const appt = db.appointments.find(a => a.id === Number(m[1]));
    if (!appt) fail('Appointment not found');
    if (me.role === 'patient' && (appt.patientId !== me.id || body.status !== 'cancelled')) fail('You can only cancel your own appointments');
    appt.status = body.status;
    saveDB(db);
    return { success: true, data: decorateAppointment(db, appt) };
  }

  // GET /dentists/me/schedule
  if (method === 'GET' && path === '/dentists/me/schedule') {
    const rows = db.appointments.filter(a => a.dentistId === me.id && a.appointmentDate >= todayStr());
    return { success: true, data: rows.map(a => decorateAppointment(db, a)).sort(sortByDateTime) };
  }

  // GET /patients (staff only)
  if (method === 'GET' && path === '/patients') {
    const rows = db.users.filter(u => u.role === 'patient').map(u => ({ id: u.id, full_name: u.fullName, email: u.email, phone: u.phone }));
    return { success: true, data: rows };
  }

  // GET /patients/:id
  m = path.match(/^\/patients\/(\d+)$/);
  if (method === 'GET' && m) {
    const id = Number(m[1]);
    const u = db.users.find(x => x.id === id);
    if (!u) fail('Patient not found');
    const profile = db.patientProfiles[id] || {};
    return {
      success: true,
      data: {
        user: { id: u.id, full_name: u.fullName, email: u.email, phone: u.phone },
        profile: {
          date_of_birth: profile.dateOfBirth, gender: profile.gender, address: profile.address,
          emergency_contact_name: profile.emergencyContactName, emergency_contact_phone: profile.emergencyContactPhone,
          allergies: profile.allergies, current_medications: profile.currentMedications,
          medical_history: profile.medicalHistory, dental_history: profile.dentalHistory
        },
        records: db.medicalRecords.filter(r => r.patientId === id).map(r => ({ ...r, created_at: r.createdAt, dentist_name: dentistName(db, r.dentistId) })),
        prescriptions: db.prescriptions.filter(p => p.patientId === id).map(p => ({ ...p, created_at: p.createdAt })),
        invoices: db.invoices.filter(i => i.patientId === id).map(i => ({ ...i, created_at: i.createdAt }))
      }
    };
  }

  // PUT /patients/:id/profile
  m = path.match(/^\/patients\/(\d+)\/profile$/);
  if (method === 'PUT' && m) {
    const id = Number(m[1]);
    db.patientProfiles[id] = { ...db.patientProfiles[id], ...body };
    saveDB(db);
    return { success: true, data: db.patientProfiles[id] };
  }

  // POST /patients/clinical-notes
  if (method === 'POST' && path === '/patients/clinical-notes') {
    const record = { id: db.nextIds.record++, patientId: Number(body.patientId), dentistId: me.id, subjective: body.subjective, objective: body.objective, assessment: body.assessment, plan: body.plan, diagnosis: body.diagnosis, createdAt: nowStr() };
    db.medicalRecords.push(record);
    saveDB(db);
    return { success: true, data: record };
  }

  // POST /patients/prescriptions
  if (method === 'POST' && path === '/patients/prescriptions') {
    const rx = { id: db.nextIds.prescription++, patientId: Number(body.patientId), dentistId: me.id, medication: body.medication, dosage: body.dosage, instructions: body.instructions, createdAt: nowStr() };
    db.prescriptions.push(rx);
    saveDB(db);
    return { success: true, data: rx };
  }

  // GET /admin/stats
  if (method === 'GET' && path === '/admin/stats') {
    const totalPatients = db.users.filter(u => u.role === 'patient').length;
    const totalDentists = db.users.filter(u => u.role === 'dentist').length;
    const upcoming = db.appointments.filter(a => a.appointmentDate >= todayStr() && ['pending','confirmed'].includes(a.status)).length;
    const outstanding = db.invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + (i.amount||0), 0);
    const byStatus = {};
    db.appointments.forEach(a => { byStatus[a.status] = (byStatus[a.status]||0) + 1; });
    return { success: true, data: {
      totalPatients, totalDentists, totalAppointments: db.appointments.length, upcomingAppointments: upcoming,
      revenue: db.invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0), outstanding,
      appointmentsByStatus: Object.entries(byStatus).map(([status,count]) => ({ status, count }))
    }};
  }

  // GET /admin/users
  if (method === 'GET' && path === '/admin/users') {
    return { success: true, data: db.users.map(u => ({ id: u.id, full_name: u.fullName, email: u.email, role: u.role, status: u.status, created_at: u.createdAt })) };
  }

  // POST /admin/users
  if (method === 'POST' && path === '/admin/users') {
    if (db.users.some(u => u.email.toLowerCase() === body.email.toLowerCase())) fail('An account with this email already exists');
    const user = {
      id: db.nextIds.user++, fullName: body.fullName, email: body.email.toLowerCase(), phone: body.phone||'',
      password: body.password, role: body.role, status: 'active', createdAt: todayStr(),
      specialty: body.specialty || '', bio: body.bio || '', yearsExperience: body.yearsExperience ? Number(body.yearsExperience) : 0
    };
    db.users.push(user);
    saveDB(db);
    return { success: true, data: { id: user.id } };
  }

  // PATCH /admin/users/:id/status
  m = path.match(/^\/admin\/users\/(\d+)\/status$/);
  if (method === 'PATCH' && m) {
    const u = db.users.find(x => x.id === Number(m[1]));
    if (!u) fail('User not found');
    u.status = body.status;
    saveDB(db);
    return { success: true };
  }

  // GET /admin/audit-logs
  if (method === 'GET' && path === '/admin/audit-logs') {
    const rows = db.auditLogs.map(l => ({ ...l, created_at: l.createdAt, full_name: (db.users.find(u=>u.id===l.userId)||{}).fullName, action: l.action }));
    return { success: true, data: rows.reverse() };
  }

  // GET /first-visit-requests  (reception/admin only — the intake queue from the public booking form)
  if (method === 'GET' && path === '/first-visit-requests') {
    if (!['receptionist', 'admin'].includes(me.role)) fail('Insufficient permissions');
    return { success: true, data: [...db.firstVisitRequests].reverse() };
  }

  // PATCH /first-visit-requests/:id/status  (e.g. mark reviewed/contacted)
  m = path.match(/^\/first-visit-requests\/([\w-]+)\/status$/);
  if (method === 'PATCH' && m) {
    if (!['receptionist', 'admin'].includes(me.role)) fail('Insufficient permissions');
    const req = db.firstVisitRequests.find(r => r.id === m[1]);
    if (!req) fail('Request not found');
    req.status = body.status;
    saveDB(db);
    return { success: true, data: req };
  }

  // POST /patients/from-request  (reception/admin — converts a first-visit request into a real patient account + appointment)
  if (method === 'POST' && path === '/patients/from-request') {
    if (!['receptionist', 'admin'].includes(me.role)) fail('Insufficient permissions');
    const req = db.firstVisitRequests.find(r => r.id === body.requestId);
    if (!req) fail('Request not found');

    const email = (body.email || req.email || '').toLowerCase();
    if (!email) fail('An email address is required to create a patient account');
    if (db.users.some(u => u.email.toLowerCase() === email)) fail('An account with this email already exists');

    const patientId = generatePatientId(db);
    const tempPassword = 'Welcome@' + new Date().getFullYear();
    const fullName = body.fullName || [req.firstName, req.middleName, req.lastName].filter(Boolean).join(' ');

    const user = {
      id: db.nextIds.user++, fullName, email, phone: body.phone || req.phone || '',
      password: tempPassword, role: 'patient', status: 'active', createdAt: todayStr(), patientId
    };
    db.users.push(user);

    db.patientProfiles[user.id] = {
      dateOfBirth: body.dateOfBirth || req.dateOfBirth || '',
      gender: body.gender || req.gender || '',
      address: body.address || req.address || '',
      emergencyContactName: body.emergencyContactName || req.emergencyContactName || '',
      emergencyContactPhone: body.emergencyContactPhone || req.emergencyContactPhone || '',
      allergies: body.allergies || req.allergies || '',
      currentMedications: body.medications || req.medications || '',
      medicalHistory: body.medicalHistory || req.medicalHistory || '',
      dentalHistory: body.previousDentalTreatment || req.previousDentalTreatment || ''
    };

    // The original request becomes a real, trackable appointment tied to the new account
    const appt = {
      id: db.nextIds.appointment++, patientId: user.id,
      dentistId: req.preferredDentist ? Number(req.preferredDentist) : null,
      appointmentDate: req.preferredDate || todayStr(),
      appointmentTime: req.preferredTime || '09:00',
      reason: req.reasonForVisit || req.currentDentalConcern || 'First visit',
      status: 'confirmed', createdAt: nowStr()
    };
    db.appointments.push(appt);

    req.status = 'converted';
    req.convertedPatientId = user.id;
    saveDB(db);

    return { success: true, data: { user: publicUser(user), patientId, tempPassword, appointment: appt } };
  }

  fail(`Mock API: no handler for ${method} ${path}`);
}

function decorateAppointment(db, a) {
  return {
    id: a.id, appointment_date: a.appointmentDate, appointment_time: a.appointmentTime,
    reason: a.reason, status: a.status, created_at: a.createdAt,
    patient_name: (db.users.find(u => u.id === a.patientId) || {}).fullName,
    dentist_name: dentistName(db, a.dentistId)
  };
}
function dentistName(db, dentistId) {
  const d = db.users.find(u => u.id === dentistId);
  return d ? d.fullName : null;
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function sortByDateTime(a, b) { return (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time); }

/** Redirect helpers used at the top of protected dashboard pages */
function requireAuth(allowedRoles) {
  const user = TokenStore.getUser();
  if (!Api.auth.isLoggedIn() || !user) {
    window.location.href = appRoot() + 'login.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = roleHome(user.role);
    return null;
  }
  return user;
}

function roleHome(role) {
  return appRoot() + `${role}/dashboard.html`;
}
