const https = require('https');
const zlib = require('zlib');

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

async function readSampleJson() {
    const { url, contentLength } = await getFinalUrl(rawUrl);
    // Fetch last 512KB for central directory
    const rangeSize = Math.min(contentLength, 512 * 1024);
    const buf = await fetchRange(url, contentLength - rangeSize, contentLength - 1);

    // Parse central directory entries
    let sampleEntry = null;
    for (let i = 0; i < buf.length - 46; i++) {
        if (buf.readUInt32LE(i) === 0x02014b50) {
            const compression = buf.readUInt16LE(i + 10);
            const compSize = buf.readUInt32LE(i + 20);
            const uncompSize = buf.readUInt32LE(i + 24);
            const fileNameLen = buf.readUInt16LE(i + 28);
            const extraLen = buf.readUInt16LE(i + 30);
            const commentLen = buf.readUInt16LE(i + 32);
            const localHeaderOffset = buf.readUInt32LE(i + 42);
            const fileName = buf.slice(i + 46, i + 46 + fileNameLen).toString('utf-8');

            if (fileName.endsWith('.json')) {
                sampleEntry = { fileName, compression, compSize, uncompSize, localHeaderOffset };
                break;
            }
            i += 45 + fileNameLen + extraLen + commentLen;
        }
    }

    if (!sampleEntry) {
        console.log("No json entry found");
        return;
    }
    console.log("Sample JSON entry:", sampleEntry);

    // Fetch the local file header + data
    const localBuf = await fetchRange(url, sampleEntry.localHeaderOffset, sampleEntry.localHeaderOffset + 100 + sampleEntry.compSize);
    if (localBuf.readUInt32LE(0) === 0x04034b50) {
        const lfFileNameLen = localBuf.readUInt16LE(26);
        const lfExtraLen = localBuf.readUInt16LE(28);
        const dataStart = 30 + lfFileNameLen + lfExtraLen;
        const compressedData = localBuf.slice(dataStart, dataStart + sampleEntry.compSize);

        let decompressed;
        if (sampleEntry.compression === 0) {
            decompressed = compressedData;
        } else if (sampleEntry.compression === 8) {
            decompressed = zlib.inflateRawSync(compressedData);
        }
        console.log("Decompressed JSON content:\n", decompressed.toString('utf-8'));
    }
}

readSampleJson().catch(console.error);
