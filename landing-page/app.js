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
