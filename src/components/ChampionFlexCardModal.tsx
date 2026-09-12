// src/components/ChampionFlexCardModal.tsx
import { useState } from 'react';
import { Trophy, X, Download, Share2, Copy, Check, Sparkles, Flame } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface ChampionFlexCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  winnerName: string;
  teamName?: string;
  points?: number | string;
  gameweek?: number | string;
  amountWon: number;
  leagueName: string;
  winType?: 'gameweek' | 'sidebet';
  betTitle?: string;
  defeatedOpponent?: string;
}

export default function ChampionFlexCardModal({
  isOpen,
  onClose,
  winnerName,
  teamName,
  points,
  gameweek,
  amountWon,
  leagueName,
  winType = 'gameweek',
  betTitle,
  defeatedOpponent,
}: ChampionFlexCardModalProps) {
  const [selectedBanter, setSelectedBanter] = useState<'mirrors' | 'goat' | 'respect'>('mirrors');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const appUrl = (typeof window !== 'undefined' && window.location.origin)
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL || 'https://fantasychama.vercel.app');

  const isSideBet = winType === 'sidebet';

  const banterCaptions = isSideBet ? {
    mirrors: {
      label: '🏎️ Nilisema Mapema',
      title: 'Confidence Banter',
      text: [
        `⚔️ *${leagueName} — Side Bet Victory!*`,
        ``,
        `Nilisema mapema hii duel ni yangu 😂!`,
        `Humbled: *${defeatedOpponent || 'Rival'}*`,
        `Wager Won: *KES ${amountWon.toLocaleString()}* 💰`,
        `Duel: "${betTitle || 'Head-to-Head Wager'}"`,
        ``,
        `Pesa ishaingia kwa wallet cleanly! Walisema form is temporary lakini class ni permanent. 🐐🔥`,
        `👉 ${appUrl}`,
      ].join('\n'),
    },
    goat: {
      label: '🐐 Humbled Huyu Ndugu',
      title: 'Class is Permanent',
      text: [
        `⚔️ *Duel Settled — ${leagueName}*`,
        ``,
        `Pole sana ndugu yangu *${defeatedOpponent || 'Rival'}* 🤝😂`,
        `Ulikuja na story nyingi lakini scoreboard haidanganyi!`,
        ``,
        `Winner: *${winnerName}* 🥇`,
        `Cash Claimed: *KES ${amountWon.toLocaleString()}* 🎉`,
        ``,
        `Kama si FantasyChama ningekuwa nazungushwa kulipwa hadi May! Wallets auto-settled safi kabisa.`,
        `👉 ${appUrl}`,
      ].join('\n'),
    },
    respect: {
      label: '☕ Chezeni Chini',
      title: 'Cool & Collected',
      text: [
        `⚔️ *${leagueName} — Head-to-Head Duel*`,
        ``,
        `Cash secured: *KES ${amountWon.toLocaleString()}* ☕`,
        `Nani mwingine anataka duel ya next gameweek? Line up hapa!`,
        ``,
        `Gg *${defeatedOpponent || 'Rival'}*, chezeni chini next time 🤝⚽`,
        `👉 ${appUrl}`,
      ].join('\n'),
    },
  } : {
    mirrors: {
      label: '🥷 Mwizi wa Points',
      title: 'Mwizi wa Points',
      text: [
        `🏆 *${leagueName} — GW${gameweek} Mwizi wa Points!* 🥷`,
        ``,
        `Hii wiki mimi ndiye mwizi wa points rasmi 😂!`,
        `Score: *${points || 0} pts*`,
        `Pot Secured: *KES ${amountWon.toLocaleString()}* 💰 safi via Pochi!`,
        ``,
        `Poleni sana wazee kwa mshtuko wa moyo, chezeni chini next gameweek! 🏁🔥`,
        `👉 ${appUrl}`,
      ].join('\n'),
    },
    goat: {
      label: '🐐 GOAT Mode',
      title: 'Class is Permanent',
      text: [
        `🏆 *GW${gameweek} Winner — ${leagueName}*`,
        ``,
        `Mapema ndio best! Form is temporary, class is permanent. 🐐`,
        `🥇 *${winnerName}* (${teamName || 'FPL Team'})`,
        `Points: *${points || 0} pts* | Payout: *KES ${amountWon.toLocaleString()}* 🎉`,
        ``,
        `Nani mwingine anataka kufunzwa FPL hapa? 😎`,
        `👉 ${appUrl}`,
      ].join('\n'),
    },
    respect: {
      label: '☕ Respect & Chai',
      title: 'Cool & Collected',
      text: [
        `🏆 *${leagueName} — Gameweek ${gameweek}*`,
        ``,
        `Nilikuwa nawangoja lakini hamkufika kwa podium leo. ☕`,
        `KES *${amountWon.toLocaleString()}* secured safi kabisa na ${points || 0} points.`,
        ``,
        `Tutaonana next gameweek, msikate tamaa! 🤝⚽`,
        `👉 ${appUrl}`,
      ].join('\n'),
    },
  };

  const currentMessage = banterCaptions[selectedBanter].text;

  const handleCopyMessage = () => {
    haptics.selection();
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    haptics.success();
    const encoded = encodeURIComponent(currentMessage);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // Generate crisp HTML5 Canvas Image and trigger download
  const handleDownloadImage = () => {
    haptics.celebrate();
    setIsExporting(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Dark radial background
      const bgGrad = ctx.createRadialGradient(540, 450, 100, 540, 540, 700);
      bgGrad.addColorStop(0, '#1c1f26');
      bgGrad.addColorStop(0.5, '#0e1419');
      bgGrad.addColorStop(1, '#05070a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1080);

      // 2. Gold decorative border & accent lines
      ctx.strokeStyle = isSideBet ? 'rgba(239, 68, 68, 0.4)' : 'rgba(251, 191, 36, 0.35)';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, 1000, 1000);

      ctx.strokeStyle = isSideBet ? 'rgba(239, 68, 68, 0.15)' : 'rgba(251, 191, 36, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(55, 55, 970, 970);

      // Accent banner
      const accentGrad = ctx.createLinearGradient(100, 0, 980, 0);
      if (isSideBet) {
        accentGrad.addColorStop(0, '#EF4444');
        accentGrad.addColorStop(0.5, '#F59E0B');
        accentGrad.addColorStop(1, '#10B981');
      } else {
        accentGrad.addColorStop(0, '#F59E0B');
        accentGrad.addColorStop(0.5, '#FDE68A');
        accentGrad.addColorStop(1, '#D97706');
      }
      ctx.fillStyle = accentGrad;
      ctx.fillRect(340, 65, 400, 6);

      // 3. Header text
      ctx.fillStyle = isSideBet ? '#F87171' : '#FBBF24';
      ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '6px';
      ctx.fillText(isSideBet ? 'HEAD-TO-HEAD DUEL WINNER' : `GAMEWEEK ${gameweek} CHAMPION`, 540, 140);

      // 4. League Name Subheader
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText(leagueName.toUpperCase(), 540, 185);

      // 5. Large Emoji / Icon
      ctx.font = '110px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(isSideBet ? '⚔️' : '🏆', 540, 320);

      // 6. Winner Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(winnerName, 540, 430);

      // 7. Team Name / Duel Subtitle
      if (isSideBet) {
        ctx.fillStyle = '#F87171';
        ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Defeated ${defeatedOpponent || 'Rival'} in "${betTitle || 'Side Bet'}"`, 540, 480);
      } else if (teamName) {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '600 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(teamName, 540, 480);
      }

      // 8. Stats Badge Cards Container
      if (isSideBet) {
        // Opponent Card
        ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(140, 560, 360, 220, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#F87171';
        ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('HUMBLED RIVAL', 320, 620);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${defeatedOpponent || 'Opponent'}`, 320, 710);

        ctx.fillStyle = '#EF4444';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('LOST WAGER', 320, 755);
      } else {
        // Points Card
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(140, 560, 360, 220, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('GAMEWEEK SCORE', 320, 620);

        ctx.fillStyle = '#34D399';
        ctx.font = '900 78px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${points || 0}`, 320, 715);

        ctx.fillStyle = '#10B981';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('POINTS', 320, 755);
      }

      // Pot Won Card
      ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(580, 560, 360, 220, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FBBF24';
      ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(isSideBet ? 'DUEL POT WON' : 'POT SECURED', 760, 620);

      ctx.fillStyle = '#FDE68A';
      ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`KES ${amountWon.toLocaleString()}`, 760, 710);

      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('AUTO-SETTLED WALLET', 760, 755);

      // 9. Bottom Footer / Chama Watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText('FANTASYCHAMA — KENYA\'S FPL POT ENGINE', 540, 960);

      // Export as PNG download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = isSideBet
        ? `${winnerName.replace(/\s+/g, '_')}_won_duel.png`
        : `${winnerName.replace(/\s+/g, '_')}_GW${gameweek}_Champion.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export canvas image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[125000] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-lg bg-[#0e1419] border-2 border-amber-500/40 rounded-3xl p-5 md:p-6 shadow-[0_0_80px_rgba(245,158,11,0.25)] relative text-white my-auto max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={() => { haptics.selection(); onClose(); }}
          className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5" /> WhatsApp Flex Card
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {isSideBet ? 'Share Your Duel Victory!' : 'Share Your Gameweek Victory!'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {isSideBet
              ? 'Flex on the Chama WhatsApp group with an official sidebet victory card or spicy banter.'
              : 'Flex on the Chama WhatsApp group with an official victory card or spicy banter.'}
          </p>
        </div>

        {/* Digital Flex Card Preview */}
        <div className="relative rounded-2xl border-2 border-amber-400/40 bg-gradient-to-br from-[#1c1f26] via-[#10151d] to-[#080c10] p-5 shadow-xl text-center overflow-hidden mb-5">
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500 blur-[100px] opacity-15 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500 blur-[100px] opacity-15 pointer-events-none" />

          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400 mb-1">
              {isSideBet ? `HEAD-TO-HEAD DUEL • ${leagueName}` : `GW${gameweek} CHAMPION • ${leagueName}`}
            </p>

            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 p-[3px] shadow-[0_0_25px_rgba(245,158,11,0.4)] mx-auto my-2 flex items-center justify-center">
              <div className="w-full h-full bg-[#0b1014] rounded-full flex items-center justify-center">
                <Trophy className="w-8 h-8 text-amber-400" />
              </div>
            </div>

            <h3 className="text-xl font-black text-white">{winnerName}</h3>
            {isSideBet ? (
              <p className="text-xs text-red-400 font-semibold mt-0.5">
                Defeated {defeatedOpponent || 'Rival'} in "{betTitle || 'Side Bet'}"
              </p>
            ) : (
              teamName && <p className="text-xs text-slate-400 font-semibold">{teamName}</p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
              <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {isSideBet ? 'Humbled Rival' : 'Score'}
                </p>
                <p className="text-lg md:text-xl font-black text-emerald-400 truncate">
                  {isSideBet ? (defeatedOpponent || 'Rival') : `${points || 0} pts`}
                </p>
              </div>
              <div className="bg-amber-500/10 rounded-xl p-2.5 border border-amber-500/20">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                  {isSideBet ? 'Duel Pot Won' : 'Pot Won'}
                </p>
                <p className="text-xl font-black text-amber-300 tabular-nums">KES {amountWon.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card Export Trigger */}
        <button
          onClick={handleDownloadImage}
          disabled={isExporting}
          className="w-full mb-5 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Generating High-Res Card...' : 'Download Flex Image (PNG for WhatsApp Status)'}
        </button>

        {/* Banter Caption Selector */}
        <div className="border-t border-white/10 pt-4">
          <p className="text-[11px] font-bold text-gray-300 mb-2.5 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Pick Banter Caption for WhatsApp Group:
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(['mirrors', 'goat', 'respect'] as const).map((key) => {
              const isSelected = selectedBanter === key;
              return (
                <button
                  key={key}
                  onClick={() => { haptics.selection(); setSelectedBanter(key); }}
                  className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all border text-center ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {banterCaptions[key].label}
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-[#080c10] border border-white/10 text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto custom-scrollbar mb-4">
            {currentMessage}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="flex-1 py-3.5 px-4 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(37,211,102,0.35)] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Flex on WhatsApp Group
            </button>
            <button
              onClick={handleCopyMessage}
              className="py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
