// Cold-open cinematic: helical crane-up around Keena, revealing the voidling-corrupted valley of Leporidia.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { U } from './toon.js';
import { buildKeena, buildMoku } from './keena.js';
import {
  terrainH, buildTerrain, buildGrass, buildFlowers, buildRocks, buildSky, buildMountains,
  buildTree, buildVoidlings, buildParticles,
} from './world.js';
import { smooth, lerp } from './geom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1920), H = +(params.get('h') || 1080);
export const DURATION = 15.5;

// ---------------------------------------------------------------- renderer + post
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the grade pass encodes sRGB itself
document.body.appendChild(renderer.domElement);
U.uRes.value.set(W, H);
U.uVortexDir.value.set(-0.1697, 0.342, -0.9243).normalize();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, W / H, 0.03, 6000);

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.85, 0.55, 0.88);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uExposure: { value: 1.0 }, uFade: { value: 1 }, uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(W, H) }, uGrain: { value: 0.022 }, uVig: { value: 0.32 }, uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uExposure; uniform float uFade; uniform float uTime;
    uniform vec2 uRes; uniform float uGrain; uniform float uVig; uniform float uFlash;
    varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    vec3 shoulder(vec3 x){ const float k = 0.78; vec3 o = max(x - k, 0.0); return min(x, vec3(k)) + (1.0 - k) * (1.0 - exp(-o / (1.0 - k))); }
    vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main(){
      vec2 dc = vUv - 0.5;
      vec2 off = dc * dot(dc, dc) * 0.010;
      vec3 c = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off).b);
      c *= uExposure * (1.0 + uFlash * 0.25);
      c = shoulder(c);
      vec3 s = toSRGB(c);
      s += vec3(0.022, 0.016, 0.040) * (1.0 - s);
      s = mix(s, s * s * (3.0 - 2.0 * s), 0.16);
      float l = dot(s, vec3(0.299, 0.587, 0.114));
      s = mix(vec3(l), s, 1.06);
      float v = smoothstep(0.95, 0.3, length(dc * vec2(1.0, 0.8)) * 1.3);
      s *= mix(1.0 - uVig, 1.0, v);
      s += (hash(vUv * uRes + fract(uTime * 7.13) * 97.0) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(s * uFade, 0.0, 1.0), 1.0);
    }`,
});
composer.addPass(grade);

// ---------------------------------------------------------------- lights
const groundY = terrainH(0, 0);
const sun = new THREE.DirectionalLight('#ffc6a6', 3.0);
sun.target.position.set(0, groundY + 1.0, 0);
sun.position.copy(sun.target.position).addScaledVector(U.uSunDir.value, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.4, right: 1.4, top: 1.6, bottom: -1.6, near: 1, far: 90 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.008;
const fillDir = V(-0.35, 0.3, -1).normalize();
const fillBase = new THREE.Color('#c1b6f2');
const fill = new THREE.DirectionalLight(fillBase.clone(), 1.15);
fill.position.copy(fillDir).multiplyScalar(30);
const hemi = new THREE.HemisphereLight('#a29ccc', '#2f4a48', 1.45);
const aura = new THREE.PointLight('#9ff5d8', 0.0, 3.0, 2);
aura.position.set(0, groundY + 1.0, -0.15);
scene.add(sun, sun.target, fill, hemi, aura);

// ---------------------------------------------------------------- world
const sky = buildSky();
scene.add(sky);
scene.add(buildMountains());
scene.add(buildTerrain());

const keena = buildKeena();
keena.group.position.set(0, groundY, 0);
scene.add(keena.group);
const MOKU_POS = V(-0.3, terrainH(-0.3, -0.16), -0.16);
const moku = buildMoku();
moku.group.position.copy(MOKU_POS);
moku.group.rotation.y = Math.PI - 0.35;
scene.add(moku.group);

// ---------------------------------------------------------------- camera path
// offset = (R sin th, h, R cos th) around Keena; th = PI is in front of her (she faces -Z)
const KEYS = [
  { t: 0.0, th: Math.PI - 0.62, R: 0.95, h: 0.10, ty: 0.16, fov: 50 },
  { t: 2.0, th: Math.PI - 0.40, R: 1.12, h: 0.13, ty: 0.30, fov: 48 },
  { t: 4.2, th: Math.PI + 0.02, R: 1.55, h: 0.26, ty: 0.92, fov: 44 },
  { t: 6.6, th: Math.PI + 0.58, R: 2.0, h: 0.48, ty: 1.36, fov: 40 },
  { t: 8.8, th: Math.PI + 1.42, R: 2.45, h: 1.0, ty: 1.44, fov: 40 },
  { t: 11.0, th: Math.PI + 2.3, R: 3.1, h: 1.7, ty: 1.35, fov: 44 },
  { t: 13.2, th: Math.PI + 2.85, R: 3.9, h: 2.35, ty: 1.2, fov: 48 },
  { t: 15.5, th: Math.PI + 3.0541, R: 4.357, h: 2.6, ty: 1.1, fov: 50 },
];
// final framing: Keena right of centre, the tree and vortex left of centre
const VISTA = V(-3.07, 2.60, -195.64);
const blendAt = (t) => smooth(9.2, 15.2, t);
function channel(name, t) {
  const k = KEYS;
  if (t <= k[0].t) return k[0][name];
  if (t >= k[k.length - 1].t) return k[k.length - 1][name];
  let i = 0;
  while (t > k[i + 1].t) i++;
  const p0 = k[Math.max(0, i - 1)], p1 = k[i], p2 = k[i + 1], p3 = k[Math.min(k.length - 1, i + 2)];
  const u = (t - p1.t) / (p2.t - p1.t);
  // non-uniform Catmull-Rom (tangents scaled by segment lengths in time)
  const m1 = (p2[name] - p0[name]) / (p2.t - p0.t || 1) * (p2.t - p1.t);
  const m2 = (p3[name] - p1[name]) / (p3.t - p1.t || 1) * (p2.t - p1.t);
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1[name] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[name] + (u3 - u2) * m2;
}
export function cameraAt(t, cam = camera) {
  const th = channel('th', t), R = channel('R', t), h = channel('h', t);
  const ty = channel('ty', t), bl = blendAt(t), fov = channel('fov', t);
  const pos = V(Math.sin(th) * R, groundY + h, Math.cos(th) * R);
  // gentle handheld drift
  const n1 = Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3 + 1.1) * 0.25, n2 = Math.sin(t * 1.3 + 2.0) * 0.6 + Math.sin(t * 2.9) * 0.2;
  const dK = V(0, groundY + ty, 0).sub(pos).normalize();
  const dV = VISTA.clone().sub(pos).normalize();
  const dir = dK.multiplyScalar(1 - bl).addScaledVector(dV, bl).normalize();
  cam.position.copy(pos);
  cam.fov = fov;
  cam.aspect = W / H;
  cam.updateProjectionMatrix();
  cam.up.set(0, 1, 0);
  cam.lookAt(pos.clone().add(dir));
  cam.rotateX(n2 * 0.0018);
  cam.rotateY(n1 * 0.0018);
  cam.updateMatrixWorld();
  return cam;
}

// keep grass off the feet, Moku and the low camera path
const camPath = [];
for (let t = 0; t <= 5.0; t += 0.05) { const c = cameraAt(t, new THREE.PerspectiveCamera()); camPath.push([c.position.x, c.position.z]); }
const avoid = (x, z) => {
  if (Math.hypot(x - 0.12, z + 0.04) < 0.085 || Math.hypot(x + 0.12, z + 0.04) < 0.085) return true;
  if (Math.hypot(x - MOKU_POS.x, z - MOKU_POS.z) < 0.11) return true;
  for (const [cx, cz] of camPath) if (Math.hypot(x - cx, z - cz) < 0.16) return true;
  return false;
};
scene.add(buildGrass(avoid));
const flowers = buildFlowers((x, z) => avoid(x, z) || Math.hypot(x, z) < 0.35);
scene.add(flowers.group);
scene.add(buildRocks());
const tree = buildTree();
scene.add(tree.group);
const voidlings = buildVoidlings(tree);
scene.add(voidlings.group);
const particles = buildParticles();
scene.add(particles.group);

// ---------------------------------------------------------------- timeline
const flashAt = (t, t0) => {
  const d = t - t0;
  if (d < 0 || d > 1.2) return 0;
  return Math.exp(-d * 9) * (0.75 + 0.25 * Math.cos(d * 70)) + (d > 0.13 ? 0.65 * Math.exp(-(d - 0.13) * 11) : 0);
};
export const FLASHES = [9.6, 12.9];
window.renderAt = (t) => {
  U.uTime.value = t;
  U.uCorruptFront.value = lerp(6.6, 3.9, smooth(0.5, 15.5, t));
  U.uCorruptBack.value = lerp(26, 19, smooth(0.5, 15.5, t));
  U.uTreeCorrupt.value = lerp(0.28, 0.72, smooth(10.0, 15.5, t));
  const fl = FLASHES.reduce((a, f) => a + flashAt(t, f), 0);
  U.uFlash.value = fl;
  fill.intensity = 1.15 + fl * 2.2;
  fill.color.copy(fillBase).lerp(new THREE.Color('#e3c4ff'), Math.min(1, fl));
  hemi.intensity = 1.45 + fl * 0.8;
  const auraLvl = 0.55 + 1.25 * smooth(10.4, 12.0, t) - 0.35 * smooth(13.8, 15.5, t);
  particles.auraMat.uniforms.uAura.value = auraLvl;
  aura.intensity = 0.05 * auraLvl;
  keena.update(t);
  moku.update(t);
  flowers.update(t);
  voidlings.update(t);
  cameraAt(t);
  if (window.camOverride) {
    const o = window.camOverride;
    camera.position.set(...o.pos); camera.fov = o.fov ?? camera.fov; camera.updateProjectionMatrix();
    camera.lookAt(V(...o.look)); camera.updateMatrixWorld();
  }
  U.uSunDirView.value.copy(U.uSunDir.value).transformDirection(camera.matrixWorldInverse);
  U.uFillDirView.value.copy(fillDir).transformDirection(camera.matrixWorldInverse);
  grade.uniforms.uTime.value = t;
  grade.uniforms.uFlash.value = fl;
  grade.uniforms.uFade.value = smooth(0.0, 1.1, t) * (1 - smooth(14.85, 15.5, t));
  composer.render();
  return true;
};

// screen-space probe for composition checks
window.probe = (t, pts) => {
  cameraAt(t);
  return pts.map(([x, y, z]) => { const v = V(x, y, z).project(camera); return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(4)]; });
};
window.sceneInfo = { groundY, treeBase: tree.base.toArray(), hive: tree.hiveWorld.toArray(), crown: tree.crownWorld.toArray() };

// debug: flat colour per top-level scene object, rendered without post-processing
const ID_NAMES = new Map([[sky, 'sky'], [keena.group, 'keena'], [moku.group, 'moku'], [flowers.group, 'flowers'], [tree.group, 'tree'], [voidlings.group, 'voidlings'], [particles.group, 'particles']]);
window.debugIds = (t) => {
  window.renderAt(t);
  const palette = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8000, 0x8000ff, 0x00ff80, 0x804000, 0xffffff, 0x808080, 0x008080];
  const saved = [], legend = [];
  let k = 0;
  scene.children.forEach((c, i) => {
    if (c.isLight || c.type === 'Object3D') return;
    const col = palette[k++ % palette.length];
    legend.push({ i, name: ID_NAMES.get(c) || c.name || c.type + '#' + i, col: '#' + col.toString(16).padStart(6, '0') });
    c.traverse((o) => {
      if (o.isPoints) { saved.push([o, o.material, o.visible]); o.visible = false; }
      else if (o.isMesh) { saved.push([o, o.material, o.visible]); o.material = new THREE.MeshBasicMaterial({ color: col, side: o.material.side ?? THREE.FrontSide }); }
    });
  });
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  saved.forEach(([o, m, v]) => { o.material = m; o.visible = v; });
  return { legend, url };
};
window.__scene = scene; window.__THREE = THREE; window.__renderer = renderer;
// compile everything up front
renderer.compile(scene, camera);
window.renderAt(0.5);
window.sceneReady = true;
