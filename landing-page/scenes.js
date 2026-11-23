/**
 * Animated illustrations of what Growth Factory does with a stream.
 *
 * The hero (`abtest`) is the idea in one loop: two versions of a clip that differ in one thing,
 * the one people watched longer wins, what it shows is kept with your approval, and the channel
 * line steps up. See growth_loop.py: one variable per experiment, equal windows, a minimum sample.
 *
 * The steps section uses `story`, one streamer's night told in photos, windowed to one stage per
 * step (`find`, `cut`, `pick`, `post`, `learn`):
 *   Find   the intro and dead air are skipped and the moments worth sharing are found (scouts.py).
 *   Cut    a vertical crop follows your face (faces.py, craft.py), then a hook and captions.
 *   Pick   you keep or skip every clip. Nothing posts without you.
 *   Post   kept clips go to TikTok, Reels and Shorts.
 *   Learn  one change is suggested for next time, which you approve before it is used.
 *
 * Rules the tests enforce: no numbers are drawn; an unreported result is "No report yet", never
 * zero; nothing posts before you keep it; nothing changes before you approve it; platforms are
 * named in text, with no logos.
 *
 * Restraint, same as the WebGL field: 30 fps at most, device pixel ratio capped at 1.5, asleep
 * offscreen or in a hidden tab, a meaningful still frame per scene under reduced motion, no canvas
 * in forced colors, and a manual pause control.
 */
import { contourSegments, STILL_AT } from './terrain.js?v=pearl-streamer-7';

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

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Settles into place with a small overshoot, so things that arrive have weight. */
const easeOutBack = (v, pull = 1.7) => { const x = clamp01(v) - 1; return 1 + (pull + 1) * x * x * x + pull * x * x; };
const easeOutCubic = (v) => { const x = 1 - clamp01(v); return 1 - x * x * x; };
const easeInOutCubic = (v) => { const x = clamp01(v); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
const mix = (a, b, v) => a + (b - a) * v;
/** How far a clock is between two moments, 0 before and 1 after. */
const span = (t, from, to) => clamp01((t - from) / (to - from));
/** Position in a repeating cycle, so every scene is a pure function of its clock. */
const cycle = (t, period) => { const v = (t / period) % 1; return v < 0 ? v + 1 : v; };
/** Alpha multiplies whatever is already set, so a crossfade dims a whole scene at once. */
const baseAlpha = (ctx) => (typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1);
const lerpRect = (a, b, v) => ({ x: mix(a.x, b.x, v), y: mix(a.y, b.y, v), w: mix(a.w, b.w, v), h: mix(a.h, b.h, v) });

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

/** Words only. Nothing numeric is ever drawn: no invented metrics. */
function label(ctx, text, x, y, { size = 12, color = MUTED, align = 'left', weight = 500, alpha = 1, shadow = 0 } = {}) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = baseAlpha(ctx) * Math.min(1, alpha);
  if (shadow) { ctx.shadowBlur = shadow; ctx.shadowColor = SURFACE; }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${size}px "Instrument Sans Variable", system-ui, sans-serif`;
  ctx.fillText(text, x, y);
  ctx.restore();
}
/** A width estimate that needs no measuring, so layout stays a pure function of size. */
const textWidth = (text, size, weight = 500) => text.length * size * (weight >= 800 ? 0.7 : weight >= 600 ? 0.58 : 0.53);

/** A rounded label: the page's vocabulary for a tag, a button or a lesson. */
function pill(ctx, text, x, y, { size = 12, color = INK, fill = SURFACE, stroke = LINE, alpha = 1, weight = 600, align = 'left', dash, strike = false } = {}) {
  if (alpha <= 0.002) return null;
  const w = textWidth(text, size, weight) + size * 1.5;
  const h = size * 1.9;
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  path(ctx, { fill, stroke, width: 1.2, alpha, dash }, () => box(ctx, left, y - h / 2, w, h, h / 2));
  label(ctx, text, left + w / 2, y, { size, color, align: 'center', weight, alpha });
  if (strike) path(ctx, { stroke: color, width: 1.2, alpha: alpha * 0.8 }, () => { ctx.moveTo(left + size * 0.6, y); ctx.lineTo(left + w - size * 0.6, y); });
  return { x: left, y: y - h / 2, w, h };
}

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

/** A tick, drawn when you keep or approve something. */
function tick(ctx, x, y, r, alpha = 1) {
  path(ctx, { stroke: PINE, width: Math.max(1.8, r * 0.3), alpha, shadow: 8 }, () => {
    ctx.moveTo(x - r * 0.55, y);
    ctx.lineTo(x - r * 0.12, y + r * 0.42);
    ctx.lineTo(x + r * 0.62, y - r * 0.5);
  });
}

/** A tap: a ring that opens out where a button is pressed. */
function tap(ctx, x, y, r, v) {
  if (v <= 0 || v >= 1) return;
  path(ctx, { stroke: ACCENT, width: 2, alpha: 1 - v }, () => ctx.arc(x, y, r * (0.4 + v * 1.4), 0, Math.PI * 2));
}

/* ---------------------------------------------------------------------------------------------
 * Photos. One streamer's night, from a licensed stock series (see ASSETS.md), so the story reads
 * as a real stream: hours of play, a pizza break, and one moment worth sharing.
 * ------------------------------------------------------------------------------------------- */

const V = '?v=pearl-streamer-7';
export const PHOTOS = {
  talk: `/assets/streamers/stream-talk.webp${V}`,
  play: `/assets/streamers/stream-play.webp${V}`,
  pizza: `/assets/streamers/stream-pizza.webp${V}`,
  moment: `/assets/streamers/stream-moment.webp${V}`,
  clip: `/assets/streamers/clip-moment.webp${V}`,
  clipTalk: `/assets/streamers/clip-talk.webp${V}`,
  clipPlay: `/assets/streamers/clip-play.webp${V}`,
};

/** Draw a photo cover-cropped into a rounded box. Until it loads, a plain surface stands in. */
function photo(ctx, s, name, x, y, w, h, { alpha = 1, r = 0, fx = 0.5, fy = 0.5, zoom = 1, region, dim = 0 } = {}) {
  if (alpha <= 0.002 || !(w >= 1) || !(h >= 1)) return;
  const img = s.photos?.[name];
  const ready = !!img && img.complete !== false && img.naturalWidth > 0;
  ctx.save();
  const a = baseAlpha(ctx) * Math.min(1, alpha);
  ctx.globalAlpha = a;
  ctx.beginPath();
  box(ctx, x, y, w, h, r);
  ctx.clip();
  if (ready) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const x0 = (region?.x0 ?? 0) * iw;
    const y0 = (region?.y0 ?? 0) * ih;
    const rw = ((region?.x1 ?? 1) - (region?.x0 ?? 0)) * iw;
    const rh = ((region?.y1 ?? 1) - (region?.y0 ?? 0)) * ih;
    const scale = Math.max(w / rw, h / rh) * Math.max(1, zoom);
    const sw = w / scale;
    const sh = h / scale;
    const sx = x0 + clamp(fx * rw - sw / 2, 0, Math.max(0, rw - sw));
    const sy = y0 + clamp(fy * rh - sh / 2, 0, Math.max(0, rh - sh));
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  } else {
    ctx.fillStyle = SURFACE;
    ctx.fillRect(x, y, w, h);
  }
  if (dim > 0) {
    ctx.globalAlpha = a * Math.min(1, dim);
    ctx.fillStyle = SURFACE;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/* ---------------------------------------------------------------------------------------------
 * The story: one stream, all the way round.
 * ------------------------------------------------------------------------------------------- */

/** One stream, in seconds. */
export const STORY_PERIOD = 24;
/** Streams before the shelf of lessons clears and the run starts again. */
export const STORY_RUN = 3;
export const FAMILIES = ['Find', 'Cut', 'Pick', 'Post', 'Learn'];
export const STORY_BEATS = [
  { at: 0, family: 0, caption: 'Last night\u2019s stream goes in' },
  { at: 3.6, family: 0, caption: 'It skips the intro and the dead air' },
  { at: 5.6, family: 0, caption: 'and finds the moments worth sharing' },
  { at: 8.0, family: 1, caption: 'Cut vertical, following your face' },
  { at: 10.4, family: 1, caption: 'A hook up top, captions word by word' },
  { at: 12.6, family: 2, caption: 'You keep it or skip it' },
  { at: 15.2, family: 3, caption: 'Posted to TikTok, Reels and Shorts' },
  { at: 17.6, family: 4, caption: 'It sees what people watched' },
  { at: 19.9, family: 4, caption: 'and suggests one change for next time' },
  { at: 22.4, family: 4, caption: 'Next stream, a better informed batch' },
];
const FAMILY_AT = [0, 8.0, 12.6, 15.2, 17.6, STORY_PERIOD];
/** What a stream teaches, in the order a run learns it: hook, length, then your taste. */
export const LESSONS = ['Open on the big moment', 'Keep it short', 'More like your picks'];
/** The timeline of the stream: what each stretch of the night looks like. */
const SEGMENTS = ['talk', 'talk', 'play', 'play', 'pizza', 'play', 'talk', 'play', 'moment', 'play'];
const SKIPPED = [{ at: 0, text: 'Intro' }, { at: 4, text: 'Dead air' }];
const FOUND = [{ at: 6, text: 'Funny story' }, { at: 8, text: 'Big reaction' }];
const PLATFORMS = ['TikTok', 'Reels', 'Shorts'];
/** Sample shapes for "watched to the end". Shorts has not reported, so it has no shape at all. */
const SAMPLE = [0.74, 0.52, null];
const CAPTION = ['I', 'CAN\u2019T', 'BELIEVE', 'THAT', 'WORKED'];
const CAPTION_GROUP = [0, 0, 1, 1, 2];
const HOOK = ['The comeback', 'nobody saw coming'];
/** Where the streamer's face is in the moment frame, and the vertical crop that follows it. */
const FACE = { x: 0.567, y: 0.4 };
const CROP_CENTRE = 0.6;

export function storyState(t) {
  const pass = Math.floor(t / STORY_PERIOD);
  const local = t - pass * STORY_PERIOD;
  let beat = 0;
  for (let i = 0; i < STORY_BEATS.length; i += 1) if (local >= STORY_BEATS[i].at) beat = i;
  const family = STORY_BEATS[beat].family;
  const progress = clamp01((local - FAMILY_AT[family]) / (FAMILY_AT[family + 1] - FAMILY_AT[family]));
  return { beat, family, progress, loop: (((pass % STORY_RUN) + STORY_RUN) % STORY_RUN) + 1 };
}

/** One layout for every size: the clip on the right, the stream and what happens to it on the left. */
export function storyLayout(w, h) {
  const narrow = w < 560;
  const U = Math.max(6, Math.min(w / 60, h / 30));
  const fs = Math.min(14, Math.max(10, U * 0.8));
  const M = Math.max(10, U * 1.6);
  const btnH = Math.max(22, U * 2.2);
  let ph = Math.max(40, h - 2 * M - btnH - U);
  let pw = (ph * 9) / 16;
  // On a narrow screen the clip may not crowd out the stream it comes from.
  if (narrow && pw > w * 0.42) { pw = w * 0.42; ph = (pw * 16) / 9; }
  const phone = { x: w - M - pw, y: M, w: pw, h: ph };
  const lw = Math.max(40, phone.x - M - U * 2.4);
  const shelfH = narrow ? 0 : fs * 2.2;
  let fw = lw;
  let fh = (fw * 9) / 16;
  const rowH = Math.max(22, U * 2.2);
  const rowGap = Math.max(5, U * 0.55);
  const top = M + (narrow ? 0 : shelfH + U * 0.6);
  // Below the frame: the timeline, then three platform rows (and, when narrow, the shelf).
  const below = U * 1.1 + Math.max(14, U * 1.8) + fs * 1.5 + 3 * (rowH + rowGap) + M + (narrow ? U * 2 + fs * 4 : 0);
  const fhMax = Math.max(40, Math.min(narrow ? h * 0.42 : h * 0.56, h - top - below));
  if (fh > fhMax) { fh = fhMax; fw = (fh * 16) / 9; }
  const frame = { x: M + (lw - fw) / 2, y: top, w: fw, h: fh };
  const track = { x: frame.x, y: frame.y + fh + U * 1.1, w: fw, h: Math.max(14, U * 1.8) };
  const rowsY = track.y + fs * 1.5;
  const rows = PLATFORMS.map((_, i) => ({ x: frame.x, y: rowsY + i * (rowH + rowGap), w: fw, h: rowH }));
  const shelf = narrow
    ? { x: frame.x, y: rows[2].y + rowH + U * 2 + fs, w: fw }
    : { x: frame.x, y: M + shelfH / 2, w: fw };
  const bw = (fh * 9) / 16;
  const crop = { x: clamp(frame.x + fw * CROP_CENTRE - bw / 2, frame.x, frame.x + fw - bw), y: frame.y, w: bw, h: fh };
  return { w, h, U, fs, M, btnH, narrow, phone, frame, track, rows, shelf, crop, stack: narrow ? 0.3 : 0.55 };
}

function drawShelf(ctx, L, lessons, alpha) {
  const { fs, shelf, narrow } = L;
  const heading = 'What it has learned';
  label(ctx, heading, shelf.x, shelf.y, { size: fs * 0.9, color: MUTED, alpha });
  const slots = [];
  let x = shelf.x + textWidth(heading, fs * 0.9) + fs;
  let y = shelf.y;
  for (let i = 0; i < STORY_RUN; i += 1) {
    if (narrow) { x = shelf.x; y = shelf.y + (i + 1) * fs * 2.3; }
    slots.push({ x, y });
    if (i < lessons) {
      const r = pill(ctx, LESSONS[i], x, y, { size: fs * 0.85, color: ACCENT, stroke: VIOLET, alpha });
      if (!narrow && r) x += r.w + fs * 0.6;
    }
  }
  if (lessons === 0) pill(ctx, 'Nothing yet', slots[0].x, slots[0].y, { size: fs * 0.85, color: MUTED, fill: SURFACE, dash: [3, 4], weight: 500, alpha: alpha * 0.8 });
  return slots;
}

function drawFrame(ctx, s, L, t) {
  const { frame: f, fs } = L;
  const N = SEGMENTS.length;
  let name = 'moment';
  let prev = null;
  let blend = 1;
  let dim = 0;
  let zoom = 1;
  let alpha = 1;
  if (t < 3.6) {
    const p = (t / 3.6) * 0.999;
    const seg = Math.floor(p * N);
    name = SEGMENTS[seg];
    prev = seg > 0 ? SEGMENTS[seg - 1] : null;
    blend = prev && prev !== name ? span(p * N - seg, 0, 0.35) : 1;
  } else if (t < 5.6) {
    name = 'pizza';
    prev = 'play';
    blend = span(t, 3.6, 3.9);
    dim = 0.55 * span(t, 3.9, 4.3);
  } else if (t < 8.0) {
    name = 'moment';
    prev = 'pizza';
    blend = span(t, 5.6, 5.95);
    zoom = 1 + 0.05 * Math.sin(Math.PI * span(t, 5.6, 7.8));
  } else if (t < 12.6) {
    dim = 0.4 * span(t, 9.6, 10.4);
  } else if (t < 22.4) {
    alpha = mix(1, 0.22, span(t, 12.6, 13.0));
    dim = 0.4;
  } else {
    name = 'talk';
    prev = 'moment';
    blend = span(t, 22.6, 23.6);
    alpha = mix(0.22, 1, span(t, 22.4, 23.4));
    dim = 0.4 * (1 - span(t, 22.6, 23.6));
  }
  const r = Math.max(6, L.U * 0.7);
  path(ctx, { fill: SURFACE, stroke: LINE, width: 1.2, alpha }, () => box(ctx, f.x, f.y, f.w, f.h, r));
  if (prev && blend < 1) photo(ctx, s, prev, f.x, f.y, f.w, f.h, { r, alpha, dim });
  photo(ctx, s, name, f.x, f.y, f.w, f.h, { r, alpha: alpha * blend, zoom, fx: FACE.x, fy: FACE.y, dim });
  if (t >= 5.6 && t < 8.6) {
    const on = span(t, 5.6, 6.0) * (1 - span(t, 8.2, 8.6));
    path(ctx, { stroke: VIOLET, width: 2, alpha: on, shadow: 14 }, () => box(ctx, f.x, f.y, f.w, f.h, r));
  }
  const named = t < 22.4 ? 1 - span(t, 12.6, 12.9) : span(t, 23.0, 23.6);
  pill(ctx, 'Last night\u2019s stream', f.x + fs * 0.7, f.y + fs * 1.5, { size: fs * 0.85, color: INK, alpha: alpha * 0.95 * named });
  if (t >= 3.6 && t < 5.6) {
    const v = span(t, 3.9, 4.3) * (1 - span(t, 5.3, 5.6));
    pill(ctx, 'Skipped', f.x + f.w / 2, f.y + f.h / 2, { size: fs * 1.1, color: MUTED, alpha: v, align: 'center', strike: true });
  }
  return { r };
}

function drawTrack(ctx, s, L, t) {
  const { track: k, fs } = L;
  const alpha = 1 - span(t, 12.6, 13.1);
  if (alpha <= 0.002) return;
  const N = SEGMENTS.length;
  const gap = Math.max(2, k.w * 0.006);
  const sw = (k.w - gap * (N - 1)) / N;
  const head = t < 3.6 ? (t / 3.6) * 0.999 : t < 5.6 ? 0.45 : 0.85;
  const skipOn = span(t, 3.9, 4.4);
  const findOn = span(t, 5.8, 6.3);
  for (let i = 0; i < N; i += 1) {
    const x = k.x + i * (sw + gap);
    const played = t >= 3.6 || i / N <= head;
    const skipped = (i === 0 || i === 4) ? skipOn : 0;
    photo(ctx, s, SEGMENTS[i], x, k.y, sw, k.h, { r: 3, alpha, dim: played ? 0.35 + skipped * 0.5 : 0.75 });
    if (skipped > 0) path(ctx, { stroke: MUTED, width: 1.2, alpha: alpha * skipped }, () => { ctx.moveTo(x + 2, k.y + k.h / 2); ctx.lineTo(x + sw - 2, k.y + k.h / 2); });
    const found = (i === 6 || i === 8) ? findOn : 0;
    if (found > 0) path(ctx, { stroke: VIOLET, width: 2, alpha: alpha * found, shadow: 10 }, () => box(ctx, x - 1, k.y - 1, sw + 2, k.h + 2, 4));
  }
  if (t < 5.6) {
    const hx = k.x + head * k.w;
    path(ctx, { stroke: ACCENT, width: 2, alpha, shadow: 8 }, () => { ctx.moveTo(hx, k.y - 4); ctx.lineTo(hx, k.y + k.h + 4); });
  }
  const tagY = k.y + k.h + fs * 1.25;
  const centre = (i) => clamp(k.x + i * (sw + gap) + sw / 2, k.x + fs * 2.5, k.x + k.w - fs * 2.5);
  const skipTags = skipOn * (1 - span(t, 5.4, 5.8)) * alpha;
  for (const tag of SKIPPED) pill(ctx, tag.text, centre(tag.at), tagY, { size: fs * 0.85, color: MUTED, alpha: skipTags, align: 'center', strike: true, weight: 500 });
  FOUND.forEach((tag, i) => pill(ctx, tag.text, centre(tag.at), tagY + i * fs * 2.1, { size: fs * 0.85, color: ACCENT, stroke: VIOLET, alpha: findOn * alpha * (1 - span(t, 9.6, 10.2)), align: 'center' }));
}

function drawPhoneShell(ctx, rect, alpha, lit = false) {
  const r = rect.w * 0.09;
  path(ctx, { fill: SURFACE, stroke: lit ? VIOLET : LINE, width: 1.5, alpha, shadow: lit ? 16 : 0 }, () => box(ctx, rect.x, rect.y, rect.w, rect.h, r));
  return r;
}

function drawCaptions(ctx, rect, t, fs, alpha) {
  if (alpha <= 0.002) return;
  const word = Math.floor(Math.max(0, t - 10.6) / 0.38) % CAPTION.length;
  const group = CAPTION_GROUP[word];
  const words = CAPTION.map((text, i) => ({ text, i })).filter((w) => CAPTION_GROUP[w.i] === group);
  const size = Math.max(9, rect.w * 0.095);
  const widths = words.map((w) => textWidth(w.text, size, 800));
  const total = widths.reduce((a, b) => a + b, 0) + size * 0.35 * (words.length - 1);
  let x = rect.x + rect.w / 2 - total / 2;
  const y = rect.y + rect.h * 0.72;
  words.forEach((w, i) => {
    const on = w.i === word;
    const pop = on ? easeOutBack(span((Math.max(0, t - 10.6) % 0.38), 0, 0.16)) : 1;
    label(ctx, w.text, x + widths[i] / 2, y - (on ? (pop - 1) * size * 0.4 : 0), { size: size * (on ? 1.06 : 1), color: on ? ACCENT : INK, align: 'center', weight: 800, alpha, shadow: 6 });
    x += widths[i] + size * 0.35;
  });
}

function drawHook(ctx, rect, t, alpha) {
  const v = easeOutBack(span(t, 10.4, 10.8));
  if (v <= 0.01 || alpha <= 0.002) return;
  const size = Math.max(7, rect.w * 0.066);
  const w = rect.w * 0.86;
  const h = size * 3.4;
  const x = rect.x + (rect.w - w) / 2;
  const y = rect.y + rect.h * 0.08 - (1 - v) * size;
  path(ctx, { fill: INK, alpha: alpha * clamp01(v) }, () => box(ctx, x, y, w, h, size * 0.5));
  HOOK.forEach((line, i) => label(ctx, line, rect.x + rect.w / 2, y + size * (1.05 + i * 1.3), { size, color: SURFACE, align: 'center', weight: 700, alpha: alpha * clamp01(v) }));
}

/** Keep or skip, under a clip. `at` is when the choice is tapped; `keep` says which. */
function drawChoice(ctx, rect, t, { at, keep, fs, h, alpha }) {
  if (alpha <= 0.002) return;
  const gap = Math.max(4, rect.w * 0.05);
  const bw = (rect.w - gap) / 2;
  const y = rect.y + rect.h + Math.max(4, h * 0.25);
  const done = span(t, at, at + 0.2);
  const size = Math.min(fs, h * 0.45);
  [['Skip', false], ['Keep', true]].forEach(([text, isKeep], i) => {
    const x = rect.x + i * (bw + gap);
    const chosen = isKeep === keep ? done : 0;
    const colour = isKeep ? PINE : MUTED;
    path(ctx, { fill: SURFACE, stroke: chosen > 0.5 ? colour : LINE, width: 1.3, alpha }, () => box(ctx, x, y, bw, h, h / 2));
    if (chosen > 0) path(ctx, { fill: colour, alpha: alpha * 0.22 * chosen }, () => box(ctx, x, y, bw, h, h / 2));
    label(ctx, text, x + bw / 2, y + h / 2, { size, color: chosen > 0.5 ? colour : INK, align: 'center', weight: 600, alpha });
    if (isKeep === keep) tap(ctx, x + bw / 2, y + h / 2, h * 0.7, span(t, at - 0.05, at + 0.5));
  });
}

function drawRows(ctx, s, L, t, run) {
  const { rows, fs } = L;
  const on = span(t, 15.2, 15.7) * (1 - span(t, 22.6, 23.4));
  if (on <= 0.002) return;
  const results = span(t, 17.6, 19.4);
  label(ctx, results > 0 ? 'Watched to the end, sample shapes' : 'Posted', rows[0].x, rows[0].y - fs * 0.95, { size: fs * 0.85, color: MUTED, alpha: on });
  rows.forEach((row, i) => {
    const rowOn = on * span(t, 15.2 + i * 0.12, 15.6 + i * 0.12);
    path(ctx, { fill: SURFACE, stroke: LINE, width: 1.2, alpha: rowOn }, () => box(ctx, row.x, row.y, row.w, row.h, row.h * 0.3));
    label(ctx, PLATFORMS[i], row.x + fs * 0.8, row.y + row.h / 2, { size: fs, color: INK, weight: 600, alpha: rowOn });
    // Posted clips pile up stream after stream: more clips out, never a promised number.
    const th = row.h * 0.74;
    const tw = (th * 9) / 16;
    const arrive = 15.4 + i * 0.35 + 0.8;
    const count = run - 1 + (t >= arrive ? 1 : 0);
    for (let k = 0; k < count; k += 1) {
      const x = row.x + row.w - fs * 0.6 - tw - k * (tw * L.stack);
      photo(ctx, s, 'clip', x, row.y + (row.h - th) / 2, tw, th, { r: 2, alpha: rowOn * (k === 0 ? 1 : 0.7), fy: 0.35 });
    }
    if (t >= arrive) tick(ctx, row.x + row.w - fs * 0.6 - tw - Math.max(0, count - 1) * tw * L.stack - fs * 1.1, row.y + row.h / 2, fs * 0.5, rowOn * span(t, arrive, arrive + 0.25));
    if (results <= 0) return;
    const bx = row.x + fs * (L.narrow ? 4.4 : 5.4);
    const bwMax = Math.max(10, row.x + row.w - bx - fs * 2.6 - tw - (STORY_RUN - 1) * tw * L.stack);
    const bh = row.h * 0.36;
    const by = row.y + (row.h - bh) / 2;
    const sample = SAMPLE[i];
    if (sample === null && L.narrow) {
      // Too small for an outline with words inside it: the words alone say it.
      label(ctx, 'No report yet', bx, row.y + row.h / 2, { size: fs * 0.8, color: MUTED, alpha: rowOn * results });
    } else if (sample === null) {
      path(ctx, { stroke: MUTED, width: 1.2, alpha: rowOn * results, dash: [3, 4] }, () => box(ctx, bx, by, bwMax, bh, bh / 2));
      label(ctx, 'No report yet', bx + bwMax / 2, row.y + row.h / 2, { size: fs * 0.8, color: MUTED, align: 'center', alpha: rowOn * results });
    } else {
      path(ctx, { fill: LINE, alpha: rowOn * results }, () => box(ctx, bx, by, bwMax, bh, bh / 2));
      const fill = easeOutCubic(span(t, 17.8 + i * 0.25, 19.0 + i * 0.25));
      path(ctx, { fill: VIOLET_SOFT, alpha: rowOn * results, shadow: 6 }, () => box(ctx, bx, by, Math.max(bh, bwMax * sample * fill), bh, bh / 2));
    }
  });
}

/** The kept clip travels to each platform row. */
function drawFlights(ctx, s, L, t) {
  const { phone, rows } = L;
  rows.forEach((row, i) => {
    const v = span(t, 15.4 + i * 0.35, 16.2 + i * 0.35);
    if (v <= 0 || v >= 1) return;
    const e = easeInOutCubic(v);
    const th = row.h * 0.74;
    const tw = (th * 9) / 16;
    const x0 = phone.x + phone.w * 0.3;
    const y0 = phone.y + phone.h * 0.5;
    const x1 = row.x + row.w - L.fs * 0.6 - tw;
    const y1 = row.y + (row.h - th) / 2;
    const cx = mix(x0, x1, 0.5);
    const cy = Math.min(y0, y1) - L.U * 4;
    const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1;
    const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1;
    const grow = mix(2.2, 1, e);
    glow(ctx, x + tw / 2, y + th / 2, th * 1.2, 0.35 * (1 - e));
    photo(ctx, s, 'clip', x, y, tw * grow, th * grow, { r: 3, fy: 0.35 });
  });
}

function drawCard(ctx, L, t, lesson, slot) {
  const { frame: f, fs } = L;
  const on = span(t, 19.9, 20.3) * (1 - span(t, 21.5, 21.8));
  if (on > 0.002) {
    const note = 'Nothing changes until you do';
    const w = Math.min(f.w * 0.94, Math.max(textWidth(lesson, fs * 1.15, 700), textWidth(note, fs * 0.75)) + fs * 2);
    const lessonSize = Math.min(fs * 1.15, (w - fs * 2) / textWidth(lesson, 1, 700));
    const h = fs * 8.2;
    const x = f.x + (f.w - w) / 2;
    const y = f.y + Math.max(0, (f.h - h) / 2) + (1 - easeOutBack(span(t, 19.9, 20.4))) * fs;
    path(ctx, { fill: SURFACE, stroke: VIOLET, width: 1.4, alpha: on, shadow: 14 }, () => box(ctx, x, y, w, h, fs * 0.7));
    label(ctx, 'Try next', x + fs, y + fs * 1.3, { size: fs * 0.85, color: MUTED, alpha: on });
    label(ctx, lesson, x + fs, y + fs * 2.9, { size: lessonSize, color: INK, weight: 700, alpha: on });
    label(ctx, note, x + fs, y + fs * 4.5, { size: fs * 0.75, color: MUTED, alpha: on });
    const bw = fs * 6;
    const bh = fs * 1.9;
    const bx = x + fs;
    const by = y + fs * 5.5;
    const done = span(t, 20.9, 21.1);
    path(ctx, { fill: SURFACE, stroke: PINE, width: 1.3, alpha: on }, () => box(ctx, bx, by, bw, bh, bh / 2));
    if (done > 0) path(ctx, { fill: PINE, alpha: on * 0.22 * done }, () => box(ctx, bx, by, bw, bh, bh / 2));
    label(ctx, 'Approve', bx + bw / 2, by + bh / 2, { size: fs * 0.9, color: PINE, align: 'center', weight: 600, alpha: on });
    tap(ctx, bx + bw / 2, by + bh / 2, bh * 0.7, span(t, 20.85, 21.4));
    if (done > 0) tick(ctx, bx + bw + fs * 1.1, by + bh / 2, fs * 0.6, on * done);
  }
  // The approved lesson flies up to the shelf.
  const fly = span(t, 21.4, 22.2);
  if (fly > 0 && fly < 1 && slot) {
    const e = easeInOutCubic(fly);
    const x = mix(f.x + f.w * 0.3, slot.x, e);
    const y = mix(f.y + f.h * 0.5, slot.y, e);
    glow(ctx, x + fs * 3, y, fs * 3, 0.3 * (1 - e));
    pill(ctx, lesson, x, y, { size: fs * 0.85, color: ACCENT, stroke: VIOLET });
  }
}

function story(ctx, s) {
  const L = storyLayout(s.w, s.h);
  const state = storyState(s.t);
  const pass = Math.floor(s.t / STORY_PERIOD);
  const t = s.t - pass * STORY_PERIOD;
  const run = state.loop;
  const { phone, fs, crop } = L;

  // What it has learned so far this run. It clears only when a new run starts.
  const lessons = run - 1 + (t >= 22.2 ? 1 : 0);
  const slots = drawShelf(ctx, L, lessons, run === STORY_RUN ? 1 - span(t, 23.2, 24) : 1);

  const { r: frameR } = drawFrame(ctx, s, L, t);
  drawTrack(ctx, s, L, t);

  // The empty clip waits on the right until a moment is found.
  const waiting = 1 - span(t, 8.8, 9.2);
  const back = span(t, 22.6, 23.4);
  const empty = Math.max(t < 9.2 ? waiting : 0, back);
  if (empty > 0.002) {
    const pr = phone.w * 0.09;
    path(ctx, { fill: SURFACE, stroke: MUTED, width: 1.2, alpha: empty * 0.7, dash: [4, 6] }, () => box(ctx, phone.x, phone.y, phone.w, phone.h, pr));
    label(ctx, 'Your clip', phone.x + phone.w / 2, phone.y + phone.h / 2, { size: fs, color: MUTED, align: 'center', alpha: empty * 0.8 });
  }

  // Cut: a vertical crop locks on to the face, lifts out of the stream and becomes the clip.
  if (t >= 8 && t < 8.9) {
    const draw = easeOutCubic(span(t, 8.0, 8.5));
    path(ctx, { stroke: ACCENT, width: 2, alpha: draw, dash: [6, 5], dashOffset: -t * 30, shadow: 10 }, () => box(ctx, crop.x, crop.y, crop.w, crop.h, frameR * 0.6));
    const fx = L.frame.x + L.frame.w * FACE.x;
    const fy = L.frame.y + L.frame.h * FACE.y;
    const b = L.frame.w * mix(0.12, 0.07, easeOutBack(span(t, 8.15, 8.6)));
    const on = span(t, 8.15, 8.35);
    path(ctx, { stroke: PINE, width: 2, alpha: on }, () => {
      const q = b * 0.35;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(fx + sx * b, fy + sy * b - sy * q);
        ctx.lineTo(fx + sx * b, fy + sy * b);
        ctx.lineTo(fx + sx * b - sx * q, fy + sy * b);
      }
    });
    pill(ctx, 'Follows your face', crop.x + crop.w / 2, crop.y + crop.h - fs * 1.4, { size: fs * 0.8, color: PINE, stroke: PINE, alpha: on, align: 'center' });
  }
  if (t >= 8.8 && t < 23.4) {
    const lift = easeInOutCubic(span(t, 8.8, 9.9));
    const rect = lerpRect(crop, phone, lift);
    const landed = span(t, 9.8, 10.3);
    const out = 1 - span(t, 22.6, 23.4);
    const lit = t >= 9.9 && t < 12.6;
    glow(ctx, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.h * 0.7, 0.18 * (1 - landed) * out);
    const pr = drawPhoneShell(ctx, rect, out, lit);
    const region = { x0: (crop.x - L.frame.x) / L.frame.w, x1: (crop.x + crop.w - L.frame.x) / L.frame.w, y0: 0, y1: 1 };
    if (landed < 1) photo(ctx, s, 'moment', rect.x, rect.y, rect.w, rect.h, { r: pr, region, alpha: out });
    if (landed > 0) photo(ctx, s, 'clip', rect.x, rect.y, rect.w, rect.h, { r: pr, alpha: out * landed, fy: 0.4 });
    if (lift > 0.98) {
      drawHook(ctx, rect, t, out);
      drawCaptions(ctx, rect, t, fs, out * span(t, 10.6, 10.8));
    }
    if (lift < 1) path(ctx, { stroke: ACCENT, width: 2, alpha: (1 - lift) * out, shadow: 10 }, () => box(ctx, rect.x, rect.y, rect.w, rect.h, pr));
    // Pick: you keep it.
    const choice = span(t, 12.6, 12.9) * (1 - span(t, 15.0, 15.4));
    drawChoice(ctx, phone, t, { at: 13.3, keep: true, fs, h: L.btnH, alpha: choice * out });
    if (t >= 13.4) tick(ctx, phone.x + phone.w - fs * 1.4, phone.y + fs * 1.4, fs * 0.8, span(t, 13.4, 13.7) * out);
  }

  // Pick: the other moments it found wait for you too. One is kept, one is skipped.
  if (t >= 12.6 && t < 15.4) {
    const { frame: f } = L;
    const gap = Math.max(8, L.U);
    const avail = (L.narrow ? L.shelf.y - fs * 2 : L.track.y + L.track.h) - f.y - L.btnH - gap;
    const mh = Math.max(20, Math.min(avail, (((f.w - gap) / 2) * 16) / 9));
    const mw = (mh * 9) / 16;
    const left = f.x + (f.w - (mw * 2 + gap)) / 2;
    [['clipTalk', true, 13.9], ['clipPlay', false, 14.5]].forEach(([name, keep, at], i) => {
      const pop = easeOutBack(span(t, 12.7 + i * 0.15, 13.15 + i * 0.15));
      const gone = keep ? span(t, 15.0, 15.4) : span(t, at + 0.25, at + 0.7);
      const alpha = clamp01(pop) * (1 - gone);
      if (alpha <= 0.002) return;
      const drop = keep ? 0 : easeOutCubic(gone) * L.U * 3;
      const rect = { x: left + i * (mw + gap), y: f.y + drop, w: mw, h: mh * clamp(pop, 0.6, 1.1) };
      const pr = drawPhoneShell(ctx, rect, alpha);
      photo(ctx, s, name, rect.x, rect.y, rect.w, rect.h, { r: pr, alpha, dim: keep ? 0 : 0.5 * span(t, at, at + 0.3), fy: 0.35 });
      drawChoice(ctx, rect, t, { at, keep, fs: fs * 0.9, h: L.btnH * 0.86, alpha });
      if (keep && t >= at + 0.1) tick(ctx, rect.x + rect.w - fs * 1.1, rect.y + fs * 1.1, fs * 0.6, span(t, at + 0.1, at + 0.4) * alpha);
    });
  }

  drawRows(ctx, s, L, t, run);
  drawFlights(ctx, s, L, t);
  drawCard(ctx, L, t, LESSONS[run - 1], slots[run - 1]);
  return state;
}
story.contours = false;
story.still = 14.05;

/** A station is the story windowed to one stage, held for a moment at the end, then repeated. */
function station(family, hold = 1.4) {
  const from = FAMILY_AT[family];
  const to = family === 4 ? 22.3 : FAMILY_AT[family + 1];
  const len = to - from;
  const paint = (ctx, s) => {
    const local = cycle(s.t, len + hold) * (len + hold);
    story(ctx, { ...s, t: from + Math.min(local, len - 0.05) });
  };
  paint.contours = false;
  paint.still = len - 0.05;
  paint.window = [from, to];
  return paint;
}

/* ---------------------------------------------------------------------------------------------
 * The hero: clips A/B tested, round after round (growth_loop.py). Each round, two versions of one
 * clip go out that differ in exactly one thing (SUPPORTED_RULES: the hook, the length, the
 * captions). The one people watched longer wins, what it shows lands in "What works" with your
 * approval, and the channel line steps up. The winner is not always B: round two keeps A.
 * ------------------------------------------------------------------------------------------- */

export const AB_ROUND = 6.5;
export const AB_TAIL = 1.5;
export const AB_ROUNDS = [
  { photo: 'moment', clip: 'clip', testing: 'Testing the hook', hooks: ['Watch till the end', 'He did NOT see that coming'], words: ['NO', 'WAY'], winner: 1, lesson: 'Story hooks', fill: [0.4, 0.8] },
  { photo: 'talk', clip: 'clipTalk', testing: 'Testing the length', hooks: ['Chat called it first', 'Chat called it first'], tags: ['Short', 'Long'], words: ['CHAT', 'KNEW'], winner: 0, lesson: 'Short clips', fill: [0.82, 0.48] },
  { photo: 'play', clip: 'clipPlay', testing: 'Testing the captions', hooks: ['One more try', 'One more try'], captions: ['big', 'small'], words: ['ONE', 'MORE'], winner: 0, lesson: 'Big captions', fill: [0.86, 0.54] },
];
export const AB_PERIOD = AB_ROUND * AB_ROUNDS.length + AB_TAIL;
const AB_DECIDE = 3.6;
const AB_LAND = 4.6;
const CHANNEL = [0.1, 0.34, 0.57, 0.88];

/** Where the loop is: which round, how far into it, what has been learned, how far the line has risen. */
export function abState(t) {
  const local = cycle(t, AB_PERIOD) * AB_PERIOD;
  const round = Math.min(AB_ROUNDS.length - 1, Math.floor(local / AB_ROUND));
  const rt = local - round * AB_ROUND;
  const learned = round + (rt >= AB_LAND ? 1 : 0);
  const chart = round + easeInOutCubic(span(rt, 4.0, 4.9));
  const reset = 1 - span(local, AB_PERIOD - 0.8, AB_PERIOD - 0.15);
  return { round, rt, learned, chart, reset, decided: rt >= AB_DECIDE, winner: AB_ROUNDS[round].winner };
}

export function abLayout(w, h) {
  const narrow = w < h * 1.2;
  const fs = clamp(narrow ? w / 30 : w / 80, 9, 15);
  const M = Math.max(10, Math.min(w, h) * 0.04);
  const below = fs * 3.9;
  if (!narrow) {
    const pillH = fs * 3;
    const frame = { x: M, w: w * 0.21 };
    frame.h = (frame.w * 9) / 16;
    const col = w * 0.045;
    const pwRoom = (w - 2 * M - frame.w - 2 * col - w * 0.17) / 2.18;
    const ph = Math.max(40, Math.min(h * 0.7, h - 2 * M - pillH - below, (pwRoom * 16) / 9));
    const pw = (ph * 9) / 16;
    const gap = pw * 0.18;
    const top = Math.max(M, (h - (pillH + ph + below)) / 2);
    const px = M + frame.w + col;
    const py = top + pillH;
    const phones = [{ x: px, y: py, w: pw, h: ph }, { x: px + pw + gap, y: py, w: pw, h: ph }];
    frame.y = py + ph / 2 - frame.h / 2;
    const sx = px + pw * 2 + gap + col;
    const shelf = { x: sx, y: py, w: w - M - sx, row: fs * 2.3, horizontal: false };
    const chartY = py + fs * 2.2 + 3 * shelf.row + fs * 0.6;
    const chart = { x: sx, y: chartY, w: shelf.w, h: Math.max(fs * 4, py + ph - chartY) };
    return { w, h, fs, M, narrow, frame, phones, shelf, chart, pill: { x: px + pw + gap / 2, y: top + pillH * 0.42 } };
  }
  const frame = { x: M, y: M, w: w * 0.42 };
  frame.h = (frame.w * 9) / 16;
  const chart = { x: M, w: w - 2 * M, h: h * 0.13 };
  chart.y = h - M - chart.h;
  const shelf = { x: M, y: chart.y - fs * 1.4, w: w - 2 * M, row: 0, horizontal: true };
  const py = M + frame.h + fs * 1.3;
  const ph = Math.max(40, shelf.y - fs * 1.1 - below - py);
  const pw = Math.min((ph * 9) / 16, (w - 2 * M) / 2.3);
  const gap = pw * 0.14;
  const px = (w - (pw * 2 + gap)) / 2;
  const phones = [{ x: px, y: py, w: pw, h: (pw * 16) / 9 }, { x: px + pw + gap, y: py, w: pw, h: (pw * 16) / 9 }];
  const right = frame.x + frame.w;
  return { w, h, fs, M, narrow, frame, phones, shelf, chart, pill: { x: right + (w - M - right) / 2, y: frame.y + frame.h / 2 } };
}

/** Split text into at most two lines that fit `width`. */
function wrap(text, size, width, weight) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (textWidth(next, size, weight) <= width || !lines[lines.length - 1]) lines[lines.length - 1] = next;
    else if (lines.length < 2) lines.push(word);
    else lines[1] = `${lines[1]} ${word}`;
  }
  return lines;
}

function drawVersion(ctx, s, L, rect, round, side, t, alpha, dim) {
  const R = AB_ROUNDS[round];
  const lit = t >= AB_DECIDE && R.winner === side;
  const r = drawPhoneShell(ctx, rect, alpha, lit);
  photo(ctx, s, R.clip, rect.x, rect.y, rect.w, rect.h, { alpha, r, dim });
  // The hook on top.
  const hook = span(t, 0.9, 1.2);
  if (hook > 0) {
    const size = Math.max(7, rect.w * 0.07);
    const bw = rect.w * 0.86;
    const lines = wrap(R.hooks[side], size, bw - size, 700);
    const bh = size * (1.2 + lines.length * 1.3);
    const bx = rect.x + (rect.w - bw) / 2;
    const by = rect.y + rect.h * 0.07;
    path(ctx, { fill: INK, alpha: alpha * hook }, () => box(ctx, bx, by, bw, bh, size * 0.5));
    lines.forEach((line, i) => label(ctx, line, rect.x + rect.w / 2, by + size * (1.25 + i * 1.3), { size, color: SURFACE, align: 'center', weight: 700, alpha: alpha * hook }));
  }
  // Captions, word by word. Round three tests big captions against small ones.
  const big = (R.captions?.[side] ?? 'big') === 'big';
  const size = big ? Math.max(8, rect.w * 0.13) : Math.max(6, rect.w * 0.07);
  const weight = big ? 800 : 600;
  const on = Math.floor(Math.max(0, t - 1.1) / 0.45) % R.words.length;
  const widths = R.words.map((word) => textWidth(word, size, weight));
  let x = rect.x + rect.w / 2 - (widths.reduce((a, b) => a + b, 0) + size * 0.3 * (widths.length - 1)) / 2;
  const caps = span(t, 1.1, 1.3);
  R.words.forEach((word, i) => {
    label(ctx, word, x + widths[i] / 2, rect.y + rect.h * 0.7, { size, color: big && i === on ? ACCENT : INK, align: 'center', weight, alpha: alpha * caps, shadow: 6 });
    x += widths[i] + size * 0.3;
  });
  // Round two tests the length, so each version says how long it is.
  if (R.tags) pill(ctx, R.tags[side], rect.x + rect.w / 2, rect.y + rect.h * 0.85, { size: Math.max(7, L.fs * 0.8), align: 'center', alpha: alpha * caps });
}

function drawMeter(ctx, L, rect, round, side, t, alpha) {
  const R = AB_ROUNDS[round];
  const { fs } = L;
  const y = rect.y + rect.h + fs * 1.7;
  const won = t >= AB_DECIDE && R.winner === side;
  path(ctx, { fill: SURFACE, stroke: won ? PINE : LINE, width: 1.2, alpha }, () => ctx.arc(rect.x + fs * 0.75, y, fs * 0.75, 0, Math.PI * 2));
  label(ctx, side ? 'B' : 'A', rect.x + fs * 0.75, y, { size: fs * 0.85, color: won ? PINE : INK, align: 'center', weight: 700, alpha });
  const bx = rect.x + fs * 2;
  const bw = rect.w - fs * 2;
  const bh = Math.max(4, fs * 0.45);
  path(ctx, { fill: LINE, alpha }, () => box(ctx, bx, y - bh / 2, bw, bh, bh / 2));
  const v = easeInOutCubic(span(t, 1.3, 3.4)) * R.fill[side];
  if (v > 0.002) path(ctx, { fill: won ? PINE : VIOLET, alpha }, () => box(ctx, bx, y - bh / 2, bw * v, bh, bh / 2));
}

function drawShelfAB(ctx, L, learned, alpha, landing) {
  const { shelf, fs } = L;
  const size = shelf.horizontal ? fs * 0.8 : fs * 0.9;
  label(ctx, 'What works', shelf.x, shelf.horizontal ? shelf.y : shelf.y + fs * 0.7, { size: fs * 0.85, color: MUTED, alpha });
  const slots = [];
  let x = shelf.x + textWidth('What works', fs * 0.85) + fs * 0.7;
  AB_ROUNDS.forEach((R, i) => {
    const w = textWidth(R.lesson, size, 600) + size * 1.5;
    const slot = shelf.horizontal ? { x, y: shelf.y } : { x: shelf.x, y: shelf.y + fs * 2.2 + i * shelf.row };
    slots.push(slot);
    x += w + fs * 0.5;
    if (i < learned && !(landing && i === learned - 1)) pill(ctx, R.lesson, slot.x, slot.y, { size, color: ACCENT, stroke: VIOLET, alpha });
  });
  return { slots, size };
}

function drawChannel(ctx, L, progress, alpha) {
  const { chart, fs } = L;
  if (alpha <= 0.002) return;
  path(ctx, { fill: SURFACE, stroke: LINE, width: 1.2, alpha }, () => box(ctx, chart.x, chart.y, chart.w, chart.h, fs * 0.6));
  label(ctx, 'Your channel', chart.x + fs * 0.8, chart.y + fs * 1.2, { size: fs * 0.8, color: MUTED, alpha });
  const pad = fs * 0.9;
  const x0 = chart.x + pad;
  const x1 = chart.x + chart.w - pad;
  const yTop = chart.y + fs * 2.2;
  const y0 = chart.y + chart.h - pad;
  const at = (u) => {
    const seg = Math.min(2, Math.floor(u * 3));
    const f = u * 3 - seg;
    const v = mix(CHANNEL[seg], CHANNEL[seg + 1], f * f * (3 - 2 * f)) + 0.02 * Math.sin(u * 29);
    return { x: mix(x0, x1, u), y: mix(y0, yTop, clamp01(v)) };
  };
  const end = clamp01(progress / 3);
  const n = Math.max(2, Math.ceil(end * 48));
  const pts = Array.from({ length: n + 1 }, (_, i) => at((end * i) / n));
  path(ctx, { fill: VIOLET, alpha: alpha * 0.14 }, () => {
    ctx.moveTo(pts[0].x, y0);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, y0);
    ctx.closePath();
  });
  path(ctx, { stroke: VIOLET_SOFT, width: 2, alpha }, () => { ctx.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y)); });
  const tip = pts[pts.length - 1];
  glow(ctx, tip.x, tip.y, fs * 1.4, alpha * 0.6);
  path(ctx, { fill: ACCENT, alpha }, () => ctx.arc(tip.x, tip.y, Math.max(2.5, fs * 0.28), 0, Math.PI * 2));
}

function abtest(ctx, s) {
  const L = abLayout(s.w, s.h);
  const state = abState(s.t);
  const { round, rt, learned, chart, reset } = state;
  const R = AB_ROUNDS[round];
  const { frame, phones, fs } = L;

  // Your stream, where every round starts.
  const fr = fs * 0.6;
  photo(ctx, s, R.photo, frame.x, frame.y, frame.w, frame.h, { r: fr });
  if (rt < 0.35 && round > 0) photo(ctx, s, AB_ROUNDS[round - 1].photo, frame.x, frame.y, frame.w, frame.h, { r: fr, alpha: 1 - span(rt, 0, 0.35) });
  path(ctx, { stroke: LINE, width: 1.2 }, () => box(ctx, frame.x, frame.y, frame.w, frame.h, fr));
  pill(ctx, 'Your stream', frame.x + fs * 0.6, frame.y + fs * 1.3, { size: fs * 0.75, alpha: 0.95 });
  const srcH = frame.h * 0.9;
  const src = { x: frame.x + frame.w * 0.6 - (srcH * 9) / 32, y: frame.y + frame.h * 0.05, w: (srcH * 9) / 16, h: srcH };
  const pick = span(rt, 0, 0.15) * (1 - span(rt, 0.5, 0.8));
  if (pick > 0) path(ctx, { stroke: ACCENT, width: 1.5, alpha: pick, dash: [4, 4] }, () => box(ctx, src.x, src.y, src.w, src.h, 4));

  // What it is testing this round.
  pill(ctx, R.testing, L.pill.x, L.pill.y, { size: fs * 0.9, color: INK, stroke: VIOLET, align: 'center', alpha: span(rt, 0.2, 0.6) * (1 - span(rt, 5.8, 6.3)) });

  // Two versions fly out of the stream, race, and one wins.
  const last = round === AB_ROUNDS.length - 1;
  const out = last ? 1 - span(rt, AB_ROUND + AB_TAIL - 0.9, AB_ROUND + AB_TAIL - 0.3) : 1 - span(rt, 5.8, 6.4);
  [0, 1].forEach((side) => {
    const fly = easeInOutCubic(span(rt, 0.15 + side * 0.15, 0.85 + side * 0.15));
    if (fly <= 0) return;
    const rect = lerpRect(src, phones[side], fly);
    const lost = state.decided && R.winner !== side ? span(rt, AB_DECIDE, AB_DECIDE + 0.4) : 0;
    const alpha = Math.min(1, fly * 1.5) * out * (1 - lost * 0.55);
    drawVersion(ctx, s, L, rect, round, side, rt, alpha, lost * 0.3);
    if (fly >= 1) drawMeter(ctx, L, rect, round, side, rt, alpha);
  });
  const meters = span(rt, 1.0, 1.3) * out;
  label(ctx, 'How long people watched', (phones[0].x + phones[1].x + phones[1].w) / 2, phones[0].y + phones[0].h + fs * 3.3, { size: fs * 0.8, color: MUTED, align: 'center', alpha: meters });
  if (state.decided) {
    const win = phones[R.winner];
    pill(ctx, 'Winner', win.x + win.w / 2, win.y + win.h, { size: fs * 0.85, color: PINE, stroke: PINE, align: 'center', alpha: span(rt, AB_DECIDE, AB_DECIDE + 0.25) * out });
  }

  // What won goes on the shelf when you approve it, and the channel line steps up.
  const landing = rt >= 4.0 && rt < AB_LAND;
  const { slots, size } = drawShelfAB(ctx, L, landing ? learned + 1 : learned, reset, landing);
  if (rt >= 4.0) {
    const slot = slots[round];
    const win = phones[R.winner];
    const v = easeInOutCubic(span(rt, 4.0, AB_LAND));
    const w = textWidth(R.lesson, size, 600) + size * 1.5;
    const x = mix(win.x + win.w / 2 - w / 2, slot.x, v);
    const y = mix(win.y + win.h * 0.5, slot.y, v);
    if (rt < AB_LAND) pill(ctx, R.lesson, x, y, { size, color: ACCENT, stroke: VIOLET, alpha: reset });
    const tapAt = span(rt, AB_LAND - 0.05, AB_LAND + 0.5);
    tap(ctx, slot.x + w / 2, slot.y, size * 1.6, tapAt);
    if (rt >= AB_LAND) tick(ctx, slot.x + w + size * 0.9, slot.y, size * 0.6, reset * (1 - span(rt, 5.6, 6.2)));
  }
  drawChannel(ctx, L, chart, reset);
  return state;
}
abtest.contours = false;
abtest.still = AB_ROUND * 2 + 5;

export const SCENES = { abtest, story, find: station(0), cut: station(1), pick: station(2), post: station(3), learn: station(4) };

/**
 * Mount one scene on a host element. Returns null when the scene name is unknown, so markup can
 * never animate something this module does not actually draw.
 *
 * A painter can ask for two canvases (`layers: ['back', 'front']`): the back one goes under the
 * host's content and the front one over it, so a scene can pass behind real page content and come
 * round in front of it. An element marked `data-scene-anchor` is measured
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
  photos = {},
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
      const base = { w: width, h: height, contours, photos, app: anchorBox, layer: layers.length > 1 ? layer.name : undefined };
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
  /** Redraw now, for when something the painter uses (a photo) has just arrived. */
  const refresh = () => { if (!disposed) draw(); };
  return { dispose, setKind, refresh, get kind() { return Object.keys(scenes).find((name) => scenes[name] === paint); } };
}

/**
 * The hero's chapter rail, like the chapters on a VOD scrubber: it follows the story's beats, so
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
      if (beatText) beatText.textContent = STORY_BEATS[beat].caption;
    }
    if (state.loop !== count) {
      count = state.loop;
      if (loopText) loopText.textContent = `Stream ${count}`;
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

/** Start every photo loading once, shared by all scenes; `onLoad` fires as each one arrives. */
export function loadPhotos(sources, onLoad, make = () => new Image()) {
  const photos = {};
  for (const [name, src] of Object.entries(sources)) {
    const img = make();
    img.decoding = 'async';
    img.addEventListener('load', onLoad);
    img.src = src;
    photos[name] = img;
  }
  return photos;
}

if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
  const hosts = [...document.querySelectorAll('[data-scene]')];
  const handles = [];
  const photos = hosts.length && typeof Image === 'function'
    ? loadPhotos(PHOTOS, () => handles.forEach((handle) => handle.refresh()))
    : {};
  for (const host of hosts) {
    const rail = host.dataset.rail ? document.querySelector(host.dataset.rail) : null;
    const handle = mountScene({
      host,
      kind: host.dataset.scene,
      button: host.parentElement?.querySelector('[data-scene-toggle]'),
      report: rail ? railReporter(rail) : undefined,
      photos,
    });
    if (!handle) continue;
    handles.push(handle);
    const steps = host.dataset.steps ? [...document.querySelectorAll(host.dataset.steps)] : [];
    if (steps.length && typeof IntersectionObserver === 'function') followSteps(handle, steps);
  }
}
