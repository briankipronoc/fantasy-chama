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
                Every active contender contributes their agreed stake per gameweek (e.g. KES 250). When the gameweek fixtures finish, official points are synced directly from the FPL API. The manager with the highest net score that week takes the weekly pot.
            </p>

            <h2>What happens if someone joins late (e.g. Gameweek 10)?</h2>
            <p>
                Late joiners have two options:
                <br />
                <strong>1. Fair Buy-In Contender:</strong> The Chairman generates an algorithmic Fair Entry invoice via the Buy-In Calculator. They pay their backdated share of the accumulated Season Vault equity plus their current round stake, giving them full rights to compete for both weekly pots and the Grand Season Vault without diluting founding members.
                <br />
                <strong>2. Spectator Mode:</strong> They can join the league for free to track live standings, join the banter, and place 1v1 head-to-head Side Bets against rivals without contributing to or winning from the weekly pot.
            </p>

            <h2>What are the 3 display themes (Light, Dark, Stealth)?</h2>
            <p>
                Fantasy Chama includes an instant 3-way theme toggle located on the top navigation bar:
                <br />
                <strong>☀️ Light:</strong> Clean, crisp daytime design with high-contrast slate text and pure white containers.
                <br />
                <strong>🌙 Dark:</strong> Sleek slate-navy palette designed for standard low-light usage.
                <br />
                <strong>🕶️ Stealth:</strong> Deep true-black (#000000) mode with pure OLED aesthetics and concealed monetary figures when browsing standings in public or over screenshare.
            </p>

            <h2>What happens if someone is in the Red Zone?</h2>
            <p>
                If a member's wallet does not have enough funds for an upcoming gameweek, they are marked in the Red Zone for that round. They are not deducted for that week's pot, and they cannot win that week's payout — even if their team scores the highest points. Once they top up via M-Pesa STK push or Pochi, their wallet is instantly credited and they re-enter the Green Zone. No ghost arrears.
            </p>

            <h2>Can our Chama start at Gameweek 5 instead of Gameweek 1?</h2>
            <p>
                Yes! Fantasy Chama supports dynamic kickoff gameweeks (e.g. GW5). When your league starts at GW5, pre-season rounds are completely insulated, preventing false debt or bogus arrears. The Gameweek Winner ledger and standings automatically sync directly to your official kickoff round.
            </p>

            <h2>How are funds deposited and paid out?</h2>
            <p>
                Members fund their digital wallet directly via automated M-Pesa STK Push prompts on their phones, or through the Chairman's Pochi La Biashara. When a gameweek is resolved, the dual-signatory Co-Chair verifies the results, and the payout is dispatched via Daraja B2C straight to the winner's Safaricom number.
            </p>

            <h2>How does the Season Vault work?</h2>
            <p>
                If your Chairman enables a season split (e.g. 70% weekly pot / 30% season vault), the season portion accumulates every round into a secure prize vault. At Gameweek 38, the vault is distributed among the season champions according to your league constitution.
            </p>

            <h2>Can a Chairman run off with the money?</h2>
            <p>
                No. Fantasy Chama enforces a dual-signatory Maker/Checker protocol with your designated Co-Chair. Before any payout dispatches or member status changes execute, your Co-Chair must independently verify scores and countersign. All ledger entries are cryptographically timestamped and publicly visible to every league member.
            </p>
        </DocLayout>
    );
}

