import { useEffect, useState } from 'react';
import { ReceiptText, History, Download, ShieldCheck, Trophy } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import clsx from 'clsx';

export default function Finances() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const memberPhone = localStorage.getItem('memberPhone');
    const { members, listenToLeagueMembers, isStealthMode, role } = useStore();

    const [transactions, setTransactions] = useState<any[]>([]);
    const [monthlyContribution, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState({ weekly: 70, vault: 30, seasonWinnersCount: 3 });

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
                    setMonthlyContribution(data.monthlyContribution || 0);
                    if (data.rules) setRules(data.rules);
                }
            });

            return () => {
                unsubscribeTx();
                unsubscribeLeague();
            };
        }
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    const paidMembers = members.filter(m => m.hasPaid);
    const totalSecured = paidMembers.length * (monthlyContribution || 1400);
    const seasonVault = totalSecured * (rules.vault / 100);

    const currentUser = members.find(m => m.phone === memberPhone);
    const isAdmin = role === 'admin';

    // My winnings received via B2C payouts
    const myWinnings = transactions
        .filter(tx => tx.type === 'payout' && (
            tx.winnerPhone === currentUser?.phone ||
            tx.winnerName === currentUser?.displayName
        ))
        .reduce((acc, tx) => acc + (tx.amount || 0), 0);

    // Toggle between 'GW Won' count and 'Total Winnings'
    const [showWinnings, setShowWinnings] = useState(false);
    useEffect(() => {
        const interval = setInterval(() => setShowWinnings(prev => !prev), 5000);
        return () => clearInterval(interval);
    }, []);

    // Member-only transaction log: their deposits + payout wins only
    const myTransactions = isAdmin ? transactions : transactions.filter(tx =>
        (tx.type === 'deposit' && tx.phoneNumber === currentUser?.phone) ||
        (tx.type === 'payout' && (
            tx.winnerPhone === currentUser?.phone ||
            tx.winnerName === currentUser?.displayName
        ))
    );

    // Personal stats still needed for the card and contributed total
    const myGameweeksWon = transactions.filter(tx => tx.type === 'payout' && (
        tx.winnerPhone === currentUser?.phone ||
        tx.winnerName === currentUser?.displayName
    )).length;
    const depositTxSum = transactions
        .filter(tx => tx.type === 'deposit' && tx.phoneNumber === currentUser?.phone)
        .reduce((acc, tx) => acc + (tx.amount || 0), 0);
    const myTotalContributed = depositTxSum || (currentUser?.hasPaid ? (monthlyContribution || 1400) : 0);

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

                    {isAdmin && (
                        <div className="bg-[#151c18] border border-white/5 p-6 rounded-2xl shadow-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Secured</h3>
                            </div>
                            <p className="text-3xl font-black tabular-nums tracking-tighter text-white">KES {isStealthMode ? '****' : totalSecured.toLocaleString()}</p>
                        </div>
                    )}

                    {!isAdmin && (
                        <div className="bg-[#151c18] border border-white/5 p-6 rounded-2xl shadow-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">My Total Contributed</h3>
                            </div>
                            <p className="text-3xl font-black tabular-nums tracking-tighter text-white">KES {isStealthMode ? '****' : myTotalContributed.toLocaleString()}</p>
                        </div>
                    )}

                    <div
                        className="bg-[#151c18] border border-white/5 p-6 rounded-2xl shadow-lg overflow-hidden relative cursor-default"
                        title="Toggles every 5 seconds"
                    >
                        {/* Flip indicator dot */}
                        <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-[#FBBF24] animate-pulse" />
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
                                <ReceiptText className="w-5 h-5 text-[#3b82f6]" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest transition-all duration-500">
                                {isAdmin ? 'Historical Payouts' : (showWinnings ? 'Total Winnings' : 'Gameweeks Won')}
                            </h3>
                        </div>
                        <p className="text-3xl font-black tabular-nums tracking-tighter transition-all duration-500">
                            {isAdmin ? (
                                <span className="text-white">{transactions.length}</span>
                            ) : showWinnings ? (
                                <span className="text-[#FBBF24]">KES {isStealthMode ? '****' : myWinnings.toLocaleString()}</span>
                            ) : (
                                <span className="text-white">{myGameweeksWon} <span className="text-base font-bold text-gray-500">GW{myGameweeksWon !== 1 ? 's' : ''}</span></span>
                            )}
                        </p>
                    </div>
                </div>

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
