import { useEffect, useState } from 'react';
import { ReceiptText, History, Download, ShieldCheck, Trophy, Wallet, TrendingUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import clsx from 'clsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Finances() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const memberPhone = localStorage.getItem('memberPhone');
    const activeUserId = localStorage.getItem('activeUserId');
    const { members, listenToLeagueMembers, isStealthMode, role } = useStore();

    const [transactions, setTransactions] = useState<any[]>([]);
    const [gameweekStake, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState({ weekly: 70, vault: 30, seasonWinnersCount: 3 });
    const [leagueChairmanId, setLeagueChairmanId] = useState<string | null>(null);

    useEffect(() => {
        if (activeLeagueId && members.length === 0) {
            listenToLeagueMembers(activeLeagueId);
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
            });

            const leagueRef = doc(db, 'leagues', activeLeagueId);
            const unsubscribeLeague = onSnapshot(leagueRef, (docSnap: any) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMonthlyContribution(data.gameweekStake || 0);
                    if (data.rules) setRules(data.rules);
                    setLeagueChairmanId(data.chairmanId);
                }
            });

            return () => {
                unsubscribeTx();
                unsubscribeLeague();
            };
        }
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    const paidMembers = members.filter(m => m.hasPaid && m.isActive !== false);
    const totalSecured = paidMembers.length * (gameweekStake || 1400);
    const seasonVault = totalSecured * (rules.vault / 100);

    const currentUser = members.find(m => m.id === activeUserId) || members.find(m => m.phone === memberPhone);
    const isAdmin = role === 'admin';

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

    // Distribution Logic Array
    const getDistributionRanges = (count: number) => {
        if (count === 1) return [100];
        if (count === 5) return [45, 25, 15, 10, 5];
        return [50, 30, 20]; // fallback top 3
    };
    const splitPercentages = getDistributionRanges(rules.seasonWinnersCount || 3);

    return (
        <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#0b1014]">
            <div className="w-full max-w-5xl mx-auto">
                <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3"><ReceiptText className="w-8 h-8 md:w-10 md:h-10 text-[#10B981]" /> Audit Log</h1>
                        <p className="text-gray-400 font-medium tracking-wide max-w-xl">
                            A transparent, 100% immutable history of all funds entering and exiting the Chama Vault.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button className="flex items-center gap-2 bg-[#151c18] border border-white/10 hover:bg-white/5 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-sm">
                            <Download className="w-4 h-4 text-gray-400" /> Export Ledger
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-[#151c18] border border-white/5 p-6 rounded-2xl shadow-lg relative overflow-hidden group">
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
                        <div className="bg-[#151c18] border border-white/5 p-6 rounded-2xl shadow-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Secured</h3>
                            </div>
                            <p className="text-3xl font-black tabular-nums tracking-tighter text-white">KES {isStealthMode ? '****' : totalSecured.toLocaleString()}</p>
                        </div>
                    ) : (
                        <div className="bg-[#151c18] border border-white/5 p-6 rounded-2xl shadow-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center border border-[#22c55e]/20">
                                    <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                                </div>
                                <h3 className="text-[10px] font-bold text-[#22c55e] uppercase tracking-widest bg-[#22c55e]/10 px-2.5 py-1 rounded-md border border-[#22c55e]/20">My Total Contributed</h3>
                            </div>
                            <p className="text-3xl font-black tabular-nums tracking-tighter text-white">KES {isStealthMode ? '****' : myTotalContributed.toLocaleString()}</p>
                        </div>
                    )}

                    <div className="bg-[#151c18] border border-[#FBBF24]/20 bg-gradient-to-br from-[#151c18] to-[#FBBF24]/5 p-6 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.05)] overflow-hidden relative">
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
                        <section className="bg-[#101511] border border-[#FBBF24]/20 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden mb-8">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-[#FBBF24] blur-[120px] opacity-[0.04] pointer-events-none"></div>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 rounded-full bg-[#FBBF24]/10 flex items-center justify-center border border-[#FBBF24]/20">
                                    <Wallet className="w-5 h-5 text-[#FBBF24]" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-[#FBBF24] uppercase tracking-widest">My Earnings ({myRoleLabel})</h3>
                                    <p className="text-[10px] text-gray-500 font-bold">Auto-credited from the 10% Escrow Rake every Gameweek</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="bg-[#0b1014]/60 rounded-xl p-4 text-center border border-white/5">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">My Rate</p>
                                    <p className="text-xl font-black text-[#FBBF24] tabular-nums">{(myRate * 100).toFixed(1)}%</p>
                                    <p className="text-[8px] text-gray-600 mt-0.5">{isChairman ? 'Governance Fee' : 'Audit Fee'}</p>
                                </div>
                                <div className="bg-[#0b1014]/60 rounded-xl p-4 text-center border border-white/5">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">This GW Est.</p>
                                    <p className="text-xl font-black text-[#FBBF24] tabular-nums">
                                        KES {isStealthMode ? '****' : Math.round(myEarningsThisGW).toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-[#0b1014]/60 rounded-xl p-4 text-center border border-[#FBBF24]/30 shadow-[0_0_15px_rgba(251,191,36,0.1)]">
                                    <p className="text-[9px] font-bold text-[#FBBF24] uppercase tracking-widest mb-1">Wallet Balance</p>
                                    <p className="text-xl font-black text-white tabular-nums">
                                        KES {isStealthMode ? '****' : myWalletBalance.toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-[#0b1014]/60 rounded-xl p-4 text-center border border-white/5">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Lifetime Earned</p>
                                    <p className="text-xl font-black text-gray-400 tabular-nums">
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
                                            const payoutApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
                                <p className="text-[10px] text-gray-500 font-bold mt-5 text-center uppercase tracking-widest bg-black/20 py-2 rounded-lg border border-white/5">
                                    No balance to withdraw. Kickbacks are deposited automatically during GW resolution.
                                </p>
                            )}
                        </section>
                    );
                })()}

                <div className="bg-[#151c18] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-lg">Recent Activity</h3>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-white/5">
                        {myTransactions.length > 0 ? myTransactions.map((tx: any) => {
                            const isWinning = tx.type === 'payout';
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
                                        <span>{tx.receiptId || `TXN${tx.id.substring(0, 8).toUpperCase()}`}</span>
                                        <span>{tx.timestamp ? new Date(tx.timestamp.toDate()).toLocaleDateString() : 'Just now'}</span>
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
                        <table className="w-full min-w-[700px] text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-[#0a100a]/50">
                                    <th className="px-6 py-4 font-bold text-[11px] text-gray-500 tracking-widest uppercase">RECEIPT NO.</th>
                                    <th className="px-6 py-4 font-bold text-[11px] text-gray-500 tracking-widest uppercase">DATE / TIME</th>
                                    <th className="px-6 py-4 font-bold text-[11px] text-gray-500 tracking-widest uppercase">DESCRIPTION</th>
                                    <th className="px-6 py-4 font-bold text-[11px] text-gray-500 tracking-widest uppercase text-right">AMOUNT</th>
                                    <th className="px-6 py-4 font-bold text-[11px] text-gray-500 tracking-widest uppercase text-center">STATUS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {myTransactions.length > 0 ? (
                                    myTransactions.map((tx: any) => {
                                        const isWinning = tx.type === 'payout';
                                        return (
                                            <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4 text-xs font-mono text-gray-500">
                                                    {tx.receiptId || `TXN${tx.id.substring(0, 8).toUpperCase()}`}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-white">
                                                        {tx.timestamp ? new Date(tx.timestamp.toDate()).toLocaleDateString() : 'Just now'}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500">
                                                        {tx.timestamp ? new Date(tx.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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
                        <div className="mt-8 bg-[#0b1014] border border-white/5 rounded-2xl shadow-xl p-6 md:p-8 relative overflow-hidden">
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
                            <div className="h-[240px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
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
                                            formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Vault']}
                                        />
                                        <Area type="monotone" dataKey="vault" stroke="#10B981" strokeWidth={2.5} fill="url(#vaultGradient)" dot={false} activeDot={{ r: 5, fill: '#10B981', strokeWidth: 0 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex items-center gap-2 mt-4 justify-center">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Vault value grows by KES {vaultRatePerGW.toLocaleString()} per resolved GW</span>
                            </div>
                        </div>
                    );
                })()}

                <div className="mt-8 bg-[#151c18] border border-white/5 rounded-2xl shadow-xl p-6 md:p-8">
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-[#FBBF24]" /> Season End Projections
                    </h3>
                    <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest font-bold mb-6">Split Strategy: Top {rules.seasonWinnersCount || 3} Managers</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {splitPercentages.map((percent, index) => {
                            const payout = seasonVault * (percent / 100);
                            return (
                                <div key={index} className="bg-[#161d24] border border-white/5 rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#FBBF24]/30 transition-colors">
                                    {index === 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-[#FBBF24] blur-[40px] opacity-20 transform translate-x-4 -translate-y-4"></div>}
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <span className={clsx(
                                            "font-black text-4xl leading-none opacity-20",
                                            index === 0 ? "text-[#FBBF24] opacity-50" : index === 1 ? "text-gray-300" : "text-[#b45309]"
                                        )}>
                                            #{index + 1}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400 bg-white/5 px-2 py-1 rounded-md border border-white/5 uppercase tracking-widest">
                                            {percent}%
                                        </span>
                                    </div>
                                    <div className="relative z-10">
                                        <h4 className="text-xl font-bold text-white tabular-nums tracking-tight mb-0.5">
                                            KES {isStealthMode ? '****' : payout.toLocaleString()}
                                        </h4>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Projected Payout</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}
