const https = require('https');

function check(name) {
  const url = `https://wiki.biligame.com/ys/api.php?action=parse&page=${encodeURIComponent(name + '语音')}&prop=text&format=json`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      const html = JSON.parse(d).parse?.text?.['*'] || '';
      console.log(`=== ${name} === (HTML: ${html.length})`);
      const idx = html.indexOf('初次见面');
      if (idx !== -1) {
        console.log(html.substring(Math.max(0, idx - 150), idx + 350));
      } else {
        console.log('No "初次见面" found!');
      }
    });
  });
}

check('凯亚');
check('白术');
check('神里绫人');
