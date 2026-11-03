import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataUrl = async (path, type) => `data:${type};base64,${(await readFile(resolve(root, path))).toString('base64')}`;
const [photo, wordmark, crest, displayFont, bodyFont] = await Promise.all([
  dataUrl('assets/budi-doremi.jpg', 'image/jpeg'),
  dataUrl('assets/budi-doremi-logo.png', 'image/png'),
  dataUrl('assets/bharasena-logo.png', 'image/png'),
  dataUrl('assets/fonts/cormorant-garamond-latin.woff2', 'font/woff2'),
  dataUrl('assets/fonts/manrope-latin.woff2', 'font/woff2'),
]);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="id"><head><style>
    @font-face { font-family: Display; src: url('${displayFont}'); }
    @font-face { font-family: Body; src: url('${bodyFont}'); }
    * { box-sizing: border-box; }
    body { margin: 0; width: 1200px; height: 630px; background: #160b10; color: #f4ecdd; font-family: Body, sans-serif; }
    main { position: relative; width: 100%; height: 100%; padding: 62px 68px; background: radial-gradient(ellipse at 70% 20%, #4b2927, transparent 65%); }
    main::after { content: ''; position: absolute; inset: 26px; border: 1px solid #d9c3a050; pointer-events: none; }
    .identity { display: flex; align-items: center; gap: 18px; margin-bottom: 25px; }
    .crest { width: 66px; height: 66px; object-fit: contain; }
    .identity p { font-size: 10px; line-height: 1.9; letter-spacing: .19em; color: #d9c3a0; }
    h1 { font-family: Display, serif; font-weight: 500; font-size: 80px; line-height: 1; letter-spacing: .025em; margin: 0 0 9px; }
    .subtitle { font-family: Display, serif; font-size: 27px; font-style: italic; color: #d9c3a0; margin: 0; }
    .artist { margin-top: 44px; }
    .artist p { margin: 0 0 20px; color: #d9c3a0; font-size: 10px; letter-spacing: .3em; }
    .wordmark { display: block; width: 430px; height: auto; }
    footer { margin-top: 46px; }
    .date { margin: 0 0 10px; font-size: 17px; letter-spacing: .08em; }
    .venue { margin: 0; color: #c0b2a7; font-size: 11px; letter-spacing: .03em; }
    figure { position: absolute; top: 62px; right: 68px; width: 374px; height: 506px; margin: 0; padding: 6px; border: 1px solid #d9c3a0; background: #b3915c; }
    figure img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; }
  </style></head><body><main>
    <div class="identity"><img class="crest" src="${crest}" alt="Lambang BHARASENA" /><p>SMAN 2 TARUNA BHAYANGKARA<br />BATALYON BHARA ARSA NAWASENA</p></div>
    <h1>BHARASENA</h1><p class="subtitle">As one to the light</p>
    <div class="artist"><p>GUEST STAR · LIVE ON STAGE</p><img class="wordmark" src="${wordmark}" alt="Budi Doremi" /></div>
    <footer><p class="date">11–13 DESEMBER 2026</p><p class="venue">SMAN 2 Taruna Bhayangkara · Banyuwangi</p></footer>
    <figure><img src="${photo}" alt="Foto resmi Budi Doremi" /></figure>
  </main></body></html>`);
  await page.evaluate(async () => {
    await globalThis.document.fonts.ready;
    await Promise.all([...globalThis.document.images].map((image) => image.decode()));
  });
  const output = resolve(root, 'assets/bharasena-share.jpg');
  await page.screenshot({ path: output, type: 'jpeg', quality: 92 });
  console.log(`Share image generated: ${output}`);
} finally {
  await browser.close();
}
