const fs = require('fs');
let txt = fs.readFileSync('src/pages/AdminCommandCenter.tsx', 'utf8');

['dashboard', 'ledger', 'finance'].forEach(tab => {
    let m = txt.indexOf(`activeTab === "${tab}"`);
    console.log(`Tab ${tab} at index ${m}`);
});
