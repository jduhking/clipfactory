/**
 * Animated illustrations of the app's growth loop, drawn to match what the app does.
 *
 * The hero (`loop`) follows the app's own learning-loop demo beat for beat (LearningLoopDemo.tsx,
 * flowEvents.ts STATIONS): footage in, listen and watch, the scout swarm, the Editor, the Critic
 * picking the best three, your approval, posting, the measurement window, the Strategist, and a
 * new Style rule that the Editor uses on the next batch. Each finished loop leaves a contour ring
 * behind, so the terrain around the factory visibly grows.
 *
 * The station scenes (`understand`, `cut`, `judge`, `post`, `learn`) are the app's five stage
 * families: Understand, Create, Judge, Ship and Learn.
 *
 * Honesty rules the tests enforce: these are diagrams, not product UI and not results. No numbers
 * are drawn. An unreported result is unavailable, never zero, so it is drawn as an empty outline.
 * Nothing reaches a channel before the approval gate. Platforms are named in text, with no logos.
 *
 * Restraint, same as the WebGL field: 30 fps at most, device pixel ratio capped at 1.5, asleep
 * offscreen or in a hidden tab, a meaningful still frame per scene under reduced motion, no canvas
 * in forced colors, and a manual pause control.
 */
import { contourSegments, STILL_AT } from './terrain.js?v=pearl-streamer-6';

const MAX_DPR = 1.5;
const FRAME_MS = 1000 / 30;
/** The backdrop field drifts slowly, so its grid is rebuilt a few times a second at most. */
const CONTOUR_MS = 125;
/** Switching stations crossfades, quickly: it is a state change, not a show. */
const FADE_MS = 320;
const INK = '#ececec';
const VIOLET = '#a75de3';
const VIOLET_SOFT = '#af85f3';
const ACCENT = '#d2acf7';
const LINE = '#2c2c2c';
const SURFACE = '#191919';
const MUTED = '#8a8a8a';
const PINE = '#6fcf97';
const DEG = Math.PI / 180;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
/** Settles into place with a small overshoot: the agent has weight. */
const easeOutBack = (v, pull = 1.7) => { const x = clamp01(v) - 1; return 1 + (pull + 1) * x * x * x + pull * x * x; };
const easeOutCubic = (v) => { const x = 1 - clamp01(v); return 1 - x * x * x; };
const easeInOutCubic = (v) => { const x = clamp01(v); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
const mix = (a, b, v) => a + (b - a) * v;
/** How far a clock is between two moments, 0 before and 1 after. */
const span = (t, from, to) => clamp01((t - from) / (to - from));
/** Position in a repeating cycle, so every scene is a pure function of its clock. */
const cycle = (t, period, offset = 0) => { const v = (t / period + offset) % 1; return v < 0 ? v + 1 : v; };
/** A deterministic wobble: the scenes never use random numbers, so stills are reproducible. */
const wobble = (i, t, speed = 1) => Math.sin(i * 1.7 + t * speed) * 0.5 + Math.sin(i * 0.9 - t * speed * 0.6) * 0.5;
/** Alpha multiplies whatever is already set, so a crossfade dims a whole scene at once. */
const baseAlpha = (ctx) => (typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1);

function path(ctx, { stroke, fill, width = 1, alpha = 1, dash, dashOffset = 0, shadow = 0 }, draw) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = baseAlpha(ctx) * Math.min(1, alpha);
  if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOffset; }
  if (shadow) { ctx.shadowBlur = shadow; ctx.shadowColor = stroke || fill || VIOLET; }
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  draw();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
}

function box(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

/** Small word labels only. Nothing numeric is ever drawn: no invented metrics. */
function label(ctx, text, x, y, { size = 10, color = MUTED, align = 'left', weight = 500, alpha = 1 } = {}) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = baseAlpha(ctx) * 0.92 * Math.min(1, alpha);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${size}px "Instrument Sans Variable", system-ui, sans-serif`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function backdrop(ctx, s) {
  for (const line of s.contours) {
    path(ctx, { stroke: INK, width: line.major ? 1.5 : 1, alpha: line.major ? 0.17 : 0.09 }, () => {
      for (const [x1, y1, x2, y2] of line.segments) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    });
  }
}

/** A violet glow, used where a stage is doing work. */
function glow(ctx, x, y, r, alpha = 0.5) {
  if (alpha <= 0.002 || !(r > 0)) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, VIOLET);
  gradient.addColorStop(1, 'rgba(167,93,227,0)');
  ctx.save();
  ctx.globalAlpha = baseAlpha(ctx) * Math.min(1, alpha);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/**
 * A 9:16 clip card, styled like a streamer's short: the speaker in frame, bold word-by-word
 * captions with the spoken word lit, and, once a Style rule asks for it, a hook title up top.
 */
function clipTile(ctx, x, y, h, { alpha = 1, lit = false, done = false, tilt = 0, squash = 1, hook = false, t = 0 } = {}) {
  if (alpha <= 0.002) return;
  const w = h * 0.5625;
  ctx.save();
  ctx.translate(x, y);
  if (tilt) ctx.rotate(tilt);
  if (squash !== 1) ctx.scale(1 / squash, squash);
  path(ctx, { fill: SURFACE, stroke: lit ? VIOLET : LINE, width: 1.2, alpha, shadow: lit ? 10 : 0 }, () => box(ctx, -w / 2, -h / 2, w, h, h * 0.07));
  // The speaker, framed.
  path(ctx, { fill: MUTED, alpha: alpha * 0.16 }, () => ctx.arc(0, -h * 0.08, w * 0.22, 0, Math.PI * 2));
  path(ctx, { fill: MUTED, alpha: alpha * 0.1 }, () => box(ctx, -w * 0.34, h * 0.06, w * 0.68, h * 0.2, w * 0.3));
  // Bold captions, word by word: one word is lit as it is spoken.
  const word = Math.floor(cycle(t, 1.2) * 3);
  [-0.3, -0.04, 0.2].forEach((at, i) => {
    const on = lit && i === word;
    path(ctx, { fill: on ? ACCENT : INK, alpha: alpha * (on ? 0.95 : 0.55) }, () => box(ctx, w * at, h * 0.3, w * 0.22, h * 0.05, h * 0.02));
  });
  if (hook) path(ctx, { fill: ACCENT, alpha: alpha * 0.9 }, () => box(ctx, -w * 0.34, -h * 0.4, w * 0.68, h * 0.07, h * 0.025));
  if (done) {
    path(ctx, { stroke: PINE, width: 1.8, alpha, shadow: 6 }, () => {
      ctx.moveTo(-w * 0.12, -h * 0.08);
      ctx.lineTo(-w * 0.02, h * 0.02);
      ctx.lineTo(w * 0.16, -h * 0.2);
    });
  }
  ctx.restore();
}

/**
 * The agent: a bright core with a soft shell, a comet trail behind it, and a tether it drops
 * into the recording when it takes a clip out.
 */
function agent(ctx, x, y, r, { alpha = 1, heading = 0, speed = 0, working = false, t = 0 } = {}) {
  for (let i = 6; i >= 1; i -= 1) {
    const back = i * r * 0.9 * Math.min(1, speed);
    if (back < 0.5) continue;
    path(ctx, { fill: VIOLET, alpha: alpha * 0.07 * (1 - i / 7) * Math.min(1, speed) }, () =>
      ctx.arc(x - Math.cos(heading) * back, y - Math.sin(heading) * back, r * (1 - i * 0.08), 0, Math.PI * 2));
  }
  glow(ctx, x, y, r * 4.5, alpha * (working ? 0.5 : 0.32));
  path(ctx, { stroke: VIOLET_SOFT, width: 1.3, alpha: alpha * 0.8, dash: [3, 4], dashOffset: -t * 20 }, () => ctx.arc(x, y, r * 1.9, 0, Math.PI * 2));
  path(ctx, { fill: SURFACE, stroke: ACCENT, width: 1.4, alpha }, () => ctx.arc(x, y, r, 0, Math.PI * 2));
  path(ctx, { fill: ACCENT, alpha: alpha * (working ? 1 : 0.75), shadow: 12 }, () => ctx.arc(x, y, r * 0.42, 0, Math.PI * 2));
}

/** A tick, drawn when you approve something. */
function tick(ctx, x, y, r, alpha = 1) {
  path(ctx, { stroke: PINE, width: Math.max(1.6, r * 0.28), alpha, shadow: 8 }, () => {
    ctx.moveTo(x - r * 0.55, y);
    ctx.lineTo(x - r * 0.12, y + r * 0.42);
    ctx.lineTo(x + r * 0.62, y - r * 0.5);
  });
}

/** A stream recording: a waveform in a rounded strip, with a playhead. */
function recording(ctx, x, y, w, h, { alpha = 1, head = -1, bars = 44, seed = 0 } = {}) {
  path(ctx, { fill: SURFACE, stroke: LINE, width: 1.2, alpha: alpha * 0.96 }, () => box(ctx, x, y, w, h, Math.min(8, h * 0.3)));
  for (let i = 0; i < bars; i += 1) {
    const at = i / (bars - 1);
    const bx = x + w * (0.03 + at * 0.94);
    const amp = 0.2 + 0.8 * Math.abs(wobble(i * 0.55 + seed, 0, 1));
    const played = head >= 0 && at <= head;
    path(ctx, { stroke: played ? VIOLET_SOFT : INK, width: 1.6, alpha: alpha * (played ? 0.75 : 0.32) }, () => {
      ctx.moveTo(bx, y + h / 2 - h * 0.36 * amp);
      ctx.lineTo(bx, y + h / 2 + h * 0.36 * amp);
    });
  }
  if (head >= 0 && head <= 1) {
    const hx = x + w * (0.03 + head * 0.94);
    path(ctx, { stroke: ACCENT, width: 1.6, alpha, shadow: 10 }, () => { ctx.moveTo(hx, y - h * 0.18); ctx.lineTo(hx, y + h * 1.18); });
  }
}

/* ---------------------------------------------------------------------------------------------
 * The hero: one loop of the factory, orbiting the real app screenshot.
 * ------------------------------------------------------------------------------------------- */

/** One loop, in seconds. Beats copy the app's learning-loop demo, in order. */
export const LOOP_PERIOD = 20;
/** Loops before the growth rings settle back and the run starts again. */
export const LOOP_RUN = 4;
export const FAMILIES = ['Understand', 'Create', 'Judge', 'Ship', 'Learn'];
export const LOOP_BEATS = [
  { at: 0, family: 0, caption: 'Footage in' },
  { at: 1.6, family: 0, caption: 'Listening and watching' },
  { at: 3.4, family: 1, caption: 'Scout swarm finds moments' },
  { at: 5.2, family: 1, caption: 'Editor cuts every clip' },
  { at: 7.0, family: 2, caption: 'Critic picks the best three' },
  { at: 9.0, family: 2, caption: 'You approve each one' },
  { at: 10.6, family: 3, caption: 'Posted to your channels' },
  { at: 12.4, family: 3, caption: 'Results come back' },
  { at: 14.4, family: 4, caption: 'The Strategist learns' },
  { at: 16.4, family: 4, caption: 'A new Style rule for the next batch' },
  { at: 18.2, family: 4, caption: 'The next loop starts' },
];
const FAMILY_AT = [0, 3.4, 7.0, 10.6, 14.4, LOOP_PERIOD];

/** Stations on the orbit, in the order the app wires them: Critic, post, measure, Strategist, Editor. */
const STATION = {
  editor: { angle: 160 * DEG, name: 'Editor', family: 1 },
  critic: { angle: 117 * DEG, name: 'Critic', family: 2 },
  approve: { angle: 72 * DEG, name: 'You approve', family: 2 },
  post: { angle: 24 * DEG, name: 'Post', family: 3 },
  measure: { angle: -32 * DEG, name: 'Measure', family: 3 },
  strategist: { angle: -148 * DEG, name: 'Strategist', family: 4 },
};
const PORTALS = [
  { name: 'TikTok', angle: 40 * DEG, reports: true },
  { name: 'Reels', angle: 12 * DEG, reports: true },
  { name: 'Shorts', angle: -16 * DEG, reports: false },
];
/** Five clips are cut; the Critic keeps the best three. */
const KEPT = [0, 2, 4];

export function loopState(t) {
  const lt = ((t % LOOP_PERIOD) + LOOP_PERIOD) % LOOP_PERIOD;
  const n = Math.floor(t / LOOP_PERIOD);
  let beat = 0;
  for (let i = 0; i < LOOP_BEATS.length; i += 1) if (lt >= LOOP_BEATS[i].at) beat = i;
  const family = LOOP_BEATS[beat].family;
  const progress = span(lt, FAMILY_AT[family], FAMILY_AT[family + 1]);
  return { lt, n, beat, family, progress, loop: (((n % LOOP_RUN) + LOOP_RUN) % LOOP_RUN) + 1 };
}

function loopGeometry(s) {
  const { w, h } = s;
  const app = s.app && s.app.w > 0 ? s.app : { x: w * 0.22, y: h * 0.1, w: w * 0.56, h: w * 0.56 * 0.5625 };
  // On a phone the app fills the width, so the orbit hangs below it instead of around it.
  const narrow = app.w > w * 0.75;
  const cx = app.x + app.w / 2;
  const rx = narrow ? w * 0.4 : Math.min(w * 0.4, Math.max(app.w * 0.7, w * 0.3));
  const ry = narrow ? Math.max(rx * 0.3, h * 0.1) : Math.max(rx * 0.24, h * 0.1);
  const cy = narrow ? app.y + app.h + ry * 1.15 : app.y + app.h * 0.72;
  return { w, h, app, cx, cy, rx, ry, narrow, unit: Math.max(6, Math.min(w, h * 1.6) * 0.012) };
}

/** A point on the orbit, or on a wider ring around it. Front means nearer than the app. */
function onOrbit(g, angle, grow = 1) {
  const sin = Math.sin(angle);
  return { x: g.cx + g.rx * grow * Math.cos(angle), y: g.cy + g.ry * grow * sin, front: sin >= 0, scale: mix(0.72, 1.12, (sin + 1) / 2) };
}

function portalAt(g, portal) {
  if (g.narrow) {
    const i = PORTALS.indexOf(portal);
    return { x: g.cx + (i - 1) * g.w * 0.28, y: g.cy + g.ry * 1.7, front: true, scale: 1 };
  }
  const p = onOrbit(g, portal.angle, 1.3);
  return { ...p, x: Math.min(p.x, g.w - g.unit * 4.5) };
}

/** Growth rings: wobbly survey contours laid around the factory, one per finished loop. */
function growthRing(ctx, g, grow, t, i, alpha, fresh) {
  path(ctx, { stroke: fresh ? VIOLET_SOFT : INK, width: fresh ? 1.6 : 1.1, alpha, shadow: fresh ? 12 : 0 }, () => {
    for (let k = 0; k <= 96; k += 1) {
      const a = (k / 96) * Math.PI * 2;
      const r = grow * (1 + 0.03 * Math.sin(a * 5 + i * 1.3 + t * 0.25) + 0.018 * Math.sin(a * 9 - i - t * 0.18));
      const x = g.cx + g.rx * r * Math.cos(a);
      const y = g.cy + g.ry * r * Math.sin(a);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  });
}

function orbitArc(ctx, g, front, t, alpha) {
  const from = front ? 0 : Math.PI;
  path(ctx, { stroke: INK, width: 1.1, alpha: alpha * (front ? 0.34 : 0.2), dash: [2, 7], dashOffset: t * 9 }, () => {
    for (let k = 0; k <= 48; k += 1) {
      const a = from + (k / 48) * Math.PI;
      const x = g.cx + g.rx * Math.cos(a);
      const y = g.cy + g.ry * Math.sin(a);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  });
}

function stationNode(ctx, g, station, active, t) {
  const p = onOrbit(g, station.angle);
  const r = g.unit * 1.05 * p.scale;
  if (active > 0) glow(ctx, p.x, p.y, r * 6, 0.45 * active);
  path(ctx, { fill: SURFACE, stroke: active > 0.3 ? ACCENT : LINE, width: 1.4, alpha: 0.98 }, () => ctx.arc(p.x, p.y, r, 0, Math.PI * 2));
  path(ctx, { fill: active > 0.3 ? ACCENT : MUTED, alpha: 0.45 + 0.55 * active, shadow: active > 0.3 ? 10 : 0 }, () => ctx.arc(p.x, p.y, r * 0.38, 0, Math.PI * 2));
  if (active > 0.3) path(ctx, { stroke: VIOLET_SOFT, width: 1.2, alpha: 0.7 * active, dash: [3, 4], dashOffset: -t * 18 }, () => ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2));
  const below = p.front || Math.abs(Math.cos(station.angle)) > 0.6;
  label(ctx, station.name, p.x, p.y + (below ? r * 2.6 : -r * 2.6), { align: 'center', size: Math.max(10, g.unit * 1.15), color: active > 0.3 ? INK : MUTED, weight: active > 0.3 ? 600 : 500 });
}

function loop(ctx, s) {
  const g = loopGeometry(s);
  const { t } = s;
  const state = loopState(t);
  const { lt, n } = state;
  const run = ((n % LOOP_RUN) + LOOP_RUN) % LOOP_RUN;
  const back = s.layer !== 'front';
  const front = s.layer !== 'back';
  const U = g.unit;
  const at = (a, b) => span(lt, a, b);
  const activeFor = (from, to) => Math.min(ease((lt - from) / 0.35), 1 - ease((lt - to) / 0.35));
  const layerOf = (p) => (p.front ? front : back);
  // The Style rule changes the next batch: from the second loop on, clips open on a hook title.
  const hook = run > 0;

  if (back) {
    // The ground: rings from every finished loop, and the one this loop is about to add.
    for (let i = 0; i < LOOP_RUN; i += 1) {
      const grow = 1.2 + 0.17 * i;
      let alpha = 0;
      let size = grow;
      if (i < run) alpha = 0.2;
      if (i === run) { const birth = easeOutCubic(at(18.2, 19.8)); alpha = 0.34 * birth; size = mix(1, grow, birth); }
      // A new run: last run's rings melt back into the terrain while the footage comes in.
      if (run === 0 && n > 0 && i > 0) alpha = Math.max(alpha, 0.2 * (1 - ease(lt / 2.4)));
      if (alpha > 0) growthRing(ctx, g, size, t, i, alpha, i === run && lt > 18.2);
    }
    glow(ctx, g.cx, g.cy, g.rx * 0.9, 0.12);
    orbitArc(ctx, g, false, t, 1);
    // Footage in: the stream recording slides into the factory, behind the app.
    const feed = at(0, 2.2);
    const fade = Math.min(ease(lt / 0.4), 1 - ease((lt - 2.4) / 0.6));
    if (fade > 0) {
      const sw = Math.min(g.w * 0.34, Math.max(g.app.x + g.app.w * 0.3, g.w * 0.2));
      const sh = Math.max(U * 3.4, g.app.h * 0.13);
      // On a phone the app covers the width, so the footage slides in under it rather than behind.
      const sx = mix(-sw * 0.9, g.narrow ? g.cx - sw / 2 : g.app.x + g.app.w * 0.32 - sw, easeInOutCubic(feed));
      const sy = g.narrow ? g.app.y + g.app.h + U * 2.6 : g.app.y + g.app.h * 0.3;
      recording(ctx, sx, sy, sw, sh, { alpha: fade, head: feed, seed: run });
      label(ctx, 'Your stream', Math.max(U, sx + U * 0.4), sy - U * 1.4, { size: Math.max(10, U * 1.15), color: INK, alpha: fade });
    }
  }
  if (front) orbitArc(ctx, g, true, t, 1);

  // Stations, each lit while it works.
  const lit = {
    editor: Math.max(activeFor(4.6, 7.0), activeFor(17.6, 18.6)),
    critic: activeFor(7.0, 9.0),
    approve: activeFor(9.0, 10.8),
    post: activeFor(10.6, 12.2),
    measure: activeFor(12.4, 14.6),
    strategist: activeFor(14.2, 16.8),
  };
  for (const [id, station] of Object.entries(STATION)) {
    const p = onOrbit(g, station.angle);
    if (layerOf(p)) stationNode(ctx, g, station, lit[id], t);
  }

  // Listening and watching: a scan passes over the real app.
  if (front) {
    const scan = at(1.6, 3.4);
    if (scan > 0 && scan < 1) {
      const y = g.app.y + g.app.h * easeInOutCubic(scan);
      const a = Math.sin(Math.PI * scan);
      path(ctx, { fill: VIOLET, alpha: 0.1 * a }, () => box(ctx, g.app.x, g.app.y, g.app.w, y - g.app.y, 6));
      path(ctx, { stroke: ACCENT, width: 1.5, alpha: 0.75 * a, shadow: 14 }, () => { ctx.moveTo(g.app.x, y); ctx.lineTo(g.app.x + g.app.w, y); });
    }
  }

  // The scout swarm flies out of the factory, finds moments, and brings them to the Editor.
  const swarm = at(3.4, 5.4);
  if (swarm > 0 && swarm < 1) {
    const origin = { x: g.cx, y: g.app.y + g.app.h * 0.55 };
    const ed = onOrbit(g, STATION.editor.angle);
    for (let k = 0; k < 6; k += 1) {
      const spot = onOrbit(g, (196 - k * 34) * DEG, 1.08);
      const out = easeOutCubic(span(swarm, k * 0.03, 0.42 + k * 0.03));
      const home = easeInOutCubic(span(swarm, 0.62, 0.95));
      const hover = swarm > 0.42 && swarm < 0.66 ? wobble(k, t * 3, 2) * U * 0.5 : 0;
      const x = mix(mix(origin.x, spot.x, out), ed.x, home);
      const y = mix(mix(origin.y, spot.y, out), ed.y, home) + hover;
      const p = { front: y >= g.cy - g.ry * 0.2 };
      if (!layerOf(p)) continue;
      const alpha = Math.min(ease(swarm / 0.08), 1 - ease((swarm - 0.9) / 0.1));
      if (out > 0.95 && home < 0.05) glow(ctx, spot.x, spot.y, U * 3, 0.4 * alpha);
      agent(ctx, x, y, U * 0.55, { alpha, heading: Math.atan2(y - origin.y, x - origin.x), speed: out < 1 || home > 0 ? 0.9 : 0, working: home < 0.05 && out > 0.9, t });
    }
  }

  // The batch: five clips cut by the Editor, judged by the Critic, approved by you, then posted.
  const ed = STATION.editor.angle;
  for (let k = 0; k < 5; k += 1) {
    const kept = KEPT.indexOf(k);
    const born = 5.2 + k * 0.28;
    if (lt < born) continue;
    let angle = mix(ed, (150 - k * 8) * DEG, easeOutCubic(at(born, born + 0.9)));
    let alpha = ease(at(born, born + 0.3));
    let lift = 0;
    let done = false;
    let size = 1;
    let litCard = false;
    // The Critic's beam passes each clip; two are left behind.
    const judged = at(7.4 + k * 0.22, 7.7 + k * 0.22);
    if (kept < 0) {
      const drop = ease(at(8.5, 9.3));
      lift = drop * U * 3;
      alpha *= 1 - drop;
      if (alpha <= 0.01) continue;
    } else {
      litCard = judged > 0.5;
      const slot = [86, 72, 58][kept] * DEG;
      angle = mix(angle, slot, easeInOutCubic(at(9.0, 9.8)));
      done = lt > 9.9 + kept * 0.28;
      const go = 10.6 + kept * 0.22;
      angle = mix(angle, STATION.post.angle, easeInOutCubic(at(go, go + 0.6)));
      const portal = portalAt(g, PORTALS[kept]);
      const fly = easeInOutCubic(at(go + 0.6, go + 1.2));
      if (fly >= 1) continue;
      if (fly > 0) {
        const from = onOrbit(g, STATION.post.angle);
        const x = mix(from.x, portal.x, fly);
        const y = mix(from.y, portal.y, fly) - Math.sin(Math.PI * fly) * U * 3;
        if (front) clipTile(ctx, x, y, U * 7 * mix(1, 0.35, fly), { alpha, lit: true, done: true, hook, t, tilt: (portal.y - from.y) * 0.002 * fly });
        continue;
      }
    }
    const p = onOrbit(g, angle);
    if (!layerOf(p)) continue;
    const pop = easeOutBack(at(born, born + 0.45));
    size = p.scale * mix(0.4, 1, pop);
    if (judged > 0 && judged < 1) glow(ctx, p.x, p.y - U * 3.5, U * 5, 0.35 * Math.sin(Math.PI * judged));
    clipTile(ctx, p.x, p.y - U * 3.6 + lift, U * 7 * size, { alpha, lit: litCard, done, hook, t, tilt: kept < 0 ? lift * 0.01 : 0 });
  }

  // The Critic's beam, sweeping the queue.
  if (front) {
    const sweep = at(7.3, 8.6);
    if (sweep > 0 && sweep < 1) {
      const c = onOrbit(g, STATION.critic.angle);
      const target = onOrbit(g, mix(150, 118, sweep) * DEG);
      path(ctx, { fill: VIOLET, alpha: 0.14 * Math.sin(Math.PI * sweep) }, () => {
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(target.x - U * 2.6, target.y - U * 7.6);
        ctx.lineTo(target.x + U * 2.6, target.y - U * 7.6);
        ctx.closePath();
      });
    }
    // The approval gate: it pulses until all three are yours, then it opens.
    const gate = onOrbit(g, STATION.approve.angle);
    const waiting = at(9.0, 10.6);
    if (waiting > 0 && waiting < 1) {
      const all = lt > 10.5;
      const pulse = Math.sin(Math.PI * cycle(t, 1.1)) ** 2;
      path(ctx, { stroke: all ? PINE : VIOLET_SOFT, width: 1.6, alpha: 0.8 * Math.sin(Math.PI * waiting) + 0.2, shadow: 10 * pulse }, () =>
        ctx.arc(gate.x, gate.y, U * (2.2 + 0.4 * pulse), 0, Math.PI * 2));
      if (all) tick(ctx, gate.x, gate.y, U * 1.1);
    }
    // Channels: names only, no logos. A clip arriving makes the channel ripple.
    PORTALS.forEach((portal, i) => {
      const p = portalAt(g, portal);
      const arrive = 10.6 + i * 0.22 + 1.2;
      const shown = Math.min(ease(at(10.2, 10.8)), 1 - ease(at(14.4, 15.2)));
      if (shown <= 0) return;
      const r = U * 1.6;
      const hit = at(arrive, arrive + 1.4);
      path(ctx, { fill: SURFACE, stroke: hit > 0 ? VIOLET_SOFT : LINE, width: 1.4, alpha: shown }, () => ctx.arc(p.x, p.y, r, 0, Math.PI * 2));
      if (hit > 0 && hit < 1) {
        for (const lag of [0, 0.25]) {
          const ripple = easeOutCubic(clamp01((hit - lag) / (1 - lag)));
          path(ctx, { stroke: ACCENT, width: 1.3, alpha: shown * 0.8 * (1 - ripple) }, () => ctx.arc(p.x, p.y, r * (1 + ripple * 2.6), 0, Math.PI * 2));
        }
      }
      label(ctx, portal.name, p.x, p.y + r + U * 1.5, { align: 'center', size: Math.max(10, U * 1.15), color: hit > 0 ? INK : MUTED, weight: 600, alpha: shown });
      // Results: a channel that has not reported stays an empty dashed outline, never a zero.
      const measuring = at(12.4, 14.4);
      if (!portal.reports && measuring > 0) {
        path(ctx, { stroke: MUTED, width: 1.2, alpha: shown * 0.8, dash: [3, 4] }, () => ctx.arc(p.x, p.y, r * 1.9, 0, Math.PI * 2));
        label(ctx, 'No report yet', p.x, p.y + r + U * 3.1, { align: 'center', size: Math.max(9, U), color: MUTED, alpha: shown * ease(measuring * 4) });
      }
    });
  }

  // Results come back from the channels that reported, through Measure to the Strategist.
  const m = onOrbit(g, STATION.measure.angle);
  for (const [i, portal] of PORTALS.entries()) {
    if (!portal.reports) continue;
    const p = portalAt(g, portal);
    for (let k = 0; k < 4; k += 1) {
      const start = 12.5 + i * 0.3 + k * 0.14;
      const home = easeInOutCubic(at(start, start + 0.9));
      const along = easeInOutCubic(at(start + 1.0, start + 2.4));
      if (home <= 0 || along >= 1) continue;
      let x;
      let y;
      let near;
      if (along <= 0) {
        x = mix(p.x, m.x, home);
        y = mix(p.y, m.y, home) - Math.sin(Math.PI * home) * U * 2;
        near = true;
      } else {
        const q = onOrbit(g, mix(STATION.measure.angle, STATION.strategist.angle, along));
        x = q.x; y = q.y; near = q.front || Math.abs(x - g.cx) > g.app.w / 2;
      }
      if (near ? !front : !back) continue;
      glow(ctx, x, y, U * 2.2, 0.35);
      path(ctx, { fill: ACCENT, alpha: 0.95, shadow: 10 }, () => ctx.arc(x, y, U * 0.32, 0, Math.PI * 2));
    }
  }

  // The Strategist forms a belief, then sends a Style rule round to the Editor.
  const st = onOrbit(g, STATION.strategist.angle);
  const belief = Math.min(easeOutBack(at(14.8, 15.4)), 1 - ease(at(16.6, 17.0)));
  if (front && belief > 0.01) {
    const bw = U * 9;
    const bh = U * 4.6;
    // The card never covers the screenshot: beside the app on wide stages, under the node on a phone.
    const bx = g.narrow ? Math.max(U, st.x - bw * 0.5) : Math.max(U, Math.min(st.x - bw * 0.5, g.app.x - bw - U));
    const by = g.narrow ? st.y + U * 4.4 : st.y - U * 3 - bh * belief;
    path(ctx, { fill: SURFACE, stroke: VIOLET_SOFT, width: 1.2, alpha: belief, shadow: 10 }, () => box(ctx, bx, by, bw, bh, U * 0.7));
    label(ctx, 'Belief', bx + U, by + U * 1.2, { size: Math.max(10, U * 1.1), color: INK, weight: 600, alpha: belief });
    [0.78, 0.52, 0.3].forEach((len, i) => path(ctx, { fill: i ? MUTED : ACCENT, alpha: belief * (i ? 0.4 : 0.9) }, () => box(ctx, bx + U, by + U * (2.3 + i * 0.75), (bw - U * 2) * len * ease(at(15.0 + i * 0.15, 15.6 + i * 0.15)), U * 0.36, U * 0.18)));
  }
  const ruleRun = easeInOutCubic(at(16.6, 17.8));
  if (ruleRun > 0 && lt < 18.2) {
    const angle = mix(STATION.strategist.angle + Math.PI * 2, STATION.editor.angle, ruleRun);
    const q = onOrbit(g, angle);
    if (layerOf(q)) {
      const pw = U * 7;
      const ph = U * 2;
      const alpha = 1 - ease(at(17.9, 18.2));
      glow(ctx, q.x, q.y, U * 4, 0.4 * alpha);
      path(ctx, { fill: SURFACE, stroke: ACCENT, width: 1.3, alpha, shadow: 12 }, () => box(ctx, q.x - pw / 2, q.y - ph / 2 - U * 2, pw, ph, ph / 2));
      label(ctx, 'Style rule', q.x, q.y - U * 2, { align: 'center', size: Math.max(10, U * 1.05), color: INK, weight: 600, alpha });
    }
  }
  // The Editor takes the rule: the factory lights up, and the next loop begins.
  if (front) {
    const take = Math.sin(Math.PI * at(17.8, 18.9));
    if (take > 0) path(ctx, { stroke: VIOLET_SOFT, width: 2, alpha: 0.8 * take, shadow: 22 * take }, () => box(ctx, g.app.x - 3, g.app.y - 3, g.app.w + 6, g.app.h + 6, 12));
  }
  return state;
}
loop.layers = ['back', 'front'];
loop.contours = false;
/** Still frame: the second loop, all three clips approved and the gate about to open. */
loop.still = LOOP_PERIOD + 10.45;

/* ---------------------------------------------------------------------------------------------
 * Station scenes, one per stage family. Each is a pure function of its clock.
 * ------------------------------------------------------------------------------------------- */

/** Understand: the recording is transcribed and split into scenes, on your Mac. */
function understand(ctx, s) {
  const { w, h, t } = s;
  backdrop(ctx, s);
  const phase = cycle(t, 6.4);
  const fade = Math.min(ease(phase / 0.06), 1 - ease((phase - 0.9) / 0.1));
  const head = ease(span(phase, 0.06, 0.8));
  const sx = w * 0.06;
  const sw = w * 0.38;
  const sh = Math.max(26, h * 0.15);
  const sy = h * 0.5 - sh / 2;
  recording(ctx, sx, sy, sw, sh, { alpha: fade, head, seed: 2 });
  label(ctx, 'Your stream', sx, sy - 16, { size: 11, color: INK, alpha: fade });
  const hx = sx + sw * (0.03 + head * 0.94);
  agent(ctx, hx, sy - sh * 0.5, Math.max(3, h * 0.02), { alpha: fade, heading: 0, speed: head > 0 && head < 1 ? 0.7 : 0, working: true, t });

  const px = w * 0.56;
  const pw = w * 0.38;
  const panels = [
    { name: 'Transcript', y: h * 0.12, h: h * 0.34 },
    { name: 'Scenes', y: h * 0.56, h: h * 0.3 },
  ];
  for (const panel of panels) {
    const ly = panel.y + panel.h / 2;
    path(ctx, { stroke: VIOLET_SOFT, width: 1.2, alpha: fade * 0.55, dash: [3, 5], dashOffset: -t * 24 }, () => {
      ctx.moveTo(sx + sw, h * 0.5);
      ctx.bezierCurveTo(mix(sx + sw, px, 0.5), h * 0.5, mix(sx + sw, px, 0.5), ly, px, ly);
    });
    path(ctx, { fill: SURFACE, stroke: LINE, width: 1.2, alpha: fade }, () => box(ctx, px, panel.y, pw, panel.h, 8));
    label(ctx, panel.name, px + 12, panel.y + 14, { size: 11, color: INK, weight: 600, alpha: fade });
  }
  // The transcript fills in as the recording is heard; one line is a moment worth cutting.
  const lines = [0.82, 0.64, 0.9, 0.5, 0.72];
  lines.forEach((len, i) => {
    const shown = ease(span(head, i * 0.17, i * 0.17 + 0.15));
    const moment = i === 2;
    const y = panels[0].y + 30 + i * ((panels[0].h - 40) / lines.length);
    if (moment && shown > 0.9) glow(ctx, px + pw * 0.4, y, pw * 0.3, 0.25 * fade);
    path(ctx, { fill: moment ? ACCENT : INK, alpha: fade * shown * (moment ? 0.9 : 0.4) }, () => box(ctx, px + 12, y - 2, (pw - 24) * len * shown, 4.5, 2));
  });
  // Scene changes are found from the picture, one thumbnail each.
  const tw = (pw - 24 - 18) / 4;
  for (let i = 0; i < 4; i += 1) {
    const pop = easeOutBack(span(head, 0.12 + i * 0.2, 0.26 + i * 0.2));
    if (pop <= 0.01) continue;
    const th = tw * 0.5625;
    const cx = px + 12 + i * (tw + 6) + tw / 2;
    const cy = panels[1].y + panels[1].h * 0.6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);
    path(ctx, { fill: SURFACE, stroke: i === 2 ? VIOLET : LINE, width: 1.2, alpha: fade }, () => box(ctx, -tw / 2, -th / 2, tw, th, 4));
    path(ctx, { fill: MUTED, alpha: fade * 0.2 }, () => ctx.arc(-tw * 0.1 + i * tw * 0.06, 0, th * 0.24, 0, Math.PI * 2));
    ctx.restore();
  }
}
understand.still = 4.2;

/** Judge: the Critic scores every clip on the production rubric, ranks them, and waits for you. */
const RUBRIC = [0.82, 0.44, 0.9, 0.52, 0.74];
function judge(ctx, s) {
  const { w, h, t } = s;
  backdrop(ctx, s);
  const phase = cycle(t, 7.5);
  const fade = Math.min(ease(phase / 0.06), 1 - ease((phase - 0.86) / 0.14));
  const ch = Math.min(h * 0.4, w * 0.24);
  const cy = h * 0.44;
  const xs = RUBRIC.map((_, k) => w * (0.14 + k * 0.18));
  const sweep = span(phase, 0.08, 0.36);
  const bx = mix(xs[0] - ch * 0.5, xs[4] + ch * 0.5, easeInOutCubic(sweep));
  if (sweep > 0 && sweep < 1) {
    glow(ctx, bx, cy, ch * 0.9, 0.3 * fade);
    path(ctx, { stroke: ACCENT, width: 1.5, alpha: fade * 0.8, shadow: 14 }, () => { ctx.moveTo(bx, cy - ch * 0.7); ctx.lineTo(bx, cy + ch * 0.85); });
  }
  label(ctx, 'Critic and ranker', w * 0.06, h * 0.08, { size: 11, color: INK, weight: 600, alpha: fade });
  const rank = ease(span(phase, 0.38, 0.5));
  let approved = 0;
  RUBRIC.forEach((score, k) => {
    const kept = KEPT.includes(k);
    const seen = ease((bx - xs[k]) / (ch * 0.4));
    const lift = kept ? -easeOutBack(rank) * h * 0.05 : rank * h * 0.03;
    const alpha = fade * (kept ? 1 : mix(1, 0.28, rank));
    const ok = kept && phase > 0.55 + KEPT.indexOf(k) * 0.08;
    if (ok) approved += 1;
    clipTile(ctx, xs[k], cy + lift, ch, { alpha, lit: kept && rank > 0.5, done: ok, hook: false, t });
    const bw = ch * 0.5625;
    const by = cy + ch * 0.62;
    path(ctx, { fill: LINE, alpha: alpha * 0.9 }, () => box(ctx, xs[k] - bw / 2, by, bw, 4, 2));
    path(ctx, { fill: kept ? VIOLET_SOFT : MUTED, alpha: alpha * 0.9 }, () => box(ctx, xs[k] - bw / 2, by, bw * score * seen, 4, 2));
  });
  const waiting = phase > 0.5;
  if (waiting) {
    const all = approved === KEPT.length;
    label(ctx, all ? 'You approved these' : 'Waiting for you', w * 0.5, h * 0.9, { size: 12, align: 'center', color: all ? PINE : INK, weight: 600, alpha: fade * ease(span(phase, 0.5, 0.56)) });
  } else {
    label(ctx, 'Production rubric', w * 0.5, h * 0.9, { size: 11, align: 'center', color: MUTED, alpha: fade * ease(sweep * 3) });
  }
}
judge.still = 5.85;

/** Learn: reported results become a belief, and a belief becomes one Style rule for the next batch. */
function learn(ctx, s) {
  const { w, h, t } = s;
  backdrop(ctx, s);
  const phase = cycle(t, 9);
  const fade = Math.min(ease(phase / 0.05), 1 - ease((phase - 0.9) / 0.1));
  // Results, as sample shapes. One channel has not reported yet:
  // unreported is unavailable, never zero, so its bar is an empty outline.
  const rx = w * 0.06;
  const rw = w * 0.26;
  const base = h * 0.7;
  const top = h * 0.24;
  label(ctx, 'Results', rx, top - 14, { size: 11, color: INK, weight: 600, alpha: fade });
  const heights = [0.7, 0.42];
  const bw = rw / 4;
  [0, 1, 2].forEach((i) => {
    const x = rx + i * (bw * 1.4);
    if (i < 2) {
      const grow = easeOutCubic(span(phase, 0.04 + i * 0.05, 0.2 + i * 0.05));
      const bh = (base - top) * heights[i] * grow;
      path(ctx, { fill: i ? VIOLET_SOFT : ACCENT, alpha: fade * 0.85 }, () => box(ctx, x, base - bh, bw, bh, 4));
    } else {
      path(ctx, { stroke: MUTED, width: 1.2, alpha: fade * 0.8, dash: [3, 4] }, () => box(ctx, x, top + (base - top) * 0.3, bw, (base - top) * 0.7, 4));
      label(ctx, 'No report yet', x + bw / 2, base + 14, { size: 10, align: 'center', alpha: fade });
    }
  });
  path(ctx, { stroke: LINE, width: 1.2, alpha: fade }, () => { ctx.moveTo(rx - 4, base); ctx.lineTo(rx + rw + bw, base); });
  label(ctx, 'Sample shapes', rx, base + 32, { size: 10, alpha: fade * 0.8 });

  // The Strategist reads them and forms a belief: observational, not proof.
  const sx = w * 0.5;
  const sy = h * 0.34;
  const think = span(phase, 0.2, 0.42);
  for (let k = 0; k < 6; k += 1) {
    const v = easeInOutCubic(span(think, k * 0.08, 0.5 + k * 0.08));
    if (v <= 0 || v >= 1) continue;
    const fromX = rx + (k % 2) * bw * 1.4 + bw / 2;
    const fromY = base - (base - top) * heights[k % 2];
    const x = mix(fromX, sx, v);
    const y = mix(fromY, sy, v) - Math.sin(Math.PI * v) * h * 0.08;
    glow(ctx, x, y, 10, 0.35 * fade);
    path(ctx, { fill: ACCENT, alpha: fade, shadow: 8 }, () => ctx.arc(x, y, 2.6, 0, Math.PI * 2));
  }
  const awake = ease(span(phase, 0.3, 0.42));
  glow(ctx, sx, sy, 40, 0.3 * awake * fade);
  path(ctx, { fill: SURFACE, stroke: awake > 0.5 ? ACCENT : LINE, width: 1.4, alpha: fade }, () => ctx.arc(sx, sy, 11, 0, Math.PI * 2));
  path(ctx, { fill: ACCENT, alpha: fade * mix(0.4, 1, awake), shadow: 10 }, () => ctx.arc(sx, sy, 4, 0, Math.PI * 2));
  label(ctx, 'Strategist', sx, sy - 22, { size: 11, align: 'center', color: INK, weight: 600, alpha: fade });
  const belief = easeOutBack(span(phase, 0.4, 0.5));
  if (belief > 0.01) {
    const cw = Math.min(w * 0.2, 150);
    const cardY = sy + 26;
    path(ctx, { fill: SURFACE, stroke: VIOLET_SOFT, width: 1.2, alpha: fade * clamp01(belief), shadow: 10 }, () => box(ctx, sx - cw / 2, cardY, cw, 50 * belief, 8));
    label(ctx, 'Belief', sx - cw / 2 + 10, cardY + 13, { size: 11, color: INK, weight: 600, alpha: fade * clamp01(belief) });
    path(ctx, { fill: ACCENT, alpha: fade * 0.85 * clamp01(belief) }, () => box(ctx, sx - cw / 2 + 10, cardY + 28, (cw - 20) * 0.7 * clamp01(belief), 4, 2));
    path(ctx, { fill: MUTED, alpha: fade * 0.4 * clamp01(belief) }, () => box(ctx, sx - cw / 2 + 10, cardY + 37, (cw - 20) * 0.45 * clamp01(belief), 4, 2));
  }

  // One approved Style rule re-cuts the next batch: the payoff moves to the front.
  const tx = w * 0.66;
  const tw = w * 0.28;
  const ty = h * 0.5;
  const th = Math.max(18, h * 0.08);
  const send = easeInOutCubic(span(phase, 0.52, 0.62));
  if (send > 0 && send < 1) {
    const x = mix(sx, tx + tw * 0.5, send);
    const y = mix(sy + 50, ty - th * 1.6, send) - Math.sin(Math.PI * send) * h * 0.06;
    path(ctx, { fill: SURFACE, stroke: ACCENT, width: 1.2, alpha: fade, shadow: 12 }, () => box(ctx, x - 36, y - 10, 72, 20, 10));
    label(ctx, 'Style rule', x, y, { size: 10, align: 'center', color: INK, weight: 600, alpha: fade });
  }
  const recut = easeInOutCubic(span(phase, 0.62, 0.76));
  label(ctx, recut > 0.5 ? 'Re-cut: hook first' : 'Before', tx, ty - th - 12, { size: 11, color: recut > 0.5 ? ACCENT : INK, weight: 600, alpha: fade });
  const setupW = tw * 0.62;
  const payoffW = tw * 0.34;
  const gap = tw * 0.04;
  const payoffX = mix(tx + setupW + gap, tx, recut);
  const setupX = mix(tx, tx + payoffW + gap, recut);
  const liftY = -Math.sin(Math.PI * recut) * th * 1.2;
  path(ctx, { fill: SURFACE, stroke: LINE, width: 1.2, alpha: fade }, () => box(ctx, setupX, ty, setupW, th, 5));
  label(ctx, 'Setup', setupX + 8, ty + th / 2, { size: 10, alpha: fade });
  if (recut > 0 && recut < 1) glow(ctx, payoffX + payoffW / 2, ty + liftY + th / 2, payoffW, 0.3 * fade);
  path(ctx, { fill: VIOLET, stroke: ACCENT, width: 1.2, alpha: fade * 0.9 }, () => box(ctx, payoffX, ty + liftY, payoffW, th, 5));
  label(ctx, 'Payoff', payoffX + 8, ty + liftY + th / 2, { size: 10, color: INK, weight: 600, alpha: fade });
  label(ctx, 'Next batch', tx, ty + th + 16, { size: 10, alpha: fade * ease(span(phase, 0.74, 0.8)) });
}
learn.still = 7.0;

/**
 * Feature one: an agent reads the recording, drops onto a moment, and pulls a captioned vertical
 * clip out of the strip. Two agents work a different moment each, out of phase.
 */
function cut(ctx, s) {
  backdrop(ctx, s);
  const { w, h, t } = s;
  const strip = { x: w * 0.06, y: h * 0.63, w: w * 0.62, h: h * 0.19 };
  const stack = { x: w * 0.85, y: h * 0.42 };
  const moments = [0.18, 0.46, 0.74];
  const PERIOD = 7.2;
  // Which moment each agent is on, and how far through its run it is.
  const runs = [0, 1].map((lane) => {
    const raw = t / PERIOD + lane * 0.5;
    const phase = ((raw % 1) + 1) % 1;
    const index = Math.floor(raw + (lane ? 0.5 : 0)) % moments.length;
    return { lane, phase, at: moments[(index + lane) % moments.length] };
  });
  // The recording: the material the clips come out of.
  path(ctx, { fill: SURFACE, stroke: LINE, width: 1.2, alpha: 0.95 }, () => box(ctx, strip.x, strip.y, strip.w, strip.h, 6));
  const taken = runs.filter((run) => run.phase > 0.42).map((run) => run.at);
  const bars = 52;
  for (let i = 0; i < bars; i += 1) {
    const span = i / (bars - 1);
    const bx = strip.x + strip.w * (0.025 + span * 0.95);
    const amp = 0.22 + 0.78 * Math.abs(wobble(i * 0.55, 0, 1));
    // Where a clip has been lifted out, the strip is visibly missing that stretch.
    const gap = taken.some((at) => Math.abs(span - at) < 0.055) ? 0.25 : 1;
    const bh = strip.h * 0.4 * amp * gap;
    path(ctx, { stroke: INK, width: 1.7, alpha: 0.34 * (gap < 1 ? 0.5 : 1) }, () => {
      ctx.moveTo(bx, strip.y + strip.h / 2 - bh);
      ctx.lineTo(bx, strip.y + strip.h / 2 + bh);
    });
  }
  label(ctx, 'Your recording', strip.x, strip.y + strip.h + h * 0.08, { color: MUTED });
  // Clips already taken out, waiting for review.
  const landed = runs.map((run) => easeOutCubic((run.phase - 0.84) / 0.1)).reduce((a, b) => a + b, 0);
  for (let i = 2; i >= 0; i -= 1) {
    const lift = Math.min(1, landed + i * 0.45);
    if (lift <= 0.02) continue;
    clipTile(ctx, stack.x - i * w * 0.012, stack.y + i * h * 0.05, h * 0.3, { alpha: 0.35 + 0.2 * (2 - i), done: true, tilt: (i - 1) * 0.05 });
  }
  label(ctx, 'Clips for review', stack.x, stack.y + h * 0.26, { align: 'center', color: MUTED });
  for (const run of runs) {
    const { phase, at } = run;
    const targetX = strip.x + strip.w * (0.025 + at * 0.95);
    const targetY = strip.y - h * 0.08;
    const entryX = mix(strip.x, strip.x + strip.w, at) - w * 0.3;
    const entryY = h * 0.12;
    const fade = Math.min(1, ease(phase / 0.05), 1 - ease((phase - 0.94) / 0.06));
    // 1. travel in, 2. settle, 3. drop a tether, 4. pull the clip out, 5. tow it to the stack
    const travel = easeInOutCubic(phase / 0.24);
    const settle = easeOutBack(clamp01((phase - 0.2) / 0.12));
    const tether = ease((phase - 0.3) / 0.1);
    const pull = easeOutCubic((phase - 0.42) / 0.18);
    const tow = easeInOutCubic((phase - 0.6) / 0.24);
    const ax = mix(mix(entryX, targetX, travel), stack.x, tow);
    const ay = mix(mix(entryY, targetY, travel) - Math.sin(Math.PI * travel) * h * 0.06, stack.y - h * 0.16, tow);
    const speed = (travel < 1 ? 1 - travel * 0.3 : 0) + (tow > 0 && tow < 1 ? 0.8 : 0);
    const heading = tow > 0 ? 0 : Math.atan2(targetY - entryY, targetX - entryX);
    const working = tether > 0.2 && pull < 1;
    // The scan beam while it reads the moment under it.
    if (travel > 0.75 && pull < 0.8) {
      const open = ease((travel - 0.75) / 0.25) * (1 - clamp01(pull));
      path(ctx, { fill: VIOLET, alpha: 0.1 * open }, () => {
        ctx.moveTo(ax, ay);
        ctx.lineTo(targetX - strip.w * 0.055, strip.y + strip.h * 0.5);
        ctx.lineTo(targetX + strip.w * 0.055, strip.y + strip.h * 0.5);
        ctx.closePath();
      });
    }
    // The cut brackets snap around the moment it chose.
    if (settle > 0.1 && pull < 1) {
      const snap = Math.min(settle, 1) * (1 - clamp01((pull - 0.8) / 0.2));
      const x1 = targetX - strip.w * 0.055;
      const x2 = targetX + strip.w * 0.055;
      const inset = mix(strip.h * 0.3, 0, snap);
      path(ctx, { stroke: VIOLET_SOFT, width: 1.6, alpha: 0.9 * snap, shadow: 8 }, () => {
        ctx.moveTo(x1, strip.y + inset); ctx.lineTo(x1, strip.y + strip.h - inset);
        ctx.moveTo(x2, strip.y + inset); ctx.lineTo(x2, strip.y + strip.h - inset);
      });
    }
    // The tether, and the clip travelling up it.
    if (tether > 0 && tow < 1) {
      const grip = { x: targetX, y: strip.y + strip.h * 0.5 };
      const clipX = mix(grip.x, ax, pull);
      const clipY = mix(grip.y, ay + h * 0.12, pull);
      path(ctx, { stroke: ACCENT, width: 1.2, alpha: 0.5 * tether * (1 - clamp01(tow)), dash: [3, 5], dashOffset: -t * 24 }, () => {
        ctx.moveTo(ax, ay);
        ctx.lineTo(mix(ax, clipX, 0.5), mix(ay, clipY, 0.5) + h * 0.02);
        ctx.lineTo(clipX, clipY);
      });
      if (pull > 0.02) {
        // Sparks at the point the clip came away from the strip.
        const spark = 1 - clamp01(pull * 2.4);
        for (let k = 0; k < 4 && spark > 0; k += 1) {
          const a = (k / 4) * Math.PI * 2 + t;
          path(ctx, { fill: ACCENT, alpha: spark * 0.8 }, () =>
            ctx.arc(grip.x + Math.cos(a) * strip.h * 0.5 * (1 - spark), grip.y + Math.sin(a) * strip.h * 0.4 * (1 - spark), 1.6, 0, Math.PI * 2));
        }
        const swing = Math.sin(phase * 22) * 0.06 * (1 - ease((phase - 0.6) / 0.3));
        clipTile(ctx, clipX, clipY, h * 0.26 * mix(0.55, 1, pull), { alpha: fade, lit: true, tilt: swing, squash: mix(1.06, 1, easeOutCubic(pull)) });
      }
    }
    // The clip lands on the stack, squashing a little as it settles.
    const drop = easeOutBack((phase - 0.8) / 0.12, 2.4);
    if (phase > 0.8 && phase < 0.95) {
      clipTile(ctx, mix(ax, stack.x, clamp01(drop)), mix(ay + h * 0.12, stack.y, clamp01(drop)), h * 0.28,
        { alpha: fade, lit: true, done: drop > 0.9, squash: mix(0.9, 1, clamp01(drop)) });
    }
    agent(ctx, ax, ay, Math.max(3, h * 0.022), { alpha: fade, heading, speed, working, t });
  }
}

/** Feature two: nothing leaves until you approve it, then it goes out to the platforms. */
function post(ctx, s) {
  backdrop(ctx, s);
  const { w, h, t } = s;
  const mid = h * 0.5;
  const loop = cycle(t, 9);
  const approach = ease(loop / 0.3);
  const approved = loop > 0.36;
  const send = ease((loop - 0.42) / 0.42);
  const gateX = w * 0.44;
  const tileX = mix(w * 0.12, gateX - w * 0.1, approach);
  // The loop fades at both ends, so starting the next clip never looks like a glitch.
  const fade = Math.min(1, ease(loop / 0.05), 1 - ease((loop - 0.95) / 0.05));
  clipTile(ctx, tileX, mid, h * 0.4, { alpha: fade, lit: approved, done: approved });
  label(ctx, 'Approved clip', w * 0.12, mid + h * 0.26, { align: 'center' });
  // The approval gate: shut, pulsing, until you open it.
  const open = approved ? ease((loop - 0.36) / 0.08) : 0;
  const gap = h * 0.11 * open;
  for (const dir of [-1, 1]) {
    path(ctx, { fill: SURFACE, stroke: approved ? PINE : LINE, width: 1.4, alpha: 0.96 }, () => box(ctx, gateX - w * 0.022, mid + dir * (gap + h * 0.02) - (dir < 0 ? h * 0.14 : 0), w * 0.044, h * 0.14, 6));
  }
  if (!approved) {
    const pulse = Math.sin(Math.PI * cycle(t, 1.6)) ** 2;
    path(ctx, { stroke: VIOLET_SOFT, width: 1.6, alpha: 0.3 + 0.5 * pulse, shadow: 10 * pulse }, () => ctx.arc(gateX, mid, h * 0.075 + h * 0.02 * pulse, 0, Math.PI * 2));
    label(ctx, 'Waiting for you', gateX, mid + h * 0.3, { align: 'center' });
  } else {
    glow(ctx, gateX, mid, h * 0.2, 0.3);
    path(ctx, { stroke: PINE, width: 2.2, alpha: 1, shadow: 8 }, () => {
      ctx.moveTo(gateX - h * 0.035, mid - h * 0.005);
      ctx.lineTo(gateX - h * 0.008, mid + h * 0.028);
      ctx.lineTo(gateX + h * 0.042, mid - h * 0.045);
    });
    label(ctx, 'You approved it', gateX, mid + h * 0.3, { align: 'center', color: PINE });
  }
  // The destinations. Names only, drawn as plain cards: no platform logos or marks.
  const cards = [{ name: 'TikTok', y: mid - h * 0.27 }, { name: 'Reels', y: mid }, { name: 'Shorts', y: mid + h * 0.27 }];
  cards.forEach((card, i) => {
    const arrive = ease((send - i * 0.12) / 0.5);
    const cardX = w * 0.74;
    const cw = w * 0.2;
    const chh = h * 0.16;
    path(ctx, { stroke: VIOLET, width: 1.2, alpha: 0.1 + 0.35 * arrive, dash: [4, 5], dashOffset: -t * 14 }, () => {
      ctx.moveTo(gateX + w * 0.04, mid);
      ctx.quadraticCurveTo(mix(gateX, cardX, 0.55), mix(mid, card.y, 0.75), cardX - cw * 0.08, card.y);
    });
    path(ctx, { fill: SURFACE, stroke: arrive > 0.92 ? PINE : arrive > 0.05 ? VIOLET : LINE, width: 1.3, alpha: mix(0.5, 0.96, fade), shadow: arrive > 0.05 && arrive < 0.95 ? 10 : 0 }, () => box(ctx, cardX, card.y - chh / 2, cw, chh, 8));
    label(ctx, card.name, cardX + cw * 0.12, card.y, { color: arrive > 0.92 ? INK : MUTED, size: 11, weight: 600 });
    if (arrive > 0.92) {
      path(ctx, { stroke: PINE, width: 1.8, alpha: 1 }, () => {
        ctx.moveTo(cardX + cw * 0.72, card.y - h * 0.004);
        ctx.lineTo(cardX + cw * 0.79, card.y + h * 0.022);
        ctx.lineTo(cardX + cw * 0.9, card.y - h * 0.03);
      });
    }
    if (arrive > 0.02 && arrive < 0.98) {
      const px = mix(gateX + w * 0.04, cardX, arrive);
      const py = mix(mid, card.y, ease(arrive));
      path(ctx, { fill: ACCENT, alpha: 1, shadow: 12 }, () => ctx.arc(px, py, 3, 0, Math.PI * 2));
    }
  });
}


export const SCENES = { loop, understand, cut, judge, post, learn };

/**
 * Mount one scene on a host element. Returns null when the scene name is unknown, so markup can
 * never animate something this module does not actually draw.
 *
 * A painter can ask for two canvases (`layers: ['back', 'front']`): the back one goes under the
 * host's content and the front one over it, so the hero's orbit can pass behind the real app
 * screenshot and come round in front of it. An element marked `data-scene-anchor` is measured
 * each frame and handed to the painter as `s.app`.
 */
export function mountScene({
  host,
  kind,
  button,
  scenes = SCENES,
  media = window.matchMedia.bind(window),
  lifecycle = window,
  clock = () => performance.now(),
  report,
}) {
  let paint = scenes[kind];
  if (!paint) return null;
  const names = paint.layers ?? ['main'];
  const forced = media('(forced-colors: active)');
  const motion = media('(prefers-reduced-motion: reduce)');
  let layers = [];
  let raf = 0;
  let last = 0;
  let time = 0;
  let field = 0;
  let paused = false;
  let disposed = false;
  let onScreen = true;
  let frozen = false;
  let scale = 1;
  let frames = 0;
  let slow = 0;
  let contours = [];
  let contourAt = -Infinity;
  let width = 0;
  let height = 0;
  let anchorBox = null;
  let fade = null;

  const still = () => !!motion.matches;
  const animating = () => !disposed && layers.length > 0 && !still() && !paused && !frozen && onScreen && !document.hidden;
  const updateButton = () => {
    if (!button) return;
    button.hidden = !layers.length || still() || forced.matches || frozen;
    button.textContent = paused ? 'Play' : 'Pause';
    button.setAttribute('aria-label', paused ? 'Play animated illustration' : 'Pause animated illustration');
  };

  function measureHost() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * scale;
    width = Math.max(1, host.clientWidth || 0);
    height = Math.max(1, host.clientHeight || 0);
    const anchor = typeof host.querySelector === 'function' ? host.querySelector('[data-scene-anchor]') : null;
    if (anchor && typeof anchor.getBoundingClientRect === 'function' && typeof host.getBoundingClientRect === 'function') {
      const a = anchor.getBoundingClientRect();
      const b = host.getBoundingClientRect();
      anchorBox = { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
    } else anchorBox = null;
    const cw = Math.max(1, Math.round(width * dpr));
    const ch = Math.max(1, Math.round(height * dpr));
    for (const layer of layers) {
      if (layer.canvas.width !== cw) layer.canvas.width = cw;
      if (layer.canvas.height !== ch) layer.canvas.height = ch;
    }
    return dpr;
  }

  function draw(at = clock()) {
    if (!layers.length) return;
    const dpr = measureHost();
    const wantsField = paint.contours !== false || (fade && fade.paint.contours !== false);
    if (wantsField && at - contourAt > CONTOUR_MS) {
      contours = contourSegments({ width, height, time: still() ? STILL_AT : field, step: width > 760 ? 24 : 20 });
      contourAt = at;
    }
    const t = still() ? (paint.still ?? STILL_AT) : time;
    const blend = fade ? clamp01((at - fade.start) / FADE_MS) : 1;
    if (fade && blend >= 1) fade = null;
    let result;
    for (const layer of layers) {
      const { ctx } = layer;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      const base = { w: width, h: height, contours, app: anchorBox, layer: layers.length > 1 ? layer.name : undefined };
      if (fade) {
        ctx.save();
        ctx.globalAlpha = 1 - blend;
        fade.paint(ctx, { ...base, t: fade.t });
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = blend;
      }
      const out = paint(ctx, { ...base, t });
      if (out !== undefined) result = out;
      if (fade) ctx.restore();
    }
    if (result !== undefined && report) report(result);
  }

  // Same bargain as the WebGL field: drop to half resolution once, then settle for a still frame.
  function keepUp(gap) {
    frames += 1;
    if (gap > 50) slow += 1;
    if (frames < 60) return;
    const struggling = slow > 40;
    frames = 0;
    slow = 0;
    if (!struggling) return;
    if (scale > 0.5) scale = 0.5;
    else { frozen = true; updateButton(); }
  }

  function frame(at) {
    raf = 0;
    if (!animating()) return;
    raf = requestAnimationFrame(frame);
    const gap = last ? at - last : FRAME_MS;
    if (gap < FRAME_MS - 3) return;
    last = at;
    const dt = Math.min(gap, 100) / 1000;
    time += dt;
    field += dt;
    draw(at);
    keepUp(gap);
  }
  function wake() {
    if (!animating() || raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function sleep() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function build() {
    if (layers.length || forced.matches || disposed) return;
    const made = [];
    for (const name of names) {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      if (names.length > 1) canvas.dataset.layer = name;
      const ctx = canvas.getContext('2d');
      if (!ctx) { made.forEach((layer) => layer.canvas.remove()); return; }
      made.push({ name, canvas, ctx });
    }
    for (const layer of made) {
      if (layer.name === 'back' && host.firstChild && typeof host.insertBefore === 'function') host.insertBefore(layer.canvas, host.firstChild);
      else host.appendChild(layer.canvas);
    }
    layers = made;
    host.classList.add('has-scene');
    time = 0;
    contourAt = -Infinity;
    draw();
  }
  function teardown() {
    sleep();
    for (const layer of layers) layer.canvas.remove();
    layers = [];
    fade = null;
    host.classList.remove('has-scene');
  }

  /** Switch to another painter on the same canvas, crossfading unless motion is reduced. */
  function setKind(next) {
    const nextPaint = scenes[next];
    if (!nextPaint || nextPaint === paint || disposed) return false;
    if (layers.length && !still() && !paused) fade = { paint, t: time, start: clock() };
    paint = nextPaint;
    time = 0;
    draw();
    wake();
    return true;
  }

  const onForced = () => {
    if (disposed) return;
    if (forced.matches) teardown(); else build();
    updateButton();
    wake();
  };
  const onMotion = () => {
    if (disposed) return;
    if (still()) { sleep(); fade = null; contourAt = -Infinity; draw(); } else wake();
    updateButton();
  };
  const onVisibility = () => wake();
  const toggle = () => { paused = !paused; if (paused) sleep(); else wake(); updateButton(); };
  const onHide = (event) => { if (!event.persisted) dispose(); };
  const onShow = () => { if (!disposed) { build(); updateButton(); wake(); } };
  function dispose() {
    if (disposed) return;
    disposed = true;
    teardown();
    seen?.disconnect();
    sized?.disconnect();
    button?.removeEventListener('click', toggle);
    forced.removeEventListener('change', onForced);
    motion.removeEventListener('change', onMotion);
    document.removeEventListener('visibilitychange', onVisibility);
    lifecycle.removeEventListener('pagehide', onHide);
    lifecycle.removeEventListener('pageshow', onShow);
    updateButton();
  }
  const seen = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
        wake();
      }, { rootMargin: '120px' })
    : null;
  const sized = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { contourAt = -Infinity; draw(); })
    : null;
  button?.addEventListener('click', toggle);
  forced.addEventListener('change', onForced);
  motion.addEventListener('change', onMotion);
  document.addEventListener('visibilitychange', onVisibility);
  lifecycle.addEventListener('pagehide', onHide);
  lifecycle.addEventListener('pageshow', onShow);
  build();
  seen?.observe(host);
  sized?.observe(host);
  updateButton();
  wake();
  return { dispose, setKind, get kind() { return Object.keys(scenes).find((name) => scenes[name] === paint); } };
}

/**
 * The hero's chapter rail, like the chapters on a VOD scrubber: it follows the loop's beats, so
 * the words always describe what the picture is doing.
 */
export function railReporter(rail) {
  const chapters = [...rail.querySelectorAll('[data-family]')];
  const beatText = rail.querySelector('[data-loop-beat]');
  const loopText = rail.querySelector('[data-loop-count]');
  let beat = -1;
  let count = -1;
  let family = -1;
  return (state) => {
    if (!state || typeof state.beat !== 'number') return;
    chapters[state.family]?.style.setProperty('--p', state.progress.toFixed(3));
    if (state.family !== family) {
      family = state.family;
      chapters.forEach((chapter, i) => {
        chapter.toggleAttribute('data-current', i === family);
        chapter.toggleAttribute('data-done', i < family);
        if (i > family) chapter.style.setProperty('--p', '0');
      });
    }
    if (state.beat !== beat) {
      beat = state.beat;
      if (beatText) beatText.textContent = LOOP_BEATS[beat].caption;
    }
    if (state.loop !== count) {
      count = state.loop;
      if (loopText) loopText.textContent = `Loop ${count}`;
    }
  };
}

/** Scroll-driven stations: the step crossing the middle of the viewport picks the scene. */
export function followSteps(handle, steps, Observer = IntersectionObserver) {
  const pick = (step) => {
    for (const other of steps) other.toggleAttribute('data-active', other === step);
    handle.setKind(step.dataset.stage);
  };
  const watcher = new Observer((entries) => {
    for (const entry of entries) if (entry.isIntersecting) pick(entry.target);
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((step) => watcher.observe(step));
  return watcher;
}

if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
  for (const host of document.querySelectorAll('[data-scene]')) {
    const rail = host.dataset.rail ? document.querySelector(host.dataset.rail) : null;
    const handle = mountScene({
      host,
      kind: host.dataset.scene,
      button: host.parentElement?.querySelector('[data-scene-toggle]'),
      report: rail ? railReporter(rail) : undefined,
    });
    const steps = host.dataset.steps ? [...document.querySelectorAll(host.dataset.steps)] : [];
    if (handle && steps.length && typeof IntersectionObserver === 'function') followSteps(handle, steps);
  }
}
