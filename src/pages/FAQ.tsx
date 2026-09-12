import { HelpCircle } from 'lucide-react';
import DocLayout from '../layouts/DocLayout';

export default function FAQ() {
    return (
        <DocLayout
            title="Frequently Asked Questions"
            icon={HelpCircle}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
            iconBorder="border-blue-500/20"
            kicker="Clarity is the ultimate security. Everything you need to know about the platform's mechanics."
        >
            <h2>How are funds deposited and secured?</h2>
            <p>
                When a league is created, the Chairman defines the stake amount per gameweek. Members receive an invitation code and can securely deposit their stakes into their platform wallet utilizing M-Pesa STK Push integration natively connected to Safaricom Daraja.
            </p>
            <p>
                Your digital wallet balance is stored securely within the platform's vault until weekly deductions resolve your gameweek stakes. All transactions are mathematically transparent.
            </p>

            <h2>How fast is the FPL score sync?</h2>
            <p>
                Fantasy Chama links directly to the Official Premier League data. As points accumulate on a matchday, your positional standings within your Chama league update in real time.
            </p>

            <h2>What happens if I miss a payment?</h2>
            <p>
                If your wallet balance is insufficient for the gameweek stake, you are temporarily moved to the "Red Zone." While in the Red Zone, you are excluded from winning that gameweek's active pot until your wallet is funded.
            </p>

            <h2>Can the Chairman withdraw funds without permission?</h2>
            <p>
                No. Fantasy Chama uses a dual-approval Maker/Checker system. Any payout initiated by the Chairman must be verified and approved by the assigned Co-Chair before funds are disbursed.
            </p>
        </DocLayout>
    );
}
