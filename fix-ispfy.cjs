const fs = require('fs');
let content = fs.readFileSync('src/services/ispfy/ispfyService.ts', 'utf8');
const regex = /^<<<<<<< HEAD\r?\n([\s\S]*?)^=======\r?\n([\s\S]*?)^>>>>>>> [^\r\n]+(?:\r?\n)?/gm;
content = content.replace(regex, (match, p1, p2) => p2);
fs.writeFileSync('src/services/ispfy/ispfyService.ts', content);
