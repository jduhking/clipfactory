// Shared pieces of the low-poly pixel-art scene: palette ramps, the flat-shaded ramp material, the eye and mouth
// shaders, geometry helpers, easing and noise. Colour management is off, so every pixel comes straight from the palette.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeOutBack = (t, s = 1.7) => { t = clamp(t) - 1; return 1 + (s + 1) * t * t * t + s * t * t; };

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
export const fbm = (x, z) => 0.6 * noise2(x, z) + 0.3 * noise2(2.03 * x + 7.1, 2.03 * z - 3.3) + 0.1 * noise2(4.1 * x - 11.7, 4.1 * z + 5.9);

// The six swatches on Vi Nguyen's moodboard, then four-step ramps (deep shadow, shadow, base, light) built around them
// and the colours of the game's own sprites.
export const SWATCH = { tealDeep: '#0d6464', teal: '#5a8f86', mint: '#9ccbbf', cream: '#ebe2d8', salmon: '#eaa0a0', rose: '#d06b8a' };
export const RAMP = {
  hair: ['#6a2445', '#a4476f', '#d06b8a', '#eb94ac'],
  mint: ['#2c6a63', '#5a8f86', '#9ccbbf', '#c9ebe0'],
  earIn: ['#b25a78', '#d9829a', '#eeaab8', '#f8cdd3'],
  skin: ['#c2827e', '#dfa79c', '#f2cdbf', '#fce6da'],
  tunic: ['#2c665f', '#5a8f86', '#9ccbbf', '#c9ebe0'],
  cuff: ['#042b2c', '#0a4f50', '#0d6464', '#2b827b'],
  legs: ['#b97c80', '#d79a9c', '#eab6b0', '#f6d2ca'],
  boot: ['#042a29', '#0b4240', '#145a55', '#2a7a70'],
  sole: ['#7e2f50', '#a8466e', '#d06b8a', '#e88aa4'],
  tongue: ['#9a3050', '#c94a6c', '#e8708e', '#f598b0'],
  lace: ['#9c9086', '#c4b9ad', '#ebe2d8', '#fbf6ee'],
  moku: ['#032628', '#06393c', '#0d6464', '#2a8580'],
  grass: ['#0b302f', '#174c46', '#2f6f60', '#5f9a7c'],
  grassTuft: ['#123c38', '#22584e', '#3f8068', '#7cb38a'],
  dirt: ['#5a2630', '#8a3b3e', '#b9544a', '#df6d58'],
  rock: ['#1f2136', '#2f3350', '#474d6c', '#666e8e'],
  bark: ['#22161e', '#3a2828', '#5a4036', '#7e5e4a'],
  leaf: ['#0b2c2c', '#164640', '#2a6450', '#4e8a62'],
  leafVoid: ['#12061a', '#260d30', '#43194c', '#6e3478'],
  hive: ['#4e2c20', '#85512f', '#c98a3a', '#f0c25c'],
  void: ['#0a0310', '#1e0c28', '#3e1a52', '#74428e'],
  crystal: ['#2a0c3a', '#5a1f72', '#9a3fa8', '#e070c8'],
  hutWall: ['#6c5e62', '#988a88', '#c8bcb2', '#ebe2d8'],
  hutRoof: ['#5e1e3a', '#8e3858', '#bc5474', '#d87494'],
  cloud: ['#1c1b46', '#29295e', '#383a74', '#50538e'],
  mountain: ['#0d0e2a', '#15173c', '#1f2452', '#2c346a'],
  voidling: ['#020104', '#08050c', '#130c1c', '#241934'],
  water: ['#11264a', '#1a3a64', '#2a5684', '#4a7ca6'],
};

// Uniforms shared by every material: the key light, the lightning lift and the stepped distance fog.
export const G = {
  uLight: { value: V3(0.3, 0.8, 0.5).normalize() },
  uLift: { value: 0 },
  uFogCol: { value: new THREE.Color('#1b2058') },
  uFog: { value: new THREE.Vector2(50, 420) },
};

const VS = /* glsl */ `
varying vec3 vW; varying vec3 vV; varying vec3 vN; varying vec3 vL;
void main(){
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
  #endif
  vL = position;
  vec4 w = modelMatrix * p;
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  vec4 v = viewMatrix * w;
  vV = v.xyz;
  gl_Position = projectionMatrix * v;
}`;

const FOG = /* glsl */ `
vec3 fogged(vec3 c){
  float f = clamp((length(vV) - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
  return mix(c, uFogCol, floor(f * 6.0) / 6.0 * uFogAmt);
}`;

const FS_RAMP = /* glsl */ `
uniform vec3 uR0; uniform vec3 uR1; uniform vec3 uR2; uniform vec3 uR3;
uniform vec3 uLight; uniform float uLift; uniform vec3 uFogCol; uniform vec2 uFog;
uniform float uBias; uniform float uOutline; uniform float uFogAmt;
varying vec3 vW; varying vec3 vV; varying vec3 vN; varying vec3 vL;
${FOG}
#ifdef GROUND
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float bayer4(vec2 p){
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[x + y * 4]) + 0.5) / 16.0;
}
#endif
#ifdef HIVE
float hexDist(vec2 p){ p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
#endif
void main(){
  #ifdef SMOOTH
  vec3 n = normalize(vN);
  #else
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  #endif
  float d = dot(n, uLight) * 0.5 + 0.5 + uBias + uLift;
  #ifdef GROUND
  // big tonal patches anchored in the world, with a light ordered dither where the tones meet
  d += (vnoise(vW.xz * 0.05) - 0.5) * 0.34 + (vnoise(vW.xz * 0.9 + 17.0) - 0.5) * 0.12 + (bayer4(gl_FragCoord.xy) - 0.5) * 0.07;
  #endif
  vec3 c = d < 0.3 ? uR0 : (d < 0.55 ? uR1 : (d < 0.86 ? uR2 : uR3));
  #ifdef HIVE
  // honeycomb cells on the hive, with some glowing with honey and the lowest ones corrupted by the void
  vec2 uv = vec2(atan(vL.z, vL.x) * 3.2, vL.y * 0.62) * 1.6;
  vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
  vec2 a = mod(uv, r) - h, b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = uv - gv;
  float edge = 0.5 - hexDist(gv);
  float rnd = hh(id);
  if (edge < 0.09) c = d < 0.55 ? uR0 : uR1;
  else if (vL.y < -2.5 && rnd < 0.55) c = rnd < 0.2 ? vec3(0.878, 0.439, 0.784) : vec3(0.243, 0.102, 0.322);
  else if (rnd > 0.9) c = vec3(0.941, 0.761, 0.361);
  #endif
  gl_FragColor = vec4(fogged(c), uOutline);
}`;

const FS_FLAT = /* glsl */ `
uniform vec3 uColor; uniform vec3 uFogCol; uniform vec2 uFog; uniform float uOutline; uniform float uFogAmt;
varying vec3 vW; varying vec3 vV; varying vec3 vN; varying vec3 vL;
${FOG}
void main(){ gl_FragColor = vec4(fogged(uColor), uOutline); }`;

const cache = new Map();
const C = (h) => new THREE.Color(h);

// A flat-shaded (or, with smooth, cel-shaded) material that only ever outputs the four colours of a ramp, fogged in steps.
export function ramp(name, { bias = 0, outline = 1, fog = 1, double = false, smooth: sm = false, hive = false, ground = false } = {}) {
  const key = `r|${name}|${bias}|${outline}|${fog}|${double}|${sm}|${hive}|${ground}`;
  if (cache.has(key)) return cache.get(key);
  const r = RAMP[name];
  if (!r) throw new Error('no ramp ' + name);
  const defines = {};
  if (sm) defines.SMOOTH = '';
  if (hive) defines.HIVE = '';
  if (ground) defines.GROUND = '';
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uR0: { value: C(r[0]) }, uR1: { value: C(r[1]) }, uR2: { value: C(r[2]) }, uR3: { value: C(r[3]) },
      uLight: G.uLight, uLift: G.uLift, uFogCol: G.uFogCol, uFog: G.uFog,
      uBias: { value: bias }, uOutline: { value: outline }, uFogAmt: { value: fog },
    },
    defines, vertexShader: VS, fragmentShader: FS_RAMP, side: double ? THREE.DoubleSide : THREE.FrontSide,
  });
  cache.set(key, m);
  return m;
}

// A single unlit colour (glows, decals, rain-lit bits), fogged like everything else.
export function flat(hex, { outline = 0, fog = 1, double = true } = {}) {
  const key = `f|${hex}|${outline}|${fog}|${double}`;
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: C(hex) }, uFogCol: G.uFogCol, uFog: G.uFog, uOutline: { value: outline }, uFogAmt: { value: fog } },
    vertexShader: VS, fragmentShader: FS_FLAT, side: double ? THREE.DoubleSide : THREE.FrontSide,
  });
  cache.set(key, m);
  return m;
}

const VS_UV = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Anime eye drawn per pixel on a quad: the iris moves (uIris, for crossed eyes) and is clipped by the eye shape,
// uOpen squashes it for blinks, and the upper rim is a thick lash line.
export function eyeMat({ sclera, irisA, irisB, pupil, lash, hi, side }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uIris: { value: new THREE.Vector2() }, uOpen: { value: 1 }, uSide: { value: side },
      uSclera: { value: C(sclera) }, uIrisA: { value: C(irisA) }, uIrisB: { value: C(irisB) },
      uPupil: { value: C(pupil) }, uLash: { value: C(lash) }, uHi: { value: C(hi) },
    },
    vertexShader: VS_UV,
    fragmentShader: /* glsl */ `
      uniform vec2 uIris; uniform float uOpen; uniform float uSide;
      uniform vec3 uSclera; uniform vec3 uIrisA; uniform vec3 uIrisB; uniform vec3 uPupil; uniform vec3 uLash; uniform vec3 uHi;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float open = max(uOpen, 0.12);
        vec2 q = vec2(p.x, p.y / open);
        float e = dot(q, q);
        if (e > 1.0) discard;
        vec3 c = uSclera;
        vec2 ip = (q - uIris) / vec2(0.62, 0.8);
        if (dot(ip, ip) < 1.0) {
          c = ip.y > 0.05 ? uIrisA : uIrisB;
          vec2 pp = ip / vec2(0.42, 0.52);
          if (dot(pp, pp) < 1.0) c = uPupil;
          vec2 hp = (ip - vec2(-0.34 * uSide, 0.36)) / 0.3;
          if (dot(hp, hp) < 1.0) c = uHi;
        }
        if ((q.y > -0.05 && e > 0.6) || uOpen < 0.2) c = uLash;
        gl_FragColor = vec4(c, 0.0);
      }`,
    side: THREE.DoubleSide,
  });
}

// Mouth on a quad: a short line when closed, an open mouth with the tongue showing when uOpen is 1.
export function mouthMat({ line, inside, tongue }) {
  return new THREE.ShaderMaterial({
    uniforms: { uOpen: { value: 0 }, uLine: { value: C(line) }, uIn: { value: C(inside) }, uTo: { value: C(tongue) } },
    vertexShader: VS_UV,
    fragmentShader: /* glsl */ `
      uniform float uOpen; uniform vec3 uLine; uniform vec3 uIn; uniform vec3 uTo;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        if (uOpen < 0.08) {
          if (abs(p.y + p.x * p.x * 0.12) < 0.13 && abs(p.x) < 0.5) { gl_FragColor = vec4(uLine, 0.0); return; }
          discard;
        }
        vec2 q = vec2(p.x / 0.78, (p.y + 0.1) / (0.8 * uOpen));
        float e = dot(q, q);
        if (e > 1.0) discard;
        vec3 c = uIn;
        vec2 t = vec2(p.x / 0.5, (p.y + 0.62) / 0.5);
        if (dot(t, t) < 1.0) c = uTo;
        if (e > 0.72) c = uLine;
        gl_FragColor = vec4(c, 0.0);
      }`,
    side: THREE.DoubleSide,
  });
}

export function mesh(geo, mat, parent, pos, rot, scl) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scl != null) { if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(scl[0], scl[1], scl[2]); }
  if (parent) parent.add(m);
  return m;
}

export function group(parent, pos, rot) {
  const g = new THREE.Group();
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
  if (parent) parent.add(g);
  return g;
}

// A tapered prism from the origin, hanging down (dir -1) or standing up (dir 1): radius r0 at the origin, r1 at the end,
// flattened front to back by flatZ.
export function seg(len, r0, r1, sides = 5, flatZ = 1, dir = -1) {
  const g = new THREE.CylinderGeometry(dir < 0 ? r0 : r1, dir < 0 ? r1 : r0, len, sides, 1);
  g.translate(0, (dir * len) / 2, 0);
  g.scale(1, 1, flatZ);
  return g;
}

// A tapered prism from point a to point b (world or parent space).
export function beam(a, b, r0, r1, sides = 6) {
  const d = b.clone().sub(a);
  const g = seg(d.length(), r0, r1, sides, 1, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

// A chain of hanging segments (hair locks): each pivot holds one segment and the next pivot at its end.
export function chain(parent, lens, r0, r1, sides, flatZ, mat) {
  const total = lens.reduce((s, l) => s + l, 0);
  const pivots = [];
  let p = parent, acc = 0;
  lens.forEach((l, i) => {
    const g = group(p, i ? [0, -lens[i - 1], 0] : null);
    mesh(seg(l * 1.05, lerp(r0, r1, acc / total), lerp(r0, r1, (acc + l) / total), sides, flatZ), mat, g);
    pivots.push(g);
    p = g;
    acc += l;
  });
  return pivots;
}
