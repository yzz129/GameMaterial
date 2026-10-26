import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inspectGame,readJSON,writeJSON,localPath} from './config.mjs';
import {prepareGame} from './prepare.mjs';
import {buildGame} from './build.mjs';

const engine=path.dirname(fileURLToPath(import.meta.url));
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=value=>String(value).normalize('NFKC').toLowerCase();
function motionProfile(profile){
  if(!profile)return '';
  const valid=(values,length)=>Array.isArray(values)&&values.length===length&&values.every(value=>Number.isFinite(value));
  if(!Array.isArray(profile.regions)||profile.regions.length>8||profile.regions.some(region=>!valid(region.area,4)||!valid(region.motion,4))||(profile.locks||[]).length>4||(profile.locks||[]).some(lock=>!valid(lock,4))||(profile.lines||[]).length>2||(profile.lines||[]).some(line=>!valid(line.points,4)||!Number.isFinite(line.width)))throw Error('门户局部动效配置无效');
  return ` data-motion-profile="${escape(JSON.stringify(profile))}"`;
}
function letteringArt(art,text,className,basePath='/portal-assets/'){
  if(!art||art.text!==text)return null;
  if(typeof art.src!=='string'||!art.src.endsWith('.webp')||![art.width,art.height].every(size=>Number.isInteger(size)&&size>0&&size<=4096))throw Error('门户书法字稿配置无效');
  localPath(engine,art.src);
  return `<span class="lettering-art ${className}" style="--lettering-mask:url(${escape(JSON.stringify(basePath+art.src))})"><span class="sr-only">${escape(text)}</span><img src="${escape(basePath+art.src)}" alt="" aria-hidden="true" width="${art.width}" height="${art.height}" decoding="async" loading="${className==='section-title-art'?'eager':'lazy'}"></span>`;
}
function titleArt(settings){
  const art=settings.titleArt;
  if(!art||art.text!==settings.heading)return {html:escape(settings.heading),files:[],preload:'',headingClass:'',layoutClass:''};
  const variants=[art.desktop,art.mobile];
  for(const variant of variants)if(!variant||![variant.still,variant.motion].every(name=>/^[A-Za-z0-9_-]+\.webp$/.test(name))||![variant.width,variant.height].every(size=>Number.isInteger(size)&&size>0&&size<=4096))throw Error('门户艺术字素材配置无效');
  const url=name=>'/portal-assets/'+escape(name),mobileMedia='(max-width: 680px) and (orientation: portrait)';
  return {files:variants.flatMap(variant=>[variant.still,variant.motion]),headingClass:'has-title-art',layoutClass:'has-title-visual',
    preload:`<link rel="preload" href="${url(art.desktop.still)}" as="image" media="(min-width: 681px), (orientation: landscape)"><link rel="preload" href="${url(art.mobile.still)}" as="image" media="${mobileMedia}">`,
    html:`<span class="sr-only title-copy">${escape(settings.heading)}</span><picture class="title-art" data-title-motion aria-hidden="true"><source media="${mobileMedia}" srcset="${url(art.mobile.still)}" data-still-src="${url(art.mobile.still)}" data-motion-src="${url(art.mobile.motion)}" width="${art.mobile.width}" height="${art.mobile.height}"><img src="${url(art.desktop.still)}" data-still-src="${url(art.desktop.still)}" data-motion-src="${url(art.desktop.motion)}" alt="" width="${art.desktop.width}" height="${art.desktop.height}" decoding="async" fetchpriority="high"></picture>`};
}
export async function portalGames(workspace){
  const registry=await readJSON(path.join(workspace,'games.json')),seen=new Set(),games=[];
  for(const entry of registry.games){
    const slug=entry.slug||entry.id;
    if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)||['api','portal-assets','assets'].includes(slug)||seen.has(slug))throw Error(`游戏英文路由无效或重复：${slug}`);
    seen.add(slug);
    const directory=localPath(workspace,entry.directory),data=await inspectGame(directory),display=data.config.portal||{};
    const first=data.catalog.find(character=>character.id===data.config.home.characterId)||data.catalog[0];
    const art=display.art||{background:first?.heroArt||first?.splashArt||data.config.assets.placeholder};
    const name=display.name||data.config.brand.shortName,cardTitleArt=display.titleArt?.text===name?display.titleArt:null;
    for(const file of [art.background,art.character,art.video?.desktop,art.video?.mobile,display.wordmark,cardTitleArt?.src].filter(Boolean))await fs.access(localPath(directory,file));
    const basePath=`/${slug}/`,asset=file=>file?basePath+file.replace(/^\/+/,''):null;
    games.push({id:entry.id,slug,directory,basePath,data,name,englishName:display.englishName||data.config.brand.englishName,unit:display.characterUnit||'位角色',voiceUnit:display.voiceUnit||'条台词',description:display.description||data.config.brand.description,titleArt:cardTitleArt,wordmark:asset(display.wordmark),font:asset(data.config.assets.fontBold||data.config.assets.font),art:{background:asset(art.background),character:asset(art.character),position:art.position||'center',backgroundMotion:art.backgroundMotion,characterMotion:art.characterMotion,video:art.video?{desktop:asset(art.video.desktop),mobile:asset(art.video.mobile)}:null},accent:display.accent||'#e4c995',search:normalize([display.name,data.config.brand.title,data.config.brand.world,entry.id,slug,...(display.keywords||[]),...data.catalog.flatMap(character=>[character.name,character.enName])].join(' '))});
  }
  return games;
}

function gameCard(game,index){
  const number=value=>Number(value).toLocaleString('en-US');
  const name=letteringArt(game.titleArt,game.name,'world-title-art',game.basePath)||(game.wordmark?`<img class="world-logo" src="${escape(game.wordmark)}" alt="${escape(game.name)}" width="475" height="369" decoding="async">`:escape(game.name));
  return `<a class="world-card" data-motion-group data-game="${escape(game.id)}" data-layered="${Boolean(game.art.character)}" data-search="${escape(game.search)}" href="${game.basePath}" aria-label="进入${escape(game.name)}档案" style="--accent:${escape(game.accent)};--art-position:${escape(game.art.position)}">
  <div class="world-background"${motionProfile(game.art.backgroundMotion)}><img class="motion-source" src="${escape(game.art.background)}" alt="" width="960" height="900" decoding="async" loading="${index===0?'eager':'lazy'}">${game.art.video?`<video class="world-video" data-scene-video data-desktop-src="${escape(game.art.video.desktop)}" data-mobile-src="${escape(game.art.video.mobile||game.art.video.desktop)}" muted playsinline loop preload="none" aria-hidden="true" tabindex="-1"></video>`:''}</div>
  ${game.art.character?`<div class="world-character"${motionProfile(game.art.characterMotion)}><img class="motion-source" src="${escape(game.art.character)}" alt="" width="900" height="1200" decoding="async" loading="${index===0?'eager':'lazy'}"></div>`:''}
  <span class="world-atmosphere" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  <span class="world-shade" aria-hidden="true"></span><div class="world-content"><h3>${name}</h3><p class="world-english">${escape(game.englishName)}</p><p class="world-meta"><span><strong>${number(game.data.catalog.length)}</strong> ${escape(game.unit)}</span><span class="meta-separator" aria-hidden="true">/</span><span><strong>${number(game.data.voices)}</strong> ${escape(game.voiceUnit)}</span></p><div class="world-bottom"><span class="world-enter"><span>进入档案</span><span class="enter-orbit"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M4 4h12v12"/></svg></span></span><span class="entry-rule" aria-hidden="true"></span></div></div></a>`;
}

export async function buildPortal(workspace,{onProgress=()=>{}}={}){
  const settings=await readJSON(path.join(workspace,'portal.config.json'));
  if(settings.schemaVersion!==1||!/^[a-z0-9.-]+$/.test(settings.domain)||!/^[a-z][a-z0-9-]*$/.test(settings.output))throw Error('门户配置无效');
  const output=localPath(workspace,settings.output),cache=localPath(workspace,'.portal-cache');
  await fs.mkdir(output,{recursive:true});await fs.mkdir(cache,{recursive:true});
  const games=await portalGames(workspace),media={},workerGames=[],summaries=[];
  for(const game of games){
    onProgress(`正在构建 ${game.name} ${game.basePath}`);
    const generatedRoot=path.join(cache,game.slug);await fs.mkdir(generatedRoot,{recursive:true});
    await prepareGame(game.directory,{outputRoot:generatedRoot,basePath:game.basePath});
    const result=await buildGame(game.directory,{generatedRoot,outputRoot:localPath(output,game.slug),statePath:path.join(generatedRoot,'build-files.json'),target:'cloudflare',embedded:true});
    let index={};try{index=await readJSON(path.join(result.output,'assets/media-index.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
    for(const [relative,asset]of Object.entries(index))media[game.basePath+relative.slice(1)]={...asset,parts:asset.parts.map(part=>({...part,path:game.basePath+part.path.replace(/^\/+/, '')}))};
    workerGames.push({basePath:game.basePath,proxy:Boolean(game.data.config.music.proxy),policy:game.data.config.music.proxySources||[],sources:Object.fromEntries(game.data.music.tracks.filter(track=>track.streamUrl).map(track=>[track.id,track.streamUrl]))});
    summaries.push({id:game.id,slug:game.slug,characters:game.data.catalog.length,voices:game.data.voices,music:game.data.music.tracks.length,files:result.files});
  }
  const source=path.join(workspace,'portal'),assets=path.join(output,'portal-assets');await fs.mkdir(assets,{recursive:true});
  const title=titleArt(settings),css=await fs.readFile(path.join(source,'portal.css'),'utf8');
  const js=await fs.readFile(path.join(source,'portal.js'),'utf8');
  const motion=await fs.readFile(path.join(source,'portal-motion.js'),'utf8');
  const version=crypto.createHash('sha256').update(css+js+motion).digest('hex').slice(0,12);
  await fs.writeFile(path.join(assets,'portal-motion.js'),motion);
  await fs.writeFile(path.join(assets,'portal.css'),css);await fs.writeFile(path.join(assets,'portal.js'),js);await fs.copyFile(path.join(source,'mark.svg'),path.join(assets,'mark.svg'));
  for(const entry of await fs.readdir(path.join(source,'assets'),{withFileTypes:true}))if(entry.isFile()&&/\.(?:webp|woff2|mp4|txt)$/.test(entry.name))await fs.copyFile(path.join(source,'assets',entry.name),path.join(assets,entry.name));
  const gamesTitle=settings.gamesTitle||'选择你的世界';
  const sectionArt=letteringArt(settings.sectionTitleArt,gamesTitle,'section-title-art');
  const footerArt=letteringArt(settings.taglineArt,settings.tagline,'footer-title-art');
  for(const art of [sectionArt&&settings.sectionTitleArt,footerArt&&settings.taglineArt].filter(Boolean))await fs.access(localPath(assets,art.src));
  const footer=settings.footerVideo;
  if(footer){for(const key of ['src','poster']){if(!/^[A-Za-z0-9_-]+\.(?:mp4|webp)$/.test(footer[key]||''))throw Error('门户视频素材配置无效');await fs.access(path.join(assets,footer[key]));}}
  let html=await fs.readFile(path.join(source,'index.html'),'utf8');
  const values={DESCRIPTION:escape(settings.description),INTRO_DESCRIPTION:escape(settings.description).replace('，','<br>'),ORIGIN:'https://'+settings.domain,TITLE:escape(settings.title),NAME:escape(settings.name),ENGLISH_NAME:escape(settings.englishName),HEADING:title.html,TITLE_CLASS:title.headingClass,TITLE_LAYOUT_CLASS:title.layoutClass,TITLE_PRELOAD:title.preload,GAME_COUNT:String(games.length).padStart(2,'0'),GAME_CARDS:games.map(gameCard).join('\n'),GAME_TYPE_STYLES:games.filter(game=>game.font&&!game.wordmark).map(game=>`@font-face{font-family:World-${game.slug};src:url('${game.font}');font-display:swap}.world-card[data-game="${game.id}"] h3{font-family:World-${game.slug},var(--display)}`).join('\n'),TAGLINE:escape(settings.tagline).replace('，','<br>'),FOOTER_MEDIA:footer?`<img class="footer-poster" src="/portal-assets/${footer.poster}" alt="" width="1248" height="704" loading="lazy"><video id="footerVideo" class="footer-video" data-src="/portal-assets/${footer.src}" poster="/portal-assets/${footer.poster}" muted playsinline webkit-playsinline loop preload="none" aria-hidden="true" tabindex="-1"></video>`:'',FOOTER_CONTROL:footer?'<button class="footer-motion" id="footerMotion" type="button" aria-label="播放背景视频"><span class="motion-symbol" aria-hidden="true"></span><span class="motion-label">播放背景视频</span></button>':'',YEAR:String(new Date().getUTCFullYear()),VERSION:version};
  values.GAMES_HEADING=sectionArt||escape(gamesTitle);
  values.TAGLINE=footerArt||values.TAGLINE;
  values.AURA_MOTION=motionProfile(settings.backgroundMotion);
  values.FOOTER_MEDIA=values.FOOTER_MEDIA.replace('data-src=', 'data-scene-video data-desktop-src=');
  values.FOOTER_CONTROL=values.FOOTER_CONTROL.replaceAll('播放背景视频','暂停页面动效');
  html=html.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>values[key]??'');
  await fs.writeFile(path.join(output,'index.html'),html);
  const video=await fs.readFile(path.join(engine,'node/video-response.mjs'),'utf8'),music=await fs.readFile(path.join(engine,'node/music-stream.mjs'),'utf8');
  const worker=`${video}\n${music}\nconst games=${JSON.stringify(workerGames)};\nconst media=${JSON.stringify(media)};\nexport default {async fetch(request,env){const url=new URL(request.url),pathname=url.pathname;const game=games.find(game=>pathname===game.basePath.slice(0,-1)||pathname.startsWith(game.basePath));if(game&&pathname===game.basePath.slice(0,-1)){url.pathname=game.basePath;return Response.redirect(url.href,308);}if(game&&pathname===game.basePath+'api/music-stream'){if(!game.proxy)return new Response('Not found',{status:404});return serveMusicStream(request,game.sources,fetch,game.policy);}const asset=media[pathname];if(asset)return serveVideo(request,asset,(relative,headers)=>env.ASSETS.fetch(new Request(new URL(relative,request.url),{headers,signal:request.signal})));return env.ASSETS.fetch(request);}};\n`;
  await fs.writeFile(path.join(output,'_worker.js'),worker);
  const include=[...Object.keys(media),...workerGames.map(game=>game.basePath.slice(0,-1)),...workerGames.filter(game=>game.proxy).map(game=>game.basePath+'api/music-stream')];
  await writeJSON(path.join(output,'_routes.json'),{version:1,include:include.length<=100?include:workerGames.map(game=>game.basePath+'*'),exclude:[]});
  await fs.writeFile(path.join(output,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: no-cache\n'+games.map(game=>`${game.basePath}assets/*\n  Cache-Control: public, max-age=86400, must-revalidate\n`).join(''));
  await fs.writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: https://${settings.domain}/sitemap.xml\n`);
  await fs.writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${settings.domain}/</loc></url>${games.map(game=>`<url><loc>https://${settings.domain}${game.basePath}</loc></url>`).join('')}</urlset>`);
  await fs.writeFile(path.join(output,'404.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>世界尚未收录｜${escape(settings.name)}</title><link rel="stylesheet" href="/portal-assets/portal.css"><main class="search-empty" style="min-height:100vh;border:0"><h1>这个世界，还在路上</h1><p>你访问的页面暂未收录</p><a class="world-enter" href="/">返回游戏档案 ↗</a></main></html>`);
  const summary={domain:settings.domain,output,games:summaries,mediaFiles:Object.keys(media).length};
  await writeJSON(path.join(cache,'latest-build.json'),summary);return summary;
}
