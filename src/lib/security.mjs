import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { countMessageWords, MESSAGE_MIN_WORDS } from '../data/message-rules.js';
import { containsProfanity } from './message-profanity.mjs';

const linkPattern = /(?:https?:\/\/|www\.|[\w-]+\.(?:com|id|net|org|io|app|co)(?:\b|\/))/iu;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const phonePattern = /(?:\+?62|0)[\s.-]?(?:\d[\s.-]?){8,13}/u;

export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex -- Remove control characters from submitted text.
  return Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').replace(/\s+/gu, ' ').trim()).slice(0, max).join('');
}

export function validateMessage(input) {
  const nicknameRaw = input?.nickname ?? input?.name ?? '';
  const bodyRaw = input?.body ?? '';
  if (typeof nicknameRaw !== 'string' || typeof bodyRaw !== 'string') return { ok: false, reason: 'Pesan tidak valid.' };
  const nickname = cleanText(nicknameRaw, 20);
  const body = cleanText(bodyRaw, 80);
  if (!body || Array.from(bodyRaw).length > 80 || Array.from(nicknameRaw).length > 20) return { ok: false, reason: 'Pesan maksimal 80 karakter dan nama maksimal 20 karakter.' };
  if (countMessageWords(body) < MESSAGE_MIN_WORDS) return { ok: false, reason: `Pesan minimal ${MESSAGE_MIN_WORDS} kata.` };
  const content = `${body} ${nickname}`;
  if (/[<>]/u.test(content) || linkPattern.test(content) || emailPattern.test(content) || phonePattern.test(content)) return { ok: false, reason: 'Pesan mengandung konten yang tidak dapat diterima.' };
  if (containsProfanity(body) || containsProfanity(nickname)) return { ok: false, reason: 'Ada kata kasar di pesan atau nama panggilan. Ubah sebelum mengirim.' };
  return { ok: true, nickname, body };
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

export function hashPassword(password, salt = randomBytes(16)) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('Kata sandi minimal 12 karakter.');
  return `scrypt:${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, encoded) {
  const [algorithm, saltHex, hashHex] = String(encoded || '').split(':');
  if (algorithm !== 'scrypt' || !/^[0-9a-f]{32}$/u.test(saltHex || '') || !/^[0-9a-f]{128}$/u.test(hashHex || '')) return false;
  const stored = Buffer.from(hashHex, 'hex');
  const candidate = scryptSync(String(password || ''), Buffer.from(saltHex, 'hex'), 64);
  return timingSafeEqual(candidate, stored);
}

export function randomToken() { return randomBytes(32).toString('base64url'); }
export function hmac(value, secret) { return createHmac('sha256', secret).update(String(value)).digest('hex'); }
export function dailyIpHash(ip, secret, day = new Date().toISOString().slice(0, 10)) { return hmac(`${day}:${ip}`, secret); }

export function createRateLimiter({ capacity, refillMs }) {
  const buckets = new Map();
  return {
    allow(key, now = Date.now()) {
      const entry = buckets.get(key) || { tokens: capacity, at: now };
      entry.tokens = Math.min(capacity, entry.tokens + Math.max(0, now - entry.at) / refillMs);
      entry.at = now;
      if (entry.tokens < 1) { buckets.set(key, entry); return false; }
      entry.tokens -= 1;
      buckets.set(key, entry);
      if (buckets.size > 5000) for (const [oldKey, oldEntry] of buckets) if (now - oldEntry.at > 86_400_000) buckets.delete(oldKey);
      return true;
    },
    clear() { buckets.clear(); },
  };
}

export function requestIp(request, trustProxy = false) {
  const forwarded = trustProxy ? request.headers['x-forwarded-for']?.split(',')[0]?.trim() : null;
  return forwarded || request.socket.remoteAddress || 'unknown';
}

export function securityHeaders({ production = false, requestId = '' } = {}) {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), gyroscope=(self), accelerometer=(self)',
    'X-Frame-Options': 'DENY',
    'X-Request-Id': requestId,
    ...(production ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}
