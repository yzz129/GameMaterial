'use strict';
const {test,before}=require('node:test');
const assert=require('node:assert/strict');
let serveMusicStream;
const source='https://archive.org/download/genshin-impact-music-collection/album/example.mp3';
const tracks={'ost-809':source};
before(async()=>{({serveMusicStream}=await import('./music-stream.mjs'))});

test('same-origin music proxy forwards byte ranges and preserves the audio response',async()=>{
  const bytes=Buffer.from('ID3-original-music-bytes');
  let called;
  const response=await serveMusicStream(new Request('https://genshin.yzzwnw.asia/api/music-stream?id=ost-809',{headers:{Range:'bytes=0-7','If-Range':'"original"'}}),tracks,async(url,options)=>{
    called={url,options};return new Response(bytes.subarray(0,8),{status:206,headers:{'Content-Type':'audio/mpeg','Content-Length':'8','Content-Range':`bytes 0-7/${bytes.length}`,ETag:'"original"'}});
  });
  assert.equal(called.url,source);assert.equal(called.options.headers.get('Range'),'bytes=0-7');assert.equal(called.options.headers.get('If-Range'),'"original"');
  assert.equal(response.status,206);assert.equal(response.headers.get('Content-Type'),'audio/mpeg');assert.equal(response.headers.get('Content-Range'),`bytes 0-7/${bytes.length}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(0,8));
});

test('HEAD and cache revalidation retain upstream metadata without downloading a body',async()=>{
  const head=await serveMusicStream(new Request('https://example.com/api/music-stream?id=ost-809',{method:'HEAD'}),tracks,async(url,options)=>{
    assert.equal(options.method,'HEAD');return new Response(null,{headers:{'Content-Type':'audio/mpeg','Content-Length':'6599919'}});
  });
  assert.equal(head.status,200);assert.equal(head.headers.get('Content-Length'),'6599919');assert.equal(head.body,null);
  const cached=await serveMusicStream(new Request('https://example.com/api/music-stream?id=ost-809',{headers:{'If-None-Match':'"same"'}}),tracks,async(url,options)=>{
    assert.equal(options.headers.get('If-None-Match'),'"same"');return new Response(null,{status:304,headers:{ETag:'"same"'}});
  });
  assert.equal(cached.status,304);assert.equal(cached.body,null);
});

test('unknown IDs and arbitrary source URLs never become an open proxy',async()=>{
  const unreachable=()=>{throw Error('Must not contact upstream')};
  for(const id of ['missing','__proto__','constructor'])assert.equal((await serveMusicStream(new Request('https://example.com/api/music-stream?id='+id),tracks,unreachable)).status,404);
  assert.equal((await serveMusicStream(new Request('https://example.com/api/music-stream?id=ost-809'),{'ost-809':'https://example.com/private.mp3'},unreachable)).status,400);
  assert.equal((await serveMusicStream(new Request('https://example.com/api/music-stream?id=ost-809',{method:'POST'}),tracks,unreachable)).status,405);
});

test('upstream failures and HTML error pages produce a retryable error without caching it',async()=>{
  const request=()=>new Request('https://example.com/api/music-stream?id=ost-809');
  for(const fetcher of [async()=>{throw Error('Network unavailable')},async()=>new Response('error',{status:503}),async()=>new Response('<html>error</html>',{headers:{'Content-Type':'text/html'}})]){
    const response=await serveMusicStream(request(),tracks,fetcher);
    assert.equal(response.status,502);assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
});

test('changing tracks cancels the upstream request stream',async()=>{
  const controller=new AbortController();let upstreamSignal;
  const response=await serveMusicStream(new Request('https://example.com/api/music-stream?id=ost-809',{signal:controller.signal}),tracks,async(url,options)=>{upstreamSignal=options.signal;return new Response(new ReadableStream({pull(){}}),{headers:{'Content-Type':'audio/mpeg'}})});
  controller.abort();assert.equal(upstreamSignal.aborted,true);
  await response.body.cancel();
});

test('completed streams release abort ownership and cancelled downloads release the upstream body',async()=>{
  const controller=new AbortController();let signal,cancelled=false;
  const request=()=>new Request('https://example.com/api/music-stream?id=ost-809',{signal:controller.signal});
  const response=await serveMusicStream(request(),tracks,async(url,options)=>{signal=options.signal;return new Response('ID3-original',{headers:{'Content-Type':'audio/mpeg'}})});
  assert.equal(await response.text(),'ID3-original');controller.abort();assert.equal(signal.aborted,false);
  const cancelledResponse=await serveMusicStream(new Request('https://example.com/api/music-stream?id=ost-809'),tracks,async(url,options)=>{signal=options.signal;return new Response(new ReadableStream({pull(){},cancel(){cancelled=true}}),{headers:{'Content-Type':'audio/mpeg'}})});
  await cancelledResponse.body.cancel();assert(signal.aborted);assert(cancelled);
});

test('already cancelled requests and malformed catalog sources do not start an upstream connection',async()=>{
  const controller=new AbortController();controller.abort();
  const unreachable=()=>{throw Error('Must not contact upstream')};
  assert.equal((await serveMusicStream(new Request('https://example.com/api/music-stream?id=ost-809',{signal:controller.signal}),tracks,unreachable)).status,499);
  assert.equal((await serveMusicStream(new Request('https://example.com/api/music-stream?id=ost-809'),{'ost-809':'invalid-url'},unreachable)).status,400);
});
