/**
 * Animated illustrations of the workflow: the factory in the hero, then agents cutting a
 * recording, posting an approved clip, and reviewing what came back.
 *
 * They are decorative diagrams, not product UI and not real results: no numbers are drawn, the
 * accessible description lives in the markup, and every scene drifts over the same topographic
 * field as the hero shader (see terrain.js).
 *
 * They stay out of the way, like the WebGL field: 30 fps at most, device pixel ratio capped at
 * 1.5, asleep while offscreen or in a hidden tab, one still frame under reduced motion, no canvas
 * at all in forced colors, and a manual pause control.
 */
import { contourSegments, STILL_AT } from './terrain.js?v=pearl-streamer-5';

const MAX_DPR = 1.5;
const FRAME_MS = 1000 / 30;
/** The backdrop field drifts slowly, so its grid is rebuilt a few times a second at most. */
const CONTOUR_MS = 125;
const INK = '#ececec';
const VIOLET = '#a75de3';
const VIOLET_SOFT = '#af85f3';
const ACCENT = '#d2acf7';
const LINE = '#2c2c2c';
const SURFACE = '#191919';
const MUTED = '#8a8a8a';
const PINE = '#6fcf97';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
/** Settles into place with a small overshoot: the agent has weight. */
const easeOutBack = (v, pull = 1.7) => { const x = clamp01(v) - 1; return 1 + (pull + 1) * x * x * x + pull * x * x; };
const easeOutCubic = (v) => { const x = 1 - clamp01(v); return 1 - x * x * x; };
const easeInOutCubic = (v) => { const x = clamp01(v); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
const mix = (a, b, v) => a + (b - a) * v;
/** Position in a repeating cycle, so every scene is a pure function of its clock. */
const cycle = (t, period, offset = 0) => { const v = (t / period + offset) % 1; return v < 0 ? v + 1 : v; };
/** A deterministic wobble: the scenes never use random numbers, so stills are reproducible. */
const wobble = (i, t, speed = 1) => Math.sin(i * 1.7 + t * speed) * 0.5 + Math.sin(i * 0.9 - t * speed * 0.6) * 0.5;

function path(ctx, { stroke, fill, width = 1, alpha = 1, dash, dashOffset = 0, shadow = 0 }, draw) {
  ctx.save();
  ctx.globalAlpha = alpha;
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
function label(ctx, text, x, y, { size = 10, color = MUTED, align = 'left', weight = 500 } = {}) {
  ctx.save();
  ctx.globalAlpha = 0.9;
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
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, VIOLET);
  gradient.addColorStop(1, 'rgba(167,93,227,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** A 9:16 clip card with caption bars: the thing the whole site is about. */
function clipTile(ctx, x, y, h, { alpha = 1, lit = false, done = false, tilt = 0, squash = 1 } = {}) {
  const w = h * 0.5625;
  ctx.save();
  ctx.translate(x, y);
  if (tilt) ctx.rotate(tilt);
  if (squash !== 1) ctx.scale(1 / squash, squash);
  path(ctx, { fill: SURFACE, stroke: lit ? VIOLET : LINE, width: 1.2, alpha }, () => box(ctx, -w / 2, -h / 2, w, h, h * 0.07));
  path(ctx, { fill: lit ? VIOLET : MUTED, alpha: alpha * (lit ? 0.9 : 0.45) }, () => box(ctx, -w * 0.3, h * 0.18, w * 0.6, h * 0.045, h * 0.02));
  path(ctx, { fill: MUTED, alpha: alpha * 0.3 }, () => box(ctx, -w * 0.3, h * 0.27, w * 0.38, h * 0.04, h * 0.02));
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

/** Feature three: checking what came back, including the parts nobody reported. */
function measure(ctx, s) {
  backdrop(ctx, s);
  const { w, h, t } = s;
  const chart = { x: w * 0.08, y: h * 0.18, w: w * 0.84, h: h * 0.58 };
  path(ctx, { fill: SURFACE, stroke: LINE, width: 1.2, alpha: 0.95 }, () => box(ctx, chart.x, chart.y, chart.w, chart.h, 10));
  for (let i = 1; i < 4; i += 1) {
    const y = chart.y + (chart.h * i) / 4;
    path(ctx, { stroke: INK, width: 1, alpha: 0.07, dash: [3, 6] }, () => { ctx.moveTo(chart.x + 10, y); ctx.lineTo(chart.x + chart.w - 10, y); });
  }
  // Fixed sample shapes. The third clip has no report, so its bar stays an empty outline:
  // unreported is unavailable, never zero.
  const shape = [0.44, 0.66, null, 0.86, 0.52, 0.7];
  const base = chart.y + chart.h - h * 0.08;
  const slot = chart.w / (shape.length + 1);
  const barX = (i) => chart.x + slot * (i + 1);
  const span = chart.h - h * 0.16;
  // One calm cycle: the reported bars rise, the cursor checks them, then everything settles back.
  const phase = cycle(t, 12);
  const presence = Math.min(ease(phase / 0.14), 1 - ease((phase - 0.9) / 0.1));
  // The cursor walks between anchors, so it never jumps when the cycle restarts.
  const anchors = [chart.x + chart.w * 0.16, barX(3), barX(2), chart.x + chart.w * 0.86];
  const walk = clamp01((phase - 0.06) / 0.88) * (anchors.length - 1);
  const leg = Math.min(anchors.length - 2, Math.floor(walk));
  const cursorX = mix(anchors[leg], anchors[leg + 1], ease(walk - leg));
  let hovered = null;
  shape.forEach((_, i) => { if (Math.abs(barX(i) - cursorX) < slot * 0.34) hovered = i; });
  const points = [];
  shape.forEach((value, i) => {
    const bx = barX(i);
    const bw = slot * 0.44;
    if (value === null) {
      const bh = 0.3 * span;
      path(ctx, { stroke: MUTED, width: 1.2, alpha: 0.5 * presence, dash: [4, 4] }, () => box(ctx, bx - bw / 2, base - bh, bw, bh, 4));
      label(ctx, '\u2014', bx, base - bh - h * 0.05, { align: 'center', color: MUTED, size: 13 });
      points.push(null);
      return;
    }
    const bh = value * span * mix(0.05, 1, ease(presence - i * 0.04));
    const hot = hovered === i;
    path(ctx, { fill: VIOLET, alpha: (hot ? 0.9 : 0.55) * presence, shadow: hot ? 14 : 0 }, () => box(ctx, bx - bw / 2, base - bh, bw, bh, 4));
    path(ctx, { stroke: ACCENT, width: 1.4, alpha: 0.8 * presence }, () => { ctx.moveTo(bx - bw / 2, base - bh); ctx.lineTo(bx + bw / 2, base - bh); });
    points.push([bx, base - bh - h * 0.06]);
  });
  path(ctx, { stroke: LINE, width: 1.2, alpha: 1 }, () => { ctx.moveTo(chart.x + 10, base); ctx.lineTo(chart.x + chart.w - 10, base); });
  // The trend line draws itself across the sample and skips the stretch it has no data for.
  const limit = chart.x + 10 + (chart.w - 20) * clamp01((phase - 0.1) / 0.4);
  path(ctx, { stroke: VIOLET_SOFT, width: 2, alpha: 0.9 * presence, shadow: 10 }, () => {
    let started = false;
    for (const point of points) {
      if (!point || point[0] > limit) { started = false; continue; }
      if (!started) { ctx.moveTo(point[0], point[1]); started = true; } else ctx.lineTo(point[0], point[1]);
    }
  });
  // The review cursor, and what it can honestly say about the bar underneath it.
  const cursorY = base - (hovered === null ? 0.5 : shape[hovered] ?? 0.3) * span - h * 0.12;
  path(ctx, { stroke: INK, width: 1.2, alpha: 0.5 * presence }, () => {
    ctx.moveTo(cursorX - 7, cursorY); ctx.lineTo(cursorX + 7, cursorY);
    ctx.moveTo(cursorX, cursorY - 7); ctx.lineTo(cursorX, cursorY + 7);
  });
  const missing = hovered !== null && shape[hovered] === null;
  const tipWidth = w * 0.19;
  path(ctx, { fill: SURFACE, stroke: LINE, width: 1.2, alpha: 0.98 * presence, shadow: 8 }, () => box(ctx, cursorX - tipWidth / 2, cursorY - h * 0.14, tipWidth, h * 0.085, 6));
  label(ctx, missing ? 'No report yet' : 'Checked by you', cursorX, cursorY - h * 0.098, { align: 'center', color: missing ? MUTED : INK, size: 10 });
  label(ctx, 'Sample shapes', chart.x + chart.w - 10, chart.y + chart.h + h * 0.1, { align: 'right', color: MUTED });
}

export const SCENES = { cut, post, measure };

/**
 * Mount one scene on a host element. Returns null when the scene name is unknown, so markup can
 * never animate something this module does not actually draw.
 */
export function mountScene({
  host,
  kind,
  button,
  scenes = SCENES,
  media = window.matchMedia.bind(window),
  lifecycle = window,
  clock = () => performance.now(),
}) {
  const paint = scenes[kind];
  if (!paint) return null;
  const forced = media('(forced-colors: active)');
  const motion = media('(prefers-reduced-motion: reduce)');
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let last = 0;
  let time = 0;
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
  const still = () => !!motion.matches;
  const animating = () => !disposed && !!ctx && !still() && !paused && !frozen && onScreen && !document.hidden;

  const updateButton = () => {
    if (!button) return;
    button.hidden = !ctx || still() || forced.matches || frozen;
    button.textContent = paused ? 'Play' : 'Pause';
    button.setAttribute('aria-label', paused ? 'Play animated illustration' : 'Pause animated illustration');
  };

  function measureHost() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * scale;
    width = Math.max(1, host.clientWidth || 0);
    height = Math.max(1, host.clientHeight || 0);
    if (!canvas) return dpr;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    return dpr;
  }

  function draw(at = clock()) {
    if (!ctx) return;
    const dpr = measureHost();
    if (at - contourAt > CONTOUR_MS) {
      contours = contourSegments({ width, height, time, step: width > 760 ? 24 : 20 });
      contourAt = at;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    paint(ctx, { w: width, h: height, t: time, contours });
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
    time += Math.min(gap, 100) / 1000;
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
    if (canvas || forced.matches || disposed) return;
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d');
    if (!ctx) { canvas = null; return; }
    host.appendChild(canvas);
    host.classList.add('has-scene');
    time = still() ? STILL_AT : 0;
    contourAt = -Infinity;
    draw();
  }

  function teardown() {
    sleep();
    canvas?.remove();
    canvas = null;
    ctx = null;
    host.classList.remove('has-scene');
  }

  const onForced = () => {
    if (disposed) return;
    if (forced.matches) teardown(); else build();
    updateButton();
    wake();
  };
  const onMotion = () => {
    if (disposed) return;
    if (still()) { sleep(); time = STILL_AT; contourAt = -Infinity; draw(); } else wake();
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
  return { dispose };
}

if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
  for (const host of document.querySelectorAll('[data-scene]')) {
    mountScene({
      host,
      kind: host.dataset.scene,
      button: host.parentElement?.querySelector('[data-scene-toggle]'),
    });
  }
}
