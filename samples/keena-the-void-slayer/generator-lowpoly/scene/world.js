// Leporidia: the hill Keena stands on, the valley below, the giant tree and its hive, the void corruption creeping up
// the trunk, the voidling swarm, storm clouds, mountains and the lightning bolt. Keena stands at the origin facing -z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V3, lerp, smooth, rng, fbm, ramp, flat, mesh, group, beam } from './kit.js';

export const TREE = V3(-14, -22, -125); // base of the giant tree
export const HIVE = V3(TREE.x + 9, TREE.y + 27, TREE.z + 5);
export const CROWN = V3(TREE.x, TREE.y + 44, TREE.z);
export const STRIKE = CROWN.clone().add(V3(6, -5, 5)); // where the bolt hits the corrupted canopy

export function hillH(x, z) {
  let h = 0.3 * fbm(x * 0.15 + 3, z * 0.15) * smooth(1.0, 4.0, Math.hypot(x, z));
  h -= 24 * smooth(-3, -45, z) * (1 - 0.3 * smooth(10, 40, Math.abs(x)));
  h -= 5 * smooth(5, 40, z);
  h += 2.5 * smooth(8, 35, Math.abs(x)) * smooth(-30, 5, z);
  return h;
}

export function valleyH(x, z) {
  let h = -22 + 2.5 * fbm(x * 0.012, z * 0.012) + 1.0 * fbm(x * 0.05 + 9, z * 0.05);
  h += 34 * smooth(150, 330, Math.abs(x - TREE.x)) + 40 * smooth(-280, -440, z);
  return h;
}

function terrain(w, d, nx, nz, cx, cz, hf, mat, parent) {
  const g = new THREE.PlaneGeometry(w, d, nx, nz);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hf(p.getX(i) + cx, p.getZ(i) + cz));
  g.translate(cx, 0, cz);
  g.computeVertexNormals();
  return mesh(g, mat, parent);
}

// A flat ribbon following points on a height function (the dirt path, the river).
function ribbon(pts, width, hf, lift, mat, parent) {
  const pos = [], idx = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
    const nx = -tz / l, nz = tx / l, w = typeof width === 'function' ? width(i / (pts.length - 1)) : width;
    for (const s of [-1, 0, 1]) {
      const x = p.x + nx * w * 0.5 * s, z = p.z + nz * w * 0.5 * s;
      pos.push(x, hf(x, z) + lift, z);
    }
    // counter-clockwise seen from above, so the ribbon faces up
    if (i) for (let k = 0; k < 2; k++) { const o = (i - 1) * 3 + k; idx.push(o, o + 1, o + 3, o + 1, o + 4, o + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, mat, parent);
}

function tuftGeo() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const h = 0.085 + i * 0.026;
    const g = new THREE.ConeGeometry(0.014, h, 3);
    g.translate(0, h / 2, 0);
    g.rotateZ((i - 1.5) * 0.26);
    g.rotateY(i * 1.7);
    g.translate((i - 1.5) * 0.012, 0, (i % 2) * 0.01);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

export function buildWorld(scene) {
  const R = rng(20261125);
  const world = group(scene);
  const dyn = {};

  // ---- the hill, with a coral dirt path running from her boots toward the valley edge
  terrain(96, 96, 80, 80, 0, -4, hillH, ramp('grass', { ground: true }), world);
  const path = [];
  for (let i = 0; i <= 30; i++) { const u = i / 30; path.push(V3(0.25 + Math.sin(u * 2.6) * 1.6 - u * 3, 0, 2.5 - u * 26)); }
  ribbon(path, (u) => 0.9 + 0.7 * u, hillH, 0.02, ramp('dirt', { bias: 0.05 }), world);
  const distPath = (x, z) => Math.min(...path.map((p) => Math.hypot(p.x - x, p.z - z)));

  // grass tufts and flowers, densest around her; they lean and sway with the wind
  const tufts = [], flowers = [[], [], []];
  for (let i = 0; i < 3200; i++) {
    const r = 0.22 + 13 * Math.pow(R(), 1.6), a = R() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 1;
    if (distPath(x, z) < 0.55) continue;
    const s = 0.7 + R() * 0.8;
    tufts.push({ x, y: hillH(x, z), z, s, yaw: R() * 6.28, ph: R() * 6.28 });
    if (R() < 0.16) flowers[Math.floor(R() * 3)].push({ x: x + 0.02, y: hillH(x, z) + 0.1 * s, z, s: 0.8 + R() * 0.5, ph: R() * 6.28 });
  }
  dyn.tufts = new THREE.InstancedMesh(tuftGeo(), ramp('grassTuft', { outline: 0 }), tufts.length);
  dyn.tufts.userData.list = tufts;
  world.add(dyn.tufts);
  dyn.flowers = ['#eaa0a0', '#d06b8a', '#ebe2d8'].map((hex, k) => {
    const m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.022, 0), flat(hex), flowers[k].length);
    m.userData.list = flowers[k];
    world.add(m);
    return m;
  });
  for (let i = 0; i < 16; i++) {
    const r = 1.6 + R() * 20, a = R() * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r - 2;
    const s = 0.15 + R() * (r < 4 ? 0.25 : 0.9);
    mesh(new THREE.DodecahedronGeometry(1, 0), ramp('rock'), world, [x, hillH(x, z) + s * 0.25, z], [R() * 3, R() * 3, R() * 3], [s * 1.3, s * 0.8, s]);
  }

  // ---- the valley: floor, river, little trees and the village of huts around the giant tree
  terrain(640, 460, 72, 52, -15, -240, valleyH, ramp('grass', { bias: -0.04, ground: true }), world);
  const river = [];
  for (let i = 0; i <= 60; i++) { const u = i / 60; river.push(V3(lerp(-260, 220, u) + 40 * Math.sin(u * 7), 0, lerp(-70, -330, u) + 30 * Math.sin(u * 5 + 1))); }
  ribbon(river, 9, valleyH, 0.35, ramp('water', { outline: 0 }), world);

  const trees = [], voidTrees = [];
  for (let i = 0; i < 260; i++) {
    const x = -280 + R() * 520, z = -45 - R() * 330;
    if (Math.hypot(x - TREE.x, z - TREE.z) < 22) continue;
    (Math.hypot(x - TREE.x, z - TREE.z) < 55 && R() < 0.7 ? voidTrees : trees).push({ x, z, y: valleyH(x, z), s: 0.8 + R() * 1.0, yaw: R() * 6 });
  }
  const coneG = new THREE.ConeGeometry(1.7, 5, 5).translate(0, 4, 0), trunkG = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 5).translate(0, 0.8, 0);
  for (const [list, mat] of [[trees, ramp('leaf')], [voidTrees, ramp('leafVoid')]]) {
    const cone = new THREE.InstancedMesh(coneG, mat, list.length), trunk = new THREE.InstancedMesh(trunkG, ramp('bark'), list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    list.forEach((t, i) => {
      m.compose(V3(t.x, t.y, t.z), q.setFromAxisAngle(V3(0, 1, 0), t.yaw), V3(t.s, t.s, t.s));
      cone.setMatrixAt(i, m);
      trunk.setMatrixAt(i, m);
    });
    world.add(cone, trunk);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + R() * 0.2, r = 28 + R() * 34;
    const x = TREE.x + Math.cos(a) * r, z = TREE.z + Math.sin(a) * r, y = valleyH(x, z), s = 0.9 + R() * 0.6;
    const hut = group(world, [x, y, z], [0, R() * 6, 0]);
    mesh(new THREE.CylinderGeometry(1.4, 1.55, 2.1, 7), ramp('hutWall'), hut, [0, 1.05, 0], null, s);
    mesh(new THREE.ConeGeometry(2.1, 2.0, 7), ramp('hutRoof'), hut, [0, 2.1 * s + 0.9 * s, 0], null, s);
    mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), flat('#f0c25c'), hut, [0, 1.1 * s, 1.45 * s]);
  }

  // ---- the giant tree
  const tree = group(world, [TREE.x, TREE.y, TREE.z]);
  const bark = ramp('bark');
  let y = 0, r = 7.5;
  const trunkR = [];
  for (let i = 0; i < 6; i++) {
    const h = 7, r2 = r * 0.84;
    mesh(new THREE.CylinderGeometry(r2, r, h * 1.06, 9, 1), bark, tree, [Math.sin(i * 0.7) * 0.6, y + h / 2, Math.cos(i * 0.5) * 0.4], [0, i * 0.3, 0]);
    trunkR.push([y, r]);
    y += h;
    r = r2;
  }
  const rAt = (h) => 7.5 * Math.pow(0.84, h / 7);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3, d = V3(Math.cos(a), -0.38, Math.sin(a)).normalize();
    const g = new THREE.ConeGeometry(2.6, 15, 5).translate(0, 7.5, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d));
    mesh(g, bark, tree, [Math.cos(a) * 4.5, 3.2, Math.sin(a) * 4.5]);
  }
  const branchEnds = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.6, h = 27 + (i % 3) * 5;
    const a0 = V3(Math.cos(a) * rAt(h) * 0.6, h, Math.sin(a) * rAt(h) * 0.6), a1 = V3(Math.cos(a) * 17, h + 9 + (i % 2) * 4, Math.sin(a) * 17);
    mesh(beam(a0, a1, 2.1, 0.8, 6), bark, tree);
    branchEnds.push(a1);
  }
  const canopy = [];
  for (let i = 0; i < 18; i++) {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 19, p = V3(Math.cos(a) * rr, 45 + R() * 9 - rr * 0.15, Math.sin(a) * rr);
    const hiveSide = p.x * 0.8 + p.z * 0.5 > 9; // the void has taken the hive side of the canopy
    canopy.push(mesh(new THREE.IcosahedronGeometry(8 + R() * 6, 0), hiveSide ? ramp('leafVoid') : ramp('leaf'), tree, [p.x, p.y, p.z], [R() * 3, R() * 3, R() * 3], [1, 0.75, 1]));
  }
  for (const e of branchEnds) mesh(new THREE.IcosahedronGeometry(6.5, 0), e.x * 0.8 + e.z * 0.5 > 9 ? ramp('leafVoid') : ramp('leaf'), tree, [e.x, e.y + 2, e.z], [R() * 3, R() * 3, R() * 3], [1, 0.75, 1]);

  // ---- the hive, hanging from its own branch, honeycombed; the lowest cells are turning void-purple
  const hl = HIVE.clone().sub(TREE);
  mesh(beam(V3(hl.x * 0.25, hl.y + 6, hl.z * 0.25), V3(hl.x, hl.y + 6.5, hl.z), 1.8, 1.1, 6), bark, tree);
  const prof = [[0.2, 5.6], [1.6, 5.2], [3.2, 4.1], [4.3, 2.4], [4.5, 0.6], [4.1, -1.3], [3.2, -3.1], [1.9, -4.5], [0.4, -5.3]].map(([a, b]) => new THREE.Vector2(a, b));
  const hive = mesh(new THREE.LatheGeometry(prof, 11), ramp('hive', { hive: true }), tree, [hl.x, hl.y, hl.z]);
  mesh(new THREE.CircleGeometry(1.1, 8), flat('#1a0a12'), hive, [Math.sin(0.5) * 4.25, -0.6, Math.cos(0.5) * 4.25], [0, 0.5, 0], [1, 1.3, 1]);

  // ---- void corruption: a stain spreading over the ground, crystals, and tendrils climbing the trunk
  const stain = new THREE.CircleGeometry(1, 16);
  const sp = stain.attributes.position;
  for (let i = 1; i < sp.count; i++) { const k = 0.75 + 0.45 * Math.sin(i * 2.3) * Math.cos(i * 1.1); sp.setXY(i, sp.getX(i) * k, sp.getY(i) * k); }
  mesh(stain, flat('#3e1a52'), world, [TREE.x + 3, valleyH(TREE.x, TREE.z) + 0.45, TREE.z + 3], [-Math.PI / 2, 0, 0], [34, 34, 1]);
  mesh(stain, flat('#1e0c28'), world, [TREE.x + 3, valleyH(TREE.x, TREE.z) + 0.55, TREE.z + 3], [-Math.PI / 2, 0, 0.7], [24, 24, 1]);
  for (let i = 0; i < 40; i++) {
    const a = R() * Math.PI * 2, rr = 7 + R() * 22, x = TREE.x + Math.cos(a) * rr, z = TREE.z + Math.sin(a) * rr, s = 0.8 + R() * 2.2;
    mesh(new THREE.OctahedronGeometry(1, 0), ramp('crystal', { bias: 0.08 }), world, [x, valleyH(x, z) + s * 1.2, z], [R() - 0.5, R() * 3, R() - 0.5], [s * 0.55, s * 2.3, s * 0.55]);
  }
  dyn.tendrils = [];
  for (let k = 0; k < 6; k++) {
    const pts = [], a0 = (k / 6) * Math.PI * 2 + 0.4, turns = 0.55 + R() * 0.4, top = 22 + R() * 14;
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, h = u * top, a = a0 + u * turns * Math.PI * 2;
      pts.push(V3(Math.cos(a) * (rAt(h) + 0.25), h, Math.sin(a) * (rAt(h) + 0.25)));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 70, 0.7 - k * 0.04, 5, false);
    const m = mesh(g, ramp('void', { bias: 0.1 }), tree);
    m.userData.n = g.index.count;
    dyn.tendrils.push(m);
    for (let i = 3; i < 14; i += 3) mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), flat('#eb658d'), tree, [pts[i].x * 1.04, pts[i].y, pts[i].z * 1.04]);
  }

  // ---- voidlings: black spiked blobs with glowing eyes, circling the tree and the hive
  const vBody = mergeGeometries([
    new THREE.IcosahedronGeometry(0.6, 0).scale(1, 0.85, 1.15),
    new THREE.ConeGeometry(0.16, 0.6, 4).rotateX(-0.5).translate(0.25, 0.55, -0.1),
    new THREE.ConeGeometry(0.16, 0.6, 4).rotateX(-0.5).translate(-0.25, 0.55, -0.1),
    new THREE.ConeGeometry(0.18, 0.8, 4).rotateX(-Math.PI / 2 - 0.3).translate(0, 0.1, -0.85),
  ].map((g) => g.toNonIndexed()));
  const vEyes = mergeGeometries([new THREE.BoxGeometry(0.16, 0.14, 0.05).translate(0.18, 0.12, 0.66), new THREE.BoxGeometry(0.16, 0.14, 0.05).translate(-0.18, 0.12, 0.66)]);
  const vl = [];
  // the orbit stays inside 22 m so the tree-shot camera (about 31 m out) never flies through the swarm
  for (let i = 0; i < 150; i++) vl.push({ r: 7 + Math.pow(R(), 0.7) * 15, y: -8 + R() * 26, w: 0.3 + R() * 0.45, ph: R() * 6.28, bf: 1 + R() * 2, s: 1.2 + R() * 1.1 });
  for (let i = 0; i < 10; i++) vl.push({ fly: true, d: i, s: 1.4 + R() * 0.8, ph: R() * 6.28, y: (R() - 0.5) * 10, off: R() });
  dyn.voidlings = { list: vl, body: new THREE.InstancedMesh(vBody, ramp('voidling'), vl.length), eyes: new THREE.InstancedMesh(vEyes, flat('#ff4a6e'), vl.length) };
  world.add(dyn.voidlings.body, dyn.voidlings.eyes);

  // ---- storm: cloud banks, the void vortex swirling over the tree, distant mountains
  // biased up so the cloud undersides stay storm-grey instead of going black
  const cloudM = ramp('cloud', { outline: 0, fog: 0.5, bias: 0.2 }), puffG = new THREE.IcosahedronGeometry(1, 1);
  dyn.clouds = [];
  for (let i = 0; i < 70; i++) {
    const x = -320 + R() * 620, z = -430 + R() * 560, yy = 30 + R() * 26 + (z > -60 ? 8 : 0);
    dyn.clouds.push(mesh(puffG, cloudM, world, [x, yy, z], [0, R() * 3, 0], [14 + R() * 26, 4 + R() * 5, 10 + R() * 16]));
  }
  dyn.vortex = group(world, [CROWN.x, CROWN.y + 24, CROWN.z]);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, rr = 28 + (i % 3) * 12;
    mesh(puffG, i % 2 ? ramp('void', { outline: 0, fog: 0.4, bias: -0.1 }) : cloudM, dyn.vortex, [Math.cos(a) * rr, (i % 4) * 2.5, Math.sin(a) * rr], [0, -a, 0], [20, 4.5, 10]);
  }
  for (let i = 0; i < 34; i++) {
    const a = -Math.PI * 0.95 + R() * Math.PI * 1.9, d = 340 + R() * 150, h = 50 + R() * 100;
    mesh(new THREE.ConeGeometry(40 + R() * 60, h, 5 + Math.floor(R() * 3)), ramp('mountain', { outline: 0 }), world, [Math.sin(a) * d, -30 + h / 2, -Math.cos(a) * d], [0, R() * 3, 0]);
  }

  // ---- the lightning bolt that strikes the corrupted canopy at the end of the tree shot
  const B = rng(7), top = STRIKE.clone().add(V3(9, 46, -3)), pts = [];
  for (let i = 0; i <= 10; i++) {
    const p = top.clone().lerp(STRIKE, i / 10);
    if (i > 0 && i < 10) p.add(V3((B() - 0.5) * 7, (B() - 0.5) * 2, (B() - 0.5) * 4));
    pts.push(p);
  }
  const parts = [];
  for (let i = 0; i < 10; i++) parts.push(beam(pts[i], pts[i + 1], 0.55, 0.45, 4));
  let fa = pts[4].clone();
  for (let k = 0; k < 4; k++) { const fb = fa.clone().add(V3(-2.5 - B() * 3, -4 - B() * 2, (B() - 0.5) * 3)); parts.push(beam(fa, fb, 0.32, 0.22, 4)); fa = fb; }
  dyn.bolt = mesh(mergeGeometries(parts), flat('#f6f2ff', { fog: 0 }), world);
  dyn.bolt.visible = false;

  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = V3(), P = V3();
  function update(t, { bolt = false, grow = 1, wind = 1, near = true } = {}) {
    // grass and flowers only matter near her, so they are skipped in the tree shot
    dyn.tufts.visible = near;
    dyn.flowers.forEach((f) => { f.visible = near; });
    if (near) {
      const gust = wind * (0.65 + 0.35 * Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1.0));
      dyn.tufts.userData.list.forEach((u, i) => {
        E.set(0.2 * gust + 0.13 * gust * Math.sin(t * 5 + u.x * 0.8 + u.z * 0.6 + u.ph * 0.3), u.yaw, 0, 'XYZ');
        M4.compose(P.set(u.x, u.y, u.z), Q.setFromEuler(E), S.set(u.s, u.s, u.s));
        dyn.tufts.setMatrixAt(i, M4);
      });
      dyn.tufts.instanceMatrix.needsUpdate = true;
      for (const f of dyn.flowers) {
        f.userData.list.forEach((u, i) => {
          const sway = (0.2 + 0.13 * Math.sin(t * 5 + u.x * 0.8 + u.z * 0.6)) * gust * 0.1;
          M4.compose(P.set(u.x, u.y, u.z + sway), Q.setFromEuler(E.set(0, u.ph, 0.6)), S.set(u.s, u.s * 0.7, u.s));
          f.setMatrixAt(i, M4);
        });
        f.instanceMatrix.needsUpdate = true;
      }
    }
    for (const m of dyn.tendrils) m.geometry.setDrawRange(0, Math.floor(70 * grow) * 30); // 70 rings of 5 sides
    const V = dyn.voidlings, c = HIVE.clone().add(V3(-4, 6, 0));
    V.list.forEach((u, i) => {
      let p, dir;
      if (u.fly) {
        // a few fly past close to the camera in the tree shot, left to right
        const k = ((t - 6.2) * 0.13 + u.off) % 1;
        p = HIVE.clone().add(V3(lerp(-30, 40, k), u.y + 6 + 3 * Math.sin(t * 2 + u.ph), 6 + u.d));
        dir = V3(1, 0.1 * Math.cos(t * 2 + u.ph), -0.2);
      } else {
        const a = u.ph + u.w * t;
        p = V3(c.x + Math.cos(a) * u.r, c.y + u.y + 1.6 * Math.sin(t * u.bf + u.ph), c.z + Math.sin(a) * u.r);
        dir = V3(-Math.sin(a), 0.2 * Math.cos(t * u.bf + u.ph), Math.cos(a));
      }
      Q.setFromRotationMatrix(M4.lookAt(V3(), dir.normalize().negate(), V3(0, 1, 0)));
      const sq = 1 + 0.12 * Math.sin(t * 11 + u.ph);
      M4.compose(p, Q, S.set(u.s / Math.sqrt(sq), u.s * sq, u.s / Math.sqrt(sq)));
      V.body.setMatrixAt(i, M4);
      V.eyes.setMatrixAt(i, M4);
    });
    V.body.instanceMatrix.needsUpdate = true;
    V.eyes.instanceMatrix.needsUpdate = true;
    dyn.vortex.rotation.y = -t * 0.07;
    dyn.bolt.visible = bolt;
  }

  return { update, hive, canopy };
}
