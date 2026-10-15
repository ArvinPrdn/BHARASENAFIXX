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
  it('limits bursts and refills over time', () => {
    const limiter = createRateLimiter({ capacity: 2, refillMs: 1000 });
    expect(limiter.allow('ip', 0)).toBe(true);
    expect(limiter.allow('ip', 0)).toBe(true);
    expect(limiter.allow('ip', 0)).toBe(false);
    expect(limiter.allow('ip', 1000)).toBe(true);
  });
});
