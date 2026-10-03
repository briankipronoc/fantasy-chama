import { useState, useMemo } from 'react';
import { X, Calculator, ShieldCheck, Share2, Copy, Check } from 'lucide-react';
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
  leagueStartGw = 1,
  currentGw = 6,
  gameweekStake = 50,
  vaultPercent = 30,
}: MidSeasonBuyInCalculatorModalProps) {
  const [joiningGw, setJoiningGw] = useState<number>(Math.max(leagueStartGw, currentGw));
  const [copied, setCopied] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  // Formula: Buy-In = (Joining GW - Start GW) * Stake * Vault% + First GW Stake
  const calculation = useMemo(() => {
    const elapsedGws = Math.max(0, joiningGw - leagueStartGw);
    const vaultDecimal = (vaultPercent > 0 ? vaultPercent : 30) / 100;
    const vaultCatchup = Math.round(elapsedGws * gameweekStake * vaultDecimal);
    const firstRoundStake = gameweekStake;
    const totalBuyIn = vaultCatchup + firstRoundStake;

    return {
      elapsedGws,
      vaultDecimal,
      vaultCatchup,
      firstRoundStake,
      totalBuyIn,
    };
  }, [joiningGw, leagueStartGw, gameweekStake, vaultPercent]);

  // WhatsApp formatted share text
  const shareText = useMemo(() => {
    const memberLabel = newMemberName.trim() ? newMemberName.trim() : 'Chief';
    const vaultPctDisplay = vaultPercent > 0 ? vaultPercent : 30;

    return `🏆 *${leagueName.toUpperCase()} — MID-SEASON FAIR BUY-IN INVOICE* 🇰🇪

Karibu sana ${memberLabel}! Here is the transparent breakdown to join the Chama at *GW${joiningGw}*:

🔢 *FAIR ENTRY FORMULA:*
\`(Joining GW - Start GW) × Stake × Vault% + First Round Stake\`

📊 *YOUR BREAKDOWN:*
• ⚽ Start Gameweek: *GW${leagueStartGw}*
• 🚀 Joining Gameweek: *GW${joiningGw}* (${calculation.elapsedGws} elapsed rounds)
• 💰 Gameweek Stake: *KES ${gameweekStake}*
• 🏦 Season Vault Contribution (${vaultPctDisplay}%): *KES ${calculation.vaultCatchup.toLocaleString()}*
• ⚡ Current Round Pot Stake: *KES ${calculation.firstRoundStake.toLocaleString()}*

💎 *TOTAL UPFRONT BUY-IN: KES ${calculation.totalBuyIn.toLocaleString()}*

🤝 *KWA NINI HII FORMULA NI FAIR?*
1. Unanunua your equal equity share into the grand Season Vault jackpot so you can win the May trophy! 🏆
2. Hakuna free-riding — existing members already contributed during the previous ${calculation.elapsedGws} rounds.
3. Kuanzia GW${joiningGw}, unalipa tu regular KES ${gameweekStake} per round kama kila mtu!

📱 *Lipa via M-Pesa kwa Chama Wallet:*
${typeof window !== 'undefined' ? window.location.origin : 'https://fantasy-chama.vercel.app'}`;
  }, [leagueName, newMemberName, joiningGw, leagueStartGw, gameweekStake, vaultPercent, calculation]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    haptics.impact();
    confetti({ particleCount: 20, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    haptics.celebrate();
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-3xl bg-[#0F141C] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.15)'
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-transparent to-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">Mid-Season Buy-In Calculator</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Fair Entry
                </span>
              </div>
              <p className="text-xs text-gray-400">Prevents free-riding & calculates fair Season Vault equity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Formula Callout Banner */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-200/90 leading-relaxed">
              <strong className="text-amber-400 font-bold">Jakob Heuristic #2 (Real World Match):</strong> New members pay into the Season Vault for elapsed gameweeks, ensuring 100% fairness to founders who paid from GW{leagueStartGw}.
            </div>
          </div>

          {/* Recalculation Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-400 mb-1 block uppercase tracking-wider">
                Prospective Member Name
              </label>
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="e.g. Dennis Kiptoo"
                className="w-full bg-[#161D26] border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-400 mb-1 flex items-center justify-between uppercase tracking-wider">
                <span>Joining Gameweek</span>
                <span className="text-amber-400 font-bold">GW{joiningGw}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={leagueStartGw}
                  max={38}
                  value={joiningGw}
                  onChange={(e) => {
                    setJoiningGw(Number(e.target.value));
                    haptics.impact();
                  }}
                  className="w-full accent-amber-400 cursor-pointer h-2 bg-white/10 rounded-lg"
                />
                <span className="font-mono text-xs font-bold text-white px-2 py-1 bg-white/5 rounded-lg border border-white/10 min-w-[48px] text-center">
                  GW{joiningGw}
                </span>
              </div>
            </div>
          </div>

          {/* Mathematical Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Elapsed Rounds
              </span>
              <p className="text-lg font-black text-white mt-1">
                {calculation.elapsedGws} <span className="text-xs text-gray-500 font-normal">GWs</span>
              </p>
              <p className="text-[10px] text-gray-500">
                GW{leagueStartGw} → GW{joiningGw}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Vault Equity Catchup
              </span>
              <p className="text-lg font-black text-amber-300 mt-1">
                KES {calculation.vaultCatchup.toLocaleString()}
              </p>
              <p className="text-[10px] text-amber-400/80">
                {calculation.elapsedGws} × {gameweekStake} × {vaultPercent}%
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                1st Round Pot Stake
              </span>
              <p className="text-lg font-black text-emerald-300 mt-1">
                KES {calculation.firstRoundStake.toLocaleString()}
              </p>
              <p className="text-[10px] text-emerald-400/80">
                Active for GW{joiningGw} pot
              </p>
            </div>
          </div>

          {/* Hero Total Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-emerald-500/20 border border-amber-500/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
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
            <div className="rounded-2xl bg-[#090C10] border border-white/10 p-3.5 font-mono text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {shareText}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#0C1017] flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-3 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            <span>{copied ? 'Invoice Copied! 🎉' : 'Copy Invoice'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-black font-black text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,211,102,0.3)] active:scale-95"
          >
            <Share2 className="w-4 h-4 text-black" />
            <span>Send via WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
