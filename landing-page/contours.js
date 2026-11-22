/* Website adapter of frontend/src/growth/contours.ts. Shader and renderer limits are
   unchanged. Types/build flags removed; manual pause added for the landing page.
   Shader parity is checked in tests/topography.test.mjs. */
/**
 * The moving map behind onboarding: a slow topographic field of contour lines, every fifth one
 * heavier like a survey map, drawn by one fragment shader. pulse() rolls a ripple out from a
 * point (the brand mark, the current step); violet shows only at its front.
 *
 * It stays out of the way: 30 fps at most, device pixel ratio capped at 1.5, paused while the page
 * or its stage is hidden, one still frame under reduced motion, half resolution and then a still
 * frame when the machine can't keep up, and no field at all where WebGL would run in software.
 * The design-review preview allows software WebGL so the field can be reviewed in a VM.
 */

                                
                                                                                 
                                                               
               
 

const MAX_DPR = 1.5;
const FRAME_MS = 1000 / 30;
const RIPPLE_SECONDS = 6;
/** Terrain units across the longer side of the canvas. */
const SPAN = 3.2;
/** A calm moment of the drift, used when the field starts as a still frame. */
const STILL_AT = 41;

const ATTRIBUTES                         = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: "low-power",
  failIfMajorPerformanceCaveat: true,
};

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAGMENT = `
#extension GL_OES_standard_derivatives : enable
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;     // drawing buffer, px
uniform float u_unit;   // px per terrain unit
uniform float u_px;     // buffer px per CSS px
uniform float u_time;   // seconds of drift
uniform vec3 u_ripple;  // origin (buffer px, y up) and age in seconds; age < 0 means none

vec2 grad(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}

// Gradient noise with a quintic fade.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(dot(grad(i), f), dot(grad(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(grad(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(grad(i + 1.0), f - 1.0), u.x),
    u.y);
}

// Two octaves over a slowly drifting warp: smooth ridges and valleys that keep reshaping.
float terrain(vec2 p, float t) {
  vec2 warp = vec2(noise(p * 0.7 + vec2(3.1, 7.7) + t * 0.013),
                   noise(p * 0.7 + vec2(9.4, 1.3) - t * 0.011));
  p += 0.6 * warp;
  float h = noise(p + vec2(t * 0.009, -t * 0.007));
  p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.1;
  return h + 0.4 * noise(p + vec2(-t * 0.012, t * 0.008));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float h = terrain((frag - 0.5 * u_res) / u_unit, u_time);

  // The ripple: a swell travelling out from u_ripple.xy that bends the lines and lights them.
  float front = 0.0;
  if (u_ripple.z >= 0.0) {
    float age = u_ripple.z;
    float x = (distance(frag, u_ripple.xy) / u_unit - age * 0.62) / (0.14 + age * 0.06);
    float fade = smoothstep(0.0, 0.35, age) * exp(-age * 0.7);
    float bell = exp(-x * x);
    front = fade * bell;
    h += 0.08 * fade * x * bell;
  }

  float level = h * 9.0;
  float spread = fwidth(level);
  float dist = abs(fract(level + 0.5) - 0.5) / max(spread, 1e-4);  // px to the nearest line
  float n = floor(level + 0.5);
  float index = 1.0 - step(0.5, abs(n - 5.0 * floor(n / 5.0 + 0.5)));
  float halfWidth = mix(0.5, 0.85, index) * u_px;
  float line = 1.0 - smoothstep(halfWidth - 0.6, halfWidth + 0.6, dist);
  line *= 1.0 - smoothstep(0.3, 0.6, spread);  // fade where lines would crowd together
  float alpha = line * mix(0.08, 0.15, index);

  vec2 c = (frag - 0.5 * u_res) / u_res.y;
  alpha *= mix(0.3, 1.0, smoothstep(0.06, 0.5, length(c * vec2(0.62, 1.0))));  // quiet behind the copy
  alpha *= 1.0 - 0.45 * smoothstep(0.6, 1.15, length(c));                     // softer edges

  alpha = min(alpha * (1.0 + 2.6 * front), 1.0);
  vec3 ink = mix(vec3(0.925), vec3(0.686, 0.522, 0.953), min(front * 1.4, 1.0));
  gl_FragColor = vec4(ink * alpha, alpha);
}
`;

let probed                     ;

/** Whether the field can run here: WebGL with derivatives, on real graphics hardware. */
export function contoursSupported()          {
  if (probed !== undefined) return probed;
  probed = false;
  if (typeof window === "undefined" || typeof window.WebGLRenderingContext === "undefined")
    return probed;
  try {
    const gl = document.createElement("canvas").getContext("webgl", ATTRIBUTES);
    probed = !!gl?.getExtension("OES_standard_derivatives");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    probed = false;
  }
  return probed;
}

/** A viewport point in drawing-buffer pixels, y up (WebGL's origin is the bottom left). */
export function bufferPoint(
  at                          ,
  box                                                              ,
  size                                   ,
) {
  return {
    x: ((at.x - box.left) / Math.max(box.width, 1)) * size.width,
    y: size.height - ((at.y - box.top) / Math.max(box.height, 1)) * size.height,
  };
}

function compile(gl                       , type        , source        ) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  // Shader failures leave the static fallback visible.
  gl.deleteShader(shader);
  return null;
}

function link(gl                       )                      {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = vertex && fragment ? gl.createProgram() : null;
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  // Flagged for deletion; they go with the program.
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

/**
 * Start the field in a fresh canvas inside `host`. Returns null when it can't run, so the caller
 * keeps its plain background. A fresh canvas per start keeps remounts safe: a canvas whose
 * context was released can't draw again.
 */
export function startContours(host             )                       {
  if (!contoursSupported()) return null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl", ATTRIBUTES);
  if (!context) return null;
  const linked = context.getExtension("OES_standard_derivatives") ? link(context) : null;
  if (!linked) {
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  const gl = context;
  const program = linked;
  host.appendChild(canvas);

  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One triangle that covers the screen.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, "u_res");
  const uUnit = gl.getUniformLocation(program, "u_unit");
  const uPx = gl.getUniformLocation(program, "u_px");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uRipple = gl.getUniformLocation(program, "u_ripple");

  const motion =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  let still = !!motion?.matches;
  let manuallyPaused = false;
  let clock = still ? STILL_AT : 0;
  let stopped = false;
  let lost = false;
  let onScreen = true;
  let raf = 0;
  let last = 0;
  let scale = 1;
  let frames = 0;
  let slow = 0;
  let ripple                                              = null;

  const active = () => !stopped && !lost && !still && !manuallyPaused && onScreen && !document.hidden;

  function draw(now        ) {
    if (stopped || lost) return;
    let age = -1;
    if (ripple) {
      age = (now - ripple.at) / 1000;
      if (age > RIPPLE_SECONDS) {
        ripple = null;
        age = -1;
      }
    }
    gl.uniform1f(uTime, clock);
    gl.uniform3f(uRipple, ripple?.x ?? 0, ripple?.y ?? 0, age);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    if (stopped || lost) return;
    const px = Math.min(window.devicePixelRatio || 1, MAX_DPR) * scale;
    const width = Math.max(1, Math.round(canvas.clientWidth * px));
    const height = Math.max(1, Math.round(canvas.clientHeight * px));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uRes, width, height);
    gl.uniform1f(uUnit, Math.max(width, height) / SPAN);
    gl.uniform1f(uPx, px);
    draw(performance.now());
  }

  // When drawing can't hold about 20 fps for two seconds, halve the resolution once, then
  // settle for a still frame.
  function keepUp(gap        ) {
    frames += 1;
    if (gap > 50) slow += 1;
    if (frames < 60) return;
    const struggling = slow > 40;
    frames = 0;
    slow = 0;
    if (!struggling) return;
    if (scale > 0.5) {
      scale = 0.5;
      resize();
    } else {
      still = true;
    }
  }

  function frame(now        ) {
    raf = 0;
    if (!active()) return;
    raf = requestAnimationFrame(frame);
    const gap = last ? now - last : FRAME_MS;
    if (gap < FRAME_MS - 3) return; // hold 30 fps on faster displays
    last = now;
    clock += Math.min(gap, 100) / 1000;
    draw(now);
    keepUp(gap);
  }

  function wake() {
    if (!active() || raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  const onVisibility = () => wake();
  const onMotion = () => {
    still = !!motion?.matches;
    if (!still) return wake();
    ripple = null;
    draw(performance.now());
  };
  const onLost = () => {
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const seen =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
          wake();
        })
      : null;
  const sized = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  seen?.observe(canvas);
  if (sized) sized.observe(canvas);
  else window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibility);
  motion?.addEventListener?.("change", onMotion);
  canvas.addEventListener("webglcontextlost", onLost);

  resize();
  wake();

  return {
    setPaused(paused) {
      manuallyPaused = !!paused;
      if (manuallyPaused) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        ripple = null;
        draw(performance.now());
      } else {
        wake();
      }
    },
    pulse(at, delayMs = 0) {
      if (still || manuallyPaused || stopped || lost) return;
      const point = at
        ? bufferPoint(at, canvas.getBoundingClientRect(), canvas)
        : { x: canvas.width / 2, y: canvas.height / 2 };
      ripple = { ...point, at: performance.now() + delayMs };
      wake();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      seen?.disconnect();
      if (sized) sized.disconnect();
      else window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      motion?.removeEventListener?.("change", onMotion);
      canvas.removeEventListener("webglcontextlost", onLost);
      if (!lost) {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      canvas.remove();
    },
  };
}
