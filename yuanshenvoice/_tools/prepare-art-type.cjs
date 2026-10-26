'use strict';
// Packages the actual AE PNG render. No browser/CSS recreation of the render.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/art-type-ae-v1');
const runtime = path.join(root, 'assets/typography');
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const relative = file => path.relative(root, file).split(path.sep).join('/');
const prefix = 'TEYVAT_04_FX_';

async function main() {
  fs.mkdirSync(runtime, { recursive:true });
  const report = fs.readFileSync(path.join(output, 'build-result.txt'), 'utf8');
  if (!report.startsWith('READY')) throw new Error('After Effects project has not been built successfully');
  const records = [];
  async function record(file, options) {
    const bytes = fs.readFileSync(file), meta = await sharp(bytes, { animated:true }).metadata();
    records.push({ file:relative(file), source:'output/art-type-ae-v1/TEYVAT_04_FX_art-type_v1.aep',
      license:'Original title layout and effects; user supplied Genshin mark, HoYoverse rights retained. SimSun rendered locally, font not redistributed.',
      version:1, width:meta.width, height:meta.pageHeight || meta.height, bytes:bytes.length, sha256:sha(bytes),
      channels:meta.channels, ...options });
    return meta;
  }
  const framesManifest = [];
  for (const channel of ['main', 'nahida']) {
    const folder = path.join(output, 'frames', channel);
    const frames = fs.readdirSync(folder).filter(f => /\.png$/.test(f)).sort().map(f => path.join(folder, f));
    if (frames.length !== 72) throw new Error(`Expected 72 AE frames for ${channel}, found ${frames.length}`);
    const buffers = [];
    for (let index = 0; index < frames.length; index++) {
      const frame = frames[index];
      const bytes = fs.readFileSync(frame), meta = await sharp(bytes).metadata();
      if (meta.width !== 1480 || meta.height !== 500 || !meta.hasAlpha || meta.depth !== 'ushort') throw new Error(`Invalid AE 16-bit alpha frame: ${frame}`);
      framesManifest.push({ file:relative(frame), bytes:bytes.length, sha256:sha(bytes) });
      // A deterministic 16-to-8-bit conversion avoids AE's temporal 8-bit dither.
      // The original 16-bit, 24 fps PNG master remains untouched.
      buffers.push(await sharp(bytes).resize(740, 250).png().toBuffer());
    }
    const still = path.join(runtime, `${prefix}title-${channel}-still_v1.webp`);
    await sharp(frames[71]).webp({ lossless:true, effort:6 }).toFile(still);
    await record(still, { purpose:`Stable ${channel} hero title; first paint and reduced motion fallback`, renderComp:`TITLE_${channel.toUpperCase()}_ALPHA`, sourceFrame:71 });
    const animation = path.join(runtime, `${prefix}title-${channel}-intro_v1.webp`);
    const delays = buffers.map((_, i) => Math.round((i + 1) * 1000 / 24) - Math.round(i * 1000 / 24));
    console.log(`Packaging ${channel}: 72 AE frames, 740 × 250, one-shot alpha WebP`);
    await sharp(buffers, { join:{ animated:true } }).webp({ quality:82, alphaQuality:100, minSize:true, effort:4, loop:1, delay:delays }).toFile(animation);
    const meta = await record(animation, { purpose:`One-shot ${channel} AE gold sweep with transparent stardust; settles after 3 seconds`, renderComp:`TITLE_${channel.toUpperCase()}_ALPHA`, frames:72, frameRate:24, durationSeconds:3, loop:1, derivedFrom:'72 straight-alpha 16-bit AE PNG render frames' });
    if (!meta.hasAlpha || meta.loop !== 1 || meta.pages < 10 || meta.delay.reduce((a, b) => a + b, 0) !== 3000) throw new Error(`Invalid one-shot WebP: ${animation}`);
    if (fs.statSync(animation).size > 1.5 * 1024 * 1024) throw new Error(`Title animation exceeds 1.5 MiB budget: ${animation}`);
  }
  const brandFolder = path.join(output, 'frames/brand');
  const brandFrame = fs.readdirSync(brandFolder).find(f => /\.png$/.test(f));
  if (!brandFrame) throw new Error('AE brand render is missing');
  const brand = path.join(runtime, `${prefix}brand-gold_v1.webp`);
  await sharp(path.join(brandFolder, brandFrame)).trim({ threshold:8 }).webp({ lossless:true, effort:6 }).toFile(brand);
  const brandMeta = await record(brand, { purpose:'Gold star-terminal 原神 brand mark from the user reference, rendered in After Effects', renderComp:'BRAND_GOLD_ALPHA' });
  if (!brandMeta.hasAlpha || brandMeta.width < 400) throw new Error('Brand matte is invalid');
  const manifestPath = path.join(root, 'assets/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const replaced = new Set(records.map(r => r.file));
  manifest.assets = manifest.assets.filter(r => !replaced.has(r.file)).concat(records);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(output, 'render-manifest.json'), JSON.stringify({
    producer:'Adobe After Effects 2026', version:'26.5x89', bitsPerChannel:16, colorSpace:'sRGB IEC61966-2.1',
    frameRate:24, frameCount:72, durationSeconds:3, alpha:'Straight (Unmatted)',
    project:relative(path.join(output, 'TEYVAT_04_FX_art-type_v1.aep')),
    sourceScript:'_tools/build-art-type.jsx', sourceReference:'assets/masters/typography/TEYVAT_04_FG_genshin-logo-reference_v1.png',
    sourceReferenceSha256:sha(fs.readFileSync(path.join(root, 'assets/masters/typography/TEYVAT_04_FG_genshin-logo-reference_v1.png'))),
    titles:{ main:['循着星光','重逢熟悉的声音'], nahida:['把须弥的故事','说给你听'] },
    cues:[{start:0,end:3,label:'Complete stable glyphs'},{start:.25,end:1.9,label:'Champagne-gold light sweep'},{start:.12,end:1.8,label:'Constellation dust settles'},{start:1.9,end:3,label:'Static complete state'}],
    assets:records, frames:framesManifest
  }, null, 2));
  records.forEach(r => console.log(`${r.file}: ${(r.bytes / 1024).toFixed(1)} KiB, ${r.width} × ${r.height}`));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
