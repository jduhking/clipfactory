// Render stills of the intro at given times, for checking a change without rendering every frame.
// Needs the static server from build.sh (or `python3 -m http.server $PORT` in this folder) running.
// usage: node shoot.mjs <outDir> <w> <h> t=<seconds>...   e.g. node shoot.mjs out/stills 960 540 t=1.5 t=14.6
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 8391;
const [outDir, w, h, ...specs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(`http://127.0.0.1:${PORT}/scene/index.html?w=${w}&h=${h}`);
try {
  await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 180000 });
} catch (e) {
  console.log('not ready', errors.join('\n'));
  await browser.close();
  process.exit(1);
}
for (const spec of specs) {
  const t0 = Date.now();
  const url = await page.evaluate((s) => {
    window.renderAt(parseFloat(s.replace(/^t=/, '')));
    return document.querySelector('canvas').toDataURL('image/png');
  }, spec);
  const file = path.join(outDir, spec.replace(/=/g, '_') + '.png');
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(file, Date.now() - t0, 'ms');
}
if (errors.length) console.log('console:', [...new Set(errors)].slice(0, 20).join('\n'));
await browser.close();
