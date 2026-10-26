'use strict';

// User-requested 2K delivery export. The downloaded native master is read only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const [inputArg, outputArg, widthArg, heightArg] = process.argv.slice(2);
const width = Number(widthArg), height = Number(heightArg);
if (!inputArg || !outputArg || !Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width % 2 || height % 2) {
  throw new Error('Usage: node _tools/upscale-video-2k.cjs INPUT OUTPUT WIDTH HEIGHT');
}
const input = path.resolve(inputArg), output = path.resolve(outputArg);
if (input === output || fs.existsSync(output)) throw new Error('Output must be new and different from the native master.');
function run(binary, args) {
  const result = spawnSync(binary, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(binary + ': ' + (result.error?.message || result.stderr || '').slice(-2500));
  return result.stdout;
}
function probe(file) {
  return JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
}
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function facts(file, metadata) {
  const video = metadata.streams.find(s => s.codec_type === 'video');
  return { path: file, bytes: fs.statSync(file).size, sha256: hash(file), width: video.width, height: video.height,
    codec: video.codec_name, pixelFormat: video.pix_fmt, frameRate: video.avg_frame_rate,
    frames: video.nb_frames ? Number(video.nb_frames) : null, durationSeconds: Number(metadata.format.duration),
    audio: metadata.streams.filter(s => s.codec_type === 'audio').map(s => ({ codec: s.codec_name, channels: s.channels, sampleRate: s.sample_rate })) };
}
const sourceMetadata = probe(input), source = facts(input, sourceMetadata);
fs.mkdirSync(path.dirname(output), { recursive: true });
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-n', '-filter_threads', '2', '-i', input,
  '-map', '0:v:0', '-map', '0:a?', '-vf', `scale=${width}:${height}:flags=lanczos,setsar=1`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-threads', '4', '-pix_fmt', 'yuv420p',
  '-fps_mode', 'passthrough', '-c:a', 'copy', '-map_metadata', '0', '-movflags', '+faststart', output]);
const delivery = facts(output, probe(output));
const sourceFps = source.frameRate.split('/').map(Number), outputFps = delivery.frameRate.split('/').map(Number);
if (delivery.width !== width || delivery.height !== height || Math.abs(delivery.durationSeconds - source.durationSeconds) > 0.12 ||
  Math.abs(sourceFps[0] / sourceFps[1] - outputFps[0] / outputFps[1]) > 0.001 ||
  JSON.stringify(source.audio) !== JSON.stringify(delivery.audio) || hash(input) !== source.sha256) {
  throw new Error('Export validation failed; inspect the source and output before delivery.');
}
run('ffmpeg', ['-v', 'error', '-i', output, '-map', '0:v:0', '-f', 'null', '-']);
const report = { created: new Date().toISOString(), source, delivery,
  conversion: { requestedByUser: true, method: 'Lanczos resampling', nativeResolution: false,
    codec: 'H.264', crf: 17, frameRatePreserved: true, audioCopied: true, nativeMasterPreserved: true },
  validation: { expectedDimensions: true, durationAndFrameRateMatch: true, allVideoFramesDecoded: true, originalChecksumUnchanged: true } };
fs.writeFileSync(output + '.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
