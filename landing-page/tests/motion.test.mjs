import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SWARM, stretchCount, candidateCount, swarmPicks, swarmSteps, swarmMarkup, LOOP, loopSteps, loopMarkup, mountScene } from '../motion.js';

const root = new URL('../', import.meta.url);
const scouts = await readFile(new URL('../../clip_factory/scouts.py', import.meta.url), 'utf8');
const growth = await readFile(new URL('../../clip_factory/growth_loop.py', import.meta.url), 'utf8');
const html = await readFile(new URL('index.html', root), 'utf8');
const seconds = (t) => t.split(':').map(Number).reduce((sum, part) => sum * 60 + part, 0);

test('the swarm follows scouts.py: ten-minute stretches, up to two scored ideas each, mostly 3 to 5', () => {
  assert.match(scouts, /^CHUNK_SECONDS = 600\.0$/m);
  assert.match(scouts, /^LONG_SOURCE_SECONDS = 20 \* 60$/m);
  assert.equal(SWARM.stretchMinutes * 60, 600);
  assert.ok(SWARM.minutes * 60 > 20 * 60, 'long enough to use scouts');
  assert.equal(stretchCount(), SWARM.ideas.length);
  assert.equal(SWARM.frames.length, SWARM.ideas.length);
  const scores = SWARM.ideas.flat().map(([score]) => score);
  assert.ok(SWARM.ideas.every((list) => list.length <= 2), 'at most two moments per scout');
  assert.ok(scores.every((s) => Number.isInteger(s) && s >= 1 && s <= 10), 'scores are 1-10');
  assert.ok(scores.filter((s) => s >= 3 && s <= 5).length / scores.length >= 0.6, 'most stretches are 3-5');
  assert.ok(SWARM.ideas.flat().every(([, at]) => at > 0 && at < 1));
});

test('the swarm shows the app progress messages, one scout at a time', () => {
  assert.ok(scouts.includes('f"Scout {index + 1}/{len(spans)} reviewing minutes {lo / 60:.0f}-{hi / 60:.0f}"') || /Scout \{index \+ 1\}\/\{len\(spans\)\} reviewing minutes/.test(scouts));
  assert.match(scouts, /Selecting the best \{[a-z_]+\} of \{len\(pool\)\} scout candidates/);
  const steps = swarmSteps();
  const scoutSteps = steps.filter((s) => s.status.startsWith('Scout '));
  assert.deepEqual(scoutSteps.map((s) => s.status), Array.from({ length: 12 }, (_, i) => `Scout ${i + 1}/12 reviewing minutes ${i * 10}-${i * 10 + 10}`));
  assert.deepEqual(scoutSteps.map((s) => s.active), [...Array(12).keys()], 'one scout lit at a time, in order');
  assert.ok(steps.some((s) => s.status === `Selecting the best 3 of ${candidateCount()} scout candidates`));
  assert.equal(candidateCount(), 14);
  assert.ok(steps.every((s) => s.ms >= 400 && s.ms <= 4000));
  const firstPick = steps.findIndex((s) => s.picked), firstCut = steps.findIndex((s) => s.cut);
  assert.ok(firstPick > steps.indexOf(scoutSteps.at(-1)) && firstCut > firstPick, 'pick after scouting, cut after picking');
});

test('the kept clips are the best idea per stretch, top three, inside their stretch, 8-60 seconds', () => {
  assert.match(scouts, /^MIN_CLIP, MAX_CLIP = 8\.0, 60\.0$/m);
  const picks = swarmPicks();
  assert.deepEqual(picks.map((p) => p.stretch), SWARM.clips.map((c) => c.stretch));
  const bestPerStretch = SWARM.ideas.map((list) => Math.max(0, ...list.map(([s]) => s)));
  const top = [...bestPerStretch].sort((a, b) => b - a).slice(0, SWARM.keep);
  assert.deepEqual(picks.map((p) => p.score).sort((a, b) => b - a), top);
  for (const clip of SWARM.clips) {
    const from = seconds(clip.at), length = seconds(clip.length);
    assert.ok(from >= clip.stretch * 600 && from + length <= (clip.stretch + 1) * 600, `${clip.hook} sits in its stretch`);
    assert.ok(length >= 8 && length <= 60, `${clip.hook} is 8-60s`);
  }
});

test('the loop follows growth_loop.py: one supported change per round, the longer-watched version wins', () => {
  const rules = growth.match(/SUPPORTED_RULES = \{([^}]+)\}/)[1].match(/"([a-z_]+)"/g).map((s) => s.slice(1, -1));
  assert.ok(rules.length >= 4);
  for (const round of LOOP.rounds) {
    assert.ok(rules.includes(round.rule), `${round.rule} is a supported rule`);
    const diff = ['label', 'tag'].filter((k) => round.a[k] !== round.b[k]);
    assert.equal(diff.length, 1, `${round.change}: one change`);
    const winner = round.a.watched > round.b.watched ? 'a' : 'b';
    assert.equal(round.winner, winner, `${round.change}: the longer-watched version wins`);
  }
  assert.ok(new Set(LOOP.rounds.map((r) => r.winner)).size > 1, 'the new version does not always win');
  assert.match(growth, /min_views/);
});

test('the loop never calls a winner before measuring, or applies a lesson before you approve it', () => {
  const steps = loopSteps();
  assert.equal(steps.length, LOOP.rounds.length * 7);
  for (const s of steps) {
    if (s.won) assert.ok(s.measured);
    if (s.learned) assert.ok(s.won);
    if (s.approved) assert.ok(s.learned);
    if (s.next) assert.ok(s.approved);
    if (s.status === 'Waiting for your OK') assert.equal(s.approved, false);
  }
  for (let r = 0; r < LOOP.rounds.length; r++) {
    const round = steps.filter((s) => s.round === r);
    assert.equal(round[0].measured, false, 'each round starts unmeasured');
    assert.ok(round.some((s) => s.learned && !s.approved), 'a lesson waits for approval');
    assert.equal(round.at(-1).status, r < LOOP.rounds.length - 1 ? `Next test: ${LOOP.rounds[r + 1].change}` : 'Your next clips use it');
  }
});

test('the built page carries both scenes in their finished state', () => {
  const swarm = swarmMarkup(), loop = loopMarkup();
  assert.ok(html.includes(swarm), 'index.html has the swarm markup');
  assert.ok(html.includes(loop), 'index.html has the loop markup');
  assert.equal([...swarm.matchAll(/class="scout /g)].length, 12);
  assert.equal([...swarm.matchAll(/class="stretch /g)].length, 12);
  assert.equal([...swarm.matchAll(/class="idea/g)].length, 14);
  assert.equal([...swarm.matchAll(/class="idea is-kept"/g)].length, 3);
  assert.equal([...swarm.matchAll(/class="clip"/g)].length, 3);
  assert.match(swarm, /class="scene swarm is-picked is-cut"/);
  assert.match(swarm, /3 clips ready\. Keep or skip each one\./);
  assert.equal([...loop.matchAll(/class="loop-round[ "]/g)].length, 3);
  assert.equal([...loop.matchAll(/class="version[ "]/g)].length, 6);
  assert.equal([...loop.matchAll(/class="version is-winner"/g)].length, 3);
  assert.equal([...loop.matchAll(/class="lesson is-approved"/g)].length, 3);
  assert.match(loop, /class="scene loop is-measured is-won is-learned is-approved is-next"/);
  assert.doesNotMatch(swarm + loop, /<script|on[a-z]+=/i);
});

function harness({ reduced = false } = {}) {
  const listeners = (target) => {
    const map = new Map();
    target.addEventListener = (type, fn) => map.set(type, fn);
    target.removeEventListener = (type, fn) => { if (map.get(type) === fn) map.delete(type); };
    target.fire = (type, event = {}) => map.get(type)?.(event);
    target.count = () => map.size;
    return target;
  };
  const classes = new Set();
  const root = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) }, classes };
  const attrs = {};
  const button = listeners({ hidden: true, textContent: 'Pause', dataset: { label: 'loop animation' }, setAttribute: (k, v) => { attrs[k] = v; }, attrs });
  const motion = listeners({ matches: reduced });
  const doc = listeners({ hidden: false });
  const lifecycle = listeners({});
  const rendered = [];
  const scene = { steps: [{ ms: 10 }, { ms: 20 }, { ms: 30 }], render: (i) => rendered.push(i) };
  let pending = [], seen = null, stopped = 0;
  const timers = { set: (fn, ms) => { const t = { fn, ms }; pending.push(t); return t; }, clear: (t) => { pending = pending.filter((x) => x !== t); } };
  const observe = (el, fn) => { seen = fn; return () => { stopped++; }; };
  const tick = () => { const t = pending.shift(); assert.ok(t, 'a timer is pending'); t.fn(); return t.ms; };
  const handle = mountScene({ root, button, scene, media: () => motion, lifecycle, doc, observe, timers });
  return { handle, root, button, motion, doc, lifecycle, rendered, tick, pending: () => pending, show: (on) => seen(on), stopped: () => stopped };
}

test('the player waits until it is on screen, then steps and wraps around', () => {
  const h = harness();
  assert.ok(h.root.classes.has('is-live'));
  assert.equal(h.button.hidden, false);
  assert.equal(h.pending().length, 0, 'nothing runs offscreen');
  h.show(true);
  assert.deepEqual(h.rendered.slice(-1), [0]);
  assert.equal(h.tick(), 10);
  assert.equal(h.tick(), 20);
  assert.equal(h.tick(), 30);
  assert.deepEqual(h.rendered.slice(-4), [0, 1, 2, 0], 'wraps back to the start');
  h.show(false);
  assert.equal(h.pending().length, 0, 'sleeps when scrolled away');
});

test('pause holds the frame and the button says what it will do', () => {
  const h = harness();
  h.show(true);
  h.tick();
  assert.equal(h.button.attrs['aria-label'], 'Pause the loop animation');
  h.button.fire('click');
  assert.equal(h.pending().length, 0);
  assert.equal(h.button.textContent, 'Play');
  assert.equal(h.button.attrs['aria-label'], 'Play the loop animation');
  const frames = h.rendered.length;
  h.button.fire('click');
  assert.equal(h.button.textContent, 'Pause');
  assert.equal(h.pending().length, 1);
  assert.equal(h.rendered.length, frames, 'resumes from the same frame');
  h.doc.hidden = true;
  h.doc.fire('visibilitychange');
  assert.equal(h.pending().length, 0, 'sleeps in a hidden tab');
});

test('reduced motion shows the finished frame with no timers and no button', () => {
  const h = harness({ reduced: true });
  h.show(true);
  assert.equal(h.pending().length, 0);
  assert.deepEqual(h.rendered, [2]);
  assert.equal(h.button.hidden, true);
  assert.ok(!h.root.classes.has('is-live'));
  const live = harness();
  live.show(true);
  live.motion.matches = true;
  live.motion.fire('change');
  assert.equal(live.pending().length, 0, 'stops when reduced motion turns on');
  assert.equal(live.rendered.at(-1), 2);
});

test('leaving the page tears the player down, but a back-forward cache stay does not', () => {
  const h = harness();
  h.show(true);
  h.lifecycle.fire('pagehide', { persisted: true });
  assert.equal(h.pending().length, 1);
  h.lifecycle.fire('pagehide', { persisted: false });
  assert.equal(h.pending().length, 0);
  assert.equal(h.stopped(), 1);
  assert.equal(h.button.count() + h.doc.count() + h.motion.count() + h.lifecycle.count(), 0, 'listeners removed');
  assert.ok(!h.root.classes.has('is-live'));
  assert.equal(h.rendered.at(-1), 2);
});
