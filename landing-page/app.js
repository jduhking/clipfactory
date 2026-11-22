/* Shared, progressively enhanced navigation and pricing. No decorative agent simulations. */
const menuButton = document.querySelector('.menu-btn');
const mobileNav = document.querySelector('#mobile-nav');
if (menuButton && mobileNav) {
  const setMenu = (open) => {
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.hidden = !open;
  };
  menuButton.addEventListener('click', () => setMenu(mobileNav.hidden));
  mobileNav.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !mobileNav.hidden) { setMenu(false); menuButton.focus(); }
  });
  const desktop = window.matchMedia('(min-width: 861px)');
  desktop.addEventListener('change', () => { if (desktop.matches) setMenu(false); });
}
document.querySelectorAll('[data-pricing]').forEach((pricing) => {
  const buttons = [...pricing.querySelectorAll('.pricing-toggle button')];
  pricing.classList.add("is-interactive");
  buttons.forEach((button) => button.addEventListener('click', () => {
    pricing.dataset.interval = button.dataset.interval;
    buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  }));
});
/* Waitlist sign-up: validates in the page, then hands a prefilled draft to the visitor's mail app.
   The site is static with no backend, so nothing is stored or transmitted here. */
document.querySelectorAll('[data-waitlist]').forEach((form) => {
  const status = form.querySelector('[data-waitlist-status]');
  const field = (name) => form.querySelector(`[name="${name}"]`);
  const value = (name) => (field(name)?.value || '').trim();
  const say = (message, state) => {
    if (!status) return;
    status.textContent = message;
    status.className = state ? `form-status ${state}` : 'form-status';
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = field('email');
    const address = value('email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
      email?.setAttribute('aria-invalid', 'true');
      say('Add an email address we can reply to.', 'is-error');
      email?.focus();
      return;
    }
    email?.setAttribute('aria-invalid', 'false');
    const lines = [
      'I would like to join the Mac streamer beta waitlist.',
      '',
      `Email: ${address}`,
      `Mac: ${value('mac') || 'not given'}`,
      `Streams: ${value('stream') || 'not given'}`,
      `Channel: ${value('channel') || 'not given'}`,
      '',
      'Sent from the Growth Factory waitlist form.',
    ];
    const url = `mailto:jamesbodebiyi@gmail.com?subject=${encodeURIComponent('Growth Factory Mac streamer beta')}&body=${encodeURIComponent(lines.join('\n'))}`;
    say('Email draft ready. Send it from your mail app to finish joining the waitlist.', 'is-ready');
    window.location.assign(url);
  });
});
