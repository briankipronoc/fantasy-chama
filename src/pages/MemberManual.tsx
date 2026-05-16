import { Link } from 'react-router-dom';
import { BookOpen, ChevronLeft, Banknote, Trophy, BarChart3, AlertCircle, Smartphone, Wallet, CheckCircle2, Star, HelpCircle } from 'lucide-react';

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
    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{n}</div>
    <div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-sm text-gray-400 leading-relaxed mt-0.5">{desc}</p>
    </div>
  </div>
);

const Tip = ({ children }: any) => (
  <div className="flex gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5">
    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-gray-300 leading-relaxed">{children}</p>
  </div>
);

const Warn = ({ children }: any) => (
  <div className="flex gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-gray-300 leading-relaxed">{children}</p>
  </div>
);

export default function MemberManual() {
  return (
    <div className="min-h-screen bg-[#0d1316] text-white p-4 md:p-10 font-sans max-w-3xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-emerald-400" /> Member Guide
        </h1>
        <Link to="/rules" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-emerald-300 hover:text-emerald-200">
          <ChevronLeft className="w-3 h-3" /> Back
        </Link>
      </div>

      <p className="text-sm text-gray-400">Everything you need to stay in the Green Zone, win payouts, and understand how your league works.</p>

      {/* 1 — Getting Started */}
      <Section icon={Star} color="text-emerald-400" title="1. Getting Started">
        <div className="space-y-4">
          <Step n={1} title="Accept your invite" desc="Your Chairman sends a 6-digit invite PIN via WhatsApp. Open the link, enter the PIN, and fill in your display name and M-Pesa number." />
          <Step n={2} title="Link your FPL Team" desc="Go to Profile → tap 'Edit Profile' → paste your FPL Team ID (found in the URL of your FPL team page: fantasy.premierleague.com/entry/XXXXXX). This is how the app tracks your weekly points." />
          <Step n={3} title="Sign the constitution" desc="On first login you'll see the league constitution. Scroll to the bottom and tap 'I Accept — Enter the War Room'. You cannot access the app until you accept." />
          <Step n={4} title="Fund your wallet" desc="Tap 'Top Up Wallet' or 'Pay via M-Pesa' at the bottom of your dashboard. A KES prompt is sent to your phone — enter your M-Pesa PIN to complete." />
          <Tip>Your wallet can hold enough for multiple gameweeks. Top up early and don't worry about deadlines — your GW stake is auto-deducted when the Chairman resolves each gameweek.</Tip>
        </div>
      </Section>

      {/* 2 — Payments */}
      <Section icon={Banknote} color="text-[#FBBF24]" title="2. Payments & Wallet">
        <div className="space-y-4">
          <Step n={1} title="M-Pesa STK Push" desc="Tap 'Pay via M-Pesa' → you'll receive a prompt on your phone automatically. Enter your M-Pesa PIN. Your wallet is credited instantly on confirmation." />
          <Step n={2} title="Pochi La Biashara (manual)" desc="Send the stake amount via Pochi La Biashara to the Chairman's number (shown on your dashboard). Then tap 'Already paid? Verify →' and enter your M-Pesa receipt code." />
          <Step n={3} title="Check wallet balance" desc="Your wallet balance is shown on the dashboard. The green/yellow number tells you how many GWs your current balance covers." />
          <Step n={4} title="Request wallet credit" desc="If the Chairman manually credited your account (e.g. from winnings), it may appear as a 'Request Wallet Credit' from your pending payout. Tap it to confirm." />
          <Warn>Missing a gameweek payment (Red Zone) for 2 consecutive GWs may result in suspension from that GW's pot. Stay funded!</Warn>
          <Tip>Top up for 3–4 GWs at once to avoid last-minute scrambles. Your wallet carries over between gameweeks.</Tip>
        </div>
      </Section>

      {/* 3 — Dashboard */}
      <Section icon={BarChart3} color="text-blue-400" title="3. Your Dashboard">
        <div className="space-y-4">
          <Step n={1} title="GW Status card" desc="Shows if you're 'Verified & Active' (Green Zone) or 'Action Required' (Red Zone). When you win, this turns gold." />
          <Step n={2} title="GW Standings card" desc="Live FPL rankings for your league's current gameweek. Your rank is highlighted in a gold pill at the top. Shows 🥇🥈🥉 for top 3." />
          <Step n={3} title="Vault & Weekly Pot" desc="The top card shows the live weekly pot (this GW's prize) and the projected season vault (accumulated across all GWs). The vault split is set by your Chairman." />
          <Step n={4} title="Live Escrow Feed" desc="Real-time log of all league events — payments, resolutions, and admin actions. Transparent and tamper-proof." />
          <Step n={5} title="Last 3 Payouts" desc="Shows recent payout history with winner name and amount for transparency." />
          <Tip>Tap Standings in the nav to see the full season leaderboard and performance trajectory chart.</Tip>
        </div>
      </Section>

      {/* 4 — Winning */}
      <Section icon={Trophy} color="text-[#FBBF24]" title="4. Winning Your GW Payout">
        <div className="space-y-4">
          <Step n={1} title="Score the highest FPL points in your league" desc="The winner is the member with the highest GW total. If there's a tie, the FPL tiebreaker applies (bench boost etc)." />
          <Step n={2} title="Chairman resolves the GW" desc="After FPL marks the GW as finished, your Chairman clicks Resolve. The system triggers a Co-Chair approval and then dispatches your payout via M-Pesa." />
          <Step n={3} title="You receive M-Pesa confirmation" desc="Safaricom sends an SMS: 'You have received KES X from...' — your dashboard also shows a golden 'Champion of the Week' banner." />
          <Step n={4} title="Confirm receipt" desc="Tap 'Confirm Receipt ✓' on the payout notification card in your dashboard. This closes the payout cycle and updates the ledger." />
          <Step n={5} title="Request wallet credit instead" desc="If you prefer to keep the winnings inside your FantasyChama wallet (to cover future GWs), tap 'Request Wallet Credit' instead." />
          <Tip>You win 91% of the total pot. The other 9% covers the Chairman's governance fee, FantasyChama platform fee, and M-Pesa network processing.</Tip>
        </div>
      </Section>

      {/* 5 — Troubleshooting */}
      <Section icon={HelpCircle} color="text-gray-400" title="5. Troubleshooting">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold text-white mb-1">Still showing Red Zone after paying?</p>
            <p className="text-sm text-gray-400">Tap 'Already paid? Verify →' and enter your M-Pesa receipt code. If still not resolved, share the code with your Chairman to manually verify.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">FPL team not linking?</p>
            <p className="text-sm text-gray-400">Go to Profile and make sure your FPL Team ID is correct — it's the number in the URL when you view your FPL team on fantasy.premierleague.com/entry/XXXXXX/event/XX.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">Shared link shows 404?</p>
            <p className="text-sm text-gray-400">The correct app URL is <strong>fantasychama.vercel.app</strong>. Old links to fantasy-chama.vercel.app may redirect. Ask your Chairman for the latest invite link.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">Can't see your payout banner?</p>
            <p className="text-sm text-gray-400">Refresh the dashboard. Payout notifications come via FCM push and the Firestore real-time feed. Enable browser notifications for instant alerts.</p>
          </div>
          <Warn>Never share your account credentials. Your M-Pesa number is your login identifier — only the Chairman can update it via the Command Center.</Warn>
        </div>
      </Section>

      <div className="text-center pt-4">
        <Link to="/faq" className="text-xs font-bold text-emerald-400 underline underline-offset-2 hover:text-emerald-300">More in FAQ →</Link>
      </div>
    </div>
  );
}
