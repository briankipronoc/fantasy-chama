import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Trophy, Star, Zap, Circle, Save, ShieldAlert, BarChart3, Users } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import clsx from 'clsx';
import Header from '../components/Header';
import ChampionFlexCardModal from '../components/ChampionFlexCardModal';
import UserAvatar from '../components/UserAvatar';
import { StandingsSkeleton } from '../components/Skeleton';

const fetchFplStandings = async (leagueId: number) => {
    // Check cache
    const cacheKey = `fpl_standings_${leagueId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        // 5-minute TTL caching to prevent Firebase/FPL quota limits during mass refreshes
        if (Date.now() - timestamp < 300000) {
            return data;
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
                lastError = `FPL API returned ${response.status}. League ID may be invalid.`;
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

    throw new Error(lastError);
};

export default function Standings() {
    const navigate = useNavigate();
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
    const [leagueName, setLeagueName] = useState(() => league?.name || localStorage.getItem('activeLeagueName') || '');
    const [chairmanId, setChairmanId] = useState<string | null>(null);
    const [coAdminId, setCoAdminId] = useState<string | null>(null);
    const [dbFplLeagueId, setDbFplLeagueId] = useState<number | null>(null);
    const [inputFplLeagueId, setInputFplLeagueId] = useState('');
    const [isSavingFplId, setIsSavingFplId] = useState(false);
    const [currentEvent, setCurrentEvent] = useState<number | null>(null);
    const [isCurrentEventFinished, setIsCurrentEventFinished] = useState(false);
    const [leagueRules, setLeagueRules] = useState<any>({});
    const [forfeitedGws, setForfeitedGws] = useState<number[]>([]);
    const [leagueStartGw, setLeagueStartGw] = useState<number>(1);
    const [gwWinnersLedger, setGwWinnersLedger] = useState<Array<{ gw: number; winnerName: string; winnerTeam?: string | null; amount?: number | null; isVoided?: boolean }>>([]);
    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

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
    } | null>(null);
    const ledgerRailRef = useRef<HTMLDivElement | null>(null);

    const members = useStore(state => state.members);
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    useEffect(() => {
        if (!activeLeagueId) {
            setIsLoading(false);
            return;
        }
        if (members.length === 0) listenToLeagueMembers(activeLeagueId);

        const fetchFPLStandings = async () => {
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
                        if (lData.forfeitedGws) setForfeitedGws(lData.forfeitedGws);
                        if (lData.startGw) setLeagueStartGw(Number(lData.startGw));
                        if (lData.fplLeagueId) {
                            setDbFplLeagueId(Number(lData.fplLeagueId));
                            targetFplId = Number(lData.fplLeagueId);
                        }
                    }
                } catch (leagueErr: any) {
                    console.warn('[standings] league metadata read skipped:', leagueErr?.message || leagueErr);
                }

                if (!targetFplId) {
                    // No FPL league linked yet - do NOT fallback to global FPL league 314
                    setStandingsData([]);
                    setPerformanceData([]);
                    setIsLoading(false);
                    setError(null);
                    return;
                }

                const results = await fetchFplStandings(targetFplId);
                setStandingsData(results);
                setError(null);

                // Fetch trajectory for Top 5 members + current user
                const fetchPerformances = async () => {
                    let aggData: any[] = [];
                    const top5 = results.slice(0, 5);
                    const teamIds = top5.map((r: any) => r.entry);
                    
                    const activeUserId = localStorage.getItem('activeUserId') || '';
                    const myMember = members.find(m => m.id === activeUserId);
                    const myFplTeamId = myMember ? Number((myMember as any).fplTeamId || 0) : null;
                    if (myFplTeamId && !teamIds.includes(myFplTeamId)) {
                        teamIds.push(myFplTeamId);
                    }

                    if (teamIds.length === 0) return;

                    const leagueAvg = results.length > 0
                        ? Math.round(results.reduce((s: number, curRes: any) => s + curRes.event_total, 0) / results.length)
                        : 50;

                    for (const tId of teamIds) {
                        try {
                            const r = await fetch(`/fpl-api/entry/${tId}/history/`);
                            if (!r.ok) throw new Error(`Fetch failed with status ${r.status}`);
                            const histData = await r.json();
                            const current = histData?.current;
                            if (current && current.length > 0) {
                                const recent = current.slice(-5);
                                const playerEntry = results.find((r:any) => r.entry === tId);
                                const playerName = playerEntry ? playerEntry.player_name.split(' ')[0] : `Team ${tId}`;

                                aggData = recent.map((gw: any, index: number) => {
                                    const existing = aggData[index] || { name: `GW${gw.event}`, Average: leagueAvg };
                                    return {
                                        ...existing,
                                        [playerName]: gw.points
                                    };
                                });
                            }
                        } catch (e) {
                            console.warn('Error fetching performance:', e);
                        }
                    }
                    if (aggData.length > 0) setPerformanceData(aggData);
                };
                fetchPerformances();

                try {
                    const txSnap = await getDocs(collection(db, 'leagues', activeLeagueId, 'transactions'));
                    const payoutRows = txSnap.docs
                        .map((txDoc) => txDoc.data() as any)
                        .filter((tx) => tx.type === 'payout' && Number.isFinite(Number(tx.gameweek || tx.gw)));

                    let pendingForfeited = new Set<number>();
                    const pendingPayoutsMap = new Map<number, any>();
                    try {
                        const pendingSnap = await getDocs(collection(db, 'leagues', activeLeagueId, 'pending_payouts'));
                        pendingSnap.docs.forEach((docSnap) => {
                            const p = docSnap.data() as any;
                            const gwNum = Number(p.gw || p.gameweek);
                            if (Number.isFinite(gwNum)) {
                                if (p.status === 'forfeited') {
                                    pendingForfeited.add(gwNum);
                                } else {
                                    pendingPayoutsMap.set(gwNum, p);
                                }
                            }
                        });
                    } catch (_pErr) {
                        // ignore if collection empty
                    }

                    const winnerByGw = new Map<number, { gw: number; winnerName: string; winnerTeam?: string | null; amount?: number | null; isVoided?: boolean; isAwaitingPayment?: boolean }>();
                    payoutRows.forEach((tx) => {
                        const gw = Number(tx.gameweek || tx.gw);
                        if (!Number.isFinite(gw) || gw <= 0 || gw > 38 || winnerByGw.has(gw)) return;
                        winnerByGw.set(gw, {
                            gw,
                            winnerName: tx.winnerName || 'Unknown winner',
                            winnerTeam: tx.winnerTeam || tx.entryName || null,
                            amount: Number(tx.amount || 0),
                        });
                    });

                    const weeklyPercent = Number((leagueRules as any)?.weekly || 70) / 100;
                    const stakeVal = Number((leagueRules as any)?.gameweekStake || 250);

                    // Active non-eliminated funded Chama members from results
                    const norm = (s: string) => String(s || '').toLowerCase().trim();
                    const activeChamaResults = results.filter((r: any) => {
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
                        const isFunded = dbMember.hasPaid === true || (stakeVal > 0 && (Number(dbMember.walletBalance || 0)) >= stakeVal);
                        return isFunded;
                    });
                    const sortedActiveResults = [...activeChamaResults].sort((a: any, b: any) => Number(b.event_total || 0) - Number(a.event_total || 0));
                    const topGwMember = sortedActiveResults[0];

                    const activeCount = members.filter(m => m.isActive !== false && !(m as any)?.isEliminated && (m as any)?.playMode !== 'sidebets_only' && (m.hasPaid || (stakeVal > 0 && (Number(m.walletBalance || 0)) >= stakeVal))).length || 1;
                    const estimatedPot = Math.round(activeCount * stakeVal * weeklyPercent);

                    const effectiveForfeited = new Set<number>([
                        ...(forfeitedGws || []),
                        ...(leagueRules?.forfeitedGws || []),
                        ...Array.from(pendingForfeited),
                    ]);

                    const effectiveStartGw = Math.max(1, Number(leagueStartGw > 1 ? leagueStartGw : ((leagueRules as any)?.startGw || currentEvent || 1)));

                    const ledger = Array.from({ length: 38 }, (_, index) => {
                        const gw = index + 1;
                        // 1. Approved winner in recorded transactions
                        if (winnerByGw.has(gw)) {
                            return winnerByGw.get(gw)!;
                        }

                        // 2. Pre-league gameweeks (prior to league officially starting) -> strictly voided
                        if (effectiveStartGw > 1 && gw < effectiveStartGw) {
                            return {
                                gw,
                                winnerName: 'Voided',
                                winnerTeam: 'Pre-League',
                                isVoided: true,
                                isPreLeague: true,
                            };
                        }

                        // 3. Explicitly forfeited gameweeks
                        if (effectiveForfeited.has(gw)) {
                            return {
                                gw,
                                winnerName: 'Voided',
                                winnerTeam: 'Round Unplayed',
                                isVoided: true,
                            };
                        }

                        // 4. Pending payouts awaiting co-chair or chairman approval
                        if (pendingPayoutsMap.has(gw)) {
                            const p = pendingPayoutsMap.get(gw);
                            return {
                                gw,
                                winnerName: p.winnerName || p.playerName || 'Winner identified',
                                winnerTeam: p.winnerTeam || p.entryName || 'Awaiting Payment',
                                amount: Number(p.amount || estimatedPot),
                                isAwaitingPayment: true,
                            };
                        }

                        // 5. Current active live gameweek
                        if (currentEvent && gw === currentEvent) {
                            if (topGwMember && Number(topGwMember.event_total) > 0) {
                                return {
                                    gw,
                                    winnerName: topGwMember.player_name,
                                    winnerTeam: topGwMember.entry_name || 'Live Leader',
                                    amount: estimatedPot,
                                    isCurrentLive: true,
                                };
                            }
                            return {
                                gw,
                                winnerName: 'In Progress',
                                winnerTeam: 'Live Gameweek',
                                isCurrentLive: true,
                            };
                        }

                        // 6. Past gameweeks that already concluded but were never resolved or had insufficient players -> Skipped
                        if (currentEvent && gw < currentEvent) {
                            return {
                                gw,
                                winnerName: 'Skipped',
                                winnerTeam: 'Not resolved / Insufficient players',
                                isVoided: true,
                                isSkipped: true,
                            };
                        }

                        // 7. Future gameweeks
                        return {
                            gw,
                            winnerName: 'Upcoming',
                            winnerTeam: 'Pending kickoff',
                            isUpcoming: true,
                        };
                    });
                    setGwWinnersLedger(ledger);
                } catch (txErr: any) {
                    console.warn('[standings] ledger read skipped:', txErr?.message || txErr);
                    const blankLedger = Array.from({ length: 38 }, (_, index) => ({ gw: index + 1, winnerName: 'Pending' }));
                    setGwWinnersLedger(blankLedger);
                }
            } catch (err: any) {
                console.error('FPL Fetch Error:', err);
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
                const current = (data?.events || []).find((event: any) => event.is_current);
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
        // Only scroll the horizontal rail — NOT the page/window — to avoid page jumping
        if (!currentEvent || !ledgerRailRef.current) return;
        const rail = ledgerRailRef.current;
        const gwCard = rail.querySelector<HTMLElement>(`[data-gw-card="${currentEvent}"]`);
        if (!gwCard) return;
        // Container-only horizontal scroll (does NOT touch vertical scroll)
        const targetLeft = gwCard.offsetLeft - rail.clientWidth / 2 + gwCard.clientWidth / 2;
        rail.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }, [currentEvent, gwWinnersLedger.length]);

    const getMemberStatus = (playerName: string, entryName: string, entryId: number) => {
        const norm = (s: string) => s.toLowerCase().trim();
        return members.find(m => {
            if (m.fplTeamId && Number(m.fplTeamId) === Number(entryId)) return true;
            const db = norm(m.displayName);
            return norm(playerName).includes(db) || db.includes(norm(playerName)) || norm(entryName).includes(db);
        });
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
        if (!matched) return false;
        if (matched.isActive === false) return false;
        if ((matched as any).isEliminated === true) return false;
        if ((matched as any).playMode === 'sidebets_only') return false;
        const stake = Number((league as any)?.gameweekStake || (league as any)?.monthlyFee || 0);
        return matched.hasPaid === true || (stake > 0 && (matched.walletBalance || 0) >= stake);
    };

    // Filter strictly to funded active members who paid for this round (resolves 54 vs 60 issue)
    const eligibleGwStandings = standingsData.filter(isMemberEligibleWinner);
    const maxEligibleGwScore = eligibleGwStandings.reduce((max, r) => Math.max(max, Number(r.event_total || 0)), 0);
    const gwWinner = eligibleGwStandings.length > 0
        ? [...eligibleGwStandings].sort((a, b) => Number(b.event_total || 0) - Number(a.event_total || 0))[0]
        : null;

    const hasFinalGwChampion = Boolean(
        gwWinner
        && isCurrentEventFinished
        && Number(gwWinner.event_total) > 0
        && (!currentEvent || Number(gwWinner.event) === Number(currentEvent))
    );

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


    // End-season snapshot: ONLY funded active members can be on the winners list
    const eligibleSeasonStandings = standingsData.filter(isMemberEligibleWinner);
    const seasonPool = eligibleSeasonStandings.length > 0
        ? eligibleSeasonStandings
        : standingsData.filter((r: any) => {
            const m = getMemberStatus(r.player_name, r.entry_name, r.entry);
            return !m || m.isActive !== false;
        });

    // Competition tie-ranking (e.g. 1, 1, 3)
    const sortedSeasonPool = [...seasonPool].sort((a: any, b: any) => Number(b.total || 0) - Number(a.total || 0));
    const rankedSeasonPool: any[] = [];
    for (let i = 0; i < sortedSeasonPool.length; i++) {
        const current = sortedSeasonPool[i];
        let rank = i + 1;
        let isTied = false;
        if (i > 0 && Number(current.total || 0) === Number(sortedSeasonPool[i - 1].total || 0)) {
            rank = rankedSeasonPool[i - 1].calculatedRank;
            isTied = true;
            rankedSeasonPool[i - 1].isTied = true;
        } else if (i < sortedSeasonPool.length - 1 && Number(current.total || 0) === Number(sortedSeasonPool[i + 1].total || 0)) {
            isTied = true;
        }
        rankedSeasonPool.push({
            ...current,
            calculatedRank: rank,
            isTied
        });
    }
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
            <div className="fc-standings-page min-h-screen w-full font-sans text-white relative overflow-hidden bg-transparent">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6">
                    <Header role={role || 'member'} title={resolvedTitle} subtitle="Gameweek Rankings" />
                    <StandingsSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div
            className="fc-standings-page min-h-screen w-full font-sans text-white relative overflow-hidden bg-transparent"
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

                    <div className="flex gap-3 flex-wrap items-center">
                        <div className="relative group">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-[#10B981] transition-colors">
                                <Search className="w-4 h-4" />
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-64 font-sans font-medium bg-[#161d24] border border-white/10 rounded-xl py-2 pl-11 pr-4 text-sm focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all placeholder:text-gray-500 text-white outline-none shadow-lg"
                                placeholder="Search members or teams..."
                            />
                        </div>
                        <button onClick={exportStandingsCSV} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-xl transition whitespace-nowrap active:scale-95">
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {/* Quick Fix Inline FPL ID Linker */}
                {role === 'admin' && (!dbFplLeagueId || error) && (
                    <div className="fc-card bg-[#10B981]/10 border border-[#10B981]/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-[#10B981] flex items-center gap-2 mb-1">
                                <Zap className="w-5 h-5" /> {error ? 'Update FPL League Link' : 'Link Official FPL League'}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">Paste your full FPL Standings URL (e.g. fantasy.premierleague.com/leagues/123456/standings).</p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="Paste Standings URL..."
                                value={inputFplLeagueId}
                                onChange={(e) => {
                                    let val = e.target.value.trim();
                                    const match = val.match(/leagues\/(\d+)\/standings/);
                                    if (match && match[1]) val = match[1];
                                    setInputFplLeagueId(val.replace(/\D/g, ''));
                                }}
                                className="w-full sm:w-64 bg-[#161d24] border border-[#10B981]/30 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#10B981]"
                            />
                            <button
                                onClick={handleSaveFplId}
                                disabled={isSavingFplId || !inputFplLeagueId}
                                className="bg-[#10B981] text-black px-4 py-2 rounded-xl font-bold flex flex-shrink-0 items-center gap-2 hover:bg-[#10B981]/90 disabled:opacity-50 transition-colors text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            >
                                <Save className="w-4 h-4" /> Save Link
                            </button>
                        </div>
                    </div>
                )}
                {/* Stats swapper + user hero */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Honest Funded Pot Members Card — clickable to /finances */}
                    <div
                        onClick={() => navigate('/finances')}
                        className="fc-card bg-[#161d24] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-5 flex items-center justify-between min-h-[88px] cursor-pointer transition-all hover:scale-[1.01] group"
                        title="Click to view Red Zone and manage manager payments"
                    >
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Funded Pot Members</p>
                                <span className="text-[9px] font-black text-emerald-400 group-hover:underline flex items-center gap-0.5 mb-1">
                                    Manage & Nudge →
                                </span>
                            </div>
                            <p className="text-2xl font-black text-white">
                                {eligibleGwStandings.length} <span className="text-sm font-bold text-gray-400">/ {standingsData.length || members.length} Paid</span>
                            </p>
                            {(() => {
                                const spectatorCount = members.filter(m => m.isActive !== false && m.playMode === 'sidebets_only').length;
                                const unpaidCount = Math.max(0, (standingsData.length || members.length) - eligibleGwStandings.length - spectatorCount);
                                return (
                                    <p className="text-[10px] font-semibold mt-0.5">
                                        {unpaidCount > 0 ? (
                                            <span className="text-rose-500 font-bold">{unpaidCount} in Red Zone (unpaid)</span>
                                        ) : (
                                            <span className="text-emerald-400 font-bold">All pot members funded ✓</span>
                                        )}
                                        {spectatorCount > 0 ? <span className="text-gray-400 font-normal"> · {spectatorCount} Spectators (1v1 Bets)</span> : null}
                                    </p>
                                );
                            })()}
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40 flex items-center justify-center transition-colors">
                            <Users className="w-5 h-5 text-emerald-400" />
                        </div>
                    </div>

                    {/* User hero card */}
                    {myStanding && (
                        <div className="fc-card bg-gradient-to-r from-[#FBBF24]/10 via-[#161d24] to-[#161d24] border border-[#FBBF24]/20 rounded-2xl p-5 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-[#FBBF24]/70 uppercase tracking-widest mb-1">Your GW Rank</p>
                                <p className="text-2xl font-black text-white">#{myStandingIdx + 1} <span className="text-sm font-bold text-[#FBBF24]">{myStanding.event_total} pts</span></p>
                                <p className="text-[10px] text-gray-500 mt-0.5">Season total: {myStanding.total?.toLocaleString()} pts{standingsData[0] && myStandingIdx > 0 ? ` · ${(standingsData[0].total - myStanding.total).toLocaleString()} behind #1` : ''}</p>
                            </div>
                            <Trophy className="w-8 h-8 text-[#FBBF24]/40" />
                        </div>
                    )}
                </div>

                {/* Standings — responsive card list */}
                {!dbFplLeagueId ? (
                    <div className="fc-card w-full bg-[#161d24] border border-amber-500/20 p-8 md:p-12 rounded-[2rem] text-center relative overflow-hidden mt-6 shadow-2xl">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
                            <Trophy className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-black text-white mb-2">No FPL League Linked Yet</h3>
                        <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed mb-6">
                            Connect your Fantasy Premier League mini-league ID so FantasyChama can pull live weekly scores, rank managers, and calculate the pot winners.
                        </p>
                        {role === 'admin' ? (
                            <div className="max-w-md mx-auto space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Paste FPL Standings URL or ID..."
                                        value={inputFplLeagueId}
                                        onChange={(e) => {
                                            let val = e.target.value.trim();
                                            const match = val.match(/leagues\/(\d+)\/standings/);
                                            if (match && match[1]) val = match[1];
                                            setInputFplLeagueId(val.replace(/\D/g, ''));
                                        }}
                                        className="flex-1 bg-[#0b1014] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400"
                                    />
                                    <button
                                        onClick={handleSaveFplId}
                                        disabled={isSavingFplId || !inputFplLeagueId}
                                        className="bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black px-5 py-2.5 rounded-xl text-sm transition-all"
                                    >
                                        {isSavingFplId ? 'Saving...' : 'Link League'}
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-500">
                                    Find your ID in the URL on fantasy.premierleague.com (e.g. /leagues/<strong>123456</strong>/standings)
                                </p>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                                ⏳ Waiting for Chairman to link the FPL League Code
                            </div>
                        )}
                    </div>
                ) : error ? (
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
                ) : (
                    <div className="fc-card w-full bg-[#161d24] border border-white/5 rounded-2xl overflow-hidden">
                        {/* Desktop table header — hidden on mobile */}
                        <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-[#10B981] uppercase tracking-widest">
                            <div className="col-span-1">Rank</div>
                            <div className="col-span-4">Member</div>
                            <div className="col-span-3">FPL Team</div>
                            <div className="col-span-1 text-center">GW</div>
                            <div className="col-span-1 text-center">Total</div>
                            <div className="col-span-2 text-right">Status</div>
                        </div>
                        {/* Rows */}
                        <div className="divide-y divide-white/[0.04]">
                            {standingsData
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
                                .map((row: any, index: number) => {
                                const isTop1Overall = index === 0;
                                const isInPodium = index < visibleSeasonWinnerCount;
                                const matchedMember = getMemberStatus(row.player_name, row.entry_name, row.entry);
                                const isSpectator = (matchedMember as any)?.playMode === 'sidebets_only';
                                const stake = Number((league as any)?.gameweekStake || (league as any)?.monthlyFee || 0);
                                const isFunded = Boolean(
                                    matchedMember &&
                                    matchedMember.isActive !== false &&
                                    !isSpectator &&
                                    (matchedMember.hasPaid === true || (stake > 0 && (matchedMember.walletBalance || 0) >= stake))
                                );
                                const isGwWinnerRow = Boolean(
                                    isFunded &&
                                    maxEligibleGwScore > 0 &&
                                    Number(row.event_total) === maxEligibleGwScore
                                );
                                const isMe = myStanding && row.id === myStanding.id;
                                const rankNum = Number(row.rank || index + 1);
                                const medal = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : null;
                                const podiumBorder = rankNum === 1 ? 'border-l-4 border-l-amber-400' : rankNum === 2 ? 'border-l-4 border-l-slate-300' : rankNum === 3 ? 'border-l-4 border-l-amber-700' : 'border-l-4 border-l-transparent';
                                return (
                                    <div
                                        key={row.id}
                                        data-testid={`standings-row-${row.id || index}`}
                                        style={{ animationDelay: `${Math.min(index * 45, 600)}ms` }}
                                        className={clsx(
                                            'px-4 py-3 md:grid md:grid-cols-12 md:gap-3 md:items-center md:px-5 md:py-4 flex flex-col transition-all animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards',
                                            podiumBorder,
                                            isTop1Overall ? 'bg-[#10B981]/5' : isInPodium && index > 0 ? 'bg-emerald-500/[0.02]' : 'hover:bg-white/[0.02]',
                                            isGwWinnerRow && !isTop1Overall ? 'bg-[#10B981]/10 ring-1 ring-[#10B981]/30' : '',
                                            isMe ? 'ring-1 ring-[#FBBF24]/40' : '',
                                            !isFunded && !isSpectator && 'opacity-40 blur-[0.4px] hover:blur-none hover:opacity-85 transition-all saturate-50'
                                        )}
                                    >
                                        {/* Rank + Avatar + Name (Row 1 on Mobile, Col 1-5 on Desktop) */}
                                        <div className="flex items-center gap-3 md:col-span-5 w-full">
                                            <span className={clsx('font-extrabold text-lg md:text-base tabular-nums w-6 text-center shrink-0', isTop1Overall ? 'text-[#10B981]' : 'text-gray-500')}>
                                                {medal || rankNum}
                                            </span>
                                            <UserAvatar name={row.player_name} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
                                                    <span className="truncate max-w-[160px] md:max-w-none">{row.player_name}</span>
                                                    {matchedMember?.id === chairmanId && (
                                                        <span className="bg-[#FBBF24]/10 text-[#FBBF24] text-[8px] px-1 py-0.5 rounded uppercase tracking-widest font-black border border-[#FBBF24]/30">Chair</span>
                                                    )}
                                                    {matchedMember?.id === coAdminId && matchedMember.id !== chairmanId && matchedMember.isActive !== false && (matchedMember.role === 'co-chair' || matchedMember.role === 'admin') && (
                                                        <span className="bg-[#3B82F6]/10 text-[#3B82F6] text-[8px] px-1 py-0.5 rounded uppercase tracking-widest font-black border border-[#3B82F6]/30">Co</span>
                                                    )}
                                                    {isSpectator ? (
                                                        <span className="bg-indigo-500/15 text-indigo-300 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-indigo-500/30">Spectator</span>
                                                    ) : !isFunded ? (
                                                        <span className="bg-red-500/15 text-red-400 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border border-red-500/25">Unfunded</span>
                                                    ) : (
                                                        <Circle className="w-2 h-2 fill-current text-[#10B981]" />
                                                    )}
                                                </span>
                                                <p className="text-[11px] text-gray-500 truncate md:hidden">{row.entry_name}</p>
                                            </div>
                                        </div>

                                        {/* FPL Team — desktop only */}
                                        <div className="hidden md:block md:col-span-3 text-gray-400 text-sm italic truncate pr-2">{row.entry_name}</div>

                                        {/* Stats Row (Row 2 on Mobile, Col 9-12 on Desktop) */}
                                        <div className="flex items-center justify-between md:contents mt-3 md:mt-0 pt-3 md:pt-0 border-t border-white/5 md:border-0 w-full">
                                            <div className="flex flex-col md:block items-center md:col-span-1 md:text-center">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 md:hidden mb-1.5">GW Pts</span>
                                                <span className={clsx(
                                                    'px-2.5 py-1 font-bold rounded-lg text-xs tabular-nums border md:inline-block transition-all',
                                                    isGwWinnerRow
                                                        ? 'bg-[#10B981] text-black font-black border-transparent shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                                                        : (isFunded || isSpectator)
                                                            ? 'bg-white/5 text-slate-200 border-white/5'
                                                            : 'bg-white/5 text-gray-500 border-white/5 line-through'
                                                )}>
                                                    {row.event_total}
                                                </span>
                                            </div>
                                            <div className="flex flex-col md:block items-center md:col-span-1 md:text-center">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 md:hidden mb-1.5">Total</span>
                                                <div className="font-extrabold text-white text-sm tabular-nums">{row.total.toLocaleString()}</div>
                                            </div>
                                            <div className="md:col-span-2 flex justify-end md:justify-end items-center w-28 md:w-auto">
                                                {isSpectator ? (
                                                    <span className="font-black text-[9px] md:text-[10px] tracking-tight border px-2 py-0.5 rounded-lg text-indigo-300 border-indigo-500/30 bg-indigo-500/15 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Spectator
                                                    </span>
                                                ) : !isFunded ? (
                                                    <span className="font-black text-[9px] md:text-[10px] tracking-tight border px-2 py-0.5 rounded-lg text-red-400 border-red-500/25 bg-red-500/10 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Eliminated
                                                    </span>
                                                ) : isGwWinnerRow && (role === 'admin' || isMe) ? (
                                                    <button
                                                        onClick={() => setFlexCardData({
                                                            winnerName: row.player_name,
                                                            teamName: row.entry_name,
                                                            points: Number(row.event_total || 0),
                                                            amountWon: Math.round((eligibleSeasonStandings.length * (stake || 100)) * (Number((league as any)?.rules?.weekly || 70) / 100)),
                                                            gameweek: currentEvent || '',
                                                        })}
                                                        className="font-black text-[10px] md:text-xs tracking-tight border px-2.5 py-1 rounded-lg text-[#10B981] border-[#10B981]/40 bg-[#10B981]/15 hover:bg-[#10B981]/25 flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.2)] transition-all active:scale-95 cursor-pointer"
                                                        title={hasFinalGwChampion ? "Share GW Champion Victory Card on WhatsApp" : "Share Live Leader Victory Card on WhatsApp"}
                                                    >
                                                        <Star className="w-3 h-3 fill-[#10B981] text-[#10B981]" /> Victory Card
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
                                    <BarChart3 className="w-4 h-4 text-emerald-500" /> Performance Trajectory (Top 5 + You)
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium mt-0.5">
                                    Recent Gameweek points progression comparing leaders against your score and the league average
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-400/10 border border-amber-300 dark:border-amber-400/25 text-amber-800 dark:text-[#FBBF24] text-xs font-bold shadow-xs">
                                    <span className="w-2.5 h-0.5 bg-amber-500 dark:bg-[#FBBF24] inline-block" />
                                    <span>GW Average: <strong className="tabular-nums font-black">{currentGwAverage}</strong> pts</span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive & Clear Legend Chips for PC & Mobile */}
                        {(() => {
                            const colors = ['#10B981', '#3B82F6', '#F43F5E', '#A855F7', '#F97316', '#06B6D4'];
                            const playerKeys = Object.keys(performanceData[0] || {}).filter(k => k !== 'name' && k !== 'Average');
                            const myMember = members.find(m => m.id === (localStorage.getItem('activeUserId') || ''));
                            const myFirstName = myMember?.displayName ? myMember.displayName.split(' ')[0] : '';

                            return (
                                <div className="flex items-center gap-2 flex-wrap mb-4 pt-1">
                                    {playerKeys.map((playerKey, idx) => {
                                        const isYou = myFirstName && (playerKey.toLowerCase() === myFirstName.toLowerCase() || playerKey.toLowerCase().includes(myFirstName.toLowerCase()));
                                        const lastScore = performanceData[performanceData.length - 1]?.[playerKey];
                                        const color = colors[idx % colors.length];
                                        return (
                                            <div
                                                key={playerKey}
                                                className={clsx(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all shadow-xs",
                                                    isYou
                                                        ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300 ring-1 ring-emerald-500/30"
                                                        : "bg-slate-100/90 dark:bg-white/[0.05] border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300"
                                                )}
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                                                <span>{playerKey} {isYou && <strong className="text-emerald-600 dark:text-emerald-400 font-black">(You)</strong>}</span>
                                                {lastScore !== undefined && (
                                                    <span className="text-[10px] font-black text-slate-500 dark:text-gray-400 tabular-nums ml-0.5">
                                                        {lastScore} pts
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300">
                                        <span className="w-3 h-0.5 bg-amber-500 inline-block border-t border-dashed" />
                                        <span>League Avg: <strong className="tabular-nums">{currentGwAverage}</strong> pts</span>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="h-64 sm:h-72 w-full" style={{ position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={performanceData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={30} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f1720', borderColor: 'rgba(255,255,255,0.12)', borderRadius: '14px', fontSize: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                        itemStyle={{ fontWeight: 'bold' }}
                                    />
                                    {Object.keys(performanceData[0] || {}).filter(k => k !== 'name' && k !== 'Average').map((playerKey, idx) => {
                                        const colors = ['#10B981', '#3B82F6', '#F43F5E', '#A855F7', '#F97316', '#06B6D4'];
                                        return (
                                            <Line
                                                key={playerKey}
                                                type="monotone"
                                                dataKey={playerKey}
                                                stroke={colors[idx % colors.length]}
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: colors[idx % colors.length], strokeWidth: 0 }}
                                                activeDot={{ r: 6 }}
                                            />
                                        );
                                    })}
                                    <Line type="monotone" dataKey="Average" stroke="#FBBF24" strokeWidth={2.5} strokeDasharray="5 5" dot={false} name="League Avg" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {!error && topSeasonLeaders.length > 0 && (Number(leagueRules.vault ?? 30) > 0) && (
                    <div className="fc-card bg-[#161d24] border border-white/5 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm md:text-base font-black text-white tracking-tight">Season Race Snapshot</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">
                                    {seasonSnapshotLabel} • end-season vault leaders only
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
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
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar justify-start sm:justify-center">
                            {topSeasonLeaders.map((leader: any, idx: number) => {
                                const leaderRank = Number(leader.calculatedRank || idx + 1);
                                const leaderMedal = leaderRank === 1 ? '🥇' : leaderRank === 2 ? '🥈' : leaderRank === 3 ? '🥉' : null;
                                const isLeaderTied = Boolean(leader.isTied);
                                return (
                                    <div key={leader.id || idx} className="min-w-[170px] flex-1 max-w-[240px] rounded-2xl border border-white/10 bg-[#0b1014]/90 p-4 flex flex-col justify-between shadow-lg hover:border-amber-500/30 transition-all">
                                        <div>
                                            <div className="flex items-center justify-between gap-1 mb-2">
                                                <span className="text-[10px] uppercase tracking-widest font-black text-amber-400 flex items-center gap-1">
                                                    {leaderMedal ? `${leaderMedal} #${leaderRank}` : `#${leaderRank}`}
                                                    {isLeaderTied && (
                                                        <span className="text-[8px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/35 rounded px-1 py-0.2">
                                                            Tied
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    Funded
                                                </span>
                                            </div>
                                            <p className="text-xs font-black text-white truncate">{leader.player_name}</p>
                                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{leader.entry_name}</p>
                                        </div>
                                        <div className="mt-3 pt-2.5 border-t border-white/5">
                                            <p className="text-base font-black text-emerald-400 tabular-nums">{Number(leader.total || 0).toLocaleString()} pts</p>
                                            <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                                {Number(leader.total || 0) === Number(topSeasonLeaders[0]?.total || 0)
                                                    ? (isLeaderTied ? 'Tied for Vault Lead' : 'Vault leader')
                                                    : `${Math.max(0, Number(topSeasonLeaders[0]?.total || 0) - Number(leader.total || 0)).toLocaleString()} pts behind`}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {!error && gwWinnersLedger.length > 0 && (
                    <div className="fc-card bg-[#161d24] border border-white/5 rounded-2xl p-5 md:p-6">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="text-sm md:text-base font-black text-white tracking-tight">Gameweek Winners Ledger</h3>
                            <div className="flex items-center gap-2">
                                {currentEvent && (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-[#FBBF24]/25 bg-[#FBBF24]/10 text-[#FBBF24]">
                                        Now: GW {currentEvent}
                                    </span>
                                )}
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">Scroll for GW 1-38</span>
                            </div>
                        </div>
                        <div ref={ledgerRailRef} className="fc-gw-ledger-rail flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
                            {gwWinnersLedger.map((item: any) => {
                                const isVoided = Boolean(item.isVoided);
                                const isPreLeague = Boolean(item.isPreLeague);
                                const isSkipped = Boolean(item.isSkipped);
                                const isAwaitingPayment = Boolean(item.isAwaitingPayment);
                                const isCurrentGw = currentEvent === item.gw;
                                const isCurrentLive = Boolean(item.isCurrentLive) || isCurrentGw;
                                const resolved = (item.winnerName !== 'Upcoming' && item.winnerName !== 'In Progress' && !isVoided) || isAwaitingPayment;
                                return (
                                    <div
                                        key={item.gw}
                                        data-gw-card={item.gw}
                                        className={clsx(
                                            'fc-gw-ledger-card snap-start shrink-0 w-56 sm:w-60 lg:w-52 rounded-xl border p-3.5 transition-all shadow-sm',
                                            resolved && !isAwaitingPayment
                                                ? 'fc-gw-ledger-card-resolved border-emerald-500/30 bg-emerald-500/10'
                                                : isAwaitingPayment
                                                ? 'border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-500/30'
                                                : isPreLeague
                                                ? 'border-slate-300 dark:border-slate-500/25 bg-slate-100/90 dark:bg-slate-500/8 text-slate-700 dark:text-slate-300'
                                                : isVoided || isSkipped
                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                                : isCurrentGw
                                                ? 'border-[#FBBF24]/50 bg-[#FBBF24]/10'
                                                : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/25',
                                            isCurrentGw && 'ring-2 ring-[#FBBF24]/55'
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className="text-[9px] uppercase tracking-widest font-black text-slate-500 dark:text-gray-400">GW {item.gw}</p>
                                            {isPreLeague ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-500/30">
                                                    Voided
                                                </span>
                                            ) : isVoided || isSkipped ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                                    Skipped
                                                </span>
                                            ) : isAwaitingPayment ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40">
                                                    Awaiting Payout
                                                </span>
                                            ) : resolved ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                    Paid ✓
                                                </span>
                                            ) : isCurrentLive ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#FBBF24]/20 text-amber-700 dark:text-[#FBBF24] border border-[#FBBF24]/40">
                                                    {isCurrentEventFinished ? 'Final' : 'Live'}
                                                </span>
                                            ) : (
                                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-500 border border-slate-200 dark:border-white/10">
                                                    Upcoming
                                                </span>
                                            )}
                                        </div>
                                        <p className={clsx(
                                            'text-xs font-black truncate',
                                            resolved ? 'text-slate-900 dark:text-white' : isPreLeague ? 'text-slate-600 dark:text-slate-400' : isVoided || isSkipped ? 'text-amber-600 dark:text-amber-300' : isCurrentGw ? 'text-amber-600 dark:text-[#FBBF24]' : 'text-slate-400 dark:text-gray-500'
                                        )}>
                                            {item.winnerName}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate mt-1">
                                            {isPreLeague
                                                ? 'Pre-League · No fees'
                                                : isVoided || isSkipped
                                                ? (item.winnerTeam || 'Not resolved / Unplayed')
                                                : isAwaitingPayment
                                                ? `${item.winnerTeam || 'Awaiting Payment'}`
                                                : item.winnerTeam || (resolved ? 'Winner recorded' : isCurrentGw ? (isCurrentEventFinished ? 'Gameweek Concluded' : 'Active Gameweek') : 'Pending kickoff')}
                                        </p>
                                        {resolved && typeof item.amount === 'number' && item.amount > 0 && (
                                            <p className="text-[10px] font-black text-[#FBBF24] mt-1">KES {item.amount.toLocaleString()}</p>
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
                    />
                )}
            </div>
        </div>
    );
}
