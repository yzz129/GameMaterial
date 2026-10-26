'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'assets/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const prompts = JSON.parse(fs.readFileSync(path.join(root, '_jobs/dreamina-windrise-dual-v1.prompts.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  for (const channel of ['pc', 'mobile']) {
    const report = JSON.parse(fs.readFileSync(path.join(root, `output/windrise-backgrounds-v1/jimeng-2k-${channel}.json`), 'utf8'));
    const name = `TEYVAT_03_VID_windrise-${channel}_jimeng-2k_v1`;
    const master = `assets/masters/video/${name}.mp4`;
    const file = `assets/video/${name}.mp4`;
    const poster = `assets/video/TEYVAT_03_BG_windrise-${channel}_poster_v1.webp`;
    const bytes = fs.readFileSync(path.join(root, master));
    if (hash(bytes) !== report.file.sha256 || bytes.length !== report.file.bytes) throw new Error(`Unreviewed video: ${master}`);
    fs.copyFileSync(path.join(root, master), path.join(root, file));
    const result = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(root, master), '-map', '0:v:0',
      '-vf', `scale=${channel === 'pc' ? 1920 : 900}:-2`, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88', path.join(root, poster)],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
    const shared = {
      source: `dreamina:resource/${report.provenance.resourceId}`, sourcePage: report.provenance.canvasUrl,
      master, license: report.provenance.rights, channel, version: 1,
      generation: { model: prompts.model, prompt: prompts[channel], sourceResolution: '720p',
        enhancement: 'Jimeng official intelligent video enhancement, 2K preset',
        nodeId: report.provenance.nodeId, submitId: report.provenance.submitId, resourceId: report.provenance.resourceId,
        referenceImage: report.provenance.referenceImage, review: report.review },
    };
    const videoAsset = { ...shared, file, purpose: `${channel} responsive muted background video`,
      width: report.file.width, height: report.file.height, duration: report.file.durationSeconds,
      frameRate: report.file.frameRate, audioChannels: report.file.audio[0]?.channels || 0,
      bytes: bytes.length, sha256: hash(bytes), byteIdenticalMaster: true };
    const posterBytes = fs.readFileSync(path.join(root, poster)), dimensions = await sharp(posterBytes).metadata();
    const posterAsset = { ...shared, file: poster, purpose: `${channel} first-frame poster and motion/data-saver fallback`,
      width: dimensions.width, height: dimensions.height, bytes: posterBytes.length, sha256: hash(posterBytes) };
    manifest.assets = manifest.assets.filter(asset => ![file, poster].includes(asset.file));
    manifest.assets.push(videoAsset, posterAsset);
    console.log(`${channel}: original ${report.file.width}x${report.file.height} video preserved; ${dimensions.width}x${dimensions.height} poster ready.`);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
