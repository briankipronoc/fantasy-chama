import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Home, Trophy } from 'lucide-react';

export default function Error808() {
  const navigate = useNavigate();

  return (
    <div className="fc-landing-shell min-h-screen text-[#dfe2ef] relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-[380px] h-[380px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-24 w-[380px] h-[380px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      <nav className="fc-landing-nav fixed top-0 w-full z-20 border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tighter text-[#DFE2EF]">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-[1px] flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#0a0e17] rounded-[11px] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            Fantasy <span className="text-emerald-400">Chama</span>
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="text-sm font-bold text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </nav>

      <main className="pt-28 pb-16 min-h-screen flex items-center justify-center px-6">
        <section className="fc-landing-panel w-full max-w-3xl rounded-[2rem] border border-white/10 p-8 md:p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[80px]" />

          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-red-400">Error 808</span>
            </div>

            <h1 className="fc-landing-title-gradient text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 leading-tight">
              Page Not Found
            </h1>

            <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
              This route is offside. The page you requested does not exist or may have been moved.
              Let us take you back to your league command center.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-[#002113] px-7 py-3.5 rounded-xl font-extrabold transition-colors"
              >
                <Home className="w-4 h-4" /> Go Home
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 bg-[#161d24] hover:bg-[#1f2937] border border-white/10 text-white px-7 py-3.5 rounded-xl font-bold transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
