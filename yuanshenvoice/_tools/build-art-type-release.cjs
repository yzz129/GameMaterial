'use strict';
// Scope this release to typography while another feature is being edited locally.
// Never rewrite the shared app.js/styles.css or discard that work.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const base = path.join(root, '_backups/2026-10-23-art-type-v1');
const dist = path.join(root, 'cloudflare-dist');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const currentApp = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const currentStyle = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let app = fs.readFileSync(path.join(base, 'app.js'), 'utf8');
let style = fs.readFileSync(path.join(base, 'styles.css'), 'utf8');
function replaceFromCurrent(pattern, label) {
  const match = currentApp.match(pattern);
  if (!match || !pattern.test(app)) throw new Error(`Missing ${label} release anchor`);
  app = app.replace(pattern, () => match[0]);
}
replaceFromCurrent(/<a class="brand"[^\n]+?<\/a>/, 'brand');
const title = currentApp.match(/<h1 id="heroTitle" class="hero-art-title">[^\n]+?<\/h1>/);
if (!title || !/<h1 id="heroTitle">[^\n]+?<\/h1>/.test(app)) throw new Error('Missing hero title release anchor');
app = app.replace(/<h1 id="heroTitle">[^\n]+?<\/h1>/, () => title[0]);
replaceFromCurrent(/  function createAtmosphere\(\) \{[\s\S]+?\n  \/\/ One illustration/, 'media lifecycle');
const artStyles = currentStyle.match(/\/\* AE-rendered,[\s\S]+?\n@media\(max-width:374px\)\{[^\n]+\}/);
if (!artStyles || !app.includes('function syncTitle(') || app.includes('musicBoxPill')) throw new Error('Typography-only release assertion failed');
style += '\n' + artStyles[0] + '\n.brand-wordmark{flex-shrink:0;white-space:nowrap}\n@media(max-width:359px){.brand .brand-wordmark small{display:none}}\n';
fs.writeFileSync(path.join(dist, 'app.js'), app);
fs.writeFileSync(path.join(dist, 'styles.css'), style);
fs.writeFileSync(path.join(root, 'output/art-type-ae-v1/scoped-bundle.json'), JSON.stringify({
  scope:'AE typography, responsive layout and motion lifecycle only',
  baseline:'_backups/2026-10-23-art-type-v1',
  sharedWorkspacePreserved:true,
  files:{'app.js':sha(app),'styles.css':sha(style)},
  workspace:{'app.js':sha(currentApp),'styles.css':sha(currentStyle)},
  deferred:'Concurrent music-box feature and its audio packaging remain in the shared workspace.'
},null,2));
console.log('Typography release prepared from the pre-edit snapshot. Shared workspace files preserved.');
