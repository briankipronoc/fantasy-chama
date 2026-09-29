// src/components/PwaInstallPrompt.tsx
import { useState, useEffect } from 'react';
import { Download, X, Share2, Trophy, Check } from 'lucide-react';
import { haptics } from '../utils/haptics';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Don't show if already installed / running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Check if dismissed recently (within 7 days)
    const dismissedAt = localStorage.getItem('fc-pwa-dismissed');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // Android / Chromium beforeinstallprompt handler
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS Safari detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

    if (isIosDevice && isSafari && !isStandalone) {
      setIsIos(true);
      // Small delay so it doesn't immediately flash on load
      const timer = setTimeout(() => setShowPrompt(true), 3500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    haptics.selection();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      haptics.success();
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    haptics.selection();
    setShowPrompt(false);
    localStorage.setItem('fc-pwa-dismissed', String(Date.now()));
  };

  if (!showPrompt) return null;

  return (
    <aside aria-label="Install FantasyChama App" className="fixed bottom-24 sm:bottom-6 left-3.5 right-3.5 sm:left-auto sm:right-6 sm:max-w-sm z-[115] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#0e1620]/95 dark:bg-[#0b1219]/95 backdrop-blur-2xl border border-amber-400/30 dark:border-emerald-500/30 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_25px_rgba(16,185,129,0.15)] text-white relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-emerald-600 flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.3)] shrink-0">
              <Trophy className="w-5 h-5 text-slate-950 font-black" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-amber-400 dark:text-emerald-400">Install FantasyChama</p>
              <p className="text-[11px] text-gray-300 leading-snug mt-0.5">
                Add to your home screen for instant updates & full-screen native view.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 -mr-1 -mt-1 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all active:scale-90 cursor-pointer shrink-0"
            title="Close install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIos ? (
          <div className="mt-3 pt-2.5 border-t border-white/10 space-y-2.5">
            <div className="flex items-center gap-2.5 bg-black/40 border border-blue-500/30 rounded-2xl p-2.5 text-xs text-gray-200 shadow-inner">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
                <Share2 className="w-4 h-4 animate-pulse" />
              </div>
              <p className="text-[11px] leading-snug">
                1. Tap the <strong className="text-white">Share</strong> button <Share2 className="w-3.5 h-3.5 text-blue-400 inline mx-0.5" /> in Safari's bottom bar.<br />
                2. Tap <strong className="text-emerald-400 font-bold">Add to Home Screen</strong>.
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-400 font-medium">Feels like a native iOS app</span>
              <button
                onClick={handleDismiss}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold text-emerald-300 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Got it</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Install App
            </button>
            <button
              onClick={handleDismiss}
              className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
