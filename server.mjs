import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApprovedMessages, getPublicContent, dbHealth, openDb, seed } from './src/lib/db.mjs';
import { csrfValid, authenticate, getSession, revokeSession, sessionCookie } from './src/lib/auth.mjs';
import { cleanText, createRateLimiter, dailyIpHash, escapeHtml, hmac, requestIp, securityHeaders, validateMessage } from './src/lib/security.mjs';
import { createAnnouncement, createGallery, deleteGallery, saveAnnouncement, saveEnvelope, saveGallery, savePerformer, saveRundown, saveSettings } from './src/lib/admin-content.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/u)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/gu, '');
  }
}
const port = Number(process.env.PORT || 4321);
const production = process.env.NODE_ENV === 'production';
const secret = process.env.APP_SECRET || (production ? '' : randomBytes(32).toString('hex'));
if (production && secret.length < 32) throw new Error('APP_SECRET harus diisi (minimal 32 karakter) pada production.');
const db = seed(openDb());
const limiter = createRateLimiter({ capacity: 4, refillMs: 15 * 60_000 });
const loginLimiter = createRateLimiter({ capacity: 5, refillMs: 15 * 60_000 });

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.ts':'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.avif':'image/avif', '.ico':'image/x-icon', '.json':'application/json; charset=utf-8' };

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  response.end(body);
}

function json(response, status, payload, headers = {}) {
  send(response, status, JSON.stringify(payload), { 'Content-Type': 'application/json; charset=utf-8', ...headers });
}

async function body(request, maxBytes = 16_384) {
  let total = 0; const chunks = [];
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('Payload terlalu besar.'), { status: 413 });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  const type = String(request.headers['content-type'] || '');
  if (type.includes('application/json')) return JSON.parse(text || '{}');
  return Object.fromEntries(new URLSearchParams(text));
}

async function multipartBody(request, maxBytes = 6 * 1024 * 1024) {
  const type = String(request.headers['content-type'] || '');
  const match = /boundary=(?:"([^"]+)"|([^;]+))/iu.exec(type);
  if (!match) throw Object.assign(new Error('Form upload tidak valid.'), { status: 400 });
  let total = 0; const chunks = [];
  for await (const chunk of request) { total += chunk.length; if (total > maxBytes) throw Object.assign(new Error('Ukuran foto terlalu besar.'), { status: 413 }); chunks.push(chunk); }
  const payload = Buffer.concat(chunks); const boundary = Buffer.from(`--${match[1] || match[2]}`); const result = {};
  let cursor = payload.indexOf(boundary);
  while (cursor !== -1) {
    const partStart = cursor + boundary.length + 2;
    if (payload.subarray(cursor, cursor + boundary.length + 2).toString() === `${boundary.toString()}--`) break;
    const headerEnd = payload.indexOf(Buffer.from('\r\n\r\n'), partStart); if (headerEnd < 0) break;
    const next = payload.indexOf(boundary, headerEnd + 4); if (next < 0) break;
    const headers = payload.subarray(partStart, headerEnd).toString('latin1');
    const data = payload.subarray(headerEnd + 4, Math.max(headerEnd + 4, next - 2));
    const disposition = /name="([^"]+)"(?:;\s*filename="([^"]*)")?/iu.exec(headers);
    if (disposition) result[disposition[1]] = disposition[2] !== undefined ? { filename: disposition[2], mime: /content-type:\s*([^\r\n]+)/iu.exec(headers)?.[1]?.trim() || '', data } : data.toString('utf8');
    cursor = next;
  }
  return result;
}

function imageExtension(file) {
  if (!file?.data || file.data.length < 12) return null;
  if (file.data[0] === 0xff && file.data[1] === 0xd8 && file.data[2] === 0xff) return 'jpg';
  if (file.data.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'png';
  if (file.data.subarray(0, 4).toString() === 'RIFF' && file.data.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

function siteOrigin(request) {
  const proto = production ? 'https' : String(request.headers['x-forwarded-proto'] || 'http').split(',')[0];
  return process.env.PUBLIC_ORIGIN || `${proto}://${request.headers.host || `localhost:${port}`}`;
}

function publicPage(request, session = null) {
  const preview = session ? new URL(request.url || '/', siteOrigin(request)).searchParams.get('now') : null;
  const previewDate = preview && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/u.test(preview) ? new Date(preview) : null;
  const now = previewDate && Number.isFinite(previewDate.getTime()) ? previewDate : new Date();
  const content = getPublicContent(now, db);
  const messages = getApprovedMessages(db);
  let html = readFileSyncSafe(join(root, 'index.html'));
  html = html.replace('<html lang="id">', '<html lang="id" data-rendered="server">');
  html = html.replace('</head>', `<meta name="server-now" content="${escapeHtml(content.serverNow)}" /><meta name="event-start" content="${escapeHtml(content.event.event_start_at || '')}" /><meta name="event-end" content="${escapeHtml(content.event.event_end_at || '')}" /><meta name="event-venue" content="${escapeHtml(content.event.venue || '')}" />\n</head>`);
  html = html.replace(/<!-- slot:venue:start -->.*?<!-- slot:venue:end -->/su, venueSlot(content.event));
  html = html.replace(/<!-- slot:performer-schedule:start -->.*?<!-- slot:performer-schedule:end -->/su, performerSlot(content.performers));
  html = html.replace(/<div class="live-strip" id="live-status"[^>]*>.*?<\/div>/su, liveStrip(content));
  html = html.replace(/<!-- slot:envelopes:start -->.*?<!-- slot:envelopes:end -->/su, envelopeGrid(content));
  html = html.replace(/<!-- slot:messages:start -->.*?<!-- slot:messages:end -->/su, messageWall(messages));
  html = html.replace(/<!-- slot:contact:start -->.*?<!-- slot:contact:end -->/su, contactSlot(content.event));
  for (const day of ['11', '12', '13']) html = html.replace(new RegExp(`(<section class="day-panel" id="panel-${day}"[^>]*>).*?(<\\/section>)`, 'su'), `$1${rundownPanel(content, day)}$2`);
  html = html.replace(/<!-- slot:gallery:start -->.*?<!-- slot:gallery:end -->/su, gallerySlot(content.gallery));
  html = html.replaceAll('src="src/scripts/experience.ts"', 'src="src/scripts/experience.js"');
  return html;
}

function readFileSyncSafe(path) {
  try { return readFileSync(path, 'utf8'); } catch { return '<!doctype html><html lang="id"><body><h1>BHARASENA</h1></body></html>'; }
}

function liveStrip(content) {
  const known = content.rundown.filter((item) => !item.isPlaceholder);
  const text = known.length ? 'Rundown resmi aktif.' : 'Rundown resmi akan hadir di sini.';
  return `<div class="live-strip" id="live-status" aria-live="polite"><span class="live-lamp" aria-hidden="true"></span><span data-live-status>${escapeHtml(text)}</span><span class="live-progress" data-live-progress aria-hidden="true"><span class="live-progress__fill" aria-hidden="true"></span></span></div>`;
}

function venueSlot(event) {
  const venue = event.venue || 'Tempat akan diumumkan';
  const note = event.venue ? 'Lokasi acara' : 'Informasi resmi menyusul';
  return `<!-- slot:venue:start --><div class="event-ticket ticket-place" data-dynamic="venue"><span class="ticket-label">LOKASI</span><strong>${escapeHtml(venue)}</strong><span>${escapeHtml(note)}</span></div><!-- slot:venue:end -->`;
}

function performerSlot(performers) {
  const performer = performers.find((item) => item.name.toLowerCase().includes('budi')) || performers[0];
  const schedule = performer?.scheduledAt || 'Menunggu pengumuman';
  return `<!-- slot:performer-schedule:start --><div class="mini-envelope" data-envelope="performer" data-dynamic="performer-schedule"><span class="wax-mini" aria-hidden="true"></span><span>Jadwal penampilan<br /><strong>${escapeHtml(schedule)}</strong></span></div><!-- slot:performer-schedule:end -->`;
}

function contactSlot(event) {
  const text = event.contact ? `Kontak panitia: ${event.contact}` : 'Kontak resmi panitia akan dicantumkan setelah terverifikasi.';
  return `<!-- slot:contact:start --><p class="contact-note" data-dynamic="contact">${escapeHtml(text)}</p><!-- slot:contact:end -->`;
}

function rundownPanel(content, day) {
  const rows = content.rundown.filter((item) => item.day.endsWith(`-${day}`));
  const roman = { '11': 'I', '12': 'II', '13': 'III' }[day] || day;
  const published = rows.filter((item) => !item.isPlaceholder);
  if (!published.length) return `<div class="schedule-locked"><span aria-hidden="true">${roman}</span><div><h3>Rundown sedang disiapkan</h3><p>Jam dan urutan kegiatan akan tampil setelah dikonfirmasi panitia.</p></div></div>`;
  return `<ol class="schedule-list">${published.map((item) => `<li><time>${escapeHtml(item.startAt || '')}</time><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || '')}</p></div></li>`).join('')}</ol>`;
}

function gallerySlot(items) {
  if (!items.length) return `<div class="gallery-track" data-dynamic="gallery" tabindex="0" aria-label="Galeri foto acara"><figure class="gallery-frame"><div class="gallery-mat"><span class="frame-monogram">B</span></div><figcaption>HARI 01 · SEGERA DIPAJANG</figcaption></figure><figure class="gallery-frame"><div class="gallery-mat"><span class="frame-monogram">H</span></div><figcaption>HARI 02 · SEGERA DIPAJANG</figcaption></figure><figure class="gallery-frame"><div class="gallery-mat"><span class="frame-monogram">A</span></div><figcaption>HARI 03 · SEGERA DIPAJANG</figcaption></figure></div>`;
  return `<div class="gallery-track" data-dynamic="gallery" tabindex="0" aria-label="Galeri foto acara">${items.map((item) => `<figure class="gallery-frame"><div class="gallery-mat"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" /></div><figcaption>${escapeHtml(item.day || 'BHARASENA')}</figcaption></figure>`).join('')}</div>`;
}

function envelopeGrid(content) {
  const labels = { venue: ['01 / LOKASI','Tempat acara'], admission: ['02 / AKSES','Ketentuan masuk'], 'dress-code': ['03 / BUSANA','Busana acara'], updates: ['04 / KABAR','Informasi terbaru'] };
  const cards = content.envelopes.map((item) => {
    const label = labels[item.id] || [' / INFO', item.title];
    const open = !item.sealed && item.body;
    const text = open ? item.body : 'Informasi resmi segera dibuka.';
    const status = open ? 'Terbuka' : 'SEGEL PANITIA';
    return `<article class="envelope ${open ? 'is-open' : 'is-sealed'}" data-envelope="${escapeHtml(item.id)}" aria-expanded="${open}"><div class="envelope-top"><span>${escapeHtml(label[0])}</span><span class="envelope-fold" aria-hidden="true"></span></div><div class="envelope-body"><h3>${escapeHtml(label[1])}</h3><p data-envelope-body>${escapeHtml(text)}</p></div><div class="envelope-bottom"><span data-envelope-status>${escapeHtml(status)}</span><span class="wax-mini" aria-hidden="true"></span></div></article>`;
  }).join('');
  return cards;
}

function messageWall(messages) {
  const items = messages.map((item) => `<article class="message-card"><p>${escapeHtml(item.body)}</p><footer><strong>${escapeHtml(item.nickname || 'Tamu')}</strong></footer></article>`).join('');
  return `<div class="message-wall-layout" data-dynamic="messages"><form id="message-form" class="message-form" data-message-form novalidate><div class="message-field"><label for="message-name">Nama panggilan <span>(opsional)</span></label><input id="message-name" name="nickname" data-message-name type="text" maxlength="20" autocomplete="nickname" /></div><div class="message-field"><label for="message-body">Pesan untuk angkatan</label><textarea id="message-body" name="body" data-message-body maxlength="80" rows="4" required></textarea><small class="message-counter"><span data-message-count>0</span> / 80</small></div><div class="message-trap" aria-hidden="true"><label for="message-website">Website</label><input id="message-website" name="website" data-message-honeypot tabindex="-1" autocomplete="off" /></div><button class="message-submit" type="submit">Kirim ke dinding <span aria-hidden="true">↗</span></button><p id="message-status" class="message-status" data-message-status role="status" aria-live="polite"></p></form><div class="message-list-wrap"><div class="message-list-heading"><span>CATATAN YANG SUDAH TIBA</span><span class="message-list-state" data-message-state>${items ? `${messages.length} PESAN TERBIT` : 'MENUNGGU PESAN'}</span></div><div class="message-list" data-messages-list aria-live="polite">${items || '<p class="message-empty" data-message-empty>Belum ada pesan yang dibuka untuk umum. Jadilah yang pertama menulis.</p>'}</div></div></div>`;
}

function adminPage(session = null) {
  const messages = db.prepare("SELECT id,nickname,body,status,created_at FROM messages ORDER BY created_at DESC LIMIT 80").all();
  const rows = messages.map((item) => `<tr><td>${escapeHtml(item.nickname || 'Tamu')}</td><td>${escapeHtml(item.body)}</td><td>${escapeHtml(item.status)}</td><td>${session && item.status === 'pending' ? `<form method="post" action="/admin/messages/${item.id}"><input type="hidden" name="csrf" value="${escapeHtml(session.csrf_token)}" /><button name="status" value="approved">Setujui</button><button name="status" value="rejected">Tolak</button></form>` : ''}</td></tr>`).join('');
  if (!session) return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin BHARASENA</title><link rel="stylesheet" href="/admin.css"></head><body class="admin-page"><main class="admin-shell"><p class="scene-kicker">BHARASENA / PANITIA</p><h1>Ruang kendali.</h1><form method="post" action="/admin/login" class="admin-form"><label>Nama pengguna<input name="username" autocomplete="username" required></label><label>Kata sandi<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Masuk</button></form></main></body></html>`;
  const csrf = escapeHtml(session.csrf_token);
  const event = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map((row) => [row.key, row.value]));
  const setting = (key, label, multiline = false) => `<label>${label}${multiline ? `<textarea name="${key}" rows="3">${escapeHtml(event[key] || '')}</textarea>` : `<input name="${key}" value="${escapeHtml(event[key] || '')}" />`}</label>`;
  const envelopeForms = db.prepare('SELECT * FROM envelopes ORDER BY rowid').all().map((item) => `<form method="post" action="/admin/envelopes/${escapeHtml(item.id)}" class="admin-form"><h3>${escapeHtml(item.title)}</h3><input type="hidden" name="csrf" value="${csrf}" /><label>Isi<textarea name="body" rows="3" maxlength="1600">${escapeHtml(item.body)}</textarea></label><label>Buka pada (ISO 8601 + zona waktu)<input name="unlock_at" value="${escapeHtml(item.unlock_at || '')}" placeholder="2026-12-11T18:00:00+07:00" /></label><label><input type="checkbox" name="published" value="1" ${item.is_placeholder ? '' : 'checked'} /> Terbitkan setelah waktu buka</label><button>Simpan amplop</button></form>`).join('');
  const rundownForms = db.prepare('SELECT * FROM rundown ORDER BY day,sort_order,id').all().map((item) => `<form method="post" action="/admin/rundown/${item.id}" class="admin-form"><h3>${escapeHtml(item.day)} · Sesi ${item.id}</h3><input type="hidden" name="csrf" value="${csrf}" /><label>Judul<input name="title" maxlength="120" value="${escapeHtml(item.title)}" /></label><label>Mulai (ISO 8601 + zona waktu)<input name="start_at" value="${escapeHtml(item.start_at)}" /></label><label>Selesai (ISO 8601 + zona waktu)<input name="end_at" value="${escapeHtml(item.end_at)}" /></label><label>Deskripsi<textarea name="description" rows="2" maxlength="400">${escapeHtml(item.description)}</textarea></label><label><input type="checkbox" name="published" value="1" ${item.is_placeholder ? '' : 'checked'} /> Terbitkan sesi</label><button>Simpan sesi</button></form>`).join('');
  const performerForms = db.prepare('SELECT * FROM performers ORDER BY id').all().map((item) => `<form method="post" action="/admin/performers/${item.id}" class="admin-form"><h3>${escapeHtml(item.name)}</h3><input type="hidden" name="csrf" value="${csrf}" /><label>Jadwal tampil (ISO 8601 + zona waktu)<input name="scheduled_at" value="${escapeHtml(item.scheduled_at || '')}" /></label><label><input type="checkbox" name="announced" value="1" ${item.is_announced ? 'checked' : ''} /> Jadwal boleh diumumkan</label><button>Simpan penampil</button></form>`).join('');
  const announcementForms = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC,id DESC').all().map((item) => `<form method="post" action="/admin/announcements/${item.id}" class="admin-form"><h3>Pengumuman #${item.id}</h3><input type="hidden" name="csrf" value="${csrf}" /><label>Judul<input name="title" maxlength="120" value="${escapeHtml(item.title)}" /></label><label>Isi<textarea name="body" rows="3" maxlength="1200">${escapeHtml(item.body)}</textarea></label><label><input type="checkbox" name="published" value="1" ${item.published ? 'checked' : ''} /> Terbitkan</label><button>Simpan pengumuman</button></form>`).join('');
  const auditRows = db.prepare('SELECT action,subject,created_at FROM audit_log ORDER BY id DESC LIMIT 20').all().map((item) => `<li>${escapeHtml(item.created_at)} · ${escapeHtml(item.action)} · ${escapeHtml(item.subject)}</li>`).join('');
  const galleryForms = db.prepare('SELECT * FROM gallery ORDER BY sort_order,id').all().map((item) => `<form method="post" action="/admin/gallery/${item.id}" class="admin-form"><h3>Foto #${item.id}</h3><input type="hidden" name="csrf" value="${csrf}" />${item.published ? `<img src="/media/${encodeURIComponent(item.file_path)}" alt="${escapeHtml(item.alt)}" loading="lazy" />` : '<p>Foto tersimpan, masih tersegel dari publik.</p>'}<label>Hari/keterangan<input name="day" maxlength="40" value="${escapeHtml(item.day)}" /></label><label>Teks alternatif<textarea name="alt" rows="2" maxlength="240">${escapeHtml(item.alt)}</textarea></label><label><input type="checkbox" name="published" value="1" ${item.published ? 'checked' : ''} /> Terbitkan</label><button>Simpan foto</button></form>`).join('');
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin BHARASENA</title><link rel="stylesheet" href="/admin.css"></head><body class="admin-page"><main class="admin-shell"><div class="admin-top"><div><p class="scene-kicker">BHARASENA / PANITIA</p><h1>Ruang kendali.</h1></div><form method="post" action="/admin/logout"><button>Keluar</button></form></div><nav class="admin-jump" aria-label="Bagian panel"><a href="#pengaturan">Pengaturan</a><a href="#rundown-admin">Rundown</a><a href="#amplop-admin">Amplop</a><a href="#pengumuman-admin">Pengumuman</a><a href="#galeri-admin">Galeri</a><a href="#pesan-admin">Pesan</a></nav><section id="pengaturan"><h2>Pengaturan acara</h2><form method="post" action="/admin/settings" class="admin-form"><input type="hidden" name="csrf" value="${csrf}" />${setting('venue','Lokasi')}${setting('contact','Kontak panitia')}${setting('dress_code','Aturan busana',true)}${setting('admission','Ketentuan masuk',true)}${setting('event_start_at','Jam mulai resmi (ISO 8601 + zona waktu)')}${setting('event_end_at','Jam selesai resmi (ISO 8601 + zona waktu)')}<button>Simpan pengaturan</button></form></section><section id="rundown-admin"><h2>Rundown</h2><div class="admin-grid">${rundownForms}</div></section><section id="amplop-admin"><h2>Amplop informasi</h2><div class="admin-grid">${envelopeForms}</div></section><section id="penampil-admin"><h2>Penampil</h2><div class="admin-grid">${performerForms}</div></section><section id="pengumuman-admin"><h2>Pengumuman</h2><form method="post" action="/admin/announcements" class="admin-form"><h3>Pengumuman baru</h3><input type="hidden" name="csrf" value="${csrf}" /><label>Judul<input name="title" maxlength="120" required /></label><label>Isi<textarea name="body" rows="3" maxlength="1200" required></textarea></label><label><input type="checkbox" name="published" value="1" /> Terbitkan</label><button>Tambah pengumuman</button></form><div class="admin-grid">${announcementForms}</div></section><section id="galeri-admin"><h2>Galeri</h2><form method="post" action="/admin/gallery" enctype="multipart/form-data" class="admin-form"><input type="hidden" name="csrf" value="${csrf}" /><label>Foto<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label><label>Hari/keterangan<input name="day" maxlength="40" required /></label><label>Teks alternatif<textarea name="alt" rows="2" maxlength="240" required></textarea></label><label><input type="checkbox" name="published" value="1" /> Terbitkan</label><button>Unggah foto</button></form><div class="admin-grid">${galleryForms}</div></section><section id="pesan-admin"><h2>Moderasi Dinding Pesan</h2><div class="admin-table-wrap"><table><thead><tr><th>Nama</th><th>Pesan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Belum ada pesan.</td></tr>'}</tbody></table></div></section><section><h2>Riwayat perubahan</h2><ol class="admin-audit">${auditRows || '<li>Belum ada perubahan.</li>'}</ol></section></main></body></html>`;
}

async function handle(request, response) {
  const requestId = randomUUID();
  const headers = securityHeaders({ production, requestId });
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  const url = new URL(request.url || '/', siteOrigin(request));
  const path = decodeURIComponent(url.pathname);

  if (request.method === 'GET' && path === '/') return send(response, 200, publicPage(request, getSession(db, request.headers.cookie, secret)), { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-cache' });
  if (request.method === 'GET' && path === '/healthz') return json(response, dbHealth(db) ? 200 : 503, { ok: dbHealth(db), database: 'sqlite', serverNow: new Date().toISOString() });
  if (request.method === 'GET' && path === '/api/content') {
    const payload = getPublicContent(new Date(), db);
    const etag = `"${hmac(JSON.stringify(payload), secret).slice(0, 24)}"`;
    if (request.headers['if-none-match'] === etag) return send(response, 304, '', { ETag: etag, 'Cache-Control':'public, max-age=30, stale-while-revalidate=60' });
    return json(response, 200, payload, { ETag: etag, 'Cache-Control':'public, max-age=30, stale-while-revalidate=60' });
  }
  if (request.method === 'GET' && path === '/api/messages') return json(response, 200, { messages: getApprovedMessages(db) }, { 'Cache-Control':'public, max-age=15' });
  if (request.method === 'GET' && path.startsWith('/media/')) {
    const filename = path.slice('/media/'.length);
    const row = db.prepare('SELECT file_path FROM gallery WHERE file_path=? AND published=1').get(filename);
    const file = row ? resolve(root, 'data', 'uploads', filename) : null;
    if (file && !relative(resolve(root, 'data', 'uploads'), file).startsWith('..') && existsSync(file)) return send(response, 200, await readFile(file), { 'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'public, max-age=86400, immutable' });
    return send(response, 404, 'Media tidak ditemukan.');
  }
  if (request.method === 'POST' && path === '/api/messages') {
    try {
      const input = await body(request);
      if (input.website || Number(input.formStartedAt) > Date.now() - 1200) return json(response, 400, { error: 'Pesan belum dapat diterima.' });
      const ip = requestIp(request, process.env.TRUST_PROXY === '1');
      if (!limiter.allow(dailyIpHash(ip, secret))) return json(response, 429, { error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      const valid = validateMessage(input);
      if (!valid.ok) return json(response, 400, { error: valid.reason });
      db.prepare("INSERT INTO messages (nickname,body,status,ip_hash) VALUES (?,?, 'pending',?)").run(valid.nickname, valid.body, dailyIpHash(ip, secret));
      return json(response, 202, { ok: true, message: 'Pesan diterima dan menunggu pemeriksaan panitia.' });
    } catch (error) { return json(response, error.status || 400, { error: 'Pesan tidak dapat diproses.' }); }
  }
  if (request.method === 'GET' && path === '/admin') return send(response, 200, adminPage(getSession(db, request.headers.cookie, secret)), { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
  if (request.method === 'POST' && path === '/admin/login') {
    try {
      const ip = requestIp(request, process.env.TRUST_PROXY === '1');
      if (!loginLimiter.allow(ip)) return send(response, 429, 'Terlalu banyak percobaan masuk.', { 'Retry-After':'900' });
      const input = await body(request, 4_096);
      const result = authenticate(db, cleanText(input.username, 80), String(input.password || ''), secret);
      if (!result) return send(response, 401, 'Nama pengguna atau kata sandi salah.');
      response.writeHead(303, { Location: '/admin', 'Set-Cookie': sessionCookie(result.token, production) }); response.end(); return;
    } catch { return send(response, 400, 'Permintaan tidak valid.'); }
  }
  if (request.method === 'POST' && path === '/admin/logout') {
    const active = getSession(db, request.headers.cookie, secret);
    if (!active || request.headers.origin !== siteOrigin(request)) return send(response, 403, 'Permintaan tidak sah.');
    revokeSession(db, request.headers.cookie, secret); response.writeHead(303, { Location: '/admin', 'Set-Cookie':'bharasena_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' }); response.end(); return;
  }
  const session = getSession(db, request.headers.cookie, secret);
  if (request.method === 'POST' && path.startsWith('/admin/') && path !== '/admin/login') {
    if (!session) return send(response, 401, 'Tidak terautentikasi.');
    try {
      const input = path === '/admin/gallery' ? null : await body(request, 16_384);
      const formInput = path === '/admin/gallery' ? await multipartBody(request) : input;
      if (!csrfValid(request, session, formInput, siteOrigin(request))) return send(response, 403, 'Permintaan tidak sah.');
      const route = path.split('/').filter(Boolean);
      if (path === '/admin/settings') saveSettings(db, formInput, session.admin_id);
      else if (path === '/admin/gallery') {
        const upload = formInput;
        const extension = imageExtension(upload.file);
        if (!extension) throw Object.assign(new Error('Format foto harus JPG, PNG, atau WebP.'), { status: 400 });
        const token = `${randomUUID()}.${extension}`;
        await mkdir(join(root, 'data', 'uploads'), { recursive: true });
        await writeFile(join(root, 'data', 'uploads', token), upload.file.data, { mode: 0o640 });
        try { createGallery(db, upload, token, session.admin_id); } catch (error) { await unlink(join(root, 'data', 'uploads', token)).catch(() => {}); throw error; }
      }
      else if (route[1] === 'envelopes' && route.length === 3) saveEnvelope(db, route[2], formInput, session.admin_id);
      else if (route[1] === 'rundown' && route.length === 3) saveRundown(db, Number(route[2]), formInput, session.admin_id);
      else if (route[1] === 'performers' && route.length === 3) savePerformer(db, Number(route[2]), formInput, session.admin_id);
      else if (path === '/admin/announcements') createAnnouncement(db, formInput, session.admin_id);
      else if (route[1] === 'announcements' && route.length === 3) saveAnnouncement(db, Number(route[2]), formInput, session.admin_id);
      else if (route[1] === 'gallery' && route.length === 3) saveGallery(db, Number(route[2]), formInput, session.admin_id);
      else if (route[1] === 'messages' && route.length === 3) {
        const status = formInput.status === 'approved' || formInput.status === 'rejected' ? formInput.status : null;
        if (!status) return send(response, 400, 'Status tidak valid.');
        db.prepare('UPDATE messages SET status=?,moderated_at=? WHERE id=?').run(status, new Date().toISOString(), Number(route[2]));
        db.prepare('INSERT INTO audit_log(admin_id,action,subject) VALUES (?,?,?)').run(session.admin_id, 'message.moderate', `${route[2]}:${status}`);
      } else return send(response, 404, 'Bagian admin tidak ditemukan.');
      response.writeHead(303, { Location: '/admin', 'Cache-Control': 'no-store' }); response.end(); return;
    } catch (error) { return send(response, error.status || 400, error.message || 'Permintaan tidak valid.'); }
  }
  if (request.method === 'GET' && path === '/sitemap.xml') return send(response, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(siteOrigin(request))}/</loc></url></urlset>`, { 'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=3600' });
  if (request.method === 'GET' && path === '/robots.txt') return send(response, 200, `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${siteOrigin(request)}/sitemap.xml\n`, { 'Content-Type':'text/plain; charset=utf-8' });

  if (request.method === 'GET') {
    const requested = path === '/favicon.ico' ? '/assets/favicon.svg' : path;
    const file = resolve(root, `.${requested}`);
    const assetRelative = relative(join(root, 'assets'), file);
    const publicAsset = path.startsWith('/assets/') && assetRelative && !assetRelative.startsWith('..') && !isAbsolute(assetRelative);
    const publicFile = publicAsset || path === '/styles.css' || path === '/admin.css' || path === '/favicon.ico'
      || path === '/src/scripts/experience.js' || path === '/src/data/event.js';
    if (publicFile && !relative(root, file).startsWith('..') && existsSync(file) && (await stat(file)).isFile()) {
      const type = mime[extname(file).toLowerCase()] || 'application/octet-stream';
      return send(response, 200, await readFile(file), { 'Content-Type': type, 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' });
    }
  }
  return send(response, 404, '<!doctype html><html lang="id"><meta charset="utf-8"><title>BHARASENA — Tidak ditemukan</title><body><main><h1>Halaman ini belum dibuka.</h1><a href="/">Kembali ke ballroom</a></main></body></html>', { 'Content-Type':'text/html; charset=utf-8' });
}

const server = createServer((request, response) => handle(request, response).catch((error) => { console.error(JSON.stringify({ level:'error', requestId: response.getHeader('X-Request-Id'), message: error.message })); send(response, 500, '<!doctype html><html lang="id"><title>BHARASENA — Terjadi gangguan</title><body><h1>Ballroom sedang menyiapkan diri.</h1></body></html>', { 'Content-Type':'text/html; charset=utf-8' }); }));
server.listen(port, () => console.log(JSON.stringify({ level:'info', message:'BHARASENA server listening', port, production })));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

