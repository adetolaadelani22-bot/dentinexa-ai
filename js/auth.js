document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, go straight to the right dashboard
  const user = Api.auth.currentUser();
  if (user && Api.auth.isLoggedIn()) {
    window.location.href = roleHome(user.role);
    return;
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) initLoginForm(loginForm);

  const registerForm = document.getElementById('register-form');
  if (registerForm) initRegisterForm(registerForm);

  // Demo credential quick-fill buttons on the login page
  document.querySelectorAll('.demo-list button[data-email]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('email').value = btn.dataset.email;
      document.getElementById('password').value = 'Demo@1234';
    });
  });
});

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.add('has-error');
  const errEl = field.querySelector('.field-error');
  if (errEl && message) errEl.textContent = message;
}
function clearFieldErrors(form) {
  form.querySelectorAll('.field').forEach(f => f.classList.remove('has-error'));
}

function initLoginForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    let valid = true;
    if (!/^\S+@\S+\.\S+$/.test(email)) { setFieldError('field-email'); valid = false; }
    if (!password) { setFieldError('field-password'); valid = false; }
    if (!valid) return;

    const submitBtn = document.getElementById('login-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
      const user = await Api.auth.login(email, password);
      showToast(`Welcome back, ${user.fullName.split(' ')[0]}!`, 'success');
      setTimeout(() => { window.location.href = roleHome(user.role); }, 400);
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });
}

function initRegisterForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;

    let valid = true;
    if (!fullName) { setFieldError('field-fullName'); valid = false; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setFieldError('field-email'); valid = false; }
    if (password.length < 8) { setFieldError('field-password'); valid = false; }
    if (!valid) return;

    const submitBtn = document.getElementById('register-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    try {
      const user = await Api.auth.register({ fullName, email, phone, password, role: 'patient' });
      showToast(`Welcome to DentiNexa AI, ${user.fullName.split(' ')[0]}!`, 'success');
      setTimeout(() => { window.location.href = roleHome(user.role); }, 400);
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });
}
