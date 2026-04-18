import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useEffect, useState } from 'react';
import { Trophy, ArrowRight, Shield, Zap, Lock, Banknote, Users, Smartphone, TrendingUp } from 'lucide-react';

// ─── Dynamic Animating Ledger Demo ────────────────────────────────
const initialDemoMembers = [
    { id: '1', name: 'Brian K.', pts: 92, paid: true, balance: 4650 },
    { id: '2', name: 'Raul G.', pts: 85, paid: true, balance: 1200 },
    { id: '3', name: 'Emmanuel', pts: 78, paid: true, balance: 800 },
    { id: '4', name: 'Akinyi M.', pts: 65, paid: true, balance: 600 },
    { id: '5', name: 'Kamau J.', pts: 61, paid: false, balance: -350 },
];

function LedgerDemo() {
    const [members, setMembers] = useState(initialDemoMembers);
    const [highlightId, setHighlightId] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setMembers(current => {
                const newMembers = [...current];
                const randomIndex = Math.floor(Math.random() * (newMembers.length - 1));
                
                newMembers[randomIndex] = {
                    ...newMembers[randomIndex],
                    pts: newMembers[randomIndex].pts + Math.floor(Math.random() * 12) + 3
                };
                
                setHighlightId(newMembers[randomIndex].id);
                setTimeout(() => setHighlightId(null), 1000);

                return newMembers.sort((a, b) => b.pts - a.pts);
            });
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fc-landing-card w-full rounded-[2rem] bg-[#161d24] border border-white/5 overflow-hidden shadow-2xl relative">
            <div className="fc-landing-card-chrome px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#161d24] z-20 relative">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live FPL Standings</span>
                <span className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Live Sync Active
                </span>
            </div>
            
            <div className="fc-landing-pane relative h-[320px] w-full bg-[#0d1620]/50 z-10">
                {members.map((m, index) => {
                    const isHighlighted = highlightId === m.id;
                    return (
                        <div
                            key={m.id}
                            className={`absolute left-0 right-0 px-6 flex items-center gap-4 transition-all duration-700 ease-in-out border-b border-white/[0.02] ${isHighlighted ? 'bg-emerald-500/10 z-20' : 'bg-transparent z-10'}`}
                            style={{ 
                                top: `${index * 64}px`, 
                                height: '64px',
                            }}
                        >
                            <div className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors duration-500 ${isHighlighted ? 'bg-emerald-500 text-white' : m.paid ? 'bg-white/5 text-gray-400' : 'bg-red-500/10 text-red-400'}`}>
                                {m.name[0]}
                            </div>
                            <span className={`flex-1 text-base font-medium transition-colors ${isHighlighted ? 'text-white' : 'text-gray-200'}`}>{m.name}</span>
                            <span className="text-sm text-gray-400 font-medium tabular-nums">{m.pts} pts</span>
                            <span className={`text-xs font-medium px-3 py-1.5 rounded-full w-24 text-center transition-colors ${m.paid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {m.paid ? `KES ${m.balance}` : 'Red Zone'}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="fc-landing-card-chrome px-6 py-4 bg-[#161d24] border-t border-white/5 flex items-center justify-between z-20 relative">
                <span className="text-xs text-gray-500 font-medium tracking-wide">GW26 · Escrow Pot</span>
                <span className="font-bold text-emerald-400 text-base">KES 1,680</span>
            </div>
        </div>
    );
}



function TrustSlider() {
    const [potSize, setPotSize] = useState(10000);
    const winnerCut = potSize * 0.91;
    const adminCut = potSize * 0.09;
    const chairCut = potSize * 0.04;
    const hqCut = potSize * 0.035;
    const mpesaCut = potSize * 0.015;

    return (
        <section className="py-24 max-w-5xl mx-auto px-6 relative z-30">
            <div className="fc-landing-panel bg-[#0b1014] border border-white/10 rounded-[3rem] p-8 md:p-12 shadow-[0_0_80px_rgba(16,185,129,0.05)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]" />
                
                <div className="text-center mb-10">
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">The Transparent 9% Engine.</h2>
                    <p className="text-gray-400 font-medium max-w-2xl mx-auto">We take precisely 9% to run the entire backend intelligence, pay M-Pesa, and compensate the League Chairman. The Winner takes the absolute rest.</p>
                </div>

                <div className="space-y-8">
                    <div>
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Adjust Gameweek Pot</span>
                            <span className="text-3xl font-black text-emerald-400 tabular-nums tracking-tight">KES {potSize.toLocaleString()}</span>
                        </div>
                        <input 
                            type="range" 
                            min="1000" 
                            max="30000" 
                            step="100" 
                            value={potSize} 
                            onChange={(e) => setPotSize(Number(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col justify-center">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Gameweek Winner (91%)</p>
                            <p className="text-4xl md:text-5xl font-black text-emerald-400 tabular-nums">KES {winnerCut.toLocaleString()}</p>
                            <p className="text-xs font-medium text-emerald-600 mt-2">Dispatched directly to M-Pesa automatically.</p>
                        </div>
                        <div className="md:col-span-4 bg-[#161d24] border border-white/5 rounded-2xl p-6 flex flex-col justify-center shadow-inner">
                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Total Ops Fee (9%)</p>
                            <p className="text-3xl font-black text-amber-500 tabular-nums">KES {adminCut.toLocaleString()}</p>
                            <div className="space-y-1.5 mt-4">
                                <div className="flex justify-between text-xs text-gray-500 font-bold"><span className="text-gray-400">Chairman (4%)</span> <span>KES {chairCut.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs text-gray-500 font-bold"><span className="text-gray-400">Platform HQ (3.5%)</span> <span>KES {hqCut.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs text-gray-500 font-bold"><span className="text-gray-400">Network Fee (1.5%)</span> <span>KES {mpesaCut.toLocaleString()}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function LandingPage() {
    const navigate = useNavigate();
    const role = useStore(state => state.role);
    const members = useStore(state => state.members);

    useEffect(() => {
        const leagueId = localStorage.getItem('activeLeagueId');
        const phone = localStorage.getItem('memberPhone');
        if (leagueId && phone && members.length > 0) {
            navigate(role === 'admin' ? '/' : '/', { replace: true });
        }
    }, [role, members, navigate]);

    return (
        <div className="fc-landing-shell bg-[#0a0e17] text-[#dfe2ef] min-h-screen font-sans selection:bg-emerald-500 selection:text-[#002113]">
            {/* TopNavBar */}
            <nav className="fc-landing-nav fixed top-0 w-full z-50 bg-[#0f131c]/80 backdrop-blur-xl border-b border-white/[0.05]">
                <div className="flex justify-between items-center px-6 md:px-8 py-4 max-w-7xl mx-auto">
                    <div className="fc-landing-brand flex items-center gap-2 text-xl md:text-2xl font-extrabold tracking-tighter text-[#DFE2EF]">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-[1px] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <div className="w-full h-full bg-[#0a0e17] rounded-[11px] flex items-center justify-center">
                                <Trophy className="w-4 h-4 text-emerald-400" />
                            </div>
                        </div>
                        Fantasy <span className="text-emerald-400">Chama</span>
                    </div>
                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 space-x-10 items-center">
                        <a href="#how-it-works" className="fc-landing-nav-link text-[#DFE2EF] opacity-70 hover:opacity-100 transition-opacity text-sm font-medium tracking-wide">How It Works</a>
                        <a href="#features" className="fc-landing-nav-link text-[#DFE2EF] opacity-70 hover:opacity-100 transition-opacity text-sm font-medium tracking-wide">Platform Capabilities</a>
                        <Link to="/terms" className="fc-landing-nav-link text-[#DFE2EF] opacity-70 hover:opacity-100 transition-opacity text-sm font-medium tracking-wide">Terms</Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/login')} className="fc-landing-nav-link hidden sm:block text-sm font-bold text-gray-400 hover:text-white transition-colors">
                            Sign In
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-24 md:pt-32 overflow-x-hidden">
                {/* Hero Section */}
                <section className="relative min-h-[85vh] flex items-center px-6 md:px-8 max-w-7xl mx-auto py-12 md:py-20">
                    <div className="absolute -top-24 -left-24 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-emerald-500/10 rounded-full blur-[100px] md:blur-[150px] pointer-events-none"></div>
                    <div className="absolute top-1/2 -right-24 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-amber-500/5 rounded-full blur-[100px] md:blur-[150px] pointer-events-none"></div>
                    
                    <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center w-full z-10">
                        {/* Left: Headline */}
                        <div className="space-y-6 md:space-y-8">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-400">Kenya's Elite FPL Platform</span>
                            </div>
                            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter leading-[0.95] text-white">
                                The Wealth <br />
                                <span className="text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">Vault</span> for <br />
                                <span className="text-amber-400 italic">FPL.</span>
                            </h1>
                            <p className="max-w-md text-base md:text-lg text-gray-400 font-medium leading-relaxed">
                                Connect your mini-league. Automate the stakes. Get paid instantly on M-Pesa the second you win.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
                                <button onClick={() => navigate('/setup')} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-[#002113] px-8 py-4 rounded-xl font-extrabold text-lg flex items-center justify-center gap-3 transition-colors shadow-lg shadow-emerald-500/20 active:scale-95">
                                    Initialize League
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                                <button onClick={() => navigate('/access')} className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 bg-[#161d24] hover:bg-[#1f2937] border border-white/5 transition-colors active:scale-95 text-white">
                                    Join With Code
                                </button>
                            </div>
                        </div>

                        {/* Right: Glass Dashboard Mockup (Custom Component) */}
                        <div className="relative pt-10 md:pt-0" style={{ perspective: '1000px' }}>
                            <div className="absolute inset-0 bg-emerald-500/10 rounded-[3rem] blur-2xl transform rotateY(-10deg) rotateX(5deg) scale(0.9) pointer-events-none"></div>
                            <div className="transition-transform duration-700 ease-out hover:rotate-0" style={{ transform: 'rotateY(-10deg) rotateX(5deg) scale(1.02)' }}>
                                <LedgerDemo />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Stats Bar: Bloomberg Terminal Style */}
                <section className="fc-landing-band py-16 md:py-24 bg-[#0A0E17] border-y border-white/[0.02] relative z-20">
                    <div className="max-w-7xl mx-auto px-6 md:px-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 md:gap-16">
                            <div className="border-l-2 border-emerald-500/30 pl-8 relative group">
                                <div className="absolute inset-0 bg-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl rounded-full" />
                                <p className="text-[10px] uppercase tracking-[0.35em] font-bold text-gray-500 mb-2">Duration</p>
                                <div className="flex flex-wrap items-baseline gap-2 relative z-10">
                                    <span className="text-5xl md:text-6xl font-black text-emerald-400 leading-none tracking-tighter drop-shadow-md">38</span>
                                    <span className="text-sm font-bold text-white tracking-tight">Gameweeks</span>
                                </div>
                            </div>
                            <div className="border-l-2 border-amber-500/30 pl-8 relative group">
                                <div className="absolute inset-0 bg-amber-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl rounded-full" />
                                <p className="text-[10px] uppercase tracking-[0.35em] font-bold text-gray-500 mb-2">Settlement</p>
                                <div className="flex flex-wrap items-baseline gap-2 relative z-10">
                                    <span className="text-5xl md:text-6xl font-black text-amber-400 leading-none tracking-tighter drop-shadow-md">100</span>
                                    <span className="text-sm font-bold text-white tracking-tight">% Accuracy</span>
                                </div>
                            </div>
                            <div className="border-l-2 border-emerald-500/30 pl-8 relative group">
                                <div className="absolute inset-0 bg-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl rounded-full" />
                                <p className="text-[10px] uppercase tracking-[0.35em] font-bold text-gray-500 mb-2">Latency</p>
                                <div className="flex flex-wrap items-baseline gap-2 relative z-10">
                                    <span className="text-5xl md:text-6xl font-black text-emerald-400 leading-none tracking-tighter drop-shadow-md">2</span>
                                    <span className="text-sm font-bold text-white tracking-tight">Taps</span>
                                </div>
                            </div>
                            <div className="border-l-2 border-amber-500/30 pl-8 relative group">
                                <div className="absolute inset-0 bg-amber-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl rounded-full" />
                                <p className="text-[10px] uppercase tracking-[0.35em] font-bold text-gray-500 mb-2">Efficiency</p>
                                <div className="flex flex-wrap items-baseline gap-2 relative z-10">
                                    <span className="text-5xl md:text-6xl font-black text-amber-400 leading-none tracking-tighter drop-shadow-md">0</span>
                                    <span className="text-sm font-bold text-white tracking-tight">Manual Math</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Interactive Trust Slider ────────────────────────────────────── */}
                <TrustSlider />

                {/* ── The Ledger Lifecycle (How it Works) ────────────────────────────────────── */}
                <section id="how-it-works" className="fc-landing-band py-24 md:py-32 px-6 md:px-8 bg-[#0d1620]/30 border-t border-b border-white/[0.02]">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-20 md:mb-24">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 block">Simple 4-Step Process</span>
                            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white mb-6">How It Works</h2>
                            <div className="w-16 h-1 bg-gradient-to-r from-emerald-500 to-emerald-300 mx-auto rounded-full"></div>
                        </div>
                        
                        <div className="relative">
                            {/* Horizontal Connector Line for Desktop */}
                            <div className="hidden md:block absolute top-[36px] left-[12%] right-[12%] h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
                                {[
                                    { step: '01', title: 'Create League', desc: 'The Chairman sets the stake amount and shares a 6-digit invite code via WhatsApp.', icon: <Users className="w-6 h-6" />, color: 'emerald' },
                                    { step: '02', title: 'Pay & Play', desc: 'Members pay easily via an automatic M-Pesa STK push. No more tracking exact receipts.', icon: <Smartphone className="w-6 h-6" />, color: 'amber' },
                                    { step: '03', title: 'Live Scoring', desc: 'We connect directly to the Premier League. See your rank and money rise with every goal.', icon: <TrendingUp className="w-6 h-6" />, color: 'blue' },
                                    { step: '04', title: 'Instant Payouts', desc: 'When the gameweek ends, the winner gets their cash sent straight to their M-Pesa automatically.', icon: <Banknote className="w-6 h-6" />, color: 'emerald' },
                                ].map((item, i) => (
                                    <div key={i} className="flex flex-col items-center text-center group">
                                        <div className={`fc-landing-card w-20 h-20 rounded-[1.25rem] bg-[#161d24] border border-white/5 flex items-center justify-center mb-8 hover:-translate-y-2 transition-transform duration-500 shadow-xl relative overflow-hidden text-${item.color}-400`}>
                                            <div className={`absolute inset-0 bg-${item.color}-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                                            <div className="relative z-10">{item.icon}</div>
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Step {item.step}</div>
                                        <h3 className="font-extrabold text-xl text-white mb-4 tracking-tight">{item.title}</h3>
                                        <p className="text-gray-400 leading-relaxed font-medium text-sm md:text-base px-2">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Platform Capabilities: Bento Grid ─────────────────────────────────── */}
                <section id="features" className="py-24 md:py-32 max-w-7xl mx-auto px-6 md:px-8 relative z-20">
                    <div className="mb-16 md:mb-20">
                        <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4 block">Institutional Architecture</span>
                        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white mb-6">Platform Capabilities</h2>
                        <div className="w-16 h-1 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
                        {/* Large Feature: Automated Escrow */}
                        <div className="fc-landing-card md:col-span-8 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-between border border-white/5 group hover:bg-[#1f2937] transition-colors relative overflow-hidden min-h-[300px]">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                            <div className="space-y-4 relative z-10 w-full md:w-3/4">
                                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
                                    <Lock className="w-6 h-6 text-emerald-400" />
                                </div>
                                <h3 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Automated Escrow</h3>
                                <p className="text-gray-400 text-lg leading-relaxed">
                                    Funds are locked in a programmatic vault at GW1. Automated distribution based on final API standings at GW38. Zero missing funds.
                                </p>
                            </div>
                        </div>

                        {/* Small Feature: Live FPL Sync */}
                        <div className="fc-landing-card md:col-span-4 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 hover:bg-[#1f2937] transition-colors relative overflow-hidden min-h-[300px]">
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none"></div>
                            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-5 relative z-10">
                                <Zap className="w-5 h-5 text-blue-400" />
                            </div>
                            <h3 className="text-2xl font-extrabold text-white mb-3 tracking-tight relative z-10">Live FPL Sync</h3>
                            <p className="text-gray-400 leading-relaxed text-sm lg:text-base relative z-10">
                                Direct integration with Official FPL APIs. Real-time stake valuation as points accumulate globally.
                            </p>
                        </div>

                        {/* Kickbacks / Yield Generation (NEW -> Obfuscated) */}
                        <div className="fc-landing-card md:col-span-6 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 hover:bg-[#1f2937] transition-colors relative overflow-hidden min-h-[300px]">
                            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none"></div>
                            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-6 relative z-10">
                                <Trophy className="w-6 h-6 text-amber-400" />
                            </div>
                            <h3 className="text-3xl font-extrabold text-white mb-4 tracking-tight relative z-10">Automated Admin Incentives</h3>
                            <p className="max-w-md text-gray-400 leading-relaxed text-base lg:text-lg relative z-10">
                                Stop managing leagues for free. The platform can natively route a commission directly to the Chairman's wallet upon every gameweek settlement.
                            </p>
                        </div>

                        {/* Red Zone Risk Management (NEW) */}
                        <div className="fc-landing-card md:col-span-6 bg-[#161d24] rounded-[2rem] p-8 md:p-10 flex flex-col justify-center border border-white/5 hover:bg-[#1f2937] transition-colors relative overflow-hidden min-h-[300px]">
                            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none"></div>
                            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6 relative z-10">
                                <Shield className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-3xl font-extrabold text-white mb-4 tracking-tight relative z-10">Maker/Checker Protocol</h3>
                            <p className="max-w-md text-gray-400 leading-relaxed text-base lg:text-lg relative z-10">
                                Financial integrity verified through dual-authorization protocols by a required Co-Chair before a single B2C payout or Red Zone exclusion executes.
                            </p>
                        </div>

                        {/* Medium Feature: Hybrid Cash Flow */}
                        <div className="fc-landing-card md:col-span-12 bg-[#161d24] rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between border border-white/5 hover:bg-[#1f2937] transition-colors relative overflow-hidden min-h-[250px] lg:min-h-[300px]">
                            <div className="absolute inset-y-0 right-0 w-full md:w-1/2 bg-gradient-to-l from-emerald-500/10 via-transparent to-transparent pointer-events-none"></div>
                            <div className="z-10 relative md:w-2/3 lg:w-3/5">
                                <div className="w-14 h-14 bg-[#0a0e17] border border-emerald-500/30 rounded-[1.25rem] flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/10">
                                    <Banknote className="w-7 h-7 text-emerald-400" />
                                </div>
                                <h3 className="text-3xl lg:text-4xl font-extrabold text-white mb-5 tracking-tight">Hybrid Cash Flow</h3>
                                <p className="text-gray-400 leading-relaxed text-lg">
                                    Execute payouts securely via Safaricom Daraja, or hand the winner physical cash while the system seamlessly reorganizes the digital ledger.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Closing CTA */}
                <section className="h-[80vh] flex items-center justify-center px-6 md:px-8 text-center relative overflow-hidden group">
                    {/* Deep Immersive Ambient Glow that expands on hover inside the section */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] group-hover:bg-emerald-500/30 group-hover:blur-[160px] group-hover:scale-150 transition-all duration-1000 ease-out pointer-events-none"></div>
                    
                    <div className="relative z-10 max-w-4xl mx-auto space-y-12 transition-transform duration-1000 ease-out group-hover:scale-105">
                        <div className="space-y-4">
                            <h2 className="fc-landing-title-gradient text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 leading-none">
                                The League <br/> Starts Now.
                            </h2>
                            <p className="text-gray-400 text-xl md:text-3xl font-medium max-w-2xl mx-auto drop-shadow-xl mt-8">
                                Stop managing spreadsheets. Move your mini-league to the only platform that automatically pays you a commission for hosting it.
                            </p>
                        </div>
                        <div className="flex flex-col justify-center items-center gap-4 pt-8 opacity-0 group-hover:opacity-100 transition-all duration-1000 delay-300 translate-y-4 group-hover:translate-y-0 pb-10">
                            <button onClick={() => navigate('/setup')} className="fc-landing-cta-secondary bg-[#FBBF24] text-[#0f172a] border border-amber-500/35 px-10 py-5 rounded-xl font-extrabold text-lg shadow-[0_0_40px_rgba(245,158,11,0.16)] hover:bg-[#eab308] hover:scale-105 transition-all active:scale-95 flex items-center gap-2">
                                <Trophy className="w-5 h-5" />
                                Claim Your 4% Chairman Fee
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="fc-landing-footer w-full bg-[#0a0e17]">
                <div className="flex flex-col md:flex-row justify-center md:justify-between items-center px-6 md:px-12 py-10 w-full max-w-7xl mx-auto border-t border-white/5">
                    <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-6 md:mb-0">
                        <Link to="/privacy-policy" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Privacy</Link>
                        <Link to="/terms" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Security</Link>
                        <Link to="/faq" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">FAQ</Link>
                        <a href="mailto:support@fantasychama.co.ke" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Support</a>
                        <a href="https://x.com/FantasyChama" className="text-gray-500 hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Twitter</a>
                    </div>
                    <div className="text-gray-600 text-xs font-semibold tracking-wide">
                        © 2026 Fantasy Chama. Institutional Grade.
                    </div>
                </div>
            </footer>
        </div>
    );
}
