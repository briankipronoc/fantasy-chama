import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

const regexQueue = /\{isAdmin && \(redZoneMembers\.length > 0 \|\| pendingApprovals\.length > 0 \|\| pendingWalletTopUpRequests\.length > 0\) && \([\s\S]+?\}\s*\)\}\s*\{!isAdmin && pendingWalletTopUpRequests\.length > 0 && \(/;
finContent = finContent.replace(regexQueue, '{!isAdmin && pendingWalletTopUpRequests.length > 0 && (');

// Strip out the unused functions safely
finContent = finContent.replace(/const handleApproveWalletTopUpRequest = async[\s\S]+?\}\;/g, "");
finContent = finContent.replace(/const handleRejectWalletTopUpRequest = async[\s\S]+?\}\;/g, "");
finContent = finContent.replace(/const handleApprovePendingPayout = async[\s\S]+?\}\;/g, "");
finContent = finContent.replace(/const handleRejectPendingPayout = async[\s\S]+?\}\;/g, "");

// Strip unused top level variables
finContent = finContent.replace(/const \[isApprovingPayoutId, setIsApprovingPayoutId\] = useState<string \| null>\(null\);\n/g, "");
finContent = finContent.replace(/const \[isRejectingPayoutId, setIsRejectingPayoutId\] = useState<string \| null>\(null\);\n/g, "");
finContent = finContent.replace(/const \[actionMessage, setActionMessage\] = useState<\{ type: 'success' \| 'error'; text: string \} \| null>\(null\);\n/g, "");
finContent = finContent.replace(/const \[isResolvingWalletRequestId, setIsResolvingWalletRequestId\] = useState<string \| null>\(null\);\n/g, "");

finContent = finContent.replace(/const totalPreviewPayout = [^\n]+\n/g, "");
finContent = finContent.replace(/const isPreviewCapped = [^\n]+\n/g, "");
finContent = finContent.replace(/const topSeasonLeader = [^\n]+\n/g, "");
finContent = finContent.replace(/const modeLabel = [^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n/g, "");

finContent = finContent.replace(/CheckCircle2, /g, "");
finContent = finContent.replace(/RefreshCw, /g, "");

fs.writeFileSync(finPath, finContent);
