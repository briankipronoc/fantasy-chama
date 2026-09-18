import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptText, History, Download, ShieldCheck, Wallet, TrendingUp, Clock3, Trophy, AlertTriangle, Check, MessageCircle } from 'lucide-react';
import UserAvatar from '../components/UserAvatar';
import { useStore } from '../store/useStore';
import { getApiBaseUrl } from '../utils/api';
import { collection, onSnapshot, query, orderBy, doc, getDoc, addDoc, updateDoc, serverTimestamp, where, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import clsx from 'clsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Header from '../components/Header';
import SeasonCeremonyModal from '../components/SeasonCeremonyModal';
import ChampionFlexCardModal from '../components/ChampionFlexCardModal';

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
    const { members, listenToLeagueMembers, isStealthMode, role, league: leagueSettings } = useStore();

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
                        const currentEvent = (bootstrapData?.events || []).find((event: any) => event.is_current);
                        if (!cancelled) {
                            setCurrentGwNumber(Number(currentEvent?.id || 0) || null);
                            setIsCurrentEventFinished(Boolean(currentEvent?.finished));
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
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

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
        if (!activeLeagueId || role !== 'admin') {
            setPendingApprovals([]);
            return;
        }

        const pendingRef = collection(db, 'leagues', activeLeagueId, 'pending_payouts');
        const pendingQuery = query(pendingRef, where('status', '==', 'awaiting_approval'));
        const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
            const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
            setPendingApprovals(items);
        }, (err) => {
            console.warn('[finances] pending approvals listener failed:', err?.message || err);
            setPendingApprovals([]);
        });

        return () => {
            try { unsubscribePending(); } catch (err) {
                console.warn('[finances] pending approvals listener cleanup failed:', err);
            }
        };
    }, [activeLeagueId, role]);

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

    const paidMembers = members.filter(m => m.hasPaid && m.isActive !== false);
    const totalSecured = paidMembers.length * (gameweekStake || 1400);
    const firstTransactionGw = transactions.reduce((minGw, tx) => {
        const value = Number(tx.gameweek || tx.gw || 999);
        return Number.isFinite(value) && value > 0 ? Math.min(minGw, value) : minGw;
    }, 999);
    
    const leagueStartGw = Number(startGw || (firstTransactionGw !== 999 ? firstTransactionGw : (currentGwNumber || 1)));
    
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    
    const toJoinedGw = (joinedMs?: number | null) => {
        if (!leagueCreatedAtMs || !joinedMs) return leagueStartGw;
        const weeksSinceStart = Math.max(0, Math.floor((joinedMs - leagueCreatedAtMs) / WEEK_MS));
        return Math.min(38, leagueStartGw + weeksSinceStart);
    };
    const contributionTypes = new Set(['deposit', 'wallet_funding', 'wallet_prefund', 'ledger_adjustment']);
    const isTxValidInflow = (tx: any) => {
        if (!contributionTypes.has(String(tx.type || ''))) return false;
        const status = String(tx.status || '').toLowerCase();
        if (status === 'reversed' || status === 'failed' || status === 'cancelled' || status === 'voided' || tx.isReversed === true || tx.reversed === true) {
            return false;
        }
        return true;
    };
    const seasonCollectedSoFarGross = transactions
        .filter(isTxValidInflow)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const seasonVaultCollectedSoFar = Math.round(seasonCollectedSoFarGross * (Number(rules.vault || 30) / 100));
    const contributionByMemberId = transactions
        .filter(isTxValidInflow)
        .reduce((acc: Record<string, number>, tx: any) => {
            const txMemberId = String(tx.userId || tx.memberId || '');
            if (txMemberId) {
                acc[txMemberId] = (acc[txMemberId] || 0) + Number(tx.amount || 0);
                return acc;
            }

            const phone = String(tx.phoneNumber || tx.winnerPhone || '');
            if (phone) {
                const matched = members.find((member) => String(member.phone || '') === phone);
                if (matched?.id) {
                    const key = String(matched.id);
                    acc[key] = (acc[key] || 0) + Number(tx.amount || 0);
                    return acc;
                }
            }

            const name = String(tx.memberName || tx.winnerName || '');
            if (name) {
                const matched = members.find((member) => String(member.displayName || '') === name);
                if (matched?.id) {
                    const key = String(matched.id);
                    acc[key] = (acc[key] || 0) + Number(tx.amount || 0);
                    return acc;
                }
            }
            return acc;
        }, {});
    const projectedRemainingCollectionsGross = members
        .filter((member) => member.isActive !== false)
        .reduce((sum, member: any) => {
            const joinedMs = member?.joinedAt?.toDate ? member.joinedAt.toDate().getTime() : leagueCreatedAtMs;
            const joinedGw = toJoinedGw(joinedMs);
            const effectiveMemberGw = Math.max(leagueStartGw, joinedGw);
            const memberSeasonCap = Math.max(0, (39 - effectiveMemberGw) * (gameweekStake || 1400));
            const collectedForMember = Number(contributionByMemberId[String(member.id)] || 0);
            const remainingForMember = Math.max(0, memberSeasonCap - collectedForMember);
            return sum + remainingForMember;
        }, 0);
    const projectedSeasonCollectionsGross = Math.max(0, seasonCollectedSoFarGross + projectedRemainingCollectionsGross);
    const projectedSeasonVault = projectedSeasonCollectionsGross * (rules.vault / 100);
    const activeMembers = members.filter((member) => member.isActive !== false && !(member as any).isEliminated && !(member as any).isPending);
    const activeMembersCount = activeMembers.length;
    const configuredWinnersCount = Number(rules.seasonWinnersCount || 3);
    const eligibleWinnersCount = Math.min(configuredWinnersCount, activeMembersCount || configuredWinnersCount);
    const seasonWinnersMode = String(rules.seasonWinnersMode || (configuredWinnersCount === 1 ? 'top1' : configuredWinnersCount === 5 ? 'top5' : 'top3'));

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

        const totalVault = Math.round(totalPreviewPayout || projectedSeasonVault || 0);
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
            const splitAmount = Math.round(totalVault * (splitPercent / 100));
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
                        amount: splitAmount,
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
                result.push({
                    tierIndex: pos,
                    rank: tier.place,
                    isTied: false,
                    percentage: tier.percentage,
                    amount: tier.amount,
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

    const totalPayoutsYielded = transactions
        .filter((t) => {
            if (t.type !== 'payout') return false;
            // Filter out payouts from prior season cycles before clean slate / reset
            if (lastResetAtMs) {
                const txTime = toMillis(t.timestamp);
                if (txTime && txTime < lastResetAtMs) return false;
            }
            // Filter out test payouts logged before official start gameweek
            const txGw = Number(t.gw || t.gameweek);
            if (Number.isFinite(txGw) && startGw && txGw < startGw) return false;
            return true;
        })
        .reduce((acc, t) => acc + (Number(t.amount || 0)), 0);

    // Member-only transaction log: their deposits + payout wins + wallet credits
    const myTransactions = isAdmin ? transactions : transactions.filter(tx =>
        (tx.type === 'deposit' && tx.phoneNumber === currentUser?.phone) ||
        (tx.type === 'payout' && (
            tx.winnerPhone === currentUser?.phone ||
            tx.winnerName === currentUser?.displayName
        )) ||
        (tx.type === 'wallet_funding' && (
            tx.memberId === activeUserId ||
            tx.memberName === currentUser?.displayName ||
            tx.phoneNumber === currentUser?.phone
        ))
    );

    const currentSeasonStartMs = new Date('2026-08-01T00:00:00Z').getTime();
    const displayedTransactions = myTransactions.filter((tx: any) => {
        const ts = toMillis(tx.timestamp);
        if (seasonFilter === 'current') {
            if (lastResetAtMs && ts && ts < lastResetAtMs) return false;
            if (ts && ts < currentSeasonStartMs) return false;
        }
        return true;
    });

    const memberTotalLoadedAllTime = useMemo(() => {
        if (!currentUser) return 0;
        const validDepositTxs = transactions.filter((tx: any) => {
            const isMatch = (
                (currentUser.id && (tx.memberId === currentUser.id || tx.userId === currentUser.id)) ||
                (currentUser.phone && (tx.phoneNumber === currentUser.phone || tx.phone === currentUser.phone)) ||
                (currentUser.displayName && (tx.memberName === currentUser.displayName || tx.playerName === currentUser.displayName))
            );
            if (!isMatch) return false;

            const isDeposit = tx.type === 'deposit' || tx.type === 'wallet_funding' || tx.type === 'manual_deposit' || tx.category === 'deposit';
            if (!isDeposit) return false;

            const status = String(tx.status || '').toLowerCase();
            if (status === 'reversed' || status === 'failed' || status === 'cancelled' || status === 'voided' || tx.isReversed === true || tx.reversed === true) {
                return false;
            }
            return true;
        });

        // Deduct any debit reversals / refunds
        const reversalTotal = transactions.filter((tx: any) => {
            const isMatch = (
                (currentUser.id && (tx.memberId === currentUser.id || tx.userId === currentUser.id)) ||
                (currentUser.phone && (tx.phoneNumber === currentUser.phone || tx.phone === currentUser.phone)) ||
                (currentUser.displayName && (tx.memberName === currentUser.displayName || tx.playerName === currentUser.displayName))
            );
            if (!isMatch) return false;
            return tx.type === 'reversal' || tx.type === 'refund' || tx.category === 'refund' || String(tx.status || '').toLowerCase() === 'refund';
        }).reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);

        const txDepositSum = validDepositTxs.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0) - reversalTotal;

        if (validDepositTxs.length > 0) {
            return Math.max(0, txDepositSum);
        }
        return Math.max(0, Number((currentUser as any)?.totalDeposited || 0) - reversalTotal);
    }, [transactions, currentUser]);


    const totalCompletedOrCurrentGws = useMemo(() => {
        const start = Math.max(1, Number(startGw || 1));
        const currentGw = Number(currentGwNumber || start);
        return Math.max(0, currentGw - start + 1);
    }, [startGw, currentGwNumber]);

    const memberFundingSummary = useMemo(() => {
        const start = Math.max(1, Number(startGw || 1));
        const currentGw = Number(currentGwNumber || start);
        const totalCompleted = Math.max(0, currentGw - start + 1);
        const stake = Number(gameweekStake || 0);

        return members
            .filter((m: any) => m.isActive !== false && (m as any).isEliminated !== true)
            .map((m: any) => {
                const isMemberSpectator = (m as any).playMode === 'sidebets_only';
                const memberBalance = Number(m.walletBalance || 0);
                const hasPaidCurrent = Boolean(m.hasPaid) || (stake > 0 && memberBalance >= stake);

                // Identify all deposit / inflow transactions associated with this member
                const memberInflowTxs = transactions.filter((tx: any) => {
                    if (!isTxValidInflow(tx)) return false;
                    return (
                        (m.id && (tx.memberId === m.id || tx.userId === m.id)) ||
                        (m.phone && (tx.phoneNumber === m.phone || tx.phone === m.phone)) ||
                        (m.displayName && (tx.memberName === m.displayName || tx.playerName === m.displayName))
                    );
                });

                const totalDeposited = memberInflowTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
                // In Chama play, each GW played costs 1x stake. Total GWs funded all-time based on contributions:
                const rawFundedCount = stake > 0 ? Math.floor(totalDeposited / stake) : totalCompleted;
                const gwsFundedCount = hasPaidCurrent ? Math.max(1, rawFundedCount) : rawFundedCount;
                const gwsSkippedCount = isMemberSpectator ? 0 : Math.max(0, totalCompleted - gwsFundedCount);
                const totalOwedArrears = isMemberSpectator ? 0 : gwsSkippedCount * stake;

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
                    walletBalance: memberBalance,
                    hasPaidCurrent,
                    totalDeposited,
                    gwsFundedCount,
                    gwsSkippedCount,
                    totalOwedArrears,
                    recentGwsFunded: taggedGws,
                };
            })
            .sort((a, b) => b.gwsSkippedCount - a.gwsSkippedCount);
    }, [members, transactions, startGw, currentGwNumber, gameweekStake]);

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
        const dueTs = toMillis((currentUser as any)?.nextDueAt) || toMillis((currentUser as any)?.dueAt) || toMillis((currentUser as any)?.deadlineAt) || (nowMs + 72 * 60 * 60 * 1000);
        const dueDate = new Date(dueTs);
        const nextDueStatus = isSpectator ? 'spectator' : (currentUser?.hasPaid ? 'on-time' : (dueTs >= nowMs ? 'grace' : 'overdue'));
        const nextDueLabel = isSpectator ? 'Spectator Mode' : (nextDueStatus === 'on-time' ? 'On Time' : nextDueStatus === 'grace' ? 'Grace Window' : 'Overdue');
        const nextDueTone = isSpectator
            ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400 dark:text-indigo-300'
            : (nextDueStatus === 'on-time'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : nextDueStatus === 'grace'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300');

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
            `🚨 *${leagueName || 'Fantasy Chama'} — Payment Arrears Notice*`,
            ``,
            `Habari *${member.displayName}*! 👋`,
            `Friendly reminder from the Chairman: according to our Chama ledger since league kickoff (GW${startGw || 1}), you have *${member.gwsSkippedCount} skipped gameweek${member.gwsSkippedCount > 1 ? 's' : ''}* with *KES ${Number(member.totalOwedArrears || 0).toLocaleString()}* in outstanding dues.`,
            ``,
            `Please clear your dues to ensure your squad remains eligible for weekly cash pots and season vault championship prizes! 🏆`,
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
            || tx.paymentMethod === 'cash_handoff';
        const title = tx.type === 'payout'
            ? 'Payout Receipt'
            : isWalletFunding
                ? 'Wallet Credit Receipt'
                : 'Deposit Receipt';
        const message = [
            `🧾 *${leagueName} ${title}*`,
            '',
            `Member: *${tx.memberName || tx.winnerName || 'Member'}*`,
            `Amount: *KES ${Number(tx.amount || 0).toLocaleString()}*`,
            tx.receiptId ? `Receipt: *${tx.receiptId}*` : '',
            tx.type === 'payout' ? `GW: *${tx.gw || tx.gameweek || 'N/A'}*` : '',
            '',
            `Powered by FantasyChama`,
        ].filter(Boolean).join('\n');

        openWhatsApp(message);
        showActionMessage('success', 'Receipt ready for WhatsApp share.');
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

            await addDoc(collection(db, 'leagues', activeLeagueId, 'transactions'), {
                type: 'wallet_funding',
                amount,
                memberId: requestItem.memberId,
                memberName: requestItem.memberName || 'Member',
                phoneNumber: requestItem.phone || null,
                paymentMethod: 'cash_handoff',
                receiptId: `CASH_TOPUP_${Date.now().toString().slice(-6)}`,
                note: requestItem.note || 'Manual cash handoff wallet top-up',
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
                        amount: payout.amount,
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
                approvedBy: auth.currentUser?.displayName || 'Admin',
                approvedAt: serverTimestamp()
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

            showActionMessage('success', `Resolved & paid ${payout.winnerName} (KES ${Number(payout.amount || 0).toLocaleString()}).`);
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
                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 mb-8">
                        <article className={clsx("fc-card rounded-2xl p-6 sm:p-7 border flex flex-col justify-between shadow-md", isSpectator ? "border-indigo-500/25 bg-gradient-to-br from-indigo-500/14 via-white dark:via-[#161d24] to-white dark:to-[#161d24]" : "border-emerald-500/25 bg-gradient-to-br from-emerald-500/14 via-white dark:via-[#161d24] to-white dark:to-[#161d24]")}>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <p className={clsx("text-[10px] font-black uppercase tracking-widest", isSpectator ? "text-indigo-600 dark:text-indigo-300" : "text-emerald-600 dark:text-emerald-300")}>
                                        {isSpectator ? "Pot Eligibility" : "Next Due"}
                                    </p>
                                    <Clock3 className={clsx("w-4 h-4", isSpectator ? "text-indigo-600 dark:text-indigo-300" : "text-emerald-600 dark:text-emerald-300")} />
                                </div>
                                <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">
                                    {isSpectator ? "Spectator (0 KES)" : `${Number(gameweekStake || 0).toLocaleString()} KES`}
                                </p>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2">
                                    {isSpectator ? "Playing Side Bets only · Free to view system" : `Deadline: ${dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                                </p>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2">
                                <span className={clsx('inline-flex px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border w-fit', nextDueTone)}>{nextDueLabel}</span>
                                {isSpectator && (
                                    <button
                                        onClick={() => navigate('/deposit', { state: { upgradeMode: true } })}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                    >
                                        Upgrade to Pot →
                                    </button>
                                )}
                            </div>
                        </article>

                        <article className="fc-card rounded-2xl p-6 sm:p-7 border border-blue-500/25 bg-gradient-to-br from-blue-500/14 via-white dark:via-[#161d24] to-white dark:to-[#161d24] flex flex-col justify-between shadow-md">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">
                                        Total Loaded (All-Time)
                                    </p>
                                    <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                                </div>
                                <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">
                                    KES {memberTotalLoadedAllTime.toLocaleString()}
                                </p>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2">
                                    All deposits and top-ups loaded for the 2026/27 season.
                                </p>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2">
                                <span className="inline-flex px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300">
                                    Current Balance: KES {Number(currentUser.walletBalance || 0).toLocaleString()}
                                </span>
                            </div>
                        </article>

                        <article className="fc-card fc-wallet-topup-card rounded-2xl p-5 sm:p-6 border border-emerald-500/25 bg-[#161d24] shadow-md sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Wallet Top-Up</p>
                                <Wallet className="w-4 h-4 text-emerald-400" />
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
                                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                                />
                                <input
                                    type="text"
                                    value={cashTopUpNote}
                                    onChange={(e) => setCashTopUpNote(e.target.value)}
                                    placeholder="Optional note"
                                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                                />
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <button
                                        onClick={() => navigate('/deposit')}
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
                        </article>
                    </section>
                )}

                {/* Main Treasury Metric Cards (1 Row with ample breathing room) */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 mb-8">
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
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30 text-emerald-500 dark:text-emerald-400">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                                                    {effectivePayoutMode === 'weekly_only'
                                                        ? "Projected Weekly Payout"
                                                        : effectivePayoutMode === 'season_only'
                                                        ? (seasonCardTab === 'collected' ? "Season Vault (Collected Now)" : "Projected Season Collection")
                                                        : projectedCardIndex === 0
                                                        ? "Projected Weekly Payout"
                                                        : (seasonCardTab === 'collected' ? "Season Vault (Collected Now)" : "Projected Season Collection")}
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
                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
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
                                                <div className="flex items-center gap-1 bg-black/10 dark:bg-black/40 p-0.5 rounded-lg border border-black/5 dark:border-white/10 shadow-xs">
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
                                            {effectivePayoutMode === 'season_only' && (
                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                                                    Season Only
                                                </span>
                                            )}
                                            {effectivePayoutMode === 'weekly_only' && (
                                                <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                                                    Weekly Only
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        {(effectivePayoutMode === 'weekly_only' || (effectivePayoutMode === 'both' && projectedCardIndex === 0)) ? (
                                            <>
                                                <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-gray-900 dark:text-white">
                                                    KES {isStealthMode ? '****' : projectedWeeklyPayout.toLocaleString()}
                                                </p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                                                    {projectedWeeklyPayoutFormula}
                                                </p>
                                            </>
                                        ) : seasonCardTab === 'collected' ? (
                                            <>
                                                <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-amber-400">
                                                    KES {isStealthMode ? '****' : seasonVaultCollectedSoFar.toLocaleString()}
                                                </p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                                                    Actual verified vault funds secured to date: KES {Number(seasonCollectedSoFarGross || 0).toLocaleString()} gross × {vaultPercent}% = KES {Number(seasonVaultCollectedSoFar || 0).toLocaleString()}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                                                    KES {isStealthMode ? '****' : projectedSeasonCollections.toLocaleString()}
                                                </p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                                                    {projectedSeasonCollectionsFormula}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Card 2: Total Payouts Yielded */}
                                <div className="fc-card bg-gradient-to-br from-[#FBBF24]/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] border border-[#FBBF24]/25 p-6 sm:p-7 rounded-[1.75rem] relative overflow-hidden flex flex-col justify-between shadow-lg min-h-[195px]">
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center border border-amber-500/30 text-amber-500 dark:text-amber-400">
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

                                    <div>
                                        <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-amber-600 dark:text-[#FBBF24]">
                                            KES {isStealthMode ? '****' : totalPayoutsYielded.toLocaleString()}
                                        </p>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed font-medium">
                                            {effectivePayoutMode === 'weekly_only'
                                                ? "Settled weekly gameweek payouts already disbursed and approved from the ledger."
                                                : effectivePayoutMode === 'season_only'
                                                ? "Settled season championship payouts already disbursed and approved from the ledger."
                                                : "Settled payouts already disbursed and approved from the ledger."}
                                        </p>
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {/* Card 3: League Treasury Split */}
                    {(() => {
                        const totalCollectedGross = totalSecured;
                        const hasCoAdmin = members.filter(m => m.role === 'admin' || m.role === 'co-chair').length > 1;
                        const chairmanRate = hasCoAdmin ? 0.03 : 0.04;
                        const coAdminRate = hasCoAdmin ? 0.01 : 0;
                        const chairmanShare = totalCollectedGross * chairmanRate;
                        const coChairShare = totalCollectedGross * coAdminRate;
                        const isPilot = (leagueSettings as any)?.pilotMode !== false;
                        const hqRate = isPilot ? 0 : 0.035;
                        const hqShare = totalCollectedGross * hqRate;
                        const networkShare = totalCollectedGross * 0.015;

                        return (
                            <div className="fc-card bg-gradient-to-br from-amber-500/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] border border-amber-500/25 p-5 sm:p-6 rounded-[1.75rem] relative overflow-hidden flex flex-col justify-between shadow-lg min-h-[195px]">
                                <div>
                                    <div className="flex items-center gap-2 mb-2.5">
                                        <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center border border-amber-500/30 text-amber-500 dark:text-amber-400 flex-shrink-0">
                                            <Wallet className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white truncate">League Treasury Split</h3>
                                            <p className="text-[9px] text-gray-500 dark:text-gray-400 font-medium truncate">Current GW secured funds snapshot</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5">
                                        <div className="bg-black/5 dark:bg-black/30 rounded-xl p-1.5 text-center border border-black/5 dark:border-white/5">
                                            <p className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Chairman</p>
                                            <p className="text-xs font-black text-gray-900 dark:text-white tabular-nums">KES {Math.round(chairmanShare).toLocaleString()}</p>
                                            <p className="text-[7.5px] text-amber-600 dark:text-amber-400 font-bold">{(chairmanRate * 100).toFixed(1)}% fee</p>
                                        </div>
                                        <div className="bg-black/5 dark:bg-black/30 rounded-xl p-1.5 text-center border border-black/5 dark:border-white/5">
                                            <p className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Co-Chair</p>
                                            <p className="text-xs font-black text-gray-900 dark:text-white tabular-nums">KES {Math.round(coChairShare).toLocaleString()}</p>
                                            <p className="text-[7.5px] text-gray-500 dark:text-gray-400 font-bold">{(coAdminRate * 100).toFixed(1)}% fee</p>
                                        </div>
                                        <div className="bg-black/5 dark:bg-black/30 rounded-xl p-1.5 text-center border border-black/5 dark:border-white/5">
                                            <p className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">HQ Share</p>
                                            <p className="text-xs font-black text-gray-900 dark:text-white tabular-nums">KES {Math.round(hqShare).toLocaleString()}</p>
                                            <p className="text-[7.5px] text-emerald-600 dark:text-emerald-400 font-bold">{isPilot ? '0% (Pilot Waived)' : '3.5%'}</p>
                                        </div>
                                        <div className="bg-black/5 dark:bg-black/30 rounded-xl p-1.5 text-center border border-black/5 dark:border-white/5">
                                            <p className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Network Buffer</p>
                                            <p className="text-xs font-black text-gray-900 dark:text-white tabular-nums">KES {Math.round(networkShare).toLocaleString()}</p>
                                            <p className="text-[7.5px] text-gray-500 dark:text-gray-400 font-bold">1.5% fee</p>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-[8px] text-gray-500 dark:text-gray-400 font-medium mt-2 text-center leading-tight bg-black/5 dark:bg-black/30 px-2 py-1 rounded-lg border border-black/5 dark:border-white/5">
                                    Withdrawals are hidden while payouts route through Pochi. Enable after Paybill/Till switch.
                                </p>
                            </div>
                        );
                    })()}
                </section>

                <section className="fc-card rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-[#161d24] to-[#0c1218] p-5 md:p-7 mb-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-40 bg-amber-500/10 blur-[90px] pointer-events-none" />
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-5">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-400">Vault payout preview</p>
                            <h2 className="fc-frosty-title text-2xl font-black mt-1">Configured by Chairman</h2>
                            <p className="text-sm text-slate-300 dark:text-gray-400 mt-2 max-w-2xl font-medium">
                                The preview mirrors your current season ladder and shows the exact amount each winner gets right now.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left lg:text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Season winners</p>
                            <p className="text-lg font-black text-white tabular-nums">{modeLabel}</p>
                            <p className="text-[11px] text-slate-400 mt-1">{activeMembersCount} active member{activeMembersCount === 1 ? '' : 's'} · {isPreviewCapped ? `capped at Top ${eligibleWinnersCount}` : 'all tiers available'}</p>
                            <p className="text-[11px] text-amber-400 font-bold mt-1">Total distributed now: KES {Math.round(totalPreviewPayout).toLocaleString()}</p>
                            {role === 'admin' && (
                                <button
                                    onClick={() => setShowSeasonCeremony(true)}
                                    className="mt-3 w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 hover:text-white hover:border-amber-400 hover:from-amber-500/30 text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                                >
                                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                    Launch Season Ceremony
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-3 custom-scrollbar lg:grid lg:grid-cols-3 xl:grid-cols-5 items-stretch">
                        {tiedSeasonVaultPreview.map((tier: any) => (
                            <div key={`${tier.originalPlace}-${tier.player_name}`} className="min-w-[190px] flex-1 rounded-2xl border border-white/10 bg-[#0b1014]/90 p-4 text-center flex flex-col justify-between hover:border-amber-500/30 transition-all shadow-lg">
                                <div>
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            #{tier.rank} {tier.isTied && <span className="text-[8px] text-amber-400 font-bold tracking-normal">(Tied)</span>}
                                        </p>
                                        <span className={clsx(
                                            'text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border',
                                            tier.rank === 1 ? 'border-amber-400/30 bg-amber-400/10 text-amber-400' : tier.rank === 2 ? 'border-slate-300/30 bg-slate-300/10 text-slate-200' : 'border-amber-600/30 bg-amber-600/10 text-amber-500'
                                        )}>
                                            {tier.percentage}%
                                        </span>
                                    </div>
                                    <p className="mt-3 text-2xl font-black text-amber-400 tabular-nums">KES {tier.amount.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="mt-2.5 text-[11px] font-bold text-emerald-300 break-words leading-tight">
                                        Current #{tier.rank}{tier.isTied ? ' (Tied)' : ''}: {tier.player_name} · {tier.entry_name}
                                    </p>
                                    <p className="mt-1.5 text-[10px] text-slate-400">
                                        {tier.percentage}% ratio of current season vault
                                        {tier.tiedRangeText ? ` (${tier.tiedRangeText})` : ''}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <details className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-500/20 dark:bg-sky-500/10">
                        <summary className="fc-vault-explainer-title cursor-pointer text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-sky-300">
                            How these ratios work
                        </summary>
                        <p className="fc-vault-explainer-copy mt-2 text-sm text-slate-700 dark:text-sky-50/90 leading-relaxed">
                            Ratios are normalized to 100% across visible winners, then converted to amounts using the live season vault balance. If active members are fewer than configured tiers, preview tiers are capped and rebalanced automatically.
                        </p>
                    </details>

                    {isPreviewCapped && (
                        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">Tier capped</p>
                            <p className="text-sm text-slate-800 dark:text-amber-50/90 mt-1 font-medium">
                                This league currently has only {activeMembersCount} active member{activeMembersCount === 1 ? '' : 's'}, so the vault preview stops at Top {eligibleWinnersCount}. The chairman's configured ladder will expand automatically once there are enough active players.
                            </p>
                        </div>
                    )}
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
                <section className="fc-card mb-8 rounded-3xl border border-white/10 bg-[#151c18] overflow-hidden shadow-xl">
                    <div className="p-5 md:p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-1 sm:mt-0">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-lg text-white">Gameweek Funding & Arrears Audit</h3>
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                        Since GW{startGw || 1}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Track member contributions, skipped gameweeks, and outstanding dues across active rounds.
                                </p>
                            </div>
                        </div>

                        {/* Filter Pills */}
                        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 overflow-x-auto self-start md:self-auto">
                            <button
                                type="button"
                                onClick={() => setFundingAuditFilter('all')}
                                className={clsx(
                                    'px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                                    fundingAuditFilter === 'all'
                                        ? 'bg-emerald-500 text-black shadow-sm'
                                        : 'text-gray-400 hover:text-white'
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
                                        ? 'bg-rose-500 text-white shadow-sm'
                                        : 'text-rose-400/90 hover:text-rose-300'
                                )}
                            >
                                <span>Behind / Skipped</span>
                                <span className={clsx(
                                    "px-1.5 py-0.2 rounded-full text-[10px] font-black border",
                                    fundingAuditFilter === 'skipped'
                                        ? "bg-white/20 text-white border-white/30"
                                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
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
                                        ? 'bg-emerald-500 text-black shadow-sm'
                                        : 'text-emerald-400/90 hover:text-emerald-300'
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
                                            ? 'bg-indigo-500 text-white shadow-sm'
                                            : 'text-indigo-400/90 hover:text-indigo-300'
                                    )}
                                >
                                    Spectators ({spectatorsCount})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Metric Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 md:p-6 bg-black/20 border-b border-white/5">
                        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Arrears Owed</p>
                            <p className={clsx("text-lg sm:text-xl font-black tabular-nums mt-0.5", totalChamaArrears > 0 ? "text-rose-400" : "text-emerald-400")}>
                                KES {isStealthMode ? '****' : totalChamaArrears.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{totalChamaArrears > 0 ? `${skippedMembersCount} members have skipped rounds` : "All accounts square"}</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Rounds Tracked</p>
                            <p className="text-lg sm:text-xl font-black tabular-nums text-white mt-0.5">
                                {totalCompletedOrCurrentGws} GW{totalCompletedOrCurrentGws !== 1 ? 's' : ''}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">GW{startGw || 1} → GW{currentGwNumber || startGw || 1}</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Regular Players</p>
                            <p className="text-lg sm:text-xl font-black tabular-nums text-emerald-400 mt-0.5">
                                {regularMembersCount}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{fundedMembersCount} fully funded</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Gameweek Stake</p>
                            <p className="text-lg sm:text-xl font-black tabular-nums text-amber-400 mt-0.5">
                                KES {gameweekStake.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">Per member / GW</p>
                        </div>
                    </div>

                    {/* Members Audit List */}
                    <div className="divide-y divide-white/[0.04]">
                        {filteredAuditMembers.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No members found for this filter.
                            </div>
                        ) : (
                            filteredAuditMembers.map((m: any) => {
                                const isCurrentUser = m.id === activeUserId || (currentUser && m.phone && m.phone === currentUser.phone);
                                return (
                                    <div key={m.id} className="p-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <UserAvatar name={m.displayName} size="md" />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-white text-sm truncate">{m.displayName}</span>
                                                    {isCurrentUser && (
                                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                            You
                                                        </span>
                                                    )}
                                                    {m.role === 'admin' && (
                                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                            Admin
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <span className="font-mono">{m.phone || 'No phone'}</span>
                                                    <span>•</span>
                                                    <span>Wallet: <strong className="text-gray-300 font-mono">KES {Number(m.walletBalance || 0).toLocaleString()}</strong></span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status & Arrears */}
                                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 flex-wrap">
                                            <div className="text-left sm:text-right">
                                                {m.isSpectator ? (
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
                                                <div className="hidden md:flex items-center gap-1 flex-wrap max-w-[150px] justify-end">
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
                                            {isAdmin && m.gwsSkippedCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleNudgeArrears(m)}
                                                    className="px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                                >
                                                    <MessageCircle className="w-3 h-3" />
                                                    <span>Nudge WhatsApp</span>
                                                </button>
                                            )}
                                            {isCurrentUser && m.gwsSkippedCount > 0 && !isAdmin && (
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
                        {displayedTransactions.length > 0 ? displayedTransactions.map((tx: any) => {
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
                            const targetTxGw = Number(tx.gameweek || tx.gw || 0);
                            const gwTag = targetTxGw > 0 ? `GW${targetTxGw}` : '';
                            const activityLabel = isReversal
                                ? (tx.note || `Reversal • ${memberName}`)
                                : tx.type === 'payout'
                                    ? `GW${tx.gw || tx.gameweek || ''} Payout → ${tx.winnerName || memberName}`
                                    : isWalletFunding
                                        ? `Wallet Top-Up • ${memberName}${gwTag ? ` (Funded for ${gwTag})` : ''}`
                                        : `Deposit • ${memberName}${gwTag ? ` (Funded for ${gwTag})` : ''}`;
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
                                    <div className="font-bold text-white text-sm">
                                        {activityLabel}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-white/5">
                                        <span>{tx.receiptId || `TXN${safeTxId.substring(0, 8).toUpperCase()}`}</span>
                                        <div className="flex items-center gap-2">
                                            {tx.type === 'payout' && (
                                                <button
                                                    onClick={() => setSelectedPayoutForFlex(tx)}
                                                    className="px-2 py-1 rounded-md border border-amber-400/30 bg-amber-400/10 text-[9px] font-black uppercase tracking-wider text-amber-300 hover:bg-amber-400/20 transition-colors flex items-center gap-1"
                                                >
                                                    <Trophy className="w-2.5 h-2.5 text-amber-400" />
                                                    Flex
                                                </button>
                                            )}
                                            <button
                                                onClick={() => shareTransactionReceipt(tx)}
                                                className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-wider text-white hover:bg-white/10 transition-colors"
                                            >
                                                Share
                                            </button>
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
                                    displayedTransactions.map((tx: any) => {
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
                                        const targetTxGw = Number(tx.gameweek || tx.gw || 0);
                                        const gwTag = targetTxGw > 0 ? `GW${targetTxGw}` : '';
                                        const statusLabel = isReversal
                                            ? 'Reversal'
                                            : isWalletFunding
                                                ? 'Wallet Credit'
                                                : ledgerDirection === '+'
                                                    ? 'Inflow'
                                                    : 'Outflow';
                                        const activityLabel = isReversal
                                            ? (tx.note || `Reversal • ${memberName}`)
                                            : tx.type === 'payout'
                                                ? `GW${tx.gw || tx.gameweek || ''} Payout → ${tx.winnerName || memberName}`
                                                : isWalletFunding
                                                    ? `Wallet Top-Up • ${memberName}${gwTag ? ` (Funded for ${gwTag})` : ''}`
                                                    : `Deposit • ${memberName}${gwTag ? ` (Funded for ${gwTag})` : ''}`;
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
                                                            : `${gwTag ? `Funded for Gameweek ${targetTxGw} • ` : ''}Receipt: ${tx.mpesaCode || tx.receiptId || 'N/A'}`}
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
                                                        {tx.type === 'payout' && (
                                                            <button
                                                                onClick={() => setSelectedPayoutForFlex(tx)}
                                                                className="px-2.5 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 text-[10px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-400/20 transition-colors flex items-center gap-1"
                                                            >
                                                                <Trophy className="w-3 h-3 text-amber-400" />
                                                                Flex
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => shareTransactionReceipt(tx)}
                                                            className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-colors"
                                                        >
                                                            Share
                                                        </button>
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
                </div>

                {/* ── Season Vault Trajectory Graph ──────────────────────────── */}
                {(() => {
                    const effectiveLeagueStart = Math.max(1, Number(startGw || (leagueSettings as any)?.startGw || 1));
                    const totalSeasonGWs = Math.max(1, 38 - effectiveLeagueStart + 1);
                    const vaultRatePerGW = totalSecured > 0
                        ? totalSecured * (Number(rules.vault || 30) / 100)
                        : (Number(rules.vault || 30) / 100) * (paidMembers.length || 8) * (gameweekStake || 200);

                    const effectiveGw = Number(currentGwNumber || 1);
                    const completedSeasonGws = effectiveGw >= effectiveLeagueStart
                        ? Math.max(0, effectiveGw - effectiveLeagueStart + (isCurrentEventFinished ? 1 : 0))
                        : 0;

                    const chartData = Array.from({ length: totalSeasonGWs }, (_, i) => {
                        const roundGw = effectiveLeagueStart + i;
                        return {
                            gw: `GW${roundGw}`,
                            vault: Math.round(vaultRatePerGW * (i + 1)),
                            active: (i + 1) <= completedSeasonGws
                        };
                    });
                    const currentVault = completedSeasonGws * vaultRatePerGW;
                    const projectedFinal = vaultRatePerGW * totalSeasonGWs;
                    const remainingLeagueGws = Math.max(0, totalSeasonGWs - completedSeasonGws);

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
                                        <p className="text-xl font-black text-emerald-400 tabular-nums">KES {isStealthMode ? '****' : currentVault.toLocaleString()}</p>
                                    </div>
                                    <div className="w-px bg-white/5" />
                                    <div className="text-right">
                                        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">By GW38</p>
                                        <p className="text-xl font-black text-amber-400 tabular-nums">KES {isStealthMode ? '****' : projectedFinal.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div ref={chartHostRef} className="h-[240px] w-full min-w-0">
                                {showVaultChart && chartHostWidth > 0 ? (
                                <ResponsiveContainer width="100%" height={220} debounce={120}>
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                                        <defs>
                                            <linearGradient id="vaultGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                                                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="gw" tick={{ fill: '#4b5563', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} interval={5} />
                                        <YAxis tick={{ fill: '#4b5563', fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                                        <Tooltip
                                            contentStyle={{ background: '#0b1014', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 14px' }}
                                            labelStyle={{ color: '#10B981', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                            itemStyle={{ color: '#fff', fontWeight: 800 }}
                                            formatter={(value) => [`KES ${Number(value ?? 0).toLocaleString()}`, 'Vault']}
                                        />
                                        <Area type="monotone" dataKey="vault" stroke="#10B981" strokeWidth={2.5} fill="url(#vaultGradient)" dot={false} activeDot={{ r: 5, fill: '#10B981', strokeWidth: 0 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                                ) : (
                                <div className="h-full w-full rounded-xl bg-black/20 border border-white/5" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-4 justify-center">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Vault value grows by KES {vaultRatePerGW.toLocaleString()} per resolved GW</span>
                            </div>
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

            {selectedPayoutForFlex && (
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
                />
            )}
            </div>
        </div>
    );
}
