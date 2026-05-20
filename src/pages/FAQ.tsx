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
                Fantasy Chama is directly linked via API to the Official Premier League servers. As points accumulate globally on a matchday, your positional standings within your private ledger update synchronously.
            </p>

            <h2>What happens if I miss a payment?</h2>
            <p>
                If your wallet hits zero, you are instantly flagged and moved into the "Red Zone." During this state, your points are ignored by the payout resolution engine, mathematically excluding you from the active weekly pot until the arrears are cleared.
            </p>

            <h2>Can the Chairman steal funds?</h2>
            <p>
                Absolutely not. Our architecture strictly relies on the Maker/Checker Protocol. Every payout or manual deduction must be explicitly cryptographically signed and approved by a secondary Co-Chair before execution.
            </p>
        </DocLayout>
    );
}
