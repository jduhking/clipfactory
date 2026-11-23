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

test('the hero is one idea: clips A/B tested until they grow your channel', async () => {
  const hero = html.slice(html.indexOf('<section class="streamer-hero'), html.indexOf('<section id="why"'));
  assert.match(hero, /<h1 id="hero-title">Find out which clips grow your channel\.<\/h1>/);
  assert.match(hero, /tests two versions of your best ones\. The one people watch longer shapes every clip after it\./);
  assert.match(hero, /class="story-stage ab-stage" data-scene="abtest" role="img" aria-label="Two versions of a clip from your stream, each with one difference: .{60,}"/);
  assert.match(hero, /data-scene-toggle hidden>Pause<\/button>/);
  const lead = hero.match(/<p class="hero-lead">([^<]+)<\/p>/)[1];
  assert.ok(lead.split(/\s+/).length <= 30, 'a short lead');
  for (const name of ['stream-talk','stream-play','stream-moment','clip-moment','clip-talk','clip-play']) {
    assert.ok(scenes.includes(`/assets/streamers/${name}.webp`), `the scenes use ${name}`);
    await readFile(new URL(`assets/streamers/${name}.webp`, root));
  }
  assert.doesNotMatch(html, /window-chrome|window-dots|window-tag|data-scene-anchor/, 'no fake browser or OS window');
  assert.doesNotMatch(html, /alpine-story|ring-card|fake-btn|Scout|Critic|Strategist|Editor\b/, 'plain words, not agent names');
});

test('the hero is not a slideshow and the page does not hedge itself', () => {
  const hero = html.slice(html.indexOf('<section class="streamer-hero'), html.indexOf('<section id="why"'));
  assert.doesNotMatch(hero, /data-rail|loop-chapters|data-loop-beat|<figcaption/, 'no chapter rail or caption under the hero');
  assert.doesNotMatch(html, /Animated illustration|stock photos?|not a customer|sample shapes|do not endorse|nothing here (promises|guarantees)|Nothing can promise|fine print|not a claim/i, 'no disclaimer lines');
});

test('the primary calls to action lead to the waitlist, with no invented installer or access guarantee', () => {
  assert.ok([...html.matchAll(/<a\b[^>]*href="#waitlist"/g)].length >= 1);
  assert.ok([...html.matchAll(/href="mailto:jamesbodebiyi@gmail.com\?subject=Growth%20Factory%20Mac%20streamer%20beta"/g)].length >= 3);
  assert.match(html, /Submitting opens an email to <a href="mailto:/);
  assert.match(html, /Apple Silicon/);
  assert.doesNotMatch(html, /Download for Mac|data-download|theclipfactory-frontend-two\.vercel\.app/);
  assert.doesNotMatch(html, /Suburbbaby|Streamer University|trusted by/i);
});

test('the page runs hero, problem, steps, learning, streamers, waitlist, FAQ, then pricing at the bottom', () => {
  const ids = ['why','how','grow','streamers','waitlist','faq','pricing'];
  const order = ids.map((id) => html.indexOf(`id="${id}"`));
  for (const [i,at] of order.entries()) assert.ok(at > 0, `missing #${ids[i]}`);
  assert.deepEqual([...order].sort((a,b) => a-b), order);
  assert.ok(html.indexOf('streamer-hero') < order[0], 'hero leads the page');
  assert.match(html, /<a class="text-link" href="#how">See how it works<\/a>/);
  const markers = [...html.matchAll(/<p class="step">([A-Za-z]+)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(markers, ['Find','Cut','Pick','Post','Test'], 'only the step sequence is marked');
});

test('the steps scroll one illustration through every stage', () => {
  const kinds = [...html.matchAll(/data-scene="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(kinds, ['abtest','find']);
  assert.match(html, /data-scene="find" data-steps="\.loop-step" role="img" aria-label="The step described beside it, shown with one stream\."/);
  const stages = [...html.matchAll(/<li class="loop-step" data-stage="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(stages, ['find','cut','pick','post','learn']);
  assert.match(scenes, /export const SCENES = \{ abtest, story, find: station\(0\), cut: station\(1\), pick: station\(2\), post: station\(3\), learn: station\(4\) \};/);
  assert.equal([...html.matchAll(/data-scene-toggle/g)].length, 2, 'each animation can be paused');
  assert.ok(html.includes('<script type="module" src="/scenes.js?v=pearl-streamer-7">'));
});

test('each step says what happens and why it matters, as the code has it', () => {
  const step = (stage) => { const at = html.indexOf(`data-stage="${stage}"`); return html.slice(at, html.indexOf('</li>', at)); };
  for (const stage of ['find','cut','pick','post','learn']) assert.match(step(stage), /<p class="why-line">Why it matters: /, `${stage} says why it matters`);
  assert.match(step('find'), /skips the intro, sponsor reads and dead air/);
  assert.match(step('find'), /a hook, one complete idea and a payoff/);
  assert.match(step('find'), /runs on your Mac/);
  assert.match(step('cut'), /The crop follows your face/);
  assert.match(step('cut'), /captions land word by word, kept clear of your face/);
  assert.match(step('cut'), /20 to 60 seconds/);
  assert.match(step('pick'), /not what will do well/);
  assert.match(step('pick'), /nothing posts without you/);
  assert.match(step('post'), /never blindly sent twice/);
  assert.match(step('learn'), /<p class="step">Test<\/p>/);
  assert.match(step('learn'), /a second version with one change, like a different hook or length/);
  assert.match(step('learn'), /the same time up and enough views/);
  assert.match(step('learn'), /suggests making that your style/);
});

test('the what-works section is for streamers testing what works, with the real Results screen', async () => {
  const source = await readFile(new URL('../../docs/images/pearl-studio.png', import.meta.url));
  assert.deepEqual(await readFile(new URL('assets/pearl-studio.jpg', root)), source, 'the social card source is untouched');
  const grow = html.slice(html.indexOf('id="grow"'), html.indexOf('<section id="streamers"'));
  assert.match(grow, /<h2 id="grow-title">Stop guessing what works\.<\/h2>/);
  assert.match(grow, /<img src="\/assets\/app-results.webp\?v=pearl-streamer-7" width="1440" height="744" loading="lazy" alt="The Growth Factory Results screen for a sample channel: /);
  const shot = await readFile(new URL('assets/app-results.webp', root));
  assert.equal(shot.subarray(8, 12).toString(), 'WEBP');
  assert.doesNotMatch(html, /pearl-studio/, 'not the brand-profile screenshot');
  for (const term of ['One change per test','A fair call','You approve the winner']) assert.ok(grow.includes(`<dt>${term}</dt>`), term);
  assert.match(grow, /the hook, the length, the framing or the captions/);
  assert.match(grow, /same time up and enough views before it picks one/);
  assert.match(grow, /once you say yes/);
  const assets = await readFile(new URL('ASSETS.md', root), 'utf8');
  assert.match(assets, /assets\/app-results\.webp/);
});

test('the problem is sourced, and every streamer photo is licensed and credited', async () => {
  const why = html.slice(html.indexOf('id="why"'), html.indexOf('<section id="how"'));
  assert.match(why, /53,511 Twitch channels/);
  assert.match(why, /href="https:\/\/nysos.io\/en\/etude-clipping-twitch"/);
  const grid = html.slice(html.indexOf('id="streamers"'), html.indexOf('<section id="waitlist"'));
  const photos = [...grid.matchAll(/<img src="\/assets\/streamers\/(grid-[a-z]+)\.webp\?v=pearl-streamer-7" width="800" height="1000" loading="lazy" alt="([^"]{20,})"/g)];
  assert.deepEqual(photos.map((m) => m[1]), ['grid-gaming','grid-chatting','grid-creator','grid-music']);
  for (const [, name] of photos) await readFile(new URL(`assets/streamers/${name}.webp`, root));
  assert.match(grid, /works best when you talk/);
  const assets = await readFile(new URL('ASSETS.md', root), 'utf8');
  assert.match(assets, /pexels.com\/license/);
  for (const id of ['7047347','7047530','7047002','7047345','7047236','9072273','5489389','8369604','7120841']) assert.ok(assets.includes(id), `ASSETS.md credits Pexels ${id}`);
});

test('the page keeps its clipping focus and discloses unverified services', () => {
  for (const wording of ['a saved recording','Can I paste a Twitch link?','Do I need editing experience?','not what will do well','Do I have to connect my accounts?','add the views by hand','on paid plans','No installer to download yet','The Free plan is export first']) assert.ok(html.includes(wording), wording);
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
  assert.match(html,/styles.css\?v=pearl-streamer-7/);
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
