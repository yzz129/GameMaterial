const https = require('https');

const url = 'https://wiki.biligame.com/ys/api.php?action=parse&page=%E8%83%A1%E6%A1%83%E8%AF%AD%E9%9F%B3&prop=text&format=json';
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    const html = json.parse?.text?.['*'] || '';
    const idx = html.indexOf('初次见面');
    if (idx !== -1) {
      console.log(html.substring(idx, idx + 1500));
    }
  });
});
