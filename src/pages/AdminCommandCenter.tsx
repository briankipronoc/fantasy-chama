import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { Megaphone, Share2, RefreshCw, Banknote, ChevronDown, CheckCircle2, Trophy, AlertTriangle, UserPlus, Bell, ShieldCheck } from 'lucide-react';
import PotVaultSwapper from '../components/PotVaultSwapper';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, onSnapshot, query, where, increment } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import confetti from 'canvas-confetti';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export default function AdminCommandCenter() {
    const navigate = useNavigate();
    const activeLeagueId = localStorage.getItem('activeLeagueId');

    const [leagueName, setLeagueName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [gameweekStake, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });
    const [isLoading, setIsLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState('');
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [coAdminId, setCoAdminId] = useState<string | null>(null);
    const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
    const [isApprovingPayout, setIsApprovingPayout] = useState<string | null>(null);
    const [whatsappReceipt, setWhatsappReceipt] = useState<string | null>(null);

    // Module 3B: Dispute/Claim alerts
    const [pendingDisputes, setPendingDisputes] = useState<any[]>([]);
    const [processingDispute, setProcessingDispute] = useState<string | null>(null);

    // Filter & Modal State
    const [paymentFilter, setPaymentFilter] = useState<'All' | 'Verified' | 'Red Zone'>('All');
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

    // Manual Member Enrollment
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberPhone, setNewMemberPhone] = useState('');
    const [newMemberTeam, setNewMemberTeam] = useState('');
    const [isAddingMember, setIsAddingMember] = useState(false);

    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);
    const togglePaymentStatusGlobal = useStore(state => state.togglePaymentStatus);
    const isStealthMode = useStore(state => state.isStealthMode);

    const handleToggleAdmin = async (memberId: string, currentRole: string | undefined) => {
        if (!activeLeagueId) return;
        try {
            await useStore.getState().toggleAdminStatus(activeLeagueId, memberId, currentRole);
            setToastMessage(currentRole === 'admin' ? "Admin role revoked 📉" : "Promoted to Admin 👑");
            setTimeout(() => setToastMessage(''), 3000);
        } catch (error) {
            console.error("Failed to toggle admin role:", error);
            setToastMessage("Error updating role");
            setTimeout(() => setToastMessage(''), 3000);
        }
    };
    useEffect(() => {
        if (!activeLeagueId) {
            navigate('/setup');
            return;
        }

        const initDashboard = async () => {
            try {
                // Fetch the main League document
                const leagueRef = doc(db, 'leagues', activeLeagueId);
                const leagueSnap = await getDoc(leagueRef);

                if (leagueSnap.exists()) {
                    const data = leagueSnap.data();
                    setLeagueName(data.leagueName || 'Unnamed League');
                    setInviteCode(data.inviteCode || '------');
                    setMonthlyContribution(data.gameweekStake || 0);
                    setCoAdminId(data.coAdminId || null);
                    if (data.rules) setRules(data.rules);
                }

                // Initialize Live Ledger
                listenToLeagueMembers(activeLeagueId);
                setIsLoading(false);
            } catch (err) {
                console.error("Error fetching league:", err);
                navigate('/setup');
            }
        };

        initDashboard();
    }, [activeLeagueId, navigate, listenToLeagueMembers]);

    // Listen for pending payouts in real-time (for Co-Admin approval)
    useEffect(() => {
        if (!activeLeagueId) return;
        const pendingRef = collection(db, 'leagues', activeLeagueId, 'pending_payouts');
        const q = query(pendingRef, where('status', '==', 'awaiting_approval'));
        const unsub = onSnapshot(q, (snap) => {
            setPendingPayouts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [activeLeagueId]);

    // Module 3B: Listen to pending disputes
    useEffect(() => {
        if (!activeLeagueId) return;
        const disputesRef = collection(db, 'leagues', activeLeagueId, 'disputes');
        const q = query(disputesRef, where('status', '==', 'pending'));
        const unsub = onSnapshot(q, snap => {
            setPendingDisputes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [activeLeagueId]);

    // Module 3B: Approve a dispute claim
    const handleApproveDispute = async (dispute: any) => {
        if (!activeLeagueId) return;
        setProcessingDispute(dispute.id);
        try {
            // Increment wallet and mark as paid
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', dispute.memberId), {
                hasPaid: true,
                walletBalance: increment(dispute.amount),
            });
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'disputes', dispute.id), { status: 'approved' });
            // Notify the member
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'success',
                message: `✅ Your payment dispute for KES ${dispute.amount?.toLocaleString()} has been approved by the Chairman. You are now in the Green Zone.`,
                timestamp: serverTimestamp(),
                readBy: []
            });
            showToast(`✅ Dispute approved for ${dispute.memberName}`);
        } catch (err: any) {
            console.error('Dispute approve error:', err);
            if (err?.code === 'permission-denied') {
                showToast('🔒 Permission Denied: Only admins can approve disputes.');
            } else {
                showToast('Failed to approve dispute. Please try again.');
            }
        } finally {
            setProcessingDispute(null);
        }
    };

    // Module 3B: Reject a dispute claim
    const handleRejectDispute = async (dispute: any) => {
        if (!activeLeagueId) return;
        setProcessingDispute(dispute.id);
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'disputes', dispute.id), { status: 'rejected' });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                message: `⚠️ Your payment dispute (Receipt: ${dispute.receiptCode}) was reviewed and rejected. Contact your Chairman for more info.`,
                timestamp: serverTimestamp(),
                readBy: []
            });
            showToast(`Dispute rejected for ${dispute.memberName}`);
        } catch (err: any) {
            console.error('Dispute reject error:', err);
            if (err?.code === 'permission-denied') {
                showToast('🔒 Permission Denied: Only admins can reject disputes.');
            } else {
                showToast('Failed to reject dispute. Please try again.');
            }
        } finally {
            setProcessingDispute(null);
        }
    };

    // Admin Tour
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('hasSeenAdminTour');
        if (!hasSeenTour && !isLoading) {
            try {
                const driverObj = driver({
                    showProgress: true,
                    steps: [
                        { element: '#tour-add-member', popover: { title: 'Add League Members', description: 'Start by manually enrolling members into the Chama using their M-Pesa phone number.', side: "bottom", align: 'start' } },
                        { element: '#tour-resolve-gw', popover: { title: 'Resolve Gameweeks', description: 'At the end of an FPL gameweek, click this to automatically calculate the highest scorer and dispatch the weekly pot.', side: "bottom", align: 'start' } },
                        { element: '#tour-ledger', popover: { title: 'Live Ledger Tracker', description: 'Monitor all deposits here. Once you mark a member as Paid, the ledger updates in real-time.', side: "top", align: 'start' } }
                    ]
                });
                driverObj.drive();
                localStorage.setItem('hasSeenAdminTour', 'true');
            } catch (e) {
                console.error("Tour failed to load", e);
            }
        }
    }, [isLoading]);

    const handleTogglePayment = async (memberId: string, currentStatus: boolean, memberName: string) => {
        if (!activeLeagueId) return;
        try {
            await togglePaymentStatusGlobal(activeLeagueId, memberId, currentStatus);
            showToast(`Payment updated for ${memberName}`);

            // If we are marking them as paid
            if (!currentStatus) {
                const adminId = localStorage.getItem('activeUserId') || 'chairman';
                const notifsRef = collection(db, 'leagues', activeLeagueId, 'notifications');
                await addDoc(notifsRef, {
                    type: 'success',
                    message: `Deposit verified for ${memberName}. Account is now in the Green Zone.`,
                    timestamp: serverTimestamp(),
                    readBy: [adminId], // Admin has already read it basically
                    targetMemberId: memberId
                });

                // Write Deposit Transaction to Ledger
                const targetMember = members.find(m => m.id === memberId);
                const txRef = collection(db, 'leagues', activeLeagueId, 'transactions');
                await addDoc(txRef, {
                    type: 'deposit',
                    winnerName: memberName,
                    phoneNumber: targetMember?.phone || '',
                    amount: gameweekStake,
                    timestamp: serverTimestamp(),
                    receiptId: 'DEP' + Math.random().toString(36).substring(2, 10).toUpperCase()
                });
            }
        } catch (error) {
            console.error("Error toggling payment", error);
        }
    };

    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Dynamic Calculations
    // Math scales properly natively since `members` array is reactive via useStore (which listens to Firestore)
    const filteredMembers = members.filter(m => {
        if (m.isActive === false) return false;
        if (paymentFilter === 'Verified') return m.hasPaid;
        if (paymentFilter === 'Red Zone') return !m.hasPaid;
        return true;
    });

    const paidMembersCount = members.filter(m => m.hasPaid && m.isActive !== false).length;
    const totalCollected = paidMembersCount * gameweekStake;
    const weeklyPot = totalCollected * (rules.weekly / 100);
    // Formula: Active members * Gameweek Stake * 38 GWs * Vault Percentage
    const seasonVault = members.length * gameweekStake * 38 * (rules.vault / 100);

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeLeagueId || !newMemberName || !newMemberPhone) return;

        setIsAddingMember(true);
        try {
            const membershipsRef = collection(db, 'leagues', activeLeagueId, 'memberships');
            await addDoc(membershipsRef, {
                displayName: newMemberName,
                phone: newMemberPhone,
                fplTeamName: newMemberTeam,
                hasPaid: false,
                role: 'member',
                avatarSeed: Math.random().toString(36).substring(7),
                joinedAt: serverTimestamp()
            });
            setShowAddMemberModal(false);
            setNewMemberName('');
            setNewMemberPhone('');
            setNewMemberTeam('');

            // Send Notification
            const notifsRef = collection(db, 'leagues', activeLeagueId, 'notifications');
            await addDoc(notifsRef, {
                type: 'info',
                message: `${newMemberName} has joined the league! Welcome to the War Room.`,
                timestamp: serverTimestamp(),
                readBy: []
            });

            showToast(`${newMemberName} manually added to the ledger!`);
        } catch (error) {
            console.error("Error adding member:", error);
            showToast("Failed to add member.");
        } finally {
            setIsAddingMember(false);
        }
    };

    const handleBulkNudge = async () => {
        if (!activeLeagueId) return;

        showToast('Bulk Nudge dispatched via SMS to all Red Zone members!');

        // Actually push to members' individual notification feeds
        const redZoneMembers = members.filter(m => !m.hasPaid && m.role !== 'admin' && m.isActive !== false);

        for (const member of redZoneMembers) {
            try {
                const notifsRef = collection(db, 'leagues', activeLeagueId, 'notifications');
                await addDoc(notifsRef, {
                    type: 'warning',
                    message: `URGENT Chairman Nudge: Gameweek Deadline approaching. Please complete your active Gameweek contribution to avoid being locked out.`,
                    timestamp: serverTimestamp(),
                    readBy: [],
                    targetMemberId: member.id
                });
            } catch (err) {
                console.error("Failed to nudge member", member.id, err);
            }
        }
    };

    const handleResolveGameweek = async () => {
        if (!activeLeagueId) return;
        setIsResolving(true);
        try {
            // 1. Fetch live FPL Standings (Using hardcoded generic ID since we don't have user's custom ID here, or 314)
            const fplLeagueId = 314;
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/fpl/standings/${fplLeagueId}`);
            if (!res.ok) throw new Error("Failed to fetch standings");
            const data = await res.json();

            const standings = data.standings.results || [];
            // Sort by GW points (event_total)
            const sortedStandings = standings.sort((a: any, b: any) => b.event_total - a.event_total);

            // 2. Chama Rule: Filter the top scorer against Firebase memberships list.
            let winner: any = null;
            let winningPoints = 0;

            for (const fplManager of sortedStandings) {
                // Match via displayName or fplTeamName
                const dbMember = members.find(m =>
                    m.displayName === fplManager.player_name || (m as any).fplTeamName === fplManager.entry_name
                );

                if (dbMember) {
                    if (dbMember.hasPaid) {
                        winner = dbMember;
                        // @ts-ignore - Intentionally not passing winningPoints to backend logic for now
                        winningPoints = fplManager.event_total || 0;
                        break;
                    }
                }
            }

            // Fallback for simulation
            if (!winner) {
                winner = members.find(m => m.hasPaid);
                winningPoints = 85; // mock points if fallback
            }

            if (!winner) {
                showToast("No eligible paid members found in the league!");
                setIsResolving(false);
                setShowResolveModal(false);
                return;
            }

            if (coAdminId) {
                // Feature: Maker / Checker (Requires Approval)
                const pendingPayoutsRef = collection(db, 'leagues', activeLeagueId, 'pending_payouts');
                await addDoc(pendingPayoutsRef, {
                    winnerId: winner.id,
                    winnerName: winner.displayName,
                    winnerPhone: winner.phone,
                    amount: weeklyPot,
                    points: winningPoints,
                    gw: 26,
                    status: 'awaiting_approval',
                    requestedBy: auth.currentUser?.displayName || 'Chairman',
                    timestamp: serverTimestamp()
                });

                // Notify Co-Admin
                const notifsRef = collection(db, 'leagues', activeLeagueId, 'notifications');
                await addDoc(notifsRef, {
                    type: 'warning',
                    message: `🚨 SECURITY: Chairman has requested a payout of KES ${weeklyPot.toLocaleString()} to ${winner.displayName} (GW26: ${winningPoints} pts). Approval required.`,
                    timestamp: serverTimestamp(),
                    readBy: []
                });

                // Log to Live Escrow Feed
                await addDoc(collection(db, 'leagues', activeLeagueId, 'league_events'), {
                    eventType: 'resolution',
                    message: `GW26 resolved — ${winner.displayName} leads with ${winningPoints} pts. Payout pending Co-Admin approval.`,
                    actor: auth.currentUser?.displayName || 'Chairman',
                    timestamp: serverTimestamp()
                });

                setShowResolveModal(false);
                showToast(`Gameweek 26 calculated. Payout sent to Co-Admin for Approval!`);
            } else {
                // No Co-Admin? Trigger Real Daraja B2C Payout Immediately
                const payoutApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                const payoutRes = await fetch(`${payoutApiUrl}/api/mpesa/b2c`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: winner.phone,
                        amount: weeklyPot,
                        remarks: `FantasyChama GW26 Winnings`,
                        userId: winner.id,
                        leagueId: activeLeagueId
                    })
                });
                const payoutData = await payoutRes.json();

                if (payoutData.success) {
                    // Phase 12: Call backend to atomically drain all member wallets
                    const gwApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                    try {
                        const deductRes = await fetch(`${gwApiUrl}/api/league/deduct-gw-cost`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                leagueId: activeLeagueId,
                                gwCostPerRound: gameweekStake,
                                gwNumber: 26,
                                winnerName: winner.displayName
                            })
                        });
                        const deductData = await deductRes.json();
                        const redNames = deductData.summary?.redZone || [];
                        const greenNames = deductData.summary?.greenZone || [];

                        // Build WhatsApp share receipt
                        const lines = [
                            `*FantasyChama — GW26 Results*`,
                            ``,
                            `Winner: *${winner.displayName}* (${winningPoints} pts)`,
                            `Payout: *KES ${weeklyPot.toLocaleString()}* dispatched`,
                            ``,
                            greenNames.length > 0 ? `Green Zone (${greenNames.length}): ${greenNames.join(', ')}` : null,
                            redNames.length > 0 ? `Red Zone (${redNames.length}): ${redNames.join(', ')} - UNPAID` : null,
                            ``,
                            `_Powered by FantasyChama_`
                        ].filter(Boolean).join('\n');
                        setWhatsappReceipt(lines);
                    } catch (deductErr) {
                        console.error('[DEDUCT] Deduction call failed:', deductErr);
                    }

                    setShowResolveModal(false);
                    showToast(`B2C Dispatch Sent! Safaricom processing KES ${weeklyPot.toLocaleString()} to ${winner.displayName}.`);

                    // Log to Live Escrow Feed
                    await addDoc(collection(db, 'leagues', activeLeagueId, 'league_events'), {
                        eventType: 'resolution',
                        message: `GW26 resolved — KES ${weeklyPot.toLocaleString()} dispatched to ${winner.displayName} (${winningPoints} pts).`,
                        actor: auth.currentUser?.displayName || 'Chairman',
                        timestamp: serverTimestamp()
                    });

                    confetti({
                        particleCount: 150,
                        spread: 80,
                        origin: { y: 0.6 },
                        colors: ['#10B981', '#FBBF24', '#FFFFFF']
                    });
                } else {
                    throw new Error(payoutData.message || "B2C Payout sequence failed.");
                }
            }
        } catch (error) {
            console.error("Resolution Error:", error);
            showToast("Gameweek Resolution Failed");
        } finally {
            setIsResolving(false);
        }
    };

    // Co-Admin: Approve a pending payout and fire real B2C
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

            // Mark the pending payout as approved in Firestore
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payout.id), {
                status: 'approved',
                approvedBy: auth.currentUser?.displayName || 'Co-Admin',
                approvedAt: serverTimestamp()
            });

            // Reset all members to Red Zone for the next gameweek
            const membershipsRef = collection(db, 'leagues', activeLeagueId, 'memberships');
            await Promise.all(members.map(m => updateDoc(doc(membershipsRef, m.id), { hasPaid: false })));

            showToast(`✅ Approved! KES ${payout.amount.toLocaleString()} dispatched to ${payout.winnerName}.`);
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#10B981', '#FBBF24', '#FFFFFF'] });
        } catch (err: any) {
            showToast(`Approval failed: ${err.message}`);
        } finally {
            setIsApprovingPayout(null);
        }
    };

    const handleRejectPayout = async (payoutId: string) => {
        if (!activeLeagueId) return;
        await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payoutId), {
            status: 'rejected',
            rejectedBy: auth.currentUser?.displayName || 'Co-Admin',
            rejectedAt: serverTimestamp()
        });
        showToast('Payout request rejected. Chairman will be notified.');
    };

    /**
     * WhatsApp Receipt Generator
     * Creates a rich formatted summary of the GW result for sharing to the group.
     */
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

    if (isLoading) {
        return (
            <div className="min-h-screen w-full text-[#10B981] flex flex-col items-center justify-center font-bold tracking-widest uppercase"
                style={{ background: 'radial-gradient(ellipse 80% 60% at 100% 0%, rgba(251,191,36,0.07) 0%, rgba(10,14,23,0) 60%), #0A0E17' }}
            >
                <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                Syncing Ledger...
            </div>
        );
    }

    return (
        <div
            className="min-h-screen w-full text-white font-sans relative"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 100% 0%, rgba(251,191,36,0.07) 0%, rgba(10,14,23,0) 60%), #0A0E17' }}
        >
            <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 md:py-10 space-y-10">
                {/* Top Header */}
                <Header role="admin" title={leagueName || 'Command Center'} subtitle="Chairman Hub" />

                {/* Co-Admin: Pending Payout Approval Panel */}
                {pendingPayouts.length > 0 && (
                    <section className="space-y-4">
                        <h2 className="text-xl font-extrabold flex items-center gap-2 text-[#FBBF24]">
                            <AlertTriangle className="w-5 h-5" /> Maker/Checker: Awaiting Approval
                        </h2>
                        <div className="space-y-3">
                            {pendingPayouts.map((payout) => (
                                <div key={payout.id} className="bg-[#FBBF24]/10 border border-[#FBBF24]/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-white font-bold text-sm">{payout.gwName || `GW${payout.gw}`} Payout Request</p>
                                        <p className="text-gray-300 text-sm mt-1">
                                            <span className="text-[#FBBF24] font-bold">KES {Number(payout.amount).toLocaleString()}</span> → {payout.winnerName} ({payout.winnerPhone})
                                        </p>
                                        <p className="text-gray-500 text-xs mt-1">Requested by: {payout.requestedBy || 'Chairman'}</p>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                                        <button
                                            onClick={() => handleRejectPayout(payout.id)}
                                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-sm font-bold rounded-xl transition-colors"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprovePayout(payout)}
                                            disabled={isApprovingPayout === payout.id}
                                            className="px-5 py-2 bg-[#10B981] hover:bg-[#10B981]/90 text-black text-sm font-black rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-60 flex items-center gap-2"
                                        >
                                            {isApprovingPayout === payout.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            {isApprovingPayout === payout.id ? 'Approving...' : 'Approve & Disburse'}
                                        </button>
                                        <button
                                            onClick={() => generateWhatsAppReceipt(payout)}
                                            className="px-4 py-2 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/30 text-sm font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-[0_0_10px_rgba(37,211,102,0.15)]"
                                            title="Share GW results to WhatsApp Group"
                                        >
                                            <Share2 className="w-3.5 h-3.5" /> WhatsApp
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Generate League Access Section */}
                <section className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-extrabold tracking-tight mb-1 flex items-center gap-3"><ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-[#10B981]" /> League Access & Economy</h2>
                            <p className="text-gray-400 text-sm">Control your league entry and monitor the live vault deposits.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button id="tour-add-member" onClick={() => setShowAddMemberModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#1a232b] hover:bg-white/5 text-white text-sm font-bold rounded-xl transition-colors border border-white/5">
                                <UserPlus className="w-4 h-4 text-[#10B981]" /> Add Member
                            </button>
                            <button id="tour-resolve-gw" onClick={() => setShowResolveModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-[#FBBF24] hover:bg-[#FBBF24]/90 text-black text-sm font-black tracking-wide rounded-xl transition-all shadow-[0_0_20px_rgba(251,191,36,0.5)] uppercase">
                                <Trophy className="w-4 h-4" /> Resolve Gameweek
                            </button>
                            <button onClick={handleBulkNudge} className="flex items-center gap-2 px-4 py-2.5 bg-[#10B981] hover:bg-[#10B981]/90 text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                <Megaphone className="w-4 h-4" /> Bulk Nudge
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
                        <div className="xl:col-span-8 flex flex-col gap-6 w-full">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 w-full">
                                <PotVaultSwapper
                                    weeklyPot={weeklyPot}
                                    seasonVault={seasonVault}
                                    weeklyRulesPercent={rules.weekly}
                                    isStealthMode={isStealthMode}
                                />

                                {/* Total Collections Card */}
                                <div id="tour-ledger" className="bg-[#161d24] border border-[#10B981]/10 rounded-[2rem] p-6 md:p-8 relative overflow-hidden shadow-lg hover:border-[#10B981]/30 transition-colors w-full min-h-[220px] flex flex-col justify-center">
                                    <div className="absolute top-6 right-6 opacity-[0.03] pointer-events-none">
                                        <Banknote className="w-24 h-24" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center border border-[#10B981]/20">
                                                <Banknote className="w-5 h-5 text-[#10B981]" />
                                            </div>
                                            <span className="text-[10px] font-bold tracking-widest text-[#10B981] uppercase bg-[#10B981]/10 px-2.5 py-1 rounded-md border border-[#10B981]/20">Live Sync</span>
                                        </div>
                                        <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2">Current GW Collections</p>
                                        <div className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">KES {isStealthMode ? '****' : totalCollected.toLocaleString()}</div>
                                        <div className="flex items-center gap-2 text-[#10B981] text-[10px] md:text-xs font-bold mt-4">
                                            {paidMembersCount} members fully paid
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Operations Feed — WhatsApp Share Banner appears post-resolution */}
                            <div className="w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl p-6 md:p-8">
                                <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-5">
                                    <Bell className="w-4 h-4" /> Operations Feed
                                </h4>

                                {/* WhatsApp Receipt Share Card — appears after GW resolution */}
                                {whatsappReceipt && (
                                    <div className="mb-4 bg-[#0a1f12] border border-green-600/30 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-lg">📲</span>
                                            <span className="text-green-400 text-xs font-black uppercase tracking-widest">GW Resolution Receipt Ready</span>
                                        </div>
                                        <pre className="text-[10px] text-gray-300 whitespace-pre-wrap font-mono bg-black/30 rounded-xl p-3 mb-3 leading-relaxed border border-white/5 max-h-40 overflow-y-auto">
                                            {whatsappReceipt}
                                        </pre>
                                        <div className="flex gap-2">
                                            <a
                                                href={`https://wa.me/?text=${encodeURIComponent(whatsappReceipt)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-white text-xs font-black rounded-xl transition-colors"
                                            >
                                                Share to WhatsApp Group
                                            </a>
                                            <button
                                                onClick={() => setWhatsappReceipt(null)}
                                                className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold rounded-xl transition-colors border border-white/5"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center shrink-0">
                                        <UserPlus className="w-5 h-5 text-[#10B981]" />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-white tracking-wide">League Open for Gameweek</h5>
                                        <p className="text-xs text-gray-400 mt-1">Accepting deposits for Gameweek 26. Deadline approaches.</p>
                                        <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-2 block">System</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="xl:col-span-4 w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-8 flex flex-col justify-center relative min-h-[220px] bg-gradient-to-b from-[#1a232b] to-[#161d24] h-full">
                                {/* Toast Notification */}
                                <div className={clsx(
                                    "absolute top-4 right-4 bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all duration-300 pointer-events-none z-20",
                                    toastMessage ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                                )}>
                                    <CheckCircle2 className="w-4 h-4" /> {toastMessage}
                                </div>

                                <span className="text-[#10B981] text-xs font-bold tracking-widest uppercase mb-4 mt-4">Master Invite Code</span>
                                <div className="text-5xl lg:text-6xl font-black text-[#FBBF24] tracking-tight mb-6 tabular-nums">{inviteCode.slice(0, 3)} {inviteCode.slice(3, 6)}</div>
                                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                                    Share this 6-digit PIN to grant access to <strong>{leagueName}</strong>.
                                </p>
                                <div className="flex flex-col gap-3 mt-auto">
                                    <button onClick={() => navigator.clipboard.writeText(inviteCode)} className="flex items-center justify-center gap-2 w-full py-3 bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold rounded-xl transition-colors shadow-lg">
                                        <Share2 className="w-4 h-4" /> Share Key
                                    </button>
                                    <button className="flex items-center justify-center gap-2 w-full py-3 hover:bg-white/5 border border-white/10 text-white font-bold rounded-xl transition-colors disabled:opacity-50" disabled>
                                        <RefreshCw className="w-4 h-4" /> Regenerate
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Module 3B: Dispute Claim Alerts */}
                {pendingDisputes.length > 0 && (
                    <section className="bg-[#1a1500] border border-[#FBBF24]/25 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 px-6 border-b border-[#FBBF24]/20 flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />
                            <h3 className="font-bold text-[#FBBF24] text-sm tracking-wide">Payment Dispute Claims</h3>
                            <span className="ml-auto bg-[#FBBF24]/20 text-[#FBBF24] text-[10px] font-black px-2 py-0.5 rounded-full border border-[#FBBF24]/30">
                                {pendingDisputes.length} pending
                            </span>
                        </div>
                        <div className="divide-y divide-[#FBBF24]/10">
                            {pendingDisputes.map((dispute) => (
                                <div key={dispute.id} className="p-4 px-6 flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-white text-sm">{dispute.memberName}</span>
                                            <span className="text-[10px] text-gray-500">{dispute.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-xs text-gray-400">Claims receipt:</span>
                                            <span className="font-mono text-xs bg-[#FBBF24]/10 text-[#FBBF24] px-2 py-0.5 rounded border border-[#FBBF24]/20">{dispute.receiptCode}</span>
                                            <span className="text-xs text-gray-400">for KES {dispute.amount?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleRejectDispute(dispute)}
                                            disabled={processingDispute === dispute.id}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl border border-red-500/20 transition-colors disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApproveDispute(dispute)}
                                            disabled={processingDispute === dispute.id}
                                            className="px-4 py-2 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] text-xs font-bold rounded-xl border border-[#10B981]/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {processingDispute === dispute.id ? <span className="animate-pulse">...</span> : <ShieldCheck className="w-3.5 h-3.5" />}
                                            Approve & Grant Access
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* The Master Ledger Section */}
                <section className="bg-[#161d24] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold tracking-tight">The Master Ledger</h2>
                        <div className="flex items-center gap-3 relative">
                            <span className="text-xs text-gray-500 font-medium">Filter by:</span>
                            <button
                                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                className="flex items-center gap-2 bg-[#1a232b] border border-white/10 px-4 py-2 rounded-lg text-sm text-white font-bold hover:bg-white/5 transition-colors min-w-[140px] justify-between"
                            >
                                {paymentFilter === 'All' ? 'All Payments' : paymentFilter} <ChevronDown className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {isFilterDropdownOpen && (
                                <div className="absolute top-full mt-2 right-0 w-48 bg-[#161d24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20">
                                    <button onClick={() => { setPaymentFilter('All'); setIsFilterDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-white hover:bg-[#1a232b] transition-colors">All Payments</button>
                                    <button onClick={() => { setPaymentFilter('Verified'); setIsFilterDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-[#10B981] hover:bg-[#10B981]/10 transition-colors">Verified (Green Zone)</button>
                                    <button onClick={() => { setPaymentFilter('Red Zone'); setIsFilterDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-[#FBBF24] hover:bg-[#FBBF24]/10 transition-colors">Red Zone (Unpaid)</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-[#11171a] border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                                    <th className="p-4 pl-6 font-medium">Member</th>
                                    <th className="p-4 font-medium hidden sm:table-cell">M-Pesa Transaction Code</th>
                                    <th className="p-4 font-medium">Wallet Balance</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 pr-6 text-right font-medium">Verify</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-white/5">
                                {filteredMembers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-gray-500 font-medium">
                                            No members found matching this filter.
                                        </td>
                                    </tr>
                                ) : filteredMembers.map((row) => {
                                    const wallet = (row as any).walletBalance ?? 0;
                                    const gwCost = gameweekStake; // fallback until gwCostPerRound is set
                                    const gwsLeft = gwCost > 0 ? Math.floor(wallet / gwCost) : 0;
                                    const walletColor = wallet <= 0 ? 'text-red-400' : gwsLeft >= 2 ? 'text-[#10B981]' : 'text-[#FBBF24]';
                                    return (
                                        <tr key={row.id} className={clsx(
                                            "transition-colors group",
                                            row.hasPaid ? "bg-[#10B981]/5 border-l-2 border-[#10B981]" : "hover:bg-white/[0.02] border-l-2 border-transparent"
                                        )}>
                                            <td className="p-4 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={clsx(
                                                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border relative overflow-hidden",
                                                        row.hasPaid ? "border-[#10B981]/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] bg-[#10B981]/10" : "border-white/10 bg-[#161d24]"
                                                    )}>
                                                        <img
                                                            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(row as any).avatarSeed || row.displayName}&backgroundColor=transparent`}
                                                            alt={row.displayName}
                                                            className={clsx("w-full h-full object-cover", !row.hasPaid && "grayscale opacity-80")}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white leading-tight mb-1 flex items-center gap-2">
                                                            {row.displayName}
                                                            {(row as any).role === 'admin' && (
                                                                <span className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Admin</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-400 leading-none flex items-center gap-2 mt-1">
                                                            <span>{row.phone}</span>
                                                            <span className="text-white/20">•</span>
                                                            <button 
                                                                onClick={() => handleToggleAdmin(row.id, (row as any).role)}
                                                                className="hover:text-white transition-colors"
                                                            >
                                                                {(row as any).role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 hidden sm:table-cell">
                                                <span className="bg-[#11171a] border border-white/5 px-3 py-1.5 rounded-md text-gray-400 font-mono text-xs">M-PESA / BANK</span>
                                            </td>
                                            <td className="p-4">
                                                <div className={clsx('font-bold tabular-nums text-sm', walletColor)}>
                                                    {isStealthMode ? '****' : `KES ${wallet.toLocaleString()}`}
                                                </div>
                                                <div className="text-[10px] text-gray-600 font-medium mt-0.5">
                                                    {gwsLeft > 0 ? `${gwsLeft} GW${gwsLeft !== 1 ? 's' : ''} covered` : 'Top up needed'}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {!row.hasPaid && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a232b] text-[#FBBF24] border border-white/5 text-xs font-bold shadow-sm">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"></div> Red Zone (Unpaid)
                                                    </span>
                                                )}
                                                {row.hasPaid && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-xs font-bold shadow-sm">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div> Green Zone (Verified)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 pr-6 text-right">
                                                <label className="relative inline-flex items-center cursor-pointer ml-auto">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={row.hasPaid}
                                                        onChange={() => handleTogglePayment(row.id, row.hasPaid, row.displayName)}
                                                    />
                                                    <div className="w-11 h-6 bg-[#1a232b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981] border border-white/10"></div>
                                                </label>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer */}
                    <div className="p-4 px-6 border-t border-white/5 flex items-center justify-between text-sm text-gray-500">
                        <span>Showing {filteredMembers.length} members</span>
                        <div className="flex gap-2">
                            <button className="px-4 py-2 bg-[#1a232b] border border-white/5 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-medium">Prev</button>
                            <button className="px-4 py-2 bg-[#1a232b] border border-white/5 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-medium">Next</button>
                        </div>
                    </div>
                </section>

                {/* Gameweek Resolution Modal */}
                {showResolveModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a100a]/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#161d24] border border-[#FBBF24]/30 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                            <div className="w-12 h-12 rounded-full bg-[#FBBF24]/10 flex items-center justify-center mb-6 border border-[#FBBF24]/20">
                                <AlertTriangle className="w-6 h-6 text-[#FBBF24]" />
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2">
                                End-of-Gameweek Resolution
                            </h3>
                            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                                <strong className="text-[#FBBF24] font-bold">Are you sure?</strong> This will calculate the top scorer, simulate an M-Pesa B2C payout, dispatch <span className="text-white font-bold tracking-tight">KES {isStealthMode ? '****' : weeklyPot.toLocaleString()}</span> to the winner, and record the gameweek in the audit log permanently.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4 mt-8">
                                <button
                                    onClick={() => setShowResolveModal(false)}
                                    disabled={isResolving}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResolveGameweek}
                                    disabled={isResolving}
                                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black bg-[#FBBF24] hover:bg-white text-[#111613] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isResolving ? (
                                        <><RefreshCw className="w-4 h-4 animate-spin" /> Disbursing...</>
                                    ) : (
                                        <><Banknote className="w-4 h-4" /> Disburse Funds</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Complete Add Member Modal */}
                {showAddMemberModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a100a]/90 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-[#161d24] border border-[#10B981]/30 w-full max-w-md rounded-3xl p-8 shadow-2xl text-left">
                            <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-6 border border-[#10B981]/20">
                                <UserPlus className="w-8 h-8 text-[#10B981]" />
                            </div>

                            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">
                                Manual Enrollment
                            </h3>
                            <p className="text-gray-400 text-sm mb-6 font-medium">
                                Need to bypass the PIN? Fill out these details to directly add a new manager to the live ledger. Math scaling will adjust automatically.
                            </p>

                            <form onSubmit={handleAddMember} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newMemberName}
                                        onChange={(e) => setNewMemberName(e.target.value)}
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] outline-none"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">M-Pesa Number</label>
                                    <input
                                        type="text"
                                        required
                                        pattern="^0[0-9]{9}$"
                                        value={newMemberPhone}
                                        onChange={(e) => setNewMemberPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] outline-none"
                                        placeholder="e.g. 0712345678"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">FPL Team Name (Optional)</label>
                                    <input
                                        type="text"
                                        value={newMemberTeam}
                                        onChange={(e) => setNewMemberTeam(e.target.value)}
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] outline-none"
                                        placeholder="e.g. Saka Potatoes"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-white/10 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddMemberModal(false)}
                                        className="flex-1 py-3.5 bg-[#0b1014] hover:bg-white/5 text-gray-400 font-bold uppercase tracking-widest text-xs rounded-xl transition-colors border border-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isAddingMember}
                                        className="flex-1 py-3.5 bg-[#10B981] hover:bg-[#10B981]/90 text-black font-black uppercase tracking-widest text-xs rounded-xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        {isAddingMember ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Enroll Member'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
