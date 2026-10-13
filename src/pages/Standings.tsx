import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Download, Trophy, Zap, Save, ShieldAlert, BarChart3, Users, RefreshCw, Shirt, Crown, Share2, Info, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import clsx from 'clsx';
import Header from '../components/Header';
import ChampionFlexCardModal from '../components/ChampionFlexCardModal';
import TeamPicksModal from '../components/TeamPicksModal';
import UserAvatar from '../components/UserAvatar';
import { StandingsSkeleton } from '../components/Skeleton';
import { haptics } from '../utils/haptics';
import FplServerStatusBanner from '../components/FplServerStatusBanner';

const fetchFplStandings = async (leagueId: number) => {
    const cacheKey = `fpl_standings_${leagueId}`;
    const cached = localStorage.getItem(cacheKey);
    let cachedData: any[] | null = null;
    if (cached) {
        try {
            const { timestamp, data } = JSON.parse(cached);
            if (Array.isArray(data) && data.length > 0) {
                cachedData = data;
                // 5-minute TTL caching to prevent Firebase/FPL quota limits during mass refreshes
                if (Date.now() - timestamp < 300000) {
                    return { results: data, isCached: false, isMaintenance: false };
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
    let isMaintenance = false;
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint);
            if (!response.ok) {
                if (response.status === 503 || response.status === 502 || response.status === 504) {
                    isMaintenance = true;
                    lastError = `Official Premier League servers are currently updating matchday scores and bonus points (HTTP ${response.status}).`;
                } else if (response.status === 404) {
                    lastError = `FPL league #${leagueId} was not found (HTTP 404). Please verify your League ID.`;
                } else {
                    lastError = `FPL API returned ${response.status}. League ID may be invalid.`;
                }
                continue;
            }

            const data = await response.json();
            if (data?.standings?.results) {
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data.standings.results }));
                return { results: data.standings.results, isCached: false, isMaintenance: false };
            }
            lastError = 'FPL response format was unexpected.';
        } catch (err: any) {
            lastError = err?.message || 'Could not connect to FPL servers.';
        }
    }

    // Graceful fallback: If FPL servers are updating (503/network) and we have previously cached standings, return them!
    if (cachedData && cachedData.length > 0) {
        return {
            results: cachedData,
            isCached: true,
            isMaintenance,
            maintenanceMessage: isMaintenance ? lastError : null
        };
    }

    const err = new Error(lastError) as any;
    err.isMaintenance = isMaintenance;
    throw err;
};

export default function Standings() {
    const role = useStore(state => state.role);
    const league = useStore(state => state.league);

    // Ensure page always renders from the very top — no auto-scroll down to trajectory
    useEffect(() => {
        const scrollHost = document.querySelector('.fc-main-scroll') as HTMLElement | null;
        if (scrollHost) { scrollHost.scrollTop = 0; }
        window.scrollTo({ top: 0, behavior: 'auto' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }, []);
    const [standingsData, setStandingsData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFplMaintenance, setIsFplMaintenance] = useState(false);
    const [isCachedStandings, setIsCachedStandings] = useState(false);
    const [leagueName, setLeagueName] = useState(() => league?.name || localStorage.getItem('activeLeagueName') || '');
    const [chairmanId, setChairmanId] = useState<string | null>(null);
    const [_coAdminId, setCoAdminId] = useState<string | null>(null);
    const [dbFplLeagueId, setDbFplLeagueId] = useState<number | null>(null);
    const [inputFplLeagueId, setInputFplLeagueId] = useState('');
    const [isSavingFplId, setIsSavingFplId] = useState(false);
    const [currentEvent, setCurrentEvent] = useState<number | null>(null);
    const [isCurrentEventFinished, setIsCurrentEventFinished] = useState(false);
    const [heroRankView, setHeroRankView] = useState<'gw' | 'season'>('gw');
    const [leagueGameweekStake, setLeagueGameweekStake] = useState<number>(0);
    const [leagueRules, setLeagueRules] = useState<any>({});
    const [forfeitedGws, setForfeitedGws] = useState<number[]>([]);
    const [leagueStartGw, setLeagueStartGw] = useState<number>(1);
    const [preChamaPointsMap, setPreChamaPointsMap] = useState<Record<number, number>>({});
    const [memberDepositsMap, setMemberDepositsMap] = useState<Record<string, number>>({});
    const [standingsMode, setStandingsMode] = useState<'clean_slate' | 'raw_fpl'>('clean_slate');
    const [payoutRows, setPayoutRows] = useState<any[]>([]);
    const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
    const [teamPicksModal, setTeamPicksModal] = useState<{
        isOpen: boolean;
        teamId: number | null;
        teamName: string;
        managerName: string;
    }>({
        isOpen: false,
        teamId: null,
        teamName: '',
        managerName: ''
    });
    const members = useStore(state => state.members);
    const gwWinnersLedger = useMemo(() => {
        const winnerByGw = new Map<number, { gw: number; winnerName: string; winnerTeam?: string | null; amount?: number | null; isPaid?: boolean; isVoided?: boolean; isAwaitingPayment?: boolean }>();
        payoutRows.forEach((tx) => {
            let gw = Number(tx.gameweek || tx.gw);
            if (!Number.isFinite(gw) || gw <= 0) {
                const gwMatch = String(tx.description || tx.notes || '').match(/GW\s*(\d+)|Gameweek\s*(\d+)/i);
                if (gwMatch) gw = Number(gwMatch[1] || gwMatch[2]);
            }
            if (!Number.isFinite(gw) || gw <= 0 || gw > 38 || winnerByGw.has(gw)) return;
            winnerByGw.set(gw, {
                gw,
                winnerName: tx.winnerName || tx.memberName || (tx.description?.split('-')[1]?.trim()) || 'Confirmed Winner',
                winnerTeam: tx.winnerTeam || tx.entryName || null,
                amount: Number(tx.amount || 0),
                isPaid: true,
            });
        });

        const pendingForfeited = new Set<number>();
        const pendingPayoutsMap = new Map<number, any>();
        pendingPayouts.forEach((p) => {
            const gwNum = Number(p.gw || p.gameweek);
            if (Number.isFinite(gwNum) && gwNum > 0) {
                if (p.status === 'forfeited') {
                    pendingForfeited.add(gwNum);
                } else if (p.status === 'approved' || p.status === 'settled') {
                    // Approved payouts are official paid winners
                    winnerByGw.set(gwNum, {
                        gw: gwNum,
                        winnerName: p.winnerName || p.playerName || 'Winner confirmed',
                        winnerTeam: p.winnerTeam || p.entryName || null,
                        amount: Number(p.amount || 0),
                        isPaid: true,
                    });
                } else {
                    pendingPayoutsMap.set(gwNum, p);
                }
            }
        });

        const mergedRules = { ...((league as any)?.rules || {}), ...(leagueRules || {}) };
        const isSeasonOnlyLeague = Number(mergedRules.vault ?? 0) === 100 || Number(mergedRules.weekly ?? 0) === 0 || mergedRules.payoutMode === 'season_only';
        const weeklyPercent = isSeasonOnlyLeague ? 0 : (Number(mergedRules.weekly || 70) / 100);
        const stakeVal = Number(
            leagueGameweekStake ||
            mergedRules.gameweekStake ||
            (league as any)?.gameweekStake ||
            (league as any)?.rules?.gameweekStake ||
            (league as any)?.monthlyFee ||
            50
        );

        // Active non-eliminated Chama members from results
        const norm = (s: string) => String(s || '').toLowerCase().trim();
        const activeChamaResults = (standingsData || []).filter((r: any) => {
            const dbMember = members.find((m: any) => {
                if (m.fplTeamId && Number(m.fplTeamId) === Number(r.entry)) return true;
                if (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(r.entry)) return true;
                const db = norm(m.displayName);
                return norm(r.player_name).includes(db) || db.includes(norm(r.player_name)) || norm(r.entry_name).includes(db);
            });
            if (!dbMember) return false;
            if (dbMember.isActive === false) return false;
            if ((dbMember as any)?.isEliminated === true) return false;
            if ((dbMember as any)?.playMode === 'sidebets_only') return false;
            return true;
        });
        const sortedActiveResults = [...activeChamaResults].sort((a: any, b: any) => Number(b.event_total || 0) - Number(a.event_total || 0));
        const topScore = Number(sortedActiveResults[0]?.event_total || 0);
        const tiedTopMembers = sortedActiveResults.filter((r: any) => Number(r.event_total || 0) === topScore);
        const isTie = tiedTopMembers.length > 1;
        const topGwMember = sortedActiveResults[0];
        const winnerDisplayName = isTie 
            ? tiedTopMembers.map((m: any) => m.player_name.split(' ')[0]).join(' & ') + ' (Tie)'
            : `${topGwMember?.player_name}`;

        const activeCount = members.filter(m => m.isActive !== false && !(m as any)?.isEliminated && (m as any)?.playMode !== 'sidebets_only' && (m.hasPaid || (stakeVal > 0 && (Number(m.walletBalance || 0)) >= stakeVal))).length || 1;
        const estimatedPot = isSeasonOnlyLeague ? 0 : Math.round(activeCount * stakeVal * weeklyPercent);

        const effectiveForfeited = new Set<number>([
            ...(forfeitedGws || []),
            ...(leagueRules?.forfeitedGws || []),
            ...Array.from(pendingForfeited),
        ]);

        const effectiveTargetGw = (isCurrentEventFinished && currentEvent) ? currentEvent + 1 : (currentEvent || 1);

        return Array.from({ length: 38 }, (_, index) => {
            const gw = index + 1;
            // 1. Approved winner in recorded transactions
            if (winnerByGw.has(gw)) {
                return winnerByGw.get(gw)!;
            }

            // 2. Explicitly forfeited gameweeks
            if (effectiveForfeited.has(gw)) {
                return {
                    gw,
                    winnerName: 'Voided',
                    winnerTeam: 'Round Unplayed',
                    isVoided: true,
                };
            }

            // 3. Pending payouts awaiting co-chair or chairman approval (only for ended rounds with weekly pots)
            if (pendingPayoutsMap.has(gw) && !isSeasonOnlyLeague) {
                const p = pendingPayoutsMap.get(gw);
                return {
                    gw,
                    winnerName: p.winnerName || p.playerName || 'Winner identified',
                    winnerTeam: p.winnerTeam || p.entryName || 'Awaiting Payment',
                    amount: Number(p.amount || estimatedPot),
                    isAwaitingPayment: true,
                };
            }

            // 4. Pre-league gameweeks based on configured start GW
            const effectiveStart = Number(leagueStartGw) > 0 ? Number(leagueStartGw) : 1;
            if (effectiveStart > 1 && gw < effectiveStart) {
                return {
                    gw,
                    winnerName: 'Voided',
                    winnerTeam: 'Pre-League · No fees',
                    isVoided: true,
                    isPreLeague: true,
                };
            }

            // 5. Current active live gameweek (during live matches before final whistle/resolution)
            if (currentEvent && gw === currentEvent && !isCurrentEventFinished) {
                if (topGwMember && Number(topGwMember.event_total) > 0) {
                    return {
                        gw,
                        winnerName: winnerDisplayName,
                        winnerTeam: isSeasonOnlyLeague
                            ? `${topGwMember.entry_name || 'Team'} · Live Leader`
                            : `${topGwMember.entry_name || 'Team'} · Live Leader`,
                        amount: isSeasonOnlyLeague ? null : (isTie ? Math.round(estimatedPot / tiedTopMembers.length) : estimatedPot),
                        isCurrentLive: true,
                        isPaid: false,
                        isSeasonOnly: isSeasonOnlyLeague,
                    };
                }
                return {
                    gw,
                    winnerName: 'In Progress',
                    winnerTeam: 'Live Gameweek · Pending Whistle',
                    isCurrentLive: true,
                    isPaid: false,
                    isSeasonOnly: isSeasonOnlyLeague,
                };
            }

            // 6. Current or past in-season gameweek finished without explicit recorded payout yet -> Awaiting payout or show winner
            if (currentEvent && (isCurrentEventFinished ? gw <= currentEvent : gw < currentEvent)) {
                if (gw >= effectiveStart && topGwMember && Number(topGwMember.event_total) > 0) {
                    return {
                        gw,
                        winnerName: winnerDisplayName,
                        winnerTeam: isSeasonOnlyLeague
                            ? `${topGwMember.entry_name || 'Team'} · GW Top Scorer (Vault)`
                            : isTie ? 'Split Pot · Pending Payout' : `${topGwMember.entry_name || 'Team'} · Pending Payout`,
                        amount: isSeasonOnlyLeague ? null : (isTie ? Math.round(estimatedPot / tiedTopMembers.length) : estimatedPot),
                        isAwaitingPayment: !isSeasonOnlyLeague,
                        isSeasonOnly: isSeasonOnlyLeague,
                    };
                }
                return {
                    gw,
                    winnerName: gw < effectiveStart ? 'Voided' : 'Unresolved',
                    winnerTeam: gw < effectiveStart ? 'Pre-League · No fees' : (isSeasonOnlyLeague ? 'Vault Round Completed' : 'Awaiting Resolution'),
                    isVoided: gw < effectiveStart,
                    isPreLeague: gw < effectiveStart,
                    isSeasonOnly: isSeasonOnlyLeague,
                };
            }

            // 7. Next target active pending kickoff
            if (gw === effectiveTargetGw) {
                return {
                    gw,
                    winnerName: 'Upcoming',
                    winnerTeam: isCurrentEventFinished ? 'Next Round Kickoff' : 'Pending kickoff',
                    isUpcoming: true,
                    isTargetActiveGw: true,
                };
            }

            // 8. Future upcoming gameweeks
            return {
                gw,
                winnerName: 'Upcoming',
                winnerTeam: 'Pending kickoff',
                isUpcoming: true,
            };
        });
    }, [payoutRows, pendingPayouts, currentEvent, isCurrentEventFinished, leagueStartGw, leagueRules, forfeitedGws, standingsData, members]);

    // Effective league start configured for the chama
    const rawStartGw = Number(leagueStartGw || (league as any)?.startGw || (league as any)?.startGameweek || (league as any)?.rules?.startGw || 6);
    const effectiveLeagueStartGw = Math.max(1, rawStartGw || 6);

    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [trajectoryView, setTrajectoryView] = useState<'top5' | 'top10' | 'all'>('top5');
    const [spotlightPlayer, setSpotlightPlayer] = useState<string | null>(null);

    const resolvedTitle = leagueName || league?.name || localStorage.getItem('activeLeagueName') || 'Chama League';

    useEffect(() => {
        if (leagueName) {
            localStorage.setItem('activeLeagueName', leagueName);
        }
    }, [leagueName]);
    const [flexCardData, setFlexCardData] = useState<{
        winnerName: string;
        teamName?: string;
        points: number;
        amountWon: number;
        gameweek: number | string;
        isJointWinner?: boolean;
        tiedCount?: number;
    } | null>(null);
    const ledgerRailRef = useRef<HTMLDivElement | null>(null);

    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    useEffect(() => {
        if (!activeLeagueId) {
            setIsLoading(false);
            return;
        }
        if (members.length === 0) listenToLeagueMembers(activeLeagueId);

        const fetchFPLStandings = async () => {
            setIsLoading(true);
            setError(null);
            try {
                let targetFplId: number | null = null;

                try {
                    const leagueRef = doc(db, 'leagues', activeLeagueId);
                    const leagueSnap = await getDoc(leagueRef);
                    if (leagueSnap.exists()) {
                        const lData = leagueSnap.data();
                        setLeagueName(lData.name || lData.leagueName || 'League');
                        if (lData.chairmanId) setChairmanId(lData.chairmanId);
                        if (lData.coAdminId) setCoAdminId(lData.coAdminId);
                        if (lData.rules) setLeagueRules(lData.rules);
                        if (lData.gameweekStake) {
                            setLeagueGameweekStake(Number(lData.gameweekStake));
                        } else if (lData.monthlyFee) {
                            setLeagueGameweekStake(Number(lData.monthlyFee));
                        }
                        if (lData.forfeitedGws) setForfeitedGws(lData.forfeitedGws);
                        if (lData.startGw || lData.startGameweek || lData.rules?.startGw) {
                            setLeagueStartGw(Number(lData.startGw || lData.startGameweek || lData.rules?.startGw));
                        } else if ((league as any)?.startGw) {
                            setLeagueStartGw(Number((league as any).startGw));
                        } else {
                            setLeagueStartGw(6);
                        }
                        if (lData.fplLeagueId) {
                            setDbFplLeagueId(Number(lData.fplLeagueId));
                            targetFplId = Number(lData.fplLeagueId);
                        }
                    }
                } catch (leagueErr: any) {
                    console.warn('[standings] league metadata read skipped:', leagueErr?.message || leagueErr);
                }

                try {
                    const bootstrapRes = await fetch(`/fpl-api/bootstrap-static/`);
                    if (bootstrapRes.ok) {
                        const bootstrapData = await bootstrapRes.json();
                        const events = bootstrapData?.events || [];
                        const current = events.find((event: any) => event.is_current)
                            || events.find((event: any) => event.is_previous)
                            || events.filter((event: any) => event.finished).pop()
                            || events[0];
                        if (current?.id) {
                            setCurrentEvent(current.id);
                            setIsCurrentEventFinished(Boolean(current.finished === true && current.data_checked === true));
                        }
                    }
                } catch (bootErr) {
                    console.warn('[standings] bootstrap static fetch skipped:', bootErr);
                }

                if (!targetFplId) {
                    setStandingsData([]);
                    setPerformanceData([]);
                    setIsLoading(false);
                    setError(null);
                    return;
                }

                const fetchRes = await fetchFplStandings(targetFplId);
                const results = fetchRes?.results || [];
                setStandingsData(results);
                setIsCachedStandings(Boolean(fetchRes?.isCached));
                setIsFplMaintenance(Boolean(fetchRes?.isMaintenance));

                const fetchPerformances = async () => {
                    const candidateManagers = results.slice(0, 30);
                    const teamIds = candidateManagers.map((r: any) => r.entry);
                    
                    const activeUserId = localStorage.getItem('activeUserId') || '';
                    const myMember = members.find(m => m.id === activeUserId);
                    const myFplTeamId = myMember ? Number((myMember as any).fplTeamId || 0) : null;
                    if (myFplTeamId && !teamIds.includes(myFplTeamId)) {
                        teamIds.push(myFplTeamId);
                    }

                    if (teamIds.length === 0) return;

                    const leagueAvg = results.length > 0
                        ? Math.round(results.reduce((s: number, curRes: any) => s + (Number(curRes.event_total) || 0), 0) / results.length)
                        : 50;

                    const gwMap = new Map<number, any>();

                    const historyResults = await Promise.allSettled(
                        teamIds.map(async (tId: any) => {
                            const cacheKey = `fpl_history_${tId}`;
                            let histData: any = null;
                            try {
                                const r = await fetch(`/fpl-api/entry/${tId}/history/`);
                                if (r.ok) {
                                    histData = await r.json();
                                    if (histData?.current) {
                                        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: histData }));
                                    }
                                }
                            } catch {}

                            if (!histData) {
                                const cached = localStorage.getItem(cacheKey);
                                if (cached) {
                                    try { histData = JSON.parse(cached).data; } catch {}
                                }
                            }
                            return { tId, histData };
                        })
                    );

                    // Clamp to max completed or live gameweek
                    const maxPlayedGw = currentEvent
                        ? (isCurrentEventFinished ? currentEvent : Math.max(1, currentEvent - 1))
                        : 38;

                    const calculatedPreMap: Record<number, number> = {};
                    for (const result of historyResults) {
                        if (result.status !== 'fulfilled') continue;
                        const { tId, histData } = result.value;
                        const current = histData?.current;
                        if (current && current.length > 0) {
                            if (effectiveLeagueStartGw > 1) {
                                const preChamaPts = current
                                    .filter((gw: any) => Number(gw.event) < effectiveLeagueStartGw)
                                    .reduce((sum: number, gw: any) => sum + (Number(gw.points) || 0), 0);
                                calculatedPreMap[Number(tId)] = preChamaPts;
                            }
                            const relevant = current.filter((gw: any) => Number(gw.event) <= maxPlayedGw);
                            const playerEntry = results.find((r: any) => r.entry === tId);
                            const playerName = playerEntry ? playerEntry.player_name.split(' ')[0] : `Team ${tId}`;

                            for (const gw of relevant) {
                                const evNum = Number(gw.event);
                                if (!gwMap.has(evNum)) {
                                    gwMap.set(evNum, { name: `GW${evNum}` });
                                }
                                gwMap.get(evNum)[playerName] = Number(gw.points);
                            }
                        } else {
                            // If history is not returned or player just joined, ensure current event score is plotted
                            const playerEntry = results.find((r: any) => r.entry === tId);
                            if (playerEntry) {
                                const playerName = playerEntry.player_name ? playerEntry.player_name.split(' ')[0] : `Team ${tId}`;
                                const evNum = currentEvent || 6;
                                if (!gwMap.has(evNum)) {
                                    gwMap.set(evNum, { name: `GW${evNum}` });
                                }
                                gwMap.get(evNum)[playerName] = Number(playerEntry.event_total || 0);
                            }
                        }
                    }

                    // Fallback preChama calculation for all managers if history API was unavailable or current round is kickoff
                    for (const r of results) {
                        const entryId = Number(r.entry);
                        if (calculatedPreMap[entryId] === undefined && effectiveLeagueStartGw > 1) {
                            if (currentEvent === effectiveLeagueStartGw) {
                                calculatedPreMap[entryId] = Math.max(0, Number(r.total || 0) - Number(r.event_total || 0));
                            }
                        }
                    }

                    if (Object.keys(calculatedPreMap).length > 0) {
                        setPreChamaPointsMap(calculatedPreMap);
                    }

                    let aggData: any[] = Array.from(gwMap.values());

                    // Sort chronologically
                    if (aggData.length > 0) {
                        aggData.sort((a, b) => {
                            const numA = parseInt(String(a.name || '').replace(/\D/g, ''), 10) || 0;
                            const numB = parseInt(String(b.name || '').replace(/\D/g, ''), 10) || 0;
                            return numA - numB;
                        });
                    }

                    if (aggData.length > 0) {
                        // Compute true per-gameweek average across all loaded managers
                        const finalData = aggData.map(row => {
                            const scores = Object.keys(row)
                                .filter(k => k !== 'name' && k !== 'Average')
                                .map(k => Number(row[k]))
                                .filter(n => Number.isFinite(n));
                            const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : leagueAvg;
                            return {
                                ...row,
                                Average: avg
                            };
                        });
                        setPerformanceData(finalData);
                    }
                };
                fetchPerformances();

                try {
                    const txSnap = await getDocs(collection(db, 'leagues', activeLeagueId, 'transactions'));
                    const payoutRowsData = txSnap.docs
                        .map((txDoc) => txDoc.data() as any)
                        .filter((tx) => {
                            if (tx.type !== 'payout') return false;
                            const gw = Number(tx.gameweek || tx.gw);
                            if (Number.isFinite(gw) && gw > 0) return true;
                            const gwMatch = String(tx.description || tx.notes || '').match(/GW\s*(\d+)|Gameweek\s*(\d+)/i);
                            return Boolean(gwMatch);
                        })
                        .map((tx) => {
                            let gw = Number(tx.gameweek || tx.gw);
                            if (!Number.isFinite(gw) || gw <= 0) {
                                const gwMatch = String(tx.description || tx.notes || '').match(/GW\s*(\d+)|Gameweek\s*(\d+)/i);
                                if (gwMatch) gw = Number(gwMatch[1] || gwMatch[2]);
                            }
                            return { ...tx, gameweek: gw, gw };
                        });
                    setPayoutRows(payoutRowsData);

                    const depMap: Record<string, number> = {};
                    txSnap.docs.forEach((txDoc) => {
                        const tx = txDoc.data() as any;
                        if (tx.type === 'deposit' || tx.type === 'payment' || tx.type === 'credit' || tx.type === 'wallet_topup') {
                            const amt = Number(tx.amount || 0);
                            if (amt > 0) {
                                if (tx.memberId) depMap[tx.memberId] = (depMap[tx.memberId] || 0) + amt;
                                if (tx.userId) depMap[tx.userId] = (depMap[tx.userId] || 0) + amt;
                                if (tx.memberName) depMap[tx.memberName.toLowerCase().trim()] = (depMap[tx.memberName.toLowerCase().trim()] || 0) + amt;
                                if (tx.displayName) depMap[tx.displayName.toLowerCase().trim()] = (depMap[tx.displayName.toLowerCase().trim()] || 0) + amt;
                            }
                        }
                    });
                    setMemberDepositsMap(depMap);

                    try {
                        const pendingSnap = await getDocs(collection(db, 'leagues', activeLeagueId, 'pending_payouts'));
                        setPendingPayouts(pendingSnap.docs.map((d) => d.data() as any));
                    } catch (_pErr) {
                        setPendingPayouts([]);
                    }
                } catch (txErr: any) {
                    console.warn('[standings] ledger tx read skipped:', txErr?.message || txErr);
                }

                // Ensure currentEvent is available immediately
                try {
                    const bResp = await fetch(`/fpl-api/bootstrap-static/`);
                    if (bResp.ok) {
                        const bData = await bResp.json();
                        const events = bData?.events || [];
                        const current = events.find((event: any) => event.is_current)
                            || events.find((event: any) => event.is_previous)
                            || events.filter((event: any) => event.finished).pop()
                            || events[0];
                        if (current?.id) {
                            setCurrentEvent(current.id);
                            setIsCurrentEventFinished(Boolean(current.finished === true && current.data_checked === true));
                        }
                    }
                } catch (bErr) {
                    console.warn('[standings] bootstrap static fetch skipped:', bErr);
                }
            } catch (err: any) {
                console.error('FPL Fetch Error:', err);
                const is503 = err?.isMaintenance || String(err?.message || '').includes('503') || String(err?.message || '').includes('updating matchday') || String(err?.message || '').includes('Premier League servers');
                setIsFplMaintenance(Boolean(is503));
                setError(err.message || 'Could not connect to FPL servers.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchFPLStandings();
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    useEffect(() => {
        const fetchCurrentEvent = async () => {
            try {
                const response = await fetch(`/fpl-api/bootstrap-static/`);
                if (!response.ok) return;
                const data = await response.json();
                const events = data?.events || [];
                const current = events.find((event: any) => event.is_current)
                    || events.find((event: any) => event.is_previous)
                    || events.filter((event: any) => event.finished).pop()
                    || events[0];
                if (current?.id) {
                    setCurrentEvent(current.id);
                    setIsCurrentEventFinished(Boolean(current.finished === true && current.data_checked === true));
                }
            } catch (err) {
                console.warn('Could not fetch current FPL event', err);
            }
        };
        fetchCurrentEvent();
    }, []);

    useEffect(() => {
        if (isLoading) return;
        const targetGw = (isCurrentEventFinished && currentEvent) ? currentEvent : (currentEvent || 1);
        
        const scrollAction = () => {
            const rail = ledgerRailRef.current;
            if (!rail) return;
            const gwCard = rail.querySelector<HTMLElement>(`[data-gw-card="${targetGw}"]`);
            if (gwCard) {
                const targetLeft = gwCard.offsetLeft - (rail.clientWidth / 2) + (gwCard.clientWidth / 2);
                rail.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
            }
        };

        // Scroll across multiple animation frames and timeout ticks as DOM layout completes
        const rafId = requestAnimationFrame(scrollAction);
        const t1 = setTimeout(scrollAction, 120);
        const t2 = setTimeout(scrollAction, 350);
        const t3 = setTimeout(scrollAction, 750);
        const t4 = setTimeout(scrollAction, 1500);

        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
        };
    }, [isLoading, currentEvent, isCurrentEventFinished, performanceData.length, payoutRows.length]);

    const getMemberStatus = (playerName: string, entryName: string, entryId: number) => {
        const norm = (s: string) => (s || '').toLowerCase().trim();
        const pNorm = norm(playerName);
        const eNorm = norm(entryName);
        const eId = Number(entryId || 0);

        // Gather all candidates matching FPL ID, player name, or squad name
        const candidates = members.filter(m => {
            const mFplId = Number(m.fplTeamId || (m as any).fplEntryId || 0);
            if (eId && mFplId && mFplId === eId) return true;

            const dNorm = norm(m.displayName);
            if (dNorm && (pNorm === dNorm || eNorm === dNorm || pNorm.includes(dNorm) || dNorm.includes(pNorm))) return true;

            const tNorm = norm((m as any).teamName || (m as any).fplTeamName || '');
            if (tNorm && (eNorm === tNorm || eNorm.includes(tNorm) || tNorm.includes(eNorm))) return true;

            return false;
        });

        if (candidates.length === 0) return undefined;

        // Sort candidates so the most complete / active / funded record is base
        const sorted = [...candidates].sort((a, b) => {
            const aFunded = (a.hasPaid || Number(a.walletBalance || 0) > 0) ? 20 : 0;
            const bFunded = (b.hasPaid || Number(b.walletBalance || 0) > 0) ? 20 : 0;
            const aActive = a.isActive !== false ? 10 : 0;
            const bActive = b.isActive !== false ? 10 : 0;
            const aFpl = (Number(a.fplTeamId || 0) === eId) ? 5 : 0;
            const bFpl = (Number(b.fplTeamId || 0) === eId) ? 5 : 0;
            const scoreDiff = (bFunded + bActive + bFpl) - (aFunded + aActive + aFpl);
            if (scoreDiff !== 0) return scoreDiff;
            return Number(b.walletBalance || 0) - Number(a.walletBalance || 0);
        });

        const best = sorted[0];
        const anyFunded = candidates.some(c => c.hasPaid === true || Number(c.walletBalance || 0) > 0);
        const maxBalance = Math.max(...candidates.map(c => Number(c.walletBalance || 0)));
        const anyActive = candidates.some(c => c.isActive !== false);

        return {
            ...best,
            hasPaid: Boolean(best.hasPaid || anyFunded),
            walletBalance: Math.max(Number(best.walletBalance || 0), maxBalance),
            isActive: anyActive,
        };
    };

    const handleSaveFplId = async () => {
        if (!inputFplLeagueId || isNaN(Number(inputFplLeagueId))) return;
        if (!activeLeagueId) return;
        setIsSavingFplId(true);
        try {
            const leagueRef = doc(db, 'leagues', activeLeagueId);
            await updateDoc(leagueRef, { fplLeagueId: Number(inputFplLeagueId) });
            setDbFplLeagueId(Number(inputFplLeagueId));
            window.location.reload(); 
        } catch (err) {
            console.error("Failed to save FPL ID", err);
        } finally {
            setIsSavingFplId(false);
        }
    };

    const exportStandingsCSV = () => {
        const rows = [
            ['Rank', 'Member', 'Team', 'GW Points', 'Total Points'],
            ...standingsData.map((row: any) => [
                row.rank || '',
                row.player_name || '',
                row.entry_name || '',
                row.event_total || 0,
                row.total || 0,
            ])
        ];
        const csv = rows.map((r) => r.map(String).map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${(leagueName || 'league').replace(/\s/g, '_')}_standings.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const activeUserId = localStorage.getItem('activeUserId') || '';
    const myMember = members.find(m => m.id === activeUserId);
    const myFplTeamId = myMember ? Number((myMember as any).fplTeamId || 0) : 0;
    const myStandingIdx = standingsData.findIndex((r: any) =>
        myFplTeamId && Number(r.entry) === myFplTeamId
    );
    const myStanding = myStandingIdx >= 0 ? standingsData[myStandingIdx] : null;

    const currentGwAverage = standingsData.length > 0
        ? (standingsData.reduce((sum, row) => sum + row.event_total, 0) / standingsData.length).toFixed(1)
        : '0.0';

    const isMemberEligibleWinner = (row: any) => {
        const matched = getMemberStatus(row.player_name, row.entry_name, row.entry);
        if (matched) {
            if (matched.isActive === false) return false;
            if ((matched as any).isEliminated === true) return false;
            if ((matched as any).playMode === 'sidebets_only') return false;
        }
        return true;
    };

    const eligibleGwStandings = standingsData.filter(isMemberEligibleWinner);
    const candidatePool = eligibleGwStandings.length > 0 ? eligibleGwStandings : standingsData;
    const maxEligibleGwScore = candidatePool.reduce((max, r) => Math.max(max, Number(r.event_total || 0)), 0);

    const mergedRules = { ...((league as any)?.rules || {}), ...(leagueRules || {}) };
    const configuredSeasonWinnersCount = Math.max(1, Number(mergedRules.seasonWinnersCount || 3));
    const seasonWinnersMode = String(
        mergedRules.seasonWinnersMode || (
            configuredSeasonWinnersCount === 1
                ? 'top1'
                : configuredSeasonWinnersCount === 5
                    ? 'top5'
                    : configuredSeasonWinnersCount === 3
                        ? 'top3'
                        : 'custom'
        ),
    );
    const visibleSeasonWinnerCount = seasonWinnersMode === 'top1'
        ? 1
        : seasonWinnersMode === 'top3'
            ? 3
            : seasonWinnersMode === 'top5'
                ? 5
                : configuredSeasonWinnersCount; // 'custom' or fallback

    const seasonSnapshotLabel = `Top ${visibleSeasonWinnerCount}`;


    const isPendingMember = (m: any) =>
        Boolean(m && m.isPending === true && !m.hasPaid && Number(m.walletBalance || 0) <= 0);

    const hasEverFunded = (m: any) =>
        Boolean(
            m && (
                m.hasPaid === true ||
                Number(m.walletBalance || 0) > 0 ||
                Number((m as any).totalContributed || 0) > 0 ||
                Number((m as any).totalDeposited || 0) > 0 ||
                Number(memberDepositsMap[m.id || ''] || 0) > 0 ||
                Number(memberDepositsMap[m.displayName?.toLowerCase().trim() || ''] || 0) > 0
            )
        );

    // End-season snapshot: Omit spectators, eliminated members, and un-funded members; rank contenders by total score
    const seasonPool = standingsData.filter((r: any) => {
        const m = getMemberStatus(r.player_name, r.entry_name, r.entry);
        if (!m) return false;
        if ((m as any).playMode === 'sidebets_only') return false;
        if ((m as any).isEliminated === true) return false;
        if (m.isActive === false) return false;
        if (isPendingMember(m)) return false;
        if (!hasEverFunded(m)) return false;
        return true;
    }).map((r: any) => {
        const rawPre = preChamaPointsMap[Number(r.entry)];
        const fallbackPre = (effectiveLeagueStartGw > 1)
            ? Math.max(0, Number(r.total || 0) - Number(r.event_total || 0))
            : 0;
        const preDeduction = (standingsMode === 'clean_slate' && effectiveLeagueStartGw > 1)
            ? (rawPre !== undefined && rawPre > 0 ? rawPre : fallbackPre)
            : 0;
        const cleanTotal = Math.max(0, Number(r.total || 0) - preDeduction);
        return {
            ...r,
            cleanTotal,
            preDeduction,
            totalToCompare: (standingsMode === 'clean_slate' && effectiveLeagueStartGw > 1) ? cleanTotal : Number(r.total || 0),
        };
    });

    // Competition tie-ranking (e.g. 1, 1, 3)
    const sortedSeasonPool = [...seasonPool].sort((a: any, b: any) => Number(b.totalToCompare || 0) - Number(a.totalToCompare || 0));
    const rankedSeasonPool: any[] = [];
    for (let i = 0; i < sortedSeasonPool.length; i++) {
        const current = sortedSeasonPool[i];
        let rank = i + 1;
        let isTied = false;
        if (i > 0 && Number(current.totalToCompare || 0) === Number(sortedSeasonPool[i - 1].totalToCompare || 0)) {
            rank = rankedSeasonPool[i - 1].calculatedRank;
            isTied = true;
            rankedSeasonPool[i - 1].isTied = true;
        } else if (i < sortedSeasonPool.length - 1 && Number(current.totalToCompare || 0) === Number(sortedSeasonPool[i + 1].totalToCompare || 0)) {
            isTied = true;
        }
        rankedSeasonPool.push({
            ...current,
            calculatedRank: rank,
            isTied
        });
    }
    // Season rank for the hero card toggle
    const mySeasonEntry = myStanding ? rankedSeasonPool.find((r: any) => myFplTeamId && Number(r.entry) === myFplTeamId) : null;
    const mySeasonRank = mySeasonEntry ? (mySeasonEntry as any).calculatedRank : (myStandingIdx >= 0 ? myStandingIdx + 1 : null);

    // Gameweek rank for the hero card toggle
    const sortedGwPool = [...standingsData].sort((a: any, b: any) => Number(b.event_total || 0) - Number(a.event_total || 0));
    const myGwIdx = myStanding ? sortedGwPool.findIndex((r: any) => myFplTeamId && Number(r.entry) === myFplTeamId) : -1;
    const myGwRank = myGwIdx >= 0 ? myGwIdx + 1 : null;

    const topSeasonLeaders = rankedSeasonPool.slice(0, Math.min(visibleSeasonWinnerCount, rankedSeasonPool.length));
    const seasonPhase = currentEvent
        ? currentEvent >= 33
            ? 'Final Stretch'
            : currentEvent >= 20
                ? 'Mid Season'
                : 'Early Season'
        : 'In Progress';
    const currentGwLabel = currentEvent ? `GW${currentEvent}` : 'GW';

    if (isLoading) {
        return (
            <div className="fc-standings-page min-h-screen w-full font-sans text-slate-900 dark:text-white relative overflow-hidden bg-transparent">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6">
                    <Header role={role || 'member'} title={resolvedTitle} subtitle="Gameweek Rankings" />
                    <StandingsSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div
            className="fc-standings-page min-h-screen w-full font-sans text-slate-900 dark:text-white relative overflow-hidden bg-transparent"
        >
            {/* Ambient Lighting Background — smoothly blended like SideBets */}
            <div className="absolute inset-0 pointer-events-none opacity-60">
                <div className="absolute -top-24 right-[10%] h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="absolute bottom-10 left-[8%] h-80 w-80 rounded-full bg-emerald-500/8 blur-3xl" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 space-y-4 md:space-y-5 pb-6 lg:pb-8">
                {/* Header — matches other pages */}
                <Header role={role || 'member'} title={resolvedTitle} subtitle="Gameweek Rankings" />

                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pt-0 pb-1 mb-2">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-400 mb-1">
                            League Table
                        </p>
                        <h2 className="fc-frosty-title text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5 mb-1">
                            <Trophy className="w-6 h-6 text-emerald-400" /> Live Standings
                        </h2>
                        <p className="fc-metallic-sub text-sm font-medium max-w-xl leading-relaxed text-gray-400">
                            Real-time FPL performance rankings for your active league.
                        </p>
                    </div>

                    <div className="flex gap-2.5 flex-wrap items-center">
                        {effectiveLeagueStartGw > 1 && (
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-black/30 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={() => { haptics.selection(); setStandingsMode('clean_slate'); }}
                                    className={clsx(
                                        'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                                        standingsMode === 'clean_slate'
                                            ? 'bg-[#10B981] text-black shadow-xs'
                                            : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                                    )}
                                    title="Calculate standings from league kickoff GW on Fantasy Chama"
                                >
                                    Since Chama Start (GW{effectiveLeagueStartGw}+) 🏁
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { haptics.selection(); setStandingsMode('raw_fpl'); }}
                                    className={clsx(
                                        'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer',
                                        standingsMode === 'raw_fpl'
                                            ? 'bg-amber-500 text-black shadow-xs'
                                            : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                                    )}
                                    title="Overall FPL points since Gameweek 1"
                                >
                                    Overall FPL (GW1+)
                                </button>
                            </div>
                        )}
                        <div className="relative group">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-gray-500 group-focus-within:text-[#10B981] transition-colors">
                                <Search className="w-3.5 h-3.5" />
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-56 font-sans font-medium bg-slate-100 dark:bg-[#161d24] border border-slate-200 dark:border-white/10 rounded-xl py-1.5 pl-9 pr-3 text-[11px] sm:text-xs focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all placeholder:text-[11px] placeholder:text-slate-400 dark:placeholder:text-gray-500 text-slate-900 dark:text-white outline-none shadow-sm"
                                placeholder="Search members or teams..."
                            />
                        </div>
                        <button onClick={exportStandingsCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-wider rounded-xl transition whitespace-nowrap active:scale-95 cursor-pointer">
                            <Download className="w-3.5 h-3.5" /> Export
                        </button>
                    </div>
                </div>

                {/* Kickoff / Chama Start Explainer Banner */}
                {effectiveLeagueStartGw > 1 && (
                    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-slate-700 dark:text-gray-200 shadow-xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-[#10B981] shrink-0" />
                            <p className="text-[11px] sm:text-xs">
                                <strong>Fantasy Chama Kickoff GW{effectiveLeagueStartGw}:</strong>{' '}
                                {standingsMode === 'clean_slate'
                                    ? `Pre-chama rounds (GW1–${effectiveLeagueStartGw - 1}) are deducted so all members start on an equal footing since the league was created on Fantasy Chama.`
                                    : `Showing raw cumulative FPL points including pre-chama rounds from Gameweek 1.`}
                            </p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                            {standingsMode === 'clean_slate' ? 'Since Chama Start Active ✓' : 'Overall FPL (GW1+)'}
                        </span>
                    </div>
                )}

                {/* Stats Cards */}
                {/* Quick Fix Inline FPL ID Linker (only when existing league has error) */}
                {role === 'admin' && Boolean(dbFplLeagueId) && Boolean(error) && !isFplMaintenance && (
                    <div className="fc-card bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 w-full">
                        <div className="w-full md:flex-1 min-w-0">
                            <h3 className="font-bold text-emerald-600 dark:text-[#10B981] flex items-center gap-2 mb-1 text-sm sm:text-base">
                                <Zap className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> Update FPL League Link
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 break-words">Paste your numeric FPL League ID or Standings URL (e.g. fantasy.premierleague.com/leagues/123456/standings).</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                            <input
                                type="text"
                                placeholder="Paste Standings URL or ID..."
                                value={inputFplLeagueId}
                                onChange={(e) => {
                                    const raw = e.target.value.trim();
                                    if (raw.includes('auto-join')) {
                                        toast.error('That is an FPL invite link (auto-join). Please enter your numeric League ID from your standings page.');
                                        return;
                                    }
                                    const match = raw.match(/leagues\/(\d+)/) || raw.match(/(\d{4,9})/);
                                    const val = match && match[1] ? match[1] : raw.replace(/\D/g, '');
                                    setInputFplLeagueId(val);
                                }}
                                className="w-full sm:w-64 bg-white dark:bg-[#161d24] border border-slate-300 dark:border-[#10B981]/30 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                            />
                            <button
                                onClick={handleSaveFplId}
                                disabled={isSavingFplId || !inputFplLeagueId}
                                className="bg-[#10B981] text-black px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#10B981]/90 disabled:opacity-50 transition-colors text-xs sm:text-sm shadow-md w-full sm:w-auto shrink-0 cursor-pointer"
                            >
                                <Save className="w-4 h-4" /> Save Link
                            </button>
                        </div>
                    </div>
                )}

                {/* Graceful banner when using cached standings while FPL is 503 updating */}
                {isCachedStandings && isFplMaintenance && (
                    <FplServerStatusBanner
                        onRefresh={async () => {
                            setIsLoading(true);
                            setError(null);
                            if (!dbFplLeagueId) { setIsLoading(false); return; }
                            try {
                                const res = await fetchFplStandings(dbFplLeagueId);
                                setStandingsData(res?.results || []);
                                setIsCachedStandings(Boolean(res?.isCached));
                                setIsFplMaintenance(Boolean(res?.isMaintenance));
                            } catch (e: any) {
                                setError(e?.message || 'Sync failed');
                            } finally {
                                setIsLoading(false);
                            }
                        }}
                        className="mb-4"
                    />
                )}
                {/* Stats swapper + user hero */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Honest Funded Pot Members Card */}
                    <div className="fc-card bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between min-h-[88px] shadow-sm dark:shadow-md">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-1">Funded Pot Members</p>
                            {(() => {
                                const activeOnboardedPotContenders = standingsData.filter((row: any) => {
                                    const matched = getMemberStatus(row.player_name, row.entry_name, row.entry);
                                    if (!matched) return false;
                                    if (matched.isActive === false) return false;
                                    if (isPendingMember(matched)) return false;
                                    if ((matched as any).playMode === 'sidebets_only') return false;
                                    return true;
                                });
                                const totalPotMembers = activeOnboardedPotContenders.length || members.filter(m => m.isActive !== false && !isPendingMember(m) && (m as any).playMode !== 'sidebets_only').length;
                                const unpaidCount = Math.max(0, totalPotMembers - eligibleGwStandings.length);
                                const pendingOnboardingCount = standingsData.filter((row: any) => {
                                    const matched = getMemberStatus(row.player_name, row.entry_name, row.entry);
                                    return !matched || isPendingMember(matched);
                                }).length;
                                const spectatorCount = members.filter(m => m.isActive !== false && m.playMode === 'sidebets_only').length;

                                return (
                                    <>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                                            {eligibleGwStandings.length} <span className="text-sm font-bold text-slate-500 dark:text-gray-400">/ {totalPotMembers} Paid</span>
                                        </p>
                                        <p className="text-[10px] font-semibold mt-0.5">
                                            {unpaidCount > 0 ? (
                                                 <span className="text-rose-500 font-bold">{unpaidCount} in Red Zone (unpaid)</span>
                                            ) : (
                                                 <span className="text-emerald-600 dark:text-emerald-400 font-bold">All pot members funded ✓</span>
                                            )}
                                            {pendingOnboardingCount > 0 ? <span className="text-amber-600 dark:text-amber-400 font-medium"> · {pendingOnboardingCount} Pending Onboarding</span> : null}
                                            {spectatorCount > 0 ? <span className="text-slate-500 dark:text-gray-400 font-normal"> · {spectatorCount} Spectators (1v1 Bets)</span> : null}
                                        </p>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>

                    {/* User hero card with GW / Season rank toggle */}
                    {myStanding && (
                        <div className="fc-card bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:via-[#161d24] dark:to-[#161d24] bg-white dark:bg-[#161d24] border border-amber-500/25 dark:border-[#FBBF24]/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm dark:shadow-lg">
                            <div className="flex-1 min-w-0">
                                {/* Toggle pill */}
                                <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-black/30 p-1 rounded-xl border border-slate-300 dark:border-white/10 w-fit mb-3">
                                    <button
                                        type="button"
                                        onClick={() => { haptics.selection(); setHeroRankView('season'); }}
                                        className={clsx('px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all', heroRankView === 'season' ? 'bg-[#FBBF24] text-slate-950 shadow-sm' : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white')}
                                    >Season</button>
                                    <button
                                        type="button"
                                        onClick={() => { haptics.selection(); setHeroRankView('gw'); }}
                                        className={clsx('px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all', heroRankView === 'gw' ? 'bg-[#FBBF24] text-slate-950 shadow-sm' : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white')}
                                    >GW Rank</button>
                                </div>

                                {heroRankView === 'gw' ? (
                                    <>
                                        <p className="text-[10px] font-bold text-amber-700 dark:text-[#FBBF24]/70 uppercase tracking-widest mb-1">Your GW{currentEvent || ''} Rank</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                                            #{myGwRank || (myStandingIdx + 1)}
                                            <span className="text-sm font-bold text-amber-600 dark:text-[#FBBF24] ml-2">{myStanding.event_total} pts</span>
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">
                                            League avg: {currentGwAverage} pts
                                            {Number(myStanding.event_total) > Number(currentGwAverage)
                                                ? <span className="text-emerald-600 dark:text-emerald-400 ml-1">· {(Number(myStanding.event_total) - Number(currentGwAverage)).toFixed(0)} above avg</span>
                                                : myStandingIdx > 0 ? <span className="text-slate-500 dark:text-gray-500 ml-1">· {(Number(currentGwAverage) - Number(myStanding.event_total)).toFixed(0)} below avg</span> : null}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-[10px] font-bold text-amber-700 dark:text-[#FBBF24]/70 uppercase tracking-widest mb-1">Your Season Rank</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                                            #{mySeasonRank ?? (myStandingIdx + 1)}
                                            <span className="text-sm font-bold text-amber-600 dark:text-[#FBBF24] ml-2">{Number(myStanding.total || 0).toLocaleString()} pts</span>
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">
                                            {sortedSeasonPool[0] && mySeasonRank && mySeasonRank > 1
                                                ? `${(Number(sortedSeasonPool[0].total || 0) - Number(myStanding.total || 0)).toLocaleString()} pts behind #1`
                                                : mySeasonRank === 1 ? '🏆 Leading the season!' : 'Season standings'}
                                        </p>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        haptics.selection();
                                        setTeamPicksModal({
                                            isOpen: true,
                                            teamId: myStanding.entry,
                                            teamName: myStanding.entry_name,
                                            managerName: myStanding.player_name
                                        });
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
                                    title="View your starting XI, bench, and points"
                                >
                                    <Shirt className="w-3.5 h-3.5" /> View Your Lineup
                                </button>
                                <Trophy className="w-8 h-8 text-emerald-500/70 dark:text-emerald-400/60 hidden sm:block" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Standings — responsive card list */}
                {!dbFplLeagueId ? (
                    <div className="fc-card w-full bg-white dark:bg-[#161d24] border border-slate-200 dark:border-amber-500/20 p-6 sm:p-10 md:p-12 rounded-[2rem] text-center relative overflow-hidden mt-6 shadow-xl transition-colors">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
                            <Trophy className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2">No FPL League Linked Yet</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-300 max-w-lg mx-auto leading-relaxed mb-6">
                            Connect your Fantasy Premier League mini-league ID so FantasyChama can pull live weekly scores, rank managers, and calculate the pot winners.
                        </p>
                        {role === 'admin' ? (
                            <div className="max-w-md mx-auto space-y-4">
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        placeholder="Paste FPL Standings URL or numeric ID..."
                                        value={inputFplLeagueId}
                                        onChange={(e) => {
                                            const raw = e.target.value.trim();
                                            if (raw.includes('auto-join')) {
                                                toast.error('That is an FPL invite link (auto-join). Please enter your numeric League ID from your standings page URL.', { duration: 6000 });
                                                return;
                                            }
                                            const match = raw.match(/leagues\/(\d+)/) || raw.match(/(\d{4,9})/);
                                            const val = match && match[1] ? match[1] : raw.replace(/\D/g, '');
                                            setInputFplLeagueId(val);
                                        }}
                                        className="flex-1 bg-slate-50 dark:bg-[#0b1014] border border-slate-300 dark:border-white/15 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 w-full"
                                    />
                                    <button
                                        onClick={handleSaveFplId}
                                        disabled={isSavingFplId || !inputFplLeagueId}
                                        className="bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm transition-all w-full sm:w-auto shrink-0 cursor-pointer shadow-md"
                                    >
                                        {isSavingFplId ? 'Saving...' : 'Link League'}
                                    </button>
                                </div>
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-left text-xs space-y-1.5">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5 text-amber-500" />
                                        How to find your numeric FPL League ID:
                                    </p>
                                    <ol className="text-[11px] text-slate-600 dark:text-gray-400 list-decimal list-inside space-y-1 leading-relaxed">
                                        <li>Open <strong>fantasy.premierleague.com</strong> in your browser</li>
                                        <li>Go to <strong>Leagues & Cups</strong> → Click your Mini-League name</li>
                                        <li>Copy the number from your browser address bar: <code className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">/leagues/<strong>123456</strong>/standings</code></li>
                                    </ol>
                                </div>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-bold">
                                ⏳ Waiting for Chairman to link the FPL League Code
                            </div>
                        )}
                    </div>
                ) : error ? (
                    isFplMaintenance ? (
                        <div className="fc-card w-full bg-white dark:bg-[#161d24] border border-amber-500/25 p-8 sm:p-10 rounded-[2rem] text-center relative overflow-hidden mt-6 shadow-2xl">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 blur-[100px] pointer-events-none" />
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-500 dark:text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                                <RefreshCw className="w-7 h-7 animate-spin text-amber-500 dark:text-amber-400" />
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Chama & Vault Secured
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Official FPL Servers Updating</h3>
                            <p className="text-sm text-slate-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed mb-6">
                                Official Premier League servers are currently crunching matchday scores and bonus points, or undergoing scheduled maintenance. Your chama records and escrow pot are completely safe and will refresh live here automatically once Premier League servers finish updating.
                            </p>
                            <button
                                onClick={() => {
                                    setIsLoading(true);
                                    setError(null);
                                    if (dbFplLeagueId) {
                                        fetchFplStandings(dbFplLeagueId)
                                            .then((res: any) => {
                                                setStandingsData(res?.results || []);
                                                setIsCachedStandings(Boolean(res?.isCached));
                                                setIsFplMaintenance(Boolean(res?.isMaintenance));
                                            })
                                            .catch((err: any) => {
                                                setError(err?.message || 'Sync retry failed');
                                            })
                                            .finally(() => setIsLoading(false));
                                    } else {
                                        setIsLoading(false);
                                    }
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider transition active:scale-95 shadow-lg cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Check FPL Status
                            </button>
                        </div>
                    ) : (
                        <div className="fc-card w-full bg-[#161d24] border border-red-500/20 p-8 rounded-[2rem] text-center relative overflow-hidden mt-6">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500 blur-[80px] opacity-10 pointer-events-none"></div>
                            <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-4" />
                            <h3 className="text-xl font-black text-white mb-2">Sync Interrupted</h3>
                            <p className="text-red-400 font-bold mb-4 text-sm">{error}</p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
                                {role === 'admin' 
                                    ? "This usually happens if your FPL League ID is incorrect or missing. Use the green 'Update FPL League Link' box above to paste your exact Standings URL and restore the connection."
                                    : "The Chairman needs to update the FPL League link, or the official FPL servers are undergoing maintenance."}
                            </p>
                        </div>
                    )
                ) : (
                    <div className="fc-card w-full bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
                        {/* Desktop table header — hidden on mobile */}
                        <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 text-[10px] font-black text-emerald-600 dark:text-[#10B981] uppercase tracking-widest">
                            <div className="col-span-1">Rank</div>
                            <div className="col-span-4">Member</div>
                            <div className="col-span-3">FPL Team</div>
                            <div className="col-span-1 text-center">GW</div>
                            <div className="col-span-1 text-center">{standingsMode === 'clean_slate' && effectiveLeagueStartGw > 1 ? `GW${effectiveLeagueStartGw}+ Total` : 'Total'}</div>
                            <div className="col-span-2 text-right">Status</div>
                        </div>
                        {/* Rows */}
                        <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                            {(() => {
                                const isCleanSlateActive = standingsMode === 'clean_slate' && effectiveLeagueStartGw > 1;
                                const filteredRows = standingsData
                                    .filter((row: any) => {
                                        const matched = getMemberStatus(row.player_name, row.entry_name, row.entry);
                                        if (matched && matched.isActive === false) return false;
                                        if (searchQuery.trim()) {
                                            const q = searchQuery.toLowerCase();
                                            return (
                                                row.player_name?.toLowerCase().includes(q) ||
                                                row.entry_name?.toLowerCase().includes(q) ||
                                                matched?.displayName?.toLowerCase().includes(q)
                                            );
                                        }
                                        return true;
                                    })
                                    .map((row: any) => {
                                        const rawPre = preChamaPointsMap[Number(row.entry)];
                                        const fallbackPre = (effectiveLeagueStartGw > 1)
                                            ? Math.max(0, Number(row.total || 0) - Number(row.event_total || 0))
                                            : 0;
                                        const preDeduction = isCleanSlateActive
                                            ? (rawPre !== undefined && rawPre > 0 ? rawPre : fallbackPre)
                                            : 0;
                                        const cleanTotal = Math.max(0, Number(row.total || 0) - preDeduction);
                                        const seasonCompareScore = isCleanSlateActive ? cleanTotal : Number(row.total || 0);
                                        return {
                                            ...row,
                                            cleanTotal,
                                            preDeduction,
                                            seasonCompareScore,
                                        };
                                    })
                                    .sort((a: any, b: any) => {
                                        if (heroRankView === 'gw') {
                                            return Number(b.event_total || 0) - Number(a.event_total || 0);
                                        }
                                        return Number(b.seasonCompareScore || 0) - Number(a.seasonCompareScore || 0);
                                    });

                                // Competition tie-ranking (e.g. 1, 1, 3, 4...)
                                let currentCompetitionRank = 1;
                                const rankedRows = filteredRows.map((row: any, idx: number, arr: any[]) => {
                                    const compareKey = heroRankView === 'gw' ? 'event_total' : 'seasonCompareScore';
                                    if (idx > 0) {
                                        const prev = arr[idx - 1];
                                        if (Number(row[compareKey]) === Number(prev[compareKey])) {
                                            // Tied with previous row!
                                        } else {
                                            currentCompetitionRank = idx + 1;
                                        }
                                    } else {
                                        currentCompetitionRank = 1;
                                    }
                                    const isTied = (idx > 0 && Number(row[compareKey]) === Number(arr[idx - 1][compareKey])) ||
                                                   (idx < arr.length - 1 && Number(row[compareKey]) === Number(arr[idx + 1][compareKey]));
                                    return {
                                        ...row,
                                        displayRank: currentCompetitionRank,
                                        isTied
                                    };
                                });

                                return rankedRows.map((row: any, index: number) => {
                                const rankNum = Number(row.displayRank || index + 1);
                                const isInPodium = rankNum <= visibleSeasonWinnerCount;
                                const matchedMember = getMemberStatus(row.player_name, row.entry_name, row.entry);
                                const isSpectator = (matchedMember as any)?.playMode === 'sidebets_only';
                                const stake = Number(
                                    leagueRules?.gameweekStake ||
                                    (league as any)?.gameweekStake ||
                                    (league as any)?.rules?.gameweekStake ||
                                    (league as any)?.monthlyFee ||
                                    0
                                );
                                const memberBalance = Number(matchedMember?.walletBalance || 0);
                                const totalDeposited = Number((matchedMember as any)?.totalDeposited || 0);
                                const isGwWinnerRow = Boolean(
                                    !isSpectator &&
                                    maxEligibleGwScore > 0 &&
                                    Number(row.event_total) === maxEligibleGwScore
                                );
                                const memberDeposited = Math.max(
                                    totalDeposited,
                                    Number(memberDepositsMap[matchedMember?.id || ''] || 0),
                                    Number(memberDepositsMap[matchedMember?.displayName?.toLowerCase().trim() || ''] || 0),
                                    Number(memberDepositsMap[row.player_name?.toLowerCase().trim() || ''] || 0)
                                );
                                const isFunded = Boolean(
                                    isGwWinnerRow ||
                                    (
                                        matchedMember &&
                                        matchedMember.isActive !== false &&
                                        !isSpectator &&
                                        (
                                            matchedMember.hasPaid === true ||
                                            memberBalance > 0 ||
                                            memberDeposited > 0 ||
                                            (stake > 0 && memberBalance >= stake) ||
                                            (stake > 0 && memberDeposited >= stake)
                                        )
                                    )
                                );
                                const isMe = myStanding && row.id === myStanding.id;
                                const isSeasonView = heroRankView === 'season';
                                const displaySeasonTotal = isCleanSlateActive ? Number(row.cleanTotal ?? (row.total - (row.preDeduction || 0))) : Number(row.total || 0);
                                const maxSeasonScore = Math.max(...filteredRows.map((r: any) => Number(r.seasonCompareScore || 0)), 0);
                                const isOverallSeasonLeader = !isSpectator && maxSeasonScore > 0 && Number(row.seasonCompareScore) === maxSeasonScore;
                                const isSeasonLeader = isSeasonView ? rankNum === 1 : isOverallSeasonLeader;
                                const isDoubleCrown = isOverallSeasonLeader && isGwWinnerRow;
                                const medal = isSeasonView
                                    ? (rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : null)
                                    : (rankNum === 1 ? '🥇' : null);
                                const podiumBorder = isDoubleCrown
                                    ? 'border-l-4 border-l-amber-400 ring-2 ring-amber-400/60'
                                    : isSeasonLeader
                                    ? 'border-l-4 border-l-amber-400 ring-1 ring-amber-400/50'
                                    : isGwWinnerRow
                                    ? 'border-l-4 border-l-emerald-500 ring-1 ring-emerald-500/40'
                                    : isSeasonView
                                    ? (rankNum === 2 ? 'border-l-4 border-l-slate-300' : rankNum === 3 ? 'border-l-4 border-l-amber-700' : 'border-l-4 border-l-transparent')
                                    : (rankNum === 1 ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-transparent');
                                return (
                                    <div
                                        key={row.id}
                                        data-testid={`standings-row-${row.id || index}`}
                                        style={{ animationDelay: `${Math.min(index * 45, 600)}ms` }}
                                        onClick={() => {
                                            haptics.selection();
                                            setTeamPicksModal({
                                                isOpen: true,
                                                teamId: row.entry,
                                                teamName: row.entry_name,
                                                managerName: row.player_name
                                            });
                                        }}
                                        className={clsx(
                                            'px-4 py-3 md:grid md:grid-cols-12 md:gap-3 md:items-center md:px-5 md:py-4 flex flex-col transition-all animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards cursor-pointer group',
                                            podiumBorder,
                                            isDoubleCrown
                                                ? 'bg-gradient-to-r from-amber-500/20 via-emerald-500/15 to-amber-500/20 hover:from-amber-500/25 hover:to-amber-500/25 shadow-md'
                                                : isSeasonLeader
                                                ? 'bg-amber-400/15 hover:bg-amber-400/20 dark:bg-amber-400/10 dark:hover:bg-amber-400/15 shadow-xs'
                                                : isGwWinnerRow
                                                ? 'bg-emerald-500/15 hover:bg-emerald-500/20 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15 shadow-xs'
                                                : (isSeasonView && isInPodium && index > 0)
                                                ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]'
                                                : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                                            isMe ? 'ring-1 ring-[#FBBF24]/40' : ''
                                        )}
                                        title={`Tap to view ${row.player_name}'s team lineup`}
                                    >
                                        {/* Rank + Avatar + Name (Row 1 on Mobile, Col 1-5 on Desktop) */}
                                        <div className="flex items-center gap-3 md:col-span-5 w-full">
                                            <span className={clsx(
                                                'font-extrabold text-lg md:text-base tabular-nums w-7 text-center shrink-0 flex items-center justify-center',
                                                isDoubleCrown || isSeasonLeader
                                                    ? 'text-amber-500 dark:text-amber-400'
                                                    : isGwWinnerRow
                                                    ? 'text-emerald-600 dark:text-[#10B981]'
                                                    : 'text-slate-600 dark:text-gray-400'
                                            )}>
                                                {medal || rankNum}
                                            </span>
                                            <UserAvatar name={row.player_name} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5 flex-wrap group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                                                    <span className="truncate max-w-[170px] md:max-w-none">{row.player_name}</span>
                                                    {isDoubleCrown && (
                                                        <span className="bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-black shadow-xs flex items-center gap-1">
                                                            🐐 GOAT
                                                        </span>
                                                    )}
                                                    {isGwWinnerRow && !isDoubleCrown && (
                                                        <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider font-black border border-emerald-500/40">
                                                            ⚡ GW Winner
                                                        </span>
                                                    )}
                                                    {matchedMember?.id === chairmanId && (
                                                        <span className="bg-[#FBBF24]/10 text-[#FBBF24] text-[8px] px-1 py-0.5 rounded uppercase tracking-widest font-black border border-[#FBBF24]/30">Chair</span>
                                                    )}
                                                </span>
                                                <p className="text-[11px] text-slate-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate md:hidden flex items-center gap-1 mt-0.5">
                                                    <Shirt className="w-3 h-3 text-emerald-600 dark:text-emerald-400/80 shrink-0" />
                                                    {row.entry_name}
                                                </p>
                                            </div>
                                        </div>

                                        {/* FPL Team — desktop only */}
                                        <div className="hidden md:flex md:col-span-3 text-slate-600 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors text-sm italic truncate pr-2 items-center gap-1.5">
                                            <Shirt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400/70 shrink-0" />
                                            <span className="truncate">{row.entry_name}</span>
                                        </div>

                                        {/* Stats Row (Row 2 on Mobile, Col 9-12 on Desktop) */}
                                        <div className="flex items-center justify-between md:contents mt-3 md:mt-0 pt-3 md:pt-0 border-t border-slate-200 dark:border-white/5 md:border-0 w-full">
                                            {isSeasonView ? (
                                                <>
                                                    <div className="flex flex-col md:block items-center md:col-span-1 md:text-center order-1 md:order-2">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-[#FBBF24] md:hidden mb-1.5">
                                                            {isCleanSlateActive ? `GW${effectiveLeagueStartGw}+ Total` : 'Season Total'}
                                                        </span>
                                                        <div className="font-extrabold text-slate-900 dark:text-white text-sm tabular-nums bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg md:bg-transparent md:border-0 md:p-0">
                                                            {displaySeasonTotal.toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col md:block items-center md:col-span-1 md:text-center order-2 md:order-1">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 md:hidden mb-1.5">GW Pts</span>
                                                        <span className="px-2 py-0.5 font-bold rounded-lg text-xs tabular-nums border text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5">
                                                            {row.event_total}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex flex-col md:block items-center md:col-span-1 md:text-center">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 md:hidden mb-1.5">GW Pts</span>
                                                        <span className={clsx(
                                                            'px-2.5 py-1 font-bold rounded-lg text-xs tabular-nums border md:inline-block transition-all',
                                                            isGwWinnerRow
                                                                ? 'bg-[#10B981] text-black font-black border-transparent shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                                                                : 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-slate-200 border-slate-200 dark:border-white/5'
                                                        )}>
                                                            {row.event_total}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col md:block items-center md:col-span-1 md:text-center">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 md:hidden mb-1.5">
                                                            {isCleanSlateActive ? `GW${effectiveLeagueStartGw}+ Total` : 'Total'}
                                                        </span>
                                                        <div className="font-extrabold text-slate-900 dark:text-white text-sm tabular-nums">
                                                            {displaySeasonTotal.toLocaleString()}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            <div className="md:col-span-2 flex justify-end md:justify-end items-center w-28 md:w-auto">
                                                {isSpectator ? (
                                                    <span className="font-black text-[9px] md:text-[10px] tracking-tight border px-2 py-0.5 rounded-lg text-indigo-300 border-indigo-500/30 bg-indigo-500/15 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Spectator
                                                    </span>
                                                ) : !isFunded ? (
                                                    (matchedMember as any)?.isEliminated ? (
                                                        <span className="font-black text-[9px] md:text-[10px] tracking-tight border px-2 py-0.5 rounded-lg text-red-400 border-red-500/25 bg-red-500/10 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Eliminated
                                                        </span>
                                                    ) : (matchedMember as any)?.isPending ? (
                                                        <span className="font-black text-[9px] md:text-[10px] tracking-tight border px-2 py-0.5 rounded-lg text-amber-500 dark:text-amber-400 border-amber-500/25 bg-amber-500/10 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Pending Onboarding
                                                        </span>
                                                    ) : (
                                                        <span className="font-black text-[9px] md:text-[10px] tracking-tight border px-2 py-0.5 rounded-lg text-amber-500 dark:text-amber-400 border-amber-500/25 bg-amber-500/10 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Pending Deposit
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="font-black text-[9px] md:text-[10px] tracking-tight border px-2 py-0.5 rounded-lg text-emerald-600 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Funded
                                                    </span>
                                                )}
                                                {/* Hide lineup button on own row — hero card already has it */}
                                                {!isMe && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        haptics.selection();
                                                        setTeamPicksModal({
                                                            isOpen: true,
                                                            teamId: row.entry,
                                                            teamName: row.entry_name,
                                                            managerName: row.player_name
                                                        });
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ml-1.5 shadow-xs"
                                                    title={`View ${row.player_name}'s gameweek lineup`}
                                                >
                                                    <Shirt className="w-3 h-3 text-emerald-400" />
                                                    <span>Lineup</span>
                                                </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                            {standingsData.length === 0 && (
                                <div className="px-5 py-10 text-center text-gray-500 font-bold text-sm">
                                    No standings returned yet. Try updating the FPL league link and syncing again.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!error && performanceData.length > 0 && (
                    <div className="fc-card bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/5 shadow-xl rounded-[1.5rem] p-5 text-slate-900 dark:text-white">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div>
                                <h4 className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-gray-300 uppercase tracking-wider">
                                    <BarChart3 className="w-4 h-4 text-emerald-500" /> Performance Trajectory ({trajectoryView === 'top5' ? 'Top 5 + You' : trajectoryView === 'top10' ? 'Top 10' : 'All Contenders'})
                                    {effectiveLeagueStartGw > 1 && (
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 normal-case tracking-normal">
                                            Chama Commenced: GW{effectiveLeagueStartGw}
                                        </span>
                                    )}
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium mt-0.5">
                                    Recent Gameweek points progression comparing leaders against your score and the league average. Tap any manager to spotlight.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setTrajectoryView('top5')}
                                        className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all', trajectoryView === 'top5' ? 'bg-emerald-500 text-black shadow-xs' : 'text-gray-400 hover:text-white')}
                                    >
                                        Top 5 + You
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTrajectoryView('top10')}
                                        className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all', trajectoryView === 'top10' ? 'bg-emerald-500 text-black shadow-xs' : 'text-gray-400 hover:text-white')}
                                    >
                                        Top 10
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTrajectoryView('all')}
                                        className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all', trajectoryView === 'all' ? 'bg-emerald-500 text-black shadow-xs' : 'text-gray-400 hover:text-white')}
                                    >
                                        All Loaded
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-400/10 border border-amber-300 dark:border-amber-400/25 text-amber-800 dark:text-[#FBBF24] text-xs font-bold shadow-xs">
                                    <span className="w-2.5 h-0.5 bg-amber-500 dark:bg-[#FBBF24] inline-block" />
                                    <span>GW Avg: <strong className="tabular-nums font-black">{currentGwAverage}</strong> pts</span>
                                    {!isCurrentEventFinished && Number(currentGwAverage) <= 5 && (
                                        <span className="text-[8px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400 ml-0.5 animate-pulse">Live</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Interactive & Clear Legend Chips for PC & Mobile */}
                        {(() => {
                            const colors = ['#10B981', '#3B82F6', '#F43F5E', '#A855F7', '#F97316', '#06B6D4', '#EAB308', '#EC4899', '#8B5CF6', '#14B8A6'];
                            const allKeysSet = new Set<string>();
                            performanceData.forEach((row) => {
                                Object.keys(row || {}).forEach((k) => {
                                    if (k !== 'name' && k !== 'Average') {
                                        allKeysSet.add(k);
                                    }
                                });
                            });
                            const allKeys = Array.from(allKeysSet);
                            const myMember = members.find(m => m.id === (localStorage.getItem('activeUserId') || ''));
                            const myFirstName = myMember?.displayName ? myMember.displayName.split(' ')[0] : '';
                            const playerKeys = trajectoryView === 'top5'
                                ? allKeys.filter((k, idx) => idx < 5 || (myFirstName && k.toLowerCase().includes(myFirstName.toLowerCase())))
                                : trajectoryView === 'top10'
                                ? allKeys.filter((k, idx) => idx < 10 || (myFirstName && k.toLowerCase().includes(myFirstName.toLowerCase())))
                                : allKeys;

                            return (
                                <>
                                    <div className="flex items-center gap-2 flex-wrap mb-4 pt-1">
                                        {playerKeys.map((playerKey, idx) => {
                                             const isYou = myFirstName && (playerKey.toLowerCase() === myFirstName.toLowerCase() || playerKey.toLowerCase().includes(myFirstName.toLowerCase()));
                                            const isSpotlit = spotlightPlayer === playerKey;
                                            const isMuted = spotlightPlayer && !isSpotlit;
                                            const lastScore = performanceData[performanceData.length - 1]?.[playerKey];
                                            const color = colors[idx % colors.length];
                                            return (
                                                <button
                                                    type="button"
                                                    key={playerKey}
                                                    onClick={() => setSpotlightPlayer((prev: string | null) => prev === playerKey ? null : playerKey)}
                                                    className={clsx(
                                                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all shadow-xs cursor-pointer active:scale-95",
                                                        isSpotlit
                                                            ? "bg-amber-400/20 border-[#FBBF24] text-white ring-2 ring-[#FBBF24]/50 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                                                            : isYou
                                                            ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300 ring-1 ring-emerald-500/30"
                                                            : isMuted
                                                            ? "opacity-40 bg-slate-100/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-400 dark:text-gray-500"
                                                            : "bg-slate-100/90 dark:bg-white/[0.05] border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:border-white/25"
                                                    )}
                                                    title={`Click to ${isSpotlit ? 'un-spotlight' : 'spotlight'} ${playerKey}'s line`}
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                                                    <span>{playerKey} {isYou && <strong className="text-emerald-600 dark:text-emerald-400 font-black">(You)</strong>}</span>
                                                    {lastScore !== undefined && (
                                                        <span className="text-[10px] font-black text-slate-500 dark:text-gray-400 tabular-nums ml-0.5">
                                                            {lastScore} pts
                                                            {!isCurrentEventFinished && lastScore === 0 && (
                                                                <span className="text-[8px] text-amber-500 font-bold ml-0.5">• live</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300">
                                            <span className="w-3 h-0.5 bg-amber-500 inline-block border-t border-dashed" />
                                            <span>League Avg: <strong className="tabular-nums">{currentGwAverage}</strong> pts</span>
                                        </div>
                                        {spotlightPlayer && (
                                            <button
                                                type="button"
                                                onClick={() => setSpotlightPlayer(null)}
                                                className="text-[10px] font-bold text-amber-400 hover:underline px-1.5 py-0.5"
                                            >
                                                ✕ Clear spotlight
                                            </button>
                                        )}
                                    </div>

                                    <div className="h-64 sm:h-72 w-full" style={{ position: 'relative' }}>
                                        <ResponsiveContainer width="100%" height={260} minWidth={100} debounce={100}>
                                            <LineChart data={performanceData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={30} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f1720', borderColor: 'rgba(255,255,255,0.12)', borderRadius: '14px', fontSize: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                                    itemStyle={{ fontWeight: 'bold' }}
                                                />
                                                {effectiveLeagueStartGw && effectiveLeagueStartGw > 1 && (
                                                    <ReferenceLine
                                                        x={`GW${effectiveLeagueStartGw}`}
                                                        stroke="#10B981"
                                                        strokeDasharray="4 4"
                                                        strokeWidth={2}
                                                        label={{
                                                            value: `🏁 Kickoff (GW${effectiveLeagueStartGw})`,
                                                            position: 'insideTopLeft',
                                                            fill: '#10B981',
                                                            fontSize: 10,
                                                            fontWeight: 800,
                                                            offset: 8
                                                        }}
                                                    />
                                                )}
                                                {playerKeys.map((playerKey, idx) => {
                                                    const color = colors[idx % colors.length];
                                                    const isSpotlit = spotlightPlayer === playerKey;
                                                    const isMuted = spotlightPlayer && !isSpotlit;
                                                    return (
                                                        <Line
                                                            key={playerKey}
                                                            type="monotone"
                                                            dataKey={playerKey}
                                                            stroke={color}
                                                            strokeWidth={isSpotlit ? 4.5 : isMuted ? 1 : 2.5}
                                                            strokeOpacity={isMuted ? 0.2 : 1}
                                                            dot={isMuted ? false : { r: isSpotlit ? 5 : 3.5, fill: color, strokeWidth: 0 }}
                                                            activeDot={{ r: 6 }}
                                                        />
                                                    );
                                                })}
                                                <Line type="monotone" dataKey="Average" stroke="#FBBF24" strokeWidth={2.5} strokeDasharray="5 5" dot={false} name="League Avg" strokeOpacity={spotlightPlayer ? 0.4 : 1} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {!error && topSeasonLeaders.length > 0 && (Number(leagueRules.vault ?? 30) > 0) && (
                    <div className="fc-card bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/5 rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white tracking-tight">Season Race Snapshot</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-gray-500 mt-1">
                                    {seasonSnapshotLabel} • end-season vault leaders only
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {topSeasonLeaders[0] && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const topLead = topSeasonLeaders[0];
                                            setFlexCardData({
                                                winnerName: topLead.player_name,
                                                teamName: topLead.entry_name,
                                                points: Number(topLead.event_total || topLead.total || 0),
                                                amountWon: Number((topLead as any)?.projectedPayout || (topLead as any)?.amount || 0),
                                                gameweek: currentEvent || 1,
                                                isJointWinner: Boolean(topLead.isTied),
                                                tiedCount: topLead.isTied ? 2 : 1
                                            });
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/10 hover:from-amber-500/30 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-xs"
                                        title="Preview and share live leader card on WhatsApp"
                                    >
                                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Share Leader Card ↗</span>
                                    </button>
                                )}
                                {currentEvent && (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-[#FBBF24]/25 bg-[#FBBF24]/10 text-[#FBBF24]">
                                        {currentGwLabel}
                                    </span>
                                )}
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]">
                                    {seasonPhase}
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
                            {topSeasonLeaders.slice(0, 3).map((leader: any, idx: number) => {
                                const leaderRank = Number(leader.calculatedRank || idx + 1);
                                const leaderMedal = leaderRank === 1 ? '🥇' : leaderRank === 2 ? '🥈' : leaderRank === 3 ? '🥉' : null;
                                const isLeaderFunded = isMemberEligibleWinner(leader);
                                const isLeaderTied = Boolean(leader.isTied);
                                return (
                                    <div 
                                        key={leader.id || idx} 
                                        onClick={() => {
                                            setFlexCardData({
                                                winnerName: leader.player_name,
                                                teamName: leader.entry_name,
                                                points: Number(leader.event_total || leader.total || 0),
                                                amountWon: Number((leader as any)?.projectedPayout || (leader as any)?.amount || 0),
                                                gameweek: currentEvent || 1,
                                                isJointWinner: Boolean(leader.isTied),
                                                tiedCount: leader.isTied ? 2 : 1
                                            });
                                        }}
                                        className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0b1014]/90 p-2.5 sm:p-3.5 flex flex-col justify-between shadow-sm dark:shadow-lg hover:border-amber-500/40 transition-all min-w-0 cursor-pointer group select-none"
                                        title="Click to view and share champion card"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-1 mb-1.5">
                                                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-amber-500 dark:text-amber-400 flex items-center gap-1 truncate">
                                                    {leaderMedal ? `${leaderMedal} #${leaderRank}` : `#${leaderRank}`}
                                                    {isLeaderTied && (
                                                        <span className="text-[7px] sm:text-[8px] font-black text-amber-700 dark:text-amber-300 bg-amber-500/20 border border-amber-500/35 rounded px-1 py-0.2">
                                                            Tied
                                                        </span>
                                                    )}
                                                </span>
                                                {isLeaderFunded ? (
                                                    <span className="text-[7px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 truncate">
                                                        ✓ Funded
                                                    </span>
                                                ) : (
                                                    <span className="text-[7px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-[#FBBF24] border border-amber-500/30 truncate" title="Deposit required to claim vault prize">
                                                        ⏳ Pending
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-amber-400 transition-colors">{leader.player_name}</p>
                                            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-gray-400 truncate mt-0.5">{leader.entry_name}</p>
                                        </div>
                                        <div className="mt-2 pt-1.5 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs sm:text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate">{Number(leader.total || 0).toLocaleString()} pts</p>
                                                <p className="text-[8px] sm:text-[10px] text-slate-500 dark:text-gray-500 font-bold mt-0.5 truncate">
                                                    {isLeaderFunded ? (
                                                        Number(leader.total || 0) === Number(topSeasonLeaders[0]?.total || 0)
                                                            ? (isLeaderTied ? 'Tied for Lead' : 'Vault Leader')
                                                            : `${Math.max(0, Number(topSeasonLeaders[0]?.total || 0) - Number(leader.total || 0)).toLocaleString()} behind`
                                                    ) : (
                                                        <span className="text-amber-600 dark:text-amber-400/90 font-medium">Pending deposit</span>
                                                    )}
                                                </p>
                                            </div>
                                            <Share2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-colors shrink-0" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {!error && gwWinnersLedger.length > 0 && (
                    <div className="fc-card bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/5 rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-xl">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white tracking-tight">Gameweek Winners Ledger</h3>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mt-0.5">Historical and upcoming round payouts</p>
                            </div>
                        </div>
                        <div ref={ledgerRailRef} className="fc-gw-ledger-rail flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
                            {gwWinnersLedger.map((item: any) => {
                                const isVoided = Boolean(item.isVoided);
                                const isPreLeague = Boolean(item.isPreLeague);
                                const isSkipped = Boolean(item.isSkipped);
                                const isAwaitingPayment = Boolean(item.isAwaitingPayment);
                                const isApprovedPaid = Boolean(item.isPaid);
                                const isCurrentGw = currentEvent === item.gw;
                                const isCurrentLive = !isCurrentEventFinished && (Boolean(item.isCurrentLive) || isCurrentGw);
                                const isResolved = isApprovedPaid || (!isCurrentLive && !item.isUpcoming && !isVoided && !isPreLeague && !isSkipped && item.winnerName && item.winnerName !== 'Upcoming' && item.winnerName !== 'Unresolved');
                                const isNextUpcoming = item.gw === ((isCurrentEventFinished && currentEvent) ? currentEvent + 1 : (currentEvent || 1) + 1);
                                const isSeasonOnlyLeague = Number(leagueRules?.weekly ?? (league as any)?.rules?.weekly ?? 70) === 0 || item.amount === 0;

                                return (
                                    <div
                                        onClick={() => {
                                            if (item.winnerName && item.winnerName !== 'Upcoming' && item.winnerName !== 'Unresolved' && item.winnerName !== 'In Progress') {
                                                setFlexCardData({
                                                    winnerName: item.winnerName,
                                                    teamName: item.winnerTeam,
                                                    points: Number(item.points || 0),
                                                    amountWon: Number(item.amount || 0),
                                                    gameweek: item.gw,
                                                    isJointWinner: Boolean(item.isTie),
                                                    tiedCount: item.tiedCount || 1
                                                });
                                            }
                                        }}
                                        key={item.gw}
                                        data-gw-card={item.gw}
                                        className={clsx(
                                            'fc-gw-ledger-card snap-start shrink-0 w-56 sm:w-60 lg:w-52 rounded-xl border p-3.5 transition-all shadow-sm select-none',
                                            (isApprovedPaid || isResolved || isCurrentLive) && 'cursor-pointer hover:border-amber-500/50',
                                            isApprovedPaid || isResolved
                                                ? 'fc-gw-ledger-card-resolved border-emerald-500/30 bg-emerald-500/10'
                                                : isCurrentLive
                                                ? 'border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-500/30'
                                                : isAwaitingPayment
                                                ? 'border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-500/30'
                                                : isPreLeague
                                                ? 'border-slate-300 dark:border-slate-500/25 bg-slate-100/90 dark:bg-slate-500/8 text-slate-700 dark:text-slate-300'
                                                : isVoided || isSkipped
                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                                : isNextUpcoming
                                                ? 'border-white/15 bg-white/[0.03]'
                                                : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/25'
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className="text-[9px] uppercase tracking-widest font-black text-slate-500 dark:text-gray-400">GW {item.gw}</p>
                                            {isPreLeague ? (
                                                 <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-500/30">
                                                     Pre-Chama
                                                 </span>
                                            ) : isVoided || isSkipped ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                                    Skipped
                                                </span>
                                            ) : isCurrentLive ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#FBBF24]/20 text-amber-700 dark:text-[#FBBF24] border border-[#FBBF24]/40 animate-pulse">
                                                    Live · In Play
                                                </span>
                                            ) : isApprovedPaid ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> {isSeasonOnlyLeague || item.amount === 0 ? 'Resolved ✓' : 'Paid ✓'}
                                                </span>
                                            ) : isResolved ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Resolved ✓
                                                </span>
                                            ) : isAwaitingPayment ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40">
                                                    Awaiting Payout
                                                </span>
                                            ) : (
                                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-500 border border-slate-200 dark:border-white/10">
                                                    Upcoming
                                                </span>
                                            )}
                                        </div>
                                        <p className={clsx(
                                            'text-xs font-black truncate',
                                            isApprovedPaid || isResolved ? 'text-slate-900 dark:text-white' : isCurrentLive ? 'text-amber-400 dark:text-[#FBBF24]' : isPreLeague ? 'text-slate-600 dark:text-slate-400' : isVoided || isSkipped ? 'text-amber-600 dark:text-amber-300' : 'text-slate-400 dark:text-gray-500'
                                        )}>
                                            {isCurrentLive && item.winnerName !== 'In Progress' ? `Live Leader: ${item.winnerName}` : item.winnerName}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate mt-1">
                                            {isPreLeague
                                                ? 'Pre-League · No fees'
                                                : isCurrentLive
                                                ? 'Crowned after final whistle'
                                                : isVoided || isSkipped
                                                ? (item.winnerTeam || 'Not resolved / Unplayed')
                                                : isAwaitingPayment
                                                ? `${item.winnerTeam || 'Awaiting Payment'}`
                                                : item.winnerTeam || (isApprovedPaid ? (isSeasonOnlyLeague || item.amount === 0 ? 'Season Vault · Points Secured' : 'Payout recorded') : isResolved ? 'Winner crowned' : 'Pending kickoff')}
                                        </p>
                                        {(isApprovedPaid || isAwaitingPayment || isResolved) && typeof item.amount === 'number' && item.amount > 0 && !isSeasonOnlyLeague && (
                                            <p className="text-[10px] font-black text-[#FBBF24] mt-1">KES {item.amount.toLocaleString()}</p>
                                        )}
                                        {isSeasonOnlyLeague && (isApprovedPaid || isResolved) && (
                                            <p className="text-[10px] font-black text-amber-400 mt-1">100% Season Vault</p>
                                        )}
                                        {isCurrentLive && typeof item.amount === 'number' && item.amount > 0 && (
                                            <p className="text-[10px] font-bold text-amber-300/80 mt-1">Est. Pot: KES {item.amount.toLocaleString()}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Champion Flex Card Modal */}
                {flexCardData && (
                    <ChampionFlexCardModal
                        isOpen={!!flexCardData}
                        onClose={() => setFlexCardData(null)}
                        winnerName={flexCardData.winnerName}
                        teamName={flexCardData.teamName}
                        points={flexCardData.points}
                        gameweek={flexCardData.gameweek}
                        amountWon={flexCardData.amountWon}
                        leagueName={leagueName || 'League'}
                        leagueCode={(league as any)?.code || ''}
                        sharedBy={role === 'admin' ? 'chairman' : 'winner'}
                        chairmanName={myMember?.displayName || 'The Chairman'}
                        isJointWinner={flexCardData.isJointWinner}
                        tiedCount={flexCardData.tiedCount}
                    />
                )}

                {/* Team Gameweek Lineup Modal */}
                {teamPicksModal.isOpen && (
                    <TeamPicksModal
                        isOpen={teamPicksModal.isOpen}
                        onClose={() => setTeamPicksModal(prev => ({ ...prev, isOpen: false }))}
                        teamId={teamPicksModal.teamId}
                        teamName={teamPicksModal.teamName}
                        managerName={teamPicksModal.managerName}
                        gameweek={currentEvent || 1}
                        myTeamId={myStanding?.entry || (myMember ? Number((myMember as any).fplTeamId || 0) : null)}
                        myTeamName={myStanding?.entry_name || myMember?.teamName || 'Your Team'}
                        myManagerName={myStanding?.player_name || myMember?.displayName || 'You'}
                        onSelectTeam={(tId, tName, mName) => {
                            setTeamPicksModal({
                                isOpen: true,
                                teamId: tId,
                                teamName: tName,
                                managerName: mName,
                            });
                        }}
                    />
                )}
            </div>
        </div>
    );
}
