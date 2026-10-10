import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, ShieldCheck, Share2, Copy, Check, Plus, Minus } from 'lucide-react';
import { haptics } from '../utils/haptics';
import confetti from 'canvas-confetti';

interface MidSeasonBuyInCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueName: string;
  leagueStartGw: number;
  currentGw: number;
  gameweekStake: number;
  vaultPercent: number; // e.g. 30 for 30%
}

export default function MidSeasonBuyInCalculatorModal({
  isOpen,
  onClose,
  leagueName,
  leagueStartGw = 5,
  currentGw = 6,
  gameweekStake = 50,
  vaultPercent = 30,
}: MidSeasonBuyInCalculatorModalProps) {
  const safeStartGw = Math.max(1, Number(leagueStartGw) || 5);
  const safeCurrentGw = Math.max(safeStartGw, Number(currentGw) || 6);

  const [joiningGw, setJoiningGw] = useState<number>(safeCurrentGw);
  const [customStake, setCustomStake] = useState<number>(gameweekStake || 50);
  const [customVaultPct, setCustomVaultPct] = useState<number>(vaultPercent || 30);
  const [copied, setCopied] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  // Keep state updated whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setJoiningGw(Math.min(38, Math.max(safeStartGw, safeCurrentGw)));
      setCustomStake(gameweekStake || 50);
      setCustomVaultPct(vaultPercent || 30);
      setCopied(false);
    }
  }, [isOpen, safeStartGw, safeCurrentGw, gameweekStake, vaultPercent]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Formula: Buy-In = (Joining GW - Start GW) * Stake * Vault% + First GW Stake
  const calculation = useMemo(() => {
    const elapsedGws = Math.max(0, joiningGw - safeStartGw);
    const vaultDecimal = (customVaultPct > 0 ? customVaultPct : 30) / 100;
    const vaultCatchup = Math.round(elapsedGws * customStake * vaultDecimal);
    const firstRoundStake = customStake;
    const totalBuyIn = vaultCatchup + firstRoundStake;

    return {
      elapsedGws,
      vaultDecimal,
      vaultCatchup,
      firstRoundStake,
      totalBuyIn,
    };
  }, [joiningGw, safeStartGw, customStake, customVaultPct]);

  // WhatsApp formatted share text
  const shareText = useMemo(() => {
    const memberLabel = newMemberName.trim() ? newMemberName.trim() : 'Chief';
    const vaultPctDisplay = customVaultPct > 0 ? customVaultPct : 30;

    return `🏆 *${(leagueName || 'Fantasy Chama').toUpperCase()} — MID-SEASON FAIR BUY-IN INVOICE* 🇰🇪

Karibu sana ${memberLabel}! Here is the transparent breakdown to join our Chama circle at *GW${joiningGw}*:

🔢 *FAIR ENTRY FORMULA:*
\`(Joining GW - Start GW) × Stake × Vault% + First Round Stake\`

📊 *YOUR BREAKDOWN:*
• ⚽ Start Gameweek: *GW${safeStartGw}*
• 🚀 Joining Gameweek: *GW${joiningGw}* (${calculation.elapsedGws} elapsed rounds)
• 💰 Gameweek Stake: *KES ${customStake}*
• 🏦 Season Vault Equity (${vaultPctDisplay}%): *KES ${calculation.vaultCatchup.toLocaleString()}*
• ⚡ Current Round Pot Stake: *KES ${calculation.firstRoundStake.toLocaleString()}*

💎 *TOTAL UPFRONT BUY-IN: KES ${calculation.totalBuyIn.toLocaleString()}*

🤝 *KWA NINI HII FORMULA NI FAIR?*
1. Unanunua your equal equity share into the grand Season Vault jackpot so you can win the May trophy! 🏆
2. Hakuna free-riding — existing members already contributed during the previous ${calculation.elapsedGws} rounds.
3. Kuanzia GW${joiningGw}, unalipa tu regular KES ${customStake} per round kama kila mtu!

📱 *Lipa via M-Pesa kwa Chama Wallet:*
${typeof window !== 'undefined' ? window.location.origin : 'https://fantasy-chama.vercel.app'}`;
  }, [leagueName, newMemberName, joiningGw, safeStartGw, customStake, customVaultPct, calculation]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    haptics.impact();
    confetti({ particleCount: 24, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    haptics.celebrate();
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className="relative z-10 w-full max-w-lg rounded-3xl bg-[#090D13] dark:bg-[#040608] border border-amber-500/30 shadow-[0_0_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-500/15 via-black/40 to-emerald-500/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[#FBBF24] shadow-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">Mid-Season Buy-In Calculator</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Fair Entry
                </span>
              </div>
              <p className="text-xs text-gray-400">Prevents free-riding & calculates fair Season Vault equity</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Formula Callout Banner */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-200/90 leading-relaxed">
              <strong className="text-[#FBBF24] font-bold">Fair Equity Rule:</strong> New recruits pay back-equity into the Season Vault for elapsed rounds ({safeStartGw} → {joiningGw}), ensuring total fairness to founders who paid from Gameweek {safeStartGw}.
            </div>
          </div>

          {/* Recalculation Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-400 mb-1.5 block uppercase tracking-wider">
                Prospective Member Name
              </label>
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="e.g. Dennis Kiptoo"
                className="w-full bg-[#111722] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 mb-1.5 flex items-center justify-between uppercase tracking-wider">
                <span>Joining Matchday</span>
                <span className="text-[#FBBF24] font-black">GW{joiningGw}</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setJoiningGw(prev => Math.max(safeStartGw, prev - 1));
                    haptics.impact();
                  }}
                  disabled={joiningGw <= safeStartGw}
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center font-black disabled:opacity-30 cursor-pointer active:scale-95"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 flex items-center justify-center bg-[#111722] border border-white/10 rounded-xl py-1.5 px-3">
                  <span className="font-mono text-sm font-black text-white">GW{joiningGw}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setJoiningGw(prev => Math.min(38, prev + 1));
                    haptics.impact();
                  }}
                  disabled={joiningGw >= 38}
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center font-black disabled:opacity-30 cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Range Slider for Gameweek Jump */}
          <div className="bg-[#111722]/50 border border-white/5 rounded-2xl p-3">
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold mb-1.5 uppercase">
              <span>Kickoff: GW{safeStartGw}</span>
              <span className="text-amber-400">Target: GW{joiningGw}</span>
              <span>Final: GW38</span>
            </div>
            <input
              type="range"
              min={safeStartGw}
              max={38}
              value={joiningGw}
              onChange={(e) => {
                setJoiningGw(Number(e.target.value));
                haptics.impact();
              }}
              className="w-full accent-amber-400 cursor-pointer h-2 bg-white/10 rounded-lg"
            />
          </div>

          {/* Mathematical Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Elapsed Rounds
              </span>
              <p className="text-xl font-black text-white mt-1">
                {calculation.elapsedGws} <span className="text-xs text-gray-500 font-normal">GWs</span>
              </p>
              <p className="text-[10px] text-gray-500">
                GW{safeStartGw} → GW{joiningGw}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Vault Equity Catchup
              </span>
              <p className="text-xl font-black text-[#FBBF24] mt-1 tabular-nums">
                KES {calculation.vaultCatchup.toLocaleString()}
              </p>
              <p className="text-[10px] text-amber-400/80">
                {calculation.elapsedGws} × {customStake} × {customVaultPct}%
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                1st Round Pot Stake
              </span>
              <p className="text-xl font-black text-emerald-300 mt-1 tabular-nums">
                KES {calculation.firstRoundStake.toLocaleString()}
              </p>
              <p className="text-[10px] text-emerald-400/80">
                Active for GW{joiningGw} pot
              </p>
            </div>
          </div>

          {/* Hero Total Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/25 via-amber-500/15 to-emerald-500/20 border border-amber-500/40 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider block">
                Total Fair Buy-In Required
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                Upfront deposit to unlock Season Vault & GW{joiningGw} eligibility
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                KES {calculation.totalBuyIn.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Live Invoice Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                WhatsApp Invoice Message
              </label>
              <span className="text-[10px] text-gray-500 font-mono">{shareText.length} chars</span>
            </div>
            <div className="rounded-2xl bg-[#06080D] border border-white/10 p-3.5 font-mono text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto select-all">
              {shareText}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#070A0F] flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-3 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            <span>{copied ? 'Invoice Copied! 🎉' : 'Copy Invoice'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-black font-black text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,211,102,0.3)] active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-black" />
            <span>Send via WhatsApp</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
