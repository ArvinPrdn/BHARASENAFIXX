import { messageWallConfig, redis } from '../src/lib/message-wall.mjs';

const galleryCache = 'public, max-age=0, s-maxage=30';
const galleryBlobOrigin = 'https://tykneqjpler2jxqc.public.blob.vercel-storage.com';
const photoIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function parse(raw) {
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return null; }
}

function photoSource(record) {
  if (record?.status !== 'published' || typeof record.src !== 'string') return null;
  try {
    const url = new URL(record.src);
    if (url.origin === galleryBlobOrigin && !url.username && !url.password && url.pathname.startsWith('/gallery/')) return url;
  } catch { /* An invalid record has no public image. */ }
  return null;
}

function json(status, data) {
  return Response.json(data, { status, headers: { 'Cache-Control': status === 200 ? galleryCache : 'no-store' } });
}

async function servePhoto(config, id) {
  if (!config.readReady || !photoIdPattern.test(id)) return json(404, { error: 'Foto tidak ditemukan.' });
  const record = parse(await redis(config, ['GET', config.prefix + ':gallery:' + id]));
  const source = photoSource(record);
  if (!source) return json(404, { error: 'Foto tidak ditemukan.' });

  const image = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  const contentType = image.headers.get('content-type');
  if (!image.ok || !image.body || !imageTypes.has(contentType)) {
    await image.body?.cancel();
    return json(502, { error: 'Foto belum dapat dimuat.' });
  }
  return new Response(image.body, {
    headers: { 'Content-Type': contentType, 'Cache-Control': galleryCache, 'X-Content-Type-Options': 'nosniff' },
  });
}

async function handleGallery(request) {
  const config = messageWallConfig();
  if (request.method !== 'GET') return json(405, { error: 'Metode tidak didukung.' });
  const photoId = new URL(request.url).searchParams.get('photo');
  try {
    if (photoId !== null) return await servePhoto(config, photoId);
    if (!config.readReady) return json(200, { gallery: [] });
    const ids = await redis(config, ['ZREVRANGE', config.prefix + ':gallery:published', 0, 99]);
    const values = ids.length ? await redis(config, ['MGET', ...ids.map((id) => config.prefix + ':gallery:' + id)]) : [];
    const gallery = (values || []).map(parse)
      .filter((item) => photoSource(item) && typeof item.id === 'string' && photoIdPattern.test(item.id))
      .map(({ id, alt, day, title, credit }) => ({ src: '/api/gallery?photo=' + id, alt, day, title, credit }));
    return json(200, { gallery });
  } catch {
    if (photoId !== null) return json(503, { error: 'Foto belum dapat dimuat.' });
    return json(503, { gallery: [], error: 'Galeri sedang tidak tersedia.' });
  }
}

export default { fetch: handleGallery };
