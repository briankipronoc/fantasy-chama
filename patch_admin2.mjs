import fs from 'fs';
let p = 'src/pages/AdminCommandCenter.tsx';
let txt = fs.readFileSync(p, 'utf8');

txt = txt.replace(/GW \?\? ongoing\.\.\./g, 'GW ${currentGwNumber || "??"} ongoing...');
txt = txt.replace('Accepting deposits for Gameweek 26. Deadline approaches.', 'Accepting deposits for the upcoming Gameweek. Deadline approaches.');

fs.writeFileSync(p, txt);
console.log("Updated AdminCommandCenter");
