import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { Bell, Trophy, BarChart3, Banknote, ShieldCheck, AlertCircle, Zap, Check, Star } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import { useNotifications } from '../components/NotificationProvider';
import PotVaultSwapper from '../components/PotVaultSwapper';
import clsx from 'clsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MemberDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const memberPhone = localStorage.getItem('memberPhone');

    const [monthlyContribution, setMonthlyContribution] = useState(0);
    const [leagueName, setLeagueName] = useState('');
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });
    const [isLoading, setIsLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState('');
    const [isPushingMpesa, setIsPushingMpesa] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptCode, setReceiptCode] = useState('');
    const [isQueryingReceipt, setIsQueryingReceipt] = useState(false);
    const [receiptResult, setReceiptResult] = useState<{ success: boolean; message: string } | null>(null);

    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);
    const isStealthMode = useStore(state => state.isStealthMode);
    const { notifications } = useNotifications();

    useEffect(() => {
        if (!activeLeagueId || !memberPhone) {
            navigate('/login');
            return;
        }

        // Setup real-time listener for the League document
        const leagueRef = doc(db, 'leagues', activeLeagueId);
        const unsubscribeLeague = onSnapshot(leagueRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMonthlyContribution(data.monthlyContribution || 0);
                setLeagueName(data.leagueName || '');
                if (data.rules) setRules(data.rules);
            }
        }, (err: any) => {
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

    const handleMpesaSTKPush = async () => {
        if (!activeLeagueId || !currentUser || !memberPhone) return;
        setIsPushingMpesa(true);
        try {
            const response = await fetch('http://localhost:5000/api/mpesa/stkpush', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: memberPhone,
                    amount: monthlyContribution,
                    userId: activeUserId,
                    leagueId: activeLeagueId
                })
            });

            const data = await response.json();
            if (data.success) {
                showToast("STK Push sent! Awaiting M-Pesa PIN...");
            } else {
                showToast(data.message || "Failed to initiate M-Pesa STK Push.");
            }
        } catch (error) {
            console.error("STK Push Error:", error);
            showToast("Network Error: Could not reach payment server.");
        } finally {
            setIsPushingMpesa(false);
        }
    };

    const handleReceiptQuery = async () => {
        if (!receiptCode.trim() || !activeUserId || !activeLeagueId) return;
        setIsQueryingReceipt(true);
        setReceiptResult(null);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/mpesa/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiptNumber: receiptCode.trim().toUpperCase(),
                    userId: activeUserId,
                    leagueId: activeLeagueId
                })
            });
            const data = await res.json();
            setReceiptResult({ success: data.success && data.verified !== false, message: data.message });
            if (data.success && data.verified === true) {
                showToast('✅ Payment verified! Your status has been updated.');
                setTimeout(() => setShowReceiptModal(false), 2000);
            }
        } catch (err) {
            setReceiptResult({ success: false, message: 'Network error. Please try again.' });
        } finally {
            setIsQueryingReceipt(false);
        }
    };

    const currentUser = members.find(m => m.phone === memberPhone);
    const hasPaid = currentUser?.hasPaid || false;
    const activeUserId = currentUser?.id || 'dummy';

    // Dynamic Calculations
    const paidMembersCount = members.filter(m => m.hasPaid).length;
    const totalCollected = paidMembersCount * monthlyContribution;
    const weeklyPot = totalCollected * (rules.weekly / 100);
    // Formula: Active members * Monthly Contribution * 38 GWs * Vault Percentage
    const seasonVaultProjected = members.length * monthlyContribution * 38 * (rules.vault / 100);

    // Dynamic Winner calculation from recent notification feed using the structured isWinnerEvent objects
    const winnerEvents = notifications.filter((n: any) => n.isWinnerEvent);
    const mostRecentWinner = winnerEvents.length > 0 ? winnerEvents[0] : null;
    const isRecentWinner = mostRecentWinner?.winnerId === currentUser?.id;

    // Format feed timestamps
    const timeAgo = (dateInput: any) => {
        if (!dateInput) return 'Just now';
        const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    };

    // Mock Performance Data for Trajectory
    const performanceData = [
        { name: 'GW21', Points: 42, Average: 45 },
        { name: 'GW22', Points: 58, Average: 50 },
        { name: 'GW23', Points: 81, Average: 54 },
        { name: 'GW24', Points: 45, Average: 48 },
        { name: 'GW25', Points: isRecentWinner ? 95 : 68, Average: 52 },
    ];

    // Dynamic Greeting Setup complete

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
            <div className="pt-6 px-4 md:pt-10 md:px-8 w-full max-w-4xl mx-auto z-50">
                <Header role="member" title={undefined} subtitle={
                    <div className="flex flex-col mt-0.5">
                        <span className="text-white text-[15px] font-bold tracking-tight mb-0.5">{leagueName || 'The Big League'}</span>
                        <span>War Room</span>
                    </div>
                } />
            </div>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col mt-0 md:mt-0 space-y-6 z-10 relative">

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
                                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={handleMpesaSTKPush}
                                        disabled={isPushingMpesa}
                                        className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors whitespace-nowrap shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isPushingMpesa ? <Zap className="w-4 h-4 animate-pulse" /> : <Banknote className="w-4 h-4" />}
                                        {isPushingMpesa ? "Awaiting PIN..." : "Pay with M-Pesa"}
                                    </button>
                                    <button
                                        onClick={() => { setShowReceiptModal(true); setReceiptResult(null); setReceiptCode(''); }}
                                        className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
                                    >
                                        Missing payment?
                                    </button>
                                </div>
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
                        <div className="w-full">
                            <PotVaultSwapper
                                weeklyPot={weeklyPot}
                                seasonVault={seasonVaultProjected}
                                weeklyRulesPercent={rules.weekly}
                                isStealthMode={isStealthMode}
                            />
                        </div>

                        {/* Leaderboard Chart */}
                        <div className="w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl p-6 md:p-8">
                            <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                                <BarChart3 className="w-4 h-4" /> Performance Trajectory
                            </h4>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={performanceData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                        <XAxis dataKey="name" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#161d24', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}
                                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                        <Line type="monotone" dataKey="Points" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                        <Line type="monotone" dataKey="Average" stroke="#FBBF24" strokeWidth={3} strokeDasharray="5 5" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent Notifications Feed */}
                        <div className="w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl p-6 md:p-8">
                            <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                                <Bell className="w-4 h-4" /> Operations Feed
                            </h4>
                            <div className="space-y-4">
                                {notifications.slice(0, 5).map((notif: any) => (
                                    <div key={notif.id} className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-full border flex items-center justify-center shrink-0",
                                            notif.type === 'success' ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]" :
                                                notif.type === 'warning' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                                    "bg-[#FBBF24]/10 border-[#FBBF24]/20 text-[#FBBF24]"
                                        )}>
                                            {notif.type === 'success' ? <Check className="w-5 h-5" /> :
                                                notif.type === 'warning' ? <AlertCircle className="w-5 h-5" /> :
                                                    <Bell className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-bold text-white tracking-wide">
                                                {notif.isWinnerEvent ? `Payout Dispatched` : (notif.type === 'success' ? 'Ledger Updated' : 'System Alert')}
                                            </h5>
                                            <p className="text-xs text-gray-400 mt-1">{notif.message}</p>
                                            <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-2 block">
                                                {timeAgo(notif.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {notifications.length === 0 && (
                                    <p className="text-xs text-gray-500 font-medium">No recent operations broadcasted.</p>
                                )}
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
                        {winnerEvents.length === 0 ? (
                            <div className="text-xs text-gray-500 font-bold tracking-widest uppercase">No verified winners yet.</div>
                        ) : winnerEvents.slice(0, 10).map((winner: any, idx: number) => {
                            const winnerMember = members.find(m => m.id === winner.winnerId) || { avatarSeed: winner.winnerName };

                            return (
                                <div key={idx} className={clsx(
                                    "bg-[#131b22] border rounded-2xl p-5 flex flex-col items-center justify-center min-w-[140px] shrink-0 shadow-md relative overflow-hidden transition-all",
                                    winner.winnerId === activeUserId ? "border-[#FBBF24]/50 shadow-[0_0_20px_rgba(251,191,36,0.15)] bg-gradient-to-b from-[#FBBF24]/10 to-transparent" : "border-white/5"
                                )}>
                                    {winner.winnerId === activeUserId && <Star className="absolute top-2 right-2 w-3 h-3 text-[#FBBF24] opacity-50" />}
                                    <div className="w-12 h-12 rounded-full border-2 border-[#FBBF24] p-0.5 mb-3 shadow-[0_0_10px_rgba(251,191,36,0.3)] bg-[#0b1014]">
                                        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(winnerMember as any).avatarSeed}&backgroundColor=transparent`} alt={winner.winnerName} className="w-full h-full rounded-full object-cover" />
                                    </div>
                                    <span className="font-bold text-[14px] text-white tracking-wide">{winner.winnerName}</span>
                                    <span className="font-bold text-[13px] text-[#eab308] my-1 tracking-tight">{winner.prize ? winner.prize.toLocaleString() + ' KES' : 'Winner'}</span>
                                    <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-1 bg-white/5 px-2 py-0.5 rounded">GW {winner.gw}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>

            {/* Bottom Actions repositioned strictly to avoid AppLayout overlap */}
            <div className="fixed bottom-[65px] lg:bottom-0 left-0 lg:left-64 xl:left-72 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0b100a] via-[#0b100a]/90 to-transparent flex justify-center z-30 pointer-events-none pb-8 lg:pb-6">
                <div className="flex gap-4 w-full max-w-4xl mx-auto pointer-events-auto">
                    <button className="flex-1 bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold text-sm md:text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                        <Banknote className="w-5 h-5" /> Deposit (M-Pesa)
                    </button>
                    <button onClick={() => navigate('/standings')} className="flex-1 bg-[#161d24] hover:bg-[#1c272c] border border-white/5 hover:border-white/20 text-white font-extrabold text-sm md:text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg">
                        <BarChart3 className="w-5 h-5 text-[#FBBF24]" /> Standings & Vault
                    </button>
                </div>
            </div>
            {/* Missing Payment? Receipt Query Modal */}
            {showReceiptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#111c14]/90 border border-white/10 rounded-3xl p-7 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="mb-5">
                            <h3 className="text-xl font-extrabold text-white mb-1 flex items-center gap-2">
                                🔍 Verify Your Payment
                            </h3>
                            <p className="text-sm text-gray-400">
                                Paid but still showing Red Zone? Enter your M-Pesa confirmation code from your SMS to self-reconcile.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Receipt Code</label>
                                <input
                                    type="text"
                                    value={receiptCode}
                                    onChange={e => setReceiptCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. SCL90XXXXXX"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#10B981]/50 transition-colors"
                                />
                            </div>

                            {receiptResult && (
                                <div className={`p-3 rounded-xl text-sm font-medium border ${receiptResult.success ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                    {receiptResult.message}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowReceiptModal(false)}
                                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 text-sm font-bold rounded-xl transition-colors border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReceiptQuery}
                                    disabled={isQueryingReceipt || !receiptCode.trim()}
                                    className="flex-1 px-4 py-3 bg-[#10B981] hover:bg-[#10B981]/90 text-black text-sm font-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isQueryingReceipt ? <><Zap className="w-4 h-4 animate-pulse" /> Verifying...</> : <><Check className="w-4 h-4" /> Verify Payment</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
