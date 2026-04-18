import { useState, useEffect } from 'react';
import { Search, Download, Trophy, Star, Zap, Circle, Save, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import clsx from 'clsx';
import Header from '../components/Header';

const fetchFplStandings = async (leagueId: number) => {
    const fplUrl = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`;
    const endpoints = [
        `https://corsproxy.io/?${encodeURIComponent(fplUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(fplUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(fplUrl)}`,
    ];

    let lastError = 'Could not connect to FPL servers.';
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint);
            if (!response.ok) {
                lastError = `FPL API returned ${response.status}. League ID may be invalid.`;
                continue;
            }

            const data = await response.json();
            if (data?.standings?.results) {
                return data.standings.results;
            }
            lastError = 'FPL response format was unexpected.';
        } catch (err: any) {
            lastError = err?.message || 'Could not connect to FPL servers.';
        }
    }

    throw new Error(lastError);
};

export default function Standings() {
    const role = useStore(state => state.role);
    const [standingsData, setStandingsData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [leagueName, setLeagueName] = useState('');
    const [chairmanId, setChairmanId] = useState<string | null>(null);
    const [coAdminId, setCoAdminId] = useState<string | null>(null);
    const [dbFplLeagueId, setDbFplLeagueId] = useState<number | null>(null);
    const [inputFplLeagueId, setInputFplLeagueId] = useState('');
    const [isSavingFplId, setIsSavingFplId] = useState(false);
    const [currentEvent, setCurrentEvent] = useState<number | null>(null);
    const [gwWinnersLedger, setGwWinnersLedger] = useState<Array<{ gw: number; winnerName: string; winnerTeam?: string | null; amount?: number | null }>>([]);

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
                    setLeagueName(lData.leagueName || lData.name || 'League');
                    if (lData.chairmanId) setChairmanId(lData.chairmanId);
                    if (lData.coAdminId) setCoAdminId(lData.coAdminId);
                    if (lData.fplLeagueId) {
                        setDbFplLeagueId(lData.fplLeagueId);
                        targetFplId = lData.fplLeagueId;
                    }
                }

                const results = await fetchFplStandings(targetFplId);
                setStandingsData(results);
                setError(null);

                const txSnap = await getDocs(collection(db, 'leagues', activeLeagueId, 'transactions'));
                const payoutRows = txSnap.docs
                    .map((txDoc) => txDoc.data() as any)
                    .filter((tx) => tx.type === 'payout' && Number.isFinite(Number(tx.gameweek || tx.gw)));

                const winnerByGw = new Map<number, { gw: number; winnerName: string; winnerTeam?: string | null; amount?: number | null }>();
                payoutRows.forEach((tx) => {
                    const gw = Number(tx.gameweek || tx.gw);
                    if (!Number.isFinite(gw) || gw <= 0 || gw > 38 || winnerByGw.has(gw)) return;
                    winnerByGw.set(gw, {
                        gw,
                        winnerName: tx.winnerName || 'Unknown winner',
                        winnerTeam: tx.winnerTeam || tx.entryName || null,
                        amount: Number(tx.amount || 0),
                    });
                });

                const ledger = Array.from({ length: 38 }, (_, index) => {
                    const gw = index + 1;
                    return winnerByGw.get(gw) || { gw, winnerName: 'Pending' };
                });
                setGwWinnersLedger(ledger);
            } catch (err: any) {
                console.error('FPL Fetch Error:', err);
                setError(err.message || 'Could not connect to FPL servers.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchFPLStandings();
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    useEffect(() => {
        const fetchCurrentEvent = async () => {
            try {
                const bootstrapUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
                const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(bootstrapUrl)}`);
                if (!response.ok) return;
                const data = await response.json();
                const current = (data?.events || []).find((event: any) => event.is_current);
                if (current?.id) setCurrentEvent(current.id);
            } catch (err) {
                console.warn('Could not fetch current FPL event', err);
            }
        };
        fetchCurrentEvent();
    }, []);

    const getMemberStatus = (playerName: string, entryName: string, entryId: number) => {
        const norm = (s: string) => s.toLowerCase().trim();
        return members.find(m => {
            if (m.fplTeamId && Number(m.fplTeamId) === Number(entryId)) return true;
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

    const exportStandingsCSV = () => {
        const rows = [
            ['Rank', 'Member', 'Team', 'GW Points', 'Total Points'],
            ...standingsData.map((row: any) => [
                row.rank || '',
                row.player_name || '',
                row.entry_name || '',
                row.event_total || 0,
                row.total || 0,
            ])
        ];
        const csv = rows.map((r) => r.map(String).map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${(leagueName || 'league').replace(/\s/g, '_')}_standings.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const currentGwAverage = standingsData.length > 0
        ? (standingsData.reduce((sum, row) => sum + row.event_total, 0) / standingsData.length).toFixed(1)
        : '0.0';

    const gwWinner = standingsData.length > 0
        ? standingsData.reduce((prev: any, current: any) => (prev.event_total > current.event_total) ? prev : current)
        : null;
    const topSeasonLeaders = standingsData.slice(0, 5);
    const seasonPhase = currentEvent
        ? currentEvent >= 33
            ? 'Final Stretch'
            : currentEvent >= 20
                ? 'Mid Season'
                : 'Early Season'
        : 'In Progress';
    const currentGwLabel = currentEvent ? `GW${currentEvent}` : 'GW';

    if (isLoading) {
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center font-sans text-white bg-[#0a0e17]">
                <Zap className="w-10 h-10 animate-pulse text-[#10B981] mb-4" />
                <h2 className="text-xl font-bold tracking-widest uppercase text-[#10B981]">Syncing with FPL Servers...</h2>
                <p className="text-gray-500 mt-2 text-sm font-medium">Fetching live Gameweek data.</p>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen w-full font-sans text-white relative overflow-hidden bg-[#0a0e17]"
        >
            {/* ── Ambient background grid ─────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none z-0" />
            <div className="fixed bottom-0 left-0 w-full h-[600px] pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 0% 100%, rgba(16,185,129,0.05) 0%, rgba(10,14,23,0) 60%)' }} />

            <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-6 md:py-10 space-y-8 pb-28">
                {/* Header — matches other pages */}
                <Header role={role || 'member'} title={leagueName || 'League'} subtitle="Gameweek Rankings" />

                {/* Page Title row */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 mb-1">
                            <Trophy className="w-7 h-7 text-[#FBBF24]" /> Live Standings
                        </h2>
                        <p className="text-gray-400 text-sm font-medium max-w-xl leading-relaxed">
                            Real-time FPL performance rankings for your active league.
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
                        <button onClick={exportStandingsCSV} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-xl transition whitespace-nowrap">
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {/* Quick Fix Inline FPL ID Linker */}
                {role === 'admin' && (!dbFplLeagueId || error) && (
                    <div className="fc-card bg-[#10B981]/10 border border-[#10B981]/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-[#10B981] flex items-center gap-2 mb-1">
                                <Zap className="w-5 h-5" /> {error ? 'Update FPL League Link' : 'Link Official FPL League'}
                            </h3>
                            <p className="text-sm text-gray-300">Paste your full FPL Standings URL (e.g. fantasy.premierleague.com/leagues/123456/standings).</p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="Paste Standings URL..."
                                value={inputFplLeagueId}
                                onChange={(e) => {
                                    let val = e.target.value.trim();
                                    const match = val.match(/leagues\/(\d+)\/standings/);
                                    if (match && match[1]) val = match[1];
                                    setInputFplLeagueId(val.replace(/\D/g, ''));
                                }}
                                className="w-full sm:w-64 bg-[#161d24] border border-[#10B981]/30 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#10B981]"
                            />
                            <button
                                onClick={handleSaveFplId}
                                disabled={isSavingFplId || !inputFplLeagueId}
                                className="bg-[#10B981] text-black px-4 py-2 rounded-xl font-bold flex flex-shrink-0 items-center gap-2 hover:bg-[#10B981]/90 disabled:opacity-50 transition-colors text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            >
                                <Save className="w-4 h-4" /> Save Link
                            </button>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="fc-card bg-[#161d24] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Members</p>
                            <p className="text-2xl font-black text-white">{standingsData.length || '--'} <span className="text-sm font-bold text-gray-400">Players</span></p>
                        </div>
                        <Trophy className="w-9 h-9 text-gray-700" />
                    </div>
                    <div className="fc-card bg-[#161d24] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">GW Average</p>
                            <p className="text-2xl font-black text-white">{currentGwAverage} <span className="text-sm font-bold text-gray-400">pts</span></p>
                        </div>
                        <Star className="w-9 h-9 text-gray-700" />
                    </div>
                </div>

                {/* GW Winner */}
                {!error && standingsData.length > 0 && (
                    <div className="grid grid-cols-1 gap-6 mt-6">
                        {/* Live Gameweek Winner Gold UI */}
                        {gwWinner && (
                            <div className="fc-card fc-highlight-card bg-gradient-to-br from-[#FBBF24]/10 via-[#F59E0B]/5 to-transparent border border-[#FBBF24]/30 rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] transition-all animate-in zoom-in-95 duration-500 min-h-[180px]">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FBBF24] blur-[100px] opacity-10 pointer-events-none"></div>
                                <div className="relative z-10 flex items-start gap-4 mb-4">
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FBBF24] to-[#B45309] p-[2px] shadow-lg flex-shrink-0 animate-pulse">
                                        <div className="w-full h-full bg-[#0b1014] rounded-full flex items-center justify-center border-2 border-[#0b1014]">
                                            <Trophy className="w-6 h-6 text-[#FBBF24]" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-[#FBBF24] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                            <Star className="w-3 h-3 fill-current" /> {currentGwLabel} Champion
                                        </p>
                                        <h3 className="text-xl md:text-2xl font-black text-white leading-tight tracking-tight">{gwWinner.player_name}</h3>
                                        <p className="text-sm font-bold text-gray-400 mt-0.5">{gwWinner.entry_name} </p>
                                    </div>
                                </div>

                                <div className="relative z-10 flex items-center justify-between fc-highlight-surface p-4 rounded-2xl border backdrop-blur-sm">
                                    <p className="text-[10px] font-black fc-meta-label uppercase tracking-widest">GW Score</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[#10B981] font-black text-lg bg-[#10B981]/10 px-3 py-1 rounded-xl border border-[#10B981]/20 tabular-nums">{gwWinner.event_total} pts</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!error && topSeasonLeaders.length > 0 && (
                    <div className="fc-card bg-[#161d24] border border-white/5 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="text-sm md:text-base font-black text-white tracking-tight">Season Race Snapshot</h3>
                            <div className="flex items-center gap-2">
                                {currentEvent && (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-[#FBBF24]/25 bg-[#FBBF24]/10 text-[#FBBF24]">
                                        {currentGwLabel}
                                    </span>
                                )}
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]">
                                    {seasonPhase}
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                            {topSeasonLeaders.map((leader: any, idx: number) => (
                                <div key={leader.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                    <p className="text-[9px] uppercase tracking-widest font-black text-gray-500 mb-1">#{idx + 1}</p>
                                    <p className="text-xs font-black text-white truncate">{leader.player_name}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{leader.entry_name}</p>
                                    <p className="text-sm font-black text-[#10B981] tabular-nums mt-1">{leader.total.toLocaleString()} pts</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!error && gwWinnersLedger.length > 0 && (
                    <div className="fc-card bg-[#161d24] border border-white/5 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="text-sm md:text-base font-black text-white tracking-tight">Gameweek Winners Ledger</h3>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">GW 1-38</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            {gwWinnersLedger.map((item) => {
                                const resolved = item.winnerName !== 'Pending';
                                return (
                                    <div key={item.gw} className={clsx(
                                        'rounded-xl border p-3',
                                        resolved ? 'border-emerald-500/25 bg-emerald-500/8' : 'border-white/10 bg-black/20'
                                    )}>
                                        <p className="text-[9px] uppercase tracking-widest font-black text-gray-500 mb-1">GW {item.gw}</p>
                                        <p className={clsx('text-xs font-black truncate', resolved ? 'text-white' : 'text-gray-500')}>
                                            {item.winnerName}
                                        </p>
                                        <p className="text-[10px] text-gray-400 truncate mt-1">{item.winnerTeam || (resolved ? 'Winner recorded' : 'Not resolved')}</p>
                                        {resolved && typeof item.amount === 'number' && item.amount > 0 && (
                                            <p className="text-[10px] font-black text-[#FBBF24] mt-1">KES {item.amount.toLocaleString()}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Table */}
                {error ? (
                    <div className="fc-card w-full bg-[#161d24] border border-red-500/20 p-8 rounded-[2rem] text-center relative overflow-hidden mt-6">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500 blur-[80px] opacity-10 pointer-events-none"></div>
                        <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-4" />
                        <h3 className="text-xl font-black text-white mb-2">Sync Interrupted</h3>
                        <p className="text-red-400 font-bold mb-4 text-sm">{error}</p>
                        <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
                            {role === 'admin' 
                                ? "This usually happens if your FPL League ID is incorrect or missing. Use the green 'Update FPL League Link' box above to paste your exact Standings URL and restore the connection."
                                : "The Chairman needs to update the FPL League link, or the official FPL servers are undergoing maintenance."}
                        </p>
                    </div>
                ) : (
                    <div className="fc-card w-full overflow-x-auto bg-[#161d24] border border-white/5 rounded-2xl">
                        <table className="w-full min-w-[700px] text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-black/20">
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase">Rank</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase">Member</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase">FPL Team</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase text-center">GW Pts</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase text-center">Total</th>
                                    <th className="px-5 py-4 font-bold text-[10px] text-[#10B981] tracking-widest uppercase text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {standingsData.map((row: any, index: number) => {
                                    const isTop1 = index === 0;
                                    const matchedMember = getMemberStatus(row.player_name, row.entry_name, row.entry);
                                    const hasPaid = matchedMember ? matchedMember.hasPaid : null;
                                    return (
                                        <tr key={row.id} className={clsx(
                                            'transition-colors',
                                            isTop1 ? 'bg-[#10B981]/5' : 'hover:bg-white/[0.02]',
                                            gwWinner && row.id === gwWinner.id && !isTop1 ? 'bg-[#FBBF24]/5' : '',
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
                                                        {matchedMember ? (
                                                            <img
                                                                src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(matchedMember as any).avatarSeed || matchedMember.displayName}&backgroundColor=transparent`}
                                                                alt={matchedMember.displayName}
                                                                className="w-full h-full rounded-full object-cover"
                                                            />
                                                        ) : row.player_name.charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                                        {row.player_name}
                                                        {matchedMember?.id === chairmanId && (
                                                            <span className="bg-[#FBBF24]/10 text-[#FBBF24] text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-[#FBBF24]/30 flex items-center gap-1">
                                                                <ShieldAlert className="w-2.5 h-2.5" /> Chairman
                                                            </span>
                                                        )}
                                                        {matchedMember?.id === coAdminId
                                                            && matchedMember.id !== chairmanId
                                                            && matchedMember.isActive !== false
                                                            && (matchedMember.role === 'co-chair' || matchedMember.role === 'admin') && (
                                                            <span className="bg-[#3B82F6]/10 text-[#3B82F6] text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-[#3B82F6]/30 flex items-center gap-1">
                                                                <ShieldCheck className="w-2.5 h-2.5" /> Co-Chair
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
                                                    {gwWinner && row.id === gwWinner.id
                                                    ? <span className="font-black text-[#FBBF24] text-xs tracking-tight border border-[#FBBF24]/20 bg-[#FBBF24]/10 px-2 py-1 rounded-lg">{currentGwLabel} Winner</span>
                                                    : <span className="text-gray-600">—</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                                {standingsData.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-10 text-center text-gray-500 font-bold text-sm">
                                            No standings returned yet. Try updating the FPL league link and syncing again.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
