import { describe, expect, it, vi } from 'vitest';
import { createMessageWallHandler, messageWallConfig, SAVE_MESSAGE_SCRIPT } from '../../src/lib/message-wall.mjs';
import { countMessageWords } from '../../src/data/message-rules.js';

const env = {
  NODE_ENV: 'production', MESSAGE_WALL_ENABLED: 'true', PUBLIC_ORIGIN: 'https://bharasena.example',
  APP_SECRET: 'test-secret-for-message-wall-1234567890',
  UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'fake-redis-secret',
  TELEGRAM_BOT_TOKEN: '12345:fake-not-a-real-token', TELEGRAM_CHAT_ID: '12345678',
};
const instant = Date.parse('2026-11-02T00:00:00Z');
const body = { nickname: 'Naim', body: 'Sampai jumpa di Bharasena', website: '', formStartedAt: instant - 2000, requestId: 'request-0000000001' };
const approved = { id: 'existing-id', nickname: 'Naim', body: 'Sampai jumpa di Bharasena', status: 'approved', created_at: new Date(instant).toISOString() };

function request(input: unknown = body, headers: Record<string, string> = {}) {
  return new Request('https://bharasena.example/api/messages', {
    method: 'POST', headers: { Origin: env.PUBLIC_ORIGIN, 'Content-Type': 'application/json', 'X-Forwarded-For': '192.0.2.10', ...headers },
    body: JSON.stringify(input),
  });
}

function harness(replies: Response[], environment = env) {
  const fetchImpl = vi.fn(async (_url: string | URL | Request, _options?: RequestInit) => {
    const response = replies.shift();
    if (!response) throw new Error('Unexpected external request');
    return response;
  });
  const logError = vi.fn();
  const handle = createMessageWallHandler({ env: environment, fetchImpl, now: () => instant, logError });
  return { handle, fetchImpl, logError };
}

const redis = (result: unknown) => Response.json({ result });

describe('online message wall', () => {
  it('uses the Redis credentials provisioned by Vercel Marketplace', async () => {
    const marketplaceEnv = {
      ...env, UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
      KV_REST_API_URL: 'https://marketplace-redis.example', KV_REST_API_TOKEN: 'marketplace-test-token',
    };
    const { handle, fetchImpl } = harness([redis([])], marketplaceEnv);
    expect(await (await handle(new Request('https://bharasena.example/api/messages'))).json()).toEqual({ enabled: true, messages: [] });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(marketplaceEnv.KV_REST_API_URL);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer marketplace-test-token' });
  });

  it('stays closed without secrets and never contacts external services', async () => {
    const { handle, fetchImpl } = harness([], { ...env, UPSTASH_REDIS_REST_TOKEN: '' });
    const response = await handle(new Request('https://bharasena.example/api/messages'));
    expect(await response.json()).toEqual({ enabled: false, messages: [] });
    expect((await handle(request())).status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(messageWallConfig({ ...env, APP_SECRET: 'replace-with-a-random-32-byte-secret' }).enabled).toBe(false);
  });

  it('validates minimum words and rejects spam without writing or notifying', async () => {
    const { handle, fetchImpl } = harness([]);
    const tooShort = await handle(request({ ...body, body: 'Halo semua' }));
    expect(tooShort.status).toBe(400);
    expect(await tooShort.json()).toEqual({ error: 'Pesan minimal 3 kata.' });
    for (const message of ['Baca di https://example.com', 'Pesan berisi kata anjing', 'Email saya hai@example.com', 'Hubungi saya 081234567890', 'Halo teman <script>']) {
      expect((await handle(request({ ...body, body: message }))).status).toBe(400);
    }
    expect((await handle(request({ ...body, body: ['invalid'] }))).status).toBe(400);
    expect((await handle(request({ ...body, nickname: {} }))).status).toBe(400);
    expect((await handle(request({ ...body, website: 'bot' }))).status).toBe(400);
    expect((await handle(request({ ...body, formStartedAt: instant }))).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(countMessageWords('Halo !!! 😊')).toBe(1);
    expect(countMessageWords('Sampai jumpa teman-teman')).toBe(3);
  });

  it('rejects cross-origin and oversized requests before storage', async () => {
    const { handle, fetchImpl } = harness([]);
    expect((await handle(request(body, { Origin: 'https://other.example' }))).status).toBe(403);
    expect((await handle(request(body, { 'Content-Type': 'text/plain' }))).status).toBe(415);
    expect((await handle(request(body, { 'Content-Length': '5000' }))).status).toBe(413);
    const large = request({ ...body, body: 'a'.repeat(5000) });
    expect((await handle(large)).status).toBe(413);
    const malformed = new Request('https://bharasena.example/api/messages', { method: 'POST', headers: { Origin: env.PUBLIC_ORIGIN, 'Content-Type': 'application/json' }, body: '{' });
    expect((await handle(malformed)).status).toBe(400);
    expect((await handle(request({ ...body, requestId: 'bad/id' }))).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('saves an approved message atomically and then notifies the private chat', async () => {
    const { handle, fetchImpl } = harness([redis([1, 'new-id']), Response.json({ ok: true })]);
    const response = await handle(request());
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.message).toMatchObject({ nickname: 'Naim', body: body.body, status: 'approved' });
    const command = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(command[0]).toBe('EVAL');
    expect(command[1]).toBe(SAVE_MESSAGE_SCRIPT);
    expect(command[2]).toBe(4);
    expect(command[3]).toMatch(/^bharasena:wall:v1:rate:[a-f0-9]{64}$/);
    expect(command[3]).not.toContain('192.0.2.10');
    expect(JSON.parse(command[8])).toEqual(payload.message);
    const notification = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body));
    expect(notification.chat_id).toBe(env.TELEGRAM_CHAT_ID);
    expect(notification.text).toContain('sudah tampil otomatis');
    expect(notification).not.toHaveProperty('reply_markup');
    expect(JSON.stringify(payload)).not.toMatch(/fake-|192\.0\.2|ip_hash/);
  });

  it('keeps the accepted message successful if Telegram fails', async () => {
    const { handle, logError } = harness([redis([1, 'new-id']), new Response('', { status: 503 })]);
    expect((await handle(request())).status).toBe(201);
    expect(logError).toHaveBeenCalledWith({ event: 'message_wall_notification_failed', messageId: expect.any(String) });
  });

  it('allows web publication without configuring Telegram notifications', async () => {
    const { handle, fetchImpl } = harness([redis([1, 'new-id'])], { ...env, TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' });
    expect((await handle(request())).status).toBe(201);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not send a notification to a group chat', async () => {
    const { handle, fetchImpl } = harness([redis([1, 'new-id'])], { ...env, TELEGRAM_CHAT_ID: '-100123456789' });
    expect((await handle(request())).status).toBe(201);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns the original message for a retried submission without a second notification', async () => {
    const { handle, fetchImpl } = harness([redis([2, approved.id]), redis(JSON.stringify(approved))]);
    const response = await handle(request());
    expect(response.status).toBe(200);
    expect((await response.json()).message).toEqual(approved);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.every(call => String(call[0]) === env.UPSTASH_REDIS_REST_URL)).toBe(true);
  });

  it('returns a durable rate limit response without notifying Telegram', async () => {
    const { handle, fetchImpl } = harness([redis([0, ''])]);
    const response = await handle(request());
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('900');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('never reports success if storage fails and logs no secrets', async () => {
    const { handle, fetchImpl, logError } = harness([new Response('', { status: 503 })]);
    const response = await handle(request());
    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith({ event: 'message_wall_write_failed' });
    expect(JSON.stringify(await response.json())).not.toContain('fake-');
  });

  it('publishes only approved records and can pause submissions without hiding the feed', async () => {
    const { handle, fetchImpl } = harness([
      redis(['approved', 'pending', 'rejected', 'missing']),
      redis([JSON.stringify({ ...approved, ip_hash: 'private' }), JSON.stringify({ ...approved, status: 'pending' }), JSON.stringify({ ...approved, status: 'rejected' }), null]),
    ], { ...env, MESSAGE_WALL_ENABLED: 'false' });
    const response = await handle(new Request('https://bharasena.example/api/messages'));
    expect(await response.json()).toEqual({ enabled: false, messages: [approved] });
    expect(response.headers.get('cache-control')).toContain('s-maxage=15');
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(['ZREVRANGE', 'bharasena:wall:v1:approved', 0, 39]);
    expect((await handle(request())).status).toBe(503);
  });

  it('uses an empty feed without an unnecessary database read', async () => {
    const { handle, fetchImpl } = harness([redis([])]);
    expect(await (await handle(new Request('https://bharasena.example/api/messages'))).json()).toEqual({ enabled: true, messages: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((await handle(new Request('https://bharasena.example/api/messages', { method: 'DELETE' }))).status).toBe(405);
  });
});
