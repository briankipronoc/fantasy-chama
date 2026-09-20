import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallbackMessage?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);

        // Auto-heal stale bundle chunk mismatch errors on page reload
        if (typeof window !== 'undefined' && error?.message) {
            const isChunkError =
                error.message.includes('dynamically imported module') ||
                error.message.includes('Loading chunk') ||
                error.message.includes('Importing a module script failed');

            if (isChunkError) {
                const hasReloaded = sessionStorage.getItem('fc_chunk_retry');
                if (!hasReloaded) {
                    sessionStorage.setItem('fc_chunk_retry', '1');
                    window.location.reload();
                    return;
                }
            }
        }

        if (typeof window !== 'undefined' && !localStorage.getItem('activeLeagueId')) {
            window.location.replace('/login');
        }
    }

    render() {
        if (this.state.hasError) {
            if (typeof window !== 'undefined' && !localStorage.getItem('activeLeagueId')) {
                window.location.replace('/login');
                return null;
            }

            return (
                <div className="fc-error-boundary min-h-[300px] flex flex-col items-center justify-center gap-4 p-8 rounded-2xl text-center">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest mb-1 text-slate-900 dark:text-white">
                            Something went wrong
                        </h3>
                        <p className="text-xs max-w-sm fc-error-boundary-copy text-slate-500 dark:text-slate-400">
                            {this.props.fallbackMessage || 'An unexpected error occurred. Please try refreshing.'}
                        </p>
                        {this.state.error?.message && (
                            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-500 mt-2 max-w-md line-clamp-2 px-2 py-1 bg-black/5 dark:bg-white/5 rounded">
                                {this.state.error.message}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <button
                            onClick={() => {
                                sessionStorage.removeItem('fc_chunk_retry');
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="fc-error-boundary-retry flex items-center gap-2 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Retry
                        </button>
                        <button
                            onClick={() => {
                                sessionStorage.removeItem('fc_chunk_retry');
                                this.setState({ hasError: false, error: null });
                                window.location.href = '/dashboard';
                            }}
                            className="px-4 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors border border-slate-700 hover:bg-white/5 text-slate-300"
                        >
                            Dashboard
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
