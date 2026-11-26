import { beforeEach, describe, expect, it, vi } from 'vitest';
import gallery from '../../api/gallery.mjs';

const galleryUrl = 'https://www.bharasena.com/api/gallery';
const id = '7b50062e-82d3-4d7e-a912-1f24c16a72ea';
const published = {
  id,
  src: 'https://tykneqjpler2jxqc.public.blob.vercel-storage.com/gallery/example.jpg',
  status: 'published',
  alt: 'Dokumentasi BHARASENA',
  day: 'day-1',
};

describe('public gallery images', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
  });

  it('provides a same-origin photo URL and serves the original image bytes', async () => {
    const bytes = Uint8Array.of(255, 216, 255, 217);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ result: [id] }))
      .mockResolvedValueOnce(Response.json({ result: [JSON.stringify(published)] }))
      .mockResolvedValueOnce(Response.json({ result: JSON.stringify(published) }))
      .mockResolvedValueOnce(new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } }));
    vi.stubGlobal('fetch', fetchMock);

    const feed = await (await gallery.fetch(new Request(galleryUrl))).json();
    const [photo] = feed.gallery;
    expect(photo).toEqual({ src: '/api/gallery?photo=' + id, alt: published.alt, day: published.day });

    const image = await gallery.fetch(new Request(new URL(photo.src, galleryUrl)));
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
    expect(fetchMock.mock.calls[3]?.[0].href).toBe(published.src);
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({ redirect: 'error' });
  });

  it.each([{ status: 'draft' }, { src: 'https://unrelated.example/gallery/example.jpg' }])(
    'does not fetch a photo for record with %o',
    async (overrides) => {
      const fetchMock = vi.fn().mockResolvedValue(Response.json({ result: { ...published, ...overrides } }));
      vi.stubGlobal('fetch', fetchMock);

      const response = await gallery.fetch(new Request(galleryUrl + '?photo=' + id));
      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});
