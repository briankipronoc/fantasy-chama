import { BookOpenCheck, Trophy, Users, Settings, DollarSign, Link2, HelpCircle, CheckCircle2, AlertCircle, Zap, Calculator } from 'lucide-react';
import DocLayout from '../layouts/DocLayout';

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
    <DocLayout
      title="Chairman Playbook"
      icon={BookOpenCheck}
      iconColor="text-amber-400"
      iconBg="bg-amber-500/10"
      iconBorder="border-amber-500/20"
      kicker="Your end-to-end operations guide. Run a tight, transparent, zero-drama FPL chama."
    >

      {/* 1 — League Setup */}
      <Section icon={Settings} color="text-amber-400" title="1. League Setup">
        <div className="space-y-4">
          <Step n={1} title="Create your account" desc="Visit fantasy-chama.vercel.app → 'Start a League'. Enter your name, phone, email, and password. Your phone is your login credential and payout remittance identifier." />
          <Step n={2} title="Enter your FPL League ID or Standings Link" desc="Paste your FPL mini-league link or ID (e.g. fantasy.premierleague.com/leagues/XXXXXX/standings/c). The app automatically fetches your league name and imports manager squads." />
          <Step n={3} title="Set the economy & start gameweek" desc="Set your Gameweek Stake (e.g. KES 50), enter the Chairman's POCHI / M-PESA # for incoming funds, and adjust the Weekly Prize vs Grand Vault split ratio. You can launch at GW1 or start mid-season (e.g. GW5) — the app dynamically locks startGw and insulates pre-season rounds." />
          <Step n={4} title="Enroll members & self-onboarding" desc="Sync squads directly from FPL standings, or enter phone numbers. Managers without phone numbers can use the self-onboarding link or shareable 6-digit invite PIN." />
          <Step n={5} title="Assign a Co-Chair (Dual Signatory)" desc="On the Members step, tap '+ Co-Chair' next to any trusted manager. The Co-Chair acts as the second signatory required to approve all prize payouts — the Maker/Checker protocol guarantees zero solo chairman tampering." />
          <Tip>The invite link and WhatsApp share buttons let members join seamlessly. Their phone number becomes their verified wallet and login credential.</Tip>
        </div>
      </Section>

      {/* 2 — Member Management */}
      <Section icon={Users} color="text-blue-400" title="2. Member Management & Modes">
        <div className="space-y-4">
          <Step n={1} title="Edit a member's profile" desc="In Command Center → Ledger tab → find the member → tap ✏️ Edit. Update their display name, M-Pesa phone number, or FPL Team ID. Changes are audited to the Operations Feed." />
          <Step n={2} title="Toggle payment status & Contender vs Spectator" desc="In the Ledger, the toggle switch marks members as Paid (Green Zone) or Unpaid (Red Zone). Members enrolled in Spectator Mode (sidebets_only) are insulated from weekly pot stake auto-deductions and debt penalties, while remaining fully active for 1v1 side bets." />
          <Step n={3} title="Fund a wallet manually" desc="In Ledger → tap 'Fund Wallet' → select the member → enter amount and method (M-Pesa or cash). This credits their wallet without requiring an STK push." />
          <Step n={4} title="Deduplication & clean rosters" desc="The Master Ledger automatically deduplicates members across phone numbers and team entries, guaranteeing that headcounts and collected totals reflect exact unique participants." />
          <Warn>Changing a member's phone number changes their login credential. Always confirm with the member before modifying phone numbers.</Warn>
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
          <Tip>For new leagues: add all FPL Team IDs before GW resolution so the winner detection works immediately on day one.</Tip>
          <div className="bg-[#0b1014] border border-white/10 rounded-xl p-4 font-mono text-xs text-gray-400">
            <p className="text-gray-500 mb-1">Example FPL URL:</p>
            <p>fantasy.premierleague.com/entry/<span className="text-amber-400">1234567</span>/event/38</p>
            <p className="text-gray-500 mt-2">FPL Team ID = <span className="text-amber-400 font-black">1234567</span></p>
          </div>
        </div>
      </Section>

      {/* 4 — Mid-Season Fair Buy-In Calculator */}
      <Section icon={Calculator} color="text-blue-400" title="4. Mid-Season Fair Buy-In Calculator">
        <div className="space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            When a new manager wants to join your Chama at Gameweek 10 or 15, existing members often worry the Season Vault will be unfairly diluted. FantasyChama solves this with our <strong>Fair Entry Formula</strong>:
          </p>
          <div className="bg-[#0b1014] border border-blue-500/30 rounded-2xl p-4 font-mono text-xs text-blue-300 space-y-1">
            <p className="font-bold text-white">Fair Entry Formula:</p>
            <p className="text-amber-400 font-black">Buy-In = (Current GW - Start GW) × Gameweek Stake × Vault % + First GW Stake</p>
          </div>
          <Step n={1} title="Open the Buy-In Calculator" desc="In Command Center → header toolbar or Ledger tab → tap 'Buy-In Calc 🧮'. The modal auto-populates your league stake, start gameweek, and vault ratio." />
          <Step n={2} title="Pick the Join Gameweek" desc="Select which GW the new manager will begin playing (e.g. GW10). The calculator immediately splits the amount into Backdated Vault Equity and First Active Round Stake." />
          <Step n={3} title="1-Tap WhatsApp Invoice" desc="Tap 'Share Invoice to WhatsApp'. A pre-formatted, transparent breakdown with payment instructions and your M-Pesa/Pochi number is ready to send to the recruit." />
          <Step n={4} title="Activate their spot" desc="Once they send the buy-in, fund their wallet or mark them active. The backdated portion secures their season vault stake without stealing a single shilling from founding members." />
          <Tip>No more arguments over late joiners. The math guarantees 100% equity for veteran members who paid from round one.</Tip>
        </div>
      </Section>

      {/* 5 — GW Operations & Banter Slip */}
      <Section icon={Trophy} color="text-[#FBBF24]" title="5. Gameweek Operations & WhatsApp Banter Slip">
        <div className="space-y-4">
          <Step n={1} title="Wait for FPL GW to finish" desc="The 'Resolve & Payout' button unlocks after FPL marks the GW as finished and points are finalized. Do not resolve prematurely." />
          <Step n={2} title="Initiate resolution" desc="Command Center → Dashboard → tap 'Resolve & Payout'. This deducts GW stakes from funded wallets and pushes a pending payout ticket to the Co-Chair's queue." />
          <Step n={3} title="Co-Chair approves" desc="The Co-Chair inspects the winner + amount in their dashboard → taps 'Approve & Pay'. Daraja B2C fires to the winner's M-Pesa, or cash handoff is logged." />
          <Step n={4} title="Generate Chama WhatsApp Banter Slip" desc="Immediately after resolution, tap 'Banter Slip 🔥'. Choose your roast heat level (Mild Chai ☕, Proper Roast 🔥, or Nuclear Matusi ☢️). The system auto-generates your group's matchday summary with King of the Week, Mtu wa Chini (Wooden Spoon), Benched Regret, and Red Zone debtors." />
          <Step n={5} title="1-Tap WhatsApp Paste" desc="Tap 'Copy Banter Slip' and paste directly into your WhatsApp group. No typing, no manual point tallying, instant Kenyan football banter!" />
          <Warn>Never resolve the same GW twice. If the button re-appears after resolution, check pending_payouts in the operations feed before clicking again.</Warn>
        </div>
      </Section>

      {/* 6 — Finance, Reversals & Clean Slate */}
      <Section icon={DollarSign} color="text-emerald-400" title="6. Finance, Reversals & Clean Slate Alignment">
        <div className="space-y-4">
          <Step n={1} title="Universal Dynamic GW Start" desc="Whether your league starts at GW1 or GW5, the accounting engine automatically anchors calculations to your league's startGw. Pre-season test rounds are insulated and never produce false arrears." />
          <Step n={2} title="Reversal & Refund Netting" desc="If test stakes or accidental deposits are reversed, the ledger applies effectiveWallet = max(0, wallet - refunds). Master collected amounts strictly reflect net funded cash (e.g. exactly KES 350 for 7 players @ KES 50)." />
          <Step n={3} title="Monthly HQ settlement" desc="FantasyChama charges a platform fee per GW (3.5% of gross pot). This accrues monthly. Pay via Pochi La Biashara to the HQ number shown in Finance → submit the M-Pesa receipt code." />
          <Step n={4} title="Stealth Mode" desc="Toggle 'Stealth Mode' (eye icon on the header) to hide all KES values when screensharing or checking standings in public." />
          <Tip>Export the full ledger as CSV from the Ledger tab footer → 'Export Audit CSV'. Share with members monthly for complete financial transparency.</Tip>
        </div>
      </Section>

      {/* 7 — Troubleshooting */}
      <Section icon={HelpCircle} color="text-gray-400" title="7. Troubleshooting & FAQs">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold text-white mb-1">Pre-season test rounds showing up in ledger?</p>
            <p className="text-sm text-gray-400">All pre-season test payouts prior to your league's official startGw are insulated and excluded from active member balances and collected pot calculations.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">Member can't log in?</p>
            <p className="text-sm text-gray-400">Verify their phone number is correct in the Ledger (✏️ Edit). Their phone + league name combination is their login credential. If changed, they need to re-login.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">WhatsApp link shows 404?</p>
            <p className="text-sm text-gray-400">The correct domain is <strong>fantasy-chama.vercel.app</strong>. Share this URL directly: <code className="text-amber-400 bg-black/30 px-1.5 py-0.5 rounded">https://fantasy-chama.vercel.app/invite</code></p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">FPL winner not auto-detected?</p>
            <p className="text-sm text-gray-400">Check that all members have their FPL Team ID linked (Section 3 above). The winner card uses real-time standings from the FPL API and requires valid IDs.</p>
          </div>
          <Warn>The Resolve button is only available when FPL marks the GW as finished. Do not attempt to force-resolve using browser dev tools or admin overrides.</Warn>
          <div className="flex gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5">
            <Zap className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">For critical issues or custom treasury configurations, contact FantasyChama HQ directly from your Chairman console.</p>
          </div>
        </div>
      </Section>

    </DocLayout>
  );
}
