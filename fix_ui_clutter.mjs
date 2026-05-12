import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

// 1. Remove Duplicate Red Zone Members card in Finances
const redZoneCardRegex = /\{\s*isAdmin && \(\s*<article className="fc-card rounded-2xl p-6 border border-red-500\/25 bg-gradient-to-br from-red-500\/14 via-white dark:via-\[#161d24\] to-white dark:to-\[#161d24\] flex flex-col justify-between">\s*<div>\s*<div className="flex items-center justify-between mb-4">\s*<p className="text-\[10px\] font-black uppercase tracking-widest text-red-400">Red Zone Members<\/p>\s*<ShieldAlert className="w-4 h-4 text-red-400" \/>\s*<\/div>\s*<p className="text-2xl font-black tabular-nums text-white">\{redZoneCount\}<\/p>\s*<p className="text-\[11px\] text-gray-600 dark:text-gray-400 mt-2">Members with pending deposits<\/p>\s*<\/div>\s*<button\s*onClick=\{handleBulkNudge\}\s*className="w-full mt-6 py-2\.5 rounded-xl border border-red-400\/30 bg-red-500\/10 hover:bg-red-500\/20 text-red-400 text-\[10px\] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"\s*>\s*Notify Group <Share2 className="w-3 h-3" \/>\s*<\/button>\s*<\/article>\s*\)\}/g;

const matches = finContent.match(redZoneCardRegex);
// Replace the SECOND occurrence
if (matches && matches.length > 1) {
    let split = finContent.split(matches[1]);
    finContent = split[0] + split[1];
}

// 2. Remove Action Queue section completely
const actionQueueStart = `{isAdmin && (redZoneMembers.length > 0 || pendingApprovals.length > 0 || pendingWalletTopUpRequests.length > 0) && (`;
const idx = finContent.indexOf(actionQueueStart);
if (idx !== -1) {
    // find the matching closing `)}`
    // Wait, simpler: replace the known block down to `{!isAdmin`
    const regexQueue = /\{isAdmin && \(redZoneMembers\.length \> 0 \|\| pendingApprovals\.length \> 0 \|\| pendingWalletTopUpRequests\.length \> 0\) && \([\s\S]+?\}\s*\)\}\s*\{!isAdmin && pendingWalletTopUpRequests\.length \> 0 && \(/;
    finContent = finContent.replace(regexQueue, '{!isAdmin && pendingWalletTopUpRequests.length > 0 && (');
}

fs.writeFileSync(finPath, finContent);
console.log("Patched Finances Clutter!");
