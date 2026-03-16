import { useState, useEffect } from 'react';
import { Search, Download, Trophy, Star, Zap, Circle, Save, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import clsx from 'clsx';
import Header from '../components/Header';

const role = localStorage.getItem('activeRole') || 'member';

export default function Standings() {
    const [standingsData, setStandingsData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [monthlyContribution, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });
    const [leagueName, setLeagueName] = useState('');
    const [chairmanId, setChairmanId] = useState<string | null>(null);
    const [coAdminId, setCoAdminId] = useState<string | null>(null);
    const [dbFplLeagueId, setDbFplLeagueId] = useState<number | null>(null);
    const [inputFplLeagueId, setInputFplLeagueId] = useState('');
    const [isSavingFplId, setIsSavingFplId] = useState(false);

    const fallbackFplLeagueId = 314;

    const members = useStore(state => state.members);
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    useEffect(() => {
        if (!activeLeagueId) return;
        if (members.length === 0) listenToLeagueMembers(activeLeagueId);

        const fetchFPLStandings = async () => {
            try {
                const leagueRef = doc(db, 'leagues', activeLeagueId);
                const leagueSnap = await getDoc(leagueRef);
                let targetFplId = fallbackFplLeagueId;
                if (leagueSnap.exists()) {
                    const lData = leagueSnap.data();
                    if (lData.monthlyContribution) setMonthlyContribution(lData.monthlyContribution);
                    if (lData.rules) setRules(lData.rules);
                    if (lData.name) setLeagueName(lData.name);
                    if (lData.chairmanId) setChairmanId(lData.chairmanId);
                    if (lData.coAdminId) setCoAdminId(lData.coAdminId);
                    if (lData.fplLeagueId) {
                        setDbFplLeagueId(lData.fplLeagueId);
                        targetFplId = lData.fplLeagueId;
                    }
                }

                const fplUrl = `https://fantasy.premierleague.com/api/leagues-classic/${targetFplId}/standings/`;
                const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(fplUrl)}`);

                if (!response.ok) throw new Error('Failed to fetch FPL standings');

                const originData = await response.json();
                const data = JSON.parse(originData.contents);

                if (data?.standings?.results) {
                    setStandingsData(data.standings.results);
                } else {
                    setStandingsData([]);
                }
            } catch (err: any) {
                console.error('FPL Fetch Error:', err);
                setError(err.message || 'Could not connect to FPL servers.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchFPLStandings();
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    const getMemberStatus = (playerName: string, entryName: string) => {
        const norm = (s: string) => s.toLowerCase().trim();
        return members.find(m => {
            const db = norm(m.displayName);
            return norm(playerName).includes(db) || db.includes(norm(playerName)) || norm(entryName).includes(db);
        });
    };

    const handleSaveFplId = async () => {
        if (!inputFplLeagueId || isNaN(Number(inputFplLeagueId))) return;
        if (!activeLeagueId) return;
        setIsSavingFplId(true);
        try {
            const leagueRef = doc(db, 'leagues', activeLeagueId);
            await updateDoc(leagueRef, { fplLeagueId: Number(inputFplLeagueId) });
            setDbFplLeagueId(Number(inputFplLeagueId));
            window.location.reload(); 
        } catch (err) {
            console.error("Failed to save FPL ID", err);
        } finally {
            setIsSavingFplId(false);
        }
    };

    const currentGwAverage = standingsData.length > 0
        ? (standingsData.reduce((sum, row) => sum + row.event_total, 0) / standingsData.length).toFixed(1)
        : '0.0';

    const paidMembersCount = members.filter(m => m.hasPaid && m.isActive !== false).length;
    const totalCollected = paidMembersCount * monthlyContribution;
    const grandVaultTotal = totalCollected * (rules.vault / 100);
    const weeklyPot = totalCollected * (rules.weekly / 100);

    if (isLoading) {
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center font-sans text-white"
                style={{ background: '#0A0E17' }}>
                <Zap className="w-10 h-10 animate-pulse text-[#10B981] mb-4" />
                <h2 className="text-xl font-bold tracking-widest uppercase text-[#10B981]">Syncing with FPL Servers...</h2>
                <p className="text-gray-500 mt-2 text-sm font-medium">Fetching live Gameweek data.</p>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen w-full font-sans text-white relative overflow-hidden"
            style={{ background: '#0A0E17' }}
        >
            {/* ── Ambient background grid ─────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none z-0" />
            <div className="fixed bottom-0 left-0 w-full h-[600px] pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 0% 100%, rgba(16,185,129,0.05) 0%, rgba(10,14,23,0) 60%)' }} />

            <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-6 md:py-10 space-y-8 pb-28">
                {/* Header — matches other pages */}
                <Header role={role} title={leagueName || 'The Big League'} subtitle="Gameweek Rankings" />

                {/* Page Title row */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 mb-1">
                            <Trophy className="w-7 h-7 text-[#FBBF24]" /> Live Standings
                        </h2>
                        <p className="text-gray-400 text-sm font-medium max-w-xl leading-relaxed">
                            Real-time FPL performance integrated with your Chama's prize pool. Payouts projected from the{' '}
                            <span className="text-[#10B981] font-bold">Grand Vault</span>.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <div className="relative group">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-[#10B981] transition-colors">
                                <Search className="w-4 h-4" />
                            </span>
                            <input
                                type="text"
                                className="w-full sm:w-72 bg-[#161d24] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all placeholder:text-gray-600 text-white outline-none shadow-lg"
                                placeholder="Search members or teams..."
                            />
                        </div>
                        <button className="flex items-center gap-2 bg-[#10B981] hover:bg-[#10B981]/80 text-black px-4 py-2.5 rounded-xl font-bold transition-colors text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)] whitespace-nowrap">
                            <Download className="w-4 h-4" /> CSV
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {role === 'admin' && !dbFplLeagueId && (
                    <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-[#10B981] flex items-center gap-2 mb-1">
                                <Zap className="w-5 h-5" /> Link Official FPL League
                            </h3>
                            <p className="text-sm text-gray-300">Enter your official FPL League ID to sync live points automatically.</p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <input
                                type="text"
                                placeholder="e.g. 314"
                                value={inputFplLeagueId}
                                onChange={(e) => setInputFplLeagueId(e.target.value.replace(/\D/g, ''))}
                                className="w-full sm:w-48 bg-[#161d24] border border-[#10B981]/30 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#10B981]"
                            />
                            <button
                                onClick={handleSaveFplId}
                                disabled={isSavingFplId || !inputFplLeagueId}
                                className="bg-[#10B981] text-black px-4 py-2 rounded-xl font-bold flex flex-shrink-0 items-center gap-2 hover:bg-[#10B981]/90 disabled:opacity-50 transition-colors"
                            >
                                <Save className="w-4 h-4" /> Save ID
                            </button>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#161d24] border border-white/5 rounded-2xl p-5 shadow-2xl shadow-black/50 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Members</p>
                            <p className="text-2xl font-black text-white">{standingsData.length || '--'} <span className="text-sm font-bold text-gray-400">Players</span></p>
                        </div>
                        <Trophy className="w-9 h-9 text-gray-700" />
                    </div>
                    <div className="bg-[#161d24] border border-white/5 rounded-2xl p-5 shadow-2xl shadow-black/50 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">GW Average</p>
                            <p className="text-2xl font-black text-white">{currentGwAverage} <span className="text-sm font-bold text-gray-400">pts</span></p>
                        </div>
                        <Star className="w-9 h-9 text-gray-700" />
                    </div>
                    <div className="bg-[#161d24] border border-[#10B981]/20 rounded-2xl p-5 shadow-2xl shadow-black/50 flex items-center justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981] blur-[80px] opacity-10 translate-x-10 -translate-y-10" />
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold text-[#10B981] uppercase tracking-widest mb-1">Grand Vault</p>
                            <p className="text-2xl font-black text-white">KES {grandVaultTotal.toLocaleString()}</p>
                        </div>
                        <div className="relative z-10 w-9 h-9 rounded-full bg-[#10B981]/20 border border-[#10B981]/30 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-[#10B981] animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Table */}
                {error ? (
                    <div className="w-full bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-center shadow-lg">
                        <p className="text-red-400 font-bold uppercase tracking-widest">{error}</p>
                        <p className="text-gray-500 text-sm mt-2">The FPL API may be updating or CORS proxy failed.</p>
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto bg-[#161d24] border border-white/5 rounded-2xl shadow-2xl shadow-black/50">
                        <table className="w-full min-w-[700px] text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-black/20">
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase">Rank</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase">Member</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase">FPL Team</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase text-center">GW Pts</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase text-center">Total</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase text-right">Payout</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {standingsData.filter((row: any) => getMemberStatus(row.player_name, row.entry_name)).map((row: any, index: number) => {
                                    const isTop1 = index === 0;
                                    const matchedMember = getMemberStatus(row.player_name, row.entry_name);
                                    const hasPaid = matchedMember ? matchedMember.hasPaid : null;
                                    return (
                                        <tr key={row.id} className={clsx(
                                            'transition-colors',
                                            isTop1 ? 'bg-[#10B981]/5' : 'hover:bg-white/[0.02]',
                                            hasPaid === false && 'opacity-50'
                                        )}>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx('font-extrabold text-lg', isTop1 ? 'text-[#10B981]' : 'text-gray-500')}>{row.rank}</span>
                                                    {isTop1 && <Star className="w-4 h-4 fill-[#FBBF24] text-[#FBBF24]" />}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={clsx(
                                                        'w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs',
                                                        isTop1 ? 'border-[#10B981]/50 bg-[#10B981]/10 text-[#10B981]' : 'border-white/10 bg-white/5 text-gray-400'
                                                    )}>
                                                        {row.player_name.charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                                        {row.player_name}
                                                        {matchedMember?.id === chairmanId && (
                                                            <span className="bg-[#FBBF24]/10 text-[#FBBF24] text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-[#FBBF24]/30 flex items-center gap-1">
                                                                <ShieldAlert className="w-2.5 h-2.5" /> Chairman
                                                            </span>
                                                        )}
                                                        {matchedMember?.id === coAdminId && (
                                                            <span className="bg-[#3B82F6]/10 text-[#3B82F6] text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-[#3B82F6]/30 flex items-center gap-1">
                                                                <ShieldCheck className="w-2.5 h-2.5" /> Co-Admin
                                                            </span>
                                                        )}
                                                        {hasPaid !== null && (
                                                            <Circle className={clsx('w-2 h-2 fill-current ml-1', hasPaid ? 'text-[#10B981]' : 'text-red-500')} />
                                                        )}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-gray-400 text-sm italic">{row.entry_name}</td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={clsx(
                                                    'px-3 py-1 font-bold rounded-lg text-xs tabular-nums border',
                                                    isTop1
                                                        ? 'bg-[#10B981] text-black border-transparent'
                                                        : 'bg-white/5 text-[#10B981] border-white/5'
                                                )}>
                                                    {row.event_total}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-center font-extrabold text-white tabular-nums">{row.total.toLocaleString()}</td>
                                            <td className="px-5 py-4 text-right">
                                                {isTop1
                                                    ? <span className="font-black text-[#FBBF24] text-sm">KES {weeklyPot.toLocaleString()}</span>
                                                    : <span className="text-gray-600">—</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
