import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
    Shield, Zap, Users, ChevronRight, Check,
    ArrowRight, Lock, Trophy, Star, GitMerge,
    TrendingUp, Smartphone
} from 'lucide-react';

// ─── Mini Ledger Demo Component ────────────────────────────────
const demoMembers = [
    { name: 'Brian K.', pts: 92, paid: true, balance: 4650 },
    { name: 'Raul G.', pts: 78, paid: true, balance: 1200 },
    { name: 'Emmanuel', pts: 85, paid: true, balance: 800 },
    { name: 'Kamau J.', pts: 61, paid: false, balance: -350 },
    { name: 'Akinyi M.', pts: 74, paid: true, balance: 600 },
];

function LedgerDemo() {
    const [highlighted, setHighlighted] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setHighlighted(prev => (prev + 1) % demoMembers.length);
        }, 1400);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full rounded-[1.5rem] bg-[#0d1117]/90 border border-white/8 overflow-hidden shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-[#161d24]/60">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Live Vault Ledger</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Live Sync
                </span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-white/[0.04]">
                {demoMembers.map((m, i) => (
                    <div
                        key={m.name}
                        className={`px-5 py-3 flex items-center gap-3 transition-all duration-500 ${highlighted === i ? (m.paid ? 'bg-emerald-500/5' : 'bg-red-500/5') : ''}`}
                    >
                        <div className={`w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center flex-shrink-0 ${m.paid ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                            {m.name[0]}
                        </div>
                        <span className="flex-1 text-sm font-bold text-white">{m.name}</span>
                        <span className="text-[11px] text-gray-500 font-mono">{m.pts} pts</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${m.paid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {m.paid ? `KES ${m.balance.toLocaleString()}` : 'Red Zone'}
                        </span>
                    </div>
                ))}
            </div>
            {/* Footer */}
            <div className="px-5 py-3 bg-[#0b1014]/60 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-gray-600 font-medium">GW26 · Weekly Pot</span>
                <span className="font-black text-emerald-400 text-sm">KES 1,680</span>
            </div>
        </div>
    );
}

// ─── Animated Counter ────────────────────────────────────────────
function Counter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            let start = 0;
            const step = target / 60;
            const timer = setInterval(() => {
                start += step;
                if (start >= target) { setCount(target); clearInterval(timer); }
                else setCount(Math.floor(start));
            }, 16);
        }, { threshold: 0.3 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target]);
    return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ─── Main Landing Page ───────────────────────────────────────────
export default function LandingPage() {
    const navigate = useNavigate();
    const role = useStore(state => state.role);
    const members = useStore(state => state.members);

    // If already authenticated, redirect to dashboard
    useEffect(() => {
        const leagueId = localStorage.getItem('activeLeagueId');
        const phone = localStorage.getItem('memberPhone');
        if (leagueId && phone && members.length > 0) {
            navigate(role === 'admin' ? '/' : '/', { replace: true });
        }
    }, [role, members, navigate]);

    const valueProps = [
        {
            icon: <Lock className="w-6 h-6 text-emerald-400" />,
            color: 'emerald',
            title: 'Automated Escrow',
            description: 'Funds sit securely in the Vault — visible to every member. Disbursed instantly via M-Pesa B2C the moment the gameweek resolves.',
            tags: ['M-Pesa B2C', 'Firestore Ledger', 'Zero Manual Transfers'],
        },
        {
            icon: <Zap className="w-6 h-6 text-amber-400" />,
            color: 'amber',
            title: 'Live FPL Sync',
            description: 'Connected directly to Premier League servers. Gameweek scores update automatically. No spreadsheets, no arguments, no manual math.',
            tags: ['FPL API', 'Auto-Resolution', 'Live Standings'],
        },
        {
            icon: <Shield className="w-6 h-6 text-blue-400" />,
            color: 'blue',
            title: 'Maker/Checker Protocol',
            description: 'Built-in anti-fraud — every payout requires Co-Admin approval before a single shilling moves. No single point of failure.',
            tags: ['Co-Admin Approval', 'Dispute System', 'Audit Trail'],
        },
    ];

    const bgMap: Record<string, string> = {
        emerald: 'bg-emerald-500/10 border-emerald-500/20',
        amber: 'bg-amber-500/10 border-amber-500/20',
        blue: 'bg-blue-500/10 border-blue-500/20',
    };
    const tagMap: Record<string, string> = {
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };

    return (
        <div className="min-h-screen bg-[#0A0E17] text-white font-sans overflow-x-hidden">

            {/* ── Ambient background grid ─────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none z-0" />

            {/* ── Navbar ─────────────────────────────────────────── */}
            <nav className="fixed top-0 z-50 w-full px-6 md:px-10 py-5 flex items-center justify-between border-b border-white/[0.04] backdrop-blur-xl bg-[#0A0E17]/50 transition-all duration-300">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="font-black text-lg tracking-tight">Fantasy<span className="text-emerald-400">Chama</span></span>
                </div>
                <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                    <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
                    <a href="#features" className="hover:text-white transition-colors">Features</a>
                    <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/login')} className="text-sm font-bold text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/5">
                        Sign In
                    </button>
                    <button onClick={() => navigate('/setup')} className="text-sm font-black px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95">
                        Start a League
                    </button>
                </div>
            </nav>

            {/* ── Hero ────────────────────────────────────────────── */}
            <section className="relative z-10 pt-32 pb-16 md:pt-40 md:pb-28 px-6 md:px-10">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                        {/* Left — Copy */}
                        <div>
                            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-8">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                Built for Kenyan FPL Chamas
                            </div>
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6">
                                Automate Your<br />
                                <span className="text-emerald-400">FPL Chama.</span><br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                                    Zero Disputes.
                                </span>
                            </h1>
                            <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-lg">
                                A trustless escrow for serious Premier League mini-leagues.
                                Deposits via M-Pesa STK Push. Payouts via B2C. Standings pulled live from London.
                                No Chairman can run with the money.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => navigate('/setup')}
                                    className="group flex items-center justify-center gap-2 px-7 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] active:scale-95 text-base"
                                >
                                    Start a League (Admin)
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button
                                    onClick={() => navigate('/access')}
                                    className="flex items-center justify-center gap-2 px-7 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black rounded-2xl transition-all text-base active:scale-95"
                                >
                                    Join with Code
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Mini trust bar */}
                            <div className="flex flex-wrap items-center gap-4 mt-10 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                {['M-Pesa Integrated', 'FPL API Live', 'Firestore Encrypted', 'Co-Admin Verified'].map(t => (
                                    <span key={t} className="flex items-center gap-1.5">
                                        <Check className="w-3 h-3 text-emerald-500" /> {t}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Right — Live Ledger Demo */}
                        <div className="relative">
                            <div className="absolute -inset-4 bg-emerald-500/5 rounded-[2rem] blur-2xl" />
                            <div className="relative">
                                {/* Status pill above */}
                                <div className="flex justify-end mb-3">
                                    <span className="flex items-center gap-1.5 bg-[#161d24]/80 border border-white/8 px-3 py-1.5 rounded-full text-[10px] font-bold text-gray-400 backdrop-blur-sm">
                                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                        GW26 Active · FPL Deadline in 18h
                                    </span>
                                </div>
                                <LedgerDemo />
                                {/* Floating payout badge */}
                                <div className="absolute -bottom-4 -right-4 bg-[#151e27] border border-emerald-500/30 rounded-2xl px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-sm">
                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Last Payout</p>
                                    <p className="text-emerald-400 font-black text-base">KES 1,680</p>
                                    <p className="text-[9px] text-gray-600 font-medium">via M-Pesa B2C · 3s ago</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Stats Bar ───────────────────────────────────────── */}
            <section className="relative z-10 py-12 border-y border-white/[0.05] bg-[#0d1117]/50 backdrop-blur-sm">
                <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {[
                        { val: 38, suffix: ' GWs', label: 'Full PL Season' },
                        { val: 100, suffix: '%', label: 'M-Pesa Automated' },
                        { val: 0, suffix: ' Disputes', label: 'With Maker/Checker' },
                        { val: 3, suffix: 's', label: 'Avg Payout Time' },
                    ].map(s => (
                        <div key={s.label}>
                            <p className="text-3xl md:text-4xl font-black text-white mb-1">
                                <Counter target={s.val} suffix={s.suffix} />
                            </p>
                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── How It Works ────────────────────────────────────── */}
            <section id="how-it-works" className="relative z-10 py-24 px-6 md:px-10">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4 block">The Flow</span>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight">How FantasyChama Works</h2>
                    </div>
                    <div className="relative">
                        {/* Connector line */}
                        <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                        <div className="grid md:grid-cols-4 gap-8">
                            {[
                                { step: '01', icon: <Smartphone className="w-5 h-5" />, title: 'Admin Creates League', desc: 'Set your stake, split rules, and invite your crew.' },
                                { step: '02', icon: <Users className="w-5 h-5" />, title: 'Members Pay via STK Push', desc: 'One tap. M-Pesa prompts your phone. Wallet funded instantly.' },
                                { step: '03', icon: <TrendingUp className="w-5 h-5" />, title: 'FPL Scores Live', desc: 'Cron job checks London servers. Top scorer wins the pot.' },
                                { step: '04', icon: <Zap className="w-5 h-5" />, title: 'B2C Payout in Seconds', desc: 'Co-Admin approves. Safaricom wires the KES. Receipt to WhatsApp.' },
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col items-center text-center group">
                                    <div className="w-12 h-12 rounded-full bg-[#161d24] border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/60 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.1)] relative">
                                        {item.icon}
                                        <span className="absolute -top-2 -right-2 text-[9px] font-black text-gray-600 bg-[#0A0E17] px-1 rounded">{item.step}</span>
                                    </div>
                                    <h3 className="font-bold text-sm text-white mb-2">{item.title}</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Value Props ─────────────────────────────────────── */}
            <section id="features" className="relative z-10 py-24 px-6 md:px-10 bg-[#0d1117]/40">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-4 block">Why FantasyChama</span>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight">Built for Trust. Engineered for Speed.</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {valueProps.map((vp) => (
                            <div
                                key={vp.title}
                                className="group relative bg-[#161d24]/60 backdrop-blur-md border border-white/5 rounded-[1.75rem] p-7 hover:border-white/10 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
                            >
                                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br ${vp.color === 'emerald' ? 'from-emerald-500/3' : vp.color === 'amber' ? 'from-amber-500/3' : 'from-blue-500/3'} to-transparent`} />
                                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-5 ${bgMap[vp.color]}`}>
                                    {vp.icon}
                                </div>
                                <h3 className="font-black text-lg mb-3">{vp.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed mb-5">{vp.description}</p>
                                <div className="flex flex-wrap gap-2">
                                    {vp.tags.map(t => (
                                        <span key={t} className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${tagMap[vp.color]}`}>{t}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Social Proof / Ledger Showcase ──────────────────── */}
            <section className="relative z-10 py-24 px-6 md:px-10">
                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4 block">Full Transparency</span>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-6">Every Member Sees<br />The Same <span className="text-emerald-400">Truth</span></h2>
                            <p className="text-gray-400 leading-relaxed mb-8">
                                No more "the Chairman said he paid." The Vault Ledger shows every wallet balance, every transaction receipt, and every Red Zone flag in real-time. Everyone gets the same immutable view.
                            </p>
                            <div className="space-y-3">
                                {[
                                    'Green Zone: Wallet funded, eligible for GW payout',
                                    'Red Zone: Insufficient balance, auto-excluded from pot',
                                    'Live Escrow Feed: Every deposit logged instantly',
                                    'Maker/Checker: Co-Admin must countersign all payouts',
                                ].map(item => (
                                    <div key={item} className="flex items-start gap-3">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        </div>
                                        <p className="text-sm text-gray-300">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute -inset-6 bg-amber-500/4 rounded-[2.5rem] blur-3xl pointer-events-none" />
                            <LedgerDemo />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Maker/Checker CTA ────────────────────────────────── */}
            <section className="relative z-10 py-20 px-6 md:px-10">
                <div className="max-w-4xl mx-auto">
                    <div className="relative bg-gradient-to-br from-[#0d1a14] to-[#101821] border border-emerald-500/20 rounded-[2rem] p-10 md:p-14 overflow-hidden text-center shadow-[0_0_60px_rgba(16,185,129,0.08)]">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/10 blur-3xl pointer-events-none" />
                        <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                                <GitMerge className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                                Ready to Run a <span className="text-emerald-400">Trustless</span> Chama?
                            </h2>
                            <p className="text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
                                Set up your league in under 5 minutes. Your members join with a 6-digit code. The system handles everything else.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button
                                    onClick={() => navigate('/setup')}
                                    className="group flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] active:scale-95 text-base"
                                >
                                    <Star className="w-4 h-4" />
                                    Start a League (Admin)
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="flex items-center justify-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black rounded-2xl transition-all text-base"
                                >
                                    Join with Code
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────────── */}
            <footer className="relative z-10 border-t border-white/[0.05] py-12 px-6 md:px-10">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <span className="font-black text-sm tracking-tight text-gray-400">Fantasy<span className="text-emerald-400">Chama</span></span>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-gray-500">
                        <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                        <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <a href="mailto:support@fantasychama.co.ke" className="hover:text-white transition-colors">Contact</a>
                        <a href="https://x.com/FantasyChama" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">@FantasyChama</a>
                    </div>
                    <p className="text-[10px] text-gray-700 font-medium">
                        © 2026 FantasyChama · Powered by Safaricom Daraja & Firebase
                    </p>
                </div>
            </footer>
        </div>
    );
}
