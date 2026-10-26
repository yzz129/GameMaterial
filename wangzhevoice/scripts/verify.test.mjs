import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {artFingerprint,compareArt,findSimilarArt} from './lib/art-similarity.mjs';
import {createServer} from '../server.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));

test('hero catalog, unique voice records and skin references remain consistent',async()=>{
  const c=await read('data/heroes.json');const ids=new Set();let voices=0;
  assert.equal(c.heroes.length,c.coverage.heroArchives);
  for(const hero of c.heroes){assert(!ids.has(hero.id));ids.add(hero.id);const d=await read(`data/heroes/${hero.id}.json`);assert.equal(d.voices.length,hero.voiceCount);const skins=new Set(d.skins.map(s=>s.id));const vIds=new Set();
    for(const v of d.voices){assert(!vIds.has(v.id));vIds.add(v.id);assert(skins.has(v.skinId));assert(v.text);assert.match(v.url,/^(assets\/|https:\/\/)/);if(v.url.startsWith('assets/'))await fs.access(path.join(root,v.url));}voices+=d.voices.length;
    await fs.access(path.join(root,hero.portrait));await fs.access(path.join(root,hero.cover));
  }
  assert.equal(voices,c.coverage.voiceCount);const search=await read('data/search-index.json');assert.equal(search.entries.length,c.heroes.length);assert(search.entries.every(e=>ids.has(e.heroId)));
});
test('music records separate playable media from platform links',async()=>{const c=await read('data/music.json');const ids=new Set();assert(c.tracks.length>1000);for(const t of c.tracks){assert(!ids.has(t.id));ids.add(t.id);assert(t.title);assert(t.sourceUrl);assert.match(t.sourceUrl,/^https:\/\//);if(t.playable)assert.match(t.url,/^(\/?assets\/|https:\/\/)/);if(/^\/?assets\//.test(t.cover))await fs.access(path.join(root,t.cover));}});
test('adapted original components receive every voice once with stable identity',async()=>{
  const catalog=await read('data/catalog.json'),raw=await read('data/heroes.json');assert.equal(catalog.length,raw.heroes.length);
  for(const hero of catalog){const d=await read(`data/characters/${hero.id}.json`),source=await read(`data/heroes/${hero.id}.json`),lines=[...d.friendLines,...d.actionLines];assert.equal(lines.length,source.voices.length);assert.equal(new Set(lines.map(q=>q.key)).size,source.voices.length);assert.deepEqual(new Set(lines.map(q=>q.key)),new Set(source.voices.map(q=>q.id)));assert(lines.every(q=>q.audioUrl));}
  const adapted=await read('assets/audio/music/music_catalog.json'),music=await read('data/music.json');assert.equal(adapted.tracks.length,music.tracks.length);assert.equal(adapted.tracks.filter(t=>t.src).length,music.coverage.playableTracks);
});
test('motion controllers, CSS timings and runtime media match yuanshenvoice',async()=>{
  const original=await fs.readFile(path.join(root,'shared/teyvat-app.js'),'utf8'),adapted=await fs.readFile(path.join(root,'app.js'),'utf8');
  const blocks=[['function createAtmosphere()','// CSS owns the sparse'],['function createCelestialMotion()','function createProjectionMotion('],['function createProjectionMotion(','// One event owner for the whole grid'],['function createCardMotion(','function detail(']];
  for(const [start,end] of blocks){const extract=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start))).trim();assert.equal(extract(adapted).replaceAll('wangzhe_','teyvat_'),extract(original),start);}
  const sourceCSS=(await fs.readFile(path.join(root,'shared/teyvat-styles.css'),'utf8')).replaceAll('assets/world-desktop.webp','assets/video/TEYVAT_03_BG_windrise-pc_poster_v1.webp').replaceAll('assets/world-mobile.webp','assets/video/TEYVAT_03_BG_windrise-mobile_poster_v1.webp');assert.equal(await fs.readFile(path.join(root,'styles.css'),'utf8'),sourceCSS);
  const manifest=await read('assets/motion-manifest.json');assert.equal(manifest.assets.length,8);for(const asset of manifest.assets){const local=await fs.readFile(path.join(root,asset.file)),source=await fs.readFile(asset.sourceFile);assert.equal(local.length,asset.bytes);assert(local.equals(source),asset.file);}
});
test('character dialog geometry, typography and voice cards come directly from the Genshin stylesheet',async()=>{
  const provenance=await read('docs/dialog-reuse-provenance.json'),source=await fs.readFile(path.join(root,provenance.source)),derived=await fs.readFile(path.join(root,provenance.derived)),runtime=await fs.readFile(path.join(root,'wangzhe-dialog.css'),'utf8'),app=await fs.readFile(path.join(root,'app.js'),'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'),provenance.sourceSha256);assert.equal(createHash('sha256').update(derived).digest('hex'),provenance.derivedSha256);assert(runtime.startsWith(derived.toString()));assert(!app.includes('class="character-dialog voice-gallery"'));assert(!app.includes('<div class="detail-toolbar">'));
  const additions=runtime.slice(derived.toString().length);for(const selector of ['.quote-card','.quote-read','.quote-text','.detail-dossier'])assert(!additions.includes(selector),'Do not restyle original dialog components in the game-specific additions');
});
test('selected skin artwork and full media audit stay consistent',async()=>{
  const catalog=await read('data/catalog.json'),art=await read('data/skin-art.json'),audit=await read('data/audio-audit.json');assert.equal(new Set(art.assets.map(a=>a.id)).size,art.assets.length);const byId=new Map(art.assets.map(a=>[a.id,a]));
  for(const h of catalog)for(const s of h.skins){if(s.art){assert.equal(byId.get(s.id).name,s.name);assert.equal(byId.get(s.id).heroId,String(h.id));await fs.access(path.join(root,s.art));}}
  assert.equal(audit.metadata.voiceMatches,audit.metadata.voiceRecords);assert.equal(audit.metadata.uiMatches,audit.metadata.voiceRecords);assert.equal(audit.metadata.musicMatches,audit.metadata.musicRecords);assert.equal(audit.media.failed,0);assert.equal(audit.issues.length,0);
  const media=await read('data/music-media.json'),adapted=await read('assets/audio/music/music_catalog.json');assert.equal(media.passed,48);for(const record of media.tracks){const track=adapted.tracks.find(t=>t.id===record.id);const measured=`${String(Math.floor(record.duration/60)).padStart(2,'0')}:${String(Math.floor(record.duration%60)).padStart(2,'0')}`;assert.equal(track.duration,measured);}
});
test('every hero uses its native official portrait and each illustrated skin has its own palette',async()=>{
  const manifest=await read('data/hero-art.json'),catalog=await read('data/catalog.json'),raw=await read('data/heroes.json'),skinArt=await read('data/skin-art.json');
  assert.deepEqual(new Set(manifest.assets.map(a=>a.heroId)),new Set(raw.heroes.map(h=>String(h.id))));
  assert.equal(manifest.assets.length,raw.heroes.length);assert.equal(manifest.skins.length,skinArt.assets.length);
  const byHero=new Map(catalog.map(h=>[String(h.id),h])),bySkin=new Map(manifest.skins.map(s=>[s.skinId,s]));
  assert(new Set(manifest.assets.map(a=>a.palette.accent)).size>25);
  for(const art of manifest.assets){
    const hero=byHero.get(art.heroId),bytes=await fs.readFile(path.join(root,art.file)),meta=await sharp(bytes).metadata(),source=await fs.readFile(path.join(root,art.sourceFile));
    assert.equal(hero.cardArt,art.file);if(!hero.fullArtTransparent)assert.equal(hero.fullArt,art.file);
    assert.equal(meta.width,art.sourceWidth);assert.equal(meta.height,art.sourceHeight);assert.equal(meta.width,art.width);assert.equal(meta.height,art.height);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),art.sha256);assert.equal(createHash('sha256').update(source).digest('hex'),art.sourceSha256);
    assert.equal(hero.artAccent,art.palette.accent);assert.equal(hero.artRgb,art.palette.rgb);
    for(const skin of hero.skins)if(skin.art){const direction=bySkin.get(skin.id);assert(direction);assert.equal(String(direction.heroId),art.heroId);assert.deepEqual(skin.artDirection,direction);assert.match(direction.palette.accent,/^#[0-9a-f]{6}$/);}
  }
});
test('hero artwork detects near-identical compositions and keeps Yao and Yun Zhong Jun distinct',async()=>{
  const art=await read('data/hero-art.json'),policy=await read('data/hero-art-sources.json'),catalog=await read('data/catalog.json');
  const fingerprints=await Promise.all(art.assets.map(async a=>({...a,fingerprint:await artFingerprint(path.join(root,a.file))})));
  const duplicates=findSimilarArt(fingerprints,policy.sharedIdentityGroups);assert.deepEqual(duplicates.filter(p=>!p.intentional),[]);assert.equal(art.visualAudit.comparedPairs,catalog.length*(catalog.length-1)/2);assert.deepEqual(art.visualAudit.unexpectedSimilarPairs,[]);
  // These original files have different byte hashes/sizes but the same double
  // portrait. Keep the actual reported example as the detector's positive control.
  const old=await Promise.all(['505','506'].map(id=>artFingerprint(path.join(root,`assets/hero-art/${id}-portrait-v2.webp`))));assert(compareArt(...old).similar);
  const current=['505','506'].map(id=>fingerprints.find(a=>a.heroId===id));assert(!compareArt(current[0].fingerprint,current[1].fingerprint).similar);
  for(const asset of current){const hero=catalog.find(h=>String(h.id)===asset.heroId);assert.equal(asset.sourceUrl,policy.heroes[asset.heroId].portraitUrl);for(const field of ['cardArt','fullArt','avatarImg','splashArt'])assert.equal(hero[field],asset.file,field);assert.equal(hero.heroArt,asset.coverFile);assert.equal(hero.artScene,asset.coverFile);assert(hero.skins.some(s=>s.id===policy.heroes[asset.heroId].coverSkinId));}
});
test('transparent figures have real alpha and stay bound to the correct hero skin',async()=>{
  const manifest=await read('data/character-cutouts.json');const seen=new Set();
  for(const asset of manifest.assets){
    assert(!seen.has(asset.skinId));seen.add(asset.skinId);
    const raw=await read(`data/heroes/${asset.heroId}.json`),detail=await read(`data/characters/${asset.heroId}.json`);
    assert(raw.skins.some(s=>s.id===asset.skinId));assert.equal(detail.skins.find(s=>s.id===asset.skinId)?.cutoutArt,asset.file);
    const bytes=await fs.readFile(path.join(root,asset.file)),meta=await sharp(bytes).metadata();
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert(meta.hasAlpha);assert.equal(meta.width,asset.width);assert.equal(meta.height,asset.height);
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let clear=0,opaque=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;if(data[i]===255)opaque++;}
    assert(clear/(info.width*info.height)>.1);assert(opaque>0);await fs.access(path.join(root,asset.master));
    const source=await fs.readFile(path.join(root,asset.sourceArtwork));assert.equal(createHash('sha256').update(source).digest('hex'),asset.sourceArtworkSha256);
    if(detail.skins[0].id===asset.skinId){assert.equal(detail.fullArt,asset.file);assert.equal(detail.fullArtTransparent,true);}
  }
});
test('HTTP supports real audio seeking, caching and excludes private source files',async t=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
  const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/王者回响/);assert.equal((await fetch(base,{headers:{'If-None-Match':home.headers.get('etag')}})).status,304);
  for(const publicPath of ['/app.js','/styles.css','/wangzhe.css','/wangzhe-refinement.css','/wangzhe-dialog.css','/wangzhe-data.js','/search-worker.js','/voice_index.html','/data/catalog.json','/data/audio-audit.json','/data/characters/131.json','/data/teyvat-search-index.json','/assets/audio/music/music_catalog.json','/assets/fonts/HYWenHei.woff'])assert.equal((await fetch(base+publicPath)).status,200,publicPath);
  const video=await fetch(base+'/assets/video/TEYVAT_03_VID_windrise-pc_jimeng-2k_v1.mp4',{headers:{Range:'bytes=0-1023'}});assert.equal(video.status,206);assert.equal(video.headers.get('content-type'),'video/mp4');assert.equal((await video.arrayBuffer()).byteLength,1024);
  const d=await read('data/heroes/131.json');const file=d.voices.find(v=>v.url.startsWith('assets/')).url;const fileData=await fs.readFile(path.join(root,file));const r=await fetch(`${base}/${file}`,{headers:{Range:'bytes=0-127'}});assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,128);assert.equal(r.headers.get('content-range'),`bytes 0-127/${fileData.length}`);
  const end=await fetch(`${base}/${file}`,{headers:{Range:'bytes=-64'}});assert.deepEqual(Buffer.from(await end.arrayBuffer()),fileData.subarray(-64));
  const invalid=await fetch(`${base}/${file}`,{headers:{Range:`bytes=${fileData.length+10}-`}});assert.equal(invalid.status,416);
  const head=await fetch(`${base}/${file}`,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(Number(head.headers.get('content-length')),fileData.length);
  for(const privatePath of ['/server.js','/package.json','/scripts/sync-voices.mjs','/.openai/hosting.json','/source-snapshots/voices-sync-report.json'])assert.equal((await fetch(base+privatePath)).status,404);
  assert.equal((await fetch(base+'/assets/%2e%2e%2f%2e%2e%2fREADME.md')).status,403);assert.equal((await fetch(base,{method:'POST'})).status,405);
});
