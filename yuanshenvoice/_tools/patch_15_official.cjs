const fs = require('fs');
const path = require('path');

const ROOT = 'D:/yuanshenvoice';

// 1. Barbara: 10000014
const barbaraFile = path.join(ROOT, 'data/characters/10000014.json');
const barbara = JSON.parse(fs.readFileSync(barbaraFile, 'utf8'));
const b3 = barbara.friendLines.find(l => l.title === '收到赠礼·其三');
if (b3 && !b3.audioUrl) {
  b3.audioUrl = 'https://static.wikia.nocookie.net/gensin-impact/images/e/ef/VO_ZH_Barbara_Receiving_a_Gift_-_03.ogg';
  console.log('Patched Barbara 收到赠礼·其三');
}
fs.writeFileSync(barbaraFile, JSON.stringify(barbara, null, 2), 'utf8');

// 2. Itto: 10000057
const ittoFile = path.join(ROOT, 'data/characters/10000057.json');
const itto = JSON.parse(fs.readFileSync(ittoFile, 'utf8'));
const i1 = itto.friendLines.find(l => l.title === '收到赠礼·其一');
if (i1 && !i1.audioUrl) {
  i1.audioUrl = 'https://static.wikia.nocookie.net/gensin-impact/images/d/d6/VO_ZH_Arataki_Itto_Receiving_a_Gift_-_01.ogg';
  console.log('Patched Itto 收到赠礼·其一');
}
fs.writeFileSync(ittoFile, JSON.stringify(itto, null, 2), 'utf8');

// 3. Sayu: 10000053
const sayuFile = path.join(ROOT, 'data/characters/10000053.json');
const sayu = JSON.parse(fs.readFileSync(sayuFile, 'utf8'));
const s1 = sayu.friendLines.find(l => l.title === '想要了解早柚·其一');
if (s1 && !s1.audioUrl) {
  s1.audioUrl = 'https://static.wikia.nocookie.net/gensin-impact/images/c/ce/VO_ZH_Sayu_More_About_Sayu_-_01.ogg';
  console.log('Patched Sayu 想要了解早柚·其一');
}
fs.writeFileSync(sayuFile, JSON.stringify(sayu, null, 2), 'utf8');

// 4. Diluc: 10000016
const dilucFile = path.join(ROOT, 'data/characters/10000016.json');
const diluc = JSON.parse(fs.readFileSync(dilucFile, 'utf8'));
const d3 = diluc.friendLines.find(l => l.title === '收到赠礼·其三');
if (d3 && !d3.audioUrl) {
  d3.audioUrl = 'https://static.wikia.nocookie.net/gensin-impact/images/4/49/VO_ZH_Diluc_Receiving_a_Gift_-_03.ogg';
  console.log('Patched Diluc 收到赠礼·其三');
}
fs.writeFileSync(dilucFile, JSON.stringify(diluc, null, 2), 'utf8');

// 5. Dori: 10000068
const doriFile = path.join(ROOT, 'data/characters/10000068.json');
const dori = JSON.parse(fs.readFileSync(doriFile, 'utf8'));
const doriMap = {
  '元素爆发·其一': 'https://static.wikia.nocookie.net/gensin-impact/images/3/3e/VO_ZH_Dori_Elemental_Burst_01.ogg',
  '元素爆发·其二': 'https://static.wikia.nocookie.net/gensin-impact/images/5/50/VO_ZH_Dori_Elemental_Burst_02.ogg',
  '元素爆发·其三': 'https://static.wikia.nocookie.net/gensin-impact/images/5/56/VO_ZH_Dori_Elemental_Burst_03.ogg',
  '生命值低·其一': 'https://static.wikia.nocookie.net/gensin-impact/images/7/75/VO_ZH_Dori_Low_HP_01.ogg',
  '生命值低·其二': 'https://static.wikia.nocookie.net/gensin-impact/images/5/5b/VO_ZH_Dori_Low_HP_02.ogg',
  '生命值低·其三': 'https://static.wikia.nocookie.net/gensin-impact/images/b/b0/VO_ZH_Dori_Low_HP_03.ogg',
  '同伴生命值低·其一': 'https://static.wikia.nocookie.net/gensin-impact/images/4/46/VO_ZH_Dori_Ally_at_Low_HP_01.ogg',
  '同伴生命值低·其二': 'https://static.wikia.nocookie.net/gensin-impact/images/d/de/VO_ZH_Dori_Ally_at_Low_HP_02.ogg',
  '倒下·其一': 'https://static.wikia.nocookie.net/gensin-impact/images/9/9f/VO_ZH_Dori_Fallen_01.ogg',
  '倒下·其二': 'https://static.wikia.nocookie.net/gensin-impact/images/6/6c/VO_ZH_Dori_Fallen_02.ogg',
  '倒下·其三': 'https://static.wikia.nocookie.net/gensin-impact/images/8/81/VO_ZH_Dori_Fallen_03.ogg'
};

for (const line of dori.actionLines) {
  if (doriMap[line.title] && !line.audioUrl) {
    line.audioUrl = doriMap[line.title];
    console.log('Patched Dori', line.title);
  }
}
fs.writeFileSync(doriFile, JSON.stringify(dori, null, 2), 'utf8');

console.log('Done patching 15 official audio lines.');
