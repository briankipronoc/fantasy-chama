import { ShieldCheck, CheckCircle2, AlertCircle, Trophy, DollarSign, FileText, Zap } from 'lucide-react';
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
  <div className="flex gap-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3.5">
    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-gray-300 leading-relaxed">{children}</p>
  </div>
);

export default function CoChairManual() {
  return (
    <DocLayout
      title="Co-Chair Manual"
      icon={ShieldCheck}
      iconColor="text-emerald-400"
      iconBg="bg-emerald-500/10"
      iconBorder="border-emerald-500/20"
      kicker="Dual-signatory governance, payout verification protocols, and anti-fraud oversight."
    >

      {/* 1 — The Co-Chair Role */}
      <Section icon={ShieldCheck} color="text-emerald-400" title="1. The Dual-Signatory Mandate">
        <div className="space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            As Co-Chair, you hold the second signatory key to your league's treasury. Fantasy Chama utilizes an institutional 
            <strong> Maker/Checker protocol</strong>: the Chairman initiates actions (the Maker), but no money leaves the vault 
            or reaches a winner without your explicit countersignature (the Checker).
          </p>
          <Step 
            n={1} 
            title="Zero Solo Tampering" 
            desc="The Chairman cannot unilaterally disburse funds to their personal M-Pesa account, alter winning scores, or bypass pot allocations. Every payout requires dual authorization." 
          />
          <Step 
            n={2} 
            title="Independent Verification" 
            desc="You represent the members' collective interest. Your role is to cross-verify weekly FPL points, ensure transfer hits are factored in, and verify the beneficiary's registered phone number before approving." 
          />
          <Step 
            n={3} 
            title="Immutable Ledger Accountability" 
            desc="Every approval or rejection you make is permanently cryptographically recorded in the Operations Feed and exported audit logs with timestamps and your user signature." 
          />
          <Tip>You can play in the league as a regular manager while serving as Co-Chair. If you win a Gameweek, standard dual-signatory rules still apply: the Chairman initiates, and you confirm receipt.</Tip>
        </div>
      </Section>

      {/* 2 — Payout Verification Protocol */}
      <Section icon={Trophy} color="text-amber-400" title="2. Payout Verification Protocol">
        <div className="space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            When the Chairman clicks <em>'Resolve &amp; Payout'</em> at the conclusion of a Gameweek, a pending disbursement ticket 
            appears in your Approval Queue. Always follow this 4-step checklist:
          </p>
          <Step 
            n={1} 
            title="Verify Net FPL Score" 
            desc="Open official FPL standings. Confirm the candidate's net GW score matches the app. Remember: Net Points = Gross Gameweek Points minus Transfer Cost (Hits). Fantasy Chama auto-deducts hits, but check for manual disputes." 
          />
          <Step 
            n={2} 
            title="Confirm Beneficiary Phone Number" 
            desc="Inspect the M-Pesa phone number listed on the payout card. It must match the registered Chama phone number on the winner's ledger profile. Never approve payouts to third-party or reassigned numbers without unanimous committee consent." 
          />
          <Step 
            n={3} 
            title="Audit Pot Math & Split" 
            desc="Review the KES amount. For example, in a 10-member league at KES 50/GW with 70/30 split: Gross pot = KES 500. Weekly payout = KES 350 (minus 1.5% M-Pesa fee), Grand Vault deposit = KES 150." 
          />
          <Step 
            n={4} 
            title="Check for Ties" 
            desc="If two managers scored identical net points, the league constitution mandates equal split of that week's prize pool. Verify that both managers are included in the split disbursement." 
          />
          <Warn>Never tap 'Approve & Pay' while FPL matches are still live. Wait until the Premier League marks the Gameweek as 'Final' and bonus points have been fully applied.</Warn>
        </div>
      </Section>

      {/* 3 — Disbursement Execution Modes */}
      <Section icon={DollarSign} color="text-emerald-400" title="3. Disbursement Execution Modes">
        <div className="space-y-4">
          <Step 
            n={1} 
            title="Automated Daraja B2C (Direct M-Pesa)" 
            desc="When M-Pesa automated payouts are active, tapping 'Approve & Pay' dispatches an instant B2C disbursement straight to the winner's Safaricom line. The M-Pesa transaction reference (e.g. QK89...) is logged to the feed." 
          />
          <Step 
            n={2} 
            title="Manual / Pochi Handoff Approval" 
            desc="In leagues operating in offline or manual settlement mode, the Chairman pays the winner via Pochi La Biashara or cash. As Co-Chair, you only tap 'Mark Approved' after the Chairman provides the valid M-Pesa receipt code." 
          />
          <Step 
            n={3} 
            title="Rejecting an Invalid Payout" 
            desc="If a score is incorrect, a tie was ignored, or an unauthorized phone number was entered, tap 'Reject Payout'. Enter a brief reason (e.g., 'Transfers hit not subtracted'). Funds remain safely locked in the pot." 
          />
          <Tip>Rejecting a payout does not destroy funds. It reverts the pending transaction back to the league ledger so the Chairman can re-initiate with corrected parameters.</Tip>
        </div>
      </Section>

      {/* 4 — SLA Guidelines & Red Flags */}
      <Section icon={AlertCircle} color="text-red-400" title="4. SLA Guidelines & Anti-Fraud Red Flags">
        <div className="space-y-4">
          <Step 
            n={1} 
            title="30-Minute Approval SLA" 
            desc="Aim to review and countersign pending payouts within 30 minutes of Gameweek completion. Rapid payouts build strong trust and excitement across your WhatsApp chama group." 
          />
          <Step 
            n={2} 
            title="Red Flag: Mid-Week Payout Attempt" 
            desc="If a payout request arrives mid-week when matches are still pending, reject immediately and notify the group. Payouts must only occur after the final whistle of the last fixture." 
          />
          <Step 
            n={3} 
            title="Red Flag: Account Number Switching" 
            desc="If a member asks to send winnings to a sibling or friend's M-Pesa, advise them that payouts only go to the registered phone number. This protects against account hijackings." 
          />
          <Step 
            n={4} 
            title="Dual Team Governance" 
            desc="If the league permits dual teams, ensure that points earned by Team 1 do not accidentally get attributed to Team 2." 
          />
          <Warn>If you suspect unauthorized Chairman access or compromised credentials, immediately alert Fantasy Chama Support or use the emergency escalation contact in the Docs.</Warn>
        </div>
      </Section>

      {/* 5 — Auditing & Transparency */}
      <Section icon={FileText} color="text-blue-400" title="5. Auditing & Reporting">
        <div className="space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            Transparency is your greatest asset. You have full visibility into the league's financial operations:
          </p>
          <Step 
            n={1} 
            title="Real-Time Operations Feed" 
            desc="Monitor all incoming wallet pre-funds, STK pushes, manually marked cash payments, and payout approvals on the Command Center feed." 
          />
          <Step 
            n={2} 
            title="Export CSV Audit Trail" 
            desc="Download the end-to-end ledger spreadsheet at any point during the season. Share it in your league's group chat every 5 Gameweeks to maintain 100% transparency." 
          />
          <Step 
            n={3} 
            title="Season Vault Verification" 
            desc="Monitor the accumulated Grand Vault balance. Ensure that monthly HQ platform settlements (if applicable) are up to date so your league remains active for season-end podium awards." 
          />
          <div className="flex gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5">
            <Zap className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">Co-Chair powers can be transferred to another trusted member at any time by the Chairman through the Member Management Ledger.</p>
          </div>
        </div>
      </Section>

    </DocLayout>
  );
}
