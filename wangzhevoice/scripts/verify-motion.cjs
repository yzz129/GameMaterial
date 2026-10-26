// Isolated browser regression tests for the local applications, using no user profile.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),checks=[],errors=[];
const mark=(name,data={})=>{checks.push({name,...data});console.log('PASS',name,JSON.stringify(data));};
(async()=>{
 const {createServer}=await import('../server.js');
 const ref=createServer(path.resolve(root,'../yuanshenvoice'));await new Promise(r=>ref.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--mute-audio'],...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
 const stats={};
 try{
  for(const [game,url,id] of [['genshin',`http://127.0.0.1:${ref.address().port}`,10000001],['wangzhe','http://127.0.0.1:8081',131]]){
   const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
   if(game==='wangzhe')await ctx.addInitScript(()=>localStorage.setItem('wangzhe_atmosphere','off'));
   const p=await ctx.newPage();p.on('pageerror',e=>errors.push(`${game}: ${e.stack}`));
   await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForSelector('.character-card');
   await p.waitForFunction(()=>{const v=document.querySelector('.world-video');return v&&!v.paused&&v.currentTime>.2&&v.videoWidth>0;},{},{timeout:30000});
   const state=await p.evaluate(()=>{const v=document.querySelector('.world-video'),h=document.querySelector('#heroCharacterImg'),r=document.querySelector('.hero-celestial-fx .celestial-ring'),s=getComputedStyle(h),rs=getComputedStyle(r);return{effects:document.documentElement.dataset.effects,src:v.currentSrc,width:v.videoWidth,height:v.videoHeight,duration:v.duration,time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames,heroAnimation:s.animationName,heroDuration:s.animationDuration,heroState:s.animationPlayState,ringAnimation:rs.animationName,ringDuration:rs.animationDuration,ringState:rs.animationPlayState};});
   assert.equal(state.effects,'on');assert(state.frames>0);assert.equal(state.heroAnimation,'celestial-levitate');assert.equal(state.heroState,'running');assert.equal(state.ringState,'running');
   const before=await p.locator('#heroCharacterImg').evaluate(el=>getComputedStyle(el).transform);await p.waitForTimeout(400);const after=await p.locator('#heroCharacterImg').evaluate(el=>getComputedStyle(el).transform);assert.notEqual(before,after);
   stats[game]=state;mark(`${game} decoded video, floating hero and rotating star planes`,state);
   if(game==='wangzhe')await p.screenshot({path:path.join(root,'docs/motion-desktop.png')});
   const card=p.locator('.character-card').first();await card.scrollIntoViewIfNeeded();await p.waitForTimeout(350);await card.hover();const box=await card.boundingBox();await p.mouse.move(box.x+box.width*.7,box.y+box.height*.35);await p.waitForTimeout(120);
   await p.waitForFunction(()=>document.querySelector('.character-card.is-tilting')?.style.getPropertyValue('--tilt-x'));
   const tilt=await card.evaluate(el=>({outer:getComputedStyle(el).transform,art:getComputedStyle(el.querySelector('.character-art')).transform}));assert.notEqual(tilt.outer,'none');assert.notEqual(tilt.art,'none');mark(`${game} original 3D card and artwork transform`,tilt);
   await p.locator(`[data-character="${id}"]`).first().click();await p.waitForSelector('.detail-art');await p.waitForTimeout(450);assert(await p.locator('.world-video').evaluate(v=>v.paused));
   const art=await p.locator('.detail-art').boundingBox();await p.mouse.move(art.x+art.width*.75,art.y+art.height*.25);await p.waitForFunction(()=>document.querySelector('.detail-art.is-projecting')?.style.getPropertyValue('--projection-x'));mark(`${game} original modal parallax and background pause`);
   await p.locator('#modalExitCross').click();await p.waitForFunction(()=>!document.querySelector('#characterDialog').open);await p.waitForFunction(()=>!document.querySelector('.world-video').paused);
   await p.locator('#effectsToggle').click();await p.waitForFunction(()=>document.documentElement.dataset.effects==='off');assert(await p.locator('.world-video').evaluate(v=>v.paused));await p.locator('#effectsToggle').click();await p.waitForFunction(()=>document.documentElement.dataset.effects==='on'&&!document.querySelector('.world-video').paused);mark(`${game} effect switch pauses and resumes original scene`);
   await ctx.close();
  }
  for(const field of ['heroAnimation','heroDuration','heroState','ringAnimation','ringDuration','ringState','width','height','duration'])assert.equal(stats.wangzhe[field],stats.genshin[field],field);mark('Wangzhe motion periods and decoded scene exactly match Genshin');
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.stack));await m.goto('http://127.0.0.1:8081',{waitUntil:'domcontentloaded'});await m.waitForFunction(()=>{const v=document.querySelector('.world-video');return v?.currentTime>.2&&v.currentSrc.includes('windrise-mobile')&&!v.paused;},{},{timeout:30000});await m.waitForTimeout(450);await m.screenshot({path:path.join(root,'docs/motion-mobile.png')});assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);mark('portrait original video decodes and plays without horizontal overflow');await mobile.close();
  const reduced=await browser.newContext({reducedMotion:'reduce'});const r=await reduced.newPage();await r.goto('http://127.0.0.1:8081',{waitUntil:'domcontentloaded'});await r.waitForSelector('.character-card');assert.equal(await r.evaluate(()=>document.documentElement.dataset.effects),'off');assert(await r.locator('.world-video').evaluate(v=>v.paused&&!v.getAttribute('src')));mark('same reduced-motion fallback as Genshin');await reduced.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'docs/motion-verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),method:'Isolated Chromium regression tests, no user browser profile',checks,errors},null,2));
 }finally{await browser.close();ref.closeAllConnections();await new Promise(r=>ref.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
