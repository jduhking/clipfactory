// Leporidia: terrain, grass, flowers, sky, mountains, the giant tree and hive, voidlings and particles.
import * as THREE from 'three';
import { rng, fbm2, smooth, lerp, loftTube, merge, withWindAttrs } from './geom.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, toon, outlineMaterial, withOutline, GRAD_ENV, GLSL_NOISE, GLSL_SKY } from './toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- terrain
export function cliffEdgeZ(x) {
  return -8.5 + 1.8 * Math.sin(x * 0.21 + 0.6) + 0.018 * x * x;
}
export const TREE_XZ = new THREE.Vector2(-46, -250);
export function terrainH(x, z) {
  const ez = cliffEdgeZ(x);
  const flat = 0.15 + 0.85 * smooth(0.6, 3.0, Math.hypot(x, z));
  const plateau = 0.22 * flat * (fbm2(x * 0.22, z * 0.22, 3) - 0.5) + Math.max(0, z - 14) * 0.045
    + 14 * smooth(40, 260, z) * (fbm2(x * 0.012 + 5, z * 0.012, 3) - 0.2);
  const dT = Math.hypot(x - TREE_XZ.x, z - TREE_XZ.y);
  const valley = -33 + 7 * (fbm2(x * 0.011 + 3, z * 0.011, 4) - 0.5) + 6 * Math.exp(-(dT * dT) / (2 * 50 * 50));
  const k = smooth(ez - 10, ez, z);
  const shape = Math.pow(k, 0.5);
  const ledge = 1.6 * (fbm2(x * 0.12, z * 0.12, 3) - 0.5) * Math.sin(Math.PI * k);
  return lerp(valley, plateau, shape) + ledge;
}

function terrainMesh() {
  const rings = 230, seg = 400, g = 0.032;
  const pos = [], idx = [];
  const radius = (i) => (i === 0 ? 0 : 0.06 * (Math.pow(1 + g, i) - 1) / g);
  for (let i = 0; i <= rings; i++) {
    const r = radius(i);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, terrainH(x, z), z);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg);
      const c = (i + 1) * seg + j, d = (i + 1) * seg + ((j + 1) % seg);
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// GLSL: corruption field shared by ground and grass. > 0.5 means void.
const GLSL_CORRUPT = /* glsl */ `
uniform float uCorruptFront; uniform float uCorruptBack;
float corruptSigned(vec3 p){
  float n = fbm(p.xz * 0.16 + vec2(uTime * 0.04, -uTime * 0.03));
  float front = (-p.z) - uCorruptFront + (n - 0.5) * 6.0;
  float back = length(p.xz) - uCorruptBack + (n - 0.5) * 9.0;
  float v = max(front, back);
  v = max(v, (-6.0 - p.y) * 2.0);
  return v;
}
float corruptAmt(vec3 p){ return smoothstep(-0.6, 0.6, corruptSigned(p)); }
`;

function groundMaterial() {
  return toon({
    color: '#ffffff', grad: GRAD_ENV,
    vertDecl: 'varying vec3 vWN;',
    vertBegin: 'vWN = normalize(mat3(modelMatrix) * objectNormal);',
    fragDecl: `varying vec3 vWN; uniform vec3 uGrassA; uniform vec3 uGrassB; uniform vec3 uRock; uniform vec3 uVoidGround; ${GLSL_CORRUPT}`,
    fragColor: `
      float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
      float gn = fbm(vWorldPos.xz * 0.3);
      vec3 gcol = mix(uGrassA, uGrassB, smoothstep(0.38, 0.68, gn));
      gcol = mix(gcol, uRock * (0.8 + 0.4 * fbm(vWorldPos.xz * 0.9 + vWorldPos.y)), smoothstep(0.22, 0.42, slope));
      float cs = corruptSigned(vWorldPos);
      float cm = smoothstep(-0.6, 0.6, cs);
      gcol = mix(gcol, uVoidGround * (0.7 + 0.6 * fbm(vWorldPos.xz * 0.5)), cm);
      diffuseColor.rgb = gcol;
      float veinN = fbm(vWorldPos.xz * 0.55 + vec2(0.0, uTime * 0.05));
      float veins = (1.0 - smoothstep(0.0, 0.045, abs(veinN - 0.5))) * cm;
      float edge = (1.0 - smoothstep(0.0, 1.1, abs(cs))) ;
      float pulse = 0.75 + 0.25 * sin(uTime * 2.3 + vWorldPos.x * 0.3);
      vec3 groundGlow = uVoidGlow * (veins * 2.2 * pulse + edge * 0.9);
    `,
    fragEmissive: 'totalEmissiveRadiance += groundGlow;',
    uniforms: {
      uGrassA: { value: new THREE.Color('#4f9277') },
      uGrassB: { value: new THREE.Color('#7fb991') },
      uRock: { value: new THREE.Color('#6c6a83') },
      uVoidGround: { value: new THREE.Color('#1b0f27') },
    },
  });
}

export function buildTerrain() {
  const m = new THREE.Mesh(terrainMesh(), groundMaterial());
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- grass and flowers
function bladeGeometry() {
  const segs = 4, w0 = 0.05;
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    const w = w0 * (1 - s) * (1 - 0.15 * s);
    const bend = 0.18 * s * s;
    if (i < segs) { pos.push(-w, s, bend, w, s, bend); } else { pos.push(0, s, bend); }
  }
  for (let i = 0; i < segs - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (segs - 1) * 2;
  idx.push(last, last + 1, last + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function grassMaterial() {
  return toon({
    color: '#ffffff', grad: GRAD_ENV, side: THREE.DoubleSide,
    vertDecl: `varying float vH; varying vec3 vIPos; uniform vec3 uWindDir;`,
    vertBegin: `
      vH = position.y;
      vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vIPos = ip;
      vec3 lw = normalize(transpose(mat3(instanceMatrix)) * uWindDir + 1e-5);
      float ph = ip.x * 0.55 + ip.z * 0.35;
      float sway = 0.55 + 0.35 * sin(uTime * 1.9 + ph) + 0.18 * sin(uTime * 3.7 + ph * 2.3);
      transformed += lw * sway * 0.42 * position.y * position.y;
      transformed.y -= 0.08 * sway * position.y * position.y;
    `,
    fragDecl: `varying float vH; varying vec3 vIPos; uniform vec3 uVoidGround; ${GLSL_CORRUPT}`,
    fragNormal: 'normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);',
    fragColor: `
      float cmB = corruptAmt(vIPos);
      vec3 bc = diffuseColor.rgb * mix(0.42, 1.22, smoothstep(0.0, 1.0, vH));
      vec3 vc = mix(uVoidGround * 0.8, uVoidGround * 2.2, vH);
      diffuseColor.rgb = mix(bc, vc, cmB);
      vec3 bladeGlow = uVoidGlow * cmB * smoothstep(0.75, 1.0, vH) * 1.6;
    `,
    fragEmissive: 'totalEmissiveRadiance += bladeGlow;',
    uniforms: { uVoidGround: { value: new THREE.Color('#1b0f27') } },
  });
}

function scatterPlateau(R, count, rMax, accept) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const r = rMax * Math.pow(R(), 0.62);
    const a = R() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z < cliffEdgeZ(x) + 0.6) continue;
    if (accept && !accept(x, z, r)) continue;
    out.push([x, terrainH(x, z), z, r]);
  }
  return out;
}

export function buildGrass(avoid) {
  const R = rng(7);
  const pts = scatterPlateau(R, 52000, 16, (x, z, r) => !avoid(x, z) && (r < 6 || R() < 0.75));
  const mesh = new THREE.InstancedMesh(bladeGeometry(), grassMaterial(), pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const cols = ['#5b9d80', '#6fae8a', '#4f948c', '#8cc28f', '#3f8577', '#9fd1b0'].map((c) => new THREE.Color(c));
  pts.forEach(([x, y, z, r], i) => {
    const h = (0.13 + 0.2 * R()) * (r < 1.2 ? 0.8 : 1) * (1 + 0.25 * fbm2(x * 0.4, z * 0.4, 2));
    q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.25, R() * Math.PI * 2, (R() - 0.5) * 0.25));
    m.compose(p.set(x, y - 0.01, z), q, s.set(h, h, h));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, cols[Math.floor(R() * cols.length)]);
  });
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

export function buildFlowers(avoid) {
  const R = rng(11);
  const pts = scatterPlateau(R, 1400, 13, (x, z) => !avoid(x, z) && fbm2(x * 0.35, z * 0.35, 2) > 0.42);
  const stemG = new THREE.CylinderGeometry(0.0022, 0.003, 1, 5, 1);
  stemG.translate(0, 0.5, 0);
  const headParts = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const pg = new THREE.SphereGeometry(1, 6, 4);
    pg.scale(0.012, 0.004, 0.008);
    pg.translate(0.011, 0, 0);
    pg.rotateY(a);
    headParts.push(pg);
  }
  const center = new THREE.SphereGeometry(0.0055, 6, 4);
  center.scale(1, 0.7, 1);
  headParts.push(center);
  const headG = merge(headParts);
  const n = pts.length;
  const stemMat = toon({ color: '#3f7f62', grad: GRAD_ENV });
  const headMat = toon({ color: '#ffffff', grad: GRAD_ENV, emissive: '#ffffff', emissiveIntensity: 0.08 });
  const stems = new THREE.InstancedMesh(stemG, stemMat, n);
  const heads = new THREE.InstancedMesh(headG, headMat, n);
  const cols = ['#f2a39c', '#d9668c', '#f7eee6', '#2f7f78', '#a6dccb', '#f2a39c', '#d9668c'].map((c) => new THREE.Color(c));
  const base = [];
  pts.forEach(([x, y, z], i) => {
    base.push({ x, y, z, h: 0.07 + 0.12 * R(), sc: 0.8 + 0.7 * R(), yaw: R() * 6.28, ph: R() * 6.28 });
    heads.setColorAt(i, cols[Math.floor(R() * cols.length)]);
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const tip = new THREE.Vector3();
  const wind = U.uWindDir.value;
  const update = (t) => {
    base.forEach((b, i) => {
      const sway = 0.12 * (0.6 + 0.4 * Math.sin(t * 1.9 + b.x * 0.55 + b.z * 0.35 + b.ph * 0.2));
      e.set(wind.z * sway, b.yaw, -wind.x * sway, 'YXZ');
      q.setFromEuler(e);
      p.set(b.x, b.y - 0.005, b.z);
      m.compose(p, q, s.set(b.sc, b.h, b.sc));
      stems.setMatrixAt(i, m);
      tip.set(0, b.h, 0).applyQuaternion(q).add(p);
      m.compose(tip, q, s.set(b.sc, b.sc, b.sc));
      heads.setMatrixAt(i, m);
    });
    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  };
  stems.castShadow = heads.castShadow = false;
  stems.receiveShadow = heads.receiveShadow = true;
  stems.frustumCulled = heads.frustumCulled = false;
  const group = new THREE.Group();
  group.add(stems, heads);
  update(0);
  return { group, update };
}

export function buildRocks() {
  const R = rng(19);
  const group = new THREE.Group();
  const mat = toon({ color: '#77748e', grad: GRAD_ENV });
  const line = outlineMaterial({ color: '#1d1a2c', widthPx: 1.6, refDist: 6 });
  for (let i = 0; i < 26; i++) {
    const x = (R() - 0.5) * 40;
    const onEdge = i < 18;
    const z = onEdge ? cliffEdgeZ(x) + (R() - 0.3) * 2.0 : 4 + R() * 16;
    if (Math.hypot(x, z) < 3.5) continue;
    const g = new THREE.DodecahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const v = V(p.getX(k), p.getY(k), p.getZ(k));
      v.multiplyScalar(0.8 + 0.35 * fbm2(v.x * 1.7 + i, v.z * 1.7 + v.y, 2));
      p.setXYZ(k, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const sc = onEdge ? 0.4 + R() * 1.3 : 0.25 + R() * 0.5;
    g.scale(sc * (1 + R() * 0.6), sc * (0.55 + R() * 0.5), sc * (1 + R() * 0.5));
    g.rotateY(R() * 6.28);
    g.translate(x, terrainH(x, z) + sc * 0.15, z);
    withOutline(group, g, mat, line);
  }
  return group;
}

// ---------------------------------------------------------------- sky and mountains
export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { ...U },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = (modelMatrix * vec4(position, 0.0)).xyz; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uVoidCore; uniform vec3 uVoidDark;
      ${GLSL_NOISE}
      ${GLSL_SKY}
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        float s = pow(sunSide(d), 1.8);
        vec3 col = skyGradient(d);
        // haze band hugging the horizon: warm toward the sun, violet toward the void
        col += mix(vec3(0.05, 0.012, 0.08), vec3(0.35, 0.12, 0.05), s) * exp(-abs(h) * 22.0);
        float sd = max(dot(d, uSunDir), 0.0);
        // streaky cloud layers on a dome
        vec2 cp = d.xz / (max(h, 0.0) + 0.1);
        float flow = uTime * 0.03;
        float c1 = fbm(cp * vec2(0.55, 1.5) + vec2(flow, 0.0));
        float c2 = fbm(cp * 2.4 + vec2(-flow * 1.7, flow) + c1 * 1.5);
        float cloud = smoothstep(0.52, 0.78, c1 * 0.7 + c2 * 0.4) * smoothstep(0.015, 0.07, h) * (1.0 - smoothstep(0.45, 0.8, h));
        float lit = smoothstep(0.35, 0.8, c2);
        vec3 cloudSun = mix(vec3(0.36, 0.13, 0.27), vec3(1.0, 0.52, 0.36), lit);
        cloudSun += uSunCore * pow(sd, 10.0) * 0.8 * lit;
        vec3 cloudVoid = mix(vec3(0.025, 0.012, 0.05), uVoidGlow * 0.22, lit * 0.6);
        col = mix(col, mix(cloudVoid, cloudSun, s), cloud * 0.85);
        // sun: tight disc with a soft halo
        col += uSunCore * (pow(sd, 2500.0) * 6.0 + pow(sd, 200.0) * 0.55 + pow(sd, 24.0) * 0.22) * (1.0 - cloud * 0.6);
        // void vortex above the giant tree
        vec3 vz = normalize(uVortexDir);
        vec3 vx = normalize(cross(vz, vec3(0.0, 1.0, 0.0)));
        vec3 vy = cross(vx, vz);
        float facing = dot(d, vz);
        if (facing > 0.0) {
          vec2 q = vec2(dot(d, vx), dot(d, vy)) / facing;
          float r = length(q);
          float ang = atan(q.y, q.x);
          float sw = ang + 1.6 / (r + 0.12) - uTime * 0.45;
          float arms = fbm(vec2(cos(sw), sin(sw)) * 2.2 + r * 3.0 - uTime * 0.05);
          float spiral = smoothstep(0.35, 0.75, arms) * smoothstep(0.95, 0.15, r);
          vec3 vcol = mix(uVoidDark, uVoidGlow * 0.55, spiral * (0.4 + 0.6 * smoothstep(0.5, 0.15, r)));
          float core = smoothstep(0.14, 0.05, r);
          float ring = smoothstep(0.05, 0.12, r) * smoothstep(0.24, 0.12, r);
          vcol = mix(vcol, uVoidCore, core);
          vcol += uVoidGlow * ring * (1.4 + 2.5 * uFlash) * (0.7 + 0.3 * sin(ang * 6.0 + uTime * 3.0));
          float mask = smoothstep(1.1, 0.35, r) * facing;
          col = mix(col, vcol, mask * 0.92);
          col += uVoidGlow * uFlash * smoothstep(0.9, 0.1, r) * (0.6 + arms) * 1.2;
        }
        // stars near the zenith
        vec2 sg = floor(d.xz / (h + 0.4) * 180.0);
        float st = step(0.9965, hash12(sg)) * smoothstep(0.45, 0.85, h) * (0.6 + 0.4 * sin(uTime * 3.0 + hash12(sg + 3.0) * 30.0));
        col += vec3(0.9, 0.85, 1.0) * st * 0.6 * (1.0 - cloud);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}

export function buildMountains() {
  const group = new THREE.Group();
  const layers = [
    { r: 650, hMin: 40, hMax: 170, col: '#3a3d63', seed: 1 },
    { r: 1050, hMin: 80, hMax: 300, col: '#3a3159', seed: 2 },
    { r: 1700, hMin: 150, hMax: 520, col: '#3a2c55', seed: 3 },
  ];
  for (const L of layers) {
    const seg = 512, rows = 6;
    const pos = [], idx = [];
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const n = fbm2(Math.cos(a) * 3 + L.seed * 10, Math.sin(a) * 3, 5);
      const peak = L.hMin + (L.hMax - L.hMin) * Math.pow(n, 1.6) * 1.6;
      for (let i = 0; i <= rows; i++) {
        const f = i / rows;
        const rr = L.r * (1 + 0.08 * (1 - f));
        const y = -60 + (peak + 60) * Math.pow(f, 0.9);
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      }
    }
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < rows; i++) {
        const a = j * (rows + 1) + i, b = (j + 1) * (rows + 1) + i;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = toon({ color: L.col, grad: GRAD_ENV, side: THREE.DoubleSide, fogMul: 0.5 });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    group.add(m);
  }
  return group;
}

// ---------------------------------------------------------------- giant tree and beehive
export function buildTree() {
  const R = rng(23);
  const base = V(TREE_XZ.x, terrainH(TREE_XZ.x, TREE_XZ.y) - 1.5, TREE_XZ.y);
  const group = new THREE.Group();
  group.position.copy(base);
  // corruption: climbs the bark and canopy from the ground; drips down the hive from its top
  const corruptFrag = (kind) => `
      float relY = vWorldPos.y - uTreeBaseY;
      float tn = fbm(vWorldPos.xz * 0.07 + vec2(vWorldPos.y * 0.05, 0.0));
      float cs = ${kind === 'hive'
        ? '(relY - (uHiveTop - uTreeCorrupt * 24.0)) + (tn - 0.5) * 12.0'
        : `((-6.0 + uTreeCorrupt * 104.0) - relY) + (tn - 0.5) * ${kind === 'leaf' ? '30.0' : '18.0'}`};
      float tc = smoothstep(-1.5, 1.5, cs);
      diffuseColor.rgb = mix(diffuseColor.rgb, uTreeVoid * (0.8 + 0.5 * tn), tc);
      float tveinN = fbm(vWorldPos.xz * 0.21 + vWorldPos.y * 0.13 + vec2(uTime * 0.05));
      float tveins = (1.0 - smoothstep(0.0, 0.05, abs(tveinN - 0.5))) * tc;
      float tedge = 1.0 - smoothstep(0.0, 2.2, abs(cs));
      vec3 treeGlow = uVoidGlow * (tveins * 2.4 + tedge * 1.2) * (0.8 + 0.2 * sin(uTime * 2.0 + relY * 0.2));`;
  const treeUniforms = () => ({
    uTreeBaseY: { value: base.y },
    uHiveTop: { value: 0 },
    uTreeVoid: { value: new THREE.Color('#1d0f2c') },
  });
  const mk = (color, kind, extra = {}) => toon({
    color, grad: GRAD_ENV, fogMul: 0.4, ...extra,
    fragDecl: 'uniform float uTreeBaseY; uniform float uHiveTop; uniform vec3 uTreeVoid; uniform float uTreeCorrupt;',
    fragColor: corruptFrag(kind),
    fragEmissive: 'totalEmissiveRadiance += treeGlow;',
    uniforms: treeUniforms(),
  });
  const barkMat = mk('#6a5a4e', 'bark');
  const leafMat = mk('#93cf86', 'leaf');
  const hiveMat = mk('#e7ad4b', 'hive', { emissive: '#4a2a08', emissiveIntensity: 0.25 });
  const line = outlineMaterial({ color: '#1a1626', widthPx: 1.4, refDist: 120 });

  // trunk, roots and branches
  const wood = [];
  const trunkPts = [V(0, -6, 0), V(2, 14, 1), V(-1.5, 30, -1), V(1.2, 46, 1), V(-0.5, 64, -1), V(1, 82, -3), V(2, 94, -4)];
  wood.push(loftTube(trunkPts, (s) => {
    const r = 4.2 + 7.5 * Math.pow(1 - s, 3) + 1.6 * (1 - s);
    return { w: r, t: r };
  }, { along: 48, around: 28, windScale: 0 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + R() * 0.4;
    const c = Math.cos(a), s = Math.sin(a);
    const len = 20 + R() * 12;
    wood.push(loftTube([V(c * 4, 8, s * 4), V(c * 10, 3, s * 10), V(c * len * 0.75, -1.5, s * len * 0.75), V(c * len, -4, s * len)],
      (t) => ({ w: 4.5 * (1 - t) + 0.5, t: 3.6 * (1 - t) + 0.4 }), { along: 20, around: 14, windScale: 0, outFn: () => V(0, 1, 0) }));
  }
  // foliage clusters (relative to the tree base); the camera looks from +z, so spread them wide in x
  const clusters = [
    [V(32, 70, 8), 1.0], [V(-36, 66, 6), 1.0], [V(-18, 84, -22), 1.0], [V(22, 88, -18), 0.95],
    [V(2, 100, -4), 1.1], [V(-6, 72, 26), 0.85], [V(-54, 57, -6), 0.72], [V(55, 59, -4), 0.7],
  ];
  // major limbs from the trunk into each cluster, plus a side branch toward a satellite clump
  clusters.forEach(([c, sz], i) => {
    const y0 = 40 + (i % 4) * 5;
    const st = V(c.x * 0.06, y0, c.z * 0.06);
    const end = c.clone().add(V(0, -5 * sz, 0));
    const m1 = st.clone().lerp(end, 0.38).add(V(0, 7, 0));
    const m2 = st.clone().lerp(end, 0.72).add(V(0, 4, 0));
    wood.push(loftTube([st, m1, m2, end], (t) => { const r = 3.9 * (1 - t) + 1.1; return { w: r, t: r }; }, { along: 20, around: 12, windScale: 0 }));
    const side = m2.clone().add(V((R() - 0.5) * 22, 9 + R() * 6, (R() - 0.5) * 16));
    wood.push(loftTube([m1.clone().lerp(m2, 0.55), side], (t) => { const r = 1.6 * (1 - t) + 0.6; return { w: r, t: r }; }, { along: 8, around: 8, windScale: 0 }));
  });
  // the hive branch reaches toward the valley centre (+x, toward Keena)
  const hiveAnchor = V(27, 47, 10);
  wood.push(loftTube([V(1, 42, 0), V(10, 46, 3), V(20, 48.5, 7), hiveAnchor, V(36, 50, 13)],
    (t) => { const r = 3.4 * (1 - t) + 1.0; return { w: r, t: r }; }, { along: 24, around: 14, windScale: 0 }));
  withOutline(group, merge(wood), barkMat, line);

  // canopy: cumulus-like clumps with flat undersides, separated by gaps that show the limbs
  const blobs = [];
  const addBlob = (c, r, seed) => {
    let g = new THREE.IcosahedronGeometry(1, 3);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const v = V(p.getX(k), p.getY(k), p.getZ(k));
      v.multiplyScalar(1 + 0.15 * (fbm2(v.x * 2 + seed, v.z * 2 + v.y * 2 + seed * 0.7, 3) - 0.5) * 2);
      p.setXYZ(k, v.x, v.y < 0 ? v.y * 0.5 : v.y * 0.9, v.z);
    }
    g.scale(r, r, r);
    g.translate(c.x, c.y, c.z);
    blobs.push(g);
  };
  clusters.forEach(([c, sz], i) => {
    addBlob(c, 13.5 * sz, i * 7.1);
    const nSat = 8;
    for (let k = 0; k < nSat; k++) {
      const a = (k / nSat) * Math.PI * 2 + R() * 0.5;
      const d = (10 + R() * 6) * sz;
      addBlob(c.clone().add(V(Math.cos(a) * d, (-2 + R() * 6) * sz, Math.sin(a) * d)), (7.5 + R() * 3.5) * sz, i * 7.1 + k);
    }
    for (let k = 0; k < 3; k++) {
      const a = R() * Math.PI * 2, d = R() * 6 * sz;
      addBlob(c.clone().add(V(Math.cos(a) * d, (7 + R() * 4) * sz, Math.sin(a) * d)), (7 + R() * 2.5) * sz, i * 7.1 + 20 + k);
    }
  });
  const canopy = merge(blobs.map((g) => { g.computeVertexNormals(); return g; }));
  withOutline(group, canopy, leafMat, line);

  // beehive hanging from the hive branch
  const hiveTop = hiveAnchor.clone().add(V(0, -1, 0));
  const HH = 30;
  const hiveR = (f) => {
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, f * 1.02)), 0.75) * (1 - 0.25 * f);
    const ridge = 0.55 * Math.pow(Math.abs(Math.sin(f * Math.PI * 9)), 0.6);
    return 1.2 + 11.5 * env + ridge * env;
  };
  const prof = [];
  for (let i = 60; i >= 0; i--) {
    const f = i / 60; // 0 top -> 1 bottom; listed bottom-up so lathe normals face outward
    const r = hiveR(f) * (f > 0.985 ? (1 - f) * 66 : 1);
    prof.push(new THREE.Vector2(Math.max(0.05, r), -f * HH));
  }
  const hiveG = new THREE.LatheGeometry(prof, 48);
  hiveG.translate(hiveTop.x, hiveTop.y, hiveTop.z);
  hiveMat.userData.local.uHiveTop.value = hiveTop.y; // relative to the tree base
  withOutline(group, hiveG, hiveMat, line);
  // entrance with void glow, facing Keena (+z/+x)
  const toKeena = V(-base.x - hiveTop.x, 0, -base.z - hiveTop.z).normalize();
  const ent = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#d48cff').multiplyScalar(2.4) }));
  ent.scale.set(3.4, 2.4, 1);
  const entY = -HH * 0.62;
  const rAt = hiveR(0.62) + 0.7;
  const faceQ = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), toKeena);
  ent.position.copy(hiveTop).add(V(toKeena.x * rAt, entY, toKeena.z * rAt));
  ent.quaternion.copy(faceQ);
  group.add(ent);
  const entCore = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: '#07020c' }));
  entCore.scale.set(2.6, 1.7, 1);
  entCore.position.copy(ent.position).addScaledVector(toKeena, 0.08);
  entCore.quaternion.copy(faceQ);
  group.add(entCore);
  // dripping void goo
  const drips = [];
  for (let i = 0; i < 9; i++) {
    const a = R() * 6.28, rr = 3 + R() * 6;
    const top = hiveTop.clone().add(V(Math.cos(a) * rr, -HH * (0.82 + R() * 0.1), Math.sin(a) * rr));
    const len = 4 + R() * 7;
    drips.push(loftTube([top, top.clone().add(V(0, -len * 0.5, 0)), top.clone().add(V(0, -len, 0))],
      (t) => ({ w: 0.9 * (1 - t * 0.6) + 0.5 * Math.pow(t, 6), t: 0.9 * (1 - t * 0.6) + 0.5 * Math.pow(t, 6) }), { along: 10, around: 10, windScale: 0 }));
  }
  const gooMat = toon({ color: '#170a22', grad: GRAD_ENV, emissive: '#7a2fd0', emissiveIntensity: 0.9 });
  withOutline(group, merge(drips), gooMat, null);

  // void tendrils spiralling up the trunk, revealed as the corruption climbs
  const tendrils = [];
  for (let k = 0; k < 6; k++) {
    const pts = [];
    const a0 = (k / 6) * Math.PI * 2;
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      const y = -4 + f * 80;
      const r = 4.2 + 7.5 * Math.pow(1 - Math.min(1, y / 72), 3) + 1.6 * (1 - y / 72) + 1.0;
      const a = a0 + f * Math.PI * 2.6 * (k % 2 ? 1 : -1);
      pts.push(V(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    tendrils.push(loftTube(pts, (t) => ({ w: 1.1 * (1 - t) + 0.25, t: 0.8 * (1 - t) + 0.2 }), { along: 90, around: 8, windScale: 0 }));
  }
  const tendrilMat = toon({
    color: '#12071d', grad: GRAD_ENV,
    fragDecl: 'uniform float uTreeBaseY; uniform float uTreeCorrupt;',
    fragColor: `
      float relY2 = vWorldPos.y - uTreeBaseY;
      float cH2 = -6.0 + uTreeCorrupt * 104.0;
      if (relY2 > cH2 + 3.0) discard;
      float stripe = smoothstep(0.75, 1.0, sin(relY2 * 1.3 - uTime * 4.0) * 0.5 + 0.5);
      vec3 tGlow = uVoidGlow * (0.5 + stripe * 2.5);`,
    fragEmissive: 'totalEmissiveRadiance += tGlow;',
    uniforms: { uTreeBaseY: { value: base.y } },
  });
  withOutline(group, merge(tendrils), tendrilMat, null);

  group.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
  const hiveWorld = hiveTop.clone().add(base).add(V(0, -HH * 0.5, 0));
  const crownWorld = V(0, 80, 0).add(base);
  return { group, base, hiveWorld, crownWorld };
}

// ---------------------------------------------------------------- voidlings
export function buildVoidlings(tree) {
  const R = rng(31);
  const list = [];
  // valley horde, facing Keena
  for (let i = 0; i < 420; i++) {
    const z = -24 - Math.pow(R(), 0.8) * 200;
    const spread = 30 + (-z) * 0.55;
    const x = (R() - 0.5) * 2 * spread - 8;
    const g = terrainH(x, z);
    if (g > -12) continue;
    list.push({ kind: 0, p: V(x, g + 1.2 + R() * 7, z), s: 0.55 + R() * 0.55, ph: R() * 6.28, sp: 0.6 + R() * 0.8 });
  }
  // risers drifting up the cliff toward her
  for (let i = 0; i < 26; i++) {
    const x = (R() - 0.5) * 26;
    const z = cliffEdgeZ(x) - 3 - R() * 9;
    list.push({ kind: 1, p: V(x, -16 + R() * 12, z), s: 0.5 + R() * 0.35, ph: R() * 6.28, sp: 0.4 + R() * 0.5 });
  }
  // swarm around the canopy and hive
  for (let i = 0; i < 180; i++) {
    const aroundHive = i < 80;
    const c = aroundHive ? tree.hiveWorld : tree.crownWorld;
    list.push({ kind: 2, c, r: (aroundHive ? 16 : 48) + R() * (aroundHive ? 14 : 22), y: (R() - 0.5) * (aroundHive ? 30 : 40), s: 1.4 + R() * 1.4, ph: R() * 6.28, sp: (0.08 + R() * 0.12) * (R() < 0.5 ? 1 : -1) });
  }
  // a few silhouettes over the meadow behind her
  for (let i = 0; i < 16; i++) {
    const a = (R() - 0.5) * 2.2;
    const d = 60 + R() * 120;
    list.push({ kind: 3, p: V(Math.sin(a) * d, 8 + R() * 30, Math.cos(a) * d + 20), s: 0.9 + R() * 0.9, ph: R() * 6.28, sp: 0.5 + R() * 0.5 });
  }
  const n = list.length;
  const bodyG = new THREE.SphereGeometry(1, 18, 12);
  const bodyMat = toon({ color: '#0d0716', grad: GRAD_ENV, rim: { color: '#b56bff', strength: 0, fillColor: '#b56bff', fillStrength: 0 }, fogMul: 0.8,
    fragEmissive: `
      {
        vec3 Vd2 = normalize(vViewPosition);
        float fr = pow(1.0 - clamp(dot(normal, Vd2), 0.0, 1.0), 2.2);
        totalEmissiveRadiance += uVoidGlow * fr * 2.2;
      }` });
  const bodies = new THREE.InstancedMesh(bodyG, bodyMat, n);
  const eyeParts = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.SphereGeometry(1, 10, 6);
    e.scale(0.17, 0.2, 0.06);
    e.translate(sx * 0.3, 0.12, 0.95);
    eyeParts.push(e);
  }
  const eyeG = merge(eyeParts);
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.2) });
  const eyes = new THREE.InstancedMesh(eyeG, eyeMat, n);
  // aura billboards
  const auraMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color('#9a4dff') }, uTime: U.uTime },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sc = length(vec3(instanceMatrix[0].xyz));
        c.xy += (uv - 0.5) * 2.0 * sc * 2.6;
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.35, d) * 0.55;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
  const auras = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), auraMat, n);
  [bodies, eyes, auras].forEach((m) => { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const look = new THREE.Matrix4();
  const keena = V(0, 1.2, 0);
  const UP = V(0, 1, 0);
  const update = (t) => {
    list.forEach((v, i) => {
      let target = keena;
      if (v.kind === 2) {
        const a = v.ph + t * v.sp;
        p.set(v.c.x + Math.cos(a) * v.r, v.c.y + v.y + Math.sin(t * 0.9 + v.ph) * 2, v.c.z + Math.sin(a) * v.r);
        target = v.c;
      } else {
        p.copy(v.p);
        p.y += Math.sin(t * 1.6 * v.sp + v.ph) * 0.35 * v.s;
        if (v.kind === 1) p.y += t * 0.55 * v.sp;
        if (v.kind === 0) p.z += t * 0.6 * v.sp;
        p.x += Math.sin(t * 0.7 + v.ph) * 0.4;
      }
      look.lookAt(target, p, UP);
      q.setFromRotationMatrix(look); // +Z (eyes) faces the target
      const squash = 1 + 0.06 * Math.sin(t * 3.1 * v.sp + v.ph);
      m4.compose(p, q, sc.set(v.s * squash, v.s / squash, v.s * squash));
      bodies.setMatrixAt(i, m4);
      eyes.setMatrixAt(i, m4);
      auras.setMatrixAt(i, m4);
    });
    bodies.instanceMatrix.needsUpdate = eyes.instanceMatrix.needsUpdate = auras.instanceMatrix.needsUpdate = true;
  };
  const group = new THREE.Group();
  group.add(bodies, eyes, auras);
  update(0);
  return { group, update };
}

// ---------------------------------------------------------------- particles
function particleMaterial({ color, additive = true, size = 0.03, box, speed, kind = 0, opacity = 1 }) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: U.uTime, uWindDir: U.uWindDir, uColor: { value: new THREE.Color(color) },
      uBoxMin: { value: box[0] }, uBoxSize: { value: box[1] }, uSize: { value: size }, uSpeed: { value: speed },
      uOpacity: { value: opacity }, uAura: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed4;
      uniform float uTime; uniform vec3 uWindDir; uniform vec3 uBoxMin; uniform vec3 uBoxSize; uniform float uSize; uniform vec2 uSpeed; uniform float uAura;
      varying vec2 vUv; varying float vTw;
      void main(){
        vUv = uv;
        vec3 p;
        float t = uTime;
        ${kind === 2 ? `
          // aura motes orbiting Keena
          float r = 0.3 + aSeed4.x * 0.85;
          float a = aSeed4.y * 6.2831 + t * (0.25 + aSeed4.z * 0.5) * (aSeed4.w > 0.5 ? 1.0 : -1.0) * (0.7 + 0.6 * uAura);
          float y = mod(aSeed4.z * 2.1 + t * (0.05 + aSeed4.w * 0.12), 2.1) - 0.05;
          p = vec3(cos(a) * r, y, sin(a) * r);
        ` : `
          vec3 start = uBoxMin + aSeed4.xyz * uBoxSize;
          vec3 vel = uWindDir * uSpeed.x * (0.6 + aSeed4.w) + vec3(0.0, uSpeed.y * (0.5 + aSeed4.w), 0.0);
          p = start + vel * t;
          p += vec3(sin(t * 1.3 + aSeed4.w * 20.0), sin(t * 0.9 + aSeed4.x * 15.0), cos(t * 1.1 + aSeed4.y * 12.0)) * 0.25;
          p = uBoxMin + mod(p - uBoxMin, uBoxSize);
        `}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float tw = 0.6 + 0.4 * sin(t * (2.0 + aSeed4.w * 4.0) + aSeed4.x * 30.0);
        vTw = tw;
        float s = uSize * (0.5 + aSeed4.w);
        ${kind === 1 ? `
          float rot = t * (1.5 + aSeed4.x * 3.0) + aSeed4.y * 6.28;
          vec2 c2 = (uv - 0.5) * vec2(1.0, 0.6 + 0.4 * sin(rot * 1.7));
          mat2 R2 = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
          mv.xy += R2 * c2 * 2.0 * s;
        ` : `mv.xy += (uv - 0.5) * 2.0 * s;`}
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uAura; varying vec2 vUv; varying float vTw;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        ${kind === 1 ? `
          float a = smoothstep(1.0, 0.8, d) * uOpacity;
          if (a < 0.02) discard;
          gl_FragColor = vec4(uColor, a);
        ` : `
          float core = smoothstep(0.35, 0.0, d);
          float halo = smoothstep(1.0, 0.0, d);
          float a = (core * 1.6 + halo * halo * 0.6) * vTw * uOpacity ${kind === 2 ? '* uAura' : ''};
          gl_FragColor = vec4(uColor * a, 1.0);
        `}
      }`,
  });
}

function particleSystem(count, seed, matOpts) {
  const R = rng(seed);
  const g = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  g.setIndex(quad.index);
  g.setAttribute('position', quad.attributes.position);
  g.setAttribute('uv', quad.attributes.uv);
  const s = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) s[i] = R();
  g.setAttribute('aSeed4', new THREE.InstancedBufferAttribute(s, 4));
  g.instanceCount = count;
  const mesh = new THREE.Mesh(g, particleMaterial(matOpts));
  mesh.frustumCulled = false;
  return mesh;
}

export function buildParticles() {
  const group = new THREE.Group();
  const embers = particleSystem(1600, 41, { color: '#b46bff', size: 0.022, box: [V(-14, -3, -16), V(28, 12, 30)], speed: new THREE.Vector2(0.9, 0.35) });
  const ash = particleSystem(900, 43, { color: '#140a1f', additive: false, kind: 1, size: 0.02, box: [V(-12, -1, -14), V(24, 9, 26)], speed: new THREE.Vector2(1.3, 0.2), opacity: 0.9 });
  const petals = particleSystem(420, 47, { color: '#f3a2b2', additive: false, kind: 1, size: 0.016, box: [V(-7, 0, -8), V(14, 3.2, 16)], speed: new THREE.Vector2(1.1, 0.05), opacity: 1 });
  const farEmbers = particleSystem(1800, 53, { color: '#a35bff', size: 0.45, box: [V(-160, -36, -320), V(260, 120, 300)], speed: new THREE.Vector2(2.5, 1.2) });
  const aura = particleSystem(220, 59, { color: '#c9fff0', size: 0.012, kind: 2, box: [V(0, 0, 0), V(1, 1, 1)], speed: new THREE.Vector2(0, 0) });
  group.add(embers, ash, petals, farEmbers, aura);
  return { group, auraMat: aura.material };
}
