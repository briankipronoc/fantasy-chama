import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BookOpen, BookOpenCheck, HelpCircle, ShieldCheck, FileText, ChevronRight, X, LayoutDashboard, RefreshCw, Users, Calculator } from 'lucide-react';
import clsx from 'clsx';

const docCards = [
  {
    icon: BookOpen,
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/5',
    title: 'Member Guide',
    desc: 'How to join via invite code, fund via M-Pesa Pochi/Till, switch between Contender & Spectator, and claim weekly winnings.',
    badge: 'Member Hub',
    to: '/manual/member',
  },
  {
    icon: BookOpenCheck,
    color: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/5',
    title: 'Chairman Playbook',
    desc: 'Set weekly stakes, manage pot splits, verify M-Pesa dues, run GW settlements, and earn your 4% management commission.',
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
    icon: Calculator,
    color: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/25',
    bg: 'bg-blue-500/5',
    title: 'Mid-Season Buy-In Math',
    desc: 'Invite friends in GW10 or GW15 fairly. Backdates their exact contribution into the Season Vault with 1-tap WhatsApp billing.',
    badge: 'Calculator',
    to: '/admin',
  },
  {
    icon: RefreshCw,
    color: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-400/25 dark:border-slate-500/20',
    bg: 'bg-slate-500/5',
    title: 'GW5 Kickoff & Forfeiture',
    desc: 'How leagues kick off mid-season forfeit prior unplayed rounds so member wallets and season vaults balance down to 0.',
    badge: 'Ledger Operations',
    to: '/admin',
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
    title: 'FAQ',
    desc: 'Frequently asked questions on M-Pesa timelines, tie-breakers, Spectator mode, 3-way themes, and platform transparency.',
    badge: 'Quick Answers',
    to: '/faq',
  },
  {
    icon: FileText,
    color: 'text-slate-600 dark:text-gray-400',
    border: 'border-slate-300 dark:border-white/10',
    bg: 'bg-slate-50 dark:bg-white/[0.02]',
    title: 'Payout Rules & Constitution',
    desc: 'Full league rules, 91/9 model, 5-tier season distribution, tie-breakers, and spectator head-to-head terms.',
    badge: 'Constitution',
    to: '/rules',
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
      <div className="fc-docs-modal relative w-full max-w-3xl bg-white dark:bg-[#0c1218] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/95 dark:bg-[#0c1218]/95 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">Help &amp; Documentation</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Complete guides, formulas, and operating playbooks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {docCards.map((card) => (
              <button
                key={card.to}
                onClick={() => {
                  onClose();
                  navigate(card.to);
                }}
                className={clsx(
                  "group flex flex-col gap-2.5 rounded-2xl border text-left",
                  card.border, card.bg,
                  "p-4 transition-all duration-200",
                  "hover:border-emerald-500/40 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] active:scale-98 cursor-pointer"
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
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{card.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed line-clamp-2">{card.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                  Read Guide <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>

          {/* Quick Navigation Footer */}
          <div className="mt-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-black/30 p-4">
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

