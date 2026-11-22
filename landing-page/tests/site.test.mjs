// Home-page positioning, source-backed visual identity and real UI behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('styles.css', root), 'utf8');
const js = await readFile(new URL('app.js', root), 'utf8');

test('the website uses the app graphite and violet tokens, not its old orange identity', async () => {
  const source = await readFile(new URL('../../frontend/src/growth/tokens.css', import.meta.url), 'utf8');
  for (const [web, app] of [['background','gf-grey-900'],['surface','gf-grey-800'],['surface-raised','gf-grey-750'],['surface-sunken','gf-grey-950'],['foreground','gf-grey-100'],['action','gf-violet-400'],['action-hover','gf-violet-200'],['accent-text','gf-violet-100']]) {
    const value = source.match(new RegExp(`--${app}: (#[a-f0-9]+)`))[1];
    assert.ok(css.includes(`--${web}: ${value}`), `${web} matches ${app}`);
  }
  assert.match(css, /color-scheme: dark/);
  assert.doesNotMatch(css, /#ff5a1f|#c2410c|#ffe9dd/i);
  assert.match(css, /Instrument Sans Variable/);
  for (const asset of ['icon.svg','favicon.svg']) {
    const svg = await readFile(new URL(`assets/${asset}`, root),'utf8');
    assert.match(svg, /#A75DE3/);
    assert.doesNotMatch(svg, /#FF5A1F/);
  }
});

test('the real Pearl Studio screenshot is unchanged, labelled and opens at full size', async () => {
  const source = await readFile(new URL('../../docs/images/pearl-studio.png', import.meta.url));
  const image = await readFile(new URL('assets/pearl-studio.jpg', root));
  assert.deepEqual(image, source);
  assert.match(html, /href="\/assets\/pearl-studio.jpg"/);
  assert.match(html, /Actual app interface/);
  assert.match(html, /Sample brand data, not a customer result/);
  assert.doesNotMatch(html, /alpine-story|ring-card|fake-btn/);
});

test('Mac beta calls to action open email, with no invented installer or access guarantee', () => {
  const ctas = [...html.matchAll(/<a\b[^>]*href="mailto:jamesbodebiyi@gmail.com\?subject=Growth%20Factory%20Mac%20streamer%20beta"[^>]*>Join the Mac beta/g)];
  assert.ok(ctas.length >= 3);
  assert.match(html, /Opens an email draft/);
  assert.match(html, /No claim of instant access/);
  assert.match(html, /Apple Silicon/);
  assert.doesNotMatch(html, /Download for Mac|data-download|theclipfactory-frontend-two\.vercel\.app/);
  assert.doesNotMatch(html, /Suburbbaby|Streamer University|trusted by/i);
});

test('the page prioritizes clips, review and export and discloses unverified services', () => {
  const sections = ['how','tools','platforms','privacy','pricing','faq','get'];
  const order = sections.map((id) => html.indexOf(`<section id="${id}"`));
  for (const [i,at] of order.entries()) assert.ok(at > 0, `missing #${sections[i]}`);
  assert.deepEqual([...order].sort((a,b) => a-b), order);
  for (const name of ['TikTok','Instagram Reels','YouTube Shorts']) assert.ok(html.includes(`<li>${name}</li>`));
  for (const wording of ['The first beta focuses on clipping and export','not a claim that live billing is launch-verified','require the app open','No surprise posts','a saved recording']) assert.ok(html.includes(wording),wording);
});

test('the mobile menu keeps its accessible associations', () => {
  assert.match(html, /aria-controls="mobile-nav" aria-expanded="false"/);
  assert.match(html, /id="mobile-nav"[^>]*hidden/s);
});

// A small DOM harness executes the shipped script, including real event callbacks.
function element(attributes = {}) {
  return { attributes, hidden: true, events: {}, dataset: {}, focused: false,
    setAttribute(name,value) { this.attributes[name] = value; },
    addEventListener(name,callback) { this.events[name] = callback; },
    focus() { this.focused = true; },
  };
}
function harness() {
  const menu = element(), nav = element(), pricing = element();
  pricing.classes = new Set(); pricing.classList = { add(name) { pricing.classes.add(name); } };
  const month = element(), year = element(); month.dataset.interval = 'month'; year.dataset.interval = 'year';
  pricing.dataset.interval = 'month'; pricing.querySelectorAll = () => [month,year];
  const events = {}, media = { matches: false, addEventListener(name,fn) { this.events ??= {}; this.events[name] = fn; } };
  const document = { querySelector: (selector) => selector === '.menu-btn' ? menu : nav,
    querySelectorAll: () => [pricing], addEventListener: (name,fn) => { events[name] = fn; } };
  runInNewContext(js, { document, window: { matchMedia: () => media } });
  return { menu,nav,pricing,month,year,events,media };
}
test('mobile menu opens, closes on Escape/link and resets at desktop width', () => {
  const h = harness(); h.menu.events.click();
  assert.equal(h.nav.hidden,false); assert.equal(h.menu.attributes['aria-expanded'],'true');
  h.events.keydown({key:'Escape'}); assert.equal(h.nav.hidden,true); assert.equal(h.menu.focused,true);
  h.menu.events.click(); h.nav.events.click({target:{closest:()=>({})}}); assert.equal(h.nav.hidden,true);
  h.menu.events.click(); h.media.matches = true; h.media.events.change(); assert.equal(h.nav.hidden,true);
});
test('pricing toggle updates visible interval and accessible pressed state', async () => {
  const h = harness(); assert.ok(h.pricing.classes.has('is-interactive'));
  h.year.events.click(); assert.equal(h.pricing.dataset.interval,'year');
  assert.equal(h.year.attributes['aria-pressed'],'true'); assert.equal(h.month.attributes['aria-pressed'],'false');
  h.month.events.click(); assert.equal(h.pricing.dataset.interval,'month');
  const site = await readFile(new URL('site.css',root),'utf8');
  assert.match(site,/\.pricing:not\(\.is-interactive\) \.pricing-toggle \{ display: none; \}/);
});
test('motion respects reduced-motion preferences', () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(js, /setInterval|autoplay/);
});
test('canonical links use this project and assets are versioned to avoid stale theme caches', async () => {
  const layout = await readFile(new URL('site/layout.mjs',root),'utf8');
  assert.match(layout,/https:\/\/clipfactory-landing.vercel.app/);
  assert.match(layout,/https:\/\/github.com\/jduhking\/clipfactory/);
  assert.match(html,/styles.css\?v=pearl-streamer-2/);
  assert.doesNotMatch(html,/fonts.googleapis.com|growth-factory-landing.vercel.app/);
});
