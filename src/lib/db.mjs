import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let connection;

export function openDb(path = process.env.DB_PATH || join(root, 'data', 'bharasena.db')) {
  if (connection) return connection;
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  connection = new DatabaseSync(path);
  connection.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(connection);
  return connection;
}

export function closeDb() {
  connection?.close();
  connection = undefined;
}

export function migrate(db = openDb()) {
  const directory = join(root, 'db', 'migrations');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  for (const file of readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(file)) continue;
    const sql = readFileSync(join(directory, file), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return db;
}

export function seed(db = openDb()) {
  const settings = {
    title: 'BHARASENA',
    subtitle: 'As one to the light',
    tagline: 'As one to the light',
    battalion: 'Batalyon Bhara Arsa Nawasena',
    school: 'SMAN 2 Taruna Bhayangkara',
    date_start: '2026-12-11',
    date_end: '2026-12-13',
    venue: 'SMA Negeri 2 Taruna Bhayangkara Jawa Timur, Jl. Pandan, Desa Kembiritan, Kecamatan Genteng, Kabupaten Banyuwangi',
    maps_url: 'https://maps.app.goo.gl/XGUJMNvkwBCmNSDWA?g_st=ac',
    contact: '+62 821-5185-9028 (Humas)',
    instagram: '@asonetothelight_',
    dress_code: '11 Des: baju muslim (muslim) atau batik/bebas rapi (nonmuslim). 12 Des pagi: atasan putih polos dan bawahan training hitam; malam: seragam PDSUS berjas Taruna Bhayangkara. 13 Des: baju prom night semi PDL. Warna tambahan, aksesori terlarang, dan contoh outfit: menyusul.',
    admission: 'Hadir untuk seluruh anggota SMAN 2 Taruna Bhayangkara dan tamu tertentu yang diundang. Parkir dan konsumsi tersedia. Yang wajib dibawa: menyusul. Tiket/kartu identitas/undangan: menyusul. Aturan masuk, keterlambatan, dan barang terlarang: menyusul.',
    event_start_at: '2026-12-11T06:00:00+07:00', event_end_at: '2026-12-13T23:00:00+07:00', location_final: '1',
  };
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
  for (const [key, value] of Object.entries(settings)) insertSetting.run(key, value);
  const insertEnvelope = db.prepare('INSERT OR IGNORE INTO envelopes (id,title,body,is_placeholder) VALUES (?,?,?,?)');
  insertEnvelope.run('venue', 'Tempat acara', 'SMA Negeri 2 Taruna Bhayangkara Jawa Timur, Jl. Pandan, Desa Kembiritan, Kecamatan Genteng, Kabupaten Banyuwangi · Google Maps: https://maps.app.goo.gl/XGUJMNvkwBCmNSDWA?g_st=ac', 0);
  insertEnvelope.run('admission', 'Ketentuan masuk', settings.admission, 0);
  insertEnvelope.run('dress-code', 'Busana acara', settings.dress_code, 0);
  insertEnvelope.run('updates', 'Informasi terbaru', '', 1);
  if (!db.prepare('SELECT 1 FROM performers LIMIT 1').get()) {
    const addPerformer = db.prepare('INSERT INTO performers (name,photo_path,scheduled_at,is_announced) VALUES (?,?,?,1)');
    addPerformer.run('Ust. Fuad Naim', '', '11 Desember 2026 · 20.00–selesai');
    addPerformer.run('DJ Gemoy', '', '12 Desember 2026 · 07.50–09.00');
    addPerformer.run('Budi Doremi', '/assets/budi-doremi.jpg', '13 Desember 2026 · 20.30–selesai');
  }
  if (!db.prepare('SELECT 1 FROM rundown LIMIT 1').get()) {
    const add = db.prepare('INSERT INTO rundown (day,start_at,end_at,title,description,is_placeholder,sort_order) VALUES (?,?,?,?,?,0,?)');
    add.run('2026-12-11', '2026-12-11T06:00:00+07:00', '2026-12-11T22:00:00+07:00', 'Taruna Bakti & Istigosah', 'Hari pertama Bharasena diisi dengan Taruna Bakti dan Istigosah. Penampil: Ust. Fuad Naim, pukul 20.00–selesai.', 0);
    add.run('2026-12-12', '2026-12-12T06:00:00+07:00', '2026-12-12T22:00:00+07:00', 'Colour Festival & Malam Intimate', 'Hari kedua Bharasena menghadirkan Colour Festival dan Malam Intimate. Penampil: DJ Gemoy, pukul 07.50–09.00.', 1);
    add.run('2026-12-13', '2026-12-13T19:00:00+07:00', '2026-12-13T23:00:00+07:00', 'Malam Puncak · Konser', 'Penutupan Bharasena berupa malam puncak dan konser bersama Budi Doremi, pukul 20.30–selesai. Ada penampil tambahan dari para taruna.', 2);
  }
  return db;
}

export function settings(db = openDb()) {
  return Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map((row) => [row.key, row.value]));
}

export function getPublicContent(now = new Date(), db = openDb()) {
  const event = settings(db);
  // Keep the public page useful before the admin panel is configured.
  if (!event.venue) event.venue = 'SMA Negeri 2 Taruna Bhayangkara Jawa Timur, Jl. Pandan, Desa Kembiritan, Kecamatan Genteng, Kabupaten Banyuwangi';
  if (!event.maps_url) event.maps_url = 'https://maps.app.goo.gl/XGUJMNvkwBCmNSDWA?g_st=ac';
  if (!event.contact) event.contact = '+62 821-5185-9028 (Humas)';
  if (!event.instagram) event.instagram = '@asonetothelight_';
  const instant = now.getTime();
  const announcements = db.prepare('SELECT id,title,body,created_at FROM announcements WHERE published=1 ORDER BY created_at DESC LIMIT 10').all();
  const latestAnnouncement = announcements[0] ? `${announcements[0].title}: ${announcements[0].body}` : '';
  const envelopes = db.prepare('SELECT id,title,body,unlock_at,is_placeholder FROM envelopes ORDER BY rowid').all().map((row) => {
    const sourceBody = row.id === 'updates' && latestAnnouncement ? latestAnnouncement : row.body;
    const sourcePlaceholder = row.id === 'updates' && latestAnnouncement ? 0 : row.is_placeholder;
    const unlocked = !sourcePlaceholder && sourceBody && (!row.unlock_at || Date.parse(row.unlock_at) <= instant);
    return { id: row.id, title: row.title, body: unlocked ? sourceBody : null, unlockAt: row.unlock_at, sealed: !unlocked };
  });
  const performers = db.prepare('SELECT id,name,photo_path,scheduled_at,is_announced FROM performers ORDER BY id').all().map((row) => ({
    id: row.id, name: row.name, photo: row.photo_path,
    scheduledAt: row.is_announced ? row.scheduled_at : null,
    isAnnounced: Boolean(row.is_announced),
  }));
  return {
    serverNow: now.toISOString(), event,
    rundown: db.prepare('SELECT id,day,start_at,end_at,title,description,is_placeholder FROM rundown ORDER BY day,sort_order,id').all().map((row) => row.is_placeholder ? { id: row.id, day: row.day, isPlaceholder: true } : { id: row.id, day: row.day, startAt: row.start_at, endAt: row.end_at, title: row.title, description: row.description, isPlaceholder: false }),
    envelopes, performers,
    announcements,
    gallery: db.prepare("SELECT id,'/media/' || file_path AS src,alt,day,sort_order FROM gallery WHERE published=1 ORDER BY sort_order,id").all(),
  };
}

export function getApprovedMessages(db = openDb()) {
  return db.prepare("SELECT id,nickname,body,created_at FROM messages WHERE status='approved' ORDER BY created_at DESC,id DESC LIMIT 40").all();
}

export function dbHealth(db = openDb()) {
  return db.prepare('SELECT 1 AS ok').get()?.ok === 1;
}
