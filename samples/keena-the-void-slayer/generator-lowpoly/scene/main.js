// The low-poly cold open, rendered at the game's 320x180 and scaled up 6x outside. Three shots on the score's cues:
//   A 0-6.33 s     the camera rises from Keena's boots around her and reveals the valley, the giant tree and the hive
//   B 6.33-10 s    the corrupted tree and hive with the voidling swarm; lightning strikes the canopy
//   C 10-14.17 s   close on her serious face; she pulls a goofy face, Moku floats up beside her and copies it
// window.renderAt(t) draws one frame; window.info() reports where key points landed on screen for checking framing.
import * as THREE from 'three';
import { V3, clamp, lerp, smooth, easeInOut, easeOutBack, G } from './kit.js';
import { buildKeena, buildMoku } from './chars.js';
import { buildWorld, TREE, HIVE, CROWN, STRIKE, hillH } from './world.js';

const W = 320, H = 180;
const CUT_B = 190 / 30, CUT_C = 10.0;
const GOOFY = 11.71, MOKU = 12.75, END = 425 / 30;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);
const params = new URLSearchParams(location.search);
const cssScale = +(params.get('scale') || 1);
renderer.domElement.style.width = `${W * cssScale}px`;
renderer.domElement.style.height = `${H * cssScale}px`;

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(46, W / H, 0.03, 1500);
const rt = new THREE.WebGLRenderTarget(W, H, {
  minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false,
  depthBuffer: true, depthTexture: new THREE.DepthTexture(W, H),
});

const POST = /* glsl */ `
uniform sampler2D tCol; uniform sampler2D tDepth;
uniform vec2 uRes; uniform float uNear; uniform float uFar;
uniform mat4 uInvProj; uniform mat4 uCamWorld;
uniform vec3 uGlowDir; uniform float uGlowAmt; uniform float uSkyLift; uniform float uStrike; uniform float uFade;
uniform float uTime; uniform float uRain;
varying vec2 vUv;
// the storm sky in solid bands from the horizon up, with dithered edges like the game's backgrounds
const vec3 S0 = vec3(0.227, 0.204, 0.455), S1 = vec3(0.180, 0.173, 0.412), S2 = vec3(0.145, 0.141, 0.369);
const vec3 S3 = vec3(0.114, 0.114, 0.322), S4 = vec3(0.090, 0.090, 0.278), S5 = vec3(0.071, 0.071, 0.231);
const vec3 GLOW0 = vec3(0.290, 0.165, 0.455), GLOW1 = vec3(0.478, 0.227, 0.573);
const vec3 RAIN = vec3(0.541, 0.565, 0.784), FLASH = vec3(0.93, 0.92, 1.0), INK = vec3(0.02, 0.01, 0.06);
float bayer4(vec2 p){
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[x + y * 4]) + 0.5) / 16.0;
}
float lin(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }
float zAt(vec2 px){ return lin(texture2D(tDepth, (px + 0.5) / uRes).x); }
vec3 sky(vec2 px, float b){
  vec2 ndc = (px + 0.5) / uRes * 2.0 - 1.0;
  vec4 v = uInvProj * vec4(ndc, 1.0, 1.0);
  vec3 dir = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
  float e = dir.y;
  float f = clamp(pow(max(e + 0.02, 0.0) / 0.62, 0.75) * 5.0 - uSkyLift * 2.5, 0.0, 5.0);
  float fi = floor(f);
  float idx = fi + ((f - fi) > 0.55 + 0.45 * b ? 1.0 : 0.0);
  vec3 c = idx < 0.5 ? S0 : idx < 1.5 ? S1 : idx < 2.5 ? S2 : idx < 3.5 ? S3 : idx < 4.5 ? S4 : S5;
  vec2 hd = normalize(dir.xz + 1e-5), gd = normalize(uGlowDir.xz + 1e-5);
  float g = pow(max(dot(hd, gd), 0.0), 10.0) * (1.0 - smoothstep(-0.05, 0.35, e)) * uGlowAmt;
  if (g > 0.15 + 0.5 * b) c = g > 0.55 + 0.4 * b ? GLOW1 : GLOW0;
  return c;
}
float rain(vec2 px){
  float x = px.x + px.y * 0.25;
  float col = floor(x / 3.0);
  float h = fract(sin(col * 91.7 + 3.1) * 43758.5453);
  if (h > 0.55 || mod(x, 3.0) >= 1.0) return 0.0;
  float len = 37.0 + h * 23.0;
  float y = mod(px.y + uTime * (240.0 + h * 140.0) + h * 977.0, len);
  return y < 4.0 ? 1.0 : 0.0;
}
void main(){
  vec2 px = floor(vUv * uRes);
  vec4 c = texture2D(tCol, (px + 0.5) / uRes);
  float d0 = texture2D(tDepth, (px + 0.5) / uRes).x;
  float b = bayer4(px);
  vec3 col;
  if (d0 >= 0.999999) col = sky(px, b);
  else {
    col = c.rgb;
    float z0 = lin(d0);
    float zl = zAt(px + vec2(-1.0, 0.0)), zr = zAt(px + vec2(1.0, 0.0)), zu = zAt(px + vec2(0.0, 1.0)), zd = zAt(px + vec2(0.0, -1.0));
    // signed Laplacian of inverse depth: zero on planes, negative only on the near side of a depth jump,
    // so each silhouette gets a single 1-px line on the object in front, like a sprite outline
    float thr = max(0.004, z0 * 0.012);
    float i0 = 1.0 / z0;
    float near = -min(1.0 / zl + 1.0 / zr - 2.0 * i0, 1.0 / zu + 1.0 / zd - 2.0 * i0) * z0 * z0;
    if (c.a > 0.5 && z0 < 220.0 && near > thr) col = col * 0.45 + INK;
  }
  if (uRain > 0.0 && rain(px) > 0.5) col = mix(col, RAIN, 0.55);
  col = mix(col, FLASH, uStrike);
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

const post = new THREE.ShaderMaterial({
  uniforms: {
    tCol: { value: rt.texture }, tDepth: { value: rt.depthTexture },
    uRes: { value: new THREE.Vector2(W, H) }, uNear: { value: 0.03 }, uFar: { value: 1500 },
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uGlowDir: { value: V3(0, 0, -1) }, uGlowAmt: { value: 1 }, uSkyLift: { value: 0 }, uStrike: { value: 0 },
    uFade: { value: 1 }, uTime: { value: 0 }, uRain: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: POST, depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene();
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
quad.frustumCulled = false;
postScene.add(quad);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ---- the cast and the world
const world = buildWorld(scene);
const K = V3(0, hillH(0, 0), 0);
const keena = buildKeena();
keena.root.position.copy(K);
keena.root.rotation.y = Math.PI; // she faces the valley (-z)
scene.add(keena.root);
const moku = buildMoku();
scene.add(moku.root);
scene.traverse((o) => { if (o.isInstancedMesh) o.frustumCulled = false; });
const HEAD = K.clone().add(V3(0, 1.24, 0));
const L = (x, y, z) => V3(x, y, z).normalize();
const bump = (t, at, k = 9) => (t < at ? 0 : Math.exp(-(t - at) * k));

let shot = 'A';
function setShot(t) {
  let lift = 0, skyLift = 0, strike = 0, bolt = false;
  G.uFogCol.value.set('#1b2058');
  if (t < CUT_B) {
    shot = 'A';
    const u = easeInOut(clamp(t / 3.9)), w = smooth(3.75, CUT_B, t);
    // crane up from her boots around her right side, ending just behind her left shoulder at head height
    const th = lerp(0.6, Math.PI + 0.33, u) + 0.02 * w;
    const r = lerp(0.72, 0.95, smooth(0, 3.9, t)) - 0.03 * w;
    const y = lerp(0.1, 1.45, easeInOut(clamp((t - 0.1) / 3.8)));
    cam.position.set(K.x + Math.sin(th) * r, K.y + y, K.z - Math.cos(th) * r);
    const body = V3(K.x, K.y + lerp(0.08, 1.3, easeInOut(clamp((t - 0.25) / 3.4))), K.z);
    const far = V3(TREE.x + 3, TREE.y + 30, TREE.z);
    const d1 = body.sub(cam.position).normalize(), d2 = far.sub(cam.position).normalize();
    cam.lookAt(cam.position.clone().add(d1.lerp(d2, smooth(2.9, 4.5, t)).normalize()));
    cam.fov = 46 - 2 * w; // a slow zoom toward the tree while she holds
    G.uLight.value.copy(L(-0.2, 0.75, -0.65));
    G.uFog.value.set(45, 420);
    if (t >= 4.58 && t < 4.66) { lift = 0.3; skyLift = 0.8; }
    if (t >= 4.76 && t < 4.8) { lift = 0.18; skyLift = 0.5; }
    moku.root.visible = false;
  } else if (t < CUT_C) {
    shot = 'B';
    const u = easeInOut((t - CUT_B) / (CUT_C - CUT_B));
    const az = lerp(0.62, 0.42, u), dist = lerp(32, 26, u), y = lerp(0, 3, u);
    cam.position.set(HIVE.x + Math.sin(az) * dist, HIVE.y + y, HIVE.z + Math.cos(az) * dist);
    cam.lookAt(HIVE.x - 3, HIVE.y + 5, HIVE.z);
    cam.fov = 48;
    G.uLight.value.copy(L(0.5, 0.7, 0.5));
    G.uFog.value.set(70, 520);
    const f = Math.round(t * 30);
    if (f >= 294) { bolt = f !== 297; lift = 0.5; skyLift = 1; strike = { 295: 0.75, 296: 0.35, 298: 0.5 }[f] || 0; }
    moku.root.visible = false;
  } else {
    shot = 'C';
    cam.position.set(HEAD.x + 0.07, HEAD.y - 0.02, HEAD.z - 0.82);
    cam.lookAt(HEAD.x - 0.03, HEAD.y, HEAD.z);
    cam.fov = 34;
    G.uLight.value.copy(L(0.35, 0.6, -0.7));
    G.uFog.value.set(45, 420);
    lift = 0.45 * (1 - smooth(10.0, 10.4, t));
    skyLift = 0.8 * (1 - smooth(10.0, 10.3, t));
    // Moku floats up beside her left cheek, bounces on the sting, then copies her face
    const rise = easeOutBack((t - 11.85) / 0.45);
    const hop = 0.025 * bump(t, MOKU, 6) * Math.abs(Math.sin((t - MOKU) * 14));
    moku.root.visible = t >= 11.8;
    moku.root.position.set(HEAD.x - 0.21, HEAD.y - 0.45 + 0.42 * rise + hop + 0.008 * Math.sin(t * 3.1), HEAD.z - 0.06);
    // his face is on local +z: π−θ turns it toward Keena (screen-left); he glances at her, then turns to camera to copy her
    moku.root.rotation.set(0, Math.PI - lerp(0.5, 0.12, smooth(13.42, 13.62, t)), 0);
    moku.root.scale.setScalar(1.3);
  }
  cam.updateProjectionMatrix();
  G.uLift.value = lift;
  post.uniforms.uSkyLift.value = skyLift;
  post.uniforms.uStrike.value = strike;
  post.uniforms.uFade.value = t < 0.4 ? Math.floor((t / 0.4) * 4) / 4 : 1;
  post.uniforms.uTime.value = t;
  post.uniforms.uGlowDir.value.copy(TREE).sub(cam.position);
  post.uniforms.uNear.value = cam.near;
  post.uniforms.uFar.value = cam.far;
  return { bolt };
}

function animate(t, { bolt }) {
  const goofy = smooth(GOOFY - 0.03, GOOFY + 0.05, t);
  const beats = [0.32, 0.56, 0.8].reduce((s, d) => s + bump(t, GOOFY + d, 10), 0);
  const blink = t > 10.55 && t < 10.64 ? 1 : 0;
  keena.update(t, { goofy: goofy * (1 + 0.06 * beats), blink, wind: shot === 'C' ? 0.8 : 1 });
  const copy = smooth(13.66, 13.76, t);
  moku.update(t, { copy, squash: Math.sin(Math.max(0, t - MOKU) * 22) * bump(t, MOKU, 7) + 0.6 * bump(t, 13.71, 9) });
  world.update(t, { bolt, grow: shot === 'B' ? lerp(0.55, 1, smooth(CUT_B, CUT_C, t)) : 1, near: shot !== 'B' });
}

function draw() {
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  post.uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
  post.uniforms.uCamWorld.value.copy(cam.matrixWorld);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}

function proj(p) {
  const v = p.clone().project(cam);
  return [+(((v.x + 1) / 2) * W).toFixed(1), +(((1 - v.y) / 2) * H).toFixed(1), +v.z.toFixed(4)];
}

window.renderAt = (t) => {
  animate(t, setShot(t));
  draw();
};
window.info = () => {
  const kp = (x, y, z) => proj(keena.root.localToWorld(V3(x, y, z)));
  return {
    shot, cam: cam.position.toArray().map((n) => +n.toFixed(3)),
    points: {
      bootL: kp(0.072, 0.08, 0.05), bootR: kp(-0.072, 0.08, 0.05), knee: kp(0, 0.45, 0), waist: kp(0, 0.78, 0), head: proj(HEAD),
      earTipL: proj(keena.earTips()[1]), earTipR: proj(keena.earTips()[0]),
      treeBase: proj(TREE), crown: proj(CROWN), hive: proj(HIVE), strike: proj(STRIKE),
      moku: moku.root.visible ? proj(moku.root.getWorldPosition(V3())) : null,
    },
  };
};

window.renderAt(0);
window.sceneReady = true;
if (params.has('t')) window.renderAt(+params.get('t'));
