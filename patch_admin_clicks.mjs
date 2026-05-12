import fs from 'fs';
const path = 'src/pages/AdminCommandCenter.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. approve payouts
content = content.replace(
    /onClick=\{\(\) => setActiveTab\("ledger"\)\}\s*>\s*<p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\s*approve payouts/g,
    `onClick={() => { setActiveTab("dashboard"); setTimeout(() => scrollToSection("pending-payout-queue"), 100); }}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\n                      approve payouts`
);

// 2. approval SLA
content = content.replace(
    /onClick=\{\(\) => setActiveTab\("finance"\)\}\s*>\s*<p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\s*approval SLA \(red zone\)/g,
    `onClick={() => { setActiveTab("ledger"); setPaymentFilter("Red Zone"); setTimeout(() => scrollToSection("master-ledger"), 100); }}\n                  >\n                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">\n                      approval SLA (red zone)`
);

// 3. unresolved disputes
content = content.replace(
    /className=\{\s*clsx\([\s\S]+?pendingDisputes\.length > 0 \? "fc-metric-alert" : "fc-metric-stable",\s*\)\s*\}\s*>\s*<p className="fc-metric-label text-xs tracking-wide font-semibold">\s*unresolved disputes/g,
    `className={clsx(
                      "fc-card rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d24] via-white dark:via-[#161d24] to-[#0f1419] p-4 hover:border-white/20 transition-colors shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between cursor-pointer",
                      pendingDisputes.length > 0 ? "fc-metric-alert" : "fc-metric-stable",
                    )}
                    onClick={() => { setActiveTab("finance"); setTimeout(() => scrollToSection("dispute-claims"), 100); }}
                  >
                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">
                      unresolved disputes`
);

// Add id="dispute-claims" to the dispute section
content = content.replace(
    /<\!-- Module 3B: Dispute Claim Alerts -->\s*\{pendingDisputes\.length > 0 && \(\s*<section className="bg-\[#1a1500\] border border-\[#FBBF24\]\/25/g,
    `{/* Module 3B: Dispute Claim Alerts */}
          {pendingDisputes.length > 0 && (
            <section id="dispute-claims" className="bg-[#1a1500] border border-[#FBBF24]/25`
);

// 4. 2-week risk members
content = content.replace(
    /className=\{\s*clsx\([\s\S]+?highRiskTwoWeekMisses > 0 \? "fc-metric-alert" : "fc-metric-stable",\s*\)\s*\}\s*>\s*<p className="fc-metric-label text-xs tracking-wide font-semibold">\s*2-week risk members/g,
    `className={clsx(
                      "fc-card rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d24] via-white dark:via-[#161d24] to-[#0f1419] p-4 hover:border-white/20 transition-colors shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between cursor-pointer",
                      highRiskTwoWeekMisses > 0 ? "fc-metric-alert" : "fc-metric-stable",
                    )}
                    onClick={() => { setActiveTab("ledger"); setPaymentFilter("Red Zone"); setTimeout(() => scrollToSection("master-ledger"), 100); }}
                  >
                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">
                      2-week risk members`
);

// 5. members paid
content = content.replace(
    />\s*<p\s*className=\{\s*clsx\([\s\S]+?"fc-metric-label text-xs tracking-wide font-semibold"[\s\S]+?\)\s*\}\s*>\s*members paid/g,
    ` onClick={() => { setActiveTab("ledger"); setPaymentFilter("All"); setTimeout(() => scrollToSection("master-ledger"), 100); }} className="cursor-pointer">
                    <p
                      className={clsx(
                        "fc-metric-label text-xs tracking-wide font-semibold",
                        allPayableMembersFunded
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-red-700 dark:text-red-300",
                      )}
                    >
                      members paid`
);

fs.writeFileSync(path, content);
console.log("Patched clicks.");
