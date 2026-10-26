'use strict';
// Keep portrait thumbnails separate from complete wish artwork. Never rebuild
// dialogue data here: it may contain separately maintained voice-file mappings.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const db = require('genshin-db');
const root = path.resolve(__dirname, '..');
const local = file => path.join(root, file);
const catalog = JSON.parse(fs.readFileSync(local('data/catalog.json')));
const requested = new Set(process.argv.slice(2).map(Number));
const targets = requested.size ? catalog.filter(c => requested.has(c.id)) : catalog;
const manifest = JSON.parse(fs.readFileSync(local('assets/manifest.json')));
const completed = [], failures = [];
fs.mkdirSync(local('assets/masters/full-art'), { recursive: true });
async function prepare(c) {
  const images = db.characters(c.enName)?.images || {};
  const travelerArt = {10000005:'UI_Gacha_AvatarImg_PlayerBoy',10000007:'UI_Gacha_AvatarImg_PlayerGirl'};
  const image = images.filename_gachaSplash || travelerArt[c.id];
  const source = image ? `https://enka.network/ui/${image}.png` : images.portrait;
  if (!source) return;
  const master = `assets/masters/full-art/${c.id}.png`;
  const file = `assets/characters/${c.id}-full.webp`;
  try {
    if (!fs.existsSync(local(master))) {
      const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(bytes).metadata();
      if (!metadata.hasAlpha || metadata.width < 500) throw Error('Unexpected artwork');
      fs.writeFileSync(local(master), bytes);
    }
    // Trim only empty alpha margins, then contain the entire illustration.
    await sharp(local(master)).trim().resize({ width: 1500, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, effort: 5 }).toFile(local(file));
    const bytes = fs.readFileSync(local(file)), metadata = await sharp(bytes).metadata();
    completed.push({ id: c.id, file, width: metadata.width, height: metadata.height });
    manifest.assets = manifest.assets.filter(a => a.file !== file);
    manifest.assets.push({ file, source, master, purpose: 'Uncropped character artwork for the projection and artwork viewer, loaded on demand', license: `HoYoverse game artwork, distributed by ${image?'Enka':'Genshin Wiki'}; original rights retained`, version: 1, width: metadata.width, height: metadata.height, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  } catch (error) { failures.push({ id: c.id, name: c.name, message: error.message }); }
}
(async () => {
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < targets.length) { const c = targets[cursor++]; await prepare(c); }
  }));
  // Merge into the latest files, preserving any edits made during downloads.
  const latest = JSON.parse(fs.readFileSync(local('data/catalog.json')));
  for (const item of completed) {
    const fields = { fullArt: item.file, fullArtWidth: item.width, fullArtHeight: item.height };
    Object.assign(latest.find(c => c.id === item.id), fields);
    const detailFile = local(`data/characters/${item.id}.json`);
    const detail = JSON.parse(fs.readFileSync(detailFile));
    fs.writeFileSync(detailFile, JSON.stringify({ ...detail, ...fields }));
  }
  fs.writeFileSync(local('data/catalog.json'), JSON.stringify(latest));
  fs.writeFileSync(local('assets/manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ complete: completed.length, failures }));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
