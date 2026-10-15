import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, getPublicContent, openDb, seed } from '../../src/lib/db.mjs';

describe('sqlite content boundary', () => {
  afterEach(() => closeDb());
  it('migrates and keeps unreleased content out of public payloads', () => {
    const db = seed(openDb(':memory:'));
    const content = getPublicContent(new Date('2026-12-01T00:00:00Z'), db);
    expect(content.event.title).toBe('BHARASENA');
    expect(content.envelopes.every((item) => item.body === null)).toBe(true);
  });
});
