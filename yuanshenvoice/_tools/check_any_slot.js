const https = require('https');

function checkAnySlot(name) {
  const url = `https://wiki.biligame.com/ys/api.php?action=parse&page=${encodeURIComponent(name + '语音')}&prop=text&format=json`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      const html = JSON.parse(d).parse?.text?.['*'] || '';
      // Look for title and all bikit-audio in that row
      const rowRegex = /<div style="[^"]*width:180px;[^"]*font-weight:bold">([^<]+)<\/div>([\s\S]{1,600}?)(?=<div style="[^"]*width:180px;|$)/gi;
      let m;
      let count = 0;
      while ((m = rowRegex.exec(html)) !== null) {
        const title = m[1].trim();
        const audios = [...m[2].matchAll(/class="bikit-audio"[^>]*data-src="([^"]+)"/g)].map(x => x[1].replace(/&#58;/g, ':'));
        // Find first non-empty audio
        const validAudio = audios.find(a => a.startsWith('http'));
        if (validAudio) {
          count++;
          if (count <= 3) console.log(`${name} [${title}] -> ${validAudio}`);
        }
      }
      console.log(`${name}: matched ${count} using any available slot.`);
    });
  });
}

checkAnySlot('凯亚');
checkAnySlot('神里绫人');
checkAnySlot('白术');
