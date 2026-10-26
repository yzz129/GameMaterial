const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\scratch\\nahida_voice';
const rawDir = path.join(rootDir, 'raw');
const outDir = path.join(rootDir, '纳西妲语音全集');
const classicDir = path.join(rootDir, '纳西妲精选经典语音');

function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|\r\n]/g, '_').trim();
}

async function main() {
    console.log("Creating output directories...");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    if (!fs.existsSync(classicDir)) fs.mkdirSync(classicDir, { recursive: true });

    const avatarVoiceDir = path.join(classicDir, '01_角色与战斗语音');
    const storyVoiceDir = path.join(classicDir, '02_剧情名场面精选');
    fs.mkdirSync(avatarVoiceDir, { recursive: true });
    fs.mkdirSync(storyVoiceDir, { recursive: true });

    console.log("Scanning raw directory:", rawDir);
    const files = fs.readdirSync(rawDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} metadata files.`);

    const records = [];
    for (const jf of jsonFiles) {
        const jsonPath = path.join(rawDir, jf);
        try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const baseId = path.basename(jf, '.json');
            const wavFile = `${baseId}.wav`;
            const wavPath = path.join(rawDir, wavFile);
            if (fs.existsSync(wavPath)) {
                records.push({
                    id: baseId,
                    wavPath,
                    inGameFilename: data.inGameFilename || '',
                    transcription: (data.transcription || '').trim(),
                    talkRoleType: data.talkRoleType || '',
                    voiceConfigs: data.voiceConfigs || []
                });
            }
        } catch (e) {
            // skip error
        }
    }

    console.log(`Matched ${records.length} valid audio-metadata pairs.`);

    // Categorize
    const avatarRecords = [];
    const storyRecords = [];

    records.forEach(r => {
        const ig = r.inGameFilename.toLowerCase();
        // Check if it is an avatar/combat/menu voice line
        if (ig.includes('vo_avatar') || ig.includes('vo_gameplay') || ig.includes('vo_friendship') ||
            ig.includes('vo_team') || ig.includes('vo_skill') || ig.includes('vo_burst') ||
            ig.includes('vo_hit') || ig.includes('vo_die') || ig.includes('vo_chest') ||
            (r.voiceConfigs && r.voiceConfigs.some(vc => vc.gameTrigger === 'Avatar' || vc.avatarName))) {
            avatarRecords.push(r);
        } else {
            storyRecords.push(r);
        }
    });

    console.log(`Avatar/Combat records: ${avatarRecords.length}, Story records: ${storyRecords.length}`);

    // Let's copy and rename into classicDir
    // 1. Avatar records
    let aCount = 0;
    for (const r of avatarRecords) {
        if (!r.transcription) continue;
        aCount++;
        let safeText = sanitizeFilename(r.transcription).slice(0, 40);
        let destName = `${String(aCount).padStart(3, '0')}_${safeText}.wav`;
        fs.copyFileSync(r.wavPath, path.join(avatarVoiceDir, destName));
    }

    // 2. Story highlights (e.g. key lines or lines with good transcriptions)
    let sCount = 0;
    // Sort or filter story records with meaningful dialogues
    const curatedStory = storyRecords
        .filter(r => r.transcription && r.transcription.length >= 4)
        .slice(0, 100); // Top 100 story lines

    for (const r of curatedStory) {
        sCount++;
        let safeText = sanitizeFilename(r.transcription).slice(0, 40);
        let destName = `${String(sCount).padStart(3, '0')}_${safeText}.wav`;
        fs.copyFileSync(r.wavPath, path.join(storyVoiceDir, destName));
    }

    console.log(`Copied ${aCount} avatar voicelines and ${sCount} story voicelines into classicDir.`);

    // Save master index JSON for Web Player
    const indexData = records.map((r, idx) => ({
        index: idx + 1,
        id: r.id,
        file: `${r.id}.wav`,
        text: r.transcription,
        inGamePath: r.inGameFilename,
        isAvatar: avatarRecords.includes(r)
    }));

    fs.writeFileSync(path.join(rootDir, 'nahida_voices_index.json'), JSON.stringify(indexData, null, 2), 'utf8');
    console.log("Saved nahida_voices_index.json");
}

main().catch(console.error);
