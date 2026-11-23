// Two short animations of what the app does, drawn in its own surfaces.
// Each one is plain HTML generated at build time (`swarmMarkup`, `loopMarkup`) in its finished
// state, so it reads the same with JavaScript off or reduced motion on; `mountScene` then plays it.
//
// Swarm follows clip_factory/scouts.py: a source over 20 minutes is split into ten-minute
// stretches (CHUNK_SECONDS = 600), one scout per stretch proposes at most two moments scored 1-10
// ("most stretches of a long video are 3-5"), then a selector keeps the strongest distinct ones,
// best per stretch first. Scouts share one model and run one after another, so they light in turn.
// The status lines are the app's own progress messages.
//
// Loop follows clip_factory/growth_loop.py: each test changes one thing from SUPPORTED_RULES
// (hooks, duration_seconds, framing, caption_style), both versions are measured over the same
// window with enough views, and a lesson only becomes a rule once you approve it.

const V = '?v=pearl-streamer-9';
const photo = (name) => `/assets/streamers/${name}.webp${V}`;
/** Pixel sizes of the photos, so the markup matches each file. */
export const PHOTO_SIZE = { 'stream-talk': [1280, 720], 'stream-play': [1280, 720], 'stream-pizza': [1280, 720], 'stream-moment': [1280, 720], 'clip-moment': [720, 1280], 'clip-play': [540, 960], 'clip-talk': [540, 960] };
const img = (name) => `<img src="${photo(name)}" alt="" loading="lazy" decoding="async" width="${PHOTO_SIZE[name][0]}" height="${PHOTO_SIZE[name][1]}" />`;
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Swarm ────────────────────────────────────────────────────────────────────────────────

export const SWARM = {
  file: 'friday-stream.mov',
  length: '2 h 0 min',
  minutes: 120,
  stretchMinutes: 10,
  frames: ['stream-talk', 'stream-play', 'stream-pizza', 'stream-play', 'stream-moment', 'stream-play', 'stream-moment', 'stream-talk', 'stream-play', 'stream-pizza', 'stream-play', 'stream-talk'],
  // Per stretch: up to two [score, position within the stretch]. Intro and outro propose nothing.
  ideas: [[], [[4, 0.62]], [[8, 0.42], [3, 0.82]], [[5, 0.3]], [[4, 0.24], [3, 0.72]], [[5, 0.56]], [[9, 0.48], [4, 0.86]], [[3, 0.4]], [[5, 0.2], [4, 0.66]], [[7, 0.31]], [[4, 0.52]], []],
  keep: 3,
  // The kept moments, in the order they happen in the stream.
  clips: [
    { stretch: 2, photo: 'clip-play', hook: 'He did NOT see that coming', at: '0:24:12', length: '0:34', caption: 'NO WAY' },
    { stretch: 6, photo: 'clip-moment', hook: 'The comeback nobody saw', at: '1:04:48', length: '0:41', caption: 'WE ARE SO BACK' },
    { stretch: 9, photo: 'clip-talk', hook: 'Chat called it first', at: '1:33:06', length: '0:27', caption: 'YOU GUYS KNEW' },
  ],
};

export const stretchCount = () => Math.ceil(SWARM.minutes / SWARM.stretchMinutes);
export const candidateCount = () => SWARM.ideas.reduce((sum, list) => sum + list.length, 0);

/** The kept moments: best idea per stretch first, then the top `keep` by score (scouts.shortlist). */
export function swarmPicks() {
  const best = SWARM.ideas.map((list, stretch) => list.length ? { stretch, idea: list.reduce((b, x, i) => (x[0] > list[b][0] ? i : b), 0), score: Math.max(...list.map((x) => x[0])) } : null).filter(Boolean);
  return best.sort((a, b) => b.score - a.score || a.stretch - b.stretch).slice(0, SWARM.keep).sort((a, b) => a.stretch - b.stretch);
}

export function swarmSteps() {
  const n = stretchCount();
  const steps = [
    { ms: 1000, status: 'Footage in', scanned: 0, active: -1, picked: false, cut: false },
    { ms: 1200, status: 'Listening and watching', scanned: 0, active: -1, picked: false, cut: false, listening: true },
  ];
  for (let i = 0; i < n; i++) {
    const lo = i * SWARM.stretchMinutes, hi = Math.min(SWARM.minutes, lo + SWARM.stretchMinutes);
    steps.push({ ms: 560, status: `Scout ${i + 1}/${n} reviewing minutes ${lo}-${hi}`, scanned: i, active: i, picked: false, cut: false });
  }
  steps.push({ ms: 1900, status: `Selecting the best ${SWARM.keep} of ${candidateCount()} scout candidates`, scanned: n, active: -1, picked: true, cut: false });
  steps.push({ ms: 1500, status: `Cutting ${SWARM.keep} vertical clips`, scanned: n, active: -1, picked: true, cut: true });
  steps.push({ ms: 3600, status: `${SWARM.keep} clips ready. Keep or skip each one.`, scanned: n, active: -1, picked: true, cut: true, done: true });
  return steps;
}

export function swarmMarkup() {
  const n = stretchCount();
  const picks = swarmPicks();
  const final = swarmSteps().at(-1);
  const scouts = Array.from({ length: n }, (_, i) => `<li class="scout is-done"><span>${i + 1}</span></li>`).join('');
  const strip = SWARM.ideas.map((list, s) => {
    const ideas = list.map(([score, at], k) => {
      const kept = picks.some((p) => p.stretch === s && p.idea === k);
      return `<b class="idea${kept ? ' is-kept' : ''}" style="--at:${at}"><span>${score}</span></b>`;
    }).join('');
    return `<li class="stretch is-done">${img(SWARM.frames[s])}<i class="scan"></i>${ideas}</li>`;
  }).join('');
  const marks = Array.from({ length: SWARM.minutes / 30 + 1 }, (_, k) => `<span>${Math.floor((k * 30) / 60)}:${String((k * 30) % 60).padStart(2, '0')}:00</span>`).join('');
  const clips = SWARM.clips.map((c) => `<li class="clip"><div class="clip-frame">${img(c.photo)}<span class="clip-hook">${esc(c.hook)}</span><span class="clip-caption">${esc(c.caption)}</span></div><span class="clip-meta"><span>From ${c.at}</span><span>${c.length}</span></span></li>`).join('');
  return `<div class="scene swarm is-picked is-cut" data-scene="swarm">
<div class="scene-head"><span class="scene-title">${SWARM.file}<span>${SWARM.length}</span></span><span class="scene-status" data-status>${final.status}</span></div>
<ol class="swarm-scouts">${scouts}</ol>
<ol class="swarm-strip">${strip}</ol>
<div class="swarm-time">${marks}</div>
<ul class="swarm-clips">${clips}</ul>
</div>`;
}

// ── Loop ─────────────────────────────────────────────────────────────────────────────────

export const LOOP = {
  stages: ['Post', 'Measure', 'Learn', 'You approve', 'Next clips'],
  rounds: [
    { change: 'the hook', rule: 'hooks', photo: 'clip-moment', a: { label: 'Wait for it', watched: 0.46 }, b: { label: 'He did NOT see that coming', watched: 0.72 }, winner: 'b', lesson: 'Open on the big moment' },
    { change: 'the length', rule: 'duration_seconds', photo: 'clip-play', a: { label: 'The comeback nobody saw', tag: '0:41', watched: 0.66 }, b: { label: 'The comeback nobody saw', tag: '0:24', watched: 0.5 }, winner: 'a', lesson: 'Let the story play out' },
    { change: 'the captions', rule: 'caption_style', photo: 'clip-talk', a: { label: 'Chat called it first', tag: 'Plain captions', watched: 0.48 }, b: { label: 'Chat called it first', tag: 'Word by word', watched: 0.68 }, winner: 'b', lesson: 'Word-by-word captions' },
  ],
};

const BEATS = [
  { ms: 1400, stage: 0, status: 'Both versions posted' },
  { ms: 2600, stage: 1, status: 'Same time up, enough views on both', measured: true },
  { ms: 1400, stage: 1, status: 'Keep the one people watched longer', measured: true, won: true },
  { ms: 1500, stage: 2, status: 'What the winner shows', measured: true, won: true, learned: true },
  { ms: 1500, stage: 3, status: 'Waiting for your OK', measured: true, won: true, learned: true },
  { ms: 1000, stage: 3, status: 'Approved. Now it is a rule.', measured: true, won: true, learned: true, approved: true },
  { ms: 2200, stage: 4, status: 'Your next clips use it', measured: true, won: true, learned: true, approved: true, next: true },
];

export function loopSteps() {
  return LOOP.rounds.flatMap((round, r) => BEATS.map((beat) => ({
    ...beat, round: r, measured: !!beat.measured, won: !!beat.won, learned: !!beat.learned, approved: !!beat.approved, next: !!beat.next,
    status: beat.next && r < LOOP.rounds.length - 1 ? `Next test: ${LOOP.rounds[r + 1].change}` : beat.status,
  })));
}

function phone(round, side) {
  const v = round[side];
  const win = round.winner === side;
  return `<div class="version${win ? ' is-winner' : ''}"><div class="clip-frame">${img(round.photo)}<span class="clip-hook">${esc(v.label)}</span>${v.tag ? `<span class="version-tag">${esc(v.tag)}</span>` : ''}<span class="version-letter">${side.toUpperCase()}</span>${win ? '<span class="version-win">Winner</span>' : ''}</div><span class="meter" aria-hidden="true"><i style="--w:${v.watched}"></i></span></div>`;
}

export function loopMarkup() {
  const last = LOOP.rounds.length - 1;
  const stages = LOOP.stages.map((s, i) => `<li class="${i === LOOP.stages.length - 1 ? 'is-now' : 'is-done'}">${s}</li>`).join('');
  const rounds = LOOP.rounds.map((round, r) => `<div class="loop-round${r === last ? ' is-now' : ''}" data-round="${r}"><p class="loop-change">Round ${r + 1}: one change, ${round.change}</p><div class="versions">${phone(round, 'a')}${phone(round, 'b')}</div></div>`).join('');
  const lessons = LOOP.rounds.map((round) => `<li class="lesson is-approved"><span>${esc(round.lesson)}</span><span class="lesson-state"><span class="lesson-approve">Approve</span><span class="lesson-ok">Approved</span></span></li>`).join('');
  const next = SWARM.clips.map((c) => `<li>${img(c.photo)}</li>`).join('');
  return `<div class="scene loop is-measured is-won is-learned is-approved is-next" data-scene="loop">
<div class="scene-head"><span class="scene-title">A/B test<span>Night Owl</span></span><span class="scene-status" data-status>${loopSteps().at(-1).status}</span></div>
<ol class="loop-stages">${stages}</ol>
<div class="loop-body"><div class="loop-rounds">${rounds}<p class="meter-label">Bars show how long people watched</p></div><div class="loop-side"><p class="loop-side-title">What works</p><ol class="lessons">${lessons}</ol><p class="loop-side-title">Your next clips</p><ul class="next-clips">${next}</ul></div></div>
</div>`;
}

// ── Players ──────────────────────────────────────────────────────────────────────────────

const toggle = (el, name, on) => el.classList.toggle(name, !!on);

export function swarmScene(root) {
  const steps = swarmSteps();
  const scouts = [...root.querySelectorAll('.scout')];
  const stretches = [...root.querySelectorAll('.stretch')];
  const status = root.querySelector('[data-status]');
  return {
    steps,
    render(i) {
      const s = steps[i];
      scouts.forEach((el, k) => { toggle(el, 'is-active', k === s.active); toggle(el, 'is-done', k < s.scanned); });
      stretches.forEach((el, k) => { toggle(el, 'is-active', k === s.active); toggle(el, 'is-done', k < s.scanned); });
      toggle(root, 'is-listening', s.listening);
      toggle(root, 'is-picked', s.picked);
      toggle(root, 'is-cut', s.cut);
      if (status) status.textContent = s.status;
    },
  };
}

export function loopScene(root) {
  const steps = loopSteps();
  const stages = [...root.querySelectorAll('.loop-stages li')];
  const rounds = [...root.querySelectorAll('.loop-round')];
  const lessons = [...root.querySelectorAll('.lesson')];
  const status = root.querySelector('[data-status]');
  return {
    steps,
    render(i) {
      const s = steps[i];
      stages.forEach((el, k) => { toggle(el, 'is-now', k === s.stage); toggle(el, 'is-done', k < s.stage); });
      rounds.forEach((el, k) => toggle(el, 'is-now', k === s.round));
      lessons.forEach((el, k) => {
        const approved = k < s.round || (k === s.round && s.approved);
        toggle(el, 'is-approved', approved);
        toggle(el, 'is-pending', k === s.round && s.learned && !s.approved);
      });
      for (const name of ['measured', 'won', 'learned', 'approved', 'next']) toggle(root, `is-${name}`, s[name]);
      if (status) status.textContent = s.status;
    },
  };
}

const SCENES = { swarm: swarmScene, loop: loopScene };

/** Plays a scene while it is on screen and the tab is visible. Reduced motion shows the finished frame. */
export function mountScene({ root, button, scene, media = window.matchMedia.bind(window), lifecycle = window, doc = document, observe, timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) } }) {
  const motion = media('(prefers-reduced-motion: reduce)');
  const last = scene.steps.length - 1;
  let step = 0, paused = false, visible = false, timer = null, disposed = false, started = false;
  const live = () => !disposed && !motion.matches;
  const running = () => live() && !paused && visible && !doc.hidden;
  const updateButton = () => {
    if (!button) return;
    button.hidden = !live();
    button.textContent = paused ? 'Play' : 'Pause';
    const what = button.dataset?.label;
    if (what) button.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} the ${what}`);
  };
  const schedule = () => {
    if (timer !== null) { timers.clear(timer); timer = null; }
    if (!running()) return;
    if (!started) { started = true; step = 0; scene.render(0); }
    timer = timers.set(() => { timer = null; step = step === last ? 0 : step + 1; scene.render(step); schedule(); }, scene.steps[step].ms);
  };
  const sync = () => {
    if (live()) root.classList.add('is-live');
    else { root.classList.remove('is-live'); started = false; step = last; scene.render(last); }
    updateButton();
    schedule();
  };
  const onClick = () => { paused = !paused; updateButton(); schedule(); };
  const onVisibility = () => schedule();
  const onHide = (event) => { if (!event.persisted) dispose(); };
  const stopObserving = (observe ?? ((el, fn) => {
    if (typeof IntersectionObserver === 'undefined') { fn(true); return () => {}; }
    const io = new IntersectionObserver((entries) => fn(entries.some((e) => e.isIntersecting)), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }))(root, (on) => { visible = on; schedule(); });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (timer !== null) timers.clear(timer);
    timer = null;
    stopObserving();
    button?.removeEventListener('click', onClick);
    motion.removeEventListener('change', sync);
    doc.removeEventListener('visibilitychange', onVisibility);
    lifecycle.removeEventListener('pagehide', onHide);
    root.classList.remove('is-live');
    scene.render(last);
    updateButton();
  };
  button?.addEventListener('click', onClick);
  motion.addEventListener('change', sync);
  doc.addEventListener('visibilitychange', onVisibility);
  lifecycle.addEventListener('pagehide', onHide);
  sync();
  return { dispose, get step() { return step; } };
}

if (typeof document !== 'undefined') {
  for (const wrap of document.querySelectorAll('.scene-wrap')) {
    const root = wrap.querySelector('[data-scene]');
    const make = root && SCENES[root.dataset.scene];
    if (make) mountScene({ root, button: wrap.querySelector('[data-scene-toggle]'), scene: make(root) });
  }
}
