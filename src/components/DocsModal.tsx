import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BookOpen, BookOpenCheck, HelpCircle, ShieldCheck, FileText, ChevronRight, X, LayoutDashboard, RefreshCw, Users } from 'lucide-react';
import clsx from 'clsx';

const docCards = [
  {
    icon: BookOpen,
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]',
    title: 'Member Guide',
    desc: 'Getting started, payments, dashboard, winning your GW payout, and troubleshooting.',
    badge: '5 Sections',
    to: '/manual/member',
  },
  {
    icon: BookOpenCheck,
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    glow: 'hover:shadow-[0_0_20px_rgba(251,191,36,0.1)]',
    title: 'Chairman Playbook',
    desc: 'League setup, member management, FPL team linking, GW operations, finance, and troubleshooting.',
    badge: '6 Sections',
    to: '/manual/chairman',
  },
  {
    icon: RefreshCw,
    color: 'text-slate-400 dark:text-slate-300',
    border: 'border-slate-500/20',
    bg: 'bg-slate-500/10',
    glow: 'hover:shadow-[0_0_20px_rgba(148,163,184,0.1)]',
    title: 'GW Forfeiture & Ledger Balance',
    desc: 'How leagues that started late forfeit unplayed rounds so member wallets and season vaults balance perfectly.',
    badge: 'Operations',
    to: '/admin',
  },
  {
    icon: Users,
    color: 'text-purple-400',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
    glow: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]',
    title: 'Multi-League & Invite Codes',
    desc: 'How to switch between active leagues, clean sweep last season names, and onboard via 6-digit code.',
    badge: 'Onboarding',
    to: '/profile',
  },
  {
    icon: HelpCircle,
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]',
    title: 'FAQ',
    desc: 'Frequently asked questions about payments, FPL data, payout rules, and platform fees.',
    badge: 'Quick Reference',
    to: '/faq',
  },
  {
    icon: FileText,
    color: 'text-gray-400',
    border: 'border-white/10',
    bg: 'bg-white/[0.02]',
    glow: 'hover:shadow-[0_0_20px_rgba(255,255,255,0.03)]',
    title: 'Payout Rules & Season Vault',
    desc: 'Full league constitution, pot splits, vault rules, straight-line 5-tier distribution, and platform fees.',
    badge: 'Constitution',
    to: '/rules',
  },
  {
    icon: ShieldCheck,
    color: 'text-gray-400',
    border: 'border-white/10',
    bg: 'bg-white/[0.02]',
    glow: '',
    title: 'Privacy Policy',
    desc: 'How we handle your data, M-Pesa transaction records, and personal information.',
    badge: 'Legal',
    to: '/privacy-policy',
  },
  {
    icon: FileText,
    color: 'text-gray-400',
    border: 'border-white/10',
    bg: 'bg-white/[0.02]',
    glow: '',
    title: 'Terms of Service',
    desc: 'Platform terms, acceptable use, dispute resolution, and liability.',
    badge: 'Legal',
    to: '/terms',
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
      className="fc-docs-overlay fixed inset-0 z-[99999] flex items-center justify-center p-2 md:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="fc-docs-backdrop absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200" />
      
      <div className="fc-docs-modal relative w-full max-w-3xl bg-[#0d1117] border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06] bg-[#0d1117]/90 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-white tracking-tight">Help &amp; Docs</h2>
              <p className="text-[11px] text-gray-500 font-medium">Everything you need to run your league</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {docCards.map((card) => (
              <button
                key={card.to}
                onClick={() => {
                  onClose();
                  navigate(card.to);
                }}
                className={clsx(
                  "group flex flex-col gap-3 rounded-[1.25rem] border text-left",
                  card.border, card.bg,
                  "p-4 md:p-5 transition-all duration-200",
                  card.glow,
                  "hover:border-white/20 active:scale-95"
                )}
              >
                <div className="flex items-start justify-between w-full">
                  <div className={clsx(`w-10 h-10 rounded-xl border flex items-center justify-center`, card.bg, card.border)}>
                    <card.icon className={clsx(`w-5 h-5`, card.color)} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 border border-white/10 px-2 py-1 rounded-full bg-black/20">
                    {card.badge}
                  </span>
                </div>
                <div className="flex-1 mt-1">
                  <h3 className="font-black text-white text-base mb-1">{card.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{card.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors mt-1">
                  Read guide <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>

          {/* Quick Links */}
          <div className="mt-5 md:mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" /> Quick Navigation
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Dashboard', to: '/dashboard' },
                { label: 'Standings', to: '/standings' },
                { label: 'Profile', to: '/profile' },
                { label: 'Finances', to: '/finances' },
                { label: 'Deposit', to: '/deposit' },
              ].map((l) => (
                <button
                  key={l.to}
                  onClick={() => {
                    onClose();
                    navigate(l.to);
                  }}
                  className="text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-white border border-white/10 bg-white/[0.02] hover:bg-white/5 px-3 py-2 rounded-xl transition-colors hover:border-white/20 active:scale-95"
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
