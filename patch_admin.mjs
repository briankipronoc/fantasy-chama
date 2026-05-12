import fs from 'fs';

const path = 'src/pages/AdminCommandCenter.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix timeline active block
content = content.replace( // match exact lines for timeline
`    {
      key: "hq-settled",
      label: "HQ Settled",
      hint: "Monthly step: submit HQ receipt in the month-end window.",
      active: isHqSettled,
    },`,
`    {
      key: "hq-settled",
      label: "HQ Settled",
      hint: "Monthly step: submit HQ receipt in the month-end window.",
      active: actionTimeline.confirmed && isHqSettled,
    },`
);

// Fix FPL fetch banner heuristic bug
const fetchStartStr = `          // Fetch Live GW Winner with 'Banner Off' Heuristic
          if (data.fplLeagueId) {
            const lastDate = data.lastResolvedDate?.toDate();
            const daysSince = lastDate
              ? (new Date().getTime() - lastDate.getTime()) / (1000 * 3600 * 24)
              : 0;

            // Show banner if never resolved, OR if we are within 2 days of resolution (celebrating), OR if it's been > 5 days (new GW starting)
            const shouldShowBanner =
              !lastDate || daysSince <= 2 || daysSince > 5;

            if (shouldShowBanner) {
              fetch(`;

const newFetchStartStr = `          // Fetch Live GW Winner always for Admin Center
          if (data.fplLeagueId) {
              fetch(`;

// We also need to safely remove the closing brace for `if (shouldShowBanner)` which is right before the `// Initialize Live Ledger` comment or similar. Let's do a regex to just fix the whole section.
const regex = /\/\/ Fetch Live GW Winner with 'Banner Off' Heuristic[\s\S]+?shouldShowBanner\) {([\s\S]+?)console\.error\("Could not fetch FPL winner:", err\),\s+\);\s+}\s+}\s+}/;
const match = content.match(regex);
if (match) {
  content = content.replace(regex, `// Fetch Live GW Winner always for Admin Center
          if (data.fplLeagueId) {` + match[1] + `console.error("Could not fetch FPL winner:", err),
                );
            }
          }`);
} else {
  console.log('Regex did not match for fetch block.');
}

fs.writeFileSync(path, content);
console.log('Admin Center patched.');
