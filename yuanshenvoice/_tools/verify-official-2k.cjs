'use strict';

// Inspect downloaded Jimeng results without altering the video bytes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const [channel, videoArg] = process.argv.slice(2);
if (!['pc', 'mobile'].includes(channel) || !videoArg) {
  throw new Error('Usage: node _tools/verify-official-2k.cjs pc|mobile VIDEO');
}
const videoPath = path.resolve(videoArg);
const job = JSON.parse(fs.readFileSync('_jobs/dreamina-windrise-dual-v1.json', 'utf8'));
const source = job.items.find(item => item.key === channel);
const official = job.official2k.items.find(item => item.key === channel);
const outputDir = path.resolve('output/windrise-backgrounds-v1');
function run(binary, args) {
  const result = spawnSync(binary, args, {
    encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${binary}: ${result.error?.message || result.stderr || result.status}`);
  }
  return result.stdout;
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const checksum = sha256(videoPath);
if (checksum !== official.downloadSha256 || fs.statSync(videoPath).size !== official.bytes) {
  throw new Error('The file does not match the authoritative CLI download checksum and size.');
}
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', videoPath]));
const video = probe.streams.find(stream => stream.codec_type === 'video');
// Jimeng's named 2K preset can return larger, block-aligned dimensions.
// Preserve those dimensions and verify resolution, orientation and aspect ratio.
const minimum = channel === 'pc' ? [2560, 1440] : [1440, 2560];
const sourceRatio = source.native.width / source.native.height;
if (!video || video.width < minimum[0] || video.height < minimum[1] ||
    Math.abs(video.width / video.height / sourceRatio - 1) > 0.01) {
  throw new Error(`Unexpected Jimeng dimensions: ${video?.width}x${video?.height}`);
}
if (Math.abs(Number(probe.format.duration) - source.native.durationSeconds) > 0.15) {
  throw new Error('Unexpected change in duration.');
}
run('ffmpeg', ['-v', 'error', '-threads', '4', '-i', videoPath, '-map', '0:v:0', '-f', 'null', '-']);
fs.mkdirSync(outputDir, { recursive: true });
const reviewPath = path.join(outputDir, `review-${channel}-jimeng-2k.jpg`);
const thumbWidth = channel === 'pc' ? 512 : 288;
run('ffmpeg', ['-v', 'error', '-y', '-threads', '4', '-i', videoPath,
  '-vf', `fps=1,scale=${thumbWidth}:-2,tile=5x2`, '-frames:v', '1', '-q:v', '2', reviewPath]);
if (sha256(videoPath) !== checksum || sha256(path.resolve(source.nativePath)) !== source.downloadSha256) {
  throw new Error('An original file changed during verification.');
}
const report = {
  channel, created: new Date().toISOString(), purpose: 'PC/mobile Genshin-themed website background',
  provenance: {
    provider: 'Jimeng', process: '官方智能超清 → 2K',
    sourceGenerationModel: job.model, sourceGenerationResolution: '720p',
    sourceNodeId: source.nodeId, sourceResourceId: source.selectedResourceId,
    nodeId: official.nodeId, resourceId: official.resourceId, submitId: official.submitId,
    canvasUrl: job.webUrl, localVideoTranscoding: false,
    native2kGeneration: false, enhancement: 'Jimeng platform AI video enhancement',
    prompts: 'prompts.json', referenceImage: source.sourcePath,
    rights: 'AI-generated Genshin Impact fan art; underlying game intellectual property remains with HoYoverse',
  },
  file: {
    path: videoPath, bytes: fs.statSync(videoPath).size, sha256: checksum,
    width: video.width, height: video.height, codec: video.codec_name, pixelFormat: video.pix_fmt,
    frameRate: video.avg_frame_rate, frames: video.nb_frames ? Number(video.nb_frames) : null,
    durationSeconds: Number(probe.format.duration),
    colorSpace: video.color_space || null, colorTransfer: video.color_transfer || null,
    audio: probe.streams.filter(stream => stream.codec_type === 'audio').map(stream => ({
      codec: stream.codec_name, channels: stream.channels, sampleRate: stream.sample_rate,
    })),
  },
  validation: {
    jimengPreset: '2K', atLeastQHD: true, sourceAspectRatioPreserved: true,
    durationMatchesSource: true, allVideoFramesDecoded: true,
    downloadChecksumAndSizeMatch: true,
    downloadedVideoUnchanged: true, native720pMasterUnchanged: true,
    localVideoTranscoding: false, seamlessLoopVerified: false,
  },
  review: { samples: '10 frames at approximately one-second intervals', contactSheet: reviewPath },
};
const reportPath = path.join(outputDir, `jimeng-2k-${channel}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ reportPath, reviewPath, ...report.file }));
