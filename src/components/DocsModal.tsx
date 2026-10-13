import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BookOpen, BookOpenCheck, HelpCircle, ShieldCheck, FileText, ChevronRight, X, LayoutDashboard, RefreshCw, Users, Calculator, Sparkles } from 'lucide-react';
import clsx from 'clsx';

const financialRules = [
  {
    icon: FileText,
    color: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/5',
    title: 'Payout Rules & Constitution',
    desc: 'Official 91/9 pot split model, 5-tier season distribution, tie-breakers, and spectator terms.',
    badge: 'Constitution',
    to: '/rules',
  },
  {
    icon: Calculator,
    color: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/25',
    bg: 'bg-blue-500/5',
    title: 'Mid-Season Buy-In Math',
    desc: 'Invite friends in GW10 or GW15 fairly. Backdates exact contribution into Season Vault with 1-tap WhatsApp billing.',
    badge: 'Calculator',
    to: '/admin',
  },
  {
    icon: RefreshCw,
    color: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-400/25 dark:border-slate-500/20',
    bg: 'bg-slate-500/5',
    title: 'GW5 Kickoff & Forfeiture',
    desc: 'How mid-season league launches forfeit prior unplayed rounds so member wallets and season vaults balance to 0.',
    badge: 'Ledger Operations',
    to: '/admin',
  },
];

const operationalManuals = [
  {
    icon: BookOpen,
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/5',
    title: 'Member Guide',
    desc: 'How to join via invite code, fund via M-Pesa Pochi/Till, switch between Contender & Spectator, and claim winnings.',
    badge: 'Member Hub',
    to: '/manual/member',
  },
  {
    icon: BookOpenCheck,
    color: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/5',
    title: 'Chairman Playbook',
    desc: 'Set weekly stakes, manage pot splits, verify M-Pesa dues, run GW settlements, and claim management fees.',
    badge: 'Chairman Hub',
    to: '/manual/chairman',
  },
  {
    icon: ShieldCheck,
    color: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/25',
    bg: 'bg-indigo-500/5',
    title: 'Co-Chair Verification',
    desc: 'Dual-signatory verification for payouts, net pot reversal reconciliation, and anti-fraud approval workflows.',
    badge: 'Co-Chair Hub',
    to: '/manual/co-chair',
  },
  {
    icon: Users,
    color: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/25',
    bg: 'bg-purple-500/5',
    title: 'Multi-League & Clean Slate',
    desc: 'Switch between active chamas, clean slate previous seasons, and onboard squad managers via master invite codes.',
    badge: 'Chama Setup',
    to: '/profile',
  },
  {
    icon: HelpCircle,
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/5',
    title: 'FAQ & Help Center',
    desc: 'Frequently asked questions on M-Pesa timelines, tie-breakers, Spectator mode, themes, and platform transparency.',
    badge: 'Quick Answers',
    to: '/faq',
  },
];

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DocsModal({ isOpen, onClose }: DocsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const renderCard = (card: typeof financialRules[0]) => (
    <button
      key={card.title}
      onClick={() => {
        onClose();
        navigate(card.to);
      }}
      className={clsx(
        "group flex flex-col gap-2.5 rounded-2xl border text-left",
        card.border, card.bg,
        "p-4 transition-all duration-200",
        "hover:border-amber-500/40 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(251,191,36,0.08)] active:scale-98 cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between w-full">
        <div className={clsx(`w-9 h-9 rounded-xl border flex items-center justify-center`, card.bg, card.border)}>
          <card.icon className={clsx(`w-4.5 h-4.5`, card.color)} />
        </div>
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/30">
          {card.badge}
        </span>
      </div>
      <div className="flex-1 mt-0.5">
        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
          {card.title}
        </h4>
        <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed line-clamp-2">
          {card.desc}
        </p>
      </div>
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
        Read Manual <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );

  return createPortal(
    <div
      ref={overlayRef}
      className="fc-docs-overlay fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="fc-docs-backdrop absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200" />
      
      {/* Modal Dialog Card */}
      <div className="fc-docs-modal relative w-full max-w-3xl bg-white dark:bg-[#121820] stealth:bg-[#070b0e] border border-slate-200 dark:border-white/10 stealth:border-white/5 rounded-[2rem] shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-200 overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-white stealth:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-white/10 stealth:border-white/5 bg-slate-50/90 dark:bg-[#161d24]/95 stealth:bg-[#0b1014]/98 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base md:text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  CHAMA CONSTITUTION &amp; PLAYBOOK
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Official Rulebook
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 font-medium mt-0.5">
                Official constitution, payout schedule, operations manual &amp; FAQ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-all cursor-pointer active:scale-95 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Quick Hero Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Interactive Rulebook &amp; Constitution
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-gray-400 font-medium mt-0.5">
                Review the 91/9 cash pot formula, weekly tier breakdowns, tie-breakers, and M-Pesa protocols.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { onClose(); navigate('/rules'); }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm shrink-0"
            >
              Open Constitution →
            </button>
          </div>

          {/* Section 1: Financial Rules */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              1. FINANCIAL RULES &amp; VAULT POLICIES
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {financialRules.map(renderCard)}
            </div>
          </div>

          {/* Section 2: Operations Manuals */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              2. OPERATIONS &amp; GOVERNANCE MANUALS
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {operationalManuals.map(renderCard)}
            </div>
          </div>

          {/* Quick Navigation Footer */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-black/30 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-2.5 flex items-center gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" /> Quick Navigation
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Dashboard', to: '/dashboard' },
                { label: 'Standings', to: '/standings' },
                { label: 'Finances', to: '/finances' },
                { label: 'Rules & Constitution', to: '/rules' },
                { label: 'FAQ', to: '/faq' },
              ].map((l) => (
                <button
                  key={l.to}
                  onClick={() => {
                    onClose();
                    navigate(l.to);
                  }}
                  className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
