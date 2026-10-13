import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import clsx from 'clsx';
import { Trophy, ArrowRight, Shield, Zap, Lock, Banknote, Users, Smartphone, TrendingUp, CheckCircle2, Flame, MessageSquare, Calculator, Copy, Shirt, Swords, Sparkles, Share2 } from 'lucide-react';

// ─── Crisp, Zero-Scroll Animated Ledger Demo ────────────────────────────────
interface DemoMember {
    id: string;
    name: string;
    team: string;
    pts: number;
    status: 'funded' | 'spectator' | 'pending';
}

const initialDemoMembers: DemoMember[] = [
    { id: '1', name: 'Joel Sifuna', team: 'Sifuna Stars', pts: 85, status: 'funded' },
    { id: '2', name: 'Kevin Otieno', team: 'Nairobi Kings', pts: 72, status: 'funded' },
    { id: '3', name: 'Brian Mwangi', team: 'Safari Boys', pts: 65, status: 'funded' },
    { id: '4', name: 'Faith Cherono', team: 'Rift Valley FC', pts: 61, status: 'spectator' },
];

const demoPitchStarters = [
    { name: 'Raya', team: 'ARS', pos: 'GKP', pts: 6 },
    { name: 'Gabriel', team: 'ARS', pos: 'DEF', pts: 7 },
    { name: 'Saliba', team: 'ARS', pos: 'DEF', pts: 6 },
    { name: 'Gvardiol', team: 'MCI', pos: 'DEF', pts: 6 },
    { name: 'Palmer', team: 'CHE', pos: 'MID', pts: 10 },
    { name: 'Saka', team: 'ARS', pos: 'MID', pts: 8, isVice: true },
    { name: 'Mbeumo', team: 'BRE', pos: 'MID', pts: 9 },
    { name: 'L. Díaz', team: 'LIV', pos: 'MID', pts: 7 },
    { name: 'Haaland', team: 'MCI', pos: 'FWD', pts: 18, isCaptain: true },
    { name: 'Watkins', team: 'AVL', pos: 'FWD', pts: 8 },
];

const demoBench = [
    { name: 'Verbruggen', team: 'BHA', pts: 3 },
    { name: 'Robinson', team: 'FUL', pts: 2 },
    { name: 'Rogers', team: 'AVL', pts: 5 },
    { name: 'Smith Rowe', team: 'FUL', pts: 6 },
];

function LedgerDemo() {
    const [members, setMembers] = useState(initialDemoMembers);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'lineup' | 'standings' | 'banter' | 'victory'>('lineup');
    const [banterTone, setBanterTone] = useState<'street' | 'roast'>('street');
    const [copiedBanter, setCopiedBanter] = useState(false);
    const [copiedFlex, setCopiedFlex] = useState(false);

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
        const textToCopy = banterTone === 'street'
            ? `⚽ *NAIROBI ELITE CHAMA — GW5 SLIP* 🇰🇪\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 *KING WA ROUND:* Joel Sifuna (Sifuna Stars)\n└ 💥 *78 pts* · KES 1,960 M-Pesa Disbursed! 💸\n└ 🗣️ "Mlisema Haaland hawezi score away? Kuleni vumbi, sherehe ya chapo dondo iko Westlands!" 🍾\n\n🥔 *KIJIJI WOODEN SPOON:* David Ochieng (54 pts) 🥄\n└ 📉 Bro rudisha smartphone kwa duka ununue Mulika Mwizi!\n└ 🗣️ "Ku-triple captain defender wa Everton ni maombi ama uchawi?" 😭\n\n🤦 *BENCH CASUALTY:* Kevin Otieno\n└ 🪑 Amekalia 16 pts kwa subs zikioza kwa baridi! 🥶\n\n🚨 *RED ZONE (DENI LIST):*\n└ @Brian Mwangi wallet iko dry! Leta kakitu ya GW6 kabla deadline usitolewe kwa pot uwe spectator bure! ⏰\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔒 *M-Pesa Escrow Verified · Fantasy Chama*`
            : `🔥 *NAIROBI ELITE CHAMA — ROAST EDITION (GW5)* 🇰🇪\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 *TAJIRI WA WIKI:* Joel Sifuna (78 pts) 🏆\n└ KES 1,960 imeenda hivo safi kwa M-Pesa. Wengine mlikua mnaomba sare? Pole sana, chama haina huruma! 😂🍾\n\n🥔 *CHOKORA YA WIKI:* David Ochieng (54 pts) 🥄\n└ Hata goalkeeper wa Southampton angekushinda points hii round. Wacha kiburi, lipia fundi wa FPL! 💀📉\n\n🤦 *KIBURI YA SUBS:* Kevin Otieno (16 pts)\n└ Points ziliachwa nje zikinyeshewa. Unalipa starter zero, sub anafunga hat-trick? Akili ni nywele kweli? 🤡\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔒 *Disbursed via Fantasy Chama Escrow*`;
        navigator.clipboard?.writeText?.(textToCopy);
        setCopiedBanter(true);
        setTimeout(() => setCopiedBanter(false), 2000);
    };

    const copyFlexToClipboard = () => {
        const textToCopy = `🏆 *GW5 CHAMPION — SIFUNA STARS* 👑\n\nManager: Joel Sifuna\nScore: 78 pts (Rank #1)\nCash Won: KES 1,960 via M-Pesa ✅\n\n"Mlidhani mtachukua pesa yangu kirahisi? Hii trophy inalala kwangu leo. Tafuteni fundi wa points!" 😮‍💨🔥\n\nVerified by Fantasy Chama ⚽`;
        navigator.clipboard?.writeText?.(textToCopy);
        setCopiedFlex(true);
        setTimeout(() => setCopiedFlex(false), 2000);
    };

    return (
        <div className="fc-landing-card w-full rounded-3xl bg-white/95 dark:bg-[#0c1218]/95 border-2 border-emerald-500/25 overflow-hidden shadow-xl dark:shadow-[0_0_50px_rgba(16,185,129,0.12)] relative">
            {/* Ambient Lighting Orbs */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-44 h-44 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

            {/* Interactive Mode Tabs */}
            <div className="p-2 bg-slate-50/90 dark:bg-[#0e151c]/90 border-b border-slate-200/80 dark:border-white/5 relative z-10">
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/70 dark:bg-black/40 border border-slate-300/70 dark:border-white/10 rounded-xl backdrop-blur-md w-full">
                    <button
                        type="button"
                        onClick={() => setActiveTab('lineup')}
                        className={`w-full text-center py-1.5 px-1 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'lineup'
                                ? 'bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35 shadow-xs'
                                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-white/5'
                        }`}
                    >
                        ⚽ Lineup
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('standings')}
                        className={`w-full text-center py-1.5 px-1 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
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
                        className={`w-full text-center py-1.5 px-1 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'banter'
                                ? 'bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35 shadow-xs'
                                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-white/5'
                        }`}
                    >
                        🔥 Banter
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('victory')}
                        className={`w-full text-center py-1.5 px-1 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'victory'
                                ? 'bg-amber-600/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/35 shadow-xs'
                                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-white/5'
                        }`}
                    >
                        🏆 Flex
                    </button>
                </div>
            </div>

            {/* TAB 0: Real FPL Lineup & Matchday Pitch */}
            {activeTab === 'lineup' && (
                <div className="w-full flex flex-col justify-between animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-[#121920]/80 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                GW5 LIVE LINEUP
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <Sparkles className="w-3.5 h-3.5" />
                                Official FPL Sync
                            </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-0.5">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Joel Sifuna · Sifuna Stars</p>
                                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight flex items-center gap-2">
                                    85 <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">LIVE PTS 🔥</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-500/30">
                                    Rank #1 (+13 pts)
                                </span>
                                <p className="text-[10px] text-slate-600 dark:text-gray-300 font-semibold mt-0.5">
                                    Triple Captain: Haaland (36 pts)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Realistic FPL Pitch */}
                    <div className="p-3 bg-slate-50/40 dark:bg-[#0c1218]/70">
                        <div className="w-full rounded-2xl bg-gradient-to-b from-[#0a4524] via-[#08391d] to-[#062c16] border border-emerald-500/40 p-2.5 sm:p-3 relative overflow-hidden shadow-inner space-y-2">
                            {/* Faint Pitch Markings */}
                            <div className="absolute inset-0 pointer-events-none opacity-20">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-14 border border-white rounded-b-xl" />
                                <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-white rounded-full" />
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-14 border border-white rounded-t-xl" />
                            </div>

                            {/* GKP */}
                            <div className="flex justify-center relative z-10">
                                {demoPitchStarters.filter(p => p.pos === 'GKP').map(p => (
                                    <div key={p.name} className="flex flex-col items-center">
                                        <div className="relative">
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/90 border border-white/30 flex items-center justify-center text-slate-950 shadow-md">
                                                <Shirt className="w-4 h-4 text-slate-950" />
                                            </div>
                                        </div>
                                        <div className="bg-slate-950/90 border border-white/10 rounded px-1.5 py-0.5 mt-0.5 text-center min-w-[50px] shadow-xs">
                                            <p className="text-[9px] font-black text-white truncate leading-tight">{p.name}</p>
                                            <p className="text-[8.5px] font-black text-emerald-400 leading-none">{p.pts} pts</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* DEF */}
                            <div className="flex justify-center gap-2 sm:gap-4 relative z-10">
                                {demoPitchStarters.filter(p => p.pos === 'DEF').map(p => (
                                    <div key={p.name} className="flex flex-col items-center">
                                        <div className="relative">
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 border border-white/20 flex items-center justify-center text-white shadow-md">
                                                <Shirt className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                        <div className="bg-slate-950/90 border border-white/10 rounded px-1.5 py-0.5 mt-0.5 text-center min-w-[48px] shadow-xs">
                                            <p className="text-[9px] font-black text-white truncate leading-tight">{p.name}</p>
                                            <p className="text-[8.5px] font-black text-emerald-400 leading-none">{p.pts} pts</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* MID */}
                            <div className="flex justify-center gap-1.5 sm:gap-3 relative z-10">
                                {demoPitchStarters.filter(p => p.pos === 'MID').map(p => (
                                    <div key={p.name} className="flex flex-col items-center">
                                        <div className="relative">
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 border border-white/20 flex items-center justify-center text-white shadow-md">
                                                <Shirt className="w-4 h-4 text-white" />
                                            </div>
                                            {p.isVice && (
                                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black text-white border border-white/40 font-black text-[8px] flex items-center justify-center">
                                                    V
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-slate-950/90 border border-white/10 rounded px-1.5 py-0.5 mt-0.5 text-center min-w-[48px] shadow-xs">
                                            <p className="text-[9px] font-black text-white truncate leading-tight">{p.name}</p>
                                            <p className="text-[8.5px] font-black text-emerald-400 leading-none">{p.pts} pts</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* FWD */}
                            <div className="flex justify-center gap-3 sm:gap-6 relative z-10">
                                {demoPitchStarters.filter(p => p.pos === 'FWD').map(p => (
                                    <div key={p.name} className="flex flex-col items-center">
                                        <div className="relative">
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600 border border-white/20 flex items-center justify-center text-white shadow-md">
                                                <Shirt className="w-4 h-4 text-white" />
                                            </div>
                                            {p.isCaptain && (
                                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-950 font-black text-[8.5px] flex items-center justify-center shadow-xs ring-1 ring-amber-300">
                                                    C
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-slate-950/90 border border-white/10 rounded px-1.5 py-0.5 mt-0.5 text-center min-w-[52px] shadow-xs">
                                            <p className="text-[9px] font-black text-white truncate leading-tight">{p.name}</p>
                                            <p className="text-[8.5px] font-black text-emerald-400 leading-none">{p.pts} pts</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Substitutes Bench Bar */}
                        <div className="mt-2 p-2 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex items-center justify-between text-[10px]">
                            <span className="font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[9px] flex items-center gap-1">
                                <Shirt className="w-3 h-3 text-slate-400" /> Bench (16 pts):
                            </span>
                            <div className="flex items-center gap-2 font-mono">
                                {demoBench.map(b => (
                                    <span key={b.name} className="text-slate-700 dark:text-gray-300">
                                        {b.name} <strong className="text-emerald-600 dark:text-emerald-400">{b.pts}p</strong>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-[#121920]/90 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between text-xs text-slate-600 dark:text-gray-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300 text-[11px]">
                            <Trophy className="w-3 h-3 text-amber-500" />
                            Projected Prize: KES 1,960 M-Pesa Payout
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live FPL API Scoring
                        </span>
                    </div>
                </div>
            )}

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
                    <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-[#121920]/80 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                            🔥 Authentic Kenyan Banter Slip
                        </div>
                        {/* Tone Selector */}
                        <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-black/50 p-0.5 rounded-lg border border-slate-300 dark:border-white/10 text-[10px] font-black">
                            <button
                                type="button"
                                onClick={() => setBanterTone('street')}
                                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                                    banterTone === 'street'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                Street 🇰🇪
                            </button>
                            <button
                                type="button"
                                onClick={() => setBanterTone('roast')}
                                className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                                    banterTone === 'roast'
                                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                Roast 🔥
                            </button>
                        </div>
                    </div>

                    <div className="p-3 sm:p-4 flex-1 flex flex-col items-center justify-center">
                        {/* WhatsApp Chat Bubble Mockup */}
                        <div className="w-full rounded-2xl bg-[#0b141a] border border-[#202c33] p-3 sm:p-4 shadow-xl text-left font-sans text-xs relative overflow-hidden">
                            {/* Chat Group Header Bar */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 font-bold text-xs">
                                        FC
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-white flex items-center gap-1.5">
                                            <span>Chama Ya Mtaa (12)</span>
                                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                        </p>
                                        <p className="text-[9px] text-[#8696a0] font-medium">WhatsApp · Forwarded message</p>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-[#1f2c34] text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                                    ↩️ Forwarded
                                </span>
                            </div>

                            {/* WhatsApp Chat Message Balloon */}
                            <div className="bg-[#1f2c34] rounded-2xl rounded-tl-sm p-3 text-slate-100 border border-white/5 space-y-2 text-[11px] leading-relaxed shadow-sm font-sans">
                                <div className="font-bold text-emerald-400 flex items-center justify-between border-b border-white/10 pb-1">
                                    <span>⚽ NAIROBI ELITE CHAMA — GW5 SLIP 🇰🇪</span>
                                    <span className="text-[9px] text-[#8696a0] font-normal">21:42</span>
                                </div>

                                {banterTone === 'street' ? (
                                    <div className="space-y-1.5 text-[11px]">
                                        <p className="leading-snug">
                                            <span className="text-amber-300 font-bold">👑 KING WA ROUND:</span> <strong className="text-white">Joel Sifuna</strong> (Sifuna Stars)<br />
                                            └ 💥 <strong className="text-emerald-400">78 pts</strong> · <span className="text-emerald-300 font-bold">KES 1,960 M-Pesa Disbursed! 💸</span><br />
                                            <span className="text-[#aebac1] italic pl-2 block text-[10px]">
                                                "Mlisema Haaland hawezi score away? Kuleni vumbi, sherehe ya chapo dondo iko Westlands!" 🍾
                                            </span>
                                        </p>
                                        <p className="leading-snug">
                                            <span className="text-rose-400 font-bold">🥔 KIJIJI WOODEN SPOON:</span> <strong className="text-white">David Ochieng</strong> (54 pts) 🥄<br />
                                            └ 📉 Bro rudisha smartphone kwa duka ununue Mulika Mwizi!<br />
                                            <span className="text-[#aebac1] italic pl-2 block text-[10px]">
                                                "Ku-triple captain defender wa Everton ni maombi ama uchawi?" 😭
                                            </span>
                                        </p>
                                        <p className="leading-snug">
                                            <span className="text-cyan-300 font-bold">🤦 BENCH CASUALTY:</span> Kevin Otieno<br />
                                            └ 🪑 Amekalia <strong className="text-amber-300">16 pts</strong> kwa subs zikioza kwa baridi! 🥶
                                        </p>
                                        <p className="leading-snug text-amber-300">
                                            🚨 <strong>RED ZONE:</strong> @Brian Mwangi wallet iko dry! Leta kakitu ya GW6 kabla deadline usitolewe kwa pot uwe spectator bure! ⏰
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 text-[11px]">
                                        <p className="leading-snug">
                                            <span className="text-amber-300 font-bold">👑 TAJIRI WA WIKI:</span> <strong className="text-white">Joel Sifuna</strong> (78 pts) 🏆<br />
                                            └ KES 1,960 imeenda hivo safi kwa M-Pesa. Wengine mlikua mnaomba sare? Pole sana, chama haina huruma! 😂🍾
                                        </p>
                                        <p className="leading-snug">
                                            <span className="text-rose-400 font-bold">🥔 CHOKORA YA WIKI:</span> <strong className="text-white">David Ochieng</strong> (54 pts) 🥄<br />
                                            └ Hata goalkeeper wa Southampton angekushinda points hii round. Wacha kiburi, lipia fundi wa FPL! 💀📉
                                        </p>
                                        <p className="leading-snug">
                                            <span className="text-cyan-300 font-bold">🤦 KIBURI YA SUBS:</span> Kevin Otieno (16 pts)<br />
                                            └ Points ziliachwa nje zikinyeshewa. Unalipa starter zero, sub anafunga hat-trick? Akili ni nywele kweli? 🤡
                                        </p>
                                        <p className="leading-snug text-amber-300">
                                            🚨 <strong>KAMATI YA WALIPA DENI:</strong> Lipeni stake zenu kabla ya deadline. Chairman ameshika rungu! 👮‍♂️
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[9px] text-[#8696a0]">
                                    <span>🔒 Safaricom M-Pesa Escrow Verified</span>
                                    <span className="text-cyan-400 font-bold">✓✓ Read</span>
                                </div>
                            </div>

                            {/* WhatsApp Action Button */}
                            <button
                                type="button"
                                onClick={copyBanterToClipboard}
                                className="w-full mt-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1caa4f] text-[#0b141a] font-black text-xs transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{copiedBanter ? '✓ Copied to WhatsApp!' : 'Copy WhatsApp Banter Slip'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="px-4 py-2 bg-slate-50/90 dark:bg-[#121920]/90 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-600 dark:text-gray-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300">
                            <MessageSquare className="w-3 h-3 text-emerald-500" />
                            Real Kenyan Football Banter
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            Zero Generic AI Copy
                        </span>
                    </div>
                </div>
            )}

            {/* TAB 3: WhatsApp Victory Card */}
            {activeTab === 'victory' && (
                <div className="w-full flex flex-col justify-between animate-in fade-in duration-200">
                    <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-[#121920]/80 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                            🏆 WhatsApp Status Victory Card
                        </div>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            Verified Crown
                        </span>
                    </div>

                    <div className="p-3 sm:p-4 flex-1 flex flex-col items-center justify-center">
                        {/* Ultra-Crisp FIFA / EA FC Holographic Champion Victory Card */}
                        <div className="w-full rounded-2xl bg-gradient-to-br from-[#1a1202] via-[#0d1620] to-[#04120a] border-2 border-amber-400/80 p-4 sm:p-5 shadow-2xl text-left text-white relative overflow-hidden space-y-3">
                            {/* Subtle Gold Shimmer Overlay */}
                            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

                            {/* Card Header Ribbon */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-2 relative z-10">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
                                        <Trophy className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Matchday 5 Champion</p>
                                        <p className="text-xs font-black text-white">Fantasy Chama Official Crown</p>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Verified
                                </span>
                            </div>

                            {/* Champion Main Spotlight */}
                            <div className="flex items-center justify-between py-1 relative z-10">
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-lg border-2 border-amber-200">
                                            JS
                                        </div>
                                        <div>
                                            <h4 className="text-base sm:text-lg font-black text-white tracking-tight leading-none">
                                                Joel Sifuna
                                            </h4>
                                            <p className="text-[11px] font-semibold text-amber-300/90">
                                                Sifuna Stars FC ⚡
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-3xl sm:text-4xl font-black text-amber-400 tabular-nums tracking-tight leading-none">
                                        78 <span className="text-xs font-bold text-amber-200">PTS</span>
                                    </p>
                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">
                                        Rank #1 (Podium 👑)
                                    </span>
                                </div>
                            </div>

                            {/* Key Performers Chips */}
                            <div className="flex flex-wrap gap-1.5 relative z-10">
                                <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-bold text-slate-200">
                                    ⚡ Haaland (C): 26 pts
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-bold text-slate-200">
                                    🎯 Palmer: 18 pts
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-bold text-slate-200">
                                    🛡️ Gabriel: 9 pts
                                </span>
                            </div>

                            {/* M-Pesa Cash Disbursed Banner */}
                            <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border border-emerald-400/50 flex items-center justify-between relative z-10">
                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 block">
                                        M-Pesa Disbursed Winnings
                                    </span>
                                    <span className="text-lg sm:text-xl font-black text-emerald-300 tabular-nums">
                                        KES 1,960 CASH 💰
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] text-emerald-200 font-mono block">
                                        Ref: QM948210P
                                    </span>
                                    <span className="text-[9px] font-bold text-emerald-400">
                                        Instant 90' Payout
                                    </span>
                                </div>
                            </div>

                            {/* Mic-Drop Status Quote */}
                            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-[10.5px] text-amber-100/90 font-mono italic leading-relaxed relative z-10">
                                "Mlidhani mtachukua pesa yangu kirahisi? Hii trophy inalala kwangu leo. Tafuteni fundi wa points!" 😮‍💨🏆
                            </div>

                            {/* Action Button */}
                            <button
                                type="button"
                                onClick={copyFlexToClipboard}
                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer relative z-10"
                            >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>{copiedFlex ? '✓ Copied Victory Card!' : 'Share to WhatsApp Status'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="px-4 py-2 bg-slate-50/90 dark:bg-[#121920]/90 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-600 dark:text-gray-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300">
                            <Trophy className="w-3 h-3 text-amber-500" />
                            Verified Flex Card
                        </span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                            Ready for WhatsApp Status
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
    const [startGw, setStartGw] = useState(1);
    const [stakePerGw, setStakePerGw] = useState(1000);
    const [splitWeekly, setSplitWeekly] = useState(70); // 0 to 100% weekly winner pot
    const [isPilotMode, setIsPilotMode] = useState(true);

    // Sync with HQ global platform settings
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'platform_settings', 'global'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setIsPilotMode(data.isPilotMode !== false);
            }
        }, (err) => {
            console.warn('[landing] platform_settings listener error:', err);
        });
        return () => unsub();
    }, []);

    const remainingGws = Math.max(1, 38 - startGw + 1);
    const splitVault = 100 - splitWeekly; // remainder into season finale vault
    const potSize = numPlayers * stakePerGw;

    // Pilot Mode: 0% Platform HQ cut (100% pass-through). Net pot is 96% (4% Chairman fee).
    // Commercial Mode: 91% Net pot (4% Chairman, 3.5% Platform HQ, 1.5% M-Pesa Disbursals).
    const netPotPercent = isPilotMode ? 0.96 : 0.91;
    const netPot = potSize * netPotPercent;
    const weeklyWinnerPrize = Math.round(netPot * (splitWeekly / 100));
    const seasonVaultWeekly = Math.round(netPot * (splitVault / 100));
    const seasonVaultTotal = seasonVaultWeekly * remainingGws;

    const chairCut = potSize * 0.04;
    const hqCut = isPilotMode ? 0 : potSize * 0.035;
    const mpesaCut = isPilotMode ? 0 : potSize * 0.015;
    const adminCut = chairCut + hqCut + mpesaCut;

    const playersPercent = ((numPlayers - 2) / (50 - 2)) * 100;
    const startGwPercent = ((startGw - 1) / (38 - 1)) * 100;
    const stakePercent = Math.min(100, Math.max(0, ((stakePerGw - 50) / (3000 - 50)) * 100));

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
                        {isPilotMode
                            ? "Customize how much goes to the weekly matchday winner versus the season finale vault jackpot. 96% straight to managers in Pilot, 0% platform fee."
                            : "Customize how much goes to the weekly matchday winner versus the season finale vault jackpot. 91% straight to managers, 0 hidden deductions."}
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Controls: Players, Start GW & Stake */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Number of Managers */}
                        <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex flex-col justify-between">
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

                        {/* Starting Gameweek */}
                        <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                            <div className="flex justify-between items-end mb-2.5">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest block">Starting Gameweek</span>
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">{remainingGws} rounds to play</span>
                                </div>
                                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">GW {startGw}</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="38" 
                                step="1" 
                                value={startGw} 
                                onChange={(e) => setStartGw(Number(e.target.value))}
                                style={{
                                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${startGwPercent}%, var(--fc-slider-track) ${startGwPercent}%, var(--fc-slider-track) 100%)`
                                }}
                                className="fc-range w-full h-2 rounded-full appearance-none cursor-pointer transition-all"
                                aria-label="Starting Gameweek"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-gray-500 mt-1.5 font-semibold">
                                <span>GW 1 (Season Start)</span><span>GW 38 (Finale)</span>
                            </div>
                        </div>

                        {/* Stake per Gameweek: KES 50 - KES 3,000 */}
                        <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                            <div className="flex justify-between items-end mb-2.5">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">Stake per Gameweek</span>
                                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">KES {stakePerGw.toLocaleString()}</span>
                            </div>
                            <input 
                                type="range" 
                                min="50" 
                                max="3000" 
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
                                <span>KES 50</span><span>KES 3,000</span>
                            </div>
                        </div>
                    </div>

                    {/* Total Pool Banner & Mode Switch */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-[#121920] border border-slate-200 dark:border-white/5">
                        <div>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest block">Total Collected Per GW</span>
                            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">KES {potSize.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">
                                    Net Manager Pot ({isPilotMode ? '96% Pilot' : '91%'})
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    KES {Math.round(netPot).toLocaleString()}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPilotMode(prev => !prev)}
                                className={clsx(
                                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer shrink-0",
                                    isPilotMode 
                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                                )}
                                title="Toggle between Pilot (0% Platform Fee) and Commercial Mode"
                            >
                                {isPilotMode ? "🚀 Pilot (0% HQ Fee)" : "💼 Commercial (Paybill Active)"}
                            </button>
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
                                    { label: 'All to Vault (100%)', val: 0 },
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

                        {/* Split Bar Track Visual - Single Interactive Dual-Fill Bar */}
                        <div className="space-y-2.5">
                            <div className="flex justify-between items-center text-xs font-black">
                                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                    <Trophy className="w-3.5 h-3.5" /> Weekly Winner: {splitWeekly}%
                                </span>
                                <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5" /> Season Vault: {splitVault}%
                                </span>
                            </div>

                            {/* Single Dual-Color Range Slider Bar */}
                            <div className="relative py-1">
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
                                    className="fc-range w-full h-3 sm:h-3.5 rounded-full appearance-none cursor-pointer transition-all shadow-inner border border-slate-300 dark:border-white/20"
                                    aria-label="Split between weekly pot and season vault"
                                />
                            </div>

                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-gray-400 font-semibold px-0.5">
                                <button type="button" onClick={() => setSplitWeekly(0)} className="hover:text-amber-500 transition-colors cursor-pointer">
                                    0% Weekly (100% Vault)
                                </button>
                                <button type="button" onClick={() => setSplitWeekly(50)} className="hover:text-emerald-500 transition-colors cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                                    50 / 50 Balanced
                                </button>
                                <button type="button" onClick={() => setSplitWeekly(100)} className="hover:text-emerald-500 transition-colors cursor-pointer">
                                    100% Weekly (No Vault)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Weekly Winner Prize Card */}
                        <div className={`md:col-span-4 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-all ${
                            splitWeekly > 0 
                                ? 'bg-emerald-500/10 border-2 border-emerald-500/35' 
                                : 'bg-slate-100/70 dark:bg-white/[0.03] border-2 border-slate-200 dark:border-white/10 opacity-70'
                        }`}>
                            <div>
                                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Weekly Winner ({splitWeekly}%)
                                </p>
                                <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                                    KES {weeklyWinnerPrize.toLocaleString()}
                                </p>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-gray-400 mt-2 font-medium">
                                {splitWeekly === 0 
                                    ? 'No weekly prize. 100% of collected stakes accumulate into the Season Finale Vault!' 
                                    : 'Sent to the top gameweek manager every single round via M-Pesa.'}
                            </p>
                        </div>

                        {/* Season Vault Pool Card */}
                        <div className={`md:col-span-4 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-all ${
                            splitVault > 0 
                                ? 'bg-amber-500/10 border-2 border-amber-500/40' 
                                : 'bg-slate-100/70 dark:bg-white/[0.03] border-2 border-slate-200 dark:border-white/10 opacity-70'
                        }`}>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Season Vault ({splitVault}%)
                                    </p>
                                    {splitVault > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-800 dark:text-amber-300 text-[9px] font-black uppercase tracking-wider">
                                            {remainingGws} GWs ESCROW (GW {startGw} – 38)
                                        </span>
                                    )}
                                </div>
                                <p className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-400 tabular-nums">
                                    KES {seasonVaultWeekly.toLocaleString()} <span className="text-xs font-bold text-amber-700 dark:text-amber-300">/ GW</span>
                                </p>
                            </div>
                            <div className="mt-2.5 pt-2 border-t border-amber-500/20">
                                {splitVault > 0 ? (
                                    <>
                                        <p className="text-xs text-slate-700 dark:text-gray-300 font-semibold leading-relaxed">
                                            Locked in escrow. Grows to <strong className="text-amber-800 dark:text-amber-300 font-black text-sm">KES {seasonVaultTotal.toLocaleString()}</strong> across {remainingGws} GWs for podium winners!
                                        </p>
                                        <p className="text-[10.5px] text-amber-800/80 dark:text-amber-400/80 font-mono font-medium mt-1">
                                            (KES {seasonVaultWeekly.toLocaleString()} / GW × {remainingGws} GWs = KES {seasonVaultTotal.toLocaleString()} Grand Jackpot)
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-slate-500 dark:text-gray-400 italic font-medium">
                                        0% to Season Vault — 100% of the pot is paid out to weekly winners each round.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Ops & Chairman Fee Card */}
                        <div className="md:col-span-4 bg-slate-50 dark:bg-[#161d24] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                            <div>
                                <p className="text-[10px] font-black text-slate-700 dark:text-gray-300 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Banknote className="w-3.5 h-3.5 text-slate-600 dark:text-gray-400" /> Ops &amp; Chairman ({isPilotMode ? '4% Pilot' : '9%'})
                                </p>
                                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                                    KES {Math.round(adminCut).toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-200 dark:border-white/5 text-[11px] text-slate-600 dark:text-gray-400">
                                <div className="flex justify-between font-medium">
                                    <span>Chairman Fee (4%)</span>
                                    <span className="text-slate-900 dark:text-white font-bold">KES {Math.round(chairCut).toLocaleString()}</span>
                                </div>
                                {isPilotMode ? (
                                    <>
                                        <div className="flex justify-between font-medium text-amber-600 dark:text-amber-400">
                                            <span>Platform HQ Fee</span>
                                            <span className="font-bold">0% (Waived in Pilot 🚀)</span>
                                        </div>
                                        <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
                                            <span>M-Pesa Disbursals</span>
                                            <span className="font-bold">Direct P2P Pass-Through</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between font-medium">
                                            <span>Platform HQ (3.5%)</span>
                                            <span className="text-slate-900 dark:text-white font-bold">KES {Math.round(hqCut).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between font-medium">
                                            <span>M-Pesa Disbursals (1.5%)</span>
                                            <span className="text-slate-900 dark:text-white font-bold">KES {Math.round(mpesaCut).toLocaleString()}</span>
                                        </div>
                                    </>
                                )}
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
                    <div className="flex space-x-6 sm:space-x-8 items-center text-xs sm:text-sm">
                        <a href="#how-it-works" className="fc-landing-nav-link text-slate-600 dark:text-[#DFE2EF] opacity-80 hover:opacity-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium tracking-wide">How It Works</a>
                        <a href="#features" className="fc-landing-nav-link text-slate-600 dark:text-[#DFE2EF] opacity-80 hover:opacity-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium tracking-wide">Features</a>
                        <Link to="/terms" className="fc-landing-nav-link text-slate-600 dark:text-[#DFE2EF] opacity-80 hover:opacity-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium tracking-wide">Terms</Link>
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
                <section id="features" className="fc-landing-section py-10 sm:py-14 md:py-16 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 relative z-20">
                    <div className="mb-8 sm:mb-10 text-center sm:text-left">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1.5 block">Built for Kenyan FPL Leagues</span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Platform Features</h2>
                        <div className="w-10 h-1 bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full mx-auto sm:mx-0" />
                    </div>
                    
                    {/* Compact, Fast-to-Scan Features Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-8 sm:mb-10">
                        {/* 1. Automated M-Pesa Vault */}
                        <div className="fc-landing-card bg-white dark:bg-[#111822] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 transition-all shadow-md group">
                            <div className="w-9 h-9 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center mb-3 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                                <Lock className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1.5">Automated M-Pesa Vault</h3>
                            <p className="text-slate-600 dark:text-gray-400 text-xs leading-relaxed">
                                Transparent pot distribution straight to winners. Payouts calculate down to the shilling with zero manual Excel headaches.
                            </p>
                        </div>

                        {/* 2. Live FPL API & Lineups */}
                        <div className="fc-landing-card bg-white dark:bg-[#111822] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 hover:border-indigo-500/40 transition-all shadow-md group">
                            <div className="w-9 h-9 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                                <Zap className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1.5">Live FPL Lineups &amp; Scores</h3>
                            <p className="text-slate-600 dark:text-gray-400 text-xs leading-relaxed">
                                Direct official API sync. Goals, assists, bonus points, captain multipliers, and auto-subs in real-time.
                            </p>
                        </div>

                        {/* 3. WhatsApp Banter Slip */}
                        <div className="fc-landing-card bg-white dark:bg-[#111822] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 hover:border-amber-500/40 transition-all shadow-md group">
                            <div className="w-9 h-9 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center mb-3 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                                <Flame className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1.5">WhatsApp Banter Slips</h3>
                            <p className="text-slate-600 dark:text-gray-400 text-xs leading-relaxed">
                                Automated 1-tap post-matchday digest in authentic Sheng. Roasts the wooden spoon and crowns the weekly king.
                            </p>
                        </div>

                        {/* 4. Co-Chair Verification */}
                        <div className="fc-landing-card bg-white dark:bg-[#111822] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 transition-all shadow-md group">
                            <div className="w-9 h-9 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center mb-3 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                                <Shield className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1.5">Co-Chair Dual Signatory</h3>
                            <p className="text-slate-600 dark:text-gray-400 text-xs leading-relaxed">
                                Maker/Checker protocol ensures payouts require dual sign-off. Zero solo chairman tampering.
                            </p>
                        </div>

                        {/* 5. Fair Mid-Season Buy-In */}
                        <div className="fc-landing-card bg-white dark:bg-[#111822] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 hover:border-blue-500/40 transition-all shadow-md group">
                            <div className="w-9 h-9 bg-blue-500/15 border border-blue-500/30 rounded-xl flex items-center justify-center mb-3 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                                <Calculator className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1.5">Fair Mid-Season Buy-Ins</h3>
                            <p className="text-slate-600 dark:text-gray-400 text-xs leading-relaxed">
                                Mathematically backdated vault catch-up so late friends can join anytime without cheating existing members.
                            </p>
                        </div>

                        {/* 6. Chairman Commission */}
                        <div className="fc-landing-card bg-white dark:bg-[#111822] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 hover:border-amber-500/40 transition-all shadow-md group">
                            <div className="w-9 h-9 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center mb-3 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                                <Trophy className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1.5">Chairman 4% Commission</h3>
                            <p className="text-slate-600 dark:text-gray-400 text-xs leading-relaxed">
                                Stop running leagues for free. Automated 4% organizer reward routed to the Chairman's wallet each round.
                            </p>
                        </div>
                    </div>

                    {/* 1v1 Side Bets & Victory Cards - Crisp, High-Contrast Showcase */}
                    <div className="fc-landing-card bg-gradient-to-br from-slate-900 via-[#0d1620] to-slate-950 dark:from-[#0a1018] dark:to-[#05080c] rounded-3xl p-6 sm:p-8 md:p-10 border-2 border-amber-500/30 shadow-2xl relative overflow-hidden text-white">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
                        
                        <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
                            {/* Left Column: Straight to the point pitch */}
                            <div className="lg:col-span-6 space-y-4 text-center lg:text-left">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                                    <Swords className="w-3.5 h-3.5 text-amber-400" />
                                    1v1 Cash Duels &amp; Spectator Mode
                                </div>
                                <h3 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                                    1v1 Side Bets &amp; <br />
                                    <span className="text-amber-400">WhatsApp Flex Cards</span>
                                </h3>
                                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-md mx-auto lg:mx-0">
                                    Spectators join for free and challenge friends to instant head-to-head matchday cash duels. Winner takes the pot straight to M-Pesa, with verified flex cards ready for WhatsApp Status.
                                </p>
                                
                                <div className="space-y-2 pt-1 text-xs text-slate-300 font-semibold max-w-md mx-auto lg:mx-0 text-left">
                                    <p className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span>Free for spectators · Zero season chama dues required</span>
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span>Safaricom M-Pesa escrow lock · Instant 90' full-time payout</span>
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span>Auto-generated verified victory cards to flex on WhatsApp</span>
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={() => navigate('/setup')}
                                        className="px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-400/20 active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                                    >
                                        <span>Start a League or Duel</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Cute, Cool, Ultra-Readable Duel Widget */}
                            <div className="lg:col-span-6 w-full max-w-md mx-auto">
                                <div className="rounded-3xl bg-slate-950/90 dark:bg-black/80 border-2 border-amber-400/50 p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md space-y-4">
                                    {/* Top Header */}
                                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                                                1v1 Matchday Duel
                                            </span>
                                        </div>
                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                            KES 1,000 POT 💰
                                        </span>
                                    </div>

                                    {/* Head-to-Head Arena */}
                                    <div className="grid grid-cols-11 gap-1 items-center py-2">
                                        {/* Left Contender */}
                                        <div className="col-span-5 space-y-1 text-left">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] font-black flex items-center justify-center shrink-0">
                                                    BM
                                                </div>
                                                <p className="text-xs font-black text-white truncate">Brian Mwangi</p>
                                            </div>
                                            <p className="text-3xl font-black text-emerald-400 tabular-nums">74 <span className="text-xs text-emerald-300 font-bold">pts</span></p>
                                            <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase">
                                                Leading 🔥 (+6)
                                            </span>
                                        </div>

                                        {/* VS Lightning Center */}
                                        <div className="col-span-1 flex justify-center">
                                            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 text-xs font-black flex items-center justify-center shadow-md">
                                                VS
                                            </div>
                                        </div>

                                        {/* Right Contender */}
                                        <div className="col-span-5 space-y-1 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <p className="text-xs font-black text-white truncate">Kevin Otieno</p>
                                                <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-500 text-slate-200 text-[10px] font-black flex items-center justify-center shrink-0">
                                                    KO
                                                </div>
                                            </div>
                                            <p className="text-3xl font-black text-slate-200 tabular-nums">68 <span className="text-xs text-slate-400 font-bold">pts</span></p>
                                            <span className="inline-block px-2 py-0.5 rounded bg-white/10 border border-white/20 text-slate-300 text-[9px] font-bold uppercase">
                                                Haaland left ⚡
                                            </span>
                                        </div>
                                    </div>

                                    {/* Banter Snippet */}
                                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] text-amber-200/90 font-mono italic leading-relaxed">
                                        "Weka KES 1,000! Haaland akifunga leo unanilipa before final whistle 🤝"
                                    </div>

                                    {/* M-Pesa Security Footer */}
                                    <div className="w-full py-2 px-3 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-bold text-center flex items-center justify-center gap-1.5">
                                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                                        <span>M-Pesa Escrow Verified · Auto-Disbursed at 90' whistle</span>
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

                        <div className="flex justify-center items-center pt-2">
                            <button onClick={() => navigate('/setup')} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-[#002113] px-8 py-4 rounded-xl font-extrabold text-base shadow-lg shadow-emerald-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 group cursor-pointer">
                                <Trophy className="w-4 h-4" />
                                <span>Start a League</span>
                                <span className="bg-[#002113] text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider border border-emerald-400/40">FREE</span>
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
