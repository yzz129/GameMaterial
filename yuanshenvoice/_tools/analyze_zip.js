const https = require('https');
const fs = require('fs');

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

async function analyzeZip() {
    const { url, contentLength } = await getFinalUrl(rawUrl);
    // End of Central Directory record is at the end of the zip file
    const tailSize = 65536;
    const tailBuf = await fetchRange(url, contentLength - tailSize, contentLength - 1);
    
    // Find EOCD signature 0x06054b50
    let eocdOffset = -1;
    for (let i = tailBuf.length - 22; i >= 0; i--) {
        if (tailBuf.readUInt32LE(i) === 0x06054b50) {
            eocdOffset = i;
            break;
        }
    }
    if (eocdOffset === -1) {
        console.error("Could not find EOCD");
        return;
    }

    const totalEntries = tailBuf.readUInt16LE(eocdOffset + 10);
    const cdSize = tailBuf.readUInt32LE(eocdOffset + 12);
    const cdOffset = tailBuf.readUInt32LE(eocdOffset + 16);
    console.log(`Total entries: ${totalEntries}, CD size: ${cdSize} bytes, CD offset: ${cdOffset}`);

    // Fetch the whole Central Directory!
    console.log(`Fetching entire Central Directory (${(cdSize / 1024).toFixed(1)} KB)...`);
    const cdBuf = await fetchRange(url, cdOffset, cdOffset + cdSize - 1);
    console.log(`Received Central Directory: ${cdBuf.length} bytes.`);

    const entries = [];
    let ptr = 0;
    while (ptr < cdBuf.length - 46) {
        if (cdBuf.readUInt32LE(ptr) !== 0x02014b50) break;
        const compression = cdBuf.readUInt16LE(ptr + 10);
        const compSize = cdBuf.readUInt32LE(ptr + 20);
        const uncompSize = cdBuf.readUInt32LE(ptr + 24);
        const fileNameLen = cdBuf.readUInt16LE(ptr + 28);
        const extraLen = cdBuf.readUInt16LE(ptr + 30);
        const commentLen = cdBuf.readUInt16LE(ptr + 32);
        const localHeaderOffset = cdBuf.readUInt32LE(ptr + 42);
        const fileName = cdBuf.slice(ptr + 46, ptr + 46 + fileNameLen).toString('utf-8');

        entries.push({
            fileName,
            compression,
            compSize,
            uncompSize,
            localHeaderOffset
        });
        ptr += 46 + fileNameLen + extraLen + commentLen;
    }

    console.log(`Parsed ${entries.length} entries.`);
    fs.writeFileSync('C:/Users/Administrator/.gemini/antigravity/scratch/nahida_voice/cd_entries.json', JSON.stringify(entries, null, 2));
    console.log('Saved cd_entries.json');
}

analyzeZip().catch(console.error);
