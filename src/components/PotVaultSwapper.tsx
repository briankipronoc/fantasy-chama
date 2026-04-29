import { useState, useEffect } from 'react';

interface SwapperProps {
    weeklyPot: number;
    seasonVault: number;
    weeklyRulesPercent: number;
    remainingGameweeks?: number;
    isStealthMode: boolean;
}

export default function PotVaultSwapper({ weeklyPot, seasonVault, weeklyRulesPercent, remainingGameweeks = 38, isStealthMode }: SwapperProps) {
    const [showWeeklyPot, setShowWeeklyPot] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setShowWeeklyPot(prev => !prev);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fc-pot-swapper bg-gradient-to-br from-[#1c272c] to-[#11171a] border border-[#FBBF24]/30 rounded-[2rem] p-6 md:p-8 relative overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.08)] hover:border-[#FBBF24]/50 transition-colors w-full min-h-[220px] flex flex-col justify-center">
            <div className="absolute top-0 right-0 p-6 opacity-10 blur-[20px] pointer-events-none">
                <div className={`w-32 h-32 rounded-full transition-colors duration-1000 ${showWeeklyPot ? 'bg-[#FBBF24]' : 'bg-[#10B981]'}`}></div>
            </div>

            <div className="fc-pot-weekly relative z-10 transition-all duration-500" style={{ opacity: showWeeklyPot ? 1 : 0, position: showWeeklyPot ? 'relative' : 'absolute', pointerEvents: showWeeklyPot ? 'auto' : 'none' }}>
                <p className="text-[#FBBF24] text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-[#FBBF24] shadow-[0_0_8px_rgba(251,191,36,1)] animate-pulse"></span>
                    Live Weekly Pot
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl md:text-5xl font-black text-white tracking-tight tabular-nums">
                        {isStealthMode ? '****' : weeklyPot.toLocaleString()}
                    </span>
                    <span className="text-[#FBBF24] text-sm md:text-base font-bold">KES</span>
                </div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-2">{weeklyRulesPercent}% Distribution</p>
            </div>

            <div className="fc-pot-season relative z-10 transition-all duration-500" style={{ opacity: !showWeeklyPot ? 1 : 0, position: !showWeeklyPot ? 'relative' : 'absolute', pointerEvents: !showWeeklyPot ? 'auto' : 'none' }}>
                <p className="text-[#10B981] text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,1)] animate-pulse"></span>
                    Season Vault
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl md:text-5xl font-black text-white tracking-tight tabular-nums">
                        {isStealthMode ? '****' : seasonVault.toLocaleString()}
                    </span>
                    <span className="text-[#10B981] text-sm md:text-base font-bold">KES</span>
                </div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-2">Projected over {remainingGameweeks} GW{remainingGameweeks === 1 ? '' : 's'}</p>
            </div>
        </div>
    );
}
