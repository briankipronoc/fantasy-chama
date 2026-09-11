// src/components/BanterNudgeModal.tsx
import { useState } from 'react';
import { X, Flame, Share2, Copy, Check, Users } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface BanterNudgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueName: string;
  nextGw: number | null;
  deadlineFormatted: string;
  unpaidMembers: Array<{ id: string; displayName: string; phone?: string }>;
  gameweekStake: number;
}

export default function BanterNudgeModal({
  isOpen,
  onClose,
  leagueName,
  nextGw,
  deadlineFormatted,
  unpaidMembers,
  gameweekStake,
}: BanterNudgeModalProps) {
  const [selectedTone, setSelectedTone] = useState<'spicy' | 'polite' | 'urgent'>('spicy');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const gwLabel = nextGw ? `GW${nextGw}` : 'Next Gameweek';
  const unpaidCount = unpaidMembers.length;
  const appUrl = (typeof window !== 'undefined' && window.location.origin)
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL || 'https://fantasychama.vercel.app');

  const templates = {
    spicy: {
      label: '🌶️ Spicy Banter',
      title: 'Kenyan Group Banter',
      desc: 'High energy, humorous nudge for the WhatsApp group.',
      text: [
        `*🏆 ${leagueName} — ${gwLabel} Banter Notice!*`,
        ``,
        `Wacheni mchezo wadau! 😂 Deadline ya ${gwLabel} ni *${deadlineFormatted}*.`,
        unpaidCount > 0 ? `Bado kuna watu ${unpaidCount} hawajatuma stake — lipeni mapema kabla pot ifungwe mchezo ikianza! ⚽🔥` : `Watu wote wako funded, lakini check lineup yako mapema!`,
        ``,
        `Usikuje kulia hapa baada ya matches! 💰👇`,
        `${appUrl}`,
      ].join('\n'),
    },
    polite: {
      label: '👔 Polite & Clean',
      title: 'Official Reminder',
      desc: 'Professional, calm deadline announcement.',
      text: [
        `*🏆 ${leagueName} — ${gwLabel} Deadline Reminder*`,
        ``,
        `Hi managers! 👋 The ${gwLabel} deadline is *${deadlineFormatted}*.`,
        `Please ensure your Chama wallet is funded (KES ${gameweekStake.toLocaleString()} per round) so you stay eligible for this week's pot.`,
        ``,
        `Check your status and top up here:`,
        `👉 ${appUrl}`,
      ].join('\n'),
    },
    urgent: {
      label: '🚨 Last Call',
      title: 'Deadline Emergency',
      desc: 'Urgent countdown reminder for the final hours.',
      text: [
        `*🚨 LAST CALL — ${leagueName} ${gwLabel}!*`,
        ``,
        `Deadline is approaching fast (*${deadlineFormatted}*)! ⏳`,
        unpaidCount > 0 ? `⚠️ ${unpaidCount} manager${unpaidCount > 1 ? 's' : ''} still unpaid. Unfunded teams forfeit any weekly winnings!` : `Confirm your captain and squad now!`,
        ``,
        `Lipeni chap chap:`,
        `👉 ${appUrl}`,
      ].join('\n'),
    },
  };

  const currentMessage = templates[selectedTone].text;

  const handleCopy = () => {
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

  return (
    <div className="fixed inset-0 z-[120000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0e1419] border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl relative text-white my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Gameweek Banter Nudge</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {gwLabel} Deadline: {deadlineFormatted}
              </p>
            </div>
          </div>
          <button
            onClick={() => { haptics.selection(); onClose(); }}
            className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unpaid managers summary */}
        <div className="my-4 p-3 rounded-2xl bg-[#161d24] border border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-gray-200">
              {unpaidCount} manager{unpaidCount !== 1 ? 's' : ''} not yet funded
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            KES {gameweekStake.toLocaleString()} / manager
          </span>
        </div>

        {/* Tone Selector Pills */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(['spicy', 'polite', 'urgent'] as const).map((tone) => {
            const isSelected = selectedTone === tone;
            return (
              <button
                key={tone}
                onClick={() => { haptics.selection(); setSelectedTone(tone); }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {templates[tone].label}
              </button>
            );
          })}
        </div>

        {/* Message Preview Box */}
        <div className="rounded-2xl border border-white/10 bg-[#070b0e] p-3.5 relative mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              WhatsApp Message Preview
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap text-gray-200 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
            {currentMessage}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            Share to WhatsApp Group
          </button>
          <button
            onClick={handleCopy}
            className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl font-bold text-xs transition-colors"
          >
            {copied ? 'Copied' : 'Copy Text'}
          </button>
        </div>
      </div>
    </div>
  );
}
