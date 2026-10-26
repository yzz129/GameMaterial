/** Native official portraits and palette metadata for every reused art component.
 * Originals are preserved; no character is redrawn, recolored or upscaled.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {artFingerprint,findSimilarArt} from './lib/art-similarity.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async file=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const catalog=await read('data/heroes.json'),sources=await read('source-snapshots/voices-sync-report.json'),skins=await read('data/skin-art.json');
const sourcePolicy=await read('data/hero-art-sources.json');
const sourceMap=new Map(sources.images.filter(a=>a.kind==='portrait').map(a=>[String(a.heroId),a]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const outputDir=path.join(root,'assets/hero-art'),masterDir=path.join(root,'source-snapshots/hero-art');
await fs.mkdir(outputDir,{recursive:true});await fs.mkdir(masterDir,{recursive:true});
const mapLimit=async(items,limit,fn)=>{const result=new Array(items.length);let index=0;await Promise.all(Array.from({length:limit},async()=>{while(index<items.length){const i=index++;result[i]=await fn(items[i],i);}}));return result;};

async function palette(file){
  const {data,info}=await sharp(file).removeAlpha().resize(36,48,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
  const buckets=new Map();
  for(let i=0;i<data.length;i+=info.channels){const r=data[i],g=data[i+1],b=data[i+2],max=Math.max(r,g,b)/255,min=Math.min(r,g,b)/255,s=max?1-min/max:0,l=(max+min)/2;
    if(s<.16||l<.14||l>.83)continue;
    const key=[r,g,b].map(v=>Math.floor(v/32)).join(','),weight=Math.pow(s,1.4)*(1-Math.abs(l-.48));
    const bucket=buckets.get(key)||{r:0,g:0,b:0,weight:0};bucket.r+=r*weight;bucket.g+=g*weight;bucket.b+=b*weight;bucket.weight+=weight;buckets.set(key,bucket);
  }
  const best=[...buckets.values()].sort((a,b)=>b.weight-a.weight)[0]||{r:149,g:207,b:255,weight:1};
  const raw=[best.r,best.g,best.b].map(v=>v/best.weight),low=Math.min(...raw),high=Math.max(...raw);
  const rgb=high-low>4?raw.map(v=>Math.round(120+(v-low)/(high-low)*112)):[149,207,255];
  return {accent:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),rgb:rgb.join(' ')};
}

const assets=await mapLimit(catalog.heroes,6,async hero=>{
  const id=String(hero.id),selection=sourcePolicy.heroes[id],baseSource=sourceMap.get(id),source=selection?{...baseSource,sourceUrl:selection.portraitUrl}:baseSource,version=selection?.version||2;if(!source?.sourceUrl)throw Error('Missing source for '+id);
  const index=path.join(masterDir,`${id}-source.json`);let bytes,sourceFile;
  try{const saved=JSON.parse(await fs.readFile(index,'utf8'));if(saved.sourceUrl!==source.sourceUrl)throw Error('Source changed');sourceFile=saved.file;bytes=await fs.readFile(path.join(root,sourceFile));if(sha(bytes)!==saved.sha256)throw Error('Source checksum changed');}catch{
    bytes=undefined;
    let failure;for(let attempt=0;attempt<3&&!bytes;attempt++)try{const response=await fetch(source.sourceUrl,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);const downloaded=Buffer.from(await response.arrayBuffer());const meta=await sharp(downloaded).metadata();if(!meta.width||!meta.height)throw Error('Not an image');bytes=downloaded;sourceFile=`source-snapshots/hero-art/${id}-portrait-source-v${version}.${meta.format}`;await fs.writeFile(path.join(root,sourceFile),bytes);await fs.writeFile(index,JSON.stringify({sourceUrl:source.sourceUrl,file:sourceFile,sha256:sha(bytes)}));}catch(error){failure=error;}if(!bytes)throw Error(`${hero.name}: ${failure}`);
  }
  const sourceMeta=await sharp(bytes).metadata(),file=`assets/hero-art/${id}-portrait-v${version}.webp`;
  const {data,info}=await sharp(bytes).rotate().webp({quality:92,effort:5}).toBuffer({resolveWithObject:true});await fs.writeFile(path.join(root,file),data);
  const cover=selection?.coverSkinId?skins.assets.find(a=>a.id===selection.coverSkinId):null;if(selection?.coverSkinId&&!cover)throw Error('Missing reviewed cover for '+id);
  return {heroId:id,name:hero.name,file,sourceFile,sourceUrl:source.sourceUrl,sourceSha256:sha(bytes),sha256:sha(data),width:info.width,height:info.height,sourceWidth:sourceMeta.width,sourceHeight:sourceMeta.height,bytes:data.length,channels:info.channels,version,license:'Tencent / respective rights holders',purpose:'Native-resolution official portrait in reused hero cards and character detail',palette:await palette(data),...(selection?{sourceSelection:selection.reason,sourceRecord:selection.sourceRecord,portraitPosition:selection.portraitPosition||'center top',coverFile:cover?.file,coverSourceUrl:cover?.sourceUrl}:{})};
});
const fingerprints=await mapLimit(assets,6,async a=>({...a,fingerprint:await artFingerprint(path.join(root,a.file))}));
const similarPairs=findSimilarArt(fingerprints,sourcePolicy.sharedIdentityGroups),unexpected=similarPairs.filter(p=>!p.intentional);
if(unexpected.length)throw Error('Unreviewed similar hero artwork: '+JSON.stringify(unexpected));
for(const a of assets)a.perceptualHash=fingerprints.find(f=>f.heroId===a.heroId).fingerprint.hash;
const skinDirections=await mapLimit(skins.assets,6,async skin=>({skinId:skin.id,heroId:skin.heroId,width:skin.width,height:skin.height,palette:await palette(path.join(root,skin.file))}));
await fs.writeFile(path.join(root,'data/hero-art.json'),JSON.stringify({version:3,updatedAt:new Date().toISOString(),policy:'Official native-resolution illustrations, preserved masters, no upscaling or character generation; display effects remain separate CSS layers',visualAudit:{heroCount:assets.length,comparedPairs:assets.length*(assets.length-1)/2,criteria:'64-bit dHash distance <= 16 and normalized RGB difference < 0.115; calibrated against the original differently cropped double portrait',unexpectedSimilarPairs:unexpected,reviewedSharedPairs:similarPairs.filter(p=>p.intentional)},assets,skins:skinDirections},null,2));
console.log(JSON.stringify({heroes:assets.length,skinPalettes:skinDirections.length,runtimeBytes:assets.reduce((n,a)=>n+a.bytes,0),nativeResolution:true,unexpectedSimilarPairs:unexpected.length}));
