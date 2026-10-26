import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inspectGame, localPath, writeJSON} from './config.mjs';

const engine = path.dirname(fileURLToPath(import.meta.url));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsonScript = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const url = value => `url(${JSON.stringify(value || '')})`;

export async function prepareGame(root, {outputRoot = root, basePath = '/'} = {}) {
  if (!/^\/(?:[a-z0-9-]+\/)*$/.test(basePath)) throw new Error('无效的游戏基础路径');
  await fs.mkdir(outputRoot, {recursive:true});
  const {config, catalog, music, search, voices} = await inspectGame(root);
  const files = ['app.js', 'model.js', 'audio-autoplay.js', 'styles.css', 'dialog.css', 'search-worker.js'];
  for (const file of files) await fs.copyFile(path.join(engine, 'client', file), path.join(outputRoot, file));
  await fs.appendFile(path.join(outputRoot, 'dialog.css'), '\n' + await fs.readFile(path.join(engine, 'client/theme-features.css'), 'utf8'));
  await fs.mkdir(path.dirname(localPath(outputRoot, config.data.search)), {recursive: true});
  await writeJSON(localPath(outputRoot, config.data.search), search);
  const runtime = structuredClone(config);
  delete runtime.server; delete runtime.build;
  runtime.basePath = basePath;
  runtime.stats = {characters: catalog.length, voices, music: music.tracks.length};
  runtime.home.character = catalog.find(c => c.id === config.home.characterId) || catalog[0] || null;
  if (runtime.legacy) runtime.legacy.home = {...runtime.home, ...runtime.legacy.home, character: catalog.find(c => c.id === runtime.legacy.characterId) || runtime.home.character};
  let preview = music.tracks.filter(t => t.playable !== false && (t.isLocal || t.localUrl || t.src && !/^https?:/i.test(t.src)));
  if (!preview.length) preview = music.tracks.filter(t => t.playable !== false);
  runtime.music.initialTracks = preview.slice(0, 48);
  runtime.filters.regions ||= [...new Set(catalog.map(c => c.region).filter(Boolean))].map(region => [region, region, region]);
  runtime.filters.secondary.options ||= [...new Set(catalog.map(c => c.weapon).filter(Boolean))].map(value => ({value, label: value}));
  const configJS = `/* Generated from game.config.json and the game catalogs. */\nwindow.GAME_CONFIG=${jsonScript(runtime)};\n(() => {const g=window.GAME_CONFIG;const root=document.documentElement;root.dataset.game=g.id;root.dataset.titleArt=String(Boolean(g.home.titleArt?.still));root.dataset.rarity=String(g.features.rarity!==false);root.dataset.music=String(g.features.music!==false);try{root.dataset.theme=localStorage.getItem(g.storage.namespace+'_theme')||g.theme.default||'dark'}catch{root.dataset.theme=g.theme.default||'dark'}})();\n`;
  await fs.writeFile(path.join(outputRoot, 'site-config.js'), configJS);
  const vars = scheme => Object.entries(config.theme[scheme] || {}).map(([key,value]) => `${key}:${value}`).join(';');
  const scenes = config.assets.scenes || {};
  const titlePreload=config.home.titleArt?.still?`<link rel="preload" href="${escape(config.home.titleArt.still)}" as="image" fetchpriority="high">`:'';
  const fontFace=(name,file,weight,points)=>`@font-face{font-family:'${name}';src:url(${JSON.stringify(file)}) format('${file.endsWith('.woff2')?'woff2':file.endsWith('.ttf')?'truetype':file.endsWith('.otf')?'opentype':'woff'}');font-weight:${weight};font-style:normal;font-display:swap${points?';unicode-range:'+points.map(point=>'U+'+point.toString(16).toUpperCase()).join(','):''}}`;
  // Discrete weights also work in older mobile WebViews. A small WOFF patch
  // gives shared UI glyphs priority without waiting for the full fallback font.
  const fonts=[
    ...[400,500].map(weight=>fontFace('ArchiveFont',config.assets.font,weight)),
    ...(config.assets.fontBold?[600,700].map(weight=>fontFace('ArchiveFont',config.assets.fontBold,weight)):[]),
    ...(config.assets.fontFallback?[400,700].map(weight=>fontFace('ArchiveFallback',config.assets.fontFallback,weight)):[]),
    ...(config.assets.fontPatch?[400,500,600,700].map(weight=>fontFace('ArchiveFont',config.assets.fontPatch.src,weight,config.assets.fontPatch.codepoints)):[])
  ].join('\n');
  const css = `/* Generated from game.config.json. Customize theme.css for additional art direction. */\n${fonts}\n:root,#characterDialog{--archive-font:'ArchiveFont',${config.assets.fontFallback?"'ArchiveFallback',":''}'Microsoft YaHei',sans-serif;--genshin-font:var(--archive-font);--display-font:var(--archive-font);--scene-desktop:${url(scenes.pc?.poster || config.assets.placeholder)};--scene-mobile:${url(scenes.mobile?.poster || scenes.pc?.poster || config.assets.placeholder)};${vars('dark')}}\nhtml[data-theme=light],html[data-theme=light] #characterDialog{${vars('light')}}\n`;
  await fs.writeFile(path.join(outputRoot, 'theme.generated.css'), css);
  const version = {};
  const generated = [...files, 'site-config.js', 'theme.generated.css', config.data.search];
  for (const file of [...files, 'site-config.js', 'theme.generated.css', ...(config.styles || [])]) version[file] = hash(await fs.readFile(localPath(generated.includes(file) ? outputRoot : root, file)));
  const html = `<!doctype html>\n<html lang="zh-CN" data-theme="${escape(config.theme.default || 'dark')}"><head>\n<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="${escape(config.theme.dark['--bg'] || '#101a26')}"><meta name="description" content="${escape(config.brand.description)}">\n<title>${escape(config.brand.title)}</title><link rel="icon" href="${escape(config.assets.favicon || config.assets.logo)}">\n${titlePreload}\n<link rel="preload" href="${escape(config.assets.font)}" as="font" type="font/woff" crossorigin>\n${['styles.css', ...(config.styles || []).filter(file=>file!=='theme.css'), 'dialog.css', 'theme.generated.css', ...(config.styles || []).filter(file=>file==='theme.css')].map(file => `<link rel="stylesheet" href="${escape(file)}?v=${version[file]}">`).join('\n')}\n<script src="site-config.js?v=${version['site-config.js']}"></script><script src="model.js?v=${version['model.js']}" defer></script><script src="audio-autoplay.js?v=${version['audio-autoplay.js']}" defer></script><script src="app.js?v=${version['app.js']}" defer></script>\n</head><body><div id="app"><p class="initial-loading">正在打开${escape(config.brand.shortName)}…</p></div><noscript>请启用 JavaScript 浏览角色与语音档案。</noscript></body></html>\n`;
  const pages = ['index.html', 'voice_index.html', ...(config.legacy ? [config.legacy.route] : [])];
  for (const page of pages) await fs.writeFile(localPath(outputRoot, page), html.replace('<head>', `<head>\n<base href="${basePath}">`));
  const publicFiles = [...pages, ...files, 'site-config.js', 'theme.generated.css', ...(config.styles || []), config.data.catalog, config.data.search, config.data.music, ...(config.publicFiles || [])];
  if (config.legacy?.data) publicFiles.push(config.legacy.data);
  await writeJSON(path.join(outputRoot, 'site-public.json'), {schemaVersion: 1, files: [...new Set(publicFiles)], generated:[...generated,...pages], characters: config.data.characters, aliases: config.legacy ? {[config.legacy.route.replace(/\.html$/, '')]: config.legacy.route} : {}});
  return {id: config.id, characters: catalog.length, voices, music: music.tracks.length, version: version['app.js']};
}
