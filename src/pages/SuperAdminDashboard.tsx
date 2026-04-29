import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { collection, collectionGroup, query, orderBy, onSnapshot, getDocs, doc, updateDoc, addDoc, serverTimestamp, runTransaction, limit, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Trophy, TrendingUp, Users, Activity, Banknote, Shield, Zap, Eye, EyeOff, BarChart3, CheckCircle, Power, ShieldAlert, Check, Download, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

export default function SuperAdminDashboard() {
    const navigate = useNavigate();
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [treasuryEvents, setTreasuryEvents] = useState<any[]>([]);
    const [leagues, setLeagues] = useState<any[]>([]);
    const [stealthMode, setStealthMode] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'leagues' | 'ledger' | 'settlements'>('overview');
    const [stats, setStats] = useState({
        totalGrossVolume: 0,
        totalPlatformRev: 0,
        totalChairmanPayouts: 0,
        totalCoAdminPayouts: 0,
        totalSafaricomFees: 0,
        activeLeagues: 0,
        activeMembers: 0,
        totalResolutions: 0
    });
    const [settlements, setSettlements] = useState<any[]>([]);
    const [settlementActionId, setSettlementActionId] = useState<string | null>(null);
    const [reviewNoteById, setReviewNoteById] = useState<Record<string, string>>({});
    const [hqNotice, setHqNotice] = useState('');

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user && user.uid === import.meta.env.VITE_SUPER_ADMIN_UID) {
                setIsAuthorized(true);
            } else {
                setIsAuthorized(false);
            }
            setIsAuthLoading(false);
        });
        return () => unsubscribeAuth();
    }, []);

    // Fetch Treasury Events
    useEffect(() => {
        if (!isAuthorized) return;
        const q = query(collection(db, 'platform_treasury'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            setTreasuryEvents(events);

            let gross = 0, platformNet = 0, chairmanCut = 0, coAdminCut = 0, safaricomFee = 0;
            const leagueSet = new Set();
            events.forEach(ev => {
                if (ev.grossPot) gross += Number(ev.grossPot);
                if (ev.platformNetRevenue) platformNet += Number(ev.platformNetRevenue);
                if (ev.chairmanCut) chairmanCut += Number(ev.chairmanCut);
                if (ev.coAdminCut) coAdminCut += Number(ev.coAdminCut);
                if (ev.mpesaFee) safaricomFee += Number(ev.mpesaFee);
                if (ev.leagueId) leagueSet.add(ev.leagueId);
            });

            setStats(prev => ({
                ...prev,
                totalGrossVolume: gross,
                totalPlatformRev: platformNet,
                totalChairmanPayouts: chairmanCut,
                totalCoAdminPayouts: coAdminCut,
                totalSafaricomFees: safaricomFee,
                activeLeagues: leagueSet.size,
                totalResolutions: events.length
            }));
        });
        return () => unsubscribe();
    }, [isAuthorized]);

    // Fetch All Leagues and Members
    useEffect(() => {
        if (!isAuthorized) return;
        let unsubLeagues: any;
        const fetchGlobalStats = async () => {
            try {
                unsubLeagues = onSnapshot(collection(db, 'leagues'), (snap) => {
                    const leagueList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setLeagues(leagueList);
                });
                const membersSnap = await getDocs(collectionGroup(db, 'memberships'));
                const activeCount = membersSnap.docs.filter(d => d.data().isActive !== false).length;
                setStats(prev => ({ ...prev, activeMembers: activeCount }));
            } catch (err) {
                console.error("Failed to fetch global stats:", err);
            }
        };
        fetchGlobalStats();
        return () => { if (unsubLeagues) unsubLeagues(); };
    }, [isAuthorized]);

    useEffect(() => {
        if (!isAuthorized) return;
        const settlementQuery = query(
            collectionGroup(db, 'hq_settlements'),
            orderBy('submittedAt', 'desc'),
            limit(200)
        );
        const unsub = onSnapshot(settlementQuery, (snapshot) => {
            const docs = snapshot.docs.map((item) => ({
                id: item.id,
                settlementPath: item.ref.path,
                ...item.data(),
            } as any));
            setSettlements(docs);
        }, (error) => {
            console.warn('[hq] settlements listener failed:', error?.message || error);
            setSettlements([]);
        });

        return () => {
            try { unsub(); } catch (error) {
                console.warn('[hq] settlements listener cleanup failed:', error);
            }
        };
    }, [isAuthorized]);

    const showHqNotice = (message: string) => {
        setHqNotice(message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.setTimeout(() => setHqNotice(''), 3500);
    };

    const handleApproveSettlement = async (settlement: any) => {
        if (!settlement?.settlementPath || !settlement?.leagueId) return;
        setSettlementActionId(settlement.id);
        try {
            const reviewNote = (reviewNoteById[settlement.id] || '').trim();
            const settlementRef = doc(db, settlement.settlementPath);
            const leagueRef = doc(db, 'leagues', settlement.leagueId);

            const txResult = await runTransaction(db, async (tx) => {
                const settlementSnap = await tx.get(settlementRef);
                if (!settlementSnap.exists()) throw new Error('Settlement request no longer exists.');
                const settlementData = settlementSnap.data() as any;
                if (settlementData.status !== 'submitted') {
                    throw new Error('Settlement already processed by another HQ operator.');
                }

                const leagueSnap = await tx.get(leagueRef);
                if (!leagueSnap.exists()) throw new Error('Target league no longer exists.');

                const currentDebt = Number(leagueSnap.data()?.pendingHQDebt || 0);
                const requestedAmount = Number(settlementData.amount || 0);
                const approvedAmount = Math.min(Math.max(requestedAmount, 0), currentDebt);
                const remainingDebt = Math.max(0, currentDebt - approvedAmount);

                tx.update(settlementRef, {
                    status: 'approved',
                    approvedAmount,
                    remainingDebt,
                    reviewedAt: serverTimestamp(),
                    reviewedById: auth.currentUser?.uid || 'hq',
                    reviewedByName: auth.currentUser?.displayName || 'HQ',
                    reviewNote: reviewNote || 'Receipt verified by HQ.'
                });

                tx.update(leagueRef, {
                    pendingHQDebt: remainingDebt,
                    ...(remainingDebt === 0 ? { isSuspended: false, suspensionNudges: [] } : {})
                });

                return { approvedAmount, remainingDebt };
            });

            await addDoc(collection(db, 'leagues', settlement.leagueId, 'notifications'), {
                type: 'success',
                message: `HQ verified receipt ${settlement.receiptCode || ''}. KES ${Number(txResult.approvedAmount || 0).toLocaleString()} posted against platform debt. Remaining debt: KES ${Number(txResult.remainingDebt || 0).toLocaleString()}.`,
                timestamp: serverTimestamp(),
                readBy: []
            });

            showHqNotice(`Settlement approved for ${settlement.leagueName || settlement.leagueId}.`);
        } catch (error: any) {
            console.error('Settlement approval failed:', error);
            showHqNotice(`Approval failed: ${error?.message || 'Unknown error'}`);
        } finally {
            setSettlementActionId(null);
        }
    };

    const handleRejectSettlement = async (settlement: any) => {
        if (!settlement?.settlementPath || !settlement?.leagueId) return;
        setSettlementActionId(settlement.id);
        try {
            const reviewNote = (reviewNoteById[settlement.id] || '').trim();
            const settlementRef = doc(db, settlement.settlementPath);
            await updateDoc(settlementRef, {
                status: 'rejected',
                reviewedAt: serverTimestamp(),
                reviewedById: auth.currentUser?.uid || 'hq',
                reviewedByName: auth.currentUser?.displayName || 'HQ',
                reviewNote: reviewNote || 'Receipt not verifiable. Re-submit with the exact M-Pesa code.'
            });

            await addDoc(collection(db, 'leagues', settlement.leagueId, 'notifications'), {
                type: 'warning',
                message: `HQ rejected settlement receipt ${settlement.receiptCode || ''}. Please re-submit the correct M-Pesa code.`,
                timestamp: serverTimestamp(),
                readBy: []
            });

            showHqNotice(`Settlement rejected for ${settlement.leagueName || settlement.leagueId}.`);
        } catch (error: any) {
            console.error('Settlement rejection failed:', error);
            showHqNotice(`Rejection failed: ${error?.message || 'Unknown error'}`);
        } finally {
            setSettlementActionId(null);
        }
    };

    const handleClearDebt = async (leagueId: string) => {
        if (!window.confirm('Mark this league\'s HQ debt as PAID via Pochi La Biashara?')) return;
        await updateDoc(doc(db, 'leagues', leagueId), { pendingHQDebt: 0 });
    };

    const handlePurgeLegacyPayouts = async () => {
        const staleCutoffMs = 24 * 60 * 60 * 1000;
        const staleItems = settlements.filter((item: any) => {
            const submittedAt = item.submittedAt?.toDate ? item.submittedAt.toDate().getTime() : 0;
            const payoutCreatedAt = item.timestamp?.toDate ? item.timestamp.toDate().getTime() : 0;
            const createdAt = submittedAt || payoutCreatedAt;
            const hasActionableTarget = item.approvalTarget === 'chairman' || item.approvalTarget === 'co-chair';
            const isStale = createdAt > 0 && (Date.now() - createdAt) > staleCutoffMs;
            return isStale && (!hasActionableTarget || item.status === 'awaiting_approval' || item.status === 'submitted');
        });

        if (staleItems.length === 0) {
            showHqNotice('No legacy payout rows qualify for cleanup.');
            return;
        }

        if (!window.confirm(`This will archive ${staleItems.length} stale payout row(s) from the queue. Continue?`)) return;

        const batch = writeBatch(db);
        for (const item of staleItems) {
            if (!item.settlementPath) continue;
            batch.delete(doc(db, item.settlementPath));
        }
        await batch.commit();
        showHqNotice(`Archived ${staleItems.length} stale payout row(s).`);
    };

    const handleToggleSuspension = async (leagueId: string, currentStatus: boolean, hasDebt: boolean) => {
        const action = currentStatus ? 'UNSUSPEND' : 'SUSPEND';
        if (hasDebt && action === 'UNSUSPEND') {
            if (!window.confirm('Wait! This league still has pending HQ debt. Unsuspend anyway?')) return;
        } else {
            if (!window.confirm(`Are you sure you want to ${action} this league?`)) return;
        }
        await updateDoc(doc(db, 'leagues', leagueId), { isSuspended: !currentStatus });
    };

    const exportTreasuryCSV = () => {
        const rows = [
            ['GW', 'League', 'Date', 'Gross Pot', 'Platform (3.5%)', 'Chairman', 'Co-Chair', 'M-Pesa Fee'],
            ...treasuryEvents.map(ev => {
                const ts = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date();
                return [
                    ev.gameweek || '',
                    ev.leagueName || '',
                    ts.toLocaleDateString(),
                    ev.grossPot || 0,
                    ev.platformNetRevenue || 0,
                    ev.chairmanCut || 0,
                    ev.coAdminCut || 0,
                    ev.mpesaFee || 0
                ];
            })
        ];
        const csv = rows.map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FantasyChama_Treasury_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Revenue trend — group by week for chart
    const revenueTrend = (() => {
        const grouped: Record<string, number> = {};
        treasuryEvents.forEach(ev => {
            const ts = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date();
            const week = `${ts.getFullYear()}-W${String(Math.ceil(ts.getDate() / 7)).padStart(2, '0')}`;
            grouped[week] = (grouped[week] || 0) + Number(ev.platformNetRevenue || 0);
        });
        return Object.entries(grouped)
            .sort()
            .slice(-12)
            .map(([week, rev]) => ({ week, rev }));
    })();

            const pendingSettlements = settlements.filter((item: any) => item.status === 'submitted');
            const approvedSettlements = settlements.filter((item: any) => item.status === 'approved');
            const rejectedSettlements = settlements.filter((item: any) => item.status === 'rejected');
            const totalSettlementClears = approvedSettlements.reduce((sum: number, item: any) => sum + Number(item.approvedAmount || item.amount || 0), 0);

    const fmt = (n: number) => stealthMode ? '****' : `KES ${Math.round(n).toLocaleString()}`;

    if (isAuthLoading) {
        return (
            <div className="fc-hq-shell min-h-screen flex items-center justify-center text-gray-500 font-mono text-sm uppercase tracking-widest">
                <Zap className="w-5 h-5 animate-pulse mr-3 text-emerald-500" />
                Securing HQ uplink...
            </div>
        );
    }

    if (!isAuthorized) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="fc-hq-shell min-h-screen text-slate-800 dark:text-gray-200 font-sans">
            <div className="max-w-7xl mx-auto px-4 md:px-10 py-8 md:py-12 space-y-8">

                {hqNotice && (
                    <div className="fc-inline-toast fc-inline-toast-info fixed top-4 right-4 z-300 max-w-[24rem] px-5 py-3 text-xs font-black uppercase tracking-widest rounded-2xl shadow-2xl">
                        {hqNotice}
                    </div>
                )}

                {/* Header */}
                <header className="fc-hq-panel rounded-3xl p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Shield className="text-emerald-500 w-5 h-5" />
                            </div>
                            HQ <span className="text-emerald-500">Analytics</span>
                        </h1>
                        <p className="text-sm font-bold text-gray-500 mt-1.5 uppercase tracking-widest">
                            Platform Command • {stats.totalResolutions} GW Resolutions Logged
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={exportTreasuryCSV}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-xl transition">
                            <Download className="w-3.5 h-3.5" /> Export CSV
                        </button>
                        <button onClick={() => setStealthMode(!stealthMode)}
                            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition border border-white/10"
                            title="Toggle figures">
                            {stealthMode ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button onClick={() => navigate('/')}
                            className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-xs font-bold uppercase tracking-widest rounded-xl transition border border-white/15 text-white">
                            ← Exit HQ
                        </button>
                    </div>
                </header>

                {/* KPI Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Gross Volume', value: fmt(stats.totalGrossVolume), sub: 'All-time', color: 'text-white', icon: <BarChart3 className="w-4 h-4 text-blue-400" />, glow: 'bg-blue-500/5' },
                        { label: 'HQ Revenue (3.5%)', value: fmt(stats.totalPlatformRev), sub: 'Platform earnings', color: 'text-emerald-400', icon: <Banknote className="w-4 h-4 text-emerald-400" />, glow: 'bg-emerald-500/10' },
                        { label: 'Active Leagues', value: stealthMode ? '**' : String(stats.activeLeagues), sub: `${stats.activeMembers} members`, color: 'text-white', icon: <Activity className="w-4 h-4 text-cyan-400" />, glow: 'bg-cyan-500/5' },
                        { label: 'GW Resolutions', value: stealthMode ? '**' : String(stats.totalResolutions), sub: 'Total processed', color: 'text-white', icon: <CheckCircle className="w-4 h-4 text-gray-400" />, glow: 'bg-white/3' },
                        { label: 'Chairman Kickbacks', value: fmt(stats.totalChairmanPayouts), sub: '4% governance', color: 'text-amber-400', icon: <Trophy className="w-4 h-4 text-amber-400" />, glow: 'bg-amber-500/5' },
                        { label: 'Co-Chair Kickbacks', value: fmt(stats.totalCoAdminPayouts), sub: '1% audit fee', color: 'text-purple-400', icon: <Users className="w-4 h-4 text-purple-400" />, glow: 'bg-purple-500/5' },
                        { label: 'M-Pesa Fees', value: fmt(stats.totalSafaricomFees), sub: '1.5% network', color: 'text-red-400', icon: <TrendingUp className="w-4 h-4 text-red-400" />, glow: 'bg-red-500/5' },
                        { label: 'Avg Rev / League', value: stats.activeLeagues > 0 ? fmt(stats.totalPlatformRev / stats.activeLeagues) : 'KES 0', sub: 'LTV estimate', color: 'text-emerald-300', icon: <ArrowUpRight className="w-4 h-4 text-emerald-300" />, glow: 'bg-emerald-500/5' },
                        { label: 'Pending Receipts', value: stealthMode ? '**' : String(pendingSettlements.length), sub: `${rejectedSettlements.length} rejected`, color: 'text-amber-300', icon: <ShieldAlert className="w-4 h-4 text-amber-300" />, glow: 'bg-amber-500/5' },
                        { label: 'Cleared By Receipts', value: fmt(totalSettlementClears), sub: `${approvedSettlements.length} approved`, color: 'text-cyan-300', icon: <Check className="w-4 h-4 text-cyan-300" />, glow: 'bg-cyan-500/5' },
                    ].map((stat, i) => (
                        <div key={i} className={`${stat.glow} fc-hq-panel p-4 rounded-xl hover:border-white/10 transition-colors`}>
                            <p className="text-[9px] font-black uppercase text-gray-600 mb-2 flex items-center gap-1.5 tracking-widest">{stat.icon} {stat.label}</p>
                            <p className={`text-lg md:text-xl font-black ${stat.color} tabular-nums tracking-tight`}>{stat.value}</p>
                            <p className="text-[9px] text-gray-700 font-bold uppercase tracking-wider mt-0.5">{stat.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Revenue Trend Chart */}
                {revenueTrend.length > 0 && (
                    <div className="fc-hq-panel rounded-2xl p-6 md:p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-48 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
                        <div className="flex items-end justify-between mb-6">
                            <div>
                                <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue Trend
                                </h2>
                                <p className="text-xs text-gray-600 mt-0.5">Weekly platform earnings (last 12 periods)</p>
                            </div>
                            <p className="text-2xl font-black text-emerald-400 tabular-nums">{fmt(stats.totalPlatformRev)}</p>
                        </div>
                        <div className="h-45">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueTrend} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                                    <defs>
                                        <linearGradient id="hqGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                    <XAxis dataKey="week" tick={{ fill: '#374151', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fill: '#374151', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        contentStyle={{ background: '#0d1218', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                                        labelStyle={{ color: '#10B981', fontWeight: 700, fontSize: 10 }}
                                        itemStyle={{ color: '#fff', fontWeight: 800, fontSize: 12 }}
                                        formatter={(value) => [`KES ${Number(value ?? 0).toLocaleString()}`, 'HQ Revenue']}
                                    />
                                    <Area type="monotone" dataKey="rev" stroke="#10B981" strokeWidth={2.5} fill="url(#hqGradient)" dot={false} activeDot={{ r: 4, fill: '#10B981', strokeWidth: 0 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="fc-hq-tabbar flex gap-1 p-1 rounded-xl w-fit">
                    {(['overview', 'settlements', 'leagues', 'ledger'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-600 hover:text-gray-400'}`}>
                            {tab}
                        </button>
                    ))}
                </div>

                {(activeTab === 'settlements' || activeTab === 'overview') && (
                    <section className="fc-hq-panel rounded-2xl p-5 md:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> HQ Settlement Queue
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">Verify chairman receipts, clear debt, and unlock affected leagues automatically when balance reaches zero.</p>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300">
                                {pendingSettlements.length} pending
                            </span>
                        </div>

                        <div className="space-y-3">
                            {settlements.length === 0 && (
                                <div className="fc-hq-subpanel rounded-xl px-4 py-6 text-center text-xs text-gray-500 font-bold uppercase tracking-widest">
                                    No HQ settlement receipts submitted yet.
                                </div>
                            )}

                            {settlements.slice(0, 12).map((item: any) => {
                                const submittedAt = item.submittedAt?.toDate ? item.submittedAt.toDate() : null;
                                const reviewedAt = item.reviewedAt?.toDate ? item.reviewedAt.toDate() : null;
                                const isPending = item.status === 'submitted';
                                const isBusy = settlementActionId === item.id;

                                return (
                                    <div key={`${item.settlementPath}-${item.id}`} className="fc-hq-subpanel rounded-xl p-3.5">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-black text-white">{item.leagueName || item.leagueId}</p>
                                                <p className="text-[11px] text-gray-400 mt-1">
                                                    Receipt <span className="font-mono text-white">{item.receiptCode || 'N/A'}</span> • Requested KES {Number(item.amount || 0).toLocaleString()} • Debt snapshot KES {Number(item.debtSnapshot || 0).toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                    Submitted by {item.submittedByName || 'Chairman'} {submittedAt ? `on ${submittedAt.toLocaleString()}` : ''}
                                                </p>
                                                {reviewedAt && (
                                                    <p className="text-[10px] text-gray-500 mt-1">Reviewed {reviewedAt.toLocaleString()} by {item.reviewedByName || 'HQ'}</p>
                                                )}
                                            </div>
                                            <span className={clsx(
                                                'text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border',
                                                isPending && 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                                                item.status === 'approved' && 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
                                                item.status === 'rejected' && 'bg-red-500/10 text-red-300 border-red-500/30'
                                            )}>
                                                {item.status || 'submitted'}
                                            </span>
                                        </div>

                                        <div className="mt-3 flex flex-col md:flex-row gap-2.5">
                                            <input
                                                type="text"
                                                value={reviewNoteById[item.id] || ''}
                                                onChange={(e) => setReviewNoteById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                                placeholder="Review note (optional)"
                                                className="fc-hq-input flex-1 px-3 py-2 rounded-lg text-sm text-white"
                                                disabled={!isPending || isBusy}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleRejectSettlement(item)}
                                                    disabled={!isPending || isBusy}
                                                    className="px-3.5 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApproveSettlement(item)}
                                                    disabled={!isPending || isBusy}
                                                    className="px-3.5 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                                                >
                                                    {isBusy ? 'Processing...' : 'Approve'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Leagues Panel */}
                {activeTab === 'leagues' && leagues.length > 0 && (
                    <section>
                        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-emerald-500" /> Registered Leagues ({leagues.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {leagues.map((league: any) => {
                                const leagueRevenue = treasuryEvents.filter(e => e.leagueId === league.id).reduce((acc, e) => acc + Number(e.platformNetRevenue || 0), 0);
                                const leagueGWs = treasuryEvents.filter(e => e.leagueId === league.id).length;
                                const hasDebt = (league.pendingHQDebt || 0) > 0;
                                const isSuspended = league.isSuspended === true;

                                return (
                                    <div key={league.id} className={clsx(
                                        "border rounded-3xl p-5 flex flex-col transition-all group",
                                        isSuspended ? "fc-hq-league-card border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] opacity-75" :
                                        hasDebt ? "fc-hq-league-card border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]" : "fc-hq-league-card border-white/5 hover:border-emerald-500/20"
                                    )}>
                                        <div className="flex flex-col mb-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className={clsx("text-base font-black truncate tracking-tight", hasDebt ? "text-red-400" : "text-white")}>
                                                    {league.leagueName || league.id}
                                                </h3>
                                                {isSuspended ? (
                                                    <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
                                                ) : hasDebt ? (
                                                    <span className="text-[9px] font-black uppercase bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">Owes HQ</span>
                                                ) : (
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                                                )}
                                            </div>
                                            <p className="text-[10px] font-mono text-gray-600 mt-1">FPL: {league.fplLeagueId || 'None'} • {leagueGWs} GWs resolved</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-center mb-4 flex-1">
                                            <div className="bg-black/30 rounded-xl p-2.5 flex flex-col justify-center">
                                                <p className="text-[9px] font-bold text-gray-600 uppercase mb-0.5">Lifetime HQ Rev</p>
                                                <p className="text-sm font-black text-emerald-400 tabular-nums">{stealthMode ? '****' : `KES ${leagueRevenue.toLocaleString()}`}</p>
                                            </div>
                                            <div className={clsx("rounded-xl p-2.5 flex flex-col justify-center border", hasDebt ? "bg-red-500/10 border-red-500/30" : "bg-black/30 border-transparent")}>
                                                <p className={clsx("text-[9px] font-bold uppercase mb-0.5", hasDebt ? "text-red-400" : "text-gray-600")}>Unpaid Debt</p>
                                                <p className={clsx("text-sm font-black tabular-nums", hasDebt ? "text-red-400" : "text-gray-500")}>
                                                    {stealthMode ? '****' : `KES ${(league.pendingHQDebt || 0).toLocaleString()}`}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-auto pt-4 border-t border-white/5">
                                            <button onClick={() => handleClearDebt(league.id)} disabled={!hasDebt}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-20 border disabled:border-transparent bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black">
                                                <Check className="w-3 h-3" /> Paid ✓
                                            </button>
                                            <button onClick={() => handleToggleSuspension(league.id, isSuspended, hasDebt)}
                                                className={clsx("flex items-center justify-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border",
                                                    isSuspended ? "bg-white/10 text-white hover:bg-white/20 border-transparent" : "bg-red-500/10 hover:bg-red-500 hover:text-white border-red-500/30 text-red-500")}>
                                                <Power className="w-3 h-3" /> {isSuspended ? 'Unlock' : 'Suspend'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Treasury Ledger Table */}
                {(activeTab === 'ledger' || activeTab === 'overview') && (
                    <div className="fc-hq-panel rounded-xl overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Treasury Events</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-600 bg-white/5 px-2 py-0.5 rounded">{treasuryEvents.length} records</span>
                                <button
                                    onClick={() => handlePurgeLegacyPayouts()}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
                                    title="Remove stale legacy payout rows from the approval queue"
                                >
                                    Purge Legacy Queue
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-black/20 text-[9px] uppercase font-black tracking-widest text-gray-500">
                                    <tr>
                                        <th className="px-5 py-3">GW & League</th>
                                        <th className="px-5 py-3">Date</th>
                                        <th className="px-5 py-3 text-right">Gross</th>
                                        <th className="px-5 py-3 text-right">Chairman</th>
                                        <th className="px-5 py-3 text-right">Co-Chair</th>
                                        <th className="px-5 py-3 text-right">M-Pesa Fee</th>
                                        <th className="px-5 py-3 text-right text-emerald-400">HQ (3.5%)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/2">
                                    {treasuryEvents.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-16 text-center text-gray-600 text-xs font-bold uppercase tracking-widest">
                                                <Zap className="w-6 h-6 mx-auto mb-2 text-gray-700" />
                                                No treasury events yet. Revenue appears after first GW resolution.
                                            </td>
                                        </tr>
                                    ) : treasuryEvents.map((ev: any) => {
                                        const ts = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date();
                                        return (
                                            <tr key={ev.id} className="hover:bg-white/4 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <p className="font-bold text-gray-200 text-xs">{ev.gameweek}</p>
                                                    <p className="text-[10px] text-gray-600 font-mono mt-0.5">{ev.leagueName}</p>
                                                </td>
                                                <td className="px-5 py-3.5 text-[11px] font-mono text-gray-500">
                                                    {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-bold text-gray-300 text-xs">{stealthMode ? '****' : `KES ${Number(ev.grossPot || 0).toLocaleString()}`}</td>
                                                <td className="px-5 py-3.5 text-right text-amber-400 font-medium text-xs">{ev.chairmanCut ? (stealthMode ? '****' : `KES ${Number(ev.chairmanCut).toLocaleString()}`) : '-'}</td>
                                                <td className="px-5 py-3.5 text-right font-medium text-gray-400 text-xs">{ev.coAdminCut ? (stealthMode ? '****' : `KES ${Number(ev.coAdminCut).toLocaleString()}`) : '-'}</td>
                                                <td className="px-5 py-3.5 text-right font-medium text-red-400/70 text-xs">{ev.mpesaFee ? (stealthMode ? '****' : `KES ${Number(ev.mpesaFee).toLocaleString()}`) : '-'}</td>
                                                <td className="px-5 py-3.5 text-right text-emerald-400 font-black text-xs">{stealthMode ? '****' : `KES ${Number(ev.platformNetRevenue || 0).toLocaleString()}`}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <footer className="text-center text-[10px] text-gray-700 font-mono uppercase tracking-widest py-4 border-t border-white/3">
                    FantasyChama HQ • Platform Analytics • Phase 8 • {new Date().getFullYear()}
                </footer>
            </div>
        </div>
    );
}
