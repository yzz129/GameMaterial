const https = require('https');

function fetchJson(url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const json = await fetchJson('https://genshin-impact.fandom.com/api.php?action=parse&page=Traveler/Voice-Overs/Chinese&prop=text&format=json');
  if (json && json.parse) {
    const html = json.parse.text['*'];
    const oggs = Array.from(new Set(html.match(/https:\/\/static\.wikia\.nocookie\.net\/gensin-impact\/images\/[^\s"'<>]+\.ogg/gi) || []));
    console.log('Traveler total OGGs on Fandom:', oggs.length);
    const fd = oggs.filter(u => /fetter|predict|magic|hero/i.test(u));
    console.log('Traveler sample matching OGGs:', fd.slice(0, 10));
    const hasUtamoro = html.includes('歌麿');
    console.log('Contains 歌麿 on Traveler Chinese page?', hasUtamoro);
  }
}

run();
