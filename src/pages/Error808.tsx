import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  Trophy,
  ShieldCheck,
  Flag,
  RotateCcw,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import { haptics } from '../utils/haptics';

export default function Error808() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { role: storeRole, league } = useStore();

  const activeLeagueId = useMemo(() => {
    return localStorage.getItem('activeLeagueId');
  }, []);

  const effectiveRole = useMemo(() => {
    const localRole = localStorage.getItem('userRole');
    return storeRole || (localRole === 'admin' ? 'admin' : localRole === 'member' ? 'member' : null);
  }, [storeRole]);

  const leagueTitle = useMemo(() => {
    return league?.name || localStorage.getItem('leagueName') || null;
  }, [league]);

  const hasActiveSession = Boolean(
    activeLeagueId && (
      effectiveRole === 'admin' ||
      localStorage.getItem('memberPhone') ||
      localStorage.getItem('activeUserId')
    )
  );

  const handleBack = () => {
    haptics.impact();
    if (window.history.length > 1) {
      navigate(-1);
    } else if (hasActiveSession) {
      navigate(effectiveRole === 'admin' ? '/admin' : '/dashboard');
    } else {
      navigate('/');
    }
  };

  const primaryTarget = hasActiveSession
    ? (effectiveRole === 'admin' ? '/admin' : '/dashboard')
    : '/';

  const primaryLabel = hasActiveSession
    ? (effectiveRole === 'admin' ? 'Command Center' : 'League Dashboard')
    : 'Return to Home';

  return (
    <div className="min-h-screen text-slate-800 dark:text-[#dfe2ef] bg-[#f8fafc] dark:bg-[#070a0f] relative overflow-hidden transition-colors duration-300 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      {/* Stadium Ambient Glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Clean Minimal Top Bar */}
      <header className="fixed top-0 inset-x-0 z-30 bg-white/80 dark:bg-[#070a0f]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.08] transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            to={primaryTarget}
            onClick={() => haptics.selection()}
            className="flex items-center gap-2.5 text-lg font-black tracking-tight text-slate-900 dark:text-white group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-[1px] flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0a0e17] rounded-[11px] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <span>
              Fantasy <span className="text-emerald-500 dark:text-emerald-400">Chama</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {leagueTitle && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {leagueTitle}
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark');
              }}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              aria-label={`Switch theme. Current: ${theme}`}
              title={`Switch Theme (${theme})`}
            >
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : theme === 'light' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Laptop className="w-4 h-4 text-emerald-500" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 pt-28 pb-12 px-4 sm:px-6 flex items-center justify-center my-auto">
        <div className="w-full max-w-lg">
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d141e] p-8 sm:p-10 shadow-xl dark:shadow-2xl text-center transition-colors">
            
            {/* Elegant Referee Flag Icon */}
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-lg shadow-amber-500/15">
              <Flag className="w-8 h-8 -rotate-12" />
            </div>

            {/* Status Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider mb-4">
              <span>Offside Call</span>
              <span className="text-slate-400 dark:text-slate-500">·</span>
              <span>404</span>
            </div>

            {/* Heading & Clear Copy */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
              Page Not Found
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed mb-6">
              The page you requested does not exist or may have moved. Let us take you back to your league command center.
            </p>

            {/* Reassurance Badge */}
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 py-2.5 px-4 mb-7 flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>Your Chama pot, records, and wallet are completely safe.</span>
            </div>

            {/* High-Contrast Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to={primaryTarget}
                onClick={() => haptics.impact()}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-[#002113] font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                {hasActiveSession ? <Trophy className="w-4 h-4" /> : <Home className="w-4 h-4" />}
                <span>{primaryLabel}</span>
              </Link>

              <button
                type="button"
                onClick={handleBack}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Go Back</span>
              </button>
            </div>

            {!hasActiveSession && (
              <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5">
                <Link
                  to="/login"
                  onClick={() => haptics.selection()}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Already in a league? Sign in to your account
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-slate-500 dark:text-gray-500">
        <p className="font-medium">
          Fantasy Chama · Official Social Escrow
        </p>
      </footer>
    </div>
  );
}
