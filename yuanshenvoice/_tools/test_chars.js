const https = require('https');

function testChar(name) {
  return new Promise((resolve) => {
    const url = 'https://wiki.biligame.com/ys/api.php?action=parse&page=' + encodeURIComponent(name + '语音') + '&prop=text&format=json';
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const html = json.parse?.text?.['*'] || '';
          const matches = [...html.matchAll(/bikit-audio"[^>]*data-src="([^"]+)"/g)];
          console.log(`${name}: found ${matches.length} real audio links`);
          if (matches.length > 0) {
            console.log(`  Sample: ${matches[0][1].replace(/&#58;/g, ':')}`);
          }
          resolve({ name, count: matches.length });
        } catch(e) {
          console.error(name, e.message);
          resolve({ name, count: 0 });
        }
      });
    }).on('error', e => {
      console.error(name, e.message);
      resolve({ name, count: 0 });
    });
  });
}

async function run() {
  await testChar('纳西妲');
  await testChar('胡桃');
  await testChar('雷电将军');
  await testChar('钟离');
  await testChar('阿贝多');
  await testChar('芙宁娜');
}
run();
