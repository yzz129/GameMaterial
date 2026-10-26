import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const heroes=JSON.parse(await fs.readFile(path.join(root,'data/heroes.json'),'utf8'));
const music=JSON.parse(await fs.readFile(path.join(root,'data/music.json'),'utf8'));
let skinArt=new Map();try{skinArt=new Map(JSON.parse(await fs.readFile(path.join(root,'data/skin-art.json'),'utf8')).assets.map(a=>[a.id,a]));}catch{}
let musicDurations=new Map();try{musicDurations=new Map(JSON.parse(await fs.readFile(path.join(root,'data/music-media.json'),'utf8')).tracks.filter(t=>t.ok).map(t=>[t.id,t.duration]));}catch{}
let characterCutouts=new Map();try{characterCutouts=new Map(JSON.parse(await fs.readFile(path.join(root,'data/character-cutouts.json'),'utf8')).assets.map(a=>[a.skinId,a]));}catch{}
let heroArtwork=new Map(),skinDirections=new Map();try{const art=JSON.parse(await fs.readFile(path.join(root,'data/hero-art.json'),'utf8'));heroArtwork=new Map(art.assets.map(a=>[a.heroId,a]));skinDirections=new Map(art.skins.map(s=>[s.skinId,s]));}catch{}
const roles=['战士','法师','坦克','刺客','射手','辅助'];
const regions=[...new Set(heroes.heroes.map(h=>h.region||'其他'))];
const factions=[...new Set(heroes.heroes.map(h=>h.faction||'其他'))];
const catalog=[],search=[];
await fs.mkdir(path.join(root,'data/characters'),{recursive:true});
for(const h of heroes.heroes){
  const d=JSON.parse(await fs.readFile(path.join(root,`data/heroes/${h.id}.json`),'utf8'));
  const c={id:Number(h.id),name:h.name,enName:h.slug,title:h.title,element:h.roles[0],roles:h.roles,region:h.region||'其他',rarity:h.voiceCount?1:0,weapon:h.faction||'其他',birthday:'',constellation:'',description:h.voiceCount?`${h.skinCount} 款皮肤档案 · ${h.voiceCount} 条官方语音`:'官方尚未公开可用语音，已收录英雄与皮肤档案。',affiliation:h.faction||'',cv:{chinese:'',japanese:'',english:''},avatarImg:h.portrait,cardArt:h.portrait,splashArt:h.portrait,fullArt:h.portrait,heroArt:h.id==='131'?'assets/hero-libai.webp':h.cover,fullArtWidth:727,fullArtHeight:1071,quoteCount:h.voiceCount,skinCount:h.skinCount,skins:h.skins,hasLocalPack:false,voicePackageUrl:'',preview:d.voices[0]?.text||h.title,metadataSearch:[h.name,h.slug,h.title,...h.roles,h.region,h.faction,...h.skins.map(s=>s.name)].join(' ').normalize('NFKC').toLowerCase(),officialPage:h.officialPage,sourceUrl:h.sourceUrl};
  const portrait=heroArtwork.get(String(h.id));
  Object.assign(c,{artEdition:'celestial',artAccent:portrait?.palette.accent||'#95cfff',artRgb:portrait?.palette.rgb||'149 207 255',artAccentSecondary:'#f4d494',artCredit:'官方英雄插画',artScene:c.heroArt});
  if(portrait)Object.assign(c,{cardArt:portrait.file,fullArt:portrait.file,fullArtWidth:portrait.width,fullArtHeight:portrait.height});
  if(portrait?.sourceSelection)Object.assign(c,{avatarImg:portrait.file,splashArt:portrait.file,portraitPosition:portrait.portraitPosition,heroArt:portrait.coverFile||c.heroArt,artScene:portrait.coverFile||c.heroArt});
  c.skins=h.skins.map(s=>({...s,art:skinArt.get(s.id)?.file||'',artSource:skinArt.get(s.id)?.sourceUrl||'',artDirection:skinDirections.get(s.id)||null,cutoutArt:characterCutouts.get(s.id)?.file||''}));
  const cutout=characterCutouts.get(c.skins[0]?.id);if(cutout)Object.assign(c,{fullArt:cutout.file,fullArtWidth:cutout.width,fullArtHeight:cutout.height,fullArtTransparent:true,artCredit:'角色立绘'});
  const lines=d.voices.map(v=>({key:v.id,title:`${v.skin} · ${v.category}`,desc:v.text,skinId:v.skinId,skin:v.skin,category:v.category,audioUrl:v.url,remoteAudio:v.remoteUrl||v.url,localAudio:/^\/?assets\//.test(v.url)?v.url:null}));
  const friendLines=lines.filter(v=>v.category.includes('大厅'));
  const actionLines=lines.filter(v=>!v.category.includes('大厅'));
  catalog.push(c);search.push({id:c.id,text:[c.metadataSearch,...lines.map(l=>`${l.title} ${l.desc}`)].join(' ').normalize('NFKC').toLowerCase()});
  await fs.writeFile(path.join(root,`data/characters/${c.id}.json`),JSON.stringify({...c,friendLines,actionLines}));
}
await fs.writeFile(path.join(root,'data/catalog.json'),JSON.stringify(catalog));
await fs.writeFile(path.join(root,'data/teyvat-search-index.json'),JSON.stringify(search));
const mmss=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const musicTracks=music.tracks.map(t=>({...t,name:t.title,titleZh:t.title,region:t.category,src:t.playable?t.url:'',streamUrl:t.playable&&!t.url.startsWith('/')&&!t.url.startsWith('assets/')?t.url:'',localUrl:/^\/?assets\//.test(t.url)?t.url:'',isLocal:/^\/?assets\//.test(t.url),sourceDuration:t.duration,duration:mmss(musicDurations.get(t.id)||t.duration||0),quality:t.playable?'官方公开原声':'QQ 音乐收听',desc:t.subtitle||`${t.album} · ${t.artist}`}));
await fs.mkdir(path.join(root,'assets/audio/music'),{recursive:true});
await fs.writeFile(path.join(root,'assets/audio/music/music_catalog.json'),JSON.stringify({...music,tracks:musicTracks}));
await fs.writeFile(path.join(root,'wangzhe-data.js'),`window.WANGZHE_DATA=${JSON.stringify({roles,regions,factions,coverage:heroes.coverage,musicCoverage:music.coverage,musicTracks:musicTracks.filter(t=>t.playable)})};\n`);

console.log(`Prepared ${catalog.length} character archives and ${musicTracks.length} music tracks.`);
