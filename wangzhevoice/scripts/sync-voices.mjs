#!/usr/bin/env node
/**
 * Sync the public Honor of Kings hero and voice catalogs from Tencent.
 * Usage: node scripts/sync-voices.mjs [--cached] [--download-audio]
 * Default: download official artwork, cache two clips for each featured hero,
 * and check at least one audio response per hero. Other clips use official URLs.
 * --download-audio caches every available clip (potentially several GB).
 * --cached reuses the saved official JSON responses for a repeatable rebuild.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOTS = path.join(ROOT, 'source-snapshots');
const DATA = path.join(ROOT, 'data');
const args = new Set(process.argv.slice(2));
const cached = args.has('--cached');
const downloadAll = args.has('--download-audio');
const featured = ['131', '141', '167', '191', '150', '505'];
const HERO_URL = 'https://pvp.qq.com/web201605/js/herolist.json';
const WORLD_URL = 'https://pvp.qq.com/zlkdatasys/yuzhouzhan/list/heroList.json';
const VOICE_BASE = 'https://pvp.qq.com/zlkdatasys/yuzhouzhan/herovoice/';
const roleNames = { 1: '战士', 2: '法师', 3: '坦克', 4: '刺客', 5: '射手', 6: '辅助' };
const warnings = [];
const failures = [];
const imageManifest = [];
const audioChecks = [];
const updatedAt = new Date().toISOString();

const clean = value => String(value ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
const absolute = value => value?.startsWith('//') ? `https:${value}` : value;
const array = value => Array.isArray(value) ? value : [];
const relative = value => path.relative(ROOT, value).split(path.sep).join('/');
const skinId = (id, name) => `${id}-${hash(name)}`;

async function jsonFile(filename, value) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, filename);
}

async function request(url, options = {}) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
      if (!response.ok) {
        await response.body?.cancel();
        const error = new Error(`HTTP ${response.status}: ${url}`);
        error.status = response.status;
        if (response.status < 500) throw error;
        last = error;
      } else return response;
    } catch (error) {
      last = error;
      if (error.status && error.status < 500) throw error;
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
  }
  throw last;
}

async function readOfficial(url, filename, { optional = false } = {}) {
  const target = path.join(SNAPSHOTS, filename);
  if (cached) {
    try { return JSON.parse(await fs.readFile(target, 'utf8')); } catch { /* Fetch missing snapshots. */ }
  }
  try {
    const data = await (await request(url)).json();
    await jsonFile(target, data);
    return data;
  } catch (error) {
    if (error.status === 404 && optional) return null;
    try {
      const data = JSON.parse(await fs.readFile(target, 'utf8'));
      warnings.push({ url, reason: error.message, usedSavedSnapshot: true });
      return data;
    } catch {
      if (optional) { warnings.push({ url, reason: error.message }); return null; }
      throw error;
    }
  }
}

async function pool(items, concurrency, operation) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(items.length, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await operation(items[index], index);
    }
  }));
  return results;
}

function audioType(bytes) {
  if (bytes.length < 12) return null;
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE') return 'wav';
  if (bytes.toString('ascii', 0, 3) === 'ID3') return 'mp3';
  if (bytes.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (bytes.toString('ascii', 0, 4) === 'fLaC') return 'flac';
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'mp3';
  if (bytes.toString('ascii', 4, 8) === 'ftyp') return 'm4a';
  return null;
}

async function checkAudio(voice, download = false) {
  const url = voice.remoteUrl;
  const extension = new URL(url).pathname.match(/\.([a-z0-9]+)$/i)?.[1] || 'mp3';
  const filename = path.join(ROOT, 'assets', 'audio', `${voice.id}.${extension}`);
  try {
    if (download) {
      try {
        const bytes = await fs.readFile(filename);
        if (audioType(bytes)) return { ok: true, url: relative(filename), cached: true, bytes: bytes.length, format: audioType(bytes) };
      } catch { /* Download missing local media. */ }
    }
    const response = await request(url, download ? {} : { headers: { Range: 'bytes=0-8191' } });
    let bytes;
    if (download) {
      bytes = Buffer.from(await response.arrayBuffer());
    } else {
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      while (size < 8192) {
        const part = await reader.read();
        if (part.done) break;
        chunks.push(part.value); size += part.value.byteLength;
      }
      await reader.cancel();
      bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    }
    const format = audioType(bytes);
    if (!format) throw new Error('Response does not have a recognized audio signature');
    if (download) {
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, bytes);
    }
    return { ok: true, url: download ? relative(filename) : url, cached: download, bytes: bytes.length, format, contentType: response.headers.get('content-type') };
  } catch (error) {
    return { ok: false, url, reason: error.message };
  }
}

async function image(id, kind, sources) {
  const filename = path.join(ROOT, 'assets', 'heroes', `${id}-${kind}.webp`);
  if (cached) {
    try {
      const metadata = await sharp(filename).metadata();
      if (metadata.width > 0) {
        imageManifest.push({ heroId: id, kind, localPath: relative(filename), sourceUrl: sources.find(Boolean), cached: true, width: metadata.width, height: metadata.height });
        return relative(filename);
      }
    } catch { /* Continue to official sources. */ }
  }
  for (const source of sources.filter(Boolean)) {
    const url = absolute(source);
    try {
      const response = await request(url);
      const bytes = Buffer.from(await response.arrayBuffer());
      const output = sharp(bytes).rotate().resize({ width: kind === 'cover' ? 1600 : 520, withoutEnlargement: true }).webp({ quality: 84 });
      const { data, info } = await output.toBuffer({ resolveWithObject: true });
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, data);
      imageManifest.push({ heroId: id, kind, sourceUrl: url, localPath: relative(filename), width: info.width, height: info.height, bytes: info.size });
      return relative(filename);
    } catch { /* The alternate is also an official image for this hero. */ }
  }
  warnings.push({ heroId: id, kind, reason: 'No official artwork could be downloaded' });
  return '';
}

await fs.mkdir(SNAPSHOTS, { recursive: true });
const [officialHeroes, worldData] = await Promise.all([
  readOfficial(HERO_URL, 'voices-official-heroes.json'),
  readOfficial(WORLD_URL, 'voices-hero-list.json')
]);
if (!Array.isArray(officialHeroes) || !officialHeroes.length) throw new Error('Official hero list is empty');
const worldHeroes = Object.values(worldData).flatMap(array);
const worldById = new Map(worldHeroes.map(hero => [String(hero.yzzyxi_2602), hero]));
const catalog = [];
const entries = [];
let rawVoiceCount = 0;
let invalidRecords = 0;
let duplicateRecords = 0;
let localAudioCount = 0;

await pool(officialHeroes, 6, async (official, index) => {
  const id = String(official.ename);
  const world = worldById.get(id) || {};
  const sourceUrl = `${VOICE_BASE}${id}.json`;
  const source = await readOfficial(sourceUrl, `voices-${id}.json`, { optional: true });
  const skins = [];
  const skinMap = new Map();
  const addSkin = name => {
    name = clean(name);
    if (!name) return null;
    if (!skinMap.has(name)) {
      const skin = { id: skinId(id, name), name, voiceCount: 0 };
      skinMap.set(name, skin); skins.push(skin);
    }
    return skinMap.get(name);
  };
  clean(official.skin_name).split('|').forEach(addSkin);
  const voices = [];
  const seen = new Set();
  for (const group of array(source?.dqpfyy_5403)) {
    const skin = addSkin(group.pfmczt_7754);
    if (!skin) continue;
    for (const record of array(group.yylbzt_9132)) {
      rawVoiceCount++;
      const url = absolute(clean(record.yywjzt_5304));
      let valid = false;
      try { const parsed = new URL(url); valid = parsed.protocol === 'https:' && parsed.hostname === 'game.gtimg.cn'; } catch { /* Invalid source record. */ }
      if (!valid) { invalidRecords++; continue; }
      const key = `${skin.id}|${url}`;
      if (seen.has(key)) { duplicateRecords++; continue; }
      seen.add(key);
      const text = clean(record.yywbzt_1517);
      voices.push({
        id: `${id}-${hash(key)}`, heroId: id, heroName: official.cname,
        skinId: skin.id, skin: skin.name, title: text || '无台词语音', text,
        category: clean(record.yygn_8632) || '其他语音', scene: clean(record.ssjqmc_1356),
        url, remoteUrl: url, sourceUrl
      });
    }
  }

  const checks = downloadAll ? [...voices] : voices.slice(0, featured.includes(id) ? 2 : 1);
  for (const voice of checks) {
    const download = downloadAll || featured.includes(id);
    const check = await checkAudio(voice, download);
    audioChecks.push({ heroId: id, voiceId: voice.id, remoteUrl: voice.remoteUrl, ...check });
    if (check.ok) {
      voice.url = check.url;
      voice.mediaVerifiedAt = updatedAt;
      if (check.cached) { voice.cached = true; localAudioCount++; }
    } else {
      voice.unavailable = true;
      failures.push({ heroId: id, heroName: official.cname, voiceId: voice.id, sourceUrl: voice.remoteUrl, reason: check.reason });
    }
  }
  // A failed sampled resource is excluded, while untested official records remain
  // accurately described as cataloged (not individually verified) media.
  const availableVoices = voices.filter(voice => !voice.unavailable);
  for (const voice of availableVoices) skins.find(skin => skin.id === voice.skinId).voiceCount++;
  const imageBase = `https://game.gtimg.cn/images/yxzj/img201606/skin/hero-info/${id}/${id}`;
  const [portrait, cover] = await Promise.all([
    image(id, 'portrait', [`${imageBase}-mobileskin-1.jpg`, world.yxlbfm_5325, world.yxlbfm_8678, `${imageBase}-bigskin-1.jpg`]),
    image(id, 'cover', [`${imageBase}-bigskin-1.jpg`, array(source?.dqpfyy_5403)[0]?.pffmtm_4757, world.yxlbfm_9398])
  ]);
  const roles = [...new Set([official.hero_type, official.hero_type2].map(type => roleNames[type]).filter(Boolean))];
  const hero = {
    id, name: official.cname, slug: official.id_name || world.yxpy_7753 || `hero-${id}`,
    title: official.title || clean(world.yzzyxc_4613), roles, portrait, cover,
    skins, skinCount: skins.length, voiceCount: availableVoices.length,
    sourceUrl, officialPage: `https://pvp.qq.com/web201605/herodetail/${id}.shtml`,
    voiceStatus: availableVoices.length ? 'available' : 'not-published',
    region: clean(world.yxqy_9100), faction: clean(world.zyyx_9680)
  };
  catalog.push(hero);
  entries.push({ heroId: id, name: hero.name, slug: hero.slug, text: [...new Set(availableVoices.map(voice => voice.text).filter(Boolean))].join('\n') });
  await jsonFile(path.join(DATA, 'heroes', `${id}.json`), { ...hero, updatedAt, voices: availableVoices });
  console.log(`[${index + 1}/${officialHeroes.length}] ${hero.name}: ${availableVoices.length} voices, ${skins.filter(skin => skin.voiceCount > 0).length} voice skins`);
});

catalog.sort((a, b) => {
  const aIndex = featured.indexOf(a.id), bIndex = featured.indexOf(b.id);
  if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  return a.name.localeCompare(b.name, 'zh-CN');
});
const missingHeroes = catalog.filter(hero => !hero.voiceCount).map(hero => ({ id: hero.id, name: hero.name, sourceUrl: hero.sourceUrl, reason: '官方鉴赏接口尚未提供可用语音列表' }));
const coverage = {
  heroArchives: catalog.length, worldHeroCount: worldHeroes.length,
  heroesWithVoices: catalog.filter(hero => hero.voiceCount > 0).length,
  voiceCount: catalog.reduce((total, hero) => total + hero.voiceCount, 0),
  skinCount: catalog.reduce((total, hero) => total + hero.skins.length, 0),
  skinsWithVoices: catalog.reduce((total, hero) => total + hero.skins.filter(skin => skin.voiceCount > 0).length, 0),
  rawVoiceCount, duplicateRecordsRemoved: duplicateRecords, invalidRecordsRemoved: invalidRecords,
  localAudioCount, checkedAudioCount: audioChecks.length, verifiedAudioCount: audioChecks.filter(check => check.ok).length,
  mediaValidation: downloadAll ? 'all-catalog-audio' : 'sample-per-hero',
  missingHeroes, failedMedia: failures,
  note: '英雄档案以官网英雄列表为准，元流之子不同职业单列。语音来自官方鉴赏接口，数量为按英雄、皮肤和音频链接去重的可用目录记录，不代表游戏内所有语音；默认逐英雄抽样验证，未公开或失效资源列入缺口。'
};
await jsonFile(path.join(DATA, 'heroes.json'), {
  updatedAt,
  source: { name: '王者荣耀官方网站 · 世界观体验站', heroListUrl: HERO_URL, worldHeroListUrl: WORLD_URL, voiceUrlTemplate: `${VOICE_BASE}{id}.json`, notice: '英雄、图片及音频版权归腾讯及相关权利人所有。' },
  heroes: catalog, coverage
});
await jsonFile(path.join(DATA, 'search-index.json'), { updatedAt, entries: entries.sort((a, b) => Number(a.heroId) - Number(b.heroId)) });
await jsonFile(path.join(SNAPSHOTS, 'voices-sync-report.json'), { updatedAt, coverage, warnings, images: imageManifest, audioChecks });
console.log(`Synced ${coverage.heroArchives} archives, ${coverage.voiceCount} voice records, ${coverage.skinsWithVoices} voiced skins; ${missingHeroes.length} archives awaiting official voice data.`);
