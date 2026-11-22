// The animated illustrations: shader-derived terrain, honest drawing, and the same restraint as
// the WebGL field (30 fps, DPR cap, sleep offscreen, still frame for reduced motion, pausable).
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
    clearRect(...a) { calls.push(['clearRect', ...a]); },
    save() { calls.push(['save']); }, restore() { calls.push(['restore']); },
    beginPath() { calls.push(['beginPath']); }, closePath() { calls.push(['closePath']); },
    moveTo() { calls.push(['moveTo']); }, lineTo() { calls.push(['lineTo']); },
    arc(...a) { calls.push(['arc', ...a]); }, quadraticCurveTo() { calls.push(['quadraticCurveTo']); }, bezierCurveTo() { calls.push(['bezierCurveTo']); },
    fill() { calls.push(['fill']); }, stroke() { calls.push(['stroke']); },
    translate(...a) { calls.push(['translate', ...a]); }, rotate(...a) { calls.push(['rotate', ...a]); }, scale(...a) { calls.push(['scale', ...a]); },
    fillRect() { calls.push(['fillRect']); }, setLineDash() { calls.push(['setLineDash']); },
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

const { mountScene, SCENES, railReporter, followSteps, loopState, LOOP_BEATS, LOOP_PERIOD } = await import('../scenes.js');
const { terrain, contourSegments, SPAN, STILL_AT } = await import('../terrain.js');

function mount({ kind = 'cut', motion = media(false), forced = media(false), host = element(), clock, report } = {}) {
  frames.length = 0;
  recorded.length = 0;
  const button = element({ hidden: true, events: {}, addEventListener(name, fn) { this.events[name] = fn; }, removeEventListener() {} });
  const lifecycle = { listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, removeEventListener() {} };
  let at = 0;
  const handle = mountScene({ host, kind, button, lifecycle, report, clock: clock ?? (() => at),
    media: (query) => (query.includes('forced-colors') ? forced : motion) });
  const canvas = () => recorded[recorded.length - 1];
  const context = () => canvas()?.getContextResult;
  // the canvas stub makes a fresh context per call, so capture the live one from the scene
  return { handle, host, button, lifecycle, motion, forced, canvas, context,
    tick(ms) { at += ms; const next = frames.shift(); next?.(at); return next; },
    drawn() { return host.children[0]?.ctx; } };
}

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

test('every scene paints, in the app palette, and never draws a number', () => {
  assert.deepEqual(Object.keys(SCENES), ['loop', 'understand', 'cut', 'judge', 'post', 'learn']);
  const allowed = new Set(['#ececec', '#a75de3', '#af85f3', '#d2acf7', '#2c2c2c', '#191919', '#8a8a8a', '#6fcf97', 'rgba(167,93,227,0)']);
  const app = { x: 176, y: 30, w: 448, h: 252 };
  for (const kind of Object.keys(SCENES)) {
    for (let t = 0; t < 40; t += 0.7) {
      const ctx = fakeContext();
      for (const layer of SCENES[kind].layers ?? [undefined]) {
        SCENES[kind](ctx, { w: 800, h: 500, t, app, layer, contours: contourSegments({ width: 800, height: 500, time: 3.5 }) });
      }
      if (Math.abs(t - 3.5) < 0.35) assert.ok(ctx.calls.length > 150, `${kind} draws`);
      for (const color of ctx.colors) assert.ok(allowed.has(color), `${kind} colour ${color}`);
      for (const text of ctx.texts) assert.doesNotMatch(text, /[0-9]/, `${kind} label "${text}" has no number`);
      for (const [name, , , r] of ctx.calls) if (name === 'arc') assert.ok(r >= 0, `${kind} arc radius ${r}`);
    }
  }
});

const paintAt = (kind, t, extra = {}) => {
  const ctx = fakeContext();
  let state;
  for (const layer of SCENES[kind].layers ?? [undefined]) state = SCENES[kind](ctx, { w: 1200, h: 600, t, contours: [], layer, app: { x: 264, y: 30, w: 672, h: 378 }, ...extra }) ?? state;
  return { ctx, state };
};

test('the results stay honest: a platform with no report is an empty outline, never zero', () => {
  const learn = paintAt('learn', 4).ctx;
  assert.ok(learn.texts.includes('No report yet'), 'the learn station leaves the unreported bar blank');
  assert.ok(learn.texts.includes('Sample shapes'), 'and labels the bars as samples');
  const loop = paintAt('loop', 13).ctx;
  assert.ok(loop.texts.includes('No report yet'), 'the hero marks Shorts as not reported');
  assert.ok(loop.texts.includes('Shorts'));
  for (const ctx of [learn, loop]) for (const text of ctx.texts) assert.doesNotMatch(text, /zero|[0-9]/i);
  assert.match(sceneSource, /unreported is unavailable, never zero/i);
});

test('the hero loop follows the app: five families in order, and approval comes before posting', () => {
  const captions = LOOP_BEATS.map((beat) => beat.caption);
  assert.ok(captions.indexOf('You approve each one') < captions.indexOf('Posted to your channels'), 'nothing posts before approval');
  assert.deepEqual([...new Set(LOOP_BEATS.map((beat) => beat.family))], [0, 1, 2, 3, 4]);
  for (let i = 1; i < LOOP_BEATS.length; i += 1) assert.ok(LOOP_BEATS[i].at > LOOP_BEATS[i - 1].at);
  assert.equal(loopState(0).beat, 0);
  assert.equal(loopState(LOOP_PERIOD - 0.01).family, 4);
  assert.equal(loopState(LOOP_PERIOD + 9.5).loop, 2, 'each pass adds a loop');
  const s = loopState(LOOP_PERIOD * 2 + 9.5);
  assert.equal(LOOP_BEATS[s.beat].caption, 'You approve each one');
  assert.ok(s.progress >= 0 && s.progress <= 1);
  // The painter reports the same state the rail shows, so words and picture never disagree.
  assert.deepEqual(paintAt('loop', 29.5).state, loopState(29.5));
  // The reduced-motion still lands on the approval gate, the moment the loop is about.
  assert.equal(LOOP_BEATS[loopState(SCENES.loop.still).beat].caption, 'You approve each one');
  for (const kind of ['understand', 'judge', 'learn']) assert.ok(typeof SCENES[kind].still === 'number', `${kind} has a chosen still`);
});

test('the hero draws behind and in front of the real app, measured from the page', () => {
  const anchor = { getBoundingClientRect: () => ({ left: 200, top: 40, width: 400, height: 225 }) };
  const content = { tag: 'app' };
  const host = element({ querySelector: (sel) => (sel === '[data-scene-anchor]' ? anchor : null) });
  host.children.push(content);
  const states = [];
  const s = mount({ kind: 'loop', host, report: (state) => states.push(state) });
  assert.deepEqual(host.children.map((c) => c.dataset?.layer ?? c.tag), ['back', 'app', 'front'], 'the orbit sandwiches the screenshot');
  assert.ok(states.length >= 1 && typeof states[0].beat === 'number', 'the painter reports its beat for the rail');
  s.handle.dispose();
  assert.deepEqual(host.children, [content], 'disposal removes both canvases');
});

test('switching stations crossfades the old scene into the new one', () => {
  const s = mount({ kind: 'understand' });
  assert.equal(s.handle.kind, 'understand');
  assert.equal(s.handle.setKind('nope'), false, 'unknown stations are ignored');
  assert.equal(s.handle.setKind('understand'), false, 'the current station is not restarted');
  s.tick(1000);
  assert.equal(s.handle.setKind('judge'), true);
  assert.equal(s.handle.kind, 'judge');
  const ctx = s.canvas().ctx;
  ctx.calls.length = 0;
  s.tick(160);
  // Halfway through the fade both scenes paint, at complementary strength.
  const layers = ctx.calls.filter(([name, value]) => name === 'globalAlpha' && Math.abs(value - 0.5) < 0.01);
  assert.ok(layers.length >= 2, `old and new are both drawn mid-fade: ${layers.length}`);
  assert.ok(ctx.texts.includes('Your stream') && ctx.texts.includes('Critic and ranker'), 'both stations are on screen');
  ctx.calls.length = 0;
  ctx.texts.length = 0;
  s.tick(400);
  assert.ok(!ctx.texts.includes('Your stream') && ctx.texts.length > 0, 'after the fade only the new station remains');
  s.handle.dispose();
});

test('the chapter rail mirrors the loop: current, done, progress, caption and count', () => {
  const chapters = [0, 1, 2, 3, 4].map(() => element());
  const beat = element();
  const count = element();
  const rail = { querySelectorAll: () => chapters, querySelector: (sel) => (sel === '[data-loop-beat]' ? beat : count) };
  const report = railReporter(rail);
  report(loopState(LOOP_PERIOD + 9.5));
  assert.equal(beat.textContent, 'You approve each one');
  assert.equal(count.textContent, 'Loop 2');
  assert.deepEqual(chapters.map((c) => c.hasAttribute('data-current')), [false, false, true, false, false]);
  assert.deepEqual(chapters.map((c) => c.hasAttribute('data-done')), [true, true, false, false, false]);
  assert.ok(Number(chapters[2].style.props['--p']) > 0);
  report(undefined);
  assert.equal(beat.textContent, 'You approve each one', 'a painter without state leaves the rail alone');
});

test('scrolling a step to the middle of the screen picks its station', () => {
  const picked = [];
  const steps = ['understand', 'cut', 'judge'].map((stage) => { const step = element(); step.dataset.stage = stage; return step; });
  class Watch { constructor(fn, options) { this.fn = fn; this.options = options; Watch.last = this; } observe() {} }
  followSteps({ setKind: (kind) => picked.push(kind) }, steps, Watch);
  assert.equal(Watch.last.options.rootMargin, '-45% 0px -45% 0px');
  Watch.last.fn([{ isIntersecting: true, target: steps[2] }]);
  assert.deepEqual(picked, ['judge']);
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

test('the agent scene shows an agent taking clips out of the recording', () => {
  const paint = (t) => { const ctx = fakeContext(); SCENES.cut(ctx, { w: 820, h: 510, t, contours: [] }); return ctx; };
  const labels = paint(3.3).texts;
  assert.ok(labels.includes('Your recording'), 'the source is named');
  assert.ok(labels.includes('Clips for review'), 'the output is named');
  // Across one run the agent moves and a clip card is carried: both change position over time.
  const times = [0.3, 1.1, 1.9, 2.7, 3.4];
  const agentX = times.map((t) => Math.round(paint(t).calls.filter(([n]) => n === 'arc').at(-1)?.[1] ?? -1));
  // It travels, then holds still while it works the moment, then tows the clip away.
  assert.ok(new Set(agentX).size >= 3, `the agent travels: ${agentX}`);
  assert.ok(agentX.length - new Set(agentX).size >= 1, `and dwells while extracting: ${agentX}`);
  const carried = times.map((t) => paint(t).calls.filter(([n]) => n === 'translate').length);
  assert.ok(Math.max(...carried) > Math.min(...carried), `a clip is picked up and put down: ${carried}`);
  // The clip card tilts and squashes as it is pulled and lands, so the motion has weight.
  const moves = times.flatMap((t) => paint(t).calls.filter(([n]) => n === 'rotate' || n === 'scale'));
  assert.ok(moves.length > 0, 'cards tilt and settle rather than sliding flat');
  assert.match(sceneSource, /anticipation|overshoot|weight/i);
  for (const text of labels) assert.doesNotMatch(text, /[0-9]/);
});
