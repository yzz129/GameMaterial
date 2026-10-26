const fs = require('fs');
const path = require('path');

const rootDir = 'D:\\yuanshenvoice';
const genshindb = require(path.join(rootDir, 'node_modules', 'genshin-db'));
genshindb.setOptions({ queryLanguages: ['CHS', 'English'], resultLanguage: 'CHS' });

// Load voice package mapping
const sourcesPath = path.join(rootDir, '_tools', 'character_voice_sources.json');
let sources = {};
if (fs.existsSync(sourcesPath)) {
    sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
}

// Dynamically scan ALL character folders in D:\yuanshenvoice ending with "语音全集(分类整理)"
console.log('Scanning for downloaded character folders in D:\\yuanshenvoice...');
const localVoiceMaps = new Map(); // charName -> Map(cleanVoiceKey -> relativeFilePath)

const topFiles = fs.readdirSync(rootDir);
for (const item of topFiles) {
    if (item.endsWith('语音全集(分类整理)')) {
        const charName = item.replace('语音全集(分类整理)', '');
        const charFolder = path.join(rootDir, item);
        const subMap = new Map();

        function scanDir(dir) {
            const files = fs.readdirSync(dir);
            for (const f of files) {
                const fp = path.join(dir, f);
                if (fs.statSync(fp).isDirectory()) {
                    scanDir(fp);
                } else if (f.endsWith('.wav') || f.endsWith('.mp3')) {
                    const rel = path.relative(rootDir, fp).replace(/\\/g, '/');
                    subMap.set(f.toLowerCase(), rel);
                    const parts = f.replace(/^\d+_/, '').replace(/\.(wav|mp3)$/, '').split('_');
                    if (parts.length > 0) {
                        subMap.set(parts[parts.length - 1].toLowerCase(), rel);
                    }
                }
            }
        }

        scanDir(charFolder);
        localVoiceMaps.set(charName, subMap);
        console.log(`- Found local audio pack for: 【${charName}】 (${subMap.size} files)`);
    }
}

// Map Nahida raw index if exists
const nahidaIndexFile = path.join(rootDir, 'nahida_voices_index.json');
let nahidaLocalAudios = [];
if (fs.existsSync(nahidaIndexFile)) {
    try {
        nahidaLocalAudios = JSON.parse(fs.readFileSync(nahidaIndexFile, 'utf8'));
    } catch(e) {}
}
const nahidaFileMap = new Map();
for (const a of nahidaLocalAudios) {
    if (a.inGame) {
        const cleanKey = a.inGame.replace(/\\/g, '/').replace(/^Chinese\//i, '').replace(/\.wem$/i, '').toLowerCase();
        nahidaFileMap.set(cleanKey, a.organizedPath || a.relativeWav);
    }
}

const charNames = genshindb.characters('names', { matchCategories: true });
const characters = [];
const seenIds = new Set();

for (const name of charNames) {
    const char = genshindb.character(name);
    if (!char || !char.name) continue;
    if (seenIds.has(char.id)) continue;

    genshindb.setOptions({ resultLanguage: 'English' });
    const charEn = genshindb.character(name);
    genshindb.setOptions({ resultLanguage: 'CHS' });

    const enName = charEn ? charEn.name : '';
    const vo = enName ? genshindb.voiceover(enName) : null;
    if (!vo || (vo.friendLines.length === 0 && vo.actionLines.length === 0)) continue;

    seenIds.add(char.id);

    // Normalize region
    let region = char.region || '其他';
    if (region.includes('蒙德')) region = '蒙德';
    else if (region.includes('璃月')) region = '璃月';
    else if (region.includes('稻妻')) region = '稻妻';
    else if (region.includes('须弥')) region = '须弥';
    else if (region.includes('枫丹')) region = '枫丹';
    else if (region.includes('纳塔')) region = '纳塔';
    else if (region.includes('至冬')) region = '至冬';
    else region = '其他/异邦';

    const charLocalMap = localVoiceMaps.get(char.name);

    function findLocalAudio(line, charName) {
        if (charName === '纳西妲' && line.voicefile) {
            const k = line.voicefile.replace(/\\/g, '/').toLowerCase();
            if (nahidaFileMap.has(k)) return nahidaFileMap.get(k);
        }
        if (charLocalMap) {
            const titleClean = (line.title || '').replace(/…|\.|\s/g, '').toLowerCase();
            const descClean = (line.desc || line.description || '').slice(0, 15).toLowerCase();
            for (const [k, relPath] of charLocalMap.entries()) {
                if ((titleClean && k.includes(titleClean)) || (descClean && k.includes(descClean))) {
                    return relPath;
                }
            }
        }
        return null;
    }

    // Format friendLines
    const friendLines = vo.friendLines.map(fl => ({
        title: fl.title || '语音台词',
        desc: (fl.description || '').replace(/\{NICKNAME\}/g, '旅行者').trim(),
        voicefile: fl.voicefile || '',
        localAudio: findLocalAudio(fl, char.name)
    }));

    // Format actionLines
    const actionLines = vo.actionLines.map(al => ({
        title: al.title || '技能与探索',
        desc: (al.description || '').replace(/\{NICKNAME\}/g, '旅行者').trim(),
        voicefile: al.voicefile || '',
        localAudio: findLocalAudio(al, char.name)
    }));

    // Avatar image
    let avatarImg = '';
    if (char.images) avatarImg = char.images.mihoyo_icon || char.images.icon || '';
    if (!avatarImg && char.images && char.images.filename_icon) {
        avatarImg = `https://upload-os-bbs.mihoyo.com/game_record/genshin/character_icon/${char.images.filename_icon}.png`;
    }

    // Gacha splash
    let splashArt = '';
    if (char.images && char.images.filename_gachaSplash) {
        splashArt = `https://enka.network/ui/${char.images.filename_gachaSplash}.png`;
    } else if (char.images && char.images.cover1) {
        splashArt = char.images.cover1;
    }

    // Map online direct download package
    let voicePackage = sources[char.name] || null;
    if (!voicePackage && enName) {
        const enKey = enName.replace(/ /g, '_').toLowerCase();
        voicePackage = Object.values(sources).find(s => s.enSpeaker.toLowerCase() === enKey) || null;
    }

    characters.push({
        id: char.id,
        name: char.name,
        enName: enName,
        title: char.title || '',
        element: char.elementText || '无属性',
        region: region,
        rarity: parseInt(char.rarity, 10) || 4,
        weapon: char.weaponText || '单手剑',
        birthday: char.birthday || '未知',
        constellation: char.constellation || '未知',
        description: char.description || '',
        affiliation: char.affiliation || '',
        cv: {
            chinese: (char.cv && char.cv.chinese) || '官方声优',
            japanese: (char.cv && char.cv.japanese) || '官方声优',
            english: (char.cv && char.cv.english) || 'Official VA',
            korean: (char.cv && char.cv.korean) || 'Official VA'
        },
        avatarImg: avatarImg,
        splashArt: splashArt,
        hasLocalPack: localVoiceMaps.has(char.name),
        voicePackageUrl: voicePackage ? voicePackage.url : null,
        voicePackageEn: voicePackage ? voicePackage.enSpeaker : enName,
        quoteCount: friendLines.length + actionLines.length,
        friendLines: friendLines,
        actionLines: actionLines
    });
}

// Sort characters: local audio downloaded first, then 5-star, then by region
const regionOrder = { '蒙德': 1, '璃月': 2, '稻妻': 3, '须弥': 4, '枫丹': 5, '纳塔': 6, '至冬': 7, '其他/异邦': 8 };
characters.sort((a, b) => {
    if (a.hasLocalPack !== b.hasLocalPack) return a.hasLocalPack ? -1 : 1;
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    const rA = regionOrder[a.region] || 99;
    const rB = regionOrder[b.region] || 99;
    if (rA !== rB) return rA - rB;
    return a.name.localeCompare(b.name, 'zh-CN');
});

console.log(`Successfully compiled ${characters.length} characters!`);
const outputPath = path.join(rootDir, 'teyvat_characters.json');
fs.writeFileSync(outputPath, JSON.stringify(characters, null, 2), 'utf8');
const jsPath = path.join(rootDir, 'teyvat_characters_data.js');
fs.writeFileSync(jsPath, 'window.TEYVAT_CHARACTERS = ' + JSON.stringify(characters) + ';', 'utf8');
console.log(`Updated teyvat_characters.json & teyvat_characters_data.js successfully!`);
