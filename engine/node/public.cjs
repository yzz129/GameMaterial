'use strict';
const fs = require('node:fs');
const path = require('node:path');

function publicPolicy(root, suppliedManifest) {
  const manifest = suppliedManifest || JSON.parse(fs.readFileSync(path.join(root, 'site-public.json'), 'utf8'));
  const exact = new Set(manifest.files);
  const characters = manifest.characters.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const detail = new RegExp('^' + characters + '/[1-9][0-9]*\\.json$');
  const allowed = file => exact.has(file) || detail.test(file)
    || /^assets\/(?!masters\/)[\w./-]+\.(?:webp|png|jpe?g|svg|json|ico|woff2?|flac|mp3|ogg|wav|m4a|mp4)$/i.test(file)
    || /^[^/]*语音全集\(分类整理\)\/.+\.(?:mp3|wav|ogg)$/i.test(file)
    || /^raw\/[\w-]+\.(?:mp3|wav|ogg)$/i.test(file);
  return {allowed, aliases: {'voice_index':'voice_index.html', ...manifest.aliases}};
}
module.exports = {publicPolicy};
