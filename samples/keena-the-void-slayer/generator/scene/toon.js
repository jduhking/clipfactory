// Toon materials, outlines, shared uniforms and GLSL helpers.
import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);

// Shared uniforms (updated every frame by main.js).
export const U = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector3(0.22, 0, 1).normalize() }, // world space: valley -> behind Keena
  uWindAmp: { value: 1 },
  uSunDir: { value: new THREE.Vector3(0.35, 0.22, 1).normalize() },
  uSunDirView: { value: new THREE.Vector3() },
  uFillDirView: { value: new THREE.Vector3() },
  uRes: { value: new THREE.Vector2(1920, 1080) },
  uFlash: { value: 0 },
  uFogDensity: { value: 0.0028 },
  uCorruptFront: { value: 6.0 }, // metres in front of Keena where the void starts
  uCorruptBack: { value: 26.0 }, // radius behind her where the void starts
  uTreeCorrupt: { value: 0.5 }, // 0..1 how far the void has climbed the tree / hive
  // sky / fog palette (linear)
  uZenith: { value: C('#14122b') },
  uHigh: { value: C('#2c2552') },
  uHorizonVoid: { value: C('#4b2463') },
  uHorizonSun: { value: C('#f19c86') },
  uSunCore: { value: C('#fff0d8') },
  uVoidGlow: { value: C('#b061ff') },
  uVoidCore: { value: C('#06030c') },
  uVoidDark: { value: C('#170b24') },
  uVortexDir: { value: new THREE.Vector3(-0.16, 0.36, -1).normalize() },
};

export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f*f*(3.-2.*f);
  float a = hash13(i), b = hash13(i+vec3(1,0,0)), c = hash13(i+vec3(0,1,0)), d = hash13(i+vec3(1,1,0));
  float e = hash13(i+vec3(0,0,1)), f1 = hash13(i+vec3(1,0,1)), g = hash13(i+vec3(0,1,1)), h = hash13(i+vec3(1,1,1));
  return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y), mix(mix(e,f1,u.x), mix(g,h,u.x), u.y), u.z); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; } return s; }
float fbm3(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * vnoise3(p); p = p * 2.03 + vec3(17.1, 9.2, 4.7); a *= .5; } return s; }
`;

export const GLSL_SKY = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHigh; uniform vec3 uHorizonVoid; uniform vec3 uHorizonSun; uniform vec3 uSunCore;
uniform vec3 uSunDir; uniform vec3 uVoidGlow; uniform vec3 uVortexDir; uniform float uFlash;
float sunSide(vec3 d){
  vec2 a = normalize(d.xz + 1e-5), b = normalize(uSunDir.xz);
  return dot(a, b) * 0.5 + 0.5;
}
// dusk gradient: gold, coral, violet, indigo toward the sun; deep purple toward the void
vec3 skyGradient(vec3 d){
  float h = clamp(d.y, -0.2, 1.0);
  float s = pow(sunSide(d), 1.8);
  vec3 sunCol = mix(vec3(1.0, 0.54, 0.25), vec3(0.87, 0.23, 0.33), smoothstep(0.0, 0.1, h));
  sunCol = mix(sunCol, vec3(0.195, 0.07, 0.33), smoothstep(0.08, 0.3, h));
  sunCol = mix(sunCol, vec3(0.03, 0.02, 0.13), smoothstep(0.25, 0.65, h));
  sunCol = mix(sunCol, vec3(0.009, 0.007, 0.042), smoothstep(0.6, 1.0, h));
  vec3 voidCol = mix(vec3(0.1, 0.023, 0.17), vec3(0.042, 0.012, 0.09), smoothstep(0.0, 0.18, h));
  voidCol = mix(voidCol, vec3(0.016, 0.008, 0.05), smoothstep(0.15, 0.5, h));
  voidCol = mix(voidCol, vec3(0.006, 0.005, 0.025), smoothstep(0.5, 1.0, h));
  return mix(voidCol, sunCol, s);
}
// colour used for distance fog: the sky just above the horizon in that direction
vec3 horizonColor(vec3 d){
  vec3 col = skyGradient(vec3(d.x, min(d.y, 0.06), d.z));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCore * pow(sd, 6.0) * 0.25;
  float vd = max(dot(d, uVortexDir), 0.0);
  col += uVoidGlow * pow(vd, 12.0) * (0.06 + 0.5 * uFlash);
  return col;
}
`;

export function gradientTexture(steps) {
  const data = new Uint8Array(steps);
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
export const GRAD_CHAR = gradientTexture([105, 105, 105, 255, 255]); // shadow when N.L < 0.2
export const GRAD_ENV = gradientTexture([80, 80, 150, 210, 255, 255]);

const WIND_VERT = /* glsl */ `
attribute float aWind;
attribute float aSeed;
uniform float uTime;
uniform vec3 uWindObj;
uniform float uWindAmpL;
uniform float uWindFreq;
vec3 windOffset(float w, float seed){
  float t = uTime * uWindFreq;
  float gust = 0.62 + 0.38 * sin(t * 0.83 + seed * 1.7) * sin(t * 0.37 + 1.3 + seed);
  float fl = sin(t * 2.1 + seed * 6.283 + w * 3.2) * 0.42 + sin(t * 3.9 + seed * 2.9 + w * 6.0) * 0.16;
  vec3 side = normalize(cross(uWindObj, vec3(0.0, 1.0, 0.0)) + 1e-5);
  float ww = w * w;
  return uWindAmpL * ww * (uWindObj * gust + side * fl + vec3(0.0, 0.25 * fl - 0.1, 0.0));
}
`;

const FOG_VERT_DECL = /* glsl */ `varying vec3 vWorldPos;`;
const FOG_VERT = /* glsl */ `
{
  vec4 wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  vWorldPos = (modelMatrix * wp).xyz;
}
`;
const FOG_FRAG_DECL = /* glsl */ `varying vec3 vWorldPos; uniform float uFogDensity; uniform float uFogMul;`;
const FOG_FRAG = /* glsl */ `
{
  vec3 fv = vWorldPos - cameraPosition;
  float fd = length(fv);
  float ff = 1.0 - exp(-pow(fd * uFogDensity * uFogMul, 1.25));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, horizonColor(normalize(fv)), clamp(ff, 0.0, 1.0));
}
`;

/**
 * Build a toon material with optional wind sway, rim light, custom sky fog and a fragment hook.
 * opts: { color, emissive, emissiveIntensity, map, emissiveMap, grad, side, transparent, opacity,
 *         wind: {amp, freq, dir(object space Vector3)}, rim: {color, strength},
 *         fogMul, fragDecl, fragColor (after color_fragment), fragEmissive (after emissivemap_fragment),
 *         vertDecl, vertBegin (after begin_vertex), uniforms }
 */
export function toon(opts = {}) {
  const mat = new THREE.MeshToonMaterial({
    color: opts.color ?? '#ffffff',
    gradientMap: opts.grad ?? GRAD_CHAR,
    emissive: opts.emissive ?? (opts.lift ? new THREE.Color(opts.color ?? '#ffffff').multiplyScalar(opts.lift) : '#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    map: opts.map ?? null,
    emissiveMap: opts.emissiveMap ?? null,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  mat.fog = false;
  const local = {
    uWindObj: { value: opts.wind?.dir ?? new THREE.Vector3(0, 0, -1) },
    uWindAmpL: { value: opts.wind?.amp ?? 0 },
    uWindFreq: { value: opts.wind?.freq ?? 1 },
    uRimColor: { value: new THREE.Color(opts.rim?.color ?? '#ffb3a0') },
    uRimStrength: { value: opts.rim?.strength ?? 0 },
    uFillRimColor: { value: new THREE.Color(opts.rim?.fillColor ?? '#9f7bff') },
    uFillRimStrength: { value: opts.rim?.fillStrength ?? 0 },
    uFogMul: { value: opts.fogMul ?? 1 },
    ...(opts.uniforms || {}),
  };
  mat.userData.local = local;
  const key = JSON.stringify({ w: !!opts.wind, r: !!opts.rim, fd: opts.fragDecl || '', fc: opts.fragColor || '', fe: opts.fragEmissive || '', fn: opts.fragNormal || '', vd: opts.vertDecl || '', vb: opts.vertBegin || '', nf: !!opts.noFog });
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, local);
    let vs = shader.vertexShader, fs = shader.fragmentShader;
    vs = vs.replace('#include <common>', `#include <common>\n${WIND_VERT}\n${FOG_VERT_DECL}\n${GLSL_NOISE}\n${opts.vertDecl || ''}`);
    vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${opts.wind ? 'transformed += windOffset(aWind, aSeed);' : ''}\n${opts.vertBegin || ''}`);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>\n${FOG_VERT}`);
    fs = fs.replace('#include <common>', `#include <common>\n${GLSL_NOISE}\n${GLSL_SKY}\n${FOG_FRAG_DECL}\nuniform float uTime; uniform vec3 uRimColor; uniform float uRimStrength; uniform vec3 uSunDirView; uniform vec3 uFillRimColor; uniform float uFillRimStrength; uniform vec3 uFillDirView;\n${opts.fragDecl || ''}`);
    if (opts.fragColor) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${opts.fragColor}`);
    if (opts.fragEmissive) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${opts.fragEmissive}`);
    if (opts.fragNormal) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${opts.fragNormal}`);
    fs = fs.replace('#include <opaque_fragment>', `
      {
        vec3 Vd = normalize(vViewPosition);
        float ndv = clamp(dot(normal, Vd), 0.0, 1.0);
        float fres = smoothstep(0.52, 0.80, 1.0 - ndv);
        float sunBack = clamp(dot(normal, uSunDirView), 0.0, 1.0);
        float fillBack = clamp(dot(normal, uFillDirView), 0.0, 1.0);
        outgoingLight += uRimColor * uRimStrength * fres * smoothstep(0.05, 0.45, sunBack);
        outgoingLight += uFillRimColor * uFillRimStrength * fres * smoothstep(0.05, 0.45, fillBack);
      }
      #include <opaque_fragment>`);
    if (!opts.noFog) fs = fs.replace('#include <fog_fragment>', FOG_FRAG);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  return mat;
}

/**
 * Inverted-hull outline with roughly constant on-screen width.
 * Shares the wind sway of the source material so outlines follow hair and cloth.
 */
export function outlineMaterial({ color = '#163b40', widthPx = 2.2, refDist = 2.5, wind = null, vertDecl = '', vertBegin = '' } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      ...U,
      uColor: { value: new THREE.Color(color) },
      uWidthPx: { value: widthPx },
      uRefDist: { value: refDist },
      uWindObj: { value: wind?.dir ?? new THREE.Vector3(0, 0, -1) },
      uWindAmpL: { value: wind?.amp ?? 0 },
      uWindFreq: { value: wind?.freq ?? 1 },
    },
    vertexShader: /* glsl */ `
      ${WIND_VERT}
      ${GLSL_NOISE}
      ${vertDecl}
      uniform float uWidthPx; uniform float uRefDist; uniform vec2 uRes;
      #include <common>
      void main(){
        vec3 transformed = position;
        ${wind ? 'transformed += windOffset(aWind, aSeed);' : ''}
        ${vertBegin}
        vec4 mv = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mv = instanceMatrix * mv;
        #endif
        mv = modelViewMatrix * mv;
        vec4 clip = projectionMatrix * mv;
        vec3 objN = normal;
        #ifdef USE_INSTANCING
          objN = mat3(instanceMatrix) * objN;
        #endif
        vec3 vn = normalize(normalMatrix * objN);
        vec2 n2 = vn.xy; float l = length(n2); n2 = l > 1e-4 ? n2 / l : vec2(0.0);
        float w = uWidthPx * clamp(uRefDist / max(clip.w, 0.01), 0.35, 1.7);
        clip.xy += n2 * (2.0 / uRes) * w * clip.w;
        clip.z += 0.00004 * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
  });
}

/** Add a mesh plus its outline twin to a parent. Returns the main mesh. */
export function withOutline(parent, geom, mat, outline) {
  const m = new THREE.Mesh(geom, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  if (outline) {
    const o = new THREE.Mesh(geom, outline);
    o.castShadow = false;
    o.receiveShadow = false;
    o.renderOrder = -1;
    parent.add(o);
  }
  return m;
}
