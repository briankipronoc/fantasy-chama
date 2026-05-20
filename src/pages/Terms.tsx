import { Shield } from 'lucide-react';
import DocLayout from '../layouts/DocLayout';

export default function Terms() {
    return (
        <DocLayout
            title="The Rules of the Vault"
            icon={Shield}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
            iconBorder="border-emerald-500/20"
            kicker="Legal Architecture"
        >
            <p>
                Institutional-grade transparency. Everything you need to know about how the platform routes, protects, and settles your stakes.
            </p>

            <h2>1. Vault Mechanics & Escrow</h2>
            <p>
                Fantasy Chama acts exclusively as an automated escrow gateway. When users fund their wallets via M-Pesa STK push, funds are held securely. The platform natively prevents manual withdrawal of active stakes prior to official gameweek settlements.
            </p>
            <p>
                The platform guarantees 100% mathematical accuracy based on the Official FPL API. We do not manually alter points, ranks, or outcomes.
            </p>

            <h2>2. Admin Powers</h2>
            <p>
                League Chairmen define the stakes. Platform architecture natively redirects customizable administrative commissions directly to their personal wallets upon each successful gameweek resolution.
            </p>

            <h2>3. Red Zone Enforcement</h2>
            <p>
                Users who fail to maintain sufficient wallet balances are automatically demoted to the "Red Zone". While in the Red Zone, managers are explicitly excluded from the active gameweek pot and are ineligible for any B2C payouts until their arrears are cleared.
            </p>

            <h2>4. Safaricom Integrations</h2>
            <p>
                All electronic transactions flow strictly through Safaricom Daraja APIs. Payout speeds and STK push reliability are subject to network uptime. Fantasy Chama is not liable for upstream telecom latency or delayed B2C executions.
            </p>

            <h2>5. Operational Indemnity & Platform Fees</h2>
            <p>
                By deploying or participating in a league engineered by Fantasy Chama, users acknowledge and agree to an irrevocable <strong>9% Gross Operational Cut</strong> per gameweek resolution. This constitutes a 4% Chairman Governance Fee, 3.5% HQ Platform Execution Fee, and a 1.5% Telecom Processing buffer. These fees are algorithmically deducted from the gross pot and are absolutely <strong>non-refundable</strong> under all circumstances, regardless of user dropout or league dissolution.
            </p>
            <p>
                Furthermore, Fantasy Chama operates strictly as a parallel calculation matrix bridging the Official Premier League API and Safaricom's Daraja gateway. We accept <strong>zero liability</strong> for financial misallocations, resolution delays, or payout failures stemming from upstream FPL API outages, catastrophic Safaricom telecom latency, or Chairman fraud via hybrid cash-handoffs. Users assume all sovereign risk when authorizing M-Pesa deposits into the platform.
            </p>
        </DocLayout>
    );
}
