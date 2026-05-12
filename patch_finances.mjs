import fs from 'fs';
const path = 'src/pages/Finances.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Extract Action Queue block
const actionQueueRegex = /\{\s*isAdmin && pendingApprovalCount > 0 && \(\s*<section className="mb-8">[\s\S]+?<\/section>\s*\)\s*\}/;
const matchAQ = content.match(actionQueueRegex);

if (matchAQ) {
    const queueBlock = matchAQ[0];
    content = content.replace(actionQueueRegex, ''); // Remove it from current position

    // Insert it BEFORE Vault payout preview
    const vaultPreviewSectionStr = `<section className="fc-card rounded-3xl border border-[#FBBF24]/20 bg-gradient-to-br from-[#FBBF24]/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] p-5 md:p-6 mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-5">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FBBF24]">Vault payout preview</p>`;
    
    if (content.includes(vaultPreviewSectionStr)) {
        content = content.replace(vaultPreviewSectionStr, queueBlock + '\n\n                ' + vaultPreviewSectionStr);
        console.log("Action Queue successfully moved.");
    } else {
        console.log("Could not find Vault Preview section.");
    }
} else {
    console.log("Could not find Action Queue block.");
}

// 2. Insert Red Zone tile into the Grid for admins
// The Grid currently has: Next Due (if not admin), Approval SLA (if admin), Cashflow Health, Wallet Top-Up (if not admin).
// I will insert Red Zone (if admin) before Approval SLA or after Cashflow Health.

const approvalSlaBlockStr = `{isAdmin && (
                        <article className="fc-card rounded-2xl p-6 border border-amber-500/25 bg-gradient-to-br from-amber-500/14 via-white dark:via-[#161d24] to-white dark:to-[#161d24] flex flex-col justify-between">`;

const redZoneBlock = `{isAdmin && (
                        <article className="fc-card rounded-2xl p-6 border border-red-500/25 bg-gradient-to-br from-red-500/14 via-white dark:via-[#161d24] to-white dark:to-[#161d24] flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Red Zone Members</p>
                                    <ShieldAlert className="w-4 h-4 text-red-400" />
                                </div>
                                <p className="text-2xl font-black tabular-nums text-white">{redZoneCount}</p>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2">Members with pending deposits</p>
                            </div>
                            <button onClick={shareRedZone} className="mt-4 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors w-full border border-red-500/20">
                                Notify Group <Share2 className="w-3 h-3" />
                            </button>
                        </article>
                    )}`;

if (content.includes(approvalSlaBlockStr)) {
    content = content.replace(approvalSlaBlockStr, redZoneBlock + '\n\n                    ' + approvalSlaBlockStr);
    
    // update grid cols from md:grid-cols-3 to lg:grid-cols-4 or just keep it 3 and let it wrap it's okay.
    // Let's modify to lg:grid-cols-4 just in case. Actually, md:grid-cols-3 is fine as well. Let's make it grid-cols-1 md:grid-cols-2 lg:grid-cols-3. Wait, it was md:grid-cols-3.
    // Replace grid-cols-1 md:grid-cols-3 with grid-cols-1 md:grid-cols-2 xl:grid-cols-3
    content = content.replace('grid-cols-1 md:grid-cols-3', 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');
    console.log("Red Zone block successfully injected.");
} else {
    console.log("Could not find Approval SLA block.");
}

fs.writeFileSync(path, content);
