import fs from 'fs';
let p = 'src/pages/AdminCommandCenter.tsx';
let txt = fs.readFileSync(p, 'utf8');

const oldCurrent = `const current = (bootstrapData?.events || []).find(
                (event: any) => event.is_current,
              );`;
const newCurrent = `const events = bootstrapData?.events || [];
              const current = events.find((e: any) => e.is_current) || events.find((e: any) => e.is_next);`;

txt = txt.replace(oldCurrent, newCurrent);

const oldCurrent2 = `const currentEvent = (bootstrapData?.events || []).find(
            (event: any) => event.is_current,
          );`;
const newCurrent2 = `const events = bootstrapData?.events || [];
          const currentEvent = events.find((e: any) => e.is_current) || events.find((e: any) => e.is_next);`;
txt = txt.replace(oldCurrent2, newCurrent2);

txt = txt.replace(/GW \$\{currentGwNumber \|\| 1\} ongoing\.\.\./g, 'GW ${currentGwNumber || "??"} ongoing...');

const diagStart = `          {activeTab === "dashboard" && diagnosticsIsAdmin && (
            <section className="fc-card rounded-2xl border border-white/10 bg-[#161d24]/85 p-4 md:p-5">`;

let startIdx = txt.indexOf(diagStart);
if (startIdx !== -1) {
    const nextSection = `          {/* Champion Card:`;
    let endIdx = txt.indexOf(nextSection, startIdx);
    if (endIdx !== -1) {
        const replacement = `          {activeTab === "dashboard" && diagnosticsIsAdmin && (
            <section className="fc-card rounded-xl border border-white/5 bg-[#161d24] p-3 md:p-4 opacity-70 hover:opacity-100 transition-opacity">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Admin Diagnostics
                  </h3>
                  <span
                    className={clsx(
                      "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border block w-max",
                      diagnosticsStatusTone,
                    )}
                  >
                    {diagnosticsStatusLabel}
                  </span>
                </div>
              </div>
              <p className="text-[9px] text-gray-500 mb-2">
                Validate UID mapping before executing financial operations.
              </p>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <div className="border border-white/5 bg-black/20 px-2 py-1 rounded">
                  <span className="text-gray-500 font-bold uppercase tracking-widest mr-1">Auth:</span>
                  <span className="text-gray-300 font-mono">{authUid ? \`•••\${authUid.slice(-6)}\` : "None"}</span>
                </div>
                <div className="border border-white/5 bg-black/20 px-2 py-1 rounded">
                  <span className="text-gray-500 font-bold uppercase tracking-widest mr-1">Chair:</span>
                  <span className="text-gray-300 font-mono">{chairmanId ? \`•••\${chairmanId.slice(-6)}\` : "None"}</span>
                </div>
                <div className="border border-white/5 bg-black/20 px-2 py-1 rounded">
                  <span className="text-gray-500 font-bold uppercase tracking-widest mr-1">Co-Admin:</span>
                  <span className="text-gray-300 font-mono">{coAdminId ? \`•••\${coAdminId.slice(-6)}\` : "None"}</span>
                </div>
                <div className="border border-white/5 bg-black/20 px-2 py-1 rounded flex gap-2">
                  <span className={isChairman ? "text-green-500" : "text-gray-600"}>C: {isChairman ? "Yes" : "No"}</span>
                  <span className={isCoAdmin ? "text-green-500" : "text-gray-600"}>Co: {isCoAdmin ? "Yes" : "No"}</span>
                  <span className={isAdmin ? "text-green-500" : "text-gray-600"}>Admin: {isAdmin ? "Yes" : "No"}</span>
                </div>
              </div>
            </section>
          )}

`;
        txt = txt.substring(0, startIdx) + replacement + txt.substring(endIdx);
    }
}

fs.writeFileSync(p, txt);
console.log("Updated AdminCommandCenter");
