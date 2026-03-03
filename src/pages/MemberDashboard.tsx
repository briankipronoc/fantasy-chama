import { Bell, Trophy, BarChart3, Banknote } from 'lucide-react';

export default function MemberDashboard() {
    const mockWinnersTape = [
        { gw: 25, name: '@Kimani', points: 94, prize: '2,000 KES', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d' },
        { gw: 24, name: '@Omar', points: 102, prize: '2,000 KES', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' },
    ];

    const grandVault = 84500;
    const grandVaultGoal = 150000;
    const progressPercentage = Math.round((grandVault / grandVaultGoal) * 100);

    return (
        <div className="min-h-screen bg-[#111613] text-white flex flex-col font-sans relative pb-28">

            {/* Top Navigation Frame */}
            <header className="flex items-center justify-between p-4 md:px-8 border-b border-white/5 bg-[#0a100a] z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-[#22C55E]/20 p-1.5 rounded-lg text-[#22C55E]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M21 18v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1h-9a2 2 0 00-2 2v8a2 2 0 002 2h9zm-9-2h10V8H12v8zm4-2.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                        </svg>
                    </div>
                    <span className="font-bold text-[15px] tracking-tight text-white">Fantasy Chama</span>
                </div>

                <div className="flex items-center gap-4">
                    <button className="relative bg-[#1a241c] p-2 rounded-full border border-white/5 text-gray-400 hover:text-white transition-colors">
                        <Bell className="w-4 h-4" />
                    </button>
                    <button className="bg-[#1a241c] p-2 rounded-full border border-white/5 text-gray-400 hover:text-white transition-colors overflow-hidden">
                        <div className="w-4 h-4 rounded-full bg-gray-500" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-8 flex flex-col items-center mt-4 space-y-6">

                <div className="w-full flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#22C55E]"></div>
                    <span className="text-[10px] font-bold text-[#22C55E] tracking-widest uppercase">WAR ROOM DASHBOARD</span>
                </div>

                {/* Season End Vault Card */}
                <div className="w-full bg-[#151c18] border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-lg">
                    <div className="absolute top-6 right-6 opacity-10">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16">
                            <path d="M19 12h-2v3h-2v-3h-2v-3h6v3zM15 7h4v2h-4zM2 13a4.5 4.5 0 004.5 4.5H8v-3.5a1.5 1.5 0 013 0v3.5h7.5A4.5 4.5 0 0023 13c0-2-1.2-3.8-3-4.3V8a3 3 0 00-3-3H7A3 3 0 004 8v1.7C2 10 2 11.4 2 13z" />
                        </svg>
                    </div>

                    <p className="text-gray-400 text-[13px] font-semibold mb-1">Season End Vault</p>
                    <div className="flex items-baseline gap-2 mb-8">
                        <span className="text-4xl font-extrabold text-white tracking-tight tabular-nums">
                            {grandVault.toLocaleString()}
                        </span>
                        <span className="text-gray-500 text-sm font-bold">KES</span>
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-2 text-[12px]">
                            <span className="text-gray-400 font-medium">Goal: <span className="text-white font-bold">{grandVaultGoal.toLocaleString()} KES</span></span>
                            <span className="text-[#22C55E] font-bold">{progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-[#0a100a] h-2.5 rounded-full overflow-hidden border border-white/5">
                            <div className="bg-[#22C55E] h-full rounded-full w-[56%] transition-all duration-1000"></div>
                        </div>
                    </div>
                </div>

                {/* Active Gameweek Pot Card */}
                <div className="w-full bg-[#111f14] border border-[#22C55E]/20 rounded-xl p-5 relative overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.05)]">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></div>
                            </div>
                            <span className="text-[10px] font-bold text-[#22C55E] tracking-widest uppercase">ACTIVE GAMEWEEK</span>
                        </div>
                        <button className="bg-[#22C55E] text-[#0a100a] text-[10px] font-bold px-3 py-1 rounded shadow-md hover:bg-[#1fbb59] transition-colors">
                            JOIN
                        </button>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">GW26 Pot: 4,000 KES</h3>

                    <div className="flex items-center gap-1.5 text-gray-400 text-[12px] font-medium">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Closes in 14h 20m
                    </div>
                </div>

                {/* Previous Winners */}
                <div className="w-full pt-2">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="flex items-center gap-2 text-[14px] font-bold text-white">
                            <Trophy className="w-4 h-4 text-[#22C55E]" /> Previous Winners
                        </h4>
                        <span className="text-[11px] font-bold text-[#22C55E] cursor-pointer hover:underline">View All</span>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        {mockWinnersTape.map((winner, idx) => (
                            <div key={idx} className="bg-[#131b22] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center min-w-[140px] shrink-0">
                                <img src={winner.avatar} alt={winner.name} className="w-12 h-12 rounded-full border-2 border-[#22C55E] p-0.5 mb-3" />
                                <span className="font-bold text-[14px] text-white tracking-wide">{winner.name}</span>
                                <span className="font-bold text-[13px] text-[#22C55E] my-1 tracking-tight">{winner.prize}</span>
                                <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase">GW{winner.gw} CHAMPION</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Live Updates */}
                <div className="w-full bg-[#151c18] border border-white/5 rounded-2xl p-5">
                    <h4 className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-4">LIVE UPDATES</h4>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></div>
                                <span className="text-[13px] text-gray-300">@Maina just deposited 500 KES</span>
                            </div>
                            <span className="text-[11px] text-gray-500">2m ago</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                                <span className="text-[13px] text-gray-300">New prize pool milestone reached!</span>
                            </div>
                            <span className="text-[11px] text-gray-500">1h ago</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Floating Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0a100a] via-[#0a100a]/90 to-transparent flex justify-center z-30">
                <div className="flex gap-4 w-full max-w-2xl mx-auto">
                    <button className="flex-1 bg-[#4ade80] hover:bg-[#22c55e] text-[#0a100a] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg">
                        <Banknote className="w-5 h-5" /> Deposit (M-Pesa)
                    </button>
                    <button className="flex-1 bg-[#1e293b] hover:bg-[#334155] border border-white/5 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <BarChart3 className="w-5 h-5" /> Standings
                    </button>
                </div>
            </div>

        </div>
    );
}
