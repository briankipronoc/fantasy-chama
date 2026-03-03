import { User, LogOut, ChevronRight, Mail, Lock, Hash, ShieldCheck, Gamepad2, AlertCircle, RefreshCw, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store/useStore';

export default function Profile() {
    const role = useStore((state) => state.role);
    const setRole = useStore((state) => state.setRole);

    const [weeklyPrizePercent, setWeeklyPrizePercent] = useState(70);
    const monthlyFee = 1400;
    const weeklyPrize = Math.round(monthlyFee * (weeklyPrizePercent / 100));
    const grandVault = Math.round(monthlyFee * ((100 - weeklyPrizePercent) / 100));

    const handleLogout = () => {
        setRole(null);
    };

    return (
        <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#111613]">
            <div className="max-w-4xl mx-auto flex flex-col gap-8">

                {/* Profile Header */}
                <div className="flex flex-col md:flex-row items-center gap-6 py-8 px-8 bg-[#151c18] rounded-2xl border border-white/5 relative overflow-hidden shadow-lg">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-[#22c55e] blur-[120px] opacity-10"></div>

                    <div className="relative group shrink-0">
                        <div
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-32 w-32 border-4 border-[#1a241c] shadow-[0_0_0_2px_rgba(34,197,94,0.5)] relative z-10"
                            style={{ backgroundImage: 'url("https://i.pravatar.cc/300?u=admin")' }}
                        ></div>
                        <button className="absolute bottom-1 right-1 bg-[#22c55e] text-[#0a100a] p-2.5 rounded-full shadow-lg hover:scale-110 transition-transform z-20">
                            <span className="material-symbols-outlined text-[15px] font-bold">edit</span>
                        </button>
                    </div>

                    <div className="text-center md:text-left relative z-10">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                            <h1 className="text-3xl font-extrabold text-white tracking-tight">{role === 'admin' ? 'Chairman Admin' : 'David Mwangi'}</h1>
                            {role === 'admin' && (
                                <span className="bg-[#eab308]/20 text-[#eab308] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-[#eab308]/30">
                                    God Mode
                                </span>
                            )}
                        </div>
                        <p className="text-gray-400 font-medium tracking-wide">Manage your chama identity and FPL stats</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* User Identity Section */}
                    <section className="flex flex-col gap-5">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                            <User className="text-[#22c55e] w-5 h-5" />
                            <h3 className="text-lg font-bold text-white">User Identity</h3>
                        </div>

                        <div className="flex flex-col gap-4">
                            <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Full Name</span>
                                <input
                                    type="text"
                                    className="w-full bg-[#151c18] border border-white/10 rounded-xl px-4 py-3.5 text-white font-bold focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] transition-all outline-none"
                                    defaultValue={role === 'admin' ? 'Chairman Admin' : 'David Mwangi'}
                                />
                            </label>

                            <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Email Address</span>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Mail className="w-4 h-4" /></span>
                                    <input
                                        type="email"
                                        className="w-full bg-[#151c18] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white font-bold focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] transition-all outline-none"
                                        defaultValue={role === 'admin' ? 'admin@fantasychama.co.ke' : 'david@example.com'}
                                    />
                                </div>
                            </label>

                            <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">M-Pesa Phone Number</span>
                                <div className="flex">
                                    <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-white/10 bg-[#1a241c] text-gray-400 text-sm font-bold">+254</span>
                                    <input
                                        type="tel"
                                        className="w-full rounded-r-xl border border-white/10 bg-[#151c18] text-white font-bold focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] transition-all outline-none px-4 py-3.5"
                                        defaultValue="712345678"
                                    />
                                </div>
                            </label>
                        </div>
                    </section>

                    {/* FPL Integration Section */}
                    <section className="flex flex-col gap-5">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                            <Gamepad2 className="text-[#22c55e] w-5 h-5" />
                            <h3 className="text-lg font-bold text-white">FPL Integration</h3>
                        </div>

                        <div className="bg-[#151c18] p-5 rounded-2xl border border-[#22c55e]/10 flex flex-col gap-5 shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-[#22c55e] blur-[60px] opacity-10"></div>

                            <label className="flex flex-col gap-2 relative z-10">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">FPL Team ID</span>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#22c55e]/50"><Hash className="w-4 h-4" /></span>
                                    <input
                                        type="text"
                                        className="w-full bg-[#0a100a] border border-white/5 rounded-xl pl-11 pr-4 py-3.5 text-white font-bold focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] transition-all outline-none"
                                        defaultValue="4829102"
                                    />
                                </div>
                            </label>

                            <label className="flex flex-col gap-2 relative z-10">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">FPL Team Name</span>
                                <input
                                    type="text"
                                    className="w-full bg-[#0a100a] border border-white/5 rounded-xl px-4 py-3.5 text-white font-bold focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] transition-all outline-none"
                                    defaultValue={role === 'admin' ? 'Admin All-Stars' : 'Mwangi Warriors FC'}
                                />
                            </label>
                        </div>

                        {/* League Information (Read-Only) */}
                        <div className="flex items-center gap-3 border-b border-white/5 pb-3 mt-2">
                            <ShieldCheck className="text-gray-500 w-5 h-5" />
                            <h3 className="text-lg font-bold text-gray-400">League Context</h3>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="p-5 rounded-2xl bg-[#1a241c] border border-white/5 shadow-md">
                                <p className="text-[10px] text-[#22c55e] font-bold uppercase tracking-widest mb-2">Active League</p>
                                <p className="text-xl font-extrabold text-white">Nairobi Elite Chama 2024</p>
                                <div className="flex items-center gap-2 mt-3 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                    <span>JOINED: AUG 12, 2024</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-[#0a100a]/50 rounded-xl border border-white/5 text-gray-500 text-xs font-medium">
                                <AlertCircle className="w-5 h-5 shrink-0 text-[#eab308]/70" />
                                <span>League transfers or multi-league support must be initiated by the Chama Administrator.</span>
                            </div>
                        </div>
                    </section>

                </div>

                {/* League Configuration Settings (Admin Only) */}
                {role === 'admin' && (
                    <section className="flex flex-col gap-5 mt-4">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                            <Trophy className="text-[#FBBF24] w-5 h-5" />
                            <h3 className="text-lg font-bold text-white">Prize Distribution Logic</h3>
                        </div>

                        <div className="bg-[#151c18] border border-white/5 p-6 md:p-8 rounded-2xl shadow-lg relative overflow-hidden">
                            <div className="mb-6 px-4 md:px-10">
                                <div className="flex justify-between items-end mb-3">
                                    <div className="text-center">
                                        <h3 className="text-3xl font-black text-[#22c55e] tabular-nums tracking-tight">{weeklyPrizePercent}%</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 text-center w-full block">Weekly Prize</p>
                                    </div>
                                    <div className="flex items-center justify-center pb-2 text-gray-500 opacity-50">
                                        <RefreshCw className="w-4 h-4 mx-8 hidden md:block" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-3xl font-black text-[#FBBF24] tabular-nums tracking-tight">{100 - weeklyPrizePercent}%</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 text-center w-full block">Grand Vault</p>
                                    </div>
                                </div>

                                {/* Interactive Range Slider */}
                                <div className="mt-6 relative">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={weeklyPrizePercent}
                                        onChange={(e) => setWeeklyPrizePercent(Number(e.target.value))}
                                        className="w-full h-2 bg-[#161d24] rounded-lg appearance-none cursor-pointer accent-[#22c55e] outline-none shadow-inner border border-white/5"
                                    />
                                    <div className="flex justify-between mt-3 text-[9px] uppercase tracking-widest text-gray-500 font-bold px-1 mb-2">
                                        <span>Season Only</span>
                                        <span>Adjust Split</span>
                                        <span>All Weekly</span>
                                    </div>
                                    {weeklyPrizePercent === 0 && (
                                        <p className="text-[10px] text-[#eab308] border border-[#eab308]/20 bg-[#eab308]/10 p-2 rounded mt-2">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 inline-block mr-1"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                            <strong>Season-only payouts selected.</strong> Tip: Weekly prizes help keep members engaged.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mx-4 md:mx-10">
                                <div className="bg-[#161d24] border border-white/5 rounded-xl p-5 border-l-4 border-l-[#22c55e] flex flex-col justify-center">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Weekly Payout</p>
                                    <h4 className="text-xl font-black text-white mb-1 tabular-nums">KES {weeklyPrize.toLocaleString()}</h4>
                                    <p className="text-[9px] text-gray-400">Distributed to top performers weekly</p>
                                </div>
                                <div className="bg-[#161d24] border border-white/5 rounded-xl p-5 border-l-4 border-l-[#FBBF24] flex flex-col justify-center">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Grand Vault</p>
                                    <h4 className="text-xl font-black text-white mb-1 tabular-nums">KES {grandVault.toLocaleString()}</h4>
                                    <p className="text-[9px] text-gray-400">Accumulated for end-of-season rewards</p>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Security Section */}
                <section className="flex flex-col gap-5 mt-4">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                        <Lock className="text-[#22c55e] w-5 h-5" />
                        <h3 className="text-lg font-bold text-white">Security & Access</h3>
                    </div>

                    <div className="flex flex-col gap-4 max-w-2xl">
                        <button className="flex items-center justify-between w-full p-5 rounded-2xl bg-[#151c18] border border-white/5 hover:border-[#22c55e]/50 transition-all group shadow-md">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-[#1a241c] rounded-lg group-hover:bg-[#22c55e]/10 transition-colors">
                                    <Lock className="w-5 h-5 text-gray-400 group-hover:text-[#22c55e] transition-colors" />
                                </div>
                                <span className="font-bold text-white">Change Password</span>
                            </div>
                            <ChevronRight className="text-gray-600 group-hover:text-[#22c55e] group-hover:translate-x-1 transition-all" />
                        </button>

                        <div className="flex items-center justify-between p-5 rounded-2xl bg-[#151c18] border border-white/5 shadow-md">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-[#22c55e]/10 rounded-lg">
                                    <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                                </div>
                                <div>
                                    <p className="font-bold text-white mb-0.5">Two-Factor Authentication</p>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">SECURE WITH SMS</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div className="w-11 h-6 bg-[#1a241c] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#22c55e]"></div>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Bottom Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-white/5 gap-6">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>

                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <button className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-gray-400 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                            DISCARD
                        </button>
                        <button className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-extrabold bg-[#4ade80] text-[#0a100a] hover:bg-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-colors">
                            SAVE PROFILE
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
