const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'D:\\yuanshenvoice';
const sourcesPath = path.join(rootDir, '_tools', 'character_voice_sources.json');

if (!fs.existsSync(sourcesPath)) {
    console.error("Please run parse_voice_sources.js first!");
    process.exit(1);
}

const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));

// Target character from args
const targetChar = process.argv[2];
if (!targetChar) {
    console.log("Usage: node download_character_voice.js <角色名>");
    console.log("Example: node download_character_voice.js 钟离");
    console.log("Example: node download_character_voice.js 雷电将军");
    console.log("Example: node download_character_voice.js 胡桃");
    console.log("Available characters count:", Object.keys(sources).length);
    process.exit(0);
}

const charInfo = sources[targetChar];
if (!charInfo) {
    console.error(`Character "${targetChar}" not found in sources list.`);
    const matches = Object.keys(sources).filter(k => k.includes(targetChar));
    if (matches.length > 0) {
        console.log(`Did you mean: ${matches.join(', ')}?`);
    }
    process.exit(1);
}

console.log(`\n========================================`);
console.log(`Target: ${targetChar} (${charInfo.enSpeaker})`);
console.log(`Archive: ${charInfo.zipRelPath}`);
console.log(`========================================\n`);

const zipDest = path.join(rootDir, `${charInfo.enSpeaker}.zip`);
const tempRawDir = path.join(rootDir, `_temp_${charInfo.enSpeaker}`);
const outDir = path.join(rootDir, `${targetChar}语音全集(分类整理)`);

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }

            const total = parseInt(res.headers['content-length'], 10);
            console.log(`File size: ${(total / 1024 / 1024).toFixed(1)} MB. Downloading...`);
            const fileStream = fs.createWriteStream(dest);

            let downloaded = 0;
            let lastReport = Date.now();
            let lastBytes = 0;

            res.on('data', chunk => {
                downloaded += chunk.length;
                const now = Date.now();
                if (now - lastReport >= 3000) {
                    const speed = ((downloaded - lastBytes) / 1024 / 1024) / ((now - lastReport) / 1000);
                    const pct = ((downloaded / total) * 100).toFixed(1);
                    console.log(`[${pct}%] ${(downloaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB (${speed.toFixed(2)} MB/s)`);
                    lastReport = now;
                    lastBytes = downloaded;
                }
            });

            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close(() => {
                    console.log(`Download completed! Total: ${(downloaded / 1024 / 1024).toFixed(1)} MB`);
                    resolve();
                });
            });
            fileStream.on('error', reject);
        }).on('error', reject);
    });
}

function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/\{NICKNAME\}/g, '旅行者')
        .replace(/\{M#他\}\{F#她\}/g, '旅行者')
        .replace(/\{PLAYERAVATAR#[^}]+\}/g, '旅行者')
        .replace(/#\{[^}]+\}/g, '旅行者')
        .replace(/#[0-9a-zA-Z]+/g, '')
        .trim();
}

function sanitize(str) {
    return str.replace(/[\\/:*?"<>|\r\n\t]/g, '_').replace(/_+/g, '_').trim();
}

async function main() {
    // 1. Download zip
    if (!fs.existsSync(zipDest)) {
        await downloadFile(charInfo.url, zipDest);
    } else {
        console.log(`Zip file already exists: ${zipDest}`);
    }

    // 2. Extract
    console.log(`Extracting to ${tempRawDir}...`);
    if (fs.existsSync(tempRawDir)) fs.rmSync(tempRawDir, { recursive: true, force: true });
    fs.mkdirSync(tempRawDir, { recursive: true });
    execSync(`tar -xf "${zipDest}" -C "${tempRawDir}"`);
    console.log(`Extraction complete.`);

    // 3. Create classified output folders
    const dirs = {
        ringtone: path.join(outDir, '00_精选热门MP3(推荐手机铃声_通知铃声)'),
        friendship: path.join(outDir, '01_角色面板与好感语音(初见_闲聊_关于他人)'),
        gameplay: path.join(outDir, '02_战斗与大世界探索(技能_宝箱_受击_组队)'),
        homestead: path.join(outDir, '03_尘歌壶家园对话(陪伴与互动)'),
        story: path.join(outDir, '04_剧情与主线任务语音')
    };
    for (const d of Object.values(dirs)) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }

    // 4. Scan and categorize
    const rawFiles = fs.readdirSync(tempRawDir);
    const jsonFiles = rawFiles.filter(f => f.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} raw voice metadata records.`);

    const records = [];
    for (const jf of jsonFiles) {
        const id = path.basename(jf, '.json');
        const wavPath = path.join(tempRawDir, `${id}.wav`);
        if (!fs.existsSync(wavPath)) continue;

        try {
            const data = JSON.parse(fs.readFileSync(path.join(tempRawDir, jf), 'utf8'));
            const text = cleanText(data.transcription);
            const inGame = data.inGameFilename || '';

            let cat = 'story';
            if (inGame.includes('\\VO_friendship\\')) cat = 'friendship';
            else if (inGame.includes('\\VO_gameplay\\')) cat = 'gameplay';
            else if (inGame.includes('\\VO_HS\\')) cat = 'homestead';

            records.push({ id, wavPath, text, inGame, cat });
        } catch(e) {}
    }

    console.log(`Valid audio files to organize: ${records.length}`);
    const counters = { friendship: 0, gameplay: 0, homestead: 0, story: 0 };

    for (const r of records) {
        counters[r.cat]++;
        const num = String(counters[r.cat]).padStart(4, '0');
        const textSum = r.text ? sanitize(r.text).slice(0, 32) : '拟音动作语音';
        const destName = `${num}_${textSum}.wav`;
        fs.copyFileSync(r.wavPath, path.join(dirs[r.cat], destName));
    }

    console.log("Categorized counts:", counters);

    // 5. Convert top 15 iconic lines to MP3
    const mp3Lines = records.filter(r => r.text && r.text.length >= 3).slice(0, 15);
    console.log(`Converting ${mp3Lines.length} iconic lines to MP3...`);
    let mIdx = 0;
    for (const m of mp3Lines) {
        mIdx++;
        const num = String(mIdx).padStart(2, '0');
        const textSum = sanitize(m.text).slice(0, 26);
        const mp3Name = `${num}_[${targetChar}]_${textSum}.mp3`;
        const mp3Path = path.join(dirs.ringtone, mp3Name);
        try {
            execSync(`ffmpeg -y -i "${m.wavPath}" -c:a libmp3lame -q:a 2 "${mp3Path}"`, { stdio: 'ignore' });
        } catch(e) {}
    }

    // 6. Clean temp dir & keep zip or cleanup
    console.log(`Cleaning temporary extracted files...`);
    fs.rmSync(tempRawDir, { recursive: true, force: true });

    // 7. Re-link to teyvat database
    console.log(`Updating Teyvat database to link ${targetChar} local audios...`);
    execSync(`node "${path.join(rootDir, '_tools', 'build_teyvat_database.js')}"`, { stdio: 'inherit' });

    console.log(`\n🎉 恭喜！【${targetChar}】官方语音全集已成功下载并分类到：\n${outDir}\n`);
}

main().catch(err => {
    console.error("Error during download/process:", err);
});
