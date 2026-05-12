import fs from 'fs';
let bPath = 'docs/SYSTEM_BLUEPRINT.md';
let bContent = fs.readFileSync(bPath, 'utf8');

// Insert dual FPL team info in Database section
bContent = bContent.replace(
    /#### `memberships\/\{memberId\}`[\s\S]+?fplTeamId, secondFplTeamId,/,
    `#### \`memberships/{memberId}\`\n\`\`\`\ndisplayName, phone, role ('admin' | 'member'), walletBalance,\nhasPaid, missedGameweeks, isActive, fplTeamId, secondFplTeamId (Dual-Entry FPL team support),`
);

// Insert multiple leagues info in Database section
if (!bContent.includes("LeagueSwitcher")) {
    bContent = bContent.replace(
        /#### `userLeagues\/\{phone\}`\nMulti-league index/g,
        `#### \`userLeagues/{phone}\`\nMulti-league index — enables a single phone to belong to multiple leagues. Managed by the \`LeagueSwitcher\` header component.`
    );
}

fs.writeFileSync(bPath, bContent);
