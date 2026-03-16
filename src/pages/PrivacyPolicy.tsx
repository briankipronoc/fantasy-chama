import { ShieldAlert, Lock, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen p-6 md:p-10 text-white font-sans bg-[#0b1014] pb-24 lg:pb-10 relative overflow-hidden">
            {/* ── Ambient background grid ─────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none z-0" />

            {/* Back button */}
            <button 
                onClick={() => navigate(-1)} 
                className="relative z-10 text-emerald-500 hover:text-emerald-400 font-bold mb-8 text-sm flex items-center gap-2"
            >
                ← Back
            </button>

            <div className="relative z-10 w-full max-w-4xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-8 text-center md:text-left flex items-center justify-center md:justify-start gap-3">
                    <ShieldAlert className="w-8 h-8 md:w-10 md:h-10 text-[#10B981]" /> Privacy Policy
                </h1>
                <div className="space-y-6 w-full">
                    <div className="bg-[#161d24]/80 backdrop-blur-md border border-white/5 p-8 rounded-[2rem] shadow-xl">
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                            <Lock className="w-5 h-5 text-[#FBBF24]" /> Data Collection & Security
                        </h2>
                        <ul className="list-disc pl-5 space-y-3 text-gray-300 leading-relaxed text-sm">
                            <li>We collect minimal personal data. Your M-Pesa phone number is stored strictly for securely handling tournament deposits and B2C payouts.</li>
                            <li>Your login credentials (passwords) are securely hashed and managed by Firebase Authentication; Fantasy Chama administrators do not have access to plaintext passwords.</li>
                            <li>Official FPL team details are grabbed synchronously via the public FPL API and are not manipulated or permanently warehoused by Fantasy Chama beyond what is required to render the live standings.</li>
                            <li>We employ Maker/Checker logic on transactions ensuring no individual Chairman can drain funds unilaterally without cryptographic audit trails on the master ledger.</li>
                        </ul>
                    </div>

                    <div className="bg-[#161d24]/80 backdrop-blur-md border border-white/5 p-8 rounded-[2rem] shadow-xl">
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                            <EyeOff className="w-5 h-5 text-[#10B981]" /> Third Parties
                        </h2>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            We do not sell, rent, or trade any user phone numbers, names, or performance data to outside marketers. Connectivity to Safaricom Daraja is authenticated over secure channels. By continuing to use Fantasy Chama, you accept this stringent data firewall approach.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
