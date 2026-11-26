// Keena and Moku as low-poly models, after Vi Nguyen's moodboard and the in-game sprites. Both face +z in their own
// space with feet (Keena) or the body centre (Moku) at the origin. Keena's left is +x.
import * as THREE from 'three';
import { V3, lerp, smooth, ramp, flat, mesh, group, seg, chain, eyeMat, mouthMat } from './kit.js';

const R = 0.15, SZ = 0.95; // head radius and front-to-back squash
const chin = (y) => { const v = Math.max(0, -y / R); return [1 - 0.28 * Math.pow(v, 1.6), 1 - 0.12 * Math.pow(v, 1.6)]; };

function headGeo() {
  const g = new THREE.SphereGeometry(R, 16, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [kx, kz] = chin(p.getY(i));
    p.setXYZ(i, p.getX(i) * kx, p.getY(i), p.getZ(i) * kz * SZ);
  }
  g.computeVertexNormals();
  return g;
}

// Put a face decal at head-space (x, y) on the skin, facing out, lifted slightly.
function onFace(obj, x, y, lift = 0.004) {
  const [kx, kz] = chin(y);
  const ux = x / kx;
  const z0 = Math.sqrt(Math.max(R * R - ux * ux - y * y, 1e-6));
  const n = V3(ux / kx, y, z0 / (kz * SZ)).normalize();
  obj.position.set(x, y, z0 * kz * SZ).addScaledVector(n, lift);
  obj.quaternion.setFromUnitVectors(V3(0, 0, 1), n);
  obj.userData.q0 = obj.quaternion.clone();
  obj.userData.p0 = obj.position.clone();
  return obj;
}

const tilt = (obj, a) => obj.quaternion.copy(obj.userData.q0).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), a));

export function buildKeena() {
  const root = new THREE.Group();
  const M = {
    hair: ramp('hair'), mint: ramp('mint'), earIn: ramp('earIn'), skin: ramp('skin', { bias: 0.04 }),
    face: ramp('skin', { bias: 0.12, smooth: true }), tunic: ramp('tunic', { double: true }), cuff: ramp('cuff'),
    legs: ramp('legs'), boot: ramp('boot'), sole: ramp('sole'), lace: ramp('lace'), tongue: ramp('tongue', { bias: 0.1 }),
  };
  const rig = { locks: [], ears: [], arms: [] };

  // boots, folded socks and leggings
  for (const s of [-1, 1]) {
    const leg = group(root, [s * 0.072, 0, 0], [0, s * 0.08, 0]);
    mesh(new THREE.BoxGeometry(0.1, 0.022, 0.2), M.sole, leg, [0, 0.011, 0.03]);
    mesh(new THREE.BoxGeometry(0.092, 0.07, 0.15), M.boot, leg, [0, 0.055, 0.02]);
    mesh(new THREE.SphereGeometry(0.05, 7, 5), M.boot, leg, [0, 0.05, 0.085], null, [0.94, 0.8, 1]);
    mesh(new THREE.CylinderGeometry(0.05, 0.054, 0.17, 7), M.boot, leg, [0, 0.135, 0]);
    mesh(new THREE.CylinderGeometry(0.061, 0.058, 0.045, 8), M.legs, leg, [0, 0.238, 0]);
    for (let i = 0; i < 3; i++) for (const r of [-0.6, 0.6]) mesh(new THREE.BoxGeometry(0.046, 0.008, 0.008), M.lace, leg, [0, 0.09 + i * 0.038, 0.052 - i * 0.002], [0, 0, r]);
    mesh(new THREE.BoxGeometry(0.034, 0.016, 0.012), M.lace, leg, [0, 0.207, 0.056]);
    mesh(seg(0.07, 0.006, 0.005, 3), M.lace, leg, [0.008, 0.203, 0.058], [0.1, 0, 0.25]);
    mesh(seg(0.062, 0.006, 0.005, 3), M.lace, leg, [-0.008, 0.203, 0.058], [0.1, 0, -0.2]);
    mesh(seg(0.37, 0.04, 0.05, 7, 1, 1), M.legs, leg, [0, 0.235, 0]);
  }

  // loose sleeveless tunic; the hem's base positions are kept so the wind can ripple it
  const tunicGeo = new THREE.CylinderGeometry(0.12, 0.2, 0.52, 10, 3, true);
  mesh(tunicGeo, M.tunic, root, [0, 0.78, 0]);
  rig.hem = { geo: tunicGeo, base: tunicGeo.attributes.position.array.slice() };
  mesh(new THREE.CylinderGeometry(0.05, 0.121, 0.05, 10), M.tunic, root, [0, 1.064, 0]);
  mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.03, 10, 1, true), M.cuff, root, [0, 1.03, 0]);

  // arms: bare, with dark-teal cuffs lined pale pink and small round hands
  for (const s of [-1, 1]) {
    const sh = group(root, [s * 0.14, 1.0, 0], [0.05, 0, s * 0.16]);
    mesh(new THREE.SphereGeometry(0.045, 7, 5), M.skin, sh);
    mesh(seg(0.22, 0.037, 0.031, 6), M.skin, sh);
    const el = group(sh, [0, -0.22, 0], [-0.18, 0, -s * 0.06]);
    mesh(seg(0.19, 0.031, 0.027, 6), M.skin, el);
    mesh(seg(0.07, 0.042, 0.04, 8), M.cuff, el, [0, -0.1, 0]);
    mesh(seg(0.013, 0.044, 0.044, 8), M.legs, el, [0, -0.095, 0]);
    mesh(new THREE.SphereGeometry(0.035, 6, 5), M.skin, el, [0, -0.215, 0.004], null, [0.85, 1.15, 0.8]);
    rig.arms.push({ sh, el, s });
  }

  // neck and head
  mesh(new THREE.CylinderGeometry(0.033, 0.04, 0.1, 7), M.skin, root, [0, 1.1, 0]);
  const neck = group(root, [0, 1.1, 0]);
  const head = group(neck, [0, 0.14, 0]);
  mesh(headGeo(), M.face, head);

  // face: big teal eyes, rose brows, blush, mouth, and the goofy face's tongue and puffed cheek
  const eyes = [], brows = [];
  for (const s of [-1, 1]) {
    const m = eyeMat({ sclera: '#fbf6ee', irisA: '#0d6464', irisB: '#2f9a8c', pupil: '#062b2b', lash: '#4a1832', hi: '#ffffff', side: s });
    onFace(mesh(new THREE.PlaneGeometry(0.056, 0.066), m, head), s * 0.056, -0.004, 0.004);
    eyes.push({ m, s });
    brows.push({ o: onFace(mesh(new THREE.PlaneGeometry(0.046, 0.009), flat('#a4476f'), head), s * 0.058, 0.05, 0.005), s });
    onFace(mesh(new THREE.PlaneGeometry(0.03, 0.014), flat('#eaa0a0'), head), s * 0.088, -0.04, 0.003);
  }
  const mouthM = mouthMat({ line: '#5a1a36', inside: '#3a0c22', tongue: '#e8708e' });
  const mouth = onFace(mesh(new THREE.PlaneGeometry(0.05, 0.04), mouthM, head), 0, -0.078, 0.004);
  const tongue = onFace(group(head), 0.004, -0.088, -0.004);
  const tongueMesh = mesh(new THREE.BoxGeometry(0.026, 0.008, 0.036), M.tongue, tongue, [0, 0, 0.018]);
  const puff = onFace(mesh(new THREE.SphereGeometry(0.042, 8, 6), M.face, head), -0.074, -0.05, -0.024);

  // hair: a cap tilted back off the face, bangs (one mint), side locks and long back locks
  mesh(new THREE.SphereGeometry(0.163, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), M.hair, head, [0, 0.008, -0.006], [-0.7, 0, 0]);
  mesh(new THREE.SphereGeometry(0.166, 6, 3, -0.5, 1.0, 0, 0.5), M.mint, head, [0, 0.008, -0.006], [-0.7, 0, 0]);
  [-0.105, -0.07, -0.035, 0, 0.035, 0.07, 0.105].forEach((x, i) => {
    const g = onFace(group(head), x, 0.084 - Math.abs(x) * 0.28, 0.012);
    const len = 0.062 + ((i * 5) % 3) * 0.012 + (Math.abs(x) > 0.09 ? 0.03 : 0);
    mesh(seg(len, 0.024, 0.004, 4, 0.45), i === 4 ? M.mint : M.hair, g, null, [0.12, 0, -x * 1.6]);
  });
  for (const s of [-1, 1]) {
    for (const [dz, len] of [[0, 0.34], [-0.05, 0.27]]) {
      const g = group(head, [s * 0.132, 0.03, 0.055 + dz]);
      rig.locks.push({ chain: chain(g, [len / 2, len / 2], 0.032, 0.006, 4, 0.5, M.hair), ph: s * 1.3 + dz * 20, kind: 'side', s });
    }
  }
  [-0.112, -0.068, -0.023, 0.023, 0.068, 0.112].forEach((x, i) => {
    const z = -Math.sqrt(0.163 ** 2 - x * x) * 0.9;
    const g = group(head, [x, 0.03, z]);
    rig.locks.push({ chain: chain(g, [0.2, 0.2, 0.2], 0.046, 0.006, 4, 0.42, M.hair), ph: i * 0.9, kind: 'back', s: Math.sign(x) });
  });

  // tall bunny ears with pale inner panels; her right ear (s = -1) is bent at the tip like the sprite's
  for (const s of [-1, 1]) {
    const base = group(head, [s * 0.058, 0.135, -0.03], [-0.12, 0, -s * 0.2]);
    const e1 = group(base);
    mesh(seg(0.17, 0.03, 0.04, 6, 0.42, 1), M.hair, e1);
    mesh(seg(0.15, 0.017, 0.025, 5, 0.3, 1), M.earIn, e1, [0, 0.016, 0.011]);
    const e2 = group(e1, [0, 0.17, 0]);
    mesh(seg(0.15, 0.04, 0.012, 6, 0.42, 1), M.hair, e2);
    mesh(seg(0.12, 0.025, 0.007, 5, 0.3, 1), M.earIn, e2, [0, 0, 0.011]);
    rig.ears.push({ e1, e2, s });
  }

  function update(t, { goofy = 0, blink = 0, wind = 1, breathe = 1 } = {}) {
    const gust = wind * (0.65 + 0.35 * Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1.0));
    for (const L of rig.locks) {
      L.chain.forEach((p, k) => {
        const sway = Math.sin(t * 6.2 + L.ph + k * 0.9) * 0.07 * (k + 1) * gust;
        if (L.kind === 'back') {
          p.rotation.x = (k ? 0.1 : 0.2) + gust * 0.16 * (k + 1) + sway;
          p.rotation.z = L.s * 0.04 + Math.sin(t * 4.3 + L.ph + k) * 0.05 * gust;
        } else {
          p.rotation.x = 0.06 + gust * 0.1 + sway * 0.6;
          p.rotation.z = L.s * (0.07 + 0.06 * gust) + Math.sin(t * 5.1 + L.ph) * 0.04 * gust;
        }
      });
    }
    for (const E of rig.ears) {
      E.e1.rotation.x = -0.14 * gust + Math.sin(t * 5.3 + E.s) * 0.035 * gust;
      E.e2.rotation.x = (E.s < 0 ? 0.55 : 0.06) - 0.18 * gust + Math.sin(t * 6.1 + E.s * 2) * 0.07 * gust;
      E.e2.rotation.z = Math.sin(t * 3.7 + E.s) * 0.04 * gust;
    }
    const pos = rig.hem.geo.attributes.position, b = rig.hem.base;
    for (let i = 0; i < pos.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
      const k = Math.pow((0.26 - y) / 0.52, 2);
      const a = Math.atan2(z, x);
      pos.setXYZ(i, x * (1 + 0.04 * k * Math.sin(t * 7 + a * 3)), y + k * 0.012 * Math.sin(t * 8.5 + a * 4), z - k * (0.035 * gust + 0.012 * Math.sin(t * 9 + a * 3)));
    }
    pos.needsUpdate = true;
    for (const A of rig.arms) A.sh.rotation.x = 0.05 + Math.sin(t * 1.9 + A.s) * 0.02 * breathe;

    const g = goofy;
    for (const E of eyes) {
      E.m.uniforms.uIris.value.set(-E.s * 0.34 * g, -0.04 + 0.1 * g);
      E.m.uniforms.uOpen.value = lerp(0.84, 1.06, g) * (1 - blink);
    }
    for (const B of brows) {
      tilt(B.o, lerp(B.s * 0.26, -B.s * 0.12, g));
      B.o.position.copy(B.o.userData.p0).add(V3(0, lerp(-0.004, 0.014, g), 0));
    }
    mouthM.uniforms.uOpen.value = g;
    tongueMesh.scale.set(1, 1, Math.max(0.001, g));
    tongue.quaternion.copy(tongue.userData.q0).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.45 + 0.08 * Math.sin(t * 11) * g, 0.25 * g, 0)));
    puff.scale.setScalar(Math.max(0.001, smooth(0, 1, g) * (1 + 0.04 * Math.sin(t * 13))));
    neck.rotation.set(0.03 * g, 0, -0.13 * g);
    head.rotation.set(0, 0, 0);
  }

  update(0);
  const earTips = () => rig.ears.map((E) => E.e2.localToWorld(V3(0, 0.15, 0)));
  return { root, head, neck, update, earTips };
}

// Moku: a floating dark-teal blob with long thin bunny ears, pale slanted eyes and a tiny mouth. No limbs.
export function buildMoku() {
  const root = new THREE.Group();
  const body = group(root);
  const MB = ramp('moku', { smooth: true, bias: 0.08 });
  const ME = ramp('moku', { bias: 0.04 });
  const RB = 0.058, SB = [1, 0.93, 0.95];
  mesh(new THREE.IcosahedronGeometry(RB, 2), MB, body, null, null, SB);
  const ears = [];
  for (const s of [-1, 1]) {
    const e1 = group(body, [s * 0.024, 0.046, -0.004], [-0.06, 0, -s * 0.18]);
    mesh(seg(0.075, 0.012, 0.015, 5, 0.6, 1), ME, e1);
    const e2 = group(e1, [0, 0.075, 0]);
    mesh(seg(0.058, 0.015, 0.011, 5, 0.6, 1), ME, e2);
    mesh(new THREE.SphereGeometry(0.0125, 6, 4), ME, e2, [0, 0.058, 0], null, [1, 1.3, 0.6]);
    ears.push({ e1, e2, s });
  }
  const at = (obj, x, y, lift = 0.002) => {
    const z = Math.sqrt(Math.max(RB * RB - (x / SB[0]) ** 2 - (y / SB[1]) ** 2, 1e-6)) * SB[2];
    const n = V3(x / (SB[0] * SB[0]), y / (SB[1] * SB[1]), z / (SB[2] * SB[2])).normalize();
    obj.position.set(x, y, z).addScaledVector(n, lift);
    obj.quaternion.setFromUnitVectors(V3(0, 0, 1), n);
    obj.userData.q0 = obj.quaternion.clone();
    obj.userData.p0 = obj.position.clone();
    return obj;
  };
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = at(mesh(new THREE.CircleGeometry(1, 12), flat('#d6f2ea'), body), s * 0.021, 0.01);
    e.userData.s = s;
    eyes.push(e);
  }
  const mouthM = mouthMat({ line: '#021a1b', inside: '#3a0c22', tongue: '#e8708e' });
  at(mesh(new THREE.PlaneGeometry(0.028, 0.024), mouthM, body), 0, -0.019, 0.002);
  const tongue = at(group(body), 0.002, -0.025, -0.003);
  const tongueMesh = mesh(new THREE.BoxGeometry(0.014, 0.005, 0.02), ramp('tongue', { bias: 0.1 }), tongue, [0, 0, 0.01]);

  function update(t, { copy = 0, squash = 0 } = {}) {
    for (const E of ears) {
      E.e1.rotation.z = -E.s * 0.18 + Math.sin(t * 4.1 + E.s) * 0.07;
      E.e1.rotation.x = -0.06 + Math.sin(t * 3.3 + E.s * 2) * 0.05;
      E.e2.rotation.x = 0.1 + Math.sin(t * 5.2 + E.s) * 0.12;
    }
    for (const e of eyes) {
      const s = e.userData.s;
      // pale slanted ovals; for the copy they squint toward the middle like Keena's crossed eyes
      e.scale.set(lerp(0.0105, 0.012, copy), lerp(0.016, 0.0125, copy), 1);
      e.position.copy(e.userData.p0).add(V3(-s * 0.005 * copy, 0.002 * copy, 0));
      tilt(e, lerp(-s * 0.42, s * 0.3, copy));
    }
    mouthM.uniforms.uOpen.value = copy;
    tongueMesh.scale.set(1, 1, Math.max(0.001, copy));
    tongue.quaternion.copy(tongue.userData.q0).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0.3 * copy, 0)));
    body.scale.set(1 + 0.08 * squash, 1 - 0.12 * squash, 1 + 0.08 * squash);
    body.rotation.z = -0.18 * copy;
  }

  update(0);
  return { root, body, update };
}
