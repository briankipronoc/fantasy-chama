// src/components/QuickActionFab.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Zap, X, Wallet, Trophy, Shield, Swords, LogOut } from 'lucide-react';
import { useStore } from '../store/useStore';
import { haptics } from '../utils/haptics';

export default function QuickActionFab() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const role = useStore(state => state.role);
  const logout = useStore(state => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  // Close on outside tap or click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [isOpen]);

  // Do not show on login, setup or landing page
  const hiddenRoutes = ['/', '/login', '/setup'];
  if (hiddenRoutes.includes(location.pathname)) return null;

  const handleAction = (path: string) => {
    haptics.selection();
    setIsOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    haptics.selection();
    setIsOpen(false);
    try {
      logout();
    } catch {}
    window.location.href = '/login';
  };

  const isAdmin = role === 'admin';

  return (
    <div
      ref={containerRef}
      className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[110] flex flex-col items-end gap-2.5"
    >
      {isOpen && (
        <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-3 fade-in duration-200">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => handleAction('/dashboard')}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#161d24]/95 backdrop-blur-md border border-white/10 hover:border-emerald-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Chairman Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => handleAction('/finances')}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#161d24]/95 backdrop-blur-md border border-white/10 hover:border-amber-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Vault & Finances</span>
              </button>
              <button
                type="button"
                onClick={() => handleAction('/standings')}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#161d24]/95 backdrop-blur-md border border-white/10 hover:border-blue-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-blue-400" />
                <span>Live Standings</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#161d24]/95 backdrop-blur-md border border-white/10 hover:border-red-500/40 text-gray-300 hover:text-red-400 text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleAction('/deposit')}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#161d24]/95 backdrop-blur-md border border-white/10 hover:border-emerald-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Fund Wallet</span>
              </button>
              <button
                type="button"
                onClick={() => handleAction('/sidebets')}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#161d24]/95 backdrop-blur-md border border-white/10 hover:border-amber-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Swords className="w-4 h-4 text-amber-400" />
                <span>Challenge Someone</span>
              </button>
              <button
                type="button"
                onClick={() => handleAction('/standings')}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#161d24]/95 backdrop-blur-md border border-white/10 hover:border-blue-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-blue-400" />
                <span>Live Standings</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#161d24]/95 backdrop-blur-md border border-white/10 hover:border-red-500/40 text-gray-300 hover:text-red-400 text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span>Sign Out</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Main Trigger FAB with Lightning Bolt Icon */}
      <button
        type="button"
        onClick={() => {
          haptics.selection();
          setIsOpen(!isOpen);
        }}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition-all cursor-pointer select-none active:scale-95 ${
          isOpen
            ? 'bg-[#161d24] border-white/20 text-gray-300 rotate-90'
            : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400/40 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105'
        }`}
        title="Quick Actions"
        aria-label="Quick Actions"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Zap className="w-5 h-5 fill-current" />}
      </button>
    </div>
  );
}
