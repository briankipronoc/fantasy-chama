import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Header from '../components/Header';
import { Trophy, BarChart3, Banknote, ShieldCheck, AlertCircle, Zap, Check, Activity, Terminal, AlertTriangle, RefreshCw, CheckCircle2, Share2, Star, Send, Shield, Smartphone, Wallet } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, where, updateDoc, orderBy, limit, arrayUnion } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import { getApiBaseUrl } from '../utils/api';
import { useNotifications } from '../components/NotificationProvider';
import PotVaultSwapper from '../components/PotVaultSwapper';
import clsx from 'clsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardSkeleton } from '../components/Skeleton';

export default function MemberDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserIdStored = localStorage.getItem('activeUserId');
    const memberPhone = localStorage.getItem('memberPhone');

    const [gameweekStake, setMonthlyContribution] = useState(0);
    const [leagueName, setLeagueName] = useState('');
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });
    const [coAdminId, setCoAdminId] = useState<string | null>(null);
    const [chairmanPhone, setChairmanPhone] = useState<string | null>(null);
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

    // Wallet top-up + winnings credit request state
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState(0);
    const [topUpNote, setTopUpNote] = useState('');
    const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);
    const [isRequestingWalletCredit, setIsRequestingWalletCredit] = useState(false);

    // Module 4A: Winner confirmation state
    const [winnerConfirmation, setWinnerConfirmation] = useState<any>(null);

    // Phase 10.5: Live Escrow Feed
    const [liveEvents, setLiveEvents] = useState<any[]>([]);

    // Phase 29: Winner's Circle logic
    const [gwWinner, setGwWinner] = useState<any>(null);
    const [currentFplEvent, setCurrentFplEvent] = useState<{ id: number; finished: boolean } | null>(null);

    // Phase 30: Expanded Winner's Circle
    const [showAllWinners, setShowAllWinners] = useState(false);
    const [showWinnersPanelMobile, setShowWinnersPanelMobile] = useState(false);
    const [showFeedPanelMobile, setShowFeedPanelMobile] = useState(false);

    // Phase 31: Real FPL Performance Trajectory
    const [performanceData, setPerformanceData] = useState<any[]>([]);

    // Co-Admin State
    const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
    const [isApprovingPayout, setIsApprovingPayout] = useState<string | null>(null);
    const [nudgeSent, setNudgeSent] = useState(false);
    const [userLeagueCount, setUserLeagueCount] = useState(1);
    const [activeLeagueRole, setActiveLeagueRole] = useState<string>('member');
    const [showLeagueGuide, setShowLeagueGuide] = useState(false);

    const members = useStore(state => state.members);
    const transactions = useStore(state => state.transactions);
    const logout = useStore(state => state.logout);
    const leagueSettings = useStore(state => state.league);
    
    // Auto-Lockout: 48 Hour Grace Period
    const pendingHQDebt = leagueSettings?.pendingHQDebt || 0;
    const lastResolvedTS = leagueSettings?.lastResolvedDate;
    const lastResolvedDate = lastResolvedTS?.toDate ? lastResolvedTS.toDate() : new Date();
    const isGracePeriodOver = pendingHQDebt > 0 && (Date.now() - lastResolvedDate.getTime()) > (2 * 24 * 60 * 60 * 1000);
    const isSuspended = leagueSettings?.isSuspended === true || isGracePeriodOver;
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);
    const listenToLeagueTransactions = useStore(state => state.listenToLeagueTransactions);
    const [showPochiInstructions, setShowPochiInstructions] = useState(false);
    const [isNudgingHQ, setIsNudgingHQ] = useState(false);


    const handleNudgeHQ = async () => {
        if (!activeLeagueId || !currentUser) return;
        setIsNudgingHQ(true);
        try {
            const leagueRef = doc(db, 'leagues', activeLeagueId);
            await updateDoc(leagueRef, {
                suspensionNudges: arrayUnion(currentUser.displayName.split(' ')[0])
            });
            showToast("Chairman has been aggressively nudged.", "success");
        } catch (error) {
            console.error("Nudge Error:", error);
            showToast("Failed to nudge Chairman.", "error");
        } finally {
            setIsNudgingHQ(false);
        }
    };
    const isStealthMode = useStore(state => state.isStealthMode);
    const { notifications } = useNotifications();

    const currentUser = members.find(m => m.id === activeUserIdStored) || members.find(m => m.phone === memberPhone);
    const chairmanMember = members.find((member) => {
        const role = (member as any).role;
        return member.id === coAdminId || role === 'admin' || role === 'chairman';
    });
    const walletBalance = currentUser?.walletBalance || 0;
    const hasPaid = currentUser?.hasPaid || (gameweekStake > 0 && walletBalance >= gameweekStake);
    const activeUserId = currentUser?.id || 'dummy';
    const coChairMember = members.find(m => m.id === coAdminId);
    const payoutApproverId = coAdminId
        && coAdminId !== activeUserId
        && coChairMember
        && coChairMember.isActive !== false
        && (((coChairMember as any).role === 'admin') || ((coChairMember as any).role === 'co-chair'))
        ? coAdminId
        : null;

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
                setMonthlyContribution(data.gameweekStake || 0);
                setLeagueName(data.leagueName || '');
                if (data.rules) setRules(data.rules);
                setCoAdminId(data.coAdminId || null);
                setChairmanPhone(data.chairmanPhone || null);

                // Phase 29: Fetch FPL GW Winner continuously
                if (data.fplLeagueId) {
                    fetch(`https://corsproxy.io/?${encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${data.fplLeagueId}/standings/`)}`)
                        .then(res => res.json())
                        .then(fplData => {
                            const results = fplData?.standings?.results;
                            if (results && results.length > 0) {
                                const winner = results.reduce((prev: any, current: any) => (prev.event_total > current.event_total) ? prev : current);
                                setGwWinner(winner);

                                // Build league-wide GW average from all entries' history
                                const fetchPerformances = async () => {
                                    let aggData: any[] = [];
                                    
                                    const teamIds = [];
                                    if (currentUser?.fplTeamId) teamIds.push(currentUser.fplTeamId);
                                    if (currentUser?.secondFplTeamId) teamIds.push(currentUser.secondFplTeamId);

                                    if (teamIds.length === 0) return;

                                    for (const tId of teamIds) {
                                        try {
                                            const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://fantasy.premierleague.com/api/entry/${tId}/history/`)}`);
                                            const histData = await r.json();
                                            const current = histData?.current;
                                            if (current && current.length > 0) {
                                                const recent = current.slice(-5);
                                                const leagueAvg = results.length > 0
                                                    ? Math.round(results.reduce((s: number, curRes: any) => s + curRes.event_total, 0) / results.length)
                                                    : 50;
                                                
                                                aggData = recent.map((gw: any, index: number) => {
                                                    const existing = aggData[index] || { name: `GW${gw.event}`, Average: leagueAvg };
                                                    return {
                                                        ...existing,
                                                        [`Team ${tId}`]: gw.points
                                                    };
                                                });
                                            }
                                        } catch (e) {
                                            console.error('Error fetching performance:', e);
                                        }
                                    }
                                    if (aggData.length > 0) setPerformanceData(aggData);
                                };
                                fetchPerformances();
                            }
                        })
                        .catch(err => console.error("Could not fetch FPL winner:", err));
                }
            }
        }, (err: any) => {
            console.error("Error listening to league:", err);
            navigate('/login');
        });

        // Initialize Live Ledger for Members
        const unsubscribeMembers = listenToLeagueMembers(activeLeagueId);
        const unsubscribeTransactions = listenToLeagueTransactions(activeLeagueId);

        // Update lastLoginAt for retention tracking
        if (activeUserId && activeUserId !== 'dummy') {
            const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', activeUserId);
            updateDoc(memberRef, { 
                lastLoginAt: serverTimestamp() 
            }).catch(e => console.error("Failed to update last login", e));
        }

        if (location.state?.welcomeMsg) {
            setToastMessage(location.state.welcomeMsg);
            setToastType('success');
            setTimeout(() => setToastMessage(''), 4000);
            window.history.replaceState({}, document.title);
        }

        return () => {
            try {
                unsubscribeLeague();
            } catch (error: any) {
                console.warn('[member-dashboard] unsubscribeLeague failed:', error?.message || error);
            }
            try {
                unsubscribeMembers();
            } catch (error: any) {
                console.warn('[member-dashboard] unsubscribeMembers failed:', error?.message || error);
            }
            try {
                unsubscribeTransactions();
            } catch (error: any) {
                console.warn('[member-dashboard] unsubscribeTransactions failed:', error?.message || error);
            }
        };
    }, [activeLeagueId, memberPhone, navigate, listenToLeagueMembers, listenToLeagueTransactions, location.state, currentUser?.fplTeamId, currentUser?.secondFplTeamId]);

    useEffect(() => {
        if (members.length === 0) return;
        if (!currentUser) return;
        if (!leagueName) return;
        setIsLoading(false);
    }, [members.length, currentUser, leagueName]);

    useEffect(() => {
        const fetchCurrentEvent = async () => {
            try {
                const bootstrapUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
                const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(bootstrapUrl)}`);
                if (!response.ok) return;
                const data = await response.json();
                const current = (data?.events || []).find((event: any) => event.is_current);
                if (current?.id) {
                    setCurrentFplEvent({
                        id: current.id,
                        finished: current.finished === true,
                    });
                }
            } catch (err) {
                console.warn('Could not fetch current FPL event', err);
            }
        };

        fetchCurrentEvent();
    }, []);

    // Phase 10.5: Real-time Live Escrow Feed from league_events
    useEffect(() => {
        if (!activeLeagueId) return;
        const eventsRef = collection(db, 'leagues', activeLeagueId, 'league_events');
        const q = query(eventsRef, orderBy('timestamp', 'desc'), limit(20));
        const unsub = onSnapshot(q, snap => {
            setLiveEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => {
            console.warn('[member-dashboard] live events listener failed:', error?.message || error);
        });
        return () => {
            try {
                unsub();
            } catch (error: any) {
                console.warn('[member-dashboard] live events unsubscribe failed:', error?.message || error);
            }
        };
    }, [activeLeagueId]);

    // Co-Chair: Listen for Pending Payouts
    useEffect(() => {
        if (!activeLeagueId || currentUser?.id !== coAdminId) return;
        const q = query(
            collection(db, 'leagues', activeLeagueId, 'pending_payouts'),
            where('status', '==', 'awaiting_approval')
        );
        const unsub = onSnapshot(q, snap => {
            setPendingPayouts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.warn('[member-dashboard] pending payouts listener failed:', error?.message || error);
        });
        return () => {
            try {
                unsub();
            } catch (error: any) {
                console.warn('[member-dashboard] pending payouts unsubscribe failed:', error?.message || error);
            }
        };
    }, [activeLeagueId, currentUser?.id, coAdminId]);

    useEffect(() => {
        if (!memberPhone) return;
        const leaguesRef = doc(db, 'userLeagues', memberPhone);
        const unsub = onSnapshot(leaguesRef, (snap) => {
            if (!snap.exists()) {
                setUserLeagueCount(1);
                setActiveLeagueRole('member');
                return;
            }

            const data = snap.data();
            const leagues = Array.isArray(data?.leagues) ? data.leagues : [];
            setUserLeagueCount(Math.max(1, leagues.length));

            const selected = leagues.find((league: any) => league?.leagueId === activeLeagueId);
            setActiveLeagueRole(selected?.role || 'member');
        }, (error) => {
            console.warn('[member-dashboard] user leagues listener failed:', error?.message || error);
        });

        return () => {
            try {
                unsub();
            } catch (error: any) {
                console.warn('[member-dashboard] user leagues unsubscribe failed:', error?.message || error);
            }
        };
    }, [activeLeagueId, memberPhone]);

    useEffect(() => {
        if (!activeLeagueId) return;
        const hasDualTeam = Boolean(currentUser?.secondFplTeamId);
        const shouldGuide = userLeagueCount > 1 || hasDualTeam;
        const guideKey = `fc-member-league-guide-dismissed-${activeLeagueId}-${activeUserId}`;
        const dismissed = localStorage.getItem(guideKey) === 'true';
        setShowLeagueGuide(shouldGuide && !dismissed);
    }, [activeLeagueId, activeUserId, currentUser?.secondFplTeamId, userLeagueCount]);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => setToastMessage(''), 3000);
    };

    const handleMpesaSTKPush = async (amount = gameweekStake) => {
        if (!activeLeagueId || !currentUser || !memberPhone) return;
        setIsSubmittingTopUp(true);
        setIsPushingMpesa(true);
        try {
            const apiUrl = getApiBaseUrl();
            if (!apiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
            const requestAmount = Math.max(1, Math.floor(Number(amount || 0)));
            const response = await fetch(`${apiUrl}/api/mpesa/stkpush`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: memberPhone,
                    amount: requestAmount,
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
            const message = (error as any)?.message || '';
            if (/failed to fetch|networkerror|network error|load failed/i.test(message)) {
                showToast("Network Error: Could not reach payment server.", "error");
            } else {
                showToast(`Top-up failed: ${message || 'Unknown error'}`, "error");
            }
        } finally {
            setIsPushingMpesa(false);
            setIsSubmittingTopUp(false);
        }
    };

    const handleReceiptQuery = async () => {
        if (!receiptCode.trim() || !activeUserId || !activeLeagueId) return;
        setIsQueryingReceipt(true);
        setReceiptResult(null);
        try {
            const apiUrl = getApiBaseUrl();
            if (!apiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
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

    const handleRequestWalletCredit = async () => {
        if (!activeLeagueId || !currentUser) return;

        const amount = Math.max(1, Math.floor(Number(topUpAmount || 0)));
        if (amount <= 0) {
            showToast('Enter a valid amount before sending the request.', 'error');
            return;
        }

        setIsRequestingWalletCredit(true);
        try {
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                message: `${currentUser.displayName} requested KES ${amount.toLocaleString()} wallet credit${topUpNote.trim() ? ` — ${topUpNote.trim()}` : ''}. Please credit the wallet from winnings or reconcile manually.`,
                timestamp: serverTimestamp(),
                readBy: [],
                targetMemberId: chairmanMember?.id || coAdminId || undefined
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'wallet_topup_requests'), {
                memberId: currentUser.id,
                memberName: currentUser.displayName,
                amount,
                note: topUpNote.trim() || null,
                status: 'pending',
                source: 'winnings_request',
                requestedAt: serverTimestamp(),
                requestedById: currentUser.id,
                requestedByName: currentUser.displayName,
                targetMemberId: chairmanMember?.id || coAdminId || null
            });

            showToast('Wallet credit request sent to the Chairman.', 'success');
            setShowTopUpModal(false);
            setTopUpNote('');
        } catch (error: any) {
            console.error('Wallet credit request failed:', error);
            showToast(`Could not send request: ${error?.message || 'Unknown error'}`, 'error');
        } finally {
            setIsRequestingWalletCredit(false);
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
                amount: gameweekStake,
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

    const handleNudge = async () => {
        if (!activeLeagueId) return;
        if (!payoutApproverId) {
            showToast('No Co-Chair assigned. Chairman executes payouts directly.', 'info');
            return;
        }
        
        const history = JSON.parse(localStorage.getItem(`nudge_${activeLeagueId}`) || "[]");
        if (history.length >= 3) {
            showToast('Maximum 3 nudges reached for this payout.', 'error');
            return;
        }
        
        const cooldowns = [0, 60000, 600000, 36000000]; // 0m, 1m, 10m, 10h
        const currentCooldown = cooldowns[history.length];
        
        if (history.length > 0) {
            const timePassed = Date.now() - history[history.length - 1];
            if (timePassed < currentCooldown) {
                const rem = currentCooldown - timePassed;
                const remainingStr = rem < 60000 ? `${Math.ceil(rem/1000)}s` : 
                                     rem < 3600000 ? `${Math.ceil(rem/60000)}m` : 
                                     `${Math.ceil(rem/3600000)}h`;
                showToast(`Cooldown active. Wait ${remainingStr} before nudging again.`, 'error');
                return;
            }
        }

        const newHistory = [...history, Date.now()];
        localStorage.setItem(`nudge_${activeLeagueId}`, JSON.stringify(newHistory));
        setNudgeSent(true); 
        
        await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
            type: 'warning',
            message: `🔔 The members are nudging the Co-Chair to approve the pending payout (${newHistory.length}/3)! Please review ASAP.`,
            timestamp: serverTimestamp(),
            readBy: [],
            targetMemberId: payoutApproverId
        });
        showToast('Nudge sent! The Co-Chair has been notified.', 'success');
        
        setTimeout(() => setNudgeSent(false), 2000);
    };

    // Co-Chair: Approve Payout
    const handleApprovePayout = async (payout: any) => {
        if (!activeLeagueId) return;
        setIsApprovingPayout(payout.id);
        try {
            const payoutApiUrl = getApiBaseUrl();
            if (!payoutApiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
            const res = await fetch(`${payoutApiUrl}/api/mpesa/b2c`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: payout.winnerPhone,
                    amount: payout.amount,
                    winnerName: payout.winnerName,
                    remarks: `FantasyChama GW${payout.gw} Approved Payout`,
                    userId: payout.winnerId,
                    leagueId: activeLeagueId
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payout.id), {
                status: 'approved',
                approvedBy: currentUser?.displayName || 'Co-Chair',
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
            rejectedBy: currentUser?.displayName || 'Co-Chair',
            rejectedAt: serverTimestamp()
        });
        showToast('Payout request rejected. Chairman will be notified.');
    };

    const generateWhatsAppReceipt = (payout: any) => {
        const unpaidCount = members.filter(m => !m.hasPaid && m.role !== 'admin' && m.isActive !== false).length;
        const appUrl = import.meta.env.VITE_APP_URL || 'https://fantasy-chama.vercel.app';

        const grossPot = payout.amount / 0.9;
        const totalFee = grossPot * 0.1;
        const chairmanCut = coAdminId ? grossPot * 0.025 : grossPot * 0.035;
        const coAdminCut = coAdminId ? grossPot * 0.01 : 0;

        const message = [
            `🏆 *${leagueName} — ${payout.gwName || `GW${payout.gw}`} Results*`,
            ``,
            `🥇 *Winner:* ${payout.winnerName} (${payout.points} pts)`,
            `💰 *Payout:* KES ${Number(payout.amount).toLocaleString()} _(Dispatched via M-Pesa ✅)_`,
            `🚨 *Red Zone:* ${unpaidCount} member${unpaidCount !== 1 ? 's' : ''} yet to deposit for next GW.`,
            ``,
            `🛡️ *Admin/Escrow Fee (10%):* KES ${Math.round(totalFee).toLocaleString()}`,
            `👑 *Chairman Cut:* KES ${Math.round(chairmanCut).toLocaleString()}`,
            `👁️ *Co-Chair Cut:* KES ${Math.round(coAdminCut).toLocaleString()}`,
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
        }, (error) => {
            console.warn('[member-dashboard] winner confirmations listener failed:', error?.message || error);
            setWinnerConfirmation(null);
        });
        return () => unsub();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeLeagueId, currentUser?.id]);

    // Dynamic Calculations
    const paidMembersCount = members.filter(m => m.hasPaid && m.isActive !== false).length;
    const totalCollected = paidMembersCount * gameweekStake;
    const weeklyPot = totalCollected * (rules.weekly / 100);
    // Formula: Active members * Gameweek Stake * 38 GWs * Vault Percentage
    const seasonVaultProjected = members.length * gameweekStake * 38 * (rules.vault / 100);

    // Dynamic Winner calculation from recent notification feed using the structured isWinnerEvent objects.
    // Fallback to payout transactions so Winner's Circle works even when winner events aren't emitted.
    const winnerEventsFromNotifs = notifications.filter((n: any) => n.isWinnerEvent);
    const winnerEventsFromTx = transactions
        .filter((tx: any) => tx.type === 'payout' && tx.winnerName && Number.isFinite(Number(tx.gw || tx.gameweek)))
        .map((tx: any, idx: number) => ({
            winnerId: tx.winnerId || tx.userId || `tx-${idx}`,
            winnerName: tx.winnerName,
            points: tx.points || null,
            gw: Number(tx.gw || tx.gameweek),
            timestamp: tx.timestamp || null,
            fromTx: true,
        }))
        .sort((a: any, b: any) => b.gw - a.gw)
        .filter((entry: any, index: number, arr: any[]) => arr.findIndex((item) => item.gw === entry.gw) === index);

    const winnerEvents = winnerEventsFromTx.length > 0 ? winnerEventsFromTx : winnerEventsFromNotifs;
    const mostRecentWinner = winnerEvents.length > 0 ? winnerEvents[0] : null;
    const isRecentWinner = mostRecentWinner?.winnerId === currentUser?.id;
    const winnerLeaderboard = Object.values(
        winnerEvents.reduce((acc: Record<string, { winnerId: string; winnerName: string; wins: number }>, item: any) => {
            const key = item.winnerId || item.winnerName || 'unknown';
            if (!acc[key]) {
                acc[key] = {
                    winnerId: item.winnerId || key,
                    winnerName: item.winnerName || 'Unknown Winner',
                    wins: 0,
                };
            }
            acc[key].wins += 1;
            return acc;
        }, {})
    ).sort((a, b) => b.wins - a.wins);
    const seasonRacePhase = winnerEvents.length >= 30 ? 'Final Stretch' : winnerEvents.length >= 18 ? 'Mid Season' : 'Early Season';
    const payoutDestinationPhone = chairmanPhone || members.find(m => m.role === 'admin' || (m as any).role === 'chairman')?.phone || 'Chairman Number';
    const coveredGameweeks = gameweekStake > 0 ? Math.floor(walletBalance / gameweekStake) : 0;
    const nextDueDate = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000));
    const txDate = (tx: any) => {
        const raw = tx?.timestamp || tx?.createdAt || tx?.updatedAt || tx?.date;
        if (!raw) return null;
        if (raw?.toDate) return raw.toDate();
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const recentResolvedPayouts = transactions
        .filter((tx: any) => tx.type === 'payout' && Number(tx.amount || 0) > 0)
        .sort((a: any, b: any) => {
            const aTs = txDate(a)?.getTime() || 0;
            const bTs = txDate(b)?.getTime() || 0;
            return bTs - aTs;
        })
        .slice(0, 3);

    const priorityStrip = winnerConfirmation
        ? {
            title: `Confirm payout receipt: KES ${Number(winnerConfirmation.amount || 0).toLocaleString()}`,
            subtitle: 'Please confirm within 24 hours once funds hit your M-Pesa.',
            tone: 'amber' as const,
        }
        : !hasPaid
            ? {
                title: `Pay KES ${Number(gameweekStake || 0).toLocaleString()} to stay eligible`,
                subtitle: 'Deadline: before next FPL cutoff window.',
                tone: 'red' as const,
            }
            : {
                title: `Coverage: ${coveredGameweeks} GW${coveredGameweeks !== 1 ? 's' : ''} funded`,
                subtitle: `Next due target: ${nextDueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
                tone: 'green' as const,
            };
    const hasDualTeam = Boolean(currentUser?.secondFplTeamId);

    const dismissLeagueGuide = () => {
        if (!activeLeagueId) return;
        const guideKey = `fc-member-league-guide-dismissed-${activeLeagueId}-${activeUserId}`;
        localStorage.setItem(guideKey, 'true');
        setShowLeagueGuide(false);
    };

    // Phase 30: Is the logged-in user the current GW Winner?
    const isCurrentUserGwWinner = Boolean(gwWinner && currentFplEvent?.finished && Number(gwWinner.event_total) > 0 && currentUser && (
        (currentUser.fplTeamId && Number(currentUser.fplTeamId) === Number(gwWinner.entry)) ||
        (currentUser.secondFplTeamId && Number(currentUser.secondFplTeamId) === Number(gwWinner.entry)) ||
        currentUser.displayName?.toLowerCase().includes(gwWinner.player_name?.toLowerCase()) ||
        gwWinner.player_name?.toLowerCase().includes(currentUser.displayName?.toLowerCase())
    ));
    const hasFinalGwChampion = Boolean(gwWinner && currentFplEvent?.finished && Number(gwWinner.event_total) > 0);



    // Greeting for member header
    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };
    const greetingText = getGreeting();
    const firstName = (currentUser?.displayName || 'Manager').split(' ')[0];
    const currentGwBadge = currentFplEvent
        ? `GW ${currentFplEvent.id} ${currentFplEvent.finished ? 'Complete' : 'Live'}`
        : gwWinner?.event
            ? `GW ${gwWinner.event} Active`
            : 'GW Active';
    const ledgerMembers = [...members].sort((a, b) => {
        if (!!a.hasPaid !== !!b.hasPaid) return a.hasPaid ? 1 : -1; // Red Zone first
        if (a.id === currentUser?.id) return -1;
        if (b.id === currentUser?.id) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
    });

    const actionButtons = (
        <>
            <button
                onClick={() => handleMpesaSTKPush(gameweekStake)}
                disabled={isPushingMpesa || hasPaid}
                className="fc-member-bottom-primary flex-1 bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-60 text-black font-extrabold text-sm md:text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
                <Banknote className="w-5 h-5" /> {hasPaid ? 'Contribution Secured ✓' : 'Pay via M-Pesa'}
            </button>
            <button
                onClick={() => {
                    setTopUpAmount(Math.max(1, gameweekStake));
                    setTopUpNote('');
                    setShowTopUpModal(true);
                }}
                className="fc-member-bottom-secondary flex-1 bg-[#FBBF24]/10 hover:bg-[#FBBF24]/15 border border-[#FBBF24]/20 text-[#FBBF24] font-extrabold text-sm md:text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
            >
                <Wallet className="w-5 h-5" /> Top Up Wallet
            </button>
        </>
    );

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className={clsx(
            "fc-member-dashboard min-h-[100dvh] text-white flex flex-col font-sans relative pb-44 lg:pb-28 w-full overflow-x-hidden transition-colors duration-1000",
            isCurrentUserGwWinner
                ? "bg-gradient-to-br from-[#0b1014] via-[#1a1608] to-[#2a1f05]"
                : hasPaid ? "bg-[#0b1014]" : "bg-gradient-to-br from-[#0b1014] to-[#2a0808]",
            isSuspended ? "overflow-hidden h-screen" : ""
        )}>
            {/* Phase 40: HQ Suspension Lockout Overlay */}
            {isSuspended && (
                <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden">
                    <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(239,68,68,0.05) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
                    <div className="w-full max-w-md bg-[#0b1014]/90 border-2 border-red-500/50 rounded-3xl p-8 text-center shadow-[0_0_80px_rgba(239,68,68,0.2)] flex flex-col items-center gap-6 relative z-10 animate-in zoom-in-95 duration-500">
                        <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/30 rounded-full flex flex-col items-center justify-center animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                            <Shield className="w-8 h-8 text-red-500 mb-1" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">HQ Lockout</h2>
                            <p className="text-sm font-medium text-gray-400">
                                This league has been suspended by <span className="font-bold text-emerald-400">FPL Chama HQ</span>. 
                                The Chairman has outstanding bills to clear before access can be restored.
                            </p>
                        </div>
                        <div className="w-full space-y-3">
                            <button 
                                onClick={handleNudgeHQ}
                                disabled={isNudgingHQ}
                                className="w-full py-3.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {isNudgingHQ ? "Nudging..." : "Nudge Chairman Directly"}
                            </button>
                            <button 
                                onClick={logout}
                                className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all"
                            >
                                Sign Out Waitroom
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={clsx("transition-all duration-700 w-full flex-1 flex flex-col", isSuspended ? "blur-xl opacity-30 pointer-events-none select-none scale-[0.98]" : "")}>

            {/* Golden Glow Overlay for GW Winner */}
            {isCurrentUserGwWinner && (
                <div className="fixed inset-0 pointer-events-none z-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#FBBF24] blur-[200px] opacity-[0.06]"></div>
                    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#F59E0B] blur-[150px] opacity-[0.04]"></div>
                </div>
            )}
            {/* Background Element */}
            <div className="fixed right-[-10%] bottom-[-10%] w-[600px] h-[600px] opacity-20 pointer-events-none z-0">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <path fill="none" stroke={isCurrentUserGwWinner ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.1)"} strokeWidth="0.5" d="M10,100 L190,100 M100,10 L100,190 M30,30 L170,170 M30,170 L170,30" />
                    <circle cx="10" cy="100" r="1.5" fill={isCurrentUserGwWinner ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.3)"} />
                    <circle cx="190" cy="100" r="1.5" fill={isCurrentUserGwWinner ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.3)"} />
                    <circle cx="100" cy="10" r="1.5" fill={isCurrentUserGwWinner ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.3)"} />
                    <circle cx="100" cy="190" r="1.5" fill={isCurrentUserGwWinner ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.3)"} />
                    <circle cx="100" cy="100" r="3" fill={isCurrentUserGwWinner ? "rgba(251,191,36,0.6)" : "rgba(255,255,255,0.5)"} />
                </svg>
            </div>

            {/* Toast Notification */}
            <div className={clsx(
                "fixed top-4 right-4 px-5 py-3 rounded-2xl text-[13px] font-bold flex items-center gap-3 transition-all duration-500 pointer-events-none z-[9999] shadow-[0_20px_50px_rgba(0,0,0,0.5)] fc-inline-toast",
                toastMessage ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-2 scale-95",
                toastType === 'error'
                    ? "fc-inline-toast-error"
                    : toastType === 'info'
                        ? "fc-inline-toast-info"
                        : "fc-inline-toast-success"
            )}>
                {toastType === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                )}
                {toastMessage}
            </div>

            {/* Top Navigation Frame */}
            <div className="fc-member-top-rail sticky top-0 pt-4 px-4 md:pt-6 md:px-8 w-full max-w-6xl mx-auto z-50 space-y-3">
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
                    <p className="fc-greeting-copy text-base md:text-lg font-semibold text-gray-300 tracking-tight">
                        {greetingText},{' '}
                        <span className="text-white font-extrabold bg-gradient-to-r from-[#FBBF24] to-[#f59e0b] bg-clip-text text-transparent">
                            {firstName}!
                        </span>
                    </p>
                    <span className="fc-gw-active-chip hidden sm:block text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded-full">
                        {currentGwBadge}
                    </span>
                </div>

                <div className={clsx(
                    'fc-member-priority-strip rounded-2xl border px-4 py-3 flex items-center justify-between gap-3',
                    priorityStrip.tone === 'red' && 'border-red-500/30 bg-red-500/10',
                    priorityStrip.tone === 'amber' && 'border-[#FBBF24]/30 bg-[#FBBF24]/10',
                    priorityStrip.tone === 'green' && 'border-[#10B981]/30 bg-[#10B981]/10'
                )}>
                    <div>
                        <p className="text-sm font-black text-white leading-tight">{priorityStrip.title}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{priorityStrip.subtitle}</p>
                    </div>
                    {!hasPaid && (
                        <button
                            onClick={() => handleMpesaSTKPush(gameweekStake)}
                            disabled={isPushingMpesa}
                            className="shrink-0 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[10px] font-black uppercase tracking-widest"
                        >
                            {isPushingMpesa ? 'Sending...' : 'Pay Now'}
                        </button>
                    )}
                </div>

                {showLeagueGuide && (
                    <div className="rounded-2xl border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3.5 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#10B981]">Dual Mode Onboarding</p>
                            </div>
                            <button
                                type="button"
                                onClick={dismissLeagueGuide}
                                className="text-[10px] font-black uppercase tracking-widest text-[#10B981] hover:text-emerald-300"
                            >
                                Dismiss
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">League Context</p>
                                <p className="text-[11px] text-gray-200 mt-1 leading-relaxed">
                                    You are in <span className="font-black text-white">{userLeagueCount}</span> league{userLeagueCount > 1 ? 's' : ''}. Use the top switcher to choose which wallet and approvals you are viewing.
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Team Eligibility</p>
                                <p className="text-[11px] text-gray-200 mt-1 leading-relaxed">
                                    {hasDualTeam
                                        ? 'Your second FPL team is active for this league, and both teams can independently win a gameweek.'
                                        : 'Only one FPL team is attached to your profile here. Add a second team from profile if your chairman allows dual mode.'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Your Access</p>
                                <p className="text-[11px] text-gray-200 mt-1 leading-relaxed">
                                    Active role in this league: <span className="font-black text-[#FBBF24] capitalize">{activeLeagueRole}</span>.
                                    {activeLeagueRole === 'admin' || activeLeagueRole === 'co-chair' ? ' You can approve governance actions tied to this circle.' : ' Governance actions stay read-only in member mode.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Phase 30: Golden Winner Celebration OR Normal Action Banner */}
                {isCurrentUserGwWinner ? (
                    <div className="w-full rounded-[2rem] border-2 border-[#FBBF24]/50 bg-gradient-to-r from-[#FBBF24]/15 via-[#F59E0B]/10 to-[#FBBF24]/15 px-6 py-5 flex flex-col sm:flex-row items-center gap-5 animate-in zoom-in-95 duration-700 shadow-[0_0_40px_rgba(251,191,36,0.15)] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-[#FBBF24] blur-[120px] opacity-10 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#F59E0B] blur-[80px] opacity-10 pointer-events-none"></div>
                        <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-[#FBBF24] to-[#B45309] p-[3px] shadow-[0_0_30px_rgba(251,191,36,0.3)] flex-shrink-0 animate-pulse">
                            <div className="w-full h-full bg-[#0b1014] rounded-full flex items-center justify-center">
                                <Trophy className="w-9 h-9 text-[#FBBF24]" />
                            </div>
                        </div>
                        <div className="relative z-10 text-center sm:text-left flex-1">
                            <p className="text-[10px] font-black text-[#FBBF24] uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5 justify-center sm:justify-start">
                                <Star className="w-3 h-3 fill-current" /> You Are This Gameweek's Champion!
                            </p>
                            <h3 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight">
                                Congratulations, {firstName}!
                            </h3>
                            <p className="fc-gw-winner-subline text-sm font-bold text-gray-200 mt-1">
                                You scored <span className="text-[#10B981] font-black">{gwWinner.event_total} pts</span> — the highest in the league this week.
                            </p>
                        </div>
                        <div className="fc-win-payout-card relative z-10 p-4 rounded-2xl text-center flex-shrink-0">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Your Payout</p>
                            <p className="text-2xl font-black text-[#FBBF24] tabular-nums">KES {((members.filter(m => m.hasPaid && m.isActive !== false).length * gameweekStake) * (rules.weekly / 100)).toLocaleString()}</p>
                        </div>
                        {/* Phase 8: Share My Win */}
                        <button
                            onClick={() => {
                                const league = encodeURIComponent(leagueName || 'My Chama');
                                const amount = Math.round((members.filter(m => m.hasPaid && m.isActive !== false).length * gameweekStake) * (rules.weekly / 100));
                                const url = `${window.location.origin}/win?league=${league}&gw=${gwWinner?.event || ''}&winner=${encodeURIComponent(firstName)}&amount=${amount}`;
                                if (navigator.share) {
                                    navigator.share({ title: `I won GW${gwWinner?.event}!`, url });
                                } else {
                                    navigator.clipboard.writeText(url);
                                    showToast('✅ Win link copied! Share it!');
                                }
                            }}
                            className="fc-share-win-btn relative z-10 flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-xl transition-all duration-300 ease-out active:scale-95"
                        >
                            🏆 Share My Win
                        </button>
                    </div>
                ) : gwWinner && !currentFplEvent?.finished ? (
                    <div className="fc-gw-live-banner w-full rounded-[2rem] border border-white/10 bg-[#161d24]/90 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-2xl shadow-black/30">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-7 h-7 text-[#FBBF24]" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-[#FBBF24] uppercase tracking-[0.2em] mb-1">Gameweek still live</p>
                            <h3 className="text-xl md:text-2xl font-black text-white leading-tight tracking-tight">Champion banner is locked until FPL finishes this GW.</h3>
                            <p className="text-sm text-gray-400 mt-1">Current standings are still moving, so the dashboard waits for the final whistle before naming a winner.</p>
                        </div>
                        <div className="fc-gw-live-leader rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center flex-shrink-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Live leader</p>
                            <p className="text-lg font-black text-white tabular-nums">{gwWinner.player_name}</p>
                            <p className="text-[11px] text-[#FBBF24] font-bold tabular-nums">{Number(gwWinner.event_total || 0).toLocaleString()} pts</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Phase 10.5: Action Required Banner — static, high-visibility, never a toast */}
                        {(currentUser && (winnerConfirmation || !hasPaid)) && (
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
                                            : `Your wallet balance is empty. Pay KES ${gameweekStake.toLocaleString()} to stay eligible.`}
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

                        {/* Live Gameweek Winner Gold UI */}
                        {gwWinner && (
                            <div className="fc-highlight-card bg-gradient-to-r from-[#FBBF24]/10 via-[#F59E0B]/5 to-transparent border border-[#FBBF24]/30 rounded-[2rem] p-6 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] transition-all animate-in zoom-in-95 duration-500 mt-4 mb-2">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FBBF24] blur-[100px] opacity-10 pointer-events-none"></div>
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#F59E0B] blur-[80px] opacity-10 pointer-events-none"></div>
                                
                                <div className="relative z-10 flex items-center gap-5 w-full md:w-auto">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FBBF24] to-[#B45309] p-[2px] shadow-lg flex-shrink-0 animate-pulse">
                                        <div className="w-full h-full bg-[#0b1014] rounded-full flex items-center justify-center border-2 border-[#0b1014]">
                                            <Trophy className="w-7 h-7 text-[#FBBF24]" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-[#FBBF24] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                            <Star className="w-3 h-3 fill-current" /> {hasFinalGwChampion ? 'Gameweek Champion' : 'Live Leader'}
                                        </p>
                                        <h3 className="text-2xl font-black text-white leading-tight tracking-tight">{gwWinner.player_name}</h3>
                                        <p className="text-sm font-bold text-gray-400 mt-0.5">{gwWinner.entry_name} <span className="inline-block text-[#10B981] ml-2 px-1.5 py-0.5 bg-[#10B981]/10 rounded border border-[#10B981]/20 tabular-nums">{gwWinner.event_total} pts</span></p>
                                    </div>
                                </div>

                                <div className="relative z-10 flex flex-row md:flex-col items-center flex-shrink-0 md:items-end justify-between w-full md:w-auto fc-highlight-surface p-4 rounded-2xl border backdrop-blur-sm gap-2">
                                    <p className="text-[10px] font-black fc-meta-label uppercase tracking-widest">Projected Payout</p>
                                    <p className="text-2xl font-black text-[#FBBF24] tabular-nums tracking-tight">KES {((members.filter(m => m.hasPaid && m.isActive !== false).length * gameweekStake) * (rules.weekly / 100)).toLocaleString()}</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Main Content — Dense Grid Layout */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 pb-40 lg:pb-28 z-10 relative mt-2">

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

                    {/* Winner's Circle — expandable */}
                    <div className="fc-member-winners lg:col-span-4 bg-[#161d24] border border-white/5 shadow-2xl shadow-black/50 rounded-[1.5rem] p-5 flex flex-col gap-3 overflow-hidden">
                        <div className="flex items-center justify-between">
                            <h4 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                <Trophy className="w-3.5 h-3.5 text-[#eab308]" /> Winner's Circle (Last 3 GWs)
                            </h4>
                            <button
                                onClick={() => setShowWinnersPanelMobile(prev => !prev)}
                                className="sm:hidden text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-white/10 text-gray-300"
                            >
                                {showWinnersPanelMobile ? 'Hide' : 'Show'}
                            </button>
                            {winnerEvents.length > 3 && (
                                <button
                                    onClick={() => setShowAllWinners(!showAllWinners)}
                                    className="text-[10px] font-bold text-[#FBBF24] hover:text-[#eab308] uppercase tracking-widest transition-colors"
                                >
                                    {showAllWinners ? 'Collapse' : `View All (${winnerEvents.length})`}
                                </button>
                            )}
                        </div>
                        <div className={clsx(
                            "flex gap-3 pb-1 transition-all duration-300",
                            showAllWinners ? "flex-wrap" : "overflow-x-auto",
                            !showWinnersPanelMobile && 'hidden sm:flex'
                        )} style={showAllWinners ? {} : { scrollbarWidth: 'none' }}>
                            {winnerEvents.length === 0 ? (
                                <div className="text-xs text-gray-600 font-bold tracking-widest uppercase py-4 w-full text-center">No winners yet</div>
                            ) : (showAllWinners ? winnerEvents : winnerEvents.slice(0, 3)).map((winner: any, idx: number) => {
                                const winnerMember = members.find(m => m.id === winner.winnerId) || { avatarSeed: winner.winnerName };
                                return (
                                    <div key={idx} className={clsx(
                                        "flex flex-col items-center justify-center min-w-[80px] rounded-xl p-3 shrink-0 border transition-all",
                                        winner.winnerId === activeUserId ? "border-[#FBBF24]/40 bg-[#FBBF24]/5 shadow-[0_0_10px_rgba(251,191,36,0.1)]" : "border-white/5 bg-white/[0.02]"
                                    )}>
                                        <div className="w-9 h-9 rounded-full border-2 border-[#FBBF24]/60 p-0.5 mb-1.5 bg-[#0b1014]">
                                            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(winnerMember as any).avatarSeed}&backgroundColor=transparent`} alt={winner.winnerName} className="w-full h-full rounded-full object-cover" />
                                        </div>
                                        <span className="font-bold text-[11px] text-white leading-tight text-center">{winner.winnerName?.split(' ')[0]}</span>
                                        <span className="text-[10px] text-[#eab308] font-bold">{winner.gw ? `GW${winner.gw}` : 'Winner'}</span>
                                        {winner.points && <span className="text-[9px] text-gray-500 font-bold tabular-nums">{winner.points} pts</span>}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Stats Summary */}
                        {showAllWinners && winnerEvents.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-white/5">
                                <div className="bg-black/30 rounded-xl p-2.5 text-center">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Total GWs Won</p>
                                    <p className="text-lg font-black text-white tabular-nums">{winnerEvents.length}</p>
                                </div>
                                <div className="bg-black/30 rounded-xl p-2.5 text-center">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Unique Winners</p>
                                    <p className="text-lg font-black text-[#FBBF24] tabular-nums">{new Set(winnerEvents.map((w: any) => w.winnerId)).size}</p>
                                </div>
                            </div>
                        )}

                        {winnerLeaderboard.length > 0 && (
                            <div className="mt-2 pt-3 border-t border-white/5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Season Podium</p>
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#10B981]/20 bg-[#10B981]/10 text-[#10B981]">
                                        {seasonRacePhase}
                                    </span>
                                </div>
                                {winnerLeaderboard.slice(0, 3).map((entry, index) => {
                                    const podiumStyles = [
                                        'border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]',
                                        'border-slate-300/40 bg-slate-300/10 text-slate-300',
                                        'border-amber-700/40 bg-amber-700/10 text-amber-500'
                                    ];
                                    return (
                                        <div key={entry.winnerId} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={clsx('w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black shrink-0', podiumStyles[index] || 'border-white/20 bg-white/5 text-white')}>
                                                    {index + 1}
                                                </span>
                                                <span className="text-xs font-bold text-white truncate">{entry.winnerName}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{entry.wins} win{entry.wins !== 1 ? 's' : ''}</span>
                                        </div>
                                    );
                                })}

                                {winnerLeaderboard.length > 3 && (
                                    <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-1">
                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Title Race</p>
                                        {winnerLeaderboard.slice(3, 6).map((entry) => (
                                            <div key={entry.winnerId} className="flex items-center justify-between text-[11px]">
                                                <span className="text-gray-300 truncate">{entry.winnerName}</span>
                                                <span className="font-bold text-[#10B981]">{entry.wins} wins</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* === ROW 1.5: Co-Chair Maker/Checker (Conditional) === */}
                {currentUser?.id === coAdminId && pendingPayouts.length > 0 && (
                    <div className="mb-4 bg-[#FBBF24]/10 border border-[#FBBF24]/40 rounded-[1.5rem] p-5 shadow-2xl overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-5 h-5 text-[#FBBF24] animate-pulse" />
                            <h3 className="text-xl font-black text-[#FBBF24] tracking-tight">Co-Chair Duty: Awaiting Approval</h3>
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

                {/* Member Nudge: If pending payouts exist but user is NOT co-chair, show a nudge button */}
                {pendingPayouts.length > 0 && payoutApproverId && currentUser?.id !== payoutApproverId && (
                    <div className="mb-4 bg-[#FBBF24]/5 border border-[#FBBF24]/20 rounded-[1.5rem] p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Trophy className="w-5 h-5 text-[#FBBF24] flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-[#FBBF24]">Payout Awaiting Approval</p>
                                <p className="text-[10px] text-gray-500 font-medium">The Co-Chair needs to approve the payout before it's dispatched.</p>
                            </div>
                        </div>
                        <button
                            disabled={nudgeSent}
                            onClick={handleNudge}
                            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[#FBBF24] hover:bg-[#eab308] text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors active:scale-95 disabled:opacity-50"
                        >
                            {nudgeSent ? <CheckCircle2 className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                            {nudgeSent ? 'Nudged ✓' : 'Nudge'}
                        </button>
                    </div>
                )}

                {/* === ROW 2: Personal Status (4) + Chart (8) === */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
                    {/* Personal Status + Pay Action */}
                    {currentUser && (
                        <div className={clsx(
                            "fc-member-status-card",
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
                                        ? `Your contribution is secured. Eligible for this GW's pot. Wallet covers your next ${gameweekStake > 0 ? Math.floor(walletBalance / gameweekStake) : 0} Gameweeks.`
                                        : (currentUser?.missedGameweeks === 1
                                            ? <span className="text-red-400 font-bold">⚠️ CRITICAL: You have missed 1 Gameweek. Failure to pay for 2 consecutive Gameweeks results in permanent disqualification from the Vault.</span>
                                            : "Your contribution is missing. Pay before the FPL deadline."))}
                            </p>

                            {!hasPaid && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-baseline justify-center gap-1.5 mb-2 mt-1">
                                        <span className="text-3xl font-black text-white tracking-tight tabular-nums">
                                            {gameweekStake.toLocaleString()}
                                        </span>
                                        <span className="text-white text-xs font-bold tracking-widest uppercase">KES</span>
                                    </div>
                                    <button
                                        onClick={() => setShowPochiInstructions(!showPochiInstructions)}
                                        className="w-full px-4 py-2.5 rounded-xl font-bold text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Banknote className="w-5 h-5 group-hover:-rotate-6 transition-transform" />
                                        Pay via Pochi La Biashara
                                    </button>

                                    {showPochiInstructions && (
                                        <div className="bg-[#1c1a09] border border-[#FBBF24]/30 rounded-xl p-3 text-left animate-in fade-in zoom-in-95 duration-200 mt-1">
                                            <p className="text-[11px] font-bold text-[#FBBF24] uppercase tracking-widest mb-1.5 flex items-center gap-1"><Smartphone className="w-3 h-3" /> Pochi Instructions</p>
                                            <ol className="text-xs text-gray-300 space-y-1.5 pl-4 list-decimal marker:text-gray-500">
                                                <li>Go to M-Pesa Menu &gt; <strong>Pochi La Biashara</strong></li>
                                                <li>Send to Mobile No. <strong>{payoutDestinationPhone}</strong></li>
                                                <li>Amount: <strong>KES {gameweekStake}</strong></li>
                                            </ol>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-gray-400">
                                        Destination: <span className="font-black text-[#10B981]">{payoutDestinationPhone}</span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2 mt-1">
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
                                            Confirm M-Pesa Receipt →
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
                    <div className="fc-member-chart lg:col-span-7 bg-[#161d24] border border-white/5 shadow-2xl shadow-black/50 rounded-[1.5rem] p-5">
                        <h4 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                            <BarChart3 className="w-3.5 h-3.5" /> Performance Trajectory
                            <span className="ml-auto text-gray-600 text-[10px] font-medium">— vs League Avg</span>
                        </h4>
                        <div className="h-52 w-full">
                            {performanceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={performanceData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                    <XAxis dataKey="name" stroke="#ffffff30" fontSize={9} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#ffffff30" fontSize={9} tickLine={false} axisLine={false} width={28} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0e1419', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px' }}
                                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                    />
                                    {currentUser?.fplTeamId && (
                                        <Line type="monotone" dataKey={`Team ${currentUser.fplTeamId}`} stroke="#10B981" strokeWidth={2.5} dot={{ r: 3.5, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Team 1" />
                                    )}
                                    {currentUser?.secondFplTeamId && (
                                        <Line type="monotone" dataKey={`Team ${currentUser.secondFplTeamId}`} stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3.5, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Team 2" />
                                    )}
                                    {/* Fallback for old dataKey="Points" if any */}
                                    {!currentUser?.fplTeamId && !currentUser?.secondFplTeamId && (
                                         <Line type="monotone" dataKey="Points" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3.5, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                    )}
                                    <Line type="monotone" dataKey="Average" stroke="#FBBF24" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                            ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <BarChart3 className="w-8 h-8 text-gray-700 mb-2" />
                                <p className="text-xs font-bold text-gray-600">Link your FPL team in Profile</p>
                                <p className="text-[10px] text-gray-700 mt-1">to see your real performance trajectory.</p>
                            </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* === ROW 3: Verification Ledger (Directory Rail) === */}
                <div className="fc-member-ledger w-full bg-[#161d24] border border-white/5 shadow-2xl shadow-black/50 rounded-[1.5rem] overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between">
                        <div>
                            <h4 className="flex items-center gap-2 text-sm font-black text-white tracking-tight">
                                <ShieldCheck className="w-4 h-4 text-[#10B981]" /> Active Managers
                            </h4>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Live League Directory</p>
                        </div>
                        <span className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 text-[10px] font-bold px-3 py-1 rounded-lg uppercase tracking-widest">
                            {paidMembersCount}/{members.length} Paid
                        </span>
                    </div>
                    <div className="px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e2935 transparent' }}>
                        <div className="flex gap-3 min-w-max">
                        {ledgerMembers.length === 0 ? (
                            <div className="p-8 text-center text-gray-600 text-xs font-bold uppercase tracking-widest">No members enrolled</div>
                        ) : ledgerMembers.map((member) => (
                            <div key={member.id} className={clsx(
                                "fc-verification-rail-card w-52 shrink-0 rounded-2xl border px-4 py-3 transition-colors",
                                member.id === currentUser?.id ? "bg-white/[0.03] border-emerald-500/30" : "border-white/10 hover:bg-white/[0.02]"
                            )}>
                                <div className="flex flex-col items-center text-center gap-2">
                                    <div className={clsx(
                                        "w-12 h-12 rounded-full border p-0.5",
                                        member.hasPaid ? "border-[#10B981]/50 bg-[#10B981]/10" : "border-white/10 opacity-40 grayscale"
                                    )}>
                                        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(member as any).avatarSeed || member.displayName}&backgroundColor=transparent`} alt="Avatar" className="w-full h-full rounded-full" />
                                    </div>
                                    <div className="min-w-0 w-full">
                                        <div className="font-bold text-white text-sm leading-tight truncate">{member.displayName}</div>
                                        {member.id === currentUser?.id && <div className="text-[10px] text-gray-500 font-medium">(you)</div>}
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
                            </div>
                        ))}
                        </div>
                    </div>
                </div>

                <div className="fc-member-trust-strip w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Last 3 Resolved Payouts</h4>
                        <span className="text-[10px] text-gray-500 font-bold">Trust Visibility</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {recentResolvedPayouts.length > 0 ? recentResolvedPayouts.map((tx: any) => (
                            <div key={tx.id || `${tx.winnerName}-${tx.gameweek || tx.gw}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                <p className="text-xs font-black text-white truncate">{tx.winnerName || 'Winner'}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">GW {tx.gameweek || tx.gw || '-'} • KES {Number(tx.amount || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-gray-500 mt-1">{txDate(tx)?.toLocaleString() || 'Recently'}</p>
                            </div>
                        )) : (
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest md:col-span-3">No resolved payouts yet</p>
                        )}
                    </div>
                </div>

                {/* === ROW 4: Live Escrow Feed === */}
                <div className="fc-member-feed w-full bg-[#0d1117] border border-white/5 rounded-[1.5rem] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-[#10B981]" />
                        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Live Escrow Feed</h4>
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse ml-1" />
                        <span className="ml-auto font-mono text-[10px] text-gray-700">{leagueName}</span>
                        <button
                            onClick={() => setShowFeedPanelMobile(prev => !prev)}
                            className="sm:hidden text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-white/10 text-gray-300"
                        >
                            {showFeedPanelMobile ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <div
                        className={clsx('h-48 overflow-y-auto divide-y divide-white/[0.03] font-mono', !showFeedPanelMobile && 'hidden sm:block')}
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
            {typeof document !== 'undefined' && createPortal(
                <>
                <div className="hidden lg:flex fc-member-bottom-actions-desktop right-0 p-4 md:p-6 bg-gradient-to-t from-[#0b100a] via-[#0b100a]/90 to-transparent justify-center z-[118] pb-4">
                    <div className="flex gap-4 w-full max-w-6xl mx-auto pointer-events-auto">
                        {actionButtons}
                    </div>
                </div>
                <div className="lg:hidden fc-member-bottom-actions-mobile left-0 right-0 p-3 z-[120]">
                    <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#0b1014]/92 backdrop-blur-xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] pb-[max(0.4rem,env(safe-area-inset-bottom))]">
                        <div className="flex gap-2.5 w-full pointer-events-auto">
                            {actionButtons}
                        </div>
                    </div>
                </div>
                </>,
                document.body
            )}

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

            {/* Wallet Top-Up Modal */}
            {showTopUpModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#111820]/95 border border-[#10B981]/20 rounded-3xl p-7 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="mb-5">
                            <div className="flex items-center gap-2 mb-1">
                                <Wallet className="w-5 h-5 text-[#10B981]" />
                                <h3 className="text-xl font-extrabold text-white">Top Up Wallet</h3>
                            </div>
                            <p className="text-sm text-gray-400">
                                Send any amount to your wallet. Your current balance is not reduced, and the top-up is added separately once M-Pesa confirms it.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Amount to Top Up</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="300000"
                                    value={topUpAmount}
                                    onChange={(e) => setTopUpAmount(Math.max(1, Number(e.target.value || 0)))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#10B981]/50 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Note for Chairman or Self</label>
                                <textarea
                                    rows={3}
                                    value={topUpNote}
                                    onChange={(e) => setTopUpNote(e.target.value)}
                                    placeholder="Optional: 'Use my GW winnings' or 'Add extra funds for next 3 GWs'"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#10B981]/50 transition-colors resize-none"
                                />
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-400 space-y-1">
                                <p>Wallet balance: <span className="font-black text-white">KES {walletBalance.toLocaleString()}</span></p>
                                <p>Current GW stake: <span className="font-black text-white">KES {gameweekStake.toLocaleString()}</span></p>
                                <p>Top-up amount: <span className="font-black text-[#10B981]">KES {Math.max(1, Number(topUpAmount || 0)).toLocaleString()}</span></p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowTopUpModal(false);
                                        setTopUpNote('');
                                    }}
                                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 text-sm font-bold rounded-xl transition-colors border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={topUpNote.trim() ? handleRequestWalletCredit : () => handleMpesaSTKPush(topUpAmount)}
                                    disabled={isSubmittingTopUp || isRequestingWalletCredit || !Number(topUpAmount || 0)}
                                    className="flex-1 px-4 py-3 bg-[#10B981] hover:bg-[#10B981]/90 text-black text-sm font-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmittingTopUp || isRequestingWalletCredit ? <><Zap className="w-4 h-4 animate-pulse" /> Sending...</> : <><Banknote className="w-4 h-4" /> {topUpNote.trim() ? 'Request Credit' : 'Send STK Push'}</>}
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
                        <button
                            onClick={() => {
                                setTopUpAmount(Math.max(1, Number(winnerConfirmation.amount || gameweekStake || 0)));
                                setTopUpNote(`Credit this payout to my wallet.`);
                                setShowTopUpModal(true);
                            }}
                            className="flex-shrink-0 bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-black px-4 py-2.5 rounded-xl transition-colors border border-white/10"
                        >
                            Request Wallet Credit
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
        </div>
    );
}
