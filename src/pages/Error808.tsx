import { useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Home,
  Trophy,
  ShieldCheck,
  FileText,
  Banknote,
  HelpCircle,
  Copy,
  Check,
  Flag,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  Radio
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import { haptics } from '../utils/haptics';

export default function Error808() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { role: storeRole, league } = useStore();

  const [copied, setCopied] = useState(false);

  // Determine user login and role state
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

  const handleCopyPath = () => {
    haptics.selection();
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

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

  return (
    <div className="fc-landing-shell min-h-screen text-slate-800 dark:text-[#dfe2ef] bg-[#f8fafc] dark:bg-[#070a0f] relative overflow-hidden transition-colors duration-300 flex flex-col justify-between">
      {/* Dynamic Ambient Stadium Lighting */}
      <div className="absolute -top-32 -left-32 w-[460px] h-[460px] bg-emerald-500/15 dark:bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[460px] h-[460px] bg-amber-500/15 dark:bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/8 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="fixed top-0 inset-x-0 z-30 bg-white/80 dark:bg-[#070a0f]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <Link
            to={hasActiveSession ? (effectiveRole === 'admin' ? '/admin' : '/dashboard') : '/'}
            onClick={() => haptics.selection()}
            className="flex items-center gap-2.5 text-lg font-black tracking-tight text-slate-900 dark:text-white group"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 p-[1px] flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0a0e17] rounded-[15px] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <span>
              Fantasy <span className="text-emerald-500 dark:text-emerald-400">Chama</span>
            </span>
          </Link>

          {/* Right Controls: Active League Badge, Theme Toggle, Back Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {leagueTitle && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {leagueTitle}
              </span>
            )}

            {/* Compact Theme Cycle Button */}
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark');
              }}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              aria-label={`Cycle theme. Current: ${theme}`}
              title={`Switch Theme (Current: ${theme})`}
            >
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : theme === 'light' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Laptop className="w-4 h-4 text-emerald-500" />
              )}
            </button>

            {/* Back Button */}
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 pt-24 pb-12 px-4 sm:px-6 flex items-center justify-center my-auto">
        <div className="w-full max-w-2xl space-y-6">

          {/* Central Glass Card */}
          <div className="rounded-[2.5rem] border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#0d141e]/90 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 relative overflow-hidden text-center transition-colors">
            {/* Top Glowing Flare */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-gradient-to-b from-amber-500/20 via-emerald-500/10 to-transparent blur-3xl pointer-events-none" />

            {/* VAR Offside Pitch Visual Display */}
            <div className="relative mx-auto mb-6 w-full max-w-sm rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-950/20 via-[#0a1515]/40 to-[#070d13]/60 dark:from-emerald-950/40 dark:via-[#081216] dark:to-[#050a0f] p-4 pt-5 overflow-hidden shadow-inner">
              {/* Pitch markings simulation */}
              <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
              
              {/* Center pitch line & circle */}
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-emerald-500/25" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-emerald-500/25" />
              
              {/* Animated Glowing Laser VAR Offside Line */}
              <div className="absolute top-0 bottom-0 left-[62%] w-[2px] bg-gradient-to-b from-red-500 via-amber-400 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse" />
              <div className="absolute top-2 left-[64%] px-1.5 py-0.5 rounded bg-red-500/30 border border-red-500/50 text-[9px] font-mono font-black text-red-300 uppercase tracking-widest">
                VAR Line
              </div>

              {/* Status Header Badge */}
              <div className="relative z-10 flex items-center justify-between mb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span>VAR Decision · Offside</span>
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-500 dark:text-gray-400">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  <span>ERROR 808 / 404</span>
                </div>
              </div>

              {/* 3D Visual Centerpiece */}
              <div className="relative z-10 py-3 flex items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/20 text-amber-500 dark:text-amber-400">
                  <Flag className="w-7 h-7 -rotate-12" />
                </div>
                <div className="text-left">
                  <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-none font-mono">
                    404
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mt-1">
                    Route Outside Pitch
                  </div>
                </div>
              </div>
            </div>

            {/* Clear Plain-English Error Title (Jakob Nielsen Heuristic #2 & #9) */}
            <div className="space-y-2 mb-4">
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                This Page is Offside
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                The page or link you requested does not exist or may have been moved. Let's get you back into the action.
              </p>
            </div>

            {/* Attempted Path Indicator */}
            {location.pathname && location.pathname !== '/' && (
              <div className="mb-5 inline-flex items-center gap-2 max-w-full px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-600 dark:text-gray-400">
                <span className="text-slate-400 dark:text-gray-500">Route:</span>
                <span className="truncate max-w-[200px] sm:max-w-xs font-bold text-slate-800 dark:text-gray-200">
                  {location.pathname}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                  title="Copy link"
                  aria-label="Copy link to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {/* Nielsen Heuristic #9 Reassurance Card */}
            <div className="mb-6 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/[0.08] border border-emerald-500/25 p-3.5 flex items-center justify-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Your Chama is Safe:</strong> Wallet balances, weekly pot stakes, and team points are completely intact.
              </span>
            </div>

            {/* Smart Action Buttons (Nielsen Heuristic #3: User Freedom) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {hasActiveSession ? (
                effectiveRole === 'admin' ? (
                  <Link
                    to="/admin"
                    onClick={() => haptics.impact()}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-[#002113] font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>League Command Center</span>
                  </Link>
                ) : (
                  <Link
                    to="/dashboard"
                    onClick={() => haptics.impact()}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-[#002113] font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Return to Member Hub</span>
                  </Link>
                )
              ) : (
                <Link
                  to="/"
                  onClick={() => haptics.impact()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-[#002113] font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>Return Home</span>
                </Link>
              )}

              <button
                type="button"
                onClick={handleBack}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold text-sm transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Previous Page</span>
              </button>

              {!hasActiveSession && (
                <Link
                  to="/login"
                  onClick={() => haptics.selection()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold text-sm transition-all cursor-pointer active:scale-95"
                >
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>

          {/* Quick Hub Navigation Cards (Help Users Recover) */}
          <div className="space-y-3">
            <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
              Direct Pitch Navigation
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Link
                to="/standings"
                onClick={() => haptics.selection()}
                className="group rounded-2xl p-3.5 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0e1622]/70 hover:border-emerald-500/40 hover:bg-white dark:hover:bg-[#121c2c] transition-all flex flex-col items-center text-center gap-2 active:scale-95 shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-extrabold text-slate-900 dark:text-white">Standings</span>
                  <span className="block text-[10px] text-slate-500 dark:text-gray-400">Live rankings</span>
                </div>
              </Link>

              <Link
                to="/finances"
                onClick={() => haptics.selection()}
                className="group rounded-2xl p-3.5 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0e1622]/70 hover:border-emerald-500/40 hover:bg-white dark:hover:bg-[#121c2c] transition-all flex flex-col items-center text-center gap-2 active:scale-95 shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-extrabold text-slate-900 dark:text-white">Finances</span>
                  <span className="block text-[10px] text-slate-500 dark:text-gray-400">Pot & Vault</span>
                </div>
              </Link>

              <Link
                to="/rules"
                onClick={() => haptics.selection()}
                className="group rounded-2xl p-3.5 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0e1622]/70 hover:border-emerald-500/40 hover:bg-white dark:hover:bg-[#121c2c] transition-all flex flex-col items-center text-center gap-2 active:scale-95 shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-extrabold text-slate-900 dark:text-white">Constitution</span>
                  <span className="block text-[10px] text-slate-500 dark:text-gray-400">Rules & payout</span>
                </div>
              </Link>

              <Link
                to="/faq"
                onClick={() => haptics.selection()}
                className="group rounded-2xl p-3.5 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0e1622]/70 hover:border-emerald-500/40 hover:bg-white dark:hover:bg-[#121c2c] transition-all flex flex-col items-center text-center gap-2 active:scale-95 shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-500 group-hover:scale-110 transition-transform">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-extrabold text-slate-900 dark:text-white">Help & FAQ</span>
                  <span className="block text-[10px] text-slate-500 dark:text-gray-400">Support center</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-slate-500 dark:text-gray-500">
        <p className="flex items-center justify-center gap-1.5 font-medium">
          <span>Fantasy Chama</span>
          <span>·</span>
          <span>Official FPL Social Escrow</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
            <Sparkles className="w-3 h-3" /> All Systems Live
          </span>
        </p>
      </footer>
    </div>
  );
}
