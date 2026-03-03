import { Search, Download, Trophy, Star } from 'lucide-react';

export default function Standings() {
    const standingsData = [
        { rank: 1, name: 'Alex Mwangi', team: 'Krypton FC', gwPts: 82, totalPts: 1450, payout: '45,000', type: 'Grand Vault Share', avatar: 'https://i.pravatar.cc/150?u=a' },
        { rank: 2, name: 'Sarah J.', team: 'Red Devils', gwPts: 75, totalPts: 1422, payout: '30,000', type: 'Projected', avatar: 'https://i.pravatar.cc/150?u=b' },
        { rank: 3, name: 'Brian O.', team: 'The Gunners', gwPts: 68, totalPts: 1395, payout: '20,000', type: '', avatar: 'https://i.pravatar.cc/150?u=c' },
        { rank: 4, name: 'David K.', team: 'City Zen', gwPts: 71, totalPts: 1380, payout: '15,000', type: '', avatar: 'https://i.pravatar.cc/150?u=d' },
        { rank: 5, name: 'Elena W.', team: 'Blues Army', gwPts: 64, totalPts: 1365, payout: '10,000', type: '', avatar: 'https://i.pravatar.cc/150?u=e' },
        { rank: 6, name: 'John Doe', team: 'United Pro', gwPts: 55, totalPts: 1290, payout: '—', type: '', avatar: 'https://i.pravatar.cc/150?u=f' },
        { rank: 7, name: 'Michael S.', team: 'Villa Boys', gwPts: 49, totalPts: 1275, payout: '—', type: '', avatar: 'https://i.pravatar.cc/150?u=g' },
    ];

    return (
        <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#111613]">

            <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Gameweek 24 Rankings</h1>
                    <p className="text-gray-400 font-medium tracking-wide max-w-xl">
                        Real-time FPL performance integrated with the Chama's prize pool. Payouts are projected based on the current <span className="text-[#22c55e] font-bold">Grand Vault</span> holdings.
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="relative group w-full sm:w-80">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-[#22c55e] transition-colors">
                            <Search className="w-5 h-5" />
                        </span>
                        <input
                            type="text"
                            className="w-full bg-[#151c18] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] transition-all placeholder:text-gray-500 text-white outline-none"
                            placeholder="Search members or teams..."
                        />
                    </div>
                    <button className="flex items-center gap-2 bg-[#4ade80] hover:bg-[#22c55e] text-[#0a100a] px-5 py-3 rounded-xl font-bold transition-colors">
                        <Download className="w-4 h-4" /> CSV
                    </button>
                </div>
            </div>

            <div className="w-full overflow-x-auto bg-[#151c18] border border-white/5 rounded-2xl shadow-lg">
                <table className="w-full min-w-[800px] text-left">
                    <thead>
                        <tr className="border-b border-white/5 bg-[#0a100a]/50">
                            <th className="px-6 py-5 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase">RANK</th>
                            <th className="px-6 py-5 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase">MEMBER NAME</th>
                            <th className="px-6 py-5 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase">FPL TEAM</th>
                            <th className="px-6 py-5 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase text-center">GW PTS</th>
                            <th className="px-6 py-5 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase text-center">TOTAL PTS</th>
                            <th className="px-6 py-5 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase text-right">PROJECTED PAYOUT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {standingsData.map((row, index) => {
                            const isTop1 = index === 0;
                            const isOut = index >= 5;

                            return (
                                <tr key={row.rank} className={`hover:bg-white/[0.02] transition-colors ${isTop1 ? 'bg-[#22c55e]/5' : ''}`}>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-extrabold text-xl ${isTop1 ? 'text-[#22c55e]' : isOut ? 'text-gray-600' : 'text-gray-400'}`}>
                                                {row.rank}
                                            </span>
                                            {isTop1 && <Star className="w-5 h-5 fill-[#22c55e] text-[#22c55e]" />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <img src={row.avatar} alt={row.name} className={`w-8 h-8 rounded-full border ${isTop1 ? 'border-[#22c55e]' : 'border-white/10'} ${isOut ? 'grayscale opacity-60' : ''}`} />
                                            <span className={`font-bold ${isOut ? 'text-gray-400' : 'text-white'}`}>{row.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 italic text-gray-500 font-medium">
                                        {row.team}
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className={`px-3 py-1.5 font-bold rounded-lg text-xs ${isTop1 ? 'bg-[#22c55e] text-[#0a100a]' : isOut ? 'bg-[#1e293b] text-gray-500' : 'bg-[#eab308]/20 text-[#eab308]'}`}>
                                            {row.gwPts}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-5 text-center font-bold ${isOut ? 'text-gray-500' : 'text-white'}`}>
                                        {row.totalPts.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-5 text-right flex flex-col items-end justify-center">
                                        {row.payout !== '—' ? (
                                            <>
                                                <span className={`font-extrabold text-base ${isTop1 ? 'text-[#22c55e]' : 'text-[#eab308]'}`}>
                                                    KES {row.payout}
                                                </span>
                                                {row.type && (
                                                    <span className={`text-[9px] uppercase font-bold tracking-widest ${isTop1 ? 'text-[#22c55e]/60' : 'text-gray-500'}`}>
                                                        {row.type}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="font-medium text-gray-600">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Bottom Stats Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-[#151c18] border border-white/5 rounded-2xl flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Members</p>
                        <p className="text-2xl font-extrabold text-white">42 Players</p>
                    </div>
                    <Trophy className="w-8 h-8 text-gray-700" />
                </div>
                <div className="p-6 bg-[#151c18] border border-white/5 rounded-2xl flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Current GW Average</p>
                        <p className="text-2xl font-extrabold text-white">54.2 pts</p>
                    </div>
                    <Star className="w-8 h-8 text-gray-700" />
                </div>
                <div className="p-6 bg-[#1a241c] border border-[#22c55e]/20 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e] blur-[100px] opacity-20 transform translate-x-10 -translate-y-10"></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-[#22c55e] uppercase tracking-widest mb-1">Grand Vault Total</p>
                        <p className="text-2xl font-extrabold text-white">KES 1.2M</p>
                    </div>
                    <div className="relative z-10 w-10 h-10 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-[#22C55E] animate-pulse"></div>
                    </div>
                </div>
            </div>

        </div>
    );
}
