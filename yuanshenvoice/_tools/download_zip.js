const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const targetUrl = 'https://huggingface.co/datasets/simon3000/genshin-voice/resolve/main/speaker-archives/Chinese/501-plus/Nahida.zip';
const destPath = 'C:\\Users\\Administrator\\.gemini\\antigravity\\scratch\\nahida_voice\\Nahida.zip';

function downloadFile(url, dest) {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            console.log('Redirecting to:', res.headers.location.slice(0, 100));
            return downloadFile(res.headers.location, dest);
        }

        if (res.statusCode !== 200) {
            console.error(`Download failed with status: ${res.statusCode}`);
            process.exit(1);
        }

        const totalBytes = parseInt(res.headers['content-length'], 10);
        console.log(`Starting download: ${(totalBytes / 1024 / 1024).toFixed(2)} MB -> ${dest}`);

        const fileStream = fs.createWriteStream(dest);
        let downloadedBytes = 0;
        let lastReport = Date.now();
        let lastDownloaded = 0;

        res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const now = Date.now();
            if (now - lastReport >= 5000) {
                const speed = ((downloadedBytes - lastDownloaded) / 1024 / 1024) / ((now - lastReport) / 1000);
                const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                console.log(`[${progress}%] ${(downloadedBytes / 1024 / 1024).toFixed(1)} / ${(totalBytes / 1024 / 1024).toFixed(1)} MB (${speed.toFixed(2)} MB/s)`);
                lastReport = now;
                lastDownloaded = downloadedBytes;
            }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
            fileStream.close(() => {
                console.log(`Download finished successfully! Total: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
                process.exit(0);
            });
        });

        fileStream.on('error', (err) => {
            console.error('File write error:', err);
            process.exit(1);
        });
    }).on('error', (err) => {
        console.error('Network error:', err);
        process.exit(1);
    });
}

downloadFile(targetUrl, destPath);
