// Only stream files from the checked-in soundtrack catalog. No arbitrary URLs.
export async function serveMusicStream(request, tracks, fetchUpstream = fetch, allowedSources = []) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status:405, headers:{Allow:'GET, HEAD'} });
  const id = new URL(request.url).searchParams.get('id');
  const source = Object.hasOwn(tracks, id || '') ? tracks[id] : null;
  if (!source) return new Response('Unknown soundtrack', { status:404 });
  let url;
  try { url=new URL(source); } catch { return new Response('Invalid soundtrack source', {status:400}); }
  if (url.protocol !== 'https:' || !allowedSources.some(rule => url.origin === rule.origin && url.pathname.startsWith(rule.pathPrefix))) return new Response('Invalid soundtrack source', { status:400 });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if(request.signal.aborted)return new Response('Soundtrack request cancelled',{status:499,headers:{'Cache-Control':'no-store'}});
  request.signal.addEventListener('abort', cancel, {once:true});
  const cleanup=()=>request.signal.removeEventListener('abort',cancel);
  let streaming=false;
  const timeout = setTimeout(cancel, 18000);
  try {
    const headers = new Headers();
    for (const key of ['Range', 'If-Range', 'If-None-Match']) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    const upstream = await fetchUpstream(url.href, {method:request.method,headers,signal:controller.signal,redirect:'follow'});
    if (![200, 206, 304, 416].includes(upstream.status)) {
      await upstream.body?.cancel();
      return new Response('Soundtrack temporarily unavailable', {status:502,headers:{'Cache-Control':'no-store'}});
    }
    const type = upstream.headers.get('Content-Type') || 'audio/mpeg';
    if ([200,206].includes(upstream.status) && !/^(audio\/|application\/octet-stream)/i.test(type)) {
      await upstream.body?.cancel();
      return new Response('Invalid soundtrack response', {status:502,headers:{'Cache-Control':'no-store'}});
    }
    const responseHeaders = new Headers({'Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Cache-Control':'public, max-age=86400, must-revalidate','X-Content-Type-Options':'nosniff'});
    for (const key of ['Content-Length', 'Content-Range', 'ETag', 'Last-Modified']) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    let body=null;
    if(request.method!=='HEAD' && upstream.body){
      const reader=upstream.body.getReader();
      body=new ReadableStream({
        async pull(output){
          try { const next=await reader.read();if(next.done){cleanup();output.close()}else output.enqueue(next.value); }
          catch(error){cleanup();output.error(error)}
        },
        async cancel(reason){cancel();try{await reader.cancel(reason)}finally{cleanup()}}
      });
      streaming=true;
    }
    return new Response(body, {status:upstream.status,headers:responseHeaders});
  } catch {
    return new Response('Soundtrack connection failed', {status:502,headers:{'Cache-Control':'no-store'}});
  } finally {
    clearTimeout(timeout);
    // Keep cancellation alive only while the response body still owns a stream.
    if (!streaming) cleanup();
  }
}
