'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = require('css-tree');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// DOM unit tests, not browser rendering tests: native media is modelled by
// happy-dom and canvas drawing is stubbed. They verify orchestration and UI state.
async function boot(t, { mobile=false, reduced=false, saveData=false, rejectPlay=false, effectsOff=false, lowMemory=false, pathname='/', configure=()=>{} } = {}) {
  const { Window } = await import('happy-dom');
  const w = new Window({ width: mobile ? 390 : 1440, height: 900, url: `http://localhost:8080${pathname}`, settings: { enableJavaScriptEvaluation:true, disableJavaScriptFileLoading:true, enableCSSFileLoading:false, suppressInsecureJavaScriptEnvironmentWarning:true } });
  const errors=[];
  w.addEventListener('error', e => errors.push(e.message));
  w.document.body.innerHTML='<div id="app"></div>';
  w.document.documentElement.dataset.theme='dark';
  if(effectsOff)w.localStorage.setItem('teyvat_atmosphere','off');
  const context = new Proxy({}, { get: (target,key) => target[key] || (()=>{}), set:(target,key,value)=>(target[key]=value,true) });
  w.HTMLCanvasElement.prototype.getContext=()=>context;
  const mediaQueries = new Map();
  w.matchMedia=query=>{
    if(!mediaQueries.has(query))mediaQueries.set(query,Object.assign(new w.EventTarget(),{media:query,matches:query.includes('prefers-reduced-motion')?reduced:query.includes('orientation:portrait')?mobile:query.includes('max-width')||query.includes('pointer:coarse')?mobile:query.includes('pointer:fine')?!mobile:false}));
    return mediaQueries.get(query);
  };
  Object.defineProperty(w.navigator,'connection',{value:Object.assign(new w.EventTarget(),{saveData,effectiveType:'4g'})});
  Object.defineProperty(w.navigator,'deviceMemory',{value:lowMemory?1:8});
  Object.defineProperty(w.navigator,'hardwareConcurrency',{value:8});
  let hidden=false;
  Object.defineProperty(w.document,'hidden',{get:()=>hidden});
  w.fetch=async url=>{const p=path.resolve(root,String(url));assert(p.startsWith(root+path.sep));return {ok:true,json:async()=>JSON.parse(fs.readFileSync(p))}};
  let playCalls=0;
  const nativePlay=w.HTMLMediaElement.prototype.play;
  w.HTMLMediaElement.prototype.play=function(){playCalls++;return rejectPlay?Promise.reject(new w.DOMException('Autoplay blocked','NotAllowedError')):nativePlay.call(this)};
  const audioInstances=[],NativeAudio=w.Audio;
  w.Audio=function(...args){const element=new NativeAudio(...args);audioInstances.push(element);return element};
  const navTimers=new Map(),nativeInterval=w.setInterval.bind(w),nativeClear=w.clearInterval.bind(w);
  w.setInterval=(callback,delay,...args)=>{const id=nativeInterval(callback,delay,...args);if(delay===5000)navTimers.set(id,callback);return id};
  w.clearInterval=id=>{navTimers.delete(id);return nativeClear(id)};
  configure(w);
  w.eval(source);
  w.dispatchEvent(new w.Event('load'));
  await pause(30);
  t.after(async()=>{w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:false}));w.HTMLMediaElement.prototype.play=nativePlay;await w.happyDOM.close();assert.deepEqual(errors,[])});
  return {w,$:id=>w.document.getElementById(id),video:w.document.querySelector('.world-video'),musicAudio:()=>audioInstances[0],playCalls:()=>playCalls,tickNav(){for(const callback of navTimers.values())callback()},navTimerCount:()=>navTimers.size,hide(value){hidden=value;w.document.dispatchEvent(new w.Event('visibilitychange'))},setPortrait(value){const media=mediaQueries.get('(orientation:portrait)');media.matches=value;media.dispatchEvent(new w.Event('change'))}};
}

test('background loads muted, pauses for dialogs and hidden pages, resumes without duplicating video',async t=>{
  const {w,$,video,hide}=await boot(t);
  assert.equal(video.getAttribute('src'),'assets/video/TEYVAT_03_VID_windrise-pc_jimeng-2k_v1.mp4');
  assert(video.muted && video.loop && video.playsInline);assert.equal(video.paused,false);
  assert.equal(w.document.querySelector('.ambient-particles').hidden,true);
  $('characterDialog').showModal();await pause(15);assert.equal(video.paused,true);
  $('characterDialog').close();await pause(15);assert.equal(video.paused,false);
  hide(true);await pause(10);assert.equal(video.paused,true);
  hide(false);await pause(10);assert.equal(video.paused,false);
  $('effectsToggle').click();await pause(10);assert.equal(video.paused,true);assert.equal(w.localStorage.getItem('teyvat_atmosphere'),'off');
  assert.equal(video.getAttribute('src'),null);
  assert.equal(w.document.querySelectorAll('video').length,1);
});

test('music dialogs release the 2K decoder and orientation changes stay unloaded until close',async t=>{
  const {w,$,video,setPortrait,hide}=await boot(t);
  for(let i=0;i<4;i++){
    $('musicBoxDialog').showModal();await pause(10);assert.equal(video.getAttribute('src'),null);assert(video.paused);
    setPortrait(i%2===0);await pause(10);assert.equal(video.getAttribute('src'),null);
    $('musicBoxDialog').close();await pause(10);assert.equal(video.paused,false);assert.equal(w.document.querySelectorAll('video').length,1);
  }
  hide(true);assert.equal(video.getAttribute('src'),null);
  hide(false);assert(video.getAttribute('src'));
});

test('celestial illustration motion releases ownership for dialogs, hidden pages and disabled effects',async t=>{
  const {w,$,hide}=await boot(t),hero=$('heroCharacterImg').closest('.hero'),dialog=$('characterDialog');
  assert.equal(hero.dataset.artEdition,'celestial');
  assert.equal(hero.dataset.celestialRunning,'true');
  dialog.showModal();await pause(15);
  assert.equal(hero.dataset.celestialRunning,'false');assert.equal(dialog.dataset.celestialRunning,'true');
  hide(true);assert.equal(dialog.dataset.celestialRunning,'false');
  hide(false);assert.equal(dialog.dataset.celestialRunning,'true');
  dialog.close();await pause(15);assert.equal(hero.dataset.celestialRunning,'true');
  $('musicBoxDialog').showModal();await pause(15);assert.equal(hero.dataset.celestialRunning,'false');
  $('musicBoxDialog').close();await pause(15);assert.equal(hero.dataset.celestialRunning,'true');
  $('effectsToggle').click();await pause(15);assert.equal(hero.dataset.celestialRunning,'false');
  assert.equal(w.document.querySelectorAll('video').length,1);
});

test('celestial editions keep complete transparent art, original references and consistent character records',async()=>{
  const sharp=require('sharp'),catalog=require('../data/catalog.json');
  for(const id of [10000001,10000005,10000007]){
    const character=catalog.find(item=>item.id===id),detail=require(`../data/characters/${id}.json`);
    assert.equal(character.artEdition,'celestial');assert.equal(character.fullArt,detail.fullArt);assert.equal(character.cardArt,detail.cardArt);
    assert(fs.existsSync(path.join(root,character.originalFullArt)));
    for(const file of [character.fullArt,character.cardArt]){
      const image=sharp(path.join(root,file)),metadata=await image.metadata(),stats=await image.stats();
      assert(metadata.hasAlpha);assert.equal(stats.channels[3].min,0);assert.equal(stats.channels[3].max,255);
    }
    const full=await sharp(path.join(root,character.fullArt)).metadata();assert.equal(full.width,character.fullArtWidth);assert.equal(full.height,character.fullArtHeight);
  }
});

test('capable mobile devices play the muted background video',async t=>{
  const {video,playCalls,w}=await boot(t,{mobile:true});
  assert.equal(video.getAttribute('src'),'assets/video/TEYVAT_03_VID_windrise-mobile_jimeng-2k_v1.mp4');
  assert.equal(video.getAttribute('poster'),'assets/video/TEYVAT_03_BG_windrise-mobile_poster_v1.webp');
  assert(video.muted&&video.loop&&video.playsInline);assert.equal(video.paused,false);
  assert.equal(playCalls(),1);assert.equal(w.document.querySelector('.ambient-particles').hidden,true);
});

test('rotating the viewport switches reviewed sources while retaining one video element',async t=>{
  const {w,video,setPortrait}=await boot(t);
  setPortrait(true);await pause(15);
  assert.equal(video.getAttribute('src'),'assets/video/TEYVAT_03_VID_windrise-mobile_jimeng-2k_v1.mp4');
  assert.equal(video.getAttribute('poster'),'assets/video/TEYVAT_03_BG_windrise-mobile_poster_v1.webp');
  assert.equal(video.paused,false);
  setPortrait(false);await pause(15);
  assert.equal(video.getAttribute('src'),'assets/video/TEYVAT_03_VID_windrise-pc_jimeng-2k_v1.mp4');
  assert.equal(video.paused,false);assert.equal(w.document.querySelectorAll('video').length,1);
});

test('reduced-motion, data saver, very low memory and saved off preference keep the static fallback',async t=>{
  for(const options of [{reduced:true},{saveData:true},{lowMemory:true},{effectsOff:true}]) {
    await t.test(JSON.stringify(options),async t=>{const {video,playCalls,$}=await boot(t,options);assert.equal(video.getAttribute('src'),null);assert.equal(playCalls(),0);assert.equal($('heroCharacterImg').closest('.hero').dataset.celestialRunning,'false')});
  }
});

test('blocked autoplay settles once and preserves a static fallback',async t=>{
  const {video,playCalls}=await boot(t,{rejectPlay:true});await pause(70);
  assert.equal(video.paused,true);assert.equal(playCalls(),1);
});

test('legacy Nahida archive retains its full index and responsive background',async t=>{
  const {w,$,video}=await boot(t,{pathname:'/nahida_player?legacy=1',mobile:true});
  assert.match($('heroTitle').textContent,/须弥的故事/);
  assert(w.document.querySelector('.voice-index-list'));
  assert.equal(video.getAttribute('src'),'assets/video/TEYVAT_03_VID_windrise-mobile_jimeng-2k_v1.mp4');
});

test('five-second voice navigation changes to another real character and stops while hidden',async t=>{
  const {w,$,tickNav,navTimerCount,hide}=await boot(t),link=$('voiceIndexNav');
  const first=link.dataset.characterId;
  assert.equal(navTimerCount(),1);tickNav();
  const next=link.dataset.characterId;
  assert.notEqual(next,first);
  assert.equal(new URL(link.href).searchParams.get('character'),next);
  const character=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json'))).find(c=>String(c.id)===next);
  assert.equal($('voiceIndexNavLabel').textContent,`${character.name}语音索引`);
  hide(true);assert.equal(navTimerCount(),0);tickNav();assert.equal(link.dataset.characterId,next);
  hide(false);assert.equal(navTimerCount(),1);
  $('musicBoxDialog').showModal();tickNav();assert.equal(link.dataset.characterId,next);
  $('musicBoxDialog').close();tickNav();assert.notEqual(link.dataset.characterId,next);
  w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));assert.equal(navTimerCount(),0);
});

test('all-character index keeps selection, quotes, favorites and audio on the same character',async t=>{
  const {w,$}=await boot(t,{pathname:'/voice_index.html?character=10000086',mobile:true});
  const first=require('../data/characters/10000086.json');
  assert.equal($('mainContent').dataset.indexCharacter,'10000086');
  assert.equal($('resultCount').textContent,String(first.friendLines.length+first.actionLines.length));
  assert.match($('archiveHeadingText').textContent,new RegExp(first.name));
  $('heroCharSelect').value='10000073';$('heroCharSelect').dispatchEvent(new w.Event('change'));
  assert.equal($('heroListenBtn').disabled,true);
  await pause(20);
  assert.equal($('mainContent').dataset.indexCharacter,'10000073');assert.equal($('resultCount').textContent,'75');
  assert.equal(new URL(w.location.href).searchParams.get('character'),'10000073');
  assert.equal($('heroListenBtn').disabled,false);
  const read=w.document.querySelector('[data-source="index"][data-quote-action="read"]');
  assert(!read.disabled);read.click();await pause(10);
  assert.match($('dockTitle').textContent,/纳西妲/);
  assert.equal($('masterAudio').getAttribute('src'),require('../data/characters/10000073.json').friendLines[0].audioUrl);
  w.document.querySelector('[data-source="index"][data-quote-action="favorite"]').click();await pause(10);
  assert(JSON.parse(w.localStorage.getItem('genshin_fav_quotes_v2')).some(key=>key.startsWith('纳西妲_')));
});

test('every character can open a voice index with matching counts, categories and audio actions',async t=>{
  const {w,$}=await boot(t,{pathname:'/voice_index.html?character=10000001'});
  for(const character of require('../data/catalog.json')){
    $('heroCharSelect').value=String(character.id);$('heroCharSelect').dispatchEvent(new w.Event('change'));await pause(3);
    assert.equal($('mainContent').dataset.indexCharacter,String(character.id),character.name);
    assert.equal($('resultCount').textContent,String(character.quoteCount),character.name);
    assert.match($('archiveHeadingText').textContent,new RegExp(character.name));
    const detail=require(`../data/characters/${character.id}.json`),quotes=[...detail.friendLines,...detail.actionLines];
    for(const button of w.document.querySelectorAll('[data-source="index"][data-quote-action="read"]')){
      const quote=quotes[Number(button.dataset.index)];assert.equal(button.disabled,!(quote.audioUrl||quote.localAudio),`${character.name} · ${quote.title}`);
    }
  }
});

test('old index links open the all-character index unless the legacy archive is requested',async t=>{
  const {$}=await boot(t,{pathname:'/nahida_player?character=10000022'});
  assert.equal($('mainContent').dataset.indexCharacter,'10000022');
  assert.match($('archiveHeadingText').textContent,/温迪/);
});

test('a late failed play promise cannot pause a newer track after rapid skips',async t=>{
  const {w,$,musicAudio}=await boot(t),box=w.musicBox,a=musicAudio();
  const nativePlay=a.play.bind(a);let rejectOld;
  a.play=()=>new Promise((resolve,reject)=>{rejectOld=reject});
  box.playTrack(box.visibleTracks[1],true);
  a.play=nativePlay;const latest=box.visibleTracks[2];box.playTrack(latest,true);
  await pause(10);assert.equal(box.playbackStatus,'playing');
  rejectOld(new w.DOMException('Old source interrupted','AbortError'));await pause(10);
  assert.equal(box.currentTrack.id,latest.id);assert.equal(box.playbackStatus,'playing');
  assert.equal($('musicCurTime').textContent,'00:00');assert(!$('musicBoxDialog').classList.contains('music-loading'));
});

test('music mute survives voice ducking, volume fades and restore from a zero volume',async t=>{
  const {w,musicAudio}=await boot(t),box=w.musicBox,a=musicAudio();
  box.toggleMute();box.duck();await pause(330);box.unduck();await pause(530);
  assert.equal(a.volume,0);assert.equal(box.muted,true);assert.equal(a.muted,true);
  box.toggleMute();assert.equal(a.volume,.65);
  box.duck();box.setVolume(.5);await pause(330);assert.equal(a.volume,.1);
  box.toggleMute();await pause(100);assert.equal(a.volume,0);
  box.unduck();await pause(530);assert.equal(a.volume,0);
  box.setVolume(0);box.toggleMute();assert.equal(box.volume,.5);assert.equal(a.volume,.5);
});

test('invalid saved music settings do not disable the native audio player',async t=>{
  const {w,musicAudio}=await boot(t,{configure(w){w.localStorage.setItem('teyvat_music_vol','not-a-number')}});
  assert.equal(w.musicBox.volume,.65);assert.equal(musicAudio().volume,.65);
  assert.match(musicAudio().src,/\.(?:flac|mp3)$/);assert.equal(musicAudio().preload,'none');
});

test('pause and close invalidate late voice playback completions and restore background volume',async t=>{
  const {w,$,musicAudio}=await boot(t),a=$('masterAudio');let resolvePlay;
  const nativePlay=a.play.bind(a);
  a.play=()=>new Promise(resolve=>{resolvePlay=resolve});
  $('heroListenBtn').click();await pause(5);
  $('masterPlayToggleBtn').click();resolvePlay();await pause(15);
  assert.equal($('masterPlayToggleBtn').getAttribute('aria-label'),'继续播放');
  await pause(530);assert.equal(musicAudio().volume,w.musicBox.volume);
  let rejectResume;a.play=()=>new Promise((resolve,reject)=>{rejectResume=reject});
  $('masterPlayToggleBtn').click();$('closePlayer').click();
  rejectResume(new w.DOMException('Interrupted','AbortError'));await pause(10);
  assert.equal($('audioPlayer').hidden,true);assert.notEqual($('playbackMode').textContent,'播放未成功');
  a.play=nativePlay;
});

test('restoring a cached page keeps voice playback paused and restores normal background volume',async t=>{
  const {w,$,musicAudio}=await boot(t),box=w.musicBox;
  const transition=type=>{const event=new w.Event(type);Object.defineProperty(event,'persisted',{value:true});w.dispatchEvent(event)};
  box.toggle();await pause(10);$('heroListenBtn').click();await pause(350);
  assert.equal(box.ducked,true);
  transition('pagehide');
  assert.equal(musicAudio().volume,box.volume);assert.equal(box.ducked,false);
  assert.equal($('masterPlayToggleBtn').getAttribute('aria-label'),'继续播放');
  assert.equal($('masterAudio').getAttribute('src'),null);
  transition('pageshow');await pause(10);
  assert.equal(box.playbackStatus,'playing');
  $('masterPlayToggleBtn').click();await pause(10);
  assert($('masterAudio').getAttribute('src'));assert.equal($('masterPlayToggleBtn').getAttribute('aria-label'),'暂停播放');
});

test('a slow hero detail does not block cards, hero switching or music controls',async t=>{
  let release;
  const {w,$}=await boot(t,{configure(w){const fetchFile=w.fetch;w.fetch=url=>String(url)==='data/characters/10000001.json'?new Promise(resolve=>{release=()=>resolve(fetchFile(url))}):fetchFile(url)}});
  assert.equal(w.document.querySelectorAll('.character-open').length,24);
  $('musicPillDisc').click();assert.equal($('musicBoxDialog').open,true);$('musicBoxDialog').close();
  $('heroCharSelect').value='10000073';$('heroCharSelect').dispatchEvent(new w.Event('change'));await pause(20);
  assert.match($('dailyAuthor').textContent,/纳西妲/);release();await pause(20);
  assert.match($('dailyAuthor').textContent,/纳西妲/);
});

test('failed role index loads show a retry instead of an empty or stale character list',async t=>{
  let fail=true;
  const {w,$}=await boot(t,{pathname:'/voice_index.html?character=10000086',configure(w){const fetchFile=w.fetch;w.fetch=url=>fail&&String(url)==='data/characters/10000086.json'?Promise.reject(Error('Offline')):fetchFile(url)}});
  assert.equal($('charConstellationGrid').getAttribute('aria-busy'),'false');
  assert.equal(w.document.querySelectorAll('.index-voice').length,0);
  const retry=w.document.querySelector('[data-action="retry-character-index"]');assert(retry);assert.notEqual($('resultCount').textContent,'1,814');
  fail=false;retry.click();await pause(20);
  assert.equal($('mainContent').dataset.indexCharacter,'10000086');assert.equal($('resultCount').textContent,'66');
  assert(w.document.querySelector('.index-voice'));
});

test('worker failures fall back automatically and repeated searches reuse the downloaded index',async t=>{
  let indexRequests=0;
  const {w,$}=await boot(t,{configure(w){const fetchFile=w.fetch;w.fetch=url=>{if(String(url)==='data/search-index.json')indexRequests++;return fetchFile(url)};w.Worker=class extends w.EventTarget{postMessage(){this.dispatchEvent(new w.Event('error'))}terminate(){}}}});
  const search=async query=>{$('masterSearchInput').value=query;$('masterSearchInput').dispatchEvent(new w.Event('input'));await pause(140)};
  await search('天动万象');assert.equal($('resultCount').textContent,'1');assert.match($('charConstellationGrid').textContent,/钟离/);
  await search('审判');assert(indexRequests===1);assert(!/暂时无法加载/.test($('resultsMeta').textContent));
  $('clearSearch').click();assert.equal($('resultCount').textContent,'97');
});

test('reset cancels a pending worker search and ignores its late result',async t=>{
  let worker;
  const {w,$}=await boot(t,{configure(w){w.Worker=class extends w.EventTarget{constructor(){super();worker=this}postMessage(data){this.request=data}terminate(){}}}});
  $('masterSearchInput').value='天动万象';$('masterSearchInput').dispatchEvent(new w.Event('input'));await pause(120);
  $('clearSearch').click();worker.dispatchEvent(new w.MessageEvent('message',{data:{id:worker.request.id,ids:[10000030]}}));await pause(10);
  assert.equal($('resultCount').textContent,'97');assert.equal($('charConstellationGrid').getAttribute('aria-busy'),'false');
});

test('music catalog failure keeps local tracks available and retry restores accurate category counts',async t=>{
  const {w,$}=await boot(t),box=w.musicBox,fetchFile=w.fetch;
  w.fetch=()=>Promise.reject(Error('Offline'));await box.loadCatalog();
  assert.equal($('musicCatalogRetry').hidden,false);assert.equal(box.visibleTracks.length,16);
  assert.match($('musicTotalCountBadge').textContent,/16 首精选/);
  w.fetch=fetchFile;$('musicCatalogRetry').click();await pause(20);
  assert.equal($('musicCatalogRetry').hidden,true);assert.equal(box.fullCatalog.length,1105);
  assert.equal(w.document.querySelector('[data-tab="local"]').textContent,'精选母带 (17)');
  w.document.querySelector('[data-tab="local"]').click();assert.equal(box.visibleTracks.length,17);
  assert.equal(w.document.querySelectorAll('.music-track-item').length,17);
});

test('random next excludes the current track without looping and previous resumes its history',async t=>{
  const {w,musicAudio}=await boot(t),box=w.musicBox;
  const random=w.Math.random;w.Math.random=()=>0;t.after(()=>{w.Math.random=random});
  const first=box.currentTrack;box.loopMode='random';box.next();await pause(10);
  assert.notEqual(box.currentTrack.id,first.id);assert.equal(box.playbackStatus,'playing');
  box.prev();await pause(10);assert.equal(box.currentTrack.id,first.id);assert.equal(box.playbackStatus,'playing');
  assert.equal(musicAudio().paused,false);
});

test('FLAC failure falls back to the original MP3 and clears stale progress',async t=>{
  const {w,$,musicAudio}=await boot(t),box=w.musicBox,a=musicAudio(),nativePlay=a.play.bind(a);
  a.canPlayType=()=> 'probably';
  a.play=()=>/\.flac$/.test(a.src)?Promise.reject(new w.DOMException('Decode failed','NotSupportedError')):nativePlay();
  $('musicCurTime').textContent='00:09';$('musicTotalTime').textContent='99:59';
  box.playTrack(box.visibleTracks[0],true);await pause(15);
  assert.match(a.src,/01_dawn_winery\.mp3$/);assert.equal(box.playbackStatus,'playing');
  assert.equal($('musicCurTime').textContent,'00:00');assert.notEqual($('musicTotalTime').textContent,'99:59');
});

test('identically named recordings do not make random next repeat the current track',async t=>{
  const {w}=await boot(t),box=w.musicBox,track=box.visibleTracks[0];
  const first={...track,id:'duplicate-a'},second={...track,id:'duplicate-b'};
  box.fullCatalog=[first,second];box.visibleTracks=[first,second];box.loopMode='random';
  box.playTrack(second,false);box.next();await pause(10);
  assert.equal(box.currentTrack.id,first.id);assert.equal(box.playbackStatus,'playing');
});

test('failed remote sources recover to an available track and blocked autoplay waits for a user gesture',async t=>{
  const {w,musicAudio}=await boot(t),box=w.musicBox,a=musicAudio(),nativePlay=a.play.bind(a);
  const remote=require('../assets/audio/music/music_catalog.json').tracks.find(t=>t.id==='ost-809');
  const local=box.visibleTracks[0];box.visibleTracks=[remote,local];
  a.play=()=>a.src.includes('/api/music-stream')||a.src.includes('archive.org')?Promise.reject(Error('Network unavailable')):nativePlay();
  box.playTrack(remote,true);await pause(20);
  assert.equal(box.currentTrack.id,local.id);assert.equal(box.playbackStatus,'playing');
  a.play=()=>Promise.reject(new w.DOMException('User gesture required','NotAllowedError'));
  box.playTrack(remote,true);await pause(10);
  assert.equal(box.currentTrack.id,remote.id);assert.equal(box.playbackStatus,'paused');assert(!box.loading);
  assert.match(box.getDownloadInfo().url,/\/api\/music-stream\?id=ost-809$/);assert.equal(box.getDownloadInfo().remote,false);
});

test('AE title intro plays once, settles to its still, and shares the effects lifecycle',async t=>{
  const {w,$}=await boot(t);
  const art=$('heroTitleArt'),title=$('heroTitle');
  assert.match(art.getAttribute('src'),/title-main-intro_v1\.webp$/);
  art.dispatchEvent(new w.Event('load'));
  assert(title.classList.contains('has-art'));assert.equal(title.dataset.motion,'playing');
  await pause(3100);
  assert.match(art.getAttribute('src'),/title-main-still_v1\.webp$/);
  assert.equal(title.dataset.motion,'settled');
  $('effectsToggle').click();$('effectsToggle').click();
  assert.match(art.getAttribute('src'),/title-main-still_v1\.webp$/);
  assert.equal(w.document.querySelectorAll('video').length,1);
  assert.match(title.textContent,/循着星光/);assert.match(title.textContent,/重逢熟悉的声音/);
});

test('AE art remains static for reduced motion, data saver, low memory and disabled effects',async t=>{
  for(const preferences of [{reduced:true},{saveData:true},{lowMemory:true},{effectsOff:true}]){
    const {$}=await boot(t,preferences);
    assert.match($('heroTitleArt').getAttribute('src'),/title-main-still_v1\.webp$/);
    assert.match($('heroTitle').textContent,/重逢熟悉的声音/);
  }
});

test('AE title releases motion when hidden and keeps real heading text after image failures',async t=>{
  const {w,$,hide}=await boot(t);
  const art=$('heroTitleArt'),title=$('heroTitle');
  art.dispatchEvent(new w.Event('load'));hide(true);
  assert.match(art.getAttribute('src'),/title-main-still_v1\.webp$/);
  hide(false);assert.equal(title.dataset.motion,'settled');
  art.dispatchEvent(new w.Event('error'));
  assert(!title.classList.contains('has-art'));assert.equal(title.dataset.motion,'fallback');
  assert.match(title.textContent,/循着星光/);assert.match(title.textContent,/重逢熟悉的声音/);
});

test('detail uses the complete artwork, viewer returns to quotes, close remains available',async t=>{
  const {w,$}=await boot(t);
  // Region filtering is a real app path, independent of the recommended first page.
  w.document.querySelector('[data-region="枫丹"]').click();
  w.document.querySelector('[data-character="10000086"]').click();await pause(25);
  assert.equal($('characterDialog').open,true);
  const art=w.document.querySelector('.detail-sculpture img');
  assert.equal(art.getAttribute('src'),'assets/characters/10000086-full.webp');
  assert(Number(art.getAttribute('width'))>0);assert($('modalQuotesStream').children.length>0);
  $('artworkToggle').click();assert($('characterDialog').classList.contains('art-expanded'));
  const cancel=new w.Event('cancel',{cancelable:true});$('characterDialog').dispatchEvent(cancel);
  assert(cancel.defaultPrevented);assert(!$('characterDialog').classList.contains('art-expanded'));assert($('characterDialog').open);
  $('modalExitCross').click();await pause(10);assert.equal($('characterDialog').open,false);
  assert.equal(w.document.querySelectorAll('#artworkToggle').length,1);
});

test('stylesheet parses and all explicit runtime media exist locally',()=>{
  const errors=[],sheet=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  css.parse(sheet,{onParseError:e=>errors.push(e.message)});assert.deepEqual(errors,[]);
  assert.match(sheet,/@media\(max-width:767px\) and \(pointer:coarse\).*?\.character-card:active/s);
  assert.doesNotMatch(sheet,/\.world-video\{display:none\}\.world-scene::after\{display:none\}/);
  for(const [,asset] of sheet.matchAll(/url\(['"]?(assets\/[^)'"\s]+)['"]?\)/g))assert(fs.existsSync(path.join(root,asset)),asset);
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json')));
  for(const character of catalog.filter(c=>c.fullArt)){assert(fs.existsSync(path.join(root,character.fullArt)));assert(character.fullArtWidth>0&&character.fullArtHeight>0)}
});
