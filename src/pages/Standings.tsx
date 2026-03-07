import { useState, useEffect } from 'react';
import { Search, Download, Trophy, Star, Zap, Circle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import clsx from 'clsx';

export default function Standings() {
    const [standingsData, setStandingsData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [monthlyContribution, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });

    // Fallback/test FPL League ID if not tied to the Chama yet
    const fplLeagueId = 314;

    const members = useStore(state => state.members);
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    useEffect(() => {
        if (!activeLeagueId) return;

        if (members.length === 0) {
            listenToLeagueMembers(activeLeagueId);
        }

        const fetchFPLStandings = async () => {
            try {
                // Fetch League Settings for accurate Vault Calculations
                const leagueRef = doc(db, 'leagues', activeLeagueId);
                const leagueSnap = await getDoc(leagueRef);
                if (leagueSnap.exists()) {
                    const lData = leagueSnap.data();
                    if (lData.monthlyContribution) setMonthlyContribution(lData.monthlyContribution);
                    if (lData.rules) setRules(lData.rules);
                }

                // Fetch FPL Standings via CORS Proxy
                const fplUrl = `https://fantasy.premierleague.com/api/leagues-classic/${fplLeagueId}/standings/`;
                const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(fplUrl)}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch FPL standings');
                }

                const originData = await response.json();
                const data = JSON.parse(originData.contents);

                if (data?.standings?.results) {
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

    // Calculate Dynamic Stats
    const currentGwAverage = standingsData.length > 0
        ? (standingsData.reduce((sum, row) => sum + row.event_total, 0) / standingsData.length).toFixed(1)
        : "0.0";

    const paidMembersCount = members.filter(m => m.hasPaid).length;
    const totalCollected = paidMembersCount * monthlyContribution;
    const grandVaultTotal = totalCollected * (rules.vault / 100);
    const weeklyPot = totalCollected * (rules.weekly / 100);

    if (isLoading) {
        return (
            <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full flex flex-col items-center justify-center bg-[#0b1014]">
                <Zap className="w-10 h-10 animate-pulse text-[#10B981] mb-4" />
                <h2 className="text-xl font-bold tracking-widest uppercase text-[#10B981]">Syncing with Premier League Servers...</h2>
                <p className="text-gray-500 mt-2 text-sm font-bold tracking-tight">Fetching live Gameweek data from London.</p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#0b1014]">
            <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3"><Trophy className="w-8 h-8 md:w-10 md:h-10 text-[#FBBF24]" /> Gameweek Rankings</h1>
                    <p className="text-gray-400 font-medium tracking-wide max-w-xl">
                        Real-time FPL performance integrated with the Chama's prize pool. Payouts are projected based on the current <span className="text-[#10B981] font-bold">Grand Vault</span> holdings.
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="relative group w-full sm:w-80">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-[#10B981] transition-colors">
                            <Search className="w-5 h-5" />
                        </span>
                        <input
                            type="text"
                            className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all placeholder:text-gray-500 text-white outline-none"
                            placeholder="Search members or teams..."
                        />
                    </div>
                    <button className="flex items-center gap-2 bg-[#10B981] hover:bg-[#10B981]/80 text-[#0b1014] px-5 py-3 rounded-xl font-bold transition-colors">
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
                <div className="w-full overflow-x-auto bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl">
                    <table className="w-full min-w-[800px] text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-[#11171a]/50">
                                <th className="px-6 py-5 font-bold text-[11px] text-[#10B981] tracking-widest uppercase">RANK</th>
                                <th className="px-6 py-5 font-bold text-[11px] text-[#10B981] tracking-widest uppercase">MEMBER NAME</th>
                                <th className="px-6 py-5 font-bold text-[11px] text-[#10B981] tracking-widest uppercase">FPL TEAM</th>
                                <th className="px-6 py-5 font-bold text-[11px] text-[#10B981] tracking-widest uppercase text-center">GW PTS</th>
                                <th className="px-6 py-5 font-bold text-[11px] text-[#10B981] tracking-widest uppercase text-center">TOTAL PTS</th>
                                <th className="px-6 py-5 font-bold text-[11px] text-[#10B981] tracking-widest uppercase text-right">PROJECTED PAYOUT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {standingsData.filter((row: any) => getMemberStatus(row.player_name, row.entry_name)).map((row: any, index: number) => {
                                const isTop1 = index === 0;
                                const isOut = index >= 5;
                                const matchedMember = getMemberStatus(row.player_name, row.entry_name);
                                const hasPaid = matchedMember ? matchedMember.hasPaid : null;

                                return (
                                    <tr key={row.id} className={clsx(
                                        "hover:bg-white/[0.02] transition-colors",
                                        isTop1 && "bg-[#10B981]/5",
                                        hasPaid === false && "opacity-60" // Dim row if unpaid in Red Zone
                                    )}>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-extrabold text-xl ${isTop1 ? 'text-[#10B981]' : isOut ? 'text-gray-600' : 'text-gray-400'}`}>
                                                    {row.rank}
                                                </span>
                                                {isTop1 && <Star className="w-5 h-5 fill-[#FBBF24] text-[#FBBF24]" />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs uppercase
                                                ${isTop1 ? 'border-[#10B981] bg-[#10B981]/20 text-[#10B981]' : 'border-white/10 bg-[#161d24] text-gray-400'} 
                                                ${isOut ? 'grayscale opacity-60' : ''}`}
                                                >
                                                    {row.player_name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`font-bold flex items-center gap-1.5 ${isOut ? 'text-gray-400' : 'text-white'}`}>
                                                        {row.player_name}
                                                        {/* The Chama Integration - Money Status Indicator */}
                                                        {hasPaid !== null && (
                                                            <Circle className={clsx("w-2 h-2 fill-current", hasPaid ? "text-[#10B981]" : "text-red-500")} />
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
                                                isTop1 ? "bg-[#10B981] text-[#0b1014] border-transparent"
                                                    : "bg-[#161d24] text-[#10B981] border-white/5"
                                            )}>
                                                {row.event_total}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-5 text-center font-extrabold tabular-nums tracking-tight ${isOut ? 'text-gray-500' : 'text-white'}`}>
                                            {row.total.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-5 text-right flex flex-col items-end justify-center">
                                            {isTop1 ? (
                                                <span className="font-black text-[#FBBF24]">KES {weeklyPot.toLocaleString()}</span>
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
            )}

            {/* Bottom Stats Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 md:p-8 bg-[#161d24] border border-white/5 rounded-[2xl] flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Members</p>
                        <p className="text-3xl font-black text-white">{standingsData.length || '--'} Players</p>
                    </div>
                    <Trophy className="w-10 h-10 text-gray-700" />
                </div>
                <div className="p-6 md:p-8 bg-[#161d24] border border-white/5 rounded-[2xl] flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Current GW Average</p>
                        <p className="text-3xl font-black text-white">{currentGwAverage} pts</p>
                    </div>
                    <Star className="w-10 h-10 text-gray-700" />
                </div>
                <div className="p-6 md:p-8 bg-gradient-to-br from-[#1c272c] to-[#11171a] border border-[#10B981]/30 rounded-[2xl] flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.1)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-[#10B981] blur-[100px] opacity-20 transform translate-x-10 -translate-y-10 group-hover:opacity-30 transition-opacity duration-500"></div>
                    <div className="relative z-10">
                        <p className="text-[10px] md:text-xs font-bold text-[#10B981] uppercase tracking-widest mb-1">Grand Vault Total</p>
                        <p className="text-3xl font-black text-white">KES {grandVaultTotal.toLocaleString()}</p>
                    </div>
                    <div className="relative z-10 w-12 h-12 rounded-full bg-[#10B981]/20 flex items-center justify-center border border-[#10B981]/30">
                        <div className="w-4 h-4 rounded-full bg-[#10B981] animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
