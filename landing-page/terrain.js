/**
 * The 2D port of the hero shader's terrain equation (frontend/src/growth/contours.ts), so the
 * animated scenes drift over the same topographic field as the WebGL background instead of a
 * second, unrelated texture. Pure functions only: no DOM, no timers.
 */

/** Terrain units across the longer side of the canvas, as in the shader. */
export const SPAN = 3.2;
/** The calm moment of the drift used for still frames under reduced motion. */
export const STILL_AT = 41;
/** The shader draws a line every 1/9 of a terrain unit; levels share that scale. */
export const LEVEL_SCALE = 9;

const fract = (x) => x - Math.floor(x);

/** Shader grad(): a hashed gradient vector per lattice point. */
export function grad(x, y) {
  return [
    fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) * 2 - 1,
    fract(Math.sin(x * 269.5 + y * 183.3) * 43758.5453) * 2 - 1,
  ];
}

/** Shader noise(): gradient noise with a quintic fade. */
export function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const at = (dx, dy) => {
    const [gx, gy] = grad(ix + dx, iy + dy);
    return gx * (fx - dx) + gy * (fy - dy);
  };
  const lower = at(0, 0) * (1 - ux) + at(1, 0) * ux;
  const upper = at(0, 1) * (1 - ux) + at(1, 1) * ux;
  return lower * (1 - uy) + upper * uy;
}

/** Shader terrain(): two octaves over a slowly drifting warp, in terrain units. */
export function terrain(x, y, t) {
  const warpX = noise(x * 0.7 + 3.1 + t * 0.013, y * 0.7 + 7.7 + t * 0.013);
  const warpY = noise(x * 0.7 + 9.4 - t * 0.011, y * 0.7 + 1.3 - t * 0.011);
  const px = x + 0.6 * warpX;
  const py = y + 0.6 * warpY;
  const h = noise(px + t * 0.009, py - t * 0.007);
  const qx = (0.8 * px + 0.6 * py) * 2.1;
  const qy = (-0.6 * px + 0.8 * py) * 2.1;
  return h + 0.4 * noise(qx - t * 0.012, qy + t * 0.008);
}

/**
 * Marching-squares iso-lines of the field in CSS pixels. Every fifth line is "major" and drawn
 * heavier, the way a survey map reads, matching the shader's index test.
 */
export function contourSegments({ width, height, time, step = 20, levels = 10 }) {
  if (!(width > 0) || !(height > 0)) return [];
  const unit = Math.max(width, height) / SPAN;
  const cols = Math.max(1, Math.ceil(width / step));
  const rows = Math.max(1, Math.ceil(height / step));
  const grid = [];
  for (let row = 0; row <= rows; row += 1) {
    const values = [];
    for (let col = 0; col <= cols; col += 1) {
      const x = (col * step - width / 2) / unit;
      const y = (height / 2 - row * step) / unit;
      values.push(terrain(x, y, time) * LEVEL_SCALE);
    }
    grid.push(values);
  }
  const lines = [];
  for (let level = -levels; level <= levels; level += 1) {
    const segments = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const corners = [
          [col * step, row * step],
          [(col + 1) * step, row * step],
          [(col + 1) * step, (row + 1) * step],
          [col * step, (row + 1) * step],
        ];
        const values = [grid[row][col], grid[row][col + 1], grid[row + 1][col + 1], grid[row + 1][col]];
        const hits = [];
        for (let k = 0; k < 4; k += 1) {
          const j = (k + 1) % 4;
          if (values[k] < level === values[j] < level) continue;
          const f = (level - values[k]) / (values[j] - values[k]);
          hits.push([
            corners[k][0] + f * (corners[j][0] - corners[k][0]),
            corners[k][1] + f * (corners[j][1] - corners[k][1]),
          ]);
        }
        for (let k = 0; k + 1 < hits.length; k += 2) segments.push([...hits[k], ...hits[k + 1]]);
      }
    }
    if (segments.length) lines.push({ level, major: level % 5 === 0, segments });
  }
  return lines;
}
