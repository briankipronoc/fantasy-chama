import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptText, History, Download, Wallet, TrendingUp, Clock3, Trophy, Crown, AlertTriangle, Check, MessageCircle, Search, X, AlertCircle, Trash2, Users, Lock, BarChart3 } from 'lucide-react';
import UserAvatar from '../components/UserAvatar';
import { useStore } from '../store/useStore';
import { getApiBaseUrl } from '../utils/api';
import { collection, onSnapshot, query, orderBy, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, where, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import clsx from 'clsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Header from '../components/Header';
import SeasonCeremonyModal from '../components/SeasonCeremonyModal';
import ChampionFlexCardModal from '../components/ChampionFlexCardModal';
import AnimatedKes from '../components/AnimatedKes';
import { calculateMpesaSendFee } from '../utils/mpesaFees';
import toast from 'react-hot-toast';

const fetchFplStandings = async (leagueId: number) => {
    const cacheKey = `fpl_standings_${leagueId}`;
    const cached = localStorage.getItem(cacheKey);
    let cachedData: any[] | null = null;
    if (cached) {
        try {
            const { timestamp, data } = JSON.parse(cached);
            if (Array.isArray(data) && data.length > 0) {
                cachedData = data;
                if (Date.now() - timestamp < 300000) {
                    return data;
                }
            }
        } catch {
            cachedData = null;
        }
    }
    const endpoints = [
        `/fpl-api/leagues-classic/${leagueId}/standings/`
    ];

    let lastError = 'Could not connect to FPL servers.';
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint);
            if (!response.ok) {
                lastError = `FPL API returned ${response.status}.`;
                continue;
            }

            const data = await response.json();
            if (data?.standings?.results) {
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data.standings.results }));
                return data.standings.results;
            }
            lastError = 'FPL response format was unexpected.';
        } catch (err: any) {
            lastError = err?.message || 'Could not connect to FPL servers.';
        }
    }

    if (cachedData && cachedData.length > 0) {
        return cachedData;
    }

    throw new Error(lastError);
};

export default function Finances() {
    const navigate = useNavigate();
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const memberPhone = localStorage.getItem('memberPhone');
    const activeUserId = localStorage.getItem('activeUserId');
    const { members: rawMembers, listenToLeagueMembers, isStealthMode, role, league: leagueSettings } = useStore();

    const members = useMemo(() => {
        const seen = new Set<string>();
        return (rawMembers || []).filter((m: any) => {
            const key = m.phone ? `phone:${m.phone}` : (m.authUid ? `auth:${m.authUid}` : `id:${m.id}`);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [rawMembers]);

    const [transactions, setTransactions] = useState<any[]>([]);
    const [gameweekStake, setMonthlyContribution] = useState(0);
    const [rules, setRules] = useState<any>({ weekly: 70, vault: 30, seasonWinnersCount: 3, seasonWinnersMode: 'top3', seasonDistribution: [50, 30, 20] });
    const [leagueName, setLeagueName] = useState('League');
    const [showVaultChart, setShowVaultChart] = useState(false);
    const [showSeasonCeremony, setShowSeasonCeremony] = useState(false);
    const [selectedPayoutForFlex, setSelectedPayoutForFlex] = useState<any>(null);
    // @ts-ignore
    const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
    // @ts-ignore
const [isApprovingPayoutId, setIsApprovingPayoutId] = useState<string | null>(null);
    // @ts-ignore
const [isRejectingPayoutId, setIsRejectingPayoutId] = useState<string | null>(null);
    // @ts-ignore
const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [projectedCardIndex, setProjectedCardIndex] = useState(0);
    const [seasonCardTab, setSeasonCardTab] = useState<'projected' | 'collected'>('projected');
    const [fundingAuditFilter, setFundingAuditFilter] = useState<'all' | 'skipped' | 'funded' | 'spectators'>('all');
    const [isAuditExpanded, setIsAuditExpanded] = useState<boolean>(false);
    const [pendingWalletTopUpRequests, setPendingWalletTopUpRequests] = useState<any[]>([]);
    const [cashTopUpAmount, setCashTopUpAmount] = useState('');
    const [cashTopUpNote, setCashTopUpNote] = useState('');
    const [isSubmittingCashTopUpRequest, setIsSubmittingCashTopUpRequest] = useState(false);
    // @ts-ignore
    const [isResolvingWalletRequestId, setIsResolvingWalletRequestId] = useState<string | null>(null);
    const [standingsData, setStandingsData] = useState<any[]>([]);
    const [seasonFilter, setSeasonFilter] = useState<'current' | 'all'>('current');
    const [currentGwNumber, setCurrentGwNumber] = useState<number | null>(null);
    const [isCurrentEventFinished, setIsCurrentEventFinished] = useState<boolean>(false);
    const [leagueCreatedAtMs, setLeagueCreatedAtMs] = useState<number | null>(null);
    const [startGw, setStartGw] = useState<number>(1);
    const [lastResetAtMs, setLastResetAtMs] = useState<number | null>(null);
    const [chartHostWidth, setChartHostWidth] = useState(0);
    const chartHostRef = useRef<HTMLDivElement | null>(null);
    const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
    const [ledgerModalSearch, setLedgerModalSearch] = useState('');
    const [ledgerModalFilter, setLedgerModalFilter] = useState<'all' | 'deposits' | 'payouts' | 'reversals'>('all');
    const [personalCardTab, setPersonalCardTab] = useState<'due' | 'loaded'>('due');
    const [nextEventDeadline, setNextEventDeadline] = useState<string | null>(null);
    const [vaultPodiumView, setVaultPodiumView] = useState<'accrued' | 'projected'>('accrued');
    const [showMpesaTopUpModal, setShowMpesaTopUpModal] = useState(false);
    const [topUpCustomAmount, setTopUpCustomAmount] = useState('');
    const [copiedPochiPhone, setCopiedPochiPhone] = useState(false);
    const [isPushingTopUpMpesa, setIsPushingTopUpMpesa] = useState(false);
    const [txToDelete, setTxToDelete] = useState<any | null>(null);
    const [isDeletingTx, setIsDeletingTx] = useState(false);
    const [showPlayerBreakdown, setShowPlayerBreakdown] = useState(false);
    const [showPayoutsModal, setShowPayoutsModal] = useState(false);
    const [payoutsFilter, setPayoutsFilter] = useState<'all' | 'weekly' | 'season'>('all');

    useEffect(() => {
        setActionMessage({ type: 'success', text: `✓ Active API: ${getApiBaseUrl()}` });
        setTimeout(() => setActionMessage(null), 5000);
    }, []);

    useEffect(() => {
        if (!activeLeagueId) {
            setStandingsData([]);
            return;
        }

        let cancelled = false;

        const loadStandings = async () => {
            try {
                let targetFplId: number | null = null;
                const leagueSnap = await getDoc(doc(db, 'leagues', activeLeagueId));
                if (leagueSnap.exists()) {
                    const data = leagueSnap.data();
                    if (data?.fplLeagueId) {
                        targetFplId = Number(data.fplLeagueId);
                    }
                }

                try {
                    const bootstrapRes = await fetch(`/fpl-api/bootstrap-static/`);
                    if (bootstrapRes.ok) {
                        const bootstrapData = await bootstrapRes.json();
                        const events: any[] = bootstrapData?.events || [];
                        const currentEvent = events.find((e: any) => e.is_current);
                        const previousEvent = events.find((e: any) => e.is_previous) || [...events].filter((e: any) => e.finished).pop();
                        const nextEvent = events.find((e: any) => e.is_next) || (currentEvent && !currentEvent.finished ? currentEvent : events.find((e: any) => !e.finished));
                        if (!cancelled && nextEvent?.deadline_time) {
                            setNextEventDeadline(nextEvent.deadline_time);
                        }
                        // Use current if it has started; fall back to previous finished GW so the
                        // funding audit never counts a gameweek that hasn't kicked off yet.
                        const isCurrentStarted = currentEvent?.deadline_time
                            ? Date.now() >= new Date(currentEvent.deadline_time).getTime()
                            : false;
                        const effectiveEvent = (isCurrentStarted && currentEvent) ? currentEvent : (previousEvent || currentEvent);
                        if (!cancelled && effectiveEvent) {
                            setCurrentGwNumber(Number(effectiveEvent.id || 0) || null);
                            setIsCurrentEventFinished(Boolean(effectiveEvent.finished));
                        }
                    }
                } catch (bootstrapErr: any) {
                    console.warn('[finances] bootstrap current GW fetch failed:', bootstrapErr?.message || bootstrapErr);
                }

                if (targetFplId) {
                    const results = await fetchFplStandings(targetFplId);
                    if (!cancelled) setStandingsData(results || []);
                } else {
                    if (!cancelled) setStandingsData([]);
                }
            } catch (err: any) {
                console.warn('[finances] standings preview failed:', err?.message || err);
                if (!cancelled) setStandingsData([]);
            }
        };

        loadStandings();

        return () => {
            cancelled = true;
        };
    }, [activeLeagueId]);

    const txDate = (tx: any) => {
        const raw = tx?.timestamp;
        if (raw?.toDate) return raw.toDate() as Date;
        if (raw instanceof Date) return raw;
        if (typeof raw === 'number') return new Date(raw);
        return null;
    };

    useEffect(() => {
        let unsubscribeMembers = () => { };
        if (activeLeagueId && members.length === 0) {
            unsubscribeMembers = listenToLeagueMembers(activeLeagueId);
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
            }, (err) => {
                console.warn('[finances] transaction listener failed:', err?.message || err);
            });

            const leagueRef = doc(db, 'leagues', activeLeagueId);
            const unsubscribeLeague = onSnapshot(leagueRef, (docSnap: any) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMonthlyContribution(data.gameweekStake || 0);
                    if (data.rules) setRules(data.rules);
                    setLeagueName(data.name || data.leagueName || 'League');
                    if (data.startGw) setStartGw(Number(data.startGw));
                    const resetAt = data?.lastResetAt;
                    if (resetAt?.toDate) {
                        setLastResetAtMs(resetAt.toDate().getTime());
                    } else if (typeof resetAt === 'number') {
                        setLastResetAtMs(resetAt);
                    }
                    const createdAt = data?.createdAt;
                    if (createdAt?.toDate) {
                        setLeagueCreatedAtMs(createdAt.toDate().getTime());
                    }
                }
            }, (err) => {
                console.warn('[finances] league listener failed:', err?.message || err);
            });

            return () => {
                try { unsubscribeTx(); } catch (err) {
                    console.warn('[finances] tx listener cleanup failed:', err);
                }
                try { unsubscribeLeague(); } catch (err) {
                    console.warn('[finances] league listener cleanup failed:', err);
                }
                try { unsubscribeMembers(); } catch (err) {
                    console.warn('[finances] members listener cleanup failed:', err);
                }
            };
        }

        return () => {
            try { unsubscribeMembers(); } catch (err) {
                console.warn('[finances] members listener cleanup failed:', err);
            }
        };
    }, [activeLeagueId, listenToLeagueMembers, rawMembers?.length]);

    useEffect(() => {
        const raf = window.requestAnimationFrame(() => setShowVaultChart(true));
        return () => window.cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        const node = chartHostRef.current;
        if (!node) return;

        const update = () => {
            setChartHostWidth(Math.max(0, node.getBoundingClientRect().width || 0));
        };

        update();
        const observer = new ResizeObserver(() => update());
        observer.observe(node);

        return () => observer.disconnect();
    }, []);



    useEffect(() => {
        if (!activeLeagueId) {
            setPendingApprovals([]);
            return;
        }

        const pendingRef = collection(db, 'leagues', activeLeagueId, 'pending_payouts');
        const pendingQuery = query(pendingRef, where('status', 'in', ['awaiting_approval', 'forfeited', 'approved', 'settled']));
        const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
            const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
            setPendingApprovals(items);
        }, (err) => {
            console.warn('[finances] pending payouts listener failed:', err?.message || err);
            setPendingApprovals([]);
        });

        return () => {
            try { unsubscribePending(); } catch (err) {
                console.warn('[finances] pending payouts listener cleanup failed:', err);
            }
        };
    }, [activeLeagueId]);

    useEffect(() => {
        if (!activeLeagueId) {
            setPendingWalletTopUpRequests([]);
            return;
        }

        const requestsRef = collection(db, 'leagues', activeLeagueId, 'wallet_topup_requests');
        const requestsQuery = role === 'admin'
            ? query(requestsRef, where('status', '==', 'pending'))
            : query(requestsRef, where('memberId', '==', activeUserId || '__NO_MEMBER__'));
        const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
            const items = snapshot.docs
                .map((item) => ({ id: item.id, ...item.data() }))
                .filter((item: any) => item.status === 'pending')
                .sort((a: any, b: any) => {
                    const aTs = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                    const bTs = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                    return bTs - aTs;
                });
            if (role === 'admin') {
                setPendingWalletTopUpRequests(items);
                return;
            }
            const own = items.filter((item: any) => item.memberId === activeUserId || item.phone === memberPhone);
            setPendingWalletTopUpRequests(own);
        }, (err) => {
            console.warn('[finances] wallet top-up request listener failed:', err?.message || err);
            setPendingWalletTopUpRequests([]);
        });

        return () => {
            try { unsubscribeRequests(); } catch (err) {
                console.warn('[finances] wallet top-up request listener cleanup failed:', err);
            }
        };
    }, [activeLeagueId, role, activeUserId, memberPhone]);

    const contributionTypes = new Set(['deposit', 'payment', 'contribution', 'wallet_funding', 'wallet_prefund', 'manual_deposit', 'ledger_adjustment']);
    const isTxValidInflow = (tx: any) => {
        const type = String(tx.type || '').toLowerCase();
        const status = String(tx.status || '').toLowerCase();
        const source = String(tx.source || '').toLowerCase();
        const note = String(tx.note || '').toLowerCase();
        const category = String(tx.category || '').toLowerCase();

        if (tx.isReversed === true || tx.reversed === true) return false;
        if (status === 'reversed' || status === 'failed' || status === 'cancelled' || status === 'voided' || status === 'refunded' || status === 'refund') return false;
        if (source === 'manual_reversal' || source.includes('revers')) return false;
        if (type === 'refund' || type === 'reversal' || type.includes('revers')) return false;
        if (category === 'refund' || category.includes('revers')) return false;
        if (note.includes('reversal') || note.includes('reversed')) return false;
        if (Number(tx.amount || 0) <= 0) return false;

        const isContributionType = contributionTypes.has(type) || type === 'deposit' || type === 'payment' || type === 'contribution' || type === 'wallet_funding' || type === 'wallet_prefund' || type === 'manual_deposit' || (type === 'ledger_adjustment' && Number(tx.amount || 0) > 0);
        return isContributionType;
    };
    const isTxRefundOrReversal = (tx: any) => {
        const type = String(tx.type || '').toLowerCase();
        const status = String(tx.status || '').toLowerCase();
        const source = String(tx.source || '').toLowerCase();
        const note = String(tx.note || '').toLowerCase();
        const category = String(tx.category || '').toLowerCase();

        return (
            type === 'refund' ||
            type === 'reversal' ||
            type.includes('revers') ||
            source === 'manual_reversal' ||
            source.includes('revers') ||
            category === 'refund' ||
            category.includes('revers') ||
            status === 'refund' ||
            status === 'refunded' ||
            status === 'reversed' ||
            tx.isReversed === true ||
            tx.reversed === true ||
            note.includes('reversal') ||
            note.includes('reversed') ||
            (type === 'ledger_adjustment' && (source === 'manual_reversal' || Number(tx.amount || 0) < 0)) ||
            Number(tx.amount || 0) < 0
        );
    };

    const rawStart = Number((leagueSettings as any)?.startGw || startGw || 1);
    const leagueStartGw = Math.max(1, rawStart || 1);

    const forfeitedGws: number[] = useMemo(() => {
        const fromSettings = (leagueSettings as any)?.forfeitedGws || [];
        const fromPayouts = (pendingApprovals || [])
            .filter((p: any) => p.status === 'forfeited')
            .map((p: any) => Number(p.gw));
        return Array.from(new Set([...fromSettings, ...fromPayouts])).map(Number);
    }, [leagueSettings, pendingApprovals]);

    const isMemberFunded = (m: any) => {
        if (!m || m.isActive === false || (m as any).isEliminated || (m as any).isPending) return false;
        if ((m as any).playMode === 'sidebets_only') return false;

        const isMatchedMember = (tx: any) =>
            (m.id && (tx.memberId === m.id || tx.userId === m.id)) ||
            (m.phone && (tx.phoneNumber === m.phone || tx.phone === m.phone)) ||
            (m.displayName && (tx.memberName === m.displayName || tx.playerName === m.displayName));

        const refundTotal = (transactions || []).filter((tx: any) => {
            if (!isMatchedMember(tx)) return false;
            return isTxRefundOrReversal(tx);
        }).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount || 0)), 0);

        const memberInflows = (transactions || []).filter((tx: any) => {
            if (!isTxValidInflow(tx)) return false;
            return isMatchedMember(tx);
        }).reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);

        const netDeposited = Math.max(0, memberInflows - refundTotal);
        if (refundTotal > 0 && netDeposited < (gameweekStake || 0)) {
            return false;
        }

        const currentGw = Number(currentGwNumber || leagueStartGw || 1);
        const playableGws: number[] = [];
        for (let g = leagueStartGw; g <= currentGw; g++) {
            if (!forfeitedGws.includes(g)) playableGws.push(g);
        }
        const totalRounds = Math.max(1, playableGws.length);
        const pastCompletedCount = Math.max(0, totalRounds - 1);
        const pastConsumedStake = pastCompletedCount * (gameweekStake || 0);
        const unspentCredit = Math.max(0, netDeposited - pastConsumedStake);

        return Boolean(
            (gameweekStake || 0) === 0 ||
            (unspentCredit >= (gameweekStake || 0)) ||
            (Number((m as any).walletBalance || 0) >= (gameweekStake || 0)) ||
            (netDeposited >= totalRounds * (gameweekStake || 0)) ||
            (transactions || []).some((tx: any) => isTxValidInflow(tx) && isMatchedMember(tx) && Number(tx.gw || tx.gameweek || 0) === currentGw) ||
            (Number((m as any).lastPaymentGw) === currentGw && Boolean(m.hasPaid)) ||
            Boolean(m.hasPaid)
        );
    };

    const paidMembers = members.filter(isMemberFunded);
    const totalSecured = paidMembers.length * (gameweekStake || 0);
    
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    
    const toJoinedGw = (joinedMs?: number | null) => {
        if (!leagueCreatedAtMs || !joinedMs) return leagueStartGw;
        const weeksSinceStart = Math.max(0, Math.floor((joinedMs - leagueCreatedAtMs) / WEEK_MS));
        return Math.min(38, leagueStartGw + weeksSinceStart);
    };

    const activeMembers = members.filter((member) => member.isActive !== false && !(member as any).isEliminated && !(member as any).isPending);
    const activeMembersCount = activeMembers.length;
    const configuredWinnersCount = Number(rules.seasonWinnersCount || 3);
    const eligibleWinnersCount = Math.min(configuredWinnersCount, activeMembersCount || configuredWinnersCount);
    const seasonWinnersMode = String(rules.seasonWinnersMode || (configuredWinnersCount === 1 ? 'top1' : configuredWinnersCount === 5 ? 'top5' : 'top3'));

    const contributionByMemberId = transactions
        .reduce((acc: Record<string, number>, tx: any) => {
            const isCredit = isTxValidInflow(tx);
            const isDebit = isTxRefundOrReversal(tx);
            if (!isCredit && !isDebit) return acc;

            const delta = isCredit ? Number(tx.amount || 0) : -Math.abs(Number(tx.amount || 0));

            const txMemberId = String(tx.userId || tx.memberId || '');
            if (txMemberId) {
                acc[txMemberId] = Math.max(0, (acc[txMemberId] || 0) + delta);
                return acc;
            }

            const phone = String(tx.phoneNumber || tx.winnerPhone || '');
            if (phone) {
                const matched = members.find((member) => String(member.phone || '') === phone);
                if (matched?.id) {
                    const key = String(matched.id);
                    acc[key] = Math.max(0, (acc[key] || 0) + delta);
                    return acc;
                }
            }

            const name = String(tx.memberName || tx.winnerName || '');
            if (name) {
                const matched = members.find((member) => String(member.displayName || '') === name);
                if (matched?.id) {
                    const key = String(matched.id);
                    acc[key] = Math.max(0, (acc[key] || 0) + delta);
                    return acc;
                }
            }
            return acc;
        }, {});

    const grossInflows = transactions
        .filter(isTxValidInflow)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const totalRefundsAllTime = transactions
        .filter(isTxRefundOrReversal)
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

    const effectiveLeagueStartGw = leagueStartGw;
    // Count active and completed playable rounds to date (includes current active round and past completed rounds)
    const playedCompletedGws = useMemo(() => {
        if (!currentGwNumber || currentGwNumber < effectiveLeagueStartGw) return [];
        const maxTrackedGw = Math.max(effectiveLeagueStartGw, Number(currentGwNumber || effectiveLeagueStartGw));
        const list: number[] = [];
        for (let g = effectiveLeagueStartGw; g <= maxTrackedGw; g++) {
            if (!forfeitedGws.includes(g)) {
                list.push(g);
            }
        }
        return list;
    }, [currentGwNumber, effectiveLeagueStartGw, forfeitedGws]);

    const completedGwsCount = playedCompletedGws.length;

    const cappedMemberContributionsSum = activeMembers.reduce((sum, member: any) => {
        const netContributed = Number(contributionByMemberId[String(member.id)] || 0);
        const memberMaxForCompleted = completedGwsCount > 0 ? completedGwsCount * (gameweekStake || 0) : 0;
        const memberActualForCompleted = Math.min(memberMaxForCompleted, Math.max(0, netContributed));
        return sum + memberActualForCompleted;
    }, 0);

    const vaultPercent = Number(rules.vault ?? 30);
    // Strict ledger verification: Realized pot includes verified member contributions for tracked rounds
    const seasonCollectedSoFarGross = completedGwsCount > 0
        ? cappedMemberContributionsSum
        : Math.max(0, grossInflows - totalRefundsAllTime);
    const seasonVaultCollectedSoFar = Math.round(seasonCollectedSoFarGross * (vaultPercent / 100));

    const projectedRemainingCollectionsGross = members
        .filter((member) => member.isActive !== false && !(member as any).isEliminated && !(member as any).isPending)
        .reduce((sum, member: any) => {
            const joinedMs = member?.joinedAt?.toDate ? member.joinedAt.toDate().getTime() : leagueCreatedAtMs;
            const joinedGw = toJoinedGw(joinedMs);
            const effectiveMemberGw = Math.max(leagueStartGw, joinedGw);
            const playableFutureGws = Math.max(0, (38 - effectiveMemberGw + 1) - forfeitedGws.filter(g => g >= effectiveMemberGw).length);
            const memberSeasonCap = playableFutureGws * (gameweekStake || 0);
            const collectedForMember = Number(contributionByMemberId[String(member.id)] || 0);
            const remainingForMember = Math.max(0, memberSeasonCap - collectedForMember);
            return sum + remainingForMember;
        }, 0);
    const projectedSeasonCollectionsGross = Math.max(0, seasonCollectedSoFarGross + projectedRemainingCollectionsGross);
    const projectedSeasonVault = projectedSeasonCollectionsGross * (rules.vault / 100);

    const getSeasonVaultPercentages = (winnerCount: number) => {
        if (winnerCount === 1) return [100];
        if (winnerCount === 2) return [65, 35];
        if (winnerCount === 3) return [50, 30, 20];
        if (winnerCount === 4) return [40, 30, 20, 10];
        if (winnerCount === 5) return [35, 25, 20, 12, 8];
        if (winnerCount === 6) return [30, 22, 16, 12, 10, 10];
        if (winnerCount === 7) return [28, 20, 15, 12, 10, 8, 7];
        if (winnerCount === 8) return [25, 18, 14, 12, 10, 8, 7, 6];
        if (winnerCount === 9) return [24, 18, 13, 11, 10, 8, 6, 5, 5];
        if (winnerCount === 10) return [22, 17, 13, 11, 10, 8, 7, 5, 4, 3];
        const base = Math.floor(100 / winnerCount);
        const remainder = 100 - base * winnerCount;
        return Array.from({ length: winnerCount }, (_, idx) => base + (idx === 0 ? remainder : 0));
    };

    const normalizeToHundred = (ratios: number[], count: number) => {
        const sliced = ratios.slice(0, count).map((value) => Math.max(0, Number(value || 0)));
        const sum = sliced.reduce((acc, value) => acc + value, 0);
        if (sum <= 0) return getSeasonVaultPercentages(count);
        const scaled = sliced.map((value) => (value / sum) * 100);
        const rounded = scaled.map((value) => Math.floor(value));
        const roundedSum = rounded.reduce((acc, value) => acc + value, 0);
        rounded[0] += 100 - roundedSum;
        return rounded;
    };

    const configuredDistribution = Array.isArray(rules.seasonDistribution) && rules.seasonDistribution.length > 0
        ? rules.seasonDistribution.map((value: any) => Number(value || 0)).filter((value: number) => Number.isFinite(value) && value >= 0)
        : getSeasonVaultPercentages(configuredWinnersCount);
    const seasonVaultBasePercentages = configuredDistribution.length > 0
        ? configuredDistribution
        : getSeasonVaultPercentages(configuredWinnersCount);
    const seasonVaultPercentages = normalizeToHundred(seasonVaultBasePercentages, eligibleWinnersCount);
    const seasonVaultPreviewRaw = seasonVaultPercentages
        .map((percentage: number, index: number) => {
            const place = index + 1;
            return {
                place,
                percentage,
                amount: Math.round(projectedSeasonVault * (percentage / 100)),
            };
        });
    const previewTotal = seasonVaultPreviewRaw.reduce((acc, tier) => acc + tier.amount, 0);
    const seasonVaultPreview = seasonVaultPreviewRaw.map((tier, idx) => (
        idx === 0 ? { ...tier, amount: Math.max(0, tier.amount + (Math.round(projectedSeasonVault) - previewTotal)) } : tier
    ));
    const totalPreviewPayout = seasonVaultPreview.reduce((acc, tier) => acc + tier.amount, 0);
    const isPreviewCapped = activeMembersCount < configuredWinnersCount;
    // const topSeasonLeader = standingsData[0] || null;
    const modeLabel = seasonWinnersMode === 'custom'
        ? `Custom Top ${configuredWinnersCount}`
        : seasonWinnersMode === 'top1'
            ? 'Top 1'
            : seasonWinnersMode === 'top5'
                ? 'Top 5'
                : configuredWinnersCount > 3
                    ? `Top ${configuredWinnersCount}`
                    : 'Top 3';

    const tiedSeasonVaultPreview = useMemo(() => {
        const activeContenders = activeMembers.filter(m => (m as any).playMode !== 'sidebets_only' && (m as any).isEliminated !== true);
        const activeStandings = standingsData.filter((entry) => {
            return activeContenders.some((m) =>
                (m.fplTeamId && Number(m.fplTeamId) === Number(entry.entry)) ||
                (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(entry.entry)) ||
                (m.displayName || '').trim().toLowerCase() === (entry.player_name || '').trim().toLowerCase() ||
                (m.teamName || '').trim().toLowerCase() === (entry.entry_name || '').trim().toLowerCase()
            );
        });
        const poolSource = activeStandings.length > 0 ? activeStandings : standingsData;
        const dedupedStandings = poolSource.filter((entry, idx, arr) => 
            arr.findIndex(e => (e.entry && e.entry === entry.entry) || ((e.player_name || '').trim().toLowerCase() === (entry.player_name || '').trim().toLowerCase())) === idx
        );
        const cleanStandings = (dedupedStandings.length > 0 
            ? dedupedStandings 
            : activeContenders.map(m => ({ entry: m.fplTeamId || 0, player_name: m.displayName || 'Manager', entry_name: m.teamName || 'FPL Squad', total: 0 }))
        ).sort((a: any, b: any) => Number(b.total || 0) - Number(a.total || 0));

        const liveVaultTotal = Math.max(0, Number(seasonVaultCollectedSoFar || 0));
        const totalVault = Math.round(projectedSeasonVault || 0);
        const tiers = seasonVaultPreview || [];

        // Group players by score to detect ties
        const groups: Array<{ score: number; players: any[]; startIndex: number }> = [];
        let curIdx = 0;
        while (curIdx < cleanStandings.length && curIdx < tiers.length) {
            const score = Number(cleanStandings[curIdx].total || 0);
            const matching = cleanStandings.filter((p: any) => Number(p.total || 0) === score);
            groups.push({ score, players: matching, startIndex: curIdx });
            curIdx += matching.length;
        }

        const result: Array<{
            tierIndex: number;
            rank: number;
            isTied: boolean;
            percentage: number;
            amount: number;
            accruedAmount: number;
            projectedAmount: number;
            player_name: string;
            entry_name: string;
            originalPlace: number;
            tiedRangeText?: string;
        }> = [];

        for (const grp of groups) {
            const rank = grp.startIndex + 1;
            const isTied = grp.players.length > 1;

            // Calculate pooled percentage across the tiers occupied by this tied group
            let pooledPercent = 0;
            const endPos = Math.min(tiers.length, grp.startIndex + grp.players.length);
            for (let pos = grp.startIndex; pos < endPos; pos++) {
                pooledPercent += Number(tiers[pos]?.percentage || 0);
            }
            const splitPercent = grp.players.length > 0 ? (pooledPercent / grp.players.length) : 0;
            const splitAccrued = Math.round(liveVaultTotal * (splitPercent / 100));
            const splitProjected = Math.round(totalVault * (splitPercent / 100));
            const roundedPercent = Math.round(splitPercent * 10) / 10;
            const tiedRangeText = isTied ? `Split from Tiers ${grp.startIndex + 1}–${endPos}` : undefined;

            for (let i = 0; i < grp.players.length; i++) {
                if (result.length < tiers.length) {
                    const p = grp.players[i];
                    result.push({
                        tierIndex: result.length,
                        rank,
                        isTied,
                        percentage: roundedPercent,
                        amount: splitAccrued,
                        accruedAmount: splitAccrued,
                        projectedAmount: splitProjected,
                        player_name: p?.player_name || `Manager #${rank}`,
                        entry_name: p?.entry_name || 'FPL Squad',
                        originalPlace: result.length + 1,
                        tiedRangeText,
                    });
                }
            }
        }

        // If fewer players than tiers, fill remaining tiers with baseline tier slot
        if (result.length < tiers.length) {
            for (let pos = result.length; pos < tiers.length; pos++) {
                const tier = tiers[pos];
                const slotPercent = Number(tier?.percentage || 0);
                result.push({
                    tierIndex: pos,
                    rank: tier.place,
                    isTied: false,
                    percentage: slotPercent,
                    amount: Math.round(liveVaultTotal * (slotPercent / 100)),
                    accruedAmount: Math.round(liveVaultTotal * (slotPercent / 100)),
                    projectedAmount: Math.round(totalVault * (slotPercent / 100)),
                    player_name: 'Awaiting Contender',
                    entry_name: 'Tier Slot',
                    originalPlace: tier.place,
                });
            }
        }

        return result;
    }, [standingsData, activeMembers, totalPreviewPayout, projectedSeasonVault, seasonVaultPreview]);

    const currentUser = members.find(m => m.id === activeUserId) || members.find(m => m.phone === memberPhone);
    const isAdmin = role === 'admin';
    const nowMs = Date.now();
    const projectedWeeklyPayout = totalSecured * (Number(rules.weekly || 0) / 100);
    const projectedWeeklyPayoutFormula = `${paidMembers.length} × KES ${Number(gameweekStake || 0).toLocaleString()} × ${Number(rules.weekly || 0).toFixed(0)}% = KES ${Number(projectedWeeklyPayout || 0).toLocaleString()}`;
    const projectedSeasonCollections = projectedSeasonVault;
    const projectedSeasonCollectionsFormula = `(Collected KES ${Number(seasonCollectedSoFarGross || 0).toLocaleString()} + Join-aware remaining KES ${Number(projectedRemainingCollectionsGross || 0).toLocaleString()}) × ${Number(rules.vault || 0).toFixed(0)}% = KES ${Number(projectedSeasonCollections || 0).toLocaleString()}`;
    const toMillis = (value: any): number | null => {
        if (!value) return null;
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const parsed = Date.parse(String(value));
        return Number.isNaN(parsed) ? null : parsed;
    };

    const payoutTransactions = useMemo(() => {
        return transactions.filter((t) => {
            if (t.type !== 'payout') return false;
            // Filter out payouts from prior season cycles before clean slate / reset
            if (lastResetAtMs) {
                const txTime = toMillis(t.timestamp);
                if (txTime && txTime < lastResetAtMs) return false;
            }
            // Filter out test payouts logged before official start gameweek
            const txGw = Number(t.gw || t.gameweek);
            if (Number.isFinite(txGw) && txGw < leagueStartGw) return false;
            return true;
        });
    }, [transactions, lastResetAtMs, leagueStartGw]);

    const weeklyPayoutsList = useMemo(() => {
        return payoutTransactions.filter(t => {
            const desc = (t.description || '').toLowerCase();
            return t.subtype !== 'season' && !desc.includes('season') && !desc.includes('podium') && !desc.includes('championship');
        });
    }, [payoutTransactions]);

    const seasonPayoutsList = useMemo(() => {
        return payoutTransactions.filter(t => {
            const desc = (t.description || '').toLowerCase();
            return t.subtype === 'season' || desc.includes('season') || desc.includes('podium') || desc.includes('championship');
        });
    }, [payoutTransactions]);

    const totalPayoutsYielded = payoutTransactions.reduce((acc, t) => acc + (Number(t.amount || 0)), 0);

    // Member-only transaction log: their deposits + payout wins + wallet credits
    const myTransactions = isAdmin ? transactions : transactions.filter((tx: any) => {
        const matchesUser = Boolean(
            (activeUserId && (tx.memberId === activeUserId || tx.userId === activeUserId || tx.winnerId === activeUserId)) ||
            (currentUser?.phone && (tx.phoneNumber === currentUser.phone || tx.phone === currentUser.phone || tx.winnerPhone === currentUser.phone)) ||
            (currentUser?.displayName && (
                (tx.memberName && tx.memberName.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase()) ||
                (tx.winnerName && tx.winnerName.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase())
            ))
        );
        return matchesUser;
    });

    const currentSeasonStartMs = new Date('2026-08-01T00:00:00Z').getTime();
    const displayedTransactions = useMemo(() => {
        const seen = new Set<string>();
        return myTransactions.filter((tx: any) => {
            const txId = tx.id || tx.receiptId || `${tx.timestamp}_${tx.amount}_${tx.type}`;
            if (seen.has(txId)) return false;
            seen.add(txId);

            const ts = toMillis(tx.timestamp);
            if (seasonFilter === 'current') {
                if (lastResetAtMs && ts && ts < lastResetAtMs) return false;
                if (ts && ts < currentSeasonStartMs) return false;
                const gw = Number(tx.gw || tx.gameweek || 0);
                if (gw > 0 && gw < leagueStartGw) return false;
            }
            return true;
        });
    }, [myTransactions, seasonFilter, lastResetAtMs, currentSeasonStartMs]);

    const filteredModalTransactions = useMemo(() => {
        return displayedTransactions.filter((tx: any) => {
            const isReversal = Number(tx.amount || 0) < 0
                || tx.type === 'ledger_adjustment'
                || tx.source === 'manual_reversal'
                || String(tx.receiptId || '').startsWith('REV');
            const isPayout = tx.type === 'payout';

            if (ledgerModalFilter === 'deposits' && (isReversal || isPayout)) return false;
            if (ledgerModalFilter === 'payouts' && !isPayout) return false;
            if (ledgerModalFilter === 'reversals' && !isReversal) return false;

            if (!ledgerModalSearch.trim()) return true;
            const q = ledgerModalSearch.toLowerCase().trim();
            const memberName = String(tx.memberName || tx.winnerName || '').toLowerCase();
            const receipt = String(tx.receiptId || tx.mpesaCode || tx.id || '').toLowerCase();
            const note = String(tx.note || '').toLowerCase();
            return memberName.includes(q) || receipt.includes(q) || note.includes(q);
        });
    }, [displayedTransactions, ledgerModalFilter, ledgerModalSearch]);

    const memberTotalLoadedCurrentSeason = useMemo(() => {
        if (!currentUser) return 0;
        const isCurrentSeason = (tx: any) => {
            const ts = toMillis(tx.timestamp);
            if (lastResetAtMs && ts && ts < lastResetAtMs) return false;
            if (ts && ts < currentSeasonStartMs) return false;
            return true;
        };
        const isMatch = (tx: any) => (
            (currentUser.id && (tx.memberId === currentUser.id || tx.userId === currentUser.id)) ||
            (currentUser.phone && (tx.phoneNumber === currentUser.phone || tx.phone === currentUser.phone)) ||
            (currentUser.displayName && (tx.memberName === currentUser.displayName || tx.playerName === currentUser.displayName))
        );

        const validDepositTxs = transactions.filter((tx: any) => {
            if (!isMatch(tx) || !isCurrentSeason(tx)) return false;
            const isDeposit = tx.type === 'deposit' || tx.type === 'wallet_funding' || tx.type === 'manual_deposit' || tx.category === 'deposit' || (tx.type === 'ledger_adjustment' && Number(tx.amount || 0) > 0 && tx.source !== 'manual_reversal');
            if (!isDeposit) return false;

            const status = String(tx.status || '').toLowerCase();
            if (status === 'reversed' || status === 'failed' || status === 'cancelled' || status === 'voided' || tx.isReversed === true || tx.reversed === true) {
                return false;
            }
            return true;
        });

        // Deduct any debit reversals / refunds / manual debit adjustments
        const reversalTotal = transactions.filter((tx: any) => {
            if (!isMatch(tx) || !isCurrentSeason(tx)) return false;
            return (
                tx.source === 'manual_reversal' ||
                tx.type === 'reversal' ||
                tx.type === 'refund' ||
                tx.category === 'refund' ||
                String(tx.status || '').toLowerCase() === 'refund' ||
                (tx.type === 'ledger_adjustment' && (tx.source === 'manual_reversal' || Number(tx.amount || 0) < 0)) ||
                Number(tx.amount || 0) < 0
            );
        }).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount || 0)), 0);

        const txDepositSum = validDepositTxs.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0) - reversalTotal;

        if (validDepositTxs.length > 0 || reversalTotal > 0) {
            return Math.max(0, txDepositSum);
        }
        return Math.max(0, Number((currentUser as any)?.totalDeposited || 0) - reversalTotal);
    }, [transactions, currentUser, lastResetAtMs, currentSeasonStartMs]);


    const totalCompletedOrCurrentGws = useMemo(() => {
        const effectiveStart = leagueStartGw;
        const currentGw = Number(currentGwNumber || effectiveStart);
        const playable: number[] = [];
        for (let g = effectiveStart; g <= currentGw; g++) {
            if (!forfeitedGws.includes(g)) playable.push(g);
        }
        return Math.max(0, playable.length);
    }, [leagueStartGw, currentGwNumber, forfeitedGws]);

    const memberFundingSummary = useMemo(() => {
        const start = leagueStartGw;
        const currentGw = Number(currentGwNumber || start);
        const playable: number[] = [];
        for (let g = start; g <= currentGw; g++) {
            if (!forfeitedGws.includes(g)) playable.push(g);
        }
        const totalCompleted = playable.length;
        const stake = Number(gameweekStake || 0);

        return members
            .filter((m: any) => m.isActive !== false && (m as any).isEliminated !== true)
            .map((m: any) => {
                const isPendingOnboarding = Boolean(m.isPending === true || (!m.phone && !m.phoneNumber));
                const isMemberSpectator = (m as any).playMode === 'sidebets_only';

                // Identify all deposit / inflow transactions associated with this member
                const memberInflowTxs = transactions.filter((tx: any) => {
                    if (!isTxValidInflow(tx)) return false;
                    return (
                        (m.id && (tx.memberId === m.id || tx.userId === m.id)) ||
                        (m.phone && (tx.phoneNumber === m.phone || tx.phone === m.phone)) ||
                        (m.displayName && (tx.memberName === m.displayName || tx.playerName === m.displayName))
                    );
                });

                // Also calculate refunds/reversals to net out from totalDeposited and wallet
                const isMatchedMember = (tx: any) =>
                    (m.id && (tx.memberId === m.id || tx.userId === m.id)) ||
                    (m.phone && (tx.phoneNumber === m.phone || tx.phone === m.phone)) ||
                    (m.displayName && (tx.memberName === m.displayName || tx.playerName === m.displayName));

                const refundTotal = transactions.filter((tx: any) => {
                    if (!isMatchedMember(tx)) return false;
                    return isTxRefundOrReversal(tx);
                }).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount || 0)), 0);

                const grossDeposited = memberInflowTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
                const totalDeposited = Math.max(0, grossDeposited - refundTotal);
                const effectiveMemberBalance = Math.max(0, Number(m.walletBalance || 0));
                
                // Real unspent credit: deposits remaining after past completed rounds are accounted for
                const pastCompletedRoundsCount = Math.max(0, totalCompleted - 1);
                const pastConsumedStake = pastCompletedRoundsCount * stake;
                const unspentCredit = Math.max(0, totalDeposited - pastConsumedStake);

                // Member has paid current GW if stake is 0, unspent credit covers stake, cumulative deposits cover all rounds including current,
                // wallet covers current stake, or they made an inflow transaction explicitly tagged with the current GW, or hasPaid is true
                const hasPaidCurrent = !isMemberSpectator && !isPendingOnboarding && (
                    (stake === 0) ||
                    (stake > 0 && unspentCredit >= stake) ||
                    (stake > 0 && effectiveMemberBalance >= stake) ||
                    (stake > 0 && totalCompleted > 0 && totalDeposited >= (totalCompleted * stake)) ||
                    (memberInflowTxs.some((tx: any) => Number(tx.gw || tx.gameweek || 0) === currentGw)) ||
                    (Number((m as any).lastPaymentGw) === currentGw && Boolean(m.hasPaid)) ||
                    Boolean(m.hasPaid)
                );

                // In Chama play, each GW played costs 1x stake. Total GWs funded all-time based on contributions:
                const rawFundedCount = stake > 0 ? Math.floor(Math.max(totalDeposited, effectiveMemberBalance) / stake) : totalCompleted;
                const gwsFundedCount = hasPaidCurrent ? Math.max(1, rawFundedCount) : rawFundedCount;
                const gwsSkippedCount = (isMemberSpectator || isPendingOnboarding || totalCompleted === 0 || hasPaidCurrent) ? 0 : Math.max(0, totalCompleted - gwsFundedCount);
                const totalOwedArrears = (isMemberSpectator || isPendingOnboarding || totalCompleted === 0) ? 0 : gwsSkippedCount * stake;

                const taggedGws = Array.from(
                    new Set(
                        memberInflowTxs
                            .map((tx: any) => Number(tx.gw || tx.gameweek || 0))
                            .filter((g: number) => g > 0)
                    )
                ).sort((a: number, b: number) => b - a);

                return {
                    id: m.id,
                    displayName: m.displayName || 'Member',
                    phone: m.phone || '',
                    role: m.role || 'member',
                    isSpectator: isMemberSpectator,
                    isPendingOnboarding,
                    walletBalance: effectiveMemberBalance,
                    hasPaidCurrent,
                    totalDeposited,
                    gwsFundedCount,
                    gwsSkippedCount,
                    totalOwedArrears,
                    recentGwsFunded: taggedGws,
                };
            })
            .sort((a, b) => b.gwsSkippedCount - a.gwsSkippedCount);
    }, [members, transactions, leagueStartGw, currentGwNumber, gameweekStake, forfeitedGws]);

    const totalChamaArrears = useMemo(() => {
        return memberFundingSummary.reduce((acc, m) => acc + (m.totalOwedArrears || 0), 0);
    }, [memberFundingSummary]);

    const skippedMembersCount = useMemo(() => {
        return memberFundingSummary.filter(m => !m.isSpectator && m.gwsSkippedCount > 0).length;
    }, [memberFundingSummary]);

    const fundedMembersCount = useMemo(() => {
        return memberFundingSummary.filter(m => !m.isSpectator && m.gwsSkippedCount === 0).length;
    }, [memberFundingSummary]);

    const spectatorsCount = useMemo(() => {
        return memberFundingSummary.filter(m => m.isSpectator).length;
    }, [memberFundingSummary]);

    const regularMembersCount = useMemo(() => {
        return memberFundingSummary.filter(m => !m.isSpectator).length;
    }, [memberFundingSummary]);

    // Use the authoritative transaction-based gross (same source as seasonCollectedSoFarGross)
    // to avoid inflating or understating from stale per-member Firestore fields.
    const seasonDepositedTotal = Math.max(0, seasonCollectedSoFarGross);

    const activeChamaMembers = useMemo(() => {
        return memberFundingSummary.filter(m => !m.isSpectator);
    }, [memberFundingSummary]);

    const currentGwExpectedWeekly = activeChamaMembers.length * (gameweekStake || 0);
    const currentGwFundedMembers = activeChamaMembers.filter(m => m.hasPaidCurrent);
    const currentGwUnfundedMembers = activeChamaMembers.filter(m => !m.hasPaidCurrent);
    const currentGwCollectedWeekly = currentGwFundedMembers.length * (gameweekStake || 0);
    const isWeeklyPotBalanced = currentGwUnfundedMembers.length === 0 && currentGwExpectedWeekly > 0 && currentGwFundedMembers.length > 0;

    const filteredAuditMembers = useMemo(() => {
        if (fundingAuditFilter === 'skipped') {
            return memberFundingSummary.filter(m => !m.isSpectator && m.gwsSkippedCount > 0);
        }
        if (fundingAuditFilter === 'funded') {
            return memberFundingSummary.filter(m => !m.isSpectator && m.gwsSkippedCount === 0);
        }
        if (fundingAuditFilter === 'spectators') {
            return memberFundingSummary.filter(m => m.isSpectator);
        }
        return memberFundingSummary;
    }, [memberFundingSummary, fundingAuditFilter]);

    const isSpectator = (currentUser as any)?.playMode === 'sidebets_only';
    const upcomingDeadlineMs = nextEventDeadline ? new Date(nextEventDeadline).getTime() : null;
    const userExplicitDue = toMillis((currentUser as any)?.nextDueAt) || toMillis((currentUser as any)?.dueAt) || toMillis((currentUser as any)?.deadlineAt);
    const dueTs = upcomingDeadlineMs || (userExplicitDue && userExplicitDue > nowMs ? userExplicitDue : null) || (nowMs + 48 * 60 * 60 * 1000);
    const dueDate = new Date(dueTs);
    const isFunded = Boolean(currentUser?.hasPaid) || (Number(gameweekStake || 0) > 0 && Number(currentUser?.walletBalance || 0) >= Number(gameweekStake || 0));
    const hoursRemaining = Math.max(0, Math.round((dueTs - nowMs) / (60 * 60 * 1000)));
    const isWithin48Hours = dueTs - nowMs <= 48 * 60 * 60 * 1000;
    const isUrgentUnpaid = !isSpectator && !isFunded && (isWithin48Hours || dueTs < nowMs);

    const nextDueStatus = isSpectator ? 'spectator' : (isFunded ? 'on-time' : (dueTs >= nowMs ? 'grace' : 'overdue'));
    const nextDueLabel = isSpectator ? 'Spectator Mode' : (isFunded ? 'Funded & On Time ✓' : isUrgentUnpaid ? `Action Required (${hoursRemaining}h)` : nextDueStatus === 'grace' ? 'Grace Window' : 'Overdue');
    const nextDueTone = isSpectator
        ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400 dark:text-indigo-300'
        : (isFunded
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : isUrgentUnpaid
                ? 'border-rose-500/50 bg-rose-500/20 text-rose-400 font-black'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300');

    const exportLedgerCSV = () => {
        const exportRows = (isAdmin ? transactions : myTransactions).map((tx: any) => {
                const ts = txDate(tx);
            const isPayout = tx.type === 'payout';
            return [
                tx.receiptId || tx.id || '',
                ts ? ts.toLocaleDateString() : '',
                ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                tx.type || '',
                tx.amount || 0,
                isPayout ? 'GW payout' : 'Deposit',
                tx.mpesaCode || tx.reference || '',
                tx.gameweek || tx.gw || '',
                isPayout ? (tx.winnerName || currentUser?.displayName || '') : (tx.memberName || currentUser?.displayName || '')
            ];
        });

        const rows = [
            ['Receipt No.', 'Date', 'Time', 'Type', 'Amount (KES)', 'Description', 'Reference', 'Gameweek', 'Member'],
            ...exportRows,
        ];
        const csv = rows.map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${(leagueName || 'League').replace(/\s/g, '_')}_Ledger.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const showActionMessage = (type: 'success' | 'error', text: string) => {
        setActionMessage({ type, text });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.setTimeout(() => setActionMessage(null), 3500);
    };

    const openWhatsApp = (message: string) => {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleNudgeArrears = (member: any) => {
        const appUrl = window.location.origin;
        const message = [
            `🚨 *${leagueName || 'Fantasy Chama'} — Gameweek Funding Reminder*`,
            ``,
            `Habari *${member.displayName}*! 👋`,
            `Friendly reminder from the Chairman: your wallet is currently not funded for the upcoming round (${member.gwsSkippedCount} round${member.gwsSkippedCount > 1 ? 's' : ''} sat out). Top up KES ${Number(gameweekStake || 50).toLocaleString()} to activate your squad and compete for this week's cash pot! 🏆`,
            ``,
            `👉 Top up directly: ${appUrl}/deposit`,
        ].join('\n');

        if (member.phone) {
            const phone = member.phone.replace(/[^0-9]/g, '');
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
        }
        showActionMessage('success', `Opened WhatsApp reminder for ${member.displayName}.`);
    };

    const shareTransactionReceipt = (tx: any) => {
        const isWalletFunding = tx.type === 'wallet_funding'
            || String(tx.receiptId || '').startsWith('SEED_')
            || String(tx.note || '').toUpperCase().includes('ADMIN_PREFUND')
            || String(tx.note || '').toLowerCase().includes('wallet top-up')
        const isPayout = tx.type === 'payout' || tx.type === 'season_vault_payout';
        const gross = Number(tx.grossAmount || (tx.feeAmount ? Number(tx.amount || 0) + Number(tx.feeAmount || 0) : tx.amount) || 0);
        const fee = Number(tx.feeAmount || 0);
        const net = Number(tx.amount || 0);

        const title = tx.type === 'payout'
            ? 'Payout Receipt'
            : tx.type === 'season_vault_payout'
                ? 'Season Vault Payout Receipt'
                : isWalletFunding
                    ? 'Wallet Credit Receipt'
                    : 'Deposit Receipt';
        const message = [
            `🧾 *${leagueName} ${title}*`,
            '',
            `Member: *${tx.memberName || tx.winnerName || 'Member'}*`,
            isPayout && fee > 0 ? `Gross Prize Won: *KES ${gross.toLocaleString()}*` : '',
            isPayout && fee > 0 ? `M-Pesa Sending Fee: *-KES ${fee}* (Pochi tariff)` : '',
            `Net Disbursed: *KES ${(isPayout && fee > 0 ? net : (tx.amount || 0)).toLocaleString()}*`,
            tx.receiptId ? `Receipt: *${tx.receiptId}*` : '',
            tx.type === 'payout' ? `GW: *${tx.gw || tx.gameweek || 'N/A'}*` : '',
            isPayout && fee > 0 ? `_Transparent Chama accounting: transfer costs deducted at source._` : '',
            '',
            `Powered by FantasyChama`,
        ].filter(Boolean).join('\n');

        openWhatsApp(message);
        showActionMessage('success', 'Receipt ready for WhatsApp share.');
    };

    const handleDeleteTransaction = async () => {
        if (!activeLeagueId || !txToDelete?.id) return;
        setIsDeletingTx(true);
        try {
            await deleteDoc(doc(db, 'leagues', activeLeagueId, 'transactions', txToDelete.id));
            toast.success(`Transaction ${txToDelete.receiptId || ''} deleted from ledger.`);
            setTxToDelete(null);
        } catch (err: any) {
            console.error('Error deleting transaction:', err);
            toast.error(`Failed to delete transaction: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsDeletingTx(false);
        }
    };

    const handleSubmitCashTopUpRequest = async () => {
        if (!activeLeagueId || !currentUser || !activeUserId) return;

        const amount = Math.max(1, Math.floor(Number(cashTopUpAmount || 0)));
        if (!Number.isFinite(amount) || amount <= 0) {
            showActionMessage('error', 'Enter a valid wallet top-up amount first.');
            return;
        }

        setIsSubmittingCashTopUpRequest(true);
        try {
            await addDoc(collection(db, 'leagues', activeLeagueId, 'wallet_topup_requests'), {
                memberId: activeUserId,
                memberName: currentUser.displayName || 'Member',
                phone: currentUser.phone || memberPhone || '',
                amount,
                note: cashTopUpNote.trim() || null,
                method: 'cash_handoff',
                status: 'pending',
                nudgeCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                message: `Cash handoff wallet top-up request: ${currentUser.displayName} requested KES ${amount.toLocaleString()} manual credit approval.`,
                timestamp: serverTimestamp(),
                readBy: []
            });

            setCashTopUpAmount('');
            setCashTopUpNote('');
            showActionMessage('success', 'Cash handoff request submitted. Chairman can approve wallet credit from Action Queue.');
        } catch (err: any) {
            showActionMessage('error', `Request failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsSubmittingCashTopUpRequest(false);
        }
    };

    const handleNudgeWalletCreditRequest = async (requestItem: any) => {
        if (!activeLeagueId) return;
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'wallet_topup_requests', requestItem.id), {
                nudgeCount: increment(1),
                lastNudgedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                message: `Wallet credit nudge: ${requestItem.memberName} is still waiting for cash handoff approval (KES ${Number(requestItem.amount || 0).toLocaleString()}).`,
                timestamp: serverTimestamp(),
                readBy: []
            });
            showActionMessage('success', 'Nudge sent to Chairman queue.');
        } catch (err: any) {
            showActionMessage('error', `Nudge failed: ${err?.message || 'Unknown error'}`);
        }
    };

    // @ts-ignore
const handleApproveWalletTopUpRequest = async (requestItem: any) => {
        if (!activeLeagueId || !requestItem?.memberId) return;

        setIsResolvingWalletRequestId(requestItem.id);
        try {
            const amount = Math.max(1, Math.floor(Number(requestItem.amount || 0)));
            const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', requestItem.memberId);

            await updateDoc(memberRef, {
                walletBalance: increment(amount),
                hasPaid: true,
            });

            const stampedGw = Math.max(Number(leagueStartGw || 1), Number(currentGwNumber || 1));
            await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                type: 'wallet_funding',
                amount,
                memberId: requestItem.memberId,
                memberName: requestItem.memberName || 'Member',
                phoneNumber: requestItem.phone || null,
                paymentMethod: 'cash_handoff',
                receiptId: `CASH_TOPUP_${Date.now().toString().slice(-6)}`,
                gameweek: stampedGw,
                gw: stampedGw,
                note: requestItem.note || `Manual cash handoff wallet top-up (GW${stampedGw})`,
                timestamp: serverTimestamp()
            });

            await updateDoc(doc(db, 'leagues', activeLeagueId, 'wallet_topup_requests', requestItem.id), {
                status: 'approved',
                approvedAt: serverTimestamp(),
                approvedBy: auth.currentUser?.displayName || 'Chairman',
                updatedAt: serverTimestamp()
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'success',
                targetMemberId: requestItem.memberId,
                message: `Wallet credited: KES ${amount.toLocaleString()} cash handoff top-up approved.`,
                timestamp: serverTimestamp(),
                readBy: []
            });

            showActionMessage('success', `Approved wallet credit for ${requestItem.memberName} (KES ${amount.toLocaleString()}).`);
        } catch (err: any) {
            showActionMessage('error', `Wallet approval failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsResolvingWalletRequestId(null);
        }
    };

    // @ts-ignore
const handleRejectWalletTopUpRequest = async (requestItem: any) => {
        if (!activeLeagueId) return;
        setIsResolvingWalletRequestId(requestItem.id);
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'wallet_topup_requests', requestItem.id), {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                rejectedBy: auth.currentUser?.displayName || 'Chairman',
                updatedAt: serverTimestamp()
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'warning',
                targetMemberId: requestItem.memberId,
                message: `Wallet top-up request rejected. Contact Chairman for manual reconciliation details.`,
                timestamp: serverTimestamp(),
                readBy: []
            });

            showActionMessage('success', `Rejected wallet request for ${requestItem.memberName}.`);
        } catch (err: any) {
            showActionMessage('error', `Reject failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsResolvingWalletRequestId(null);
        }
    };

    // @ts-ignore
const handleApprovePendingPayout = async (payout: any) => {
        if (!activeLeagueId) return;

        setIsApprovingPayoutId(payout.id);
        try {
            const payoutPoints = Number(
                payout.points ??
                payout.winningPoints ??
                payout.gwPoints ??
                payout.event_total ??
                0
            );
            const winnerMember = members.find((member) =>
                member.id === payout.winnerId ||
                member.displayName === payout.winnerName
            );
            const payoutPhone = payout.winnerPhone || winnerMember?.phone;

            const payoutGross = Number(payout.grossAmount || (payout.feeAmount ? Number(payout.amount || 0) + Number(payout.feeAmount || 0) : payout.amount) || 0);
            const payoutFee = Number(payout.feeAmount !== undefined ? payout.feeAmount : calculateMpesaSendFee(payoutGross));
            const payoutNet = Number(payout.amount && payout.grossAmount ? payout.amount : Math.max(0, payoutGross - payoutFee));

            if ((payout.method === 'mpesa' || !payout.method) && !payoutPhone) {
                throw new Error('Winner phone number is missing. Update member details and retry.');
            }

            if (payout.method === 'mpesa' || !payout.method) {
                const payoutApiUrl = getApiBaseUrl();
                if (!payoutApiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
                const payoutRes = await fetch(`${payoutApiUrl}/api/mpesa/b2c`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: payoutPhone,
                        amount: payoutNet,
                        winnerName: payout.winnerName,
                        remarks: `FantasyChama GW${payout.gw} Approved Payout`,
                        userId: payout.winnerId || winnerMember?.id || activeUserId,
                        leagueId: activeLeagueId,
                        gw: Number(payout.gw || 0),
                        points: payoutPoints
                    })
                });
                if (!payoutRes.ok) {
                    throw new Error(`Payment dispatch failed (${payoutRes.status}).`);
                }
                const payoutData = await payoutRes.json();
                if (!payoutData.success) throw new Error(payoutData.message || 'B2C dispatch failed');
            }

            await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payout.id), {
                status: 'approved',
                winnerPhone: payoutPhone || null,
                grossAmount: payoutGross,
                feeAmount: payoutFee,
                amount: payoutNet,
                approvedBy: auth.currentUser?.displayName || 'Admin',
                approvedAt: serverTimestamp()
            });

            // Write transaction to ledger
            await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                type: 'payout',
                amount: payoutNet,
                grossAmount: payoutGross,
                feeAmount: payoutFee,
                feeBreakdown: payoutFee > 0 ? `Gross KES ${payoutGross.toLocaleString()} less KES ${payoutFee} M-Pesa transfer fee = KES ${payoutNet.toLocaleString()}` : undefined,
                winnerName: payout.winnerName,
                winnerId: payout.winnerId,
                winnerPhone: payoutPhone || null,
                points: payoutPoints,
                gw: Number(payout.gw || 0),
                receiptId: `CASH_GW${Number(payout.gw || 0)}_${Date.now().toString().slice(-6)}`,
                timestamp: serverTimestamp(),
            });

            // Deduct gameweek stake from each funded member's wallet directly via Firestore
            const fundedMembers = members.filter(
                (m) => m.isActive !== false && m.hasPaid && gameweekStake > 0,
            );
            for (const m of fundedMembers) {
                const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', m.id);
                const newBalance = Math.max(0, (m.walletBalance || 0) - gameweekStake);
                await updateDoc(memberRef, {
                    walletBalance: newBalance,
                    hasPaid: newBalance >= gameweekStake,
                });
            }

            // Record the GW deduction in league_events audit log
            await addDoc(collection(db, 'leagues', activeLeagueId, 'league_events'), {
                eventType: 'gw_deduction',
                message: `GW${payout.gw} stake deducted: KES ${gameweekStake} × ${fundedMembers.length} members. Winner: ${payout.winnerName} (${payout.method || 'mpesa'}).`,
                actor: auth.currentUser?.displayName || 'Chairman',
                timestamp: serverTimestamp(),
            });

            showActionMessage('success', `Resolved & paid ${payout.winnerName} (Net KES ${payoutNet.toLocaleString()}${payoutFee > 0 ? ` · Fee KES ${payoutFee}` : ''}).`);
        } catch (err: any) {
            const message = err?.message || 'Unknown error';
            if (/failed to fetch|networkerror|network error|load failed/i.test(String(message))) {
                showActionMessage('error', 'Approval failed: Cannot reach payment server. Confirm Render backend URL and CORS settings.');
            } else {
                showActionMessage('error', `Approval failed: ${message}`);
            }
        } finally {
            setIsApprovingPayoutId(null);
        }
    };

    // @ts-ignore
const handleRejectPendingPayout = async (payout: any) => {
        if (!activeLeagueId) return;

        setIsRejectingPayoutId(payout.id);
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payout.id), {
                status: 'rejected',
                rejectedBy: auth.currentUser?.displayName || 'Admin',
                rejectedAt: serverTimestamp()
            });
            showActionMessage('success', `Rejected payout request for ${payout.winnerName}.`);
        } catch (err: any) {
            showActionMessage('error', `Reject failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsRejectingPayoutId(null);
        }
    };

    if (!isAdmin && !currentUser) {
        return (
            <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#0b1014]">
                <div className="w-full max-w-6xl mx-auto">
                    <Header role={role || 'member'} title={leagueName} subtitle="Finance & Audit" />
                    <div className="fc-card mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4">
                        <p className="text-sm font-black text-amber-300 uppercase tracking-widest">Sync Pending</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Your member profile is still syncing. Refresh in a few seconds and try again.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAdmin && isSpectator) {
        return (
            <div className="fc-finances-page p-3 sm:p-5 md:p-6 lg:p-8 w-full animate-in fade-in duration-500 pb-36 sm:pb-32 lg:pb-16 font-sans text-slate-900 dark:text-white relative">
                <div className="w-full max-w-4xl mx-auto space-y-6">
                    <Header role={role || 'member'} title={leagueName} subtitle="Finance & Audit" />
                    
                    <div className="mt-8 rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-slate-50 dark:via-[#111822] to-slate-100 dark:to-[#0b1014] p-6 sm:p-10 text-center shadow-xl relative overflow-hidden">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4 text-indigo-500 dark:text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.25)]">
                            <Lock className="w-8 h-8" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-400">
                            Spectator Mode Active
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-3 mb-2">
                            Financial Vault & Ledger Locked
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 max-w-lg mx-auto leading-relaxed">
                            Financial records, weekly pot balances, and M-Pesa audit trails are exclusively accessible to registered Chama members who are actively participating in cash pots.
                        </p>

                        <div className="mt-6 p-4 rounded-2xl bg-white/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 max-w-md mx-auto text-left space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-gray-200">
                                What You Can Access as a Spectator:
                            </p>
                            <ul className="text-xs text-slate-600 dark:text-gray-400 space-y-1.5 list-disc list-inside">
                                <li>Live Premier League Standings & Gameweek Points</li>
                                <li>Full Matchday Lineup Pitch & Manager Matchups</li>
                                <li>Chama Banter Slips & 1-Tap WhatsApp Digests</li>
                                <li>1v1 P2P Cash Side Bets with any rival</li>
                            </ul>
                        </div>

                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={() => navigate('/deposit', { state: { upgradeMode: true } })}
                                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                            >
                                <Trophy className="w-4 h-4" />
                                <span>Upgrade to Cash Pot Contender</span>
                            </button>
                            <button
                                onClick={() => navigate('/standings')}
                                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                            >
                                <BarChart3 className="w-4 h-4" />
                                <span>View Live Standings</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fc-finances-page p-3 sm:p-5 md:p-6 lg:p-8 w-full animate-in fade-in duration-500 pb-36 sm:pb-32 lg:pb-16 font-sans text-white relative">
            <div className="absolute inset-0 pointer-events-none opacity-50">
                <div className="absolute -top-20 right-[8%] h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>
            <div className="w-full max-w-6xl mx-auto space-y-4">
                <Header role={role || 'member'} title={leagueName} subtitle="Finance & Audit" />
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pt-0 pb-1 mb-1">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-400 mb-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                            Red Zone & Finances
                        </p>
                        <h2 className="fc-frosty-title text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5 mb-1">
                            <ReceiptText className="w-6 h-6 text-emerald-400" /> Audit Log
                        </h2>
                        <p className="fc-metallic-sub text-sm font-medium max-w-xl leading-relaxed text-gray-400">
                            A transparent, permanent history of all funds entering and exiting the Chama Vault.
                        </p>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                        <button onClick={exportLedgerCSV} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-xl transition active:scale-95">
                            <Download className="w-3.5 h-3.5" /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Member Personal Wallet & Due Actions (shown for members) */}
                {!isAdmin && currentUser && (
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mb-8 items-stretch">
                        {/* Merged Card: Next Due & Total Loaded (Toggleable Tab) */}
                        <article className={clsx(
                            "fc-card rounded-2xl p-6 sm:p-7 border flex flex-col justify-between shadow-md transition-all",
                            personalCardTab === 'due'
                                ? (isUrgentUnpaid
                                    ? "border-rose-500/50 bg-rose-500/10 text-rose-400 shadow-rose-950/30"
                                    : (isSpectator
                                        ? "border-indigo-500/25 bg-gradient-to-br from-indigo-500/14 via-white dark:via-[#161d24] to-white dark:to-[#161d24]"
                                        : "border-emerald-500/25 bg-gradient-to-br from-emerald-500/14 via-white dark:via-[#161d24] to-white dark:to-[#161d24]"))
                                : "border-blue-500/25 bg-gradient-to-br from-blue-500/14 via-white dark:via-[#161d24] to-white dark:to-[#161d24]"
                        )}>
                            <div>
                                {/* Card Header with Tabs */}
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <div className="flex items-center p-0.5 rounded-xl bg-black/30 border border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setPersonalCardTab('due')}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                                personalCardTab === 'due'
                                                    ? (isUrgentUnpaid ? "bg-rose-500 text-white shadow-sm" : "bg-emerald-500 text-slate-950 shadow-sm")
                                                    : "text-gray-400 hover:text-white"
                                            )}
                                        >
                                            {isSpectator ? "Pot Eligibility" : "Next Due"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPersonalCardTab('loaded')}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                                personalCardTab === 'loaded'
                                                    ? "bg-blue-500 text-white shadow-sm"
                                                    : "text-gray-400 hover:text-white"
                                            )}
                                        >
                                            Total Loaded
                                        </button>
                                    </div>
                                    {personalCardTab === 'due' ? (
                                        <Clock3 className={clsx("w-4 h-4", isUrgentUnpaid ? "text-rose-400 animate-pulse" : isSpectator ? "text-indigo-400" : "text-emerald-400")} />
                                    ) : (
                                        <TrendingUp className="w-4 h-4 text-blue-400" />
                                    )}
                                </div>

                                {/* Tab Body */}
                                {personalCardTab === 'due' ? (
                                    <div>
                                        <p className={clsx("text-2xl font-black tabular-nums", isUrgentUnpaid ? "text-rose-400" : "text-gray-900 dark:text-white")}>
                                            {isSpectator ? "Spectator (0 KES)" : `${Number(gameweekStake || 0).toLocaleString()} KES`}
                                        </p>
                                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2">
                                            {isSpectator
                                                ? "Playing Side Bets only · Free to view system"
                                                : isUrgentUnpaid
                                                    ? `⚠️ Urgent: Deadline ${dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${hoursRemaining}h left)`
                                                    : `Deadline: ${dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">
                                            <AnimatedKes amount={memberTotalLoadedCurrentSeason} className="tabular-nums" />
                                        </p>
                                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2">
                                            Net deposits and top-ups loaded for the 2026/27 season.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Card Footer Badges */}
                            <div className="mt-5 flex items-center justify-between gap-2 flex-wrap pt-3 border-t border-white/5">
                                {personalCardTab === 'due' ? (
                                    <>
                                        <span className={clsx('inline-flex px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border w-fit', nextDueTone)}>
                                            {nextDueLabel}
                                        </span>
                                        {isSpectator ? (
                                            <button
                                                onClick={() => navigate('/deposit', { state: { upgradeMode: true } })}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                            >
                                                Upgrade to Pot →
                                            </button>
                                        ) : !isFunded ? (
                                            <button
                                                onClick={() => navigate('/deposit')}
                                                className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
                                            >
                                                <Wallet className="w-3.5 h-3.5" /> Top Up Wallet →
                                            </button>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <span className="inline-flex px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300">
                                            Wallet Balance: <AnimatedKes amount={Number(currentUser.walletBalance || 0)} className="ml-1 tabular-nums" />
                                        </span>
                                        {Number(currentUser.walletBalance || 0) < Number(gameweekStake || 0) && !isSpectator && (
                                            <span className="text-[10px] font-bold text-amber-400">
                                                Top-up needed for next GW
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        </article>

                        {/* Wallet Top-Up Card */}
                        <article className="fc-card fc-wallet-topup-card rounded-2xl p-5 sm:p-6 border border-emerald-500/25 bg-white dark:bg-[#161d24] shadow-sm dark:shadow-md flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Wallet Top-Up</p>
                                    <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                </div>

                                <div className="space-y-2.5">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={cashTopUpAmount}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => {
                                            const cleaned = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                                            setCashTopUpAmount(cleaned);
                                        }}
                                        placeholder="Amount (KES)"
                                        className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
                                    />
                                    <input
                                        type="text"
                                        value={cashTopUpNote}
                                        onChange={(e) => setCashTopUpNote(e.target.value)}
                                        placeholder="Optional note"
                                        className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
                                    />
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (cashTopUpAmount) setTopUpCustomAmount(cashTopUpAmount);
                                                setShowMpesaTopUpModal(true);
                                            }}
                                            className="px-3 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/25 transition-all active:scale-95 cursor-pointer"
                                        >
                                            M-Pesa
                                        </button>
                                        <button
                                            onClick={handleSubmitCashTopUpRequest}
                                            disabled={isSubmittingCashTopUpRequest}
                                            className="px-3 py-2.5 rounded-xl border border-white/15 bg-white/5 text-gray-300 hover:text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                        >
                                            {isSubmittingCashTopUpRequest ? '...' : 'Cash'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 pt-1">Request after cash handoff to Chairman.</p>
                                </div>
                            </div>
                        </article>
                    </section>
                )}

                {/* Main Treasury Metric Cards (Chairman View Only) */}
                {isAdmin && (
                    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 mb-8">
                        {/* Card 1: Projected Weekly / Season Collection */}
                        {(() => {
                            const weeklyPercent = Number(rules?.weekly || 0);
                            const vaultPercent = Number(rules?.vault || 0);
                            const isSeasonOnlyLeague = weeklyPercent === 0 && vaultPercent > 0;
                            const isWeeklyOnlyLeague = vaultPercent === 0 && weeklyPercent > 0;
                            const memberPlayMode = (currentUser as any)?.playMode || 'full';
                            const effectivePayoutMode: 'weekly_only' | 'season_only' | 'both' = 
                                isSeasonOnlyLeague || memberPlayMode === 'season_only'
                                    ? 'season_only'
                                    : isWeeklyOnlyLeague || memberPlayMode === 'weekly_only'
                                    ? 'weekly_only'
                                    : 'both';

                            return (
                                <>
                                    <div className="fc-card bg-gradient-to-br from-emerald-500/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] border border-emerald-500/25 p-6 sm:p-7 rounded-[1.75rem] relative overflow-hidden flex flex-col justify-between shadow-lg min-h-[195px]">
                                        <div className="space-y-2.5 mb-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 shrink-0">
                                                        <TrendingUp className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                                                            {effectivePayoutMode === 'weekly_only'
                                                                ? "Projected Weekly Payout"
                                                                : effectivePayoutMode === 'season_only'
                                                                ? (seasonCardTab === 'collected' ? "Season Vault" : "Projected Season Collection")
                                                                : projectedCardIndex === 0
                                                                ? "Projected Weekly Payout"
                                                                : (seasonCardTab === 'collected' ? "Season Vault" : "Projected Season Collection")}
                                                        </h3>
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                            {effectivePayoutMode === 'weekly_only'
                                                                ? `Weekly Cash Pot (${weeklyPercent}%)`
                                                                : effectivePayoutMode === 'season_only'
                                                                ? (seasonCardTab === 'collected' ? `Live Secured Vault (${vaultPercent}%)` : `Season Podium Vault (${vaultPercent}%)`)
                                                                : projectedCardIndex === 0
                                                                ? `Current Gameweek Pot (${weeklyPercent}%)`
                                                                : (seasonCardTab === 'collected' ? `Live Secured Vault (${vaultPercent}%)` : `Join-aware remaining estimate (${vaultPercent}%)`)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end shrink-0 sm:ml-auto">
                                                    {effectivePayoutMode === 'both' && (
                                                        <div className="flex items-center gap-1 bg-black/10 dark:bg-black/40 p-0.5 rounded-lg border border-black/5 dark:border-white/10">
                                                            <button
                                                                type="button"
                                                                onClick={() => setProjectedCardIndex(0)}
                                                                className={clsx("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer", projectedCardIndex === 0 ? "bg-emerald-500 text-black shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white")}
                                                            >
                                                                GW
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setProjectedCardIndex(1)}
                                                                className={clsx("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer", projectedCardIndex === 1 ? "bg-emerald-500 text-black shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white")}
                                                            >
                                                                Season
                                                            </button>
                                                        </div>
                                                    )}
                                                    {(effectivePayoutMode === 'season_only' || projectedCardIndex === 1) && (
                                                        <div className="flex items-center gap-1 bg-black/10 dark:bg-black/40 p-0.5 rounded-lg border border-black/5 dark:border-white/10 shadow-xs sm:ml-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSeasonCardTab('collected')}
                                                                className={clsx(
                                                                    "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1",
                                                                    seasonCardTab === 'collected' ? "bg-amber-400 text-black shadow-sm font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                                )}
                                                                title="Actual funds secured in the vault right now"
                                                            >
                                                                Now
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSeasonCardTab('projected')}
                                                                className={clsx(
                                                                    "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1",
                                                                    seasonCardTab === 'projected' ? "bg-emerald-500 text-black shadow-sm font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                                                )}
                                                                title="Projected season collection across remaining rounds"
                                                            >
                                                                Projected
                                                            </button>
                                                        </div>
                                                    )}
                                                    {effectivePayoutMode === 'weekly_only' && (
                                                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                                                            Weekly Only
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            {(effectivePayoutMode === 'weekly_only' || (effectivePayoutMode === 'both' && projectedCardIndex === 0)) ? (
                                                <>
                                                    <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-gray-900 dark:text-white">
                                                        {isStealthMode ? 'KES ****' : <AnimatedKes amount={projectedWeeklyPayout} className="tabular-nums" />}
                                                    </p>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed font-medium">
                                                        {projectedWeeklyPayoutFormula}
                                                    </p>
                                                </>
                                            ) : seasonCardTab === 'collected' ? (
                                                <>
                                                    <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-amber-400">
                                                        {isStealthMode ? 'KES ****' : <AnimatedKes amount={seasonVaultCollectedSoFar} className="tabular-nums" />}
                                                    </p>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed font-medium">
                                                        Actual verified vault funds secured to date: KES {Number(seasonCollectedSoFarGross || 0).toLocaleString()} gross × {vaultPercent}% = KES {Number(seasonVaultCollectedSoFar || 0).toLocaleString()}
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                                                        {isStealthMode ? 'KES ****' : <AnimatedKes amount={projectedSeasonCollections} className="tabular-nums" />}
                                                    </p>
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed font-medium">
                                                        {projectedSeasonCollectionsFormula}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card 2: Total Payouts Yielded */}
                                    <div 
                                        onClick={() => setShowPayoutsModal(true)}
                                        className="fc-card bg-gradient-to-br from-[#FBBF24]/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] border border-[#FBBF24]/25 hover:border-[#FBBF24]/50 p-6 sm:p-7 rounded-[1.75rem] relative overflow-hidden flex flex-col justify-between shadow-lg min-h-[195px] cursor-pointer transition-all active:scale-[0.99] group"
                                        title="Click to view full weekly and season payouts breakdown"
                                    >
                                        <div className="flex items-center justify-between gap-2.5 mb-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center border border-amber-500/30 text-amber-500 dark:text-amber-400 shrink-0">
                                                    <Trophy className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                                                        {effectivePayoutMode === 'weekly_only'
                                                            ? "Weekly Payouts Yielded"
                                                            : effectivePayoutMode === 'season_only'
                                                            ? "Season Payouts Yielded"
                                                            : (projectedCardIndex === 0 ? "Weekly Payouts Yielded" : "Season Payouts Yielded")}
                                                    </h3>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Issued from ledger</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setShowPayoutsModal(true); }}
                                                className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-500/15 group-hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                                Breakdown ↗
                                            </button>
                                        </div>

                                        <div>
                                            <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-amber-600 dark:text-[#FBBF24]">
                                                KES {isStealthMode ? '****' : totalPayoutsYielded.toLocaleString()}
                                            </p>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed font-medium">
                                                {effectivePayoutMode === 'weekly_only'
                                                    ? "Settled weekly gameweek payouts already disbursed and approved from the ledger."
                                                    : effectivePayoutMode === 'season_only'
                                                    ? "Settled season championship payouts already disbursed and approved from the ledger."
                                                    : "Settled payouts already disbursed. Tap to inspect weekly vs season payments."}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}

                        {/* Card 3: Member Receipts & Inflow Liquidity (Player Collections) */}
                        {(() => {
                            const totalContributedByAll = activeMembers.reduce((sum, m: any) => {
                                return sum + Number(contributionByMemberId[String(m.id)] || 0);
                            }, 0);
                            const totalWalletFloat = activeMembers.reduce((sum, m: any) => sum + Number(m.walletBalance || 0), 0);
                            const regularCount = activeMembers.filter(m => (m as any).playMode !== 'sidebets_only').length || 1;
                            const avgPerPlayer = Math.round(totalContributedByAll / regularCount);

                            return (
                                <div className="fc-card bg-gradient-to-br from-indigo-500/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] border border-indigo-500/25 p-6 sm:p-7 rounded-[1.75rem] relative overflow-hidden flex flex-col justify-between shadow-lg min-h-[195px]">
                                    <div className="space-y-2.5 mb-3">
                                        <div className="flex items-center justify-between gap-2.5">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center border border-indigo-500/30 text-indigo-500 dark:text-indigo-400 shrink-0">
                                                    <Users className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                                                        Player Receipts & Float
                                                    </h3>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                        Live receipts across {regularCount} players
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowPlayerBreakdown(true)}
                                                className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                                Player Breakdown ↗
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-indigo-600 dark:text-indigo-400">
                                            {isStealthMode ? 'KES ****' : <AnimatedKes amount={totalContributedByAll} className="tabular-nums" />}
                                        </p>
                                        <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                            <span>Avg KES {avgPerPlayer.toLocaleString()} / player</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">KES {totalWalletFloat.toLocaleString()} float in wallets</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </section>
                )}

                {/* Streamlined Vault Payout Preview */}
                <section className="fc-card rounded-3xl border border-amber-500/30 dark:border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-white to-slate-50 dark:via-[#161d24] dark:to-[#0c1218] p-4 sm:p-6 mb-6 shadow-xl dark:shadow-2xl relative overflow-hidden text-slate-900 dark:text-white">
                    <div className="absolute top-0 right-0 w-80 h-40 bg-amber-500/10 blur-[90px] pointer-events-none" />
                    
                    {/* Header: Title, Toggle & Badges */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200/70 dark:border-white/10">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                                    Vault Payout Preview
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400">
                                    {modeLabel} · {activeMembersCount} active players
                                </span>
                            </div>
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight mt-1">
                                Chairman's Season Ladder
                            </h2>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Toggle: Live Accrued vs Projected */}
                            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-black/50 p-1 rounded-xl border border-slate-300 dark:border-white/10 text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => setVaultPodiumView('accrued')}
                                    className={clsx(
                                        "px-2.5 py-1 rounded-lg font-black uppercase tracking-wider transition-all cursor-pointer",
                                        vaultPodiumView === 'accrued'
                                            ? "bg-emerald-500 text-black shadow-xs font-extrabold"
                                            : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    Live Accrued
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVaultPodiumView('projected')}
                                    className={clsx(
                                        "px-2.5 py-1 rounded-lg font-black uppercase tracking-wider transition-all cursor-pointer",
                                        vaultPodiumView === 'projected'
                                            ? "bg-amber-400 text-black shadow-xs font-extrabold"
                                            : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    Projected Final
                                </button>
                            </div>

                            {role === 'admin' && (
                                (Number(currentGwNumber) >= 38 && isCurrentEventFinished) ? (
                                    <button
                                        onClick={() => setShowSeasonCeremony(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-700 dark:text-amber-300 hover:text-black dark:hover:text-white hover:border-amber-400 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                        <Trophy className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                                        Launch Ceremony
                                    </button>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-100/60 dark:bg-white/[0.03] text-[10px] font-bold text-slate-500 dark:text-gray-400">
                                        <Lock className="w-3 h-3 text-amber-500" />
                                        GW{currentGwNumber || '--'}/38
                                    </span>
                                )
                            )}
                        </div>
                    </div>

                    {/* Podium Grid */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full items-stretch">
                        {tiedSeasonVaultPreview.slice(0, 3).map((tier: any) => {
                            const isAccrued = vaultPodiumView === 'accrued';
                            const primaryAmount = isAccrued ? (tier.accruedAmount ?? tier.amount) : (tier.projectedAmount || tier.amount);
                            const secondaryAmount = isAccrued ? (tier.projectedAmount || tier.amount) : (tier.accruedAmount ?? tier.amount);
                            const medal = tier.rank === 1 ? '🥇' : tier.rank === 2 ? '🥈' : '🥉';
                            return (
                                <div
                                    key={`${tier.originalPlace}-${tier.player_name}`}
                                    onClick={() => setVaultPodiumView(prev => prev === 'accrued' ? 'projected' : 'accrued')}
                                    className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0b1014]/90 p-2.5 sm:p-3.5 text-center flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-xs min-w-0 cursor-pointer select-none"
                                    title="Tap to toggle live accrued vs projected final"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-1 mb-1.5">
                                            <span className="text-[10px] sm:text-xs font-black text-slate-900 dark:text-white flex items-center gap-1 truncate">
                                                <span>{medal}</span> #{tier.rank}
                                                {tier.isTied && <span className="text-[7.5px] text-amber-600 dark:text-amber-400 font-bold">(Tied)</span>}
                                            </span>
                                            <span className={clsx(
                                                'text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border shrink-0',
                                                tier.rank === 1 ? 'border-amber-400/40 bg-amber-400/15 text-amber-700 dark:text-amber-400' : tier.rank === 2 ? 'border-slate-300 bg-slate-100 dark:border-slate-300/30 dark:bg-slate-300/10 text-slate-700 dark:text-slate-200' : 'border-amber-600/30 bg-amber-600/15 text-amber-800 dark:text-amber-500'
                                            )}>
                                                {tier.percentage}%
                                            </span>
                                        </div>
                                        <div className="mt-1">
                                            <p className={clsx(
                                                "text-sm sm:text-lg md:text-xl font-black tabular-nums truncate",
                                                isAccrued ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                                            )}>
                                                KES {Math.round(primaryAmount || 0).toLocaleString()}
                                            </p>
                                            <p className="mt-0.5 text-[8px] sm:text-[9.5px] text-slate-500 dark:text-gray-400 truncate font-medium">
                                                {isAccrued ? (
                                                    <>Est: <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">KES {Math.round(secondaryAmount || 0).toLocaleString()}</strong></>
                                                ) : (
                                                    <>Accrued: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">KES {Math.round(secondaryAmount || 0).toLocaleString()}</strong></>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5">
                                        <p className="text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-gray-200 truncate">
                                            {tier.player_name}
                                        </p>
                                        <p className="text-[8px] sm:text-[9px] text-slate-500 dark:text-gray-400 truncate mt-0.5">{tier.entry_name}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <p className="mt-3 text-[10px] text-slate-500 dark:text-gray-400 font-medium text-center">
                        💡 Payouts mirror live season rankings and rebalance automatically to 100% across podium tiers.
                        {isPreviewCapped && ` (Capped at Top ${eligibleWinnersCount} until additional active players join)`}
                    </p>
                </section>

                

                {!isAdmin && pendingWalletTopUpRequests.length > 0 && (
                    <section className="fc-card mb-8 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 to-white dark:to-[#161d24] p-5 md:p-6">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-sky-300">Pending Wallet Credit Requests</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">If you already handed cash and your wallet is not credited yet, nudge Chairman here.</p>

                        <div className="mt-4 space-y-2">
                            {pendingWalletTopUpRequests.slice(0, 3).map((requestItem: any) => (
                                <div key={requestItem.id} className="rounded-xl border border-sky-500/25 bg-black/20 px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black text-white">KES {Number(requestItem.amount || 0).toLocaleString()} • awaiting approval</p>
                                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{requestItem.note || 'Cash handoff wallet credit request'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleNudgeWalletCreditRequest(requestItem)}
                                        className="px-3 py-2 rounded-lg border border-sky-500/35 bg-sky-500/15 text-sky-300 text-[10px] font-black uppercase tracking-widest hover:bg-sky-500/25"
                                    >
                                        Nudge Chairman
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}


                {/* Member Gameweek Funding & Arrears Audit */}
                <section className="fc-card mb-8 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151c18] overflow-hidden shadow-xl">
                    <div className="p-5 md:p-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-1 sm:mt-0">
                                <ReceiptText className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-black text-lg text-slate-900 dark:text-white">Gameweek Funding & Arrears Audit</h3>
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                        Since GW{leagueStartGw}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                    Track member contributions, skipped gameweeks, and outstanding dues across active rounds.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                            <button
                                type="button"
                                onClick={() => setIsAuditExpanded((prev) => !prev)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 transition-all cursor-pointer"
                            >
                                <span>{isAuditExpanded ? 'Collapse Audit ▲' : 'View Audit Details ▼'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Metric Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 md:p-6 bg-slate-50/80 dark:bg-black/20 border-b border-slate-200/60 dark:border-white/5">
                        <div className="p-3 rounded-2xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.07] border border-emerald-500/30 dark:border-emerald-500/20 col-span-2 sm:col-span-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Raised / Deposited</p>
                                <p className="text-lg sm:text-xl font-black tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                                    {isStealthMode ? 'KES ****' : <AnimatedKes amount={seasonDepositedTotal} className="tabular-nums" />}
                                </p>
                            <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">Total member pot contributions</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 shadow-xs">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-gray-400">Total Arrears Owed</p>
                            <p className={clsx("text-lg sm:text-xl font-black tabular-nums mt-0.5", totalChamaArrears > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                                {isStealthMode ? 'KES ****' : <AnimatedKes amount={totalChamaArrears} className="tabular-nums" />}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">{totalChamaArrears > 0 ? `${skippedMembersCount} members behind` : "All accounts square"}</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 shadow-xs">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-gray-400">Rounds Tracked</p>
                            <p className="text-lg sm:text-xl font-black tabular-nums text-slate-900 dark:text-white mt-0.5">
                                {totalCompletedOrCurrentGws} GW{totalCompletedOrCurrentGws !== 1 ? 's' : ''}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">GW{leagueStartGw} → GW{Math.max(leagueStartGw, Number(currentGwNumber || leagueStartGw))}</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 shadow-xs">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-gray-400">Fully Funded</p>
                            <p className="text-lg sm:text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {fundedMembersCount} <span className="text-xs font-normal text-slate-500 dark:text-gray-400">/ {regularMembersCount}</span>
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">Active pot contenders</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 shadow-xs">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-gray-400">Spectators</p>
                            <p className="text-lg sm:text-xl font-black tabular-nums text-indigo-600 dark:text-indigo-300 mt-0.5">
                                {spectatorsCount}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">1v1 bets only (exempt)</p>
                        </div>
                    </div>

                    {/* Weekly Pot Balancing Indicator */}
                    <div className="px-4 py-3 md:px-6 bg-emerald-500/[0.06] dark:bg-emerald-500/[0.04] border-b border-slate-200/60 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-700 dark:text-gray-300">GW{currentGwNumber || leagueStartGw || 1} Weekly Pot:</span>
                            <span className="font-black text-slate-900 dark:text-white tabular-nums">KES {currentGwCollectedWeekly.toLocaleString()}</span>
                            <span className="text-slate-500 dark:text-gray-400">collected of</span>
                            <span className="font-black text-emerald-700 dark:text-emerald-400 tabular-nums">KES {currentGwExpectedWeekly.toLocaleString()}</span>
                            <span className="text-slate-500 dark:text-gray-400">expected ({currentGwFundedMembers.length}/{activeChamaMembers.length} active players)</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {isWeeklyPotBalanced ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Pot Balanced for GW{currentGwNumber || leagueStartGw || 1}
                                </span>
                            ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Unbalanced: {currentGwUnfundedMembers.length} Pending
                                    </span>
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {currentGwUnfundedMembers.map((m: any) => (
                                            <span key={m.id} className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-semibold">
                                                {m.displayName} (KES {gameweekStake || 0} due)
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Member rows collapsible breakdown */}
                    {isAuditExpanded && (
                        <div>
                            {/* Filter Pills */}
                            <div className="p-4 md:px-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-black/10">
                                <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-black/40 p-1 rounded-xl border border-slate-300 dark:border-white/10 overflow-x-auto self-start md:self-auto w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setFundingAuditFilter('all')}
                                        className={clsx(
                                            'px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                                            fundingAuditFilter === 'all'
                                                ? 'bg-emerald-500 text-black shadow-xs font-black'
                                                : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                                        )}
                                    >
                                        All ({memberFundingSummary.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFundingAuditFilter('skipped')}
                                        className={clsx(
                                            'px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
                                            fundingAuditFilter === 'skipped'
                                                ? 'bg-rose-500 text-white shadow-xs font-black'
                                                : 'text-rose-600 hover:text-rose-700 dark:text-rose-400/90 dark:hover:text-rose-300'
                                        )}
                                    >
                                        <span>Behind / Skipped</span>
                                        <span className={clsx(
                                            "px-1.5 py-0.2 rounded-full text-[10px] font-black border",
                                            fundingAuditFilter === 'skipped'
                                                ? "bg-white/20 text-white border-white/30"
                                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                        )}>
                                            {skippedMembersCount}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFundingAuditFilter('funded')}
                                        className={clsx(
                                            'px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                                            fundingAuditFilter === 'funded'
                                                ? 'bg-emerald-500 text-black shadow-xs font-black'
                                                : 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-400/90 dark:hover:text-emerald-300'
                                        )}
                                    >
                                        Up to Date ({fundedMembersCount})
                                    </button>
                                    {spectatorsCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setFundingAuditFilter('spectators')}
                                            className={clsx(
                                                'px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                                                fundingAuditFilter === 'spectators'
                                                    ? 'bg-indigo-500 text-white shadow-xs font-black'
                                                    : 'text-indigo-700 hover:text-indigo-800 dark:text-indigo-400/90 dark:hover:text-indigo-300'
                                            )}
                                        >
                                            Spectators ({spectatorsCount})
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredAuditMembers.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 dark:text-gray-500 text-sm">
                                    No members found in this audit filter.
                                </div>
                            ) : (
                                filteredAuditMembers.map((m: any) => {
                                    const isCurrentUser = m.id === activeUserId || (currentUser && m.phone && m.phone === currentUser.phone);
                                    return (
                                        <div key={m.id} className="p-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <UserAvatar name={m.displayName} size="md" />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-slate-900 dark:text-white text-sm truncate">{m.displayName}</span>
                                                        {isCurrentUser && (
                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                                                You
                                                            </span>
                                                        )}
                                                        {m.role === 'admin' && (
                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                                                Admin
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-gray-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className="font-mono">{m.phone || 'No phone'}</span>
                                                        <span>•</span>
                                                        <span>Received: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">KES {Number(m.totalDeposited || 0).toLocaleString()}</strong></span>
                                                        <span>•</span>
                                                        <span>Wallet: <strong className="text-slate-800 dark:text-gray-300 font-mono">KES {Number(m.walletBalance || 0).toLocaleString()}</strong></span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status & Arrears */}
                                            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 flex-wrap">
                                                <div className="text-left sm:text-right">
                                                    {m.isPendingOnboarding ? (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                                                                <Clock3 className="w-3 h-3 text-amber-400" />
                                                                Pending Onboarding
                                                            </span>
                                                            <p className="text-[10px] text-gray-500 mt-0.5">Invited · Awaiting Profile Link</p>
                                                        </div>
                                                    ) : m.isSpectator ? (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider">
                                                                Spectator (Exempt)
                                                            </span>
                                                            <p className="text-[10px] text-gray-500 mt-0.5">1v1 Side-Bets Only</p>
                                                        </div>
                                                    ) : m.gwsSkippedCount > 0 ? (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider">
                                                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                                                Skipped {m.gwsSkippedCount} GW{m.gwsSkippedCount > 1 ? 's' : ''}
                                                            </span>
                                                            <p className="text-xs font-black text-rose-400 mt-0.5 tabular-nums">
                                                                KES {m.totalOwedArrears.toLocaleString()} Owed
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                                                                <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                                                                Fully Funded
                                                            </span>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                                {m.gwsFundedCount} GW{m.gwsFundedCount !== 1 ? 's' : ''} covered
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Tagged Gameweek Badges */}
                                                {m.recentGwsFunded && m.recentGwsFunded.length > 0 && (
                                                    <div className="flex items-center gap-1 flex-wrap max-w-[200px] justify-start sm:justify-end">
                                                        {m.recentGwsFunded.slice(0, 4).map((gw: any, idx: number) => (
                                                            <span key={idx} className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                GW{gw}
                                                            </span>
                                                        ))}
                                                        {m.recentGwsFunded.length > 4 && (
                                                            <span className="text-[9px] text-gray-500 font-bold">
                                                                +{m.recentGwsFunded.length - 4}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Action Button */}
                                                {isAdmin && !m.isPendingOnboarding && m.gwsSkippedCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleNudgeArrears(m)}
                                                        className="px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <MessageCircle className="w-3 h-3" />
                                                        <span>Nudge WhatsApp</span>
                                                    </button>
                                                )}
                                                {isCurrentUser && !m.isPendingOnboarding && m.gwsSkippedCount > 0 && !isAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate('/deposit')}
                                                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                                    >
                                                        Pay Dues
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
                </section>

                <div className="fc-card bg-[#151c18] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-5 md:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-bold text-lg text-white">Recent Activity</h3>
                            <span className="text-[10px] uppercase tracking-widest font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {seasonFilter === 'current' ? '2026/27 Season' : 'All Time'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 w-fit">
                            <button
                                type="button"
                                onClick={() => setSeasonFilter('current')}
                                className={clsx(
                                    'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                                    seasonFilter === 'current'
                                        ? 'bg-emerald-500 text-black shadow-sm'
                                        : 'text-gray-400 hover:text-white'
                                )}
                            >
                                Current Season
                            </button>
                            <button
                                type="button"
                                onClick={() => setSeasonFilter('all')}
                                className={clsx(
                                    'px-3 py-1 rounded-lg text-xs font-bold transition-all',
                                    seasonFilter === 'all'
                                        ? 'bg-emerald-500 text-black shadow-sm'
                                        : 'text-gray-400 hover:text-white'
                                )}
                            >
                                All History
                            </button>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-white/5">
                        {displayedTransactions.length > 0 ? displayedTransactions.slice(0, 7).map((tx: any) => {
                            const isWalletFunding = tx.type === 'wallet_funding'
                                || String(tx.receiptId || '').startsWith('SEED_')
                                || String(tx.note || '').toUpperCase().includes('ADMIN_PREFUND')
                                || String(tx.note || '').toLowerCase().includes('wallet top-up')
                                || tx.paymentMethod === 'cash_handoff';
                            // @ts-ignore
                                            const isChairmanSeed = String(tx.note || '').toUpperCase().includes('ADMIN_PREFUND')
                                || String(tx.receiptId || '').startsWith('SEED_');
                            // Resolve real member name: tx field > store lookup > fallback
                            const resolvedMember = members.find(
                                (m: any) => m.id === (tx.memberId || tx.userId || tx.winnerId)
                                    || m.authUid === (tx.memberId || tx.userId)
                            );
                            const memberName = tx.memberName || tx.winnerName
                                || resolvedMember?.displayName
                                || 'Member';
                            const isReversal = Number(tx.amount || 0) < 0
                                || tx.type === 'ledger_adjustment'
                                || tx.source === 'manual_reversal'
                                || String(tx.receiptId || '').startsWith('REV');
                            const isPayout = tx.type === 'payout';
                            const ledgerDirection = isReversal ? '-' : isPayout ? (isAdmin ? '-' : '+') : '+';
                            const safeTxId = typeof tx.id === 'string' ? tx.id : 'UNKNOWN';
                            const statusLabel = isReversal
                                ? 'Reversal'
                                : isWalletFunding
                                    ? 'Wallet Credit'
                                    : ledgerDirection === '+'
                                        ? 'Inflow'
                                        : 'Outflow';
                            const activeCurrentGw = Number(currentGwNumber || leagueStartGw || 6);
                            const rawTxGw = Number(tx.gameweek || tx.gw || 0);
                            const targetTxGw = rawTxGw > 0 ? (rawTxGw > activeCurrentGw ? activeCurrentGw : rawTxGw) : activeCurrentGw;
                            const gwTag = `GW${targetTxGw}`;
                            const rawNote = String(tx.note || '').trim();
                            const sanitizedNote = rawNote.replace(/gw\s*7/gi, `GW${activeCurrentGw}`).replace(/gameweek\s*7/gi, `Gameweek ${activeCurrentGw}`);
                            const activityLabel = isReversal
                                ? `Reversal • ${memberName}`
                                : tx.type === 'payout'
                                    ? `GW${targetTxGw} Payout → ${tx.winnerName || memberName}`
                                    : isWalletFunding
                                        ? `Wallet Credit → ${memberName}`
                                        : `Deposit • ${memberName}`;
                            const subLabel = sanitizedNote || (isWalletFunding ? `Wallet Top-Up • ${gwTag}` : `Deposit • ${gwTag}`);
                            return (
                                <div key={tx.id} className="p-4 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className={clsx(
                                            'text-sm font-extrabold',
                                            isReversal ? 'text-[#FBBF24]' : ledgerDirection === '+' ? 'text-[#10B981]' : 'text-[#FBBF24]'
                                        )}>
                                            {ledgerDirection} KES {Math.abs(Number(tx.amount || 0)).toLocaleString()}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {gwTag && (
                                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                    {gwTag}
                                                </span>
                                            )}
                                            <span className={clsx(
                                                'text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border',
                                                isReversal
                                                    ? 'bg-amber-500/15 text-[#FBBF24] border-amber-500/30'
                                                    : isWalletFunding || ledgerDirection === '+'
                                                    ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
                                                    : 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20'
                                            )}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-sm">
                                            {activityLabel}
                                        </div>
                                        {subLabel && (
                                            <div className="text-xs text-gray-400 font-normal mt-0.5">
                                                {subLabel}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-white/5">
                                        <span>{tx.receiptId || `TXN${safeTxId.substring(0, 8).toUpperCase()}`}</span>
                                        <div className="flex items-center gap-1.5">
                                            {tx.type === 'payout' && (() => {
                                                const isWinnerOfTx = Boolean(
                                                    currentUser && (
                                                        (currentUser.id && (tx.memberId === currentUser.id || tx.userId === currentUser.id)) ||
                                                        (currentUser.phone && (tx.phoneNumber === currentUser.phone || tx.phone === currentUser.phone || tx.winnerPhone === currentUser.phone)) ||
                                                        (currentUser.displayName && (tx.memberName === currentUser.displayName || tx.winnerName === currentUser.displayName || tx.playerName === currentUser.displayName))
                                                    )
                                                );
                                                if (!isAdmin && !isWinnerOfTx) return null;
                                                const isChairmanShare = isAdmin && !isWinnerOfTx;
                                                return (
                                                    <button
                                                        onClick={() => setSelectedPayoutForFlex(tx)}
                                                        className={clsx(
                                                            "px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider transition-colors flex items-center gap-1",
                                                            isChairmanShare
                                                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                                                : "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                                                        )}
                                                        title={isChairmanShare ? "Announce Winner as Chairman" : "Share Victory Card"}
                                                    >
                                                        {isChairmanShare ? (
                                                            <>
                                                                <Crown className="w-2.5 h-2.5 text-emerald-400" />
                                                                Announce
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Trophy className="w-2.5 h-2.5 text-amber-400" />
                                                                Flex
                                                            </>
                                                        )}
                                                    </button>
                                                );
                                            })()}
                                            <button
                                                onClick={() => shareTransactionReceipt(tx)}
                                                className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[9px] font-black uppercase tracking-wider text-slate-800 dark:text-white transition-colors cursor-pointer"
                                            >
                                                Share
                                            </button>
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => setTxToDelete(tx)}
                                                    className="px-1.5 py-1 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 transition-colors cursor-pointer"
                                                    title="Delete this transaction (Chairman)"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
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
                        <table className="fc-muted-table w-full min-w-[700px] text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-[#0a100a]/50">
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase">RECEIPT NO.</th>
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase">DATE / TIME</th>
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase">DESCRIPTION</th>
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase text-right">AMOUNT</th>
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase text-center">STATUS</th>
                                    <th className="px-6 py-4 font-bold text-[11px] fc-meta-label tracking-widest uppercase text-right">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {displayedTransactions.length > 0 ? (
                                    displayedTransactions.slice(0, 7).map((tx: any) => {
                                        const isWalletFunding = tx.type === 'wallet_funding'
                                            || String(tx.receiptId || '').startsWith('SEED_')
                                            || String(tx.note || '').toUpperCase().includes('ADMIN_PREFUND')
                                            || String(tx.note || '').toLowerCase().includes('wallet top-up')
                                            || tx.paymentMethod === 'cash_handoff';
                                        // @ts-ignore
                                            const isChairmanSeed = String(tx.note || '').toUpperCase().includes('ADMIN_PREFUND')
                                            || String(tx.receiptId || '').startsWith('SEED_');
                                        // Resolve real member name: tx field > store lookup > fallback
                                        const resolvedMember = members.find(
                                            (m: any) => m.id === (tx.memberId || tx.userId || tx.winnerId)
                                                || m.authUid === (tx.memberId || tx.userId)
                                        );
                                        const memberName = tx.memberName || tx.winnerName
                                            || resolvedMember?.displayName
                                            || 'Member';
                                        const isReversal = Number(tx.amount || 0) < 0
                                            || tx.type === 'ledger_adjustment'
                                            || tx.source === 'manual_reversal'
                                            || String(tx.receiptId || '').startsWith('REV');
                                        const isPayout = tx.type === 'payout';
                                        const ledgerDirection = isReversal ? '-' : isPayout ? (isAdmin ? '-' : '+') : '+';
                                        const safeTxId = typeof tx.id === 'string' ? tx.id : 'UNKNOWN';
                                        const activeCurrentGw = Number(currentGwNumber || leagueStartGw || 6);
                                        const rawTxGw = Number(tx.gameweek || tx.gw || 0);
                                        const targetTxGw = rawTxGw > 0 ? (rawTxGw > activeCurrentGw ? activeCurrentGw : rawTxGw) : activeCurrentGw;
                                        const gwTag = `GW${targetTxGw}`;
                                        const rawNote = String(tx.note || '').trim();
                                        const sanitizedNote = rawNote.replace(/gw\s*7/gi, `GW${activeCurrentGw}`).replace(/gameweek\s*7/gi, `Gameweek ${activeCurrentGw}`);
                                        const statusLabel = isReversal
                                            ? 'Reversal'
                                            : isWalletFunding
                                                ? 'Wallet Credit'
                                                : ledgerDirection === '+'
                                                    ? 'Inflow'
                                                    : 'Outflow';
                                        const activityLabel = isReversal
                                            ? `Reversal • ${memberName}`
                                            : tx.type === 'payout'
                                                ? `GW${targetTxGw} Payout → ${tx.winnerName || memberName}`
                                                : isWalletFunding
                                                    ? `Wallet Credit → ${memberName}`
                                                    : `Deposit • ${memberName}`;
                                        return (
                                            <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4 text-xs font-mono text-gray-500">
                                                    {tx.receiptId || `TXN${safeTxId.substring(0, 8).toUpperCase()}`}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-white">
                                                            {txDate(tx) ? txDate(tx)?.toLocaleDateString() : 'Just now'}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500">
                                                            {txDate(tx) ? txDate(tx)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-white flex items-center gap-2">
                                                        <span>{activityLabel}</span>
                                                        {gwTag && (
                                                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                                {gwTag}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                                        {isReversal
                                                            ? `Manual Reversal • ${tx.receiptId || 'Adjustment'}`
                                                            : tx.type === 'payout'
                                                            ? `GW ${tx.gameweek || tx.gw || 'N/A'} • ${tx.winnerPhone || tx.phoneNumber || 'phone not set'}`
                                                            : (sanitizedNote || `${gwTag ? `Funded for Gameweek ${targetTxGw} • ` : ''}Receipt: ${tx.mpesaCode || tx.receiptId || 'N/A'}`)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={clsx(
                                                        'font-bold text-sm',
                                                        isReversal ? 'text-[#FBBF24]' : ledgerDirection === '+' ? 'text-[#10B981]' : 'text-[#FBBF24]'
                                                    )}>
                                                        {ledgerDirection} KES {Math.abs(Number(tx.amount || 0)).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={clsx(
                                                        'inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md border',
                                                        isReversal
                                                            ? 'bg-amber-500/15 text-[#FBBF24] border-amber-500/30'
                                                            : isWalletFunding || ledgerDirection === '+'
                                                            ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                                            : 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20'
                                                    )}>
                                                        {statusLabel}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {tx.type === 'payout' && (() => {
                                                            const isWinnerOfTx = Boolean(
                                                                currentUser && (
                                                                    (currentUser.id && (tx.memberId === currentUser.id || tx.userId === currentUser.id)) ||
                                                                    (currentUser.phone && (tx.phoneNumber === currentUser.phone || tx.phone === currentUser.phone || tx.winnerPhone === currentUser.phone)) ||
                                                                    (currentUser.displayName && (tx.memberName === currentUser.displayName || tx.winnerName === currentUser.displayName || tx.playerName === currentUser.displayName))
                                                                )
                                                            );
                                                            if (!isAdmin && !isWinnerOfTx) return null;
                                                            const isChairmanShare = isAdmin && !isWinnerOfTx;
                                                            return (
                                                                <button
                                                                    onClick={() => setSelectedPayoutForFlex(tx)}
                                                                    className={clsx(
                                                                        "px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1",
                                                                        isChairmanShare
                                                                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                                                            : "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                                                                    )}
                                                                    title={isChairmanShare ? "Announce Winner as Chairman" : "Share Victory Card"}
                                                                >
                                                                    {isChairmanShare ? (
                                                                        <>
                                                                            <Crown className="w-3 h-3 text-emerald-400" />
                                                                            Announce
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Trophy className="w-3 h-3 text-amber-400" />
                                                                            Flex
                                                                        </>
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                        <button
                                                            onClick={() => shareTransactionReceipt(tx)}
                                                            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white transition-colors cursor-pointer"
                                                        >
                                                            Share
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setTxToDelete(tx)}
                                                                className="px-2 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 transition-colors cursor-pointer"
                                                                title="Delete this transaction (Chairman)"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            <ReceiptText className="w-10 h-10 mx-auto text-gray-600 mb-3 opacity-50" />
                                            <p className="font-medium text-white/70">No financial transactions recorded yet.</p>
                                            <p className="text-sm mt-1 opacity-50">When you deposit funds or the admin resolves a gameweek, receipts will appear here.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Collapsed Ledger Footer / Expand Button */}
                    {displayedTransactions.length > 0 && (
                        <div className="p-4 border-t border-white/5 bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-xs text-gray-400">
                                Showing {Math.min(7, displayedTransactions.length)} of {displayedTransactions.length} transactions
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsLedgerModalOpen(true)}
                                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                            >
                                <ReceiptText className="w-4 h-4 text-emerald-400" />
                                <span>Expand Activity / Full Ledger ({displayedTransactions.length})</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Full Ledger Modal ──────────────────────────────────────── */}
                {isLedgerModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
                        <div className="fc-card w-full max-w-5xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0d1410] border border-slate-200 dark:border-emerald-500/30 rounded-3xl overflow-hidden shadow-2xl">
                            {/* Modal Header */}
                            <div className="p-5 md:p-6 border-b border-slate-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-black/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                        <History className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-black text-lg text-slate-900 dark:text-white">Full Activity Ledger</h3>
                                            <span className="text-[10px] uppercase tracking-widest font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                                {filteredModalTransactions.length} Transactions
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                            {seasonFilter === 'current' ? '2026/27 Season complete ledger & audit log' : 'All-time transaction history'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={exportLedgerCSV}
                                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                    >
                                        <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span>Export CSV</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsLedgerModalOpen(false)}
                                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-all cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Search and Filters Bar */}
                            <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="relative w-full sm:w-72">
                                    <Search className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={ledgerModalSearch}
                                        onChange={(e) => setLedgerModalSearch(e.target.value)}
                                        placeholder="Search member, receipt, or note..."
                                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                                    />
                                    {ledgerModalSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setLedgerModalSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-gray-500 dark:hover:text-white text-xs cursor-pointer"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-black/40 p-1 rounded-xl border border-slate-300/80 dark:border-white/10 overflow-x-auto w-full sm:w-auto">
                                    {(['all', 'deposits', 'payouts', 'reversals'] as const).map((filterKey) => (
                                        <button
                                            key={filterKey}
                                            type="button"
                                            onClick={() => setLedgerModalFilter(filterKey)}
                                            className={clsx(
                                                'px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize whitespace-nowrap cursor-pointer',
                                                ledgerModalFilter === filterKey
                                                    ? 'bg-emerald-500 text-black shadow-xs font-black'
                                                    : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                                            )}
                                        >
                                            {filterKey === 'all' ? 'All' : filterKey === 'deposits' ? 'Inflows / Deposits' : filterKey === 'payouts' ? 'Payouts' : 'Reversals'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scrollable Modal Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {/* Desktop Table View in Modal */}
                                <div className="hidden md:block w-full overflow-x-auto">
                                    <table className="fc-muted-table w-full min-w-[700px] text-left">
                                        <thead className="sticky top-0 bg-slate-50 dark:bg-[#0a100a] z-10 border-b border-slate-200 dark:border-white/10">
                                            <tr>
                                                <th className="px-6 py-3 font-bold text-[11px] fc-meta-label tracking-widest uppercase">RECEIPT NO.</th>
                                                <th className="px-6 py-3 font-bold text-[11px] fc-meta-label tracking-widest uppercase">DATE / TIME</th>
                                                <th className="px-6 py-3 font-bold text-[11px] fc-meta-label tracking-widest uppercase">DESCRIPTION</th>
                                                <th className="px-6 py-3 font-bold text-[11px] fc-meta-label tracking-widest uppercase text-right">AMOUNT</th>
                                                <th className="px-6 py-3 font-bold text-[11px] fc-meta-label tracking-widest uppercase text-center">STATUS</th>
                                                <th className="px-6 py-3 font-bold text-[11px] fc-meta-label tracking-widest uppercase text-right">ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {filteredModalTransactions.length > 0 ? (
                                                filteredModalTransactions.map((tx: any) => {
                                                    const isWalletFunding = tx.type === 'wallet_funding'
                                                        || String(tx.receiptId || '').startsWith('SEED_')
                                                        || String(tx.note || '').toUpperCase().includes('ADMIN_PREFUND')
                                                        || String(tx.note || '').toLowerCase().includes('wallet top-up')
                                                        || tx.paymentMethod === 'cash_handoff';
                                                    const resolvedMember = members.find(
                                                        (m: any) => m.id === (tx.memberId || tx.userId || tx.winnerId)
                                                            || m.authUid === (tx.memberId || tx.userId)
                                                    );
                                                    const memberName = tx.memberName || tx.winnerName || resolvedMember?.displayName || 'Member';
                                                    const isReversal = Number(tx.amount || 0) < 0
                                                        || tx.type === 'ledger_adjustment'
                                                        || tx.source === 'manual_reversal'
                                                        || String(tx.receiptId || '').startsWith('REV');
                                                    const isPayout = tx.type === 'payout';
                                                    const ledgerDirection = isReversal ? '-' : isPayout ? (isAdmin ? '-' : '+') : '+';
                                                    const safeTxId = typeof tx.id === 'string' ? tx.id : 'UNKNOWN';
                                                    const rawTxGw = Number(tx.gameweek || tx.gw || 0);
                                                    const targetTxGw = rawTxGw > 0 ? rawTxGw : leagueStartGw;
                                                    const gwTag = `GW${targetTxGw}`;
                                                    const rawNote = String(tx.note || '').trim();
                                                    const statusLabel = isReversal ? 'Reversal' : isWalletFunding ? 'Wallet Credit' : ledgerDirection === '+' ? 'Inflow' : 'Outflow';
                                                    const activityLabel = isReversal
                                                        ? `Reversal • ${memberName}`
                                                        : tx.type === 'payout'
                                                            ? `GW${targetTxGw} Payout → ${tx.winnerName || memberName}`
                                                            : isWalletFunding
                                                                ? `Wallet Credit → ${memberName}`
                                                                : `Deposit • ${memberName}`;

                                                    return (
                                                        <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-6 py-3.5 text-xs font-mono text-gray-500">
                                                                {tx.receiptId || `TXN${safeTxId.substring(0, 8).toUpperCase()}`}
                                                            </td>
                                                            <td className="px-6 py-3.5">
                                                                <div className="text-sm font-bold text-white">
                                                                    {txDate(tx) ? txDate(tx)?.toLocaleDateString() : 'Just now'}
                                                                </div>
                                                                <div className="text-[11px] text-gray-500">
                                                                    {txDate(tx) ? txDate(tx)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3.5">
                                                                <div className="text-sm font-bold text-white flex items-center gap-2">
                                                                    <span>{activityLabel}</span>
                                                                    {gwTag && (
                                                                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                                            {gwTag}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-400">
                                                                    {isReversal
                                                                        ? `Manual Reversal • ${tx.receiptId || 'Adjustment'}`
                                                                        : tx.type === 'payout'
                                                                        ? `GW ${tx.gameweek || tx.gw || 'N/A'} • ${tx.winnerPhone || tx.phoneNumber || 'phone not set'}`
                                                                        : (rawNote || `${gwTag ? `Funded for Gameweek ${targetTxGw} • ` : ''}Receipt: ${tx.mpesaCode || tx.receiptId || 'N/A'}`)}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3.5 text-right">
                                                                <span className={clsx(
                                                                    'font-bold text-sm',
                                                                    isReversal ? 'text-[#FBBF24]' : ledgerDirection === '+' ? 'text-[#10B981]' : 'text-[#FBBF24]'
                                                                )}>
                                                                    {ledgerDirection} KES {Math.abs(Number(tx.amount || 0)).toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-3.5 text-center">
                                                                <span className={clsx(
                                                                    'inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md border',
                                                                    isReversal
                                                                        ? 'bg-amber-500/15 text-[#FBBF24] border-amber-500/30'
                                                                        : isWalletFunding || ledgerDirection === '+'
                                                                        ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                                                        : 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20'
                                                                )}>
                                                                    {statusLabel}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-3.5 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {tx.type === 'payout' && (() => {
                                                                        const isWinnerOfTx = Boolean(
                                                                            currentUser && (
                                                                                (currentUser.id && (tx.memberId === currentUser.id || tx.userId === currentUser.id)) ||
                                                                                (currentUser.phone && (tx.phoneNumber === currentUser.phone || tx.phone === currentUser.phone || tx.winnerPhone === currentUser.phone)) ||
                                                                                (currentUser.displayName && (tx.memberName === currentUser.displayName || tx.winnerName === currentUser.displayName || tx.playerName === currentUser.displayName))
                                                                            )
                                                                        );
                                                                        if (!isAdmin && !isWinnerOfTx) return null;
                                                                        const isChairmanShare = isAdmin && !isWinnerOfTx;
                                                                        return (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setIsLedgerModalOpen(false);
                                                                                    setSelectedPayoutForFlex(tx);
                                                                                }}
                                                                                className={clsx(
                                                                                    "px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1 cursor-pointer",
                                                                                    isChairmanShare
                                                                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                                                                        : "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                                                                                )}
                                                                                title={isChairmanShare ? "Announce Winner as Chairman" : "Share Victory Card"}
                                                                            >
                                                                                {isChairmanShare ? (
                                                                                    <>
                                                                                        <Crown className="w-3 h-3 text-emerald-400" />
                                                                                        Announce
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <Trophy className="w-3 h-3 text-amber-400" />
                                                                                        Flex
                                                                                    </>
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    })()}
                                                                    <button
                                                                        onClick={() => shareTransactionReceipt(tx)}
                                                                        className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white transition-colors cursor-pointer"
                                                                    >
                                                                        Share
                                                                    </button>
                                                                    {isAdmin && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setTxToDelete(tx)}
                                                                            className="px-2 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 transition-colors cursor-pointer"
                                                                            title="Delete this transaction (Chairman)"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                        <ReceiptText className="w-10 h-10 mx-auto text-gray-600 mb-2 opacity-50" />
                                                        <p className="font-medium text-white/70">No matching transactions found.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View in Modal */}
                                <div className="md:hidden divide-y divide-slate-100 dark:divide-white/5">
                                    {filteredModalTransactions.length > 0 ? (
                                        filteredModalTransactions.map((tx: any) => {
                                            const isWalletFunding = tx.type === 'wallet_funding'
                                                || String(tx.receiptId || '').startsWith('SEED_')
                                                || String(tx.note || '').toUpperCase().includes('ADMIN_PREFUND')
                                                || String(tx.note || '').toLowerCase().includes('wallet top-up')
                                                || tx.paymentMethod === 'cash_handoff';
                                            const resolvedMember = members.find(
                                                (m: any) => m.id === (tx.memberId || tx.userId || tx.winnerId)
                                                    || m.authUid === (tx.memberId || tx.userId)
                                            );
                                            const memberName = tx.memberName || tx.winnerName || resolvedMember?.displayName || 'Member';
                                            const isReversal = Number(tx.amount || 0) < 0
                                                || tx.type === 'ledger_adjustment'
                                                || tx.source === 'manual_reversal'
                                                || String(tx.receiptId || '').startsWith('REV');
                                            const isPayout = tx.type === 'payout';
                                            const ledgerDirection = isReversal ? '-' : isPayout ? (isAdmin ? '-' : '+') : '+';
                                            const safeTxId = typeof tx.id === 'string' ? tx.id : 'UNKNOWN';
                                            const statusLabel = isReversal ? 'Reversal' : isWalletFunding ? 'Wallet Credit' : ledgerDirection === '+' ? 'Inflow' : 'Outflow';
                                            const rawTxGw = Number(tx.gameweek || tx.gw || 0);
                                            const targetTxGw = rawTxGw > 0 ? rawTxGw : (effectiveLeagueStartGw || 5);
                                            const gwTag = `GW${targetTxGw}`;
                                            const sanitizedNote = String(tx.note || '');
                                            const activityLabel = isReversal
                                                ? `Reversal • ${memberName}`
                                                : tx.type === 'payout'
                                                    ? `GW${targetTxGw} Payout → ${tx.winnerName || memberName}`
                                                    : isWalletFunding
                                                        ? `Wallet Credit → ${memberName}`
                                                        : `Deposit • ${memberName}`;
                                            const subLabel = sanitizedNote || (isWalletFunding ? `Wallet Top-Up • ${gwTag}` : `Deposit • ${gwTag}`);

                                            return (
                                                <div key={tx.id} className="p-4 flex flex-col gap-2 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className={clsx(
                                                            'text-sm font-extrabold',
                                                            isReversal ? 'text-amber-600 dark:text-[#FBBF24]' : ledgerDirection === '+' ? 'text-emerald-600 dark:text-[#10B981]' : 'text-amber-600 dark:text-[#FBBF24]'
                                                        )}>
                                                            {ledgerDirection} KES {Math.abs(Number(tx.amount || 0)).toLocaleString()}
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            {gwTag && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                                                    {gwTag}
                                                                </span>
                                                            )}
                                                            <span className={clsx(
                                                                'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border',
                                                                isReversal
                                                                    ? 'bg-amber-500/15 text-amber-700 dark:text-[#FBBF24] border-amber-500/30'
                                                                    : isWalletFunding || ledgerDirection === '+'
                                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-[#10B981] border-emerald-500/20'
                                                                    : 'bg-amber-500/10 text-amber-700 dark:text-[#FBBF24] border-amber-500/20'
                                                            )}>
                                                                {statusLabel}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                            {activityLabel}
                                                        </div>
                                                        {subLabel && (
                                                            <div className="text-xs text-slate-500 dark:text-gray-400 font-normal mt-0.5">
                                                                {subLabel}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-500 pt-1 border-t border-slate-100 dark:border-white/5">
                                                        <span className="font-mono">{tx.receiptId || `TXN${safeTxId.substring(0, 8).toUpperCase()}`}</span>
                                                        <div className="flex items-center gap-2">
                                                            {tx.type === 'payout' && (() => {
                                                                const isWinnerOfTx = Boolean(
                                                                    currentUser && (
                                                                        (currentUser.id && (tx.memberId === currentUser.id || tx.userId === currentUser.id)) ||
                                                                        (currentUser.phone && (tx.phoneNumber === currentUser.phone || tx.phone === currentUser.phone || tx.winnerPhone === currentUser.phone)) ||
                                                                        (currentUser.displayName && (tx.memberName === currentUser.displayName || tx.winnerName === currentUser.displayName || tx.playerName === currentUser.displayName))
                                                                    )
                                                                );
                                                                if (!isAdmin && !isWinnerOfTx) return null;
                                                                const isChairmanShare = isAdmin && !isWinnerOfTx;
                                                                return (
                                                                    <button
                                                                        onClick={() => {
                                                                            setIsLedgerModalOpen(false);
                                                                            setSelectedPayoutForFlex(tx);
                                                                        }}
                                                                        className={clsx(
                                                                            "px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer",
                                                                            isChairmanShare
                                                                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                                                                                : "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300 hover:bg-amber-400/20"
                                                                        )}
                                                                        title={isChairmanShare ? "Announce Winner as Chairman" : "Share Victory Card"}
                                                                    >
                                                                        {isChairmanShare ? (
                                                                            <>
                                                                                <Crown className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                                                                Announce
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Trophy className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                                                                Flex
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })()}
                                                            {isAdmin && (
                                                                <button
                                                                    onClick={() => setTxToDelete(tx)}
                                                                    className="px-2 py-1 rounded-md border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors cursor-pointer flex items-center gap-1"
                                                                    title="Delete ledger entry"
                                                                >
                                                                    <Trash2 className="w-2.5 h-2.5" />
                                                                    Delete
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => shareTransactionReceipt(tx)}
                                                                className="px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-[9px] font-black uppercase tracking-wider text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                                            >
                                                                Share
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-8 text-center text-slate-500 dark:text-gray-500">
                                            <ReceiptText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                            <p className="text-sm">No transactions match your search</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/40 flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-gray-400">
                                    Total Records: <strong className="text-slate-900 dark:text-white font-black">{filteredModalTransactions.length}</strong>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsLedgerModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-xs font-bold text-slate-800 dark:text-white transition-all cursor-pointer"
                                >
                                    Close Ledger
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Sleek In-Page M-Pesa Top-Up Modal ──────────────────────────── */}
                {showMpesaTopUpModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="w-full max-w-md bg-white dark:bg-[#0b1014] border border-slate-200 dark:border-emerald-500/30 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
                            {/* Modal Header */}
                            <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                            M-Pesa Wallet Top-Up
                                        </h3>
                                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Instant Chama Wallet Credit</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowMpesaTopUpModal(false)}
                                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-400 dark:hover:text-white transition-all cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 space-y-4">
                                {/* Quick Amount Selector */}
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-2 block">
                                        Select Amount (KES)
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            gameweekStake || 50,
                                            (gameweekStake || 50) * 2,
                                            (gameweekStake || 50) * 4,
                                        ].map((amt) => {
                                            const isSelected = Number(topUpCustomAmount || (gameweekStake || 50)) === amt;
                                            return (
                                                <button
                                                    key={amt}
                                                    type="button"
                                                    onClick={() => setTopUpCustomAmount(String(amt))}
                                                    className={clsx(
                                                        "py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                                                        isSelected
                                                            ? "bg-emerald-500 text-black border-emerald-400 font-extrabold shadow-md shadow-emerald-950/20"
                                                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 border-slate-200 dark:border-white/10"
                                                    )}
                                                >
                                                    KES {amt.toLocaleString()}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-2.5 relative">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={topUpCustomAmount}
                                            onChange={(e) => {
                                                const cleaned = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                                                setTopUpCustomAmount(cleaned);
                                            }}
                                            placeholder={`Custom Amount (e.g. KES ${gameweekStake || 50})`}
                                            className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 font-bold"
                                        />
                                    </div>
                                </div>

                                {/* Destination Pochi Number Card */}
                                <div
                                    onClick={() => {
                                        const phoneToCopy = String((leagueSettings as any)?.paymentDetails?.accountNumber || (leagueSettings as any)?.payoutPhone || '0728445771');
                                        navigator.clipboard.writeText(phoneToCopy);
                                        setCopiedPochiPhone(true);
                                        toast.success(`Copied Chairman's Pochi number (${phoneToCopy})!`);
                                        setTimeout(() => setCopiedPochiPhone(false), 2000);
                                    }}
                                    className={clsx(
                                        "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group select-none",
                                        copiedPochiPhone
                                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-[1.01]"
                                            : "border-emerald-500/25 bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                                    )}
                                    title="Click to copy phone number"
                                >
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Chairman Pochi Destination</span>
                                            <span className="text-[8px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-black">Tap to copy</span>
                                        </div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5 tracking-wider">
                                            {(leagueSettings as any)?.paymentDetails?.accountNumber || (leagueSettings as any)?.payoutPhone || '0728445771'}
                                        </p>
                                        <p className="text-[10px] text-slate-600 dark:text-gray-400">Recipient: Brian Kiprono (Chairman)</p>
                                    </div>
                                    <div className={clsx(
                                        "px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0",
                                        copiedPochiPhone
                                            ? "bg-emerald-500 text-black border-emerald-400 shadow-md font-extrabold"
                                            : "bg-slate-100 dark:bg-white/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 group-hover:bg-emerald-200/50 dark:group-hover:bg-emerald-500/20"
                                    )}>
                                        {copiedPochiPhone ? 'Copied! ✓' : 'Copy'}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-2 pt-1">
                                    <button
                                        type="button"
                                        disabled={isPushingTopUpMpesa}
                                        onClick={async () => {
                                            const amt = Number(topUpCustomAmount || gameweekStake || 50);
                                            if (!amt || amt <= 0) {
                                                alert('Please enter a valid deposit amount');
                                                return;
                                            }
                                            setIsPushingTopUpMpesa(true);
                                            try {
                                                navigate(`/deposit?amount=${amt}`);
                                                setShowMpesaTopUpModal(false);
                                            } finally {
                                                setIsPushingTopUpMpesa(false);
                                            }
                                        }}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                                    >
                                        <Wallet className="w-4 h-4" />
                                        Launch Instant M-Pesa Checkout (KES {Number(topUpCustomAmount || gameweekStake || 50).toLocaleString()})
                                    </button>

                                    <a
                                        href="tel:*334#"
                                        className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 dark:hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                                    >
                                        Dial *334# (Pochi la Biashara)
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Season Vault Trajectory Graph ──────────────────────────── */}
                {(() => {
                    const effectiveLeagueStart = leagueStartGw;
                    const totalSeasonGWs = Math.max(1, 38 - effectiveLeagueStart + 1);
                    const vaultRatePerGW = totalSecured > 0
                        ? totalSecured * (Number(rules.vault || 30) / 100)
                        : (Number(rules.vault || 30) / 100) * paidMembers.length * (gameweekStake || 0);
                    const completedSeasonGws = playedCompletedGws.length;

                    const effectiveCurrentGw = currentGwNumber || (effectiveLeagueStart + Math.max(0, completedSeasonGws - 1));

                    const chartData = Array.from({ length: totalSeasonGWs }, (_, i) => {
                        const roundGw = effectiveLeagueStart + i;
                        const isForfeitedRound = forfeitedGws.includes(roundGw);
                        const isPastOrCurrent = roundGw <= effectiveCurrentGw;
                        const isCurrentOrFuture = roundGw >= effectiveCurrentGw;

                        let actualVault: number | null = null;
                        let projectedVault: number | null = null;

                        if (isPastOrCurrent) {
                            if (roundGw === effectiveCurrentGw) {
                                actualVault = currentVault;
                            } else {
                                actualVault = isForfeitedRound ? 0 : Math.round(vaultRatePerGW * (i + 1));
                            }
                        }

                        if (isCurrentOrFuture) {
                            if (roundGw === effectiveCurrentGw) {
                                projectedVault = currentVault;
                            } else {
                                const stepsAhead = roundGw - effectiveCurrentGw;
                                projectedVault = currentVault + Math.round(vaultRatePerGW * stepsAhead);
                            }
                        }

                        return {
                            gw: `GW${roundGw}`,
                            actualVault,
                            projectedVault,
                            roundGw,
                        };
                    });
                    // Strict ledger verified: If seasonVaultCollectedSoFar <= 0, accumulated vault is STRICTLY 0 KES!
                    const currentVault = completedSeasonGws > 0 
                        ? (seasonVaultCollectedSoFar > 0 ? Math.min(completedSeasonGws * vaultRatePerGW, seasonVaultCollectedSoFar) : 0)
                        : 0;
                    const nonForfeitedRemaining = Math.max(0, (38 - effectiveLeagueStart + 1) - forfeitedGws.filter(g => g >= effectiveLeagueStart).length);
                    const projectedFinal = vaultRatePerGW * nonForfeitedRemaining;
                    const remainingLeagueGws = Math.max(0, nonForfeitedRemaining - completedSeasonGws);

                    return (
                        <div className="fc-card mt-8 bg-[#0b1014] border border-white/5 rounded-2xl p-6 md:p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-96 h-56 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                                        <h3 className="font-bold text-lg text-white">Season Vault Trajectory</h3>
                                    </div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Projected pot growth over {remainingLeagueGws} remaining gameweeks (GW{effectiveLeagueStart} → GW38)</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-right">
                                        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">Current</p>
                                        <p className="text-xl font-black text-emerald-400 tabular-nums">{isStealthMode ? 'KES ****' : <AnimatedKes amount={currentVault} className="tabular-nums" />}</p>
                                    </div>
                                    <div className="w-px bg-white/5" />
                                    <div className="text-right">
                                        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">By GW38</p>
                                        <p className="text-xl font-black text-amber-400 tabular-nums">{isStealthMode ? 'KES ****' : <AnimatedKes amount={projectedFinal} className="tabular-nums" />}</p>
                                    </div>
                                </div>
                            </div>
                            <div ref={chartHostRef} className="h-[240px] w-full min-w-0">
                                {showVaultChart && chartHostWidth > 0 ? (
                                <ResponsiveContainer width="100%" height={220} debounce={120}>
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                                        <defs>
                                            <linearGradient id="vaultGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                                                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="projectedVaultGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.15} />
                                                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="gw" tick={{ fill: '#4b5563', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} interval={5} />
                                        <YAxis tick={{ fill: '#4b5563', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                                        <Tooltip
                                            contentStyle={{ background: '#0b1014', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 14px' }}
                                            labelStyle={{ color: '#10B981', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                            itemStyle={{ color: '#fff', fontWeight: 800 }}
                                            formatter={(value: any, name: any) => {
                                                if (value === null || value === undefined) return ['', ''];
                                                const label = name === 'actualVault' ? 'Accrued to Date' : 'Projected Forecast';
                                                return [`KES ${Number(value).toLocaleString()}`, label];
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="actualVault"
                                            name="actualVault"
                                            stroke="#10B981"
                                            strokeWidth={2.5}
                                            fill="url(#vaultGradient)"
                                            dot={{ r: 3, fill: '#10B981' }}
                                            activeDot={{ r: 5, fill: '#10B981', strokeWidth: 0 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="projectedVault"
                                            name="projectedVault"
                                            stroke="#F59E0B"
                                            strokeWidth={2.5}
                                            strokeDasharray="5 5"
                                            fill="url(#projectedVaultGradient)"
                                            dot={false}
                                            activeDot={{ r: 5, fill: '#F59E0B', strokeWidth: 0 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                                ) : (
                                <div className="h-full w-full rounded-xl bg-black/20 border border-white/5" />
                                )}
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-5 mt-4 text-[10px] font-bold">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-1 bg-emerald-500 rounded-full inline-block" />
                                    <span className="text-gray-300">Accrued to Date (GW{effectiveLeagueStart} → GW{effectiveCurrentGw})</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-0 border-t-2 border-dashed border-amber-400 inline-block" />
                                    <span className="text-amber-400">Projected Growth (GW{effectiveCurrentGw} → GW38)</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 text-center mt-2 font-medium">
                                Vault grows by KES {vaultRatePerGW.toLocaleString()} per resolved GW · Projection assumes active roster retention.
                            </p>
                        </div>
                    );
                })()}

            {showSeasonCeremony && role === 'admin' && (
                <SeasonCeremonyModal
                    isOpen={showSeasonCeremony}
                    onClose={() => setShowSeasonCeremony(false)}
                    leagueName={leagueName}
                    seasonVaultTotal={Math.round(totalPreviewPayout || projectedSeasonVault || 0)}
                    winners={tiedSeasonVaultPreview.map((t: any) => ({
                        rank: t.rank,
                        isTied: t.isTied,
                        name: t.player_name,
                        teamName: t.entry_name,
                        percent: t.percentage,
                        amount: t.amount,
                    }))}
                    chairmanName={leagueSettings?.chairmanName || 'Chairman'}
                    leagueId={activeLeagueId || undefined}
                    members={activeMembers}
                />
            )}

            {selectedPayoutForFlex && (() => {
                const isWinnerOfSelected = Boolean(
                    currentUser && (
                        (currentUser.id && (selectedPayoutForFlex.memberId === currentUser.id || selectedPayoutForFlex.userId === currentUser.id)) ||
                        (currentUser.phone && (selectedPayoutForFlex.phoneNumber === currentUser.phone || selectedPayoutForFlex.phone === currentUser.phone || selectedPayoutForFlex.winnerPhone === currentUser.phone)) ||
                        (currentUser.displayName && (selectedPayoutForFlex.memberName === currentUser.displayName || selectedPayoutForFlex.winnerName === currentUser.displayName || selectedPayoutForFlex.playerName === currentUser.displayName))
                    )
                );
                const sharedBy = (isAdmin && !isWinnerOfSelected) ? 'chairman' : 'winner';
                const chairmanName = leagueSettings?.chairmanName || (currentUser?.displayName && isAdmin ? currentUser.displayName : 'Chairman');

                return (
                    <ChampionFlexCardModal
                        isOpen={Boolean(selectedPayoutForFlex)}
                        onClose={() => setSelectedPayoutForFlex(null)}
                        winnerName={selectedPayoutForFlex.winnerName || selectedPayoutForFlex.memberName || 'Gameweek Champion'}
                        teamName={selectedPayoutForFlex.teamName}
                        points={selectedPayoutForFlex.points || selectedPayoutForFlex.event_total || 0}
                        gameweek={selectedPayoutForFlex.gameweek || selectedPayoutForFlex.gw || ''}
                        amountWon={Number(selectedPayoutForFlex.amount || 0)}
                        leagueName={leagueName}
                        winType="gameweek"
                        sharedBy={sharedBy}
                        chairmanName={chairmanName}
                    />
                );
            })()}

            {/* Player Receipts & Float Breakdown Modal */}
            {showPlayerBreakdown && (() => {
                const totalReceipts = memberFundingSummary.reduce((sum, m: any) => sum + (m.totalDeposited || 0), 0);
                const totalFloat = memberFundingSummary.reduce((sum, m: any) => sum + (Number(m.walletBalance) || 0), 0);
                const regularPlayers = memberFundingSummary.filter((m: any) => !m.isSpectator);
                const avgReceipt = Math.round(totalReceipts / (regularPlayers.length || 1));

                return (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                        <div className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-indigo-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-white max-h-[85vh]">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">Player Receipts & Float</h3>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Live receipts across {regularPlayers.length} players</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPlayerBreakdown(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Informative Explanation */}
                            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">
                                💡 <strong>Receipts vs Available Float:</strong> Total Deposited tracks historical funds collected into the Chama. Available Float is the unspent wallet balance ready for future gameweeks.
                            </div>

                            {/* Summary Stat Grid */}
                            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 text-xs">
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-wider block">Total Receipts</span>
                                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">KES {totalReceipts.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-wider block">Avg / Player</span>
                                    <span className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">KES {avgReceipt.toLocaleString()}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-wider block">Float In Wallets</span>
                                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">KES {totalFloat.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Scrollable Members List */}
                            <div className="overflow-y-auto space-y-2 pr-1 max-h-[46vh] divide-y divide-slate-100 dark:divide-white/5">
                                {memberFundingSummary.map((m: any) => (
                                    <div key={m.id} className="pt-2 flex items-center justify-between text-xs">
                                        <div className="min-w-0 pr-2">
                                            <span className="text-slate-900 dark:text-white font-bold block truncate">{m.displayName}</span>
                                            <span className="text-[10px] text-slate-400 dark:text-gray-500">Available Float: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">KES {Number(m.walletBalance || 0).toLocaleString()}</strong></span>
                                        </div>
                                        <div className="text-right shrink-0 font-mono">
                                            <span className="text-indigo-600 dark:text-indigo-400 font-extrabold block">KES {m.totalDeposited.toLocaleString()}</span>
                                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Total Deposited</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setShowPlayerBreakdown(false)}
                                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-bold text-slate-700 dark:text-white transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Payouts Breakdown Modal (Weekly vs Season) */}
            {showPayoutsModal && (() => {
                const weeklySum = weeklyPayoutsList.reduce((acc, t) => acc + Number(t.amount || 0), 0);
                const seasonSum = seasonPayoutsList.reduce((acc, t) => acc + Number(t.amount || 0), 0);
                const displayedPayouts = payoutsFilter === 'weekly' 
                    ? weeklyPayoutsList 
                    : payoutsFilter === 'season' 
                    ? seasonPayoutsList 
                    : payoutTransactions;

                return (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                        <div className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-white max-h-[85vh]">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                        <Trophy className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">Chama Payouts Breakdown</h3>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Winnings disbursed to managers from the ledger</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPayoutsModal(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Informative Explanation */}
                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                                💡 <strong>Disbursed Payouts vs Season Vault:</strong> This ledger catalogues prize money already paid out to winners. Your <strong>Season Vault holds KES {seasonVaultCollectedSoFar.toLocaleString()}</strong> in accrued funds from played gameweeks (matures and pays out at GW38). Gameweek pots disburse when the Chairman approves & executes payouts in the Command Center.
                            </div>

                            {/* Summary Stat Grid */}
                            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 text-xs">
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-wider block">Total Paid Out</span>
                                    <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">KES {totalPayoutsYielded.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-wider block">GW Winnings Paid</span>
                                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">KES {weeklySum.toLocaleString()}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-wider block">Podiums Paid</span>
                                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">KES {seasonSum.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Filter Tabs */}
                            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setPayoutsFilter('all')}
                                    className={clsx(
                                        "flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer",
                                        payoutsFilter === 'all'
                                            ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-xs font-black"
                                            : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    All ({payoutTransactions.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPayoutsFilter('weekly')}
                                    className={clsx(
                                        "flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer",
                                        payoutsFilter === 'weekly'
                                            ? "bg-emerald-500 text-black shadow-xs font-black"
                                            : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    Weekly ({weeklyPayoutsList.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPayoutsFilter('season')}
                                    className={clsx(
                                        "flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer",
                                        payoutsFilter === 'season'
                                            ? "bg-amber-400 text-black shadow-xs font-black"
                                            : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    Season ({seasonPayoutsList.length})
                                </button>
                            </div>

                            {/* Payouts List */}
                            <div className="overflow-y-auto space-y-2.5 pr-1 max-h-[44vh] custom-scrollbar">
                                {displayedPayouts.length === 0 ? (
                                    <div className="py-8 text-center space-y-2">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 mx-auto flex items-center justify-center">
                                            <Trophy className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-gray-300">No Disbursed Payouts Yet</h4>
                                        <p className="text-[11px] text-slate-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                                            When gameweek winners or season championship podiums are approved and disbursed, transaction receipts, recipients, and amounts will be catalogued here.
                                        </p>
                                        <div className="pt-2 flex items-center justify-center gap-3 text-[10px] font-bold text-slate-500 dark:text-gray-400">
                                            <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">Accrued Season Vault: KES {seasonVaultCollectedSoFar.toLocaleString()}</span>
                                            <span>•</span>
                                            <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Matures at GW38</span>
                                        </div>
                                    </div>
                                ) : (
                                    displayedPayouts.map((tx: any, idx: number) => {
                                        const isSeason = tx.subtype === 'season' || (tx.description || '').toLowerCase().includes('season');
                                        const dateObj = txDate(tx);
                                        const dateStr = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Settled';
                                        return (
                                            <div 
                                                key={tx.id || idx}
                                                className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 text-xs"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={clsx(
                                                            "text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                                                            isSeason 
                                                                ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400"
                                                                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                                        )}>
                                                            {isSeason ? 'Season Vault' : `GW ${tx.gw || tx.gameweek || 'Round'}`}
                                                        </span>
                                                        <span className="font-bold text-slate-900 dark:text-white truncate">
                                                            {tx.winnerName || tx.memberName || tx.userName || tx.description || 'Champion'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 truncate">
                                                        {tx.receiptId ? `Ref: ${tx.receiptId}` : 'M-Pesa Disbursed'} · {dateStr}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono block">
                                                        KES {Number(tx.amount || 0).toLocaleString()}
                                                    </span>
                                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                                                        Settled ✓
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setShowPayoutsModal(false)}
                                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-bold text-slate-700 dark:text-white transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Chairman Delete Confirmation Modal */}
            {txToDelete && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="relative w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-rose-500/30 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Delete Ledger Entry?</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">This will permanently remove this transaction from the league ledger.</p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex flex-col gap-2 text-xs">
                            <div className="flex justify-between items-center text-slate-500 dark:text-gray-400">
                                <span>Receipt No:</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{txToDelete.receiptId || txToDelete.id}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-500 dark:text-gray-400">
                                <span>Member:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{txToDelete.memberName || txToDelete.winnerName || 'Member'}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-500 dark:text-gray-400">
                                <span>Amount:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">KES {Math.abs(Number(txToDelete.amount || 0)).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-500 dark:text-gray-400">
                                <span>Gameweek:</span>
                                <span className="font-bold text-amber-600 dark:text-amber-400">GW{txToDelete.gameweek || txToDelete.gw || 'N/A'}</span>
                            </div>
                        </div>

                        <p className="text-xs text-rose-700 dark:text-rose-300/80 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg p-2.5">
                            Are you sure you want to delete this ledger entry? Vault calculations and member statements will be recalculated automatically.
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setTxToDelete(null)}
                                disabled={isDeletingTx}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteTransaction}
                                disabled={isDeletingTx}
                                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isDeletingTx ? (
                                    <>Deleting...</>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete Entry
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
