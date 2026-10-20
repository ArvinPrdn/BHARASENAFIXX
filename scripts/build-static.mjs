import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public');
if (output !== join(root, 'public')) throw new Error('Unexpected static output path.');
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'src', 'scripts'), { recursive: true });
await mkdir(join(output, 'src', 'data'), { recursive: true });
for (const path of ['styles.css', 'galeri.html', 'gallery-page.css', 'assets', 'src/scripts/experience.js', 'src/scripts/gallery-page.js', 'src/scripts/music.js', 'src/scripts/heritage.js', 'src/data/event.js']) {
  await cp(join(root, path), join(output, path), { recursive: true });
}
let html = await readFile(join(root, 'index.html'), 'utf8');
html = html.replace('<html lang="id">', '<html lang="id" data-hosting="static">');
html = html.replace('<title>BHARASENA', '<title>Bharasena');
html = html.replace('data-message-form novalidate', 'data-message-form data-static-form novalidate');
html = html.replace(/(<form[^>]*data-static-form[\s\S]*?<\/form>)/u, (form) =>
  form.replace(/<(input|textarea|button)\b/gu, '<$1 disabled')
    .replace('data-message-status role="status" aria-live="polite"></p>', 'data-message-status role="status" aria-live="polite">Pengiriman pesan akan segera dibuka.</p>'));
html = html.replace('Pesan akan diperiksa panitia sebelum tampil di ballroom.', 'Pengiriman pesan akan segera dibuka.');
await writeFile(join(output, 'index.html'), html);
await writeFile(join(output, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /admin\n');
console.log('Public Vercel build prepared in public/. No local database or admin files included.');
