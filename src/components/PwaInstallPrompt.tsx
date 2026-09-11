// src/components/PwaInstallPrompt.tsx
import { useState, useEffect } from 'react';
import { Download, X, Share2, Smartphone } from 'lucide-react';
import { haptics } from '../utils/haptics';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

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
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

    if (isIosDevice && isSafari && !isStandalone) {
      setIsIos(true);
      // Small delay so it doesn't immediately flash on load
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    haptics.selection();
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

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
    setShowIosGuide(false);
    localStorage.setItem('fc-pwa-dismissed', String(Date.now()));
  };

  if (!showPrompt) return null;

  return (
    <aside aria-label="Install FantasyChama App" className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[115] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#121922]/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.6)] text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-[#0b1014] border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-400">Install FantasyChama</p>
              <p className="text-[11px] text-gray-300 leading-snug mt-0.5">
                Add to your home screen for faster access, instant updates & full-screen view.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-white p-1 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showIosGuide ? (
          <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-300 space-y-1.5 animate-in fade-in duration-200">
            <p className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">1</span>
              Tap the <Share2 className="w-3.5 h-3.5 text-blue-400 inline mx-0.5" /> <strong>Share</strong> button in Safari's bottom toolbar.
            </p>
            <p className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">2</span>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              onClick={handleDismiss}
              className="mt-2 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-center"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              {isIos ? 'How to Install' : 'Install App'}
            </button>
            <button
              onClick={handleDismiss}
              className="py-2 px-3 text-xs font-bold text-gray-400 hover:text-white transition-colors"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
