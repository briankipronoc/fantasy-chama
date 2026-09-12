import { useState, useEffect } from 'react';
import { useCountUp } from '../hooks/useCountUp';

interface SwapperProps {
    weeklyPot: number;
    seasonVault: number;
    weeklyRulesPercent: number;
    isStealthMode: boolean;
    projectedSeasonVault?: number;
}

export default function PotVaultSwapper({ weeklyPot, seasonVault, weeklyRulesPercent, isStealthMode, projectedSeasonVault }: SwapperProps) {
    const [showWeeklyPot, setShowWeeklyPot] = useState(true);
    const animatedWeeklyPot = useCountUp(weeklyPot);
    const animatedSeasonVault = useCountUp(seasonVault);

    useEffect(() => {
        const interval = setInterval(() => {
            setShowWeeklyPot(prev => !prev);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const vaultPercent = 100 - weeklyRulesPercent;
    const progressPercent = (projectedSeasonVault && projectedSeasonVault > 0)
        ? Math.min(100, Math.round((seasonVault / projectedSeasonVault) * 100))
        : 0;

    return (
        <div className="fc-pot-swapper bg-gradient-to-br from-[#1c272c] to-[#11171a] border border-[#FBBF24]/30 rounded-[2rem] p-6 md:p-8 relative overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.08)] hover:border-[#FBBF24]/50 transition-colors w-full min-h-[220px] h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-6 opacity-10 blur-[20px] pointer-events-none">
                <div className={`w-32 h-32 rounded-full transition-colors duration-1000 ${showWeeklyPot ? 'bg-[#FBBF24]' : 'bg-[#10B981]'}`}></div>
            </div>

            {/* Quick Interactive Switch Tabs */}
            <div className="flex items-center justify-between gap-2 mb-3 relative z-20">
                <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/10 rounded-full backdrop-blur-md">
                    <button
                        type="button"
                        onClick={() => setShowWeeklyPot(true)}
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
                        onClick={() => setShowWeeklyPot(false)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            !showWeeklyPot
                                ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        🏦 Season Vault
                    </button>
                </div>

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
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[#10B981] text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,1)] animate-pulse"></span>
                        Season Vault
                    </p>
                    {projectedSeasonVault && projectedSeasonVault > 0 && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            Target: KES {isStealthMode ? '****' : projectedSeasonVault.toLocaleString()}
                        </span>
                    )}
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl md:text-5xl font-black text-white tracking-tight tabular-nums">
                        {isStealthMode ? '****' : animatedSeasonVault.toLocaleString()}
                    </span>
                    <span className="text-[#10B981] text-sm md:text-base font-bold">KES</span>
                </div>

                {/* Progress bar toward projected vault */}
                {projectedSeasonVault && projectedSeasonVault > 0 && (
                    <div className="w-full my-2">
                        <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 mb-1">
                            <span>Vault Progress</span>
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
                    <span className="text-emerald-400 font-semibold normal-case">Secured from active funds</span>
                </div>
            </div>
        </div>
    );
}
