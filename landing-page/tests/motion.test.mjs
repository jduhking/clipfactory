import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SWARM, stretchCount, candidateCount, swarmPicks, swarmSteps, swarmMarkup, heroMarks, heroMarkup, LOOP, loopSteps, loopMarkup, LEARN, learnSteps, learnMarkup, fmt, mountScene } from '../motion.js';

const root = new URL('../', import.meta.url);
const scouts = await readFile(new URL('../../clip_factory/scouts.py', import.meta.url), 'utf8');
const growth = await readFile(new URL('../../clip_factory/growth_loop.py', import.meta.url), 'utf8');
const posting = await readFile(new URL('../../clip_factory/posting_server.py', import.meta.url), 'utf8');
const supported = growth.match(/SUPPORTED_RULES = \{([^}]+)\}/)[1].match(/"([a-z_]+)"/g).map((x) => x.slice(1, -1));
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
  const ready = steps.findIndex((s) => s.done);
  assert.ok(steps.slice(0, ready).reduce((t, s) => t + s.ms, 0) <= 6000, 'clips are ready within six seconds');
  assert.ok(steps.every((s) => s.ms >= 150 && s.ms <= 4000));
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

test('the loop follows growth_loop.py: one supported change per round on a platform that reports reach, more views wins', () => {
  const reported = posting.match(/"instagram": \{([^}]+)\}/)[1];
  assert.match(growth, /def compare_observations\(before: dict, after: dict, \*, metric="views", min_views=100/);
  assert.equal(LOOP.metric, 'views');
  assert.equal(LOOP.minViews, 100);
  assert.equal(LOOP.platform, 'Instagram');
  for (const round of LOOP.rounds) {
    assert.ok(supported.includes(round.rule), `${round.rule} is a supported rule`);
    const diff = ['label', 'tag'].filter((k) => round.a[k] !== round.b[k]);
    assert.equal(diff.length, 1, `${round.change}: one change`);
    for (const side of ['a', 'b']) {
      for (const key of Object.keys(round[side].stats)) assert.ok(reported.includes(`"${key}"`), `Instagram reports ${key}`);
      assert.ok(round[side].stats.views >= LOOP.minViews, 'enough views on both');
    }
    const [win, lose] = round.winner === 'a' ? [round.a, round.b] : [round.b, round.a];
    assert.ok(win.stats.views > lose.stats.views, `${round.change}: more views wins`);
    assert.ok(win.stats.reach > lose.stats.reach, `${round.change}: and more reach`);
    assert.ok(win.stats.reach <= win.stats.views && lose.stats.reach <= lose.stats.views, 'reach never exceeds views');
  }
  assert.ok(new Set(LOOP.rounds.map((r) => r.winner)).size > 1, 'the new version does not always win');
  assert.equal(fmt(940), '940');
  assert.equal(fmt(3410), '3.4K');
  assert.equal(fmt(1020), '1K');
});

test('the loop never calls a winner before the window ends, or applies a lesson before you approve it', () => {
  const steps = loopSteps();
  assert.equal(steps.length, LOOP.rounds.length * 9);
  for (const s of steps) {
    if (s.measured) assert.equal(s.progress, 1, 'measured only once the window is complete');
    if (s.won) assert.ok(s.measured);
    if (s.learned) assert.ok(s.won);
    if (s.approved) assert.ok(s.learned);
    if (s.next) assert.ok(s.approved);
    if (s.status === 'Waiting for your OK') assert.equal(s.approved, false);
  }
  for (let r = 0; r < LOOP.rounds.length; r++) {
    const round = steps.filter((s) => s.round === r);
    assert.equal(round[0].progress, 0, 'each round starts at zero');
    assert.ok(round.every((s, i) => i === 0 || s.progress >= round[i - 1].progress), 'numbers only climb');
    assert.ok(round.some((s) => s.status === `More views and reach: keep ${LOOP.rounds[r].winner.toUpperCase()}`));
    assert.ok(round.some((s) => s.learned && !s.approved), 'a lesson waits for approval');
    assert.equal(round.at(-1).status, r < LOOP.rounds.length - 1 ? `Next test: ${LOOP.rounds[r + 1].change}` : 'Your next clips use it');
  }
});

test('the playbook stacks the approved lessons week by week as Style versions', () => {
  assert.equal(LEARN.views.length, LEARN.weeks);
  assert.equal(LEARN.kept.length, LEARN.weeks);
  assert.ok(LEARN.kept.every((k) => k >= 0 && k <= 10));
  for (const rule of LEARN.rules) assert.ok(supported.includes(rule.rule), `${rule.rule} is a supported rule`);
  assert.deepEqual(LEARN.rules.slice(0, LOOP.rounds.length).map((r) => r.text), LOOP.rounds.map((r) => r.lesson), 'the loop lessons are the first rules');
  assert.deepEqual(LEARN.rules.slice(0, LOOP.rounds.length).map((r) => r.rule), LOOP.rounds.map((r) => r.rule));
  const steps = learnSteps();
  assert.deepEqual(steps.filter((s) => !s.done).map((s) => s.week), [...Array(LEARN.weeks).keys()].map((k) => k + 1));
  for (const rule of LEARN.rules) assert.equal(steps[rule.week - 1].status, `Week ${rule.week}: you approved a new rule`);
  assert.equal(steps.at(-1).status, `Style v${LEARN.rules.length + 1}: ${LEARN.rules.length} rules, each one approved by you`);
  assert.match(growth, /^MIN_TASTE_REVIEWS = \d+$/m);
});

test('the hero marks where each kept clip comes from and names real posting platforms', () => {
  const labels = [...posting.match(/PLATFORM_LABELS = \{([^}]+)\}/)[1].matchAll(/: "([^"]+)"/g)].map((m) => m[1]);
  const marks = heroMarks();
  assert.equal(marks.length, SWARM.clips.length);
  SWARM.clips.forEach((clip, i) => {
    assert.ok(marks[i] > clip.stretch / stretchCount() && marks[i] < (clip.stretch + 1) / stretchCount(), `mark ${i + 1} sits in its stretch`);
    assert.ok(labels.some((label) => clip.platform.startsWith(label)), `${clip.platform} is a posting platform`);
  });
  const hero = heroMarkup();
  assert.equal([...hero.matchAll(/class="hero-clip"/g)].length, 3);
  assert.equal([...hero.matchAll(/class="hero-mark"/g)].length, 3);
  assert.equal([...hero.matchAll(/fetchpriority="high"/g)].length, 1, 'only the stream frame loads first');
});

test('the built page carries both scenes in their finished state', () => {
  const swarm = swarmMarkup(), loop = loopMarkup(), learn = learnMarkup();
  for (const [name, markup] of [['swarm', swarm], ['loop', loop], ['learn', learn], ['hero', heroMarkup()]]) assert.ok(html.includes(markup), `index.html has the ${name} markup`);
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
  assert.equal([...loop.matchAll(/data-stat="/g)].length, 24);
  assert.equal([...loop.matchAll(/class="version-win"/g)].length, 3, 'only winners carry the badge');
  assert.equal([...learn.matchAll(/class="week /g)].length, 8);
  assert.equal([...learn.matchAll(/class="rule is-on"/g)].length, 4);
  assert.match(learn, /Sample channel/);
  assert.equal([...loop.matchAll(/class="lesson is-approved"/g)].length, 3);
  assert.match(loop, /class="scene loop is-measured is-won is-learned is-approved is-next"/);
  assert.doesNotMatch(swarm + loop + learn, /<script|on[a-z]+=/i);
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
