import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { Trophy, BarChart3, Banknote, ShieldCheck, AlertCircle, Zap, Check, Activity, Terminal, AlertTriangle, RefreshCw, CheckCircle2, Share2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, where, updateDoc, orderBy, limit } from 'firebase/firestore';
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
    const [coAdminId, setCoAdminId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
    const [isPushingMpesa, setIsPushingMpesa] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptCode, setReceiptCode] = useState('');
    const [isQueryingReceipt, setIsQueryingReceipt] = useState(false);
    const [receiptResult, setReceiptResult] = useState<{ success: boolean; message: string } | null>(null);

    // Module 3B: Dispute/Claim state
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [claimReceiptCode, setClaimReceiptCode] = useState('');
    const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
    const [claimSubmitted, setClaimSubmitted] = useState(false);

    // Module 4A: Winner confirmation state
    const [winnerConfirmation, setWinnerConfirmation] = useState<any>(null);

    // Phase 10.5: Live Escrow Feed
    const [liveEvents, setLiveEvents] = useState<any[]>([]);

    // Co-Admin State
    const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
    const [isApprovingPayout, setIsApprovingPayout] = useState<string | null>(null);

    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);
    const isStealthMode = useStore(state => state.isStealthMode);
    const { notifications } = useNotifications();

    const currentUser = members.find(m => m.phone === memberPhone);
    const hasPaid = currentUser?.hasPaid || false;
    const activeUserId = currentUser?.id || 'dummy';

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
                if (data.coAdminId) setCoAdminId(data.coAdminId);
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
            setToastType('success');
            setTimeout(() => setToastMessage(''), 4000);
            window.history.replaceState({}, document.title);
        }

        return () => unsubscribeLeague();
    }, [activeLeagueId, memberPhone, navigate, listenToLeagueMembers, location.state]);

    // Phase 10.5: Real-time Live Escrow Feed from league_events
    useEffect(() => {
        if (!activeLeagueId) return;
        const eventsRef = collection(db, 'leagues', activeLeagueId, 'league_events');
        const q = query(eventsRef, orderBy('timestamp', 'desc'), limit(20));
        const unsub = onSnapshot(q, snap => {
            setLiveEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [activeLeagueId]);

    // Co-Admin: Listen for Pending Payouts
    useEffect(() => {
        if (!activeLeagueId || currentUser?.id !== coAdminId) return;
        const q = query(
            collection(db, 'leagues', activeLeagueId, 'pending_payouts'),
            where('status', '==', 'pending_approval')
        );
        const unsub = onSnapshot(q, snap => {
            setPendingPayouts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, [activeLeagueId, currentUser?.id, coAdminId]);

    // Module 4A: Listen for pending winner confirmations — moved below currentUser declaration

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setTimeout(() => setToastMessage(''), 3000);
    };

    const handleMpesaSTKPush = async () => {
        if (!activeLeagueId || !currentUser || !memberPhone) return;
        setIsPushingMpesa(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${apiUrl}/api/mpesa/stkpush`, {
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
                showToast("STK Push sent! Awaiting M-Pesa PIN...", "success");
            } else {
                showToast(data.message || "Failed to initiate M-Pesa STK Push.", "error");
            }
        } catch (error) {
            console.error("STK Push Error:", error);
            showToast("Network Error: Could not reach payment server.", "error");
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
                showToast('✅ Payment verified! Your status has been updated.', 'success');
                setTimeout(() => setShowReceiptModal(false), 2000);
            }
        } catch (err) {
            setReceiptResult({ success: false, message: 'Network error. Please try again.' });
        } finally {
            setIsQueryingReceipt(false);
        }
    };

    // Module 3B: Submit a payment dispute
    const handleClaimPayment = async () => {
        if (!claimReceiptCode.trim() || !activeLeagueId || !currentUser) return;
        setIsSubmittingClaim(true);
        try {
            await addDoc(collection(db, 'leagues', activeLeagueId, 'disputes'), {
                memberId: currentUser.id,
                memberName: currentUser.displayName,
                phone: currentUser.phone,
                receiptCode: claimReceiptCode.trim().toUpperCase(),
                amount: monthlyContribution,
                status: 'pending',
                timestamp: serverTimestamp()
            });
            setClaimSubmitted(true);
            setTimeout(() => { setShowClaimModal(false); setClaimSubmitted(false); setClaimReceiptCode(''); }, 3000);
        } catch (err: any) {
            console.error('Claim submit error:', err);
            if (err?.code === 'permission-denied') {
                showToast('🔒 Permission Denied: Could not submit claim.', 'error');
            }
        } finally {
            setIsSubmittingClaim(false);
        }
    };

    // Co-Admin: Approve Payout
    const handleApprovePayout = async (payout: any) => {
        if (!activeLeagueId) return;
        setIsApprovingPayout(payout.id);
        try {
            const payoutApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await fetch(`${payoutApiUrl}/api/mpesa/b2c`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: payout.winnerPhone,
                    amount: payout.amount,
                    remarks: `FantasyChama GW${payout.gw} Approved Payout`,
                    userId: payout.winnerId,
                    leagueId: activeLeagueId
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payout.id), {
                status: 'approved',
                approvedBy: currentUser?.displayName || 'Co-Admin',
                approvedAt: serverTimestamp()
            });

            // Reset all members to Red Zone
            const membershipsRef = collection(db, 'leagues', activeLeagueId, 'memberships');
            await Promise.all(members.map(m => updateDoc(doc(membershipsRef, m.id), { hasPaid: false })));

            showToast(`✅ Approved! KES ${payout.amount.toLocaleString()} dispatched to ${payout.winnerName}.`);
        } catch (err: any) {
            showToast(`Approval failed: ${err.message}`, 'error');
        } finally {
            setIsApprovingPayout(null);
        }
    };

    const handleRejectPayout = async (payoutId: string) => {
        if (!activeLeagueId) return;
        await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payoutId), {
            status: 'rejected',
            rejectedBy: currentUser?.displayName || 'Co-Admin',
            rejectedAt: serverTimestamp()
        });
        showToast('Payout request rejected. Chairman will be notified.');
    };

    const generateWhatsAppReceipt = (payout: any) => {
        const unpaidCount = members.filter(m => !m.hasPaid && m.role !== 'admin' && m.isActive !== false).length;
        const appUrl = import.meta.env.VITE_APP_URL || 'https://fantasy-chama.vercel.app';

        const message = [
            `🏆 *${leagueName} — ${payout.gwName || `GW${payout.gw}`} Results*`,
            ``,
            `🥇 *Winner:* ${payout.winnerName} (${payout.points} pts)`,
            `💰 *Payout:* KES ${Number(payout.amount).toLocaleString()} _(Dispatched via M-Pesa ✅)_`,
            `🚨 *Red Zone:* ${unpaidCount} member${unpaidCount !== 1 ? 's' : ''} yet to deposit for next GW.`,
            ``,
            `📊 Check live standings & vault:`,
            `🔗 ${appUrl}`,
            ``,
            `_Powered by FantasyChama — Your Chama runs itself._ ⚡`,
        ].join('\n');

        const encoded = encodeURIComponent(message);
        window.open(`whatsapp://send?text=${encoded}`, '_blank');
    };

    // Module 4A: Confirm receipt
    const handleConfirmWinnings = async () => {
        if (!activeLeagueId || !winnerConfirmation) return;
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'winner_confirmations', winnerConfirmation.id), {
                status: 'confirmed'
            });
            showToast('✅ Payout confirmed! Thank you.', 'success');
        } catch (err: any) {
            console.error('Confirm error:', err);
            if (err?.code === 'permission-denied') {
                showToast('🔒 Permission Denied: You can only confirm your own payout.', 'error');
            }
        }
    };

    // Module 4A: Listen for pending winner confirmations for this user
    useEffect(() => {
        if (!activeLeagueId || !currentUser?.id) return;
        const q = query(
            collection(db, 'leagues', activeLeagueId, 'winner_confirmations'),
            where('winnerId', '==', currentUser.id),
            where('status', '==', 'pending_confirmation')
        );
        const unsub = onSnapshot(q, snap => {
            if (!snap.empty) setWinnerConfirmation({ id: snap.docs[0].id, ...snap.docs[0].data() });
            else setWinnerConfirmation(null);
        });
        return () => unsub();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeLeagueId, currentUser?.id]);

    // Dynamic Calculations
    const paidMembersCount = members.filter(m => m.hasPaid && m.isActive !== false).length;
    const totalCollected = paidMembersCount * monthlyContribution;
    const weeklyPot = totalCollected * (rules.weekly / 100);
    // Formula: Active members * Monthly Contribution * 38 GWs * Vault Percentage
    const seasonVaultProjected = members.length * monthlyContribution * 38 * (rules.vault / 100);

    // Dynamic Winner calculation from recent notification feed using the structured isWinnerEvent objects
    const winnerEvents = notifications.filter((n: any) => n.isWinnerEvent);
    const mostRecentWinner = winnerEvents.length > 0 ? winnerEvents[0] : null;
    const isRecentWinner = mostRecentWinner?.winnerId === currentUser?.id;


    // Mock Performance Data for Trajectory
    const performanceData = [
        { name: 'GW21', Points: 42, Average: 45 },
        { name: 'GW22', Points: 58, Average: 50 },
        { name: 'GW23', Points: 81, Average: 54 },
        { name: 'GW24', Points: 45, Average: 48 },
        { name: 'GW25', Points: isRecentWinner ? 95 : 68, Average: 52 },
    ];

    // Greeting for member header
    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };
    const greetingText = getGreeting();
    const firstName = (currentUser?.displayName || 'Manager').split(' ')[0];

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
                "fixed top-20 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-xs md:text-sm font-bold flex items-center gap-3 transition-all duration-500 pointer-events-none z-50",
                toastMessage ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4",
                toastType === 'error'
                    ? "bg-red-500/10 border border-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                    : "bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            )}>
                {toastType === 'error' ? (
                    <AlertCircle className="w-5 h-5 bg-red-500/20 rounded-full p-0.5" />
                ) : (
                    <Check className="w-5 h-5 bg-[#10B981]/20 rounded-full p-0.5" />
                )}
                {toastMessage}
            </div>

            {/* Top Navigation Frame */}
            <div className="pt-6 px-4 md:pt-10 md:px-8 w-full max-w-6xl mx-auto z-50 space-y-3">
                <Header
                    role="member"
                    title={leagueName || 'The Big League'}
                    subtitle="Member Hub"
                />
                {/* Personalised greeting row */}
                <div className="flex items-center gap-2.5 pl-1">
                    <span className="text-lg md:text-xl">
                        {greetingText === 'Good morning' ? '🌅' : greetingText === 'Good afternoon' ? '☀️' : '🌙'}
                    </span>
                    <p className="text-base md:text-lg font-semibold text-gray-300 tracking-tight">
                        {greetingText},{' '}
                        <span className="text-white font-extrabold bg-gradient-to-r from-[#FBBF24] to-[#f59e0b] bg-clip-text text-transparent">
                            {firstName}!
                        </span>
                    </p>
                    <span className="hidden sm:block text-[10px] font-bold text-gray-600 uppercase tracking-widest border border-white/5 bg-white/[0.03] px-2 py-0.5 rounded-full">
                        GW 26 Active
                    </span>
                </div>

                {/* Phase 10.5: Action Required Banner — static, high-visibility, never a toast */}
                {(winnerConfirmation || !hasPaid) && (
                    <div className={clsx(
                        "w-full rounded-2xl border px-4 py-3 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300",
                        winnerConfirmation
                            ? "bg-[#1c1a09] border-[#FBBF24]/40 shadow-[0_0_20px_rgba(251,191,36,0.1)]"
                            : "bg-red-950/40 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.08)]"
                    )}>
                        <span className="text-xl flex-shrink-0">{winnerConfirmation ? '🏆' : '⚠️'}</span>
                        <div className="flex-1 min-w-0">
                            <p className={clsx(
                                "font-extrabold text-sm leading-tight",
                                winnerConfirmation ? "text-[#FBBF24]" : "text-red-400"
                            )}>
                                {winnerConfirmation
                                    ? `ACTION REQUIRED: Confirm receipt of KES ${winnerConfirmation.amount?.toLocaleString()}`
                                    : 'ACTION REQUIRED: Red Zone — Pay before the FPL deadline'}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                {winnerConfirmation
                                    ? 'Tap below once you receive the funds in your M-Pesa'
                                    : `Your wallet balance is empty. Pay KES ${monthlyContribution.toLocaleString()} to stay eligible.`}
                            </p>
                        </div>
                        {winnerConfirmation && (
                            <button
                                onClick={handleConfirmWinnings}
                                className="flex-shrink-0 bg-[#FBBF24] hover:bg-[#eab308] text-black text-xs font-black px-3 py-2 rounded-xl transition-colors"
                            >
                                Confirm ✓
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Main Content — Dense Grid Layout */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 pb-6 z-10 relative mt-2">

                {/* === ROW 1: Vault (8) + Weekly Pot Status (4) === */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
                    {/* Vault / Pot Swapper */}
                    <div className="lg:col-span-8">
                        <PotVaultSwapper
                            weeklyPot={weeklyPot}
                            seasonVault={seasonVaultProjected}
                            weeklyRulesPercent={rules.weekly}
                            isStealthMode={isStealthMode}
                        />
                    </div>

                    {/* Winner's Circle — compact */}
                    <div className="lg:col-span-4 bg-[#161d24] border border-white/5 shadow-2xl shadow-black/50 rounded-[1.5rem] p-5 flex flex-col gap-3 overflow-hidden">
                        <h4 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                            <Trophy className="w-3.5 h-3.5 text-[#eab308]" /> Winner's Circle
                        </h4>
                        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {winnerEvents.length === 0 ? (
                                <div className="text-xs text-gray-600 font-bold tracking-widest uppercase py-4 w-full text-center">No winners yet</div>
                            ) : winnerEvents.slice(0, 5).map((winner: any, idx: number) => {
                                const winnerMember = members.find(m => m.id === winner.winnerId) || { avatarSeed: winner.winnerName };
                                return (
                                    <div key={idx} className={clsx(
                                        "flex flex-col items-center justify-center min-w-[80px] rounded-xl p-3 shrink-0 border transition-all",
                                        winner.winnerId === activeUserId ? "border-[#FBBF24]/40 bg-[#FBBF24]/5" : "border-white/5 bg-white/[0.02]"
                                    )}>
                                        <div className="w-9 h-9 rounded-full border-2 border-[#FBBF24]/60 p-0.5 mb-1.5 bg-[#0b1014]">
                                            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(winnerMember as any).avatarSeed}&backgroundColor=transparent`} alt={winner.winnerName} className="w-full h-full rounded-full object-cover" />
                                        </div>
                                        <span className="font-bold text-[11px] text-white leading-tight text-center">{winner.winnerName?.split(' ')[0]}</span>
                                        <span className="text-[10px] text-[#eab308] font-bold">GW{winner.gw}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* === ROW 1.5: Co-Admin Maker/Checker (Conditional) === */}
                {currentUser?.id === coAdminId && pendingPayouts.length > 0 && (
                    <div className="mb-4 bg-[#FBBF24]/10 border border-[#FBBF24]/40 rounded-[1.5rem] p-5 shadow-2xl overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-5 h-5 text-[#FBBF24] animate-pulse" />
                            <h3 className="text-xl font-black text-[#FBBF24] tracking-tight">Co-Admin Duty: Awaiting Approval</h3>
                        </div>
                        <div className="space-y-3">
                            {pendingPayouts.map((payout) => (
                                <div key={payout.id} className="bg-black/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-white font-bold text-sm tracking-wide">{payout.gwName || `GW${payout.gw}`} Payout Request</p>
                                        <p className="text-gray-300 text-sm mt-1">
                                            <span className="text-[#FBBF24] font-black tracking-tight">KES {Number(payout.amount).toLocaleString()}</span> → {payout.winnerName} ({payout.winnerPhone})
                                        </p>
                                        <p className="text-gray-500 text-[10px] mt-1 uppercase tracking-widest font-bold">Requested by: {payout.requestedBy || 'Chairman'}</p>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => handleRejectPayout(payout.id)}
                                            className="flex-1 sm:flex-none px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprovePayout(payout)}
                                            disabled={isApprovingPayout === payout.id}
                                            className="flex-1 sm:flex-none px-5 py-2.5 bg-[#10B981] hover:bg-[#10b981]/90 text-black text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            {isApprovingPayout === payout.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            {isApprovingPayout === payout.id ? 'Approving...' : 'Approve & Pay'}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => generateWhatsAppReceipt(payout)}
                                        className="sm:hidden lg:flex px-4 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors items-center justify-center gap-1.5 active:scale-95 text-center w-full sm:w-auto"
                                    >
                                        <Share2 className="w-3.5 h-3.5" /> Share
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* === ROW 2: Personal Status (4) + Chart (8) === */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
                    {/* Personal Status + Pay Action */}
                    {currentUser && (
                        <div className={clsx(
                            "lg:col-span-5 rounded-[1.5rem] p-5 border relative overflow-hidden shadow-xl border-white/5 shadow-black/50",
                            isRecentWinner ? "bg-[#1c272c] border-[#FBBF24]/50 shadow-[0_0_30px_rgba(251,191,36,0.12)]" :
                                (hasPaid ? "bg-[#10B981]/5 border-[#10B981]/20" : "bg-red-500/5 border-red-500/20")
                        )}>
                            {isRecentWinner && (
                                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#FBBF24] to-transparent" />
                            )}
                            {/* Status Label */}
                            <span className={clsx(
                                "text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 mb-2",
                                hasPaid ? "text-[#10B981]" : "text-red-400"
                            )}>
                                <span className={clsx("w-1.5 h-1.5 rounded-full animate-pulse", hasPaid ? "bg-[#10B981]" : "bg-red-500")} />
                                Your Gameweek Status
                            </span>
                            <h3 className={clsx("text-xl font-black tracking-tight mb-1.5", isRecentWinner ? "text-[#FBBF24]" : "text-white")}>
                                {isRecentWinner ? "Champion of the Week 🏆" : (hasPaid ? "Verified & Active" : "Action Required")}
                            </h3>
                            <p className="text-xs text-gray-400 leading-relaxed mb-4">
                                {isRecentWinner
                                    ? "Incredible! You secured the highest points this GW. Payout processing."
                                    : (hasPaid
                                        ? "Your contribution is secured. Eligible for this GW's pot."
                                        : (currentUser?.missedGameweeks === 1
                                            ? <span className="text-red-400 font-bold">⚠️ CRITICAL: You have missed 1 Gameweek. Failure to pay for 2 consecutive Gameweeks results in permanent disqualification from the Vault.</span>
                                            : "Your contribution is missing. Pay before the FPL deadline."))}
                            </p>

                            {!hasPaid && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-baseline justify-center gap-1.5 mb-2 mt-1">
                                        <span className="text-3xl font-black text-white tracking-tight tabular-nums">
                                            {monthlyContribution.toLocaleString()}
                                        </span>
                                        <span className="text-white text-xs font-bold tracking-widest uppercase">KES</span>
                                    </div>
                                    <button
                                        onClick={handleMpesaSTKPush}
                                        disabled={isPushingMpesa}
                                        className="w-full px-4 py-2.5 rounded-xl font-bold text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <Banknote className="w-5 h-5 group-hover:-rotate-6 transition-transform" />
                                        {isPushingMpesa ? "Awaiting PIN..." : "Pay with M-Pesa"}
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setShowReceiptModal(true); setReceiptResult(null); setReceiptCode(''); }}
                                            className="flex-1 text-[11px] text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors text-center"
                                        >
                                            Already paid? Verify →
                                        </button>
                                        <button
                                            onClick={() => { setShowClaimModal(true); setClaimSubmitted(false); setClaimReceiptCode(''); }}
                                            className="flex-1 text-[11px] text-[#FBBF24]/60 hover:text-[#FBBF24] underline underline-offset-2 transition-colors text-center"
                                        >
                                            Dispute payment →
                                        </button>
                                    </div>
                                </div>
                            )}
                            {hasPaid && (
                                <div className="flex items-center gap-2 text-[#10B981]/70 text-xs font-bold mt-auto">
                                    <Check className="w-4 h-4" /> Contribution confirmed
                                </div>
                            )}

                            {/* BG graphic */}
                            <div className="absolute -right-3 -bottom-3 opacity-[0.04] pointer-events-none">
                                {isRecentWinner ? <Trophy className="w-28 h-28 text-[#FBBF24]" /> : (hasPaid ? <ShieldCheck className="w-24 h-24" /> : <AlertCircle className="w-24 h-24" />)}
                            </div>
                        </div>
                    )}

                    {/* Performance Chart */}
                    <div className="lg:col-span-7 bg-[#161d24] border border-white/5 shadow-2xl shadow-black/50 rounded-[1.5rem] p-5">
                        <h4 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                            <BarChart3 className="w-3.5 h-3.5" /> Performance Trajectory
                            <span className="ml-auto text-gray-600 text-[10px] font-medium">— vs League Avg</span>
                        </h4>
                        <div className="h-52 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={performanceData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                    <XAxis dataKey="name" stroke="#ffffff30" fontSize={9} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#ffffff30" fontSize={9} tickLine={false} axisLine={false} width={28} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0e1419', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px' }}
                                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                    />
                                    <Line type="monotone" dataKey="Points" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3.5, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                    <Line type="monotone" dataKey="Average" stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* === ROW 3: Full-width Red Zone / Verification Ledger === */}
                <div className="w-full bg-[#161d24] border border-white/5 shadow-2xl shadow-black/50 rounded-[1.5rem] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" /> Verification Ledger
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse ml-1" />
                        </h4>
                        <span className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 text-[10px] font-bold px-3 py-1 rounded-lg uppercase tracking-widest">
                            {paidMembersCount}/{members.length} Paid
                        </span>
                    </div>
                    <div
                        className="max-h-56 overflow-y-auto divide-y divide-white/[0.04]"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e2935 transparent' }}
                    >
                        {members.length === 0 ? (
                            <div className="p-8 text-center text-gray-600 text-xs font-bold uppercase tracking-widest">No members enrolled</div>
                        ) : members.map((member) => (
                            <div key={member.id} className={clsx(
                                "px-5 py-3 flex items-center justify-between transition-colors",
                                member.id === currentUser?.id ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                            )}>
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "w-8 h-8 rounded-full border p-0.5 flex-shrink-0",
                                        member.hasPaid ? "border-[#10B981]/50 bg-[#10B981]/10" : "border-white/10 opacity-40 grayscale"
                                    )}>
                                        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(member as any).avatarSeed || member.displayName}&backgroundColor=transparent`} alt="Avatar" className="w-full h-full rounded-full" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-sm leading-tight">{member.displayName}
                                            {member.id === currentUser?.id && <span className="ml-1.5 text-[10px] text-gray-500 font-medium">(you)</span>}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono">{member.phone}</div>
                                    </div>
                                </div>
                                <span className={clsx(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                                    member.hasPaid
                                        ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20"
                                        : "bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20"
                                )}>
                                    <span className={clsx("w-1.5 h-1.5 rounded-full", member.hasPaid ? "bg-[#10B981]" : "bg-[#FBBF24]")} />
                                    {member.hasPaid ? "Funded" : "Red Zone"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* === ROW 4: Live Escrow Feed === */}
                <div className="w-full bg-[#0d1117] border border-white/5 rounded-[1.5rem] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-[#10B981]" />
                        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Live Escrow Feed</h4>
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse ml-1" />
                        <span className="ml-auto font-mono text-[10px] text-gray-700">{leagueName}</span>
                    </div>
                    <div
                        className="h-48 overflow-y-auto divide-y divide-white/[0.03] font-mono"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e2935 transparent' }}
                    >
                        {liveEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-700">
                                <Terminal className="w-6 h-6 mb-2 opacity-40" />
                                <span className="text-[11px] tracking-widest uppercase">Standing by...</span>
                            </div>
                        ) : liveEvents.map(ev => {
                            const ts = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date();
                            const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const tagColor = ev.eventType === 'payment' ? 'text-[#10B981] bg-[#10B981]/10' :
                                ev.eventType === 'resolution' ? 'text-[#FBBF24] bg-[#FBBF24]/10' :
                                    ev.eventType === 'rules' ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 bg-white/5';
                            return (
                                <div key={ev.id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors animate-in fade-in duration-500">
                                    <span className="text-gray-700 text-[10px] w-12 flex-shrink-0">{timeStr}</span>
                                    <span className={clsx('text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0', tagColor)}>
                                        {ev.eventType || 'SYS'}
                                    </span>
                                    <span className="text-[11px] text-gray-400 truncate">{ev.message}</span>
                                    {ev.actor && <span className="ml-auto text-[10px] text-gray-700 flex-shrink-0">@{ev.actor}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-[65px] lg:bottom-0 left-0 lg:left-64 xl:left-72 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0b100a] via-[#0b100a]/90 to-transparent flex justify-center z-30 pointer-events-none pb-8 lg:pb-6">
                <div className="flex gap-4 w-full max-w-6xl mx-auto pointer-events-auto">
                    <button
                        onClick={handleMpesaSTKPush}
                        disabled={isPushingMpesa || hasPaid}
                        className="flex-1 bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-60 text-black font-extrabold text-sm md:text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    >
                        <Banknote className="w-5 h-5" /> {hasPaid ? 'Contribution Secured ✓' : 'Pay via M-Pesa'}
                    </button>
                    <button
                        onClick={() => navigate('/standings')}
                        className="flex-1 bg-[#161d24] hover:bg-[#1c272c] border border-white/5 hover:border-white/20 text-white font-extrabold text-sm md:text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                        <BarChart3 className="w-5 h-5 text-[#FBBF24]" /> Standings &amp; Vault
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
                                Paid but still showing Red Zone? Enter your M-Pesa confirmation code to self-reconcile.
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
                                <div className={`p-3 rounded-xl text-sm font-medium border ${receiptResult?.success ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                    {receiptResult?.message}
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

            {/* Module 4A: Winner Confirmation Banner */}
            {winnerConfirmation && (
                <div className="fixed bottom-36 lg:bottom-24 left-0 lg:left-64 xl:left-72 right-0 px-4 md:px-8 z-40 flex justify-center">
                    <div className="w-full max-w-2xl bg-[#1c1a09] border border-[#FBBF24]/40 rounded-2xl p-4 shadow-[0_0_30px_rgba(251,191,36,0.15)] flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="w-10 h-10 rounded-full bg-[#FBBF24]/15 border border-[#FBBF24]/30 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-5 h-5 text-[#FBBF24]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-white text-sm">Chairman disbursed KES {winnerConfirmation.amount?.toLocaleString()} to your M-Pesa</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">Tap confirm once you receive the funds</p>
                        </div>
                        <button
                            onClick={handleConfirmWinnings}
                            className="flex-shrink-0 bg-[#FBBF24] hover:bg-[#eab308] text-black text-xs font-black px-4 py-2.5 rounded-xl transition-colors"
                        >
                            Confirm Receipt ✓
                        </button>
                    </div>
                </div>
            )}

            {/* Module 3B: Claim Payment Modal */}
            {showClaimModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#111820]/95 border border-[#FBBF24]/20 rounded-3xl p-7 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                        {claimSubmitted ? (
                            <div className="text-center py-4">
                                <div className="w-14 h-14 rounded-full bg-[#FBBF24]/10 border border-[#FBBF24]/30 flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-7 h-7 text-[#FBBF24]" />
                                </div>
                                <h3 className="text-xl font-extrabold text-white mb-2">Dispute Lodged! 🚨</h3>
                                <p className="text-sm text-gray-400">Your claim has been flagged to the Chairman for review. You'll be updated within 24 hours.</p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[#FBBF24] text-lg">🚨</span>
                                        <h3 className="text-xl font-extrabold text-white">Claim Payment</h3>
                                    </div>
                                    <p className="text-sm text-gray-400">
                                        Paid via M-Pesa but still Red Zone? Submit your receipt and the Chairman will verify it within 24h.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Receipt Code</label>
                                        <input
                                            type="text"
                                            value={claimReceiptCode}
                                            onChange={e => setClaimReceiptCode(e.target.value.toUpperCase())}
                                            placeholder="e.g. SCL90XXXXXX"
                                            className="w-full bg-white/5 border border-[#FBBF24]/20 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#FBBF24]/50 transition-colors"
                                        />
                                    </div>
                                    <div className="bg-[#FBBF24]/5 border border-[#FBBF24]/15 rounded-xl p-3 text-xs text-gray-400 leading-relaxed">
                                        The Chairman will receive an alert to cross-check your M-Pesa receipt with their records. False claims may result in suspension.
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowClaimModal(false)}
                                            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 text-sm font-bold rounded-xl transition-colors border border-white/10"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleClaimPayment}
                                            disabled={isSubmittingClaim || !claimReceiptCode.trim()}
                                            className="flex-1 px-4 py-3 bg-[#FBBF24] hover:bg-[#eab308] text-black text-sm font-black rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isSubmittingClaim ? <Zap className="w-4 h-4 animate-pulse" /> : null}
                                            {isSubmittingClaim ? 'Submitting...' : 'Submit Claim 🚨'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
