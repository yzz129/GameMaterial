const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog.json'), 'utf8'));

// Name aliases for BWIKI
const PAGE_ALIASES = {
  '空': '旅行者(空)语音',
  '荧': '旅行者(荧)语音'
};

function fetchBwikiHtml(charName) {
  const pageTitle = PAGE_ALIASES[charName] || (charName + '语音');
  const url = `https://wiki.biligame.com/ys/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json`;

  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GenshinVoiceArchive/2.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            // Try alternate title if failed
            resolve({ ok: false, error: json.error.info, html: '' });
            return;
          }
          resolve({ ok: true, html: json.parse?.text?.['*'] || '' });
        } catch(e) {
          resolve({ ok: false, error: e.message, html: '' });
        }
      });
    }).on('error', e => resolve({ ok: false, error: e.message, html: '' }));
  });
}

function normalizeTitle(t) {
  return t.replace(/[…\.\s·\-_（）\(\)·:：]/g, '').toLowerCase();
}

function parseVoicePairs(html) {
  const pairs = [];
  const regex = /<div style="[^"]*width:180px;[^"]*font-weight:bold">([^<]+)<\/div>[\s\S]{1,350}?<div class="bikit-audio"[^>]*data-src="([^"]+)"/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const rawTitle = m[1].trim();
    const rawAudio = m[2].replace(/&#58;/g, ':').trim();
    if (rawTitle && rawTitle !== '中' && rawTitle !== '语音' && rawAudio.startsWith('http')) {
      pairs.push({ title: rawTitle, audio: rawAudio });
    }
  }
  return pairs;
}

async function processCharacter(charMeta) {
  const charId = charMeta.id;
  const charName = charMeta.name;
  const jsonPath = path.join(ROOT, `data/characters/${charId}.json`);

  if (!fs.existsSync(jsonPath)) {
    console.log(`[SKIP] ${charName} (${charId}) json not found.`);
    return { name: charName, matched: 0, total: 0 };
  }

  const charData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const bwikiRes = await fetchBwikiHtml(charName);

  if (!bwikiRes.ok) {
    console.log(`[WARN] ${charName} BWIKI fetch failed: ${bwikiRes.error}`);
    return { name: charName, matched: 0, total: charData.quoteCount };
  }

  const pairs = parseVoicePairs(bwikiRes.html);
  if (pairs.length === 0) {
    console.log(`[WARN] ${charName} parsed 0 voice pairs from BWIKI.`);
    return { name: charName, matched: 0, total: charData.quoteCount };
  }

  // Create lookup maps
  const audioByExact = new Map();
  const audioByNorm = new Map();

  pairs.forEach(p => {
    audioByExact.set(p.title, p.audio);
    const n = normalizeTitle(p.title);
    if (!audioByNorm.has(n)) audioByNorm.set(n, p.audio);
  });

  let matchedCount = 0;
  const matchLine = (line) => {
    const exact = audioByExact.get(line.title);
    const norm = audioByNorm.get(normalizeTitle(line.title));
    const audioUrl = exact || norm;
    if (audioUrl) {
      line.audioUrl = audioUrl;
      matchedCount++;
    }
  };

  if (charData.friendLines) charData.friendLines.forEach(matchLine);
  if (charData.actionLines) charData.actionLines.forEach(matchLine);

  // Write updated JSON
  const updatedJsonStr = JSON.stringify(charData);
  fs.writeFileSync(jsonPath, updatedJsonStr, 'utf8');

  // Re-compress .br and .gz
  const brBuf = zlib.brotliCompressSync(Buffer.from(updatedJsonStr, 'utf8'));
  const gzBuf = zlib.gzipSync(Buffer.from(updatedJsonStr, 'utf8'));
  fs.writeFileSync(jsonPath + '.br', brBuf);
  fs.writeFileSync(jsonPath + '.gz', gzBuf);

  console.log(`✔ [${charName}] Matched ${matchedCount} / ${charData.quoteCount} real voice audio URLs.`);
  return { name: charName, matched: matchedCount, total: charData.quoteCount };
}

async function runAll() {
  console.log(`Starting real character voice synchronization for all ${catalog.length} characters...`);
  const startTime = Date.now();
  let totalMatched = 0;
  let totalQuotes = 0;

  // Process in batches of 4 with 250ms gap
  const BATCH_SIZE = 4;
  for (let i = 0; i < catalog.length; i += BATCH_SIZE) {
    const batch = catalog.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(processCharacter));
    results.forEach(r => {
      totalMatched += r.matched;
      totalQuotes += r.total;
    });
    // small throttle delay
    await new Promise(r => setTimeout(r, 250));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`🎉 角色原声音频全量同步完成！`);
  console.log(`⏱ 耗时: ${duration}s`);
  console.log(`🎵 共绑定原声直链: ${totalMatched} / ${totalQuotes} 条台词 (${(totalMatched / totalQuotes * 100).toFixed(1)}%)`);
  console.log(`======================================================`);
}

runAll();
