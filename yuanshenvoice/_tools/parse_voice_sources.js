const https = require('https');
const fs = require('fs');
const path = require('path');

const rootDir = 'D:\\yuanshenvoice';
const genshindb = require(path.join(rootDir, 'node_modules', 'genshin-db'));
genshindb.setOptions({ queryLanguages: ['CHS', 'English'], resultLanguage: 'CHS' });

https.get('https://huggingface.co/datasets/simon3000/genshin-voice/raw/main/speaker-archives/README.md', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
}, res => {
    let md = '';
    res.on('data', c => md += c);
    res.on('end', () => {
        const lines = md.split('\n');
        const mapping = {};

        for (const line of lines) {
            // Find Zip name and Chinese path
            const zipMatch = line.match(/`([^`]+)\.zip`/);
            const pathMatch = line.match(/\((Chinese\/[^\)]+\.zip)\)/);
            if (zipMatch && pathMatch) {
                const enSpeaker = zipMatch[1];
                const cleanEn = enSpeaker.replace(/_/g, ' ');
                const zipRelPath = pathMatch[1];

                const char = genshindb.character(cleanEn) || genshindb.character(enSpeaker);
                if (char && char.name) {
                    mapping[char.name] = {
                        enSpeaker: enSpeaker,
                        zipRelPath: zipRelPath,
                        url: 'https://huggingface.co/datasets/simon3000/genshin-voice/resolve/main/speaker-archives/' + zipRelPath
                    };
                }
            }
        }

        console.log('Successfully mapped characters:', Object.keys(mapping).length);
        console.log('List of available characters:');
        console.log(Object.keys(mapping).join('、'));

        fs.writeFileSync(path.join(rootDir, '_tools', 'character_voice_sources.json'), JSON.stringify(mapping, null, 2), 'utf8');
        console.log('Saved D:\\yuanshenvoice\\_tools\\character_voice_sources.json');
    });
});
