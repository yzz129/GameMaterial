import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {readJSON,writeJSON,inspectGame,localPath,validateConfig} from '../engine/config.mjs';
import {prepareGame} from '../engine/prepare.mjs';
import {buildGame} from '../engine/build.mjs';
import {addGame} from '../engine/scaffold.mjs';
import {serveMusicStream} from '../engine/node/music-stream.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const {createGameServer}=require('../engine/node/server.cjs');
const modelContext=vm.createContext({});
vm.runInContext(await fs.readFile(path.join(root,'engine/client/model.js'),'utf8'),modelContext);
const {normalizeDetails}=modelContext.ArchiveModel;

test('both production games retain all character, dialogue and music records',async()=>{
  const registry=await readJSON(path.join(root,'games.json'));
  const expected={yuanshen:[97,7342,1105],wangzhe:[133,18159,1349]};
  const namespaces=new Set(),ports=new Set();
  for(const game of registry.games){
    const data=await inspectGame(localPath(root,game.directory));
    if(expected[game.id])assert.deepEqual([data.catalog.length,data.voices,data.music.tracks.length],expected[game.id]);
    assert(!namespaces.has(data.config.storage.namespace),'storage namespace collision');namespaces.add(data.config.storage.namespace);
    assert(!ports.has(data.config.server.port),'port collision');ports.add(data.config.server.port);
    for(const character of data.catalog){
      const detail=normalizeDetails(await readJSON(localPath(path.join(root,game.directory),`${data.config.data.characters}/${character.id}.json`)));
      const lines=[...detail.friendLines,...detail.actionLines];assert.equal(new Set(lines.map(line=>line.key)).size,lines.length);
    }
  }
});

test('generated interfaces have one authoritative shared source',async()=>{
  for(const file of ['app.js','model.js','audio-autoplay.js','styles.css','search-worker.js']){
    const shared=await fs.readFile(path.join(root,'engine/client',file));
    for(const game of ['yuanshenvoice','wangzhevoice'])assert.deepEqual(await fs.readFile(path.join(root,game,file)),shared,`${game}/${file}`);
  }
  const source=await fs.readFile(path.join(root,'engine/client/app.js'),'utf8');
  assert.doesNotMatch(source,/WANGZHE_DATA|10000073|10000001|TEYVAT_0|提瓦特|纳西妲|派蒙|蒙德|璃月|王者荣耀/);
});

test('production games share layout styles while owning their brand assets and fonts',async()=>{
  const genshin=await readJSON(path.join(root,'yuanshenvoice/game.config.json'));
  const honor=await readJSON(path.join(root,'wangzhevoice/game.config.json'));
  assert.deepEqual(honor.styles,genshin.styles,'game layouts must use the same component stylesheet stack');
  const html=await fs.readFile(path.join(root,'wangzhevoice/index.html'),'utf8');
  assert.doesNotMatch(html,/wangzhe(?:-refinement)?\.css/,'retired layout overrides must not be loaded');
  assert.notEqual(honor.assets.font,genshin.assets.font);
  assert.notEqual(honor.assets.logo,genshin.assets.logo);
  const css=await fs.readFile(path.join(root,'wangzhevoice/theme.generated.css'),'utf8');
  for(const field of ['font','fontBold','fontFallback']){
    const bytes=await fs.readFile(localPath(path.join(root,'wangzhevoice'),honor.assets[field]));
    assert.match(bytes.toString('ascii',0,4),/^wOF[F2]$/);
    assert(css.includes(honor.assets[field]),`${field} must be registered in the generated theme`);
  }
  assert.equal(honor.home.artMode,'illustration');
});

test('repeated source titles get distinct keys without breaking the first legacy favorite',()=>{
  const raw={friendLines:[{title:'问候',desc:'a'},{title:'问候',desc:'b'}],actionLines:[{title:'问候',desc:'c'}]};
  const normalized=normalizeDetails(raw);
  assert.deepEqual(Array.from([...normalized.friendLines,...normalized.actionLines],line=>line.key),['问候','问候#2','问候#3']);
  assert.equal(raw.friendLines[0].key,undefined);
  const collision=normalizeDetails({friendLines:[{title:'问候'},{title:'问候'},{title:'显式语音',key:'问候#2'}],actionLines:[]});
  assert.equal(new Set(collision.friendLines.map(line=>line.key)).size,3);
});

test('HTTP serves both games, seeks real media and keeps source/configuration private',async t=>{
  for(const directory of ['yuanshenvoice','wangzhevoice']){
    const server=createGameServer(path.join(root,directory));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const file of ['/','/site-config.js','/model.js','/app.js','/styles.css','/dialog.css','/theme.generated.css','/theme.css','/data/voice-search-index.json','/voice_index'])assert.equal((await fetch(base+file)).status,200,file);
    const file='/assets/video/TEYVAT_03_VID_windrise-pc_jimeng-2k_v1.mp4';
    const response=await fetch(base+file,{headers:{Range:'bytes=0-127'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,128);
    assert.equal((await fetch(base+file,{headers:{Range:'bytes=-0'}})).status,416);
    const head=await fetch(base+'/app.js',{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
    assert.equal((await fetch(base+'/app.js',{headers:{'If-None-Match':head.headers.get('etag')}})).status,304);
    for(const privateFile of ['/game.config.json','/site-public.json','/package.json','/server.js','/scripts/prepare-data.mjs','/assets/masters/hidden.png'])assert.equal((await fetch(base+privateFile)).status,404,privateFile);
    assert.equal((await fetch(base+'/assets/%2e%2e%2f%2e%2e%2fREADME.md')).status,403);
  }
});

test('a third game needs only configuration and data; its build is independent',async t=>{
  const workspace=await fs.mkdtemp(path.join(os.tmpdir(),'archive-third-game-'));
  t.after(()=>fs.rm(workspace,{recursive:true,force:true}));
  await writeJSON(path.join(workspace,'games.json'),{schemaVersion:1,games:[]});
  await addGame(workspace,{id:'starfield-test',name:'星界试验',port:18082});
  const directory=path.join(workspace,'starfield-testvoice');
  const config=await readJSON(path.join(directory,'game.config.json'));
  config.brand.shortName='新的主题';config.home.titleLines=['独立世界','专属声音'];config.theme.dark['--gold']='#ff5500';
  await writeJSON(path.join(directory,'game.config.json'),config);
  await prepareGame(directory);
  const result=await buildGame(directory);
  assert.match(await fs.readFile(path.join(result.output,'index.html'),'utf8'),/site-config\.js/);
  const context=vm.createContext({document:{documentElement:{dataset:{}}},localStorage:{getItem:()=>null}});context.window=context;
  vm.runInContext(await fs.readFile(path.join(result.output,'site-config.js'),'utf8'),context);
  assert.equal(context.GAME_CONFIG.brand.shortName,'新的主题');assert.equal(context.GAME_CONFIG.home.titleLines[0],'独立世界');
  assert.equal(context.GAME_CONFIG.music.initialTracks.length,0);
  assert.match(await fs.readFile(path.join(result.output,'theme.generated.css'),'utf8'),/--gold:#ff5500/);
  assert.deepEqual(await fs.readFile(path.join(result.output,'app.js')),await fs.readFile(path.join(root,'engine/client/app.js')));
  await assert.rejects(fs.access(path.join(result.output,'game.config.json')));
  await assert.rejects(addGame(workspace,{id:'starfield-test',name:'覆盖'}),/已经存在/);
  await assert.rejects(addGame(workspace,{id:'other-test',name:'端口冲突',port:18082}),/端口/);
  assert.throws(()=>localPath(workspace,'../outside'),/越界/);
  assert.throws(()=>validateConfig({...config,server:{port:99999}}),/server.port/);
});

test('music proxy uses catalog IDs and configured origin boundaries',async()=>{
  const tracks={demo:'https://audio.example.com/music/demo.mp3'};
  let called=0;
  const upstream=async()=>{called++;return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}})};
  const request=new Request('http://localhost/api/music-stream?id=demo');
  assert.equal((await serveMusicStream(request,tracks,upstream,[])).status,400);
  const response=await serveMusicStream(request,tracks,upstream,[{origin:'https://audio.example.com',pathPrefix:'/music/'}]);
  assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,3);assert.equal(called,1);
  assert.equal((await serveMusicStream(new Request('http://localhost/api/music-stream?id=unknown'),tracks,upstream)).status,404);
});
