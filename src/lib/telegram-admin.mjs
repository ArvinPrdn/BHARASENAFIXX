import { escapeHtml } from './security.mjs';
import { messageWallConfig, redis } from './message-wall.mjs';

const MAX_BODY_BYTES = 32_768;
const MODERATE_MESSAGE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current.status ~= 'pending' then return 2 end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('ZREM', KEYS[2], ARGV[2])
if ARGV[3] == 'approved' then redis.call('ZADD', KEYS[3], ARGV[4], ARGV[2]) end
return 1
`;

function json(status, payload) {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readJson(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new Error('Payload too large');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error('Payload too large');
  return JSON.parse(text);
}

async function telegram(config, method, payload, fetchImpl) {
  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000), body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Telegram unavailable');
  const result = await response.json();
  if (!result.ok) throw new Error('Telegram unavailable');
  return result.result;
}

function isAdmin(config, userId, chatId) {
  return config.adminIds.has(String(userId || '')) && (!config.adminChatId || String(config.adminChatId) === String(chatId || ''));
}

function parseStored(raw) {
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

function keyboard(id) {
  return { inline_keyboard: [[
    { text: '✅ Setujui', callback_data: `wall:approve:${id}` },
    { text: '❌ Tolak', callback_data: `wall:reject:${id}` },
  ]] };
}

function messageText(message, status = 'pending') {
  const label = status === 'approved' ? 'Disetujui dan ditampilkan di web.' : status === 'rejected' ? 'Ditolak dan tidak ditampilkan.' : 'Menunggu persetujuan admin.';
  return `<b>Dinding Pesan BHARASENA</b>\n\n<b>${escapeHtml(message.nickname || 'Tamu BHARASENA')}</b>\n${escapeHtml(message.body)}\n\n<i>${label}</i>`;
}

async function moderate(config, id, status, fetchImpl) {
  if (!/^[a-zA-Z0-9_-]{16,80}$/u.test(id) || !['approved', 'rejected'].includes(status)) return { ok: false };
  const raw = await redis(config, ['GET', `${config.prefix}:message:${id}`], fetchImpl);
  const current = parseStored(raw);
  if (!current || current.status !== 'pending') return { ok: false };
  const next = { ...current, status };
  const result = await redis(config, ['EVAL', MODERATE_MESSAGE_SCRIPT, 3,
    `${config.prefix}:message:${id}`, `${config.prefix}:pending`, `${config.prefix}:approved`, JSON.stringify(next), id, status, Date.parse(current.created_at) || Date.now(),
  ], fetchImpl);
  return { ok: Number(result) === 1, message: next };
}

export function createTelegramAdminHandler({ env = process.env, fetchImpl = globalThis.fetch, logError = console.error } = {}) {
  return async function handleTelegramAdmin(request) {
    const config = messageWallConfig(env);
    if (request.method !== 'POST') return json(405, { error: 'Metode tidak didukung.' });
    if (!config.adminReady || request.headers.get('x-telegram-bot-api-secret-token') !== config.webhookSecret) return json(403, { error: 'Webhook tidak sah.' });
    let update;
    try { update = await readJson(request); } catch { return json(400, { error: 'Update tidak valid.' }); }

    const callback = update?.callback_query;
    if (callback) {
      const chatId = callback.message?.chat?.id;
      if (!isAdmin(config, callback.from?.id, chatId)) return json(200, { ok: true });
      const match = /^wall:(approve|reject):([a-zA-Z0-9_-]{16,80})$/u.exec(String(callback.data || ''));
      if (!match) return json(200, { ok: true });
      const status = match[1] === 'approve' ? 'approved' : 'rejected';
      try {
        const result = await moderate(config, match[2], status, fetchImpl);
        await telegram(config, 'answerCallbackQuery', { callback_query_id: callback.id, text: result.ok ? (status === 'approved' ? 'Pesan disetujui.' : 'Pesan ditolak.') : 'Pesan sudah diproses.' }, fetchImpl).catch(() => {});
        if (result.ok && callback.message?.message_id) await telegram(config, 'editMessageText', { chat_id: chatId, message_id: callback.message.message_id, text: messageText(result.message, status), parse_mode: 'HTML' }, fetchImpl).catch(() => {});
      } catch { logError({ event: 'telegram_admin_moderation_failed' }); }
      return json(200, { ok: true });
    }

    const incoming = update?.message;
    const chatId = incoming?.chat?.id;
    if (!isAdmin(config, incoming?.from?.id, chatId)) return json(200, { ok: true });
    const command = /^\/(pending|stats)(?:@[^\s]+)?(?:\s|$)/iu.exec(String(incoming?.text || ''));
    if (!command) return json(200, { ok: true });
    try {
      if (command[1].toLowerCase() === 'stats') {
        const [pending, approved] = await Promise.all([redis(config, ['ZCARD', `${config.prefix}:pending`], fetchImpl), redis(config, ['ZCARD', `${config.prefix}:approved`], fetchImpl)]);
        await telegram(config, 'sendMessage', { chat_id: chatId, text: `<b>BHARASENA Admin</b>\nPending: ${pending}\nTampil: ${approved}`, parse_mode: 'HTML' }, fetchImpl);
      } else {
        const ids = await redis(config, ['ZREVRANGE', `${config.prefix}:pending`, 0, 9], fetchImpl);
        const values = ids.length ? await redis(config, ['MGET', ...ids.map((id) => `${config.prefix}:message:${id}`)], fetchImpl) : [];
        const pending = (values || []).map(parseStored).filter((message) => message?.status === 'pending');
        if (!pending.length) await telegram(config, 'sendMessage', { chat_id: chatId, text: 'Tidak ada pesan yang menunggu moderasi.' }, fetchImpl);
        for (const message of pending) await telegram(config, 'sendMessage', { chat_id: chatId, text: messageText(message), parse_mode: 'HTML', reply_markup: keyboard(message.id) }, fetchImpl);
      }
    } catch { logError({ event: 'telegram_admin_command_failed' }); }
    return json(200, { ok: true });
  };
}
