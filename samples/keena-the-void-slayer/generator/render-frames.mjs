// Render a frame range of the intro to PNGs (resumable: frames already on disk are skipped).
// Needs the static server from build.sh (or `python3 -m http.server $PORT` in this folder) running.
// usage: node render-frames.mjs <firstFrame> <lastFrame> <outDir> [w h fps]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 8391;
const [f0, f1, outDir, w = '1920', h = '1080', fps = '30'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/scene/index.html?w=${w}&h=${h}`);
await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 300000 });
const start = Date.now();
for (let f = +f0; f <= +f1; f++) {
  const file = path.join(outDir, String(f).padStart(4, '0') + '.png');
  if (fs.existsSync(file) && fs.statSync(file).size > 10000) continue; // resumable
  const url = await page.evaluate((t) => { window.renderAt(t); return document.querySelector('canvas').toDataURL('image/png'); }, f / +fps);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  if (f % 10 === 0) console.log(`frame ${f} done, ${((Date.now() - start) / 1000).toFixed(0)} s elapsed`);
}
if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 10).join('\n'));
console.log('DONE', f0, f1, ((Date.now() - start) / 1000).toFixed(0), 's');
await browser.close();
