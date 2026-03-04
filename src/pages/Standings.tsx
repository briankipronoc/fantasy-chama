import { useState, useEffect } from 'react';
import { Search, Download, Trophy, Star, Zap, Circle } from 'lucide-react';
import { useStore } from '../store/useStore';
import clsx from 'clsx';

export default function Standings() {
    const [standingsData, setStandingsData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fallback/test FPL League ID if not tied to the Chama yet
    const fplLeagueId = 314;

    const members = useStore(state => state.members);
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    useEffect(() => {
        if (activeLeagueId && members.length === 0) {
            listenToLeagueMembers(activeLeagueId);
        }

        const fetchFPLStandings = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const response = await fetch(`${apiUrl}/api/fpl/standings/${fplLeagueId}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch FPL standings');
                }

                const data = await response.json();

                if (data && data.standings && data.standings.results) {
                    setStandingsData(data.standings.results);
                } else {
                    setStandingsData([]);
                }
            } catch (err: any) {
                console.error("FPL Fetch Error:", err);
                setError(err.message || 'Could not connect to FPL servers.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchFPLStandings();
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    // Matching logic to bridge FPL data to Firebase Ledger
    const getMemberStatus = (playerName: string, entryName: string) => {
        const normalizedPlayerName = playerName.toLowerCase().trim();
        const normalizedEntryName = entryName.toLowerCase().trim();

        // 1. Try to match by display name closely
        const matchedMember = members.find(m => {
            const dbName = m.displayName.toLowerCase().trim();
            return normalizedPlayerName.includes(dbName) || dbName.includes(normalizedPlayerName) ||
                normalizedEntryName.includes(dbName);
        });

        return matchedMember;
    };

    if (isLoading) {
        return (
            <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full flex flex-col items-center justify-center bg-[#111613]">
                <Zap className="w-10 h-10 animate-pulse text-[#22C55E] mb-4" />
                <h2 className="text-xl font-bold tracking-widest uppercase text-[#22C55E]">Syncing with Premier League Servers...</h2>
                <p className="text-gray-500 mt-2 text-sm font-bold tracking-tight">Fetching live Gameweek data from London.</p>
            </div>
        );
    }

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

            {error ? (
                <div className="w-full bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-center shadow-lg">
                    <p className="text-red-500 font-bold uppercase tracking-widest">{error}</p>
                    <p className="text-gray-400 text-sm mt-2">The official FPL API may be updating or CORS proxy failed.</p>
                </div>
            ) : (
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
                                const matchedMember = getMemberStatus(row.player_name, row.entry_name);
                                const hasPaid = matchedMember ? matchedMember.hasPaid : null;

                                return (
                                    <tr key={row.id} className={clsx(
                                        "hover:bg-white/[0.02] transition-colors",
                                        isTop1 && "bg-[#22c55e]/5",
                                        hasPaid === false && "opacity-60" // Dim row if unpaid in Red Zone
                                    )}>
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
                                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs uppercase
                                                ${isTop1 ? 'border-[#22c55e] bg-[#22c55e]/20 text-[#22c55e]' : 'border-white/10 bg-[#161d24] text-gray-400'} 
                                                ${isOut ? 'grayscale opacity-60' : ''}`}
                                                >
                                                    {row.player_name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`font-bold flex items-center gap-1.5 ${isOut ? 'text-gray-400' : 'text-white'}`}>
                                                        {row.player_name}
                                                        {/* The Chama Integration - Money Status Indicator */}
                                                        {hasPaid !== null && (
                                                            <Circle className={clsx("w-2 h-2 fill-current", hasPaid ? "text-[#22c55e]" : "text-red-500")} />
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 italic text-gray-400 font-medium">
                                            {row.entry_name}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className={clsx(
                                                "px-3 py-1.5 font-bold rounded-lg text-xs tabular-nums border",
                                                isTop1 ? "bg-[#22c55e] text-[#0a100a] border-transparent"
                                                    : "bg-[#161d24] text-[#FBBF24] border-white/5"
                                            )}>
                                                {row.event_total}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-5 text-center font-extrabold tabular-nums tracking-tight ${isOut ? 'text-gray-500' : 'text-white'}`}>
                                            {row.total.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-5 text-right flex flex-col items-end justify-center">
                                            <span className="font-medium text-gray-600">—</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Bottom Stats Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-[#151c18] border border-white/5 rounded-2xl flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Members</p>
                        <p className="text-2xl font-extrabold text-white">{standingsData.length || '--'} Players</p>
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
