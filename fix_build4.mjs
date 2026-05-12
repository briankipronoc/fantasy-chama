import fs from 'fs';
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');

finContent = finContent.replace(
    "import { ReceiptText, History, Download, ShieldCheck, Wallet, TrendingUp, CheckCircle2, RefreshCw, ShieldAlert, Clock3 } from 'lucide-react';",
    "import { ReceiptText, History, Download, ShieldCheck, Wallet, TrendingUp, CheckCircle2, RefreshCw, ShieldAlert, Clock3, Share2 } from 'lucide-react';"
);

fs.writeFileSync(finPath, finContent);
