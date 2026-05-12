import fs from 'fs';
let adminPath = 'src/pages/AdminCommandCenter.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');

// The proxy to corsproxy.io isn't working if there's no current GW in FPL before season starts 
// or if FPL api is offline. 
// We should check the condition {hasFinalGwChampion ? "Resolve / Close GW" : `GW ${currentGwNumber ?? "??"} ongoing...`}

adminContent = adminContent.replace(
    /GW \$\{currentGwNumber \?\? "\?\?"\} ongoing\.\.\./g, 
    'GW ${currentGwNumber || activeLeague?.currentGw || 1} ongoing...'
);

fs.writeFileSync(adminPath, adminContent);
console.log("Admin GW display fixed.");
