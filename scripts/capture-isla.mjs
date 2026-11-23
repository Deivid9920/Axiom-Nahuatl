// Captura automatizada de la isla jugable — Playwright + SwiftShader (sin GPU)
// Uso: node scripts/capture-isla.mjs [etiqueta]
// Genera capturas JPEG en download/evidencia-isla-jugable/ y un resumen JSON.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const TAG = process.argv[2] || 'v1';
const ROOT = '/home/z/my-project';
const OUT = path.join(ROOT, 'download', 'evidencia-isla-jugable');
mkdirSync(OUT, { recursive: true });

// 1) servir download/ en 8091
const server = spawn('python3', ['-m', 'http.server', '8091', '--bind', '127.0.0.1'],
  { cwd: path.join(ROOT, 'download'), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

const URL = 'http://127.0.0.1:8091/isla-axiom-jugable.html';
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
         '--disable-gpu-sandbox', '--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1.5 });
page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
try { await page.waitForFunction('window.__state && window.__state().ready', { timeout: 30000 }); }
catch { console.log('⚠ la página no reportó ready'); }

const state = await page.evaluate('window.__state ? window.__state() : null').catch(() => null);
console.log('STATE:', JSON.stringify(state));

const shots = [
  { name: `${TAG}-01-vista-general`, fn: `window.__cam(38, 43, 108, 0, 0)` },
  { name: `${TAG}-02-vista-alta`,    fn: `window.__cam(-52, 74, 122, -4, -2)` },
  { name: `${TAG}-03-heroica`,       fn: `window.__cam(14, 16, 62, 6, 18)` },
  { name: `${TAG}-04-puente`,        fn: `window.__cam(140, 34, 34, 12, 26)` },
  { name: `${TAG}-05-cumbre`,        fn: `window.__cam(-125, 30, 46, -9, -7)` },
  { name: `${TAG}-06-lemur`,         fn: `window.__lemurTo(12); window.__cam(30, 22, 13, 30, 40)` },
  { name: `${TAG}-07-noche`,         fn: `window.__night(true); window.__cam(38, 43, 108, 0, 0)` },
];
for (const s of shots) {
  await page.evaluate(s.fn);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `${s.name}.jpg`), type: 'jpeg', quality: 72 });
  console.log('✓', s.name);
}

// estado tras mover al lémur cerca del puente (prueba de altura sobre el terreno)
await page.evaluate(`window.__lemurTo(80)`);
await page.waitForTimeout(700);
const st2 = await page.evaluate('window.__state()');
console.log('LEMUR@80:', JSON.stringify(st2.lemur), 'bridge:', JSON.stringify(st2.bridge));

await browser.close();
server.kill();
console.log('LISTO →', OUT);
