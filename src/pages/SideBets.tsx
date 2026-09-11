import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
    updateDoc, doc, arrayUnion, increment, getDoc
} from 'firebase/firestore';
import { useStore } from '../store/useStore';
import { Swords, Check, X, Trophy, Plus, Clock, ShieldCheck, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Participant {
    id: string;
    name: string;
    signed: boolean;
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

    const [bets, setBets] = useState<SideBet[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Create form state
    const [betTitle, setBetTitle] = useState('');
    const [betDescription, setBetDescription] = useState('');
    const [betStake, setBetStake] = useState('');
    const [opponentId, setOpponentId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showOpponentPicker, setShowOpponentPicker] = useState(false);

    // Resolve state
    const [resolvingBetId, setResolvingBetId] = useState<string | null>(null);
    const [resolveWinnerId, setResolveWinnerId] = useState('');

    useEffect(() => {
        if (!activeLeagueId) return;
        const q = query(
            collection(db, 'leagues', activeLeagueId, 'side_bets'),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setBets(snap.docs.map(d => ({ id: d.id, ...d.data() } as SideBet)));
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
        const opponent = members.find(m => m.id === opponentId);
        if (!opponent) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'leagues', activeLeagueId, 'side_bets'), {
                title: betTitle,
                description: betDescription,
                challenger: { id: currentUser.id, name: currentUser.displayName, signed: true },
                opponent: { id: opponent.id, name: opponent.displayName, signed: false },
                stake,
                status: 'pending_opponent',
                winnerId: null,
                winnerName: null,
                endorsers: [],
                chairmanSeen: false,
                chairmanApproved: false,
                createdAt: serverTimestamp(),
            });
            toast.success('Bet created! Waiting for opponent to agree.');
            setShowCreate(false);
            setBetTitle('');
            setBetDescription('');
            setBetStake('');
            setOpponentId('');
        } catch (_e) {
            toast.error('Failed to create bet. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSign = async (bet: SideBet) => {
        if (!activeLeagueId) return;
        const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
        await updateDoc(betRef, {
            'opponent.signed': true,
            status: 'pending_chairman',
        });
        toast.success('You agreed to the bet! Waiting for Chairman approval.');
    };

    const handleChairmanApprove = async (bet: SideBet) => {
        if (!activeLeagueId) return;
        const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
        await updateDoc(betRef, {
            chairmanApproved: true,
            chairmanSeen: true,
            status: 'active',
        });
        toast.success('Bet approved and now active!');
    };

    const handleChairmanReject = async (bet: SideBet) => {
        if (!activeLeagueId) return;
        const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
        await updateDoc(betRef, {
            chairmanSeen: true,
            status: 'cancelled',
        });
        toast.success('Bet rejected.');
    };

    const handleEndorse = async (bet: SideBet) => {
        if (!activeLeagueId || !activeUserId) return;
        if (bet.endorsers.includes(activeUserId)) {
            toast('You are already watching this bet!');
            return;
        }
        if (bet.challenger.id === activeUserId || bet.opponent.id === activeUserId) {
            toast('You cannot endorse your own bet.');
            return;
        }
        const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
        await updateDoc(betRef, { endorsers: arrayUnion(activeUserId) });
        toast.success('You are now watching this bet!');
    };

    const handleResolve = async (bet: SideBet) => {
        if (!activeLeagueId || !resolveWinnerId) {
            toast.error('Select a winner first.');
            return;
        }
        const isChallenger = resolveWinnerId === bet.challenger.id;
        const loserId = isChallenger ? bet.opponent.id : bet.challenger.id;
        const winnerName = isChallenger ? bet.challenger.name : bet.opponent.name;

        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'resolved',
                winnerId: resolveWinnerId,
                winnerName,
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

            // Create notification
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'success',
                message: `🎲 ${winnerName} won the side bet "${bet.title}" and claimed KES ${bet.stake.toLocaleString()}!`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            toast.success(`${winnerName} wins KES ${bet.stake.toLocaleString()}! Wallets updated.`);
            setResolvingBetId(null);
            setResolveWinnerId('');
        } catch (_e) {
            toast.error('Failed to resolve bet.');
        }
    };

    const getStatusBadge = (bet: SideBet) => {
        switch (bet.status) {
            case 'pending_opponent':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-widest"><Clock className="w-3 h-3" />Awaiting Opponent</span>;
            case 'pending_chairman':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-widest"><ShieldCheck className="w-3 h-3" />Awaiting Chairman</span>;
            case 'active':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live Bet</span>;
            case 'resolved':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 text-[10px] font-bold uppercase tracking-widest"><Trophy className="w-3 h-3" />Resolved</span>;
            case 'cancelled':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase tracking-widest"><X className="w-3 h-3" />Cancelled</span>;
        }
    };

    const myActiveBets = bets.filter(b =>
        b.challenger.id === activeUserId || b.opponent.id === activeUserId
    );
    const otherBets = bets.filter(b =>
        b.challenger.id !== activeUserId && b.opponent.id !== activeUserId
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0b1014] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
            </div>
        );
    }

    const selectedOpponent = members.find(m => m.id === opponentId);

    return (
        <div className="min-h-screen bg-[#0b1014] text-white font-sans pb-32 px-4 py-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Swords className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">League Feature</p>
                        <h1 className="text-2xl font-black tracking-tight text-white">Side Bets</h1>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">Custom wagers between players. Chairman-approved. Wallets auto-settle.</p>
            </div>

            {/* Create Bet Button */}
            <button
                onClick={() => setShowCreate(true)}
                className="w-full mb-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-500/20"
            >
                <Plus className="w-5 h-5" />
                Challenge Someone
            </button>

            {/* My Bets */}
            {myActiveBets.length > 0 && (
                <div className="mb-8">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Your Bets</p>
                    <div className="space-y-3">
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
                                getStatusBadge={getStatusBadge}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* League Bets */}
            {otherBets.length > 0 && (
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">League Bets</p>
                    <div className="space-y-3">
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
                                getStatusBadge={getStatusBadge}
                            />
                        ))}
                    </div>
                </div>
            )}

            {bets.length === 0 && (
                <div className="text-center py-16">
                    <Swords className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500 font-bold">No side bets yet.</p>
                    <p className="text-gray-600 text-sm mt-1">Be the first to challenge someone!</p>
                </div>
            )}

            {/* Create Bet Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center p-4" onClick={() => setShowCreate(false)}>
                    <div className="w-full max-w-sm bg-[#0b1014] border border-white/10 rounded-[2rem] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-white mb-1">New Side Bet</h3>
                        <p className="text-xs text-gray-500 mb-6">Your opponent must agree, then the Chairman approves before it goes live.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Bet Title</label>
                                <input
                                    type="text"
                                    value={betTitle}
                                    onChange={e => setBetTitle(e.target.value)}
                                    placeholder="e.g. Arsenal beats Man City"
                                    className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-amber-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Custom Terms (optional)</label>
                                <textarea
                                    value={betDescription}
                                    onChange={e => setBetDescription(e.target.value)}
                                    placeholder="Add any specifics — e.g. scoreline, handicap..."
                                    rows={2}
                                    className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-amber-500/50 outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Stake (KES)</label>
                                <input
                                    type="number"
                                    value={betStake}
                                    onChange={e => setBetStake(e.target.value)}
                                    placeholder="e.g. 500"
                                    className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-white font-mono focus:ring-1 focus:ring-amber-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Challenge</label>
                                <button
                                    onClick={() => setShowOpponentPicker(!showOpponentPicker)}
                                    className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-left flex items-center justify-between"
                                >
                                    <span className={selectedOpponent ? 'text-white font-bold' : 'text-gray-500'}>
                                        {selectedOpponent ? selectedOpponent.displayName : 'Pick opponent...'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                </button>
                                {showOpponentPicker && (
                                    <div className="mt-1 bg-[#161d24] border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                        {members.filter(m => m.id !== activeUserId && m.isActive !== false).map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => { setOpponentId(m.id); setShowOpponentPicker(false); }}
                                                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 flex items-center gap-3 transition-colors"
                                            >
                                                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
                                                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(m as any).avatarSeed || m.displayName}&backgroundColor=transparent`} alt={m.displayName} className="w-full h-full object-cover" />
                                                </div>
                                                <span className="font-bold">{m.displayName}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setShowCreate(false); setBetTitle(''); setBetDescription(''); setBetStake(''); setOpponentId(''); }}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateBet}
                                disabled={isSubmitting || !betTitle || !opponentId || !betStake}
                                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? 'Creating...' : 'Create Bet'}
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
                    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                        <div className="w-full max-w-sm bg-[#0b1014] border border-white/10 rounded-[2rem] p-6 shadow-2xl">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                                <Trophy className="w-5 h-5 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-1">Resolve Bet</h3>
                            <p className="text-xs text-gray-500 mb-6">"{bet.title}" — KES {bet.stake.toLocaleString()} will be auto-transferred from loser to winner's wallet.</p>
                            <div className="space-y-3 mb-6">
                                <button
                                    onClick={() => setResolveWinnerId(bet.challenger.id)}
                                    className={clsx('w-full py-3 px-4 rounded-xl text-sm font-bold text-left border transition-all', resolveWinnerId === bet.challenger.id ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/10 text-gray-400 hover:bg-white/5')}
                                >
                                    🏆 {bet.challenger.name} wins
                                </button>
                                <button
                                    onClick={() => setResolveWinnerId(bet.opponent.id)}
                                    className={clsx('w-full py-3 px-4 rounded-xl text-sm font-bold text-left border transition-all', resolveWinnerId === bet.opponent.id ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/10 text-gray-400 hover:bg-white/5')}
                                >
                                    🏆 {bet.opponent.name} wins
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setResolvingBetId(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all">Cancel</button>
                                <button
                                    onClick={() => handleResolve(bet)}
                                    disabled={!resolveWinnerId}
                                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black transition-all disabled:opacity-50"
                                >
                                    Confirm Winner
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
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
    getStatusBadge: (bet: SideBet) => JSX.Element | undefined;
}

function BetCard({ bet, currentUserId, isAdmin, onSign, onEndorse, onApprove, onReject, onResolveClick, getStatusBadge }: BetCardProps) {
    const isChallenger = bet.challenger.id === currentUserId;
    const isOpponent = bet.opponent.id === currentUserId;
    const hasEndorsed = bet.endorsers.includes(currentUserId);
    const isParticipant = isChallenger || isOpponent;
    const isResolved = bet.status === 'resolved';
    const isCancelled = bet.status === 'cancelled';

    return (
        <div className={clsx(
            'rounded-2xl border p-5 transition-all',
            isResolved ? 'border-white/5 bg-white/[0.02]' :
            isCancelled ? 'border-red-500/10 bg-red-500/5' :
            bet.status === 'active' ? 'border-amber-500/20 bg-amber-500/5 shadow-[0_0_20px_rgba(251,191,36,0.05)]' :
            'border-white/10 bg-[#161d24]'
        )}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <p className="font-black text-white text-sm leading-tight">{bet.title}</p>
                    {bet.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{bet.description}</p>}
                </div>
                <div className="flex-shrink-0">{getStatusBadge(bet)}</div>
            </div>

            {/* Participants */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className={clsx('flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold', bet.challenger.signed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-400')}>
                    {bet.challenger.signed && <Check className="w-3 h-3" />}
                    {bet.challenger.name}
                    {bet.challenger.signed && <span className="text-[9px] text-emerald-600 font-bold">✓ signed</span>}
                </div>
                <span className="text-gray-600 text-xs font-bold">vs</span>
                <div className={clsx('flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold', bet.opponent.signed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')}>
                    {bet.opponent.signed ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {bet.opponent.name}
                    {bet.opponent.signed && <span className="text-[9px] text-emerald-600 font-bold">✓ signed</span>}
                </div>
            </div>

            {/* Stake + Endorsers + Winner */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-500">Stake:</span>
                    <span className="text-sm font-black text-amber-400 tabular-nums">KES {bet.stake.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                    {bet.endorsers.length > 0 && (
                        <span className="text-xs text-gray-500 font-bold flex items-center gap-1">
                            <span className="text-base">👀</span> {bet.endorsers.length}
                        </span>
                    )}
                    {isResolved && bet.winnerName && (
                        <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                            <Trophy className="w-3 h-3" />{bet.winnerName} won
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
                {/* Opponent needs to sign */}
                {isOpponent && bet.status === 'pending_opponent' && !bet.opponent.signed && (
                    <button
                        onClick={onSign}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs font-black transition-all active:scale-95 shadow-md"
                    >
                        <Check className="w-3.5 h-3.5" /> I Agree to This Bet
                    </button>
                )}

                {/* Chairman can approve/reject when both signed */}
                {isAdmin && bet.status === 'pending_chairman' && (
                    <>
                        <button onClick={onApprove} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black transition-all hover:bg-emerald-500/20 active:scale-95">
                            <ShieldCheck className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={onReject} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black transition-all hover:bg-red-500/20 active:scale-95">
                            <X className="w-3.5 h-3.5" /> Reject
                        </button>
                    </>
                )}

                {/* Chairman can resolve active bets */}
                {isAdmin && bet.status === 'active' && (
                    <button onClick={onResolveClick} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black transition-all hover:bg-amber-500/20 active:scale-95">
                        <Trophy className="w-3.5 h-3.5" /> Resolve Bet
                    </button>
                )}

                {/* Others can endorse (watch) */}
                {!isParticipant && !isResolved && !isCancelled && (
                    <button
                        onClick={onEndorse}
                        disabled={hasEndorsed}
                        className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95',
                            hasEndorsed ? 'bg-white/5 text-gray-600 cursor-default' : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                        )}
                    >
                        <span className="text-sm">👀</span> {hasEndorsed ? 'Watching' : 'Watch This'}
                    </button>
                )}
            </div>
        </div>
    );
}
