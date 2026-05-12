import sys
with open('src/pages/AdminCommandCenter.tsx', 'r') as f:
    text = f.read()

import re

# Redesign diagnostics block to collapsible `<details>`
new_block = """<details className="fc-card rounded-2xl border border-white/5 bg-[#161d24]/50 p-4 md:p-5 group cursor-pointer transition-all hover:bg-[#161d24]/70">
              <summary className="flex items-center justify-between outline-none">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors">
                  System Health Status
                </h3>
                <span
                  className={clsx(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
                    diagnosticsStatusTone,
                  )}
                >
                  {diagnosticsStatusLabel}
                </span>
              </summary>
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[11px] text-gray-400 mb-4 max-w-3xl">
                  Run diagnostics checks before wallet funding, pilot prefund, payment toggles, and GW resolution. These checks confirm your current session strictly maps to correct Chairman/Co-Chair permissions in Firebase.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">My UID</p>
                    <p className="text-gray-300 font-mono">{authUid ? `•••${authUid.slice(-6)}` : "None"}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Chairman</p>
                    <p className="text-gray-300 font-mono">{chairmanId ? `•••${chairmanId.slice(-6)}` : "None"}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Co-Chair</p>
                    <p className="text-gray-300 font-mono">{coAdminId ? `•••${coAdminId.slice(-6)}` : "None"}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Role</p>
                    <div className="flex gap-2">
                       {diagnosticsIsCoAdmin && <span className="text-emerald-500 text-[10px] font-bold uppercase">Co-Chair</span>}
                       {diagnosticsIsChairman && <span className="text-amber-500 text-[10px] font-bold uppercase">Chair</span>}
                       {!diagnosticsIsCoAdmin && !diagnosticsIsChairman && <span className="text-gray-500 text-[10px] font-bold uppercase">None</span>}
                    </div>
                  </div>
                </div>
              </div>
            </details>"""

text = re.sub(r'<section className="fc-card rounded-2xl border border-white/10 bg-\[#161d24\]/85 p-4 md:p-5">.*?Admin Diagnostics.*?</section>', new_block, text, flags=re.DOTALL)
with open('src/pages/AdminCommandCenter.tsx', 'w') as f:
    f.write(text)
