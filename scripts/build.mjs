import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const copy = async (from, to) => { if (existsSync(from)) { await mkdir(to.substring(0, to.lastIndexOf('/')), { recursive: true }).catch(() => {}); await cp(from, to, { recursive: true }); } };
await mkdir('dist', { recursive: true });
await copy('index.html', 'dist/index.html');
await copy('styles.css', 'dist/styles.css');
await copy('admin.css', 'dist/admin.css');
await copy('assets', 'dist/assets');
await copy('src/data', 'dist/src/data');
await copy('src/experience.js', 'dist/src/experience.js');
await copy('src/scripts/experience.js', 'dist/src/scripts/experience.js');
await copy('server.mjs', 'dist/server.mjs');
await copy('src', 'dist/src');
await copy('db', 'dist/db');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile('dist/package.json', JSON.stringify({ type: 'module', scripts: { start: 'node server.mjs' }, engines: pkg.engines }, null, 2));
console.log('Build artefact prepared in dist/.');

