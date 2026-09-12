// src/components/QuickActionFab.tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Zap, X, Wallet, Trophy, MessageSquare, Shield, Swords } from 'lucide-react';
import { useStore } from '../store/useStore';
import { haptics } from '../utils/haptics';

export default function QuickActionFab() {
  const [isOpen, setIsOpen] = useState(false);
  const role = useStore(state => state.role);
  const navigate = useNavigate();
  const location = useLocation();

  // Do not show on login, setup or landing page
  const hiddenRoutes = ['/', '/login', '/setup'];
  if (hiddenRoutes.includes(location.pathname)) return null;

  const handleAction = (path: string) => {
    haptics.selection();
    setIsOpen(false);
    navigate(path);
  };

  const isAdmin = role === 'admin';

  return (
    <div className="hidden lg:flex fixed bottom-6 right-6 z-[100] flex-col items-end gap-2.5">
      {isOpen && (
        <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-3 fade-in duration-200">
          {isAdmin ? (
            <>
              <button
                onClick={() => handleAction('/dashboard')}
                className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#161d24] border border-white/10 hover:border-emerald-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Chairman Dashboard</span>
              </button>
              <button
                onClick={() => handleAction('/finances')}
                className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#161d24] border border-white/10 hover:border-amber-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Vault & Finances</span>
              </button>
              <button
                onClick={() => handleAction('/standings')}
                className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#161d24] border border-white/10 hover:border-blue-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>League Standings</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleAction('/deposit')}
                className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#161d24] border border-white/10 hover:border-emerald-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Fund Wallet</span>
              </button>
              <button
                onClick={() => handleAction('/sidebets')}
                className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#161d24] border border-white/10 hover:border-amber-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                <Swords className="w-4 h-4 text-amber-400" />
                <span>Challenge Rival</span>
              </button>
              <button
                onClick={() => handleAction('/standings')}
                className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#161d24] border border-white/10 hover:border-blue-500/40 text-white text-xs font-black shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                <Trophy className="w-4 h-4 text-blue-400" />
                <span>Live Standings</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Main Trigger FAB */}
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
        title="Quick Shortcuts"
        aria-label="Quick Actions"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Zap className="w-5 h-5 fill-current" />}
      </button>
    </div>
  );
}
