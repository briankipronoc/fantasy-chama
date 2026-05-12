import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

const targetStart = "{isAdmin && (redZoneMembers.length > 0 || pendingApprovals.length > 0 || pendingWalletTopUpRequests.length > 0) && (";

const startIdx = finContent.indexOf(targetStart);
if (startIdx !== -1) {
    // Find the next <section className="fc-card rounded-3xl
    const endStr = "<section className=\"fc-card rounded-3xl border border-[#FBBF24]/20 bg-gradient-to-br from-[#FBBF24]/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] p-5 md:p-6 mb-8\">";
    const endIdx = finContent.indexOf(endStr, startIdx);
    
    if (endIdx !== -1) {
        finContent = finContent.substring(0, startIdx) + finContent.substring(endIdx);
    }
} else {
   console.log("Start not found!");
}

fs.writeFileSync(finPath, finContent);
