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

// Image sizes read from the WebP header (VP8, VP8L or VP8X), so the markup can never disagree with the file.
function webpSize(buf) {
  assert.equal(buf.subarray(0, 4).toString(), 'RIFF');
  assert.equal(buf.subarray(8, 12).toString(), 'WEBP');
  const kind = buf.subarray(12, 16).toString();
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
  if (kind === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  throw new Error(`unknown WebP chunk ${kind}`);
}
const section = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));

test('the hero is three short lines, one button and a stream turning into clips', () => {
  const hero = section('<section class="hero"', '<section class="proof"');
  assert.match(hero, /<h1 id="hero-title">One stream in\.<br>Clips worth posting\.<br>Smarter every week\.<\/h1>/);
  const lead = hero.match(/<p class="hero-lead">([^<]+)<\/p>/)[1];
  assert.equal(lead, 'Growth Factory cuts each stream into clips, tests them, and learns what your viewers watch.');
  assert.ok(lead.split(/\s+/).length <= 22, 'a short lead');
  assert.equal([...hero.matchAll(/class="btn /g)].length, 1, 'one button');
  assert.match(hero, /<a class="btn btn-primary btn-lg" href="#waitlist">Join the Mac beta<\/a>/);
  assert.match(hero, /<p class="hero-note">Free to start\. No card needed\.<\/p>/);
  assert.match(hero, /<figure class="hero-shot" role="img" aria-label="A two-hour stream with its three best moments marked, [^"]+TikTok, Instagram Reels and YouTube Shorts\."><!-- build:scene hero --><div class="hero-visual">/);
  assert.match(hero, /<div class="hero-stream app-shot"><img src="\/assets\/streamers\/stream-moment\.webp\?v=pearl-streamer-10" alt="" fetchpriority="high"/);
  assert.equal([...hero.matchAll(/class="hero-clip"/g)].length, 3, 'three clips');
});

test('the page stays simple: one background, a few short animations, no video or disclaimers', () => {
  assert.doesNotMatch(html, /<canvas|<video|autoplay|scenes\.js/, 'no video, and no canvas outside the background');
  assert.equal([...html.matchAll(/data-scene="/g)].length, 4, 'three rows and the week cards');
  assert.equal([...html.matchAll(/data-topography /g)].length, 1, 'one background');
  assert.doesNotMatch(html, /Animated illustration|stock photos?|not a customer|sample shapes|do not endorse|nothing here (promises|guarantees)|Nothing can promise|fine print|not a claim/i, 'no disclaimer lines');
  assert.doesNotMatch(html, /window-chrome|window-dots|window-tag/, 'no fake browser or OS window');
  assert.doesNotMatch(html, /alpine-story|ring-card|fake-btn|pearl-studio|Critic|Strategist|Editor\b/, 'plain words; only the scouts are named');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<div class="(scene|hero-visual)[ "][\s\S]*?<\/figure>/g, ' ').replace(/<[^>]+>/g, ' ');
  assert.ok(main.split(/\s+/).filter(Boolean).length < 800, 'a short page');
});

test('the primary calls to action lead to the waitlist, with no invented installer or access guarantee', () => {
  assert.ok([...html.matchAll(/<a\b[^>]*href="#waitlist"/g)].length >= 1);
  assert.ok([...html.matchAll(/href="mailto:jamesbodebiyi@gmail.com\?subject=Growth%20Factory%20Mac%20streamer%20beta"/g)].length >= 3);
  assert.match(html, /Submitting opens an email to <a href="mailto:/);
  assert.match(html, /Apple Silicon/);
  assert.doesNotMatch(html, /Download for Mac|data-download|theclipfactory-frontend-two\.vercel\.app/);
  assert.doesNotMatch(html, /Suburbbaby|Streamer University|trusted by/i);
});

test('the page runs hero, proof, three rows, your week, waitlist, FAQ, then pricing at the bottom', () => {
  const marks = ['<section class="hero"', '<section class="proof"', 'id="how"', 'id="week"', 'id="waitlist"', 'id="faq"', 'id="pricing"'];
  const order = marks.map((m) => html.indexOf(m));
  for (const [i, at] of order.entries()) assert.ok(at > 0, `missing ${marks[i]}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  const rows = [...section('id="how"', 'id="waitlist"').matchAll(/<article class="feature">[\s\S]*?<h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['Drop in a stream. Get clips back.', 'Two versions. Keep the winner.', 'It learns what works for your channel.']);
});

test('each row says what the app does, as the code has it, beside the app doing it', async () => {
  const rows = [...section('id="how"', 'id="waitlist"').matchAll(/<article class="feature">([\s\S]*?)<\/article>/g)].map((m) => m[1]);
  assert.equal(rows.length, 3);
  const copy = rows.map((row) => row.match(/<div class="feature-copy">[\s\S]*?<p>([^<]+)<\/p>/)[1]);
  assert.equal(copy[0], 'Scouts find the best moments and cut them into vertical clips with hooks and captions. You keep or skip each one.');
  assert.ok(copy[0].split(/\s+/).length <= 22, 'row 1 gets to the point');
  assert.match(copy[1], /two versions with one change, like the hook or length/);
  assert.match(copy[1], /After a week, Growth Factory compares the views and reach and keeps the winner\./);
  assert.match(copy[2], /every clip you keep or skip, teaches it your audience and taste/);
  assert.match(copy[2], /Winners become rules once you approve them/);
  assert.ok(copy.every((c) => c.split(/\s+/).length <= 30), 'short rows');
  const scenes = rows.map((row) => row.match(/<figure class="app-shot scene-shot" role="img" aria-label="([^"]{80,})"><!-- build:scene (\w+) -->/));
  assert.deepEqual(scenes.map((m) => m && m[2]), ['swarm', 'loop', 'learn']);
  assert.match(scenes[1][1], /Instagram/);
  assert.match(scenes[2][1], /sample channel/);
  assert.doesNotMatch(html, /data-scene-toggle|scene-controls|>Pause</, 'the animations have no pause control');
});

test('every image is a real WebP whose size matches its markup, and is credited', async () => {
  const imgs = [...html.matchAll(/<img src="\/assets\/((?:streamers\/)?[a-z-]+\.webp)\?v=pearl-streamer-10"[^>]*?width="(\d+)" height="(\d+)"/g)];
  const files = [...new Set(imgs.map((m) => m[1]))];
  assert.equal(files.filter((f) => f.startsWith('streamers/')).length, 7);
  const assets = await readFile(new URL('ASSETS.md', root), 'utf8');
  for (const [, file, w, h] of imgs) {
    assert.deepEqual(webpSize(await readFile(new URL(`assets/${file}`, root))), [Number(w), Number(h)], `${file} size`);
    assert.ok(assets.includes(file.startsWith('streamers/') ? file.slice(10) : `assets/${file}`), `ASSETS.md describes ${file}`);
  }
  assert.match(assets, /Pexels licence/);
  const source = await readFile(new URL('../../docs/images/pearl-studio.png', import.meta.url));
  assert.deepEqual(await readFile(new URL('assets/pearl-studio.jpg', root)), source, 'the social card source is untouched');
});

test('the numbers are sourced: the study, and the app itself', async () => {
  const scouts = await readFile(new URL('../../clip_factory/scouts.py', import.meta.url), 'utf8');
  assert.match(scouts, /^CHUNK_SECONDS = 600(\.0)?$/m, 'ten minutes per scout, so twelve on two hours');
  const proof = section('<section class="proof"', 'id="how"');
  assert.match(proof, /<b>35\.8%<\/b><span>of 53,511 active Twitch channels got no clips in 30 days\. <a class="source-link" href="https:\/\/nysos.io\/en\/etude-clipping-twitch" rel="noopener">Nysos study<\/a>/);
  assert.deepEqual([...proof.matchAll(/<li><b>([^<]+)<\/b>/g)].map((m) => m[1]), ['35.8%', '12', '1', '0']);
  const week = section('id="week"', 'id="waitlist"');
  assert.deepEqual([...week.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]), ['Tonight', 'Tomorrow', 'Next week']);
  assert.equal([...week.matchAll(/<dt>You do<\/dt>/g)].length, 3);
  assert.equal([...week.matchAll(/<dt>You get<\/dt>/g)].length, 3);
  assert.match(week, /<ol class="routine-steps" data-scene="routine">/, 'one player walks the three cards');
  assert.deepEqual([...week.matchAll(/<li class="routine-card" data-card="(\d)"><figure class="routine-vis" aria-hidden="true"><!-- build:scene routine-([a-z]+) -->/g)].map((m) => `${m[1]}:${m[2]}`), ['0:tonight', '1:tomorrow', '2:next']);
  assert.doesNotMatch(css, /\.week-steps|\.week > h2|\.week \{ padding/, 'the section does not reuse the learn chart .week class');
});

test('the page keeps its clipping focus and discloses unverified services', () => {
  for (const wording of ['a saved recording','Can I paste a Twitch link?','Do I need editing experience?','Do I have to connect my accounts?','add the views by hand','on paid plans','No installer to download yet','The Free plan is export first']) assert.ok(html.includes(wording), wording);
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
  // One raised surface on the page: the app screenshots.
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
  for (const name of ['email','mac','stream']) assert.ok(form.includes(`name="${name}"`), name);
  assert.doesNotMatch(form, /name="channel"/, 'three questions, no more');
  assert.match(form, /id="wl-email"[^>]*type="email"[^>]*required/);
  for (const id of ['wl-email','wl-mac','wl-stream']) assert.ok(form.includes(`for="${id}"`), `label for ${id}`);
  assert.match(form, /data-waitlist-status role="status" aria-live="polite"/);
  assert.match(form, /Submitting opens an email to <a href="mailto:jamesbodebiyi@gmail.com[^"]*">jamesbodebiyi@gmail.com<\/a> with your answers filled in\./);
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
  const fields = { email: element(), mac: element(), stream: element() };
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
  assert.match(html,/styles.css\?v=pearl-streamer-10/);
  assert.doesNotMatch(html,/pearl-streamer-[789](?!\d)/);
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
  assert.doesNotMatch(body, /Channel/);
  assert.match(h.waitlist.status.textContent, /Send it from your mail app/);
  assert.match(h.waitlist.status.className, /is-ready/);
  assert.equal(h.waitlist.fields.email.attributes['aria-invalid'], 'false');
});
