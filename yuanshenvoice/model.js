'use strict';
(() => {
  // Some source catalogs repeat a line title for alternate costumes. Keep the
  // first legacy favorite key, and give later recordings stable distinct keys.
  function normalizeDetails(character) {
    const used = new Set();
    const reserved = new Set([...(character.friendLines || []), ...(character.actionLines || [])].map(line => line.key).filter(Boolean));
    const normalize = rows => (rows || []).map(line => {
      const base = line.key || line.title;
      let key = base, count = 1;
      while (used.has(key) || !line.key && reserved.has(key)) key = `${base}#${++count}`;
      used.add(key);
      return {...line, key};
    });
    return {...character, friendLines: normalize(character.friendLines), actionLines: normalize(character.actionLines)};
  }
  const mediaFields = new Set(['avatarImg','cardArt','splashArt','fullArt','heroArt','artScene','cover','src','srcFallback','localUrl','localAudio','audioUrl','proxyUrl','flacUrl','art','cutoutArt','url','file']);
  function normalizeMedia(value, basePath = '/') {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => normalizeMedia(item,basePath));
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,typeof item==='string' && mediaFields.has(key) && item.startsWith('/') && !item.startsWith('//') && basePath!=='/' && !item.startsWith(basePath) ? basePath+item.slice(1) : normalizeMedia(item,basePath)]));
  }
  globalThis.ArchiveModel = Object.freeze({normalizeDetails,normalizeMedia});
})();
