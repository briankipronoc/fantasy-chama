import fs from 'fs';
let p = 'src/pages/AdminCommandCenter.tsx';
let txt = fs.readFileSync(p, 'utf8');

txt = txt.replace(/role === 'admin'/g, "diagnosticsIsChairman");
txt = txt.replace(/role === 'co-admin'/g, "diagnosticsIsCoAdmin");
txt = txt.replace(/\['admin', 'co-admin'\].includes\(role \|\| ''\)/g, "diagnosticsIsAdmin");

fs.writeFileSync(p, txt);
