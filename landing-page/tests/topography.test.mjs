import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { mountTopography } from '../topography.js';
const root = new URL('../', import.meta.url);
const renderer = await readFile(new URL('contours.js',root),'utf8');
const css = await readFile(new URL('styles.css',root),'utf8');
const html = await readFile(new URL('index.html',root),'utf8');

test('topography uses the exact app shaders and performance limits', async () => {
  const source = await readFile(new URL('../../frontend/src/growth/contours.ts',import.meta.url),'utf8');
  for (const name of ['VERTEX','FRAGMENT']) {
    const pattern = new RegExp('const '+name+' = `([\\s\\S]*?)`;');
    assert.equal(renderer.match(pattern)[1],source.match(pattern)[1],name);
  }
  for (const limit of ['MAX_DPR = 1.5','FRAME_MS = 1000 / 30','STILL_AT = 41','SPAN = 3.2']) assert.ok(renderer.includes(limit));
  assert.match(renderer,/failIfMajorPerformanceCaveat: true/);
  assert.doesNotMatch(renderer,/import\.meta\.env/);
});
test('topography is decorative, behind content, with static and forced-color fallbacks', async () => {
  assert.match(html,/class="topography-field" data-topography aria-hidden="true"/);
  assert.match(html,/data-topography-toggle hidden>Pause background/);
  assert.match(html,/type="module" src="\/topography.js\?v=pearl-streamer-10"/);
  assert.match(css,/\.topography-field \{[^}]*z-index: -1[^}]*pointer-events: none[^}]*topography.svg/);
  assert.match(css,/forced-colors: active/);
  const svg = await readFile(new URL('assets/topography.svg',root),'utf8');
  assert.match(svg,/<svg[^>]*viewBox="0 0 1440 800"/);
  assert.ok((svg.match(/<path /g)||[]).length>5);
  assert.doesNotMatch(svg,/<script|<foreignObject/);
});
function events(obj={}) {
  obj.events = new Map();
  obj.addEventListener = (name,fn) => obj.events.set(name,fn);
  obj.removeEventListener = (name,fn) => { if(obj.events.get(name)===fn)obj.events.delete(name); };
  return obj;
}
function rendererHarness({reduced=false,webgl=true}={}) {
  const raf = new Map(), frames=[], observers=[], canvases=[];
  let serial=0, time=0, draws=0, deleted=0;
  const motion=events({matches:reduced});
  const gl = { VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,FLOAT:7,TRIANGLES:8,
    createShader:()=>({}),getShaderParameter:()=>true,createProgram:()=>({}),getProgramParameter:()=>true,
    createBuffer:()=>({}),getUniformLocation:(_,name)=>name,
    getExtension:(name)=>name==='WEBGL_lose_context'?{loseContext(){}}:{},
    uniform1f:(name,value)=>{if(name==='u_time')frames.push(value);},
    drawArrays:()=>{draws++;},deleteBuffer:()=>{deleted++;},deleteProgram:()=>{deleted++;},
  };
  for(const name of ['shaderSource','compileShader','deleteShader','attachShader','bindAttribLocation','linkProgram','useProgram','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','uniform2f','uniform3f','viewport'])gl[name]=()=>{};
  const document=events({hidden:false,createElement(){const canvas=events({clientWidth:960,clientHeight:540,width:0,height:0,removed:false,getContext:()=>gl,remove(){this.removed=true;},getBoundingClientRect:()=>({left:0,top:0,width:960,height:540})});canvases.push(canvas);return canvas;}});
  const window=events({devicePixelRatio:3,matchMedia:()=>motion});if(webgl)window.WebGLRenderingContext=function(){};
  class Observer {constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  const sandbox={window,document,performance:{now:()=>time},Float32Array,
    requestAnimationFrame:(fn)=>{raf.set(++serial,fn);return serial;},cancelAnimationFrame:(id)=>raf.delete(id),
    IntersectionObserver:Observer,ResizeObserver:Observer};
  runInNewContext(renderer.replaceAll('export ', '')+'\nthis.startField = startContours;',sandbox);
  const host={appendChild(canvas){this.canvas=canvas;}};
  const handle=sandbox.startField(host);
  return {handle,host,motion,document,observers,raf,frames,get draws(){return draws;},get deleted(){return deleted;},
    tick(gap=40){time+=gap;const callbacks=[...raf.values()];raf.clear();callbacks.forEach(fn=>fn(time));}};
}
test('unsupported graphics leave the static background alone', () => {
  const h=rendererHarness({webgl:false});assert.equal(h.handle,null);assert.equal(h.host.canvas,undefined);assert.equal(h.raf.size,0);
});
test('reduced motion draws one still frame without scheduling animation', () => {
  const h=rendererHarness({reduced:true});assert.ok(h.handle);assert.equal(h.draws,1);assert.equal(h.frames.at(-1),41);assert.equal(h.raf.size,0);
  h.handle.pulse();assert.equal(h.raf.size,0);h.handle.stop();
});
test('animation moves, pause freezes, resume restarts, and buffer DPR is capped', () => {
  const h=rendererHarness();assert.ok(h.handle);assert.equal(h.host.canvas.width,1440);assert.equal(h.host.canvas.height,810);
  const time=h.frames.at(-1);h.tick();h.tick();assert.ok(h.frames.at(-1)>time);
  h.handle.setPaused(true);const draws=h.draws;h.tick();assert.equal(h.draws,draws);assert.equal(h.raf.size,0);
  h.handle.setPaused(false);h.tick();assert.ok(h.draws>draws);h.handle.stop();
});
test('renderer sleeps offscreen and in hidden tabs and cleans up on stop', () => {
  const h=rendererHarness();h.observers[0].callback([{isIntersecting:false}]);h.tick();assert.equal(h.raf.size,0);
  const draws=h.draws;h.tick();assert.equal(h.draws,draws);
  h.observers[0].callback([{isIntersecting:true}]);assert.equal(h.raf.size,1);h.tick();
  h.document.hidden=true;h.document.events.get('visibilitychange')();h.tick();assert.equal(h.raf.size,0);
  h.document.hidden=false;h.document.events.get('visibilitychange')();assert.equal(h.raf.size,1);
  h.handle.stop();assert.equal(h.raf.size,0);assert.equal(h.document.events.size,0);
  assert.ok(h.observers.every(o=>o.disconnected));assert.equal(h.host.canvas.removed,true);assert.equal(h.deleted,2);
});
test('changing reduced motion stops drift and never overrides a manual pause', () => {
  const h=rendererHarness();h.motion.matches=true;h.motion.events.get('change')();h.tick();assert.equal(h.raf.size,0);
  h.motion.matches=false;h.motion.events.get('change')();assert.equal(h.raf.size,1);
  h.handle.setPaused(true);h.motion.matches=true;h.motion.events.get('change')();h.motion.matches=false;h.motion.events.get('change')();assert.equal(h.raf.size,0);h.handle.stop();
});
function controllerHarness({reduced=false,forced=false,supported=true}={}) {
  const calls={start:0,stop:0,pulse:0,paused:[]}, motion=events({matches:reduced}), contrast=events({matches:forced}), lifecycle=events();
  const classes=new Set();const host=events({classList:{remove:name=>classes.delete(name),toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}});
  const button=events({hidden:true,attributes:{},setAttribute(name,value){this.attributes[name]=value;}});
  const mount=mountTopography({host,button,lifecycle,media:q=>q.includes('forced-colors')?contrast:motion,start(){calls.start++;return supported?{stop(){calls.stop++;},pulse(){calls.pulse++;},setPaused(value){calls.paused.push(value);}}:null;}});
  return {mount,calls,motion,contrast,lifecycle,host,classes,button};
}
test('pause control reflects its action and hides for reduced motion', () => {
  const h=controllerHarness();assert.equal(h.button.hidden,false);assert.ok(h.classes.has('has-contours'));
  h.button.events.get('click')();assert.equal(h.calls.paused.at(-1),true);assert.equal(h.button.textContent,'Play background');
  assert.equal(h.button.attributes['aria-label'],'Play animated topography');
  h.motion.matches=true;h.motion.events.get('change')();assert.equal(h.button.hidden,true);
  h.motion.matches=false;h.motion.events.get('change')();assert.equal(h.button.hidden,false);assert.equal(h.button.textContent,'Play background');
  h.mount.dispose();assert.equal(h.button.hidden,true);assert.equal(h.calls.stop,1);assert.equal(h.lifecycle.events.size,0);
});
test('forced colors dispose the field and restore it without losing manual pause', () => {
  const h=controllerHarness();h.button.events.get('click')();h.contrast.matches=true;h.contrast.events.get('change')();
  assert.equal(h.calls.stop,1);assert.equal(h.button.hidden,true);assert.equal(h.classes.size,0);
  h.contrast.matches=false;h.contrast.events.get('change')();assert.equal(h.calls.start,2);assert.equal(h.calls.paused.at(-1),true);
  h.mount.dispose();
});
test('fallback has no useless pause control and page lifecycle disposal is idempotent', () => {
  const h=controllerHarness({supported:false});assert.equal(h.button.hidden,true);assert.equal(h.classes.size,0);
  h.lifecycle.events.get('pagehide')({persisted:true});assert.equal(h.lifecycle.events.size,2);
  h.lifecycle.events.get('pagehide')({persisted:false});assert.equal(h.lifecycle.events.size,0);h.mount.dispose();assert.equal(h.calls.stop,0);
  const forced=controllerHarness({forced:true});assert.equal(forced.calls.start,0);forced.mount.dispose();
});

test('lost WebGL context restores the static fallback and hides animation controls', () => {
  const h=controllerHarness();h.host.events.get('webglcontextlost')();
  assert.equal(h.calls.stop,1);assert.equal(h.button.hidden,true);assert.equal(h.classes.size,0);
  h.mount.dispose();assert.equal(h.host.events.size,0);
});
