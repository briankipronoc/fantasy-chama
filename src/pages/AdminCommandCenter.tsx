import { Bell, Search, Download, Megaphone, Share2, RefreshCw, Banknote, TrendingUp, ChevronDown } from 'lucide-react';

export default function AdminCommandCenter() {
    const mockLedgerData = [
        {
            id: 1,
            name: 'Felix Kamau',
            email: 'felix.k@gmail.com',
            txCode: 'RHJB9L2M5X',
            amount: '5,000.00',
            status: 'Pending',
            verified: false,
            avatarUrl: 'https://i.pravatar.cc/150?u=1'
        },
        {
            id: 2,
            name: 'Sarah Wandia',
            email: 's.wandia@outlook.com',
            txCode: 'QK72X9J1P2',
            amount: '12,500.00',
            status: 'Verified',
            verified: true,
            avatarUrl: 'https://i.pravatar.cc/150?u=2'
        },
        {
            id: 3,
            name: 'David Otieno',
            email: 'd.otieno@chama.org',
            txCode: 'BM98Q3V7K1',
            amount: '7,200.00',
            status: 'Failed',
            verified: false,
            avatarUrl: 'https://i.pravatar.cc/150?u=3'
        },
    ];

    return (
        <div className="min-h-screen bg-[#0d1316] text-white p-6 md:p-10 font-sans max-w-7xl mx-auto space-y-10">
            {/* Top Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
                    <div className="relative max-w-md w-full hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search ledger..."
                            className="bg-[#1a232b] border border-transparent text-sm rounded-full pl-10 pr-4 py-2 w-full focus:outline-none focus:border-[#10B981]/50 text-white placeholder-gray-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button className="relative text-gray-400 hover:text-white transition-colors">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-[#10B981] rounded-full ring-2 ring-[#0d1316]"></span>
                    </button>
                    <div className="flex flex-col items-end hidden sm:flex">
                        <span className="text-sm font-bold text-white">Admin Profile</span>
                        <span className="text-xs text-[#10B981] font-medium">Level 4 Vault Access</span>
                    </div>
                    <img src="https://i.pravatar.cc/150?u=admin" alt="Admin" className="w-10 h-10 rounded-lg bg-gray-800 border border-white/10" />
                </div>
            </header>

            {/* Generate League Access Section */}
            <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight mb-1">Generate League Access</h2>
                        <p className="text-gray-400 text-sm">Control your league entry and synchronize member records.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#1a232b] hover:bg-[#232f3a] text-sm font-bold rounded-xl transition-colors border border-white/5 disabled:opacity-50">
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#10B981] hover:bg-[#10B981]/90 text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            <Megaphone className="w-4 h-4" /> Bulk Nudge
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Invitation Key Card */}
                    <div className="col-span-1 md:col-span-2 bg-[#161d24] border border-white/5 rounded-2xl flex flex-col sm:flex-row overflow-hidden">
                        <div className="p-8 flex-1 flex flex-col justify-center">
                            <span className="text-[#10B981] text-xs font-bold tracking-widest uppercase mb-4">Current Invitation Key</span>
                            <div className="text-6xl font-black text-[#FBBF24] tracking-tight mb-6 tabular-nums">882 941</div>
                            <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm">
                                Share this 6-digit PIN with verified members to grant them access to the Vault Gold League. PIN expires in 24 hours.
                            </p>
                            <div className="flex items-center gap-4 mt-auto">
                                <button className="flex items-center gap-2 px-4 py-2 text-[#10B981] hover:bg-[#10B981]/10 rounded-lg text-sm font-bold transition-colors">
                                    <RefreshCw className="w-4 h-4" /> Regenerate PIN
                                </button>
                                <button className="flex items-center gap-2 px-6 py-2 bg-[#1a232b] hover:bg-white/10 border border-white/5 text-white rounded-lg text-sm font-bold transition-colors">
                                    <Share2 className="w-4 h-4" /> Share Key
                                </button>
                            </div>
                        </div>
                        <div className="bg-[#11171a] p-8 flex flex-col items-center justify-center border-l border-white/5 min-w-[240px]">
                            <div className="bg-white p-3 rounded-xl mb-4 h-32 w-32 flex items-center justify-center shadow-lg">
                                {/* Mock QR Code visual */}
                                <div className="grid grid-cols-3 gap-1 w-full h-full opacity-30">
                                    {[...Array(9)].map((_, i) => (
                                        <div key={i} className={`bg-black rounded-sm ${i === 4 ? 'opacity-0' : ''}`}></div>
                                    ))}
                                </div>
                            </div>
                            <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Scan to Join</span>
                        </div>
                    </div>

                    {/* Total Collections Card */}
                    <div className="col-span-1 bg-[#161d24] border border-[#10B981]/20 rounded-2xl p-8 flex flex-col relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Banknote className="w-32 h-32 text-[#10B981]" />
                        </div>
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-auto">
                                <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center border border-[#10B981]/20">
                                    <Banknote className="w-5 h-5 text-[#10B981]" />
                                </div>
                                <span className="text-[10px] font-bold tracking-widest text-[#10B981] uppercase bg-[#10B981]/10 px-2.5 py-1 rounded-md border border-[#10B981]/20">Live Sync</span>
                            </div>

                            <div className="mt-8">
                                <span className="text-gray-400 text-sm font-medium block mb-2">Total League Collections</span>
                                <div className="text-3xl font-black text-white tracking-tight mb-3">KES 142,500.00</div>
                                <div className="flex items-center gap-2 text-[#10B981] text-xs font-bold bg-[#10B981]/10 w-fit px-2.5 py-1 rounded-md">
                                    <TrendingUp className="w-3 h-3" /> +12% from last week
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* The Master Ledger Section */}
            <section className="bg-[#161d24] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold tracking-tight">The Master Ledger</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-medium">Filter by:</span>
                        <button className="flex items-center gap-2 bg-[#1a232b] border border-white/10 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white transition-colors">
                            All Payments <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#11171a] border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                                <th className="p-4 pl-6 font-medium">Member</th>
                                <th className="p-4 font-medium">M-Pesa Transaction Code</th>
                                <th className="p-4 font-medium">Amount (KES)</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 pr-6 text-right font-medium">Verify Payment</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {mockLedgerData.map((row) => (
                                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            <img src={row.avatarUrl} alt={row.name} className="w-10 h-10 rounded-full border border-white/10" />
                                            <div>
                                                <div className="font-bold text-white leading-tight mb-1">{row.name}</div>
                                                <div className="text-xs text-gray-500 leading-none">{row.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="bg-[#11171a] border border-white/5 px-3 py-1.5 rounded-md text-gray-400 font-mono text-xs">{row.txCode}</span>
                                    </td>
                                    <td className="p-4 font-bold text-[#FBBF24]">
                                        {row.amount}
                                    </td>
                                    <td className="p-4">
                                        {row.status === 'Pending' && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a232b] text-[#FBBF24] border border-white/5 text-xs font-bold">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"></div> Pending
                                            </span>
                                        )}
                                        {row.status === 'Verified' && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-xs font-bold">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div> Verified
                                            </span>
                                        )}
                                        {row.status === 'Failed' && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Failed
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        {/* Custom Toggle Switch */}
                                        <label className="relative inline-flex items-center cursor-pointer ml-auto">
                                            <input type="checkbox" className="sr-only peer" defaultChecked={row.verified} />
                                            <div className="w-11 h-6 bg-[#1a232b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981] border border-white/10"></div>
                                        </label>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                <div className="p-4 px-6 border-t border-white/5 flex items-center justify-between text-sm text-gray-500">
                    <span>Showing 3 of 152 members</span>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-[#1a232b] border border-white/5 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-medium">Prev</button>
                        <button className="px-4 py-2 bg-[#1a232b] border border-white/5 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-medium">Next</button>
                    </div>
                </div>
            </section>
        </div>
    );
}
