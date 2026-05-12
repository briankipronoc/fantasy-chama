import fs from 'fs';
let bPath = 'docs/USER_MANUAL.md';
let bContent = fs.readFileSync(bPath, 'utf8');

// Insert Multiple Leagues support info into USER_MANUAL.md
if (!bContent.includes("League Switcher Dropdown")) {
    bContent = bContent.replace(
        /### 2\. Linking Your Exact FPL Team\nIf you joined using the Chairman's 6-digit code, you must link your identity\.\n- Go to Profile > Select your exact team name from the FPL Roster\.\n- \(\*Users with multiple FPL entries\? Register both IDs! Each will act as an independent ticket for the pot!\*\)/,
        `### 2. Linking Your Exact FPL Team\nIf you joined using the Chairman's 6-digit code, you must link your identity.\n- Go to Profile > Select your exact team name from the FPL Roster.\n- (*Users with multiple FPL entries? Register both IDs via \`secondFplTeamId\`! Each will act as an independent ticket for the pot!*)\n\n### 2.1 Multi-League Support\n- In multiple Chamas? The **League Switcher Dropdown** in the main header allows you to instantly hot-swap between multiple mini-leagues. All wallet features, approvals, and FPL leaderboards will instantly reset to the new context without requiring re-login.`
    );
}

fs.writeFileSync(bPath, bContent);
