import { Shield, Bell, ShieldCheck, UserPlus, Users, Trash2, Wallet, Clock, Lock, Info, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MemberEnrollment() {
    const mockMembers = [
        {
            id: 1,
            name: 'Marcus Rashford',
            team: 'Bean Blast FC',
            status: 'ACTIVE',
            avatar: 'https://i.pravatar.cc/150?u=a2'
        },
        {
            id: 2,
            name: 'Sarah Jenkins',
            team: 'Golden Booties',
            status: 'ACTIVE',
            avatar: 'https://i.pravatar.cc/150?u=b3'
        },
        {
            id: 3,
            name: 'David Ngugi',
            team: 'Safari Stars',
            status: 'PENDING',
            avatar: 'https://i.pravatar.cc/150?u=c4'
        },
        {
            id: 4,
            name: 'Kevin Omondi',
            team: 'K-Town Kings',
            status: 'ACTIVE',
            avatar: 'https://i.pravatar.cc/150?u=d5'
        }
    ];

    return (
        <div className="min-h-screen bg-[#111820] text-white font-sans flex flex-col">
            {/* Top Navigation Bar specific to this page layout */}
            <header className="flex items-center justify-between p-6 md:px-10 border-b border-white/5 bg-[#161d24]">
                <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-[#10B981]" />
                    <span className="font-bold text-lg tracking-tight">Fantasy Chama</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2 bg-[#10B981]/10 px-3 py-1.5 rounded-full border border-[#10B981]/20">
                        <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                        <span className="text-[10px] font-bold text-[#10B981] tracking-widest uppercase">Secured Gateway</span>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors bg-[#1a232b] p-2 rounded-lg border border-white/5">
                        <Bell className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-[#FBBF24] flex items-center justify-center text-black font-bold border border-white/10">
                        JD
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-6xl mx-auto w-full p-6 md:p-10 space-y-10">

                {/* Page Header */}
                <div className="max-w-2xl">
                    <div className="flex items-center gap-2 mb-3">
                        <Lock className="w-5 h-5 text-[#FBBF24]" />
                        <span className="text-[#FBBF24] text-xs font-bold tracking-widest uppercase">The Gatekeeper</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Member Enrollment</h1>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Establish your league's inner circle. Only verified managers can access the treasury and competition dashboard.
                    </p>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Left Column: Form Card */}
                    <div className="bg-[#161d24] border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="bg-[#10B981]/10 p-2 rounded-xl text-[#10B981]">
                                <UserPlus className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">Add New Member</h2>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2">Member Display Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. John Doe"
                                    className="w-full bg-[#0d1316] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#10B981]/50 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2">FPL Team Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Red Devils FC"
                                    className="w-full bg-[#0d1316] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#10B981]/50 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="mt-8 space-y-4">
                            <button className="w-full bg-[#10B981] hover:bg-[#10B981]/90 text-black font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                <UserPlus className="w-5 h-5" /> Enroll Member
                            </button>

                            <div className="bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-xl p-4 flex gap-3 text-sm">
                                <Info className="w-5 h-5 text-[#FBBF24] shrink-0 mt-0.5" />
                                <p className="text-gray-300 leading-relaxed">
                                    <strong className="text-white">Security Note:</strong> Enrolled members will receive a secure invite link to join the chama. Identity verification is required for withdrawal access.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: List Card */}
                    <div className="bg-[#1a232b] border border-white/5 rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#161d24]">
                            <div className="flex items-center gap-3">
                                <Users className="w-5 h-5 text-gray-400" />
                                <h2 className="text-lg font-bold tracking-tight">Enrolled Circle (12)</h2>
                            </div>
                            <button className="text-[10px] font-bold tracking-widest uppercase text-gray-500 hover:text-white transition-colors">
                                Export
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                            {mockMembers.map((member) => (
                                <div key={member.id} className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full border border-white/10" />
                                        <div>
                                            <div className="font-bold text-white mb-0.5">{member.name}</div>
                                            <div className="text-xs text-gray-400">Team: {member.team}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {member.status === 'ACTIVE' ? (
                                            <span className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-2 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase">Active</span>
                                        ) : (
                                            <span className="bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/20 px-2 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase">Pending</span>
                                        )}
                                        <button className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 px-6 border-t border-white/5 flex items-center justify-between text-xs text-gray-500 bg-[#161d24]">
                            <span>Showing <strong className="text-white">4</strong> of <strong className="text-white">12</strong> members</span>
                            <div className="flex gap-2">
                                <button className="p-1.5 bg-[#0d1316] border border-white/5 hover:bg-white/5 hover:text-white rounded-md transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button className="p-1.5 bg-[#0d1316] border border-white/5 hover:bg-white/5 hover:text-white rounded-md transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                    <div className="bg-[#161d24] border border-white/5 rounded-2xl p-6 flex items-center gap-4">
                        <div className="bg-[#10B981]/10 p-3 rounded-xl text-[#10B981]">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Pool Status</div>
                            <div className="text-xl font-bold text-white">Active</div>
                        </div>
                    </div>

                    <div className="bg-[#161d24] border border-[#FBBF24]/20 rounded-2xl p-6 flex items-center gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <ShieldCheck className="w-24 h-24 text-[#FBBF24]" />
                        </div>
                        <div className="bg-[#FBBF24]/10 p-3 rounded-xl text-[#FBBF24] relative z-10 border border-[#FBBF24]/20">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div className="relative z-10">
                            <div className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Security Tier</div>
                            <div className="text-xl font-bold text-white">High (Level 3)</div>
                        </div>
                    </div>

                    <div className="bg-[#161d24] border border-white/5 rounded-2xl p-6 flex items-center gap-4">
                        <div className="bg-white/5 p-3 rounded-xl text-gray-400 border border-white/5">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Deadline</div>
                            <div className="text-xl font-bold text-white">48h Left</div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Global Footer */}
            <footer className="mt-auto border-t border-white/5 p-6 md:px-10 bg-[#0d1316] flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Shield className="w-4 h-4 text-[#10B981]" />
                    <span>© 2024 Fantasy Chama. Encrypted & Secure.</span>
                </div>
                <div className="flex gap-6 text-sm text-gray-500 font-medium">
                    <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-white transition-colors">League Terms</a>
                    <a href="#" className="hover:text-white transition-colors">Support</a>
                </div>
            </footer>
        </div>
    );
}
