import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import LeagueRulesModal from '../components/LeagueRulesModal';
import { Trophy, BarChart3, Banknote, ShieldCheck, AlertCircle, Zap, Check, Activity, Terminal, AlertTriangle, RefreshCw, CheckCircle2, Share2, Star, Send, AlertOctagon, Bell, Smartphone, Wallet, MessageCircle, Calendar, Flame } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, where, updateDoc, orderBy, limit, arrayUnion } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import { getApiBaseUrl, secureApiPost } from '../utils/api';
import { useNotifications } from '../components/NotificationProvider';
import PotVaultSwapper from '../components/PotVaultSwapper';
import clsx from 'clsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardSkeleton } from '../components/Skeleton';
import ChampionFlexCardModal from '../components/ChampionFlexCardModal';
import LiveMatchdayPulse from '../components/LiveMatchdayPulse';
import { haptics } from '../utils/haptics';

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

    // Phase 29: FPL GW Winner + full standings
    const [gwWinner, setGwWinner] = useState<any>(null);
    const [fplStandings, setFplStandings] = useState<any[]>([]);
    const [currentFplEvent, setCurrentFplEvent] = useState<{
        id: number;
        name?: string;
        finished: boolean;
        deadlineTime?: string;
        nextId?: number;
        nextName?: string;
        nextDeadlineTime?: string;
        isPreparingForNextGw?: boolean;
    } | null>(null);

    // Phase 30: panel toggles
    const [showFeedPanelMobile, setShowFeedPanelMobile] = useState(false);
    const [showFlexModal, setShowFlexModal] = useState(false);
    // const [showAllWinners, setShowAllWinners] = useState(false);

    // Phase 31: Real FPL Performance Trajectory
    const [performanceData, setPerformanceData] = useState<any[]>([]);

    // Co-Admin State
    const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
    const [isApprovingPayout, setIsApprovingPayout] = useState<string | null>(null);
    const [nudgeSent, setNudgeSent] = useState(false);
    const [userLeagueCount, setUserLeagueCount] = useState(1);
    const [activeLeagueRole, setActiveLeagueRole] = useState<string>('member');
    const [showLeagueGuide, setShowLeagueGuide] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);

    const members = useStore(state => state.members);
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
                suspensionNudges: arrayUnion((currentUser?.displayName || 'Member').split(' ')[0])
            });
            showToast("Chairman has been notified.", "success");
        } catch (error) {
            console.error("Nudge Error:", error);
            showToast("Failed to nudge Chairman.", "error");
        } finally {
            setIsNudgingHQ(false);
        }
    };
    const isStealthMode = useStore(state => state.isStealthMode);
    const role = useStore(state => state.role);
    const { notifications } = useNotifications();

    const chairmanMember = members.find((member) => {
        const mRole = (member as any).role;
        return member.id === coAdminId || mRole === 'admin' || mRole === 'chairman';
    });
    const currentUser = members.find(m => m.id === activeUserIdStored)
        || members.find(m => m.phone === memberPhone)
        || (role === 'admin' ? chairmanMember : undefined)
        || (role === 'admin' ? members.find(m => (m as any).role === 'admin') : undefined);
    const walletBalance = currentUser?.walletBalance || 0;
    const hasPaid = currentUser?.hasPaid || (gameweekStake > 0 && walletBalance >= gameweekStake);
    const activeUserId = currentUser?.id || activeUserIdStored || 'dummy';
    const coChairMember = members.find(m => m.id === coAdminId);
    const payoutApproverId = coAdminId
        && coAdminId !== activeUserId
        && coChairMember
        && coChairMember.isActive !== false
        && (((coChairMember as any).role === 'admin') || ((coChairMember as any).role === 'co-chair'))
        ? coAdminId
        : null;

    useEffect(() => {
        if (!activeLeagueId) {
            navigate('/login');
            return;
        }
        if (!memberPhone && role !== 'admin') {
            navigate('/login');
            return;
        }

        // Setup real-time listener for the League document
        const leagueRef = doc(db, 'leagues', activeLeagueId);
        const unsubscribeLeague = onSnapshot(leagueRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMonthlyContribution(data.gameweekStake || 0);
                setLeagueName(data.name || data.leagueName || '');
                if (data.rules) setRules(data.rules);
                setCoAdminId(data.coAdminId || null);
                setChairmanPhone(data.chairmanPhone || null);

                // Phase 29: Fetch FPL GW Winner continuously
                if (data.fplLeagueId) {
                    fetch(`/fpl-api/leagues-classic/${data.fplLeagueId}/standings/`)
                        .then(res => res.json())
                        .then(fplData => {
                            const results = fplData?.standings?.results;
                            if (results && results.length > 0) {
                                // Chama Rule: Only active funded members can win the pot
                                const norm = (s: string) => String(s || '').toLowerCase().trim();
                                const eligibleResults = results.filter((r: any) => {
                                    const dbMember = members.find((m: any) => {
                                        if (m.fplTeamId && Number(m.fplTeamId) === Number(r.entry)) return true;
                                        if (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(r.entry)) return true;
                                        const db = norm(m.displayName);
                                        return norm(r.player_name).includes(db) || db.includes(norm(r.player_name)) || norm(r.entry_name).includes(db);
                                    });
                                    const isFunded = dbMember && (
                                        dbMember.hasPaid === true ||
                                        (gameweekStake > 0 && (dbMember.walletBalance || 0) >= gameweekStake)
                                    );
                                    return dbMember && dbMember.isActive !== false && isFunded;
                                });

                                // Chama Rule: Minimum 2 funded managers required for a contestable pot
                                if (eligibleResults.length >= 2) {
                                    const sorted = [...eligibleResults].sort((a: any, b: any) => Number(b.event_total || 0) - Number(a.event_total || 0));
                                    const winner = sorted[0];
                                    const runnerUp = sorted[1];
                                    const leadMargin = Number(winner?.event_total || 0) - Number(runnerUp?.event_total || 0);
                                    setGwWinner({
                                        ...winner,
                                        runnerUpName: runnerUp?.player_name || runnerUp?.entry_name || '2nd Place',
                                        leadMargin: Math.max(0, leadMargin),
                                    });
                                } else {
                                    // 0 or 1 funded managers: Gameweek is unplayable / void; no unfunded winner
                                    setGwWinner(null);
                                }
                                // Store full sorted standings for rank card
                                const allSorted = [...results].sort((a: any, b: any) => Number(b.event_total || 0) - Number(a.event_total || 0));
                                setFplStandings(allSorted);

                                // Build league-wide GW average from all entries' history
                                const fetchPerformances = async () => {
                                    let aggData: any[] = [];
                                    
                                    const teamIds = [];
                                    if (currentUser?.fplTeamId) teamIds.push(currentUser.fplTeamId);
                                    if (currentUser?.secondFplTeamId) teamIds.push(currentUser.secondFplTeamId);

                                    if (teamIds.length === 0) return;

                                    for (const tId of teamIds) {
                                        try {
                                            const r = await fetch(`/fpl-api/entry/${tId}/history/`);
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
        if (!leagueName) return;
        setIsLoading(false);
        // Show constitution modal on first login (only for non-admin members who haven't accepted)
        if (currentUser && currentUser?.role !== 'admin' && !(currentUser as any)?.hasAcceptedRules) {
            setTimeout(() => setShowRulesModal(true), 800);
        }
    }, [members.length, currentUser, leagueName]);


    useEffect(() => {
        const fetchCurrentEvent = async () => {
            try {
                const response = await fetch(`/fpl-api/bootstrap-static/`);
                if (!response.ok) return;
                const data = await response.json();
                const events = data?.events || [];
                const current = events.find((event: any) => event.is_current);
                const next = events.find((event: any) => event.is_next);

                if (current?.id) {
                    let isPreparingForNext = false;
                    if (current.finished === true) {
                        const deadlineMs = current.deadline_time ? new Date(current.deadline_time).getTime() : 0;
                        const hoursSinceDeadline = deadlineMs ? (Date.now() - deadlineMs) / (1000 * 60 * 60) : 0;
                        // If it's been > 48 hours since the gameweek deadline or next GW deadline is within 5 days
                        if (hoursSinceDeadline >= 48 || (next?.deadline_time && (new Date(next.deadline_time).getTime() - Date.now()) <= 5 * 24 * 3600 * 1000)) {
                            isPreparingForNext = true;
                        }
                    }

                    setCurrentFplEvent({
                        id: current.id,
                        name: current.name || `Gameweek ${current.id}`,
                        finished: current.finished === true,
                        deadlineTime: current.deadline_time,
                        nextId: next?.id || current.id + 1,
                        nextName: next?.name || `Gameweek ${next?.id || current.id + 1}`,
                        nextDeadlineTime: next?.deadline_time,
                        isPreparingForNextGw: isPreparingForNext,
                    });
                    // Auto-persist startGw if the league doesn't have it yet
                    const leagueRef2 = activeLeagueId ? (await import('firebase/firestore').then(({ doc, getDoc }) => getDoc(doc(db, 'leagues', activeLeagueId)))) : null;
                    if (leagueRef2 && activeLeagueId && leagueRef2.data()?.startGw == null) {
                        import('firebase/firestore').then(({ doc, updateDoc }) => {
                            updateDoc(doc(db, 'leagues', activeLeagueId), { startGw: current.id }).catch(() => {});
                        });
                    }
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
            const data = await secureApiPost(`${apiUrl}/api/mpesa/stkpush`, {
                phoneNumber: memberPhone,
                amount: requestAmount,
                userId: activeUserId,
                leagueId: activeLeagueId
            });
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
                message: `${currentUser?.displayName || 'Member'} requested KES ${amount.toLocaleString()} wallet credit${topUpNote.trim() ? ` — ${topUpNote.trim()}` : ''}. Please credit the wallet from winnings or reconcile manually.`,
                timestamp: serverTimestamp(),
                readBy: [],
                targetMemberId: chairmanMember?.id || coAdminId || undefined
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'wallet_topup_requests'), {
                memberId: currentUser?.id || activeUserIdStored || 'unknown',
                memberName: currentUser?.displayName || 'Member',
                amount,
                note: topUpNote.trim() || null,
                status: 'pending',
                source: 'winnings_request',
                requestedAt: serverTimestamp(),
                requestedById: currentUser?.id || activeUserIdStored || 'unknown',
                requestedByName: currentUser?.displayName || 'Member',
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
                memberId: currentUser?.id || activeUserIdStored || 'unknown',
                memberName: currentUser?.displayName || 'Member',
                phone: currentUser?.phone || memberPhone || '',
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
            const data = await secureApiPost(`${payoutApiUrl}/api/mpesa/b2c`, {
                phone: payout.winnerPhone,
                amount: payout.amount,
                winnerName: payout.winnerName,
                remarks: `FantasyChama GW${payout.gw} Approved Payout`,
                userId: payout.winnerId,
                leagueId: activeLeagueId
            });
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
        const appUrl = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : (import.meta.env.VITE_APP_URL || 'https://fantasychama.vercel.app');
        const method = payout.method === 'cash' ? 'Cash Handoff 💵' : 'M-Pesa ✅';

        const message = [
            `🏆 *${leagueName.toUpperCase()} — GW${payout.gw} WINNER'S PODIUM* 🚨`,
            ``,
            `🥇 Mwizi wa points this week is *${payout.winnerName}* na *${payout.points} pts*! 👑`,
            `💰 Payout: *KES ${Number(payout.amount).toLocaleString()}* imetumwa safi via ${method}.`,
            ``,
            `👏 Wengine poleni kwa mshtuko wa moyo! Alama zilikataa lakini weekend ijayo kimeumana tena! 🏃‍♂️💨`,
            ``,
            unpaidCount > 0
                ? `⚠️ *RED ZONE CALLOUT*: Kuna watu ${unpaidCount} bado hawajatuma kakitu. Treasurer halali na pochi haina huruma kabla deadline!`
                : `✅ Watu wote wako funded kishujaa. Hatutaki vilio deadline ikipita!`,
            ``,
            `📊 Angalia live table & wallet yako:`,
            `👉 ${appUrl}/dashboard`,
        ].join('\n');

        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
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
    // Season vault: use actual GWs remaining since league start
    const leagueStartGw = (leagueSettings as any)?.startGw || (currentFplEvent?.id ? Math.max(1, currentFplEvent.id - 2) : 1);
    const totalLeagueGws = Math.max(1, 38 - leagueStartGw + 1);
    const seasonVaultProjected = members.length * gameweekStake * totalLeagueGws * (rules.vault / 100);

    // Dynamic Winner calculation from recent notification feed using the structured isWinnerEvent objects.
    // A gameweek is voided if marked as voided or if active funded members < 2
    const isCurrentGwVoided = Boolean(
        notifications.some((n: any) => (n.eventType === 'gw_voided' || n.status === 'voided') && (Number(n.gw || n.gameweek) === Number(currentFplEvent?.id))) ||
        (members.filter(m => m.hasPaid && m.isActive !== false).length < 2 && currentFplEvent?.finished)
    );

    const payoutDestinationPhone = chairmanPhone || members.find(m => m.role === 'admin' || (m as any).role === 'chairman')?.phone || 'Chairman Number';
    const hasDualTeam = Boolean(currentUser?.secondFplTeamId);

    const dismissLeagueGuide = () => {
        if (!activeLeagueId) return;
        const guideKey = `fc-member-league-guide-dismissed-${activeLeagueId}-${activeUserId}`;
        localStorage.setItem(guideKey, 'true');
        setShowLeagueGuide(false);
    };

    // Phase 30: Is the logged-in user the current GW Winner? (Suppressed if voided or once GW ends and preparation begins)
    const isCurrentUserGwWinner = Boolean(
        !isCurrentGwVoided &&
        !currentFplEvent?.isPreparingForNextGw &&
        gwWinner &&
        currentFplEvent?.finished &&
        Number(gwWinner.event_total) > 0 &&
        currentUser && (
            (currentUser.fplTeamId && Number(currentUser.fplTeamId) === Number(gwWinner.entry)) ||
            (currentUser.secondFplTeamId && Number(currentUser.secondFplTeamId) === Number(gwWinner.entry)) ||
            currentUser.displayName?.toLowerCase().includes(gwWinner.player_name?.toLowerCase()) ||
            gwWinner.player_name?.toLowerCase().includes(currentUser.displayName?.toLowerCase())
        )
    );
    const hasFinalGwChampion = Boolean(!isCurrentGwVoided && !currentFplEvent?.isPreparingForNextGw && gwWinner && currentFplEvent?.finished && Number(gwWinner.event_total) > 0);
    const isRecentWinner = isCurrentUserGwWinner;

    // Trigger celebratory confetti for the GW winner
    useEffect(() => {
        if (isCurrentUserGwWinner) {
            haptics.celebrate();
            import('canvas-confetti').then((module) => {
                const confetti = module.default;
                confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#FBBF24', '#10B981', '#F59E0B', '#FFFFFF'],
                });
            }).catch(() => {});
        }
    }, [isCurrentUserGwWinner]);



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
    /* const ledgerMembers = [...members].sort((a, b) => {
        if (!!a.hasPaid !== !!b.hasPaid) return a.hasPaid ? 1 : -1; // Red Zone first
        if (a.id === currentUser?.id) return -1;
        if (b.id === currentUser?.id) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
    }); */

    // FAB actions are now rendered via FloatingActionBubble component

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className={clsx(
            "fc-member-dashboard min-h-[100dvh] text-slate-900 dark:text-white flex flex-col font-sans relative pb-32 w-full overflow-x-hidden transition-colors duration-700",
            isCurrentUserGwWinner
                ? "bg-gradient-to-br from-[#0b1014] via-[#1a1608] to-[#2a1f05] dark:from-[#0b1014] dark:via-[#1a1608] dark:to-[#2a1f05]"
                : hasPaid ? "bg-slate-50 dark:bg-[#0b1014]" : "bg-gradient-to-br from-slate-100 to-red-50 dark:from-[#0b1014] dark:to-[#2a0808]",
            isSuspended ? "overflow-hidden h-screen" : ""
        )}>
            {/* Constitution first-login modal */}
            <LeagueRulesModal
                isOpen={showRulesModal}
                onClose={() => setShowRulesModal(false)}
                currentMember={currentUser}
                leagueName={leagueName}
                chairmanName={members.find(m => (m as any).role === 'admin')?.displayName}
            />

            {/* Champion WhatsApp Flex Card Modal */}
            <ChampionFlexCardModal
                isOpen={showFlexModal}
                onClose={() => setShowFlexModal(false)}
                winnerName={currentUser?.displayName || firstName || 'Champion'}
                teamName={gwWinner?.entry_name || (currentUser?.fplTeamId ? `Team ${currentUser.fplTeamId}` : undefined)}
                points={gwWinner?.event_total || 0}
                gameweek={gwWinner?.event || currentFplEvent?.id || ''}
                amountWon={Math.round((members.filter(m => m.hasPaid && m.isActive !== false).length * gameweekStake) * (rules.weekly / 100))}
                leagueName={leagueName}
            />

            {/* Phase 40: HQ Suspension Lockout Overlay */}
            {isSuspended && (
                <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden">
                    <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(239,68,68,0.05) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
                    <div className="w-full max-w-md bg-[#0b1014]/90 border-2 border-red-500/50 rounded-3xl p-8 text-center shadow-[0_0_80px_rgba(239,68,68,0.2)] flex flex-col items-center gap-6 relative z-10 animate-in zoom-in-95 duration-500">
                        <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/30 rounded-full flex flex-col items-center justify-center">
                            <AlertOctagon className="w-10 h-10 text-red-500 animate-bounce" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">League Suspended</h2>
                            <p className="text-sm text-gray-400 max-w-sm">
                                The Chairman's platform subscription requires settlement. Once resolved, standard gameweek gameplay will instantly resume.
                            </p>
                        </div>
                        <div className="w-full flex flex-col gap-3 mt-2">
                            <button
                                onClick={handleNudgeHQ}
                                disabled={isNudgingHQ}
                                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                <Bell className="w-4 h-4" />
                                {isNudgingHQ ? "Reminding..." : "Remind Chairman"}
                            </button>
                            <button 
                                onClick={() => {
                                    try { logout(); } catch {}
                                    window.location.href = '/login';
                                }}
                                className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all"
                            >
                                Sign Out
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
                toastMessage ? "opacity-100 translate-y-0 scale-100 visible" : "opacity-0 -translate-y-2 scale-95 invisible",
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
            <div className="fc-member-top-rail sticky top-0 pt-[max(3rem,calc(env(safe-area-inset-top,0px)+1.25rem))] px-4 md:pt-6 md:px-8 w-full max-w-6xl mx-auto z-50 space-y-3">
                <Header
                    role="member"
                    title={leagueName || 'The Big League'}
                    subtitle="Member Hub"
                />
                <LiveMatchdayPulse className="mt-1 mb-1" />

                {/* ── GREETING CARD — First thing member sees ── */}
                <section className={clsx(
                    "fc-card mt-3 mb-3 rounded-3xl border p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4",
                    isCurrentUserGwWinner
                        ? "border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24]"
                        : hasPaid
                            ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-white dark:via-[#0f1823] to-white dark:to-[#0f1823]"
                            : "border-red-400/20 bg-gradient-to-br from-red-400/6 via-white dark:via-[#0f1823] to-white dark:to-[#0f1823]"
                )}>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400 mb-2">
                            {hasPaid ? '✓ Contribution Secured' : 'Action Required'}
                        </p>
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl md:text-3xl">
                                {greetingText === 'Good morning' ? '🌅' : greetingText === 'Good afternoon' ? '☀️' : '🌙'}
                            </span>
                            <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                {greetingText},{' '}
                                <span className={clsx(
                                    "bg-clip-text text-transparent bg-gradient-to-r",
                                    isCurrentUserGwWinner ? "from-amber-500 to-yellow-400" : hasPaid ? "from-emerald-500 to-emerald-400" : "from-rose-500 to-red-400"
                                )}>
                                    {firstName}!
                                </span>
                            </p>
                        </div>
                        {!hasPaid && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Pay KES {gameweekStake.toLocaleString()} via M-Pesa to stay eligible.
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx(
                            "text-[11px] font-bold uppercase tracking-widest border px-3 py-1 rounded-full w-fit",
                            hasPaid
                                ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10"
                                : "border-red-500/30 text-red-500 dark:text-red-300 bg-red-500/10"
                        )}>
                            {currentGwBadge}
                        </span>
                        {!hasPaid && (
                            <button
                                onClick={() => handleMpesaSTKPush(gameweekStake)}
                                disabled={isPushingMpesa}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-50 transition-all active:scale-95 shadow-md"
                            >
                                {isPushingMpesa ? 'Sending...' : 'Pay Now'}
                            </button>
                        )}
                    </div>
                </section>

                {/* ── POT LEADER / GAMEWEEK CHAMPION CARD — Positioned directly after Greeting ── */}
                {!currentFplEvent?.isPreparingForNextGw && gwWinner && (
                    <div className="fc-highlight-card bg-gradient-to-r from-amber-500/10 via-amber-100/40 to-white/90 dark:from-[#FBBF24]/10 dark:via-[#F59E0B]/5 dark:to-transparent border border-amber-400/40 dark:border-[#FBBF24]/30 rounded-[2rem] p-5 md:p-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-[0_4px_24px_rgba(245,158,11,0.08)] dark:shadow-[0_0_40px_rgba(251,191,36,0.1)] transition-all animate-in zoom-in-95 duration-500 mb-3">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FBBF24] blur-[100px] opacity-10 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#F59E0B] blur-[80px] opacity-10 pointer-events-none"></div>
                        
                        <div className="relative z-10 flex items-center gap-4 md:gap-5 w-full md:w-auto">
                            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-[2px] shadow-lg flex-shrink-0 animate-pulse">
                                <div className="w-full h-full bg-amber-50 dark:bg-[#0b1014] rounded-2xl flex items-center justify-center border border-amber-300 dark:border-white/10">
                                    <Trophy className="w-7 h-7 text-amber-500 dark:text-[#FBBF24]" />
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black text-amber-600 dark:text-[#FBBF24] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Star className="w-3 h-3 fill-current" /> {hasFinalGwChampion ? 'Gameweek Champion' : 'Live Pot Leader'}
                                </p>
                                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight truncate">
                                    {isCurrentUserGwWinner ? `${gwWinner.player_name} (You!)` : gwWinner.player_name}
                                </h3>
                                <p className="text-xs md:text-sm font-bold text-slate-600 dark:text-gray-400 mt-0.5 truncate">
                                    {gwWinner.entry_name}{' '}
                                    <span className="inline-block text-emerald-700 dark:text-[#10B981] ml-2 px-2 py-0.5 bg-emerald-500/15 rounded-lg border border-emerald-500/30 tabular-nums font-black">
                                        {gwWinner.event_total} pts
                                    </span>
                                </p>
                                {!hasFinalGwChampion && gwWinner.leadMargin !== undefined && (
                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                                            +{gwWinner.leadMargin} pts ahead of {gwWinner.runnerUpName}
                                        </span>
                                        <span className={clsx(
                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                            gwWinner.leadMargin >= 15
                                                ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
                                                : gwWinner.leadMargin >= 5
                                                ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                                                : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300 animate-pulse"
                                        )}>
                                            {gwWinner.leadMargin >= 15 ? "Dominant Lead 🛡️" : gwWinner.leadMargin >= 5 ? "Contested Lead ⚔️" : "Nail-Biter 🔥"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="relative z-10 flex flex-row md:flex-col items-center flex-shrink-0 md:items-end justify-between w-full md:w-auto bg-white/80 dark:bg-[#0b1014]/60 p-3.5 md:p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 backdrop-blur-sm gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Projected Payout</p>
                            <p className="text-xl md:text-2xl font-black text-amber-600 dark:text-[#FBBF24] tabular-nums tracking-tight">
                                KES {((members.filter(m => m.hasPaid && m.isActive !== false).length * gameweekStake) * (rules.weekly / 100)).toLocaleString()}
                            </p>
                            {isCurrentUserGwWinner && (
                                <button
                                    onClick={() => {
                                        haptics.celebrate();
                                        setShowFlexModal(true);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
                                >
                                    🏆 Flex on WhatsApp
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {showLeagueGuide && (
                    <div className="rounded-2xl border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3.5 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#10B981]">Two Teams Setup</p>
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
                            <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">
                                Congratulations, {firstName}!
                            </h3>
                            <p className="fc-gw-winner-subline text-sm font-bold text-gray-200 mt-1">
                                You scored <span className="text-[#10B981] font-black">{gwWinner.event_total} pts</span> — the highest in the league this week.
                            </p>
                        </div>
                        <div className="fc-win-payout-card relative z-10 p-4 rounded-2xl text-center flex-shrink-0">
                            <p className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-1">Your Payout</p>
                            <p className="text-2xl font-black text-[#FBBF24] tabular-nums">KES {((members.filter(m => m.hasPaid && m.isActive !== false).length * gameweekStake) * (rules.weekly / 100)).toLocaleString()}</p>
                        </div>
                        {/* Phase 8: Flex on WhatsApp */}
                        <button
                            onClick={() => {
                                haptics.celebrate();
                                setShowFlexModal(true);
                            }}
                            className="fc-share-win-btn relative z-10 flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-xl transition-all duration-300 ease-out active:scale-95 shadow-lg shadow-amber-950/40"
                        >
                            🏆 Flex on WhatsApp
                        </button>
                    </div>
                ) : gwWinner && !currentFplEvent?.finished ? (
                    <div className="fc-gw-live-banner w-full rounded-[2rem] border border-white/10 bg-[#161d24]/90 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-2xl shadow-black/30">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-7 h-7 text-[#FBBF24]" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-[#FBBF24] uppercase tracking-[0.2em] mb-1">Gameweek still live</p>
                            <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">Champion banner is locked until FPL finishes this GW.</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Current standings are still moving, so the dashboard waits for the final whistle before naming a winner.</p>
                        </div>
                        {(() => {
                            const myRankEntry = fplStandings.findIndex((e: any) =>
                                (currentUser?.fplTeamId && Number(e.entry) === Number(currentUser.fplTeamId)) ||
                                (currentUser?.secondFplTeamId && Number(e.entry) === Number(currentUser.secondFplTeamId)) ||
                                currentUser?.displayName?.toLowerCase().includes(e.player_name?.toLowerCase())
                            );
                            const myEntry = myRankEntry >= 0 ? fplStandings[myRankEntry] : null;
                            const isMeLeader = myEntry && myEntry.entry === gwWinner.entry;

                            return (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                                    <div className={clsx(
                                        "fc-gw-live-leader rounded-2xl border px-4 py-3 text-center flex-shrink-0",
                                        isMeLeader ? "border-[#FBBF24]/50 bg-[#FBBF24]/10 shadow-[0_0_20px_rgba(251,191,36,0.15)]" : "border-white/10 bg-black/20"
                                    )}>
                                        <p className={clsx("text-[10px] font-black uppercase tracking-widest", isMeLeader ? "text-[#FBBF24]" : "text-gray-500")}>
                                            {isMeLeader ? "You're the Live Leader! 🚀" : "Live leader"}
                                        </p>
                                        <p className="text-lg font-black text-white tabular-nums">{isMeLeader ? firstName : gwWinner.player_name}</p>
                                        <p className="text-[11px] text-[#FBBF24] font-bold tabular-nums">{Number(gwWinner.event_total || 0).toLocaleString()} pts</p>
                                        {gwWinner.leadMargin !== undefined && (
                                            <div className="mt-1.5 flex flex-col items-center gap-1">
                                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                    +{gwWinner.leadMargin} pts ahead
                                                </span>
                                                <span className={clsx(
                                                    "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                                    gwWinner.leadMargin >= 15
                                                        ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                                                        : gwWinner.leadMargin >= 5
                                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                                        : "bg-red-500/10 border-red-500/30 text-red-300 animate-pulse"
                                                )}>
                                                    {gwWinner.leadMargin >= 15 ? "Dominant 🛡️" : gwWinner.leadMargin >= 5 ? "Contested ⚔️" : "Nail-Biter 🔥"}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {!isMeLeader && myEntry && (
                                        <div className="fc-gw-live-leader rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center flex-shrink-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Your Points</p>
                                            <p className="text-lg font-black text-white tabular-nums">{firstName}</p>
                                            <p className="text-[11px] text-emerald-400 font-bold tabular-nums">{Number(myEntry.event_total || 0).toLocaleString()} pts</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
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
                                            : 'ACTION REQUIRED: Pay before the FPL deadline'}
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

                        {/* Gameweek Preparation Stage — Displayed once the finished GW concludes */}
                        {currentFplEvent?.isPreparingForNextGw && (
                            <div className="w-full rounded-[2rem] border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[#0e171b] to-emerald-950/30 p-6 shadow-2xl relative overflow-hidden mt-4 mb-2 animate-in fade-in duration-500">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500 blur-[130px] opacity-10 pointer-events-none" />
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                            <Calendar className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    Preparing for {currentFplEvent.nextName || `Gameweek ${currentFplEvent.nextId}`}
                                                </span>
                                                {currentFplEvent.nextDeadlineTime && (
                                                    <span className="text-[11px] text-gray-400 font-medium">
                                                        Deadline: {new Date(currentFplEvent.nextDeadlineTime).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                                                {hasPaid 
                                                    ? "You're Locked In for the Next Gameweek 🔒" 
                                                    : "Fund Your Wallet for the Next Gameweek ⚡"}
                                            </h3>
                                            <p className="text-xs text-gray-300 mt-1 max-w-xl leading-relaxed">
                                                {hasPaid
                                                    ? `Your KES ${gameweekStake.toLocaleString()} stake is covered from your wallet balance (KES ${walletBalance.toLocaleString()}). Tweak your team and prepare your lineup!`
                                                    : `Deposit your KES ${gameweekStake.toLocaleString()} weekly stake before the deadline to compete for the ${leagueName} weekly pot.`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                                        {!hasPaid ? (
                                            <button
                                                onClick={() => navigate('/deposit')}
                                                className="flex-1 md:flex-initial px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                                            >
                                                <Wallet className="w-4 h-4" />
                                                Fund Wallet (KES {gameweekStake})
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate('/sidebets')}
                                                className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                                            >
                                                <Flame className="w-4 h-4 text-amber-400" />
                                                Challenge in Side Bets
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigate('/standings')}
                                            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <BarChart3 className="w-4 h-4 text-blue-400" />
                                            Standings
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}



                        {!currentFplEvent?.isPreparingForNextGw && !gwWinner && members.length > 0 && (
                            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                                        <Trophy className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-amber-300 uppercase tracking-wider">
                                            No Eligible Funded Winner
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            Chama Rule: Minimum 2 funded managers required to contest the pot. Unfunded managers cannot claim prize money.
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                    {members.filter(m => m.hasPaid && m.isActive !== false).length} Funded
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Main Content — Dense Grid Layout */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 pb-40 lg:pb-28 z-10 relative mt-2">

                {/* === ROW 1: Vault (8) + GW Rank Card (4) === */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4 items-stretch">
                    {/* Vault / Pot Swapper */}
                    <div className="lg:col-span-8 flex flex-col h-full">
                        <PotVaultSwapper
                            weeklyPot={weeklyPot}
                            seasonVault={seasonVaultProjected}
                            weeklyRulesPercent={rules.weekly}
                            isStealthMode={isStealthMode}
                        />
                    </div>

                    {/* GW Rank Card — live standings from FPL */}
                    <div className="lg:col-span-4 bg-[#161d24] border border-white/5 shadow-2xl shadow-black/50 rounded-[1.5rem] p-5 flex flex-col justify-between h-full overflow-hidden">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                    <Star className="w-3.5 h-3.5 text-[#FBBF24]" /> GW Standings
                                </h4>
                                {gwWinner && (
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#10B981]/20 bg-[#10B981]/10 text-[#10B981]">
                                        {currentFplEvent?.finished ? 'Final' : 'Live'}
                                    </span>
                                )}
                            </div>

                            {/* User's own rank highlight */}
                            {(() => {
                                const myRankEntry = fplStandings.findIndex((e: any) =>
                                    (currentUser?.fplTeamId && Number(e.entry) === Number(currentUser.fplTeamId)) ||
                                    (currentUser?.secondFplTeamId && Number(e.entry) === Number(currentUser.secondFplTeamId)) ||
                                    currentUser?.displayName?.toLowerCase().includes(e.player_name?.toLowerCase())
                                );
                                const myEntry = myRankEntry >= 0 ? fplStandings[myRankEntry] : null;
                                return myEntry ? (
                                    <div className="rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/8 px-3 py-2 flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-[#FBBF24]/20 border border-[#FBBF24]/40 text-[#FBBF24] text-[10px] font-black flex items-center justify-center flex-shrink-0">
                                                {myRankEntry + 1}
                                            </span>
                                            <div>
                                                <p className="text-xs font-black text-white leading-tight truncate max-w-[100px]">{firstName}</p>
                                                <p className="text-[10px] text-gray-500">You</p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-[#FBBF24] tabular-nums">{myEntry.event_total ?? 0} pts</span>
                                    </div>
                                ) : null;
                            })()}

                            {/* Top 3 ranks */}
                            <div className="space-y-1.5">
                                {fplStandings.length === 0 ? (
                                    <div className="text-xs text-gray-600 font-bold tracking-widest uppercase py-4 text-center">Waiting for FPL data…</div>
                                ) : fplStandings.slice(0, 3).map((entry: any, idx: number) => {
                                    const medals = ['🥇', '🥈', '🥉'];
                                    const isMe = (currentUser?.fplTeamId && Number(entry.entry) === Number(currentUser.fplTeamId)) ||
                                        (currentUser?.secondFplTeamId && Number(entry.entry) === Number(currentUser.secondFplTeamId));
                                    return (
                                        <div key={entry.entry} className={clsx(
                                            'flex items-center justify-between rounded-xl px-3 py-2 transition-colors',
                                            isMe ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/[0.02] border border-white/5'
                                        )}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-sm flex-shrink-0">{medals[idx] || <span className="text-[10px] font-bold text-gray-500 w-5 text-center">{idx + 1}</span>}</span>
                                                <span className="text-[11px] font-bold text-white truncate">{entry.player_name?.split(' ')[0]}</span>
                                                {isMe && <span className="text-[9px] text-emerald-400 font-black">(you)</span>}
                                            </div>
                                            <span className="text-[11px] font-black text-[#FBBF24] tabular-nums flex-shrink-0">{entry.event_total ?? 0}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/standings')}
                            className="w-full mt-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-emerald-400 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                            View Full Standings →
                        </button>
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
                                        <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
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

                {/* === ROW 2: Personal Status (5) + Chart (7) === */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4 items-stretch">
                    {/* Personal Status + Pay Action */}
                    {currentUser && (
                        <div className={clsx(
                            "fc-member-status-card",
                            "lg:col-span-5 rounded-[1.5rem] p-5 border relative overflow-hidden shadow-xl border-white/5 shadow-black/50 flex flex-col justify-between h-full",
                            isRecentWinner ? "bg-[#1c272c] border-[#FBBF24]/50 shadow-[0_0_30px_rgba(251,191,36,0.12)]" :
                                (isCurrentGwVoided ? "bg-amber-500/5 border-amber-500/20" :
                                    (hasPaid ? "bg-[#10B981]/5 border-[#10B981]/20" : "bg-red-500/5 border-red-500/20"))
                        )}>
                            {isRecentWinner && (
                                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#FBBF24] to-transparent" />
                            )}
                            <div>
                                {/* Status Label */}
                                <span className={clsx(
                                    "text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 mb-2",
                                    isRecentWinner ? "text-[#FBBF24]" :
                                        (isCurrentGwVoided ? "text-amber-400" : (hasPaid ? "text-[#10B981]" : "text-red-400"))
                                )}>
                                    <span className={clsx(
                                        "w-1.5 h-1.5 rounded-full animate-pulse",
                                        isRecentWinner ? "bg-[#FBBF24]" :
                                            (isCurrentGwVoided ? "bg-amber-400" : (hasPaid ? "bg-[#10B981]" : "bg-red-500"))
                                    )} />
                                    Your Gameweek Status
                                </span>
                                <h3 className={clsx("text-xl font-black tracking-tight mb-1.5", isRecentWinner ? "text-[#FBBF24]" : "text-white")}>
                                    {isRecentWinner
                                        ? "Champion of the Week 🏆"
                                        : (isCurrentGwVoided
                                            ? "Gameweek Voided ⚠️"
                                            : (hasPaid ? "Verified & Active" : "Action Required"))}
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                                    {isRecentWinner
                                        ? "Incredible! You secured the highest points this GW. Payout processing."
                                        : (isCurrentGwVoided
                                            ? "Contest requires at least 2 funded managers to disburse the weekly pot. All funds and balances are preserved."
                                            : (hasPaid
                                                ? `Your contribution is secured. Eligible for this GW's pot. Wallet covers your next ${gameweekStake > 0 ? Math.floor(walletBalance / gameweekStake) : 0} Gameweeks.`
                                                : (currentUser?.missedGameweeks === 1
                                                    ? <span className="text-red-400 font-bold">⚠️ CRITICAL: You have missed 1 Gameweek. Failure to pay for 2 consecutive Gameweeks results in permanent disqualification from the Vault.</span>
                                                    : "Your contribution is missing. Pay before the FPL deadline.")))}
                                </p>
                            </div>

                            {!hasPaid && !isCurrentGwVoided && (
                                <div className="flex flex-col gap-2 mt-auto">
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
                                            <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 pl-4 list-decimal marker:text-gray-500">
                                                <li>Go to M-Pesa Menu &gt; <strong>Pochi La Biashara</strong></li>
                                                <li>Send to Mobile No. <strong>{payoutDestinationPhone}</strong></li>
                                                <li>Amount: <strong>KES {gameweekStake}</strong></li>
                                            </ol>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-gray-600 dark:text-gray-400">
                                        Destination: <span className="font-black text-[#10B981]">{payoutDestinationPhone}</span>
                                    </div>

                                    <div className="flex justify-end mt-1">
                                        <button
                                            onClick={() => { setShowClaimModal(true); setClaimSubmitted(false); setClaimReceiptCode(''); }}
                                            className="text-[11px] text-[#FBBF24]/80 hover:text-[#FBBF24] underline underline-offset-2 transition-colors flex items-center gap-1 font-bold"
                                        >
                                            Claim M-Pesa Receipt via WhatsApp →
                                        </button>
                                    </div>
                                </div>
                            )}
                            {hasPaid && !isCurrentGwVoided && (
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
                    <div className="fc-member-chart lg:col-span-7 bg-[#161d24] border border-white/5 shadow-2xl shadow-black/50 rounded-[1.5rem] p-5 flex flex-col justify-between h-full">
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

                {/* === ROW 4: Live Escrow Feed === */}
                <div className="fc-member-feed w-full bg-[#0d1117] border border-white/5 rounded-[1.5rem] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-[#10B981]" />
                        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">League Activity</h4>
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse ml-1" />
                        <span className="ml-auto font-mono text-[10px] text-gray-700">{leagueName}</span>
                        <button
                            onClick={() => setShowFeedPanelMobile(prev => !prev)}
                            className="sm:hidden text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-white/10 text-gray-600 dark:text-gray-300"
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
                                    ev.eventType === 'rules' ? 'text-blue-400 bg-blue-400/10' : 'text-gray-600 dark:text-gray-400 bg-white/5';
                            return (
                                <div key={ev.id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors animate-in fade-in duration-500">
                                    <span className="text-gray-700 text-[10px] w-12 flex-shrink-0">{timeStr}</span>
                                    <span className={clsx('text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0', tagColor)}>
                                        {ev.eventType || 'SYS'}
                                    </span>
                                    <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{ev.message}</span>
                                    {ev.actor && <span className="ml-auto text-[10px] text-gray-700 flex-shrink-0">@{ev.actor}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>

            {/* Wallet Top-Up Modal */}
            {showTopUpModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#111820]/95 border border-[#10B981]/20 rounded-3xl p-7 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="mb-5">
                            <div className="flex items-center gap-2 mb-1">
                                <Wallet className="w-5 h-5 text-[#10B981]" />
                                <h3 className="text-xl font-extrabold text-white">Top Up Wallet</h3>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Send any amount to your wallet. Your current balance is not reduced, and the top-up is added separately once M-Pesa confirms it.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Amount to Top Up</label>
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
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Note for Chairman or Self</label>
                                <textarea
                                    rows={3}
                                    value={topUpNote}
                                    onChange={(e) => setTopUpNote(e.target.value)}
                                    placeholder="Optional: 'Use my GW winnings' or 'Add extra funds for next 3 GWs'"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#10B981]/50 transition-colors resize-none"
                                />
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
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
                                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-600 dark:text-gray-400 text-sm font-bold rounded-xl transition-colors border border-white/10"
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



            {/* Module 3B: Claim Payment Modal */}
            {showClaimModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#111820]/95 border border-[#FBBF24]/20 rounded-3xl p-7 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                        {claimSubmitted ? (
                            <div className="text-center py-4 space-y-4">
                                <div className="w-14 h-14 rounded-full bg-[#FBBF24]/10 border border-[#FBBF24]/30 flex items-center justify-center mx-auto">
                                    <Check className="w-7 h-7 text-[#FBBF24]" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-extrabold text-white mb-1">Claim Submitted ✓</h3>
                                    <p className="text-sm text-gray-400">Your claim has been logged for the Chairman's review.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const targetPhone = (payoutDestinationPhone || chairmanPhone || '').startsWith('0') 
                                            ? `254${(payoutDestinationPhone || chairmanPhone || '').slice(1)}` 
                                            : (payoutDestinationPhone || chairmanPhone || '');
                                        const msg = `*M-Pesa Payment Claim*\n\n` +
                                            `🏆 *League:* ${leagueName || 'FantasyChama'}\n` +
                                            `👤 *Member:* ${currentUser?.displayName || 'Member'} (${memberPhone || ''})\n` +
                                            `🧾 *M-Pesa Code:* ${claimReceiptCode}\n\n` +
                                            `I have logged my payment claim in FantasyChama. Please confirm and update my wallet status!`;
                                        window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                    }}
                                    className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,211,102,0.25)]"
                                >
                                    <MessageCircle className="w-4 h-4 fill-current" /> Notify Chairman via WhatsApp
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[#FBBF24] text-lg">🚨</span>
                                        <h3 className="text-xl font-extrabold text-white">Claim Payment</h3>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Paid via M-Pesa but still showing unpaid? Submit your receipt and the Chairman will verify it within 24h.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Receipt Code</label>
                                        <input
                                            type="text"
                                            value={claimReceiptCode}
                                            onChange={e => setClaimReceiptCode(e.target.value.toUpperCase())}
                                            placeholder="e.g. SCL90XXXXXX"
                                            className="w-full bg-white/5 border border-[#FBBF24]/20 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#FBBF24]/50 transition-colors"
                                        />
                                    </div>
                                    <div className="bg-[#FBBF24]/5 border border-[#FBBF24]/15 rounded-xl p-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                        The Chairman will receive an alert to cross-check your M-Pesa receipt with their records. False claims may result in suspension.
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowClaimModal(false)}
                                            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-600 dark:text-gray-400 text-sm font-bold rounded-xl transition-colors border border-white/10"
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
