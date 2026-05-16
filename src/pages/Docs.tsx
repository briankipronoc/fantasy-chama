import { Link } from 'react-router-dom';
import { BookOpen, BookOpenCheck, HelpCircle, ShieldCheck, FileText, ChevronRight, ArrowLeft } from 'lucide-react';

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
    title: 'Payout Rules',
    desc: 'Full league constitution, pot splits, vault rules, season winner rules, and platform fees.',
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

export default function Docs() {
  return (
    <div className="min-h-screen bg-[#0d1316] text-white p-4 md:p-10 font-sans max-w-3xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2 mb-2">
        <Link to="/dashboard" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Help &amp; Docs</h1>
          <p className="text-sm text-gray-500 font-medium">Everything you need to run your league.</p>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-8 pl-1">Choose a guide below. Member and Chairman guides are the most important — read them first.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {docCards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className={`group flex flex-col gap-3 rounded-2xl border ${card.border} ${card.bg} p-5 transition-all duration-200 ${card.glow} hover:border-white/20 hover:-translate-y-0.5`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-600 border border-white/10 px-2 py-0.5 rounded-full">{card.badge}</span>
            </div>
            <div className="flex-1">
              <h3 className="font-black text-white text-base mb-1">{card.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{card.desc}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-gray-500 group-hover:text-white transition-colors">
              Read guide <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>

      {/* Quick links strip */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-3">Quick Links</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Standings', to: '/standings' },
            { label: 'Profile', to: '/profile' },
            { label: 'Finances', to: '/finances' },
            { label: 'Deposit', to: '/deposit' },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="text-xs font-bold text-gray-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-xl transition-colors hover:border-white/20">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
