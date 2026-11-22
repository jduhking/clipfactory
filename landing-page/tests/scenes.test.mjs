// The animated illustrations: one streamer's night told in photos, honest drawing, and the same
// restraint as the WebGL field (30 fps, DPR cap, sleep offscreen, still frame for reduced motion,
// pausable).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sceneSource = await readFile(new URL('scenes.js', root), 'utf8');
const terrainSource = await readFile(new URL('terrain.js', root), 'utf8');
const shader = await readFile(new URL('../../frontend/src/growth/contours.ts', import.meta.url), 'utf8');

// ---- a DOM and canvas harness, installed before the module is imported ----
const frames = [];
const recorded = [];
function fakeContext() {
  const calls = [];
  const colors = [];
  const texts = [];
  const target = {
    calls, colors, texts,
    setTransform(...a) { calls.push(['setTransform', ...a]); },
    lineDashOffset: 0,
    clearRect(...a) { calls.push(['clearRect', ...a]); },
    save() { calls.push(['save']); }, restore() { calls.push(['restore']); },
    beginPath() { calls.push(['beginPath']); }, closePath() { calls.push(['closePath']); },
    moveTo() { calls.push(['moveTo']); }, lineTo() { calls.push(['lineTo']); },
    arc(...a) { calls.push(['arc', ...a]); }, quadraticCurveTo() { calls.push(['quadraticCurveTo']); }, bezierCurveTo() { calls.push(['bezierCurveTo']); },
    fill() { calls.push(['fill']); }, stroke() { calls.push(['stroke']); },
    translate(...a) { calls.push(['translate', ...a]); }, rotate(...a) { calls.push(['rotate', ...a]); }, scale(...a) { calls.push(['scale', ...a]); },
    fillRect() { calls.push(['fillRect']); }, clip() { calls.push(['clip']); },
    drawImage(img, ...a) { calls.push(['drawImage', img?.name, ...a]); }, setLineDash() { calls.push(['setLineDash']); },
    fillText(text) { texts.push(String(text)); calls.push(['fillText', text]); },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  return new Proxy(target, {
    set(object, key, value) {
      if (key === 'fillStyle' || key === 'strokeStyle' || key === 'shadowColor') {
        if (typeof value === 'string') colors.push(value);
      }
      if (key === 'globalAlpha') calls.push(['globalAlpha', value]);
      object[key] = value;
      return true;
    },
  });
}
function element(extra = {}) {
  const classes = new Set();
  return {
    clientWidth: 800, clientHeight: 500, attributes: {}, children: [], classes, dataset: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    setAttribute(name, value) { this.attributes[name] = value; },
    hasAttribute(name) { return name in this.attributes; },
    toggleAttribute(name, on) { if (on) this.attributes[name] = ''; else delete this.attributes[name]; },
    get firstChild() { return this.children[0] ?? null; },
    appendChild(child) { this.children.push(child); child.parent = this; },
    insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; },
    querySelector() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; },
    ...extra,
  };
}
function media(matches = false) {
  return { matches, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, removeEventListener() {}, set(value) { this.matches = value; this.listeners.change?.(); } };
}
const documentStub = {
  hidden: false, listeners: {},
  querySelectorAll: () => [],
  addEventListener(name, fn) { this.listeners[name] = fn; },
  removeEventListener() {},
  createElement: () => {
    const canvas = element({ width: 0, height: 0, getContext() { this.ctx ??= fakeContext(); return this.ctx; },
      remove() { this.removed = true; const kids = this.parent?.children; if (kids) kids.splice(kids.indexOf(this), 1); } });
    recorded.push(canvas);
    return canvas;
  },
};
globalThis.document = documentStub;
globalThis.window = { devicePixelRatio: 3, matchMedia: () => media(false), addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
globalThis.cancelAnimationFrame = () => {};
globalThis.IntersectionObserver = class { constructor(fn) { this.fn = fn; IntersectionObserver.last = this; } observe() {} disconnect() { this.disconnected = true; } };
globalThis.ResizeObserver = class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} };
globalThis.performance = { now: () => 0 };

const { mountScene, SCENES, PHOTOS, railReporter, followSteps, loadPhotos, storyState, storyLayout, STORY_BEATS, STORY_PERIOD, STORY_RUN, FAMILIES, LESSONS } = await import('../scenes.js');
const { terrain, contourSegments, SPAN, STILL_AT } = await import('../terrain.js');

/** Stand-ins for the loaded photos, at their real sizes. */
const SIZES = { talk: [1280, 720], play: [1280, 720], pizza: [1280, 720], moment: [1280, 720], clip: [720, 1280], clipTalk: [540, 960], clipPlay: [540, 960] };
const loaded = Object.fromEntries(Object.entries(SIZES).map(([name, [w, h]]) => [name, { name, complete: true, naturalWidth: w, naturalHeight: h }]));

function mount({ kind = 'cut', motion = media(false), forced = media(false), host = element(), clock, report, scenes, photos } = {}) {
  frames.length = 0;
  recorded.length = 0;
  const button = element({ hidden: true, events: {}, addEventListener(name, fn) { this.events[name] = fn; }, removeEventListener() {} });
  const lifecycle = { listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, removeEventListener() {} };
  let at = 0;
  const handle = mountScene({ host, kind, button, lifecycle, report, photos, ...(scenes ? { scenes } : {}), clock: clock ?? (() => at),
    media: (query) => (query.includes('forced-colors') ? forced : motion) });
  const canvas = () => recorded[recorded.length - 1];
  return { handle, host, button, lifecycle, motion, forced, canvas,
    tick(ms) { at += ms; const next = frames.shift(); next?.(at); return next; } };
}

const paint = (kind, t, { w = 1320, h = 619, photos = loaded } = {}) => {
  const ctx = fakeContext();
  const state = SCENES[kind](ctx, { w, h, t, contours: [], photos });
  return { ctx, state };
};

test('the terrain port matches the hero shader, constant for constant', () => {
  assert.equal(SPAN, Number(shader.match(/const SPAN = ([\d.]+)/)[1]));
  assert.equal(STILL_AT, Number(shader.match(/const STILL_AT = (\d+)/)[1]));
  for (const magic of ['127.1', '311.7', '269.5', '183.3', '43758.5453', '0.013', '0.011', '0.009', '0.007', '0.012', '0.008', '2.1', '0.4']) {
    assert.ok(shader.includes(magic), `shader has ${magic}`);
    assert.ok(terrainSource.includes(magic), `terrain.js keeps ${magic}`);
  }
  assert.match(terrainSource, /frontend\/src\/growth\/contours\.ts/);
  assert.ok(!/Math\.random/.test(terrainSource + sceneSource), 'scenes stay deterministic');
});

test('contour lines are deterministic, scaled like the shader, and every fifth one is major', () => {
  const first = contourSegments({ width: 400, height: 300, time: STILL_AT });
  const again = contourSegments({ width: 400, height: 300, time: STILL_AT });
  assert.deepEqual(first, again);
  assert.ok(first.length > 3);
  assert.ok(first.reduce((n, line) => n + line.segments.length, 0) > 50);
  for (const line of first) assert.equal(line.major, line.level % 5 === 0);
  const moved = contourSegments({ width: 400, height: 300, time: STILL_AT + 9 });
  assert.notDeepEqual(moved, first, 'the field drifts with time');
  assert.deepEqual(contourSegments({ width: 0, height: 0, time: 0 }), []);
  assert.equal(terrain(0, 0, STILL_AT).toFixed(6), '0.130711');
});

test('every scene paints in the app palette, at every size, and never draws a number', () => {
  assert.deepEqual(Object.keys(SCENES), ['story', 'find', 'cut', 'pick', 'post', 'learn']);
  const allowed = new Set(['#ececec', '#a75de3', '#af85f3', '#d2acf7', '#2c2c2c', '#191919', '#8a8a8a', '#6fcf97', 'rgba(167,93,227,0)']);
  const sizes = [[1320, 619], [480, 370], [350, 350], [900, 420]];
  for (const kind of Object.keys(SCENES)) {
    for (const [w, h] of sizes) {
      for (const photos of [loaded, {}]) {
        for (let t = 0; t < STORY_PERIOD * STORY_RUN + 2; t += 0.45) {
          const { ctx } = paint(kind, t, { w, h, photos });
          assert.ok(ctx.calls.length > 20, `${kind} draws at ${t}`);
          for (const color of ctx.colors) assert.ok(allowed.has(color), `${kind} colour ${color}`);
          for (const text of ctx.texts) assert.doesNotMatch(text, /[0-9]/, `${kind} label "${text}" has no number`);
          for (const [name, , , r] of ctx.calls) if (name === 'arc') assert.ok(r >= 0, `${kind} arc radius ${r}`);
          for (const [name, , ...args] of ctx.calls) {
            if (name === 'drawImage') assert.ok(args.length === 8 && args.every(Number.isFinite), `${kind} draws a photo with finite numbers at ${t}: ${args}`);
          }
          if (photos !== loaded) assert.ok(!ctx.calls.some(([name]) => name === 'drawImage'), 'nothing is drawn from a photo that has not loaded');
        }
      }
    }
  }
});

test('the story is told in photos of one stream, and every photo it uses exists', async () => {
  assert.deepEqual(Object.keys(PHOTOS).sort(), Object.keys(SIZES).sort());
  for (const src of Object.values(PHOTOS)) {
    assert.match(src, /^\/assets\/streamers\/[a-z-]+\.webp\?v=pearl-streamer-7$/);
    await readFile(new URL('.' + src.split('?')[0], root));
  }
  const used = new Set();
  for (let t = 0; t < STORY_PERIOD; t += 0.25) for (const [name, img] of paint('story', t).ctx.calls) if (name === 'drawImage') used.add(img);
  assert.deepEqual([...used].sort(), Object.keys(SIZES).sort(), 'every photo appears in the story');
  // Source rectangles stay inside the photo, so nothing stretches or samples outside it.
  for (let t = 0; t < STORY_PERIOD; t += 0.3) {
    for (const [name, img, sx, sy, sw, sh] of paint('story', t).ctx.calls) {
      if (name !== 'drawImage') continue;
      const [iw, ih] = SIZES[img];
      assert.ok(sx >= -0.01 && sy >= -0.01 && sx + sw <= iw + 0.01 && sy + sh <= ih + 0.01, `${img} crop stays inside at ${t}`);
    }
  }
});

test('find: the intro and dead air are skipped and the good moments are found', () => {
  const skipping = paint('story', 4.8).ctx.texts;
  for (const text of ['Intro', 'Dead air', 'Skipped', 'Last night\u2019s stream']) assert.ok(skipping.includes(text), `shows ${text}`);
  const found = paint('story', 7).ctx.texts;
  for (const text of ['Funny story', 'Big reaction']) assert.ok(found.includes(text), `finds ${text}`);
  assert.ok(!found.includes('Skipped'), 'skipping is over once moments are found');
  assert.ok(paint('story', 2).ctx.texts.includes('Your clip'), 'the empty clip waits to be filled');
});

test('cut: the vertical crop follows the face and travels into the clip', () => {
  assert.ok(paint('story', 8.5).ctx.texts.includes('Follows your face'));
  const L = storyLayout(1320, 619);
  const dest = (t) => paint('story', t).ctx.calls.filter(([n, img]) => n === 'drawImage' && img === 'moment').map((c) => c.slice(6)).find(([, , w, h]) => w < L.frame.w * 0.9 && h >= L.frame.h * 0.9);
  const lifted = [8.9, 9.3, 9.7].map((t) => dest(t)[0]);
  assert.ok(lifted[0] < lifted[1] && lifted[1] < lifted[2], `the crop moves towards the phone: ${lifted}`);
  assert.ok(Math.abs(dest(9.95)[0] - L.phone.x) < 1 && Math.abs(dest(9.95)[3] - L.phone.h) < 1, 'and lands in it');
  const styled = paint('story', 11.5).ctx.texts;
  for (const text of ['The comeback', 'nobody saw coming']) assert.ok(styled.includes(text), 'a hook is added');
  assert.ok(styled.some((text) => /BELIEVE|THAT|CAN|WORKED|^I$/.test(text)), 'and captions');
});

test('pick, post, learn: you keep it before it posts, and approve before anything changes', () => {
  const captions = STORY_BEATS.map((beat) => beat.caption);
  assert.ok(captions.indexOf('You keep it or skip it') < captions.indexOf('Posted to TikTok, Reels and Shorts'), 'nothing posts before you keep it');
  const picking = paint('story', 13.8).ctx.texts;
  assert.ok(picking.includes('Keep') && picking.includes('Skip'));
  const posted = paint('story', 16.6).ctx.texts;
  for (const name of ['TikTok', 'Reels', 'Shorts', 'Posted']) assert.ok(posted.includes(name), `posts to ${name}`);
  const results = paint('story', 19.5).ctx.texts;
  assert.ok(results.includes('No report yet'), 'an unreported platform stays blank');
  assert.ok(results.includes('Watched to the end, sample shapes'), 'and the bars are labelled as samples');
  for (const text of results) assert.doesNotMatch(text, /zero/i);
  const card = paint('story', 20.6).ctx.texts;
  for (const text of ['Try next', LESSONS[0], 'Approve', 'Nothing changes until you do']) assert.ok(card.includes(text), `the suggestion shows ${text}`);
  assert.ok(paint('story', 21).ctx.texts.includes('Nothing yet'), 'the shelf is empty until you approve');
  assert.ok(paint('story', 23).ctx.texts.includes(LESSONS[0]), 'then the lesson is on the shelf');
  assert.match(sceneSource, /unreported result is unavailable,\s+\*?\s*never zero/i);
  assert.match(sceneSource, /bars never grow/i);
});

test('each stream adds what it learned, and the run starts fresh after the last one', () => {
  const shelf = (t) => LESSONS.filter((lesson) => paint('story', t).ctx.texts.includes(lesson));
  assert.deepEqual(shelf(5), []);
  assert.deepEqual(shelf(STORY_PERIOD + 5), LESSONS.slice(0, 1));
  assert.deepEqual(shelf(STORY_PERIOD * 2 + 5), LESSONS.slice(0, 2));
  assert.deepEqual(shelf(STORY_PERIOD * 2 + 22.8), LESSONS);
  assert.deepEqual(shelf(STORY_PERIOD * 3 + 5), [], 'a new run starts with nothing learned');
  // More clips go out each stream, but the result shapes are the same: no implied lift.
  const bars = (t) => paint('story', t).ctx.calls.filter(([n]) => n === 'drawImage').length;
  assert.ok(bars(STORY_PERIOD * 2 + 19.5) > bars(19.5), 'posted clips pile up stream after stream');
});

test('the story follows the app: five steps in order, with a state the rail can show', () => {
  assert.deepEqual(FAMILIES, ['Find', 'Cut', 'Pick', 'Post', 'Learn']);
  assert.deepEqual([...new Set(STORY_BEATS.map((beat) => beat.family))], [0, 1, 2, 3, 4]);
  for (let i = 1; i < STORY_BEATS.length; i += 1) assert.ok(STORY_BEATS[i].at > STORY_BEATS[i - 1].at);
  assert.equal(storyState(0).beat, 0);
  assert.equal(storyState(STORY_PERIOD - 0.01).family, 4);
  assert.equal(storyState(STORY_PERIOD + 9).loop, 2, 'each pass is the next stream');
  assert.equal(storyState(STORY_PERIOD * STORY_RUN + 1).loop, 1);
  const s = storyState(STORY_PERIOD * 2 + 13);
  assert.ok(s.progress >= 0 && s.progress <= 1);
  assert.deepEqual(paint('story', 37.5).state, storyState(37.5), 'the painter reports what the rail shows');
  assert.equal(STORY_BEATS[storyState(SCENES.story.still).beat].caption, 'You keep it or skip it', 'the still frame is the choice that is yours');
});

test('each station is its own step of the story, with a still that shows the step done', () => {
  const expect = { find: ['Funny story'], cut: ['The comeback'], pick: ['Keep'], post: ['TikTok'], learn: [LESSONS[0], 'No report yet'] };
  for (const [kind, words] of Object.entries(expect)) {
    const still = paint(kind, SCENES[kind].still).ctx.texts;
    for (const word of words) assert.ok(still.includes(word), `${kind} still shows ${word}`);
    assert.equal(SCENES[kind].contours, false);
  }
  assert.ok(!paint('find', 1).ctx.texts.includes('Keep'), 'find never jumps ahead to picking');
  assert.ok(!paint('pick', 1).ctx.texts.includes('Try next'), 'pick never jumps ahead to learning');
  assert.ok(paint('learn', 3).ctx.texts.includes('No report yet'));
});

test('a mounted scene draws the shared photos and redraws when one arrives', () => {
  const s = mount({ kind: 'cut', photos: {} });
  const ctx = s.canvas().ctx;
  assert.ok(!ctx.calls.some(([n]) => n === 'drawImage'), 'nothing to draw before photos load');
  s.handle.dispose();
  const t = mount({ kind: 'cut', photos: loaded });
  assert.ok(t.canvas().ctx.calls.some(([n]) => n === 'drawImage'));
  const before = t.canvas().ctx.calls.length;
  t.handle.refresh();
  assert.ok(t.canvas().ctx.calls.length > before, 'refresh draws again');
  t.handle.dispose();
  const loads = [];
  const made = [];
  const photos = loadPhotos({ a: '/a.webp', b: '/b.webp' }, () => loads.push(1), () => {
    const img = { listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } };
    made.push(img);
    return img;
  });
  assert.deepEqual(Object.keys(photos), ['a', 'b']);
  assert.ok(made.every((img) => img.decoding === 'async' && img.src.endsWith('.webp')));
  made[0].listeners.load();
  assert.equal(loads.length, 1);
});

test('a two-layer scene can sandwich real page content', () => {
  const layered = (ctx, s) => { ctx.fillStyle = '#191919'; ctx.fillRect(0, 0, s.w, s.h); };
  layered.layers = ['back', 'front'];
  const content = { tag: 'app' };
  const host = element();
  host.children.push(content);
  const s = mount({ kind: 'layered', host, scenes: { layered } });
  assert.deepEqual(host.children.map((c) => c.dataset?.layer ?? c.tag), ['back', 'app', 'front']);
  s.handle.dispose();
  assert.deepEqual(host.children, [content], 'disposal removes both canvases');
});

test('switching stations crossfades the old scene into the new one', () => {
  const s = mount({ kind: 'find', photos: loaded });
  assert.equal(s.handle.kind, 'find');
  assert.equal(s.handle.setKind('nope'), false, 'unknown stations are ignored');
  assert.equal(s.handle.setKind('find'), false, 'the current station is not restarted');
  s.tick(1000);
  assert.equal(s.handle.setKind('pick'), true);
  assert.equal(s.handle.kind, 'pick');
  const ctx = s.canvas().ctx;
  ctx.calls.length = 0;
  ctx.texts.length = 0;
  s.tick(160);
  const layers = ctx.calls.filter(([name, value]) => name === 'globalAlpha' && Math.abs(value - 0.5) < 0.01);
  assert.ok(layers.length >= 2, `old and new are both drawn mid-fade: ${layers.length}`);
  assert.ok(ctx.texts.includes('Your clip') && ctx.texts.includes('Keep'), 'both stations are on screen');
  ctx.calls.length = 0;
  ctx.texts.length = 0;
  s.tick(400);
  assert.ok(!ctx.texts.includes('Your clip') && ctx.texts.includes('Keep'), 'after the fade only the new station remains');
  s.handle.dispose();
});

test('the chapter rail mirrors the story: current, done, progress, caption and stream', () => {
  const chapters = [0, 1, 2, 3, 4].map(() => element());
  const beat = element();
  const count = element();
  const rail = { querySelectorAll: () => chapters, querySelector: (sel) => (sel === '[data-loop-beat]' ? beat : count) };
  const report = railReporter(rail);
  report(storyState(STORY_PERIOD + 13));
  assert.equal(beat.textContent, 'You keep it or skip it');
  assert.equal(count.textContent, 'Stream 2');
  assert.deepEqual(chapters.map((c) => c.hasAttribute('data-current')), [false, false, true, false, false]);
  assert.deepEqual(chapters.map((c) => c.hasAttribute('data-done')), [true, true, false, false, false]);
  assert.ok(Number(chapters[2].style.props['--p']) > 0);
  report(undefined);
  assert.equal(beat.textContent, 'You keep it or skip it', 'a painter without state leaves the rail alone');
});

test('scrolling a step to the middle of the screen picks its station', () => {
  const picked = [];
  const steps = ['find', 'cut', 'pick'].map((stage) => { const step = element(); step.dataset.stage = stage; return step; });
  class Watch { constructor(fn, options) { this.fn = fn; this.options = options; Watch.last = this; } observe() {} }
  followSteps({ setKind: (kind) => picked.push(kind) }, steps, Watch);
  assert.equal(Watch.last.options.rootMargin, '-45% 0px -45% 0px');
  Watch.last.fn([{ isIntersecting: true, target: steps[2] }]);
  assert.deepEqual(picked, ['pick']);
  assert.deepEqual(steps.map((step) => step.hasAttribute('data-active')), [false, false, true]);
});

test('an unknown scene name animates nothing', () => {
  const host = element();
  assert.equal(mountScene({ host, kind: 'growth-chart', media: () => media(false), lifecycle: { addEventListener() {}, removeEventListener() {} } }), null);
  assert.equal(host.children.length, 0);
});

test('a mounted scene caps device pixel ratio and holds 30 fps', () => {
  const s = mount({ kind: 'cut' });
  const canvas = s.canvas();
  assert.equal(canvas.width, Math.round(800 * 1.5), 'DPR capped at 1.5 despite a 3x display');
  assert.equal(canvas.height, Math.round(500 * 1.5));
  assert.equal(frames.length, 1, 'one frame is scheduled');
  s.tick(10);
  assert.equal(frames.length, 1, 'a 10ms gap is skipped, not drawn twice');
  s.tick(40);
  assert.ok(frames.length >= 1, 'a 33ms+ gap keeps the loop running');
  s.handle.dispose();
});

test('reduced motion draws one still frame and schedules nothing', () => {
  const motion = media(true);
  const s = mount({ motion });
  assert.equal(frames.length, 0, 'no animation loop under reduced motion');
  assert.ok(s.canvas(), 'a still frame is still drawn');
  assert.equal(s.button.hidden, true, 'no pause control for a still image');
  motion.set(false);
  assert.equal(frames.length, 1, 'turning reduced motion off starts the loop');
  assert.equal(s.button.hidden, false);
  s.handle.dispose();
});

test('the pause control stops and restarts the scene and says which it does', () => {
  const s = mount();
  assert.equal(s.button.textContent, 'Pause');
  assert.equal(s.button.attributes['aria-label'], 'Pause animated illustration');
  s.button.events.click();
  assert.equal(s.button.textContent, 'Play');
  assert.equal(s.button.attributes['aria-label'], 'Play animated illustration');
  frames.length = 0;
  s.tick(40);
  assert.equal(frames.length, 0, 'a paused scene schedules no frames');
  s.button.events.click();
  assert.equal(frames.length, 1, 'playing again resumes the loop');
  s.handle.dispose();
});

test('scenes sleep offscreen and in hidden tabs, and wake again', () => {
  const s = mount();
  const idle = () => { s.tick(40); frames.length = 0; };  // let the scheduled callback retire
  IntersectionObserver.last.fn([{ isIntersecting: false }]);
  idle();
  assert.equal(frames.length, 0, 'offscreen scenes stop asking for frames');
  IntersectionObserver.last.fn([{ isIntersecting: true }]);
  assert.equal(frames.length, 1, 'scrolling back wakes it');
  documentStub.hidden = true;
  documentStub.listeners.visibilitychange();
  idle();
  assert.equal(frames.length, 0, 'a hidden tab stays asleep');
  documentStub.hidden = false;
  documentStub.listeners.visibilitychange();
  assert.equal(frames.length, 1, 'coming back to the tab resumes it');
  s.handle.dispose();
});

test('forced colors remove the canvas and restore it when turned off', () => {
  const forced = media(true);
  const s = mount({ forced });
  assert.equal(s.host.children.length, 0, 'no canvas is drawn in forced colors');
  assert.equal(s.button.hidden, true);
  forced.set(false);
  assert.equal(s.host.children.length, 1, 'the scene comes back');
  assert.equal(s.button.hidden, false);
  s.handle.dispose();
});

test('disposal is idempotent and leaves nothing behind', () => {
  const s = mount();
  assert.ok(s.host.classes.has('has-scene'));
  s.handle.dispose();
  s.handle.dispose();
  assert.equal(s.host.classes.has('has-scene'), false);
  assert.equal(s.canvas().removed, true);
  assert.equal(IntersectionObserver.last.disconnected, true);
  frames.length = 0;
  s.tick(40);
  assert.equal(frames.length, 0, 'a disposed scene never draws again');
});

test('leaving the page disposes the scene unless the page is kept in the back/forward cache', () => {
  const kept = mount();
  kept.lifecycle.listeners.pagehide({ persisted: true });
  assert.equal(kept.host.children.length, 1, 'a cached page keeps its renderer');
  kept.handle.dispose();
  const gone = mount();
  gone.lifecycle.listeners.pagehide({ persisted: false });
  assert.equal(gone.host.children.length, 0);
});
