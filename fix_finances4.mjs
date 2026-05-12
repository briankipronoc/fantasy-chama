import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

const regexQueue = /\{isAdmin && \(redZoneMembers\.length > 0 \|\| pendingApprovals\.length > 0 \|\| pendingWalletTopUpRequests\.length > 0\) && \([\s\S]+?\}\s*\)\}\s*\{!isAdmin && pendingWalletTopUpRequests\.length > 0 && \(/;
finContent = finContent.replace(regexQueue, '{!isAdmin && pendingWalletTopUpRequests.length > 0 && (');

fs.writeFileSync(finPath, finContent);
