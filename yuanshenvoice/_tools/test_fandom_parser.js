const fs = require('fs');
const https = require('https');

function normalize(s) {
  return String(s || '').replace(/[…\.\s·\-_（）\(\)·:：！!？\?，,、“”"''‘’]/g, '').toLowerCase();
}

function parseFandomRows(html) {
  const pairs = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  let currentTitle = '';

  while ((m = rowRegex.exec(html)) !== null) {
    const row = m[1];
    if (!row.includes('.ogg')) continue;

    // Check if new th exists
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

    // Extract Chinese text from td
    let text = '';
    const tdMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    if (tdMatch) {
      const zhSpan = tdMatch[1].match(/<span[^>]*lang="zh(?:-Hans)?"[^>]*>([\s\S]*?)<\/span>/i);
      if (zhSpan) {
        text = zhSpan[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    // Extract audio
    const audioMatch = row.match(/https:\/\/static\.wikia\.nocookie\.net\/gensin-impact\/images\/[^\s"'<>]+\.ogg/i);
    if (audioMatch) {
      let audioUrl = audioMatch[0];
      const revIdx = audioUrl.indexOf('/revision/');
      if (revIdx !== -1) audioUrl = audioUrl.slice(0, revIdx);
      pairs.push({
        section: currentTitle,
        text,
        audioUrl
      });
    }
  }
  return pairs;
}

const url = 'https://genshin-impact.fandom.com/api.php?action=parse&page=' + encodeURIComponent('Baizhu/Voice-Overs/Chinese') + '&prop=text&format=json';
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    const html = json.parse.text['*'];
    const pairs = parseFandomRows(html);

    const baizhu = JSON.parse(fs.readFileSync('D:/yuanshenvoice/data/characters/10000082.json', 'utf8'));
    const lines = [...baizhu.friendLines, ...baizhu.actionLines];
    let matched = 0;
    const unmatched = [];

    for (const l of lines) {
      const normDesc = normalize(l.desc);
      const normTitle = normalize(l.title);

      // Match strategy 1: Text match
      let p = pairs.find(x => {
        const xText = normalize(x.text);
        return normDesc && xText && (xText.includes(normDesc.slice(0, 6)) || normDesc.includes(xText.slice(0, 6)));
      });

      // Match strategy 2: Title match
      if (!p) {
        p = pairs.find(x => normalize(x.section) === normTitle || normalize(x.section + x.text).includes(normTitle));
      }

      if (p) {
        matched++;
        l.audioUrl = p.audioUrl;
      } else {
        unmatched.push(l);
      }
    }

    console.log(`Baizhu lines: ${lines.length}, Matched: ${matched}`);
    if (unmatched.length) {
      console.log('Unmatched count:', unmatched.length);
      console.log('Unmatched samples:', unmatched);
    }
  });
});
