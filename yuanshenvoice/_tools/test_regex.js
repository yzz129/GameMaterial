const https = require('https');

https.get('https://wiki.biligame.com/ys/api.php?action=parse&page=%E8%83%A1%E6%A1%83%E8%AF%AD%E9%9F%B3&prop=text&format=json', { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    const html = JSON.parse(d).parse?.text?.['*'] || '';
    const regex = /<div style="[^"]*width:180px;[^"]*font-weight:bold">([^<]+)<\/div>[\s\S]{1,300}?<div class="bikit-audio"[^>]*data-src="([^"]+)"/gi;
    let m, count = 0;
    while ((m = regex.exec(html)) !== null) {
      count++;
      if (count <= 6) console.log(m[1].trim(), '->', m[2].replace(/&#58;/g, ':'));
    }
    console.log('Total matched:', count);
  });
});
