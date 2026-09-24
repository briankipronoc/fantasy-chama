import { useState, useEffect } from 'react';
import { useCountUp } from '../hooks/useCountUp';

interface SwapperProps {
    weeklyPot: number;
    seasonVault: number;
    weeklyRulesPercent: number;
    isStealthMode: boolean;
    projectedSeasonVault?: number;
    leagueStartGw?: number;
}

export function PotVaultSwapper({
    weeklyPot,
    seasonVault,
    weeklyRulesPercent,
    isStealthMode,
    projectedSeasonVault,
    leagueStartGw = 1
}: SwapperProps) {
    const isWeeklyOnly = weeklyRulesPercent >= 100;
    const isVaultOnly = weeklyRulesPercent <= 0;
    const hasBothPots = !isWeeklyOnly && !isVaultOnly;

    const [showWeeklyPot, setShowWeeklyPot] = useState(!isVaultOnly);
    const [isManualSelection, setIsManualSelection] = useState(false);
    const [vaultView, setVaultView] = useState<'accumulated' | 'projected'>('accumulated');
    const [isManualVaultSelection, setIsManualVaultSelection] = useState(false);

    const animatedWeeklyPot = useCountUp(weeklyPot);
    const animatedSeasonVault = useCountUp(seasonVault);
    const animatedProjectedVault = useCountUp(projectedSeasonVault || 0);

    // Auto-swap between Weekly Pot and Season Vault if both exist
    useEffect(() => {
        if (!hasBothPots) {
            setShowWeeklyPot(!isVaultOnly);
            return;
        }
        if (isManualSelection) return;
        const interval = setInterval(() => {
            setShowWeeklyPot(prev => !prev);
        }, 6000);
        return () => clearInterval(interval);
    }, [hasBothPots, isVaultOnly, isManualSelection]);

    // Auto-swap between Accumulated to date and Expected By GW38
    useEffect(() => {
        if (isManualVaultSelection) return;
        const interval = setInterval(() => {
            setVaultView(prev => prev === 'accumulated' ? 'projected' : 'accumulated');
        }, 5000);
        return () => clearInterval(interval);
    }, [isManualVaultSelection]);

    const vaultPercent = 100 - weeklyRulesPercent;
    const progressPercent = (projectedSeasonVault && projectedSeasonVault > 0)
        ? Math.min(100, Math.round((seasonVault / projectedSeasonVault) * 100))
        : 0;

    return (
        <div className="fc-pot-swapper bg-gradient-to-br from-[#1c272c] to-[#11171a] border border-[#FBBF24]/30 rounded-[2rem] p-6 sm:p-8 md:p-10 relative overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.08)] hover:border-[#FBBF24]/50 transition-colors w-full min-h-[240px] h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-6 opacity-10 blur-[20px] pointer-events-none">
                <div className={`w-32 h-32 rounded-full transition-colors duration-1000 ${showWeeklyPot ? 'bg-[#FBBF24]' : 'bg-[#10B981]'}`}></div>
            </div>

            {/* Quick Interactive Switch Tabs */}
            <div className="flex items-center justify-between gap-2 mb-3 relative z-20">
                {hasBothPots ? (
                    <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/10 rounded-full backdrop-blur-md">
                        <button
                            type="button"
                            onClick={() => {
                                setIsManualSelection(true);
                                setShowWeeklyPot(true);
                            }}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                showWeeklyPot
                                    ? 'bg-amber-500/25 border border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            🏆 Weekly Pot
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsManualSelection(true);
                                setShowWeeklyPot(false);
                            }}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                !showWeeklyPot
                                    ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            🏦 Season Vault
                        </button>
                    </div>
                ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/40 border border-white/10 rounded-full backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-emerald-400">
                        {isVaultOnly ? '🏦 100% Season Vault League' : '🏆 100% Weekly Pot League'}
                    </div>
                )}

                <div className="flex items-center gap-1 text-[10px] font-mono text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="hidden sm:inline">LIVE SYNC</span>
                </div>
            </div>

            <div className="fc-pot-weekly relative z-10 transition-all duration-500" style={{ opacity: showWeeklyPot ? 1 : 0, display: showWeeklyPot ? 'block' : 'none' }}>
                <p className="text-[#FBBF24] text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-[#FBBF24] shadow-[0_0_8px_rgba(251,191,36,1)] animate-pulse"></span>
                    Live Weekly Pot
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl md:text-5xl font-black text-white tracking-tight tabular-nums">
                        {isStealthMode ? '****' : animatedWeeklyPot.toLocaleString()}
                    </span>
                    <span className="text-[#FBBF24] text-sm md:text-base font-bold">KES</span>
                </div>
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-3">
                    <span>{weeklyRulesPercent}% Distribution</span>
                    <span className="text-amber-400 font-semibold normal-case">Disbursed each gameweek</span>
                </div>
            </div>

            <div className="fc-pot-season relative z-10 transition-all duration-500" style={{ opacity: !showWeeklyPot ? 1 : 0, display: !showWeeklyPot ? 'block' : 'none' }}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <p className="text-[#10B981] text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,1)] animate-pulse"></span>
                        Season Vault
                    </p>

                    {/* Toggle between Accumulated & Expected Target */}
                    {projectedSeasonVault && projectedSeasonVault > 0 && (
                        <div className="inline-flex items-center p-0.5 bg-black/40 border border-white/10 rounded-lg backdrop-blur-md">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsManualVaultSelection(true);
                                    setVaultView('accumulated');
                                }}
                                className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    vaultView === 'accumulated'
                                        ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-xs'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                Accumulated
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsManualVaultSelection(true);
                                    setVaultView('projected');
                                }}
                                className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    vaultView === 'projected'
                                        ? 'bg-amber-500/25 border border-amber-500/40 text-amber-300 shadow-xs'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                Expected By GW38
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl md:text-5xl font-black text-white tracking-tight tabular-nums">
                        {isStealthMode
                            ? '****'
                            : vaultView === 'accumulated'
                                ? animatedSeasonVault.toLocaleString()
                                : animatedProjectedVault.toLocaleString()}
                    </span>
                    <span className={`text-sm md:text-base font-bold ${vaultView === 'accumulated' ? 'text-[#10B981]' : 'text-amber-400'}`}>KES</span>
                </div>

                <p className="text-[10px] text-gray-400 font-medium mb-2">
                    {vaultView === 'accumulated'
                        ? 'Total verified funds accumulated in the vault so far'
                        : `Projected final season vault prize pool at GW38 (GW${leagueStartGw} → GW38)`}
                </p>

                {/* Progress bar toward projected vault */}
                {projectedSeasonVault && projectedSeasonVault > 0 && (
                    <div className="w-full my-2">
                        <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 mb-1">
                            <span>Vault Progress (KES {seasonVault.toLocaleString()} of KES {projectedSeasonVault.toLocaleString()})</span>
                            <span className="text-emerald-400 font-mono">{progressPercent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-[#10B981] rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-2">
                    <span>{vaultPercent}% Distribution · Live Season Pot</span>
                    <span className="text-emerald-400 font-semibold normal-case">
                        {vaultView === 'accumulated' ? 'Secured from active rounds' : `Target for ${38 - leagueStartGw + 1} rounds`}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default PotVaultSwapper;
