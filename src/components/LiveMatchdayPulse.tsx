// LiveMatchdayPulse.tsx — Gameweek Live Matchday Pulse / In-Play Ticker & Leader Hub
import { useState, useEffect } from 'react';
import { Radio, ChevronRight, Trophy, Flame, ChevronUp, ChevronDown, ShieldCheck, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { haptics } from '../utils/haptics';
import clsx from 'clsx';

export interface LiveMatchdayPulseProps {
    className?: string;
    gw?: number;
    leaderName?: string;
    leaderTeam?: string;
    leaderPoints?: number;
    leadMargin?: number;
    runnerUpName?: string;
    isLive?: boolean;
    isFinished?: boolean;
    potAmount?: number;
    contributorCount?: number;
    onFlex?: () => void;
    isCurrentUserLeader?: boolean;
}

export default function LiveMatchdayPulse({
    className = '',
    gw: propGw,
    leaderName: propLeaderName,
    leaderTeam: propLeaderTeam,
    leaderPoints: propLeaderPoints,
    leadMargin: propLeadMargin,
    runnerUpName: propRunnerUpName,
    isLive: propIsLive,
    isFinished: propIsFinished,
    potAmount: propPotAmount,
    contributorCount: propContributorCount,
    onFlex,
    isCurrentUserLeader,
}: LiveMatchdayPulseProps) {
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('fc-pulse-collapsed') === 'true');
    const [fetchedData, setFetchedData] = useState<{
        gw: number;
        leaderName: string;
        leaderTeam?: string;
        leaderPoints: number;
        isLive: boolean;
        isFinished: boolean;
        potAmount: number;
        contributorCount: number;
    } | null>(null);

    const league = useStore((state) => state.league);
    const members = useStore((state) => state.members);

    useEffect(() => {
        // If all essential props are provided, skip standalone fetch
        if (propGw !== undefined && propLeaderName !== undefined && propPotAmount !== undefined) {
            return;
        }

        let isMounted = true;
        const checkLiveStatus = async () => {
            try {
                const res = await fetch('/fpl-api/bootstrap-static/');
                if (!res.ok) return;
                const data = await res.json();
                const currentEvent = (data.events || []).find((e: any) => e.is_current) || (data.events || []).find((e: any) => e.is_next);
                if (!currentEvent || !isMounted) return;

                const gwNum = Number(currentEvent.id || 4);
                const isFin = Boolean(currentEvent.finished);
                const isLv = Boolean(currentEvent.is_current && !isFin);

                // Calculate pot
                const stake = Number((league as any)?.gameweekStake || (league as any)?.monthlyFee || 250);
                const activeFunded = members.filter(m => m.isActive !== false && (m.hasPaid || (m.walletBalance || 0) >= stake));
                const fundedCount = activeFunded.length || 1;
                const weeklyPercent = Number((league as any)?.rules?.weekly || 70) / 100;
                const pot = Math.round(fundedCount * stake * weeklyPercent);

                // Fetch top score from current standings if available
                const cachedStandings = localStorage.getItem(`fpl_standings_${(league as any)?.fplLeagueId || ''}`);
                let topName = 'Leading Manager';
                let topTeam = 'Chama XI';
                let topPts = 68;

                if (cachedStandings) {
                    try {
                        const parsed = JSON.parse(cachedStandings);
                        const results = parsed.data || parsed;
                        if (Array.isArray(results) && results[0]) {
                            const top = [...results].sort((a, b) => (b.event_total || 0) - (a.event_total || 0))[0];
                            if (top) {
                                topName = top.player_name;
                                topTeam = top.entry_name;
                                topPts = top.event_total || 0;
                            }
                        }
                    } catch {}
                }

                setFetchedData({
                    gw: gwNum,
                    leaderName: topName,
                    leaderTeam: topTeam,
                    leaderPoints: topPts,
                    isLive: isLv,
                    isFinished: isFin,
                    potAmount: pot > 0 ? pot : 1750,
                    contributorCount: fundedCount,
                });
            } catch {
                if (isMounted) {
                    setFetchedData({
                        gw: 4,
                        leaderName: 'Leading Manager',
                        leaderTeam: 'Chama XI',
                        leaderPoints: 68,
                        isLive: true,
                        isFinished: false,
                        potAmount: 1750,
                        contributorCount: 7,
                    });
                }
            }
        };

        checkLiveStatus();
        return () => { isMounted = false; };
    }, [league, members, propGw, propLeaderName, propPotAmount]);

    const toggleCollapse = () => {
        haptics.selection();
        setIsCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('fc-pulse-collapsed', String(next));
            return next;
        });
    };

    // Resolved values prioritizing props
    const gw = propGw ?? fetchedData?.gw ?? 4;
    const leaderName = propLeaderName ?? fetchedData?.leaderName ?? 'Leading Manager';
    const leaderTeam = propLeaderTeam ?? fetchedData?.leaderTeam ?? 'Chama XI';
    const leaderPoints = propLeaderPoints ?? fetchedData?.leaderPoints ?? 0;
    const leadMargin = propLeadMargin;
    const runnerUpName = propRunnerUpName;
    const isFinished = propIsFinished ?? fetchedData?.isFinished ?? false;
    const isLive = propIsLive ?? fetchedData?.isLive ?? (!isFinished);
    const potAmount = propPotAmount ?? fetchedData?.potAmount ?? 0;
    const contributorCount = propContributorCount ?? fetchedData?.contributorCount ?? members.filter(m => m.hasPaid && m.isActive !== false).length;

    return (
        <div className={clsx("w-full transition-all duration-300", className)}>
            <div className={clsx(
                "rounded-2xl sm:rounded-3xl border transition-all shadow-xl p-4 sm:p-5 relative overflow-hidden",
                "bg-white dark:bg-gradient-to-r dark:from-[#181409] dark:via-[#161d24] dark:to-[#0f141a]",
                "border-amber-400/40 dark:border-[#FBBF24]/30"
            )}>
                {/* Glow Accents */}
                <div className="absolute top-0 right-0 w-72 h-32 bg-amber-500/10 dark:bg-[#FBBF24]/10 blur-[80px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-60 h-32 bg-emerald-500/10 blur-[80px] pointer-events-none" />

                {/* Top Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3.5 mb-3.5 border-b border-slate-200 dark:border-white/10 relative z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
                            <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                            Matchday Pulse • GW{gw} {isFinished ? 'Finished' : isLive ? 'Live' : 'Upcoming'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">
                            <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" /> High Score Active
                        </span>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <Link
                            to="/standings"
                            onClick={() => haptics.selection()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10 text-xs font-bold transition-all active:scale-95 shadow-xs"
                            title="View complete live mini-league table"
                        >
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <span>Live Standings</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-gray-400" />
                        </Link>
                        <button
                            type="button"
                            onClick={toggleCollapse}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition cursor-pointer"
                            title={isCollapsed ? 'Expand details' : 'Collapse details'}
                        >
                            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Expanded Details */}
                {!isCollapsed && (
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                        {/* Leader Details */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className="relative shrink-0">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-[2px] shadow-md flex items-center justify-center">
                                    <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center">
                                        <Trophy className="w-5 h-5 text-amber-400" />
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 text-amber-700 dark:text-[#FBBF24]">
                                        <ShieldCheck className="w-3.5 h-3.5 fill-current" />
                                        {isFinished ? 'POT CHAMPION' : 'POT LEADER'}
                                    </p>
                                    <span className={clsx(
                                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                        isFinished
                                            ? "bg-amber-100 text-amber-800 border-amber-300 dark:border-[#FBBF24]/40 dark:bg-[#FBBF24]/10 dark:text-[#FBBF24]"
                                            : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
                                    )}>
                                        {isFinished ? `GW${gw} Final` : `GW${gw} Live`}
                                    </span>
                                </div>
                                <h4 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                                    {isCurrentUserLeader ? `${leaderName} (You!)` : leaderName}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-gray-300 truncate max-w-[200px]">
                                        {leaderTeam}
                                    </span>
                                    <span className="inline-flex items-center gap-1 font-black px-2 py-0.5 rounded-full text-[11px] tabular-nums bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-[#10B981]/15 dark:border-[#10B981]/30 dark:text-emerald-300">
                                        {leaderPoints} pts
                                    </span>
                                </div>

                                {!isFinished && leadMargin !== undefined && (
                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            +{leadMargin} pts ahead of {runnerUpName || 'Rival'}
                                        </span>
                                        <span className={clsx(
                                            "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                                            leadMargin >= 15
                                                ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300"
                                                : leadMargin >= 5
                                                ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300"
                                                : "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300 animate-pulse"
                                        )}>
                                            {leadMargin >= 15 ? "Dominant Lead 🛡️" : leadMargin >= 5 ? "Contested Lead ⚔️" : "Nail-Biter 🔥"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pot & Action */}
                        <div className="flex items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-white/5 justify-between md:justify-end">
                            <div className="rounded-2xl px-4 py-2.5 border text-center flex flex-col items-center justify-center bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-0.5 text-center">
                                    Projected Cash Pot
                                </p>
                                <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-[#FBBF24] tabular-nums tracking-tight text-center">
                                    KES {potAmount.toLocaleString()}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium text-center">
                                    {contributorCount} active contributions
                                </p>
                            </div>

                            {onFlex && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        haptics.celebrate();
                                        onFlex();
                                    }}
                                    className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center gap-1.5 shrink-0"
                                >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>Victory Card</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

