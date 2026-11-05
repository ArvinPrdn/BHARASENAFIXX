import { createHmac, randomUUID } from 'node:crypto';
import { escapeHtml, validateMessage } from './security.mjs';

const WINDOW_SECONDS = 15 * 60;
const MAX_MESSAGES = 4;
const MAX_BODY_BYTES = 4096;

// Rate limiting, saving, feed insertion, and retry deduplication are one operation.
export const SAVE_MESSAGE_SCRIPT = `
local existing = redis.call('GET', KEYS[4])
if existing then return {2, existing} end
local attempts = redis.call('INCR', KEYS[1])
if attempts == 1 then redis.call('EXPIRE', KEYS[1], ARGV[4]) end
if attempts > tonumber(ARGV[5]) then return {0, ''} end
redis.call('SET', KEYS[2], ARGV[2])
redis.call('ZADD', KEYS[3], ARGV[3], ARGV[1])
redis.call('SET', KEYS[4], ARGV[1], 'EX', 86400)
return {1, ARGV[1]}
`;

export function messageWallConfig(env = process.env) {
  let origin = '';
  let redisUrl = '';
  // Vercel Marketplace provisions the KV_* names for Upstash connections.
  const redisRestUrl = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || '';
  try {
    const url = new URL(env.PUBLIC_ORIGIN);
    if (url.protocol === 'https:' || (env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))) origin = url.origin;
  } catch { /* A missing origin keeps submissions closed. */ }
  try {
    const url = new URL(redisRestUrl);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash) redisUrl = url.origin;
  } catch { /* A missing database keeps submissions closed. */ }
  const prefix = /^[a-zA-Z0-9:_-]{1,80}$/u.test(env.MESSAGE_WALL_NAMESPACE || '') ? env.MESSAGE_WALL_NAMESPACE : 'bharasena:wall:v1';
  const readReady = Boolean(redisUrl && redisToken);
  const secretReady = String(env.APP_SECRET || '').length >= 32 && !/^replace-with-/iu.test(env.APP_SECRET || '');
  const writeReady = Boolean(readReady && origin && secretReady);
  const enabled = env.MESSAGE_WALL_ENABLED === 'true' && writeReady;
  return {
    origin, redisUrl, prefix, readReady, writeReady, enabled,
    redisToken, secret: env.APP_SECRET || '',
    botToken: env.TELEGRAM_BOT_TOKEN || '',
    // This integration intentionally sends notifications only to a private chat.
    // Telegram group and supergroup chat IDs are negative numbers.
    chatId: /^-?\d{1,16}$/u.test(env.TELEGRAM_CHAT_ID || '') ? env.TELEGRAM_CHAT_ID : '',
  };
}

function json(status, payload, headers = {}) {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}

async function readJson(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw Object.assign(new Error(), { status: 413 });
  if (!request.body) throw Object.assign(new Error(), { status: 400 });
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw Object.assign(new Error(), { status: 413 }); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error(), { status: 400 }); }
}

async function redis(config, command, fetchImpl) {
  const response = await fetchImpl(config.redisUrl, {
    method: 'POST', headers: { Authorization: `Bearer ${config.redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error('Storage unavailable');
  const payload = await response.json();
  if (payload.error || !Object.hasOwn(payload, 'result')) throw new Error('Storage unavailable');
  return payload.result;
}

function publicMessage(raw) {
  let message;
  try { message = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!message || message.status !== 'approved' || typeof message.id !== 'string' || typeof message.body !== 'string' || typeof message.nickname !== 'string') return null;
  return { id: message.id, nickname: message.nickname, body: message.body, status: 'approved', created_at: message.created_at };
}

export async function notifyTelegram(config, message, fetchImpl = globalThis.fetch) {
  if (!config.botToken || !config.chatId) return;
  const text = `<b>Dinding Pesan BHARASENA</b>\n\n<b>${escapeHtml(message.nickname || 'Tamu BHARASENA')}</b>\n${escapeHtml(message.body)}\n\nPesan sudah tampil otomatis di web.`;
  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ chat_id: config.chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
  });
  if (!response.ok || !(await response.json()).ok) throw new Error('Notification unavailable');
}

export function createMessageWallHandler({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, uuid = randomUUID, logError = console.error } = {}) {
  return async function handleMessageWall(request) {
    const config = messageWallConfig(env);
    if (request.method === 'GET') {
      if (!config.readReady) return json(200, { enabled: false, messages: [] });
      try {
        const ids = await redis(config, ['ZREVRANGE', `${config.prefix}:approved`, 0, 39], fetchImpl);
        if (!Array.isArray(ids)) throw new Error('Invalid feed');
        const values = ids.length ? await redis(config, ['MGET', ...ids.map(id => `${config.prefix}:message:${id}`)], fetchImpl) : [];
        if (!Array.isArray(values)) throw new Error('Invalid feed');
        return json(200, { enabled: config.enabled, messages: values.map(publicMessage).filter(Boolean) }, { 'Cache-Control': 'public, max-age=0, s-maxage=15' });
      } catch {
        logError({ event: 'message_wall_read_failed' });
        return json(503, { enabled: false, error: 'Dinding pesan sedang tidak tersedia. Coba lagi nanti.' });
      }
    }
    if (request.method !== 'POST') return json(405, { error: 'Metode tidak didukung.' }, { Allow: 'GET, POST' });
    if (!config.enabled) return json(503, { error: 'Pengiriman pesan belum dibuka.' });
    if (request.headers.get('origin') !== config.origin) return json(403, { error: 'Permintaan tidak sah.' });
    if (!/^application\/json(?:;|$)/iu.test(request.headers.get('content-type') || '')) return json(415, { error: 'Format pesan tidak didukung.' });

    let input;
    try { input = await readJson(request); }
    catch (error) { return json(error.status || 400, { error: error.status === 413 ? 'Pesan terlalu besar.' : 'Pesan tidak valid.' }); }
    const nickname = input?.nickname ?? input?.name ?? '';
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.body !== 'string' || typeof nickname !== 'string') return json(400, { error: 'Pesan tidak valid.' });
    const timestamp = now();
    const startedAt = Number(input.formStartedAt);
    if (input.website || !Number.isFinite(startedAt) || startedAt <= 0 || startedAt > timestamp - 1000) return json(400, { error: 'Pesan belum dapat diterima. Coba lagi sebentar.' });
    const valid = validateMessage({ nickname, body: input.body });
    if (!valid.ok) return json(400, { error: valid.reason });
    if (input.requestId !== undefined && (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/u.test(input.requestId))) return json(400, { error: 'Identitas kiriman tidak valid.' });

    const id = uuid();
    const message = { id, nickname: valid.nickname, body: valid.body, status: 'approved', created_at: new Date(timestamp).toISOString() };
    // Vercel overwrites this header. Raw visitor IPs are never stored or sent to Telegram.
    const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const ipHash = createHmac('sha256', config.secret).update(`${new Date(timestamp).toISOString().slice(0, 10)}:${ip}`).digest('hex');
    const attempt = input.requestId || id;
    try {
      const result = await redis(config, ['EVAL', SAVE_MESSAGE_SCRIPT, 4,
        `${config.prefix}:rate:${ipHash}`, `${config.prefix}:message:${id}`, `${config.prefix}:approved`, `${config.prefix}:attempt:${ipHash}:${attempt}`,
        id, JSON.stringify(message), timestamp, WINDOW_SECONDS, MAX_MESSAGES,
      ], fetchImpl);
      if (!Array.isArray(result) || ![0, 1, 2].includes(Number(result[0]))) throw new Error('Invalid save result');
      if (Number(result[0]) === 0) return json(429, { error: 'Terlalu banyak kiriman. Coba lagi dalam 15 menit.' }, { 'Retry-After': String(WINDOW_SECONDS) });
      if (Number(result[0]) === 2) {
        const existing = publicMessage(await redis(config, ['GET', `${config.prefix}:message:${result[1]}`], fetchImpl));
        if (!existing) throw new Error('Saved message unavailable');
        return json(200, { ok: true, message: existing });
      }
    } catch {
      logError({ event: 'message_wall_write_failed' });
      return json(503, { error: 'Pesan belum dapat disimpan. Silakan coba lagi.' });
    }
    try { await notifyTelegram(config, message, fetchImpl); }
    catch { logError({ event: 'message_wall_notification_failed', messageId: id }); }
    return json(201, { ok: true, message });
  };
}
