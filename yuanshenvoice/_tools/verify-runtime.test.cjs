'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const crypto=require('node:crypto');
const {createStaticServer}=require('../server');
let server,port;
before(async()=>{server=createStaticServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port});
after(()=>new Promise(resolve=>server.close(resolve)));
function request(url,headers={},method='GET'){return new Promise((resolve,reject)=>{http.request({host:'127.0.0.1',port,path:url,headers,method},r=>{const chunks=[];r.on('data',c=>chunks.push(c));r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body:Buffer.concat(chunks)}))}).on('error',reject).end()})}
test('compressed catalogs and search return the complete original content',async()=>{for(const file of ['data/catalog.json','data/search-index.json','assets/audio/music/music_catalog.json']){const r=await request('/'+file,{'Accept-Encoding':'br,gzip'});assert.equal(r.status,200);assert.equal(r.headers['content-encoding'],'br');assert.deepEqual(zlib.brotliDecompressSync(r.body),fs.readFileSync(path.resolve(__dirname,'..',file)))}});

test('every referenced public illustration, music file, font and character route serves successfully',async()=>{
  const paths=new Set(['index.html','voice_index.html','nahida_player.html','assets/icons/ui.svg']);
  const root=path.resolve(__dirname,'..');
  const visit=value=>{if(typeof value==='string'&&/^\/?(?:assets\/|raw\/)/.test(value))paths.add(value.replace(/^\//,''));else if(value&&typeof value==='object')Object.values(value).forEach(visit)};
  for(const character of require('../data/catalog.json')){
    for(const key of ['avatarImg','cardArt','splashArt','fullArt'])if(character[key])paths.add(character[key]);
    paths.add(`data/characters/${character.id}.json`);
    const detail=require(`../data/characters/${character.id}.json`);
    for(const quote of [...detail.friendLines,...detail.actionLines])if(quote.localAudio)paths.add(quote.localAudio.replace(/^\//,''));
  }
  visit(require('../assets/audio/music/music_catalog.json'));
  for(const asset of require('../assets/manifest.json').assets)paths.add(asset.file);
  const queue=[...paths];
  await Promise.all(Array.from({length:8},async()=>{for(let file;(file=queue.pop());){
    const result=await request('/'+file.split('/').map(encodeURIComponent).join('/'),{},'HEAD');
    assert.equal(result.status,200,file);assert.equal(result.body.length,0,file);
    assert.equal(Number(result.headers['content-length']),fs.statSync(path.join(root,file)).size,file);
  }}));
});

test('every literal UI icon points at an existing SVG symbol',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),svg=fs.readFileSync(path.resolve(__dirname,'../assets/icons/ui.svg'),'utf8');
  const symbols=new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
  for(const match of source.matchAll(/\bicon\('([^']+)'/g))assert(symbols.has(match[1]),match[1]);
});
test('cache revalidation, HEAD, disabled encoding and byte ranges',async()=>{const file='/assets/characters/10000073-card.webp',first=await request(file);assert.equal(first.status,200);assert.match(first.headers['cache-control'],/max-age/);assert.equal((await request(file,{'If-None-Match':first.headers.etag})).status,304);const head=await request(file,{},'HEAD');assert.equal(head.body.length,0);assert.equal(Number(head.headers['content-length']),first.body.length);const range=await request(file,{Range:'bytes=12-41'});assert.equal(range.status,206);assert.deepEqual(range.body,first.body.subarray(12,42));assert.equal((await request(file,{Range:'bytes=99999999-'})).status,416);assert.equal((await request('/app.js',{'Accept-Encoding':'br;q=0,gzip;q=0'})).headers['content-encoding'],undefined)});
test('compression honors explicit exclusions and client quality preferences',async()=>{
  assert.equal((await request('/data/catalog.json',{'Accept-Encoding':'br;q=0, *;q=1'})).headers['content-encoding'],'gzip');
  assert.equal((await request('/data/catalog.json',{'Accept-Encoding':'br;q=0.2, gzip;q=1'})).headers['content-encoding'],'gzip');
  assert.equal((await request('/data/catalog.json',{'If-None-Match':'*'})).status,304);
});
test('stale partial-download validators return a complete file instead of mixing versions',async()=>{
  const file='/assets/characters/10000073-card.webp',first=await request(file);
  const stale=await request(file,{Range:'bytes=0-127','If-Range':'"old-version"'});
  assert.equal(stale.status,200);assert.deepEqual(stale.body,first.body);
  const fresh=await request(file,{Range:'bytes=0-127','If-Range':first.headers['last-modified']});
  assert.equal(fresh.status,206);assert.deepEqual(fresh.body,first.body.subarray(0,128));
  assert.equal((await request(file,{Range:'bytes=-0'})).status,416);
});
test('favicon route serves the user-provided Paimon icon in ICO format',async()=>{const r=await request('/favicon.ico');assert.equal(r.status,200);assert.equal(r.headers['content-type'],'image/x-icon');assert.equal(r.body.readUInt16LE(0),0);assert.equal(r.body.readUInt16LE(2),1);assert.equal(r.body.readUInt16LE(4),1);assert(r.body.subarray(22,26).equals(Buffer.from([40,0,0,0])))});
test('malformed paths and private source files are not served',async()=>{assert.equal((await request('/%zz')).status,400);assert.equal((await request('/%2e%2e/package.json')).status,403);for(const url of ['/_backups/2026-10-22/index.html','/node_modules/genshin-db/package.json','/assets/masters/official-app.js','/server.js'])assert.equal((await request(url)).status,404);assert.equal((await request('/',{},'POST')).status,405)});
test('every character has local artwork, valid counts and no missing local audio',()=>{const catalog=require('../data/catalog.json');assert.equal(catalog.length,97);assert.equal(catalog.reduce((n,c)=>n+c.quoteCount,0),7342);const ids=new Set();for(const c of catalog){assert(!ids.has(c.id));ids.add(c.id);for(const file of [c.avatarImg,c.cardArt,c.splashArt])assert(fs.existsSync(path.resolve(__dirname,'..',file)),file);const d=require(`../data/characters/${c.id}.json`);assert.equal(d.friendLines.length+d.actionLines.length,c.quoteCount);for(const q of [...d.friendLines,...d.actionLines])if(q.localAudio)assert(fs.existsSync(path.resolve(__dirname,'..',q.localAudio)),q.localAudio)}assert.equal(require('../data/nahida-index.json').length,1814)});
test('search index preserves distinctive full-text quotes',()=>{const index=require('../data/search-index.json'),original=require('../teyvat_characters.json');for(const needle of ['天动万象','手拉手','晚安','审判']){const expected=original.filter(c=>[c.name,c.enName,c.title,...Object.values(c.cv),...c.friendLines.flatMap(q=>[q.title,q.desc]),...c.actionLines.flatMap(q=>[q.title,q.desc])].join('\n').toLowerCase().includes(needle)).map(c=>c.id);assert.deepEqual(index.filter(c=>c.text.includes(needle)).map(c=>c.id),expected)}});
test('runtime asset provenance checksums match the delivered files',()=>{const manifest=require('../assets/manifest.json');const paths=new Set();for(const asset of manifest.assets){assert(!paths.has(asset.file));paths.add(asset.file);assert(asset.source&&asset.purpose&&asset.license);const bytes=fs.readFileSync(path.resolve(__dirname,'..',asset.file));assert.equal(bytes.length,asset.bytes,asset.file);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.file)}});
test('background video supports streaming ranges and exactly preserves the reviewed master',async()=>{
  for(const channel of ['pc','mobile']){
  const name=`TEYVAT_03_VID_windrise-${channel}_jimeng-2k_v1.mp4`;
  const file=`assets/video/${name}`,bytes=fs.readFileSync(path.resolve(__dirname,'..',file));
  const master=fs.readFileSync(path.resolve(__dirname,'../assets/masters/video',name));
  assert.deepEqual(bytes,master);assert.equal(bytes.subarray(4,8).toString(),'ftyp');
  const head=await request('/'+file,{},'HEAD');assert.equal(head.status,200);assert.equal(head.headers['content-type'],'video/mp4');assert.equal(Number(head.headers['content-length']),bytes.length);
  const range=await request('/'+file,{Range:'bytes=0-127'});assert.equal(range.status,206);assert.deepEqual(range.body,bytes.subarray(0,128));
  const tail=await request('/'+file,{Range:'bytes=-128'});assert.equal(tail.status,206);assert.deepEqual(tail.body,bytes.subarray(-128));
  assert.equal((await request('/assets/masters/video/'+name)).status,404);
  }
});
