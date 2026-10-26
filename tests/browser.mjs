// Requires an existing Playwright installation; screenshots go to the OS temp directory.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {readJSON,writeJSON} from '../engine/config.mjs';
import {prepareGame} from '../engine/prepare.mjs';
import {buildGame} from '../engine/build.mjs';
import {addGame} from '../engine/scaffold.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {createGameServer}=require('../engine/node/server.cjs');
const output=await fs.mkdtemp(path.join(os.tmpdir(),'game-archive-browser-'));
const workspace=await fs.mkdtemp(path.join(os.tmpdir(),'game-archive-fixture-'));
const servers=[],checks=[],errors=[];
const start=async server=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));servers.push(server);return `http://127.0.0.1:${server.address().port}`};
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
try{
  await writeJSON(path.join(workspace,'games.json'),{schemaVersion:1,games:[]});
  await addGame(workspace,{id:'nebula-test',name:'星河档案',port:18082});
  const third=path.join(workspace,'nebula-testvoice');
  const thirdConfig=await readJSON(path.join(third,'game.config.json'));thirdConfig.theme.dark['--gold']='#ff7a59';
  await writeJSON(path.join(third,'game.config.json'),thirdConfig);
  const catalog=await readJSON(path.join(third,'data/catalog.json'));catalog[0].quoteCount=1;catalog[0].name='星河旅人';
  await writeJSON(path.join(third,'data/catalog.json'),catalog);
  await writeJSON(path.join(third,'data/characters/1.json'),{...catalog[0],friendLines:[{key:'greeting-1',title:'初次见面',desc:'来自新世界的第一声问候。'}],actionLines:[]});
  await prepareGame(third);const built=await buildGame(third);
  for(const [directory,id] of [[path.join(root,'yuanshenvoice'),'yuanshen'],[path.join(root,'wangzhevoice'),'wangzhe'],[third,'nebula-test']]){
    const config=await readJSON(path.join(directory,'game.config.json'));
    const base=await start(createGameServer(directory));
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addInitScript(()=>{const NativeAudio=window.Audio;window.__qaAudio=[];window.Audio=function(...args){const audio=new NativeAudio(...args);window.__qaAudio.push(audio);return audio};window.Audio.prototype=NativeAudio.prototype});
    const page=await context.newPage(),bad=[];
    page.on('pageerror',error=>errors.push(`${id}: ${error.stack}`));
    page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400)bad.push(`${response.status()} ${response.url()}`)});
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.character-card').first().waitFor();
    assert.equal(await page.title(),config.brand.title);assert.equal(await page.locator('.brand strong').innerText(),config.brand.shortName);
    if(!config.home.titleArt?.still){const title=await page.locator('.hero-title-text').boundingBox();assert(title.width>100&&title.height>30,'text hero title must remain visible without title artwork');}
    assert(!(await page.locator('body').innerText()).includes('${'),'unexpanded template');
    await page.screenshot({path:path.join(output,`${id}-desktop.png`),animations:'disabled'});
    await page.locator('#masterSearchInput').fill('不存在的角色测试zzzz');await page.locator('#charConstellationGrid .empty-state').waitFor();
    await page.locator('[data-action="reset"]').click();await page.locator('.character-card').first().waitFor();
    const firstElement=config.filters.elements[0]?.name;
    if(firstElement){await page.locator(`[data-element="${firstElement}"]`).click();assert(await page.locator('.character-card').count()>0);await page.locator('#resetFilters').click();}
    await page.locator(`[data-character="${config.home.characterId}"]`).first().click();await page.locator('.quote-card').first().waitFor();
    if(config.features.skins&&id==='wangzhe'){
      const detail=await readJSON(path.join(directory,'data/characters/131.json')),skin=detail.skins.find(s=>s.name==='凤求凰');
      await page.locator('#skinSelect').selectOption(skin.id);assert.equal(await page.locator('.quote-card').count(),detail.friendLines.filter(line=>line.skinId===skin.id).length);
      await page.locator('[data-quote-tab="action"]').click();assert.equal(await page.locator('.quote-card').count(),detail.actionLines.filter(line=>line.skinId===skin.id).length);
      await page.locator('[data-quote-tab="friend"]').click();await page.locator('#skinSelect').selectOption('all');
      await page.locator('[data-quote-action="read"]').first().click();await page.waitForFunction(()=>document.querySelector('#masterAudio').currentTime>0.1,{},{timeout:20000});
      assert.equal(await page.locator('.quote-card.playing').count(),1);assert((await page.locator('#audioPlayer').boundingBox()).height<130,'player must not cover dialogue controls');await page.locator('#masterPlayToggleBtn').click();
    }
    await page.locator('[data-quote-action="favorite"]').first().click();assert.equal(await page.locator('#favCounter').innerText(),'1');
    await page.locator('#artworkToggle').click();assert.equal(await page.locator('#artworkToggle').getAttribute('aria-expanded'),'true');await page.locator('#artworkToggle').click();
    await page.screenshot({path:path.join(output,`${id}-detail.png`),animations:'disabled'});
    await page.locator('#modalExitCross').click();
    if(await page.locator('#audioPlayer').isVisible())await page.locator('#closePlayer').click();
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('.character-card').first().waitFor();assert.equal(await page.locator('#favCounter').innerText(),'1');
    await page.locator('#themeToggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('.character-card').first().waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.locator('#themeToggle').click();
    if(config.features.music){
      await page.locator('#musicPillOpen').click();await page.waitForFunction(()=>Array.isArray(window.musicBox.fullCatalog));
      await page.locator('.music-tab-btn[data-tab="local"]').click();assert(await page.locator('.music-track-item').count()>0);
      if(id==='yuanshen'){
        if(!await page.evaluate(()=>window.musicBox.playing))await page.locator('#musicModalPlay').click();
        await page.waitForFunction(()=>window.__qaAudio.some(audio=>audio.currentTime>0.1),{},{timeout:20000});
        await page.locator('#musicModalPlay').click();
      }
      await page.locator('#musicSearchInput').fill('不存在的曲目zzzz');await page.locator('.music-empty-state').waitFor();
      await page.locator('#musicBoxClose').click();
    }
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.character-card').first().waitFor();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${id}: horizontal overflow at ${width}px`);
      await page.locator(`[data-character="${config.home.characterId}"]`).first().click();await page.locator('.quote-card').first().waitFor();
      assert(await page.evaluate(()=>document.querySelector('#characterDialog').getBoundingClientRect().width<=window.innerWidth+1));
      if(width===390)await page.screenshot({path:path.join(output,`${id}-mobile.png`),animations:'disabled'});
      await page.locator('#modalExitCross').click();
    }
    await page.goto(`${base}/voice_index.html?character=${config.home.characterId}`,{waitUntil:'domcontentloaded'});await page.locator('.index-voice').first().waitFor();
    if(config.legacy){await page.goto(`${base}/${config.legacy.route}?legacy=1`,{waitUntil:'domcontentloaded'});await page.locator('.index-voice').first().waitFor();assert.equal((await page.locator('#resultCount').innerText()).replaceAll(',',''),String(config.legacy.count));}
    if(id==='nebula-test'){
      assert.doesNotMatch(await page.locator('body').innerText(),/原神|提瓦特|王者荣耀|纳西妲|蒙德/);
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()),'#ff7a59');
    }
    assert.deepEqual(bad,[],`${id}: local resource failures`);
    checks.push({id,desktop:1440,mobile:[390,320],search:true,detail:true,skins:config.features.skins,favorites:true,theme:true,index:true,localResources:true});
    console.log('PASS',id);await context.close();
  }
  // Serve the third game's output from a plain static server with no engine or config files.
  const staticBase=await start(http.createServer(async(req,res)=>{try{const relative=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';const file=path.resolve(built.output,relative);if(!file.startsWith(built.output+path.sep))throw Error();const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.html':'text/html'})[path.extname(file)]||'application/octet-stream'});res.end(bytes)}catch{res.writeHead(404);res.end()}}));
  const portable=await browser.newPage();portable.on('pageerror',error=>errors.push(`portable: ${error.message}`));await portable.goto(staticBase);await portable.locator('.character-card').first().waitFor();assert.equal(await portable.locator('.brand strong').innerText(),'星河档案');await portable.close();
  assert.deepEqual(errors,[]);
  await writeJSON(path.join(output,'result.json'),{passed:true,browser:'Chrome / Playwright',browserPlugin:'Browser plugin not available',checks,portableStaticBuild:true,errors});
  console.log(JSON.stringify({passed:true,output,checks:checks.length,portableStaticBuild:true}));
}finally{
  await browser.close();for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await fs.rm(workspace,{recursive:true,force:true});
}
