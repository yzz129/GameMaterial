const https = require('https');

const rawUrl = 'https://huggingface.co/datasets/simon3000/genshin-voice/resolve/main/speaker-archives/Chinese/501-plus/Nahida.zip';

function getFinalUrl(url) {
    return new Promise((resolve, reject) => {
        https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            if (res.headers.location) {
                resolve(getFinalUrl(res.headers.location));
            } else {
                resolve({ url, contentLength: parseInt(res.headers['content-length'], 10) });
            }
        }).on('error', reject).end();
    });
}

function fetchRange(url, start, end) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Range': `bytes=${start}-${end}`
            }
        }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function inspectZip() {
    console.log("Resolving URL...");
    const { url, contentLength } = await getFinalUrl(rawUrl);
    console.log(`Total zip size: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);

    // Fetch the last 256KB of the file to read ZIP central directory
    const rangeSize = Math.min(contentLength, 256 * 1024);
    const startByte = contentLength - rangeSize;
    console.log(`Fetching range ${startByte} to ${contentLength - 1}...`);
    const buf = await fetchRange(url, startByte, contentLength - 1);
    console.log(`Received buffer of ${buf.length} bytes.`);

    // Find Central Directory signature 0x02014b50 (PK\x01\x02)
    const fileNames = [];
    for (let i = 0; i < buf.length - 46; i++) {
        if (buf.readUInt32LE(i) === 0x02014b50) {
            const fileNameLen = buf.readUInt16LE(i + 28);
            const extraLen = buf.readUInt16LE(i + 30);
            const commentLen = buf.readUInt16LE(i + 32);
            const fileName = buf.slice(i + 46, i + 46 + fileNameLen).toString('utf-8');
            fileNames.push(fileName);
            i += 45 + fileNameLen + extraLen + commentLen;
        }
    }

    console.log(`Found ${fileNames.length} files in central directory!`);
    console.log("Sample file names:");
    fileNames.slice(0, 30).forEach(f => console.log('  ', f));
}

inspectZip().catch(console.error);
