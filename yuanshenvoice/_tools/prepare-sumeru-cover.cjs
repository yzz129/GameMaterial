const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');

const url = 'https://archive.org/download/genshin-impact-forest-of-jnana-and-vidya-disc-1-dwelling-where-everlasting-spring-abides/Cover.jpg';

function download(u, dest) {
  return new Promise((resolve, reject) => {
    https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error('Status ' + res.statusCode));
      const f = fs.createWriteStream(dest);
      res.pipe(f);
      f.on('finish', () => { f.close(); resolve(); });
    }).on('error', reject);
  });
}

async function run() {
  const jpg = 'D:/yuanshenvoice/assets/audio/music/covers/cover_sumeru.jpg';
  const webp = 'D:/yuanshenvoice/assets/audio/music/covers/cover_sumeru.webp';
  await download(url, jpg);
  console.log('Downloaded cover_sumeru.jpg');
  execSync(`ffmpeg -y -i "${jpg}" -vf "scale=400:400" -c:v libwebp -quality 85 "${webp}"`);
  console.log('Converted to cover_sumeru.webp');
  if (fs.existsSync(jpg)) fs.unlinkSync(jpg);
}

run().catch(console.error);
