const https = require('https');

const chars = ['神里绫人', '林尼', '凯亚', '米卡', '鹿野院平藏', '早柚', '多莉', '菲米尼'];

function check(name) {
  const url = 'https://wiki.biligame.com/ys/api.php?action=parse&page=' + encodeURIComponent(name + '语音') + '&prop=text&format=json';
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const json = JSON.parse(data);
      if (json.error) {
        console.log(name, 'ERROR:', json.error.info);
      } else {
        const html = json.parse.text['*'];
        const validAudios = (html.match(/data-src="https[^\"]+\.(?:mp3|ogg|wav)"/g) || []).length;
        console.log(name, 'Valid audios:', validAudios, 'HTML len:', html.length);
      }
    });
  });
}

chars.forEach(c => check(c));
