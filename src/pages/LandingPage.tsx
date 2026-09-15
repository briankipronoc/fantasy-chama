import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useEffect, useState } from 'react';
import { Trophy, ArrowRight, Shield, Zap, Lock, Banknote, Users, Smartphone, TrendingUp, CheckCircle2 } from 'lucide-react';

// ─── Dynamic Animating System-Accurate Ledger Demo ────────────────────────────────
interface DemoMember {
    id: string;
    name: string;
    team: string;
    pts: number;
    status: 'funded' | 'spectator' | 'pending';
}

const initialDemoMembers: DemoMember[] = [
    { id: '1', name: 'Brian Kiprono', team: 'Live XI', pts: 74, status: 'funded' },
    { id: '2', name: 'Raul Gonzalez', team: 'Galacticos', pts: 68, status: 'funded' },
    { id: '3', name: 'Emmanuel S.', team: 'Simba FC', pts: 62, status: 'funded' },
    { id: '4', name: 'Akinyi M.', team: 'Nairobi Queens', pts: 58, status: 'spectator' },
    { id: '5', name: 'Kamau J.', team: 'Rift Strikers', pts: 51, status: 'pending' },
];

function LedgerDemo() {
    const [members, setMembers] = useState(initialDemoMembers);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'ledger' | 'victory' | 'mockup'>('ledger');

    useEffect(() => {
        const interval = setInterval(() => {
            setMembers(current => {
                const newMembers = [...current];
                // Randomly award 2-6 live matchday points to a member
                const randomIndex = Math.floor(Math.random() * (newMembers.length - 1));
                
                newMembers[randomIndex] = {
                    ...newMembers[randomIndex],
                    pts: newMembers[randomIndex].pts + Math.floor(Math.random() * 5) + 2
                };
                
                setHighlightId(newMembers[randomIndex].id);
                setTimeout(() => setHighlightId(null), 1200);

                return newMembers.sort((a, b) => b.pts - a.pts);
            });
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fc-landing-card w-full rounded-[2rem] bg-gradient-to-b from-[#18222c]/90 via-[#101720]/95 to-[#0a0f15] border-2 border-emerald-500/25 overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.12)] relative">
            {/* Ambient Lighting Orbs */}
            <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/15 rounded-full blur-[90px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-56 h-56 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />

            {/* Interactive Card Mode Tabs */}
            <div className="px-4 pt-3.5 pb-2.5 bg-[#0e151c]/90 border-b border-white/5 flex items-center justify-between gap-2 relative z-10">
                <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/10 rounded-xl backdrop-blur-md">
                    <button
                        type="button"
                        onClick={() => setActiveTab('ledger')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'ledger'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        ⚡ Live Ledger
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('victory')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'victory'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        🏆 Victory Card
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('mockup')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'mockup'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        💳 System Cards
                    </button>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE FPL SYNC
                </div>
            </div>

            {/* TAB 1: Live Interactive Ledger */}
            {activeTab === 'ledger' && (
                <div className="animate-in fade-in duration-300">
                    {/* Real System Card Header */}
                    <div className="px-5 py-4 border-b border-white/5 bg-[#121920]/80 backdrop-blur-md flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-[10px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
                                GW4 LIVE POT
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                Official FPL Sync
                            </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">Total Escrow Pot</p>
                                <p className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight">
                                    KES 2,800
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-500/30">
                                    91/9 Model
                                </span>
                                <p className="text-[11px] text-gray-300 font-semibold mt-1">
                                    KES 1,960 Weekly · KES 840 Vault
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Live Standings Table */}
                    <div className="p-3 sm:p-4 space-y-2 bg-[#0c1218]/70">
                        {members.map((m, index) => {
                            const isHighlighted = highlightId === m.id;
                            const isLeader = index === 0;

                            return (
                                <div
                                    key={m.id}
                                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl transition-all duration-500 border ${
                                        isLeader
                                            ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.12)]'
                                            : isHighlighted
                                                ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                                : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                                            isLeader
                                                ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/30 ring-1 ring-amber-300'
                                                : 'bg-white/5 text-gray-300 border border-white/10'
                                        }`}>
                                            {isLeader ? <Trophy className="w-4 h-4" /> : index + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-extrabold text-xs sm:text-sm text-white truncate">
                                                    {m.name}
                                                </p>
                                                {isLeader && (
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                        Leader 👑
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">
                                                {m.team}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                        <span className={`text-xs sm:text-sm font-black tabular-nums transition-colors ${
                                            isHighlighted ? 'text-emerald-400 font-extrabold' : isLeader ? 'text-amber-300' : 'text-gray-200'
                                        }`}>
                                            {m.pts} pts
                                        </span>
                                        <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-extrabold tracking-wide uppercase ${
                                            m.status === 'funded'
                                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                                                : m.status === 'spectator'
                                                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                        }`}>
                                            {m.status === 'funded' ? 'Funded ✓' : m.status === 'spectator' ? 'Spectator 🛡️' : 'Pending ⏳'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Real System Card Chrome Footer */}
                    <div className="px-5 py-3.5 bg-[#121920]/90 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1.5 font-semibold text-gray-300">
                            <Lock className="w-3.5 h-3.5 text-emerald-400" />
                            M-Pesa Escrow Verified
                        </span>
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Auto-Disbursed at Final Whistle
                        </span>
                    </div>
                </div>
            )}

            {/* TAB 2: Official WhatsApp Victory Card Visual */}
            {activeTab === 'victory' && (
                <div className="p-4 sm:p-6 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
                    <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/40 shadow-[0_0_40px_rgba(251,191,36,0.2)] max-w-sm w-full group">
                        <img 
                            src="/victory-card-preview.jpg" 
                            alt="Official WhatsApp Victory Card" 
                            className="w-full h-auto object-cover transform group-hover:scale-102 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                            <div className="inline-flex items-center gap-1.5 self-center px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 backdrop-blur-md text-amber-300 text-[10px] font-black uppercase tracking-wider">
                                🏆 Branded Victory Card for WhatsApp Status
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-300 mt-3 font-medium max-w-xs">
                        Every gameweek winner gets a custom, verified Victory Card to flex in WhatsApp groups and challenge rivals.
                    </p>
                </div>
            )}

            {/* TAB 3: Multi-Card System Mockup */}
            {activeTab === 'mockup' && (
                <div className="p-4 sm:p-6 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
                    <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)] max-w-sm w-full group">
                        <img 
                            src="/system-card-preview.jpg" 
                            alt="FantasyChama System Cards Showcase" 
                            className="w-full h-auto object-cover transform group-hover:scale-102 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                            <div className="inline-flex items-center gap-1.5 self-center px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-md text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                                🔒 Automated 91/9 Settlement Engine
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-300 mt-3 font-medium max-w-xs">
                        Three dedicated system cards: Live Matchday Pot, Automated M-Pesa Disbursal, and 38 Gameweeks Season Vault.
                    </p>
                </div>
            )}
        </div>
    );
}

function TrustSlider() {
    const [numPlayers, setNumPlayers] = useState(10);
    const [stakePerGw, setStakePerGw] = useState(1000);
    
    const potSize = numPlayers * stakePerGw;
    const winnerCut = potSize * 0.91;
    const adminCut = potSize * 0.09;
    const chairCut = potSize * 0.04;
    const hqCut = potSize * 0.035;
    const mpesaCut = potSize * 0.015;

    return (
        <section className="fc-landing-section py-12 sm:py-16 md:py-20 max-w-5xl mx-auto px-4 sm:px-6 relative z-30">
            <div className="fc-landing-panel bg-[#0b1014] border border-white/10 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-[0_0_60px_rgba(16,185,129,0.06)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="text-center mb-8">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2 block">
                        Full Transparency Guarantee
                    </span>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white mb-3">
                        The 91/9 Transparent Engine.
                    </h2>
                    <p className="text-gray-400 font-medium text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
                        91% goes straight to the Gameweek & Season winners. Exactly 9% covers automated FPL intelligence, M-Pesa fees, and Chairman payout.
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Number of Players</span>
                                <span className="text-xl font-black text-emerald-400 tabular-nums">{numPlayers} players</span>
                            </div>
                            <input 
                                type="range" 
                                min="2" 
                                max="50" 
                                step="1" 
                                value={numPlayers} 
                                onChange={(e) => setNumPlayers(Number(e.target.value))}
                                className="fc-range w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer transition-all"
                            />
                            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                <span>2</span><span>50</span>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stake per GW</span>
                                <span className="text-xl font-black text-emerald-400 tabular-nums">KES {stakePerGw.toLocaleString()}</span>
                            </div>
                            <input 
                                type="range" 
                                min="100" 
                                max="5000" 
                                step="50" 
                                value={stakePerGw} 
                                onChange={(e) => setStakePerGw(Number(e.target.value))}
                                className="fc-range w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer transition-all"
                            />
                            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                <span>KES 100</span><span>KES 5,000</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Gameweek Pot</span>
                        <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">KES {potSize.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 flex flex-col justify-center">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Pot Winners (91%)
                            </p>
                            <p className="text-3xl sm:text-4xl font-black text-emerald-400 tabular-nums">
                                KES {winnerCut.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400 mt-2 font-medium">
                                Dispatched directly to winner's M-Pesa automatically via Pochi / Till.
                            </p>
                        </div>
                        <div className="md:col-span-4 bg-[#161d24] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-center shadow-inner">
                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <Banknote className="w-3.5 h-3.5 text-amber-400" /> Ops & Chairman Fee (9%)
                            </p>
                            <p className="text-2xl font-black text-amber-400 tabular-nums">
                                KES {adminCut.toLocaleString()}
                            </p>
                            <div className="space-y-1.5 mt-3 pt-3 border-t border-white/5 text-xs text-gray-400">
                                <div className="flex justify-between font-medium"><span>Chairman (4%)</span> <span className="text-white font-bold">KES {chairCut.toLocaleString()}</span></div>
                                <div className="flex justify-between font-medium"><span>Platform HQ (3.5%)</span> <span className="text-white font-bold">KES {hqCut.toLocaleString()}</span></div>
                                <div className="flex justify-between font-medium"><span>M-Pesa Fee (1.5%)</span> <span className="text-white font-bold">KES {mpesaCut.toLocaleString()}</span></div>
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

    useEffect(() => {
        const leagueId = localStorage.getItem('activeLeagueId');
        const activeUserId = localStorage.getItem('activeUserId');
        if (leagueId && (role || activeUserId)) {
            navigate('/dashboard', { replace: true });
        }
    }, [role, navigate]);

    return (
        <div className="fc-landing-shell bg-[#0a0e17] text-[#dfe2ef] min-h-screen font-sans selection:bg-emerald-500 selection:text-[#002113]">
            {/* TopNavBar */}
            <nav className="fc-landing-nav fixed top-0 w-full z-50 bg-[#0f131c]/80 backdrop-blur-xl border-b border-white/[0.05]">
                <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 py-3.5 max-w-7xl mx-auto">
                    <div className="fc-landing-brand flex items-center gap-2 text-lg sm:text-xl md:text-2xl font-extrabold tracking-tighter text-[#DFE2EF]">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-[1px] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <div className="w-full h-full bg-[#0a0e17] rounded-[11px] flex items-center justify-center">
                                <Trophy className="w-4 h-4 text-emerald-400" />
                            </div>
                        </div>
                        Fantasy <span className="text-emerald-400">Chama</span>
                    </div>
                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 space-x-10 items-center">
                        <a href="#how-it-works" className="fc-landing-nav-link text-[#DFE2EF] opacity-70 hover:opacity-100 transition-opacity text-sm font-medium tracking-wide">How It Works</a>
                        <a href="#features" className="fc-landing-nav-link text-[#DFE2EF] opacity-70 hover:opacity-100 transition-opacity text-sm font-medium tracking-wide">Features</a>
                        <Link to="/terms" className="fc-landing-nav-link text-[#DFE2EF] opacity-70 hover:opacity-100 transition-opacity text-sm font-medium tracking-wide">Terms</Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/login')} className="fc-landing-nav-link text-xs sm:text-sm font-bold text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
                            Sign In
                        </button>
                        <button onClick={() => navigate('/setup')} className="bg-emerald-500 hover:bg-emerald-400 text-[#002113] px-3.5 py-1.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-emerald-500/20 active:scale-95">
                            Start Free
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-20 sm:pt-24 md:pt-28 overflow-x-hidden">
                {/* Hero Section */}
                <section className="fc-landing-section relative px-4 sm:px-6 md:px-8 max-w-7xl mx-auto py-8 sm:py-14 md:py-20">
                    <div className="absolute -top-24 -left-24 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-emerald-500/10 rounded-full blur-[100px] md:blur-[150px] pointer-events-none" />
                    <div className="absolute top-1/2 -right-24 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-amber-500/5 rounded-full blur-[100px] md:blur-[150px] pointer-events-none" />
                    
                    <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full z-10">
                        {/* Left: Headline */}
                        <div className="lg:col-span-6 space-y-5 sm:space-y-6 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-400">Kenya's Elite FPL Platform</span>
                            </div>
                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[1.02] text-white">
                                The Wealth <br className="hidden sm:inline" />
                                <span className="text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">Vault</span> for <br className="hidden sm:inline" />
                                <span className="text-amber-400 italic">FPL.</span>
                            </h1>
                            <p className="max-w-md mx-auto lg:mx-0 text-sm sm:text-base text-gray-400 font-medium leading-relaxed">
                                Set a stake per gameweek. Members pay via M-Pesa. The week's top scorer gets the pot — automatically calculated every GW with zero spreadsheet drama.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center lg:justify-start pt-2">
                                <button onClick={() => navigate('/setup')} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-[#002113] px-7 py-3.5 rounded-xl font-extrabold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 group">
                                    <span>Start a League</span>
                                    <span className="bg-[#002113] text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider border border-emerald-400/40">FREE</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button onClick={() => navigate('/access')} className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-[#161d24] hover:bg-[#1f2937] border border-white/10 transition-colors active:scale-95 text-white">
                                    Join With Code
                                </button>
                            </div>
                        </div>

                        {/* Right: Real System Live Ledger Preview */}
                        <div className="lg:col-span-6 w-full max-w-md mx-auto lg:max-w-none">
                            <LedgerDemo />
                        </div>
                    </div>
                </section>

                {/* Stats Bar */}
                <section className="fc-landing-section py-10 sm:py-14 bg-white/[0.01] border-y border-white/[0.04] relative z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
                            <div className="border-l-2 border-emerald-500/40 pl-4 sm:pl-6">
                                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-500 mb-1">Full Season</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-400 leading-none tracking-tighter">38</span>
                                    <span className="text-xs font-bold text-white">GWs Tracked</span>
                                </div>
                            </div>
                            <div className="border-l-2 border-amber-500/40 pl-4 sm:pl-6">
                                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-500 mb-1">Admin Overhead</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-400 leading-none tracking-tighter">KES 0</span>
                                </div>
                                <span className="text-xs font-bold text-gray-400">to run your league</span>
                            </div>
                            <div className="border-l-2 border-emerald-500/40 pl-4 sm:pl-6">
                                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-500 mb-1">Weekly Dues</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-400 leading-none tracking-tighter">2</span>
                                    <span className="text-xs font-bold text-white">Taps on M-Pesa</span>
                                </div>
                            </div>
                            <div className="border-l-2 border-amber-500/40 pl-4 sm:pl-6">
                                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-gray-500 mb-1">Payout Precision</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-400 leading-none tracking-tighter">100%</span>
                                </div>
                                <span className="text-xs font-bold text-gray-400">Official FPL API Sync</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Interactive Trust Slider */}
                <TrustSlider />

                {/* The Ledger Lifecycle (How it Works) */}
                <section id="how-it-works" className="fc-landing-section py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-8 bg-white/[0.01] border-t border-b border-white/[0.04]">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-10 sm:mb-14">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2 block">Simple 4-Step Process</span>
                            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">How It Works</h2>
                            <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">From Friday deadline to Sunday payouts, your league runs smoothly on autopilot.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 relative z-10">
                            {[
                                { step: '01', title: 'Chairman Creates League', desc: 'Set your weekly stake, link your FPL mini-league, and share a 6-character invite code with your squad on WhatsApp.', icon: <Users className="w-5 h-5" />, tone: 'emerald' },
                                { step: '02', title: 'Members Pay via M-Pesa', desc: 'Members send their weekly stake to the chairman via M-Pesa Pochi or Till. The ledger marks them funded with 1 tap.', icon: <Smartphone className="w-5 h-5" />, tone: 'amber' },
                                { step: '03', title: 'Live Matchday Pulse', desc: 'Points sync directly from the official FPL API. Real-time standings update as matchday goals and bonus points roll in.', icon: <TrendingUp className="w-5 h-5" />, tone: 'indigo' },
                                { step: '04', title: 'Chairman Pays the Winner', desc: 'When the GW finishes, the system shows the exact payout and recipient. Chairman confirms payout in seconds.', icon: <Banknote className="w-5 h-5" />, tone: 'emerald' },
                            ].map((item, i) => (
                                <div key={i} className="fc-landing-card bg-gradient-to-b from-[#161f28]/90 to-[#0c1218]/95 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-emerald-500/40 hover:shadow-[0_0_25px_rgba(16,185,129,0.12)] transition-all group shadow-lg">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${
                                                item.tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' :
                                                item.tone === 'amber' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(251,191,36,0.2)]' :
                                                'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                            }`}>
                                                {item.icon}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                Step {item.step}
                                            </span>
                                        </div>
                                        <h3 className="font-extrabold text-base sm:text-lg text-white mb-2 tracking-tight group-hover:text-emerald-300 transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Platform Capabilities: Bento Grid */}
                <section id="features" className="fc-landing-section py-12 sm:py-16 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 relative z-20">
                    <div className="mb-10 sm:mb-14 text-center sm:text-left">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2 block">Built for Kenyan FPL Leagues</span>
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">Platform Features</h2>
                        <div className="w-12 h-1 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full mx-auto sm:mx-0" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
                        {/* Large Feature: Automated Escrow */}
                        <div className="fc-landing-card md:col-span-8 bg-gradient-to-br from-[#16202a] to-[#0d141b] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-white/10 hover:border-emerald-500/30 transition-all relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
                            <div className="grid sm:grid-cols-12 gap-6 items-center relative z-10">
                                <div className="sm:col-span-7 space-y-3">
                                    <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center mb-4">
                                        <Lock className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Transparent Escrow Vaults</h3>
                                    <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                                        Weekly stakes and season pots are locked and accounted for down to the last shilling. Payouts match official FPL scores without delays or disputes.
                                    </p>
                                </div>
                                <div className="sm:col-span-5">
                                    <div className="rounded-2xl overflow-hidden border border-emerald-500/30 shadow-xl group-hover:scale-105 transition-transform duration-500">
                                        <img src="/system-card-preview.jpg" alt="System Escrow Card" className="w-full h-auto object-cover" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Small Feature: Live FPL Sync */}
                        <div className="fc-landing-card md:col-span-4 bg-gradient-to-br from-[#161c24] to-[#0f141a] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-white/10 hover:border-indigo-500/30 transition-all relative overflow-hidden shadow-xl">
                            <div className="w-10 h-10 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center mb-4">
                                <Zap className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2 tracking-tight">Live FPL Sync</h3>
                                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                                    Direct integration with Official FPL APIs. Standings update automatically without manual spreadsheet entry.
                                </p>
                            </div>
                        </div>

                        {/* Kickbacks / Chairman Incentive */}
                        <div className="fc-landing-card md:col-span-6 bg-gradient-to-br from-[#191e24] to-[#10151b] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-white/10 hover:border-amber-500/30 transition-all relative overflow-hidden shadow-xl">
                            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center mb-4">
                                <Trophy className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2 tracking-tight">Chairman Commission</h3>
                                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                                    Stop running your league for free. The platform routes an automatic 4% commission to the Chairman's wallet upon every gameweek settlement.
                                </p>
                            </div>
                        </div>

                        {/* Co-Chair Approval */}
                        <div className="fc-landing-card md:col-span-6 bg-gradient-to-br from-[#161f26] to-[#0f151b] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-white/10 hover:border-emerald-500/30 transition-all relative overflow-hidden shadow-xl">
                            <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center mb-4">
                                <Shield className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2 tracking-tight">Co-Chair Verification</h3>
                                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                                    Every payout and member status update requires approval from your designated Co-Chair. Double protection against accidental clicks.
                                </p>
                            </div>
                        </div>

                        {/* 1v1 Side Bets & Spectators with WhatsApp Victory Card Image */}
                        <div className="fc-landing-card md:col-span-12 bg-gradient-to-br from-[#1d1a12] via-[#141b24] to-[#0b1016] rounded-3xl p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 border-2 border-amber-500/35 hover:border-amber-500/55 transition-all relative overflow-hidden group shadow-2xl">
                            <div className="space-y-4 md:max-w-xl relative z-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                                    <Trophy className="w-3.5 h-3.5" /> WhatsApp Flex Cards
                                </div>
                                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">1v1 Side Bets & Victory Cards</h3>
                                <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                                    Spectators can follow the league for free and challenge friends to head-to-head cash side bets. Generate stunning branded Victory Cards to post directly to your WhatsApp Status and banter the group.
                                </p>
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <button
                                        onClick={() => navigate('/setup')}
                                        className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2"
                                    >
                                        <span>Start a League Now</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="w-full md:w-80 shrink-0 relative z-10">
                                <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/40 shadow-[0_0_35px_rgba(251,191,36,0.25)] group-hover:scale-102 transition-transform duration-500">
                                    <img 
                                        src="/victory-card-preview.jpg" 
                                        alt="Victory Card Showcase" 
                                        className="w-full h-auto object-cover" 
                                    />
                                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-amber-400/50 text-[10px] font-black text-amber-300 uppercase tracking-wider">
                                        WhatsApp Ready
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Closing CTA */}
                <section className="fc-landing-section py-14 sm:py-20 px-4 sm:px-6 md:px-8 text-center relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
                    
                    <div className="relative z-10 max-w-3xl mx-auto space-y-6">
                        <div className="space-y-3">
                            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter text-white leading-tight">
                                Your League <br />
                                <span className="text-emerald-400">Starts Here.</span>
                            </h2>
                            <p className="text-gray-400 text-sm sm:text-base md:text-lg font-medium max-w-xl mx-auto">
                                Stop managing WhatsApp chaos and spreadsheets. Set up your league in 3 minutes — every gameweek runs itself.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
                            <button onClick={() => navigate('/setup')} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-[#002113] px-8 py-4 rounded-xl font-extrabold text-base shadow-lg shadow-emerald-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 group">
                                <Trophy className="w-4 h-4" />
                                <span>Start a League</span>
                                <span className="bg-[#002113] text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider border border-emerald-400/40">FREE</span>
                            </button>
                            <button onClick={() => navigate('/access')} className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-[#161d24] hover:bg-[#1f2937] border border-white/10 transition-colors active:scale-95 text-white">
                                Join With Code
                            </button>
                        </div>
                        <p className="text-gray-500 text-xs">No credit card needed · Free for all managers · Chairman earns 4% commission</p>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="fc-landing-footer w-full bg-[#0a0e17] border-t border-white/5">
                <div className="flex flex-col sm:flex-row justify-between items-center px-4 sm:px-6 md:px-12 py-8 max-w-7xl mx-auto gap-4">
                    <div className="flex flex-wrap justify-center gap-5 sm:gap-8 text-xs font-medium text-gray-400">
                        <Link to="/privacy-policy" className="hover:text-emerald-400 transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-emerald-400 transition-colors">Terms</Link>
                        <Link to="/faq" className="hover:text-emerald-400 transition-colors">FAQ</Link>
                        <a href="mailto:support@fantasychama.co.ke" className="hover:text-emerald-400 transition-colors">Support</a>
                    </div>
                    <div className="text-gray-500 text-xs font-semibold text-center sm:text-right">
                        © 2026 Fantasy Chama. Built for Kenyan FPL leagues.
                    </div>
                </div>
            </footer>
        </div>
    );
}
