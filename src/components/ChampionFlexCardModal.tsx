import { useState, useEffect } from 'react';
import { Trophy, X, Download, Share2, Copy, Check, Flame, Dices, Crown } from 'lucide-react';
import { haptics } from '../utils/haptics';
import clsx from 'clsx';

export interface KeyPerformer {
  name: string;
  pts: number;
  icon?: string;
  isCaptain?: boolean;
}

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
  sharedBy?: 'winner' | 'chairman';
  chairmanName?: string;
  receiptRef?: string;
  performers?: KeyPerformer[];
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
  sharedBy = 'winner',
  chairmanName = 'The Chairman',
  receiptRef,
  performers,
}: ChampionFlexCardModalProps) {
  const [activeBanterIndex, setActiveBanterIndex] = useState(0);
  const [customMessage, setCustomMessage] = useState('');
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isChairman = sharedBy === 'chairman';
  const appUrl = (typeof window !== 'undefined' && window.location.origin)
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL || 'https://fantasy-chama.vercel.app');

  const joinUrl = leagueCode ? `${appUrl}/access?code=${encodeURIComponent(leagueCode)}` : appUrl;
  const isSideBet = winType === 'sidebet';

  const initials = (winnerName || 'Champion')
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'FC';

  const refCode = receiptRef || `QM${Math.abs((winnerName || 'Joel Sifuna').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 194821 + Number(gameweek || 5) * 313) % 900000 + 100000}P`;

  const displayPerformers: KeyPerformer[] = performers && performers.length > 0 ? performers : [
    { icon: '⚡', name: 'Haaland (C)', pts: Math.min(Math.round(Number(points || 78) * 0.33), 32) || 26 },
    { icon: '🎯', name: 'Palmer', pts: Math.min(Math.round(Number(points || 78) * 0.23), 22) || 18 },
    { icon: '🛡️', name: 'Gabriel', pts: Math.max(Math.round(Number(points || 78) * 0.12), 6) || 9 },
  ];

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

  // Chairman's Official Announcements (Third-person official communique)
  const getChairmanBanters = (name: string, pts: string | number): BanterItem[] => {
    const isCashPot = amountWon > 0;
    const isTied = Boolean(isJointWinner && (tiedCount || 0) > 1);
    const tieNote = isTied ? ` (Joint tie with ${Number(tiedCount) - 1} other${Number(tiedCount) > 2 ? 's' : ''})` : '';

    return [
      {
        id: 'chairman-crown',
        label: '👑 Official Ratification',
        title: 'Chairman Official Crown',
        text: [
          `🏆 *Matchday ${gameweek} Champion* 👑`,
          `✨ *Fantasy Chama Official Crown Verified*`,
          ``,
          `🥇 *${winnerName}*`,
          `⚡ *${teamName || `${name} Stars FC`} ⚡*`,
          ``,
          `📊 *${pts} PTS* — Rank #1 (Podium 👑)`,
          ...displayPerformers.map(p => `${p.icon} ${p.name}: ${p.pts} pts`),
          ``,
          isCashPot
            ? `💰 *M-Pesa Disbursed Winnings:*\nKES ${amountWon.toLocaleString()} CASH 💰\nRef: ${refCode} · Instant 90' Payout`
            : `👑 *Official Gameweek Podium Winner*`,
          ``,
          `"Mlidhani mtachukua pesa yangu kirahisi? Hii trophy inalala kwangu leo. Tafuteni fundi wa points!" 😮‍💨🏆`,
          ``,
          `Officially ratified & certified by Chairman ${chairmanName}. Wadau wote wametii matokeo! 🤝⚽`,
          ``,
          ...(leagueCode ? [`👉 Live League Standings:\n${joinUrl}`] : [`👉 Live League Standings:\n${joinUrl}`]),
        ].join('\n'),
      },
      {
        id: 'official-communique',
        label: '📢 Official Communiqué',
        title: 'Executive Proclamation',
        text: [
          `📢 *OFFICIAL CHAMA COMMUNIQUÉ — GW${gameweek}* 👑`,
          `Office of the Chairperson officially ratifies *${name}* ${teamName ? `(${teamName})` : ''} as the GW${gameweek} Champion with *${pts} pts*${tieNote}!`,
          isCashPot
            ? `💰 *KES ${amountWon.toLocaleString()}* cash pot has been released & auto-disbursed via M-Pesa. 💸`
            : `🏆 Gameweek MVP & Grand Season Vault points secured!`,
          `Hongera sana champion! Mkutano umefungwa, game on for next gameweek! 🤝⚽`,
          ``,
          ...(leagueCode ? [`👉 ${joinUrl}`] : []),
        ].join('\n'),
      },
      {
        id: 'ratified-verdict',
        label: '⚖️ Ratified Verdict',
        title: 'Chairman Verification Stamp',
        text: [
          `⚖️ *Office of the Chair — ${leagueName}*`,
          `Official results for Gameweek ${gameweek} are now certified:`,
          `🥇 Crowned Champion: *${name}* (*${pts} pts*)`,
          isCashPot
            ? `💸 Disbursed Payout: *KES ${amountWon.toLocaleString()}* (Direct to Wallet/M-Pesa)`
            : `👑 Status: Gameweek MVP Crowned`,
          `Class is permanent. Wadau wote wametii matokeo ya uwanja! 🏁`,
          ``,
          ...(leagueCode ? [`👉 ${joinUrl}`] : []),
        ].join('\n'),
      },
    ];
  };

  // Winner's Swagger Banters (First-person winner flex)
  const getGameweekBanters = (name: string, pts: string | number): BanterItem[] => {
    const isCashPot = amountWon > 0;
    const isTied = Boolean(isJointWinner && (tiedCount || 0) > 1);
    const tieNote = isTied ? ` (Joint tie with ${Number(tiedCount) - 1} other${Number(tiedCount) > 2 ? 's' : ''})` : '';

    return [
      {
        id: 'fundi-points',
        label: '👑 Fundi wa Points',
        title: 'Fantasy Chama Official Crown',
        text: [
          `🏆 *Matchday ${gameweek} Champion* 👑`,
          `✨ *Fantasy Chama Official Crown Verified*`,
          ``,
          `🥇 *${winnerName}*`,
          `⚡ *${teamName || `${name} Stars FC`} ⚡*`,
          ``,
          `📊 *${pts} PTS* — Rank #1 (Podium 👑)`,
          ...displayPerformers.map(p => `${p.icon} ${p.name}: ${p.pts} pts`),
          ``,
          isCashPot
            ? `💰 *M-Pesa Disbursed Winnings:*\nKES ${amountWon.toLocaleString()} CASH 💰\nRef: ${refCode} · Instant 90' Payout`
            : `👑 *Official Gameweek Podium Winner*`,
          ``,
          `"Mlidhani mtachukua pesa yangu kirahisi? Hii trophy inalala kwangu leo. Tafuteni fundi wa points!" 😮‍💨🏆`,
          ``,
          ...(leagueCode ? [`👉 Live League Standings:\n${joinUrl}`] : [`👉 Live League Standings:\n${joinUrl}`]),
        ].join('\n'),
      },
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
          ``,
          ...(leagueCode ? [`👉 ${joinUrl}`] : []),
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
          ``,
          ...(leagueCode ? [`👉 ${joinUrl}`] : []),
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
          ``,
          ...(leagueCode ? [`👉 ${joinUrl}`] : []),
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
      : isChairman
        ? getChairmanBanters(winnerFirstName, points !== undefined ? points : 0)
        : getGameweekBanters(winnerFirstName, points !== undefined ? points : 0);
    setCustomMessage(initialBanters[0]?.text || '');
    setActiveBanterIndex(0);
  }, [winnerFirstName, points, isOpen, winType, leagueCode, isChairman]);

  const handleShuffleBanter = () => {
    setIsRollingDice(true);
    haptics.selection();
    setTimeout(() => {
      const currentList = isSideBet
        ? getSideBetBanters(winnerFirstName)
        : isChairman
          ? getChairmanBanters(winnerFirstName, points !== undefined ? points : 0)
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
      if (isChairman) {
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(0.6, '#090e17');
        bgGrad.addColorStop(1, '#020617');
      } else if (!isDark) {
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
      ctx.strokeStyle = isSideBet
        ? 'rgba(239, 68, 68, 0.45)'
        : isChairman
          ? 'rgba(245, 158, 11, 0.65)'
          : 'rgba(245, 158, 11, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 48, 984, 984);

      ctx.strokeStyle = isSideBet
        ? 'rgba(239, 68, 68, 0.2)'
        : isChairman
          ? 'rgba(16, 185, 129, 0.4)'
          : 'rgba(245, 158, 11, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(60, 60, 960, 960);

      // Top accent bar
      ctx.fillStyle = isSideBet ? '#EF4444' : isChairman ? '#10B981' : '#F59E0B';
      ctx.fillRect(440, 75, 200, 3);

      // 3. Header
      ctx.fillStyle = isSideBet
        ? '#DC2626'
        : isChairman
          ? '#FBBF24'
          : (isDark ? '#FBBF24' : '#D97706');
      ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '5px';
      ctx.fillText(
        isSideBet
          ? 'HEAD-TO-HEAD DUEL SETTLED'
          : isChairman
            ? 'OFFICE OF THE CHAIRPERSON • OFFICIAL COMMUNIQUÉ'
            : `GAMEWEEK ${gameweek} CHAMPION FLEX`,
        540,
        140
      );

      // 4. League Name Subheader
      ctx.fillStyle = isChairman
        ? '#10B981'
        : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(30, 41, 59, 0.7)');
      ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText(
        isChairman
          ? `LEAGUE RESULTS RATIFIED • ${leagueName.toUpperCase()}`
          : leagueName.toUpperCase(),
        540,
        185
      );

      // 5. Refined Emblem Icon
      ctx.font = '80px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(isSideBet ? '⚔️' : isChairman ? '👑' : '🏆', 540, 305);

      // 6. Winner Name
      ctx.fillStyle = isDark || isChairman ? '#FFFFFF' : '#0F172A';
      ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(winnerFirstName, 540, 410);

      // 7. Team Name / Duel Subtitle
      if (isSideBet) {
        ctx.fillStyle = '#EF4444';
        ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Defeated ${defeatedOpponent || 'Rival'} in "${betTitle || 'Side Bet'}"`, 540, 465);
      } else if (isChairman) {
        ctx.fillStyle = '#38BDF8';
        ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Officially Crowned GW${gameweek} Champion by Chairman ${chairmanName}`, 540, 465);
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
        ctx.fillStyle = isChairman
          ? 'rgba(16, 185, 129, 0.08)'
          : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(241, 245, 249, 0.85)');
        ctx.strokeStyle = isChairman
          ? 'rgba(16, 185, 129, 0.3)'
          : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(203, 213, 225, 0.8)');
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(160, 540, 350, 200, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isChairman ? '#34D399' : (isDark ? '#94A3B8' : '#64748B');
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(isChairman ? 'CERTIFIED SCORE' : 'GAMEWEEK SCORE', 335, 600);

        ctx.fillStyle = isDark || isChairman ? '#34D399' : '#059669';
        ctx.font = '900 70px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${points !== undefined ? points : 0}`, 335, 685);

        ctx.fillStyle = isDark || isChairman ? '#10B981' : '#047857';
        ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('POINTS RECORDED', 335, 715);
      }

      // Pot Won Card
      ctx.fillStyle = isDark || isChairman ? 'rgba(245, 158, 11, 0.08)' : 'rgba(254, 243, 199, 0.7)';
      ctx.strokeStyle = isDark || isChairman ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(570, 540, 350, 200, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDark || isChairman ? '#FBBF24' : '#B45309';
      ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(
        isSideBet
          ? 'DUEL POT CLAIMED'
          : isChairman
            ? 'DISBURSED VIA M-PESA'
            : (amountWon > 0 ? 'POT SECURED' : 'GAMEWEEK HONOR'),
        745,
        600
      );

      ctx.fillStyle = isDark || isChairman ? '#FDE68A' : '#78350F';
      if (amountWon > 0) {
        ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`KES ${amountWon.toLocaleString()}`, 745, 685);
      } else {
        ctx.font = '900 46px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('GW MVP 👑', 745, 685);
      }

      ctx.fillStyle = isDark || isChairman ? '#F59E0B' : '#92400E';
      ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(
        isChairman
          ? 'CHAIRMAN DISBURSEMENT SEAL'
          : (amountWon > 0 ? 'AUTO-DISBURSED M-PESA' : 'SEASON VAULT CONTENDER'),
        745,
        715
      );

      // 9. League Code Pill if available
      if (leagueCode) {
        ctx.fillStyle = isDark || isChairman ? 'rgba(255, 255, 255, 0.05)' : 'rgba(241, 245, 249, 0.9)';
        ctx.strokeStyle = isDark || isChairman ? 'rgba(255, 255, 255, 0.15)' : 'rgba(203, 213, 225, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(390, 800, 300, 48, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark || isChairman ? '#E2E8F0' : '#334155';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`LEAGUE CODE: ${leagueCode}`, 540, 832);
      }

      // 10. Bottom Footer / Verified Stamp
      ctx.fillStyle = isDark || isChairman ? 'rgba(255, 255, 255, 0.5)' : 'rgba(71, 85, 105, 0.7)';
      ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText(
        isChairman
          ? `OFFICIALLY RATIFIED BY CHAIRPERSON • DISBURSED VIA M-PESA`
          : 'VERIFIED BY FANTASYCHAMA • OFFICIAL FPL SYNC',
        540,
        960
      );

      // Export as PNG download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = isSideBet
        ? `${(winnerName || 'Champion').replace(/\s+/g, '_')}_won_duel.png`
        : isChairman
          ? `${(winnerName || 'Champion').replace(/\s+/g, '_')}_GW${gameweek}_Chairman_Announcement.png`
          : `${(winnerName || 'Champion').replace(/\s+/g, '_')}_GW${gameweek}_Champion_Flex.png`;
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
            <div className={clsx(
              "w-9 h-9 rounded-xl flex items-center justify-center border",
              isChairman
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                : "bg-amber-500/15 border-amber-500/30 text-amber-500"
            )}>
              {isChairman ? <Crown className="w-5 h-5 text-emerald-400" /> : <Trophy className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none flex items-center gap-2">
                <span>{isSideBet ? 'Side Bet Victory Card' : isChairman ? 'Official Chama Communiqué' : isJointWinner && (tiedCount || 0) > 1 ? 'Joint Gameweek Victory Card' : 'Gameweek Victory Card'}</span>
                {isChairman && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    Chairman
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                {isChairman
                  ? 'Officially announce the winner & ratify payouts to the Chama'
                  : 'Official Chama result ready for WhatsApp flex'}
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

        {/* Digital Flex Card Preview — User-requested Matchday Champion Layout */}
        <div className={clsx(
          "relative rounded-3xl border p-4 sm:p-5 text-center shadow-2xl overflow-hidden mb-4",
          isSideBet
            ? "border-rose-500/40 bg-gradient-to-b from-[#211116] via-[#160c10] to-[#0d070a] text-white"
            : isChairman
            ? "border-emerald-500/50 bg-gradient-to-b from-[#0f241a] via-[#091711] to-[#040a07] text-white"
            : "border-amber-500/50 bg-gradient-to-b from-[#1c2430] via-[#101720] to-[#080d12] text-white"
        )}>
          {/* Radial gold glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/15 blur-3xl pointer-events-none" />

          {/* Top Row: Matchday Champion + Verified */}
          <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
              {isSideBet ? 'Head-to-Head Duel' : `Matchday ${gameweek || '5'} Champion`}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider text-emerald-300 shadow-xs">
              <Check className="w-3 h-3 text-emerald-400" />
              Verified
            </span>
          </div>

          {/* Official Crown Ribbon */}
          <div className="flex items-center justify-center gap-1.5 py-1 px-3.5 rounded-full bg-gradient-to-r from-amber-500/15 via-yellow-500/25 to-amber-500/15 border border-amber-400/40 text-amber-300 text-[10.5px] font-black uppercase tracking-widest w-fit mx-auto mb-3 shadow-xs relative z-10">
            <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Fantasy Chama Official Crown</span>
          </div>

          {/* Manager Identity with Initials Avatar */}
          <div className="flex flex-col items-center gap-1.5 mb-3 relative z-10">
            <div className="w-13 h-13 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-0.5 shadow-lg shadow-amber-500/20 ring-2 ring-white/10">
              <div className="w-full h-full rounded-full bg-[#0d131a] flex items-center justify-center font-black text-lg text-amber-300 tracking-wider">
                {initials}
              </div>
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                {winnerName}
              </h3>
              <p className="text-xs font-bold text-amber-400/90 flex items-center justify-center gap-1 mt-0.5">
                <span>{teamName || `${winnerFirstName} Stars FC`}</span>
                <span>⚡</span>
              </p>
            </div>
          </div>

          {/* Big Points Banner & Rank */}
          <div className="py-2.5 px-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md mb-2.5 relative z-10">
            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight tabular-nums flex items-center justify-center gap-2">
              <span>{points !== undefined ? points : 0}</span>
              <span className="text-xl sm:text-2xl text-emerald-400 font-extrabold">PTS</span>
            </div>
            <p className="text-xs font-black uppercase tracking-wider text-amber-400 mt-0.5 flex items-center justify-center gap-1">
              <span>{isJointWinner && (tiedCount || 0) > 1 ? `Rank #1 (Joint ${tiedCount}-Way Tie 👑)` : 'Rank #1 (Podium 👑)'}</span>
            </p>
          </div>

          {/* Star Performers */}
          <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-black/40 border border-white/5 text-[10.5px] mb-2.5 font-semibold relative z-10">
            {displayPerformers.map((p, idx) => (
              <div key={idx} className="truncate">
                <span className="text-gray-400">{p.icon} {p.name}: </span>
                <strong className="text-emerald-400 font-black">{p.pts} pts</strong>
              </div>
            ))}
          </div>

          {/* M-Pesa Disbursed Winnings Box */}
          <div className="rounded-2xl p-2.5 bg-gradient-to-r from-emerald-950/40 via-emerald-900/30 to-emerald-950/40 border border-emerald-500/40 text-center mb-2.5 shadow-inner relative z-10">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300 mb-0.5">
              M-Pesa Disbursed Winnings
            </p>
            <p className="text-lg sm:text-xl font-black text-emerald-400 font-mono tracking-tight">
              KES {amountWon.toLocaleString()} CASH 💰
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] text-gray-300 mt-1">
              <span className="font-mono text-emerald-300/90 font-bold">Ref: {refCode}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Instant 90' Payout
              </span>
            </div>
          </div>

          {/* Banter Quote Callout */}
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs italic text-amber-200/90 leading-relaxed font-serif relative z-10">
            "Mlidhani mtachukua pesa yangu kirahisi? Hii trophy inalala kwangu leo. Tafuteni fundi wa points!" 😮‍💨🏆
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
