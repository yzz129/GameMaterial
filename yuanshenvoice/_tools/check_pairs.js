const https = require('https');

function inspectTable(name) {
  const url = 'https://wiki.biligame.com/ys/api.php?action=parse&page=' + encodeURIComponent(name + '语音') + '&prop=text&format=json';
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const json = JSON.parse(data);
      const html = json.parse?.text?.['*'] || '';
      
      // Let's find rows or audio containers
      // Look at how bikit-audio is placed relative to titles
      // e.g. regex for title followed by bikit-audio or vice versa
      const regex = /<div style="[^"]*font-weight:bold[^"]*">([^<]+)<\/div>[\s\S]*?<div class="bikit-audio"[^>]*data-src="([^"]+)"/gi;
      let m;
      let count = 0;
      console.log(`=== Pairings for ${name} ===`);
      while ((m = regex.exec(html)) !== null && count < 10) {
        count++;
        console.log(`[${m[1].trim()}] -> ${m[2].replace(/&#58;/g, ':')}`);
      }
    });
  });
}

inspectTable('胡桃');
