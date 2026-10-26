const https = require('https');

const url = `https://wiki.biligame.com/ys/api.php?action=parse&page=%E5%87%AF%E4%BA%9A%E8%AF%AD%E9%9F%B3&prop=text&format=json`;
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    const html = JSON.parse(d).parse?.text?.['*'] || '';
    const idx = html.indexOf('初次见面');
    console.log(html.substring(idx, idx + 800));
  });
});
