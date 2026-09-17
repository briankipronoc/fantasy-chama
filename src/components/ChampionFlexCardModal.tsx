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
  isJointWinner?: boolean;
  tiedCount?: number;
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
  isJointWinner,
  tiedCount,
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
        `⚔️ *${leagueName} — Side Bet Victory!* 🏎️`,
        `Nilisema mapema hii duel ni yangu! 🥇 *${name}* beat *${defeatedOpponent || 'Rival'}*`,
        `💰 Wager Won: *KES ${amountWon.toLocaleString()}* safi! Form is permanent. 🐐🔥`,
        ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
      ].join('\n'),
    },
    {
      id: 'goat',
      label: '🐐 Humbled Huyu Ndugu',
      title: 'Class is Permanent',
      text: [
        `⚔️ *Duel Settled — ${leagueName}* 🐐`,
        `Pole sana *${defeatedOpponent || 'Rival'}* 🤝😂 Scoreboard haidanganyi:`,
        `🥇 Winner: *${name}* · 💰 Wager: *KES ${amountWon.toLocaleString()}*`,
        ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
      ].join('\n'),
    },
    {
      id: 'respect',
      label: '☕ Chezeni Chini',
      title: 'Cool & Collected',
      text: [
        `⚔️ *${leagueName} — Duel Result* ☕`,
        `Winner: *${name}* 🥇 · Cash Secured: *KES ${amountWon.toLocaleString()}*`,
        `Gg *${defeatedOpponent || 'Rival'}*, chezeni chini next time! 🤝⚽`,
        ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
      ].join('\n'),
    },
    {
      id: 'rematch',
      label: '🔄 Rematch Inakubaliwa',
      title: 'Rematch Policy',
      text: [
        `⚔️ *Head-to-Head Settled — ${leagueName}* 🔄`,
        `Winner: *${name}* 🥇 (KES ${amountWon.toLocaleString()}) vs *${defeatedOpponent || 'Rival'}*`,
        `Rematch inakubaliwa ukijipanga next gameweek! 🔥`,
        ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
      ].join('\n'),
    },
  ];

  const getGameweekBanters = (name: string, pts: string | number): BanterItem[] => {
    const isCashPot = amountWon > 0;
    const isTied = Boolean(isJointWinner && (tiedCount || 0) > 1);
    const tieNote = isTied ? ` (Joint tie with ${Number(tiedCount) - 1} other${Number(tiedCount) > 2 ? 's' : ''})` : '';

    return [
      {
        id: 'official',
        label: isTied ? '🤝 Joint Result' : '🏆 Official Result',
        title: isTied ? 'Joint Winner Announcement' : 'Official Winner Announcement',
        text: [
          isTied
            ? `🏆 *${leagueName} — GW${gameweek} Joint Champion!* 🤝`
            : `🏆 *${leagueName} — GW${gameweek} Champion!*`,
          `🥇 *${name}* ${teamName ? `(${teamName})` : ''} tops with *${pts} pts*${tieNote}!`,
          isCashPot
            ? `${isTied ? '💰 Split Pot Secured' : '💰 Pot Secured'}: *KES ${amountWon.toLocaleString()}* (Auto-disbursed via M-Pesa)`
            : `👑 Gameweek MVP & Bragging Rights Secured! (Season Grand Vault Contender 🏆)`,
          ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
        ].join('\n'),
      },
      {
        id: 'mwizi',
        label: '🥷 Mwizi wa Points',
        title: 'Points Master',
        text: [
          `🏆 *${leagueName} — GW${gameweek} Mwizi wa Points!* 🥷`,
          `Hii wiki *${name}* ndiye mwizi wa points (*${pts} pts*${isTied ? ' - Shared Honor' : ''}) 😂!`,
          isCashPot
            ? `💰 ${isTied ? 'Split Pot' : 'Pot'}: *KES ${amountWon.toLocaleString()}* safi kwa wallet. Chezeni chini wazee! 🏁`
            : `👑 Bragging rights safi kwa kibindoni. Chezeni chini wazee! 🏁`,
          ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
        ].join('\n'),
      },
      {
        id: 'goat',
        label: '🐐 Mapema Ndio Best',
        title: 'Class is Permanent',
        text: [
          `🏆 *GW${gameweek} ${isTied ? 'Joint Winner' : 'Champion'} — ${leagueName}* 🐐`,
          `Mapema ndio best! Form is temporary, class is permanent.`,
          isCashPot
            ? `🥇 *${name}* (*${pts} pts*) | ${isTied ? 'Split Payout' : 'Payout'}: *KES ${amountWon.toLocaleString()}* 🎉`
            : `🥇 *${name}* (*${pts} pts*) | Gameweek MVP & King of the Week 👑🎉`,
          ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
        ].join('\n'),
      },
      {
        id: 'respect',
        label: '☕ Respect & Chai',
        title: 'Cool & Collected',
        text: [
          `🏆 *${leagueName} — Gameweek ${gameweek}* ☕`,
          `Champion: *${name}* 🥇 (*${pts} pts*) | ${isCashPot ? `Pot: *KES ${amountWon.toLocaleString()}*` : 'Gameweek MVP 👑'}`,
          `Nilikuwa nawangoja lakini hamkufika podium leo. Tutaonana next GW! 🤝⚽`,
          ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
        ].join('\n'),
      },
      {
        id: 'pep',
        label: '🧠 Tactical Masterclass',
        title: 'Pep Guardiola wa Chama',
        text: [
          `🏆 *${leagueName} Tactical Masterclass — GW${gameweek}* 🧠⚽`,
          `Mnaniita Pep wa Chama kuanzia leo! 🥇 *${name}* (*${pts} pts*)`,
          isCashPot
            ? `Pot Won: *KES ${amountWon.toLocaleString()}* 💸. Classes zinaanza Monday! 📚`
            : `Season Vault inatambua masterclass hii! Classes zinaanza Monday! 📚`,
          ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
        ].join('\n'),
      },
      {
        id: 'lunch',
        label: isCashPot ? '🥩 Asanteni kwa Lunch' : '👑 Supa MVP',
        title: isCashPot ? 'Pot ya Wiki' : 'Supremacy ya Wiki',
        text: [
          `🏆 *${leagueName} — GW${gameweek} Settled!* ${isCashPot ? '🥩' : '👑'}`,
          isCashPot
            ? `Asanteni sana wadau kwa kunilipia lunch na fuel ya wiki! 😂`
            : `Mbio za Season Grand Vault zinaongozwa na wakali! Respect the leader! 👑`,
          `Winner: *${name}* (*${pts} pts*) | ${isCashPot ? `Pot: *KES ${amountWon.toLocaleString()}*` : 'Status: GW MVP 👑'}`,
          ...(leagueCode ? [`🔑 Code: *${leagueCode}* · 👉 ${joinUrl}`] : [`👉 ${joinUrl}`]),
        ].join('\n'),
      },
    ];
  };

  const winnerFirstName = (winnerName || 'Champion').trim().split(/\s+/)[0] || 'Champion';

  useEffect(() => {
    const initialBanters = isSideBet
      ? getSideBetBanters(winnerFirstName)
      : getGameweekBanters(winnerFirstName, points !== undefined ? points : 0);
    setCustomMessage(initialBanters[0]?.text || '');
    setActiveBanterIndex(0);
  }, [winnerFirstName, points, isOpen, winType, leagueCode]);

  const handleShuffleBanter = () => {
    setIsRollingDice(true);
    haptics.selection();
    setTimeout(() => {
      const currentList = isSideBet
        ? getSideBetBanters(winnerFirstName)
        : getGameweekBanters(winnerFirstName, points !== undefined ? points : 0);
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

      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

      // 1. Background gradient
      const bgGrad = ctx.createRadialGradient(540, 540, 150, 540, 540, 750);
      if (!isDark) {
        bgGrad.addColorStop(0, '#FFFFFF');
        bgGrad.addColorStop(0.6, '#FCF9F2');
        bgGrad.addColorStop(1, '#F5EFE1');
      } else {
        bgGrad.addColorStop(0, '#151b24');
        bgGrad.addColorStop(0.6, '#0d1219');
        bgGrad.addColorStop(1, '#070a0e');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1080);

      // 2. Refined gold hairline borders
      ctx.strokeStyle = isSideBet ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 48, 984, 984);

      ctx.strokeStyle = isSideBet ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(60, 60, 960, 960);

      // Top accent bar
      ctx.fillStyle = isSideBet ? '#EF4444' : '#F59E0B';
      ctx.fillRect(440, 75, 200, 3);

      // 3. Header
      ctx.fillStyle = isSideBet ? '#DC2626' : (isDark ? '#FBBF24' : '#D97706');
      ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '5px';
      ctx.fillText(isSideBet ? 'HEAD-TO-HEAD DUEL SETTLED' : `GAMEWEEK ${gameweek} CHAMPION`, 540, 140);

      // 4. League Name Subheader
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(30, 41, 59, 0.7)';
      ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText(leagueName.toUpperCase(), 540, 185);

      // 5. Refined Trophy Icon
      ctx.font = '80px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(isSideBet ? '⚔️' : '🏆', 540, 305);

      // 6. Winner Name
      ctx.fillStyle = isDark ? '#FFFFFF' : '#0F172A';
      ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(winnerFirstName, 540, 410);

      // 7. Team Name / Duel Subtitle
      if (isSideBet) {
        ctx.fillStyle = '#EF4444';
        ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Defeated ${defeatedOpponent || 'Rival'} in "${betTitle || 'Side Bet'}"`, 540, 465);
      } else if (teamName) {
        ctx.fillStyle = isDark ? '#94A3B8' : '#475569';
        ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(teamName, 540, 465);
      }

      // 8. Stats Cards Container (Toned-down, clean)
      if (isSideBet) {
        // Opponent Card
        ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.08)';
        ctx.strokeStyle = isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(160, 540, 350, 200, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#EF4444';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('HUMBLED RIVAL', 335, 600);

        ctx.fillStyle = isDark ? '#FFFFFF' : '#0F172A';
        ctx.font = '800 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${defeatedOpponent || 'Opponent'}`, 335, 680);
      } else {
        // Score Card
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(241, 245, 249, 0.85)';
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(203, 213, 225, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(160, 540, 350, 200, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('GAMEWEEK SCORE', 335, 600);

        ctx.fillStyle = isDark ? '#34D399' : '#059669';
        ctx.font = '900 70px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${points !== undefined ? points : 0}`, 335, 685);

        ctx.fillStyle = isDark ? '#10B981' : '#047857';
        ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('POINTS', 335, 715);
      }

      // Pot Won Card
      ctx.fillStyle = isDark ? 'rgba(245, 158, 11, 0.05)' : 'rgba(254, 243, 199, 0.7)';
      ctx.strokeStyle = isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(570, 540, 350, 200, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDark ? '#FBBF24' : '#B45309';
      ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(
        isSideBet ? 'DUEL POT CLAIMED' : (amountWon > 0 ? 'POT SECURED' : 'GAMEWEEK HONOR'),
        745,
        600
      );

      ctx.fillStyle = isDark ? '#FDE68A' : '#78350F';
      if (amountWon > 0) {
        ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`KES ${amountWon.toLocaleString()}`, 745, 685);
      } else {
        ctx.font = '900 46px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('GW MVP 👑', 745, 685);
      }

      ctx.fillStyle = isDark ? '#F59E0B' : '#92400E';
      ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(
        amountWon > 0 ? 'AUTO-DISBURSED M-PESA' : 'SEASON VAULT CONTENDER',
        745,
        715
      );

      // 9. League Code Pill if available
      if (leagueCode) {
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(241, 245, 249, 0.9)';
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(203, 213, 225, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(390, 800, 300, 48, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#E2E8F0' : '#334155';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`LEAGUE CODE: ${leagueCode}`, 540, 832);
      }

      // 10. Bottom Footer / Verified Stamp
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(71, 85, 105, 0.7)';
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
    <div className="fixed inset-0 z-[125000] bg-slate-900/35 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-lg md:max-w-xl bg-white dark:bg-[#121820] border border-slate-200 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl relative text-slate-900 dark:text-white my-auto max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
                {isSideBet ? 'Side Bet Victory Card' : isJointWinner && (tiedCount || 0) > 1 ? 'Joint Gameweek Victory Card' : 'Gameweek Victory Card'}
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

        {/* Digital Flex Card Preview — Adaptive Light & Dark Mode */}
        <div className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-50/80 via-white to-amber-50/40 dark:from-[#161d26] dark:to-[#0d1218] p-4 text-center shadow-md dark:shadow-lg overflow-hidden mb-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 mb-2 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
            {isSideBet
              ? `DUEL SETTLED • ${leagueName}`
              : isJointWinner && (tiedCount || 0) > 1
                ? `GW${gameweek} JOINT CHAMPION (${tiedCount}-WAY TIE) • ${leagueName}`
                : `GW${gameweek} CHAMPION • ${leagueName}`}
          </p>

          <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {winnerFirstName}
          </h3>

          {isSideBet ? (
            <p className="text-xs text-red-500 dark:text-red-400 font-bold mt-0.5">
              Humbled {defeatedOpponent || 'Rival'} in "{betTitle || 'Side Bet'}"
            </p>
          ) : (
            teamName && <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">{teamName}</p>
          )}

          {leagueCode && (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-medium text-slate-600 dark:text-gray-400 mt-1.5">
              League Code: <span className="font-mono font-bold text-amber-600 dark:text-amber-300">{leagueCode}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <div className="bg-slate-100/90 dark:bg-white/[0.04] rounded-xl p-2.5 border border-slate-200 dark:border-white/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-0.5">
                {isSideBet ? 'Rival' : 'Gameweek Score'}
              </p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 truncate">
                {isSideBet ? (defeatedOpponent || 'Rival') : `${points !== undefined ? points : 0} pts`}
              </p>
            </div>
            <div className="bg-amber-100/70 dark:bg-amber-500/10 rounded-xl p-2.5 border border-amber-300 dark:border-amber-500/20">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-400 mb-0.5">
                {isJointWinner && (tiedCount || 0) > 1 ? 'Split Pot' : 'Pot Secured'}
              </p>
              <p className="text-lg font-black text-amber-700 dark:text-amber-300 tabular-nums">
                KES {amountWon.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <p className="text-[8px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
              Verified Chama Settlement • Official FPL Sync
            </p>
          </div>
        </div>

        {/* Banter Caption Box — Spacious rows=5 with clean sans-serif typography */}
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
              rows={5}
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0a0e14] border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/60 font-sans text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed outline-none resize-none custom-scrollbar transition-all"
              placeholder="Edit your banter message..."
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-gray-500 px-1 mt-0.5 font-medium">
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
