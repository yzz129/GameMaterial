const fs = require('fs');
const https = require('https');

function fetchBwikiVoice(charName) {
  return new Promise((resolve) => {
    const pageName = encodeURIComponent(charName + '语音');
    const url = `https://wiki.biligame.com/ys/api.php?action=parse&page=${pageName}&prop=text&format=json`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return resolve({ name: charName, ok: false, pairs: [] });
          const html = json.parse?.text?.['*'] || '';
          const pairs = [];
          
          // Match all table rows with voice title and audio
          // Pattern in BWIKI table:
          // title is in a div with font-weight:bold, followed by 4 audio links (Chinese, Japanese, English, Korean)
          const rowRegex = /<div style="[^"]*font-weight:bold[^"]*">([^<]+)<\/div>[\s\S]*?<div class="bikit-audio"[^>]*data-src="([^"]+)"/gi;
          let m;
          while ((m = rowRegex.exec(html)) !== null) {
            const rawTitle = m[1].trim();
            const rawAudio = m[2].replace(/&#58;/g, ':').trim();
            if (rawTitle && rawTitle !== '中' && rawTitle !== '语音' && rawAudio.startsWith('http')) {
              pairs.push({ title: rawTitle, audio: rawAudio });
            }
          }
          resolve({ name: charName, ok: true, pairs });
        } catch(e) {
          resolve({ name: charName, ok: false, pairs: [] });
        }
      });
    }).on('error', e => resolve({ name: charName, ok: false, pairs: [] }));
  });
}

function normalizeTitle(t) {
  return t.replace(/[…\.\s·\-_（）\(\)]/g, '').toLowerCase();
}

async function testMatch(charId, charName) {
  const charPath = `D:/yuanshenvoice/data/characters/${charId}.json`;
  const charData = JSON.parse(fs.readFileSync(charPath, 'utf8'));
  const bwiki = await fetchBwikiVoice(charName);
  
  console.log(`\n=== Testing ${charName} (ID: ${charId}) ===`);
  console.log(`BWIKI audio items: ${bwiki.pairs.length}`);
  console.log(`Local lines: ${charData.friendLines.length} friend + ${charData.actionLines.length} action = ${charData.quoteCount}`);

  // Map of normalized title -> audio URL
  const audioMap = new Map();
  bwiki.pairs.forEach(p => {
    const norm = normalizeTitle(p.title);
    if (!audioMap.has(norm)) audioMap.set(norm, p.audio);
    // Also store exact
    if (!audioMap.has(p.title)) audioMap.set(p.title, p.audio);
  });

  let matched = 0;
  const allLines = [...charData.friendLines, ...charData.actionLines];
  allLines.forEach(line => {
    const direct = audioMap.get(line.title);
    const norm = audioMap.get(normalizeTitle(line.title));
    const audio = direct || norm;
    if (audio) {
      matched++;
    }
  });

  console.log(`Matched with real audio: ${matched} / ${allLines.length} (${(matched / allLines.length * 100).toFixed(1)}%)`);
}

async function run() {
  await testMatch(10000046, '胡桃');
  await testMatch(10000073, '纳西妲');
  await testMatch(10000030, '钟离');
  await testMatch(10000089, '芙宁娜');
}
run();
