import { randomUUID } from 'node:crypto';
import { escapeHtml } from './security.mjs';
import { redis } from './message-wall.mjs';

const SESSION_TTL = 1800;
const MAX_TEXT = 240;
function parse(raw) { try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; } }
// eslint-disable-next-line no-control-regex -- Strip control characters from Telegram text.
function clean(value, max = MAX_TEXT) { return String(value || '').replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function adminAllowed(config, userId, chatId) { return config.adminIds.has(String(userId || '')) && (!config.adminChatId || String(config.adminChatId) === String(chatId || '')); }
async function telegram(config, method, payload, fetchImpl) {
  const response = await fetchImpl('https://api.telegram.org/bot' + config.botToken + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error('Telegram unavailable');
  const result = await response.json();
  if (!result.ok) throw new Error('Telegram unavailable');
  return result.result;
}
function dayKeyboard() { return { inline_keyboard: [[{ text: 'Day 1 · 11 Des', callback_data: 'gallery:day:day-1' }, { text: 'Day 2 · 12 Des', callback_data: 'gallery:day:day-2' }], [{ text: 'Day 3 · 13 Des', callback_data: 'gallery:day:day-3' }]] }; }
function reviewKeyboard() { return { inline_keyboard: [[{ text: '✅ Terbitkan', callback_data: 'gallery:publish' }, { text: '📝 Simpan draft', callback_data: 'gallery:draft' }], [{ text: '🗑 Batalkan', callback_data: 'gallery:cancel' }]] }; }
function sessionKey(config, userId) { return config.prefix + ':gallery:session:' + userId; }
function recordKey(config, id) { return config.prefix + ':gallery:' + id; }
async function saveSession(config, userId, session, fetchImpl) { await redis(config, ['SET', sessionKey(config, userId), JSON.stringify(session), 'EX', SESSION_TTL], fetchImpl); }
async function getSession(config, userId, fetchImpl) { return parse(await redis(config, ['GET', sessionKey(config, userId)], fetchImpl)); }
async function clearSession(config, userId, fetchImpl) { await redis(config, ['DEL', sessionKey(config, userId)], fetchImpl); }
async function prompt(config, chatId, text, fetchImpl, extra = {}) { return telegram(config, 'sendMessage', { chat_id: chatId, text, ...extra }, fetchImpl); }
async function putBlob(config, pathname, data, contentType, fetchImpl) {
  if (!config.blobToken) throw new Error('BLOB_READ_WRITE_TOKEN belum diatur.');
  const response = await fetchImpl('https://blob.vercel-storage.com/' + encodeURIComponent(pathname), { method: 'PUT', headers: { Authorization: 'Bearer ' + config.blobToken, 'x-api-version': '7', 'x-content-type': contentType, 'x-content-disposition': 'inline', 'x-cache-control-max-age': '31536000' }, body: data });
  if (!response.ok) throw new Error('Upload foto ke Blob gagal.');
  const result = await response.json();
  if (!result.url) throw new Error('URL foto tidak diterima dari Blob.');
  return result;
}
async function uploadTelegramPhoto(config, fileId, fetchImpl) {
  const file = await telegram(config, 'getFile', { file_id: fileId }, fetchImpl);
  if (!file?.file_path) throw new Error('File Telegram tidak ditemukan.');
  const source = await fetchImpl('https://api.telegram.org/file/bot' + config.botToken + '/' + file.file_path, { signal: AbortSignal.timeout(30000) });
  if (!source.ok) throw new Error('Foto Telegram tidak dapat diunduh.');
  const data = new Uint8Array(await source.arrayBuffer());
  return putBlob(config, 'gallery/' + new Date().toISOString().slice(0, 10) + '/' + randomUUID() + '.jpg', data, 'image/jpeg', fetchImpl);
}
async function publish(config, session, status, fetchImpl) {
  const id = randomUUID();
  const blob = await uploadTelegramPhoto(config, session.fileId, fetchImpl);
  const record = { id, src: blob.url, day: session.day, title: session.title, alt: session.description || session.title || 'Dokumentasi BHARASENA', description: session.description, credit: session.credit, status, pathname: blob.pathname || '', created_at: new Date().toISOString(), created_by: String(session.userId) };
  await redis(config, ['SET', recordKey(config, id), JSON.stringify(record)], fetchImpl);
  await redis(config, ['ZADD', config.prefix + ':gallery:' + status, Date.parse(record.created_at), id], fetchImpl);
  return record;
}
async function handleText(config, message, session, fetchImpl) {
  const text = clean(message.text);
  if (session.step === 'title') {
    if (!text) return prompt(config, message.chat.id, 'Tulis judul foto dulu ya.', fetchImpl);
    session.title = text; session.step = 'description'; await saveSession(config, message.from.id, session, fetchImpl);
    return prompt(config, message.chat.id, 'Keterangan foto apa? Contoh: Colour Festival di Lapangan Catur Prasetya.', fetchImpl);
  }
  if (session.step === 'description') {
    session.description = text; session.step = 'credit'; await saveSession(config, message.from.id, session, fetchImpl);
    return prompt(config, message.chat.id, 'Kredit foto siapa? Kalau tidak ada, balas /skip.', fetchImpl);
  }
  if (session.step === 'credit') {
    session.credit = text === '/skip' ? '' : text; session.step = 'review'; await saveSession(config, message.from.id, session, fetchImpl);
    const preview = '<b>Preview foto</b>\\n\\n<b>' + escapeHtml(session.day) + '</b>\\n<b>' + escapeHtml(session.title) + '</b>\\n' + escapeHtml(session.description || 'Tanpa keterangan') + (session.credit ? '\\n\\nKredit: ' + escapeHtml(session.credit) : '');
    return prompt(config, message.chat.id, preview, fetchImpl, { parse_mode: 'HTML', reply_markup: reviewKeyboard() });
  }
  return false;
}
async function handleCallback(config, callback, fetchImpl, logError) {
  const chatId = callback.message?.chat?.id;
  if (!adminAllowed(config, callback.from?.id, chatId)) return true;
  await telegram(config, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'Memproses...' }, fetchImpl).catch(() => {});
  const userId = callback.from.id;
  const session = await getSession(config, userId, fetchImpl);
  const data = String(callback.data || '');
  if (data.startsWith('gallery:day:')) {
    const day = data.slice('gallery:day:'.length);
    if (!['day-1', 'day-2', 'day-3'].includes(day) || !session) return true;
    session.day = day; session.step = 'title'; await saveSession(config, userId, session, fetchImpl);
    await prompt(config, chatId, 'Day dipilih. Sekarang tulis judul foto.', fetchImpl);
    return true;
  }
  if (!session) return true;
  if (data === 'gallery:cancel') {
    await clearSession(config, userId);
    await telegram(config, 'editMessageText', { chat_id: chatId, message_id: callback.message?.message_id, text: 'Upload foto dibatalkan.' }, fetchImpl).catch(() => {});
    return true;
  }
  if (data !== 'gallery:publish' && data !== 'gallery:draft') return true;
  try {
    const record = await publish(config, session, data === 'gallery:publish' ? 'published' : 'draft', fetchImpl);
    await clearSession(config, userId);
    await telegram(config, 'editMessageText', { chat_id: chatId, message_id: callback.message?.message_id, text: record.status === 'published' ? 'Foto sudah terbit di galeri.' : 'Foto tersimpan sebagai draft.' }, fetchImpl).catch(() => {});
  } catch (error) {
    logError({ event: 'gallery_publish_failed', message: String(error.message || error).slice(0, 160) });
    await prompt(config, chatId, 'Foto belum berhasil disimpan: ' + String(error.message || error), fetchImpl);
  }
  return true;
}
export async function handleGalleryUpdate({ config, update, fetchImpl = globalThis.fetch, logError = console.error }) {
  const callback = update?.callback_query;
  if (callback && String(callback.data || '').startsWith('gallery:')) return handleCallback(config, callback, fetchImpl, logError).catch(() => true);
  const message = update?.message;
  if (!message || !adminAllowed(config, message.from?.id, message.chat?.id)) return false;
  const session = await getSession(config, message.from.id, fetchImpl).catch(() => null);
  if (message.photo?.length) {
    const photo = message.photo.at(-1);
    await saveSession(config, message.from.id, { step: 'day', fileId: photo.file_id, userId: message.from.id, chatId: message.chat.id }, fetchImpl);
    await prompt(config, message.chat.id, 'Foto diterima. Foto ini untuk hari keberapa?', fetchImpl, { reply_markup: dayKeyboard() });
    return true;
  }
  if (session?.step && message.text) { await handleText(config, message, session, fetchImpl); return true; }
  return false;
}
