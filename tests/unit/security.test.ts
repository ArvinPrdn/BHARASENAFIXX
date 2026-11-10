import { describe, expect, it } from 'vitest';
import { createRateLimiter, hashPassword, validateMessage, verifyPassword } from '../../src/lib/security.mjs';

describe('security boundaries', () => {
  it('round trips password hashes without storing the password', () => {
    const encoded = hashPassword('kata-sandi-panjang');
    expect(encoded).not.toContain('kata-sandi-panjang');
    expect(verifyPassword('kata-sandi-panjang', encoded)).toBe(true);
    expect(verifyPassword('salah sekali', encoded)).toBe(false);
  });
  it('rejects links and unsafe message content', () => {
    expect(validateMessage({ body: 'Halo semua, sampai jumpa!', nickname: 'Ari' }).ok).toBe(true);
    expect(validateMessage({ body: 'https://example.com', nickname: '' }).ok).toBe(false);
    expect(validateMessage({ body: '<script>alert(1)</script>', nickname: '' }).ok).toBe(false);
  });
  it.each([
    { body: 'Dasar kamu GOBLOK!' },
    { body: 'Sampai jumpa semua!', nickname: 'ｋｎｔｌ' },
    { body: 'Kamu itu j4n.c0kk!' },
    { body: 'Kamu itu b e l e g u g!' },
    { body: 'Kamu itu pan\u200Btek!' },
    { body: 'Kamu itu bujang-inam!' },
    { body: 'Sampai jumpa semua!', nickname: 'kléééng' },
    { body: 'Kamu itu naskleng!' },
    { body: 'Sampai jumpa semua!', nickname: 'cicing' },
    { body: 'Kamu itu cukimai!' },
    { body: 'Kamu itu telaso!' },
    { body: 'Kamu itu aneuk bajeung!' },
  ])('rejects profanity in the message or nickname (%o)', (input) => {
    expect(validateMessage(input)).toEqual({
      ok: false,
      reason: 'Ada kata kasar di pesan atau nama panggilan. Ubah sebelum mengirim.',
    });
  });
  it.each([
    { body: 'Sampai jumpa di pantai!', nickname: 'Hasuna' },
    { body: 'Aku sudah baca bab I.' },
    { body: 'Selamat datang, Bujang!', nickname: 'Putu' },
    { body: 'Matur nuwun kabeh!', nickname: 'Asep' },
  ])('accepts ordinary text that resembles blocked content (%o)', (input) => {
    expect(validateMessage(input).ok).toBe(true);
  });
  it('limits bursts and refills over time', () => {
    const limiter = createRateLimiter({ capacity: 2, refillMs: 1000 });
    expect(limiter.allow('ip', 0)).toBe(true);
    expect(limiter.allow('ip', 0)).toBe(true);
    expect(limiter.allow('ip', 0)).toBe(false);
    expect(limiter.allow('ip', 1000)).toBe(true);
  });
});
