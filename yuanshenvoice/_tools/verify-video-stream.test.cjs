'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bytes = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
const asset = { bytes:bytes.length, sha256:'reviewed-video', parts:[0,10,20,30].map((start,index)=>({path:`/${index}.bin`,start,bytes:Math.min(10,bytes.length-start)})) };
async function fixture({ignoreRange=false, fail=false,contentType}={}) {
  const {serveVideo}=await import('./video-response.mjs');
  const calls=[];
  const fetchChunk=async(path,headers)=>{
    calls.push({path,headers}); if(fail)return new Response(null,{status:404});
    const part=asset.parts.find(part=>part.path===path);
    let data=bytes.subarray(part.start,part.start+part.bytes),status=200;
    if(!ignoreRange){const [,start,end]=/bytes=(\d+)-(\d+)/.exec(headers.Range);data=data.subarray(Number(start),Number(end)+1);status=206;}
    return new Response(data,{status});
  };
  return {calls,request:(headers={},method='GET')=>serveVideo(new Request('https://example.test/media',{headers,method}),{...asset,contentType},fetchChunk)};
}

test('FLAC audio retains its media type and supports seek ranges across chunks',async()=>{
  const f=await fixture({contentType:'audio/flac'}),response=await f.request({Range:'bytes=8-22'});
  assert.equal(response.status,206);assert.equal(response.headers.get('Content-Type'),'audio/flac');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(8,23));
  const head=await f.request({},'HEAD');assert.equal(head.headers.get('Content-Type'),'audio/flac');assert.equal(head.headers.get('Content-Length'),String(bytes.length));
});
test('chunk delivery preserves the complete original and cross-chunk ranges',async()=>{
  const f=await fixture(), full=await f.request();assert.equal(full.status,200);assert.equal(full.headers.get('Content-Length'),String(bytes.length));assert.deepEqual(Buffer.from(await full.arrayBuffer()),bytes);
  for(const [range,start,end] of [['bytes=8-22',8,23],['bytes=-5',31,36],['bytes=30-',30,36]]){
    const response=await f.request({Range:range});assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),`bytes ${start}-${end-1}/${bytes.length}`);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(start,end));
  }
});
test('HEAD, cache hits and invalid ranges do not fetch any chunks',async()=>{
  const f=await fixture();assert.equal((await f.request({},'HEAD')).status,200);
  assert.equal((await f.request({'If-None-Match':'"reviewed-video"'})).status,304);
  for(const range of ['bytes=999-','bytes=-0','bytes=10-3','bytes=0-1,4-6'])assert.equal((await f.request({Range:range})).status,416);
  assert.equal(f.calls.length,0);
});
test('servers ignoring chunk Range still return the exact requested bytes',async()=>{
  const f=await fixture({ignoreRange:true}),response=await f.request({Range:'bytes=8-22'});
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(8,23));
});
test('stale If-Range requests receive the complete reviewed video',async()=>{
  const f=await fixture(),response=await f.request({Range:'bytes=8-22','If-Range':'"old-version"'});
  assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
});
test('missing chunks fail before a video response is accepted',async()=>{
  const f=await fixture({fail:true});assert.equal((await f.request()).status,502);
});
