import { ShieldAlert, EyeOff, Database, Key } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
    return (
        <div className="bg-[#0a0e17] text-[#dfe2ef] min-h-screen font-sans">
            {/* TopNavBar */}
            <nav className="fixed top-0 w-full z-50 bg-[#0f131c]/80 backdrop-blur-xl border-b border-white/[0.05]">
                <div className="flex justify-between items-center px-6 md:px-8 py-4 max-w-7xl mx-auto">
                    <Link to="/" className="flex items-center gap-2 text-xl md:text-2xl font-extrabold tracking-tighter text-[#DFE2EF] hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-[1px] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <div className="w-full h-full bg-[#0a0e17] rounded-[11px] flex items-center justify-center">
                                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                            </div>
                        </div>
                        Fantasy <span className="text-emerald-400">Chama</span>
                    </Link>
                    <div className="flex items-center gap-6">
                        <Link to="/" className="text-sm font-bold text-gray-400 hover:text-white transition-colors">Return Home</Link>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-24 px-6 md:px-8 max-w-6xl mx-auto">
                {/* Hero Header */}
                <div className="text-center mb-16 md:mb-24 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4 block relative z-10">Data Assurance</span>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-white mb-6 relative z-10">Privacy Architecture.</h1>
                    <p className="text-gray-400 text-lg md:text-xl font-medium max-w-2xl mx-auto relative z-10">
                        Zero compromises. How we secure your identification, protect your cryptographic keys, and keep the master ledger entirely private.
                    </p>
                </div>

                {/* Bento Grid Terms */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
                    
                    {/* 1. Data Collection (Large) */}
                    <div className="md:col-span-8 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-between border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                        <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <Database className="w-6 h-6 text-blue-400" />
                        </div>
                        <div className="z-10 relative">
                            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">Minimal Telemetry Collection</h2>
                            <p className="text-gray-400 leading-relaxed text-base md:text-lg mb-4">
                                We strip out invasive analytics. Fantasy Chama explicitly gathers the absolute minimum personal data necessary to power financial pipelines. Your encrypted M-Pesa phone number is retained natively for the strict purpose of securely handling real-time deposits and automated B2C payout sweeps.
                            </p>
                            <p className="text-gray-400 leading-relaxed text-base md:text-lg">
                                Official FPL metadata, such as generic team details and gameweek scores, are ingested synchronously via the public FPL architecture. We do not permanently warehouse FPL roster data beyond what is required to render the live positional standings.
                            </p>
                        </div>
                    </div>

                    {/* 2. Third Parties (Small) */}
                    <div className="md:col-span-4 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-[50px] pointer-events-none"></div>
                        <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <EyeOff className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3 z-10 relative">Strict Legal Isolation & PII</h2>
                        <p className="text-gray-400 leading-relaxed text-sm lg:text-base z-10 relative">
                            We categorically do not sell, rent, or trade your financial or performance Personally Identifiable Information (PII) to outside marketers, aggregators, or brokers. All Daraja pipeline transactions adhere strictly to the Safaricom API Data Privacy rulesets, completely shielding your M-Pesa PINs and sensitive financial vectors from our servers.
                        </p>
                    </div>

                    {/* 3. Authentication (Half) */}
                    <div className="md:col-span-12 bg-[#161d24] rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row md:items-center border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute inset-y-0 right-0 w-full md:w-1/2 bg-gradient-to-l from-amber-500/5 via-transparent to-transparent pointer-events-none"></div>
                        <div className="w-full relative z-10">
                            <div className="w-14 h-14 bg-[#0a0e17] border border-amber-500/30 rounded-[1.25rem] flex items-center justify-center mb-6 shadow-xl shadow-amber-500/10">
                                <Key className="w-7 h-7 text-amber-400" />
                            </div>
                            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">Cryptographic Authentication</h2>
                            <p className="text-gray-400 leading-relaxed text-lg max-w-4xl">
                                Your login payload is securely hashed, salted, and governed by Google Firebase Infrastructure. Fantasy Chama codebase administrators entirely lack the capability to view plaintext passwords. Furthermore, our Maker/Checker disbursement logic relies on segmented multi-signature workflows, ensuring no single entity can execute unauthorized payouts without generating immutable audit trails sequentially validated on the server.
                            </p>
                        </div>
                    </div>
                </div>

            {/* Global Footer */}
            <footer className="w-full bg-[#0a0e17]">
                <div className="flex flex-col md:flex-row justify-center md:justify-between items-center px-6 md:px-12 py-10 w-full max-w-7xl mx-auto border-t border-white/5">
                    <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-6 md:mb-0">
                        <Link to="/privacy-policy" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Privacy</Link>
                        <Link to="/terms" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Security</Link>
                        <Link to="/faq" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">FAQ</Link>
                        <a href="mailto:support@fantasychama.co.ke" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Support</a>
                        <a href="https://x.com/FantasyChama" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Twitter</a>
                    </div>
                    <div className="text-gray-600 text-xs font-semibold tracking-wide">
                        © 2026 Fantasy Chama. Institutional Grade.
                    </div>
                </div>
            </footer>
            </main>
        </div>
    );
}
