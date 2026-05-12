import fs from 'fs';
const path = 'src/pages/Finances.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\{\s*isAdmin && \(redZoneMembers\.length > 0 \|\| pendingApprovals\.length > 0 \|\| pendingWalletTopUpRequests\.length > 0\) && \(\s*<section className="fc-card mb-8[\s\S]+?<\/section>\s*\)\s*\}/;
const match = content.match(regex);

if (match) {
    const queueBlock = match[0];
    content = content.replace(regex, ''); // Remove from bottom

    const vaultStr = `<section className="fc-card rounded-3xl border border-[#FBBF24]/20 bg-gradient-to-br from-[#FBBF24]/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] p-5 md:p-6 mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-5">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FBBF24]">Vault payout preview</p>`;
    
    if (content.includes(vaultStr)) {
        content = content.replace(vaultStr, queueBlock + '\n\n                ' + vaultStr);
        fs.writeFileSync(path, content);
        console.log("Moved Action Queue above Vault Preview.");
    } else {
        console.log("Could not find Vault logic");
    }
} else {
    console.log("Could not find Action queue");
}
