const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\scratch\\nahida_voice';
const rawDir = path.join(rootDir, 'raw');

// Target directories
const baseDest = path.join(rootDir, '纳西妲语音全集(分类整理)');
const dirs = {
    ringtone: path.join(baseDest, '00_精选热门MP3(推荐手机铃声_通知铃声)'),
    friendship: path.join(baseDest, '01_角色面板与好感语音(初见_闲聊_关于他人)'),
    gameplay: path.join(baseDest, '02_战斗与大世界探索(技能_宝箱_受击_组队)'),
    homestead: path.join(baseDest, '03_尘歌壶家园对话(陪伴与互动)'),
    legend: path.join(baseDest, '04_传说任务剧情语音(智慧主之章)'),
    archon: path.join(baseDest, '05_魔神任务主线剧情(须弥_纳塔全剧情)'),
    other: path.join(baseDest, '06_活动与烹饪特殊语音')
};

// Create target dirs
for (const p of Object.values(dirs)) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/\{NICKNAME\}/g, '旅行者')
        .replace(/\{M#他\}\{F#她\}/g, '旅行者')
        .replace(/\{M#他\}\{F#她\}/g, '旅行者')
        .replace(/\{PLAYERAVATAR#[^}]+\}/g, '旅行者')
        .replace(/#\{[^}]+\}/g, '旅行者')
        .replace(/#[0-9a-zA-Z]+/g, '')
        .trim();
}

function sanitizeFilename(str) {
    return str
        .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
        .replace(/_+/g, '_')
        .trim();
}

async function run() {
    console.log("Reading raw directory...");
    const files = fs.readdirSync(rawDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} metadata files.`);

    const records = [];
    for (const jf of jsonFiles) {
        const id = path.basename(jf, '.json');
        const wavPath = path.join(rawDir, `${id}.wav`);
        if (!fs.existsSync(wavPath)) continue;

        try {
            const data = JSON.parse(fs.readFileSync(path.join(rawDir, jf), 'utf8'));
            const transcription = cleanText(data.transcription);
            const inGame = data.inGameFilename || '';

            // Classify
            let category = 'other';
            let catName = '活动语音';
            if (inGame.includes('\\VO_friendship\\')) {
                category = 'friendship';
                catName = '角色面板';
            } else if (inGame.includes('\\VO_gameplay\\')) {
                category = 'gameplay';
                catName = '战斗探索';
            } else if (inGame.includes('\\VO_HS\\')) {
                category = 'homestead';
                catName = '尘歌壶';
            } else if (inGame.includes('\\VO_LQ\\')) {
                category = 'legend';
                catName = '传说任务';
            } else if (inGame.includes('\\VO_AQ\\')) {
                category = 'archon';
                catName = '魔神主线';
            }

            records.push({
                id,
                wavPath,
                inGame,
                text: transcription,
                category,
                catName
            });
        } catch (e) {
            console.error('Error parsing', jf, e.message);
        }
    }

    console.log(`Total valid audio files: ${records.length}`);

    // Group counters
    const counters = {
        friendship: 0,
        gameplay: 0,
        homestead: 0,
        legend: 0,
        archon: 0,
        other: 0
    };

    const indexItems = [];

    for (const r of records) {
        counters[r.category]++;
        const num = String(counters[r.category]).padStart(4, '0');
        let textSummary = r.text ? sanitizeFilename(r.text).slice(0, 36) : '拟音动作语音';
        const newFileName = `${num}_${textSummary}.wav`;
        const destFilePath = path.join(dirs[r.category], newFileName);

        fs.copyFileSync(r.wavPath, destFilePath);

        indexItems.push({
            id: r.id,
            category: r.category,
            catName: r.catName,
            text: r.text || '(角色动作/拟音/无台词)',
            inGame: r.inGame,
            relativeWav: `raw/${r.id}.wav`,
            organizedPath: `纳西妲语音全集(分类整理)/${path.basename(dirs[r.category])}/${newFileName}`
        });
    }

    console.log("Category counts:", counters);

    // Now select iconic lines for MP3 conversion (combat skills, friendship, chest open, famous lines)
    const iconicKeywords = [
        '好奇心', '知识与你分享', '手拉手', '我都看见了', '最初的贤者', '揉揉眼睛',
        '晚安', '早安', '初次见面', '阳光', '下雨', '打雷', '思考', '生日快乐',
        '眨眼睛', '打个喷嚏', '散兵', '多莉', '提纳里', '大慈树王', '明天会到来',
        '扫兴的那个人', '国境线上', '攻势'
    ];

    const curatedForMp3 = [];
    const usedIds = new Set();

    // First, find matches from keywords
    for (const kw of iconicKeywords) {
        const match = records.find(r => r.text.includes(kw) && !usedIds.has(r.id));
        if (match) {
            curatedForMp3.push(match);
            usedIds.add(match.id);
        }
    }

    // Add some classic gameplay lines
    const gameplayMatches = records.filter(r => r.category === 'gameplay' && r.text && !usedIds.has(r.id)).slice(0, 10);
    for (const m of gameplayMatches) {
        curatedForMp3.push(m);
        usedIds.add(m.id);
    }

    console.log(`Converting ${curatedForMp3.length} iconic lines to MP3...`);
    let mp3Idx = 0;
    for (const item of curatedForMp3) {
        mp3Idx++;
        const num = String(mp3Idx).padStart(2, '0');
        const textSum = sanitizeFilename(item.text).slice(0, 30);
        const mp3Name = `${num}_[纳西妲]_${textSum}.mp3`;
        const mp3Path = path.join(dirs.ringtone, mp3Name);
        try {
            execSync(`ffmpeg -y -i "${item.wavPath}" -c:a libmp3lame -q:a 2 "${mp3Path}"`, { stdio: 'ignore' });
        } catch (e) {
            console.error('FFmpeg error on', mp3Name, e.message);
        }
    }
    console.log(`Finished converting ${mp3Idx} MP3 files.`);

    // Write index json
    fs.writeFileSync(path.join(rootDir, 'nahida_voices_index.json'), JSON.stringify(indexItems, null, 2), 'utf8');
    console.log("Saved nahida_voices_index.json");

    // Write README catalog
    let readme = `# 原神 · 纳西妲 (Nahida / 小草神) 官方中文语音全集\n\n`;
    readme += `本语音包共收录 **${records.length}** 条高品质无损 WAV 中文语音音频，并经过结构化分类整理与命名，由官方中配声优 **花玲** 配音录制。\n\n`;
    readme += `## 📁 目录结构\n\n`;
    readme += `- **\`00_精选热门MP3(推荐手机铃声_通知铃声)\`**: ${mp3Idx} 条高频经典台词，已转换为标准 MP3 格式，方便手机随身听、设为闹钟或提示音。\n`;
    readme += `- **\`01_角色面板与好感语音\`**: ${counters.friendship} 条角色语音（初次见面、早晚问候、闲聊、关于须弥各角色评价、突破台词等）。\n`;
    readme += `- **\`02_战斗与大世界探索\`**: ${counters.gameplay} 条战斗语音（拍照战技「手拉手」「我都看见了」、大招「知识与你分享」、开宝箱、组队、受击、倒下等）。\n`;
    readme += `- **\`03_尘歌壶家园对话\`**: ${counters.homestead} 条尘歌壶内与旅行者的亲密对话及好感互动台词。\n`;
    readme += `- **\`04_传说任务剧情语音\`**: ${counters.legend} 条纳西妲传说任务「智慧主之章」第一幕与第二幕全剧情台词。\n`;
    readme += `- **\`05_魔神任务主线剧情\`**: ${counters.archon} 条须弥主线、花神诞祭轮回、大慈树王诀别及纳塔等魔神任务主线剧情全语音。\n`;
    readme += `- **\`06_活动与烹饪特殊语音\`**: ${counters.other} 条版本限时活动、烹饪品尝等趣味语音。\n\n`;
    readme += `## 🎧 网页可视化点播器\n\n`;
    readme += `双击根目录下的 **\`index.html\`**，即可在浏览器中开启纳西妲专属音频播放器，支持实时关键字搜索、台词筛选与一键点播试听！\n\n`;

    fs.writeFileSync(path.join(rootDir, 'README.md'), readme, 'utf8');
    console.log("Saved README.md");
}

run().catch(console.error);
