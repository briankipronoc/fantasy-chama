// src/components/TeamPicksModal.tsx
import { useEffect, useState, useMemo } from 'react';
import { X, Trophy, Shirt, ArrowRight, Zap, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, User } from 'lucide-react';
import clsx from 'clsx';
import UserAvatar from './UserAvatar';

interface TeamPicksModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamId: number | null;
    teamName: string;
    managerName: string;
    gameweek: number;
    myTeamId?: number | null;
    myTeamName?: string;
    myManagerName?: string;
    onSelectTeam?: (teamId: number, teamName: string, managerName: string) => void;
}

interface PlayerPick {
    element: number;
    position: number;
    multiplier: number;
    is_captain: boolean;
    is_vice_captain: boolean;
}

interface PlayerDetails {
    id: number;
    web_name: string;
    element_type: number; // 1: GKP, 2: DEF, 3: MID, 4: FWD
    team: number;
    team_short: string;
    points: number;
    minutes?: number;
    goals?: number;
    assists?: number;
}



export default function TeamPicksModal({
    isOpen,
    onClose,
    teamId,
    teamName,
    managerName,
    gameweek,
    myTeamId,
    myTeamName,
    myManagerName,
    onSelectTeam
}: TeamPicksModalProps) {
    const [selectedGw, setSelectedGw] = useState<number>(gameweek || 1);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [picks, setPicks] = useState<PlayerPick[]>([]);
    const [entryHistory, setEntryHistory] = useState<any>(null);
    const [activeChip, setActiveChip] = useState<string | null>(null);
    const [playersMap, setPlayersMap] = useState<Record<number, PlayerDetails>>({});

    useEffect(() => {
        if (gameweek) setSelectedGw(gameweek);
    }, [gameweek, teamId]);

    useEffect(() => {
        if (!isOpen || !teamId) return;

        let isMounted = true;
        setLoading(true);
        setError(null);

        const fetchTeamLineup = async () => {
            try {
                // 1. Fetch bootstrap-static (elements & teams) with local storage cache
                let elements: any[] = [];
                let teamsList: any[] = [];
                const cachedBootstrap = localStorage.getItem('fpl_bootstrap_static_cache');
                let useCached = false;

                if (cachedBootstrap) {
                    try {
                        const { timestamp, data } = JSON.parse(cachedBootstrap);
                        if (Date.now() - timestamp < 3600000 && data.elements && data.teams) {
                            elements = data.elements;
                            teamsList = data.teams;
                            useCached = true;
                        }
                    } catch {}
                }

                if (!useCached) {
                    try {
                        const bResp = await fetch('/fpl-api/bootstrap-static/');
                        if (bResp.ok) {
                            const bData = await bResp.json();
                            elements = bData.elements || [];
                            teamsList = bData.teams || [];
                            localStorage.setItem('fpl_bootstrap_static_cache', JSON.stringify({
                                timestamp: Date.now(),
                                data: { elements, teams: teamsList }
                            }));
                        }
                    } catch (e) {
                        console.warn('[TeamPicks] bootstrap-static fetch error, fallback to cache:', e);
                    }
                }

                const teamShortNames: Record<number, string> = {};
                for (const t of teamsList) {
                    teamShortNames[t.id] = t.short_name || t.name;
                }

                // 2. Fetch live event points for current GW
                const livePointsMap: Record<number, { points: number, minutes: number, goals: number, assists: number }> = {};
                try {
                    const liveResp = await fetch(`/fpl-api/event/${selectedGw}/live/`);
                    if (liveResp.ok) {
                        const liveData = await liveResp.json();
                        for (const el of liveData.elements || []) {
                            livePointsMap[el.id] = {
                                points: Number(el.stats?.total_points || 0),
                                minutes: Number(el.stats?.minutes || 0),
                                goals: Number(el.stats?.goals_scored || 0),
                                assists: Number(el.stats?.assists || 0)
                            };
                        }
                    }
                } catch (e) {
                    console.warn('[TeamPicks] Live points fetch error:', e);
                }

                // 3. Fetch entry picks for target GW
                const picksResp = await fetch(`/fpl-api/entry/${teamId}/event/${selectedGw}/picks/`);
                if (!picksResp.ok) {
                    if (picksResp.status === 404) {
                        throw new Error(`Team picks for GW${selectedGw} are not available yet (deadline pending or invalid round).`);
                    }
                    throw new Error(`Could not load picks for GW${selectedGw} (HTTP ${picksResp.status}).`);
                }

                const picksData = await picksResp.json();
                if (!isMounted) return;

                setPicks(picksData.picks || []);
                setEntryHistory(picksData.entry_history || null);
                setActiveChip(picksData.active_chip || null);

                // Build fast lookup player details
                const pMap: Record<number, PlayerDetails> = {};
                for (const p of elements) {
                    const liveStats = livePointsMap[p.id];
                    pMap[p.id] = {
                        id: p.id,
                        web_name: p.web_name,
                        element_type: p.element_type,
                        team: p.team,
                        team_short: teamShortNames[p.team] || 'PL',
                        points: liveStats !== undefined ? liveStats.points : Number(p.event_points || 0),
                        minutes: liveStats?.minutes,
                        goals: liveStats?.goals,
                        assists: liveStats?.assists
                    };
                }
                setPlayersMap(pMap);
                setLoading(false);
            } catch (err: any) {
                if (isMounted) {
                    setError(err?.message || 'Failed to load manager lineup.');
                    setLoading(false);
                }
            }
        };

        fetchTeamLineup();

        return () => {
            isMounted = false;
        };
    }, [isOpen, teamId, selectedGw]);

    // Separate starters (positions 1-11) and bench (positions 12-15)
    const { starters, bench, formationString } = useMemo(() => {
        const startList = picks.filter(p => p.position <= 11);
        const benchList = picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position);

        const gkp = startList.filter(p => playersMap[p.element]?.element_type === 1);
        const def = startList.filter(p => playersMap[p.element]?.element_type === 2);
        const mid = startList.filter(p => playersMap[p.element]?.element_type === 3);
        const fwd = startList.filter(p => playersMap[p.element]?.element_type === 4);

        const formation = `${def.length}-${mid.length}-${fwd.length}`;

        return {
            starters: { gkp, def, mid, fwd },
            bench: benchList,
            formationString: formation
        };
    }, [picks, playersMap]);

    // Calculate live starting total with captain multipliers
    const calculatedGwScore = useMemo(() => {
        if (!picks.length) return 0;
        let total = 0;
        // If bench boost is active, all 15 score!
        const scoringPicks = activeChip === 'bboost' ? picks : picks.filter(p => p.position <= 11);
        for (const p of scoringPicks) {
            const player = playersMap[p.element];
            const pts = (player?.points || 0) * (p.multiplier || 1);
            total += pts;
        }
        return total;
    }, [picks, playersMap, activeChip]);

    const transferCost = entryHistory?.event_transfers_cost || 0;
    const netGwScore = calculatedGwScore - transferCost;
    const isViewingMyself = myTeamId && Number(teamId) === Number(myTeamId);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/75 backdrop-blur-xl animate-in fade-in duration-200">
            <div 
                className="relative w-full max-w-2xl bg-white dark:bg-[#0e141a] border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] text-slate-900 dark:text-white"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#131b23] relative">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300 dark:border-white/15 text-xs font-bold text-slate-700 dark:text-white hover:text-slate-900 dark:hover:text-emerald-300 transition-all cursor-pointer active:scale-95 shadow-xs"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Back</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300 dark:border-white/15 flex items-center justify-center text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer active:scale-90"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar name={managerName} size="md" />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">{managerName}</h3>
                                    {isViewingMyself && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                                            You
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate">
                                    {teamName}
                                </p>
                            </div>
                        </div>

                        {/* Gameweek Navigator */}
                        <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-[#0c1218] border border-slate-300 dark:border-white/15 rounded-xl p-1 self-start sm:self-auto shadow-inner">
                            <button
                                onClick={() => setSelectedGw(prev => Math.max(1, prev - 1))}
                                disabled={selectedGw <= 1}
                                className="p-1 rounded-lg text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer transition-colors"
                                title="Previous Gameweek"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-black px-2 py-0.5 text-slate-900 dark:text-white tracking-wider">
                                GW {selectedGw}
                            </span>
                            <button
                                onClick={() => setSelectedGw(prev => Math.min(38, prev + 1))}
                                disabled={selectedGw >= (gameweek || 38)}
                                className="p-1 rounded-lg text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer transition-colors"
                                title="Next Gameweek"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Stats & Chip Ribbon */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap mt-3 pt-2.5 border-t border-slate-200 dark:border-white/10 text-[11px] sm:text-xs">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200 font-bold">
                            <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>GW Points:</span>
                            <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">{calculatedGwScore}</span>
                        </div>

                        {transferCost > 0 && (
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 dark:bg-rose-500/20 border border-rose-500/30 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 font-bold">
                                <span>Hit: -{transferCost} pts</span>
                            </div>
                        )}

                        {transferCost > 0 && (
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-gray-200 font-bold">
                                <span>Net: {netGwScore} pts</span>
                            </div>
                        )}

                        {activeChip && (
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-900 dark:text-amber-300 font-black uppercase text-[9.5px] tracking-wider animate-pulse">
                                <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                                {activeChip === 'bboost' && 'Bench Boost Active'}
                                {activeChip === '3xc' && 'Triple Captain Active'}
                                {activeChip === 'freehit' && 'Free Hit Active'}
                                {activeChip === 'wildcard' && 'Wildcard Played'}
                            </div>
                        )}

                        <span className="text-slate-600 dark:text-gray-300 text-[10px] ml-auto font-mono font-bold bg-slate-200/60 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-300/50 dark:border-white/10">
                            Formation: {formationString}
                        </span>
                    </div>
                </div>

                {/* Modal Body / Pitch View */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-gray-400">
                            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 dark:text-emerald-400" />
                            <p className="text-xs font-bold uppercase tracking-wider">Loading team lineup...</p>
                        </div>
                    ) : error ? (
                        <div className="py-14 px-6 text-center space-y-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Lineup Unavailable</h4>
                            <p className="text-xs text-slate-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* Visual Pitch */}
                            <div className="relative rounded-2xl sm:rounded-3xl p-3 sm:p-5 overflow-hidden border border-emerald-500/30 dark:border-emerald-500/30 bg-gradient-to-b from-[#15803d] via-[#166534] to-[#14532d] dark:from-[#0a4524] dark:via-[#08391d] dark:to-[#062c16] shadow-xl">
                                {/* Pitch Markings */}
                                <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-25">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-16 border-b-2 border-x-2 border-white rounded-b-xl" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white" />
                                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white" />
                                </div>

                                <div className="relative z-10 space-y-3 sm:space-y-4">
                                    {/* GKP Row */}
                                    <div className="flex justify-center gap-2.5 sm:gap-5">
                                        {starters.gkp.map(p => renderPlayerCard(p, playersMap[p.element], activeChip))}
                                    </div>

                                    {/* DEF Row */}
                                    <div className="flex justify-center gap-1.5 sm:gap-3 flex-wrap">
                                        {starters.def.map(p => renderPlayerCard(p, playersMap[p.element], activeChip))}
                                    </div>

                                    {/* MID Row */}
                                    <div className="flex justify-center gap-1.5 sm:gap-3 flex-wrap">
                                        {starters.mid.map(p => renderPlayerCard(p, playersMap[p.element], activeChip))}
                                    </div>

                                    {/* FWD Row */}
                                    <div className="flex justify-center gap-2.5 sm:gap-5 flex-wrap">
                                        {starters.fwd.map(p => renderPlayerCard(p, playersMap[p.element], activeChip))}
                                    </div>
                                </div>
                            </div>

                            {/* Bench Section */}
                            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100/90 dark:bg-black/40 p-3 sm:p-4 space-y-2.5 shadow-xs">
                                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                                    <div className="flex items-center gap-1.5">
                                        <Shirt className="w-3.5 h-3.5 text-slate-600 dark:text-gray-300" />
                                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                            Substitutes Bench
                                        </h4>
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono font-medium">
                                        {activeChip === 'bboost' ? 'Points Counted (Bench Boost Active)' : `Points on bench: ${entryHistory?.points_on_bench || 0}`}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {bench.map((p, idx) => {
                                        const player = playersMap[p.element];
                                        return (
                                            <div 
                                                key={p.element}
                                                className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] flex items-center justify-between gap-1.5 shadow-xs"
                                            >
                                                <div className="min-w-0">
                                                    <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-white/10 inline-block mb-1">
                                                        {idx === 0 ? 'GKP 12' : `Sub ${idx}`}
                                                    </span>
                                                    <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{player?.web_name || `Player ${p.element}`}</p>
                                                    <p className="text-[9px] text-slate-500 dark:text-gray-300 font-medium">{player?.team_short || 'PL'}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className={clsx(
                                                        "text-[11px] font-black px-2 py-0.5 rounded-md block border",
                                                        activeChip === 'bboost'
                                                            ? "bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border-emerald-500/40"
                                                            : "bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white border-slate-200 dark:border-white/15"
                                                    )}>
                                                        {player?.points || 0} pts
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/50 flex items-center justify-between gap-2.5">
                    {/* Toggle to My Team if viewing another rival */}
                    {!isViewingMyself && myTeamId && onSelectTeam ? (
                        <button
                            type="button"
                            onClick={() => onSelectTeam(myTeamId, myTeamName || 'My Team', myManagerName || 'You')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                        >
                            <User className="w-3.5 h-3.5" />
                            <span>Switch to My Team</span>
                            <ArrowRight className="w-3 h-3 ml-0.5" />
                        </button>
                    ) : (
                        <span className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">Official Fantasy Premier League data</span>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white/15 dark:hover:bg-white/25 border border-slate-900 dark:border-white/20 text-white text-xs font-black transition-all cursor-pointer ml-auto active:scale-95 shadow-sm"
                    >
                        Close Lineup
                    </button>
                </div>
            </div>
        </div>
    );
}

function renderPlayerCard(pick: PlayerPick, player: PlayerDetails | undefined, activeChip: string | null) {
    const isCaptain = pick.is_captain;
    const isVice = pick.is_vice_captain;
    const mult = pick.multiplier || 1;
    const rawPoints = player?.points || 0;
    const scoredPoints = rawPoints * mult;
    const posType = player?.element_type || 3; // 1: GKP, 2: DEF, 3: MID, 4: FWD

    return (
        <div 
            key={pick.element}
            className="flex flex-col items-center min-w-[58px] sm:min-w-[70px] max-w-[84px] text-center group cursor-default"
        >
            {/* Jersey Card */}
            <div className="relative">
                <div className={clsx(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border shadow-md transition-transform group-hover:scale-110",
                    posType === 1
                        ? "bg-amber-500 border-amber-300/80 text-slate-950"
                        : posType === 2
                        ? "bg-emerald-600 border-emerald-400/50 text-white"
                        : posType === 3
                        ? "bg-indigo-600 border-indigo-400/50 text-white"
                        : "bg-rose-600 border-rose-400/50 text-white",
                    isCaptain ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-emerald-700 dark:ring-offset-[#082d18] shadow-[0_0_14px_rgba(251,191,36,0.7)]" : "",
                    isVice && !isCaptain ? "ring-2 ring-slate-200 ring-offset-1 ring-offset-emerald-700 dark:ring-offset-[#082d18]" : ""
                )}>
                    <Shirt className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-current drop-shadow-sm" />
                </div>

                {/* Team Tag pill on top */}
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 py-0.2 rounded bg-slate-950/90 dark:bg-black/85 text-[7.5px] font-black uppercase text-white tracking-wider border border-white/20 whitespace-nowrap">
                    {player?.team_short || 'PL'}
                </span>

                {/* Captaincy Badge */}
                {isCaptain && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-[9px] flex items-center justify-center border border-white shadow-md">
                        {activeChip === '3xc' ? '3x' : 'C'}
                    </span>
                )}
                {isVice && !isCaptain && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-900 text-white font-black text-[8px] flex items-center justify-center border border-white/60 shadow-md">
                        V
                    </span>
                )}
            </div>

            {/* Name Banner & Points */}
            <div className="w-full mt-2 px-1.5 py-1 rounded-lg bg-white/95 dark:bg-black/95 backdrop-blur-md border border-slate-200/90 dark:border-white/20 shadow-md">
                <p className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-white truncate leading-tight">
                    {player?.web_name || `Player ${pick.element}`}
                </p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className="text-[9.5px] sm:text-[10px] font-black text-emerald-700 dark:text-emerald-400 tabular-nums leading-none">
                        {scoredPoints} pts
                    </span>
                </div>
            </div>
        </div>
    );
}
