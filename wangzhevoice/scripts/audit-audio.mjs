/** Exhaustive source-to-record, record-to-UI and media availability audit.
 * Node 22+, no credentials. Small range reads; does not download the archive.
 * Resume successful URL probes with --resume; metadata is always rechecked.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'source-snapshots/audio-audit');await fs.mkdir(folder,{recursive:true});
const read=async file=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const clean=v=>String(v??'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
const arr=v=>Array.isArray(v)?v:[];
const absolute=v=>v?.startsWith('//')?'https:'+v:v;
const sha=v=>createHash('sha256').update(v).digest('hex');
const startedAt=new Date().toISOString(),issues=[],sourceGaps=[],checks=[],sourceFetch=[];
const metadata={voiceRecords:0,voiceMatches:0,uiMatches:0,musicRecords:0,musicMatches:0,invalidOfficialRecords:[],duplicateOfficialRecords:0,localCacheMatches:0};
const urls=new Map(),cacheRows=[];
const pool=async(items,limit,fn)=>{let i=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(i<items.length){const at=i++;await fn(items[at],at);}}));};
async function request(url,options={}){let error;for(let n=0;n<3;n++){try{const r=await fetch(url,{...options,signal:AbortSignal.timeout(18000)});if(!r.ok){await r.body?.cancel();throw new Error('HTTP '+r.status);}return r;}catch(e){error=e;if(n<2)await new Promise(r=>setTimeout(r,250*(n+1)));}}throw error;}
async function official(url,file,fallback){try{const r=await request(url);let raw=await r.text();if(raw.trim().startsWith('createList'))raw=raw.trim().replace(/^createList\s*\(/,'').replace(/\)\s*;?$/,'');const data=JSON.parse(raw);await fs.writeFile(path.join(folder,file),JSON.stringify({url,checkedAt:new Date().toISOString(),data}));sourceFetch.push({url,ok:true});return data;}catch(e){sourceFetch.push({url,ok:false,error:e.message,usedSnapshot:!!fallback});return fallback;}}
const heroes=await read('data/heroes.json');
await pool(heroes.heroes,6,async h=>{
 const detail=await read(`data/heroes/${h.id}.json`),ui=await read(`data/characters/${h.id}.json`);
 let saved;try{saved=await read(`source-snapshots/voices-${h.id}.json`);}catch{}
 const url=`https://pvp.qq.com/zlkdatasys/yuzhouzhan/herovoice/${h.id}.json`,source=await official(url,`hero-${h.id}.json`,saved);
 const expected=new Map();for(const g of arr(source?.dqpfyy_5403)){const skin=clean(g.pfmczt_7754);for(const q of arr(g.yylbzt_9132)){const u=absolute(clean(q.yywjzt_5304));let valid=false;try{const p=new URL(u);valid=p.protocol==='https:'&&p.hostname==='game.gtimg.cn';}catch{}if(!valid){metadata.invalidOfficialRecords.push({heroId:h.id,hero:h.name,skin,text:clean(q.yywbzt_1517),url:u});continue;}const key=skin+'|'+u;if(expected.has(key)){metadata.duplicateOfficialRecords++;continue;}expected.set(key,{skin,text:clean(q.yywbzt_1517),category:clean(q.yygn_8632)||'其他语音',scene:clean(q.ssjqmc_1356),url:u});}}
 if(!expected.size)sourceGaps.push({heroId:h.id,hero:h.name,reason:'官方鉴赏接口未提供可用语音'});
 const uiLines=new Map([...ui.friendLines,...ui.actionLines].map(q=>[q.key,q]));
 for(const v of detail.voices){metadata.voiceRecords++;const key=v.skin+'|'+v.remoteUrl,e=expected.get(key);const fields=['text','category','scene'];if(e&&fields.every(f=>v[f]===e[f])&&v.heroId===h.id&&v.heroName===h.name){metadata.voiceMatches++;expected.delete(key);}else issues.push({type:'voice-source-mismatch',hero:h.name,skin:v.skin,id:v.id,expected:e||null,actual:v});
  const q=uiLines.get(v.id);if(q&&q.desc===v.text&&q.skinId===v.skinId&&q.skin===v.skin&&q.category===v.category&&q.audioUrl===v.url)metadata.uiMatches++;else issues.push({type:'voice-ui-mismatch',hero:h.name,id:v.id});
  if(!urls.has(v.remoteUrl))urls.set(v.remoteUrl,{url:v.remoteUrl,kind:'voice',refs:[]});urls.get(v.remoteUrl).refs.push({id:v.id,hero:h.name,skin:v.skin,text:v.text});
  if(/^\/?assets\//.test(v.url))cacheRows.push(v);
 }
 for(const e of expected.values())issues.push({type:'official-voice-not-in-catalog',hero:h.name,...e});
});
console.log(JSON.stringify({stage:'voice-source-mapping',...metadata,issues:issues.length,sourceGaps:sourceGaps.length}));
// Match every song to the official MP3 record or QQ song MID, not title alone.
const music=await read('data/music.json'),musicUI=await read('assets/audio/music/music_catalog.json');
const expectedMusic=new Map(),files=await fs.readdir(path.join(root,'source-snapshots/music'));
await pool(files.filter(f=>/^official-tracks-|^qq-/.test(f)),4,async file=>{
 const saved=await read('source-snapshots/music/'+file),source=await official(saved.url,'music-'+file,saved.data);
 if(file.startsWith('official'))for(const q of arr(source?.zjyllb_5a))expectedMusic.set(absolute(q.yp_b7),{title:clean(q.bt_fd),artist:clean(q.zz_69),url:absolute(q.yp_b7)});
 else for(const q of arr(source?.req_1?.data?.songList)){const s=q.songInfo;if(s?.mid)expectedMusic.set('qq-'+s.mid,{title:clean(s.title),artist:s.singer.map(a=>clean(a.title||a.name)).join(' / '),sourceUrl:`https://y.qq.com/n/ryqq/songDetail/${s.mid}`,album:clean(s.album?.title||s.album?.name),songMid:s.mid});}
});
for(const t of music.tracks){metadata.musicRecords++;const key=t.playable?t.audioSourceUrl:t.id,e=expectedMusic.get(key),u=musicUI.tracks.find(q=>q.id===t.id);const okay=e&&t.title===e.title&&t.artist===e.artist&&(t.playable?t.audioSourceUrl===e.url:(!t.url&&t.qqMusic.songMid===e.songMid&&t.sourceUrl===e.sourceUrl&&t.album===e.album));if(okay)metadata.musicMatches++;else issues.push({type:'music-source-mismatch',id:t.id,title:t.title,expected:e,actual:t});if(!u||u.src!==(t.playable?t.url:'')||u.title!==t.title)issues.push({type:'music-ui-mismatch',id:t.id});if(t.playable)urls.set(t.audioSourceUrl,{url:t.audioSourceUrl,kind:'music',refs:[{id:t.id,title:t.title,artist:t.artist}]});}
console.log(JSON.stringify({stage:'music-source-mapping',musicMatches:metadata.musicMatches,musicRecords:metadata.musicRecords,uniqueMedia:urls.size,issues:issues.length}));
function signature(b){const a=b.toString('ascii',0,4);if(a==='RIFF'&&b.toString('ascii',8,12)==='WAVE')return'wav';if(a==='OggS')return'ogg';if(a==='fLaC')return'flac';if(b.toString('ascii',0,3)==='ID3'||b[0]===255&&(b[1]&224)===224)return'mp3';if(b.toString('ascii',4,8)==='ftyp')return'm4a';return null;}
const probeFile=path.join(folder,'media-probes.ndjson'),prior=new Map();
if(process.argv.includes('--resume')){try{for(const l of(await fs.readFile(probeFile,'utf8')).split('\n').filter(Boolean)){try{const r=JSON.parse(l);if(r.ok&&Date.now()-Date.parse(r.checkedAt)<24*3600000)prior.set(r.url,r);}catch{}}}catch{}}
let done=0,fail=0,bytesRead=0;
await pool([...urls.values()],12,async item=>{
 let row=prior.get(item.url);if(!row){try{
  const r=await request(item.url,{headers:{Range:'bytes=0-4095'}}),reader=r.body.getReader(),parts=[];let size=0;while(size<4096){const p=await reader.read();if(p.done)break;parts.push(Buffer.from(p.value));size+=p.value.length;}await reader.cancel();const b=Buffer.concat(parts).subarray(0,4096),format=signature(b);if(!format)throw new Error('Unrecognized audio bytes');const total=Number(r.headers.get('content-range')?.split('/')[1]||r.headers.get('content-length'));if(!total||total<44)throw new Error('Empty or invalid media size');row={url:item.url,ok:true,status:r.status,format,bytes:total,probeBytes:b.length,headerSha256:sha(b),contentType:r.headers.get('content-type'),checkedAt:new Date().toISOString()};bytesRead+=b.length;
 }catch(e){row={url:item.url,ok:false,error:e.message,checkedAt:new Date().toISOString()};}
 await fs.appendFile(probeFile,JSON.stringify(row)+'\n');}
 checks.push({...row,kind:item.kind,refs:item.refs});done++;if(!row.ok)fail++;if(done%500===0||done===urls.size)console.log(JSON.stringify({stage:'media-probes',done,total:urls.size,failed:fail,megabytesRead:(bytesRead/1048576).toFixed(1)}));
});
await pool(cacheRows,3,async v=>{try{const local=await fs.readFile(path.join(root,v.url)),r=await request(v.remoteUrl),remote=Buffer.from(await r.arrayBuffer());if(!local.equals(remote))throw new Error('Cached bytes differ from the linked official audio');metadata.localCacheMatches++;}catch(e){issues.push({type:'cache-mismatch',id:v.id,hero:v.heroName,error:e.message});}});
const unavailable=checks.filter(r=>!r.ok),finishedAt=new Date().toISOString();
const result={startedAt,finishedAt,scope:'All catalog records and unique playable URLs; authoritative source mapping and file signatures, not speech transcription of every clip',metadata,sourceGaps,sourceRequests:sourceFetch,issues,media:{unique:checks.length,passed:checks.length-unavailable.length,failed:unavailable.length,voiceUnique:checks.filter(x=>x.kind==='voice').length,musicUnique:checks.filter(x=>x.kind==='music').length,unavailable},checks};
await fs.writeFile(path.join(folder,'report.json'),JSON.stringify(result,null,2));
await fs.writeFile(path.join(root,'data/audio-audit.json'),JSON.stringify({startedAt,finishedAt,scope:result.scope,metadata,sourceGaps,issues,media:{...result.media,unavailable:unavailable.map(r=>({url:r.url,error:r.error,refs:r.refs}))},sourceRequests:{fresh:sourceFetch.filter(r=>r.ok).length,fallback:sourceFetch.filter(r=>!r.ok&&r.usedSnapshot).length,unavailable:sourceFetch.filter(r=>!r.ok&&!r.usedSnapshot).length}}));
if(!issues.length&&!unavailable.length){Object.assign(heroes.coverage,{mediaValidation:'all-unique-url-audio-signatures',checkedAudioCount:metadata.voiceRecords,verifiedAudioCount:metadata.voiceRecords,uniqueAudioCount:result.media.voiceUnique,metadataMappingMatches:metadata.voiceMatches,uiMappingMatches:metadata.uiMatches,mediaAuditAt:finishedAt,note:'已逐条核对官方目录、皮肤、台词及播放器数据，并对全部独立音源验证访问与音频文件头；不等于逐句人工听辨。未公开或缺少地址的资源单列。'});await fs.writeFile(path.join(root,'data/heroes.json'),JSON.stringify(heroes));}
console.log(JSON.stringify({stage:'complete',metadata,unique:checks.length,passed:checks.length-unavailable.length,failed:unavailable.length,issues:issues.length,report:'source-snapshots/audio-audit/report.json'}));
if(issues.length||unavailable.length)process.exitCode=1;
