const https = require('https');
const fs = require('fs');
const path = require('path');

const newTracks = [
  {
    filename: '07_sumeru.mp3',
    remotePath: '13. Forest of Jñāna and Vidyā/Disc 1 - Dwelling Where Everlasting Spring Abides/001. Sumeru.mp3'
  },
  {
    filename: '08_la_vaguelette.mp3',
    remotePath: '18.5. La vaguelette/1. La vaguelette.mp3'
  },
  {
    filename: '09_rex_incognito.mp3',
    remotePath: '04. The Stellar Moments vol. 1/17. Rex Incognito.mp3'
  },
  {
    filename: '10_termination_of_desires.mp3',
    remotePath: '08. The Stellar Moments vol. 2/21. Termination of Desires.mp3'
  },
  {
    filename: '11_surasthana_fantasia.mp3',
    remotePath: '14. The Stellar Moments vol. 3/26. Surasthāna Fantasia.mp3'
  },
  {
    filename: '12_parousia_diluvi.mp3',
    remotePath: '19. The Stellar Moments vol. 4/21. Parousia Diluvi.mp3'
  },
  {
    filename: '13_devastation_and_redemption.mp3',
    remotePath: '07.5. Fleeting Colors in Flight/01. Devastation and Redemption.mp3'
  },
  {
    filename: '14_emberfire.mp3',
    remotePath: '21.5. Emberfire/01. Emberfire.mp3'
  },
  {
    filename: '15_path_of_yaksha.mp3',
    remotePath: '08. The Stellar Moments vol. 2/01. Path of Yaksha.mp3'
  },
  {
    filename: '16_broker_betwixt_life_and_death.mp3',
    remotePath: '08. The Stellar Moments vol. 2/02. Broker Betwixt Life and Death.mp3'
  }
];

function downloadUrl(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r2 => {
          const file = fs.createWriteStream(dest);
          r2.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
      } else if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      } else {
        reject(new Error(`Failed with status ${res.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function main() {
  const targetDir = 'D:/yuanshenvoice/assets/audio/music';
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  for (const t of newTracks) {
    const dest = path.join(targetDir, t.filename);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100000) {
      console.log(`Already exists: ${t.filename} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)}MB)`);
      continue;
    }
    const encoded = t.remotePath.split('/').map(encodeURIComponent).join('/');
    const url = `https://archive.org/download/genshin-impact-music-collection/${encoded}`;
    console.log(`Downloading ${t.filename} from ${url}...`);
    try {
      await downloadUrl(url, dest);
      console.log(`Downloaded ${t.filename} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)}MB)`);
    } catch (e) {
      console.error(`Error downloading ${t.filename}:`, e.message);
    }
  }
}

main().catch(console.error);
