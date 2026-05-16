import { Link } from 'react-router-dom';
import { BookOpenCheck, ChevronLeft, Trophy, Users, Settings, DollarSign, Link2, HelpCircle, ShieldCheck, AlertTriangle, CheckCircle2, AlertCircle, Zap } from 'lucide-react';

const Section = ({ icon: Icon, color, title, children }: any) => (
  <section className="rounded-3xl border border-white/10 bg-[#161d24] p-6 md:p-8 space-y-4">
    <h2 className="text-xl font-black text-white flex items-center gap-3">
      <Icon className={`w-5 h-5 ${color}`} />
      {title}
    </h2>
    {children}
  </section>
);

const Step = ({ n, title, desc }: { n: number; title: string; desc: string }) => (
  <div className="flex gap-4">
    <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{n}</div>
    <div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-sm text-gray-400 leading-relaxed mt-0.5">{desc}</p>
    </div>
  </div>
);

const Tip = ({ children }: any) => (
  <div className="flex gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
    <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-gray-300 leading-relaxed">{children}</p>
  </div>
);

const Warn = ({ children }: any) => (
  <div className="flex gap-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3.5">
    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-gray-300 leading-relaxed">{children}</p>
  </div>
);

export default function ChairmanManual() {
  return (
    <div className="min-h-screen bg-[#0d1316] text-white p-4 md:p-10 font-sans max-w-3xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <BookOpenCheck className="w-7 h-7 text-amber-300" /> Chairman Playbook
        </h1>
        <Link to="/rules" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-amber-300 hover:text-amber-200">
          <ChevronLeft className="w-3 h-3" /> Back
        </Link>
      </div>

      <p className="text-sm text-gray-400">Your end-to-end operations guide. Run a tight, transparent, zero-drama FPL chama.</p>

      {/* 1 — League Setup */}
      <Section icon={Settings} color="text-amber-400" title="1. League Setup">
        <div className="space-y-4">
          <Step n={1} title="Create your account" desc="Visit fantasychama.vercel.app → 'Start a League'. Enter your name, phone, email, and a strong password. Your phone is your login and payout destination." />
          <Step n={2} title="Enter your FPL League ID" desc="Find this in your FPL mini-league URL: fantasy.premierleague.com/leagues/XXXXXX/standings/c — paste the number. The app auto-fetches the league name and member standings." />
          <Step n={3} title="Set the economy" desc="Choose your GW stake, pot split (default 60% weekly / 40% season vault), and season winner distribution. Use the slider — it recalculates live." />
          <Step n={4} title="Enroll members" desc="Use 'Import from FPL' to bulk-add members from your FPL standings, or add them manually. You can also give members the 6-digit invite PIN to self-enroll via the invite link." />
          <Step n={5} title="Assign a Co-Chair" desc="On the Members step, tap any member and select 'Set as Co-Chair'. The Co-Chair approves all payouts — the Maker/Checker protocol prevents solo chairman fraud." />
          <Tip>The invite PIN is shareable via WhatsApp. Members click the link, enter the PIN, and self-enroll. Their phone number becomes their login credential.</Tip>
        </div>
      </Section>

      {/* 2 — Member Management */}
      <Section icon={Users} color="text-blue-400" title="2. Member Management">
        <div className="space-y-4">
          <Step n={1} title="Edit a member's profile" desc="In Command Center → Ledger tab → find the member → tap ✏️ Edit. Update their display name, M-Pesa phone number, or FPL Team ID. Changes are audited to the Operations Feed." />
          <Step n={2} title="Toggle payment status" desc="In the Ledger, the toggle switch on the right of each member row marks them as Paid (Green Zone) or Unpaid (Red Zone). Use this for manual cash top-ups." />
          <Step n={3} title="Remove or deactivate a member" desc="Contact FantasyChama HQ for permanent removal. For temporary deactivation, mark them inactive from the member profile (future feature)." />
          <Step n={4} title="Fund a wallet manually" desc="In Ledger → tap 'Fund Wallet' → select the member → enter amount and method (M-Pesa or cash). This credits their wallet without STK push." />
          <Warn>Changing a member's phone number is a sensitive action — it changes their login credential. Always double-check before saving, as changes are irreversible without contacting the member.</Warn>
        </div>
      </Section>

      {/* 3 — Tying Phone to FPL Team */}
      <Section icon={Link2} color="text-emerald-400" title="3. How to Link a Phone to an FPL Team">
        <div className="space-y-4">
          <p className="text-sm text-gray-400 leading-relaxed">
            Every member needs their FPL Team ID linked so the app can track their weekly points and identify the winner. Here's how:
          </p>
          <Step n={1} title="Ask the member for their FPL Team URL" desc="They open FPL on browser → click their team → look at the URL: fantasy.premierleague.com/entry/1234567/event/38 — the number is their Team ID." />
          <Step n={2} title="Edit the member profile" desc="In Command Center → Ledger → ✏️ Edit next to their name → paste the FPL Team ID number into the FPL Team ID field → Save." />
          <Step n={3} title="Self-service alternative" desc="Members can also add it themselves: Dashboard → Profile → Edit Profile → FPL Team ID field. If they have dual teams (e.g. second FPL account), they can add a second FPL Team ID too." />
          <Step n={4} title="Verify it's correct" desc="Check Standings tab — if their name appears with points, the link is working. If they show 0 or no data, double-check the Team ID." />
          <Tip>For new leagues: add all FPL Team IDs before GW1 resolution so the winner detection works on day one. You can bulk-import from FPL standings during setup (Step 3 of the wizard).</Tip>
          <div className="bg-[#0b1014] border border-white/10 rounded-xl p-4 font-mono text-xs text-gray-400">
            <p className="text-gray-500 mb-1">Example FPL URL:</p>
            <p>fantasy.premierleague.com/entry/<span className="text-amber-400">1234567</span>/event/38</p>
            <p className="text-gray-500 mt-2">FPL Team ID = <span className="text-amber-400 font-black">1234567</span></p>
          </div>
        </div>
      </Section>

      {/* 4 — GW Operations */}
      <Section icon={Trophy} color="text-[#FBBF24]" title="4. Gameweek Operations">
        <div className="space-y-4">
          <Step n={1} title="Wait for FPL GW to finish" desc="The 'Resolve & Payout' button only unlocks after FPL marks the GW as finished and the winner card shows 'GW Final'. Do not resolve prematurely." />
          <Step n={2} title="Initiate resolution" desc="Command Center → Dashboard → tap 'Resolve & Payout'. This deducts GW stakes from all wallets and creates a pending payout in the Co-Chair's queue." />
          <Step n={3} title="Co-Chair approves" desc="The Co-Chair sees the payout in their dashboard (or the Members tab). They review winner + amount → tap 'Approve & Pay'. The Daraja B2C fires to the winner's M-Pesa." />
          <Step n={4} title="Send WhatsApp receipt" desc="After resolution, the dashboard shows a WhatsApp share button. Tap it to send a pre-formatted winner announcement to your group — includes name, points, amount." />
          <Step n={5} title="Winner confirms" desc="The winner sees a banner on their dashboard to 'Confirm Receipt'. They tap it to close the cycle." />
          <Warn>Never resolve the same GW twice. If the button re-appears after resolution, check pending_payouts in the feed before clicking again.</Warn>
        </div>
      </Section>

      {/* 5 — Finance */}
      <Section icon={DollarSign} color="text-emerald-400" title="5. Finance & HQ Settlement">
        <div className="space-y-4">
          <Step n={1} title="Monthly HQ settlement" desc="FantasyChama charges a platform fee per GW (3.5% of gross pot). This accrues monthly. The Finance tab shows your outstanding HQ balance." />
          <Step n={2} title="Settling HQ dues" desc="Pay via Pochi La Biashara to the HQ number shown → enter the M-Pesa receipt code in the settlement form → submit. The suspension warning clears within minutes." />
          <Step n={3} title="Stealth Mode" desc="Toggle 'Stealth Mode' (eye icon on the header) to hide all KES values. Useful for screensharing or in public spaces." />
          <Step n={4} title="Season Vault trajectory" desc="The vault card shows projected end-of-season prize pool based on remaining GWs (automatically calculated from when your league started, so mid-season leagues are handled correctly)." />
          <Tip>Export the full ledger as CSV from the Ledger tab footer → 'Export Audit CSV'. Share with members monthly for full transparency.</Tip>
        </div>
      </Section>

      {/* 6 — Troubleshooting */}
      <Section icon={HelpCircle} color="text-gray-400" title="6. Troubleshooting">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold text-white mb-1">Prefund or Top-Up modal freezes?</p>
            <p className="text-sm text-gray-400">This was a known browser paint issue — it has been fixed as of the latest release. If it persists, tap elsewhere on screen once to trigger the render.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">Backend cold start (Render free tier)?</p>
            <p className="text-sm text-gray-400">The backend may take 30–60 seconds to wake up on first load. If an API call fails, wait and retry. The Render dashboard shows deploy status.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">Member can't log in?</p>
            <p className="text-sm text-gray-400">Verify their phone number is correct in the Ledger (✏️ Edit). Their phone + league name combination is their login credential. If changed, they need to re-login.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">WhatsApp link shows 404?</p>
            <p className="text-sm text-gray-400">The correct domain is <strong>fantasychama.vercel.app</strong> (no dash). Share this URL directly: <code className="text-amber-400 bg-black/30 px-1.5 py-0.5 rounded">https://fantasychama.vercel.app/invite</code></p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">FPL winner not auto-detected?</p>
            <p className="text-sm text-gray-400">Check that all members have their FPL Team ID linked (Section 3 above). The winner card uses real-time standings from the FPL API — it needs team IDs to match members.</p>
          </div>
          <Warn>The Resolve button is only available when FPL marks the GW as finished. Do not attempt to force-resolve using browser dev tools or admin overrides.</Warn>
          <div className="flex gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5">
            <Zap className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">For critical issues, contact FantasyChama HQ from the HQ panel or via the platform admin email.</p>
          </div>
        </div>
      </Section>

      <div className="text-center pt-4">
        <Link to="/faq" className="text-xs font-bold text-amber-400 underline underline-offset-2 hover:text-amber-300">More in FAQ →</Link>
      </div>
    </div>
  );
}
