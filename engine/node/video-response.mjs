// Serve original media bytes from size-limited static chunks without transcoding.
export async function serveVideo(request, asset, fetchChunk) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status:405, headers:{ Allow:'GET, HEAD' } });
  const etag = `"${asset.sha256}"`;
  const headers = new Headers({ 'Content-Type':asset.contentType || 'video/mp4', 'Accept-Ranges':'bytes',
    'Cache-Control':'public, max-age=86400, must-revalidate', 'ETag':etag, 'X-Content-Type-Options':'nosniff' });
  if (request.headers.get('If-None-Match')?.split(',').some(value => value.trim().replace(/^W\//,'') === etag)) {
    return new Response(null, { status:304, headers });
  }
  let start = 0, end = asset.bytes - 1, status = 200;
  const ifRange = request.headers.get('If-Range');
  const range = !ifRange || ifRange === etag ? request.headers.get('Range') : null;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    let valid = Boolean(match && (match[1] || match[2]));
    if (valid) {
      if (!match[1]) start = Math.max(0, asset.bytes - Number(match[2]));
      else start = Number(match[1]);
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      valid = Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < asset.bytes;
    }
    if (!valid) return new Response(null, { status:416, headers:{ 'Content-Range':`bytes */${asset.bytes}`, 'Accept-Ranges':'bytes' } });
    status = 206; headers.set('Content-Range', `bytes ${start}-${end}/${asset.bytes}`);
  }
  headers.set('Content-Length', String(end - start + 1));
  if (request.method === 'HEAD') return new Response(null, { status, headers });
  const spans = asset.parts.filter(part => part.start <= end && part.start + part.bytes > start).map(part => ({
    ...part, from:Math.max(0, start - part.start), to:Math.min(part.bytes - 1, end - part.start),
  }));
  let next = 0, reader, skip = 0, remaining = 0, cancelled = false;
  async function openNext() {
    const part = spans[next++];
    const response = await fetchChunk(part.path, { Range:`bytes=${part.from}-${part.to}` });
    if (!response.ok || !response.body) throw new Error('Video chunk unavailable');
    if (cancelled) { await response.body.cancel(); return; }
    reader = response.body.getReader();
    // Some asset servers ignore Range. Slice their stream without buffering it.
    skip = response.status === 206 ? 0 : part.from;
    remaining = part.to - part.from + 1;
  }
  try { await openNext(); } catch { return new Response('Video unavailable', { status:502 }); }
  const body = new ReadableStream({
    async pull(controller) {
      try {
        while (!cancelled) {
          if (!reader) {
            if (next === spans.length) { controller.close(); return; }
            await openNext(); if (cancelled) return;
          }
          const { value, done } = await reader.read();
          if (done) throw new Error('Incomplete video chunk');
          let offset = Math.min(skip, value.byteLength); skip -= offset;
          if (offset === value.byteLength) continue;
          const count = Math.min(remaining, value.byteLength - offset);
          const bytes = value.subarray(offset, offset + count); remaining -= count;
          if (!remaining) { await reader.cancel(); reader = null; }
          controller.enqueue(bytes); return;
        }
      } catch (error) { await reader?.cancel().catch(()=>{}); controller.error(error); }
    },
    async cancel() { cancelled = true; await reader?.cancel().catch(()=>{}); },
  });
  const responseBody = typeof FixedLengthStream === 'function'
    ? body.pipeThrough(new FixedLengthStream(end - start + 1)) : body;
  return new Response(responseBody, { status, headers });
}
