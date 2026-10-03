import { useState, useMemo } from 'react';
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
      if (tone === 'street') {
        kingSection = `👑 *KING WA ROUND (${gwLabel}):* ${winner.name} (${winner.teamName || 'Chama Top Dog'})
└ 💥 *${winner.points} pts* | Amepokea KES *${winner.amountWon.toLocaleString()}* safi kwa M-Pesa! Mpigieni makofi kabla pesa iishe 👏💸`;
      } else if (tone === 'roast') {
        kingSection = `👑 *TAJIRI WA WIKI (${gwLabel}):* ${winner.name} (${winner.teamName || 'Haters Cry'})
└ 💥 *${winner.points} pts* | KES *${winner.amountWon.toLocaleString()}* imeenda hivo. Wengine mlikua mnaomba sare? Pole sana, chama haina huruma! 😂🍾`;
      } else {
        kingSection = `👑 *ROUND CHAMPION (${gwLabel}):* ${winner.name} (${winner.teamName || 'Top Rank'})
└ 💥 Score: *${winner.points} pts* | Cash Pot Disbursed: KES *${winner.amountWon.toLocaleString()}* via M-Pesa. Hongera sana! 🏆`;
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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-3xl bg-[#0F141C] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.15)'
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">Chama Banter Slip</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  GW{gameweek}
                </span>
              </div>
              <p className="text-xs text-gray-400">1-Tap WhatsApp digest with authentic Kenyan vibes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Tone Selector */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center justify-between">
              <span>Select Banter Heat Level</span>
              <span className="text-emerald-400 font-mono text-[10px]">Jakob Heuristic #3: User Control</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setTone('street'); haptics.impact(); }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  tone === 'street'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                <span className="text-sm">🇰🇪</span>
                <span className="text-[11px]">Street Sheng</span>
              </button>
              <button
                type="button"
                onClick={() => { setTone('roast'); haptics.impact(); }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  tone === 'roast'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                <span className="text-sm">🔥</span>
                <span className="text-[11px]">Kuchoma Roast</span>
              </button>
              <button
                type="button"
                onClick={() => { setTone('official'); haptics.impact(); }}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  tone === 'official'
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-bold shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                <span className="text-sm">👔</span>
                <span className="text-[11px]">Kikao Rasmi</span>
              </button>
            </div>
          </div>

          {/* Highlights Preview Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10px] uppercase">
                <Crown className="w-3.5 h-3.5" />
                <span>King of Week</span>
              </div>
              <p className="text-xs font-black text-white mt-1 truncate">
                {winner ? `${winner.name}` : 'Awaiting sync'}
              </p>
              <p className="text-[10px] text-emerald-400 font-mono">
                {winner ? `${winner.points} pts (KES ${winner.amountWon.toLocaleString()})` : '—'}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase">
                <span>🥔</span>
                <span>Mtu wa Chini</span>
              </div>
              <p className="text-xs font-black text-white mt-1 truncate">
                {lowestScorer ? lowestScorer.name : 'Everyone safe'}
              </p>
              <p className="text-[10px] text-amber-400 font-mono">
                {lowestScorer ? `${lowestScorer.points} pts` : '—'}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[10px] uppercase">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Red Zone Debt</span>
              </div>
              <p className="text-xs font-black text-white mt-1">
                {redZoneMembers.length > 0 ? `${redZoneMembers.length} member(s)` : 'All Clear ✓'}
              </p>
              <p className="text-[10px] text-rose-400 font-mono">
                {redZoneMembers.length > 0 ? `KES ${stake} each` : 'No arrears'}
              </p>
            </div>
          </div>

          {/* Live Banter Slip Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <span>Live WhatsApp Message Preview</span>
              </label>
              <span className="text-[10px] text-gray-500 font-mono">{generatedText.length} chars</span>
            </div>
            <div className="relative rounded-2xl bg-[#090C10] border border-white/10 p-3.5 font-mono text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto selection:bg-emerald-500/30">
              {generatedText}
            </div>
          </div>

          {/* Optional Custom Note */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 mb-1 flex items-center justify-between">
              <span>Add Custom Chairman Note (Optional)</span>
              <span className="text-[10px] text-gray-500">e.g. "Meeting at 8pm", "Deadline Friday"</span>
            </label>
            <input
              type="text"
              value={customBanterNote}
              onChange={(e) => setCustomBanterNote(e.target.value)}
              placeholder="e.g. Kumbukeni kulipa kabla deadline ya Ijumaa saa kumi jioni!"
              className="w-full bg-[#161D26] border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
            />
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
            <span>{copied ? 'Copied to Clipboard! 🎉' : 'Copy Banter Slip'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-black font-black text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,211,102,0.3)] active:scale-95"
          >
            <Share2 className="w-4 h-4 text-black" />
            <span>Open in WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
