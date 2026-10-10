import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useEffect, useState, useRef } from 'react';
import { Trophy, ArrowRight, Shield, Zap, Lock, Banknote, Users, Smartphone, TrendingUp, CheckCircle2, Sun, Moon, Laptop, ChevronDown, Flame, MessageSquare, Calculator, Copy, Check } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

// ─── Crisp, Zero-Scroll Animated Ledger Demo ────────────────────────────────
interface DemoMember {
    id: string;
    name: string;
    team: string;
    pts: number;
    status: 'funded' | 'spectator' | 'pending';
}

const initialDemoMembers: DemoMember[] = [
    { id: '1', name: 'Joel Sifuna', team: 'Sifuna Stars', pts: 78, status: 'funded' },
    { id: '2', name: 'Kevin Otieno', team: 'Nairobi Kings', pts: 72, status: 'funded' },
    { id: '3', name: 'Brian Mwangi', team: 'Safari Boys', pts: 65, status: 'funded' },
    { id: '4', name: 'Faith Cherono', team: 'Rift Valley FC', pts: 61, status: 'spectator' },
];

function LedgerDemo() {
    const [members, setMembers] = useState(initialDemoMembers);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'standings' | 'banter' | 'victory'>('standings');
    const [copiedBanter, setCopiedBanter] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setMembers(current => {
                const newMembers = [...current];
                const randomIndex = Math.floor(Math.random() * (newMembers.length - 1));
                
                newMembers[randomIndex] = {
                    ...newMembers[randomIndex],
                    pts: newMembers[randomIndex].pts + Math.floor(Math.random() * 4) + 2
                };
                
                setHighlightId(newMembers[randomIndex].id);
                setTimeout(() => setHighlightId(null), 1200);

                return newMembers.sort((a, b) => b.pts - a.pts);
            });
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const copyBanterToClipboard = () => {
        setCopiedBanter(true);
        setTimeout(() => setCopiedBanter(false), 2000);
    };

    return (
        <div className="fc-landing-card w-full rounded-3xl bg-white/95 dark:bg-[#0c1218]/95 border-2 border-emerald-500/25 overflow-hidden shadow-xl dark:shadow-[0_0_50px_rgba(16,185,129,0.12)] relative">
            {/* Ambient Lighting Orbs */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-44 h-44 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

            {/* Interactive Mode Tabs */}
            <div className="p-2 bg-slate-50/90 dark:bg-[#0e151c]/90 border-b border-slate-200/80 dark:border-white/5 relative z-10">
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 dark:bg-black/40 border border-slate-300/70 dark:border-white/10 rounded-xl backdrop-blur-md w-full">
                    <button
                        type="button"
                        onClick={() => setActiveTab('standings')}
                        className={`w-full text-center py-1.5 px-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'standings'
                                ? 'bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35 shadow-xs'
                                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-white/5'
                        }`}
                    >
                        ⚡ Standings
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('banter')}
                        className={`w-full text-center py-1.5 px-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'banter'
                                ? 'bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35 shadow-xs'
                                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-white/5'
                        }`}
                    >
                        🔥 Banter Slip
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('victory')}
                        className={`w-full text-center py-1.5 px-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'victory'
                                ? 'bg-amber-600/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/35 shadow-xs'
                                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-white/5'
                        }`}
                    >
                        🏆 Victory Card
                    </button>
                </div>
            </div>

            {/* TAB 1: Live Interactive Standings */}
            {activeTab === 'standings' && (
                <div className="w-full flex flex-col justify-between animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-[#121920]/80 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                GW5 LIVE MATCHDAY
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-gray-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                Official FPL Sync
                            </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-0.5">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Total Gameweek Pot</p>
                                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                                    KES 2,800
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-500/30">
                                    70 / 30 Split
                                </span>
                                <p className="text-[10px] text-slate-600 dark:text-gray-300 font-semibold mt-0.5">
                                    KES 1,960 Weekly · KES 840 Vault
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Live Standings Rows */}
                    <div className="p-3 space-y-1.5 bg-slate-50/40 dark:bg-[#0c1218]/70">
                        {members.map((m, index) => {
                            const isHighlighted = highlightId === m.id;
                            const isLeader = index === 0;

                            return (
                                <div
                                    key={m.id}
                                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-300 border ${
                                        isLeader
                                            ? 'bg-amber-50/90 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 shadow-xs'
                                            : isHighlighted
                                                ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/50 shadow-xs'
                                                : 'bg-white dark:bg-white/[0.03] border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                                            isLeader
                                                ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-black shadow-sm ring-1 ring-amber-300'
                                                : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-white/10'
                                        }`}>
                                            {isLeader ? <Trophy className="w-3.5 h-3.5" /> : index + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                                    {m.name}
                                                </p>
                                                {isLeader && (
                                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                                                        Leader 👑
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                                                {m.team}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                                        <span className={`text-xs sm:text-sm font-black tabular-nums transition-colors ${
                                            isHighlighted ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : isLeader ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-gray-200'
                                        }`}>
                                            {m.pts} pts
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-wide uppercase ${
                                            m.status === 'funded'
                                                ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/35'
                                                : 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/30'
                                        }`}>
                                            {m.status === 'funded' ? 'Funded ✓' : 'Spectator 🛡️'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-[#121920]/90 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between text-xs text-slate-600 dark:text-gray-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300 text-[11px]">
                            <Lock className="w-3 h-3 text-emerald-500" />
                            M-Pesa Escrow Verified
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Auto-Calculated at Final Whistle
                        </span>
                    </div>
                </div>
            )}

            {/* TAB 2: WhatsApp Banter Slip */}
            {activeTab === 'banter' && (
                <div className="w-full flex flex-col justify-between animate-in fade-in duration-200">
                    <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-[#121920]/80 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                            🔥 Chama WhatsApp Banter Slip
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-gray-300">
                            1-Tap Group Export
                        </span>
                    </div>

                    <div className="p-3 sm:p-4 flex-1 flex flex-col items-center justify-center">
                        <div className="w-full rounded-2xl bg-white dark:bg-[#0b141a] border-2 border-emerald-500/30 dark:border-emerald-500/40 p-3 sm:p-4 shadow-md text-left font-sans text-xs">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2 mb-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-base">📋</span>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Matchday Digest</p>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">Chama WhatsApp Banter</p>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-[9px] font-black">
                                    ROAST: PROPER 🔥
                                </span>
                            </div>

                            <div className="space-y-1.5 bg-slate-50 dark:bg-black/40 border border-slate-200/80 dark:border-white/10 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 text-[10.5px] leading-relaxed font-mono">
                                <p className="font-bold text-emerald-700 dark:text-emerald-300">🏆 *NAIROBI CHAMA GW5 DIGEST*</p>
                                <p>👑 *King of the Week:* Joel Sifuna: 78 pts (KES 1,960) 💰<br /><span className="text-slate-500 dark:text-gray-400 italic">"Huyu jamaa ameiba points tena, sherehe iko wapi?"</span></p>
                                <p>🥔 *Mtu wa Chini:* David Ochieng: 54 pts 🥄<br /><span className="text-slate-500 dark:text-gray-400 italic">"Form imeshuka kama shillingi. Tafuta fundi."</span></p>
                                <p className="text-amber-700 dark:text-amber-400 font-bold">🚨 *Red Zone:* 1 member atume stake kabla Ijumaa 8 PM!</p>
                            </div>

                            <button
                                type="button"
                                onClick={copyBanterToClipboard}
                                className="w-full mt-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs transition-all shadow-sm active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{copiedBanter ? '✓ Copied to WhatsApp!' : 'Copy Banter Slip for WhatsApp'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="px-4 py-2 bg-slate-50/90 dark:bg-[#121920]/90 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-600 dark:text-gray-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300">
                            <MessageSquare className="w-3 h-3 text-emerald-500" />
                            Kenyan Sheng Ready
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            Zero Manual Typing
                        </span>
                    </div>
                </div>
            )}

            {/* TAB 3: WhatsApp Victory Card */}
            {activeTab === 'victory' && (
                <div className="w-full flex flex-col justify-between animate-in fade-in duration-200">
                    <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-[#121920]/80 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                            🏆 WhatsApp Flex Card
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-gray-300">
                            Auto-Generated
                        </span>
                    </div>

                    <div className="p-3 sm:p-4 flex-1 flex flex-col items-center justify-center">
                        <div className="w-full rounded-2xl bg-gradient-to-b from-amber-50/90 via-white to-amber-50/40 dark:from-[#18231c] dark:via-[#0d141b] dark:to-[#080d12] border-2 border-amber-400/80 dark:border-amber-500/40 p-4 shadow-md text-left font-sans">
                            <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-white/10 pb-2 mb-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 dark:bg-amber-500/20 dark:border-amber-500/40 flex items-center justify-center">
                                        <Trophy className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">Gameweek 5 Winner</p>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">Official Chama Crown</p>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 dark:text-emerald-400 text-[9px] font-black uppercase">
                                    VERIFIED
                                </span>
                            </div>

                            <div className="space-y-0.5 mb-2.5">
                                <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Joel Sifuna</p>
                                <p className="text-xs text-amber-800 dark:text-amber-300/80 font-semibold">Sifuna Stars · 78 pts</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 bg-white/80 dark:bg-black/40 border border-amber-200/80 dark:border-white/10 rounded-xl p-2.5 mb-2.5 shadow-xs">
                                <div>
                                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Cash Won</p>
                                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">KES 1,960</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Season Rank</p>
                                    <p className="text-sm font-black text-amber-700 dark:text-amber-400">#1 (Podium)</p>
                                </div>
                            </div>

                            <div className="w-full py-1.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 dark:text-emerald-300 text-[9px] font-black uppercase tracking-widest text-center">
                                📱 Ready to flex on WhatsApp Status
                            </div>
                        </div>
                    </div>

                    <div className="px-4 py-2 bg-slate-50/90 dark:bg-[#121920]/90 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-600 dark:text-gray-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300">
                            <Trophy className="w-3 h-3 text-amber-500" />
                            Official Podium Slip
                        </span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                            One-Tap Share
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── The Pot Engine Calculator With Interactive Dual-Segment Split Bar ─────────────
function TrustSlider() {
    const [numPlayers, setNumPlayers] = useState(10);
    const [stakePerGw, setStakePerGw] = useState(1000);
    const [splitWeekly, setSplitWeekly] = useState(70); // 0 to 100% weekly winner pot
    
    const splitVault = 100 - splitWeekly; // remainder into season finale vault
    const potSize = numPlayers * stakePerGw;
    const netPot = potSize * 0.91;
    const weeklyWinnerPrize = Math.round(netPot * (splitWeekly / 100));
    const seasonVaultWeekly = Math.round(netPot * (splitVault / 100));
    const seasonVaultTotal = seasonVaultWeekly * 38;

    const adminCut = potSize * 0.09;
    const chairCut = potSize * 0.04;
    const hqCut = potSize * 0.035;
    const mpesaCut = potSize * 0.015;

    const playersPercent = ((numPlayers - 2) / (50 - 2)) * 100;
    const stakePercent = ((stakePerGw - 100) / (5000 - 100)) * 100;

    return (
        <section className="fc-landing-section py-10 sm:py-16 md:py-20 max-w-5xl mx-auto px-4 sm:px-6 relative z-30">
            <div className="fc-landing-panel bg-white dark:bg-[#0b1014] border border-slate-200 dark:border-white/10 rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 md:p-10 shadow-xl dark:shadow-[0_0_60px_rgba(16,185,129,0.06)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="text-center mb-8">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2 block">
                        Interactive Chama Pot Engine
                    </span>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
                        Calculate Your League Pot &amp; Splits
                    </h2>
                    <p className="text-slate-600 dark:text-gray-400 font-medium text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
                        Customize how much goes to the weekly matchday winner versus the season finale vault jackpot. 91% straight to managers, 0 hidden deductions.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Controls: Players & Stake */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-4">
                            <div className="flex justify-between items-end mb-2.5">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Number of Managers</span>
                                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{numPlayers} managers</span>
                            </div>
                            <input 
                                type="range" 
                                min="2" 
                                max="50" 
                                step="1" 
                                value={numPlayers} 
                                onChange={(e) => setNumPlayers(Number(e.target.value))}
                                style={{
                                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${playersPercent}%, var(--fc-slider-track) ${playersPercent}%, var(--fc-slider-track) 100%)`
                                }}
                                className="fc-range w-full h-2 rounded-full appearance-none cursor-pointer transition-all"
                                aria-label="Number of managers"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-gray-500 mt-1.5 font-semibold">
                                <span>2 managers</span><span>50 managers</span>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-4">
                            <div className="flex justify-between items-end mb-2.5">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Stake per Gameweek</span>
                                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">KES {stakePerGw.toLocaleString()}</span>
                            </div>
                            <input 
                                type="range" 
                                min="100" 
                                max="5000" 
                                step="50" 
                                value={stakePerGw} 
                                onChange={(e) => setStakePerGw(Number(e.target.value))}
                                style={{
                                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${stakePercent}%, var(--fc-slider-track) ${stakePercent}%, var(--fc-slider-track) 100%)`
                                }}
                                className="fc-range w-full h-2 rounded-full appearance-none cursor-pointer transition-all"
                                aria-label="Stake per Gameweek"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-gray-500 mt-1.5 font-semibold">
                                <span>KES 100</span><span>KES 5,000</span>
                            </div>
                        </div>
                    </div>

                    {/* Total Pool Banner */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-[#121920] border border-slate-200 dark:border-white/5">
                        <div>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest block">Total Collected Per GW</span>
                            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">KES {potSize.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Net Manager Pot (91%)</span>
                            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">KES {Math.round(netPot).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* ─── PROMINENT POT SPLIT BAR ─── */}
                    <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    Pot Distribution: Weekly Winner vs Season Vault
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Drag the slider or choose a preset to adjust how winnings split.</p>
                            </div>

                            {/* Preset Buttons */}
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { label: '70 / 30', val: 70 },
                                    { label: '50 / 50', val: 50 },
                                    { label: '80 / 20', val: 80 },
                                    { label: '100% Weekly', val: 100 },
                                ].map((p) => (
                                    <button
                                        key={p.val}
                                        type="button"
                                        onClick={() => setSplitWeekly(p.val)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            splitWeekly === p.val
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Split Bar Track Visual */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs font-black">
                                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                    <Trophy className="w-3.5 h-3.5" /> Weekly Winner: {splitWeekly}%
                                </span>
                                <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <Lock className="w-3.5 h-3.5" /> Season Vault: {splitVault}%
                                </span>
                            </div>

                            {/* Visual Dual-Colored Split Segment Bar */}
                            <div className="w-full h-4 sm:h-5 rounded-full overflow-hidden flex border-2 border-slate-300 dark:border-white/20 shadow-inner bg-slate-200 dark:bg-black/60 p-0.5">
                                <div 
                                    style={{ width: `${splitWeekly}%` }}
                                    className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 rounded-l-full transition-all duration-200 flex items-center justify-end pr-1 text-[9px] font-black text-white shadow-sm"
                                >
                                    {splitWeekly >= 20 && <span className="drop-shadow-xs">{splitWeekly}%</span>}
                                </div>
                                <div 
                                    style={{ width: `${splitVault}%` }}
                                    className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 rounded-r-full transition-all duration-200 flex items-center justify-start pl-1 text-[9px] font-black text-slate-950 shadow-sm"
                                >
                                    {splitVault >= 20 && <span className="drop-shadow-xs">{splitVault}%</span>}
                                </div>
                            </div>

                            {/* Range Slider Controller */}
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                step="5" 
                                value={splitWeekly} 
                                onChange={(e) => setSplitWeekly(Number(e.target.value))}
                                style={{
                                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${splitWeekly}%, #f59e0b ${splitWeekly}%, #f59e0b 100%)`
                                }}
                                className="fc-range w-full h-2.5 rounded-full appearance-none cursor-pointer transition-all"
                                aria-label="Split between weekly pot and season vault"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-gray-400 font-semibold px-0.5">
                                <span>0% Weekly (All to Vault)</span>
                                <span>50 / 50</span>
                                <span>100% Weekly (No Vault)</span>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Weekly Winner Prize Card */}
                        <div className="md:col-span-4 bg-emerald-500/10 border-2 border-emerald-500/35 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                            <div>
                                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Weekly Winner ({splitWeekly}%)
                                </p>
                                <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                                    KES {weeklyWinnerPrize.toLocaleString()}
                                </p>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-gray-400 mt-2 font-medium">
                                Sent to the top gameweek manager every single round via M-Pesa.
                            </p>
                        </div>

                        {/* Season Vault Pool Card */}
                        <div className="md:col-span-4 bg-amber-500/10 border-2 border-amber-500/35 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                            <div>
                                <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Season Vault ({splitVault}%)
                                </p>
                                <p className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-400 tabular-nums">
                                    KES {seasonVaultWeekly.toLocaleString()} <span className="text-xs font-bold">/ GW</span>
                                </p>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-gray-400 mt-2 font-medium">
                                Locked in escrow. Grows to <strong className="text-slate-900 dark:text-white">KES {seasonVaultTotal.toLocaleString()}</strong> across 38 GWs for podium winners!
                            </p>
                        </div>

                        {/* Ops & Chairman Fee (9%) */}
                        <div className="md:col-span-4 bg-slate-50 dark:bg-[#161d24] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                            <div>
                                <p className="text-[10px] font-black text-slate-700 dark:text-gray-300 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Banknote className="w-3.5 h-3.5 text-slate-600 dark:text-gray-400" /> Ops &amp; Chairman (9%)
                                </p>
                                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                                    KES {Math.round(adminCut).toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1 mt-2 pt-2 border-t border-slate-200 dark:border-white/5 text-[11px] text-slate-600 dark:text-gray-400">
                                <div className="flex justify-between font-medium"><span>Chairman Fee (4%)</span> <span className="text-slate-900 dark:text-white font-bold">KES {Math.round(chairCut).toLocaleString()}</span></div>
                                <div className="flex justify-between font-medium"><span>Platform HQ (3.5%)</span> <span className="text-slate-900 dark:text-white font-bold">KES {Math.round(hqCut).toLocaleString()}</span></div>
                                <div className="flex justify-between font-medium"><span>M-Pesa Disbursals (1.5%)</span> <span className="text-slate-900 dark:text-white font-bold">KES {Math.round(mpesaCut).toLocaleString()}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Theme Switcher (System / Light / Dark / Stealth) ──────────────────────────
function ExpandingThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const modes = [
        { key: 'system', label: 'System', icon: <Laptop className="w-3.5 h-3.5 text-emerald-500" />, desc: 'Follow Device' },
        { key: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5 text-amber-500" />, desc: 'Crisp White & Green' },
        { key: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5 text-indigo-400" />, desc: 'Deep Charcoal' },
        { key: 'stealth', label: 'Stealth', icon: <Shield className="w-3.5 h-3.5 text-amber-400" />, desc: 'Pitch Black OLED' },
    ] as const;

    const currentMode = modes.find(m => m.key === theme) || modes[0];

    return (
        <div ref={containerRef} className="relative z-50">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 text-slate-700 dark:text-gray-200 transition-all cursor-pointer active:scale-95 shadow-xs"
                aria-label={`Current theme: ${theme}. Tap to change theme`}
            >
                {currentMode.icon}
                <span className="text-[10px] font-black uppercase tracking-wider">{currentMode.label}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 p-1.5 rounded-2xl bg-white/95 dark:bg-[#111822]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    {modes.map((m) => (
                        <button
                            key={m.key}
                            type="button"
                            onClick={() => {
                                setTheme(m.key);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                                theme === m.key
                                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                                    : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                {m.icon}
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-wider leading-none">{m.label}</p>
                                    <p className="text-[9px] text-slate-500 dark:text-gray-400 font-medium mt-0.5">{m.desc}</p>
                                </div>
                            </div>
                            {theme === m.key && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
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
        <div className="fc-landing-shell bg-slate-50 dark:bg-[#0a0e17] text-slate-900 dark:text-[#dfe2ef] min-h-screen font-sans selection:bg-emerald-500 selection:text-[#002113]">
            {/* TopNavBar */}
            <nav className="fc-landing-nav fixed top-0 w-full z-50 bg-white/85 dark:bg-[#0f131c]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.05]">
                <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 py-3.5 max-w-7xl mx-auto">
                    <div className="fc-landing-brand flex items-center gap-2 text-lg sm:text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-[#DFE2EF]">
                        <img 
                            src="/favicon.svg" 
                            alt="Fantasy Chama Logo" 
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl shadow-md shadow-emerald-500/20 object-contain shrink-0" 
                        />
                        <span className="tracking-tight whitespace-nowrap">
                            Fantasy <span className="text-emerald-600 dark:text-emerald-400">Chama</span>
                        </span>
                    </div>
                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 space-x-10 items-center">
                        <a href="#how-it-works" className="fc-landing-nav-link text-slate-600 dark:text-[#DFE2EF] opacity-80 hover:opacity-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">How It Works</a>
                        <a href="#features" className="fc-landing-nav-link text-slate-600 dark:text-[#DFE2EF] opacity-80 hover:opacity-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Features</a>
                        <Link to="/terms" className="fc-landing-nav-link text-slate-600 dark:text-[#DFE2EF] opacity-80 hover:opacity-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm font-medium tracking-wide">Terms</Link>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Expanding & Contracting Theme Switcher */}
                        <ExpandingThemeSwitcher />

                        <button onClick={() => navigate('/login')} className="fc-landing-nav-link text-xs sm:text-sm font-extrabold text-slate-700 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white transition-colors px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95 shadow-sm">
                            Sign In
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
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-600 dark:text-emerald-400">Kenyan FPL Chama Automation</span>
                            </div>
                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[1.02] text-slate-900 dark:text-white">
                                Automate Your <br className="hidden sm:inline" />
                                <span className="text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">FPL Cash League</span> <br className="hidden sm:inline" />
                                <span className="text-amber-600 dark:text-amber-400">On Autopilot.</span>
                            </h1>
                            <p className="max-w-md mx-auto lg:mx-0 text-sm sm:text-base text-slate-600 dark:text-gray-400 font-medium leading-relaxed">
                                Set your weekly stake. Collect dues via M-Pesa Pochi or Till. Points sync in real-time from the official FPL API, and the pot is calculated down to the last shilling at the final whistle.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center lg:justify-start pt-2">
                                <button onClick={() => navigate('/setup')} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-[#002113] px-7 py-3.5 rounded-xl font-extrabold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 group cursor-pointer">
                                    <span>Start a League</span>
                                    <span className="bg-[#002113] text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider border border-emerald-400/40">FREE</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button onClick={() => navigate('/access')} className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#161d24] dark:hover:bg-[#1f2937] border border-slate-200 dark:border-white/10 transition-colors active:scale-95 text-slate-900 dark:text-white cursor-pointer">
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
                <section className="fc-landing-section py-8 sm:py-12 bg-slate-100/60 dark:bg-white/[0.01] border-y border-slate-200 dark:border-white/[0.04] relative z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
                            <div className="border-l-2 border-emerald-500/40 pl-4 sm:pl-6">
                                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-500 dark:text-gray-500 mb-1">Full Season</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-tighter">38</span>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">GWs Synced</span>
                                </div>
                            </div>
                            <div className="border-l-2 border-amber-500/40 pl-4 sm:pl-6">
                                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-500 dark:text-gray-500 mb-1">Admin Stress</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-600 dark:text-amber-400 leading-none tracking-tighter">KES 0</span>
                                </div>
                                <span className="text-xs font-bold text-slate-600 dark:text-gray-400">Zero Excel drama</span>
                            </div>
                            <div className="border-l-2 border-emerald-500/40 pl-4 sm:pl-6">
                                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-500 dark:text-gray-500 mb-1">Weekly Dues</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-tighter">1-Tap</span>
                                </div>
                                <span className="text-xs font-bold text-slate-600 dark:text-gray-400">M-Pesa Pochi / Till</span>
                            </div>
                            <div className="border-l-2 border-amber-500/40 pl-4 sm:pl-6">
                                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-500 dark:text-gray-500 mb-1">Payout Precision</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-600 dark:text-amber-400 leading-none tracking-tighter">100%</span>
                                </div>
                                <span className="text-xs font-bold text-slate-600 dark:text-gray-400">Official FPL API Sync</span>
                            </div>
                        </div>
                    </div>
                </section>


                {/* Interactive Trust Slider */}
                <TrustSlider />

                {/* The Ledger Lifecycle (How it Works) */}
                <section id="how-it-works" className="fc-landing-section py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-8 bg-slate-100/40 dark:bg-white/[0.01] border-t border-b border-slate-200 dark:border-white/[0.04]">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-10 sm:mb-14">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2 block">Simple 4-Step Process</span>
                            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">How It Works</h2>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 max-w-md mx-auto">From Friday deadline to Sunday payouts, your league runs smoothly on autopilot.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 relative z-10">
                            {[
                                { step: '01', title: 'Chairman Creates League', desc: 'Set your weekly stake, link your FPL mini-league, and share a 6-character invite code with your squad on WhatsApp.', icon: <Users className="w-5 h-5" />, tone: 'emerald' },
                                { step: '02', title: 'Members Pay via M-Pesa', desc: 'Members send their weekly stake to the chairman via M-Pesa Pochi or Till. The ledger marks them funded with 1 tap.', icon: <Smartphone className="w-5 h-5" />, tone: 'amber' },
                                { step: '03', title: 'Live Matchday Pulse', desc: 'Points sync directly from the official FPL API. Real-time standings update as matchday goals and bonus points roll in.', icon: <TrendingUp className="w-5 h-5" />, tone: 'indigo' },
                                { step: '04', title: 'Chairman Pays the Winner', desc: 'When the GW finishes, the system shows the exact payout and recipient. Chairman confirms payout in seconds.', icon: <Banknote className="w-5 h-5" />, tone: 'emerald' },
                            ].map((item, i) => (
                                <div key={i} className="fc-landing-card bg-white dark:bg-gradient-to-b dark:from-[#161f28]/90 dark:to-[#0c1218]/95 border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-emerald-500/40 hover:shadow-lg transition-all group shadow-md">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${
                                                item.tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
                                                item.tone === 'amber' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
                                                'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                                            }`}>
                                                {item.icon}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                Step {item.step}
                                            </span>
                                        </div>
                                        <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white mb-2 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-slate-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
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
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2 block">Built for Kenyan FPL Leagues</span>
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">Platform Features</h2>
                        <div className="w-12 h-1 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full mx-auto sm:mx-0" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
                        {/* Large Feature: Automated Escrow */}
                        <div className="fc-landing-card md:col-span-8 bg-white dark:bg-gradient-to-br dark:from-[#16202a] dark:to-[#0d141b] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 dark:border-white/10 hover:border-emerald-500/30 transition-all relative overflow-hidden group shadow-lg">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
                            <div className="grid sm:grid-cols-12 gap-6 items-center relative z-10">
                                <div className="sm:col-span-7 space-y-3">
                                    <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center mb-4">
                                        <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Weekly Pot &amp; Season Vault</h3>
                                    <p className="text-slate-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed">
                                        Weekly matchday stakes and end-of-season vaults are tracked down to the exact shilling. Payouts match official FPL scores with zero dispute or delay.
                                    </p>
                                </div>
                                <div className="sm:col-span-5">
                                    <div className="rounded-2xl p-4 bg-slate-50 dark:bg-[#0c1218] border border-emerald-200 dark:border-emerald-500/30 shadow-md dark:shadow-lg space-y-3 text-left font-sans">
                                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                <Shield className="w-3 h-3" /> M-Pesa Escrow Lock
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-500 dark:text-gray-400">GW5 Active</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-white dark:bg-black/40 border border-slate-200/80 dark:border-white/5 rounded-xl p-2.5 shadow-xs">
                                                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Weekly Pot</p>
                                                <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">KES 1,960</p>
                                            </div>
                                            <div className="bg-white dark:bg-black/40 border border-slate-200/80 dark:border-white/5 rounded-xl p-2.5 shadow-xs">
                                                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Season Vault</p>
                                                <p className="text-sm font-black text-amber-700 dark:text-amber-400 tabular-nums">KES 31,920</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-600 dark:text-gray-300 font-medium">
                                            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Auto Disbursal</span>
                                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">100% Precision</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Small Feature: Live FPL Sync */}
                        <div className="fc-landing-card md:col-span-4 bg-white dark:bg-gradient-to-br dark:from-[#161c24] dark:to-[#0f141a] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 dark:border-white/10 hover:border-indigo-500/30 transition-all relative overflow-hidden shadow-lg">
                            <div className="w-10 h-10 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center mb-4">
                                <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Live FPL Sync</h3>
                                <p className="text-slate-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                                    Direct integration with Official FPL APIs. Standings update automatically without manual spreadsheet entry.
                                </p>
                            </div>
                        </div>

                        {/* Feature: Chama WhatsApp Banter Slip */}
                        <div className="fc-landing-card md:col-span-6 bg-white dark:bg-gradient-to-br dark:from-[#18231c] dark:to-[#0f1814] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 dark:border-white/10 hover:border-emerald-500/35 transition-all relative overflow-hidden shadow-lg group">
                            <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center mb-4">
                                <Flame className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">WhatsApp Banter Slip</h3>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase">Instant Digest</span>
                                </div>
                                <p className="text-slate-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                                    Automated 1-tap post-matchday summary with authentic Kenyan Sheng. Highlights King of the Week, Mtu wa Chini (Wooden Spoon), Benched Regret, and Red Zone debt alerts across 3 customizable heat levels. Zero manual typing.
                                </p>
                            </div>
                        </div>

                        {/* Feature: Mid-Season Fair Buy-In Calculator */}
                        <div className="fc-landing-card md:col-span-6 bg-white dark:bg-gradient-to-br dark:from-[#1c1e28] dark:to-[#11131a] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 dark:border-white/10 hover:border-blue-500/35 transition-all relative overflow-hidden shadow-lg group">
                            <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/30 rounded-xl flex items-center justify-center mb-4">
                                <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Fair Buy-In Math</h3>
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase">Math Guaranteed</span>
                                </div>
                                <p className="text-slate-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                                    Want to invite a friend at Gameweek 10 or 15? The formula calculates their exact backdated share into the Season Vault so existing members aren't cheated. Generates a 1-tap WhatsApp invoice instantly.
                                </p>
                            </div>
                        </div>

                        {/* Kickbacks / Chairman Incentive */}
                        <div className="fc-landing-card md:col-span-6 bg-white dark:bg-gradient-to-br dark:from-[#191e24] dark:to-[#10151b] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 dark:border-white/10 hover:border-amber-500/30 transition-all relative overflow-hidden shadow-lg">
                            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center mb-4">
                                <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Chairman Commission</h3>
                                <p className="text-slate-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                                    Stop running your league for free. The platform routes an automatic 4% commission to the Chairman's wallet upon every gameweek settlement.
                                </p>
                            </div>
                        </div>

                        {/* Co-Chair Approval */}
                        <div className="fc-landing-card md:col-span-6 bg-white dark:bg-gradient-to-br dark:from-[#161f26] dark:to-[#0f151b] rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 dark:border-white/10 hover:border-emerald-500/30 transition-all relative overflow-hidden shadow-lg">
                            <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center mb-4">
                                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Co-Chair Verification</h3>
                                <p className="text-slate-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                                    Every payout and member status update requires sign-off from your designated Co-Chair. Two pairs of eyes ensure total peace of mind.
                                </p>
                            </div>
                        </div>

                        {/* 1v1 Side Bets & Victory Cards */}
                        <div className="fc-landing-card md:col-span-12 bg-white dark:bg-gradient-to-br dark:from-[#1c221a] dark:to-[#0f1614] rounded-3xl p-6 sm:p-8 md:p-10 flex flex-col justify-between border border-slate-200 dark:border-white/10 hover:border-amber-500/35 transition-all relative overflow-hidden group shadow-lg">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />
                            <div className="grid sm:grid-cols-12 gap-8 items-center relative z-10">
                                <div className="sm:col-span-7 space-y-4">
                                    <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center mb-4">
                                        <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">1v1 Side Bets &amp; Victory Cards</h3>
                                    <p className="text-slate-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
                                        Spectators can follow the league for free and challenge friends to head-to-head cash side bets. Generate verified Victory Cards to flex on WhatsApp Status.
                                    </p>
                                    <div className="pt-2">
                                        <button
                                            onClick={() => navigate('/setup')}
                                            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0a0e17] font-extrabold text-sm transition-all shadow-md shadow-amber-500/20 active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                                        >
                                            <span>Start a League Now</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="sm:col-span-5">
                                    <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-b from-amber-50/80 via-white to-amber-50/40 dark:from-[#1c221a] dark:to-[#0c1214] border-2 border-amber-300 dark:border-amber-500/40 shadow-lg dark:shadow-xl space-y-3.5 text-left font-sans">
                                        <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-white/10 pb-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-ping" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">1v1 Matchday Duel</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-[9px] font-black uppercase border border-amber-200 dark:border-transparent">
                                                KES 1,000 POT
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 items-center py-1">
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Brian Mwangi</p>
                                                <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums">74 pts</p>
                                                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300/80 uppercase">Leading 🔥</span>
                                            </div>
                                            <div className="space-y-1 text-right border-l border-amber-200/80 dark:border-white/10 pl-3">
                                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Kevin Otieno</p>
                                                <p className="text-lg font-black text-slate-700 dark:text-gray-300 tabular-nums">68 pts</p>
                                                <span className="text-[9px] font-bold text-slate-500 dark:text-gray-500 uppercase">-6 pts</span>
                                            </div>
                                        </div>

                                        <div className="w-full py-2 rounded-xl bg-amber-100/70 dark:bg-black/40 border border-amber-200 dark:border-white/10 text-slate-700 dark:text-gray-300 text-[10px] font-bold text-center flex items-center justify-center gap-1.5">
                                            <Lock className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                                            <span>M-Pesa Verified · Disburses at 90'</span>
                                        </div>
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
                            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">
                                Ditch the WhatsApp Chaos. <br />
                                <span className="text-emerald-600 dark:text-emerald-400">Run Your Chama Right.</span>
                            </h2>
                            <p className="text-slate-600 dark:text-gray-400 text-sm sm:text-base md:text-lg font-medium max-w-xl mx-auto">
                                Set up your league in 3 minutes. Automated M-Pesa tracking, live FPL sync, and instant winner payouts.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
                            <button onClick={() => navigate('/setup')} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-[#002113] px-8 py-4 rounded-xl font-extrabold text-base shadow-lg shadow-emerald-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 group cursor-pointer">
                                <Trophy className="w-4 h-4" />
                                <span>Start a League</span>
                                <span className="bg-[#002113] text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider border border-emerald-400/40">FREE</span>
                            </button>
                            <button onClick={() => navigate('/access')} className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#161d24] dark:hover:bg-[#1f2937] border border-slate-200 dark:border-white/10 transition-colors active:scale-95 text-slate-900 dark:text-white cursor-pointer">
                                Join With Code
                            </button>
                        </div>
                        <p className="text-slate-500 dark:text-gray-500 text-xs">No credit card needed · Free for all managers · Chairman earns 4% commission</p>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="fc-landing-footer w-full bg-slate-100 dark:bg-[#0a0e17] border-t border-slate-200 dark:border-white/5">
                <div className="flex flex-col sm:flex-row justify-between items-center px-4 sm:px-6 md:px-12 py-8 max-w-7xl mx-auto gap-4">
                    <div className="flex flex-wrap justify-center gap-5 sm:gap-8 text-xs font-medium text-slate-600 dark:text-gray-400">
                        <Link to="/privacy-policy" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Terms</Link>
                        <Link to="/faq" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">FAQ</Link>
                        <a href="mailto:support@fantasychama.co.ke" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Support</a>
                    </div>
                    <div className="text-slate-500 dark:text-gray-500 text-xs font-semibold text-center sm:text-right">
                        © 2026 Fantasy Chama. Built for Kenyan FPL leagues.
                    </div>
                </div>
            </footer>
        </div>
    );
}
