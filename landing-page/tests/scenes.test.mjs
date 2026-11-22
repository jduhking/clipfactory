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
    arc(...a) { calls.push(['arc', ...a]); }, quadraticCurveTo() { calls.push(['quadraticCurveTo']); },
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
      object[key] = value;
      return true;
    },
  });
}
function element(extra = {}) {
  const classes = new Set();
  return {
    clientWidth: 800, clientHeight: 500, attributes: {}, children: [], classes,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    setAttribute(name, value) { this.attributes[name] = value; },
    appendChild(child) { this.children.push(child); child.parent = this; },
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
    const canvas = element({ width: 0, height: 0, getContext: () => fakeContext(),
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

const { mountScene, SCENES } = await import('../scenes.js');
const { terrain, contourSegments, SPAN, STILL_AT } = await import('../terrain.js');

function mount({ kind = 'cut', motion = media(false), forced = media(false), host = element(), clock } = {}) {
  frames.length = 0;
  recorded.length = 0;
  const button = element({ hidden: true, events: {}, addEventListener(name, fn) { this.events[name] = fn; }, removeEventListener() {} });
  const lifecycle = { listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, removeEventListener() {} };
  let at = 0;
  const handle = mountScene({ host, kind, button, lifecycle, clock: clock ?? (() => at),
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
  assert.deepEqual(Object.keys(SCENES), ['cut', 'post', 'measure']);
  const allowed = new Set(['#ececec', '#a75de3', '#af85f3', '#d2acf7', '#2c2c2c', '#191919', '#8a8a8a', '#6fcf97', 'rgba(167,93,227,0)']);
  for (const kind of Object.keys(SCENES)) {
    const ctx = fakeContext();
    SCENES[kind](ctx, { w: 800, h: 500, t: 3.5, contours: contourSegments({ width: 800, height: 500, time: 3.5 }) });
    assert.ok(ctx.calls.length > 150, `${kind} draws`);
    for (const color of ctx.colors) assert.ok(allowed.has(color) || typeof color === 'object', `${kind} colour ${color}`);
    for (const text of ctx.texts) assert.doesNotMatch(text, /[0-9]/, `${kind} label "${text}" has no number`);
  }
});

test('the results scene shows an unreported bar as blank, never as zero', () => {
  const paint = (t) => { const ctx = fakeContext(); SCENES.measure(ctx, { w: 800, h: 500, t, contours: [] }); return ctx; };
  const checking = paint(6);
  const gap = paint(7.4);
  assert.ok(checking.texts.includes('\u2014'), 'an em dash marks the bar nobody reported');
  assert.ok(gap.texts.includes('\u2014'));
  assert.ok(checking.texts.some((t) => /Checked by you/.test(t)), 'the cursor inspects a reported bar');
  assert.ok(gap.texts.some((t) => /No report yet/.test(t)), 'and reports nothing for the gap');
  assert.ok(gap.texts.some((t) => /Sample/.test(t)));
  for (const ctx of [checking, gap]) for (const text of ctx.texts) assert.doesNotMatch(text, /zero|[0-9]/);
  assert.match(sceneSource, /unreported is unavailable, never zero/i);
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
  const agentX = times.map((t) => Math.round(paint(t).calls.filter(([n]) => n === 'arc')[0]?.[1] ?? -1));
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
