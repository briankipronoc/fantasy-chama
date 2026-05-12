import fs from 'fs';

let blueprintPath = 'docs/SYSTEM_BLUEPRINT.md';
if (fs.existsSync(blueprintPath)) {
    let content = fs.readFileSync(blueprintPath, 'utf8');
    if (!content.includes('Wallet-First Architecture')) {
        content += `\n\n## Wallet-First Architecture\nTo improve cash-float and accommodate varying transaction sizes (from student micro-payments to 4-week bulk top-ups), the core architecture relies on an internal Wallet ledger. Users deposit via M-Pesa to a central holding state. Gameweek stakes are deducted from this wallet programmatically, drastically reducing M-Pesa API STK push fatigue and enabling flexible payment frequencies.\n`;
        fs.writeFileSync(blueprintPath, content);
    }
}

let invBriefPath = 'docs/INVESTOR_BRIEF.md';
if (fs.existsSync(invBriefPath)) {
    let content = fs.readFileSync(invBriefPath, 'utf8');
    if (!content.includes('Student micro-payments')) {
        content += `\n\n## Growth Strategy: Micro-payments & Wallet Pre-funding\nBy pivoting to a Wallet-First system, we now capture both high-roller bulk deposits (4-week advances) and student micro-payments (custom top-ups), dramatically increasing total platform liquidity and user retention by removing weekly payment friction.\n`;
        fs.writeFileSync(invBriefPath, content);
    }
}

console.log("Documents updated with Wallet-First parameters.");
