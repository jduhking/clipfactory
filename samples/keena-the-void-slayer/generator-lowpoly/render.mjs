// Render the low-poly intro with headless Chromium (SwiftShader, no GPU needed).
//   node render.mjs <outDir> [first last]        frames 0000.png ... at 30 fps, 320x180; skips frames already on disk
//   node render.mjs --stills <outDir> t1 t2 ...   stills at the given times plus info.json (key points on screen)
// Expects the scene served at http://127.0.0.1:$KTVS_PORT (default 8393)/scene/index.html (build.sh starts the server).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.KTVS_PORT || 8393;
const FPS = 30, FRAMES = 425;
const args = process.argv.slice(2);
const stills = args[0] === '--stills';
if (stills) args.shift();
const outDir = args[0];
if (!outDir) { console.error('usage: node render.mjs [--stills] <outDir> ...'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/scene/index.html`);
try {
  await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 180000 });
} catch (e) {
  console.error('scene did not load:\n' + errors.join('\n'));
  await browser.close();
  process.exit(1);
}

const grab = (t) => page.evaluate((t) => { window.renderAt(t); return document.querySelector('canvas').toDataURL('image/png'); }, t);
const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));

if (stills) {
  const info = {};
  for (const t of args.slice(1).map(Number)) {
    save(path.join(outDir, `still_${t.toFixed(2)}.png`), await grab(t));
    info[t.toFixed(2)] = await page.evaluate(() => window.info());
  }
  fs.writeFileSync(path.join(outDir, 'info.json'), JSON.stringify(info, null, 1));
} else {
  const f0 = +(args[1] ?? 0), f1 = +(args[2] ?? FRAMES - 1);
  const start = Date.now();
  for (let f = f0; f <= f1; f++) {
    const file = path.join(outDir, String(f).padStart(4, '0') + '.png');
    if (fs.existsSync(file) && fs.statSync(file).size > 200) continue;
    save(file, await grab(f / FPS));
    if (f % 50 === 0) console.log(`frame ${f} (${((Date.now() - start) / 1000).toFixed(0)} s)`);
  }
}
if (errors.length) console.log('page messages:\n' + [...new Set(errors)].slice(0, 20).join('\n'));
await browser.close();
