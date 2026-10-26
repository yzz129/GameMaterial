const https = require('https');

function test(page) {
  const url = `https://genshin-impact.fandom.com/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const json = JSON.parse(data);
      if (json.error) console.log(page, 'ERR:', json.error);
      else {
        const html = json.parse.text['*'];
        const audioMatches = html.match(/https:\/\/static\.wikia\.nocookie\.net\/gensin-impact\/images\/[^\s"'<>]+\.ogg/g) || [];
        console.log(page, 'Audio count:', audioMatches.length);
        const aether = audioMatches.filter(u => u.includes('Aether'));
        const lumine = audioMatches.filter(u => u.includes('Lumine'));
        console.log('Aether audios:', aether.length, 'Lumine audios:', lumine.length);
      }
    });
  });
}

test('Traveler/Voice-Overs/Chinese');
test('Traveler_(Aether)/Voice-Overs/Chinese');
test('Traveler_(Lumine)/Voice-Overs/Chinese');
