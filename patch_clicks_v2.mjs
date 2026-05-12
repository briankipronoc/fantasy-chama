import fs from 'fs';
const path = 'src/pages/AdminCommandCenter.tsx';
let content = fs.readFileSync(path, 'utf8');

// The error was caused by incorrectly messing up the JSX syntax in the previous regex. 
// I will just use simpler strict string replacements for exactly the onClick handlers I want to inject.

content = content.replace(
    /onClick=\{\(\) => setActiveTab\("ledger"\)\}/g,
    `onClick={() => setActiveTab("ledger")}` // reset just in case, wait, I didn't commit the bad patch so it's clean.
);

// 1. approve payouts -> already has onClick={() => setActiveTab("ledger")}, let's change it
content = content.replace(
    `onClick={() => setActiveTab("ledger")}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\n                      approve payouts`,
    `onClick={() => { setActiveTab("dashboard"); setTimeout(() => document.getElementById("pending-payout-queue")?.scrollIntoView({ behavior: "smooth" }), 100); }}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\n                      approve payouts`
);

// 2. approval SLA (red zone) -> already has onClick={() => setActiveTab("finance")}
content = content.replace(
    `onClick={() => setActiveTab("finance")}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\n                      approval SLA (red zone)`,
    `onClick={() => { setActiveTab("ledger"); setPaymentFilter("Red Zone"); setTimeout(() => document.getElementById("master-ledger")?.scrollIntoView({ behavior: "smooth" }), 100); }}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\n                      approval SLA (red zone)`
);

// 3. unresolved disputes -> missing click handler
content = content.replace(
    `pendingDisputes.length > 0 ? "fc-metric-alert" : "fc-metric-stable",\n                    )}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold">\n                      unresolved disputes`,
    `pendingDisputes.length > 0 ? "fc-metric-alert" : "fc-metric-stable",\n                    )}\n                    onClick={() => { setActiveTab("finance"); setTimeout(() => window.document.getElementById("dispute-claims")?.scrollIntoView({ behavior: "smooth" }), 100); }}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\n                      unresolved disputes`
);

// 4. 2-week risk members -> missing click handler
content = content.replace(
    `highRiskTwoWeekMisses > 0 ? "fc-metric-alert" : "fc-metric-stable",\n                    )}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold">\n                      2-week risk members`,
    `highRiskTwoWeekMisses > 0 ? "fc-metric-alert" : "fc-metric-stable",\n                    )}\n                    onClick={() => { setActiveTab("ledger"); setPaymentFilter("Red Zone"); setTimeout(() => window.document.getElementById("master-ledger")?.scrollIntoView({ behavior: "smooth" }), 100); }}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\n                      2-week risk members`
);

fs.writeFileSync(path, content);
console.log("Patched safely.");
