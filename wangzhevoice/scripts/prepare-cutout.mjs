/** Register a reviewed transparent derivative, preserving the generated master. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,v,i,all)=>{if(v.startsWith('--'))pairs.push([v.slice(2),all[i+1]]);return pairs;},[]));
if(!/^\d+$/.test(args.hero)||!/^\d+-[a-f0-9]+$/.test(args.skin)||!args.source)throw Error('Expected --hero ID --skin SKIN_ID --source PNG');
const generated=await fs.readFile(args.source),meta=await sharp(generated).metadata();
if(!meta.hasAlpha)throw Error('Cutout must contain transparency');
const {data,info}=await sharp(generated).ensureAlpha().raw().toBuffer({resolveWithObject:true});let clear=0,opaque=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;if(data[i]===255)opaque++;}const ratio=clear/(info.width*info.height);if(ratio<.1||ratio>.85||!opaque)throw Error('Unusable cutout alpha');
const master=`source-snapshots/character-cutouts/${args.skin}-cutout-v1.png`,file=`assets/characters/${args.skin}-cutout-v1.webp`;
await fs.mkdir(path.dirname(path.join(root,master)),{recursive:true});await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.copyFile(args.source,path.join(root,master));
const bytes=await sharp(generated).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();await fs.writeFile(path.join(root,file),bytes);
let manifest={version:1,assets:[]};try{manifest=JSON.parse(await fs.readFile(path.join(root,'data/character-cutouts.json'),'utf8'));}catch{}
manifest.assets=manifest.assets.filter(a=>a.skinId!==args.skin);manifest.assets.push({heroId:args.hero,skinId:args.skin,file,master,width:meta.width,height:meta.height,transparent:true,transparentPixelFraction:ratio,sha256:createHash('sha256').update(bytes).digest('hex'),sourceArtwork:`assets/heroes/${args.hero}-cover.webp`,sourceArtworkSha256:createHash('sha256').update(await fs.readFile(path.join(root,`assets/heroes/${args.hero}-cover.webp`))).digest('hex'),processing:'Background removal using built-in image_gen; official character design retained; original art preserved',generatedSource:args.source,generatedAt:new Date().toISOString(),license:'Derivative display of Tencent / respective rights holders character artwork',purpose:'Freestanding character in reused character-detail display stage',prompt:'Extract existing Zhuge Liang figure, hands, clothing and held fan from the official source; remove starfield and detached holographic rings; preserve pose, face, armor, colors and original visible anatomy; transparent RGBA background, no rectangle, no text or border.'});
await fs.writeFile(path.join(root,'data/character-cutouts.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({file,width:meta.width,height:meta.height,transparentPixelFraction:ratio,bytes:bytes.length}));
