// src/components/SeasonCeremonyModal.tsx
import { useState, useEffect, useRef } from 'react';
import { Trophy, Download, Share2, Copy, Check, ShieldCheck, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { haptics } from '../utils/haptics';

export interface SeasonWinnerTier {
  rank: number;
  name: string;
  teamName: string;
  percent: number;
  amount: number;
  points?: number;
}

interface SeasonCeremonyModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueName: string;
  seasonVaultTotal: number;
  winners: SeasonWinnerTier[];
  chairmanName?: string;
}

export default function SeasonCeremonyModal({
  isOpen,
  onClose,
  leagueName,
  seasonVaultTotal,
  winners,
  chairmanName = 'Chairman',
}: SeasonCeremonyModalProps) {
  const [activeTab, setActiveTab] = useState<'podium' | 'certificate'>('podium');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      haptics.success();
      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.45 },
        colors: ['#FBBF24', '#10B981', '#FFFFFF', '#60A5FA'],
      });
      const t = setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FBBF24', '#F59E0B'],
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10B981', '#34D399'],
        });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const champion = winners[0] || {
    name: 'Season Champion',
    teamName: 'Champion FC',
    amount: Math.round(seasonVaultTotal * 0.35),
    percent: 35,
    rank: 1,
  };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fantasychama.onrender.com';

  const seasonBroadcastMessage = [
    `🏆 *FANTASYCHAMA — OFFICIAL SEASON PODIUM* 🏆`,
    `Chama: *${leagueName}*`,
    `Total Season Vault Distributed: *KES ${seasonVaultTotal.toLocaleString()}*`,
    ``,
    `🥇 *#1 CHAMPION:* ${winners[0]?.name || 'N/A'} (${winners[0]?.teamName || ''})`,
    `💰 *KES ${Number(winners[0]?.amount || 0).toLocaleString()}* (35% Tier 1)`,
    ``,
    `🥈 *#2 RUNNER-UP:* ${winners[1]?.name || 'N/A'} (${winners[1]?.teamName || ''})`,
    `💰 *KES ${Number(winners[1]?.amount || 0).toLocaleString()}* (25% Tier 2)`,
    ``,
    `🥉 *#3 THIRD PLACE:* ${winners[2]?.name || 'N/A'} (${winners[2]?.teamName || ''})`,
    `💰 *KES ${Number(winners[2]?.amount || 0).toLocaleString()}* (20% Tier 3)`,
    ``,
    winners[3] ? `🎖️ *#4 FOURTH:* ${winners[3].name} — KES ${Number(winners[3].amount).toLocaleString()} (12%)` : '',
    winners[4] ? `🎖️ *#5 FIFTH:* ${winners[4].name} — KES ${Number(winners[4].amount).toLocaleString()} (8%)` : '',
    ``,
    `Hongera sana kwa washindi wote! 🍾🎉 Wallets have been credited cleanly via FantasyChama Vault Engine.`,
    `👉 ${appUrl}/finances`,
  ].filter(Boolean).join('\n');

  const handleShareWhatsApp = () => {
    haptics.selection();
    window.open(`https://wa.me/?text=${encodeURIComponent(seasonBroadcastMessage)}`, '_blank');
  };

  const handleCopyMessage = () => {
    haptics.selection();
    navigator.clipboard.writeText(seasonBroadcastMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCertificate = async () => {
    setIsExporting(true);
    haptics.selection();
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      canvas.width = 1200;
      canvas.height = 750;

      const grad = ctx.createLinearGradient(0, 0, 1200, 750);
      grad.addColorStop(0, '#0a0f16');
      grad.addColorStop(0.5, '#0d1520');
      grad.addColorStop(1, '#080c12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 750);

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 10;
      ctx.strokeRect(30, 30, 1140, 690);

      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2;
      ctx.strokeRect(45, 45, 1110, 660);

      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FANTASYCHAMA • OFFICIAL CERTIFICATE OF EXCELLENCE', 600, 110);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 48px sans-serif';
      ctx.fillText('SEASON CHAMPION', 600, 180);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 20px sans-serif';
      ctx.fillText('This is officially awarded to the supreme manager of', 600, 230);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(leagueName, 600, 280);

      ctx.fillStyle = '#FEF3C7';
      ctx.font = '900 54px sans-serif';
      ctx.fillText(champion.name, 600, 370);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '600 24px sans-serif';
      ctx.fillText(champion.teamName || 'FPL Contender', 600, 415);

      ctx.fillStyle = '#161e27';
      ctx.beginPath();
      ctx.roundRect(400, 460, 400, 100, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('SEASON VAULT TIER 1 PAYOUT (35%)', 600, 495);

      ctx.fillStyle = '#34D399';
      ctx.font = '900 36px sans-serif';
      ctx.fillText(`KES ${champion.amount.toLocaleString()}`, 600, 540);

      ctx.fillStyle = '#64748B';
      ctx.font = '14px monospace';
      ctx.fillText(`VERIFIED BY CHAIRMAN: ${chairmanName.toUpperCase()}`, 350, 640);
      ctx.fillText(`AUTHENTICATED BY FANTASYCHAMA ENGINE`, 850, 640);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `FantasyChama_Season_Champion_${champion.name.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Certificate export failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0b1016] border border-amber-500/30 rounded-3xl p-5 sm:p-8 shadow-[0_0_80px_rgba(245,158,11,0.2)] overflow-hidden my-auto">
        <div className="absolute top-0 right-1/4 w-96 h-40 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute top-1/3 left-0 w-80 h-40 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.4)] text-black">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Grand Finale
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  Vault KES {seasonVaultTotal.toLocaleString()}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
                {leagueName} <span className="text-amber-400">Season Ceremony</span>
              </h2>
            </div>
          </div>

          <button
            onClick={() => { haptics.selection(); onClose(); }}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 p-1 bg-black/40 border border-white/5 rounded-2xl w-fit mb-6">
          <button
            onClick={() => { haptics.selection(); setActiveTab('podium'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'podium'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🏆 Championship Podium
          </button>
          <button
            onClick={() => { haptics.selection(); setActiveTab('certificate'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'certificate'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📜 Digital Winner Certificate
          </button>
        </div>

        {activeTab === 'podium' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* #2 Runner Up */}
              <div className="order-2 md:order-1 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-8 h-8 rounded-full bg-slate-300 text-slate-900 font-black text-xs flex items-center justify-center shadow">
                    #2
                  </span>
                  <span className="text-[10px] font-black uppercase text-slate-400">Runner-Up · 25%</span>
                </div>
                <div>
                  <h4 className="text-lg font-black text-white truncate">{winners[1]?.name || 'Runner Up'}</h4>
                  <p className="text-xs text-slate-400 font-medium truncate">{winners[1]?.teamName || 'FPL Contender'}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800">
                  <p className="text-[9px] uppercase font-bold text-slate-500">Vault Prize</p>
                  <p className="text-xl font-black text-slate-200 tabular-nums">
                    KES {Number(winners[1]?.amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* #1 Champion */}
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/20 via-[#181308] to-black border-2 border-amber-400/60 rounded-3xl p-6 flex flex-col justify-between relative shadow-[0_0_40px_rgba(245,158,11,0.25)] md:-mt-3">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-black font-black text-[10px] uppercase tracking-widest shadow-md">
                  👑 Grand Champion
                </div>
                <div className="flex items-center justify-between mb-3 pt-2">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-black font-black text-sm flex items-center justify-center shadow-lg">
                    #1
                  </span>
                  <span className="text-[10px] font-black uppercase text-amber-300">Tier 1 · 35%</span>
                </div>
                <div>
                  <h4 className="text-2xl font-black text-white tracking-tight truncate">{champion.name}</h4>
                  <p className="text-sm font-bold text-amber-300/80 truncate">{champion.teamName || 'Champion FC'}</p>
                </div>
                <div className="mt-5 pt-3 border-t border-amber-500/20">
                  <p className="text-[10px] uppercase font-black text-amber-400 tracking-wider">Top Vault Prize</p>
                  <p className="text-3xl font-black text-emerald-400 tabular-nums tracking-tight">
                    KES {champion.amount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* #3 Third Place */}
              <div className="order-3 bg-amber-950/30 border border-amber-800/40 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="w-8 h-8 rounded-full bg-amber-700 text-amber-100 font-black text-xs flex items-center justify-center shadow">
                    #3
                  </span>
                  <span className="text-[10px] font-black uppercase text-amber-500">Bronze · 20%</span>
                </div>
                <div>
                  <h4 className="text-lg font-black text-white truncate">{winners[2]?.name || 'Third Place'}</h4>
                  <p className="text-xs text-gray-400 font-medium truncate">{winners[2]?.teamName || 'FPL Contender'}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-amber-900/30">
                  <p className="text-[9px] uppercase font-bold text-amber-600">Vault Prize</p>
                  <p className="text-xl font-black text-amber-300 tabular-nums">
                    KES {Number(winners[2]?.amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* #4 & #5 Honourable Mentions */}
            {(winners[3] || winners[4]) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {winners[3] && (
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-white/10 text-gray-300 font-bold text-xs flex items-center justify-center">
                        #4
                      </span>
                      <div>
                        <p className="text-sm font-black text-white">{winners[3].name}</p>
                        <p className="text-[11px] text-gray-400">{winners[3].teamName} • 12% cut</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-400 tabular-nums">
                      KES {Number(winners[3].amount).toLocaleString()}
                    </span>
                  </div>
                )}
                {winners[4] && (
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-white/10 text-gray-300 font-bold text-xs flex items-center justify-center">
                        #5
                      </span>
                      <div>
                        <p className="text-sm font-black text-white">{winners[4].name}</p>
                        <p className="text-[11px] text-gray-400">{winners[4].teamName} • 8% cut</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-400 tabular-nums">
                      KES {Number(winners[4].amount).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-white/10">
              <button
                onClick={handleShareWhatsApp}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Broadcast Season Podium to WhatsApp
              </button>
              <button
                onClick={handleCopyMessage}
                className="w-full sm:w-auto py-3 px-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied Summary' : 'Copy Summary'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div
              ref={certRef}
              className="relative p-8 rounded-2xl bg-gradient-to-b from-[#0e1622] via-[#090e15] to-[#06090d] border-4 border-amber-500/40 text-center shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-2 border border-amber-400/20 rounded-xl pointer-events-none" />
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-lg">
                  <Trophy className="w-8 h-8" />
                </div>
              </div>
              <p className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-[0.25em]">
                FantasyChama • Official Certificate of Excellence
              </p>
              <h3 className="text-3xl font-black text-white tracking-tight mt-2">
                SEASON GRAND CHAMPION
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Conferred upon the supreme manager of <span className="text-emerald-400 font-bold">{leagueName}</span>
              </p>

              <div className="my-6 py-4 bg-amber-500/10 border-y border-amber-500/20 max-w-lg mx-auto">
                <p className="text-2xl sm:text-3xl font-black text-amber-200">{champion.name}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{champion.teamName || 'Champion FC'}</p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold">
                  Vault Allocation Won: KES {champion.amount.toLocaleString()} (35%)
                </span>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-gray-500">
                <span>VERIFIED BY: {chairmanName.toUpperCase()}</span>
                <span>AUTHENTICATED BY FANTASYCHAMA</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleDownloadCertificate}
                disabled={isExporting}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting High-Res Certificate...' : 'Download Official Certificate (PNG)'}
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="w-full sm:w-auto py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Share Champion to WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
