const fs = require('fs');
const https = require('https');

const url = 'https://genshin-impact.fandom.com/api.php?action=parse&page=' + encodeURIComponent('Traveler/Voice-Overs/Chinese') + '&prop=text&format=json';
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    const html = json.parse.text['*'];
    const aether = JSON.parse(fs.readFileSync('D:/yuanshenvoice/data/characters/10000005.json', 'utf8'));
    const lumine = JSON.parse(fs.readFileSync('D:/yuanshenvoice/data/characters/10000007.json', 'utf8'));
    console.log('Aether lines:', aether.friendLines.length + aether.actionLines.length);
    console.log('Lumine lines:', lumine.friendLines.length + lumine.actionLines.length);

    // Check sample rows with Aether and Lumine
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    let count = 0;
    while ((m = rowRegex.exec(html)) !== null && count < 5) {
      const row = m[1];
      if (row.includes('VO_ZH_') && (row.includes('Aether') || row.includes('Lumine'))) {
        console.log(`--- TRAVELER ROW ${count} ---\n`, row.slice(0, 350));
        count++;
      }
    }
  });
});
