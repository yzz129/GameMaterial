#!/usr/bin/env node
/**
 * Sync public Honor of Kings music metadata and official, openly published MP3s.
 * No login cookies, playback tokens, DRM workarounds or third-party audio mirrors.
 * Usage: node scripts/sync-music.mjs [--offline] [--cache-audio] [--skip-covers]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOTS = path.join(ROOT, 'source-snapshots', 'music');
const args = new Set(process.argv.slice(2));
const OFFLINE = args.has('--offline');
const CACHE_AUDIO = args.has('--cache-audio');
const SKIP_COVERS = args.has('--skip-covers');
const PAGE_SIZE = 100;
const SINGERS = [
  { id: 'qq-honor-of-kings', mid: '002KASw53FQbTK', name: '王者荣耀' },
  { id: 'qq-infinite-kings', mid: '002zGErV35WYvq', name: '无限王者团' },
  { id: 'qq-community', mid: '003DmkdW3DIIPP', name: '王者荣耀同人局' },
];
const OFFICIAL_LIST = 'https://pvp.qq.com/webplat/info/news_version3/15592/27363/28302/34175/34183/m21932/list_1.shtml';
const OFFICIAL_PAGE = 'https://pvp.qq.com/story201904/index.html#/music';
const QQ_API = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const sourceFetchTimes = [];

const https = (url) => url ? new URL(url.replace(/^http:/, 'https:'), 'https://pvp.qq.com').href : '';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
const text = (value) => String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
const duration = (value) => String(value || '').split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
const exists = async (file) => fs.access(file).then(() => true, () => false);

async function request(url, options = {}) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), ...options });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    } catch (err) {
      error = err;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw error;
}

async function jsonSource(name, url, { jsonp = false } = {}) {
  const file = path.join(SNAPSHOTS, `${name}.json`);
  if (OFFLINE) {
    const saved = JSON.parse(await fs.readFile(file, 'utf8'));
    sourceFetchTimes.push(saved.fetchedAt);
    return saved.data;
  }
  const response = await request(url);
  let raw = await response.text();
  if (jsonp) {
    // This endpoint returns createList(<JSON>); it is parsed as data, never executed.
    const match = raw.trim().match(/^createList\s*\(([\s\S]*)\)\s*;?$/);
    if (!match) throw new Error(`Unexpected JSONP format: ${url}`);
    raw = match[1];
  }
  const data = JSON.parse(raw);
  const fetchedAt = new Date().toISOString();
  sourceFetchTimes.push(fetchedAt);
  await fs.writeFile(file, JSON.stringify({ url, fetchedAt, data }, null, 2) + '\n');
  return data;
}

async function binarySource(url, options = {}) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(url, options);
      return { response, bytes: new Uint8Array(await response.arrayBuffer()) };
    } catch (err) { error = err; }
  }
  throw error;
}

async function mapLimit(items, limit, callback) {
  const result = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await callback(items[index], index);
    }
  }));
  return result;
}

function categoryFor(song, { officialCollection = '' } = {}) {
  const metadata = `${song.title} ${song.subtitle || ''} ${song.album || ''} ${officialCollection}`;
  if (/赛事|电竞|KPL|冠军杯|世冠|职业联赛|总决赛|挑战者杯|比赛现场/i.test(metadata)) return '赛事音乐';
  if (/英雄(?:主打|主题|故事|印象)|英雄.*(?:CP曲|主题曲)|英雄的征途|CP曲|皮肤(?:主题|推广|主打)/.test(metadata)) return '英雄主题';
  if (/游戏原声|原声音乐|背景音乐|云梦泽之声|Original Game Soundtrack/i.test(metadata)) return '游戏原声';
  if (/主题曲|主题推广曲|主打歌|推广曲|祝福曲|片头曲|片尾曲|周年|庆生|王者之歌|五五开黑|开黑节/.test(metadata)) return '主题曲';
  if (/同人|共创|闪光计划|农音节/.test(metadata + ' ' + song.artist)) return '共创音乐';
  if (song.artist.includes('无限王者团')) return '无限王者团';
  return '其他音乐';
}

async function officialTracks() {
  const list = await jsonSource('official-collections', OFFICIAL_LIST);
  if (!Array.isArray(list.data) || !list.data.length) throw new Error('Official music collection list is empty.');
  const tracks = [];
  const collections = [];
  for (const album of list.data) {
    const albumId = album.url.match(/(\d+)\.shtml$/)?.[1];
    if (!albumId) throw new Error(`Unexpected official album URL: ${album.url}`);
    const detail = await jsonSource(`official-album-${albumId}`, https(album.url));
    const catalog = await jsonSource(`official-tracks-${albumId}`, https(detail.src), { jsonp: true });
    if (!Array.isArray(catalog.zjyllb_5a)) throw new Error(`Missing official tracks: ${album.title}`);
    collections.push({ title: album.title, source: album.source, count: catalog.zjyllb_5a.length, dataUrl: https(detail.src) });
    for (const item of catalog.zjyllb_5a) {
      const audioUrl = https(item.yp_b7);
      if (!audioUrl || !/^https:\/\/(game\.gtimg\.cn|ossweb-img\.qq\.com)\//.test(audioUrl) || !/\.mp3(?:$|\?)/.test(audioUrl)) {
        throw new Error(`Unexpected official audio URL: ${audioUrl}`);
      }
      const track = {
        id: `official-${hash(audioUrl)}`,
        title: text(item.bt_fd), artist: text(item.zz_69), album: text(album.title),
        category: '', cover: https(item.sbtp_ac || item.hbtp_ee || album.imgsrc),
        coverSourceUrl: https(item.sbtp_ac || item.hbtp_ee || album.imgsrc),
        url: audioUrl, audioSourceUrl: audioUrl,
        sourceUrl: `https://pvp.qq.com/story201904/index.html#/musicDetail/${album.url.split('/34183/')[1].replace('.shtml', '').replaceAll('/', '-')}`,
        metadataSourceUrl: https(detail.src), duration: duration(item.ypsc_89),
        playable: true, playbackType: 'official-audio', sourceIds: ['official-world-music'],
        subtitle: text(album.source),
      };
      track.category = categoryFor(track, { officialCollection: `${album.title} ${album.source}` });
      tracks.push(track);
    }
  }
  return { tracks, collections };
}

async function singerTracks(singer) {
  const tracks = [];
  let expectedTotal = null;
  for (let begin = 0; expectedTotal === null || begin < expectedTotal; begin += PAGE_SIZE) {
    const payload = { comm: { ct: 24, cv: 0 }, req_1: {
      method: 'GetSingerSongList', module: 'musichall.song_list_server',
      param: { singerMid: singer.mid, order: 1, begin, num: PAGE_SIZE },
    } };
    const data = await jsonSource(`${singer.id}-${begin}`, `${QQ_API}?data=${encodeURIComponent(JSON.stringify(payload))}`);
    if (data.code !== 0 || data.req_1?.code !== 0 || !Array.isArray(data.req_1?.data?.songList)) {
      throw new Error(`QQ Music returned an invalid catalog for ${singer.name} at ${begin}.`);
    }
    const page = data.req_1.data;
    if (expectedTotal === null) expectedTotal = page.totalNum;
    if (page.totalNum !== expectedTotal) throw new Error(`${singer.name} catalog changed while syncing; rerun.`);
    if (!page.songList.length && begin < expectedTotal) throw new Error(`${singer.name} returned an empty page before the catalog end.`);
    for (const entry of page.songList) {
      const song = entry.songInfo;
      if (!song?.mid || !song?.title) throw new Error(`Malformed QQ Music song at ${begin}.`);
      const coverKey = song.album?.pmid || song.album?.mid;
      const cover = coverKey ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${coverKey}.jpg` : 'https://y.gtimg.cn/music/photo_new/T001R300x300M000002KASw53FQbTK_4.jpg';
      const track = {
        id: `qq-${song.mid}`, title: text(song.title),
        artist: song.singer.map((artist) => text(artist.title || artist.name)).join(' / '),
        album: text(song.album?.title || song.album?.name), category: '', cover,
        coverSourceUrl: cover, url: '',
        sourceUrl: `https://y.qq.com/n/ryqq/songDetail/${song.mid}`,
        duration: song.interval || 0, year: Number((song.time_public || song.album?.time_public || '').slice(0, 4)) || null,
        publishedAt: song.time_public || song.album?.time_public || '', subtitle: text(song.subtitle || song.album?.subtitle),
        playable: false, playbackType: 'official-platform',
        playbackNote: '到 QQ 音乐收听', sourceIds: [singer.id],
        qqMusic: { songMid: song.mid, songId: song.id, albumMid: song.album?.mid || '',
          payPlay: Boolean(song.pay?.pay_play), payDownload: Boolean(song.pay?.pay_down) },
      };
      track.category = categoryFor(track);
      tracks.push(track);
    }
    console.log(`${singer.name}: ${Math.min(begin + page.songList.length, expectedTotal)}/${expectedTotal}`);
  }
  const unique = new Set(tracks.map((track) => track.id));
  if (unique.size !== expectedTotal) throw new Error(`${singer.name}: expected ${expectedTotal} unique songs, got ${unique.size}.`);
  return { tracks, expectedTotal };
}

async function cacheCover(track) {
  const relative = `/assets/music/covers/${hash(track.coverSourceUrl)}.jpg`;
  const file = path.join(ROOT, relative);
  if (await exists(file)) { track.cover = relative; return; }
  if (OFFLINE || SKIP_COVERS) return;
  try {
    const { response, bytes } = await binarySource(track.coverSourceUrl);
    if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('Not an image');
    if (bytes.length < 100 || bytes.length > 2 * 1024 * 1024) throw new Error('Unexpected cover size');
    await fs.writeFile(file, bytes);
    track.cover = relative;
  } catch (error) { console.warn(`Cover remains remote: ${track.title}: ${error.message}`); }
}

async function verifyAudio(track) {
  const relative = `/assets/music/audio/${track.id}.mp3`;
  const file = path.join(ROOT, relative);
  if (await exists(file)) track.url = relative;
  if (OFFLINE) return;
  try {
    // A small range checks accessibility and media type without downloading each file.
    const { response, bytes } = await binarySource(track.audioSourceUrl, { headers: { Range: 'bytes=0-2047' } });
    const contentType = response.headers.get('content-type') || '';
    if (!/audio|octet-stream/i.test(contentType)) throw new Error(`Unexpected content type ${contentType}`);
    if (!bytes.length) throw new Error('Empty media');
    track.audioVerifiedAt = new Date().toISOString();
    const total = response.headers.get('content-range')?.split('/')[1] || response.headers.get('content-length');
    if (Number(total)) track.audioBytes = Number(total);
    if (CACHE_AUDIO && !(await exists(file))) {
      const full = response.status === 200 ? bytes : (await binarySource(track.audioSourceUrl)).bytes;
      if (full.length > 20 * 1024 * 1024) throw new Error('Skipping unexpectedly large audio file');
      await fs.writeFile(file, full);
      track.url = relative;
    }
  } catch (error) {
    if (!(await exists(file))) { track.playable = false; track.url = ''; track.playbackNote = '官方音频暂不可用'; }
    track.audioError = error.message;
    console.warn(`Audio verification: ${track.title}: ${error.message}`);
  }
}

async function main() {
  await Promise.all([SNAPSHOTS, path.join(ROOT, 'data'), path.join(ROOT, 'assets/music/covers'), path.join(ROOT, 'assets/music/audio')].map((directory) => fs.mkdir(directory, { recursive: true })));
  const official = await officialTracks();
  const sources = [{ id: 'official-world-music', title: '王者荣耀世界观体验站 · 音乐鉴赏',
    url: OFFICIAL_PAGE, metadataUrl: OFFICIAL_LIST, expectedTotal: official.tracks.length, collectedTotal: official.tracks.length,
    collectionCount: official.collections.length, collections: official.collections, complete: true }];
  const byId = new Map(official.tracks.map((track) => [track.id, track]));
  for (const singer of SINGERS) {
    const result = await singerTracks(singer);
    sources.push({ id: singer.id, title: `QQ 音乐 · ${singer.name}`, url: `https://y.qq.com/n/ryqq/singer/${singer.mid}`,
      metadataUrl: QQ_API, expectedTotal: result.expectedTotal, collectedTotal: result.tracks.length, complete: true });
    for (const track of result.tracks) {
      const previous = byId.get(track.id);
      if (previous) previous.sourceIds.push(singer.id);
      else byId.set(track.id, track);
    }
  }
  const tracks = [...byId.values()];
  // QQ sometimes supplies the descriptive subtitle only on the main song, not
  // its instrumental variants. Reuse an unambiguous category within that album.
  const albumCategories = new Map();
  for (const track of tracks) {
    const albumId = track.qqMusic?.albumMid;
    if (!albumId || track.category === '其他音乐') continue;
    if (!albumCategories.has(albumId)) albumCategories.set(albumId, new Set());
    albumCategories.get(albumId).add(track.category);
  }
  for (const track of tracks) {
    const known = albumCategories.get(track.qqMusic?.albumMid);
    if (track.category === '其他音乐' && known?.size === 1) track.category = [...known][0];
  }
  const verificationFile = path.join(SNAPSHOTS, 'audio-verification.json');
  if (OFFLINE) {
    const verification = JSON.parse(await fs.readFile(verificationFile, 'utf8'));
    for (const track of official.tracks) {
      const previous = verification.tracks.find((entry) => entry.id === track.id);
      if (!previous) throw new Error(`No saved audio verification for ${track.id}. Run an online sync.`);
      Object.assign(track, previous);
      if (!track.playable) track.url = '';
      const localAudio = `/assets/music/audio/${track.id}.mp3`;
      if (await exists(path.join(ROOT, localAudio))) track.url = localAudio;
    }
  } else {
    await mapLimit(official.tracks, 4, verifyAudio);
    await fs.writeFile(verificationFile, JSON.stringify({ updatedAt: new Date().toISOString(), tracks: official.tracks.map(({ id, playable, audioVerifiedAt, audioBytes, audioError }) => ({ id, playable, audioVerifiedAt, audioBytes, audioError })) }, null, 2) + '\n');
  }
  // One download per cover. Albums share their cached image.
  const coverGroups = new Map();
  for (const track of tracks) {
    if (!coverGroups.has(track.coverSourceUrl)) coverGroups.set(track.coverSourceUrl, []);
    coverGroups.get(track.coverSourceUrl).push(track);
  }
  await mapLimit([...coverGroups.values()], 5, async (group) => {
    await cacheCover(group[0]);
    for (const track of group) track.cover = group[0].cover;
  });
  const playableTracks = tracks.filter((track) => track.playable).length;
  const result = { updatedAt: sourceFetchTimes.sort().at(-1), builtAt: new Date().toISOString(), sources, coverage: {
    scope: '官方世界观音乐鉴赏目录、QQ 音乐王者荣耀、无限王者团及王者荣耀同人局歌手目录',
    completeForListedSources: true, universalCompletenessClaimed: false,
    totalTracks: tracks.length, playableTracks,
    platformOnlyTracks: tracks.filter((track) => track.playbackType === 'official-platform').length,
    unavailableAudioTracks: tracks.filter((track) => track.playbackType === 'official-audio' && !track.playable).length,
    officialAudioTracks: official.tracks.length, qqMusicTracks: tracks.filter((track) => track.id.startsWith('qq-')).length,
    albums: new Set(tracks.map((track) => track.album)).size,
    categories: Object.fromEntries([...new Set(tracks.map((track) => track.category))].map((category) => [category, tracks.filter((track) => track.category === category).length])),
    note: '已完整同步上述来源。歌曲版本按 QQ 音乐 songMid 去重；官网原声保留独立版本。平台歌曲通过官方链接收听，站内播放仅使用官网公开 MP3。公开目录可能未涵盖未发行、下架或其他艺人名下的合作歌曲。',
  }, tracks };
  const temp = path.join(ROOT, 'data/music.json.tmp');
  await fs.writeFile(temp, JSON.stringify(result, null, 2) + '\n');
  await fs.rename(temp, path.join(ROOT, 'data/music.json'));
  console.log(JSON.stringify(result.coverage, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
