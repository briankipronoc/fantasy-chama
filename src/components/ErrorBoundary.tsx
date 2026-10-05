import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard, Home, ChevronDown, ChevronUp, ShieldCheck, WifiOff } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallbackMessage?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    showTechnicalDetails: boolean;
}

/**
 * Categorizes raw runtime exceptions into human-friendly explanations
 * adhering to Jakob Nielsen's Usability Heuristics:
 * #1: Visibility of system status
 * #3: User control and freedom
 * #5: Error prevention
 * #9: Help users recognize, diagnose, and recover from errors (plain language, no jargon)
 */
function getHumanFriendlyErrorInfo(error: Error | null, fallbackMessage?: string) {
    const rawMsg = String(error?.message || '').toLowerCase();

    // 1. Call Stack / Loop / Render Limit errors
    if (rawMsg.includes('stack') || rawMsg.includes('call stack') || rawMsg.includes('too many re-renders') || rawMsg.includes('recursion')) {
        return {
            title: 'Temporary Refresh Loop',
            headline: 'Your session hit a brief loading loop',
            explanation: 'The app ran into a temporary refresh cycle while synchronizing your view. Don’t worry — your Chama pot, payment history, and wallet balance are 100% safe.',
            actionAdvice: 'Tap "Fix & Reload" below to reset the view and jump right back in.',
            icon: 'refresh' as const,
        };
    }

    // 2. FPL / Premier League server maintenance or 503 errors
    if (rawMsg.includes('fpl') || rawMsg.includes('503') || rawMsg.includes('502') || rawMsg.includes('504') || rawMsg.includes('updating') || rawMsg.includes('service unavailable')) {
        return {
            title: 'Premier League Game Updating',
            headline: 'Official FPL matchday servers are updating',
            explanation: 'The Premier League servers are currently calculating live scores and bonus points. Live standings will automatically resume as soon as the official gameweek crunching finishes.',
            actionAdvice: 'Your Chama escrow pot and saved standings remain secure. Tap "Go to Dashboard" to view your cached standings.',
            icon: 'fpl' as const,
        };
    }

    // 3. Network / Connection errors
    if (rawMsg.includes('failed to fetch') || rawMsg.includes('network') || rawMsg.includes('offline') || rawMsg.includes('timeout')) {
        return {
            title: 'Connection Interrupted',
            headline: 'Could not connect to the server',
            explanation: 'Your device lost connection for a moment. All your saved league data and wallet transactions are completely safe.',
            actionAdvice: 'Please check your internet or mobile data connection and tap "Reload App".',
            icon: 'network' as const,
        };
    }

    // 4. Stale bundle / Deployment chunk mismatch
    if (rawMsg.includes('dynamically imported') || rawMsg.includes('loading chunk') || rawMsg.includes('module script failed') || rawMsg.includes('mime type')) {
        return {
            title: 'New Update Available',
            headline: 'FantasyChama has been updated',
            explanation: 'A fresh version of FantasyChama is ready with the latest performance and feature updates.',
            actionAdvice: 'Tap "Update & Reload" to load the latest release seamlessly.',
            icon: 'refresh' as const,
        };
    }

    // 5. Generic runtime error fallback
    return {
        title: 'Something Didn’t Load Right',
        headline: fallbackMessage || 'A screen element encountered a temporary hiccup',
        explanation: 'FantasyChama experienced an unexpected glitch while rendering this section. Your money, standings, and settings remain untouched and secure.',
        actionAdvice: 'Tap "Reload App" to refresh, or head back to your Dashboard.',
        icon: 'warning' as const,
    };
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, showTechnicalDetails: false };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);

        // Auto-heal stale bundle chunk mismatch errors on page reload (strictly once per session)
        if (typeof window !== 'undefined' && error?.message) {
            const isChunkError =
                error.message.includes('dynamically imported module') ||
                error.message.includes('Loading chunk') ||
                error.message.includes('Importing a module script failed') ||
                error.message.includes('not a valid JavaScript MIME type') ||
                error.message.includes('MIME type');

            if (isChunkError) {
                const hasReloaded = sessionStorage.getItem('fc_chunk_retry');
                if (!hasReloaded) {
                    sessionStorage.setItem('fc_chunk_retry', '1');
                    window.location.reload();
                }
            }
        }
    }

    handleReload = () => {
        try {
            sessionStorage.removeItem('fc_chunk_retry');
            sessionStorage.removeItem('fc_reload_guard');
        } catch {}
        this.setState({ hasError: false, error: null });
        if (typeof window !== 'undefined') {
            window.location.href = window.location.pathname;
        }
    };

    handleGoToDashboard = () => {
        try {
            sessionStorage.removeItem('fc_chunk_retry');
        } catch {}
        this.setState({ hasError: false, error: null });
        window.location.href = '/dashboard';
    };

    handleGoHome = () => {
        try {
            sessionStorage.removeItem('fc_chunk_retry');
        } catch {}
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    toggleTechnicalDetails = () => {
        this.setState(prev => ({ showTechnicalDetails: !prev.showTechnicalDetails }));
    };

    render() {
        if (this.state.hasError) {
            const info = getHumanFriendlyErrorInfo(this.state.error, this.props.fallbackMessage);

            return (
                <div className="fc-error-boundary min-h-[100dvh] w-full flex flex-col items-center justify-center gap-5 px-4 sm:px-6 pt-[max(3rem,calc(env(safe-area-inset-top,0px)+2rem))] pb-12 text-center bg-[#0a0e17] text-white select-none border-0 outline-none">
                    {/* Visual Status Indicator Icon */}
                    <div className="relative">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.18)]">
                            {info.icon === 'network' ? (
                                <WifiOff className="w-8 h-8 text-amber-400" />
                            ) : info.icon === 'refresh' || info.icon === 'fpl' ? (
                                <RefreshCw className="w-8 h-8 text-emerald-400" />
                            ) : (
                                <AlertTriangle className="w-8 h-8 text-amber-400" />
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0a0e17] border border-emerald-500/40 flex items-center justify-center">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                    </div>

                    {/* Human-Friendly Text Copy */}
                    <div className="max-w-md space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Funds & Chama Records Safe
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                            {info.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                            {info.explanation}
                        </p>
                        <p className="text-[11px] sm:text-xs text-emerald-400/90 font-bold mt-1">
                            {info.actionAdvice}
                        </p>
                    </div>

                    {/* Primary & Secondary Human Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-sm mt-1">
                        <button
                            type="button"
                            onClick={this.handleReload}
                            className="w-full sm:flex-1 py-3 px-5 text-xs font-black uppercase tracking-wider rounded-2xl transition-all bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.3)] active:scale-95 cursor-pointer font-bold border-0"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Fix & Reload</span>
                        </button>
                        <button
                            type="button"
                            onClick={this.handleGoToDashboard}
                            className="w-full sm:flex-1 py-3 px-5 text-xs font-black uppercase tracking-wider rounded-2xl transition-all border border-slate-700 hover:border-emerald-500/40 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                            <span>Dashboard</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={this.handleGoHome}
                        className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <Home className="w-3.5 h-3.5" />
                        <span>Return to Main Page</span>
                    </button>

                    {/* Discreet Collapsible Technical Diagnostics (Jakob Nielsen #9 & #10: Help developers without scaring users) */}
                    {this.state.error?.message && (
                        <div className="w-full max-w-md mt-4 pt-3 border-t border-white/5">
                            <button
                                type="button"
                                onClick={this.toggleTechnicalDetails}
                                className="text-[10px] font-bold text-slate-500 hover:text-slate-400 transition-colors inline-flex items-center gap-1 cursor-pointer select-none"
                            >
                                <span>Technical Diagnostics</span>
                                {this.state.showTechnicalDetails ? (
                                    <ChevronUp className="w-3 h-3" />
                                ) : (
                                    <ChevronDown className="w-3 h-3" />
                                )}
                            </button>

                            {this.state.showTechnicalDetails && (
                                <div className="mt-2 p-3 rounded-xl bg-black/60 border border-white/10 text-left font-mono text-[10px] text-slate-400 overflow-x-auto max-h-36 select-text animate-in fade-in duration-150">
                                    <p className="text-amber-400/90 font-bold mb-1">
                                        Error: {this.state.error.name || 'Error'}
                                    </p>
                                    <p className="break-all whitespace-pre-wrap text-slate-300">
                                        {this.state.error.message}
                                    </p>
                                    {this.state.error.stack && (
                                        <p className="text-[9px] text-slate-500 mt-2 whitespace-pre-wrap break-all opacity-80">
                                            {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

