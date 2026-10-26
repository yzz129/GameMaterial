'use strict';
// Preserve the generated PNG masters and original official artwork; publish only
// bounded, alpha-preserving WebP variants for the three reviewed fan editions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const local = file => path.join(root, file);
const generationRoot = 'C:/Users/Administrator/.codex/generated_images/01a1636a-1a78-7fb3-9cdc-5c9ca870732a';
const editions = [
  {id:10000001,key:'paimon',task:'exec-90febc9c-2008-4cdc-ae68-f39cd4013b10',color:'#95cfff',secondary:'#f4d494'},
  {id:10000005,key:'aether',task:'exec-545a0485-1295-4519-9e52-cc1ab2bff220',color:'#82e4cc',secondary:'#efd08b'},
  {id:10000007,key:'lumine',task:'exec-1eba0a98-0f99-482c-a8f0-c32e776ac51f',color:'#b6ddff',secondary:'#e8ccf5'}
];
const checksum = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  const catalog = JSON.parse(fs.readFileSync(local('data/catalog.json')));
  const manifest = JSON.parse(fs.readFileSync(local('assets/manifest.json')));
  const job = JSON.parse(fs.readFileSync(local('_jobs/character-celestial-v1.json')));
  const promptFile = 'output/character-celestial-v1/prompts.json';
  fs.mkdirSync(local('assets/masters/character-editions'), {recursive:true});
  for (const edition of editions) {
    const record = job.targets.find(target => target.id === edition.id);
    const master = `assets/masters/character-editions/TEYVAT_05_CHAR_${edition.key}-celestial_v1.png`;
    if (!fs.existsSync(local(master))) fs.copyFileSync(path.join(generationRoot, edition.task + '.png'), local(master), fs.constants.COPYFILE_EXCL);
    const metadata = await sharp(local(master)).metadata();
    if (!metadata.hasAlpha || metadata.width < 1000) throw Error('Invalid generated master: ' + master);
    const stem = `assets/characters/TEYVAT_05_CHAR_${edition.key}-celestial`;
    const full = `${stem}-full_v1.webp`, card = `${stem}-card_v1.webp`;
    await sharp(local(master)).extend({top:28,bottom:28,left:28,right:28,background:'#00000000'})
      .webp({quality:87,alphaQuality:96,effort:5}).toFile(local(full));
    await sharp(local(master)).resize(456,552,{fit:'contain',background:'#00000000',withoutEnlargement:true})
      .extend({top:14,bottom:14,left:12,right:12,background:'#00000000'}).webp({quality:85,alphaQuality:95,effort:5}).toFile(local(card));
    const fullMeta = await sharp(local(full)).metadata();
    const fields = {fullArt:full,fullArtWidth:fullMeta.width,fullArtHeight:fullMeta.height,splashArt:full,cardArt:card,
      artEdition:'celestial',artAccent:edition.color,artAccentSecondary:edition.secondary,
      artCredit:'星辉同人重绘 · AI 辅助创作，角色设计版权归 HoYoverse',originalFullArt:record.reference};
    Object.assign(catalog.find(character => character.id === edition.id), fields);
    const detailPath = local(`data/characters/${edition.id}.json`);
    const detail = JSON.parse(fs.readFileSync(detailPath));
    fs.writeFileSync(detailPath, JSON.stringify({...detail,...fields}));
    for (const file of [full,card]) {
      const bytes = fs.readFileSync(local(file));
      const dimensions = await sharp(bytes).metadata();
      manifest.assets = manifest.assets.filter(asset => asset.file !== file);
      manifest.assets.push({file,source:`image_gen:identity-preserve/${edition.task}`,master,
        reference:record.reference,promptFile,provider:'built-in image_gen',model:'not exposed by the built-in tool',taskId:edition.task,
        purpose:file===full?'Complete transparent celestial fan artwork for hero, character projection and poster':'Lazy-loaded transparent character card, entire figure contained',
        license:'AI-assisted fan reinterpretation of HoYoverse character designs; underlying character rights retained',
        review:'Reviewed: recognizable character, complete body/weapon, genuine alpha, no text or background rectangle',
        version:1,width:dimensions.width,height:dimensions.height,bytes:bytes.length,sha256:checksum(bytes)});
    }
    Object.assign(record,{status:'integrated',master,generatedSource:path.join(generationRoot,edition.task+'.png'),taskId:edition.task,promptFile,runtime:{full,card},reviewed:true,masterSha256:checksum(fs.readFileSync(local(master)))});
    console.log(`${edition.key}: ${fullMeta.width}×${fullMeta.height}; ${Math.round(fs.statSync(local(full)).size/1024)} KB full / ${Math.round(fs.statSync(local(card)).size/1024)} KB card`);
  }
  job.status = 'integrating';
  fs.writeFileSync(local('data/catalog.json'), JSON.stringify(catalog));
  fs.writeFileSync(local('assets/manifest.json'), JSON.stringify(manifest,null,2));
  fs.writeFileSync(local('_jobs/character-celestial-v1.json'), JSON.stringify(job,null,2)+'\n');
}
main().catch(error => {console.error(error);process.exitCode=1;});
