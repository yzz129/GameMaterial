'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..');
async function main(){
  const manifestPath=path.join(root,'assets/manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  for(const name of ['world-desktop.webp','world-mobile.webp']){const file=`assets/${name}`,bytes=fs.readFileSync(path.join(root,file)),m=await sharp(bytes).metadata();manifest.assets=manifest.assets.filter(a=>a.file!==file);manifest.assets.push({file,source:'https://genshin.hoyoverse.com/_nuxt/img/s1.5c125a1.png',sourcePage:'https://genshin.hoyoverse.com/en/map',purpose:name.includes('mobile')?'Static mobile hero wallpaper':'Static desktop hero and glass-panel backdrop',license:'HoYoverse official Teyvat page artwork; original rights retained',width:m.width,height:m.height,version:1,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')})}
  for(const asset of manifest.assets){const bytes=fs.readFileSync(path.join(root,asset.file));asset.bytes=bytes.length;asset.sha256=crypto.createHash('sha256').update(bytes).digest('hex')}
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  // HTML always points at the current script/style bytes, including for visitors
  // whose browser cached a previous Pages deployment with a long max-age.
  const versions=Object.fromEntries(['app.js','styles.css'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,12)]));
  for(const name of ['index.html','nahida_player.html','voice_index.html']){
    const file=path.join(root,name),html=fs.readFileSync(file,'utf8')
      .replace(/href="styles\.css(?:\?[^\"]*)?"/,'href="styles.css?v='+versions['styles.css']+'"')
      .replace(/src="app\.js(?:\?[^\"]*)?"/,'src="app.js?v='+versions['app.js']+'"');
    fs.writeFileSync(file,html);
  }
  const files=['index.html','nahida_player.html','voice_index.html','app.js','styles.css','search-worker.js','assets/icons/ui.svg','assets/audio/music/music_catalog.json','data/catalog.json','data/search-index.json','data/nahida-index.json',...fs.readdirSync(path.join(root,'data/characters')).filter(f=>f.endsWith('.json')).map(f=>'data/characters/'+f)];
  let before=0,after=0;
  for(const relative of files){const file=path.join(root,relative),buffer=fs.readFileSync(file),br=zlib.brotliCompressSync(buffer,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:8}}),gz=zlib.gzipSync(buffer,{level:9});fs.writeFileSync(file+'.br',br);fs.writeFileSync(file+'.gz',gz);before+=buffer.length;after+=br.length;}
  console.log(`Prepared ${files.length} text resources: ${(before/1024).toFixed(0)} KB → ${(after/1024).toFixed(0)} KB Brotli.`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
