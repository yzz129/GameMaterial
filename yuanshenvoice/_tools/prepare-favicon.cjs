'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets/masters/icons/paimon-site-icon.png');
const iconDir = path.join(root, 'assets/icons');

function makeIco(pixels, size) {
  const xor = Buffer.alloc(size * size * 4);
  const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
  for (let y = 0; y < size; y++) {
    const srcY = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const src = (srcY * size + x) * 4;
      const dst = (y * size + x) * 4;
      xor[dst] = pixels[src + 2];
      xor[dst + 1] = pixels[src + 1];
      xor[dst + 2] = pixels[src];
      xor[dst + 3] = pixels[src + 3];
      if (pixels[src + 3] < 128) mask[y * 4 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  const dib = Buffer.alloc(40);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(0, 16);
  dib.writeUInt32LE(xor.length, 20);

  const directory = Buffer.alloc(22);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(1, 4);
  directory.writeUInt8(size, 6);
  directory.writeUInt8(size, 7);
  directory.writeUInt8(0, 8);
  directory.writeUInt8(0, 9);
  directory.writeUInt16LE(1, 10);
  directory.writeUInt16LE(32, 12);
  directory.writeUInt32LE(dib.length + xor.length + mask.length, 14);
  directory.writeUInt32LE(directory.length, 18);
  return Buffer.concat([directory, dib, xor, mask]);
}

async function main() {
  fs.mkdirSync(iconDir, { recursive: true });
  const png32Path = path.join(iconDir, 'site-icon-32.png');
  const png180Path = path.join(iconDir, 'site-icon-180.png');
  const icoPath = path.join(iconDir, 'site-favicon.ico');
  await sharp(source).resize(32, 32, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(png32Path);
  await sharp(source).resize(180, 180, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(png180Path);
  const { data, info } = await sharp(png32Path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  fs.writeFileSync(icoPath, makeIco(data, info.width));

  const manifestPath = path.join(root, 'assets/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const generated = [
    ['assets/icons/site-icon-32.png', 32, 32, '32 px browser tab icon derived from user-supplied Paimon artwork'],
    ['assets/icons/site-icon-180.png', 180, 180, 'Apple touch icon derived from user-supplied Paimon artwork'],
    ['assets/icons/site-favicon.ico', 32, 32, 'Windows and legacy browser favicon derived from user-supplied Paimon artwork']
  ];
  for (const [file, width, height, purpose] of generated) {
    const bytes = fs.readFileSync(path.join(root, file));
    manifest.assets = manifest.assets.filter(asset => asset.file !== file);
    manifest.assets.push({
      file,
      source: 'User-provided image attachment',
      purpose,
      license: 'User-provided artwork; used at the user\'s request',
      width,
      height,
      version: 1,
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    });
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Generated PNG/ICO favicons from the provided image.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
