const fs = require('fs');
const cat = JSON.parse(fs.readFileSync('D:/yuanshenvoice/data/catalog.json', 'utf8'));

console.log('Total characters:', cat.length);
cat.forEach((c, i) => {
  console.log(`${i + 1}. [${c.id}] ${c.name} (${c.element} / ${c.region})`);
});
