import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptText, History, Download, ShieldCheck, Trophy, Wallet, TrendingUp, CheckCircle2, RefreshCw, ShieldAlert, Clock3 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getApiBaseUrl } from '../utils/api';
import { collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, serverTimestamp, where, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import clsx from 'clsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Header from '../components/Header';

export default function Finances() {
    const navigate = useNavigate();
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const memberPhone = localStorage.getItem('memberPhone');
    const activeUserId = localStorage.getItem('activeUserId');
    const { members, listenToLeagueMembers, isStealthMode, role } = useStore();

    const [transactions, setTransactions] = useState<any[]>([]);
    const [gameweekStake, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState<any>({ weekly: 70, vault: 30, seasonWinnersCount: 3, seasonWinnersMode: 'top3', seasonDistribution: [50, 30, 20] });
    const [leagueChairmanId, setLeagueChairmanId] = useState<string | null>(null);
    const [leagueName, setLeagueName] = useState('League');
    const [showVaultChart, setShowVaultChart] = useState(false);
    const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
    const [isApprovingPayoutId, setIsApprovingPayoutId] = useState<string | null>(null);
    const [isRejectingPayoutId, setIsRejectingPayoutId] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [pendingWalletTopUpRequests, setPendingWalletTopUpRequests] = useState<any[]>([]);
    const [cashTopUpAmount, setCashTopUpAmount] = useState('');
    const [cashTopUpNote, setCashTopUpNote] = useState('');
    const [isSubmittingCashTopUpRequest, setIsSubmittingCashTopUpRequest] = useState(false);
    const [isResolvingWalletRequestId, setIsResolvingWalletRequestId] = useState<string | null>(null);

    useEffect(() => {
        setActionMessage({ type: 'success', text: `✓ Active API: ${getApiBaseUrl()}` });
        setTimeout(() => setActionMessage(null), 5000);
    }, []);

    const txDate = (tx: any) => {
        const raw = tx?.timestamp;
        if (raw?.toDate) return raw.toDate() as Date;
        if (raw instanceof Date) return raw;
        if (typeof raw === 'number') return new Date(raw);
        return null;
    };

    useEffect(() => {
        let unsubscribeMembers = () => { };
        if (activeLeagueId && members.length === 0) {
            unsubscribeMembers = listenToLeagueMembers(activeLeagueId);
        }

        if (activeLeagueId) {
            const txRef = collection(db, 'leagues', activeLeagueId, 'transactions');
            const q = query(txRef, orderBy('timestamp', 'desc'));
            const unsubscribeTx = onSnapshot(q, (snapshot) => {
                const txs = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                }));
                setTransactions(txs);
            }, (err) => {
                console.warn('[finances] transaction listener failed:', err?.message || err);
            });

            const leagueRef = doc(db, 'leagues', activeLeagueId);
            const unsubscribeLeague = onSnapshot(leagueRef, (docSnap: any) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMonthlyContribution(data.gameweekStake || 0);
                    if (data.rules) setRules(data.rules);
                    setLeagueChairmanId(data.chairmanId);
                    setLeagueName(data.leagueName || data.name || 'League');
                }
            }, (err) => {
                console.warn('[finances] league listener failed:', err?.message || err);
            });

            return () => {
                try { unsubscribeTx(); } catch (err) {
                    console.warn('[finances] tx listener cleanup failed:', err);
                }
                try { unsubscribeLeague(); } catch (err) {
                    console.warn('[finances] league listener cleanup failed:', err);
                }
                try { unsubscribeMembers(); } catch (err) {
                    console.warn('[finances] members listener cleanup failed:', err);
                }
            };
        }

        return () => {
            try { unsubscribeMembers(); } catch (err) {
                console.warn('[finances] members listener cleanup failed:', err);
            }
        };
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    useEffect(() => {
        const raf = window.requestAnimationFrame(() => setShowVaultChart(true));
        return () => window.cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        if (!activeLeagueId || role !== 'admin') {
            setPendingApprovals([]);
            return;
        }

        const pendingRef = collection(db, 'leagues', activeLeagueId, 'pending_payouts');
        const pendingQuery = query(pendingRef, where('status', '==', 'awaiting_approval'));
        const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
            const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
            setPendingApprovals(items);
        }, (err) => {
            console.warn('[finances] pending approvals listener failed:', err?.message || err);
            setPendingApprovals([]);
        });

        return () => {
            try { unsubscribePending(); } catch (err) {
                console.warn('[finances] pending approvals listener cleanup failed:', err);
            }
        };
    }, [activeLeagueId, role]);

    useEffect(() => {
        if (!activeLeagueId) {
            setPendingWalletTopUpRequests([]);
            return;
        }

        const requestsRef = collection(db, 'leagues', activeLeagueId, 'wallet_topup_requests');
        const requestsQuery = query(requestsRef, where('status', '==', 'pending'));
        const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
            const items = snapshot.docs
                .map((item) => ({ id: item.id, ...item.data() }))
                .sort((a: any, b: any) => {
                    const aTs = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                    const bTs = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                    return bTs - aTs;
                });
            if (role === 'admin') {
                setPendingWalletTopUpRequests(items);
                return;
            }
            const own = items.filter((item: any) => item.memberId === activeUserId || item.phone === memberPhone);
            setPendingWalletTopUpRequests(own);
        }, (err) => {
            console.warn('[finances] wallet top-up request listener failed:', err?.message || err);
            setPendingWalletTopUpRequests([]);
        });

        return () => {
            try { unsubscribeRequests(); } catch (err) {
                console.warn('[finances] wallet top-up request listener cleanup failed:', err);
            }
        };
    }, [activeLeagueId, role, activeUserId, memberPhone]);

    const paidMembers = members.filter(m => m.hasPaid && m.isActive !== false);
    const totalSecured = paidMembers.length * (gameweekStake || 1400);
    const seasonVault = totalSecured * (rules.vault / 100);
    const activeMembersCount = members.filter((member) => member.isActive !== false).length;
    const configuredWinnersCount = Number(rules.seasonWinnersCount || 3);
    const eligibleWinnersCount = Math.min(configuredWinnersCount, activeMembersCount || configuredWinnersCount);

    const getSeasonVaultPercentages = (winnerCount: number) => {
        if (winnerCount === 1) return [100];
        if (winnerCount === 3) return [50, 30, 20];
        return [45, 25, 15, 10, 5];
    };

    const configuredDistribution = Array.isArray(rules.seasonDistribution) && rules.seasonDistribution.length > 0
        ? rules.seasonDistribution.map((value: any) => Number(value || 0)).filter((value: number) => Number.isFinite(value) && value >= 0)
        : getSeasonVaultPercentages(configuredWinnersCount);
    const seasonVaultPercentages = configuredDistribution.length > 0
        ? configuredDistribution
        : getSeasonVaultPercentages(configuredWinnersCount);
    const seasonVaultPreview = seasonVaultPercentages
        .slice(0, eligibleWinnersCount)
        .map((percentage: number, index: number) => {
            const place = index + 1;
            return {
                place,
                percentage,
                amount: Math.round(seasonVault * (percentage / 100)),
            };
        });
    const isPreviewCapped = activeMembersCount < configuredWinnersCount;

    const currentUser = members.find(m => m.id === activeUserId) || members.find(m => m.phone === memberPhone);
    const isAdmin = role === 'admin';
    const nowMs = Date.now();

    const toMillis = (value: any): number | null => {
        if (!value) return null;
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const parsed = Date.parse(String(value));
        return Number.isNaN(parsed) ? null : parsed;
    };

    // My winnings received via B2C payouts
    const myWinnings = transactions
        .filter(tx => tx.type === 'payout' && (
            tx.winnerPhone === currentUser?.phone ||
            tx.winnerName === currentUser?.displayName
        ))
        .reduce((acc, tx) => acc + (tx.amount || 0), 0);

    // Member-only transaction log: their deposits + payout wins only
    const myTransactions = isAdmin ? transactions : transactions.filter(tx =>
        (tx.type === 'deposit' && tx.phoneNumber === currentUser?.phone) ||
        (tx.type === 'payout' && (
            tx.winnerPhone === currentUser?.phone ||
            tx.winnerName === currentUser?.displayName
        ))
    );

    // Personal stats still needed for the card and contributed total
    const depositTxSum = transactions
        .filter(tx => tx.type === 'deposit' && tx.phoneNumber === currentUser?.phone)
        .reduce((acc, tx) => acc + (tx.amount || 0), 0);
    const myTotalContributed = depositTxSum || (currentUser?.hasPaid ? (gameweekStake || 1400) : 0);
    const redZoneMembers = members.filter((member) => member.role !== 'admin' && member.isActive !== false && !member.hasPaid);

        const inferredGw = transactions.reduce((maxGw, tx) => {
            const value = Number(tx.gameweek || tx.gw || 0);
            return Number.isFinite(value) ? Math.max(maxGw, value) : maxGw;
        }, 0);

        const scopeTx = isAdmin ? transactions : myTransactions;
        const gwScopedTx = scopeTx.filter((tx) => {
            if (inferredGw > 0) {
                const txGw = Number(tx.gameweek || tx.gw || 0);
                return txGw === inferredGw;
            }
            const txTs = toMillis(tx.timestamp);
            if (!txTs) return false;
            return nowMs - txTs <= 7 * 24 * 60 * 60 * 1000;
        });

        const inflowThisGw = gwScopedTx
            .filter((tx) => tx.type === 'deposit')
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const outflowThisGw = gwScopedTx
            .filter((tx) => tx.type === 'payout')
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const netThisGw = inflowThisGw - outflowThisGw;

        const dueTs = toMillis((currentUser as any)?.nextDueAt) || toMillis((currentUser as any)?.dueAt) || toMillis((currentUser as any)?.deadlineAt) || (nowMs + 72 * 60 * 60 * 1000);
        const dueDate = new Date(dueTs);
        const nextDueStatus = currentUser?.hasPaid ? 'on-time' : (dueTs >= nowMs ? 'grace' : 'overdue');
        const nextDueLabel = nextDueStatus === 'on-time' ? 'On Time' : nextDueStatus === 'grace' ? 'Grace Window' : 'Overdue';
        const nextDueTone = nextDueStatus === 'on-time'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : nextDueStatus === 'grace'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300';

        const pendingAgesHours = pendingApprovals
            .map((item) => {
                const created = toMillis((item as any).createdAt) || toMillis((item as any).timestamp) || toMillis((item as any).requestedAt);
                if (!created) return 0;
                return Math.max(0, (nowMs - created) / (1000 * 60 * 60));
            })
            .filter((hours) => Number.isFinite(hours));
        const oldestPendingHours = pendingAgesHours.length > 0 ? Math.max(...pendingAgesHours) : 0;
        const staleApprovalCount = pendingAgesHours.filter((hours) => hours >= 6).length;

    const exportLedgerCSV = () => {
        const exportRows = (isAdmin ? transactions : myTransactions).map((tx: any) => {
                const ts = txDate(tx);
            const isPayout = tx.type === 'payout';
            return [
                tx.receiptId || tx.id || '',
                ts ? ts.toLocaleDateString() : '',
                ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                tx.type || '',
                tx.amount || 0,
                isPayout ? 'GW payout' : 'Deposit',
                tx.mpesaCode || tx.reference || '',
                tx.gameweek || '',
                isPayout ? (tx.winnerName || currentUser?.displayName || '') : (tx.memberName || currentUser?.displayName || '')
            ];
        });

        const rows = [
            ['Receipt No.', 'Date', 'Time', 'Type', 'Amount (KES)', 'Description', 'Reference', 'Gameweek', 'Member'],
            ...exportRows,
        ];
        const csv = rows.map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${(leagueName || 'League').replace(/\s/g, '_')}_Ledger.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const showActionMessage = (type: 'success' | 'error', text: string) => {
        setActionMessage({ type, text });
        window.setTimeout(() => setActionMessage(null), 3500);
    };

    const handleSubmitCashTopUpRequest = async () => {
        if (!activeLeagueId || !currentUser || !activeUserId) return;

        const amount = Math.max(1, Math.floor(Number(cashTopUpAmount || 0)));
        if (!Number.isFinite(amount) || amount <= 0) {
            showActionMessage('error', 'Enter a valid wallet top-up amount first.');
            return;
        }

        setIsSubmittingCashTopUpRequest(true);
        try {
            await addDoc(collection(db, 'leagues', activeLeagueId, 'wallet_topup_requests'), {
                memberId: activeUserId,
                memberName: currentUser.displayName || 'Member',
                phone: currentUser.phone || memberPhone || '',
                amount,
                note: cashTopUpNote.trim() || null,
                method: 'cash_handoff',
                status: 'pending',
                nudgeCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                message: `Cash handoff wallet top-up request: ${currentUser.displayName} requested KES ${amount.toLocaleString()} manual credit approval.`,
                timestamp: serverTimestamp(),
                readBy: []
            });

            setCashTopUpAmount('');
            setCashTopUpNote('');
            showActionMessage('success', 'Cash handoff request submitted. Chairman can approve wallet credit from Action Queue.');
        } catch (err: any) {
            showActionMessage('error', `Request failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsSubmittingCashTopUpRequest(false);
        }
    };

    const handleNudgeWalletCreditRequest = async (requestItem: any) => {
        if (!activeLeagueId) return;
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'wallet_topup_requests', requestItem.id), {
                nudgeCount: increment(1),
                lastNudgedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                message: `Wallet credit nudge: ${requestItem.memberName} is still waiting for cash handoff approval (KES ${Number(requestItem.amount || 0).toLocaleString()}).`,
                timestamp: serverTimestamp(),
                readBy: []
            });
            showActionMessage('success', 'Nudge sent to Chairman queue.');
        } catch (err: any) {
            showActionMessage('error', `Nudge failed: ${err?.message || 'Unknown error'}`);
        }
    };

    const handleApproveWalletTopUpRequest = async (requestItem: any) => {
        if (!activeLeagueId || !requestItem?.memberId) return;

        setIsResolvingWalletRequestId(requestItem.id);
        try {
            const amount = Math.max(1, Math.floor(Number(requestItem.amount || 0)));
            const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', requestItem.memberId);

            await updateDoc(memberRef, {
                walletBalance: increment(amount),
                hasPaid: true,
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                type: 'deposit',
                amount,
                memberId: requestItem.memberId,
                memberName: requestItem.memberName || 'Member',
                phoneNumber: requestItem.phone || null,
                paymentMethod: 'cash_handoff',
                receiptId: `CASH_TOPUP_${Date.now().toString().slice(-6)}`,
                note: requestItem.note || 'Manual cash handoff wallet top-up',
                timestamp: serverTimestamp()
            });

            await updateDoc(doc(db, 'leagues', activeLeagueId, 'wallet_topup_requests', requestItem.id), {
                status: 'approved',
                approvedAt: serverTimestamp(),
                approvedBy: auth.currentUser?.displayName || 'Chairman',
                updatedAt: serverTimestamp()
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'success',
                targetMemberId: requestItem.memberId,
                message: `Wallet credited: KES ${amount.toLocaleString()} cash handoff top-up approved.`,
                timestamp: serverTimestamp(),
                readBy: []
            });

            showActionMessage('success', `Approved wallet credit for ${requestItem.memberName} (KES ${amount.toLocaleString()}).`);
        } catch (err: any) {
            showActionMessage('error', `Wallet approval failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsResolvingWalletRequestId(null);
        }
    };

    const handleRejectWalletTopUpRequest = async (requestItem: any) => {
        if (!activeLeagueId) return;
        setIsResolvingWalletRequestId(requestItem.id);
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'wallet_topup_requests', requestItem.id), {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                rejectedBy: auth.currentUser?.displayName || 'Chairman',
                updatedAt: serverTimestamp()
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                targetMemberId: requestItem.memberId,
                message: `Wallet top-up request rejected. Contact Chairman for manual reconciliation details.`,
                timestamp: serverTimestamp(),
                readBy: []
            });

            showActionMessage('success', `Rejected wallet request for ${requestItem.memberName}.`);
        } catch (err: any) {
            showActionMessage('error', `Reject failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsResolvingWalletRequestId(null);
        }
    };

    const handleApprovePendingPayout = async (payout: any) => {
        if (!activeLeagueId) return;

        setIsApprovingPayoutId(payout.id);
        try {
            const payoutPoints = Number(
                payout.points ??
                payout.winningPoints ??
                payout.gwPoints ??
                payout.event_total ??
                0
            );
            const winnerMember = members.find((member) =>
                member.id === payout.winnerId ||
                member.displayName === payout.winnerName
            );
            const payoutPhone = payout.winnerPhone || winnerMember?.phone;

            if ((payout.method === 'mpesa' || !payout.method) && !payoutPhone) {
                throw new Error('Winner phone number is missing. Update member details and retry.');
            }

            if (payout.method === 'mpesa' || !payout.method) {
                const payoutApiUrl = getApiBaseUrl();
                if (!payoutApiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
                const payoutRes = await fetch(`${payoutApiUrl}/api/mpesa/b2c`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: payoutPhone,
                        amount: payout.amount,
                        winnerName: payout.winnerName,
                        remarks: `FantasyChama GW${payout.gw} Approved Payout`,
                        userId: payout.winnerId || winnerMember?.id || activeUserId,
                        leagueId: activeLeagueId,
                        gw: Number(payout.gw || 0),
                        points: payoutPoints
                    })
                });
                if (!payoutRes.ok) {
                    throw new Error(`Payment dispatch failed (${payoutRes.status}).`);
                }
                const payoutData = await payoutRes.json();
                if (!payoutData.success) throw new Error(payoutData.message || 'B2C dispatch failed');
            }

            await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payout.id), {
                status: 'approved',
                winnerPhone: payoutPhone || null,
                approvedBy: auth.currentUser?.displayName || 'Admin',
                approvedAt: serverTimestamp()
            });

            const gwApiUrl = getApiBaseUrl();
            if (!gwApiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
            const gwDeductRes = await fetch(`${gwApiUrl}/api/league/deduct-gw-cost`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueId: activeLeagueId,
                    gwCostPerRound: gameweekStake,
                    gwNumber: payout.gw,
                    winnerName: payout.winnerName,
                    payoutMethod: payout.method,
                    chairmanId: auth.currentUser?.uid,
                    winnerAmount: payout.amount
                })
            });
            if (!gwDeductRes.ok) {
                throw new Error(`Stake deduction failed (${gwDeductRes.status}).`);
            }

            showActionMessage('success', `Resolved & paid ${payout.winnerName} (KES ${Number(payout.amount || 0).toLocaleString()}).`);
        } catch (err: any) {
            const message = err?.message || 'Unknown error';
            if (/failed to fetch|networkerror|network error|load failed/i.test(String(message))) {
                showActionMessage('error', 'Approval failed: Cannot reach payment server. Confirm Render backend URL and CORS settings.');
            } else {
                showActionMessage('error', `Approval failed: ${message}`);
            }
        } finally {
            setIsApprovingPayoutId(null);
        }
    };

    const handleRejectPendingPayout = async (payout: any) => {
        if (!activeLeagueId) return;

        setIsRejectingPayoutId(payout.id);
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payout.id), {
                status: 'rejected',
                rejectedBy: auth.currentUser?.displayName || 'Admin',
                rejectedAt: serverTimestamp()
            });
            showActionMessage('success', `Rejected payout request for ${payout.winnerName}.`);
        } catch (err: any) {
            showActionMessage('error', `Reject failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsRejectingPayoutId(null);
        }
    };

    if (!isAdmin && !currentUser) {
        return (
            <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#0b1014]">
                <div className="w-full max-w-6xl mx-auto">
                    <Header role={role || 'member'} title={leagueName} subtitle="Finance & Audit" />
                    <div className="fc-card mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4">
                        <p className="text-sm font-black text-amber-300 uppercase tracking-widest">Sync Pending</p>
                        <p className="text-sm text-gray-300 mt-1">Your member profile is still syncing. Refresh in a few seconds and try again.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fc-finances-page p-5 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto relative">
            <div className="absolute inset-0 pointer-events-none opacity-70">
                <div className="absolute -top-20 right-[8%] h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="absolute bottom-10 left-[6%] h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
            </div>
            <div className="w-full max-w-6xl mx-auto">
                <Header role={role || 'member'} title={leagueName} subtitle="Finance & Audit" />
                <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3"><ReceiptText className="w-8 h-8 md:w-10 md:h-10 text-[#10B981]" /> Audit Log</h1>
                        <p className="text-gray-400 font-medium tracking-wide max-w-xl">
                            A transparent, 100% immutable history of all funds entering and exiting the Chama Vault.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={exportLedgerCSV} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-xl transition">
                            <Download className="w-3.5 h-3.5" /> Export CSV
                        </button>
                    </div>
                </div>

                <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {!isAdmin && currentUser && (
                        <article className="fc-card rounded-2xl p-5 border border-emerald-500/20 bg-gradient-to-br from-emerald-500/12 via-[#161d24] to-[#161d24]">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Next Due</p>
                                <Clock3 className="w-4 h-4 text-emerald-300" />
                            </div>
                            <p className="text-2xl font-black tabular-nums text-white">KES {Number(gameweekStake || 0).toLocaleString()}</p>
                            <p className="text-[11px] text-gray-400 mt-1">Deadline: {dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                            <span className={clsx('mt-3 inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border', nextDueTone)}>{nextDueLabel}</span>
                        </article>
                    )}

                    {isAdmin && (
                        <article className="fc-card rounded-2xl p-5 border border-amber-500/25 bg-gradient-to-br from-amber-500/14 via-[#161d24] to-[#161d24]">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Approval SLA</p>
                                <RefreshCw className="w-4 h-4 text-amber-300" />
                            </div>
                            <p className="text-2xl font-black tabular-nums text-white">{oldestPendingHours.toFixed(1)}h</p>
                            <p className="text-[11px] text-gray-400 mt-1">Oldest pending payout age</p>
                            <p className="text-[11px] font-bold text-amber-300 mt-3">{staleApprovalCount} stale ({'>'}=6h)</p>
                        </article>
                    )}

                    <article className="fc-card fc-cashflow-health-card rounded-2xl p-5 border border-sky-500/20 bg-gradient-to-br from-sky-500/12 via-[#161d24] to-[#161d24]">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-sky-300">Cashflow Health</p>
                            <TrendingUp className="w-4 h-4 text-sky-300" />
                        </div>
                        <div className="space-y-1.5 text-[11px] font-bold">
                            <p className="flex justify-between text-gray-300"><span>Inflow {inferredGw > 0 ? `GW${inferredGw}` : '7d'}</span><span className="text-emerald-300">+ KES {inflowThisGw.toLocaleString()}</span></p>
                            <p className="flex justify-between text-gray-300"><span>Outflow {inferredGw > 0 ? `GW${inferredGw}` : '7d'}</span><span className="text-amber-300">- KES {outflowThisGw.toLocaleString()}</span></p>
                            <p className="flex justify-between text-white text-sm pt-2 border-t border-white/10"><span>Net</span><span className={netThisGw >= 0 ? 'text-emerald-300' : 'text-red-300'}>{netThisGw >= 0 ? '+' : '-'} KES {Math.abs(netThisGw).toLocaleString()}</span></p>
                        </div>
                    </article>

                    {!isAdmin && (
                        <article className="fc-card rounded-2xl p-5 border border-amber-500/25 bg-gradient-to-br from-amber-500/12 via-[#161d24] to-[#161d24]">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Wallet Top-Up</p>
                                <Wallet className="w-4 h-4 text-amber-300" />
                            </div>

                            <div className="space-y-2.5">
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={cashTopUpAmount}
                                    onChange={(e) => setCashTopUpAmount(e.target.value)}
                                    placeholder="Amount (KES)"
                                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
                                />
                                <input
                                    type="text"
                                    value={cashTopUpNote}
                                    onChange={(e) => setCashTopUpNote(e.target.value)}
                                    placeholder="Optional note (cash handoff ref)"
                                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => navigate('/deposit')}
                                        className="px-3 py-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/25 transition-colors"
                                    >
                                        M-Pesa Top Up
                                    </button>
                                    <button
                                        onClick={handleSubmitCashTopUpRequest}
                                        disabled={isSubmittingCashTopUpRequest}
                                        className="px-3 py-2 rounded-lg border border-amber-500/35 bg-amber-500/15 text-amber-300 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/25 transition-colors disabled:opacity-50"
                                    >
                                        {isSubmittingCashTopUpRequest ? 'Sending...' : 'Cash Handoff'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400">If you already handed cash to Chairman, send a request here. They can approve and credit your wallet from Action Queue.</p>
                            </div>
                        </article>
                    )}
                </section>

                <section className="fc-card rounded-3xl border border-[#FBBF24]/20 bg-gradient-to-br from-[#FBBF24]/10 via-[#161d24] to-[#161d24] p-5 md:p-6 mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-5">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FBBF24]">Vault payout preview</p>
                            <h2 className="text-2xl font-black text-white mt-1">Configured by Chairman</h2>
                            <p className="text-sm text-gray-400 mt-2 max-w-2xl">
                                The preview below mirrors the league's current season winner setup. It automatically caps itself when the league has fewer active members than the configured payout ladder.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left lg:text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Season winners</p>
                            <p className="text-lg font-black text-white tabular-nums">Top {configuredWinnersCount}</p>
                            <p className="text-[11px] text-gray-400 mt-1">{activeMembersCount} active member{activeMembersCount === 1 ? '' : 's'} · {isPreviewCapped ? `capped at Top ${eligibleWinnersCount}` : 'all tiers available'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {seasonVaultPreview.map((tier: { place: number; percentage: number; amount: number }) => (
                            <div key={tier.place} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">#{tier.place}</p>
                                    <span className={clsx(
                                        'text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border',
                                        tier.place === 1 ? 'border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]' : tier.place === 2 ? 'border-slate-300/30 bg-slate-300/10 text-slate-300' : 'border-amber-600/30 bg-amber-600/10 text-amber-500'
                                    )}>
                                        {tier.percentage}%
                                    </span>
                                </div>
                                <p className="mt-3 text-xl font-black text-[#FBBF24] tabular-nums">KES {tier.amount.toLocaleString()}</p>
                                <p className="mt-1 text-[11px] text-gray-400">Projected share of the season vault</p>
                            </div>
                        ))}
                    </div>

                    {isPreviewCapped && (
                        <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Tier capped</p>
                            <p className="text-sm text-amber-50/90 mt-1">
                                This league currently has only {activeMembersCount} active member{activeMembersCount === 1 ? '' : 's'}, so the vault preview stops at Top {eligibleWinnersCount}. The chairman's configured ladder will expand automatically once there are enough active players.
                            </p>
                        </div>
                    )}
                </section>

                {isAdmin && (redZoneMembers.length > 0 || pendingApprovals.length > 0 || pendingWalletTopUpRequests.length > 0) && (
                    <section className="fc-card mb-8 rounded-2xl border border-[#FBBF24]/25 bg-gradient-to-br from-[#FBBF24]/10 to-[#161d24] p-5 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-[#FBBF24]">Action Queue</h3>
                                <p className="text-xs text-gray-400 mt-1">These items require Chairman or Co-Chair action in Command Center.</p>
                            </div>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="px-4 py-2.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500/25 transition-colors"
                            >
                                Open Command Center
                            </button>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Red Zone Members</p>
                                <p className="text-2xl font-black tabular-nums text-white mt-1">{redZoneMembers.length}</p>
                                <p className="text-xs text-gray-400 mt-1">Top up needed before deadline.</p>
                            </div>
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Pending Payout Approvals</p>
                                <p className="text-2xl font-black tabular-nums text-white mt-1">{pendingApprovals.length}</p>
                                <p className="text-xs text-gray-400 mt-1">Review maker-checker queue now.</p>
                            </div>
                            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-sky-300">Wallet Cash Handoff Requests</p>
                                <p className="text-2xl font-black tabular-nums text-white mt-1">{pendingWalletTopUpRequests.length}</p>
                                <p className="text-xs text-gray-400 mt-1">Approve manual wallet credits from members.</p>
                            </div>
                        </div>

                        {actionMessage && (
                            <div className={clsx(
                                'mt-4 rounded-xl border px-3 py-2 text-xs font-bold',
                                actionMessage.type === 'success'
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                            )}>
                                {actionMessage.text}
                            </div>
                        )}

                        {pendingApprovals.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {pendingApprovals.slice(0, 4).map((payout: any) => (
                                    <div key={payout.id} className="rounded-xl border border-amber-500/25 bg-black/20 px-3 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black text-white">{payout.gwName || `GW${payout.gw || '-'}`} • {payout.winnerName || 'Unknown winner'}</p>
                                            <p className="text-[11px] text-gray-400 mt-0.5">KES {Number(payout.amount || 0).toLocaleString()} • {payout.method === 'cash' ? 'Cash' : 'M-Pesa'} • {payout.winnerPhone || 'No phone'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleRejectPendingPayout(payout)}
                                                disabled={isRejectingPayoutId === payout.id || isApprovingPayoutId === payout.id}
                                                className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-[11px] font-black uppercase tracking-widest hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                {isRejectingPayoutId === payout.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleApprovePendingPayout(payout)}
                                                disabled={isApprovingPayoutId === payout.id || isRejectingPayoutId === payout.id}
                                                className="px-3 py-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500/25 disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                {isApprovingPayoutId === payout.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                Resolve & Pay
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {pendingApprovals.length > 4 && (
                                    <p className="text-[11px] text-gray-500 font-bold">+ {pendingApprovals.length - 4} more pending approvals in Command Center.</p>
                                )}
                            </div>
                        )}

                        {pendingWalletTopUpRequests.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {pendingWalletTopUpRequests.slice(0, 5).map((requestItem: any) => (
                                    <div key={requestItem.id} className="rounded-xl border border-sky-500/25 bg-black/20 px-3 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black text-white">Cash Handoff • {requestItem.memberName || 'Member'}</p>
                                            <p className="text-[11px] text-gray-400 mt-0.5">KES {Number(requestItem.amount || 0).toLocaleString()} • {requestItem.phone || 'No phone'} {requestItem.note ? `• ${requestItem.note}` : ''}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleRejectWalletTopUpRequest(requestItem)}
                                                disabled={isResolvingWalletRequestId === requestItem.id}
                                                className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-[11px] font-black uppercase tracking-widest hover:bg-red-500/20 disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleApproveWalletTopUpRequest(requestItem)}
                                                disabled={isResolvingWalletRequestId === requestItem.id}
                                                className="px-3 py-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500/25 disabled:opacity-50"
                                            >
                                                {isResolvingWalletRequestId === requestItem.id ? 'Approving...' : 'Approve Credit'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {!isAdmin && pendingWalletTopUpRequests.length > 0 && (
                    <section className="fc-card mb-8 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 to-[#161d24] p-5 md:p-6">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-sky-300">Pending Wallet Credit Requests</h3>
                        <p className="text-xs text-gray-400 mt-1">If you already handed cash and your wallet is not credited yet, nudge Chairman here.</p>

                        <div className="mt-4 space-y-2">
                            {pendingWalletTopUpRequests.slice(0, 3).map((requestItem: any) => (
                                <div key={requestItem.id} className="rounded-xl border border-sky-500/25 bg-black/20 px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black text-white">KES {Number(requestItem.amount || 0).toLocaleString()} • awaiting approval</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{requestItem.note || 'Cash handoff wallet credit request'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleNudgeWalletCreditRequest(requestItem)}
                                        className="px-3 py-2 rounded-lg border border-sky-500/35 bg-sky-500/15 text-sky-300 text-[10px] font-black uppercase tracking-widest hover:bg-sky-500/25"
                                    >
                                        Nudge Chairman
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="fc-card bg-[#151c18] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <ShieldCheck className="w-24 h-24 text-[#22c55e]" />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center border border-[#22c55e]/20">
                                    <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                                </div>
                                <h3 className="text-[10px] font-bold text-[#22c55e] uppercase tracking-widest bg-[#22c55e]/10 px-2.5 py-1 rounded-md border border-[#22c55e]/20">Season Vault</h3>
                            </div>
                            <p className="text-3xl font-black tabular-nums tracking-tighter text-white">KES {isStealthMode ? '****' : seasonVault.toLocaleString()}</p>
                        </div>
                    </div>

                    {isAdmin ? (
                        <div className="fc-card bg-[#151c18] border border-white/5 p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Secured</h3>
                            </div>
                            <p className="text-3xl font-black tabular-nums tracking-tighter text-white">KES {isStealthMode ? '****' : totalSecured.toLocaleString()}</p>
                        </div>
                    ) : (
                        <div className="fc-card bg-[#151c18] border border-white/5 p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center border border-[#22c55e]/20">
                                    <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                                </div>
                                <h3 className="text-[10px] font-bold text-[#22c55e] uppercase tracking-widest bg-[#22c55e]/10 px-2.5 py-1 rounded-md border border-[#22c55e]/20">My Total Contributed</h3>
                            </div>
                            <p className="text-3xl font-black tabular-nums tracking-tighter text-white">KES {isStealthMode ? '****' : myTotalContributed.toLocaleString()}</p>
                        </div>
                    )}

                    <div className="fc-card bg-[#151c18] border border-[#FBBF24]/20 bg-gradient-to-br from-[#151c18] to-[#FBBF24]/5 p-6 rounded-2xl overflow-hidden relative">
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="w-10 h-10 rounded-full bg-[#FBBF24]/10 flex items-center justify-center border border-[#FBBF24]/20 shadow-lg">
                                <Trophy className="w-5 h-5 text-[#FBBF24]" />
                            </div>
                            <h3 className="text-[10px] font-bold text-[#FBBF24] uppercase tracking-widest bg-[#FBBF24]/10 px-2.5 py-1 rounded-md border border-[#FBBF24]/20">
                                {isAdmin ? 'Total Payouts Yielded' : 'My Total Winnings'}
                            </h3>
                        </div>
                        <p className="text-3xl font-black tabular-nums tracking-tighter text-[#FBBF24] relative z-10">
                            {isAdmin ? (
                                <span>KES {isStealthMode ? '****' : transactions.filter(t => t.type === 'payout').reduce((acc, t) => acc + (t.amount || 0), 0).toLocaleString()}</span>
                            ) : (
                                <span>KES {isStealthMode ? '****' : myWinnings.toLocaleString()}</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Chairman/Co-Chair Dedicated Earnings Panel */}
                {isAdmin && currentUser && (() => {
                    const totalCollectedGross = paidMembers.length * gameweekStake;
                    const hasCoAdmin = members.filter(m => m.role === 'admin').length > 1;
                    const isChairman = (auth.currentUser?.uid === leagueChairmanId) || (currentUser.authUid === leagueChairmanId);
                    
                    const chairmanRate = hasCoAdmin ? 0.03 : 0.04;
                    const coAdminRate = hasCoAdmin ? 0.01 : 0;
                    const myRate = isChairman ? chairmanRate : coAdminRate;
                    const myEarningsThisGW = totalCollectedGross * myRate;
                    const myRoleLabel = isChairman ? 'Chairman' : 'Co-Chair';
                    const myWalletBalance = currentUser.walletBalance || 0;

                    return (
                        <section className="fc-highlight-card fc-card bg-gradient-to-br from-[#FBBF24]/16 via-[#F59E0B]/8 to-[#161d24] border border-[#FBBF24]/35 rounded-2xl p-6 md:p-8 relative overflow-hidden mb-8 shadow-[0_18px_60px_rgba(251,191,36,0.14)]">
                            <div className="absolute top-0 right-0 w-56 h-56 bg-[#FBBF24] blur-[120px] opacity-[0.14] pointer-events-none"></div>
                            <div className="absolute -bottom-16 -left-12 w-52 h-52 bg-[#B45309] blur-[120px] opacity-[0.12] pointer-events-none"></div>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 rounded-full bg-[#FBBF24]/18 flex items-center justify-center border border-[#FBBF24]/35">
                                    <Wallet className="w-5 h-5 text-[#FBBF24]" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">My Earnings ({myRoleLabel})</h3>
                                    <p className="text-[10px] text-gray-400 font-bold">Auto-credited from the 10% Escrow Rake every Gameweek</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="fc-card bg-black/20 rounded-xl p-4 text-center border border-[#FBBF24]/30">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">My Rate</p>
                                    <p className="text-xl font-black text-white tabular-nums">{(myRate * 100).toFixed(1)}%</p>
                                    <p className="text-[8px] text-gray-500 mt-0.5">{isChairman ? 'Governance Fee' : 'Audit Fee'}</p>
                                </div>
                                <div className="fc-card bg-black/20 rounded-xl p-4 text-center border border-[#FBBF24]/30">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">This GW Est.</p>
                                    <p className="text-xl font-black text-white tabular-nums">
                                        KES {isStealthMode ? '****' : Math.round(myEarningsThisGW).toLocaleString()}
                                    </p>
                                </div>
                                <div className="fc-card bg-black/20 rounded-xl p-4 text-center border border-[#FBBF24]/30 shadow-[0_0_15px_rgba(251,191,36,0.1)]">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Wallet Balance</p>
                                    <p className="text-xl font-black text-white tabular-nums">
                                        KES {isStealthMode ? '****' : myWalletBalance.toLocaleString()}
                                    </p>
                                </div>
                                <div className="fc-card bg-black/20 rounded-xl p-4 text-center border border-[#FBBF24]/30">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Lifetime Earned</p>
                                    <p className="text-xl font-black text-white tabular-nums">
                                        KES {isStealthMode ? '****' : Math.round(currentUser.totalEarned || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Request Withdrawal Button */}
                            {myWalletBalance > 0 ? (
                                <button
                                    onClick={async () => {
                                        if (!activeLeagueId || !currentUser.phone) return;
                                        const confirmed = window.confirm(
                                            `Withdraw KES ${myWalletBalance.toLocaleString()} to M-Pesa (${currentUser.phone})?\n\nThis will trigger a B2C payout to your registered phone number.`
                                        );
                                        if (!confirmed) return;

                                        try {
                                            // 1. Trigger B2C payout
                                            const payoutApiUrl = getApiBaseUrl();
                                            if (!payoutApiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
                                            const res = await fetch(`${payoutApiUrl}/api/mpesa/b2c`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    phone: currentUser.phone,
                                                    amount: myWalletBalance,
                                                    leagueId: activeLeagueId,
                                                    remarks: `${myRoleLabel} kickback withdrawal`
                                                })
                                            });
                                            const data = await res.json();

                                            if (!data.success && !data.ConversationID) {
                                                throw new Error(data.message || 'B2C failed');
                                            }

                                            // 2. Log withdrawal to platform_treasury
                                            await addDoc(collection(db, 'platform_treasury'), {
                                                type: 'kickback_withdrawal',
                                                role: myRoleLabel.toLowerCase(),
                                                memberId: currentUser.id,
                                                memberName: currentUser.displayName,
                                                phone: currentUser.phone,
                                                amount: myWalletBalance,
                                                leagueId: activeLeagueId,
                                                timestamp: serverTimestamp()
                                            });

                                            // 3. Reset wallet balance
                                            const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', currentUser.id);
                                            await updateDoc(memberRef, { walletBalance: 0 });

                                            // 4. Notification
                                            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                                                type: 'transactionSuccess',
                                                message: `💰 ${myRoleLabel} ${currentUser.displayName} withdrew KES ${myWalletBalance.toLocaleString()} kickback earnings via M-Pesa B2C.`,
                                                timestamp: serverTimestamp(),
                                                readBy: [],
                                                targetMemberId: currentUser.id
                                            });

                                            alert(`KES ${myWalletBalance.toLocaleString()} sent to ${currentUser.phone}!`);
                                        } catch (err: any) {
                                            console.error("Withdrawal error:", err);
                                            alert(`Withdrawal failed: ${err.message}`);
                                        }
                                    }}
                                    className="w-full mt-5 flex items-center justify-center gap-2 py-3.5 bg-[#FBBF24] hover:bg-[#eab308] text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(251,191,36,0.15)] active:scale-[0.98]"
                                >
                                    <Wallet className="w-4 h-4" /> Request Withdrawal — KES {isStealthMode ? '****' : myWalletBalance.toLocaleString()}
                                </button>
                            ) : (
                                <p className="fc-empty-withdraw text-[10px] text-gray-300 font-bold mt-5 text-center uppercase tracking-widest bg-black/25 py-2 rounded-lg border border-[#FBBF24]/30">
                                    No balance to withdraw. Kickbacks are deposited automatically during GW resolution.
                                </p>
                            )}
                        </section>
                    );
                })()}

                <div className="fc-card bg-[#151c18] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-lg">Recent Activity</h3>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-white/5">
                        {myTransactions.length > 0 ? myTransactions.map((tx: any) => {
                            const isWinning = tx.type === 'payout';
                            const safeTxId = typeof tx.id === 'string' ? tx.id : 'UNKNOWN';
                            return (
                                <div key={tx.id} className="p-4 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className={clsx(
                                            'text-sm font-extrabold',
                                            isWinning ? 'text-[#FBBF24]' : 'text-[#10B981]'
                                        )}>
                                            {isWinning ? '+' : '-'} KES {tx.amount?.toLocaleString()}
                                        </span>
                                        <span className={clsx(
                                            'text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border',
                                            isWinning
                                                ? 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20'
                                                : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
                                        )}>
                                            {isWinning ? 'Won' : 'Verified'}
                                        </span>
                                    </div>
                                    <div className="font-bold text-white text-sm">
                                        {isWinning ? '🏆 GW Payout (Winner)' : 'M-Pesa Deposit'}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>{tx.receiptId || `TXN${safeTxId.substring(0, 8).toUpperCase()}`}</span>
                                        <span>{txDate(tx) ? txDate(tx)?.toLocaleDateString() : 'Just now'}</span>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="p-10 text-center text-gray-500">
                                <ReceiptText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No transactions yet</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block w-full overflow-x-auto">
                        <table className="fc-muted-table w-full min-w-[700px] text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-[#0a100a]/50">
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase">RECEIPT NO.</th>
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase">DATE / TIME</th>
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase">DESCRIPTION</th>
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase text-right">AMOUNT</th>
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase text-center">STATUS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {myTransactions.length > 0 ? (
                                    myTransactions.map((tx: any) => {
                                        const isWinning = tx.type === 'payout';
                                        const safeTxId = typeof tx.id === 'string' ? tx.id : 'UNKNOWN';
                                        return (
                                            <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4 text-xs font-mono text-gray-500">
                                                    {tx.receiptId || `TXN${safeTxId.substring(0, 8).toUpperCase()}`}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-white">
                                                            {txDate(tx) ? txDate(tx)?.toLocaleDateString() : 'Just now'}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500">
                                                            {txDate(tx) ? txDate(tx)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-white">
                                                        {isWinning ? '🏆 GW Payout (Winner)' : 'M-Pesa Deposit'}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {isWinning ? `GW ${tx.gameweek || 'N/A'}` : `Receipt: ${tx.mpesaCode || tx.receiptId || 'N/A'}`}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={clsx(
                                                        'font-bold text-sm',
                                                        isWinning ? 'text-[#FBBF24]' : 'text-[#10B981]'
                                                    )}>
                                                        {isWinning ? '+' : '-'} KES {tx.amount?.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={clsx(
                                                        'inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md border',
                                                        isWinning
                                                            ? 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20'
                                                            : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                                    )}>
                                                        {isWinning ? 'Received' : 'Verified'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <ReceiptText className="w-10 h-10 mx-auto text-gray-600 mb-3 opacity-50" />
                                            <p className="font-medium text-white/70">No financial transactions recorded yet.</p>
                                            <p className="text-sm mt-1 opacity-50">When you deposit funds or the admin resolves a gameweek, receipts will appear here.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Season Vault Trajectory Graph ──────────────────────────── */}
                {(() => {
                    const totalGWs = 38;
                    const vaultRatePerGW = (rules.vault / 100) * (paidMembers.length || 8) * (gameweekStake || 200);
                    const chartData = Array.from({ length: totalGWs }, (_, i) => ({
                        gw: `GW${i + 1}`,
                        vault: Math.round(vaultRatePerGW * (i + 1)),
                        active: i < 12 // highlight resolved GWs
                    }));
                    const currentVault = vaultRatePerGW * 12; // approx 12 GWs resolved
                    const projectedFinal = vaultRatePerGW * totalGWs;

                    return (
                        <div className="fc-card mt-8 bg-[#0b1014] border border-white/5 rounded-2xl p-6 md:p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-96 h-56 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                                        <h3 className="font-bold text-lg text-white">Season Vault Trajectory</h3>
                                    </div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Projected pot growth over 38 gameweeks</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-right">
                                        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">Current</p>
                                        <p className="text-xl font-black text-emerald-400 tabular-nums">KES {isStealthMode ? '****' : currentVault.toLocaleString()}</p>
                                    </div>
                                    <div className="w-px bg-white/5" />
                                    <div className="text-right">
                                        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">By GW38</p>
                                        <p className="text-xl font-black text-amber-400 tabular-nums">KES {isStealthMode ? '****' : projectedFinal.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[240px] w-full min-w-0">
                                {showVaultChart ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220} debounce={120}>
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                                        <defs>
                                            <linearGradient id="vaultGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                                                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="gw" tick={{ fill: '#4b5563', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} interval={5} />
                                        <YAxis tick={{ fill: '#4b5563', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                                        <Tooltip
                                            contentStyle={{ background: '#0b1014', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 14px' }}
                                            labelStyle={{ color: '#10B981', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                            itemStyle={{ color: '#fff', fontWeight: 800 }}
                                            formatter={(value) => [`KES ${Number(value ?? 0).toLocaleString()}`, 'Vault']}
                                        />
                                        <Area type="monotone" dataKey="vault" stroke="#10B981" strokeWidth={2.5} fill="url(#vaultGradient)" dot={false} activeDot={{ r: 5, fill: '#10B981', strokeWidth: 0 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                                ) : (
                                <div className="h-full w-full rounded-xl bg-black/20 border border-white/5" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-4 justify-center">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Vault value grows by KES {vaultRatePerGW.toLocaleString()} per resolved GW</span>
                            </div>
                        </div>
                    );
                })()}

            </div>
        </div>
    );
}
