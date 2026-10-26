const https = require('https');
const url = 'https://wiki.biligame.com/ys/api.php?action=parse&page=%E7%A5%9E%E9%87%8C%E7%BB%AB%E5%8D%8E%E8%AF%AD%E9%9F%B3&prop=text&format=json';

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    const html = json.parse?.text?.['*'] || '';
    console.log('HTML length:', html.length);
    console.log('Looking for 初次见面:');
    const idx = html.indexOf('初次见面');
    if (idx !== -1) {
      console.log(html.substring(idx - 100, idx + 400));
    }
  });
});
