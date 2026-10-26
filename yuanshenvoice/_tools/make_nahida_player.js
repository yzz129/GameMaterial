const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\scratch\\nahida_voice';
const script = fs.readFileSync(path.join(rootDir, '_tools', 'update_player.js'), 'utf8');
const modified = script.replace(
    "fs.writeFileSync(path.join(rootDir, 'index.html')",
    "fs.writeFileSync(path.join(rootDir, 'nahida_player.html')"
);
eval(modified);
console.log('nahida_player.html generated successfully!');
