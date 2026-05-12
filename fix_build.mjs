import fs from 'fs';

// Fix AdminCommandCenter hoisting issue
let adminPath = 'src/pages/AdminCommandCenter.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');

adminContent = adminContent.replace(
    '  }, [pendingPayouts.length, hasFinalGwChampion]);',
    '    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [pendingPayouts.length]);'
);
adminContent = adminContent.replace(
    'if (!hasFinalGwChampion && pendingPayouts.length === 0) {',
    'if (!isCurrentEventFinished && pendingPayouts.length === 0) {'
);
fs.writeFileSync(adminPath, adminContent);

// Fix Finances.tsx imports and missing vars
let finPath = 'src/pages/Finances.tsx';
let finContent = fs.readFileSync(finPath, 'utf8');
finContent = finContent.replace(
    "import { ReceiptText, CloudLightning, ShieldAlert, ShieldCheck, Download, RefreshCw, Calculator, Vault, Wallet, Clock3, TrendingUp, HelpCircle } from 'lucide-react';",
    "import { ReceiptText, CloudLightning, ShieldAlert, ShieldCheck, Download, RefreshCw, Calculator, Vault, Wallet, Clock3, TrendingUp, HelpCircle, Share2 } from 'lucide-react';"
);

// We need to inject redZoneCount
const findMemberLine = 'const activeMembersCount = members.filter';
const injectVar = `const redZoneCount = members.filter((m) => m.role !== 'admin' && m.isActive !== false && !m.hasPaid).length;\n    const findMemberLine`;
finContent = finContent.replace(findMemberLine, injectVar);

fs.writeFileSync(finPath, finContent);
