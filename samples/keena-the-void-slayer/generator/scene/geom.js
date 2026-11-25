// Geometry helpers: seeded random, JS noise, lofted tubes and ring lofts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function vnoise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2(x, z, oct = 5) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise2(x * f + i * 17.3, z * f - i * 9.1);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Loft a tube along a Catmull-Rom curve through `points`.
 * profile(s) -> { w, t }: half-width along the side vector and half-thickness along the "out" vector.
 * outFn(point, s) -> Vector3: direction the flat side faces (e.g. away from the head).
 * Adds attributes: aWind (0 at root, 1 at tip) and aSeed (constant per tube).
 */
export function loftTube(points, profile, opts = {}) {
  const {
    along = 28, around = 10, outFn = null, seed = 0, capRoot = true, capTip = true,
    windStart = 0, windPow = 1, windScale = 1,
  } = opts;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const P = [], T = [];
  for (let i = 0; i <= along; i++) {
    const s = i / along;
    P.push(curve.getPointAt(s));
    T.push(curve.getTangentAt(s).normalize());
  }
  // Frames: use outFn when given, else parallel transport from an arbitrary normal.
  const N = [], B = [];
  let prevN = null;
  for (let i = 0; i <= along; i++) {
    const s = i / along;
    let n;
    if (outFn) {
      n = outFn(P[i], s).clone();
      n.addScaledVector(T[i], -n.dot(T[i]));
      if (n.lengthSq() < 1e-8) n = prevN ? prevN.clone() : new THREE.Vector3(1, 0, 0);
      n.normalize();
    } else if (prevN) {
      n = prevN.clone().addScaledVector(T[i], -prevN.dot(T[i])).normalize();
    } else {
      const ref = Math.abs(T[i].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      n = new THREE.Vector3().crossVectors(T[i], ref).normalize();
    }
    prevN = n;
    N.push(n);
    B.push(new THREE.Vector3().crossVectors(T[i], n).normalize());
  }
  const pos = [], nor = [], uv = [], wind = [], seeds = [], idx = [];
  const ringStart = [];
  for (let i = 0; i <= along; i++) {
    const s = i / along;
    const { w, t } = profile(s);
    const ww = Math.max(w, 1e-5), tt = Math.max(t, 1e-5);
    ringStart.push(pos.length / 3);
    const wv = windScale * Math.pow(Math.max(0, (s - windStart) / (1 - windStart)), windPow);
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const p = P[i].clone().addScaledVector(B[i], ww * c).addScaledVector(N[i], tt * sn);
      const nn = B[i].clone().multiplyScalar(c / ww).addScaledVector(N[i], sn / tt).normalize();
      pos.push(p.x, p.y, p.z);
      nor.push(nn.x, nn.y, nn.z);
      uv.push(j / around, s);
      wind.push(wv);
      seeds.push(seed);
    }
  }
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = ringStart[i] + j, b = ringStart[i + 1] + j;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const addCap = (i, dirSign) => {
    const center = pos.length / 3;
    const p = P[i], tn = T[i].clone().multiplyScalar(dirSign);
    pos.push(p.x, p.y, p.z);
    nor.push(tn.x, tn.y, tn.z);
    uv.push(0.5, i / along);
    wind.push(wind[ringStart[i]]);
    seeds.push(seed);
    for (let j = 0; j < around; j++) {
      const a = ringStart[i] + j;
      if (dirSign < 0) idx.push(center, a + 1, a); else idx.push(center, a, a + 1);
    }
  };
  if (capRoot) addCap(0, -1);
  if (capTip) addCap(along, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(wind, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  g.setIndex(idx);
  return g;
}

/** Loft rings stacked along Y. levels: [{y, rx, rz, cx=0, cz=0}], smoothly interpolated. */
export function loftRings(levels, { around = 48, sub = 6, wind = null, seed = 0 } = {}) {
  const L = levels.map((l) => ({ cx: 0, cz: 0, ...l }));
  const cat = (p0, p1, p2, p3, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
  const rings = [];
  for (let i = 0; i < L.length - 1; i++) {
    const a = L[Math.max(0, i - 1)], b = L[i], c = L[i + 1], d = L[Math.min(L.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const r = {};
      for (const key of ['y', 'rx', 'rz', 'cx', 'cz']) r[key] = cat(a[key], b[key], c[key], d[key], t);
      rings.push(r);
    }
  }
  rings.push(L[L.length - 1]);
  const pos = [], uv = [], windA = [], seeds = [], idx = [];
  const y0 = rings[0].y, y1 = rings[rings.length - 1].y;
  rings.forEach((r, i) => {
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      pos.push(r.cx + Math.sin(a) * r.rx, r.y, r.cz + Math.cos(a) * r.rz);
      uv.push(j / around, i / (rings.length - 1));
      windA.push(wind ? wind(r.y, (r.y - y0) / (y1 - y0 || 1)) : 0);
      seeds.push(seed);
    }
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j, b = (i + 1) * (around + 1) + j;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(windA, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Ensure a geometry has aWind/aSeed (zeros) so it can be merged with wind-enabled parts. */
export function withWindAttrs(g, windValue = 0, seed = 0) {
  const n = g.attributes.position.count;
  if (!g.attributes.aWind) g.setAttribute('aWind', new THREE.Float32BufferAttribute(new Float32Array(n).fill(windValue), 1));
  if (!g.attributes.aSeed) g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Float32Array(n).fill(seed), 1));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

export function merge(geoms) {
  const prepared = geoms.map((g) => {
    const gg = g.index ? g : g;
    withWindAttrs(gg);
    for (const k of Object.keys(gg.attributes)) {
      if (!['position', 'normal', 'uv', 'aWind', 'aSeed'].includes(k)) gg.deleteAttribute(k);
    }
    if (!gg.index) {
      const n = gg.attributes.position.count;
      gg.setIndex([...Array(n).keys()]);
    }
    return gg;
  });
  return mergeGeometries(prepared, false);
}

/** Deformed sphere used for the head and hair cap. Returns geometry with smooth normals. */
export function headGeometry(r, { widthSeg = 96, heightSeg = 72, scale = 1, keep = null } = {}) {
  const g = new THREE.SphereGeometry(1, widthSeg, heightSeg);
  const p = g.attributes.position;
  const dirs = [];
  for (let i = 0; i < p.count; i++) {
    const d = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    dirs.push(d.clone());
    let x = d.x * r * 0.94, y = d.y * r, z = d.z * r * 0.98;
    if (d.y < 0) {
      const k = Math.pow(-d.y, 1.35);
      x *= 1 - 0.40 * k;
      z *= 1 - 0.22 * k;
      if (d.z > 0) z += 0.018 * k * d.z;
      y *= 1.1;
    }
    if (d.z > 0.25) z -= 0.014 * (d.z - 0.25);
    if (d.z < -0.2 && d.y > -0.3) z *= 1.04; // fuller back of the skull
    p.setXYZ(i, x * scale, y * scale, z * scale);
  }
  if (keep) {
    const index = g.index.array;
    const out = [];
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i], b = index[i + 1], c = index[i + 2];
      if (keep(dirs[a]) && keep(dirs[b]) && keep(dirs[c])) out.push(a, b, c);
    }
    g.setIndex(out);
  }
  g.computeVertexNormals();
  return g;
}
