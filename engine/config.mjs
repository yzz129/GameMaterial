import fs from 'node:fs/promises';
import path from 'node:path';

export const readJSON = async file => JSON.parse(await fs.readFile(file, 'utf8'));
export const writeJSON = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');

export function localPath(root, relative) {
  if (typeof relative !== 'string' || !relative || /[\\\0?#]/.test(relative) || path.isAbsolute(relative)) throw new Error(`需要站内相对路径：${relative}`);
  const full = path.resolve(root, relative);
  const boundary = path.relative(root, full);
  if (!boundary || boundary.startsWith('..') || path.isAbsolute(boundary)) throw new Error(`路径越界：${relative}`);
  return full;
}

export function validateConfig(config) {
  if (config.schemaVersion !== 1) throw new Error('game.config.json 的 schemaVersion 必须为 1');
  for (const field of ['brand','assets','data','home','copy','filters','detail','features','music','theme','server','storage']) {
    if (!config[field] || typeof config[field] !== 'object' || Array.isArray(config[field])) throw new Error(`缺少配置对象：${field}`);
  }
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(config.id || '')) throw new Error('游戏 id 仅支持小写英文、数字和连字符');
  for (const field of ['title', 'shortName', 'englishName', 'world', 'copyright']) {
    if (typeof config.brand?.[field] !== 'string' || !config.brand[field].trim()) throw new Error(`缺少 brand.${field}`);
  }
  if (!Number.isInteger(config.server?.port) || config.server.port < 1024 || config.server.port > 65535) throw new Error('server.port 必须在 1024–65535 之间');
  if (!/^[a-z][a-z0-9_-]+$/.test(config.storage?.namespace || '')) throw new Error('storage.namespace 无效');
  for (const field of ['catalog', 'characters', 'search', 'music']) localPath(process.cwd(), config.data?.[field]);
  for (const file of [config.assets?.logo, config.assets?.placeholder, config.assets?.font, ...(config.styles || [])]) localPath(process.cwd(), file);
  for (const file of [config.assets.fontBold,config.assets.fontFallback].filter(Boolean))localPath(process.cwd(),file);
  if(config.assets.fontPatch){
    localPath(process.cwd(),config.assets.fontPatch.src);
    const points=config.assets.fontPatch.codepoints;
    if(!Array.isArray(points)||!points.length||points.length>2000||points.some(point=>!Number.isInteger(point)||point<1||point>0x10ffff))throw Error('assets.fontPatch.codepoints 必须为有效 Unicode 码点数组');
  }
  for (const scheme of ['dark', 'light']) for (const [name, value] of Object.entries(config.theme?.[scheme] || {})) {
    if (!/^--[a-z][a-z0-9-]*$/.test(name) || typeof value !== 'string' || /[{};<>]|url\s*\(/i.test(value)) throw new Error(`主题变量无效：${name}`);
  }
  if (!Array.isArray(config.filters?.elements) || !Array.isArray(config.music?.tabs)) throw new Error('filters.elements 与 music.tabs 必须为数组');
  if (!Array.isArray(config.home.titleLines) || !config.home.titleLines.length || config.home.titleLines.some(line=>typeof line!=='string')) throw new Error('home.titleLines 必须为非空文字数组');
  if(config.home.artMode&&!['cutout','illustration'].includes(config.home.artMode))throw Error('home.artMode 必须为 cutout 或 illustration');
  if (!config.assets.scenes || !Array.isArray(config.home.preferred) || !Array.isArray(config.detail.metadata)) throw new Error('缺少场景、推荐角色或详情字段配置');
  for (const name of ['primary','secondary']) {
    const filter=config.filters[name];
    if (!filter?.label || !filter.allLabel || name==='primary'&&!Array.isArray(filter.options) || filter.options!=null&&!Array.isArray(filter.options)) throw new Error(`筛选配置无效：filters.${name}`);
  }
  for (const tab of config.music.tabs) if (!/^[\w\u4e00-\u9fff-]+$/.test(tab.id) || !tab.label) throw new Error('音乐分类需要稳定的 id 和 label');
  return config;
}

export async function inspectGame(root, {checkAssets = true} = {}) {
  const config = validateConfig(await readJSON(path.join(root, 'game.config.json')));
  const catalog = await readJSON(localPath(root, config.data.catalog));
  const music = await readJSON(localPath(root, config.data.music));
  if (!Array.isArray(catalog) || !Array.isArray(music.tracks)) throw new Error('角色目录必须为数组；音乐目录必须含 tracks 数组');
  const seen = new Set(), search = [];
  let voices = 0;
  const assetPaths = new Set([config.assets.logo, config.assets.placeholder, config.assets.font, ...(config.styles || [])]);
  const addAsset = value => { if (typeof value === 'string' && value && !/^https?:\/\//i.test(value)) assetPaths.add(value.replace(/^\/+/, '')); };
  addAsset(config.assets.fontBold);addAsset(config.assets.fontFallback);
  addAsset(config.assets.fontPatch?.src);
  addAsset(config.assets.favicon);
  for (const element of config.filters.elements) addAsset(element.asset);
  for (const scene of Object.values(config.assets.scenes || {})) { addAsset(scene.src); addAsset(scene.poster); }
  addAsset(config.home.titleArt?.still); addAsset(config.home.titleArt?.intro);
  addAsset(config.legacy?.home?.titleArt?.still); addAsset(config.legacy?.home?.titleArt?.intro);
  for (const character of catalog) {
    if (!Number.isSafeInteger(character.id) || character.id < 1 || !character.name || seen.has(character.id)) throw new Error(`角色 id 或名称无效/重复：${character.id}`);
    seen.add(character.id);
    if (typeof character.metadataSearch !== 'string') throw new Error(`角色 ${character.id} 缺少 metadataSearch 搜索文字`);
    const detail = await readJSON(localPath(root, `${config.data.characters}/${character.id}.json`));
    if (detail.id !== character.id || detail.name !== character.name || !Array.isArray(detail.friendLines) || !Array.isArray(detail.actionLines)) throw new Error(`角色详情不匹配：${character.id}`);
    const lines = [...detail.friendLines, ...detail.actionLines], keys = new Set();
    for (const line of lines) {
      const key = line.key || line.title;
      if (!key || line.key && keys.has(line.key)) throw new Error(`角色 ${character.id} 的语音 key 重复或为空：${key}`);
      if (line.key) keys.add(line.key);
      addAsset(line.localAudio);addAsset(line.audioUrl);
    }
    if (character.quoteCount !== lines.length) throw new Error(`角色 ${character.id} 的 quoteCount 与详情数量不符`);
    voices += lines.length;
    search.push({id: character.id, text: [character.metadataSearch, character.name, character.title, ...(character.roles || []), ...lines.flatMap(line => [line.title, line.desc])].filter(Boolean).join('\n').normalize('NFKC').toLowerCase()});
    for (const field of ['avatarImg', 'cardArt', 'splashArt', 'fullArt', 'heroArt']) addAsset(character[field]);
    for (const skin of character.skins || []) { addAsset(skin.art); addAsset(skin.cutoutArt); }
  }
  const musicIds = new Set();
  for (const track of music.tracks) {
    if (!track.id || musicIds.has(track.id)) throw new Error(`音乐 id 为空或重复：${track.id}`);
    musicIds.add(track.id);
    if (track.playable === false && !/^https:\/\//.test(track.sourceUrl || '')) throw new Error(`站外音乐缺少 HTTPS 来源：${track.id}`);
    addAsset(track.cover);
    for (const field of ['localUrl','src','srcFallback','flacUrl']) addAsset(track[field]);
  }
  if (config.home.characterId && catalog.length && !seen.has(config.home.characterId)) throw new Error('home.characterId 不在角色目录中');
  if (checkAssets) for (const file of assetPaths) await fs.access(localPath(root, file)).catch(() => { throw new Error(`素材不存在：${file}`); });
  return {config, catalog, music, search, voices};
}
