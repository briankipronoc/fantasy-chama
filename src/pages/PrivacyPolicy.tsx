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

            <h2>Strict Data Privacy</h2>
            <p>
                We do not sell, rent, or trade your personal or financial information to outside parties. All M-Pesa transactions adhere strictly to Safaricom Data Privacy standards, completely shielding your M-Pesa PIN and personal details from our servers.
            </p>

            <h2>Secure Authentication & Safeguards</h2>
            <p>
                Your account authentication is encrypted and managed via Google Firebase Infrastructure. Fantasy Chama administrators cannot view plaintext passwords. Furthermore, our Maker/Checker disbursement flow requires dual authorization from the Chairman and Co-Chair, ensuring funds cannot be disbursed without proper approval and a permanent audit record.
            </p>
        </DocLayout>
    );
}
