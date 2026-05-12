import fs from 'fs';
let adminPath = 'src/pages/AdminCommandCenter.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');

// Remove Open Red Zone and "GW ongoing" button cluster that duplicates everything
// Oh wait, the Resolve Gameweek cluster is important, it's NOT redundant, just "Open Red Zone" is.
const openRedZoneButton = `<button
                    onClick={() => {
                      setActiveTab("ledger");
                      setPaymentFilter("Red Zone");
                    }}
                    className="min-w-[200px] px-4 py-2.5 rounded-xl border border-red-500/40 bg-red-500/85 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-colors text-center"
                  >
                    Open Red Zone
                  </button>`;

adminContent = adminContent.replace(openRedZoneButton, "");

fs.writeFileSync(adminPath, adminContent);
console.log("Admin clutter fixed.");
