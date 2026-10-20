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
    subtitle: 'Prom Night Batalyon 6',
    battalion: 'Batalyon Bhara Arsa Nawasena',
    school: 'SMAN 2 Taruna Bhayangkara',
    date_start: '2026-12-11',
    date_end: '2026-12-13',
    venue: 'SMADATARA, Banyuwangi, Jawa Timur',
    contact: 'WhatsApp 082233244629 · Instagram @asonetothelight_',
    dress_code: '', admission: '',
    event_start_at: '', event_end_at: '', location_final: '0',
  };
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
  for (const [key, value] of Object.entries(settings)) insertSetting.run(key, value);
  const insertEnvelope = db.prepare('INSERT OR IGNORE INTO envelopes (id,title,body,is_placeholder) VALUES (?,?,?,1)');
  for (const [id, title] of [['venue','Tempat acara'],['admission','Ketentuan masuk'],['dress-code','Busana acara'],['updates','Informasi terbaru']]) insertEnvelope.run(id, title, '');
  if (!db.prepare('SELECT 1 FROM performers LIMIT 1').get()) db.prepare('INSERT INTO performers (name,photo_path,is_announced) VALUES (?,?,1)').run('Budi Doremi', '/assets/budi-doremi.jpg');
  if (!db.prepare('SELECT 1 FROM rundown LIMIT 1').get()) {
    const add = db.prepare('INSERT INTO rundown (day,start_at,end_at,title,description,is_placeholder,sort_order) VALUES (?,?,?,?,?,1,?)');
    for (const [index, day] of ['2026-12-11','2026-12-12','2026-12-13'].entries()) {
      for (let order = 0; order < 3; order += 1) add.run(day, '', '', `Sesi ${order + 1}`, '', index * 3 + order);
    }
  }
  return db;
}

export function settings(db = openDb()) {
  return Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map((row) => [row.key, row.value]));
}

export function getPublicContent(now = new Date(), db = openDb()) {
  const event = settings(db);
  // Keep the public page useful before the admin panel is configured.
  if (!event.venue) event.venue = 'SMADATARA, Banyuwangi, Jawa Timur';
  if (!event.contact) event.contact = 'WhatsApp 082233244629 · Instagram @asonetothelight_';
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
