import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Trophy, BarChart3, Banknote, ShieldCheck, AlertCircle, Search, Zap, Check, Star } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import clsx from 'clsx';

export default function MemberDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const memberPhone = localStorage.getItem('memberPhone');

    const [leagueName, setLeagueName] = useState('');
    const [monthlyContribution, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });
    const [isLoading, setIsLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState('');
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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

        if (location.state?.welcomeMsg) {
            setToastMessage(location.state.welcomeMsg);
            setTimeout(() => setToastMessage(''), 4000);
            window.history.replaceState({}, document.title);
        }

        return () => unsubscribeLeague();
    }, [activeLeagueId, memberPhone, navigate, listenToLeagueMembers, location.state]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    const handleNudgeAdmin = () => {
        showToast("Chairman Notified via Secure Channel");
    };

    const currentUser = members.find(m => m.phone === memberPhone);
    const hasPaid = currentUser?.hasPaid || false;
    const activeUserId = currentUser?.id || 'dummy';
    const avatarSeed = (currentUser as any)?.avatarSeed || currentUser?.displayName || 'default';

    // Dynamic Calculations
    const paidMembersCount = members.filter(m => m.hasPaid).length;
    const totalCollected = paidMembersCount * monthlyContribution;
    const weeklyPot = totalCollected * (rules.weekly / 100);
    const seasonVault = totalCollected * (rules.vault / 100);
    const projectedVault = members.length * monthlyContribution * 38 * (rules.vault / 100);

    useEffect(() => {
        if (!activeLeagueId || activeUserId === 'dummy') return;
        const memberNotificationsRef = collection(db, 'leagues', activeLeagueId, 'memberships', activeUserId, 'notifications');
        const q = query(memberNotificationsRef, orderBy('createdAt', 'desc'), limit(15));
        const unsubscribe = onSnapshot(q, (snap) => {
            const notifs = snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    text: data.text,
                    read: data.read,
                    time: data.createdAt ? new Date(data.createdAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'
                };
            });
            setNotifications(notifs);
        });
        return () => unsubscribe();
    }, [activeLeagueId, activeUserId]);

    const mockWinnersTape = [
        { gw: 25, id: 'user-id-here', name: '@Kimani', points: 94, prize: '2,000 KES', avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=kimani&backgroundColor=transparent' },
        { gw: 24, id: activeUserId, name: currentUser?.displayName || '@Me', points: 102, prize: '2,000 KES', avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed}&backgroundColor=transparent` },
    ];

    // Determine if user is a recent winner
    const isRecentWinner = mockWinnersTape.some(w => w.name === currentUser?.displayName || w.name === '@Me');

    // Dynamic Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0b1014] text-[#10B981] flex flex-col items-center justify-center font-bold tracking-widest uppercase">
                <Zap className="w-8 h-8 animate-pulse mb-4 text-[#10B981]" />
                Initializing War Room...
            </div>
        );
    }

    return (
        <div className={clsx(
            "min-h-[100dvh] text-white flex flex-col font-sans relative pb-28 w-full overflow-x-hidden transition-colors duration-1000",
            hasPaid ? "bg-[#0b1014]" : "bg-gradient-to-br from-[#0b1014] to-[#2a0808]"
        )}>
            {/* Background Element */}
            <div className="fixed right-[-10%] bottom-[-10%] w-[600px] h-[600px] opacity-20 pointer-events-none z-0">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <path fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" d="M10,100 L190,100 M100,10 L100,190 M30,30 L170,170 M30,170 L170,30" />
                    <circle cx="10" cy="100" r="1.5" fill="rgba(255,255,255,0.3)" />
                    <circle cx="190" cy="100" r="1.5" fill="rgba(255,255,255,0.3)" />
                    <circle cx="100" cy="10" r="1.5" fill="rgba(255,255,255,0.3)" />
                    <circle cx="100" cy="190" r="1.5" fill="rgba(255,255,255,0.3)" />
                    <circle cx="100" cy="100" r="3" fill="rgba(255,255,255,0.5)" />
                </svg>
            </div>

            {/* Toast Notification */}
            <div className={clsx(
                "fixed top-20 left-1/2 -translate-x-1/2 bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] px-5 py-3 rounded-xl text-xs md:text-sm font-bold flex items-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all duration-500 pointer-events-none z-50",
                toastMessage ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
            )}>
                <Check className="w-5 h-5 bg-[#10B981]/20 rounded-full p-0.5" /> {toastMessage}
            </div>

            {/* Top Navigation Frame */}
            <header className="flex items-center justify-between p-4 md:px-8 border-b border-white/5 bg-[#0b1014]/80 backdrop-blur-md sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <div className="bg-[#10B981] p-1.5 md:p-2 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <div className="w-4 h-4 md:w-5 md:h-5 border-[2.5px] border-[#0b1014] rounded-md flex items-center justify-center relative">
                            <div className="w-1.5 h-1.5 bg-[#0b1014] rounded-sm absolute right-0.5"></div>
                        </div>
                    </div>
                    <span className="font-extrabold text-lg md:text-xl tracking-wide">{leagueName || "Fantasy Chama"}</span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <button
                            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                            className="relative bg-[#161d24] p-2 md:p-2.5 rounded-full border border-white/5 text-gray-400 hover:text-white transition-colors z-[101]"
                        >
                            <Bell className="w-4 h-4 md:w-5 md:h-5" />
                            {notifications.filter(n => !n.read).length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#10B981] text-[#0d1316] text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-[#0b1014] animate-pulse">
                                    {notifications.filter(n => !n.read).length}
                                </span>
                            )}
                        </button>

                        {/* Notifications Dropdown Container */}
                        {isNotificationsOpen && (
                            <>
                                {/* Backdrop Blur */}
                                <div
                                    className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
                                    onClick={() => setIsNotificationsOpen(false)}
                                ></div>

                                {/* Dropdown Panel */}
                                <div className="absolute right-0 top-full mt-4 w-80 md:w-96 bg-[#161d24] border border-white/5 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#11171a]">
                                        <h3 className="text-white font-bold text-sm tracking-tight">War Room Intel</h3>
                                        <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} className="text-[10px] uppercase font-bold text-[#10B981] hover:text-[#10B981]/80 transition-colors">Mark all read</button>
                                    </div>
                                    <div className="max-h-[22rem] overflow-y-auto custom-scrollbar">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center text-xs text-gray-500 font-medium">No alerts today.</div>
                                        ) : notifications.map(notif => (
                                            <div key={notif.id} className={clsx("p-4 border-b border-white/5 flex gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer", !notif.read && "bg-[#10B981]/5")}>
                                                <div className="w-2 h-2 rounded-full bg-[#10B981] mt-1.5 flex-shrink-0"></div>
                                                <div>
                                                    <p className={clsx("text-sm", notif.read ? "text-gray-400" : "text-white font-medium")}>{notif.text}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{notif.time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className={clsx(
                        "w-10 h-10 md:w-12 md:h-12 rounded-full p-[2px] transition-all",
                        isRecentWinner ? "bg-gradient-to-tr from-[#FBBF24] to-[#fde047] shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse" : "bg-gradient-to-tr from-[#10B981] to-[#047857]"
                    )}>
                        <img
                            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed}&backgroundColor=transparent`}
                            alt="Avatar"
                            className="w-full h-full object-cover rounded-full bg-[#0b1014]"
                        />
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col mt-2 md:mt-4 space-y-6 z-10 relative">

                {/* Greeting */}
                <div className="flex flex-col mb-2">
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                        {greeting}, <span className="text-[#10B981]">{currentUser?.displayName?.split(' ')[0] || 'Manager'}</span>!
                    </h1>
                    <p className="text-gray-400 text-sm md:text-base tracking-wide mt-1">
                        Welcome back to the War Room. The vault is active.
                    </p>
                </div>

                {/* Personal Status Highlight */}
                {currentUser && (
                    <div className={clsx(
                        "w-full rounded-[2rem] p-6 border relative overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-500",
                        isRecentWinner ? "bg-[#1c272c] border-[#FBBF24]/50 shadow-[0_0_40px_rgba(251,191,36,0.15)]" : (hasPaid ? "bg-[#22C55E]/5 border-[#22C55E]/20" : "bg-red-500/5 border-red-500/20")
                    )}>
                        {isRecentWinner && (
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#FBBF24] to-transparent"></div>
                        )}
                        <div className="flex justify-between items-center sm:items-start flex-col sm:flex-row gap-4">
                            <div className="w-full">
                                <div className="flex justify-between items-center w-full mb-1">
                                    <span className={clsx(
                                        "text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5",
                                        hasPaid ? "text-[#10B981]" : "text-red-400"
                                    )}>
                                        <div className={clsx("w-1.5 h-1.5 rounded-full animate-pulse", hasPaid ? "bg-[#10B981]" : "bg-red-500")} />
                                        Your Gameweek Status
                                    </span>
                                </div>
                                <h3 className={clsx("text-xl md:text-2xl font-black tracking-tight mb-2", isRecentWinner ? "text-[#FBBF24]" : "text-white")}>
                                    {isRecentWinner ? "Champion of the Week 🏆" : (hasPaid ? "Verified & Active" : "Action Required")}
                                </h3>
                                <p className="text-sm md:text-base text-gray-400 leading-snug">
                                    {isRecentWinner
                                        ? "Incredible performance! You secured the highest points in the last Gameweek. Your vault payout is processing."
                                        : (hasPaid
                                            ? "Your M-Pesa contribution has been secured. You are eligible for this gameweek's pot payout."
                                            : "Your contribution for this gameweek is missing. Ensure your M-Pesa clears before the FPL deadline.")}
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
                        <div className="absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none">
                            {isRecentWinner ? <Trophy className="w-40 h-40 text-[#FBBF24] opacity-20" /> : (hasPaid ? <ShieldCheck className="w-32 h-32" /> : <AlertCircle className="w-32 h-32" />)}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full mt-4">
                    <div className="xl:col-span-8 flex flex-col gap-6 w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 w-full">
                            {/* Active Gameweek Pot Card */}
                            <div className="bg-gradient-to-br from-[#1c272c] to-[#11171a] border border-[#FBBF24]/30 rounded-[2rem] p-6 md:p-8 relative overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.08)] hover:border-[#FBBF24]/50 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-10 blur-[20px] pointer-events-none">
                                    <div className="w-32 h-32 bg-[#FBBF24] rounded-full"></div>
                                </div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <p className="text-[#FBBF24] text-[10px] md:text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#FBBF24] shadow-[0_0_8px_rgba(251,191,36,1)] animate-pulse"></span>
                                        Live Weekly Pot
                                    </p>
                                </div>
                                <div className="flex flex-col relative z-10">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-4xl md:text-5xl font-black text-white tracking-tight tabular-nums">
                                            {weeklyPot.toLocaleString()}
                                        </span>
                                        <span className="text-[#FBBF24] text-sm md:text-base font-bold">KES</span>
                                    </div>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-2">{rules.weekly}% Distribution</p>
                                </div>
                            </div>

                            {/* Season End Vault Card */}
                            <div className="bg-[#161d24] border border-[#10B981]/10 rounded-[2rem] p-6 md:p-8 relative overflow-hidden shadow-lg hover:border-[#10B981]/30 transition-colors flex flex-col justify-between">
                                <div className="absolute top-6 right-6 opacity-[0.03]">
                                    <Banknote className="w-24 h-24" />
                                </div>
                                <div>
                                    <p className="text-[#10B981] text-[10px] md:text-xs font-bold tracking-widest uppercase mb-4">Season Vault</p>
                                    <div className="flex flex-col mb-4">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl md:text-4xl font-black text-white tracking-tight tabular-nums">
                                                {projectedVault.toLocaleString()}
                                            </span>
                                            <span className="text-gray-500 text-sm font-bold">KES</span>
                                        </div>
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mt-1">Projected end of season</p>
                                    </div>
                                </div>
                                <div className="w-full bg-[#0b1014] h-1.5 md:h-2 rounded-full overflow-hidden border border-white/5 mt-auto">
                                    <div className="bg-[#10B981] h-full transition-all duration-1000" style={{ width: '45%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Notifications Feed */}
                        <div className="w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl p-6 md:p-8">
                            <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                                <Bell className="w-4 h-4" /> Operations Feed
                            </h4>
                            <div className="space-y-4">
                                <div className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center shrink-0">
                                        <BarChart3 className="w-5 h-5 text-[#10B981]" />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-white tracking-wide">Gameweek 25 Calculated</h5>
                                        <p className="text-xs text-gray-400 mt-1">You scored 85 pts this week, beating the league average of 54.2 pts.</p>
                                        <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-2 block">2 Hours Ago</span>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-[#FBBF24]/10 border border-[#FBBF24]/20 flex items-center justify-center shrink-0">
                                        <Trophy className="w-5 h-5 text-[#FBBF24]" />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-white tracking-wide">Payout Dispatched</h5>
                                        <p className="text-xs text-gray-400 mt-1">KES 2,000 has been secured to Kimani for winning GW 24.</p>
                                        <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-2 block">Yesterday</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-4 w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[600px]">
                        <div className="p-6 md:p-8 border-b border-white/5 flex flex-col justify-between gap-2 bg-[#0b1014]/50">
                            <div>
                                <h4 className="flex items-center gap-2 text-lg md:text-xl font-bold text-white tracking-tight">
                                    <ShieldCheck className="w-5 h-5 text-[#10B981]" /> Verification Ledger
                                </h4>
                            </div>
                            <span className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest self-start w-full text-center mt-2">
                                {paidMembersCount} / {members.length} VERIFIED PAID
                            </span>
                        </div>

                        <div className="divide-y divide-white/5 overflow-y-auto custom-scrollbar flex-1">
                            {members.length === 0 ? (
                                <div className="p-10 text-center text-gray-500 text-xs font-bold uppercase tracking-widest">No members enrolled</div>
                            ) : members.map((member) => (
                                <div key={member.id} className={clsx(
                                    "p-4 md:p-5 flex items-center justify-between transition-colors",
                                    member.id === currentUser?.id ? "bg-white/[0.03]" : "hover:bg-white/[0.01]"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-full flex items-center justify-center p-0.5 border shadow-sm",
                                            member.hasPaid ? "bg-gradient-to-b from-[#10B981] to-[#047857] border-[#10B981]" : "bg-[#1c272c] border-white/10 opacity-50 grayscale"
                                        )}>
                                            <img
                                                src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(member as any).avatarSeed || member.displayName}&backgroundColor=transparent`}
                                                alt="Avatar"
                                                className="w-full h-full object-cover rounded-full bg-[#0b1014]"
                                            />
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-sm tracking-tight flex items-center gap-2">
                                                {member.displayName}
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono mt-0.5 uppercase tracking-widest flex items-center gap-1">
                                                <div className={clsx("w-1.5 h-1.5 rounded-full", member.hasPaid ? "bg-[#10B981]" : "bg-red-500")} />
                                                {member.hasPaid ? "Funded" : "Red Zone"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Previous Gameweek Winners */}
                <div className="w-full pt-4">
                    <h4 className="flex items-center gap-2 text-[12px] font-bold text-white uppercase tracking-widest mb-4">
                        <Trophy className="w-3.5 h-3.5 text-[#eab308]" /> Winner's Circle
                    </h4>

                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        {mockWinnersTape.map((winner, idx) => (
                            <div key={idx} className={clsx(
                                "bg-[#131b22] border rounded-2xl p-5 flex flex-col items-center justify-center min-w-[140px] shrink-0 shadow-md relative overflow-hidden transition-all",
                                winner.id === activeUserId ? "border-[#FBBF24]/50 shadow-[0_0_20px_rgba(251,191,36,0.15)] bg-gradient-to-b from-[#FBBF24]/10 to-transparent" : "border-white/5"
                            )}>
                                {winner.id === activeUserId && <Star className="absolute top-2 right-2 w-3 h-3 text-[#FBBF24] opacity-50" />}
                                <div className="w-12 h-12 rounded-full border-2 border-[#FBBF24] p-0.5 mb-3 shadow-[0_0_10px_rgba(251,191,36,0.3)] bg-[#0b1014]">
                                    <img src={winner.avatar} alt={winner.name} className="w-full h-full rounded-full object-cover" />
                                </div>
                                <span className="font-bold text-[14px] text-white tracking-wide">{winner.name}</span>
                                <span className="font-bold text-[13px] text-[#eab308] my-1 tracking-tight">{winner.prize}</span>
                                <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-1 bg-white/5 px-2 py-0.5 rounded">GW{winner.gw}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Bottom Floating Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0b100a] via-[#0b100a]/90 to-transparent flex justify-center z-30 pointer-events-none">
                <div className="flex gap-4 w-full max-w-4xl mx-auto pointer-events-auto">
                    <button className="flex-1 bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold text-sm md:text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                        <Banknote className="w-5 h-5" /> Deposit (M-Pesa)
                    </button>
                    <button onClick={() => navigate('/standings')} className="flex-1 bg-[#161d24] hover:bg-[#1c272c] border border-white/5 hover:border-white/20 text-white font-extrabold text-sm md:text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg">
                        <BarChart3 className="w-5 h-5 text-[#FBBF24]" /> Standings & Vault
                    </button>
                </div>
            </div>

        </div>
    );
}
