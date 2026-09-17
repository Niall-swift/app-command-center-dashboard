const fs = require('fs');
const files = [
  'src/services/ispfy/ispfyService.ts',
  'src/components/ispfy/ISPFYClientDashboard.tsx',
  'src/components/layout/AppSidebar.tsx',
  'src/pages/Settings.tsx',
  'src/pages/ISPFYConsulta.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // Match conflict markers that are at the beginning of the line
  const regex = /^<<<<<<< HEAD\r?\n([\s\S]*?)^=======\r?\n([\s\S]*?)^>>>>>>> [^\r\n]+(?:\r?\n)?/gm;
  content = content.replace(regex, (match, p1, p2) => p2);
  fs.writeFileSync(file, content);
  console.log('Fixed ' + file);
}
