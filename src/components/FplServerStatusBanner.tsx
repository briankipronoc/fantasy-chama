import { useState } from 'react';
import { RefreshCw, ShieldCheck, Check, Activity } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface FplServerStatusBannerProps {
    onRefresh?: () => Promise<void> | void;
    lastUpdated?: string;
    className?: string;
    isRefreshing?: boolean;
}

/**
 * FplServerStatusBanner — Friendly, plain-English status notification
 * displayed whenever Premier League FPL servers are updating matchday scores or unavailable.
 * Adheres to Jakob Nielsen Usability Heuristics:
 * - #1: Visibility of System Status (Always inform the user what is happening)
 * - #9: Help users recognize, diagnose, and recover from errors (Natural English, no 503 jargon)
 */
export default function FplServerStatusBanner({
    onRefresh,
    lastUpdated,
    className = '',
    isRefreshing = false
}: FplServerStatusBannerProps) {
    const [isChecking, setIsChecking] = useState(false);
    const [checkedFeedback, setCheckedFeedback] = useState(false);

    const handleCheckLive = async () => {
        haptics.selection();
        setIsChecking(true);
        try {
            if (onRefresh) {
                await onRefresh();
            }
            setCheckedFeedback(true);
            setTimeout(() => setCheckedFeedback(false), 2500);
        } catch (e) {
            console.warn('[fpl-banner] manual check error:', e);
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div
            role="status"
            aria-live="polite"
            className={`fc-fpl-status-banner rounded-2xl bg-amber-500/10 dark:bg-amber-500/[0.08] border border-amber-500/30 dark:border-amber-400/25 p-3.5 sm:p-4 shadow-lg shadow-black/20 backdrop-blur-xl text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-300 ${className}`}
        >
            <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.25)] text-amber-300">
                    <Activity className={`w-5 h-5 ${isChecking || isRefreshing ? 'animate-spin' : 'animate-pulse'}`} />
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-amber-300 dark:text-amber-200">
                            Premier League Game Updating
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/35">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            Live Calculation
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Pot & Wallet 100% Secure</span>
                        </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-300 dark:text-gray-300 leading-relaxed mt-1 font-medium">
                        The official Premier League servers are crunching matchday scores and bonus points right now. Your Chama balances and saved standings are completely safe and will refresh live automatically as soon as the calculations finish.
                    </p>
                    {lastUpdated && (
                        <p className="text-[10px] text-amber-300/80 font-mono mt-0.5">
                            Showing verified standings from: {lastUpdated}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto justify-end">
                <button
                    type="button"
                    onClick={handleCheckLive}
                    disabled={isChecking || isRefreshing}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-500/40 text-amber-200 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                    {checkedFeedback ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Checked (Still Updating)</span>
                        </>
                    ) : (
                        <>
                            <RefreshCw className={`w-3.5 h-3.5 ${isChecking || isRefreshing ? 'animate-spin' : ''}`} />
                            <span>Check Status</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
