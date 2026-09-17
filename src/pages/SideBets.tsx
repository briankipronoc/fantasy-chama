import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
    updateDoc, doc, arrayUnion, increment, getDoc
} from 'firebase/firestore';
import { useStore } from '../store/useStore';
import { Swords, Check, X, Trophy, Plus, Clock, ShieldCheck, ChevronDown, Flame, Search, History } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import ChampionFlexCardModal from '../components/ChampionFlexCardModal';
import UserAvatar from '../components/UserAvatar';
import { DashboardSkeleton } from '../components/Skeleton';

interface Participant {
    id: string;
    name: string;
    signed: boolean;
    teamLabel?: string;
    fplEntryId?: number;
}

interface SideBet {
    id: string;
    title: string;
    description: string;
    challenger: Participant;
    opponent: Participant;
    stake: number;
    status: 'pending_opponent' | 'pending_chairman' | 'active' | 'resolved' | 'cancelled';
    winnerId: string | null;
    winnerName: string | null;
    endorsers: string[];
    chairmanSeen: boolean;
    chairmanApproved: boolean;
    createdAt: any;
}

export default function SideBets() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId');

    const members = useStore(state => state.members);
    const role = useStore(state => state.role);

    const currentUser = members.find(m => m.id === activeUserId);
    const isAdmin = role === 'admin';

    const [leagueName, setLeagueName] = useState('League');
    const [bets, setBets] = useState<SideBet[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Create form state
    const [betTitle, setBetTitle] = useState('');
    const [betDescription, setBetDescription] = useState('');
    const [betStake, setBetStake] = useState('');
    const [opponentId, setOpponentId] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<'primary' | 'secondary'>('primary');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showOpponentPicker, setShowOpponentPicker] = useState(false);
    const [opponentSearch, setOpponentSearch] = useState('');
    const [betFilterTab, setBetFilterTab] = useState<'active' | 'my' | 'past'>('active');

    // Resolve state
    const [resolvingBetId, setResolvingBetId] = useState<string | null>(null);
    const [resolveWinnerId, setResolveWinnerId] = useState('');
    const [sharingBet, setSharingBet] = useState<SideBet | null>(null);

    useEffect(() => {
        if (!activeLeagueId) return;
        const lRef = doc(db, 'leagues', activeLeagueId);
        const unsub = onSnapshot(lRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setLeagueName(data.name || data.leagueName || 'League');
            }
        });
        return () => unsub();
    }, [activeLeagueId]);

    useEffect(() => {
        if (!activeLeagueId) {
            setLoading(false);
            return;
        }
        const q = query(
            collection(db, 'leagues', activeLeagueId, 'side_bets'),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setBets(snap.docs.map(d => ({ id: d.id, ...d.data() } as SideBet)));
            setLoading(false);
        }, (err) => {
            console.warn('[side-bets] listener failed:', err?.message || err);
            setBets([]);
            setLoading(false);
        });
        return () => unsub();
    }, [activeLeagueId]);

    const handleCreateBet = async () => {
        if (!activeLeagueId || !currentUser || !opponentId || !betTitle || !betStake) {
            toast.error('Please fill in all fields and select an opponent.');
            return;
        }
        const stake = Number(betStake);
        if (isNaN(stake) || stake < 10) {
            toast.error('Stake must be at least KES 10.');
            return;
        }

        const myBalance = currentUser.walletBalance || 0;
        if (myBalance < stake) {
            toast.error(`Insufficient wallet balance (KES ${myBalance.toLocaleString()}). Fund your wallet first.`);
            return;
        }

        const opponent = members.find(m => m.id === opponentId);
        if (!opponent) return;

        setIsSubmitting(true);
        try {
            const challengerFplEntry = selectedTeam === 'secondary'
                ? (currentUser.secondFplTeamId || currentUser.fplTeamId)
                : currentUser.fplTeamId;

            const challengerId = currentUser.id || activeUserId || '';
            const challengerName = currentUser.displayName || (currentUser as any).name || 'Challenger';
            const opponentIdClean = opponent.id || opponentId || '';
            const opponentName = opponent.displayName || (opponent as any).name || 'Opponent';

            const challengerData: Record<string, any> = {
                id: challengerId,
                name: challengerName,
                signed: true,
            };
            if (currentUser.secondFplTeamId) {
                challengerData.teamLabel = selectedTeam === 'secondary' ? 'Team 2' : 'Team 1';
            }
            const parsedFpl = Number(challengerFplEntry);
            if (challengerFplEntry && !isNaN(parsedFpl) && parsedFpl > 0) {
                challengerData.fplEntryId = parsedFpl;
            }

            await addDoc(collection(db, 'leagues', activeLeagueId, 'side_bets'), {
                title: betTitle.trim(),
                description: (betDescription || '').trim(),
                challenger: challengerData,
                opponent: {
                    id: opponentIdClean,
                    name: opponentName,
                    signed: false
                },
                challengerId,
                opponentId: opponentIdClean,
                stake: Number(stake) || 0,
                amount: Number(stake) || 0,
                status: 'pending_opponent',
                winnerId: null,
                winnerName: null,
                endorsers: [],
                chairmanSeen: false,
                chairmanApproved: false,
                createdAt: serverTimestamp(),
            });

            // 1. Personal direct challenge notification targeted to opponent exclusively
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                targetMemberId: opponent.id,
                message: `⚔️ Direct Challenge! ${challengerName} challenged you to a head-to-head wager: "${betTitle.trim()}" (KES ${stake.toLocaleString()}). Accept in Side Bets!`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            // 2. Public announcement for other managers in the league
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                message: `🎲 Side Bet Challenge: ${challengerName} challenged ${opponentName} to "${betTitle.trim()}" for KES ${stake.toLocaleString()}`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            toast.success(`Challenge sent to ${opponent.displayName || 'Opponent'}!`);
            setShowCreate(false);
            setBetTitle('');
            setBetDescription('');
            setBetStake('');
            setOpponentId('');
        } catch (e: any) {
            console.error('[side-bets] Failed to create bet:', e);
            toast.error('Failed to create bet: ' + (e?.message || 'Error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSign = async (bet: SideBet) => {
        if (!activeLeagueId || !currentUser) return;

        const myBalance = currentUser.walletBalance || 0;
        if (myBalance < bet.stake) {
            toast.error(`Insufficient wallet balance (KES ${myBalance.toLocaleString()}). Top up before accepting.`);
            return;
        }

        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                'opponent.signed': true,
                status: 'pending_chairman',
            });

            // 1. Targeted personal notification for challenger
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                targetMemberId: bet.challenger.id,
                message: `⚔️ Challenge Accepted! ${currentUser?.displayName} signed your wager for "${bet.title}". Awaiting Chairman sign-off.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            // 2. League activity notification
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                message: `🎲 Wager Locked: ${currentUser?.displayName} accepted challenge for "${bet.title}" (KES ${bet.stake.toLocaleString()}).`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            toast.success('Bet accepted! Awaiting Chairman confirmation.');
        } catch (_e) {
            toast.error('Failed to sign bet.');
        }
    };

    const handleEndorse = async (bet: SideBet) => {
        if (!activeLeagueId || !currentUser) return;
        if (bet.endorsers.includes(currentUser.id)) return;
        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                endorsers: arrayUnion(currentUser.id),
            });
            toast.success('Wager endorsed!');
        } catch (_e) {
            toast.error('Failed to endorse.');
        }
    };

    const handleChairmanApprove = async (bet: SideBet) => {
        if (!activeLeagueId || !isAdmin) return;
        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'active',
                chairmanApproved: true,
                chairmanSeen: true,
            });

            // Personal notifications to both participants
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                targetMemberId: bet.challenger.id,
                message: `🔒 Side Bet Approved! Chairman verified "${bet.title}". Wager is officially LIVE.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                targetMemberId: bet.opponent.id,
                message: `🔒 Side Bet Approved! Chairman verified "${bet.title}". Wager is officially LIVE.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            toast.success('Side bet approved and marked active.');
        } catch (_e) {
            toast.error('Failed to approve bet.');
        }
    };

    const handleChairmanReject = async (bet: SideBet) => {
        if (!activeLeagueId || !isAdmin) return;
        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'cancelled',
                chairmanSeen: true,
            });
            toast.success('Side bet rejected.');
        } catch (_e) {
            toast.error('Failed to reject bet.');
        }
    };

    const handleResolve = async (bet: SideBet) => {
        if (!activeLeagueId || !isAdmin) return;
        if (!resolveWinnerId) {
            toast.error('Select a winner first.');
            return;
        }
        const isChallenger = resolveWinnerId === bet.challenger.id;
        const loserId = isChallenger ? bet.opponent.id : bet.challenger.id;
        const loser = members.find(m => m.id === loserId);
        const winnerName = isChallenger ? bet.challenger.name : bet.opponent.name;
        const loserName = loser?.displayName || (loser as any)?.name || 'Opponent';

        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'resolved',
                winnerId: resolveWinnerId,
                winnerName,
                resolvedAt: serverTimestamp(),
            });

            // Auto-deduct from loser wallet, credit winner wallet
            const loserRef = doc(db, 'leagues', activeLeagueId, 'memberships', loserId);
            const winnerRef = doc(db, 'leagues', activeLeagueId, 'memberships', resolveWinnerId);

            const loserSnap = await getDoc(loserRef);
            if (loserSnap.exists()) {
                await updateDoc(loserRef, { walletBalance: increment(-bet.stake) });
            }
            const winnerSnap = await getDoc(winnerRef);
            if (winnerSnap.exists()) {
                await updateDoc(winnerRef, { walletBalance: increment(bet.stake) });
            }

            // 1. Personal notification to winner
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'transactionSuccess',
                targetMemberId: resolveWinnerId,
                message: `🏆 Victory! You won the head-to-head wager "${bet.title}"! KES ${(bet.stake * 2).toLocaleString()} pot secured to your wallet!`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            // 2. Personal notification to loser
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                targetMemberId: loserId,
                message: `⚔️ Wager Settled: "${bet.title}" concluded. KES ${bet.stake.toLocaleString()} transferred to ${winnerName}. Better luck next gameweek!`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            // 3. System notification for the league
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                message: `🏆 Side Bet Result: ${winnerName} defeated ${loserName} in "${bet.title}" (KES ${(bet.stake * 2).toLocaleString()} total pot)!`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            toast.success(`${winnerName} wins KES ${bet.stake.toLocaleString()}! Wallets auto-settled.`);
            setResolvingBetId(null);
            setResolveWinnerId('');
            setSharingBet({
                ...bet,
                status: 'resolved',
                winnerId: resolveWinnerId,
                winnerName,
            });
        } catch (_e) {
            toast.error('Failed to resolve bet.');
        }
    };

    const getStatusBadge = (bet: SideBet) => {
        switch (bet.status) {
            case 'pending_opponent':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                        <Clock className="w-3 h-3" /> Awaiting Opponent
                    </span>
                );
            case 'pending_chairman':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">
                        <ShieldCheck className="w-3 h-3" /> Awaiting Chairman
                    </span>
                );
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Bet
                    </span>
                );
            case 'resolved':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10 text-[10px] font-bold uppercase tracking-wider">
                        <Trophy className="w-3 h-3 text-amber-400" /> Resolved
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase tracking-wider">
                        <X className="w-3 h-3" /> Cancelled
                    </span>
                );
        }
    };

    const activeBets = bets.filter(b => b.status !== 'resolved' && b.status !== 'cancelled');
    const pastBets = bets.filter(b => b.status === 'resolved' || b.status === 'cancelled');
    const myActiveBets = activeBets.filter(b =>
        b.challenger.id === activeUserId || b.opponent.id === activeUserId
    );
    const otherBets = activeBets.filter(b =>
        b.challenger.id !== activeUserId && b.opponent.id !== activeUserId
    );

    const filteredOpponentMembers = members.filter(m => {
        if (m.id === activeUserId || m.isActive === false) return false;
        if (!opponentSearch.trim()) return true;
        const q = opponentSearch.toLowerCase();
        const nameMatch = (m.displayName || '').toLowerCase().includes(q);
        const teamMatch = (m.teamName || '').toLowerCase().includes(q);
        return nameMatch || teamMatch;
    });

    if (loading) {
        return (
            <div className="fc-sidebets-loading min-h-screen bg-[#0b1014] p-5 md:p-10 font-sans text-white">
                <DashboardSkeleton />
            </div>
        );
    }

    const selectedOpponent = members.find(m => m.id === opponentId);

    return (
        <div className="fc-sidebets-page min-h-screen p-5 md:p-10 w-full animate-in fade-in duration-500 pb-6 lg:pb-8 font-sans text-white relative overflow-hidden bg-transparent">
            {/* Ambient Lighting Background */}
            <div className="absolute inset-0 pointer-events-none opacity-70">
                <div className="absolute -top-24 right-[10%] h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
                <div className="absolute bottom-10 left-[8%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="max-w-6xl mx-auto space-y-4 md:space-y-5 relative z-10">
                {/* Standard Page Header */}
                <Header role={role || 'member'} title={leagueName} subtitle="Head-to-Head Wagers" />

                {/* Clean Unboxed Title Module (League Control Snapshot style) */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-0 pb-1">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-400 mb-1 flex items-center gap-1.5">
                            ⚔️ League Features
                        </p>
                        <h2 className="fc-frosty-title text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5 mb-1">
                            <Swords className="w-6 h-6 text-indigo-400" /> Side Bets & Wagers
                        </h2>
                        <p className="fc-metallic-sub text-sm font-medium max-w-xl leading-relaxed text-gray-400">
                            Direct head-to-head wagers between managers. Chairman approved, wallets auto-settled.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-amber-500/20 whitespace-nowrap self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" /> Challenge Someone
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 flex-wrap">
                    <button
                        onClick={() => setBetFilterTab('active')}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                            betFilterTab === 'active'
                                ? "bg-white/10 text-white shadow-sm font-black border border-white/20"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        <Swords className="w-3.5 h-3.5 text-amber-400" />
                        Live Duels
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300">
                            {activeBets.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setBetFilterTab('my')}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                            betFilterTab === 'my'
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        My Wagers
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                            {myActiveBets.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setBetFilterTab('past')}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                            betFilterTab === 'past'
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black"
                                : "text-gray-400 hover:text-white"
                        )}
                    >
                        <History className="w-3.5 h-3.5 text-emerald-400" />
                        Past Side Bets & Winners
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            {pastBets.length}
                        </span>
                    </button>
                </div>

                {/* Empty State */}
                {bets.length === 0 && (
                    <div className="fc-card bg-[#161d24]/60 border border-white/5 rounded-3xl p-10 md:p-14 text-center relative overflow-hidden my-6">
                        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.1)]">
                            <Swords className="w-8 h-8" />
                        </div>
                        <h3 className="fc-frosty-title text-xl md:text-2xl font-black mb-2">No Active Side Bets Yet</h3>
                        <p className="fc-metallic-sub text-sm max-w-md mx-auto leading-relaxed text-gray-400">
                            Challenge any rival manager in this league to a winner-takes-all head-to-head duel. Wallets auto-settle upon completion.
                        </p>
                    </div>
                )}

                {/* TAB: PAST BETS */}
                {betFilterTab === 'past' && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy className="w-4 h-4 text-emerald-400" />
                            <h3 className="font-bold text-sm uppercase tracking-widest text-emerald-400">Completed & Settled Duels</h3>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {pastBets.length}
                            </span>
                        </div>
                        {pastBets.length === 0 ? (
                            <div className="text-center py-12 border border-white/5 rounded-2xl bg-white/[0.02]">
                                <Trophy className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-bold text-gray-400">No past side bets resolved yet</p>
                                <p className="text-xs text-gray-500">Resolved duels and winners will appear here.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pastBets.map(bet => (
                                    <BetCard
                                        key={bet.id}
                                        bet={bet}
                                        currentUserId={activeUserId || ''}
                                        isAdmin={isAdmin}
                                        onSign={() => handleSign(bet)}
                                        onEndorse={() => handleEndorse(bet)}
                                        onApprove={() => handleChairmanApprove(bet)}
                                        onReject={() => handleChairmanReject(bet)}
                                        onResolveClick={() => { setResolvingBetId(bet.id); setResolveWinnerId(''); }}
                                        onShareWin={() => setSharingBet(bet)}
                                        getStatusBadge={getStatusBadge}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: MY WAGERS */}
                {betFilterTab === 'my' && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Flame className="w-4 h-4 text-amber-400" />
                            <h3 className="font-bold text-sm uppercase tracking-widest text-amber-400">Your Active & Pending Duels</h3>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {myActiveBets.length}
                            </span>
                        </div>
                        {myActiveBets.length === 0 ? (
                            <div className="text-center py-12 border border-white/5 rounded-2xl bg-white/[0.02]">
                                <Swords className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-bold text-gray-400">You don't have any active duels</p>
                                <p className="text-xs text-gray-500">Tap "Challenge Someone" above to start a side bet!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {myActiveBets.map(bet => (
                                    <BetCard
                                        key={bet.id}
                                        bet={bet}
                                        currentUserId={activeUserId || ''}
                                        isAdmin={isAdmin}
                                        onSign={() => handleSign(bet)}
                                        onEndorse={() => handleEndorse(bet)}
                                        onApprove={() => handleChairmanApprove(bet)}
                                        onReject={() => handleChairmanReject(bet)}
                                        onResolveClick={() => { setResolvingBetId(bet.id); setResolveWinnerId(''); }}
                                        onShareWin={() => setSharingBet(bet)}
                                        getStatusBadge={getStatusBadge}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: ACTIVE WAGERS (ALL) */}
                {betFilterTab === 'active' && (
                    <>
                        {/* My Active Bets Section */}
                        {myActiveBets.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Flame className="w-4 h-4 text-amber-400" />
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-amber-400">Your Wagers</h3>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        {myActiveBets.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {myActiveBets.map(bet => (
                                        <BetCard
                                            key={bet.id}
                                            bet={bet}
                                            currentUserId={activeUserId || ''}
                                            isAdmin={isAdmin}
                                            onSign={() => handleSign(bet)}
                                            onEndorse={() => handleEndorse(bet)}
                                            onApprove={() => handleChairmanApprove(bet)}
                                            onReject={() => handleChairmanReject(bet)}
                                            onResolveClick={() => { setResolvingBetId(bet.id); setResolveWinnerId(''); }}
                                            onShareWin={() => setSharingBet(bet)}
                                            getStatusBadge={getStatusBadge}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* League Bets Section */}
                        {otherBets.length > 0 && (
                            <div className="pt-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Trophy className="w-4 h-4 text-emerald-400" />
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-emerald-400">League Battles</h3>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        {otherBets.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {otherBets.map(bet => (
                                        <BetCard
                                            key={bet.id}
                                            bet={bet}
                                            currentUserId={activeUserId || ''}
                                            isAdmin={isAdmin}
                                            onSign={() => handleSign(bet)}
                                            onEndorse={() => handleEndorse(bet)}
                                            onApprove={() => handleChairmanApprove(bet)}
                                            onReject={() => handleChairmanReject(bet)}
                                            onResolveClick={() => { setResolvingBetId(bet.id); setResolveWinnerId(''); }}
                                            onShareWin={() => setSharingBet(bet)}
                                            getStatusBadge={getStatusBadge}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {myActiveBets.length === 0 && otherBets.length === 0 && bets.length > 0 && (
                            <div className="text-center py-12 border border-white/5 rounded-2xl bg-white/[0.02]">
                                <Swords className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-bold text-gray-400">No live wagers currently running</p>
                                <p className="text-xs text-gray-500">All recent duels have concluded. Check the "Past Side Bets" tab!</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create Bet Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#0c1218]/95 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <Swords className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="fc-frosty-title text-xl font-black">Issue Challenge</h3>
                                <p className="text-xs text-gray-400 font-medium">Head-to-head wager between managers</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-6">Your rival must sign before the Chairman gives the green light.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Wager Title</label>
                                <input
                                    type="text"
                                    value={betTitle}
                                    onChange={e => setBetTitle(e.target.value)}
                                    placeholder="e.g. Haaland vs Salah Top Scorer GW5"
                                    className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-amber-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Terms & Conditions (Optional)</label>
                                <textarea
                                    value={betDescription}
                                    onChange={e => setBetDescription(e.target.value)}
                                    placeholder="e.g. Captaincy points do not count, tie is refunded"
                                    rows={2}
                                    className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-amber-500/50 outline-none resize-none"
                                />
                            </div>
                            {currentUser?.secondFplTeamId && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">
                                        Stake With Team
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 bg-[#161d24] p-1.5 rounded-xl border border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTeam('primary')}
                                            className={clsx(
                                                "py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                                                selectedTeam === 'primary'
                                                    ? "bg-amber-500 text-black shadow-sm font-black"
                                                    : "text-gray-400 hover:text-white"
                                            )}
                                        >
                                            Team 1 (Primary)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTeam('secondary')}
                                            className={clsx(
                                                "py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                                                selectedTeam === 'secondary'
                                                    ? "bg-amber-500 text-black shadow-sm font-black"
                                                    : "text-gray-400 hover:text-white"
                                            )}
                                        >
                                            Team 2 (Dual #{currentUser.secondFplTeamId})
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1 font-medium">
                                        Points scored by {selectedTeam === 'secondary' ? 'Team 2' : 'Team 1'} will determine your wager score.
                                    </p>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stake (KES)</label>
                                    <span className="text-[10px] font-bold text-gray-500">
                                        Your Balance: KES {(currentUser?.walletBalance || 0).toLocaleString()}
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={betStake}
                                    onFocus={e => e.target.select()}
                                    onChange={e => {
                                        const cleaned = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                                        setBetStake(cleaned);
                                    }}
                                    placeholder="500"
                                    className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-white font-mono focus:ring-1 focus:ring-amber-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">Pick Rival Manager</label>
                                <button
                                    type="button"
                                    onClick={() => setShowOpponentPicker(!showOpponentPicker)}
                                    className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-left flex items-center justify-between"
                                >
                                    <span className={selectedOpponent ? 'text-white font-bold' : 'text-gray-500'}>
                                        {selectedOpponent ? selectedOpponent.displayName : 'Select opponent from league...'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                </button>
                                {showOpponentPicker && (
                                    <div className="mt-1 bg-[#161d24] border border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto shadow-2xl">
                                        <div className="p-2 border-b border-white/10 sticky top-0 bg-[#161d24] z-10">
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    value={opponentSearch}
                                                    onChange={e => setOpponentSearch(e.target.value)}
                                                    placeholder="Search manager or team..."
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        {filteredOpponentMembers.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-gray-500">No managers found</div>
                                        ) : (
                                            filteredOpponentMembers.map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => { setOpponentId(m.id); setShowOpponentPicker(false); setOpponentSearch(''); }}
                                                    className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 flex items-center justify-between transition-colors border-b border-white/5 last:border-0"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar name={m.displayName} size="xs" />
                                                        <div>
                                                            <div className="font-bold text-xs">{m.displayName}</div>
                                                            {m.teamName && <div className="text-[10px] text-gray-400">{m.teamName}</div>}
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500">
                                                        KES {(m.walletBalance || 0).toLocaleString()}
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
                            <button
                                type="button"
                                onClick={() => { setShowCreate(false); setBetTitle(''); setBetDescription(''); setBetStake(''); setOpponentId(''); }}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-xs font-black uppercase tracking-wider hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateBet}
                                disabled={isSubmitting || !betTitle || !opponentId || !betStake}
                                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                            >
                                {isSubmitting ? 'Submitting...' : 'Send Challenge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resolve Bet Modal */}
            {resolvingBetId && (() => {
                const bet = bets.find(b => b.id === resolvingBetId);
                if (!bet) return null;
                return (
                    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                        <div className="w-full max-w-sm bg-[#0c1218] border border-white/10 rounded-[2rem] p-6 shadow-2xl">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <h3 className="fc-frosty-title text-xl font-black mb-1">Resolve Wager</h3>
                            <p className="text-xs text-gray-400 mb-6">
                                "{bet.title}" — KES {bet.stake.toLocaleString()} will be automatically transferred from the loser to the winner's wallet.
                            </p>
                            <div className="space-y-3 mb-6">
                                <button
                                    onClick={() => setResolveWinnerId(bet.challenger.id)}
                                    className={clsx(
                                        'w-full py-3 px-4 rounded-xl text-sm font-bold text-left border transition-all flex items-center justify-between',
                                        resolveWinnerId === bet.challenger.id
                                            ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-md'
                                            : 'border-white/10 text-gray-300 hover:bg-white/5'
                                    )}
                                >
                                    <span>🏆 {bet.challenger.name} wins</span>
                                    {resolveWinnerId === bet.challenger.id && <Check className="w-4 h-4 text-amber-400" />}
                                </button>
                                <button
                                    onClick={() => setResolveWinnerId(bet.opponent.id)}
                                    className={clsx(
                                        'w-full py-3 px-4 rounded-xl text-sm font-bold text-left border transition-all flex items-center justify-between',
                                        resolveWinnerId === bet.opponent.id
                                            ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-md'
                                            : 'border-white/10 text-gray-300 hover:bg-white/5'
                                    )}
                                >
                                    <span>🏆 {bet.opponent.name} wins</span>
                                    {resolveWinnerId === bet.opponent.id && <Check className="w-4 h-4 text-amber-400" />}
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setResolvingBetId(null)}
                                    className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-xs font-black uppercase tracking-wider hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleResolve(bet)}
                                    disabled={!resolveWinnerId}
                                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                                >
                                    Confirm Winner
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {/* Champion Flex Card Modal for Side Bets */}
            {sharingBet && (
                <ChampionFlexCardModal
                    isOpen={!!sharingBet}
                    onClose={() => setSharingBet(null)}
                    winType="sidebet"
                    winnerName={sharingBet.winnerName || 'Champion'}
                    amountWon={sharingBet.stake * 2}
                    leagueName={leagueName}
                    betTitle={sharingBet.title}
                    defeatedOpponent={
                        sharingBet.winnerId === sharingBet.challenger.id
                            ? sharingBet.opponent.name
                            : sharingBet.challenger.name
                    }
                />
            )}
        </div>
    );
}

// ─── Bet Card Component ───────────────────────────────────────────────────────

interface BetCardProps {
    bet: SideBet;
    currentUserId: string;
    isAdmin: boolean;
    onSign: () => void;
    onEndorse: () => void;
    onApprove: () => void;
    onReject: () => void;
    onResolveClick: () => void;
    onShareWin: () => void;
    getStatusBadge: (bet: SideBet) => JSX.Element | undefined;
}

function BetCard({ bet, currentUserId, isAdmin, onSign, onEndorse, onApprove, onReject, onResolveClick, onShareWin, getStatusBadge }: BetCardProps) {
    const isChallenger = bet.challenger.id === currentUserId;
    const isOpponent = bet.opponent.id === currentUserId;
    const hasEndorsed = bet.endorsers.includes(currentUserId);
    const isParticipant = isChallenger || isOpponent;
    const isResolved = bet.status === 'resolved';
    const isCancelled = bet.status === 'cancelled';

    return (
        <div className={clsx(
            'fc-card rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between backdrop-blur-xl',
            isResolved ? 'border-white/5 bg-[#161d24]/60' :
            isCancelled ? 'border-red-500/10 bg-red-500/5' :
            bet.status === 'active' ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[#161d24] to-[#0c1218] shadow-[0_0_25px_rgba(251,191,36,0.06)]' :
            'border-white/10 bg-[#161d24]/90'
        )}>
            <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <p className="fc-frosty-title font-black text-base leading-snug">{bet.title}</p>
                        {bet.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{bet.description}</p>}
                    </div>
                    <div className="flex-shrink-0">{getStatusBadge(bet)}</div>
                </div>

                {/* Participants */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <div className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border',
                        bet.challenger.signed
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-white/5 text-gray-400 border-white/5'
                    )}>
                        {bet.challenger.signed && <Check className="w-3 h-3 text-emerald-400" />}
                        <span>{bet.challenger.name}</span>
                        {bet.challenger.signed && <span className="text-[9px] text-emerald-400/80 font-normal">(Challenger)</span>}
                    </div>
                    <span className="text-gray-500 text-xs font-black">vs</span>
                    <div className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border',
                        bet.opponent.signed
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    )}>
                        {bet.opponent.signed ? <Check className="w-3 h-3 text-emerald-400" /> : <Clock className="w-3 h-3 text-amber-400" />}
                        <span>{bet.opponent.name}</span>
                        {bet.opponent.signed ? (
                            <span className="text-[9px] text-emerald-400/80 font-normal">(Signed)</span>
                        ) : (
                            <span className="text-[9px] text-amber-400/80 font-normal">(Pending)</span>
                        )}
                    </div>
                </div>

                {/* Stake + Endorsers + Winner */}
                <div className="flex items-center justify-between mb-4 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-400">Pot:</span>
                        <span className="text-base font-black text-amber-400 tabular-nums">
                            KES {(bet.stake * 2).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-gray-500">({bet.stake.toLocaleString()} each)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {bet.endorsers.length > 0 && (
                            <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
                                <span>👀</span> {bet.endorsers.length}
                            </span>
                        )}
                        {isResolved && bet.winnerName && (
                            <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                                <Trophy className="w-3.5 h-3.5 text-amber-400" /> {bet.winnerName} won
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                {/* Opponent needs to sign */}
                {isOpponent && bet.status === 'pending_opponent' && !bet.opponent.signed && (
                    <button
                        onClick={onSign}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-emerald-500/20"
                    >
                        <Check className="w-3.5 h-3.5" /> Accept & Stake KES {bet.stake.toLocaleString()}
                    </button>
                )}

                {/* Chairman can approve/reject when both signed */}
                {isAdmin && bet.status === 'pending_chairman' && (
                    <>
                        <button
                            onClick={onApprove}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider transition-all hover:bg-emerald-500/20 active:scale-95"
                        >
                            <ShieldCheck className="w-3.5 h-3.5" /> Approve Wager
                        </button>
                        <button
                            onClick={onReject}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider transition-all hover:bg-red-500/20 active:scale-95"
                        >
                            <X className="w-3.5 h-3.5" /> Decline
                        </button>
                    </>
                )}

                {/* Chairman can resolve active bets */}
                {isAdmin && bet.status === 'active' && (
                    <button
                        onClick={onResolveClick}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider transition-all hover:bg-amber-500/20 active:scale-95"
                    >
                        <Trophy className="w-3.5 h-3.5" /> Resolve Winner
                    </button>
                )}

                {/* Others can endorse (watch) */}
                {!isParticipant && !isResolved && !isCancelled && (
                    <button
                        onClick={onEndorse}
                        disabled={hasEndorsed}
                        className={clsx(
                            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95',
                            hasEndorsed
                                ? 'bg-white/5 text-gray-500 border border-white/5 cursor-default'
                                : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                        )}
                    >
                        <span>👀</span> {hasEndorsed ? 'Watching' : 'Watch Duel'}
                    </button>
                )}

                {/* Resolved bet: Share / Flex Win on WhatsApp */}
                {isResolved && bet.winnerName && (
                    <button
                        onClick={onShareWin}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-amber-500/25"
                    >
                        <Trophy className="w-3.5 h-3.5" /> Share Duel Win
                    </button>
                )}
            </div>
        </div>
    );
}
