import { Link } from 'react-router-dom';
import { BookOpen, ChevronLeft } from 'lucide-react';

export default function MemberManual() {
  return (
    <div className="min-h-screen bg-[#0d1316] text-white p-6 md:p-10 font-sans max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-emerald-400" /> Member Manual
        </h1>
        <Link to="/rules" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-emerald-300 hover:text-emerald-200">
          <ChevronLeft className="w-3 h-3" /> Back
        </Link>
      </div>

      <section className="rounded-3xl border border-white/10 bg-[#161d24] p-6 md:p-8 space-y-4">
        <h2 className="text-xl font-black text-white">Quick Start</h2>
        <ul className="space-y-2 text-sm text-gray-300 leading-relaxed">
          <li>Join with the 6-digit invite PIN, then link your exact FPL team profile.</li>
          <li>Fund your wallet via M-Pesa or request cash-handoff credit through Action Queue.</li>
          <li>Stay in Green Zone to remain eligible for weekly winner payouts.</li>
          <li>Use your dashboard for balance, deposits, standings, and payout receipts.</li>
        </ul>
      </section>
    </div>
  );
}
