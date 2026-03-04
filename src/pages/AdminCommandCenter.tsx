import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, Download, Megaphone, Share2, RefreshCw, Banknote, TrendingUp, ChevronDown, CheckCircle2, Trophy, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import confetti from 'canvas-confetti';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function AdminCommandCenter() {
    const navigate = useNavigate();
    const activeLeagueId = localStorage.getItem('activeLeagueId');

    const [leagueName, setLeagueName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [monthlyContribution, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });
    const [isLoading, setIsLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState('');
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [isResolving, setIsResolving] = useState(false);

    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);
    const togglePaymentStatusGlobal = useStore(state => state.togglePaymentStatus);

    useEffect(() => {
        if (!activeLeagueId) {
            navigate('/setup');
            return;
        }

        const initDashboard = async () => {
            try {
                // Fetch the main League document
                const leagueRef = doc(db, 'leagues', activeLeagueId);
                const leagueSnap = await getDoc(leagueRef);

                if (leagueSnap.exists()) {
                    const data = leagueSnap.data();
                    setLeagueName(data.leagueName || 'Unnamed League');
                    setInviteCode(data.inviteCode || '------');
                    setMonthlyContribution(data.monthlyContribution || 0);
                    if (data.rules) setRules(data.rules);
                }

                // Initialize Live Ledger
                listenToLeagueMembers(activeLeagueId);
                setIsLoading(false);
            } catch (err) {
                console.error("Error fetching league:", err);
                navigate('/setup');
            }
        };

        initDashboard();
    }, [activeLeagueId, navigate, listenToLeagueMembers]);

    const handleTogglePayment = async (memberId: string, currentStatus: boolean, memberName: string) => {
        if (!activeLeagueId) return;
        try {
            await togglePaymentStatusGlobal(activeLeagueId, memberId, currentStatus);
            showToast(`Payment updated for ${memberName}`);
        } catch (error) {
            console.error("Error toggling payment", error);
        }
    };

    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Dynamic Calculations
    const paidMembersCount = members.filter(m => m.hasPaid).length;
    const totalCollected = paidMembersCount * monthlyContribution;
    const weeklyPot = totalCollected * (rules.weekly / 100);
    const seasonVault = totalCollected * (rules.vault / 100);

    const handleResolveGameweek = async () => {
        if (!activeLeagueId) return;
        setIsResolving(true);
        try {
            // 1. Fetch live FPL Standings (Using hardcoded generic ID since we don't have user's custom ID here, or 314)
            const fplLeagueId = 314;
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/fpl/standings/${fplLeagueId}`);
            if (!res.ok) throw new Error("Failed to fetch standings");
            const data = await res.json();

            const standings = data.standings.results || [];
            // Sort by GW points (event_total)
            const sortedStandings = standings.sort((a: any, b: any) => b.event_total - a.event_total);

            // 2. Chama Rule: Filter the top scorer against Firebase memberships list.
            let winner: any = null;

            for (const fplManager of sortedStandings) {
                // Match via displayName or fplTeamName
                const dbMember = members.find(m =>
                    m.displayName === fplManager.player_name || (m as any).fplTeamName === fplManager.entry_name
                );

                if (dbMember) {
                    if (dbMember.hasPaid) {
                        winner = dbMember;
                        break;
                    }
                }
            }

            // Fallback for simulation
            if (!winner) {
                winner = members.find(m => m.hasPaid);
            }

            if (!winner) {
                showToast("No eligible paid members found in the league!");
                setIsResolving(false);
                setShowResolveModal(false);
                return;
            }

            // 3. Simulated B2C Payout
            const payoutApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const payoutRes = await fetch(`${payoutApiUrl}/api/mpesa/b2c-payout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    winnerName: winner.displayName,
                    phoneNumber: winner.phone,
                    amount: weeklyPot
                })
            });
            const payoutData = await payoutRes.json();

            if (payoutData.success) {
                // 4. Audit Log Write
                const txRef = collection(db, 'leagues', activeLeagueId, 'transactions');
                await addDoc(txRef, {
                    type: 'payout',
                    winnerName: winner.displayName,
                    amount: weeklyPot,
                    gameweek: 26,
                    timestamp: serverTimestamp(),
                    receiptId: payoutData.simulatedReceipt
                });

                setShowResolveModal(false);
                showToast(`${weeklyPot.toLocaleString()} KES Dispatched to ${winner.displayName}!`);

                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#10B981', '#FBBF24', '#FFFFFF']
                });
            }
        } catch (error) {
            console.error("Resolution Error:", error);
            showToast("Gameweek Resolution Failed");
        } finally {
            setIsResolving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0d1316] text-[#10B981] flex flex-col items-center justify-center font-bold tracking-widest uppercase">
                <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                Syncing Ledger...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d1316] text-white p-6 md:p-10 font-sans max-w-7xl mx-auto space-y-10">
            {/* Top Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">Command Center <span className="text-[#10B981] text-lg font-medium tracking-normal ml-2 hidden sm:inline-block">({leagueName})</span></h1>
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
                        <h2 className="text-3xl font-extrabold tracking-tight mb-1">League Access & Economy</h2>
                        <p className="text-gray-400 text-sm">Control your league entry and monitor the live vault deposits.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowResolveModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-[#FBBF24] hover:bg-[#FBBF24]/90 text-black text-sm font-black tracking-wide rounded-xl transition-all shadow-[0_0_20px_rgba(251,191,36,0.5)] uppercase">
                            <Trophy className="w-4 h-4" /> Resolve Gameweek
                        </button>
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
                        <div className="p-8 flex-1 flex flex-col justify-center relative">
                            {/* Toast Notification */}
                            <div className={clsx(
                                "absolute top-4 right-4 bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all duration-300 pointer-events-none",
                                toastMessage ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                            )}>
                                <CheckCircle2 className="w-4 h-4" /> {toastMessage}
                            </div>

                            <span className="text-[#10B981] text-xs font-bold tracking-widest uppercase mb-4">Master Invite Code</span>
                            <div className="text-6xl font-black text-[#FBBF24] tracking-tight mb-6 tabular-nums">{inviteCode.slice(0, 3)} {inviteCode.slice(3, 6)}</div>
                            <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm">
                                Share this 6-digit PIN with verified members to grant them access to <strong>{leagueName}</strong>. PIN expires at the start of season.
                            </p>
                            <div className="flex items-center gap-4 mt-auto">
                                <button className="flex items-center gap-2 px-4 py-2 text-[#10B981] hover:bg-[#10B981]/10 rounded-lg text-sm font-bold transition-colors disabled:opacity-50" disabled>
                                    <RefreshCw className="w-4 h-4" /> Regenerate PIN
                                </button>
                                <button onClick={() => navigator.clipboard.writeText(inviteCode)} className="flex items-center gap-2 px-6 py-2 bg-[#1a232b] hover:bg-white/10 border border-white/5 text-white rounded-lg text-sm font-bold transition-colors">
                                    <Share2 className="w-4 h-4" /> Share Key
                                </button>
                            </div>
                        </div>
                        <div className="hidden lg:flex bg-[#11171a] p-8 flex-col items-center justify-center border-l border-white/5 min-w-[200px]">
                            <div className="w-full text-center space-y-4">
                                <div>
                                    <p className="text-xl font-bold text-[#FBBF24] tabular-nums hover:scale-105 transition-transform">KES {weeklyPot.toLocaleString()}</p>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-1">Weekly Pot ({rules.weekly}%)</p>
                                </div>
                                <div className="h-px bg-white/5 w-full"></div>
                                <div>
                                    <p className="text-xl font-bold text-[#22c55e] tabular-nums hover:scale-105 transition-transform">KES {seasonVault.toLocaleString()}</p>
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-1">Season Vault ({rules.vault}%)</p>
                                </div>
                            </div>
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
                                <span className="text-gray-400 text-sm font-medium block mb-2">Total Live Collections</span>
                                <div className="text-3xl font-black text-white tracking-tight mb-3">KES {totalCollected.toLocaleString()}</div>
                                <div className="flex items-center gap-2 text-[#10B981] text-xs font-bold bg-[#10B981]/10 w-fit px-2.5 py-1 rounded-md">
                                    <TrendingUp className="w-3 h-3" /> {paidMembersCount} members fully paid
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
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-500 font-medium">
                                        No members enrolled in the live ledger yet.
                                    </td>
                                </tr>
                            ) : members.map((row) => (
                                <tr key={row.id} className={clsx(
                                    "transition-colors group",
                                    row.hasPaid ? "bg-[#10B981]/5 border-l-2 border-[#10B981]" : "hover:bg-white/[0.02] border-l-2 border-transparent"
                                )}>
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                                                row.hasPaid ? "bg-[#10B981]/20 text-[#10B981]" : "bg-gray-800 text-gray-400"
                                            )}>
                                                {row.displayName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white leading-tight mb-1">{row.displayName}</div>
                                                <div className="text-xs text-gray-400 leading-none">{row.phone}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="bg-[#11171a] border border-white/5 px-3 py-1.5 rounded-md text-gray-400 font-mono text-xs">M-PESA / BANK</span>
                                    </td>
                                    <td className={clsx("p-4 font-bold tabular-nums", row.hasPaid ? "text-[#10B981]" : "text-[#FBBF24]")}>
                                        KES {monthlyContribution.toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        {!row.hasPaid && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a232b] text-[#FBBF24] border border-white/5 text-xs font-bold shadow-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"></div> Red Zone (Unpaid)
                                            </span>
                                        )}
                                        {row.hasPaid && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-xs font-bold shadow-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div> Green Zone (Verified)
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        {/* Custom Toggle Switch */}
                                        <label className="relative inline-flex items-center cursor-pointer ml-auto">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={row.hasPaid}
                                                onChange={() => handleTogglePayment(row.id, row.hasPaid, row.displayName)}
                                            />
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
                    <span>Showing {members.length} members</span>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-[#1a232b] border border-white/5 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-medium">Prev</button>
                        <button className="px-4 py-2 bg-[#1a232b] border border-white/5 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-medium">Next</button>
                    </div>
                </div>
            </section>

            {/* Gameweek Resolution Modal */}
            {showResolveModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a100a]/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#161d24] border border-[#FBBF24]/30 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                        <div className="w-12 h-12 rounded-full bg-[#FBBF24]/10 flex items-center justify-center mb-6 border border-[#FBBF24]/20">
                            <AlertTriangle className="w-6 h-6 text-[#FBBF24]" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">
                            End-of-Gameweek Resolution
                        </h3>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            <strong className="text-[#FBBF24] font-bold">Are you sure?</strong> This will calculate the top scorer, simulate an M-Pesa B2C payout, dispatch <span className="text-white font-bold tracking-tight">KES {weeklyPot.toLocaleString()}</span> to the winner, and record the gameweek in the audit log permanently.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4 mt-8">
                            <button
                                onClick={() => setShowResolveModal(false)}
                                disabled={isResolving}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolveGameweek}
                                disabled={isResolving}
                                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black bg-[#FBBF24] hover:bg-white text-[#111613] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isResolving ? (
                                    <><RefreshCw className="w-4 h-4 animate-spin" /> Disbursing...</>
                                ) : (
                                    <><Banknote className="w-4 h-4" /> Disburse Funds</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
