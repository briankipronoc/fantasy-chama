import { HelpCircle, Wallet, Lock, Activity, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FAQ() {
    return (
        <div className="bg-[#0a0e17] text-[#dfe2ef] min-h-screen font-sans">
            {/* TopNavBar */}
            <nav className="fixed top-0 w-full z-50 bg-[#0f131c]/80 backdrop-blur-xl border-b border-white/[0.05]">
                <div className="flex justify-between items-center px-6 md:px-8 py-4 max-w-7xl mx-auto">
                    <Link to="/" className="flex items-center gap-2 text-xl md:text-2xl font-extrabold tracking-tighter text-[#DFE2EF] hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-[1px] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <div className="w-full h-full bg-[#0a0e17] rounded-[11px] flex items-center justify-center">
                                <HelpCircle className="w-4 h-4 text-emerald-400" />
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
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4 block relative z-10">Knowledge Base</span>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-white mb-6 relative z-10">Frequently Asked<br />Questions.</h1>
                    <p className="text-gray-400 text-lg md:text-xl font-medium max-w-2xl mx-auto relative z-10">
                        Clarity is the ultimate security. Everything you need to know about the platform's mechanics, payouts, and infrastructure.
                    </p>
                </div>

                {/* Bento Grid FAQ */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
                    
                    {/* Q1: Wallet Flow (Large) */}
                    <div className="md:col-span-8 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-between border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                        <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <Wallet className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="z-10 relative">
                            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">How are funds deposited and secured?</h2>
                            <p className="text-gray-400 leading-relaxed text-base md:text-lg mb-4">
                                When a league is created, the Chairman defines the stake amount per gameweek. Members receive an invitation code and can securely deposit their stakes into their platform wallet utilizing M-Pesa STK Push integration natively connected to Safaricom Daraja.
                            </p>
                            <p className="text-gray-400 leading-relaxed text-base md:text-lg">
                                Your digital wallet balance is stored securely within the platform's vault until weekly deductions resolve your gameweek stakes. All transactions are mathematically transparent.
                            </p>
                        </div>
                    </div>

                    {/* Q2: FPL Sync (Small) */}
                    <div className="md:col-span-4 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none"></div>
                        <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <Activity className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3 z-10 relative">How fast is the FPL score sync?</h2>
                        <p className="text-gray-400 leading-relaxed text-sm lg:text-base z-10 relative">
                            Fantasy Chama is directly linked via API to the Official Premier League servers. As points accumulate globally on a matchday, your positional standings within your private ledger update synchronously.
                        </p>
                    </div>

                    {/* Q3: Red Zone (Half) */}
                    <div className="md:col-span-6 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-[60px] pointer-events-none"></div>
                        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <Lock className="w-6 h-6 text-red-400" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3 z-10 relative">What happens if I miss a payment?</h2>
                        <p className="text-gray-400 leading-relaxed text-base z-10 relative">
                            If your wallet hits zero, you are instantly flagged and moved into the "Red Zone." During this state, your points are ignored by the payout resolution engine, mathematically excluding you from the active weekly pot until the arrears are cleared.
                        </p>
                    </div>

                    {/* Q4: Maker Checker (Half) */}
                    <div className="md:col-span-6 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 relative overflow-hidden group hover:bg-[#1f2937] transition-colors">
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none"></div>
                        <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-6 z-10 relative">
                            <Users className="w-6 h-6 text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3 z-10 relative">Can the Chairman steal funds?</h2>
                        <p className="text-gray-400 leading-relaxed text-base z-10 relative">
                            Absolutely not. Our architecture strictly relies on the Maker/Checker Protocol. Every payout or manual deduction must be explicitly cryptographically signed and approved by a secondary Co-Chair before execution.
                        </p>
                    </div>
                </div>
            </main>

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
        </div>
    );
}
