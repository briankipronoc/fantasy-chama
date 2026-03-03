import { Download, AlertCircle, MessageSquareShare, FileSpreadsheet, ShieldCheck, Star, Search, Filter, CheckCircle, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Finances() {
    const role = useStore(state => state.role);

    // Hardcode mockup data to match exact visual state
    const unpaidMembers = [
        { id: 1, name: 'Njoroge Kamau', overdue: 5, amount: '1,200', penalty: true, avatar: 'https://i.pravatar.cc/150?u=1' },
        { id: 2, name: 'Mwangi Maina', overdue: 2, amount: '1,000', penalty: false, avatar: 'https://i.pravatar.cc/150?u=2' },
    ];

    const activeLedger = [
        { id: 3, name: 'Adhiambo Otieno', status: 'MONTHLY DUE SOON', trustScore: { type: 'stars', value: 4 }, lastPaid: 'Yesterday (GW)', actionType: 'text', avatar: 'https://i.pravatar.cc/150?u=3' },
        { id: 4, name: 'Mutua Musyoka', status: 'FULLY PAID', trustScore: { type: 'score', value: 98 }, lastPaid: 'Aug 01, 2024', actionType: 'icon', avatar: 'https://i.pravatar.cc/150?u=4' },
        { id: 5, name: 'Wanjiku Njeri', status: 'FULLY PAID', trustScore: { type: 'score', value: 100 }, lastPaid: 'Aug 01, 2024', actionType: 'icon', avatar: 'https://i.pravatar.cc/150?u=5' },
        { id: 6, name: 'Ochieng Juma', status: 'FULLY PAID', trustScore: { type: 'score', value: 95 }, lastPaid: 'July 29, 2024', actionType: 'icon', avatar: 'https://i.pravatar.cc/150?u=6' },
        { id: 7, name: 'Kiptoo Sang', status: 'FULLY PAID', trustScore: { type: 'score', value: 89 }, lastPaid: 'Aug 02, 2024', actionType: 'icon', avatar: 'https://i.pravatar.cc/150?u=7' },
        { id: 8, name: 'Moraa Nyambane', status: 'MONTHLY DUE SOON', trustScore: { type: 'stars', value: 4 }, lastPaid: '2 days ago (GW)', actionType: 'text', avatar: 'https://i.pravatar.cc/150?u=8' },
        { id: 9, name: 'Khamisi Ali', status: 'FULLY PAID', trustScore: { type: 'score', value: 92 }, lastPaid: 'July 30, 2024', actionType: 'icon', avatar: 'https://i.pravatar.cc/150?u=9' },
    ];

    const historyData = [
        { id: 1, date: 'Oct 24, 2023', time: '14:32 PM', name: 'John Kamau', type: 'Contribution', amount: '50,000.00', status: 'Verified', code: 'RJS4PQ9L02', avatar: 'https://i.pravatar.cc/150?u=h' },
        { id: 2, date: 'Oct 24, 2023', time: '11:15 AM', name: 'Sarah Njeri', type: 'Payout', amount: '125,000.00', status: 'Verified', code: 'RK81MN2Z41', avatar: 'https://i.pravatar.cc/150?u=i' },
        { id: 3, date: 'Oct 23, 2023', time: '16:45 PM', name: 'David Mutua', type: 'Contribution', amount: '50,000.00', status: 'Pending', code: 'RL94TY3X09', avatar: 'https://i.pravatar.cc/150?u=j' },
        { id: 4, date: 'Oct 23, 2023', time: '09:12 AM', name: 'Grace Achieng', type: 'Contribution', amount: '50,000.00', status: 'Verified', code: 'RL12VB6M88', avatar: 'https://i.pravatar.cc/150?u=k' },
    ];

    return (
        <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#111613]">

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Finances & Ledger</h1>
                    <p className="text-[#22C55E] font-medium tracking-wide">Real-time payment transparency and integrity tracking</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {role === 'admin' && (
                        <button className="flex items-center gap-2 bg-[#161d24] hover:bg-[#1a242f] border border-white/10 hover:border-[#22c55e]/30 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg transition-colors">
                            <span className="text-[#22c55e] border border-[#22c55e] rounded-full size-4 flex justify-center items-center font-bold text-xs leading-none pb-[1px]">+</span>
                            Manual Entry
                        </button>
                    )}
                    <button className="flex items-center gap-2 bg-[#4ade80] hover:bg-[#22c55e] text-[#0a100a] px-5 py-2.5 rounded-lg font-bold shadow-lg transition-colors">
                        <Download className="w-4 h-4" /> Export Report
                    </button>
                </div>
            </div>

            {/* Unpaid Members Section */}
            <div className="mb-10">
                <div className="flex items-center gap-2 mb-6">
                    <AlertCircle className="w-5 h-5 text-[#ef4444] fill-[#ef4444]/20" />
                    <h2 className="text-[17px] font-bold text-[#ef4444]">Unpaid Members (Red Zone)</h2>
                </div>

                <div className="space-y-4">
                    {unpaidMembers.map((member) => (
                        <div key={member.id} className="bg-[#241315] border border-[#ef4444]/30 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full border-2 border-[#ef4444] p-0.5 object-cover" />
                                <div>
                                    <h3 className="font-bold text-lg text-[#ef4444] tracking-wide">{member.name}</h3>
                                    <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mt-0.5">OVERDUE: {member.overdue} DAYS</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-8">
                                <div className="text-right">
                                    <h4 className="font-extrabold text-[#ef4444] text-lg tabular-nums">KSh {member.amount}</h4>
                                    <p className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-0.5">
                                        SHORT FOR GAMEWEEK
                                    </p>
                                </div>
                                {role === 'admin' && (
                                    <button className="flex items-center gap-2 bg-[#4ade80] hover:bg-[#22c55e] text-[#0a100a] px-5 py-2.5 rounded-lg font-bold shadow-md transition-colors whitespace-nowrap">
                                        <MessageSquareShare className="w-4 h-4" /> Dispatch Nudge
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Active Ledger Section */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-[#22C55E]" />
                        <h2 className="text-[17px] font-bold text-[#22C55E]">Active Ledger</h2>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">UPDATE: 2 MINS AGO</span>
                </div>

                <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="pb-4 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase">MEMBER</th>
                                <th className="pb-4 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase">STATUS</th>
                                <th className="pb-4 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase">TRUST SCORE</th>
                                <th className="pb-4 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase">LAST PAID</th>
                                {role === 'admin' && <th className="pb-4 font-bold text-[11px] text-[#22c55e] tracking-widest uppercase text-right px-4">ACTION</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {activeLedger.map((row) => (
                                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4">
                                        <div className="flex items-center gap-3">
                                            <img src={row.avatar} alt={row.name} className="w-8 h-8 rounded-full border border-white/10" />
                                            <span className="font-bold text-[15px]">{row.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        {row.status === 'MONTHLY DUE SOON' ? (
                                            <span className="inline-block bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">
                                                MONTHLY DUE SOON
                                            </span>
                                        ) : (
                                            <span className="inline-block bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">
                                                FULLY PAID
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4">
                                        {row.trustScore.type === 'stars' ? (
                                            <div className="flex gap-1 text-[#eab308]">
                                                {Array.from({ length: 4 }).map((_, i) => (
                                                    <Star key={i} className="w-3.5 h-3.5 fill-[#eab308]" />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-[#22C55E] font-bold text-[13px]">
                                                <ShieldCheck className="w-4 h-4" /> {row.trustScore.value}/100
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4">
                                        <span className={`text-[13px] ${row.lastPaid.includes('Yesterday') || row.lastPaid.includes('ago') ? 'text-gray-400 italic font-medium' : 'text-gray-300 font-medium'}`}>
                                            {row.lastPaid}
                                        </span>
                                    </td>
                                    {role === 'admin' && (
                                        <td className="py-4 text-right px-4">
                                            {row.actionType === 'text' ? (
                                                <button className="text-[#22c55e] font-bold text-[11px] tracking-widest uppercase hover:text-[#4ade80] transition-colors">
                                                    REMINDER
                                                </button>
                                            ) : (
                                                <button className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#22C55E] text-[#0a100a] hover:bg-[#4ade80] transition-colors shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                                                    <Star className="w-3.5 h-3.5 fill-[#0a100a]" />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Transaction History Sub-Section */}
                <div className="mt-16">
                    <div className="flex items-center justify-between gap-6 mb-8">
                        <div>
                            <h2 className="text-2xl font-extrabold tracking-tight mb-2">Audit Log</h2>
                            <p className="text-gray-400 font-medium tracking-wide">Detailed chronological audit of all transactions.</p>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="relative w-full md:w-64 group hidden md:block">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-[#22c55e] transition-colors">
                                    <Search className="w-5 h-5" />
                                </span>
                                <input
                                    type="text"
                                    className="w-full bg-[#151c18] border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-sm focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] transition-all placeholder:text-gray-500 text-white outline-none"
                                    placeholder="Search History..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-[#1a241c] p-4 rounded-xl border border-white/5 flex flex-wrap items-center gap-4 shadow-md mb-6">
                        <div className="flex items-center gap-2">
                            <Filter className="text-[#22c55e] w-4 h-4" />
                            <span className="text-[12px] font-bold text-white uppercase tracking-wider">Filters:</span>
                        </div>
                        <div className="flex-1 flex flex-wrap gap-3">
                            <select className="bg-[#0a100a] border border-white/5 rounded-lg text-sm px-4 py-2 text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#22c55e]">
                                <option>Last 30 Days</option>
                                <option>Last 7 Days</option>
                            </select>
                            <select className="bg-[#0a100a] border border-white/5 rounded-lg text-sm px-4 py-2 text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#22c55e]">
                                <option>All Members</option>
                                <option>John Doe</option>
                            </select>
                        </div>
                    </div>

                    {/* Transaction Table */}
                    <div className="bg-[#151c18] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left">
                                <thead>
                                    <tr className="bg-[#0a100a]/80 border-b border-white/5">
                                        <th className="px-6 py-5 text-[10px] font-bold text-[#22c55e] uppercase tracking-widest">DATE / TIME</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-[#22c55e] uppercase tracking-widest">MEMBER NAME</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-[#22c55e] uppercase tracking-widest">TYPE</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-[#22c55e] uppercase tracking-widest text-right">AMOUNT (KES)</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-[#22c55e] uppercase tracking-widest">STATUS</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-[#22c55e] uppercase tracking-widest">M-PESA CODE</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {historyData.map((row) => (
                                        <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-white mb-0.5">{row.date}</div>
                                                <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">{row.time}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={row.avatar} alt={row.name} className="w-9 h-9 rounded-full border border-white/10" />
                                                    <span className="text-sm font-bold text-white">{row.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {row.type === 'Contribution' ? (
                                                    <span className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                                                        Contribution
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20">
                                                        Payout
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`font-extrabold text-sm ${row.type === 'Contribution' ? 'text-white' : 'text-[#eab308]'}`}>
                                                    {row.amount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {row.status === 'Verified' ? (
                                                    <div className="flex items-center gap-2 text-[#22c55e]">
                                                        <CheckCircle className="w-4 h-4 fill-[#22c55e] text-[#0a100a]" />
                                                        <span className="text-[11px] font-bold text-[#22c55e] uppercase tracking-widest">Verified</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-gray-400">
                                                        <Clock className="w-4 h-4" />
                                                        <span className="text-[11px] font-bold uppercase tracking-widest">Pending</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <code className="text-xs bg-[#0a100a] border border-white/5 px-3 py-2 rounded-lg text-gray-300 font-mono tracking-widest">{row.code}</code>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
