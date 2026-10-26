const catalog = require('../data/catalog.json');
for (const name of ['白术', '神里绫人', '林尼', '凯亚', '米卡', '早柚', '菲米尼', '安柏', '凝光', '琴', '达达利亚']) {
  const c = catalog.find(x => x.name === name);
  const d = require(`../data/characters/${c.id}.json`);
  const lines = [...d.friendLines, ...d.actionLines];
  const withAudio = lines.filter(l => l.audioUrl).length;
  console.log(name, `${withAudio}/${lines.length} lines have audioUrl`);
}
