import { startContours } from './contours.js?v=pearl-streamer-5';

/** Decorative only: one field in the hero, never over controls or content. */
export function mountTopography({ host, button, start = startContours, media = window.matchMedia.bind(window), lifecycle = window }) {
  const forced = media('(forced-colors: active)');
  const motion = media('(prefers-reduced-motion: reduce)');
  let field = null;
  let paused = false;
  let disposed = false;
  const updateButton = () => {
    if (!button) return;
    button.hidden = !field || motion.matches || forced.matches;
    button.textContent = paused ? 'Play background' : 'Pause background';
    button.setAttribute('aria-label', paused ? 'Play animated topography' : 'Pause animated topography');
  };
  const sync = () => {
    if (disposed) return;
    if (forced.matches) {
      field?.stop(); field = null;
      host.classList.remove('has-contours');
    } else if (!field) {
      field = start(host);
      host.classList.toggle('has-contours', !!field);
      field?.setPaused(paused);
      field?.pulse(undefined, 300);
    }
    updateButton();
  };
  const toggle = () => {
    paused = !paused;
    field?.setPaused(paused);
    updateButton();
  };
  const onContextLost = () => {
    field?.stop(); field = null;
    host.classList.remove('has-contours');
    updateButton();
  };
  const onHide = (event) => {
    // A bfcache page resumes its existing renderer via visibilitychange/pageshow.
    if (!event.persisted) dispose();
  };
  const onShow = () => sync();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    field?.stop(); field = null;
    host.classList.remove('has-contours');
    button?.removeEventListener('click', toggle);
    host.removeEventListener('webglcontextlost', onContextLost, true);
    forced.removeEventListener('change', sync);
    motion.removeEventListener('change', updateButton);
    lifecycle.removeEventListener('pagehide', onHide);
    lifecycle.removeEventListener('pageshow', onShow);
    updateButton();
  };
  button?.addEventListener('click', toggle);
  host.addEventListener('webglcontextlost', onContextLost, true);
  forced.addEventListener('change', sync);
  motion.addEventListener('change', updateButton);
  lifecycle.addEventListener('pagehide', onHide);
  lifecycle.addEventListener('pageshow', onShow);
  sync();
  return { dispose };
}

if (typeof document !== 'undefined') {
  const hero = document.querySelector('.streamer-hero');
  const host = hero?.querySelector('[data-topography]');
  if (host) mountTopography({ host, button: hero.querySelector('[data-topography-toggle]') });
}
