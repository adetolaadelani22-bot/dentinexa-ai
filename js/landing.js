document.addEventListener('DOMContentLoaded', async () => {
  // Mobile nav toggle
  const burger = document.getElementById('nav-burger');
  const nav = document.getElementById('main-nav');
  if (burger) {
    burger.addEventListener('click', () => {
      const expanded = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('nav-open');
    });
  }

  // Load real dentists from the backend
  const grid = document.getElementById('dentists-grid');
  try {
    const json = await Api.get('/dentists');
    const dentists = json.data || [];
    if (dentists.length === 0) {
      grid.innerHTML = '<p class="text-muted center">Dentist profiles will appear here soon.</p>';
    } else {
      grid.innerHTML = dentists.map(d => `
        <div class="dentist-card card">
          <div class="dentist-avatar">${initials(d.full_name)}</div>
          <h3>${escapeHtml(d.full_name)}</h3>
          <p class="dentist-specialty">${escapeHtml(d.specialty || 'General Dentistry')}</p>
          <p class="text-muted text-sm">${escapeHtml(d.bio || '')}</p>
          <p class="text-sm text-muted mt-8">${d.years_experience || 0}+ years experience</p>
        </div>
      `).join('');
    }
  } catch (err) {
    grid.innerHTML = '<p class="text-muted center">Unable to load dentist profiles right now.</p>';
  }

  // Contact form (demo — persists nowhere yet, confirms receipt)
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Thanks — your message has been received. We\'ll reply within one business day.', 'success');
      contactForm.reset();
    });
  }

  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Subscribed! Watch your inbox for oral health tips.', 'success');
      newsletterForm.reset();
    });
  }
});

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
