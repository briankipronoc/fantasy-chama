import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
    updateDoc, doc, arrayUnion, increment, getDoc
} from 'firebase/firestore';
import { useStore } from '../store/useStore';
import { Swords, Check, X, Trophy, Plus, Clock, ShieldCheck, ChevronDown, Flame, Search, History, AlertTriangle, Target, Bot, Bell, Sparkles } from 'lucide-react';
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
    fundingMode?: 'post_match' | 'instant_escrow';
    status: 'pending_opponent' | 'pending_chairman' | 'active' | 'resolved' | 'cancelled';
    winnerId: string | null;
    winnerName: string | null;
    endorsers: string[];
    chairmanSeen: boolean;
    chairmanApproved: boolean;
    createdAt: any;
    cancelRequestedBy?: string | null;
    cancelRequestedByName?: string | null;
    cancelRequestedAt?: any;
    cancelledBy?: string | null;
    cancellationReason?: string | null;
    resolvedAt?: any;
}

export default function SideBets() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId');

    const members = useStore(state => state.members);
    const role = useStore(state => state.role);
    const league = useStore(state => state.league);

    const currentUser = members.find(m => m.id === activeUserId);
    const isAdmin = role === 'admin';

    const [leagueName, setLeagueName] = useState('League');
    const [bets, setBets] = useState<SideBet[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const getMemberTeamName = (m: any) => {
        if (!m) return '';
        if (m.teamName) return m.teamName;
        if (m.fplTeamName) return m.fplTeamName;
        if (m.entryName) return m.entryName;
        if (m.entry_name) return m.entry_name;
        
        const fplLeagueId = (league as any)?.fplLeagueId;
        if (fplLeagueId) {
            try {
                const cached = localStorage.getItem(`fpl_standings_${fplLeagueId}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const results = parsed?.data || parsed;
                    if (Array.isArray(results)) {
                        const norm = (s: string) => String(s || '').toLowerCase().trim();
                        const match = results.find((r: any) => {
                            if (m.fplTeamId && Number(m.fplTeamId) === Number(r.entry)) return true;
                            if (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(r.entry)) return true;
                            const db = norm(m.displayName);
                            return norm(r.player_name).includes(db) || db.includes(norm(r.player_name));
                        });
                        if (match?.entry_name) return match.entry_name;
                    }
                }
            } catch {}
        }
        return '';
    };

    // Create form state
    const [betTitle, setBetTitle] = useState('');
    const [betDescription, setBetDescription] = useState('');
    const [betStake, setBetStake] = useState('');
    const [fundingMode, setFundingMode] = useState<'post_match' | 'instant_escrow'>('post_match');
    const [opponentId, setOpponentId] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<'primary' | 'secondary'>('primary');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showOpponentPicker, setShowOpponentPicker] = useState(false);
    const [opponentSearch, setOpponentSearch] = useState('');
    const [betFilterTab, setBetFilterTab] = useState<'active' | 'my' | 'past' | 'cancelled'>('active');

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

        const opponent = members.find(m => m.id === opponentId);
        if (!opponent) return;

        const numStake = Number(stake) || 0;
        const currentChallengerWallet = Number(currentUser?.walletBalance || 0);
        if (fundingMode === 'instant_escrow' && currentChallengerWallet < numStake) {
            toast.error(`Insufficient wallet balance! You have KES ${currentChallengerWallet.toLocaleString()} but need KES ${numStake.toLocaleString()} to escrow this wager.`);
            return;
        }

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
                escrowed: fundingMode === 'instant_escrow',
            };
            if (currentUser.secondFplTeamId) {
                challengerData.teamLabel = selectedTeam === 'secondary' ? 'Team 2' : 'Team 1';
            }
            const parsedFpl = Number(challengerFplEntry);
            if (challengerFplEntry && !isNaN(parsedFpl) && parsedFpl > 0) {
                challengerData.fplEntryId = parsedFpl;
            }

            // If Wallet Escrow, deduct stake upfront and record ledger transaction
            if (fundingMode === 'instant_escrow' && numStake > 0) {
                const chalMemberRef = doc(db, 'leagues', activeLeagueId, 'memberships', challengerId);
                await updateDoc(chalMemberRef, {
                    walletBalance: increment(-numStake)
                });
                await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                    type: 'sidebet_escrow',
                    category: 'sidebet',
                    amount: -numStake,
                    memberId: challengerId,
                    memberName: challengerName,
                    opponentId: opponentIdClean,
                    opponentName: opponentName,
                    note: `Escrow stake locked for side bet: "${betTitle.trim()}" vs ${opponentName}`,
                    receiptId: `CASH_SB_ESC_${Date.now().toString().slice(-6)}`,
                    timestamp: serverTimestamp(),
                });
                await addDoc(collection(db, 'leagues', activeLeagueId, 'league_events'), {
                    eventType: 'sidebet_escrow',
                    message: `🔒 ${challengerName} locked KES ${numStake.toLocaleString()} in escrow for "${betTitle.trim()}" vs ${opponentName}`,
                    timestamp: serverTimestamp(),
                });
            }

            await addDoc(collection(db, 'leagues', activeLeagueId, 'side_bets'), {
                title: betTitle.trim(),
                description: (betDescription || '').trim(),
                challenger: challengerData,
                opponent: {
                    id: opponentIdClean,
                    name: opponentName,
                    signed: false,
                    escrowed: false
                },
                challengerId,
                opponentId: opponentIdClean,
                stake: numStake,
                amount: numStake,
                fundingMode,
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
                message: `⚔️ Direct Challenge! ${challengerName} challenged you to a head-to-head wager: "${betTitle.trim()}" (KES ${numStake.toLocaleString()}). Accept in Side Bets!`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            // 2. Public announcement for other managers in the league
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                message: `🎲 Side Bet Challenge: ${challengerName} challenged ${opponentName} to "${betTitle.trim()}" for KES ${numStake.toLocaleString()}`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            toast.success(`Challenge sent to ${opponent.displayName || 'Opponent'}!${fundingMode === 'instant_escrow' ? ` KES ${numStake.toLocaleString()} escrowed.` : ''}`);
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

        try {
            // If instant escrow, opponent must also have required float
            if (bet.fundingMode === 'instant_escrow' && bet.stake > 0) {
                const oppMember = members.find(m => m.id === currentUser.id);
                const oppWallet = Number(oppMember?.walletBalance ?? currentUser?.walletBalance ?? 0);
                if (oppWallet < bet.stake) {
                    toast.error(`Insufficient wallet balance! You have KES ${oppWallet.toLocaleString()} but need KES ${bet.stake.toLocaleString()} to lock in this wager.`);
                    return;
                }
                const oppMemberRef = doc(db, 'leagues', activeLeagueId, 'memberships', currentUser.id);
                await updateDoc(oppMemberRef, {
                    walletBalance: increment(-bet.stake)
                });
                await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                    type: 'sidebet_escrow',
                    category: 'sidebet',
                    amount: -bet.stake,
                    memberId: currentUser.id,
                    memberName: currentUser.displayName || 'Opponent',
                    opponentId: bet.challenger.id,
                    opponentName: bet.challenger.name,
                    note: `Escrow stake locked for side bet: "${bet.title}" vs ${bet.challenger.name}`,
                    receiptId: `CASH_SB_ESC_${Date.now().toString().slice(-6)}`,
                    timestamp: serverTimestamp(),
                });
                await addDoc(collection(db, 'leagues', activeLeagueId, 'league_events'), {
                    eventType: 'sidebet_escrow',
                    message: `🔒 ${currentUser.displayName} matched escrow (KES ${bet.stake.toLocaleString()}) for "${bet.title}" vs ${bet.challenger.name}`,
                    timestamp: serverTimestamp(),
                });
            }

            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                'opponent.signed': true,
                'opponent.escrowed': bet.fundingMode === 'instant_escrow',
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

    const refundEscrowedStakesIfAny = async (bet: SideBet) => {
        if (!activeLeagueId || bet.fundingMode !== 'instant_escrow') return;
        const stake = Number(bet.stake || 0);
        if (stake <= 0) return;

        // Refund challenger if escrowed
        if (bet.challenger?.id) {
            try {
                const chalRef = doc(db, 'leagues', activeLeagueId, 'memberships', bet.challenger.id);
                await updateDoc(chalRef, { walletBalance: increment(stake) });
                await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                    type: 'sidebet_refund',
                    category: 'sidebet',
                    amount: stake,
                    memberId: bet.challenger.id,
                    memberName: bet.challenger.name,
                    note: `Escrow stake refunded for cancelled side bet: "${bet.title}"`,
                    receiptId: `CASH_SB_REF_${Date.now().toString().slice(-6)}`,
                    timestamp: serverTimestamp(),
                });
            } catch (e) {
                console.error('Failed to refund challenger:', e);
            }
        }

        // Refund opponent if they signed and escrowed
        if (bet.opponent?.id && (bet.opponent?.signed || (bet as any).opponentEscrowed || (bet.opponent as any).escrowed)) {
            try {
                const oppRef = doc(db, 'leagues', activeLeagueId, 'memberships', bet.opponent.id);
                await updateDoc(oppRef, { walletBalance: increment(stake) });
                await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                    type: 'sidebet_refund',
                    category: 'sidebet',
                    amount: stake,
                    memberId: bet.opponent.id,
                    memberName: bet.opponent.name,
                    note: `Escrow stake refunded for cancelled side bet: "${bet.title}"`,
                    receiptId: `CASH_SB_REF_${Date.now().toString().slice(-6)}`,
                    timestamp: serverTimestamp(),
                });
            } catch (e) {
                console.error('Failed to refund opponent:', e);
            }
        }
    };

    const handleChairmanReject = async (bet: SideBet) => {
        if (!activeLeagueId || !isAdmin) return;
        try {
            await refundEscrowedStakesIfAny(bet);
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'cancelled',
                cancelledBy: 'Chairman',
                cancellationReason: 'Declined by Chairman',
                chairmanSeen: true,
                updatedAt: serverTimestamp(),
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                targetMemberId: bet.challenger.id,
                message: `⚠️ Side Bet Declined: Chairman declined "${bet.title}". Any escrowed stake has been refunded to your wallet.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                targetMemberId: bet.opponent.id,
                message: `⚠️ Side Bet Declined: Chairman declined "${bet.title}". Any escrowed stake has been refunded to your wallet.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            toast.success('Side bet rejected and escrow refunded.');
        } catch (_e) {
            toast.error('Failed to reject bet.');
        }
    };

    const handleChallengerWithdraw = async (bet: SideBet) => {
        if (!activeLeagueId) return;
        try {
            await refundEscrowedStakesIfAny(bet);
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'cancelled',
                cancelledBy: currentUser?.displayName || 'Challenger',
                cancellationReason: 'Challenge withdrawn by challenger',
                updatedAt: serverTimestamp(),
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                targetMemberId: bet.opponent.id,
                message: `Challenge withdrawn: ${bet.challenger.name} withdrew the side bet "${bet.title}".`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            toast.success('Challenge withdrawn and escrow returned.');
        } catch (_e) {
            toast.error('Failed to withdraw challenge.');
        }
    };

    const handleChairmanCancel = async (bet: SideBet) => {
        if (!activeLeagueId || !isAdmin) return;
        try {
            await refundEscrowedStakesIfAny(bet);
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'cancelled',
                cancelledBy: 'Chairman',
                cancellationReason: 'Cancelled by Chairman override',
                updatedAt: serverTimestamp(),
            });
            // Send personal notifications to both participants
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                targetMemberId: bet.challenger.id,
                message: `⚠️ Side bet "${bet.title}" was cancelled by the Chairman. Any escrow has been returned to your wallet.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                targetMemberId: bet.opponent.id,
                message: `⚠️ Side bet "${bet.title}" was cancelled by the Chairman. Any escrow has been returned to your wallet.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            // League activity notification
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                message: `⚖️ Chairman cancelled the side bet "${bet.title}" (${bet.challenger.name} vs ${bet.opponent.name}).`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            toast.success('Side bet cancelled and escrow refunded.');
        } catch (_e) {
            toast.error('Failed to cancel bet.');
        }
    };

    const handleRequestCancel = async (bet: SideBet) => {
        if (!activeLeagueId || !activeUserId) return;
        const otherId = bet.challenger.id === activeUserId ? bet.opponent.id : bet.challenger.id;
        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                cancelRequestedBy: activeUserId,
                cancelRequestedByName: currentUser?.displayName || 'Opponent',
                cancelRequestedAt: serverTimestamp(),
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                targetMemberId: otherId,
                message: `⚠️ ${currentUser?.displayName || 'Opponent'} requested to cancel side bet "${bet.title}". Both players must agree to cancel.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            toast.success('Cancellation request sent to opponent.');
        } catch (_e) {
            toast.error('Failed to request cancellation.');
        }
    };

    const handleAgreeCancel = async (bet: SideBet) => {
        if (!activeLeagueId || !activeUserId) return;
        try {
            await refundEscrowedStakesIfAny(bet);
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'cancelled',
                cancelledBy: 'mutual_agreement',
                cancellationReason: 'Mutually cancelled by both players',
                cancelAgreedAt: serverTimestamp(),
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                targetMemberId: bet.challenger.id,
                message: `🤝 Side bet "${bet.title}" has been cancelled by mutual agreement. Any escrow has been returned to your wallet.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                targetMemberId: bet.opponent.id,
                message: `🤝 Side bet "${bet.title}" has been cancelled by mutual agreement. Any escrow has been returned to your wallet.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                message: `🤝 Side bet "${bet.title}" (${bet.challenger.name} vs ${bet.opponent.name}) was cancelled by mutual agreement.`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            toast.success('Bet cancelled by mutual agreement and escrow refunded.');
        } catch (_e) {
            toast.error('Failed to agree to cancellation.');
        }
    };

    const handleDeclineCancel = async (bet: SideBet) => {
        if (!activeLeagueId || !activeUserId) return;
        const requesterId = bet.cancelRequestedBy;
        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                cancelRequestedBy: null,
                cancelRequestedByName: null,
            });
            if (requesterId) {
                await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                    type: 'info',
                    targetMemberId: requesterId,
                    message: `${currentUser?.displayName || 'Opponent'} declined your request to cancel "${bet.title}". The wager remains active.`,
                    timestamp: serverTimestamp(),
                    readBy: [],
                });
            }
            toast('Cancellation request declined.', { icon: 'ℹ️' });
        } catch (_e) {
            toast.error('Failed to decline request.');
        }
    };

    const handleWithdrawCancelRequest = async (bet: SideBet) => {
        if (!activeLeagueId) return;
        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                cancelRequestedBy: null,
                cancelRequestedByName: null,
            });
            toast('Cancellation request withdrawn.', { icon: 'ℹ️' });
        } catch (_e) {
            toast.error('Failed to withdraw request.');
        }
    };

    const handleSmartVerify = async (bet: SideBet) => {
        toast.loading('🤖 Checking FPL live matchday statistics...', { id: `verify-${bet.id}` });
        try {
            const fplLeagueId = (league as any)?.fplLeagueId;
            let standings: any[] = [];
            if (fplLeagueId) {
                const cached = localStorage.getItem(`fpl_standings_${fplLeagueId}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    standings = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];
                }
            }

            const titleLower = bet.title.toLowerCase();
            const descLower = (bet.description || '').toLowerCase();
            const combined = `${titleLower} ${descLower}`;

            // Check if this is a Manager H2H Matchday duel (comparing FPL gameweek scores)
            const isH2hScoreDuel = /point|beat|score|gameweek|gw|matchday/i.test(combined) && !/haaland|salah|palmer|saka|son|clean\s*sheet/i.test(combined);

            if (isH2hScoreDuel && standings.length > 0) {
                const norm = (s: string) => String(s || '').toLowerCase().trim();
                const challengerRow = standings.find((r: any) => 
                    norm(r.player_name).includes(norm(bet.challenger.name)) || 
                    norm(bet.challenger.name).includes(norm(r.player_name))
                );
                const opponentRow = standings.find((r: any) => 
                    norm(r.player_name).includes(norm(bet.opponent.name)) || 
                    norm(bet.opponent.name).includes(norm(r.player_name))
                );

                if (challengerRow && opponentRow) {
                    const cScore = Number(challengerRow.event_total || 0);
                    const oScore = Number(opponentRow.event_total || 0);

                    if (cScore > oScore) {
                        toast.success(`🤖 Auto-Verified: ${bet.challenger.name} scored ${cScore} pts vs ${bet.opponent.name} (${oScore} pts)!`, { id: `verify-${bet.id}` });
                        await executeAutoResolve(bet, bet.challenger.id, bet.challenger.name, `${bet.challenger.name} scored ${cScore} pts vs ${oScore} pts`);
                        return;
                    } else if (oScore > cScore) {
                        toast.success(`🤖 Auto-Verified: ${bet.opponent.name} scored ${oScore} pts vs ${bet.challenger.name} (${cScore} pts)!`, { id: `verify-${bet.id}` });
                        await executeAutoResolve(bet, bet.opponent.id, bet.opponent.name, `${bet.opponent.name} scored ${oScore} pts vs ${cScore} pts`);
                        return;
                    } else {
                        toast('🤝 Auto-Check: Scores are currently tied! Awaiting final bonus point lock or Chairman review.', { id: `verify-${bet.id}`, icon: '🤝', duration: 4000 });
                        return;
                    }
                }
            }

            if (/blank/i.test(combined)) {
                toast('🤖 FPL Live Tracker: Player blank duel monitored. Awaiting final whistle to confirm official bonus and clean sheet points.', { id: `verify-${bet.id}`, icon: '⏳', duration: 4500 });
                return;
            }

            toast('🤖 Smart Tracker Active: Matchday in progress. Auto-resolution will finalize on final whistle, or tap "Nudge Chairman" to alert him!', { id: `verify-${bet.id}`, icon: 'ℹ️', duration: 5000 });
        } catch (_e) {
            toast.error('Smart verification encountered an error. You can nudge Chairman to resolve manually.', { id: `verify-${bet.id}` });
        }
    };

    const executeAutoResolve = async (bet: SideBet, autoWinnerId: string, autoWinnerName: string, reason: string) => {
        if (!activeLeagueId) return;
        const isChallenger = autoWinnerId === bet.challenger.id;
        const loserId = isChallenger ? bet.opponent.id : bet.challenger.id;
        const loser = members.find(m => m.id === loserId);
        const loserName = loser?.displayName || (loser as any)?.name || 'Opponent';
        const numStake = Number(bet.stake || 0);

        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'resolved',
                winnerId: autoWinnerId,
                winnerName: autoWinnerName,
                resolvedAt: serverTimestamp(),
            });

            const winnerRef = doc(db, 'leagues', activeLeagueId, 'memberships', autoWinnerId);
            const loserRef = doc(db, 'leagues', activeLeagueId, 'memberships', loserId);

            if (bet.fundingMode === 'instant_escrow') {
                const totalPot = numStake * 2;
                await updateDoc(winnerRef, { walletBalance: increment(totalPot) });
                await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                    type: 'sidebet_payout',
                    category: 'sidebet',
                    amount: totalPot,
                    memberId: autoWinnerId,
                    memberName: autoWinnerName,
                    opponentId: loserId,
                    opponentName: loserName,
                    note: `Smart Auto-Settled Pot: "${bet.title}" (${reason})`,
                    receiptId: `AUTO_SB_${Date.now().toString().slice(-6)}`,
                    timestamp: serverTimestamp(),
                });
            } else {
                const loserSnap = await getDoc(loserRef);
                if (loserSnap.exists()) {
                    await updateDoc(loserRef, { walletBalance: increment(-numStake) });
                }
                const winnerSnap = await getDoc(winnerRef);
                if (winnerSnap.exists()) {
                    await updateDoc(winnerRef, { walletBalance: increment(numStake) });
                }
                await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                    type: 'sidebet_payout',
                    category: 'sidebet',
                    amount: numStake,
                    memberId: autoWinnerId,
                    memberName: autoWinnerName,
                    opponentId: loserId,
                    opponentName: loserName,
                    note: `Smart Post-Match Settle: "${bet.title}" (${reason})`,
                    receiptId: `AUTO_SB_${Date.now().toString().slice(-6)}`,
                    timestamp: serverTimestamp(),
                });
            }

            await addDoc(collection(db, 'leagues', activeLeagueId, 'league_events'), {
                eventType: 'sidebet_resolved',
                message: `🤖 Smart Duel Settled: ${autoWinnerName} won "${bet.title}" against ${loserName}! (${reason})`,
                timestamp: serverTimestamp(),
            });

            toast.success(`🏆 Duel settled! ${autoWinnerName} wins KES ${(bet.fundingMode === 'instant_escrow' ? numStake * 2 : numStake).toLocaleString()}!`);
        } catch (err: any) {
            console.error('Auto resolve failed:', err);
            toast.error('Failed to complete auto-settlement.');
        }
    };

    const handleNudgeChairman = async (bet: SideBet) => {
        if (!activeLeagueId) return;
        try {
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                message: `🔔 Duel Nudge: ${currentUser?.displayName || 'Manager'} requests resolution for "${bet.title}" (Pot: KES ${(bet.stake * 2).toLocaleString()}).`,
                timestamp: serverTimestamp(),
                readBy: [],
            });
            toast.success('Chairman nudged via Chama notification!');
            const text = `Hi Chairman, please verify & settle our Chama side bet "${bet.title}" on FantasyChama: https://fantasy-chama.vercel.app/side-bets`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        } catch {
            toast.error('Failed to nudge Chairman.');
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
        const numStake = Number(bet.stake || 0);

        try {
            const betRef = doc(db, 'leagues', activeLeagueId, 'side_bets', bet.id);
            await updateDoc(betRef, {
                status: 'resolved',
                winnerId: resolveWinnerId,
                winnerName,
                resolvedAt: serverTimestamp(),
            });

            const winnerRef = doc(db, 'leagues', activeLeagueId, 'memberships', resolveWinnerId);
            const loserRef = doc(db, 'leagues', activeLeagueId, 'memberships', loserId);

            if (bet.fundingMode === 'instant_escrow') {
                // Both stakes were already escrowed upfront, so winner receives the combined 2x pot!
                const totalPot = numStake * 2;
                await updateDoc(winnerRef, { walletBalance: increment(totalPot) });
                await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                    type: 'sidebet_payout',
                    category: 'sidebet',
                    amount: totalPot,
                    memberId: resolveWinnerId,
                    memberName: winnerName,
                    opponentId: loserId,
                    opponentName: loserName,
                    note: `Side bet victory pot: "${bet.title}" (Defeated ${loserName})`,
                    receiptId: `CASH_SB_WIN_${Date.now().toString().slice(-6)}`,
                    timestamp: serverTimestamp(),
                });
            } else {
                // Post-match: deduct loser, credit winner
                const loserSnap = await getDoc(loserRef);
                if (loserSnap.exists()) {
                    await updateDoc(loserRef, { walletBalance: increment(-numStake) });
                }
                const winnerSnap = await getDoc(winnerRef);
                if (winnerSnap.exists()) {
                    await updateDoc(winnerRef, { walletBalance: increment(numStake) });
                }
                await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                    type: 'sidebet_payout',
                    category: 'sidebet',
                    amount: numStake,
                    memberId: resolveWinnerId,
                    memberName: winnerName,
                    opponentId: loserId,
                    opponentName: loserName,
                    note: `Post-match side bet victory: "${bet.title}" (Defeated ${loserName})`,
                    receiptId: `CASH_SB_WIN_${Date.now().toString().slice(-6)}`,
                    timestamp: serverTimestamp(),
                });
            }

            // Record celebration in league_events
            await addDoc(collection(db, 'leagues', activeLeagueId, 'league_events'), {
                eventType: 'sidebet_resolved',
                message: `🏆 ${winnerName} won the head-to-head duel "${bet.title}" against ${loserName}! Pot: KES ${(bet.fundingMode === 'instant_escrow' ? numStake * 2 : numStake).toLocaleString()}`,
                timestamp: serverTimestamp(),
            });

            // 1. Personal notification to winner
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'transactionSuccess',
                targetMemberId: resolveWinnerId,
                message: `🏆 Victory! You won the head-to-head wager "${bet.title}"! KES ${(bet.fundingMode === 'instant_escrow' ? numStake * 2 : numStake).toLocaleString()} pot secured to your wallet!`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            // 2. Personal notification to loser
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                targetMemberId: loserId,
                message: `⚔️ Wager Settled: "${bet.title}" concluded. KES ${numStake.toLocaleString()} transferred to ${winnerName}. Better luck next gameweek!`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            // 3. System notification for the league
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                message: `🏆 Side Bet Result: ${winnerName} defeated ${loserName} in "${bet.title}" (KES ${(bet.fundingMode === 'instant_escrow' ? numStake * 2 : numStake).toLocaleString()} total pot)!`,
                timestamp: serverTimestamp(),
                readBy: [],
            });

            toast.success(`${winnerName} wins KES ${(bet.fundingMode === 'instant_escrow' ? numStake * 2 : numStake).toLocaleString()}! Wallets auto-settled.`);
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
    const pastResolvedBets = bets.filter(b => b.status === 'resolved');
    const cancelledBets = bets.filter(b => b.status === 'cancelled');
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
        const teamMatch = getMemberTeamName(m).toLowerCase().includes(q);
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
        <div className="fc-sidebets-page min-h-screen p-5 md:p-10 w-full animate-in fade-in duration-500 pb-6 lg:pb-8 font-sans text-slate-900 dark:text-white relative overflow-hidden bg-transparent">
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
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-500 dark:text-amber-400 mb-1">
                            League Features
                        </p>
                        <h2 className="fc-frosty-title text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5 mb-1 text-slate-900 dark:text-white">
                            <Swords className="w-6 h-6 text-amber-500 dark:text-amber-400" /> Side Bets & Wagers
                        </h2>
                        <p className="fc-metallic-sub text-sm font-medium max-w-xl leading-relaxed text-slate-600 dark:text-gray-400">
                            Direct head-to-head wagers between managers. Chairman approved, wallets auto-settled.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-amber-500/20 whitespace-nowrap self-start sm:self-auto cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> Challenge Someone
                    </button>
                </div>

                {/* Side Bet Arena Hero & Weekly Champions Banner */}
                {(() => {
                    const totalEscrowPot = activeBets.reduce((acc, b) => {
                        const stake = Number(b.stake || 0);
                        return acc + (b.fundingMode === 'instant_escrow' ? stake * 2 : stake);
                    }, 0);

                    return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-2">
                            {/* Card 1: Duel Champion / Next GW Points Contest */}
                            <div
                                onClick={() => {
                                    setBetTitle('Next GW Matchday Points Duel');
                                    setBetDescription('Head-to-head matchday duel. Manager with the higher official FPL score in the upcoming gameweek takes the pot.');
                                    setShowCreate(true);
                                }}
                                className="fc-card rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 p-4 flex flex-col justify-between shadow-md cursor-pointer hover:border-amber-500/60 transition-all group"
                                title="Click to challenge a manager for the next gameweek points stake"
                            >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                        <Trophy className="w-3 h-3 text-amber-500" /> Duel Champion
                                    </span>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                                        Weekly Spotlight ⚡
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                                        Next GW Points Stake Duel
                                    </p>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 font-medium">
                                        Challenge a manager to claim the Weekly Duel crown!
                                    </p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-amber-500/20 flex items-center justify-between text-[10px] font-black text-amber-600 dark:text-amber-400">
                                    <span>⚡ Points Clash Stake</span>
                                    <span className="flex items-center gap-1 group-hover:underline">Tap to Challenge →</span>
                                </div>
                            </div>

                            {/* Card 2: Live Duels Escrow Liquidity */}
                            <div className="fc-card rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 p-4 flex flex-col justify-between shadow-md">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                        <Swords className="w-3 h-3 text-emerald-500" /> Active Pot
                                    </span>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                                        {activeBets.length} Active Duel{activeBets.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                        KES {totalEscrowPot.toLocaleString()}
                                    </p>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                                        Locked in wallet escrow & post-match duels
                                    </p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                    <span>Auto-Settlement Ready</span>
                                    <span>Escrow Verified ✓</span>
                                </div>
                            </div>

                            {/* Card 3: Milestone & Prop Watch Types */}
                            <div className="fc-card rounded-2xl bg-gradient-to-br from-indigo-500/15 via-white dark:via-[#161d24] to-indigo-500/5 dark:to-[#0c1218] border border-indigo-500/30 p-4 flex flex-col justify-between shadow-md">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                                        <Target className="w-3 h-3 text-indigo-500" /> Challenge Ideas & Props
                                    </span>
                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                                        Examples · Tap to Customize ⚡
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {/* Type 1: Milestone Target (Has progress bar) */}
                                    <div
                                        onClick={() => {
                                            setBetTitle('Player Milestone Target');
                                            setBetDescription('Back a player or team milestone target across the season (e.g. 20 goals, 15 assists, 10 clean sheets). Auto-tracked via official FPL data with Chairman verification.');
                                            setShowCreate(true);
                                        }}
                                        className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all cursor-pointer group"
                                        title="Click to customize a Progressive Milestone Challenge"
                                    >
                                        <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-gray-200 group-hover:text-indigo-500 transition-colors">
                                            <span className="truncate">🎯 Milestone Target (e.g. 20 Goals)</span>
                                            <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px] shrink-0 font-bold">Target Tracker</span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                            <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: '70%' }} />
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] text-gray-500 dark:text-gray-400 mt-1">
                                            <span>Progressive Cumulative Target</span>
                                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Auto-Tracked FPL 🤖</span>
                                        </div>
                                    </div>

                                    {/* Type 2: Single Match Prop (Yes / No Outcome) */}
                                    <div
                                        onClick={() => {
                                            setBetTitle('Single Match Prop (Yes / No)');
                                            setBetDescription('Back a single match or player outcome (e.g. clean sheet, goal, blank). Settles directly at the final whistle via official match statistics.');
                                            setShowCreate(true);
                                        }}
                                        className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all cursor-pointer group"
                                        title="Click to customize a Single Match Prop Challenge"
                                    >
                                        <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-gray-200 group-hover:text-amber-500 transition-colors">
                                            <span className="truncate">🎲 Single Match Prop (Yes / No)</span>
                                            <span className="text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                                Single Match Outcome
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-1.5 flex items-center justify-between">
                                            <span>Yes / No Match Event</span>
                                            <span className="font-semibold text-amber-600 dark:text-amber-400">Direct whistle settlement</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3 flex-wrap">
                    <button
                        onClick={() => setBetFilterTab('active')}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                            betFilterTab === 'active'
                                ? "bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/40 font-black shadow-xs"
                                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <Swords className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Live Duels
                        <span className={clsx(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                            betFilterTab === 'active'
                                ? "bg-amber-500/30 text-amber-900 dark:text-amber-300"
                                : "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-gray-300"
                        )}>
                            {activeBets.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setBetFilterTab('my')}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                            betFilterTab === 'my'
                                ? "bg-indigo-500/15 text-indigo-900 dark:text-indigo-300 border border-indigo-500/40 font-black shadow-xs"
                                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <Flame className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        My Wagers
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 font-bold">
                            {myActiveBets.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setBetFilterTab('past')}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                            betFilterTab === 'past'
                                ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 font-black shadow-xs"
                                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <History className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Past Winners
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold">
                            {pastResolvedBets.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setBetFilterTab('cancelled')}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                            betFilterTab === 'cancelled'
                                ? "bg-red-500/20 text-red-800 dark:text-red-300 border border-red-500/40 font-black shadow-xs"
                                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        Cancelled & Withdrawn
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-700 dark:text-red-400 font-bold">
                            {cancelledBets.length}
                        </span>
                    </button>
                </div>

                {/* Empty State */}
                {bets.length === 0 && (
                    <div className="fc-card bg-slate-100/90 dark:bg-[#161d24]/60 border border-slate-200 dark:border-white/5 rounded-3xl p-10 md:p-14 text-center relative overflow-hidden my-6 text-slate-900 dark:text-white shadow-sm">
                        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-500 dark:text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.1)]">
                            <Swords className="w-8 h-8" />
                        </div>
                        <h3 className="fc-frosty-title text-xl md:text-2xl font-black mb-2 text-slate-900 dark:text-white">No Active Side Bets Yet</h3>
                        <p className="fc-metallic-sub text-sm max-w-md mx-auto leading-relaxed text-slate-600 dark:text-gray-400">
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
                                {pastResolvedBets.length}
                            </span>
                        </div>
                        {pastResolvedBets.length === 0 ? (
                            <div className="text-center py-12 border border-white/5 rounded-2xl bg-white/[0.02]">
                                <Trophy className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-bold text-gray-400">No past side bets resolved yet</p>
                                <p className="text-xs text-gray-500">Resolved duels and winners will appear here.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pastResolvedBets.map(bet => (
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
                                        onWithdraw={() => handleChallengerWithdraw(bet)}
                                        onChairmanCancel={() => handleChairmanCancel(bet)}
                                        onRequestCancel={() => handleRequestCancel(bet)}
                                        onAgreeCancel={() => handleAgreeCancel(bet)}
                                        onDeclineCancel={() => handleDeclineCancel(bet)}
                                        onWithdrawCancelRequest={() => handleWithdrawCancelRequest(bet)}
                                        getStatusBadge={getStatusBadge}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: CANCELLED & WITHDRAWN */}
                {betFilterTab === 'cancelled' && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <X className="w-4 h-4 text-red-400" />
                            <h3 className="font-bold text-sm uppercase tracking-widest text-red-400">Cancelled & Withdrawn Duels</h3>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                {cancelledBets.length}
                            </span>
                        </div>
                        {cancelledBets.length === 0 ? (
                            <div className="text-center py-12 border border-white/5 rounded-2xl bg-white/[0.02]">
                                <X className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-bold text-gray-400">No cancelled or withdrawn wagers</p>
                                <p className="text-xs text-gray-500">Wagers withdrawn by challengers or cancelled by agreement are recorded here.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {cancelledBets.map(bet => (
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
                                        onWithdraw={() => handleChallengerWithdraw(bet)}
                                        onChairmanCancel={() => handleChairmanCancel(bet)}
                                        onRequestCancel={() => handleRequestCancel(bet)}
                                        onAgreeCancel={() => handleAgreeCancel(bet)}
                                        onDeclineCancel={() => handleDeclineCancel(bet)}
                                        onWithdrawCancelRequest={() => handleWithdrawCancelRequest(bet)}
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
                                        onWithdraw={() => handleChallengerWithdraw(bet)}
                                        onChairmanCancel={() => handleChairmanCancel(bet)}
                                        onRequestCancel={() => handleRequestCancel(bet)}
                                        onAgreeCancel={() => handleAgreeCancel(bet)}
                                        onDeclineCancel={() => handleDeclineCancel(bet)}
                                        onWithdrawCancelRequest={() => handleWithdrawCancelRequest(bet)}
                                        onSmartVerify={() => handleSmartVerify(bet)}
                                        onNudgeChairman={() => handleNudgeChairman(bet)}
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
                                            onWithdraw={() => handleChallengerWithdraw(bet)}
                                            onChairmanCancel={() => handleChairmanCancel(bet)}
                                            onRequestCancel={() => handleRequestCancel(bet)}
                                            onAgreeCancel={() => handleAgreeCancel(bet)}
                                            onDeclineCancel={() => handleDeclineCancel(bet)}
                                            onWithdrawCancelRequest={() => handleWithdrawCancelRequest(bet)}
                                            onSmartVerify={() => handleSmartVerify(bet)}
                                            onNudgeChairman={() => handleNudgeChairman(bet)}
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
                                            onWithdraw={() => handleChallengerWithdraw(bet)}
                                            onChairmanCancel={() => handleChairmanCancel(bet)}
                                            onRequestCancel={() => handleRequestCancel(bet)}
                                            onAgreeCancel={() => handleAgreeCancel(bet)}
                                            onDeclineCancel={() => handleDeclineCancel(bet)}
                                            onWithdrawCancelRequest={() => handleWithdrawCancelRequest(bet)}
                                            onSmartVerify={() => handleSmartVerify(bet)}
                                            onNudgeChairman={() => handleNudgeChairman(bet)}
                                            getStatusBadge={getStatusBadge}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {myActiveBets.length === 0 && otherBets.length === 0 && bets.length > 0 && (
                            <div className="text-center py-12 border border-slate-200 dark:border-white/5 rounded-2xl bg-slate-50 dark:bg-white/[0.02]">
                                <Swords className="w-8 h-8 text-slate-400 dark:text-gray-500 mx-auto mb-2 opacity-60" />
                                <p className="text-sm font-bold text-slate-800 dark:text-gray-400">No live wagers currently running</p>
                                <p className="text-xs text-slate-500 dark:text-gray-500">All recent duels have concluded. Check the "Past Side Bets" tab!</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create Bet Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white dark:bg-[#0c1218] border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden text-slate-900 dark:text-white">
                        {/* Uniform Modal Top-Right X */}
                        <button
                            type="button"
                            onClick={() => { setShowCreate(false); setBetTitle(''); setBetDescription(''); setBetStake(''); setOpponentId(''); }}
                            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-all cursor-pointer"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <Swords className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Issue Challenge</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Head-to-head wager between managers</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-gray-400 mb-4 font-medium">Your rival must sign before the Chairman gives the green light.</p>

                        {/* Quick Template Chips */}
                        <div className="mb-4">
                            <span className="block text-[10px] font-black text-slate-500 dark:text-gray-400 mb-1.5 uppercase tracking-widest flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-500" /> Challenge Templates & Ideas
                            </span>
                            <div className="flex flex-wrap gap-1.5 mb-2.5">
                                {[
                                    { tag: 'Points', title: 'Next GW Points Duel', desc: 'Higher official FPL score in the upcoming gameweek takes the pot.' },
                                    { tag: 'Milestone', title: 'Haaland 20 Goals Target', desc: 'Back Erling Haaland to hit 20 Premier League goals this season. Auto-tracked with Chairman verification.' },
                                    { tag: 'Yes/No', title: 'Haaland to blank GW8', desc: 'Erling Haaland scores 0 goals and 0 assists in GW8 (Single match Yes/No outcome).' },
                                    { tag: 'Prop', title: 'Arsenal Clean Sheet GW8', desc: 'Arsenal defense maintains a clean sheet in GW8.' },
                                ].map((tpl) => (
                                    <button
                                        key={tpl.title}
                                        type="button"
                                        onClick={() => {
                                            setBetTitle(tpl.title);
                                            setBetDescription(tpl.desc);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                        <span className="text-[9px] uppercase px-1 py-0.2 bg-amber-500/20 rounded font-black">{tpl.tag}</span>
                                        <span>{tpl.title}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-600 dark:text-gray-400 flex items-start gap-2">
                                <span className="text-amber-500 font-bold shrink-0">💡</span>
                                <span>You can challenge on <strong>any player or match outcome</strong>. FPL points & stats are auto-tracked, and the Chairman can manually settle with 1 tap if external details cannot be fetched.</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase tracking-widest">Wager Title</label>
                                <input
                                    type="text"
                                    value={betTitle}
                                    onChange={e => setBetTitle(e.target.value)}
                                    placeholder="e.g. Haaland vs Salah Top Scorer GW5"
                                    className="w-full bg-slate-50 dark:bg-[#161d24] border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-amber-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase tracking-widest">Terms & Conditions (Optional)</label>
                                <textarea
                                    value={betDescription}
                                    onChange={e => setBetDescription(e.target.value)}
                                    placeholder="e.g. Captaincy points do not count, tie is refunded"
                                    rows={2}
                                    className="w-full bg-slate-50 dark:bg-[#161d24] border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-amber-500/50 outline-none resize-none"
                                />
                            </div>
                            {currentUser?.secondFplTeamId && (
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase tracking-widest">
                                        Stake With Team
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-[#161d24] p-1.5 rounded-xl border border-slate-200 dark:border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTeam('primary')}
                                            className={clsx(
                                                "py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                                                selectedTeam === 'primary'
                                                    ? "bg-amber-500 text-black shadow-sm font-black"
                                                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
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
                                                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                            )}
                                        >
                                            Team 2 (Dual #{currentUser.secondFplTeamId})
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 font-medium">
                                        Points scored by {selectedTeam === 'secondary' ? 'Team 2' : 'Team 1'} will determine your wager score.
                                    </p>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[10px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-widest">Stake (KES)</label>
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400">
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
                                    className="w-full bg-slate-50 dark:bg-[#161d24] border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-slate-900 dark:text-white font-mono placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-amber-500/50 outline-none"
                                />
                            </div>

                            {/* Settlement & Funding Method */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase tracking-widest">
                                    Settlement & Funding Method
                                </label>
                                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-[#161d24] p-1.5 rounded-xl border border-slate-200 dark:border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setFundingMode('post_match')}
                                        className={clsx(
                                            "py-2.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                                            fundingMode === 'post_match'
                                                ? "bg-amber-500 text-black font-black shadow-sm"
                                                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                        )}
                                    >
                                        <span className="block font-bold">⏳ Settle After Final Whistle</span>
                                        <span className="block text-[9px] font-normal opacity-80 mt-0.5">Pay after game finishes</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFundingMode('instant_escrow')}
                                        className={clsx(
                                            "py-2.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                                            fundingMode === 'instant_escrow'
                                                ? "bg-amber-500 text-black font-black shadow-sm"
                                                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                        )}
                                    >
                                        <span className="block font-bold">🔒 Wallet Escrow Hold</span>
                                        <span className="block text-[9px] font-normal opacity-80 mt-0.5">Deduct & lock stake now</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 font-medium">
                                    {fundingMode === 'post_match'
                                        ? 'Wager is active immediately with 0 upfront deduction. Loser pays winner pot after final whistle via wallet debit, M-Pesa prompt, or cash handoff.'
                                        : 'Stakes are held in wallet escrow immediately upon duel confirmation and auto-credited to the winner upon resolution.'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-gray-300 mb-1.5 uppercase tracking-widest">Pick Rival Manager</label>
                                <button
                                    type="button"
                                    onClick={() => setShowOpponentPicker(!showOpponentPicker)}
                                    className="w-full bg-slate-50 dark:bg-[#161d24] border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-left flex items-center justify-between text-slate-900 dark:text-white"
                                >
                                    <span className={selectedOpponent ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-400 dark:text-gray-500'}>
                                        {selectedOpponent 
                                            ? `${selectedOpponent.displayName}${getMemberTeamName(selectedOpponent) ? ` (${getMemberTeamName(selectedOpponent)})` : ''}` 
                                            : 'Select opponent from league...'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-slate-500 dark:text-gray-400" />
                                </button>
                                {showOpponentPicker && (
                                    <div className="mt-1 bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto shadow-2xl">
                                        <div className="p-2 border-b border-slate-200 dark:border-white/10 sticky top-0 bg-white dark:bg-[#161d24] z-10">
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    value={opponentSearch}
                                                    onChange={e => setOpponentSearch(e.target.value)}
                                                    placeholder="Search manager or team..."
                                                    className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none focus:border-amber-500"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        {filteredOpponentMembers.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-slate-500 dark:text-gray-400">No managers found</div>
                                        ) : (
                                            filteredOpponentMembers.map(m => {
                                                const mTeam = getMemberTeamName(m);
                                                return (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => { setOpponentId(m.id); setShowOpponentPicker(false); setOpponentSearch(''); }}
                                                        className="w-full text-left px-4 py-3 text-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between transition-colors border-b border-slate-100 dark:border-white/5 last:border-0"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <UserAvatar name={m.displayName} size="xs" />
                                                            <div>
                                                                <div className="font-bold text-xs">{m.displayName}</div>
                                                                {mTeam && <div className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">{mTeam}</div>}
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400">
                                                            KES {(m.walletBalance || 0).toLocaleString()}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
                            <button
                                type="button"
                                onClick={() => { setShowCreate(false); setBetTitle(''); setBetDescription(''); setBetStake(''); setOpponentId(''); }}
                                className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateBet}
                                disabled={isSubmitting || !betTitle || !opponentId || !betStake}
                                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20 cursor-pointer"
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
                        <div className="w-full max-w-sm bg-white dark:bg-[#0c1218] border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 shadow-2xl relative text-slate-900 dark:text-white">
                            {/* Uniform Modal Top-Right X */}
                            <button
                                type="button"
                                onClick={() => setResolvingBetId(null)}
                                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-all cursor-pointer"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-500 dark:text-amber-400">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-black mb-1 text-slate-900 dark:text-white">Resolve Wager</h3>
                            <p className="text-xs text-slate-600 dark:text-gray-400 mb-6 font-medium">
                                "{bet.title}" — KES {bet.stake.toLocaleString()} will be automatically transferred from the loser to the winner's wallet.
                            </p>
                            <div className="space-y-3 mb-6">
                                <button
                                    onClick={() => setResolveWinnerId(bet.challenger.id)}
                                    className={clsx(
                                        'w-full py-3 px-4 rounded-xl text-sm font-bold text-left border transition-all flex items-center justify-between',
                                        resolveWinnerId === bet.challenger.id
                                            ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-md'
                                            : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 bg-slate-50 dark:bg-transparent hover:bg-slate-100 dark:hover:bg-white/5'
                                    )}
                                >
                                    <span>🏆 {bet.challenger.name} wins</span>
                                    {resolveWinnerId === bet.challenger.id && <Check className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
                                </button>
                                <button
                                    onClick={() => setResolveWinnerId(bet.opponent.id)}
                                    className={clsx(
                                        'w-full py-3 px-4 rounded-xl text-sm font-bold text-left border transition-all flex items-center justify-between',
                                        resolveWinnerId === bet.opponent.id
                                            ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-md'
                                            : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 bg-slate-50 dark:bg-transparent hover:bg-slate-100 dark:hover:bg-white/5'
                                    )}
                                >
                                    <span>🏆 {bet.opponent.name} wins</span>
                                    {resolveWinnerId === bet.opponent.id && <Check className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setResolvingBetId(null)}
                                    className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleResolve(bet)}
                                    disabled={!resolveWinnerId}
                                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20 cursor-pointer"
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
    onWithdraw?: () => void;
    onChairmanCancel?: () => void;
    onRequestCancel?: () => void;
    onAgreeCancel?: () => void;
    onDeclineCancel?: () => void;
    onWithdrawCancelRequest?: () => void;
    onSmartVerify?: () => void;
    onNudgeChairman?: () => void;
    getStatusBadge: (bet: SideBet) => JSX.Element | undefined;
}

function BetCard({
    bet,
    currentUserId,
    isAdmin,
    onSign,
    onEndorse,
    onApprove,
    onReject,
    onResolveClick,
    onShareWin,
    onWithdraw,
    onChairmanCancel,
    onRequestCancel,
    onAgreeCancel,
    onDeclineCancel,
    onWithdrawCancelRequest,
    onSmartVerify,
    onNudgeChairman,
    getStatusBadge
}: BetCardProps) {
    const isChallenger = bet.challenger.id === currentUserId;
    const isOpponent = bet.opponent.id === currentUserId;
    const hasEndorsed = bet.endorsers.includes(currentUserId);
    const isParticipant = isChallenger || isOpponent;
    const isResolved = bet.status === 'resolved';
    const isCancelled = bet.status === 'cancelled';

    return (
        <div className={clsx(
            'fc-card rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between backdrop-blur-xl',
            isResolved ? 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#161d24]/60 text-slate-900 dark:text-white' :
            isCancelled ? 'border-red-500/20 bg-red-50/50 dark:bg-red-500/5 text-slate-900 dark:text-white' :
            bet.status === 'active' ? 'border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-white to-slate-50 dark:via-[#161d24] dark:to-[#0c1218] shadow-md dark:shadow-[0_0_25px_rgba(251,191,36,0.06)] text-slate-900 dark:text-white' :
            'border-slate-200 dark:border-white/10 bg-white dark:bg-[#161d24]/90 text-slate-900 dark:text-white'
        )}>
            <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <p className="fc-frosty-title font-black text-base leading-snug text-slate-900 dark:text-white">{bet.title}</p>
                        {bet.description && <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">{bet.description}</p>}
                    </div>
                    <div className="flex-shrink-0">{getStatusBadge(bet)}</div>
                </div>

                {/* Participants */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <div className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border',
                        bet.challenger.signed
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/5'
                    )}>
                        {bet.challenger.signed && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                        <span>{bet.challenger.name}</span>
                        {bet.challenger.signed && <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-normal">(Challenger)</span>}
                    </div>
                    <span className="text-slate-400 dark:text-gray-500 text-xs font-black">vs</span>
                    <div className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border',
                        bet.opponent.signed
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                    )}>
                        {bet.opponent.signed ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                        <span>{bet.opponent.name}</span>
                        {bet.opponent.signed ? (
                            <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-normal">(Signed)</span>
                        ) : (
                            <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80 font-normal">(Pending)</span>
                        )}
                    </div>
                </div>

                {/* Stake + Endorsers + Winner */}
                <div className="flex items-center justify-between mb-4 pt-3 border-t border-slate-200 dark:border-white/5 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-500 dark:text-gray-400">Pot:</span>
                        <span className="text-base font-black text-amber-600 dark:text-amber-400 tabular-nums">
                            KES {(bet.stake * 2).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500">({bet.stake.toLocaleString()} each)</span>
                        <span className={clsx(
                            "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ml-1",
                            bet.fundingMode === 'instant_escrow'
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        )}>
                            {bet.fundingMode === 'instant_escrow' ? '🔒 Wallet Escrow' : '⏳ Settle After Final Whistle'}
                        </span>
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

                {/* Settlement Mechanism Banner */}
                <div className="mb-4 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 text-[11px] text-slate-600 dark:text-gray-400 leading-relaxed">
                    {bet.fundingMode === 'instant_escrow' ? (
                        <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-emerald-600 dark:text-emerald-400 font-black">🔒 Wallet Escrow:</span>
                            <span>KES {bet.stake.toLocaleString()} is locked from each manager's wallet. Total KES {(bet.stake * 2).toLocaleString()} pot automatically credited to winner upon outcome.</span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-amber-600 dark:text-amber-400 font-black">⏳ Settle After Final Whistle:</span>
                            <span>No upfront lock. Winner claims KES {(bet.stake * 2).toLocaleString()} pot ({bet.stake.toLocaleString()} each) from loser via wallet debit, M-Pesa prompt, or cash handoff.</span>
                        </span>
                    )}
                </div>

                {/* Mutual Cancellation Banner */}
                {bet.cancelRequestedBy && bet.cancelRequestedBy !== currentUserId && !isCancelled && !isResolved && (
                    <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-col gap-2">
                        <p className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                            <span>⚠️</span>
                            <span><strong>{bet.cancelRequestedByName || 'Opponent'}</strong> requested to cancel this wager.</span>
                        </p>
                        <p className="text-[10px] text-gray-400">
                            Side bets cannot be edited. Both players must agree to cancel this wager.
                        </p>
                        <div className="flex gap-2">
                            {onAgreeCancel && (
                                <button
                                    type="button"
                                    onClick={onAgreeCancel}
                                    className="flex-1 py-2 px-3 rounded-lg bg-rose-500 hover:bg-rose-400 text-black text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    Agree & Cancel Bet
                                </button>
                            )}
                            {onDeclineCancel && (
                                <button
                                    type="button"
                                    onClick={onDeclineCancel}
                                    className="py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-gray-300 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    Decline
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {bet.cancelRequestedBy === currentUserId && !isCancelled && !isResolved && (
                    <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2 text-xs">
                        <span className="text-amber-300 font-medium flex items-center gap-1.5 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                            Waiting for opponent to agree to cancel...
                        </span>
                        {onWithdrawCancelRequest && (
                            <button
                                type="button"
                                onClick={onWithdrawCancelRequest}
                                className="text-[10px] font-bold text-gray-400 hover:text-white underline cursor-pointer"
                            >
                                Withdraw
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                {/* Opponent needs to sign */}
                {isOpponent && bet.status === 'pending_opponent' && !bet.opponent.signed && (
                    <button
                        onClick={onSign}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-emerald-500/20"
                    >
                        <Check className="w-3.5 h-3.5" /> Accept & Stake KES {bet.stake.toLocaleString()}
                    </button>
                )}

                {/* Challenger can withdraw challenge before opponent signs */}
                {isChallenger && bet.status === 'pending_opponent' && onWithdraw && (
                    <button
                        type="button"
                        onClick={onWithdraw}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-gray-400 hover:text-rose-300 text-xs font-bold transition-all active:scale-95"
                    >
                        <X className="w-3.5 h-3.5" /> Withdraw Challenge
                    </button>
                )}

                {/* Mutual cancellation request for active or pending_chairman bets */}
                {isParticipant && (bet.status === 'active' || bet.status === 'pending_chairman') && !bet.cancelRequestedBy && onRequestCancel && (
                    <button
                        type="button"
                        onClick={onRequestCancel}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/25 text-gray-400 hover:text-rose-300 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" /> Cancel Wager
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

                {/* Smart Outcome Auto-Verification & Autonomous Resolution */}
                {bet.status === 'active' && onSmartVerify && (
                    <button
                        type="button"
                        onClick={onSmartVerify}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-xs"
                        title="Check live FPL stats and auto-resolve without waiting for manual intervention"
                    >
                        <Bot className="w-3.5 h-3.5 text-indigo-500" /> Auto-Verify Outcome
                    </button>
                )}

                {/* Nudge Chairman to Resolve */}
                {isParticipant && bet.status === 'active' && onNudgeChairman && (
                    <button
                        type="button"
                        onClick={onNudgeChairman}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                        title="Nudge Chairman to review and confirm this wager"
                    >
                        <Bell className="w-3.5 h-3.5 text-amber-500" /> Nudge Chairman
                    </button>
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

                {/* Chairman direct cancel override for any active/pending bet */}
                {isAdmin && bet.status !== 'resolved' && bet.status !== 'cancelled' && onChairmanCancel && (
                    <button
                        type="button"
                        onClick={onChairmanCancel}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 text-xs font-bold transition-all active:scale-95 ml-auto"
                        title="Chairman override: cancel and void bet"
                    >
                        <AlertTriangle className="w-3.5 h-3.5" /> Cancel (Chairman)
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

                {/* Cancelled badge details */}
                {isCancelled && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-400/90 font-medium py-1">
                        <span>❌ {bet.cancellationReason || 'Wager Cancelled'}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
