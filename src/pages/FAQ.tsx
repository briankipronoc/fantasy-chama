import { HelpCircle } from 'lucide-react';
import DocLayout from '../layouts/DocLayout';

export default function FAQ() {
    return (
        <DocLayout
            title="Frequently Asked Questions"
            icon={HelpCircle}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
            iconBorder="border-emerald-500/20"
            kicker="Clear rules, zero confusion. Everything you need to know about how your Chama runs."
        >
            <h2>How does the weekly pot work?</h2>
            <p>
                Every active member contributes their agreed stake per gameweek (e.g. KES 250). When the gameweek fixtures finish, official points are synced directly from the FPL API. The manager with the highest score that week takes the weekly pot.
            </p>

            <h2>What happens if someone joins late (e.g. Gameweek 10)?</h2>
            <p>
                Late joiners only contribute to the pot from the week they join onwards. They are never back-charged for earlier gameweeks, and their contributions only go toward active gameweeks from GW10 through GW38.
            </p>

            <h2>What happens if someone skips a gameweek or is in the Red Zone?</h2>
            <p>
                If a member's wallet doesn't have enough funds for a gameweek, they are marked Red Zone for that week. They do not contribute to that week's pot, and they cannot win that week's payout — even if they score the highest points. Once they top up, they are immediately eligible for the next gameweek. No ghost arrears.
            </p>

            <h2>How are funds deposited and paid out?</h2>
            <p>
                Members fund their digital wallet directly via M-Pesa STK Push on their phones, or through the Chairman's Pochi La Biashara. When a gameweek is resolved, the winner's payout is sent directly to their registered M-Pesa number.
            </p>

            <h2>How does the Season Vault work?</h2>
            <p>
                If your Chairman enables a season split (e.g. 70% weekly / 30% season vault), the season portion accumulates every week into a secure prize pool. At Gameweek 38, the vault is shared among the top season managers according to the league's payout tiers.
            </p>

            <h2>Can a Chairman run off with the money?</h2>
            <p>
                No. Fantasy Chama uses a dual-confirmation system with an assigned Co-Chair. Before any payout or member status change executes, your designated Co-Chair must approve it. Plus, the full ledger and transactions are open and visible to every member in the league.
            </p>
        </DocLayout>
    );
}

