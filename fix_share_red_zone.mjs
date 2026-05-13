import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

finContent = finContent.replace(/\s*\{isAdmin && \(\s*<button onClick=\{shareRedZone\}[\s\S]*?<\/button>\s*\)\}/g, "");
fs.writeFileSync(finPath, finContent);
console.log("Removed Share Red Zone button in Finances.");
