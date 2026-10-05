import { BookOpen, Banknote, Trophy, BarChart3, AlertCircle, CheckCircle2, Star, HelpCircle } from 'lucide-react';
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
    <DocLayout
      title="Member Guide"
      icon={BookOpen}
      iconColor="text-emerald-400"
      iconBg="bg-emerald-500/10"
      iconBorder="border-emerald-500/20"
      kicker="Everything you need to stay in the Green Zone, win payouts, challenge friends in side bets, and understand how your league works."
    >

      {/* 1 — Getting Started */}
      <Section icon={Star} color="text-emerald-400" title="1. Getting Started & Player Modes">
        <div className="space-y-4">
          <Step n={1} title="Accept your invite" desc="Your Chairman sends a 6-digit invite PIN or share link via WhatsApp. Open the link, enter the PIN, and fill in your display name and M-Pesa number." />
          <Step n={2} title="Link your FPL Team" desc="Go to Profile → tap 'Edit Profile' → paste your FPL Team ID (found in the URL of your FPL team page: fantasy.premierleague.com/entry/XXXXXX). This is how the app tracks your weekly points." />
          <Step n={3} title="Choose your participation mode" desc="Contenders fund their wallet to compete for weekly pots and the Grand Season Vault. Spectators can follow the league for free, view live standings, and participate exclusively in 1v1 head-to-head Side Bets without pot stake auto-deductions." />
          <Step n={4} title="Sign the constitution" desc="On first login you'll see the league constitution. Scroll to the bottom and tap 'I Accept — Enter League'. You cannot access the app until you accept." />
          <Tip>Your wallet can hold enough for multiple gameweeks. Top up early and don't worry about deadlines — your GW stake is auto-deducted when the Chairman resolves each round.</Tip>
        </div>
      </Section>

      {/* 2 — Payments */}
      <Section icon={Banknote} color="text-[#FBBF24]" title="2. Payments & Wallet Management">
        <div className="space-y-4">
          <Step n={1} title="M-Pesa STK Push" desc="Tap 'Pay via M-Pesa' → you'll receive a prompt on your phone automatically. Enter your M-Pesa PIN. Your wallet is credited instantly on confirmation." />
          <Step n={2} title="Pochi La Biashara (manual)" desc="Send the stake amount via Pochi La Biashara to the Chairman's number (shown on your dashboard). Then tap 'Already paid? Verify →' and enter your M-Pesa receipt code." />
          <Step n={3} title="Mid-Season Fair Buy-Ins" desc="Joining late at GW10 or GW15? Your Chairman will generate a Fair Buy-In invoice using the algorithmic formula. Once paid, the backdated vault portion locks in your equity for the Season Finale." />
          <Step n={4} title="Reversal & refund reconciliation" desc="If an accidental transfer or test deposit is refunded, the ledger automatically adjusts your net balance so arrears and available rounds stay 100% accurate." />
          <Warn>Missing a gameweek payment (Red Zone) for 2 consecutive GWs may result in suspension from that GW's pot. Stay funded in the Green Zone!</Warn>
          <Tip>Top up for 3–4 GWs at once to avoid last-minute scrambles. Your wallet balance rolls over seamlessly.</Tip>
        </div>
      </Section>

      {/* 3 — Dashboard & Standings */}
      <Section icon={BarChart3} color="text-blue-400" title="3. Your Dashboard & Standings">
        <div className="space-y-4">
          <Step n={1} title="GW Status card" desc="Shows if you're 'Verified & Active' (Green Zone) or 'Action Required' (Red Zone). When you win the round, this turns gold." />
          <Step n={2} title="GW Standings card" desc="Live FPL rankings for your league's current gameweek. Your rank is highlighted in a gold pill at the top with medals for top 3." />
          <Step n={3} title="Vault & Weekly Pot" desc="The top card shows the live weekly pot (this GW's prize) and the projected season vault (accumulated across all rounds). The vault split is set by your Chairman." />
          <Step n={4} title="Live Escrow Feed" desc="Real-time log of all league events — payments, resolutions, and admin actions. Completely transparent and tamper-proof." />
          <Step n={5} title="1v1 Side Bets Arena" desc="Challenge any rival manager to a head-to-head cash duel. Escrow locks both stakes and automatically disburses the winnings to the victor at 90 minutes." />
        </div>
      </Section>

      {/* 4 — Winning, Victory Cards & Banter Slip */}
      <Section icon={Trophy} color="text-[#FBBF24]" title="4. Winning, WhatsApp Banter & Victory Cards">
        <div className="space-y-4">
          <Step n={1} title="Score highest FPL points in your league" desc="The winner is the member with the highest net GW total (transfers hits deducted). If there's a tie, the prize is split equally." />
          <Step n={2} title="Chairman resolves the GW" desc="After FPL marks the round finished, the Chairman initiates resolution. The Co-Chair countersigns, and the Daraja B2C payment fires to your registered M-Pesa." />
          <Step n={3} title="WhatsApp Victory Card" desc="Tap 'Share My Win' on your dashboard to generate a custom, verified Victory Card with your score and payout. Post directly to your WhatsApp Status to flex on your rivals!" />
          <Step n={4} title="Chama WhatsApp Banter Slip" desc="The Chairman posts the official Banter Slip directly to your WhatsApp group immediately after each GW closes. Check if you're King of the Week 👑, took the Wooden Spoon 🥔, or got roasted for leaving 18 points on the bench 🤦!" />
          <Step n={5} title="Confirm receipt" desc="Tap 'Confirm Receipt ✓' on your payout card to close the cycle and audit the transaction on the public ledger." />
          <Tip>In Pilot Phase, 98.5% of the gross pot goes directly to members! The platform fee is 0% (waived), with only 1.5% network fee for M-Pesa.</Tip>
        </div>
      </Section>

      {/* 5 — Troubleshooting */}
      <Section icon={HelpCircle} color="text-gray-400" title="5. Troubleshooting & FAQs">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold text-white mb-1">Still showing Red Zone after paying?</p>
            <p className="text-sm text-gray-400">Tap 'Already paid? Verify →' and enter your M-Pesa receipt code. If still not resolved, share the code with your Chairman to manually verify in the ledger.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">FPL team not linking?</p>
            <p className="text-sm text-gray-400">Go to Profile and make sure your FPL Team ID is correct — it's the number in the URL when you view your FPL team on fantasy.premierleague.com/entry/XXXXXX/event/XX.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">Shared link shows 404?</p>
            <p className="text-sm text-gray-400">The correct app URL is <strong>fantasy-chama.vercel.app</strong>. Ask your Chairman for the latest invite link.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-1">Can't see your payout banner?</p>
            <p className="text-sm text-gray-400">Refresh the dashboard. Payout notifications arrive via the real-time Firestore feed. Enable browser push notifications for instant alerts.</p>
          </div>
          <Warn>Never share your account credentials. Your M-Pesa number is your login identifier — only the Chairman can update it via the Command Center.</Warn>
        </div>
      </Section>

    </DocLayout>
  );
}
