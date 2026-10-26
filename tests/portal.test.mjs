import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {addGame} from '../engine/scaffold.mjs';
import {prepareGame} from '../engine/prepare.mjs';
import {buildPortal,portalGames} from '../engine/portal.mjs';
import {createPortalServer} from '../engine/portal-server.mjs';
import {readJSON,writeJSON} from '../engine/config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({});vm.runInContext(await fs.readFile(path.join(root,'engine/client/model.js'),'utf8'),context);

test('game media keeps its own prefix without changing remote sources or double-prefixing',()=>{
  const input={cover:'/assets/cover.webp',friendLines:[{audioUrl:'/assets/audio/a.mp3'}],tracks:[{localUrl:'/assets/a.flac',streamUrl:'https://archive.org/music.mp3',proxyUrl:'/api/music-stream?id=x'}],sourceUrl:'https://official.example/hero'};
  const scoped=context.ArchiveModel.normalizeMedia(input,'/custom-game/');
  assert.equal(scoped.cover,'/custom-game/assets/cover.webp');assert.equal(scoped.friendLines[0].audioUrl,'/custom-game/assets/audio/a.mp3');
  assert.equal(scoped.tracks[0].localUrl,'/custom-game/assets/a.flac');assert.equal(scoped.tracks[0].proxyUrl,'/custom-game/api/music-stream?id=x');
  assert.equal(scoped.tracks[0].streamUrl,input.tracks[0].streamUrl);assert.equal(scoped.sourceUrl,input.sourceUrl);
  assert.equal(context.ArchiveModel.normalizeMedia(scoped,'/custom-game/').cover,scoped.cover);
  assert.equal(input.cover,'/assets/cover.webp');
});

test('the published portal contains both registered English game routes',async()=>{
  const games=await portalGames(root);
  assert.equal(games.find(game=>game.id==='yuanshen').basePath,'/genshin/');
  assert.equal(games.find(game=>game.id==='wangzhe').basePath,'/honor-of-kings/');
  assert(games.find(game=>game.id==='yuanshen').search.includes('派蒙'));
  assert(games.find(game=>game.id==='wangzhe').search.includes('李白'));
});

test('a newly registered game builds under its English path and streams chunks independently',async t=>{
  const workspace=await fs.mkdtemp(path.join(os.tmpdir(),'archive-portal-'));
  t.after(()=>fs.rm(workspace,{recursive:true,force:true}));
  await fs.mkdir(path.join(workspace,'portal'));
  for(const file of ['index.html','portal.css','portal.js','portal-motion.js','mark.svg'])await fs.copyFile(path.join(root,'portal',file),path.join(workspace,'portal',file));
  await fs.cp(path.join(root,'portal/assets'),path.join(workspace,'portal/assets'),{recursive:true});
  await writeJSON(path.join(workspace,'games.json'),{schemaVersion:1,games:[]});
  const titleArt=(await readJSON(path.join(root,'portal.config.json'))).titleArt;
  await writeJSON(path.join(workspace,'portal.config.json'),{schemaVersion:1,domain:'portal.example',output:'portal-dist',name:'门户测试',englishName:'ARCHIVE',title:'门户测试',heading:'新世界的声音',titleArt,description:'跨游戏门户',tagline:'独立的游戏档案'});
  await addGame(workspace,{id:'source-game',name:'新世界',port:18082});
  const registry=await readJSON(path.join(workspace,'games.json'));registry.games[0].slug='another-world';await writeJSON(path.join(workspace,'games.json'),registry);
  const directory=path.join(workspace,'source-gamevoice'),game=await readJSON(path.join(directory,'game.config.json'));
  const original=await fs.readFile(path.join(directory,'site-config.js'));
  const media=Buffer.alloc(26*1024*1024,77);media.write('ID3');
  await fs.mkdir(path.join(directory,'assets/audio'),{recursive:true});await fs.writeFile(path.join(directory,'assets/audio/test.mp3'),media);
  await writeJSON(path.join(directory,game.data.music),{tracks:[{id:'fixture-audio',title:'测试原声',localUrl:'/assets/audio/test.mp3',isLocal:true,playable:true,cover:'assets/placeholder.svg'}]});
  const result=await buildPortal(workspace);
  assert.deepEqual(await fs.readFile(path.join(directory,'site-config.js')),original,'portal build must not overwrite standalone output');
  const html=await fs.readFile(path.join(result.output,'index.html'),'utf8');assert.match(html,/href="\/another-world\/"/);assert.doesNotMatch(html,/\/genshin\//);
  assert.match(html,/新世界的声音/);assert.doesNotMatch(html,/data-title-motion/,'changed headings must use live text instead of stale artwork');
  const scoped=await fs.readFile(path.join(result.output,'another-world/index.html'),'utf8');assert.match(scoped,/<base href="\/another-world\/">/);
  for(const privateFile of ['game.config.json','site-public.json','.archive-build.json','_worker.js'])await assert.rejects(fs.access(path.join(result.output,'another-world',privateFile)));
  assert.equal(result.mediaFiles,1);
  const server=await createPortalServer(result.output);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve))});
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/')).status,200);
  for(const file of ['PORTAL_01_BG_nebula_v1.webp','PORTAL_01_BG_nebula-mobile_v1.webp']){
    const background=await fetch(base+'/portal-assets/'+file);assert.equal(background.status,200);
    assert.match(background.headers.get('content-type'),/^image\/webp/);
    assert.deepEqual(Buffer.from(await background.arrayBuffer()),await fs.readFile(path.join(root,'portal/assets',file)));
  }
  await assert.rejects(fs.access(path.join(result.output,'portal-assets','masters')));
  const redirect=await fetch(base+'/another-world?x=1',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(new URL(redirect.headers.get('location')).pathname,'/another-world/');
  const home=await fetch(base+'/another-world/');assert.equal(home.status,200);assert.match(await home.text(),/新世界/);
  for(const file of ['site-config.js','app.js','model.js','styles.css','theme.css','data/catalog.json','data/voice-search-index.json','assets/placeholder.svg'])assert.equal((await fetch(`${base}/another-world/${file}`)).status,200,file);
  const start=24*1024*1024-16,end=start+47;
  const range=await fetch(base+'/another-world/assets/audio/test.mp3',{headers:{Range:`bytes=${start}-${end}`}});
  assert.equal(range.status,206);assert.equal(range.headers.get('content-type'),'audio/mpeg');assert.deepEqual(Buffer.from(await range.arrayBuffer()),media.subarray(start,end+1));
  const head=await fetch(base+'/another-world/assets/audio/test.mp3',{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),media.length);
  for(const file of ['/assets/audio/test.mp3','/another-world/game.config.json','/another-world/.archive-build.json','/_worker.js','/unknown-game/'])assert.equal((await fetch(base+file)).status,404,file);
  const pages=await readJSON(path.join(result.output,'_routes.json'));assert(pages.include.includes('/another-world/assets/audio/test.mp3'));
});
