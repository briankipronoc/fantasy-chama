import { Shield } from 'lucide-react';
import DocLayout from '../layouts/DocLayout';

export default function Terms() {
    return (
        <DocLayout
            title="Terms of Service & Rules"
            icon={Shield}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
            iconBorder="border-emerald-500/20"
            kicker="Terms & Conditions"
        >
            <p>
                Transparent Chama rules. Clear guidelines on how stakes, weekly pots, and season distributions are settled.
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

            <h2>3. Red Zone & Gameweek Eligibility</h2>
            <p>
                Managers who do not fund their wallet for an upcoming gameweek are marked in the "Red Zone". While in the Red Zone, you do not contribute to that week's pot and are ineligible to win that week's payout. Late joiners (e.g. starting at GW10) and managers returning from a skipped week only contribute from their active week forward — no retroactive back-charges or phantom arrears.
            </p>

            <h2>4. Safaricom Integrations</h2>
            <p>
                All electronic transactions flow strictly through Safaricom Daraja APIs. Payout speeds and STK push reliability are subject to network uptime. Fantasy Chama is not liable for upstream telecom latency or delayed B2C executions.
            </p>

            <h2>5. Platform Fees & Responsibilities</h2>
            <p>
                By creating or participating in a league on Fantasy Chama, members agree to the standard league commission and platform fees configured by the Chairman (such as Chairman administration, platform maintenance, and M-Pesa network processing). All deducted fees are finalized once a gameweek is resolved.
            </p>
            <p>
                Fantasy Chama coordinates league standings calculations with official Premier League data and Safaricom M-Pesa. Members are responsible for ensuring their M-Pesa phone numbers and transaction details are accurate.
            </p>
        </DocLayout>
    );
}
