import { Shield, Lock, Scale, AlertOctagon, Terminal, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Terms() {
    return (
        <div className="bg-[#0a0e17] text-[#dfe2ef] min-h-screen font-sans">
            {/* TopNavBar */}
            <nav className="fixed top-0 w-full z-50 bg-[#0f131c]/80 backdrop-blur-xl border-b border-white/[0.05]">
                <div className="flex justify-between items-center px-6 md:px-8 py-4 max-w-7xl mx-auto">
                    <Link to="/" className="flex items-center gap-2 text-xl md:text-2xl font-extrabold tracking-tighter text-[#DFE2EF] hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-[1px] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <div className="w-full h-full bg-[#0a0e17] rounded-[11px] flex items-center justify-center">
                                <Shield className="w-4 h-4 text-emerald-400" />
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
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4 block relative z-10">Legal Architecture</span>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-white mb-6 relative z-10">The Rules of the Vault.</h1>
                    <p className="text-gray-400 text-lg md:text-xl font-medium max-w-2xl mx-auto relative z-10">
                        Institutional-grade transparency. Everything you need to know about how the platform routes, protects, and settles your stakes.
                    </p>
                </div>

                {/* Bento Grid Terms */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
                    
                    {/* 1. Vault Mechanics (Large) */}
                    <div className="md:col-span-8 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-between border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                        <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <Lock className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="z-10 relative">
                            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">1. Vault Mechanics & Escrow</h2>
                            <p className="text-gray-400 leading-relaxed text-base md:text-lg mb-4">
                                Fantasy Chama acts exclusively as an automated escrow gateway. When users fund their wallets via M-Pesa STK push, funds are held securely. The platform natively prevents manual withdrawal of active stakes prior to official gameweek settlements.
                            </p>
                            <p className="text-gray-400 leading-relaxed text-base md:text-lg">
                                The platform guarantees 100% mathematical accuracy based on the Official FPL API. We do not manually alter points, ranks, or outcomes.
                            </p>
                        </div>
                    </div>

                    {/* 2. Admin Capabilities (Small) */}
                    <div className="md:col-span-4 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-[50px] pointer-events-none"></div>
                        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <Terminal className="w-5 h-5 text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3 z-10 relative">2. Admin Powers</h2>
                        <p className="text-gray-400 leading-relaxed text-sm lg:text-base z-10 relative">
                            League Chairmen define the stakes. Platform architecture natively redirects customizable administrative commissions directly to their personal wallets upon each successful gameweek resolution.
                        </p>
                    </div>

                    {/* 3. Red Zone & Defauls (Half) */}
                    <div className="md:col-span-6 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-[60px] pointer-events-none"></div>
                        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <AlertOctagon className="w-6 h-6 text-red-400" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3 z-10 relative">3. Red Zone Enforcement</h2>
                        <p className="text-gray-400 leading-relaxed text-base z-10 relative">
                            Users who fail to maintain sufficient wallet balances are automatically demoted to the "Red Zone". While in the Red Zone, managers are explicitly excluded from the active gameweek pot and are ineligible for any B2C payouts until their arrears are cleared.
                        </p>
                    </div>

                    {/* 4. Financial Jurisdiction (Half) */}
                    <div className="md:col-span-6 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-48 h-48 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none"></div>
                        <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <Scale className="w-6 h-6 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3 z-10 relative">4. Safaricom Integrations</h2>
                        <p className="text-gray-400 leading-relaxed text-base z-10 relative">
                            All electronic transactions flow strictly through Safaricom Daraja APIs. Payout speeds and STK push reliability are subject to network uptime. Fantasy Chama is not liable for upstream telecom latency or delayed B2C executions.
                        </p>
                    </div>

                    {/* 5. User Consent (Full) */}
                    <div className="md:col-span-12 bg-[#161d24] rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row md:items-center border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute inset-y-0 right-0 w-full md:w-1/2 bg-gradient-to-l from-emerald-500/5 via-transparent to-transparent pointer-events-none"></div>
                        <div className="w-full relative z-10">
                            <div className="w-14 h-14 bg-[#0a0e17] border border-emerald-500/30 rounded-[1.25rem] flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/10">
                                <FileText className="w-7 h-7 text-emerald-400" />
                            </div>
                            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">5. Operational Indemnity & Platform Fees</h2>
                            <p className="text-gray-400 leading-relaxed text-lg max-w-4xl mb-4">
                                By deploying or participating in a league engineered by Fantasy Chama, users acknowledge and agree to an irrevocable <strong>9% Gross Operational Cut</strong> per gameweek resolution. This constitutes a 4% Chairman Governance Fee, 3.5% HQ Platform Execution Fee, and a 1.5% Telecom Processing buffer. These fees are algorithmically deducted from the gross pot and are absolutely <strong>non-refundable</strong> under all circumstances, regardless of user dropout or league dissolution.
                            </p>
                            <p className="text-gray-400 leading-relaxed text-lg max-w-4xl">
                                Furthermore, Fantasy Chama operates strictly as a parallel calculation matrix bridging the Official Premier League API and Safaricom's Daraja gateway. We accept <strong>zero liability</strong> for financial misallocations, resolution delays, or payout failures stemming from upstream FPL API outages, catastrophic Safaricom telecom latency, or Chairman fraud via hybrid cash-handoffs. Users assume all sovereign risk when authorizing M-Pesa deposits into the platform.
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
