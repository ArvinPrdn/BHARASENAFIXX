import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, getPublicContent, openDb, seed } from '../../src/lib/db.mjs';

describe('sqlite content boundary', () => {
  afterEach(() => closeDb());
  it('migrates and keeps unreleased content out of public payloads', () => {
    const db = seed(openDb(':memory:'));
    const unlockAt = '2026-12-11T00:00:00Z';
    const body = 'Informasi untuk peserta.';
    db.prepare('INSERT INTO envelopes (id,title,body,unlock_at,is_placeholder) VALUES (?,?,?,?,0)')
      .run('scheduled', 'Informasi terjadwal', body, unlockAt);

    const content = getPublicContent(new Date('2026-12-01T00:00:00Z'), db);
    expect(content.event.title).toBe('BHARASENA');
    expect(content.envelopes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'venue', sealed: false, body: expect.any(String) }),
      expect.objectContaining({ id: 'scheduled', sealed: true, body: null }),
    ]));

    const released = getPublicContent(new Date(unlockAt), db);
    expect(released.envelopes).toContainEqual(expect.objectContaining({ id: 'scheduled', sealed: false, body }));
  });
});
