// Home-page positioning, source-backed visual identity and real UI behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('styles.css', root), 'utf8');
const js = await readFile(new URL('app.js', root), 'utf8');
const scenes = await readFile(new URL('scenes.js', root), 'utf8');

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

test('the hero puts the real app screenshot at the centre of the loop, labelled, with no re-drawn chrome', async () => {
  const source = await readFile(new URL('../../docs/images/pearl-studio.png', import.meta.url));
  const image = await readFile(new URL('assets/pearl-studio.jpg', root));
  assert.deepEqual(image, source);
  const hero = html.slice(html.indexOf('<section class="streamer-hero'), html.indexOf('<section id="loop"'));
  assert.match(hero, /<h1 id="hero-title">Turn every stream into a growth loop\.<\/h1>/);
  assert.match(hero, /class="loop-stage" data-scene="loop" data-rail="#loop-rail"/);
  assert.match(hero, /<a class="loop-app" data-scene-anchor href="\/assets\/pearl-studio.jpg"[^>]*><img [^>]*alt="The Growth Factory desktop app/);
  assert.doesNotMatch(hero, /class="loop-stage"[^>]*role="img"/, 'the stage holds a real link, so it is not collapsed into an image');
  assert.match(hero, /<figure class="loop-figure" id="watch" aria-describedby="loop-description">/);
  assert.match(hero, /id="loop-description">Animated illustration of one loop around the real app: .{120,}<\/p>/);
  assert.match(hero, /The app itself, with sample brand data\./);
  assert.match(hero, /animated illustration of the loop, not real results/);
  assert.doesNotMatch(html, /window-chrome|window-dots|window-tag/, 'no fake browser or OS window');
  assert.doesNotMatch(html, /alpine-story|ring-card|fake-btn/);
});

test('the hero rail names the five stage families the app uses, with a live loop caption', () => {
  const rail = html.slice(html.indexOf('<div class="loop-rail"'), html.indexOf('</ol>', html.indexOf('<div class="loop-rail"')));
  assert.deepEqual([...rail.matchAll(/data-family="([a-z]+)"/g)].map((m) => m[1]), ['understand', 'create', 'judge', 'ship', 'learn']);
  assert.match(rail, /<span data-loop-count>Loop 1<\/span> <span data-loop-beat>Footage in<\/span>/);
  assert.match(rail, /data-scene-toggle hidden>Pause<\/button>/);
  assert.doesNotMatch(rail, /aria-live/, 'the caption changes every few seconds, so it is not announced');
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

test('the page runs hero, the five stations, growth, waitlist, then pricing at the bottom', () => {
  const ids = ['loop','grow','waitlist','faq','pricing'];
  const order = ids.map((id) => html.indexOf(`id="${id}"`));
  for (const [i,at] of order.entries()) assert.ok(at > 0, `missing #${ids[i]}`);
  assert.deepEqual([...order].sort((a,b) => a-b), order);
  assert.ok(html.indexOf('streamer-hero') < order[0], 'hero leads the page');
  assert.ok(order.at(-1) > order[2], 'pricing sits below the waitlist');
  assert.match(html, /<a class="text-link" href="#loop">See each station<\/a>/);
  const markers = [...html.matchAll(/<p class="step">([A-Za-z]+)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(markers, ['Understand','Create','Judge','Ship','Learn'], 'only the station sequence is marked');
  assert.equal([...html.matchAll(/class="step"/g)].length, 5);
});

test('the stations scroll one diagram through every stage, labelled as an illustration', () => {
  const kinds = [...html.matchAll(/data-scene="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(kinds, ['loop','understand']);
  assert.match(html, /data-scene="understand" data-steps="\.loop-step" role="img" aria-label="Animated illustration: .{40,}\."/);
  const stages = [...html.matchAll(/<li class="loop-step" data-stage="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(stages, ['understand','cut','judge','post','learn']);
  for (const stage of stages) assert.match(scenes, new RegExp(`function ${stage}\\(ctx, s\\)`), `scenes.js draws ${stage}`);
  assert.match(scenes, /export const SCENES = \{ loop, understand, cut, judge, post, learn \};/);
  assert.equal([...html.matchAll(/data-scene-toggle/g)].length, 2, 'each animation can be paused');
  assert.equal([...html.matchAll(/<figcaption>Animated illustration/g)].length, 1, 'the station diagram says it is an illustration');
  assert.ok(html.includes('<script type="module" src="/scenes.js?v=pearl-streamer-6">'));
});

test('each station describes the loop as the code has it', () => {
  const step = (stage) => { const at = html.indexOf(`data-stage="${stage}"`); return html.slice(at, html.indexOf('</li>', at)); };
  assert.match(step('understand'), /transcript/i);
  assert.match(step('understand'), /scene changes/);
  assert.match(step('understand'), /on your Mac/);
  assert.match(step('cut'), /hook first, bold word by word captions/);
  assert.match(step('cut'), /A new cut never replaces the old one/);
  assert.match(step('judge'), /eight part production rubric/);
  assert.match(step('judge'), /not what will do well/);
  assert.match(step('judge'), /Nothing moves on until you approve it/);
  assert.match(step('post'), /matched by its external id/);
  assert.match(step('post'), /first beta is export only/);
  assert.match(step('learn'), /one Style rule at a time/);
  assert.match(step('learn'), /stays blank, never zero/);
  assert.match(step('learn'), /need Growth Factory running/);
});

test('the growth section shows the real Factory map and keeps learning claims modest', async () => {
  const grow = html.slice(html.indexOf('id="grow"'), html.indexOf('<section id="waitlist"'));
  await readFile(new URL('assets/factory-map.jpg', root));
  assert.match(grow, /<img src="\/assets\/factory-map.jpg" width="1398" height="437" loading="lazy" alt="The Factory map in Growth Factory/);
  assert.match(grow, /The real Factory map\.<\/span> Running on labelled preview data with sample counts, not a customer result\./);
  for (const term of ['Your taste','Beliefs','Style rules','Experiments']) assert.ok(grow.includes(`<dt>${term}</dt>`), term);
  assert.match(grow, /Observational, not proof/);
  assert.match(grow, /about one pick in four spent exploring/);
  assert.match(grow, /never overrides the rubric/);
  assert.match(grow, /Nothing here guarantees growth/);
});

test('the page keeps its clipping focus and discloses unverified services', () => {
  for (const wording of ['a saved recording','not what will do well','needs a paid plan, a supported account and live verification','export only','nothing here promises more views','Nothing can promise that','not a claim that live billing is launch verified','No installer to download yet','demo data stays labelled']) assert.ok(html.includes(wording), wording);
  assert.doesNotMatch(html, /guaranteed|viral|10x|grow your audience by/i);
});

test('the page avoids the generated-design tells it was built to avoid', () => {
  assert.doesNotMatch(css, /text-transform: uppercase/, 'no tracked capitals in label roles');
  assert.doesNotMatch(css, /transition: all/);
  assert.match(css, /html \{[^}]*overflow-x: clip/);
  assert.match(css, /body \{[^}]*overflow-x: clip/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:active/);
  assert.match(css, /text-wrap: balance/);
  // One raised surface on the page: the app screenshot.
  const shadows = [...css.matchAll(/box-shadow: ([^;]+);/g)].map((m) => m[1].trim());
  assert.deepEqual(shadows, ['var(--lift)'], 'elevation is one token on one element');
  // Every colour lives in the token block.
  const body = css.slice(css.indexOf('}', css.indexOf(':root')));
  assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'no colour literals outside :root');
  assert.doesNotMatch(html, /<span class="accent"/, 'no single accented word in a heading');
  assert.doesNotMatch(html, /status-dot|eyebrow/, 'no decorative dots, no eyebrow labels');
  // An arrow may describe an in-app path (Settings → Plan), but never pad a link or button label.
  for (const [, label] of html.matchAll(/<(?:a|button)\b[^>]*>(.*?)<\/(?:a|button)>/gs)) {
    assert.doesNotMatch(label, /[\u2192\u2197\u2193]/, `arrow in control label: ${label.slice(0, 60)}`);
  }
  assert.doesNotMatch(html, / \u00b7 /, 'no middle-dot meta strings');
  assert.doesNotMatch(html, /\u2014/, 'no em dashes in copy');
  const prose = html.replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(prose, /['"]/, 'typographic quotes and apostrophes in prose');
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
  assert.match(html,/styles.css\?v=pearl-streamer-6/);
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
