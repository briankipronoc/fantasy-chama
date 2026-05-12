import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

// The redundant section is from line 953 to 1029:
// {isAdmin && (redZoneMembers.length > 0 || pendingApprovals.length > 0...
const startStr = "{isAdmin && (redZoneMembers.length > 0 || pendingApprovals.length > 0 || pendingWalletTopUpRequests.length > 0) && (";
const endStr = "{!isAdmin && pendingWalletTopUpRequests.length > 0 && (";
const startIdx = finContent.indexOf(startStr);
const endIdx = finContent.indexOf(endStr);
if (startIdx !== -1 && endIdx !== -1) {
    finContent = finContent.substring(0, startIdx) + finContent.substring(endIdx);
}

fs.writeFileSync(finPath, finContent);
