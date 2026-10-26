// Exhaustively dispatch every voice through the retained UI event handler.
// Media transport is stubbed only here; availability/signatures are checked by
// audit-audio.mjs and real decoding/playback by verify-reused-ui.cjs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
(async()=>{const b=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});let voices=0,skins=0;const errors=[];
try{const c=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await c.addInitScript(()=>{const sources=new WeakMap();Object.defineProperty(HTMLMediaElement.prototype,'src',{get(){return sources.get(this)||''},set(value){sources.set(this,value);if(!this.id)window.__qaMusicRequested=value;}});HTMLMediaElement.prototype.play=function(){return Promise.resolve()};HTMLMediaElement.prototype.pause=function(){};HTMLMediaElement.prototype.load=function(){};});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.stack));await p.goto('http://127.0.0.1:8081',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('#heroCharSelect').options.length>100);
 for(const h of read('data/heroes.json').heroes){const d=read(`data/characters/${h.id}.json`);
  await p.evaluate(id=>{const sel=document.querySelector('#heroCharSelect');sel.value=id;sel.dispatchEvent(new Event('change'));document.querySelector('#heroCharacterImg').click();},h.id);
  try{await p.waitForFunction(name=>document.querySelector('#modalHeroName')?.textContent===name&&!!document.querySelector('#skinSelect'),h.name,{timeout:10000});}catch(e){console.log(JSON.stringify({hero:h.name,expectedId:h.id,state:await p.evaluate(()=>({name:document.querySelector('#modalHeroName')?.textContent,select:document.querySelector('#heroCharSelect').value,html:document.querySelector('#detailLayout').innerText.slice(0,200)})),errors}));throw e;}
  const result=await p.evaluate(detail=>{
   const problems=[],seen=new Set();let skinCount=0;
   for(const skin of detail.skins){const sel=document.querySelector('#skinSelect');sel.value=skin.id;sel.dispatchEvent(new Event('change'));skinCount++;const image=document.querySelector('.detail-sculpture img');if(image.getAttribute('src')!==(skin.cutoutArt||skin.art||detail.fullArt))problems.push({type:'skin-art',skin:skin.name});
    for(const [tab,lines]of[['friend',detail.friendLines],['action',detail.actionLines]]){document.querySelector(`[data-quote-tab="${tab}"]`).click();while(document.querySelector('[data-action="more-quotes"]'))document.querySelector('[data-action="more-quotes"]').click();
     const expected=lines.filter(q=>q.skinId===skin.id),buttons=[...document.querySelectorAll('#modalQuotesStream [data-quote-action="read"]')];if(buttons.length!==expected.length||Number(document.querySelector(`[data-quote-tab="${tab}"] span`).textContent)!==expected.length)problems.push({type:'count',skin:skin.name,tab,actual:buttons.length,expected:expected.length});
     buttons.forEach((button,i)=>{const q=expected[i];if(!q)return;button.click();const audio=document.querySelector('#masterAudio'),title=document.querySelector('#dockTitle').textContent,text=document.querySelector('#dockSnippet').textContent,row=button.closest('.quote-card');if(button.dataset.voiceId!==q.key||audio.src!==q.audioUrl||title!==detail.name+' · '+q.title||!text.includes(q.desc)||!row.querySelector('.quote-text').textContent.includes(q.desc))problems.push({type:'route',hero:detail.name,id:q.key,src:audio.src});seen.add(q.key);});
    }
   }
   document.querySelector('#closePlayer').click();document.querySelector('#modalExitCross').click();return{problems,voices:seen.size,skins:skinCount};
  },d);
  assert.deepEqual(result.problems,[]);assert.equal(result.voices,h.voiceCount);voices+=result.voices;skins+=result.skins;
  if(voices%1000<h.voiceCount)console.log(JSON.stringify({stage:'ui-media-routing',hero:h.name,voices,skins}));await p.waitForFunction(()=>!document.querySelector('#characterDialog').open);
 }
 assert.equal(voices,18159);await p.locator('#wangzheMusicNav').click();await p.waitForFunction(()=>window.musicBox.fullCatalog?.length===1349);
 const songs=await p.evaluate(()=>{const box=window.musicBox,problems=[];document.querySelector('.music-tab-btn[data-tab="all"]').click();while(document.querySelector('#musicLoadMoreBtn'))document.querySelector('#musicLoadMoreBtn').click();const opened=[],oldOpen=window.open;window.open=url=>{opened.push(url);return null;};let audio=0,links=0;for(const button of document.querySelectorAll('.music-track-item')){const track=box.fullCatalog.find(t=>t.id===button.dataset.trackId);const n=opened.length;button.click();if(track.playable){audio++;if(box.currentTrack.id!==track.id||window.__qaMusicRequested!==track.src)problems.push({type:'music-audio',id:track.id,actual:window.__qaMusicRequested});}else{links++;if(opened.length!==n+1||opened.at(-1)!==track.sourceUrl)problems.push({type:'music-platform-link',id:track.id});}}window.open=oldOpen;box.suspend();return{audio,links,problems};});assert.deepEqual(songs.problems,[]);assert.equal(songs.audio,48);assert.equal(songs.links,1301);
 assert.deepEqual(errors,[]);const report={checkedAt:new Date().toISOString(),method:'Every rendered original play button dispatched with media transport stubbed; sources checked separately',heroes:133,skins,voices,musicAudio:songs.audio,musicLinks:songs.links,errors};fs.writeFileSync(path.join(root,'docs/audio-routing-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
