import { messageWallConfig } from '../src/lib/message-wall.mjs';

const env = process.env;

async function telegram(method, parameters = {}) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parameters), signal: AbortSignal.timeout(10000),
    });
  } catch { throw new Error('Telegram tidak dapat dihubungi.'); }
  let payload;
  try { payload = await response.json(); } catch { throw new Error('Balasan Telegram tidak valid.'); }
  if (!response.ok || !payload.ok) throw new Error(`Telegram menolak ${method}. Periksa token dan chat pribadi.`);
  return payload.result;
}

try {
  if (!/^\d+:[A-Za-z0-9_-]+$/u.test(env.TELEGRAM_BOT_TOKEN || '')) throw new Error('Isi TELEGRAM_BOT_TOKEN di .env lokal atau environment Vercel. Jangan kirim token ke chat.');
  const bot = await telegram('getMe');
  console.log(`Bot terhubung: @${bot.username}`);
  if (process.argv.includes('--discover')) {
    const webhook = await telegram('getWebhookInfo');
    if (webhook.url) throw new Error('Bot sudah memakai webhook. Periksa integrasi lama sebelum mengambil chat ID; script ini tidak mengubah webhook.');
    const updates = await telegram('getUpdates', { timeout: 0, allowed_updates: ['message'] });
    const chats = new Map();
    for (const update of updates) {
      const chat = update.message?.chat;
      if (chat?.type === 'private') chats.set(String(chat.id), chat);
    }
    if (!chats.size) console.log('Buka bot di Telegram, tekan Start, lalu jalankan perintah ini lagi.');
    for (const [id, chat] of chats) console.log(`Chat pribadi ${chat.username ? `@${chat.username}` : chat.first_name || ''}: TELEGRAM_CHAT_ID=${id}`);
    console.log('Pilih ID chat milikmu. Token tidak ditampilkan atau ditulis oleh script ini.');
  } else {
    const config = messageWallConfig(env);
    if (!config.chatId) throw new Error('Isi TELEGRAM_CHAT_ID dengan ID chat pribadi dari telegram:discover.');
    const chat = await telegram('getChat', { chat_id: config.chatId });
    if (chat.type !== 'private') throw new Error('Tujuan notifikasi harus chat pribadi.');
    console.log('Chat pribadi terverifikasi.');
    if (!config.readReady) throw new Error('Penyimpanan belum siap: isi UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN.');
    let storageResponse;
    try {
      storageResponse = await fetch(config.redisUrl, {
        method: 'POST', headers: { Authorization: `Bearer ${config.redisToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(['PING']), signal: AbortSignal.timeout(7000),
      });
    } catch { throw new Error('Penyimpanan tidak dapat dihubungi.'); }
    if (!storageResponse.ok || (await storageResponse.json()).result !== 'PONG') throw new Error('Penyimpanan belum dapat digunakan.');
    console.log('Penyimpanan terhubung.');
    if (!config.writeReady) throw new Error('Isi PUBLIC_ORIGIN sesuai alamat situs dan APP_SECRET acak minimal 32 karakter.');
    console.log(config.enabled ? 'Dinding Pesan aktif: kiriman valid langsung tampil.' : 'Konfigurasi siap. Set MESSAGE_WALL_ENABLED=true pada environment tujuan setelah verifikasi.');
    console.log('Pemeriksaan selesai tanpa mengirim pesan atau mengubah webhook.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
