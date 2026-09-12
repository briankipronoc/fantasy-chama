import { ShieldAlert } from 'lucide-react';
import DocLayout from '../layouts/DocLayout';

export default function PrivacyPolicy() {
    return (
        <DocLayout
            title="Privacy Policy"
            icon={ShieldAlert}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
            iconBorder="border-emerald-500/20"
            kicker="Data Privacy & Security"
        >
            <p>
                Simple, transparent privacy. How we protect your M-Pesa phone number and Chama records.
            </p>

            <h2>Minimal Data Collection</h2>
            <p>
                We strip out invasive analytics. Fantasy Chama explicitly gathers the absolute minimum personal data necessary to power financial pipelines. Your encrypted M-Pesa phone number is retained natively for the strict purpose of securely handling real-time deposits and automated B2C payout sweeps.
            </p>
            <p>
                Official FPL metadata, such as generic team details and gameweek scores, are ingested synchronously via the public FPL architecture. We do not permanently warehouse FPL roster data beyond what is required to render the live positional standings.
            </p>

            <h2>Strict Legal Isolation & PII</h2>
            <p>
                We categorically do not sell, rent, or trade your financial or performance Personally Identifiable Information (PII) to outside marketers, aggregators, or brokers. All Daraja pipeline transactions adhere strictly to the Safaricom API Data Privacy rulesets, completely shielding your M-Pesa PINs and sensitive financial vectors from our servers.
            </p>

            <h2>Cryptographic Authentication</h2>
            <p>
                Your login payload is securely hashed, salted, and governed by Google Firebase Infrastructure. Fantasy Chama codebase administrators entirely lack the capability to view plaintext passwords. Furthermore, our Maker/Checker disbursement logic relies on segmented multi-signature workflows, ensuring no single entity can execute unauthorized payouts without generating immutable audit trails sequentially validated on the server.
            </p>
        </DocLayout>
    );
}
