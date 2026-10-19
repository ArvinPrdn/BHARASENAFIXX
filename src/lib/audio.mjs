import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

export async function sendAudio(request, response, file, size, type) {
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  if (request.method === 'HEAD') {
    response.writeHead(200, { ...headers, 'Content-Length': size });
    response.end();
    return;
  }
  let start = 0;
  let end = size - 1;
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
    if (!match || (!match[1] && !match[2])) {
      response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
      response.end();
      return;
    }
    if (match[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), end);
    } else {
      start = Math.max(0, size - Number(match[2]));
      if (Number(match[2]) === 0) start = size;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
      response.end();
      return;
    }
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  response.writeHead(range ? 206 : 200, { ...headers, 'Content-Length': Math.max(0, end - start + 1) });
  if (!size) { response.end(); return; }
  try {
    await pipeline(createReadStream(file, { start, end }), response);
  } catch (error) {
    if (!response.headersSent) throw error;
    response.destroy();
  }
}
