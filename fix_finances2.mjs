import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

// The unused variables arose because we wholesale deleted the Action Queue panel where the Chairman buttons lived.
// Let's strip those TS compilation issues out by deleting the unused functions.
finContent = finContent.replace(/const handleApproveWalletTopUpRequest[\s\S]+?\}\;/g, "");
finContent = finContent.replace(/const handleRejectWalletTopUpRequest[\s\S]+?\}\;/g, "");
finContent = finContent.replace(/const handleApprovePendingPayout[\s\S]+?\}\;/g, "");
finContent = finContent.replace(/const handleRejectPendingPayout[\s\S]+?\}\;/g, "");
finContent = finContent.replace(/const totalPreviewPayout[\s\S]+?\}\n/g, ""); // Removes vars

finContent = finContent.replace(/import \{ ReceiptText, History, Download, ShieldCheck, Wallet, TrendingUp, CheckCircle2, RefreshCw, ShieldAlert, Clock3, Share2 \} from 'lucide-react';/, "import { ReceiptText, History, Download, ShieldCheck, Wallet, TrendingUp, ShieldAlert, Clock3, Share2 } from 'lucide-react';");

finContent = finContent.replace(/const \[isApprovingPayoutId, setIsApprovingPayoutId\] = useState<string \| null>\(null\);\n/, '');
finContent = finContent.replace(/const \[isRejectingPayoutId, setIsRejectingPayoutId\] = useState<string \| null>\(null\);\n/, '');
finContent = finContent.replace(/const \[actionMessage, setActionMessage\] = useState<\{ type: 'success' \| 'error'; text: string \} \| null>\(null\);\n/, '');
finContent = finContent.replace(/const \[isResolvingWalletRequestId, setIsResolvingWalletRequestId\] = useState<string \| null>\(null\);\n/, '');

fs.writeFileSync(finPath, finContent);
