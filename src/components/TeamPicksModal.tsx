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

const POSITION_LABELS: Record<number, string> = {
    1: 'GKP',
    2: 'DEF',
    3: 'MID',
    4: 'FWD'
};

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
                className="relative w-full max-w-2xl bg-[#0e141a] border border-white/10 rounded-[2rem] shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col my-auto max-h-[92vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="p-3.5 sm:p-5 border-b border-white/5 bg-gradient-to-r from-emerald-950/40 via-[#0e141a] to-emerald-950/20 relative">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer active:scale-95 shadow-xs"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Back</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer active:scale-90"
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
                                    <h3 className="text-base sm:text-lg font-black text-white truncate">{managerName}</h3>
                                    {isViewingMyself && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                                            You
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs font-semibold text-emerald-400 truncate">
                                    {teamName}
                                </p>
                            </div>
                        </div>

                        {/* Gameweek Navigator */}
                        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1 self-start sm:self-auto">
                            <button
                                onClick={() => setSelectedGw(prev => Math.max(1, prev - 1))}
                                disabled={selectedGw <= 1}
                                className="p-1 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 cursor-pointer"
                                title="Previous Gameweek"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-black px-2 py-0.5 text-white tracking-wider">
                                GW {selectedGw}
                            </span>
                            <button
                                onClick={() => setSelectedGw(prev => Math.min(38, prev + 1))}
                                disabled={selectedGw >= (gameweek || 38)}
                                className="p-1 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 cursor-pointer"
                                title="Next Gameweek"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Stats & Chip Ribbon */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap mt-3 pt-2.5 border-t border-white/5 text-[11px] sm:text-xs">
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                            <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                            <span>GW Points:</span>
                            <span className="text-xs sm:text-sm font-black text-white tabular-nums">{calculatedGwScore}</span>
                        </div>

                        {transferCost > 0 && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold">
                                <span>Hit: -{transferCost} pts</span>
                            </div>
                        )}

                        {transferCost > 0 && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/40 border border-white/10 text-gray-300 font-bold">
                                <span>Net: {netGwScore} pts</span>
                            </div>
                        )}

                        {activeChip && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black uppercase text-[9.5px] tracking-wider animate-pulse">
                                <Zap className="w-3 h-3 text-amber-400" />
                                {activeChip === 'bboost' && 'Bench Boost Active'}
                                {activeChip === '3xc' && 'Triple Captain Active'}
                                {activeChip === 'freehit' && 'Free Hit Active'}
                                {activeChip === 'wildcard' && 'Wildcard Played'}
                            </div>
                        )}

                        <span className="text-gray-500 text-[10px] ml-auto font-mono">
                            Formation: {formationString}
                        </span>
                    </div>
                </div>

                {/* Modal Body / Pitch View */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
                            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                            <p className="text-xs font-bold uppercase tracking-wider">Loading team lineup...</p>
                        </div>
                    ) : error ? (
                        <div className="py-14 px-6 text-center space-y-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <h4 className="text-sm font-bold text-white">Lineup Unavailable</h4>
                            <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* Visual Pitch */}
                            <div className="relative rounded-2xl sm:rounded-3xl p-3 sm:p-5 overflow-hidden border border-emerald-500/25 bg-gradient-to-b from-[#0d2a1b] via-[#091f14] to-[#06150d] shadow-2xl">
                                {/* Pitch Markings */}
                                <div className="absolute inset-0 pointer-events-none opacity-20">
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
                            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4 space-y-2.5">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <div className="flex items-center gap-1.5">
                                        <Shirt className="w-3.5 h-3.5 text-gray-400" />
                                        <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-300">
                                            Substitutes Bench
                                        </h4>
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-mono">
                                        {activeChip === 'bboost' ? 'Points Counted (Bench Boost Active)' : `Points on bench: ${entryHistory?.points_on_bench || 0}`}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {bench.map((p, idx) => {
                                        const player = playersMap[p.element];
                                        return (
                                            <div 
                                                key={p.element}
                                                className="p-2 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between gap-1.5"
                                            >
                                                <div className="min-w-0">
                                                    <span className="text-[8.5px] font-black uppercase px-1 py-0.2 rounded bg-white/5 text-gray-400 border border-white/5 inline-block mb-0.5">
                                                        {idx === 0 ? 'GKP 12' : `Sub ${idx}`}
                                                    </span>
                                                    <p className="text-[11px] font-bold text-white truncate">{player?.web_name || `Player ${p.element}`}</p>
                                                    <p className="text-[9px] text-gray-400">{player?.team_short || 'PL'}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className={clsx(
                                                        "text-[11px] font-black px-1.5 py-0.5 rounded-md block",
                                                        activeChip === 'bboost'
                                                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                            : "bg-white/5 text-gray-300"
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
                <div className="p-3 sm:p-4 border-t border-white/5 bg-black/40 flex items-center justify-between gap-2.5">
                    {/* Toggle to My Team if viewing another rival */}
                    {!isViewingMyself && myTeamId && onSelectTeam ? (
                        <button
                            type="button"
                            onClick={() => onSelectTeam(myTeamId, myTeamName || 'My Team', myManagerName || 'You')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                        >
                            <User className="w-3.5 h-3.5" />
                            <span>Switch to My Team</span>
                            <ArrowRight className="w-3 h-3 ml-0.5" />
                        </button>
                    ) : (
                        <span className="text-[10px] text-gray-500">Official Fantasy Premier League data</span>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer ml-auto"
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

    return (
        <div 
            key={pick.element}
            className="flex flex-col items-center min-w-[58px] sm:min-w-[70px] max-w-[82px] text-center group"
        >
            {/* Jersey Card */}
            <div className="relative">
                <div className={clsx(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex flex-col items-center justify-center p-0.5 border shadow-md transition-transform group-hover:scale-105",
                    isCaptain
                        ? "bg-gradient-to-br from-amber-500/30 to-amber-600/10 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                        : isVice
                            ? "bg-gradient-to-br from-slate-400/25 to-slate-600/10 border-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.15)]"
                            : "bg-[#101b15]/90 border-white/15 hover:border-emerald-400/40"
                )}>
                    <span className="text-[8px] font-black text-emerald-400 tracking-wider uppercase leading-none">
                        {player?.team_short || 'PL'}
                    </span>
                    <Shirt className={clsx("w-4 h-4 sm:w-5 sm:h-5 mt-0.5", isCaptain ? "text-amber-300" : isVice ? "text-slate-200" : "text-emerald-100")} />
                </div>

                {/* Captaincy Badge */}
                {isCaptain && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-[9px] flex items-center justify-center border border-white shadow">
                        {activeChip === '3xc' ? '3x' : 'C'}
                    </span>
                )}
                {isVice && !isCaptain && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-300 text-slate-950 font-black text-[8px] flex items-center justify-center border border-white shadow">
                        VC
                    </span>
                )}
            </div>

            {/* Name Banner */}
            <div className="w-full mt-1 px-1 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10">
                <p className="text-[10px] sm:text-[11px] font-bold text-white truncate leading-tight">
                    {player?.web_name || `Player ${pick.element}`}
                </p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className="text-[8.5px] text-gray-400 font-mono">
                        {POSITION_LABELS[player?.element_type || 0] || 'MID'}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className={clsx(
                        "text-[9.5px] sm:text-[10px] font-black tabular-nums",
                        scoredPoints > 6 ? "text-emerald-400" : scoredPoints > 2 ? "text-white" : "text-gray-300"
                    )}>
                        {scoredPoints} pts
                    </span>
                </div>
            </div>
        </div>
    );
}
