import fs from 'fs';
let adminPath = 'src/pages/AdminCommandCenter.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');

adminContent = adminContent.replace(
    /GW \$\{currentGwNumber \?\? "\?\?"\} ongoing\.\.\./g,
    'GW ${currentGwNumber || 1} ongoing...'
);

fs.writeFileSync(adminPath, adminContent);
console.log("Admin GW display fixed again.");
