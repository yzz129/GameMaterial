'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'cloudflare-dist');
const media=JSON.parse(fs.readFileSync(path.join(dist,'assets/media-index.json')));

test('production bundle uses the latest workspace source and includes all local music references',()=>{
  for(const file of ['app.js','styles.css','index.html','nahida_player.html','voice_index.html'])assert(fs.readFileSync(path.join(dist,file)).equals(fs.readFileSync(path.join(root,file))),file);
  for(const file of ['app.js','styles.css']){
    const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,file))).digest('hex').slice(0,12);
    for(const html of ['index.html','nahida_player.html','voice_index.html'])assert(fs.readFileSync(path.join(dist,html),'utf8').includes(`${file}?v=${hash}`));
  }
  assert(fs.readFileSync(path.join(dist,'_headers'),'utf8').includes('/app.js\n  Cache-Control: no-cache'));
  const urls=new Set();
  function visit(value){if(typeof value==='string'&&/^\/?assets\/audio\//.test(value))urls.add(value.replace(/^\//,''));else if(value&&typeof value==='object')Object.values(value).forEach(visit)}
  visit(JSON.parse(fs.readFileSync(path.join(root,'assets/audio/music/music_catalog.json'))));
  for(const [,url] of fs.readFileSync(path.join(root,'app.js'),'utf8').matchAll(/['"](assets\/audio\/[^'"\s]+)['"]/g))urls.add(url);
  assert(urls.size>=22);
  for(const url of urls)assert(fs.existsSync(path.join(dist,url))||media['/'+url],url);
});

test('music proxy is a production worker route backed by the complete curated catalog',()=>{
  const routes=JSON.parse(fs.readFileSync(path.join(dist,'_routes.json'))).include;
  assert(routes.includes('/api/music-stream'));
  const worker=fs.readFileSync(path.join(dist,'_worker.js'),'utf8');
  assert.match(worker,/serveMusicStream\(request,musicSources\)/);
  const match=/const musicSources=(.*);\nexport default/.exec(worker);
  assert(match);const sources=JSON.parse(match[1]);
  for(const track of require('../assets/audio/music/music_catalog.json').tracks)assert.equal(sources[track.id],track.streamUrl);
});

test('oversized FLAC and video chunks reconstruct the exact original bytes',()=>{
  assert(Object.values(media).some(a=>a.contentType==='audio/flac'));
  for(const [url,asset] of Object.entries(media)){
    const hash=crypto.createHash('sha256');let size=0;
    for(const part of asset.parts){const bytes=fs.readFileSync(path.join(dist,part.path));assert.equal(part.start,size);assert.equal(bytes.length,part.bytes);assert(bytes.length<=25*1024*1024);hash.update(bytes);size+=bytes.length}
    assert.equal(size,asset.bytes);assert.equal(hash.digest('hex'),asset.sha256,url);
    const original=fs.readFileSync(path.join(root,url));assert.equal(original.length,size);assert.equal(crypto.createHash('sha256').update(original).digest('hex'),asset.sha256);
  }
});

test('all audio files have a public asset or worker route and the correct MIME header',()=>{
  const headers=fs.readFileSync(path.join(dist,'_headers'),'utf8'),routes=JSON.parse(fs.readFileSync(path.join(dist,'_routes.json'))).include;
  const folder=path.join(root,'assets/audio/music');
  for(const file of fs.readdirSync(folder).filter(f=>/\.(mp3|flac)$/i.test(f))){
    const url='/assets/audio/music/'+file;
    assert(headers.includes(url+'\n  Content-Type: '+(file.endsWith('.flac')?'audio/flac':'audio/mpeg')));
    if(media[url])assert(routes.includes(url));else assert(fs.readFileSync(path.join(dist,url)).equals(fs.readFileSync(path.join(root,url))),url);
  }
});
