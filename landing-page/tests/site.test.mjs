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

test('the real Pearl Studio screenshot is unchanged, labelled and kept apart from the illustrations', async () => {
  const source = await readFile(new URL('../../docs/images/pearl-studio.png', import.meta.url));
  const image = await readFile(new URL('assets/pearl-studio.jpg', root));
  assert.deepEqual(image, source);
  const band = html.slice(html.indexOf('<section id="workspace"'), html.indexOf('<section id="cut"'));
  assert.match(band, /href="\/assets\/pearl-studio.jpg"/);
  assert.match(band, /Actual app interface/);
  assert.match(band, /Sample brand data, not a customer result/);
  assert.match(band, /The illustrations on this page are diagrams/);
  assert.doesNotMatch(html, /alpine-story|ring-card|fake-btn/);
});

test('the primary calls to action lead to the waitlist, with no invented installer or access guarantee', () => {
  assert.ok([...html.matchAll(/<a\b[^>]*href="#waitlist"/g)].length >= 1);
  assert.ok([...html.matchAll(/href="mailto:jamesbodebiyi@gmail.com\?subject=Growth%20Factory%20Mac%20streamer%20beta"/g)].length >= 3);
  assert.match(html, /opens an email draft/i);
  assert.match(html, /not a claim of instant access/i);
  assert.match(html, /Apple Silicon/);
  assert.doesNotMatch(html, /Download for Mac|data-download|theclipfactory-frontend-two\.vercel\.app/);
  assert.doesNotMatch(html, /Suburbbaby|Streamer University|trusted by/i);
});

test('the page runs hero, three app features, waitlist, then pricing at the bottom', () => {
  const sections = ['workspace','cut','post','measure','waitlist','faq','pricing'];
  const order = sections.map((id) => html.indexOf(`<section id="${id}"`));
  for (const [i,at] of order.entries()) assert.ok(at > 0, `missing #${sections[i]}`);
  assert.deepEqual([...order].sort((a,b) => a-b), order);
  assert.ok(html.indexOf('streamer-hero') < order[0], 'hero leads the page');
  assert.equal(html.lastIndexOf('<section'), order.at(-1), 'pricing is the last section');
  for (const label of ['Feature 01 / Agents cut the clips','Feature 02 / Posting','Feature 03 / Results']) assert.ok(html.includes(label), label);
});

test('each stage has an animated scene, labelled as an illustration and describable without sight', () => {
  const kinds = [...html.matchAll(/data-scene="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(kinds, ['factory','cut','post','measure']);
  const scenes = [...html.matchAll(/<div class="scene[^"]*" data-scene="[a-z]+" role="img" aria-label="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(scenes.length, 4, 'every scene is an image with a text alternative');
  for (const description of scenes) assert.match(description, /^Animated illustration: .{40,}\.$/);
  assert.equal([...html.matchAll(/class="(?:panel-tag|window-tag)">Animated illustration</g)].length, 4, 'each scene carries a visible illustration tag');
  assert.match(html, /class="screenshot-label">Animated illustration</, 'the hero caption says so too');
  assert.equal([...html.matchAll(/data-scene-toggle/g)].length, 4, 'each scene can be paused');
  for (const caption of ['A diagram of the workflow drawn over the app',"Not a screenshot, and not real performance data",'Platform names are labels only, with no logos and no endorsement','Animated illustration with sample shapes and no values']) assert.ok(html.includes(caption), caption);
  assert.ok(html.includes('<script type="module" src="/scenes.js?v=pearl-streamer-4">'));
});

test('the three stages describe cutting, posting and results as the code has them', () => {
  const after = (id) => html.slice(html.indexOf(`<section id="${id}"`), html.indexOf('</section>', html.indexOf(`<section id="${id}"`)));
  assert.match(after('cut'), /transcript/i);
  assert.match(after('cut'), /Revisions never overwrite/);
  assert.match(after('post'), /Approval is the gate/);
  assert.match(after('post'), /matched by its external id/);
  assert.match(after('measure'), /never as a zero/);
  assert.match(after('measure'), /Collection needs the app open/);
});

test('the page keeps its clipping focus and discloses unverified services', () => {
  for (const wording in {'a saved stream':1,'does not predict views':1,'needs a paid plan, a supported account and live verification':1,'stays export-first':1,'promises no audience growth':1,'not a claim that live billing is launch-verified':1,'no signed Mac installer':1,'demo data stays labelled':1}) assert.ok(html.includes(wording), wording);
  assert.doesNotMatch(html, /guaranteed|viral|10x|grow your audience by/i);
});

test('the waitlist form collects beta-screening answers and states where they go', () => {
  const form = html.slice(html.indexOf('<form class="waitlist-form"'), html.indexOf('</form>'));
  assert.match(form, /novalidate/);
  for (const name of ['email','mac','stream','channel']) assert.ok(form.includes(`name="${name}"`), name);
  assert.match(form, /id="wl-email"[^>]*type="email"[^>]*required/);
  for (const id of ['wl-email','wl-mac','wl-stream','wl-channel']) assert.ok(form.includes(`for="${id}"`), `label for ${id}`);
  assert.match(form, /data-waitlist-status role="status" aria-live="polite"/);
  assert.match(form, /This site stores nothing and sets no cookies/);
  assert.match(form, /<noscript>/);
  assert.doesNotMatch(form, /You're in|Thanks, you are on the list|position #/i);
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
function waitlistForm() {
  const status = element(); status.textContent = ''; status.className = '';
  const fields = { email: element(), mac: element(), stream: element(), channel: element() };
  for (const input of Object.values(fields)) input.value = '';
  const form = element();
  form.querySelector = (selector) => selector === '[data-waitlist-status]' ? status
    : fields[(selector.match(/name="([a-z]+)"/) || [])[1]] ?? null;
  return { form, status, fields };
}
function harness() {
  const menu = element(), nav = element(), pricing = element();
  pricing.classes = new Set(); pricing.classList = { add(name) { pricing.classes.add(name); } };
  const month = element(), year = element(); month.dataset.interval = 'month'; year.dataset.interval = 'year';
  pricing.dataset.interval = 'month'; pricing.querySelectorAll = () => [month,year];
  const events = {}, media = { matches: false, addEventListener(name,fn) { this.events ??= {}; this.events[name] = fn; } };
  const waitlist = waitlistForm();
  const assigned = [];
  const document = { querySelector: (selector) => selector === '.menu-btn' ? menu : nav,
    querySelectorAll: (selector) => selector === '[data-waitlist]' ? [waitlist.form] : [pricing],
    addEventListener: (name,fn) => { events[name] = fn; } };
  runInNewContext(js, { document, window: { matchMedia: () => media, location: { assign: (url) => assigned.push(url) } } });
  return { menu,nav,pricing,month,year,events,media,waitlist,assigned };
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
  assert.match(html,/styles.css\?v=pearl-streamer-4/);
  assert.doesNotMatch(html,/fonts.googleapis.com|growth-factory-landing.vercel.app/);
});
test('the waitlist form rejects a missing or malformed email without opening a draft', () => {
  const h = harness();
  let prevented = 0;
  h.waitlist.form.events.submit({ preventDefault: () => { prevented += 1; } });
  assert.equal(prevented, 1);
  assert.equal(h.assigned.length, 0);
  assert.match(h.waitlist.status.textContent, /email address we can reply to/);
  assert.match(h.waitlist.status.className, /is-error/);
  assert.equal(h.waitlist.fields.email.attributes['aria-invalid'], 'true');
  assert.equal(h.waitlist.fields.email.focused, true);
  h.waitlist.fields.email.value = 'streamer@example';
  h.waitlist.form.events.submit({ preventDefault() {} });
  assert.equal(h.assigned.length, 0);
});
test('a valid entry prepares a prefilled draft with the answers given', () => {
  const h = harness();
  h.waitlist.fields.email.value = ' streamer@example.com ';
  h.waitlist.fields.mac.value = 'MacBook Air (Apple Silicon)';
  h.waitlist.fields.stream.value = 'horror games';
  h.waitlist.form.events.submit({ preventDefault() {} });
  assert.equal(h.assigned.length, 1);
  const url = h.assigned[0];
  assert.match(url, /^mailto:jamesbodebiyi@gmail.com\?subject=Growth%20Factory%20Mac%20streamer%20beta&body=/);
  const body = decodeURIComponent(url.split('&body=')[1]);
  assert.match(body, /Email: streamer@example\.com/);
  assert.match(body, /Mac: MacBook Air \(Apple Silicon\)/);
  assert.match(body, /Streams: horror games/);
  assert.match(body, /Channel: not given/);
  assert.match(h.waitlist.status.textContent, /Send it from your mail app/);
  assert.match(h.waitlist.status.className, /is-ready/);
  assert.equal(h.waitlist.fields.email.attributes['aria-invalid'], 'false');
});
