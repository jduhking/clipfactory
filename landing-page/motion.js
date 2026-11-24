// The homepage's pictures of what the app does, drawn in its own surfaces.
// Each one is plain HTML generated at build time in its finished state, so it reads the same with
// JavaScript off or reduced motion on; `mountScene` then plays the three scenes.
//
// Hero: one stream, its three best moments marked, and the vertical clips cut from them.
//
// Swarm follows clip_factory/scouts.py: a source over 20 minutes is split into ten-minute
// stretches (CHUNK_SECONDS = 600), one scout per stretch proposes at most two moments scored 1-10
// ("most stretches of a long video are 3-5"), then a selector keeps the strongest distinct ones,
// best per stretch first. Scouts share one model and run one after another, so they light in turn.
// The status lines are the app's own progress messages.
//
// Loop follows clip_factory/growth_loop.py and posting_server.py: each test changes one thing from
// SUPPORTED_RULES (hooks, duration_seconds, framing, caption_style), both versions are read over
// the same window with at least 100 views, compared on views (the default metric), and a lesson
// only becomes a rule once you approve it. Instagram is the platform that reports reach.
//
// Learn shows the same rules stacking up over weeks as Style versions, and the review queue
// leaning towards the clips you keep (growth_loop.preference_model, after MIN_TASTE_REVIEWS).

const V = '?v=pearl-streamer-10';
const photo = (name) => `/assets/streamers/${name}.webp${V}`;
/** Pixel sizes of the photos, so the markup matches each file. */
export const PHOTO_SIZE = { 'stream-talk': [1280, 720], 'stream-play': [1280, 720], 'stream-pizza': [1280, 720], 'stream-moment': [1280, 720], 'clip-moment': [720, 1280], 'clip-play': [540, 960], 'clip-talk': [540, 960] };
const img = (name, eager = false) => `<img src="${photo(name)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="${PHOTO_SIZE[name][0]}" height="${PHOTO_SIZE[name][1]}" />`;
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Social-style counts: 940, 1.2K, 3.4K. */
export const fmt = (n) => (n < 1000 ? String(Math.round(n)) : `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`);

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
    { stretch: 2, photo: 'clip-play', hook: 'He did NOT see that coming', at: '0:24:12', length: '0:34', caption: 'No way', platform: 'TikTok' },
    { stretch: 6, photo: 'clip-moment', hook: 'The comeback nobody saw', at: '1:04:48', length: '0:41', caption: 'We are so back', platform: 'Instagram Reels' },
    { stretch: 9, photo: 'clip-talk', hook: 'Chat called it first', at: '1:33:06', length: '0:27', caption: 'You guys knew', platform: 'YouTube Shorts' },
  ],
};

export const stretchCount = () => Math.ceil(SWARM.minutes / SWARM.stretchMinutes);
export const candidateCount = () => SWARM.ideas.reduce((sum, list) => sum + list.length, 0);
const seconds = (t) => t.split(':').map(Number).reduce((sum, part) => sum * 60 + part, 0);

/** The kept moments: best idea per stretch first, then the top `keep` by score (scouts.shortlist). */
export function swarmPicks() {
  const best = SWARM.ideas.map((list, stretch) => list.length ? { stretch, idea: list.reduce((b, x, i) => (x[0] > list[b][0] ? i : b), 0), score: Math.max(...list.map((x) => x[0])) } : null).filter(Boolean);
  return best.sort((a, b) => b.score - a.score || a.stretch - b.stretch).slice(0, SWARM.keep).sort((a, b) => a.stretch - b.stretch);
}

/** Quick to the point: the scouts sweep the stream in about two seconds, then the clips hold. */
export function swarmSteps() {
  const n = stretchCount();
  const steps = [
    { ms: 600, status: 'Footage in', scanned: 0, active: -1, picked: false, cut: false },
    { ms: 700, status: 'Listening and watching', scanned: 0, active: -1, picked: false, cut: false, listening: true },
  ];
  for (let i = 0; i < n; i++) {
    const lo = i * SWARM.stretchMinutes, hi = Math.min(SWARM.minutes, lo + SWARM.stretchMinutes);
    steps.push({ ms: 190, status: `Scout ${i + 1}/${n} reviewing minutes ${lo}-${hi}`, scanned: i, active: i, picked: false, cut: false });
  }
  steps.push({ ms: 1000, status: `Selecting the best ${SWARM.keep} of ${candidateCount()} scout candidates`, scanned: n, active: -1, picked: true, cut: false });
  steps.push({ ms: 900, status: `Cutting ${SWARM.keep} vertical clips`, scanned: n, active: -1, picked: true, cut: true });
  steps.push({ ms: 4000, status: `${SWARM.keep} clips ready. Keep or skip each one.`, scanned: n, active: -1, picked: true, cut: true, done: true });
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

// ── Hero ─────────────────────────────────────────────────────────────────────────────────

export const HERO = { frame: 'stream-moment', tilts: [-4, 0, 4] };

/** Where each kept clip sits along the stream, 0-1. */
export const heroMarks = () => SWARM.clips.map((c) => seconds(c.at) / (SWARM.minutes * 60));

export function heroMarkup() {
  const scores = new Map(swarmPicks().map((p) => [p.stretch, p.score]));
  const marks = heroMarks().map((at, i) => `<span class="hero-mark" style="--at:${at.toFixed(4)}"><span>${i + 1}</span></span>`).join('');
  const clips = SWARM.clips.map((c, i) => `<li class="hero-clip" style="--tilt:${HERO.tilts[i]}deg;--i:${i}"><div class="clip-frame">${img(c.photo)}<span class="clip-hook">${esc(c.hook)}</span><span class="clip-caption">${esc(c.caption)}</span><span class="hero-score">Score ${scores.get(c.stretch)}/10</span><span class="hero-num">${i + 1}</span></div><span class="hero-clip-meta"><span>${c.platform}</span><span>${c.length}</span></span></li>`).join('');
  return `<div class="hero-visual">
<div class="hero-stream app-shot">${img(HERO.frame, true)}<span class="hero-file">${SWARM.file}<span>${SWARM.length}</span></span><div class="hero-track">${marks}</div></div>
<ul class="hero-clips">${clips}</ul>
</div>`;
}

// ── Loop ─────────────────────────────────────────────────────────────────────────────────

export const LOOP = {
  platform: 'Instagram',
  windowDays: 7,
  minViews: 100,
  metric: 'views',
  stages: ['Post', 'Measure', 'Learn', 'You approve', 'Next clips'],
  rounds: [
    { change: 'the hook', rule: 'hooks', photo: 'clip-moment',
      a: { label: 'Wait for it', stats: { views: 1240, reach: 980, likes: 61, shares: 9 } },
      b: { label: 'He did NOT see that coming', stats: { views: 3410, reach: 2760, likes: 228, shares: 47 } },
      winner: 'b', lesson: 'Open on the big moment' },
    { change: 'the length', rule: 'duration_seconds', photo: 'clip-play',
      a: { label: 'The comeback nobody saw', tag: '0:41', stats: { views: 2980, reach: 2350, likes: 174, shares: 38 } },
      b: { label: 'The comeback nobody saw', tag: '0:24', stats: { views: 2120, reach: 1710, likes: 109, shares: 21 } },
      winner: 'a', lesson: 'Let the story play out' },
    { change: 'the captions', rule: 'caption_style', photo: 'clip-talk',
      a: { label: 'Chat called it first', tag: 'Plain captions', stats: { views: 1870, reach: 1490, likes: 96, shares: 14 } },
      b: { label: 'Chat called it first', tag: 'Word by word', stats: { views: 2640, reach: 2190, likes: 171, shares: 33 } },
      winner: 'b', lesson: 'Word-by-word captions' },
  ],
};
const STATS = [['views', 'Views'], ['reach', 'Reach'], ['likes', 'Likes'], ['shares', 'Shares']];

const BEATS = [
  { ms: 1300, stage: 0, progress: 0, status: `Both versions posted on ${LOOP.platform}` },
  { ms: 1300, stage: 1, progress: 0.35, status: `Day 2 of ${LOOP.windowDays}` },
  { ms: 1300, stage: 1, progress: 0.7, status: `Day 5 of ${LOOP.windowDays}` },
  { ms: 1500, stage: 1, progress: 1, measured: true, status: `Day ${LOOP.windowDays}: same time up, enough views on both` },
  { ms: 1700, stage: 1, progress: 1, measured: true, won: true, status: 'WINNER' },
  { ms: 1400, stage: 2, progress: 1, measured: true, won: true, learned: true, status: 'What the winner shows' },
  { ms: 1400, stage: 3, progress: 1, measured: true, won: true, learned: true, status: 'Waiting for your OK' },
  { ms: 1000, stage: 3, progress: 1, measured: true, won: true, learned: true, approved: true, status: 'Approved. Now it is a rule.' },
  { ms: 2000, stage: 4, progress: 1, measured: true, won: true, learned: true, approved: true, next: true, status: 'Your next clips use it' },
];

export function loopSteps() {
  const last = LOOP.rounds.length - 1;
  return LOOP.rounds.flatMap((round, r) => BEATS.map((beat) => {
    let status = beat.status;
    if (status === 'WINNER') status = `More views and reach: keep ${round.winner.toUpperCase()}`;
    if (beat.next && r < last) status = `Next test: ${LOOP.rounds[r + 1].change}`;
    return { ...beat, round: r, measured: !!beat.measured, won: !!beat.won, learned: !!beat.learned, approved: !!beat.approved, next: !!beat.next, status };
  }));
}

function phone(round, side) {
  const v = round[side];
  const win = round.winner === side;
  const stats = STATS.map(([key, label]) => `<div><dt>${label}</dt><dd data-stat="${v.stats[key]}">${fmt(v.stats[key])}</dd></div>`).join('');
  return `<div class="version${win ? ' is-winner' : ''}"><div class="clip-frame">${img(round.photo)}<span class="clip-hook">${esc(v.label)}</span>${v.tag ? `<span class="version-tag">${esc(v.tag)}</span>` : ''}<span class="version-letter">${side.toUpperCase()}</span>${win ? '<span class="version-win">Winner</span>' : ''}</div><dl class="stats">${stats}</dl></div>`;
}

export function loopMarkup() {
  const last = LOOP.rounds.length - 1;
  const stages = LOOP.stages.map((s, i) => `<li class="${i === LOOP.stages.length - 1 ? 'is-now' : 'is-done'}">${s}</li>`).join('');
  const rounds = LOOP.rounds.map((round, r) => `<div class="loop-round${r === last ? ' is-now' : ''}" data-round="${r}"><p class="loop-change">Round ${r + 1}: one change, ${round.change}</p><div class="versions">${phone(round, 'a')}${phone(round, 'b')}</div></div>`).join('');
  const lessons = LOOP.rounds.map((round) => `<li class="lesson is-approved"><span>${esc(round.lesson)}</span><span class="lesson-state"><span class="lesson-approve">Approve</span><span class="lesson-ok">Approved</span></span></li>`).join('');
  const next = SWARM.clips.map((c) => `<li>${img(c.photo)}</li>`).join('');
  return `<div class="scene loop is-measured is-won is-learned is-approved is-next" data-scene="loop">
<div class="scene-head"><span class="scene-title">A/B test<span>Night Owl on ${LOOP.platform}</span></span><span class="scene-status" data-status>${loopSteps().at(-1).status}</span></div>
<ol class="loop-stages">${stages}</ol>
<div class="loop-body"><div class="loop-rounds">${rounds}<p class="meter-label">Insights from ${LOOP.platform}, the same ${LOOP.windowDays} days for both</p></div><div class="loop-side"><p class="loop-side-title">What works</p><ol class="lessons">${lessons}</ol><p class="loop-side-title">Your next clips</p><ul class="next-clips">${next}</ul></div></div>
</div>`;
}

// ── Learn ────────────────────────────────────────────────────────────────────────────────

export const LEARN = {
  weeks: 8,
  // Sample channel: average views per new clip, and how many of ten suggested clips you kept.
  views: [310, 360, 520, 560, 740, 810, 1020, 1180],
  kept: [4, 5, 5, 6, 6, 7, 7, 8],
  // The loop's approved lessons, in the week each became a rule.
  rules: [
    { week: 2, rule: 'hooks', text: 'Open on the big moment' },
    { week: 3, rule: 'duration_seconds', text: 'Let the story play out' },
    { week: 5, rule: 'caption_style', text: 'Word-by-word captions' },
    { week: 7, rule: 'framing', text: 'Keep your reaction in frame' },
  ],
};

export function learnSteps() {
  const steps = [];
  for (let week = 1; week <= LEARN.weeks; week++) {
    const rule = LEARN.rules.find((r) => r.week === week);
    steps.push({ ms: rule ? 1500 : 800, week, status: rule ? `Week ${week}: you approved a new rule` : `Week ${week}: new clips, new tests` });
  }
  steps.push({ ms: 3400, week: LEARN.weeks, done: true, status: `Style v${LEARN.rules.length + 1}: ${LEARN.rules.length} rules, each one approved by you` });
  return steps;
}

export function learnMarkup() {
  const top = Math.max(...LEARN.views);
  const bars = LEARN.views.map((v, k) => {
    const rule = LEARN.rules.some((r) => r.week === k + 1);
    return `<li class="week is-done${rule ? ' has-rule' : ''}" style="--h:${(v / top).toFixed(3)}"><span class="bar"><i></i></span><span class="week-label">W${k + 1}</span></li>`;
  }).join('');
  const rules = LEARN.rules.map((r) => `<li class="rule is-on"><span>${esc(r.text)}</span><span class="rule-week">Week ${r.week}</span></li>`).join('');
  const last = LEARN.weeks - 1;
  return `<div class="scene learn" data-scene="learn">
<div class="scene-head"><span class="scene-title">Night Owl playbook<span>Sample channel</span></span><span class="scene-status" data-status>${learnSteps().at(-1).status}</span></div>
<div class="learn-body"><div class="learn-chart"><p class="learn-label">Average views per new clip</p><ol class="learn-bars">${bars}</ol></div>
<div class="learn-side"><div class="learn-tiles"><p><b data-learn-views>${fmt(LEARN.views[last])}</b><span>views per new clip</span></p><p><b data-learn-kept>${LEARN.kept[last]} of 10</b><span>suggested clips you keep</span></p></div>
<p class="loop-side-title">Style <span data-learn-version>v${LEARN.rules.length + 1}</span></p><ol class="rules">${rules}</ol></div></div>
</div>`;
}

// ── Routine ──────────────────────────────────────────────────────────────────────────────
// The Tonight / Tomorrow / Next week cards. One player walks the three cards in order, reusing the
// swarm's stream and clips and the loop's first round, so the cards tell the same story as the rows.

export const ROUTINE = {
  cards: ['tonight', 'tomorrow', 'next'],
  stream: 'stream-talk',
  timer: ['0:41:12', '1:22:05', '2:00:00'],
  scouts: [4, 8, 12],
  // Your taste on the three suggested clips: keep the first two, skip the third.
  kept: [true, true, false],
  platforms: ['TikTok', 'Reels', 'Shorts'],
  days: [1, 4, 7],
  idle: ['Waiting for tonight', 'Waiting for clips', 'Waiting for results'],
};

export function routineSteps() {
  const round = LOOP.rounds[0];
  const n = stretchCount();
  const keptCount = ROUTINE.kept.filter(Boolean).length;
  const steps = [];
  let state = { timer: ROUTINE.timer[0], saved: false, scouts: 0, shown: false, picked: 0, posted: false, progress: 0, won: false, asked: false, approved: false, rule: false };
  const add = (card, ms, note, change = {}) => { state = { ...state, ...change }; steps.push({ ms, card, note, ...state }); };
  ROUTINE.timer.forEach((timer, k) => {
    const end = k === ROUTINE.timer.length - 1;
    add(0, end ? 900 : 650, end ? `Stream saved: ${SWARM.file}` : `Live ${timer}`, { timer, saved: end });
  });
  ROUTINE.scouts.forEach((scouts) => add(0, scouts === n ? 1300 : 550, scouts === n ? `${SWARM.keep} moments found` : `Scouts ${scouts} of ${n}`, { scouts }));
  add(1, 800, `${SWARM.keep} clips ready`, { shown: true });
  ROUTINE.kept.forEach((keep, k) => add(1, 650, `You ${keep ? 'keep' : 'skip'} clip ${k + 1}`, { picked: k + 1 }));
  add(1, 1500, `${keptCount} clips posted`, { posted: true });
  ROUTINE.days.forEach((day) => add(2, day === LOOP.windowDays ? 900 : 700, `Day ${day} of ${LOOP.windowDays} on ${LOOP.platform}`, { progress: day / LOOP.windowDays }));
  add(2, 1000, `More views: keep ${round.winner.toUpperCase()}`, { won: true });
  add(2, 900, 'Waiting for your OK', { asked: true });
  add(2, 700, 'Approved', { approved: true });
  add(2, 2600, 'Every new clip starts from it', { rule: true });
  return steps;
}

const routineAt = (pred) => routineSteps().findIndex(pred);
const routineDuration = (card) => routineSteps().filter((s) => s.card === card).reduce((sum, s) => sum + s.ms, 0);
const routineNote = (card) => routineSteps().filter((s) => s.card === card).at(-1).note;

/** One card's picture, in its finished state; data-at / data-off name the step that turns each part on or off. */
export function routineMarkup(card) {
  const k = ROUTINE.cards.indexOf(card);
  if (k < 0) throw new Error(`Unknown routine card: ${card}`);
  const n = stretchCount();
  const round = LOOP.rounds[0];
  let stage = '', row = '';
  if (card === 'tonight') {
    const saved = routineAt((s) => s.saved);
    const found = routineAt((s) => s.scouts >= n);
    const segments = Array.from({ length: n }, (_, i) => `<li class="is-on" data-at="${routineAt((s) => s.scouts > i)}"></li>`).join('');
    const marks = swarmPicks().map((p) => `<span class="routine-mark is-on" data-at="${found}" style="--x:${((p.stretch + SWARM.ideas[p.stretch][p.idea][1]) / n).toFixed(3)}"></span>`).join('');
    stage = `${img(ROUTINE.stream)}<span class="routine-badge routine-live is-off" data-off="${saved}"><i></i>Live <b data-set="timer">${ROUTINE.timer.at(-1)}</b></span><span class="routine-badge routine-file is-on" data-at="${saved}">${esc(SWARM.file)}</span>`;
    row = `<div class="routine-scan"><ol>${segments}</ol>${marks}</div>`;
  } else if (card === 'tomorrow') {
    const shown = routineAt((s) => s.shown), posted = routineAt((s) => s.posted);
    const clips = SWARM.clips.map((c, i) => {
      const keep = ROUTINE.kept[i];
      return `<li class="routine-clip is-on${keep ? '' : ' is-skipped'}" data-at="${shown}">${img(c.photo)}<span class="routine-pick is-on" data-at="${routineAt((s) => s.picked > i)}">${keep ? 'Kept' : 'Skipped'}</span>${keep ? `<span class="routine-posted is-on" data-at="${posted}">Posted</span>` : ''}</li>`;
    }).join('');
    stage = `<ol class="routine-clips">${clips}</ol>`;
    row = `<ul class="routine-chips">${ROUTINE.platforms.map((p) => `<li class="is-on" data-at="${posted}">${p}</li>`).join('')}</ul>`;
  } else {
    const top = Math.max(round.a.stats.views, round.b.stats.views);
    const side = (key) => {
      const v = round[key];
      const win = round.winner === key;
      return `<div class="routine-ab${win ? ' is-winner' : ''}"><span class="routine-letter">${key.toUpperCase()}</span><span class="routine-hook">${esc(v.label)}</span><span class="routine-views"><b data-set="${key}">${fmt(v.stats.views)}</b> views</span><span class="routine-bar"><i style="--share:${(v.stats.views / top).toFixed(3)}"></i></span>${win ? `<span class="routine-win is-on" data-at="${routineAt((s) => s.won)}">Winner</span>` : ''}</div>`;
    };
    const ask = routineAt((s) => s.asked), ok = routineAt((s) => s.approved);
    stage = `<div class="routine-test"><p class="routine-meta">${LOOP.platform}, ${LOOP.windowDays} days</p>${side('a')}${side('b')}<span class="routine-btn is-on" data-at="${ask}"><span>Approve</span><span class="routine-ok is-on" data-at="${ok}">Approved</span></span></div>`;
    row = `<p class="routine-rule is-on" data-at="${routineAt((s) => s.rule)}"><span>New rule</span>${esc(round.lesson)}</p>`;
  }
  return `<div class="scene routine-scene routine-${card}"><span class="routine-progress" style="--dur:${routineDuration(k)}ms"></span><div class="routine-stage">${stage}</div>${row}<p class="routine-note" data-note>${esc(routineNote(k))}</p></div>`;
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
      rounds.forEach((el, k) => {
        toggle(el, 'is-now', k === s.round);
        const share = k === s.round ? s.progress : 1;
        for (const dd of el.querySelectorAll('[data-stat]')) dd.textContent = fmt(Number(dd.dataset.stat) * share);
      });
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

export function learnScene(root) {
  const steps = learnSteps();
  const weeks = [...root.querySelectorAll('.week')];
  const rules = [...root.querySelectorAll('.rule')];
  const status = root.querySelector('[data-status]');
  const views = root.querySelector('[data-learn-views]');
  const kept = root.querySelector('[data-learn-kept]');
  const version = root.querySelector('[data-learn-version]');
  return {
    steps,
    render(i) {
      const s = steps[i];
      weeks.forEach((el, k) => { toggle(el, 'is-done', k < s.week); toggle(el, 'is-now', !s.done && k === s.week - 1); });
      let on = 0;
      rules.forEach((el, k) => {
        const rule = LEARN.rules[k];
        toggle(el, 'is-on', rule.week <= s.week);
        toggle(el, 'is-new', !s.done && rule.week === s.week);
        if (rule.week <= s.week) on++;
      });
      if (views) views.textContent = fmt(LEARN.views[s.week - 1]);
      if (kept) kept.textContent = `${LEARN.kept[s.week - 1]} of 10`;
      if (version) version.textContent = `v${on + 1}`;
      if (status) status.textContent = s.status;
    },
  };
}

export function routineScene(root) {
  const steps = routineSteps();
  const round = LOOP.rounds[0];
  const cards = [...root.querySelectorAll('[data-card]')];
  const notes = cards.map((card) => card.querySelector('[data-note]'));
  const finals = ROUTINE.cards.map((_, k) => routineNote(k));
  const ons = [...root.querySelectorAll('[data-at]')];
  const offs = [...root.querySelectorAll('[data-off]')];
  const sets = [...root.querySelectorAll('[data-set]')];
  return {
    steps,
    render(i) {
      const s = steps[i];
      const values = { timer: s.timer, a: fmt(round.a.stats.views * s.progress), b: fmt(round.b.stats.views * s.progress) };
      ons.forEach((el) => toggle(el, 'is-on', i >= Number(el.dataset.at)));
      offs.forEach((el) => toggle(el, 'is-off', i >= Number(el.dataset.off)));
      sets.forEach((el) => { el.textContent = values[el.dataset.set]; });
      cards.forEach((el, k) => { toggle(el, 'is-now', k === s.card); toggle(el, 'is-done', k < s.card); });
      notes.forEach((el, k) => { if (el) el.textContent = k === s.card ? s.note : k < s.card ? finals[k] : ROUTINE.idle[k]; });
      root.style.setProperty('--ab', String(s.progress));
    },
  };
}

const SCENES = { swarm: swarmScene, loop: loopScene, learn: learnScene, routine: routineScene };

/** Plays a scene while it is on screen and the tab is visible. Reduced motion shows the finished frame. */
export function mountScene({ root, scene, media = window.matchMedia.bind(window), lifecycle = window, doc = document, observe, timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) } }) {
  const motion = media('(prefers-reduced-motion: reduce)');
  const last = scene.steps.length - 1;
  let step = 0, visible = false, timer = null, disposed = false, started = false;
  const live = () => !disposed && !motion.matches;
  const running = () => live() && visible && !doc.hidden;
  const schedule = () => {
    if (timer !== null) { timers.clear(timer); timer = null; }
    if (!running()) return;
    if (!started) { started = true; step = 0; scene.render(0); }
    timer = timers.set(() => { timer = null; step = step === last ? 0 : step + 1; scene.render(step); schedule(); }, scene.steps[step].ms);
  };
  const sync = () => {
    if (live()) root.classList.add('is-live');
    else { root.classList.remove('is-live'); started = false; step = last; scene.render(last); }
    schedule();
  };
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
    motion.removeEventListener('change', sync);
    doc.removeEventListener('visibilitychange', onVisibility);
    lifecycle.removeEventListener('pagehide', onHide);
    root.classList.remove('is-live');
    scene.render(last);
  };
  motion.addEventListener('change', sync);
  doc.addEventListener('visibilitychange', onVisibility);
  lifecycle.addEventListener('pagehide', onHide);
  sync();
  return { dispose, get step() { return step; } };
}

if (typeof document !== 'undefined') {
  for (const root of document.querySelectorAll('[data-scene]')) {
    const make = SCENES[root.dataset.scene];
    if (make) mountScene({ root, scene: make(root) });
  }
}
