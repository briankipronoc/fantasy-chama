import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Share2, MessageCircle, Crown, AlertTriangle } from 'lucide-react';
import { haptics } from '../utils/haptics';
import confetti from 'canvas-confetti';

export interface BanterSlipData {
  gameweek: number;
  leagueName: string;
  stake: number;
  vaultPercent?: number;
  currentVaultTotal?: number;
  winner?: {
    name: string;
    teamName?: string;
    points: number;
    amountWon: number;
  } | null;
  lowestScorer?: {
    name: string;
    teamName?: string;
    points: number;
  } | null;
  benchRegret?: {
    name: string;
    teamName?: string;
    benchPoints: number;
  } | null;
  redZoneMembers?: Array<{
    name: string;
    phone?: string;
    balance?: number;
  }>;
}

interface ChamaBanterSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BanterSlipData;
}

type BanterTone = 'street' | 'roast' | 'official';

export default function ChamaBanterSlipModal({ isOpen, onClose, data }: ChamaBanterSlipModalProps) {
  const [tone, setTone] = useState<BanterTone>('street');
  const [copied, setCopied] = useState(false);
  const [customBanterNote, setCustomBanterNote] = useState('');

  const {
    gameweek,
    leagueName,
    winner,
    lowestScorer,
    benchRegret,
    redZoneMembers = [],
    currentVaultTotal = 0,
    stake = 50,
  } = data;

  // Generate De-AI'd authentic Kenyan Chama banter texts
  const generatedText = useMemo(() => {
    const gwLabel = `GW${gameweek}`;
    const headerTitle = `⚽ *${leagueName.toUpperCase()} — ${gwLabel} MATCHDAY BANTER SLIP* 🇰🇪`;
    
    // King of the week
    let kingSection = '';
    if (winner) {
      const hasCashPot = Number(winner.amountWon || 0) > 0;
      if (tone === 'street') {
        kingSection = `👑 *KING WA ROUND (${gwLabel}):* ${winner.name} (${winner.teamName || 'Chama Top Dog'})
└ 💥 *${winner.points} pts* | ${hasCashPot ? `Amepokea KES *${winner.amountWon.toLocaleString()}* safi kwa M-Pesa! Mpigieni makofi kabla pesa iishe 👏💸` : `Ushindi safi wa round bila kupingwa! Heshima yote kwa champion 👏👑🔥`}`;
      } else if (tone === 'roast') {
        kingSection = `👑 *${hasCashPot ? 'TAJIRI WA WIKI' : 'CHAMPION WA WIKI'} (${gwLabel}):* ${winner.name} (${winner.teamName || 'Haters Cry'})
└ 💥 *${winner.points} pts* | ${hasCashPot ? `KES *${winner.amountWon.toLocaleString()}* imeenda hivo. Wengine mlikua mnaomba sare? Pole sana, chama haina huruma! 😂🍾` : `Amebeba heshima yote ya round bila huruma! Wengine mlikua mnaomba sare? Endeleeni kulia kwa pembe! 😂👑`}`;
      } else {
        kingSection = `👑 *ROUND CHAMPION (${gwLabel}):* ${winner.name} (${winner.teamName || 'Top Rank'})
└ 💥 Score: *${winner.points} pts* | ${hasCashPot ? `Cash Pot Disbursed: KES *${winner.amountWon.toLocaleString()}* via M-Pesa. Hongera sana! 🏆` : `Gameweek Winner & League Bragging Rights Secured! Hongera sana! 🏆`}`;
      }
    } else {
      kingSection = `👑 *KING WA ROUND:* Hakuna winner aliyepatikana bado. Standings zinachambuliwa...`;
    }

    // Lowest scorer (Mtu wa Chini)
    let spoonSection = '';
    if (lowestScorer) {
      if (tone === 'street') {
        spoonSection = `🥔 *MTU WA CHINI (WOODEN SPOON):* ${lowestScorer.name}
└ 📉 *${lowestScorer.points} pts* tu! Bro amekam na fomu ya kuteremsha points. Tuma till number tukutumie fare ya kurudi soko 🧻🚑`;
      } else if (tone === 'roast') {
        spoonSection = `🥔 *CHOKORA YA WIKI:* ${lowestScorer.name}
└ 📉 *${lowestScorer.points} pts*! Hata goalkeeper wa Southampton angekushinda points hii wiki. Rudisha smartphone kwa duka utumie Mulika Mwizi 💀📉`;
      } else {
        spoonSection = `🥔 *WOODEN SPOON AWARD:* ${lowestScorer.name}
└ 📉 *${lowestScorer.points} pts* | Pole sana for a tough round. Tactical adjustments needed before the next deadline! 🛡️`;
      }
    }

    // Bench Regret
    let benchSection = '';
    if (benchRegret && benchRegret.benchPoints > 0) {
      if (tone === 'street') {
        benchSection = `🤦 *BENCH WARMER REGRET:* ${benchRegret.name}
└ 🪑 Amekalia *${benchRegret.benchPoints} pts* kwa subs kama hekima ya wazee! Points zimeoza kwa baridi 🥶🤦`;
      } else if (tone === 'roast') {
        benchSection = `🤦 *KIBURI YA SUBS:* ${benchRegret.name}
└ 🪑 Points *${benchRegret.benchPoints}* ziliachwa nje zikinyeshewa. Unalipa starter zero, sub anafunga hat-trick. Akili ni nywele kweli? 🤡`;
      } else {
        benchSection = `🤦 *BENCH CASUALTY:* ${benchRegret.name}
└ 🪑 Left *${benchRegret.benchPoints} pts* on the substitute bench. Painful managerial call! 📉`;
      }
    }

    // Red zone members (arrears)
    let redZoneSection = '';
    if (redZoneMembers.length > 0) {
      const names = redZoneMembers.map(m => `@${m.name}`).join(', ');
      if (tone === 'street') {
        redZoneSection = `🚨 *LIST YA DENI (RED ZONE):*
└ ${names}
👉 M-Pesa wallet iko dry! Leta kakitu ya ${gwLabel} (KES ${stake}) mapema kabla deadline usitolewe kwa pot uwe spectator bure! ⏰💸`;
      } else if (tone === 'roast') {
        redZoneSection = `🚨 *KAMATI YA WALIPA DENI:*
└ ${names}
👉 Mbona mnanunua bundles badala ya kulipa Chama? Chairman ameshika rungu, luku bila stake haina maana. Lipeni KES ${stake}! 👮‍♂️🧾`;
      } else {
        redZoneSection = `🚨 *DEADLINE COMPLIANCE (RED ZONE):*
└ ${names}
👉 Outstanding round stake (KES ${stake}). Please top up your wallet prior to kickoff to maintain active eligibility.`;
      }
    } else {
      redZoneSection = `✅ *RED ZONE STATUS:* Chama iko 100% funded! Watu wote wamelipa stake zao kwa wakati. Safi sana! 💯`;
    }

    // Season Vault
    const vaultText = currentVaultTotal > 0
      ? `🏦 *SEASON VAULT JACKPOT:* KES *${currentVaultTotal.toLocaleString()}* (Inaivana polepole hadi May! 🏆🔥)`
      : `🏦 *SEASON VAULT:* Accumulating weekly stakes for the grand champion finale!`;

    // Sign off & CTA
    const footer = `📱 *Pitia Live App ucheki Standings & Wallet:*
${typeof window !== 'undefined' ? window.location.origin : 'https://fantasy-chama.vercel.app'}`;

    const optionalNote = customBanterNote.trim() ? `\n💬 *CHAIRMAN'S SPECIAL NOTE:*\n"${customBanterNote.trim()}"\n` : '';

    return `${headerTitle}

${kingSection}

${spoonSection ? spoonSection + '\n' : ''}${benchSection ? benchSection + '\n' : ''}${redZoneSection}

${vaultText}
${optionalNote}
${footer}`;
  }, [gameweek, leagueName, winner, lowestScorer, benchRegret, redZoneMembers, currentVaultTotal, stake, tone, customBanterNote]);

  useEffect(() => {
    if (!isOpen) return;

    const stateKey = 'fc_banter_slip_open';
    try {
      window.history.pushState({ [stateKey]: true }, '');
    } catch {
      // ignore state errors in restricted environments
    }

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.[stateKey]) {
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSafeClose = () => {
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    haptics.impact();
    confetti({ particleCount: 25, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    haptics.celebrate();
    const url = `https://wa.me/?text=${encodeURIComponent(generatedText)}`;
    window.open(url, '_blank');
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0F141C] border border-slate-200 dark:border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] dark:shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-white"
        style={{
          boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.15)'
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-500/15 via-slate-50 dark:via-transparent to-amber-500/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white">Chama Banter Slip</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  GW{gameweek}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400">1-Tap WhatsApp digest with authentic Kenyan vibes</p>
            </div>
          </div>
          <button
            onClick={handleSafeClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Tone Selector */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300 mb-2 flex items-center justify-between">
              <span>Select Banter Heat Level</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">Jakob Heuristic #3: User Control</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setTone('street'); haptics.impact(); }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  tone === 'street'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-black shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="text-sm">🇰🇪</span>
                <span className="text-[11px] font-bold">Street Sheng</span>
              </button>
              <button
                type="button"
                onClick={() => { setTone('roast'); haptics.impact(); }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  tone === 'roast'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300 font-black shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="text-sm">🔥</span>
                <span className="text-[11px] font-bold">Kuchoma Roast</span>
              </button>
              <button
                type="button"
                onClick={() => { setTone('official'); haptics.impact(); }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  tone === 'official'
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-700 dark:text-indigo-300 font-black shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="text-sm">👔</span>
                <span className="text-[11px] font-bold">Kikao Rasmi</span>
              </button>
            </div>
          </div>

          {/* Highlights Preview Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase">
                <Crown className="w-3.5 h-3.5" />
                <span>King of Week</span>
              </div>
              <p className="text-xs font-black text-slate-900 dark:text-white mt-1 truncate">
                {winner ? `${winner.name}` : 'Awaiting sync'}
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                {winner ? (Number(winner.amountWon || 0) > 0 ? `${winner.points} pts (KES ${winner.amountWon.toLocaleString()})` : `${winner.points} pts (Round MVP 👑)`) : '—'}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-[10px] uppercase">
                <span>🥔</span>
                <span>Mtu wa Chini</span>
              </div>
              <p className="text-xs font-black text-slate-900 dark:text-white mt-1 truncate">
                {lowestScorer ? lowestScorer.name : 'Everyone safe'}
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                {lowestScorer ? `${lowestScorer.points} pts` : '—'}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-[10px] uppercase">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Red Zone Debt</span>
              </div>
              <p className="text-xs font-black text-slate-900 dark:text-white mt-1">
                {redZoneMembers.length > 0 ? `${redZoneMembers.length} member(s)` : 'All Clear ✓'}
              </p>
              <p className="text-[10px] text-rose-700 dark:text-rose-400 font-mono">
                {redZoneMembers.length > 0 ? `KES ${stake} each` : 'No arrears'}
              </p>
            </div>
          </div>

          {/* Live Banter Slip Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <span>Live WhatsApp Message Preview</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-gray-500 font-mono">{generatedText.length} chars</span>
            </div>
            <div className="relative rounded-2xl bg-slate-100 dark:bg-[#090C10] border border-slate-200 dark:border-white/10 p-3.5 font-mono text-[11px] text-slate-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto selection:bg-emerald-500/30">
              {generatedText}
            </div>
          </div>

          {/* Optional Custom Note */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-gray-300 mb-1 flex items-center justify-between">
              <span>Add Custom Chairman Note (Optional)</span>
              <span className="text-[10px] text-slate-500 dark:text-gray-500">e.g. "Meeting at 8pm", "Deadline Friday"</span>
            </label>
            <input
              type="text"
              value={customBanterNote}
              onChange={(e) => setCustomBanterNote(e.target.value)}
              placeholder="e.g. Kumbukeni kulipa kabla deadline ya Ijumaa saa kumi jioni!"
              className="w-full bg-slate-50 dark:bg-[#161D26] border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0C1017] flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500 dark:text-gray-400" />}
            <span>{copied ? 'Copied to Clipboard! 🎉' : 'Copy Banter Slip'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-black font-black text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,211,102,0.3)] active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-black" />
            <span>Open in WhatsApp</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
