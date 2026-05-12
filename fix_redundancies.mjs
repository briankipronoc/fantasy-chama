import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

// The first patch didn't quite capture the entire Action Queue cleanly. Let's do a strict removal of the Action Queue in Finances.tsx
// that had all the duplicate cards (Red Zone, Pending Payouts, etc.)
let idxQueue = finContent.indexOf('<section className="fc-card mb-8 rounded-2xl border border-[#FBBF24]/25 bg-gradient-to-br from-[#FBBF24]/10 to-white dark:to-[#161d24] p-5 md:p-6">');
if (idxQueue !== -1) {
    let nextSectionId = finContent.indexOf('{!isAdmin', idxQueue);
    if(nextSectionId !== -1) {
        let blockToRemove = finContent.substring(finContent.lastIndexOf('{isAdmin && (', idxQueue), nextSectionId);
        finContent = finContent.replace(blockToRemove, '');
    }
}

// Ensure the second redundant Red Zone Members card is definitely gone.
let redZoneCards = finContent.match(/text-red-400">Red Zone Members/g);
if (redZoneCards && redZoneCards.length > 1) {
    let redZoneCardStart = finContent.lastIndexOf('{isAdmin && (', finContent.lastIndexOf('text-red-400">Red Zone Members'));
    let redZoneCardEnd = finContent.indexOf('</article>', redZoneCardStart) + 11;
    // adding the closing tag
    if(finContent.substring(redZoneCardEnd, redZoneCardEnd+2) === ')}') redZoneCardEnd += 2;
    finContent = finContent.substring(0, redZoneCardStart) + finContent.substring(redZoneCardEnd);
}

fs.writeFileSync(finPath, finContent);

let adminPath = 'src/pages/AdminCommandCenter.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');

// Ensure click handlers are correctly assigned to all metric cards in Command Center so chairman can tap and action.
// red zone follow-ups card
adminContent = adminContent.replace(
    'redZoneMembers.length > 0 ? "fc-metric-alert" : "fc-metric-stable",\n                    )}',
    'redZoneMembers.length > 0 ? "fc-metric-alert" : "fc-metric-stable",\n                    )}\n                    onClick={() => { setActiveTab("ledger"); setPaymentFilter("Red Zone"); setTimeout(() => window.document.getElementById("master-ledger")?.scrollIntoView({ behavior: "smooth" }), 100); }}'
);

// We had an unnecessary UI element showing duplicated text below the button
fs.writeFileSync(adminPath, adminContent);
console.log("Cleanup complete!");
