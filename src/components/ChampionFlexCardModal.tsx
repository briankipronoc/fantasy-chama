import { useState, useEffect } from 'react';
import { Trophy, X, Download, Share2, Copy, Check, Sparkles, Flame, Dices } from 'lucide-react';
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
  leagueCode?: string;
}

interface BanterItem {
  id: string;
  label: string;
  title: string;
  text: string;
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
  leagueCode,
}: ChampionFlexCardModalProps) {
  const [activeBanterIndex, setActiveBanterIndex] = useState(0);
  const [customMessage, setCustomMessage] = useState('');
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const appUrl = (typeof window !== 'undefined' && window.location.origin)
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL || 'https://fantasy-chama.vercel.app');

  const joinUrl = leagueCode ? `${appUrl}/access?code=${encodeURIComponent(leagueCode)}` : appUrl;
  const isSideBet = winType === 'sidebet';

  const getSideBetBanters = (name: string): BanterItem[] => [
    {
      id: 'mapema',
      label: '🏎️ Nilisema Mapema',
      title: 'Confidence Banter',
      text: [
        `⚔️ *${leagueName} — Side Bet Victory!*`,
        ``,
        `Nilisema mapema hii duel ni yangu 😂!`,
        `🥇 Winner: *${name}*`,
        `🥊 Humbled: *${defeatedOpponent || 'Rival'}*`,
        `💰 Wager Claimed: *KES ${amountWon.toLocaleString()}* safi via Pochi!`,
        `Duel: "${betTitle || 'Head-to-Head Wager'}"`,
        ``,
        `Form is temporary, class is permanent. 🐐🔥`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
    {
      id: 'goat',
      label: '🐐 Humbled Huyu Ndugu',
      title: 'Class is Permanent',
      text: [
        `⚔️ *Duel Settled — ${leagueName}*`,
        ``,
        `Pole sana ndugu yangu *${defeatedOpponent || 'Rival'}* 🤝😂`,
        `Scoreboard haidanganyi:`,
        `🥇 Winner: *${name}*`,
        `💰 Cash Claimed: *KES ${amountWon.toLocaleString()}*`,
        ``,
        `Wallets auto-settled safi kabisa kwa Chama.`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
    {
      id: 'respect',
      label: '☕ Chezeni Chini',
      title: 'Cool & Collected',
      text: [
        `⚔️ *${leagueName} — Head-to-Head Duel*`,
        ``,
        `🥇 Winner: *${name}*`,
        `Cash secured: *KES ${amountWon.toLocaleString()}* ☕`,
        `Gg *${defeatedOpponent || 'Rival'}*, chezeni chini next time! 🤝⚽`,
        ``,
        `Nani mwingine anataka duel ya next gameweek?`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
    {
      id: 'rematch',
      label: '🔄 Rematch Inakubaliwa',
      title: 'Rematch Policy',
      text: [
        `⚔️ *Head-to-Head Settled — ${leagueName}* 🤝`,
        ``,
        `Winner: *${name}* 🥇`,
        `Bounty Won: *KES ${amountWon.toLocaleString()}* 💰`,
        `Humbled: *${defeatedOpponent || 'Rival'}*`,
        ``,
        `Rematch inakubaliwa ukijipanga next gameweek!`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
  ];

  const getGameweekBanters = (name: string, pts: string | number): BanterItem[] => [
    {
      id: 'official',
      label: '🏆 Official Result',
      title: 'Official Winner Announcement',
      text: [
        `🏆 *${leagueName} — GW${gameweek} Champion!*`,
        ``,
        `🥇 Champion: *${name}* ${teamName ? `(${teamName})` : ''}`,
        `🎯 Gameweek Score: *${pts} pts*`,
        `💰 Pot Secured: *KES ${amountWon.toLocaleString()}* (Auto-disbursed via M-Pesa)`,
        ``,
        `Verified by FantasyChama official FPL sync.`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
    {
      id: 'mwizi',
      label: '🥷 Mwizi wa Points',
      title: 'Points Master',
      text: [
        `🏆 *${leagueName} — GW${gameweek} Mwizi wa Points!* 🥷`,
        ``,
        `Hii wiki *${name}* ndiye mwizi wa points rasmi 😂!`,
        `🎯 Score: *${pts} pts* (Highest in the Chama)`,
        `💰 Pot: *KES ${amountWon.toLocaleString()}* safi kwa wallet!`,
        ``,
        `Poleni sana wazee kwa mshtuko wa moyo, chezeni chini next gameweek! 🏁`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
    {
      id: 'goat',
      label: '🐐 Mapema Ndio Best',
      title: 'Class is Permanent',
      text: [
        `🏆 *GW${gameweek} Champion — ${leagueName}*`,
        ``,
        `Mapema ndio best! Form is temporary, class is permanent. 🐐`,
        `🥇 *${name}* ${teamName ? `(${teamName})` : ''}`,
        `Points: *${pts} pts* | Payout: *KES ${amountWon.toLocaleString()}* 🎉`,
        ``,
        `Nani mwingine anataka kufunzwa FPL hapa? 😎`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
    {
      id: 'respect',
      label: '☕ Respect & Chai',
      title: 'Cool & Collected',
      text: [
        `🏆 *${leagueName} — Gameweek ${gameweek}*`,
        ``,
        `Champion: *${name}* 🥇`,
        `Score: *${pts} pts* | Pot: *KES ${amountWon.toLocaleString()}* ☕`,
        ``,
        `Nilikuwa nawangoja lakini hamkufika kwa podium leo. Tutaonana next GW! 🤝⚽`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
    {
      id: 'pep',
      label: '🧠 Tactical Masterclass',
      title: 'Pep Guardiola wa Chama',
      text: [
        `🏆 *${leagueName} Tactical Masterclass — GW${gameweek}* 🧠⚽`,
        ``,
        `Mnaniita Pep Guardiola wa Chama kuanzia leo!`,
        `Captain pick ilikuwa pure genius:`,
        `Champion: *${name}* (*${pts} pts*)`,
        `Pot Won: *KES ${amountWon.toLocaleString()}* 💸`,
        ``,
        `Classes zinaanza Monday, admission ni free kwa table-trailers! 📚😂`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
    {
      id: 'lunch',
      label: '🥩 Asanteni kwa Lunch',
      title: 'Pot ya Wiki',
      text: [
        `🏆 *${leagueName} — GW${gameweek} Settled!*`,
        ``,
        `Asanteni sana wadau kwa kunilipia lunch na fuel ya wiki mzima! 😂🥩`,
        `Winner: *${name}* (*${pts} pts*)`,
        `Pot Secured: *KES ${amountWon.toLocaleString()}*`,
        ``,
        `Jiandaeni kwa kichapo kingine next gameweek! 🔥`,
        ...(leagueCode ? [`🔑 League Code: *${leagueCode}*`] : []),
        `👉 ${joinUrl}`,
      ].join('\n'),
    },
  ];

  useEffect(() => {
    const initialBanters = isSideBet
      ? getSideBetBanters(winnerName)
      : getGameweekBanters(winnerName, points !== undefined ? points : 0);
    setCustomMessage(initialBanters[0]?.text || '');
    setActiveBanterIndex(0);
  }, [winnerName, points, isOpen, winType, leagueCode]);

  const handleShuffleBanter = () => {
    setIsRollingDice(true);
    haptics.selection();
    setTimeout(() => {
      const currentList = isSideBet
        ? getSideBetBanters(winnerName)
        : getGameweekBanters(winnerName, points !== undefined ? points : 0);
      const nextIdx = (activeBanterIndex + 1 + Math.floor(Math.random() * (currentList.length - 1))) % currentList.length;
      setActiveBanterIndex(nextIdx);
      setCustomMessage(currentList[nextIdx]?.text || '');
      setIsRollingDice(false);
    }, 280);
  };

  const handleCopyMessage = () => {
    haptics.selection();
    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    haptics.success();
    const encoded = encodeURIComponent(customMessage);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  if (!isOpen) return null;

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

      // 1. Toned-down, elegant graphite background
      const bgGrad = ctx.createRadialGradient(540, 540, 150, 540, 540, 750);
      bgGrad.addColorStop(0, '#151b24');
      bgGrad.addColorStop(0.6, '#0d1219');
      bgGrad.addColorStop(1, '#070a0e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1080);

      // 2. Refined gold hairline borders
      ctx.strokeStyle = isSideBet ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 48, 984, 984);

      ctx.strokeStyle = isSideBet ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(60, 60, 960, 960);

      // Top accent bar
      ctx.fillStyle = isSideBet ? '#EF4444' : '#F59E0B';
      ctx.fillRect(440, 75, 200, 3);

      // 3. Header
      ctx.fillStyle = isSideBet ? '#F87171' : '#FBBF24';
      ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '5px';
      ctx.fillText(isSideBet ? 'HEAD-TO-HEAD DUEL SETTLED' : `GAMEWEEK ${gameweek} CHAMPION`, 540, 140);

      // 4. League Name Subheader
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText(leagueName.toUpperCase(), 540, 185);

      // 5. Refined Trophy Icon
      ctx.font = '80px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(isSideBet ? '⚔️' : '🏆', 540, 305);

      // 6. Winner Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText((winnerName || 'Champion').trim(), 540, 410);

      // 7. Team Name / Duel Subtitle
      if (isSideBet) {
        ctx.fillStyle = '#F87171';
        ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Defeated ${defeatedOpponent || 'Rival'} in "${betTitle || 'Side Bet'}"`, 540, 465);
      } else if (teamName) {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(teamName, 540, 465);
      }

      // 8. Stats Cards Container (Toned-down, clean)
      if (isSideBet) {
        // Opponent Card
        ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(160, 540, 350, 200, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#F87171';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('HUMBLED RIVAL', 335, 600);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${defeatedOpponent || 'Opponent'}`, 335, 680);
      } else {
        // Score Card
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(160, 540, 350, 200, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('GAMEWEEK SCORE', 335, 600);

        ctx.fillStyle = '#34D399';
        ctx.font = '900 70px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${points !== undefined ? points : 0}`, 335, 685);

        ctx.fillStyle = '#10B981';
        ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('POINTS', 335, 715);
      }

      // Pot Won Card
      ctx.fillStyle = 'rgba(245, 158, 11, 0.05)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(570, 540, 350, 200, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FBBF24';
      ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(isSideBet ? 'DUEL POT CLAIMED' : 'POT SECURED', 745, 600);

      ctx.fillStyle = '#FDE68A';
      ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`KES ${amountWon.toLocaleString()}`, 745, 685);

      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('AUTO-DISBURSED M-PESA', 745, 715);

      // 9. League Code Pill if available
      if (leagueCode) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(390, 800, 300, 48, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#E2E8F0';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`LEAGUE CODE: ${leagueCode}`, 540, 832);
      }

      // 10. Bottom Footer / Verified Stamp
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText('VERIFIED BY FANTASYCHAMA • OFFICIAL FPL SYNC', 540, 960);

      // Export as PNG download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = isSideBet
        ? `${(winnerName || 'Champion').replace(/\s+/g, '_')}_won_duel.png`
        : `${(winnerName || 'Champion').replace(/\s+/g, '_')}_GW${gameweek}_Champion.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export canvas image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[125000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#121820] border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl relative text-slate-900 dark:text-white my-auto max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
                {isSideBet ? 'Side Bet Victory Card' : 'Gameweek Victory Card'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                Official Chama result ready for WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={() => { haptics.selection(); onClose(); }}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Digital Flex Card Preview */}
        <div className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#161d26] to-[#0d1218] p-4 text-center shadow-lg overflow-hidden mb-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400 mb-2 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            {isSideBet ? `DUEL SETTLED • ${leagueName}` : `GW${gameweek} CHAMPION • ${leagueName}`}
          </p>

          <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {winnerName || 'Champion'}
          </h3>

          {isSideBet ? (
            <p className="text-xs text-red-400 font-bold mt-0.5">
              Humbled {defeatedOpponent || 'Rival'} in "{betTitle || 'Side Bet'}"
            </p>
          ) : (
            teamName && <p className="text-xs text-slate-400 font-medium mt-0.5">{teamName}</p>
          )}

          {leagueCode && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-medium text-gray-400 mt-1.5">
              League Code: <span className="font-mono font-bold text-amber-300">{leagueCode}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-white/10">
            <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                {isSideBet ? 'Rival' : 'Gameweek Score'}
              </p>
              <p className="text-lg font-black text-emerald-400 truncate">
                {isSideBet ? (defeatedOpponent || 'Rival') : `${points !== undefined ? points : 0} pts`}
              </p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-2.5 border border-amber-500/20">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-0.5">
                Pot Secured
              </p>
              <p className="text-lg font-black text-amber-300 tabular-nums">
                KES {amountWon.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-2.5 pt-2 border-t border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">
              Verified Chama Settlement • Official FPL Sync
            </p>
          </div>
        </div>

        {/* Banter Caption Box */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-xs font-bold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> WhatsApp Banter
            </p>
            <button
              type="button"
              onClick={handleShuffleBanter}
              disabled={isRollingDice}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Roll to switch banter message"
            >
              <Dices className={`w-3.5 h-3.5 text-amber-500 ${isRollingDice ? 'animate-spin' : ''}`} />
              <span>Shuffle Banter 🎲</span>
            </button>
          </div>

          <div className="relative">
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#0a0e14] border border-slate-200 dark:border-white/10 focus:border-amber-500/50 text-xs font-mono text-slate-800 dark:text-gray-200 leading-relaxed outline-none resize-none custom-scrollbar"
              placeholder="Edit your banter message..."
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-gray-500 px-1 mt-1 font-medium">
              <span>✏️ Tap inside to edit or personalize</span>
              <span>{customMessage.length} chars</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleShareWhatsApp}
            className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-[#25D366]/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            Share to WhatsApp Group
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? 'Exporting...' : 'Download Image'}
            </button>
            <button
              onClick={handleCopyMessage}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white rounded-xl font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Banter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
