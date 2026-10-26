const fs = require('fs');
const https = require('https');

const catalog = JSON.parse(fs.readFileSync('D:/yuanshenvoice/data/catalog.json', 'utf8'));

function fetchBwikiVoice(charName) {
  return new Promise((resolve) => {
    // Try charName + "语音"
    const pageName = encodeURIComponent(charName + '语音');
    const url = `https://wiki.biligame.com/ys/api.php?action=parse&page=${pageName}&prop=text&format=json`;
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            resolve({ name: charName, ok: false, error: json.error.info });
            return;
          }
          const html = json.parse?.text?.['*'] || '';
          
          // Regex to extract title and 1st bikit-audio (Chinese audio)
          // Look at pattern:
          // <div style="[^"]*font-weight:bold[^"]*">([^<]+)<\/div>[\s\S]*?<div class="bikit-audio"[^>]*data-src="([^"]+)"
          const titleAudioPairs = [];
          const rowRegex = /<div style="[^"]*font-weight:bold[^"]*">([^<]+)<\/div>[\s\S]*?<div class="bikit-audio"[^>]*data-src="([^"]+)"/gi;
          let m;
          while ((m = rowRegex.exec(html)) !== null) {
            const rawTitle = m[1].trim();
            const rawAudio = m[2].replace(/&#58;/g, ':').trim();
            if (rawTitle && rawTitle !== '中' && rawTitle !== '语音' && rawAudio.startsWith('http')) {
              titleAudioPairs.push({ title: rawTitle, audio: rawAudio });
            }
          }

          resolve({ name: charName, ok: true, count: titleAudioPairs.length, pairs: titleAudioPairs });
        } catch(e) {
          resolve({ name: charName, ok: false, error: e.message });
        }
      });
    }).on('error', e => resolve({ name: charName, ok: false, error: e.message }));
  });
}

async function testAll() {
  console.log(`Testing first 10 characters out of ${catalog.length}...`);
  for (let i = 0; i < 10; i++) {
    const c = catalog[i];
    const res = await fetchBwikiVoice(c.name);
    console.log(`${c.name} (ID: ${c.id}): found ${res.count || 0} voices. (ok: ${res.ok})`);
    if (res.pairs && res.pairs.length > 0) {
      console.log(`   Sample: [${res.pairs[0].title}] -> ${res.pairs[0].audio}`);
    }
  }
}

testAll();
