const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog.json'), 'utf8'));

function normalize(s) {
  return String(s || '').replace(/[…\.\s·\-_（）\(\)·:：！!？\?，,、“”"''‘’]/g, '').toLowerCase();
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GenshinVoiceArchive/2.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// 1. Fetch BWIKI page text
async function fetchBwiki(pageTitle) {
  const url = `https://wiki.biligame.com/ys/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json`;
  const json = await fetchUrl(url);
  if (json && json.parse && json.parse.text) {
    return json.parse.text['*'];
  }
  return '';
}

// 2. Fetch Fandom page text
async function fetchFandom(fandomPage) {
  const url = `https://genshin-impact.fandom.com/api.php?action=parse&page=${encodeURIComponent(fandomPage)}&prop=text&format=json`;
  const json = await fetchUrl(url);
  if (json && json.parse && json.parse.text) {
    return json.parse.text['*'];
  }
  return '';
}

// Parser for Fandom HTML
function parseFandom(html) {
  const pairs = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  let currentTitle = '';

  while ((m = rowRegex.exec(html)) !== null) {
    const row = m[1];
    if (!row.includes('.ogg')) continue;

    const thMatch = row.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    if (thMatch) {
      const zhSpan = thMatch[1].match(/<span[^>]*lang="zh(?:-Hans)?"[^>]*>([\s\S]*?)<\/span>/i);
      if (zhSpan) {
        currentTitle = zhSpan[1].replace(/<[^>]+>/g, '').trim();
      } else {
        const idMatch = thMatch[1].match(/id="([^"]+)"/i);
        if (idMatch) currentTitle = idMatch[1].trim();
      }
    }

    let text = '';
    const tdMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    if (tdMatch) {
      const zhSpan = tdMatch[1].match(/<span[^>]*lang="zh(?:-Hans)?"[^>]*>([\s\S]*?)<\/span>/i);
      if (zhSpan) {
        text = zhSpan[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    const audioMatch = row.match(/https:\/\/static\.wikia\.nocookie\.net\/gensin-impact\/images\/[^\s"'<>]+\.ogg/i);
    if (audioMatch) {
      let audioUrl = audioMatch[0];
      const revIdx = audioUrl.indexOf('/revision/');
      if (revIdx !== -1) audioUrl = audioUrl.slice(0, revIdx);
      pairs.push({
        title: currentTitle,
        text,
        audioUrl
      });
    }
  }
  return pairs;
}

// Parser for BWIKI HTML
function parseBwiki(html) {
  const pairs = [];
  // Method A: regex for table cell with title followed by audio
  const cellRegex = /<div style="[^"]*width:180px;[^"]*font-weight:bold">([^<]+)<\/div>[\s\S]*?<div class="bikit-audio"[^>]*data-src="([^"]+)"/gi;
  let m;
  while ((m = cellRegex.exec(html)) !== null) {
    const rawTitle = m[1].trim();
    const rawAudio = m[2].replace(/&#58;/g, ':').trim();
    if (rawTitle && rawTitle !== '中' && rawTitle !== '语音' && rawAudio.startsWith('http')) {
      pairs.push({ title: rawTitle, audioUrl: rawAudio });
    }
  }

  // Method B: row by row parser
  const rowRegex = /<div style="display: table-row;[^"]*">([\s\S]*?)<\/div>\s*(?=<div style="display: table-row|$)/gi;
  while ((m = rowRegex.exec(html)) !== null) {
    const row = m[1];
    const titleM = row.match(/width:180px;[^"]*font-weight:bold">([^<]+)<\/div>/i);
    const audioM = row.match(/class="bikit-audio"[^>]*data-src="([^"]+)"/i);
    const textM = row.match(/class="voice_text_chs[^"]*">([\s\S]*?)<\/div>/i);
    if (audioM) {
      const audioUrl = audioM[1].replace(/&#58;/g, ':').trim();
      if (audioUrl.startsWith('http')) {
        const title = titleM ? titleM[1].trim() : '';
        const text = textM ? textM[1].replace(/<[^>]+>/g, '').trim() : '';
        pairs.push({ title, text, audioUrl });
      }
    }
  }
  return pairs;
}

function matchLine(line, sources) {
  if (line.audioUrl) return true;
  const normTitle = normalize(line.title);
  const normDesc = normalize(line.desc);

  // Strategy 1: exact normalized title match
  for (const src of sources) {
    if (src.title && normalize(src.title) === normTitle && src.audioUrl) {
      line.audioUrl = src.audioUrl;
      return true;
    }
  }

  // Strategy 2: text substring match (desc)
  if (normDesc && normDesc.length >= 6) {
    for (const src of sources) {
      if (src.text) {
        const normSrc = normalize(src.text);
        if (normSrc && (normSrc.includes(normDesc.slice(0, 10)) || normDesc.includes(normSrc.slice(0, 10)))) {
          line.audioUrl = src.audioUrl;
          return true;
        }
      }
    }
  }

  // Strategy 3: title contains
  for (const src of sources) {
    if (src.title) {
      const normSrc = normalize(src.title);
      if (normSrc && (normSrc.includes(normTitle) || normTitle.includes(normSrc)) && src.audioUrl) {
        line.audioUrl = src.audioUrl;
        return true;
      }
    }
  }

  return false;
}

async function run() {
  console.log(`Starting official voice sync across all ${catalog.length} characters...`);
  let totalLines = 0;
  let totalWithAudio = 0;
  let updatedCount = 0;

  for (let i = 0; i < catalog.length; i++) {
    const c = catalog[i];
    const file = path.join(ROOT, `data/characters/${c.id}.json`);
    if (!fs.existsSync(file)) continue;

    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const allLines = [...data.friendLines, ...data.actionLines];
    totalLines += allLines.length;

    let missingBefore = allLines.filter(l => !l.audioUrl).length;
    if (missingBefore > 0) {
      console.log(`[${i + 1}/${catalog.length}] ${c.name} (${c.enName}) has ${missingBefore} lines missing audio...`);

      const sources = [];

      // Fetch BWIKI
      let bwikiPage = c.name + '语音';
      if (c.name === '空') bwikiPage = '旅行者语音/空';
      if (c.name === '荧') bwikiPage = '旅行者语音/荧';

      const bwikiHtml = await fetchBwiki(bwikiPage);
      if (bwikiHtml) {
        const bwPairs = parseBwiki(bwikiHtml);
        sources.push(...bwPairs);
      }

      // Fetch Fandom
      let fandomName = c.enName.replace(/\s+/g, '_');
      if (c.name === '空' || c.name === '荧') fandomName = 'Traveler';
      const fandomHtml = await fetchFandom(`${fandomName}/Voice-Overs/Chinese`);
      if (fandomHtml) {
        const fdPairs = parseFandom(fandomHtml);
        // For Traveler, filter by Aether/Lumine
        if (c.name === '空') {
          sources.push(...fdPairs.filter(p => !p.audioUrl.includes('Lumine')));
        } else if (c.name === '荧') {
          sources.push(...fdPairs.filter(p => !p.audioUrl.includes('Aether')));
        } else {
          sources.push(...fdPairs);
        }
      }

      // Match missing lines
      let newlyMatched = 0;
      for (const line of allLines) {
        if (!line.audioUrl) {
          if (matchLine(line, sources)) {
            newlyMatched++;
          }
        }
      }

      console.log(`  -> Matched ${newlyMatched} new lines! (Total audio: ${allLines.filter(l => l.audioUrl).length}/${allLines.length})`);

      // Write updated json
      fs.writeFileSync(file, JSON.stringify(data, null, 2));

      // Recompress .br and .gz
      const content = fs.readFileSync(file);
      fs.writeFileSync(file + '.br', zlib.brotliCompressSync(content, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }));
      fs.writeFileSync(file + '.gz', zlib.gzipSync(content, { level: 9 }));
      updatedCount++;
    }

    const currentAudio = allLines.filter(l => l.audioUrl).length;
    totalWithAudio += currentAudio;
  }

  console.log(`\n========================================`);
  console.log(`SYNC COMPLETE!`);
  console.log(`Updated character files: ${updatedCount}`);
  console.log(`Total quotes: ${totalLines}`);
  console.log(`Total with official voice audio: ${totalWithAudio} (${(totalWithAudio / totalLines * 100).toFixed(1)}%)`);
  console.log(`========================================\n`);
}

run();
