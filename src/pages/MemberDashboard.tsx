import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Trophy, BarChart3, Banknote, ShieldCheck, AlertCircle, CheckCircle2, Search, Zap } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import clsx from 'clsx';

export default function MemberDashboard() {
    const navigate = useNavigate();
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const memberPhone = localStorage.getItem('memberPhone');

    const [leagueName, setLeagueName] = useState('');
    const [monthlyContribution, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });
    const [isLoading, setIsLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState('');

    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    useEffect(() => {
        if (!activeLeagueId || !memberPhone) {
            navigate('/login');
            return;
        }

        // Setup real-time listener for the League document
        const leagueRef = doc(db, 'leagues', activeLeagueId);
        const unsubscribeLeague = onSnapshot(leagueRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLeagueName(data.leagueName || '');
                setMonthlyContribution(data.monthlyContribution || 0);
                if (data.rules) setRules(data.rules);
            }
        }, (err) => {
            console.error("Error listening to league:", err);
            navigate('/login');
        });

        // Initialize Live Ledger for Members
        listenToLeagueMembers(activeLeagueId);
        setIsLoading(false);

        return () => unsubscribeLeague();
    }, [activeLeagueId, memberPhone, navigate, listenToLeagueMembers]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    const handleNudgeAdmin = () => {
        showToast("Chairman Notified via Secure Channel");
    };

    // Derived Status
    const currentUser = members.find(m => m.phone === memberPhone);
    const hasPaid = currentUser?.hasPaid || false;

    // Dynamic Calculations
    const paidMembersCount = members.filter(m => m.hasPaid).length;
    const totalCollected = paidMembersCount * monthlyContribution;
    const weeklyPot = totalCollected * (rules.weekly / 100);
    const seasonVault = totalCollected * (rules.vault / 100);

    const mockWinnersTape = [
        { gw: 25, name: '@Kimani', points: 94, prize: '2,000 KES', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d' },
        { gw: 24, name: '@Omar', points: 102, prize: '2,000 KES', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' },
    ];

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#111613] text-[#22C55E] flex flex-col items-center justify-center font-bold tracking-widest uppercase">
                <Zap className="w-8 h-8 animate-pulse mb-4 text-[#22C55E]" />
                Initializing War Room...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#111613] text-white flex flex-col font-sans relative pb-28">

            {/* Toast Notification */}
            <div className={clsx(
                "fixed top-20 left-1/2 -translate-x-1/2 bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xl transition-all duration-300 pointer-events-none z-50",
                toastMessage ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
            )}>
                <CheckCircle2 className="w-5 h-5" /> {toastMessage}
            </div>

            {/* Top Navigation Frame */}
            <header className="flex items-center justify-between p-4 md:px-8 border-b border-white/5 bg-[#0a100a] z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-[#22C55E]/20 p-1.5 rounded-lg text-[#22C55E] shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M21 18v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1h-9a2 2 0 00-2 2v8a2 2 0 002 2h9zm-9-2h10V8H12v8zm4-2.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                        </svg>
                    </div>
                    <span className="font-bold text-[15px] tracking-tight text-white">{leagueName || "Fantasy Chama"}</span>
                </div>

                <div className="flex items-center gap-4">
                    <button className="relative bg-[#1a241c] p-2 rounded-full border border-white/5 text-gray-400 hover:text-white transition-colors">
                        <Bell className="w-4 h-4" />
                    </button>
                    <button className="bg-[#1a241c] p-2 rounded-full border border-white/5 text-gray-400 hover:text-white transition-colors overflow-hidden">
                        <div className="w-4 h-4 rounded-full bg-gray-500" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-8 flex flex-col items-center mt-4 space-y-6">

                {/* Personal Status Highlight */}
                {currentUser && (
                    <div className={clsx(
                        "w-full rounded-2xl p-5 border relative overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-500",
                        hasPaid ? "bg-[#22C55E]/5 border-[#22C55E]/20" : "bg-red-500/5 border-red-500/20"
                    )}>
                        <div className="flex justify-between items-center sm:items-start flex-col sm:flex-row gap-4">
                            <div>
                                <span className={clsx(
                                    "text-[10px] font-bold tracking-widest uppercase mb-1 flex items-center gap-1.5",
                                    hasPaid ? "text-[#22C55E]" : "text-red-400"
                                )}>
                                    <div className={clsx("w-1.5 h-1.5 rounded-full animate-pulse", hasPaid ? "bg-[#22C55E]" : "bg-red-500")} />
                                    Your Status
                                </span>
                                <h3 className="text-xl font-bold text-white tracking-tight">
                                    {hasPaid ? "Verified & Active" : "Action Required"}
                                </h3>
                                <p className="text-sm text-gray-400 mt-1 max-w-sm leading-snug">
                                    {hasPaid
                                        ? "Your M-Pesa contribution has been secured. You are eligible for this gameweek's pot."
                                        : "Your contribution for this gameweek is pending. Please complete your M-Pesa payment to the Chairman."}
                                </p>
                            </div>

                            {!hasPaid && (
                                <button
                                    onClick={handleNudgeAdmin}
                                    className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors whitespace-nowrap shadow-md flex items-center justify-center gap-2"
                                >
                                    <AlertCircle className="w-4 h-4" />
                                    I've Paid
                                </button>
                            )}
                        </div>

                        {/* Background structural graphic */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                            {hasPaid ? <ShieldCheck className="w-32 h-32" /> : <AlertCircle className="w-32 h-32" />}
                        </div>
                    </div>
                )}

                {/* Season End Vault & Active GW Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
                    {/* Season End Vault Card */}
                    <div className="bg-[#151c18] border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-lg hover:border-white/10 transition-colors">
                        <div className="absolute top-6 right-6 opacity-10">
                            <Banknote className="w-12 h-12" />
                        </div>
                        <p className="text-gray-400 text-[11px] font-bold tracking-widest uppercase mb-2 text-[#22C55E]">Season Vault</p>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
                                {seasonVault.toLocaleString()}
                            </span>
                            <span className="text-gray-500 text-sm font-bold">KES</span>
                        </div>
                        <div className="w-full bg-[#0a100a] h-1.5 rounded-full overflow-hidden border border-white/5 mt-4">
                            <div className="bg-[#22C55E] h-full transition-all duration-1000" style={{ width: '45%' }}></div>
                        </div>
                    </div>

                    {/* Active Gameweek Pot Card */}
                    <div className="bg-[#111f14] border border-[#FBBF24]/20 rounded-2xl p-6 relative overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.03)] hover:border-[#FBBF24]/40 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[#FBBF24] text-[11px] font-bold tracking-widest uppercase mb-1 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] shadow-[0_0_5px_rgba(251,191,36,1)]"></span>
                                Live Weekly Pot
                            </p>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
                                {weeklyPot.toLocaleString()}
                            </span>
                            <span className="text-[#FBBF24]/70 text-sm font-bold">KES</span>
                        </div>
                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mt-4">Ends in 14h 20m</p>
                    </div>
                </div>

                {/* The Transparency Ledger (Read-Only) */}
                <div className="w-full bg-[#151c18] border border-white/5 rounded-2xl shadow-xl overflow-hidden mt-4">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-[13px] font-bold text-white tracking-widest uppercase">
                            <Search className="w-4 h-4 text-gray-500" /> Transparency Ledger
                        </h4>
                        <span className="bg-[#111613] text-gray-400 text-[10px] font-bold px-2.5 py-1 rounded border border-white/5 uppercase tracking-widest">
                            {paidMembersCount} / {members.length} PAID
                        </span>
                    </div>

                    <div className="divide-y divide-white/5">
                        {members.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-xs font-bold uppercase tracking-widest">No members enrolled</div>
                        ) : members.map((member) => (
                            <div key={member.id} className={clsx(
                                "p-4 flex items-center justify-between transition-colors",
                                member.id === currentUser?.id ? "bg-white/[0.03]" : "hover:bg-white/[0.01]"
                            )}>
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-inner",
                                        member.hasPaid ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30" : "bg-red-500/10 text-red-500 border border-red-500/20 border-dashed"
                                    )}>
                                        {member.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-sm tracking-tight flex items-center gap-2">
                                            {member.displayName}
                                            {member.id === currentUser?.id && <span className="text-[9px] bg-[#1a241c] text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-widest border border-white/5 ml-1">You</span>}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">TRX-{member.id.substring(0, 6)}</div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className={clsx(
                                        "font-bold text-sm tracking-tight tabular-nums",
                                        member.hasPaid ? "text-[#10B981]" : "text-gray-500"
                                    )}>
                                        KES {monthlyContribution.toLocaleString()}
                                    </div>
                                    <div className={clsx(
                                        "text-[9px] font-bold uppercase tracking-widest mt-0.5",
                                        member.hasPaid ? "text-[#10B981]/70" : "text-red-500/70"
                                    )}>
                                        {member.hasPaid ? "Verified" : "Pending"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Previous Gameweek Winners */}
                <div className="w-full pt-4">
                    <h4 className="flex items-center gap-2 text-[12px] font-bold text-white uppercase tracking-widest mb-4">
                        <Trophy className="w-3.5 h-3.5 text-[#eab308]" /> Winner's Circle
                    </h4>

                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        {mockWinnersTape.map((winner, idx) => (
                            <div key={idx} className="bg-[#131b22] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center min-w-[140px] shrink-0 shadow-md">
                                <img src={winner.avatar} alt={winner.name} className="w-12 h-12 rounded-full border-2 border-[#eab308] p-0.5 mb-3 shadow-[0_0_10px_rgba(234,179,8,0.3)]" />
                                <span className="font-bold text-[14px] text-white tracking-wide">{winner.name}</span>
                                <span className="font-bold text-[13px] text-[#eab308] my-1 tracking-tight">{winner.prize}</span>
                                <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-1 bg-white/5 px-2 py-0.5 rounded">GW{winner.gw}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Bottom Floating Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0a100a] via-[#0a100a]/90 to-transparent flex justify-center z-30 pointer-events-none">
                <div className="flex gap-4 w-full max-w-2xl mx-auto pointer-events-auto">
                    <button className="flex-1 bg-[#22c55e] hover:bg-[#1fbb59] text-[#0a100a] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                        <Banknote className="w-5 h-5" /> Deposit (M-Pesa)
                    </button>
                    <button onClick={() => navigate('/standings')} className="flex-1 bg-[#161d24] hover:bg-white/10 border border-white/5 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md">
                        <BarChart3 className="w-5 h-5" /> Standings
                    </button>
                </div>
            </div>

        </div>
    );
}
