import { describe, expect, it, vi } from 'vitest';
import { createTelegramAdminHandler } from '../../src/lib/telegram-admin.mjs';

const env = {
  NODE_ENV: 'production', MESSAGE_WALL_ENABLED: 'true', PUBLIC_ORIGIN: 'https://bharasena.example',
  APP_SECRET: 'test-secret-for-message-wall-1234567890',
  UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'fake-redis-secret',
  TELEGRAM_BOT_TOKEN: '12345:fake-not-a-real-token', TELEGRAM_CHAT_ID: '12345678',
  TELEGRAM_ADMIN_IDS: '7666256021', TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
};
const redis = (result: unknown) => Response.json({ result });
const telegram = (result: unknown = true) => Response.json({ ok: true, result });

function request(update: unknown, secret = env.TELEGRAM_WEBHOOK_SECRET) {
  return new Request('https://bharasena.example/api/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify(update),
  });
}

describe('Telegram admin panel', () => {
  it('rejects a webhook without the configured secret', async () => {
    const fetchImpl = vi.fn();
    const handle = createTelegramAdminHandler({ env, fetchImpl });
    expect((await handle(request({}, 'wrong-secret'))).status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports pending and approved counts to an authorized admin', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      const command = JSON.parse(String(options?.body));
      return command[0] === 'ZCARD' ? redis(command[1].endsWith(':pending') ? 2 : 7) : telegram();
    });
    const handle = createTelegramAdminHandler({ env, fetchImpl });
    const response = await handle(request({ message: { chat: { id: 12345678 }, from: { id: 7666256021 }, text: '/stats' } }));
    expect(response.status).toBe(200);
    const notificationCall = fetchImpl.mock.calls.find((call) => String(call[1]?.body).includes('Pending: 2'));
    const notification = JSON.parse(String(notificationCall?.[1]?.body));
    expect(notification.text).toContain('Pending: 2');
    expect(notification.text).toContain('Tampil: 7');
  });

  it('shows the admin menu to an authorized admin', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      const command = JSON.parse(String(options?.body));
      return String(command[0]) === 'GET' ? redis(null) : telegram();
    });
    const handle = createTelegramAdminHandler({ env, fetchImpl });
    const response = await handle(request({ message: { chat: { id: 12345678 }, from: { id: 7666256021 }, text: '/menu@PesanBharasenaBot' } }));
    expect(response.status).toBe(200);
    const notification = fetchImpl.mock.calls.map((call) => JSON.parse(String(call[1]?.body))).find((payload) => payload.text);
    expect(notification.text).toContain('/pending');
    expect(notification.text).toContain('Terbitkan');
  });

  it('approves a pending message from an authorized inline button', async () => {
    const message = { id: '1234567890abcdef', nickname: 'Naim', body: 'Sampai jumpa di Bharasena', status: 'pending', created_at: '2026-11-19T00:00:00.000Z' };
    const fetchImpl = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      const command = JSON.parse(String(options?.body));
      if (String(command[0]) === 'GET') return redis(JSON.stringify(message));
      if (String(command[0]) === 'EVAL') return redis(1);
      return telegram();
    });
    const handle = createTelegramAdminHandler({ env, fetchImpl });
    const response = await handle(request({ callback_query: {
      id: 'callback-1', from: { id: 7666256021 }, data: 'wall:approve:1234567890abcdef',
      message: { chat: { id: 12345678 }, message_id: 44 },
    } }));
    expect(response.status).toBe(200);
    expect(fetchImpl.mock.calls.some((call) => String(call[1]?.body).includes('approved'))).toBe(true);
  });
});
