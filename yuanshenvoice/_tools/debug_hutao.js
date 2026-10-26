const https = require('https');

const pageName = encodeURIComponent('胡桃语音');
const url = `https://wiki.biligame.com/ys/api.php?action=parse&page=${pageName}&prop=text&format=json`;

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    const html = json.parse?.text?.['*'] || '';
    console.log('HTML length:', html.length);
    
    // Test row matching
    const rowRegex = /<div style="[^"]*font-weight:bold[^"]*">([^<]+)<\/div>[\s\S]*?<div class="bikit-audio"[^>]*data-src="([^"]+)"/gi;
    let m;
    let count = 0;
    while ((m = rowRegex.exec(html)) !== null) {
      count++;
      if (count <= 5) console.log(m[1].trim(), '->', m[2].replace(/&#58;/g, ':'));
    }
    console.log('Total matched:', count);
  });
});
