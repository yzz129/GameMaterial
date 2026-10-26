'use strict';
// Register existing audio bytes and their real metadata without re-encoding.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const folder = 'assets/audio/music';
async function main() {
  const manifestPath = path.join(root, 'assets/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const catalog = JSON.parse(fs.readFileSync(path.join(root, folder, 'music_catalog.json')));
  const entries = [];
  function record(file, metadata) {
    const data = fs.readFileSync(path.join(root, file));
    entries.push({ file, source:`Existing workspace soundtrack asset: ${file}`,
      purpose:'Music-box playback and soundtrack browsing', license:'HoYoverse / HOYO-MiX soundtrack and game artwork; original rights retained',
      version:1, bytes:data.length, sha256:crypto.createHash('sha256').update(data).digest('hex'), ...metadata });
  }
  for (const name of fs.readdirSync(path.join(root, folder)).filter(f => /\.(flac|mp3|ogg|wav)$/i.test(f))) {
    const file = `${folder}/${name}`;
    const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-select_streams','a:0','-show_entries','stream=codec_name,sample_rate,channels,bits_per_raw_sample:format=duration,bit_rate','-of','json',path.join(root,file)], { encoding:'utf8',windowsHide:true }));
    const stream = probe.streams[0];
    const track = catalog.tracks.find(t => t.localUrl?.replace(/^\//,'') === file);
    record(file, { preservedSource:true, codec:stream.codec_name, sampleRate:Number(stream.sample_rate), channels:stream.channels,
      bitsPerSample:Number(stream.bits_per_raw_sample) || undefined, durationSeconds:Number(probe.format.duration), bitrate:Number(probe.format.bit_rate),
      sourceCatalog:'assets/audio/music/music_catalog.json', sourceUrl:track?.streamUrl });
  }
  for (const name of fs.readdirSync(path.join(root,folder,'covers')).filter(f => /\.(webp|png|jpe?g)$/i.test(f))) {
    const file = `${folder}/covers/${name}`, meta = await sharp(path.join(root,file)).metadata();
    record(file,{ purpose:'Music-box album artwork',width:meta.width,height:meta.height });
  }
  record(`${folder}/music_catalog.json`,{source:'_tools/build-music-catalog.cjs',purpose:'Music-box index with local selections and external streaming references',tracks:catalog.totalTracks,albums:catalog.totalAlbums});
  const files = new Set(entries.map(e => e.file));
  manifest.assets = manifest.assets.filter(e => !files.has(e.file)).concat(entries);
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  console.log(`Registered ${entries.length} music assets; original audio bytes preserved.`);
}
main().catch(e => {console.error(e);process.exitCode=1});
