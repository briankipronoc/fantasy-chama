import { Link } from 'react-router-dom';
import { BookOpenCheck, ChevronLeft } from 'lucide-react';

export default function ChairmanManual() {
  return (
    <div className="min-h-screen bg-[#0d1316] text-white p-6 md:p-10 font-sans max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
          <BookOpenCheck className="w-8 h-8 text-amber-300" /> Chairman Manual
        </h1>
        <Link to="/rules" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-amber-300 hover:text-amber-200">
          <ChevronLeft className="w-3 h-3" /> Back
        </Link>
      </div>

      <section className="rounded-3xl border border-white/10 bg-[#161d24] p-6 md:p-8 space-y-4">
        <h2 className="text-xl font-black text-white">Operations Checklist</h2>
        <ul className="space-y-2 text-sm text-gray-300 leading-relaxed">
          <li>Track Red Zone members and clear pending approvals from Command Center.</li>
          <li>Resolve gameweeks only after FPL marks the current GW as finished.</li>
          <li>Use maker-checker approvals for payouts and record cash handoffs in ledger.</li>
          <li>Settle HQ dues on the monthly window and submit receipts promptly.</li>
        </ul>
      </section>
    </div>
  );
}
