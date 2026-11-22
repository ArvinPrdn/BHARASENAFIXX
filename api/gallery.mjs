import { messageWallConfig, redis } from '../src/lib/message-wall.mjs';
function parse(raw) { try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; } }
function json(status, payload) { return Response.json(payload, { status, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' } }); }
export default { fetch: async (request) => {
  const config = messageWallConfig();
  if (request.method !== 'GET') return json(405, { error: 'Metode tidak didukung.' });
  if (!config.readReady) return json(200, { gallery: [] });
  try {
    const ids = await redis(config, ['ZREVRANGE', config.prefix + ':gallery:published', 0, 99]);
    const values = ids.length ? await redis(config, ['MGET', ...ids.map((id) => config.prefix + ':gallery:' + id)]) : [];
    const gallery = (values || []).map(parse).filter((item) => item?.status === 'published').map((item) => ({ src: item.src, alt: item.alt, day: item.day, title: item.title, credit: item.credit }));
    return json(200, { gallery });
  } catch { return json(503, { gallery: [], error: 'Galeri sedang tidak tersedia.' }); }
}};
