import { cleanText } from './security.mjs';

const settingLimits = {
  venue: 240,
  contact: 160,
  dress_code: 1200,
  admission: 1200,
  event_start_at: 40,
  event_end_at: 40,
};

export const editableSettings = Object.freeze(Object.keys(settingLimits));

export function saveSettings(db, input, adminId) {
  const update = db.prepare('UPDATE settings SET value=?,updated_at=? WHERE key=?');
  const at = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const key of editableSettings) {
      const raw = input[key] ?? '';
      if (typeof raw !== 'string' || Array.from(raw).length > settingLimits[key]) throw new Error(`Nilai ${key} terlalu panjang.`);
      const value = cleanText(raw, settingLimits[key]);
      if ((key === 'event_start_at' || key === 'event_end_at') && value && !validInstant(value)) throw new Error(`Waktu ${key} harus berupa ISO 8601 dengan zona waktu.`);
      update.run(value, at, key);
    }
    const current = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map((row) => [row.key, row.value]));
    if (current.event_start_at && current.event_end_at && Date.parse(current.event_start_at) >= Date.parse(current.event_end_at)) throw new Error('Jam selesai harus lebih lambat dari jam mulai.');
    audit(db, adminId, 'settings.update', editableSettings.join(','));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function saveEnvelope(db, id, input, adminId) {
  if (!['venue','admission','dress-code','updates'].includes(id)) throw new Error('Amplop tidak dikenal.');
  const body = cleanText(input.body ?? '', 1600);
  const unlockAt = cleanText(input.unlock_at ?? '', 40);
  if (typeof input.body !== 'string' || Array.from(input.body).length > 1600 || (unlockAt && !validInstant(unlockAt))) throw new Error('Isi amplop atau waktu buka tidak valid.');
  const published = input.published === '1';
  if (published && !body) throw new Error('Isi amplop wajib diisi sebelum diterbitkan.');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE envelopes SET body=?,unlock_at=?,is_placeholder=? WHERE id=?').run(body, unlockAt || null, published ? 0 : 1, id);
    audit(db, adminId, 'envelope.update', id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function saveRundown(db, id, input, adminId) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Sesi tidak valid.');
  const row = db.prepare('SELECT id,day FROM rundown WHERE id=?').get(id);
  if (!row) throw new Error('Sesi tidak ditemukan.');
  const title = cleanText(input.title ?? '', 120);
  const description = cleanText(input.description ?? '', 400);
  const startAt = cleanText(input.start_at ?? '', 40);
  const endAt = cleanText(input.end_at ?? '', 40);
  const published = input.published === '1';
  if (Array.from(input.title ?? '').length > 120 || Array.from(input.description ?? '').length > 400) throw new Error('Teks sesi terlalu panjang.');
  if (published && (!title || !validInstant(startAt) || !validInstant(endAt))) throw new Error('Sesi terbit perlu judul dan jam yang valid.');
  if (startAt && !validInstant(startAt) || endAt && !validInstant(endAt)) throw new Error('Jam harus memakai ISO 8601 dengan zona waktu.');
  if (startAt && endAt && Date.parse(startAt) >= Date.parse(endAt)) throw new Error('Jam selesai harus lebih lambat.');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE rundown SET title=?,description=?,start_at=?,end_at=?,is_placeholder=? WHERE id=?').run(title || 'Sesi', description, startAt, endAt, published ? 0 : 1, id);
    audit(db, adminId, 'rundown.update', String(id));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function savePerformer(db, id, input, adminId) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Penampil tidak valid.');
  const scheduledAt = cleanText(input.scheduled_at ?? '', 40);
  if (scheduledAt && !validInstant(scheduledAt)) throw new Error('Jam penampil tidak valid.');
  const announced = input.announced === '1';
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE performers SET scheduled_at=?,is_announced=? WHERE id=?').run(scheduledAt || null, announced ? 1 : 0, id);
    audit(db, adminId, 'performer.update', String(id));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function createGallery(db, input, filePath, adminId) {
  const alt = cleanText(input.alt ?? '', 240);
  const day = cleanText(input.day ?? '', 40);
  if (!filePath || !alt || Array.from(input.alt ?? '').length > 240 || Array.from(input.day ?? '').length > 40) throw new Error('Foto dan teks alternatif wajib diisi.');
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = db.prepare('INSERT INTO gallery(file_path,alt,day,sort_order,published) VALUES (?,?,?,?,?)').run(filePath, alt, day, 0, input.published === '1' ? 1 : 0);
    audit(db, adminId, 'gallery.create', String(result.lastInsertRowid));
    db.exec('COMMIT');
    return Number(result.lastInsertRowid);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function saveGallery(db, id, input, adminId) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Foto tidak valid.');
  const alt = cleanText(input.alt ?? '', 240);
  const day = cleanText(input.day ?? '', 40);
  if (!alt || Array.from(input.alt ?? '').length > 240 || Array.from(input.day ?? '').length > 40) throw new Error('Teks foto tidak valid.');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE gallery SET alt=?,day=?,published=? WHERE id=?').run(alt, day, input.published === '1' ? 1 : 0, id);
    audit(db, adminId, 'gallery.update', String(id));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function deleteGallery(db, id, adminId) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Foto tidak valid.');
  const row = db.prepare('SELECT file_path FROM gallery WHERE id=?').get(id);
  if (!row) throw new Error('Foto tidak ditemukan.');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM gallery WHERE id=?').run(id);
    audit(db, adminId, 'gallery.delete', String(id));
    db.exec('COMMIT');
    return row.file_path;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function createAnnouncement(db, input, adminId) {
  const title = cleanText(input.title ?? '', 120);
  const body = cleanText(input.body ?? '', 1200);
  if (!title || !body || Array.from(input.title ?? '').length > 120 || Array.from(input.body ?? '').length > 1200) throw new Error('Judul atau isi pengumuman tidak valid.');
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = db.prepare('INSERT INTO announcements(title,body,published) VALUES (?,?,?)').run(title, body, input.published === '1' ? 1 : 0);
    audit(db, adminId, 'announcement.create', String(result.lastInsertRowid));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function saveAnnouncement(db, id, input, adminId) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Pengumuman tidak valid.');
  const title = cleanText(input.title ?? '', 120);
  const body = cleanText(input.body ?? '', 1200);
  if (!title || !body || Array.from(input.title ?? '').length > 120 || Array.from(input.body ?? '').length > 1200) throw new Error('Judul atau isi pengumuman tidak valid.');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE announcements SET title=?,body=?,published=? WHERE id=?').run(title, body, input.published === '1' ? 1 : 0, id);
    audit(db, adminId, 'announcement.update', String(id));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function validInstant(value) {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/u.test(value) && Number.isFinite(Date.parse(value));
}

function audit(db, adminId, action, subject) {
  db.prepare('INSERT INTO audit_log(admin_id,action,subject) VALUES (?,?,?)').run(adminId, action, subject);
}
