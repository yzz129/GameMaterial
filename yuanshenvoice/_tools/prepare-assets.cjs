/* Rebuild local, size-bounded runtime artwork from the existing character database. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const db = require('genshin-db');
const root = path.resolve(__dirname, '..');
const original = require('../teyvat_characters.json');
const manifest = [];
const slash = p => p.replaceAll('\\', '/');
const assetPath = p => path.join(root, p);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
for (const dir of ['assets/masters/characters', 'assets/characters', 'assets/elements', 'assets/icons', 'data/characters']) {
  fs.mkdirSync(assetPath(dir), { recursive: true });
}
async function register(file, source, purpose, license = 'HoYoverse game artwork; original rights retained') {
  const bytes = fs.readFileSync(assetPath(file));
  let dimensions = {};
  try { const m = await sharp(bytes).metadata(); dimensions = { width: m.width, height: m.height }; } catch {}
  manifest.push({ file, source, purpose, license, version: 1, bytes: bytes.length, sha256: hash(bytes), ...dimensions });
}
async function download(url, file) {
  if (fs.existsSync(assetPath(file))) return fs.readFileSync(assetPath(file));
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await sharp(bytes).metadata();
  fs.writeFileSync(assetPath(file), bytes);
  return bytes;
}
async function one(c) {
  const info = db.characters(c.enName) || db.characters(c.name);
  const imageInfo = info?.images || {};
  const stem = `assets/characters/${c.id}`;
  const master = `assets/masters/characters/${c.id}.png`;
  const candidates = [imageInfo.cover1, c.splashArt, imageInfo.filename_iconCard && `https://enka.network/ui/${imageInfo.filename_iconCard}.png`, imageInfo.portrait, imageInfo.card].filter(Boolean);
  let bytes, source;
  for (const url of candidates) {
    try { bytes = await download(url, master); source = url; break; }
    catch (e) { console.log(`Retry artwork ${c.name}: ${e.message}`); }
  }
  if (!bytes) throw Error(`No artwork for ${c.name}`);
  await sharp(bytes).trim().resize({ width: 900, height: 1100, fit: 'inside', withoutEnlargement: true }).webp({ quality: 83, effort: 5 }).toFile(assetPath(`${stem}-art.webp`));
  await sharp(bytes).trim().resize(480, 580, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 79, effort: 5 }).toFile(assetPath(`${stem}-card.webp`));
  const avatarUrl = `https://enka.network/ui/${imageInfo.filename_icon || c.avatarImg.split('/').at(-1).replace('.png', '')}.png`;
  try {
    const avatar = await download(avatarUrl, `assets/masters/characters/${c.id}-avatar.png`);
    await sharp(avatar).resize(96, 96).webp({ quality: 82 }).toFile(assetPath(`${stem}-avatar.webp`));
  } catch {
    await sharp(bytes).trim().resize(96, 96, { fit: 'cover', position: 'attention' }).webp({ quality: 82 }).toFile(assetPath(`${stem}-avatar.webp`));
  }
  await register(`${stem}-art.webp`, source, 'Character detail artwork, loaded only on demand');
  await register(`${stem}-card.webp`, source, 'Character grid, native lazy loading');
  await register(`${stem}-avatar.webp`, avatarUrl, 'Small player and quote avatar');
  const cleanLines = lines => lines.map(q => ({ ...q, localAudio: q.localAudio && fs.existsSync(assetPath(q.localAudio)) ? slash(q.localAudio) : null }));
  const detailed = { ...c, avatarImg: `${stem}-avatar.webp`, splashArt: `${stem}-art.webp`, cardArt: `${stem}-card.webp`, friendLines: cleanLines(c.friendLines), actionLines: cleanLines(c.actionLines) };
  detailed.hasLocalPack = [...detailed.friendLines, ...detailed.actionLines].some(q => q.localAudio);
  fs.writeFileSync(assetPath(`data/characters/${c.id}.json`), JSON.stringify(detailed));
  const { friendLines, actionLines, ...summary } = detailed;
  summary.preview = friendLines[0]?.desc || c.description;
  summary.metadataSearch = [c.name, c.enName, c.title, c.region, c.element, c.weapon, ...Object.values(c.cv)].join(' ').toLowerCase();
  return summary;
}
async function main() {
  const names = { anemo: 'Anemo', geo: 'Geo', electro: 'Electro', dendro: 'Dendro', hydro: 'Hydro', pyro: 'Pyro', cryo: 'Cryo' };
  for (const [id, name] of Object.entries(names)) {
    const base64 = db.elements(name).images.base64;
    await sharp(Buffer.from(base64.split(',')[1], 'base64')).webp({ lossless: true }).toFile(assetPath(`assets/elements/${id}.webp`));
    await register(`assets/elements/${id}.webp`, `genshin-db:elements/${name}`, 'Original game element emblem');
  }
  const icons = ['compass', 'headphones', 'magnifying-glass', 'sliders-horizontal', 'arrow-right', 'arrow-left', 'caret-down', 'caret-right', 'caret-left', 'x', 'arrows-clockwise', 'play', 'pause', 'skip-back', 'skip-forward', 'speaker-high', 'speaker-slash', 'heart', 'download-simple', 'copy', 'image-square', 'star', 'book-open', 'lightning', 'sword', 'arrow-counter-clockwise', 'check', 'moon', 'sun', 'globe-hemisphere-west', 'leaf', 'music-notes', 'warning-circle', 'grid-four', 'list-bullets', 'shuffle', 'repeat', 'dots-three', 'arrow-up-right'];
  const symbols = icons.map(id => {
    const svg = fs.readFileSync(assetPath(`node_modules/@phosphor-icons/core/assets/regular/${id}.svg`), 'utf8');
    return `<symbol id="${id}" viewBox="0 0 256 256">${svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')}</symbol>`;
  });
  fs.writeFileSync(assetPath('assets/icons/ui.svg'), `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>`);
  fs.copyFileSync(assetPath('node_modules/@phosphor-icons/core/LICENSE'), assetPath('assets/icons/LICENSE'));
  await register('assets/icons/ui.svg', '@phosphor-icons/core', 'Consistent interface icons', 'MIT; see assets/icons/LICENSE');
  const result = new Array(original.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < original.length) {
      const index = cursor++;
      result[index] = await one(original[index]);
      console.log(`Artwork ${index + 1}/${original.length}: ${original[index].name}`);
    }
  }));
  fs.writeFileSync(assetPath('data/catalog.json'), JSON.stringify(result));
  const search = original.map(c => ({ id: c.id, text: [c.name, c.enName, c.title, ...Object.values(c.cv), ...c.friendLines.flatMap(q => [q.title, q.desc]), ...c.actionLines.flatMap(q => [q.title, q.desc])].join('\n').normalize('NFKC').toLowerCase() }));
  fs.writeFileSync(assetPath('data/search-index.json'), JSON.stringify(search));
  const rawNahida = JSON.parse(fs.readFileSync(assetPath('_backups/2026-10-22/nahida-all-voices.json'), 'utf8'));
  const nahida = rawNahida.map(q => ({ id: q.id, category: q.category, catName: q.catName, text: q.text, localAudio: q.organizedPath && fs.existsSync(assetPath(q.organizedPath)) ? q.organizedPath : null }));
  fs.writeFileSync(assetPath('data/nahida-index.json'), JSON.stringify(nahida));
  manifest.sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(assetPath('assets/manifest.json'), JSON.stringify({ generated: '2026-10-22', masters: 'assets/masters (preserved source images, not loaded by the app)', assets: manifest }, null, 2));
  console.log(`Prepared ${result.length} characters; catalog ${fs.statSync(assetPath('data/catalog.json')).size} bytes. All runtime artwork is local.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
