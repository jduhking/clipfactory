// Keena (and Moku), built from lofted procedural geometry. Modelled facing +Z, origin at her feet.
import * as THREE from 'three';
import { loftTube, loftRings, headGeometry, merge, withWindAttrs, rng, smooth } from './geom.js';
import { toon, outlineMaterial, withOutline, GRAD_CHAR } from './toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const PALETTE = {
  skin: '#f9e7dc',
  hair: '#d65f8a',
  hairHi: '#bfe9df',
  earInner: '#f3a8b6',
  tunic: '#a9dccd',
  tunicTrim: '#4f9c8d',
  shorts: '#2d6c66',
  glove: '#f6efe6',
  cuff: '#3f9084',
  warmer: '#f3c6be',
  boot: '#3f8c7d',
  sole: '#1d4a47',
  lace: '#f7f2ec',
  line: '#173a3f',
  moku: '#1c4b4c',
  mokuEye: '#d9f4ec',
};

const HEAD_R = 0.122;
export const HEAD_C = V(0, 1.425, 0.005);
const FACE_SPAN = HEAD_R * 1.0923; // half-width of the face texture on the head

function faceTexture(blink = false) {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = PALETTE.skin;
  g.fillRect(0, 0, S, S);
  const X = (u) => u * S, Y = (v) => (1 - v) * S;
  // blush
  for (const su of [-1, 1]) {
    const cx = X(0.5 + su * 0.235), cy = Y(0.335);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.075);
    gr.addColorStop(0, 'rgba(240,128,146,0.62)');
    gr.addColorStop(1, 'rgba(240,128,146,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(cx, cy, S * 0.085, S * 0.05, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(214,88,120,0.75)'; g.lineWidth = S * 0.006; g.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(cx + k * S * 0.022 - S * 0.008, cy + S * 0.012);
      g.lineTo(cx + k * S * 0.022 + S * 0.008, cy - S * 0.012);
      g.stroke();
    }
  }
  // eyes
  for (const su of [-1, 1]) {
    const cx = X(0.5 + su * 0.168), cy = Y(0.445);
    const rx = S * 0.068, ry = S * 0.082;
    if (!blink) {
      g.save();
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#ffffff'; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      // iris
      const ix = cx - su * S * 0.004, iy = cy + S * 0.004;
      const gr = g.createLinearGradient(ix, iy - ry, ix, iy + ry);
      gr.addColorStop(0, '#12464a'); gr.addColorStop(0.45, '#2a8b84'); gr.addColorStop(1, '#93e6d6');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(ix, iy, S * 0.054, S * 0.074, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#0f3a3d'; g.lineWidth = S * 0.006; g.stroke();
      g.fillStyle = '#0d2f32';
      g.beginPath(); g.ellipse(ix, iy - S * 0.004, S * 0.024, S * 0.038, 0, 0, Math.PI * 2); g.fill();
      // glints
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(ix - S * 0.022, iy - S * 0.032, S * 0.019, S * 0.024, -0.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(ix + S * 0.02, iy + S * 0.036, S * 0.009, S * 0.009, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(190,255,240,0.55)';
      g.beginPath(); g.ellipse(ix, iy + S * 0.048, S * 0.03, S * 0.012, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      // upper lash line with outer flick
      g.strokeStyle = '#173133'; g.lineCap = 'round'; g.lineJoin = 'round';
      g.lineWidth = S * 0.02;
      g.beginPath();
      g.ellipse(cx, cy + S * 0.004, rx * 1.04, ry * 1.0, 0, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      g.lineWidth = S * 0.014;
      g.beginPath();
      const ox = cx + su * rx * 0.95, oy = cy - ry * 0.32;
      g.moveTo(ox, oy); g.lineTo(ox + su * S * 0.028, oy - S * 0.018); g.stroke();
      // lower lash hint
      g.lineWidth = S * 0.006;
      g.beginPath(); g.ellipse(cx, cy, rx * 0.9, ry * 0.98, 0, Math.PI * (su > 0 ? 0.08 : 0.62), Math.PI * (su > 0 ? 0.38 : 0.92)); g.stroke();
    } else {
      g.strokeStyle = '#173133'; g.lineCap = 'round'; g.lineWidth = S * 0.016;
      g.beginPath(); g.ellipse(cx, cy + S * 0.01, rx * 1.02, ry * 0.4, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
    }
    // brow: angled toward the centre for a determined look
    g.strokeStyle = '#a84a66'; g.lineWidth = S * 0.011; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - su * S * 0.055, Y(0.625));
    g.quadraticCurveTo(cx, Y(0.648), cx + su * S * 0.062, Y(0.632));
    g.stroke();
  }
  // nose
  g.strokeStyle = 'rgba(196,120,120,0.8)'; g.lineWidth = S * 0.007; g.lineCap = 'round';
  g.beginPath(); g.moveTo(X(0.497), Y(0.305)); g.lineTo(X(0.507), Y(0.292)); g.stroke();
  // confident little smile
  g.strokeStyle = '#7d3446'; g.lineWidth = S * 0.009;
  g.beginPath(); g.moveTo(X(0.462), Y(0.198)); g.quadraticCurveTo(X(0.5), Y(0.172), X(0.545), Y(0.205)); g.stroke();
  g.fillStyle = 'rgba(125,52,70,0.9)';
  g.beginPath(); g.moveTo(X(0.47), Y(0.193)); g.quadraticCurveTo(X(0.5), Y(0.176), X(0.535), Y(0.197)); g.quadraticCurveTo(X(0.5), Y(0.186), X(0.47), Y(0.193)); g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function capPoint(phi, elev, extra = 0) {
  const r = HEAD_R * 1.08 + extra;
  const d = V(Math.sin(phi) * Math.cos(elev), Math.sin(elev), Math.cos(phi) * Math.cos(elev));
  return V(d.x * r * 0.95, d.y * r, d.z * r).add(HEAD_C);
}

const outFromHead = (p) => p.clone().sub(HEAD_C).normalize();
const outFromAxis = (p) => V(p.x, 0, p.z - 0.01).normalize();

function hairStrands(R) {
  const parts = [];
  // Bangs: pointed strands over the forehead.
  const nb = 11;
  for (let i = 0; i < nb; i++) {
    const u = i / (nb - 1) * 2 - 1; // -1..1
    const phi = u * 1.0;
    const len = 0.16 - Math.abs(u) * 0.05 + (i % 2 ? 0.0 : -0.025) + (Math.abs(u) < 0.2 ? 0.012 : 0);
    const tipElev = 0.62 - len * 3.4;
    const pts = [
      capPoint(phi * 0.85, 1.12, -0.012),
      capPoint(phi * 0.95, 0.85, 0.012),
      capPoint(phi * 1.02, 0.5, 0.019),
      capPoint(phi * 1.06 + u * 0.03, tipElev + 0.12, 0.016),
      capPoint(phi * 1.08 + u * 0.05, tipElev, 0.008),
    ];
    const W = 0.024 + (1 - Math.abs(u)) * 0.006;
    parts.push(loftTube(pts, (s) => ({ w: W * (1 - Math.pow(s, 1.7)) + 0.0008, t: 0.0075 * (1 - Math.pow(s, 1.5)) + 0.0012 }),
      { along: 18, around: 8, outFn: outFromHead, seed: R() * 10, windStart: 0.4, windPow: 1, windScale: 0.35 }));
  }
  // Side locks framing the face, falling in front of the shoulders.
  for (const sx of [-1, 1]) {
    const pts = [
      capPoint(sx * 1.18, 0.78, -0.01),
      capPoint(sx * 1.32, 0.2, 0.018),
      V(sx * 0.118, HEAD_C.y - 0.15, 0.045),
      V(sx * 0.128, 1.15, 0.075),
      V(sx * 0.118, 1.04, 0.098),
      V(sx * 0.1, 0.97, 0.104),
    ];
    parts.push(loftTube(pts, (s) => ({ w: 0.03 * (1 - Math.pow(s, 2.2)) + 0.002 + 0.006 * Math.sin(Math.PI * s), t: 0.011 * (1 - s * s) + 0.002 }),
      { along: 30, around: 10, outFn: (p, s) => (s < 0.3 ? outFromHead(p) : V(0, 0, 1)), seed: R() * 10, windStart: 0.25, windPow: 1.2, windScale: 0.5 }));
    const pts2 = [
      capPoint(sx * 1.5, 0.75, -0.01),
      capPoint(sx * 1.62, 0.05, 0.02),
      V(sx * 0.15, HEAD_C.y - 0.17, -0.02),
      V(sx * 0.19, 1.1, -0.045),
      V(sx * 0.2, 0.98, -0.06),
      V(sx * 0.19, 0.9, -0.07),
    ];
    parts.push(loftTube(pts2, (s) => ({ w: 0.034 * (1 - Math.pow(s, 2)) + 0.002, t: 0.012 * (1 - s * s) + 0.002 }),
      { along: 30, around: 10, outFn: (p, s) => (s < 0.3 ? outFromHead(p) : outFromAxis(p)), seed: R() * 10, windStart: 0.25, windPow: 1.2, windScale: 0.75 }));
  }
  // Back hair: long strands down to the lower back, fanning out.
  const nbk = 26;
  for (let i = 0; i < nbk; i++) {
    const u = (i / (nbk - 1)) * 2 - 1;
    const layer = i % 2;
    const phi = Math.PI + u * 1.55;
    const elev = 0.25 + (1 - Math.abs(u)) * 0.75 + layer * 0.12 + (R() - 0.5) * 0.12;
    const yEnd = 0.74 + Math.abs(u) * 0.14 + (R() - 0.5) * 0.05 + layer * 0.03;
    const depth = (y) => 0.135 + (1.25 - y) * 0.075 + layer * 0.012;
    const spread = (y) => 0.15 + (1.25 - y) * 0.09;
    const at = (y) => V(u * spread(y), y, -depth(y) * Math.sqrt(Math.max(0.15, 1 - 0.62 * u * u)) - 0.01);
    const pts = [
      capPoint(phi, elev, -0.012),
      capPoint(phi, Math.max(-0.35, elev * 0.4 - 0.25), 0.012 + layer * 0.006),
      at(1.2),
      at(1.05),
      at(0.92),
      at(yEnd + 0.04).add(V(u * 0.03, 0, -0.015)),
      at(yEnd).add(V(u * 0.05, 0, -0.02)),
    ];
    const W = 0.034 + (1 - Math.abs(u)) * 0.012;
    parts.push(loftTube(pts, (s) => ({
      w: W * (0.6 + 0.55 * Math.sin(Math.PI * Math.min(1, s * 1.15) * 0.5 + 0.3)) * (1 - smooth(0.72, 1.0, s)) + 0.001,
      t: 0.013 * (1 - Math.pow(s, 2.5)) + 0.002,
    }), {
      along: 40, around: 10, seed: R() * 10, windStart: 0.18, windPow: 1.1,
      outFn: (p, s) => (s < 0.22 ? outFromHead(p) : outFromAxis(p).add(V(0, 0, -0.4)).normalize()),
    }));
  }
  return merge(parts);
}

function earGeom(sx, inner = false) {
  const root = V(sx * 0.045, HEAD_C.y + 0.112, -0.022);
  const bend = sx > 0 ? 1 : 0;
  const pts = [
    root.clone().add(V(0, -0.02, 0)),
    root.clone().add(V(sx * 0.012, 0.1, -0.008)),
    root.clone().add(V(sx * 0.034, 0.215, -0.024)),
    root.clone().add(V(sx * (0.058 + bend * 0.012), 0.322, -0.046 - bend * 0.012)),
    root.clone().add(V(sx * (0.078 + bend * 0.05), 0.405 - bend * 0.03, -0.072 - bend * 0.05)),
  ];
  const fwd = V(sx * 0.45, 0.0, 1).normalize(); // turned outward so the ears read as wide shapes from the side
  if (inner) pts.forEach((p) => p.addScaledVector(fwd, 0.0085));
  const prof = (s) => {
    const m = 0.45;
    let w = s < m ? 0.021 + (0.046 - 0.021) * smooth(0, m, s) : 0.046 * Math.sqrt(Math.max(0, 1 - Math.pow((s - m) / (1 - m), 2)));
    let t = 0.013 - 0.006 * s;
    if (inner) {
      w *= 0.6 * smooth(0.04, 0.18, s) * (1 - smooth(0.86, 0.95, s));
      t *= 0.45;
    }
    return { w: w + 0.0006, t: t + 0.0006 };
  };
  return loftTube(pts, prof, { along: 36, around: 14, outFn: () => fwd, seed: sx > 0 ? 3.1 : 7.7, windStart: 0.2, windPow: 1.3 });
}

function limb(pts, r0, r1, rMid = null, along = 24) {
  return loftTube(pts, (s) => {
    let r = r0 + (r1 - r0) * s;
    if (rMid) r += rMid * Math.sin(Math.PI * s);
    return { w: r, t: r };
  }, { along, around: 18, windScale: 0 });
}

function ellipsoid(rx, ry, rz, pos, seg = 32) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  g.scale(rx, ry, rz);
  g.translate(pos.x, pos.y, pos.z);
  return g;
}

export function buildKeena({ windWorld = V(0.22, 0, 1).normalize(), facing = Math.PI } = {}) {
  const R = rng(42);
  const group = new THREE.Group();
  group.rotation.y = facing;
  // wind direction in Keena's object space
  const windObj = windWorld.clone().applyAxisAngle(V(0, 1, 0), -facing).normalize();
  const rim = { color: '#ffc4ae', strength: 0.85, fillColor: '#b49cff', fillStrength: 0.35 };
  const line = PALETTE.line;
  const out = (wind = null, w = 2.1) => outlineMaterial({ color: line, widthPx: w, refDist: 2.4, wind });

  // --- materials
  const skin = toon({ color: PALETTE.skin, rim, lift: 0.1 });
  const faceTex = faceTexture(false), blinkTex = faceTexture(true);
  const face = toon({ color: '#ffffff', map: faceTex, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 0.2, rim });
  const hairWind = { dir: windObj, amp: 0.085, freq: 1.0 };
  const hairMat = toon({
    color: PALETTE.hair, wind: hairWind, rim: { ...rim, strength: 1.0 }, lift: 0.16,
    vertDecl: 'varying vec3 vObjPos;', vertBegin: 'vObjPos = position;',
    fragDecl: `varying vec3 vObjPos; uniform vec3 uHairHi; uniform vec3 uHeadC;`,
    fragColor: `
      {
        vec3 hd = vObjPos - uHeadC;
        float r = length(hd);
        vec3 dn = hd / max(r, 1e-4);
        float ang = atan(dn.x, dn.z);
        float jag = 0.035 * sin(ang * 26.0) + 0.02 * sin(ang * 11.0 + 1.0);
        float band = smoothstep(0.50 + jag, 0.56 + jag, dn.y) * (1.0 - smoothstep(0.70 + jag, 0.76 + jag, dn.y));
        band *= step(r, 0.2) * smoothstep(-0.2, 0.4, dn.z + 0.3);
        diffuseColor.rgb = mix(diffuseColor.rgb, uHairHi, band * 0.55);
      }`,
    uniforms: { uHairHi: { value: new THREE.Color(PALETTE.hairHi) }, uHeadC: { value: HEAD_C.clone() } },
  });
  const capMat = hairMat; // same shader; cap has aWind = 0
  const earWind = { dir: windObj, amp: 0.05, freq: 0.9 };
  const earMat = toon({ color: PALETTE.hair, wind: earWind, rim: { ...rim, strength: 1.0 }, lift: 0.16 });
  const earInMat = toon({ color: PALETTE.earInner, wind: earWind, rim, lift: 0.12 });
  const clothWind = { dir: windObj, amp: 0.05, freq: 1.3 };
  const tunicMat = toon({ color: PALETTE.tunic, wind: clothWind, rim, side: THREE.DoubleSide, lift: 0.12 });
  const trimMat = toon({ color: PALETTE.tunicTrim, wind: clothWind, rim, side: THREE.DoubleSide, lift: 0.16 });
  const shortsMat = toon({ color: PALETTE.shorts, rim, side: THREE.DoubleSide, lift: 0.18 });
  const gloveMat = toon({ color: PALETTE.glove, rim, lift: 0.08 });
  const cuffMat = toon({ color: PALETTE.cuff, rim, lift: 0.18 });
  const warmerMat = toon({ color: PALETTE.warmer, rim, lift: 0.1 });
  const bootMat = toon({ color: PALETTE.boot, rim, lift: 0.22 });
  const soleMat = toon({ color: PALETTE.sole, rim, lift: 0.18 });
  const laceWind = { dir: windObj, amp: 0.03, freq: 1.6 };
  const laceMat = toon({ color: PALETTE.lace, wind: laceWind, rim, lift: 0.06 });

  // --- head
  const headG = headGeometry(HEAD_R);
  {
    const p = headG.attributes.position, uv = headG.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (z < -0.02) uv.setXY(i, 0.02, 0.98);
      else uv.setXY(i, 0.5 + x / (2 * FACE_SPAN), 0.5 + y / (2 * FACE_SPAN));
    }
    headG.translate(HEAD_C.x, HEAD_C.y, HEAD_C.z);
  }
  const headMesh = withOutline(group, headG, face, out(null, 2.0));
  headMesh.receiveShadow = false;

  const capG = headGeometry(HEAD_R, {
    scale: 1.075,
    keep: (d) => (d.y > 0.02 || d.z < -0.3) && !(d.z > 0.4 && d.y < 0.5),
  });
  capG.translate(HEAD_C.x, HEAD_C.y, HEAD_C.z);
  withWindAttrs(capG, 0, 0);
  withOutline(group, capG, capMat, out(null, 2.0));
  withOutline(group, hairStrands(R), hairMat, out(hairWind, 1.8));

  // ears
  for (const sx of [-1, 1]) {
    withOutline(group, earGeom(sx), earMat, out(earWind, 2.0));
    const inner = new THREE.Mesh(earGeom(sx, true), earInMat);
    inner.castShadow = true;
    group.add(inner);
  }

  // neck, chest, shoulders
  withOutline(group, merge([
    limb([V(0, 1.19, -0.012), V(0, 1.27, -0.008), V(0, 1.36, -0.004)], 0.031, 0.028),
    loftRings([
      { y: 1.185, rx: 0.112, rz: 0.074 }, { y: 1.205, rx: 0.1, rz: 0.068 }, { y: 1.225, rx: 0.07, rz: 0.052 }, { y: 1.245, rx: 0.042, rz: 0.04 },
    ], { around: 40, sub: 4 }),
    ellipsoid(0.042, 0.04, 0.04, V(0.15, 1.168, -0.006)),
    ellipsoid(0.042, 0.04, 0.04, V(-0.15, 1.168, -0.006)),
  ]), skin, out());

  // tunic, trims and shorts
  const tunicWind = (y) => smooth(0.88, 0.655, y);
  withOutline(group, loftRings([
    { y: 1.215, rx: 0.106, rz: 0.071 }, { y: 1.18, rx: 0.128, rz: 0.083 }, { y: 1.1, rx: 0.127, rz: 0.09, cz: 0.004 },
    { y: 1.03, rx: 0.117, rz: 0.083 }, { y: 0.95, rx: 0.108, rz: 0.076 }, { y: 0.87, rx: 0.128, rz: 0.086 },
    { y: 0.78, rx: 0.158, rz: 0.106 }, { y: 0.69, rx: 0.184, rz: 0.124 }, { y: 0.66, rx: 0.19, rz: 0.128 },
  ], { around: 64, sub: 6, wind: tunicWind, seed: 1.3 }), tunicMat, out(clothWind));
  withOutline(group, loftRings([
    { y: 0.684, rx: 0.188, rz: 0.127 }, { y: 0.67, rx: 0.192, rz: 0.13 }, { y: 0.656, rx: 0.194, rz: 0.131 },
  ], { around: 64, sub: 3, wind: tunicWind, seed: 1.3 }), trimMat, null);
  withOutline(group, loftRings([
    { y: 1.228, rx: 0.103, rz: 0.069 }, { y: 1.214, rx: 0.109, rz: 0.073 }, { y: 1.2, rx: 0.114, rz: 0.076 },
  ], { around: 56, sub: 3 }), trimMat, null);
  withOutline(group, loftRings([
    { y: 0.88, rx: 0.12, rz: 0.08 }, { y: 0.78, rx: 0.142, rz: 0.092 }, { y: 0.72, rx: 0.15, rz: 0.098 },
  ], { around: 48, sub: 4 }), shortsMat, null);

  // legs
  const legs = [];
  const warmers = [], boots = [], soles = [], laces = [];
  for (const sx of [-1, 1]) {
    const hip = V(sx * 0.072, 0.8, 0.0), knee = V(sx * 0.09, 0.45, 0.014), ankle = V(sx * 0.118, 0.13, 0.0);
    legs.push(loftTube([hip, V(sx * 0.082, 0.62, 0.01), knee, V(sx * 0.104, 0.3, 0.004), ankle], (s) => {
      const r = 0.062 - 0.03 * s + 0.004 * Math.sin(Math.PI * Math.min(1, s * 1.6));
      return { w: r, t: r };
    }, { along: 32, around: 20, windScale: 0 }));
    const legX = (y) => sx * (0.09 + (0.118 - 0.09) * (0.45 - y) / (0.45 - 0.13));
    const lv = [];
    for (let k = 0; k <= 11; k++) {
      const y = 0.2 + k * 0.019;
      const r = (k % 2 ? 0.058 : 0.051) + (k > 9 ? 0.004 : 0);
      lv.push({ y, rx: r, rz: r * 1.03, cx: legX(y), cz: 0.004 });
    }
    warmers.push(loftRings(lv, { around: 32, sub: 3 }));
    const fx = sx * 0.12;
    boots.push(loftRings([
      { y: 0.235, rx: 0.06, rz: 0.062, cx: fx, cz: 0.004 }, { y: 0.215, rx: 0.056, rz: 0.058, cx: fx, cz: 0.004 },
      { y: 0.15, rx: 0.053, rz: 0.056, cx: fx, cz: 0.006 }, { y: 0.08, rx: 0.056, rz: 0.064, cx: fx, cz: 0.014 },
      { y: 0.05, rx: 0.058, rz: 0.07, cx: fx, cz: 0.02 },
    ], { around: 36, sub: 4 }));
    boots.push(ellipsoid(0.058, 0.047, 0.1, V(fx, 0.052, 0.05)));
    soles.push(ellipsoid(0.063, 0.02, 0.112, V(fx, 0.018, 0.048)));
    // laces: criss-cross on the shaft front, bow and two hanging ends
    for (let k = 0; k < 3; k++) {
      const y = 0.1 + k * 0.035;
      laces.push(limb([V(fx - 0.026, y, 0.058), V(fx, y + 0.008, 0.066), V(fx + 0.026, y + 0.016, 0.058)], 0.0045, 0.0045, null, 8));
      laces.push(limb([V(fx + 0.026, y, 0.058), V(fx, y + 0.008, 0.066), V(fx - 0.026, y + 0.016, 0.058)], 0.0045, 0.0045, null, 8));
    }
    const bow = V(fx, 0.212, 0.066);
    for (const bx of [-1, 1]) {
      const loop = new THREE.TorusGeometry(0.017, 0.0045, 8, 20);
      loop.scale(1, 0.62, 0.5);
      loop.translate(bow.x + bx * 0.018, bow.y + 0.004, bow.z + 0.004);
      laces.push(withWindAttrs(loop, 0, 0));
      laces.push(loftTube([bow.clone(), bow.clone().add(V(bx * 0.012, -0.03, 0.012)), bow.clone().add(V(bx * 0.02, -0.075, 0.016)), bow.clone().add(V(bx * 0.024, -0.11, 0.012))],
        (s) => ({ w: 0.0042, t: 0.0042 }), { along: 12, around: 6, seed: sx * 2 + bx, windStart: 0.0, windPow: 1.0 }));
    }
  }
  withOutline(group, merge(legs), skin, out());
  withOutline(group, merge(warmers), warmerMat, out());
  withOutline(group, merge(boots), bootMat, out());
  withOutline(group, merge(soles), soleMat, out(null, 1.6));
  withOutline(group, merge(laces), laceMat, out(laceWind, 1.1));

  // arms with gloves and fists
  const arms = [], gloves = [], cuffs = [];
  for (const sx of [-1, 1]) {
    const sh = V(sx * 0.152, 1.168, -0.006), el = V(sx * 0.2, 0.955, -0.03), wr = V(sx * 0.226, 0.77, 0.02);
    arms.push(loftTube([sh, V(sx * 0.178, 1.06, -0.02), el, V(sx * 0.212, 0.9, -0.016)], (s) => {
      const r = 0.036 - 0.009 * s; return { w: r, t: r };
    }, { along: 20, around: 18, windScale: 0 }));
    gloves.push(loftTube([V(sx * 0.21, 0.905, -0.016), V(sx * 0.218, 0.84, 0.0), wr], (s) => {
      const r = 0.03 - 0.005 * s; return { w: r, t: r };
    }, { along: 14, around: 18, windScale: 0 }));
    cuffs.push(loftRings([
      { y: 0.915, rx: 0.033, rz: 0.033, cx: sx * 0.209, cz: -0.018 }, { y: 0.9, rx: 0.036, rz: 0.036, cx: sx * 0.21, cz: -0.016 },
      { y: 0.872, rx: 0.035, rz: 0.035, cx: sx * 0.214, cz: -0.01 }, { y: 0.86, rx: 0.031, rz: 0.031, cx: sx * 0.215, cz: -0.007 },
    ], { around: 24, sub: 3 }));
    const fist = ellipsoid(0.032, 0.044, 0.037, V(sx * 0.232, 0.718, 0.03), 24);
    gloves.push(fist);
    gloves.push(limb([V(sx * 0.214, 0.74, 0.058), V(sx * 0.226, 0.722, 0.066), V(sx * 0.242, 0.71, 0.06)], 0.012, 0.01, null, 8));
  }
  withOutline(group, merge(arms), skin, out());
  withOutline(group, merge(gloves), gloveMat, out());
  withOutline(group, merge(cuffs), cuffMat, out(null, 1.5));

  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  const api = {
    group,
    headWorld: () => group.localToWorld(HEAD_C.clone()),
    update(t) {
      // blink twice: once early, once at the face reveal
      const blink = [3.1, 6.9, 12.2].some((b) => t > b && t < b + 0.12);
      const tex = blink ? blinkTex : faceTex;
      if (face.map !== tex) { face.map = tex; face.emissiveMap = tex; face.needsUpdate = true; }
      // breathing
      const br = 1 + 0.006 * Math.sin(t * 2.2);
      group.scale.set(1, br, 1);
    },
  };
  return api;
}

export function buildMoku({ windWorld = V(0.22, 0, 1).normalize(), facing = Math.PI } = {}) {
  const group = new THREE.Group();
  group.rotation.y = facing;
  const windObj = windWorld.clone().applyAxisAngle(V(0, 1, 0), -facing).normalize();
  const rim = { color: '#ffc4ae', strength: 0.9, fillColor: '#b49cff', fillStrength: 0.4 };
  const bodyMat = toon({ color: PALETTE.moku, rim, lift: 0.12 });
  const earWind = { dir: windObj, amp: 0.025, freq: 1.4 };
  const earMat = toon({ color: PALETTE.moku, rim, wind: earWind, lift: 0.12 });
  const eyeMat = toon({ color: PALETTE.mokuEye, emissive: PALETTE.mokuEye, emissiveIntensity: 0.35 });
  const line = outlineMaterial({ color: '#0b2224', widthPx: 1.8, refDist: 1.6 });
  const body = new THREE.SphereGeometry(1, 40, 30);
  {
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const wide = 1 + 0.18 * Math.max(0, -y);
      x *= 0.085 * wide; z *= 0.09 * wide;
      y = y < -0.55 ? -0.55 * 0.075 + (y + 0.55) * 0.02 : y * 0.075;
      p.setXYZ(i, x, y + 0.045, z);
    }
    body.computeVertexNormals();
  }
  withOutline(group, body, bodyMat, line);
  for (const sx of [-1, 1]) {
    const e = ellipsoid(0.015, 0.022, 0.008, V(sx * 0.032, 0.07, 0.083), 20);
    e.rotateY(0);
    const em = new THREE.Mesh(e, eyeMat);
    group.add(em);
    const pts = [V(sx * 0.03, 0.1, -0.005), V(sx * 0.036, 0.15, -0.012), V(sx * 0.044, 0.2, -0.022), V(sx * 0.05, 0.235, -0.03)];
    const ear = loftTube(pts, (s) => ({ w: 0.009 + 0.008 * Math.sin(Math.PI * Math.min(1, s * 1.1)) * (s > 0.6 ? 1.2 : 1), t: 0.006 }),
      { along: 16, around: 10, outFn: () => V(0, 0, 1), seed: sx + 4, windStart: 0.1 });
    withOutline(group, ear, earMat, outlineMaterial({ color: '#0b2224', widthPx: 1.6, refDist: 1.6, wind: earWind }));
  }
  group.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } });
  return {
    group,
    update(t) {
      const hop = Math.max(0, Math.sin(t * 2.6)) * 0.006;
      group.position.y = hop;
      group.scale.set(1 + hop * 2, 1 - hop * 3, 1 + hop * 2);
    },
  };
}
