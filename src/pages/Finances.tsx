import { useEffect, useState } from 'react';
import { ReceiptText, History, Download, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function Finances() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    const [transactions, setTransactions] = useState<any[]>([]);

    useEffect(() => {
        if (activeLeagueId && members.length === 0) {
            listenToLeagueMembers(activeLeagueId);
        }

        if (activeLeagueId) {
            const txRef = collection(db, 'leagues', activeLeagueId, 'transactions');
            const q = query(txRef, orderBy('timestamp', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const txs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setTransactions(txs);
            });
            return () => unsubscribe();
        }
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    const paidMembers = members.filter(m => m.hasPaid);
    const totalSecured = paidMembers.length * 1400; // Simplified for MVP display, normally you sum transactions or read league params

    return (
        <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#111613]">

            <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Audit Log</h1>
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
                <div className="bg-[#151c18] border border-white/5 p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-[#22c55e]" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Secured</h3>
                    </div>
                    <p className="text-3xl font-black tabular-nums tracking-tighter text-white">KES {totalSecured.toLocaleString()}</p>
                </div>
                <div className="bg-[#151c18] border border-white/5 p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
                            <ReceiptText className="w-5 h-5 text-[#3b82f6]" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Historical Payouts</h3>
                    </div>
                    <p className="text-3xl font-black tabular-nums tracking-tighter text-white">{transactions.length}</p>
                </div>
            </div>

            <div className="bg-[#151c18] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-400" />
                    <h3 className="font-bold text-lg">Recent Activity</h3>
                </div>

                <div className="w-full overflow-x-auto">
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
                            {transactions.length > 0 ? (
                                transactions.map((tx: any, _idx: number) => (
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
                                                {tx.type === 'payout' ? 'B2C Payout (Weekly Winner)' : 'Deposit'}
                                            </div>
                                            <div className="text-xs text-gray-400">@{tx.winnerName || 'System'} • GW {tx.gameweek || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-[#FBBF24]">- KES {tx.amount.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-block px-3 py-1 bg-[#10B981]/10 text-[#10B981] text-[10px] font-bold uppercase tracking-widest rounded-md border border-[#10B981]/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                                Dispatched
                                            </span>
                                        </td>
                                    </tr>
                                ))
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

        </div>
    );
}
