import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Download, Trophy, Star, Zap, Save, ShieldAlert, BarChart3, Users, RefreshCw, Shirt } from 'lucide-react';
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
    const [coAdminId, setCoAdminId] = useState<string | null>(null);
    const [dbFplLeagueId, setDbFplLeagueId] = useState<number | null>(null);
    const [inputFplLeagueId, setInputFplLeagueId] = useState('');
    const [isSavingFplId, setIsSavingFplId] = useState(false);
    const [currentEvent, setCurrentEvent] = useState<number | null>(null);
    const [isCurrentEventFinished, setIsCurrentEventFinished] = useState(false);
    const [leagueRules, setLeagueRules] = useState<any>({});
    const [forfeitedGws, setForfeitedGws] = useState<number[]>([]);
    const [leagueStartGw, setLeagueStartGw] = useState<number>(1);
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
            const gw = Number(tx.gameweek || tx.gw);
            if (!Number.isFinite(gw) || gw <= 0 || gw > 38 || winnerByGw.has(gw)) return;
            winnerByGw.set(gw, {
                gw,
                winnerName: tx.winnerName || 'Unknown winner',
                winnerTeam: tx.winnerTeam || tx.entryName || null,
                amount: Number(tx.amount || 0),
                isPaid: true,
            });
        });

        const pendingForfeited = new Set<number>();
        const pendingPayoutsMap = new Map<number, any>();
        pendingPayouts.forEach((p) => {
            const gwNum = Number(p.gw || p.gameweek);
            if (Number.isFinite(gwNum)) {
                if (p.status === 'forfeited') {
                    pendingForfeited.add(gwNum);
                } else {
                    pendingPayoutsMap.set(gwNum, p);
                }
            }
        });

        const weeklyPercent = Number((leagueRules as any)?.weekly || 70) / 100;
        const stakeVal = Number((leagueRules as any)?.gameweekStake || 250);

        // Active non-eliminated funded Chama members from results
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

            // 3. Pending payouts awaiting co-chair or chairman approval (only for ended rounds)
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

            // 4. Pre-league gameweeks based on configured start GW (league commenced later)
            if (leagueStartGw > 1 && gw < leagueStartGw) {
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
                        winnerName: `${topGwMember.player_name}`,
                        winnerTeam: `${topGwMember.entry_name || 'Team'} · Live Leader`,
                        amount: estimatedPot,
                        isCurrentLive: true,
                        isPaid: false,
                    };
                }
                return {
                    gw,
                    winnerName: 'In Progress',
                    winnerTeam: 'Live Gameweek · Pending Whistle',
                    isCurrentLive: true,
                    isPaid: false,
                };
            }

            // 6. Current or past in-season gameweek finished without explicit recorded payout yet -> Awaiting payout or show winner
            if (currentEvent && (isCurrentEventFinished ? gw <= currentEvent : gw < currentEvent)) {
                if (gw >= leagueStartGw && topGwMember && Number(topGwMember.event_total) > 0) {
                    return {
                        gw,
                        winnerName: `${topGwMember.player_name}`,
                        winnerTeam: `${topGwMember.entry_name || 'Team'} · Pending Payout`,
                        amount: estimatedPot,
                        isAwaitingPayment: true,
                    };
                }
                return {
                    gw,
                    winnerName: gw < leagueStartGw ? 'Voided' : 'Unresolved',
                    winnerTeam: gw < leagueStartGw ? 'Pre-League · No fees' : 'Awaiting Resolution',
                    isVoided: gw < leagueStartGw,
                    isPreLeague: gw < leagueStartGw,
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
                    let aggData: any[] = [];
                    const candidateManagers = results.slice(0, 10);
                    const teamIds = candidateManagers.map((r: any) => r.entry);
                    
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
                            } catch {
                                // network failed, will attempt cache below
                            }

                            if (!histData) {
                                const cached = localStorage.getItem(cacheKey);
                                if (cached) {
                                    try { histData = JSON.parse(cached).data; } catch {}
                                }
                            }

                            const current = histData?.current;
                            if (current && current.length > 0) {
                                const recent = current.slice(-5);
                                const playerEntry = results.find((r:any) => r.entry === tId);
                                const playerName = playerEntry ? playerEntry.player_name.split(' ')[0] : `Team ${tId}`;

                                aggData = recent.map((gw: any, index: number) => {
                                    const existing = aggData[index] || { name: `GW${gw.event}` };
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

                    // Append current live event points if not already in completed history
                    const liveGwId = currentEvent;
                    if (liveGwId && !aggData.some(row => row.name === `GW${liveGwId}`)) {
                        const liveRow: any = { name: `GW${liveGwId}` };
                        for (const tId of teamIds) {
                            const playerEntry = results.find((r: any) => r.entry === tId);
                            const playerName = playerEntry ? playerEntry.player_name.split(' ')[0] : `Team ${tId}`;
                            liveRow[playerName] = Number(playerEntry?.event_total || 0);
                        }
                        aggData.push(liveRow);
                    }

                    // Ensure GW${leagueStartGw} is present if league commenced at a later round so ReferenceLine can render
                    if (leagueStartGw && leagueStartGw > 1 && !aggData.some(row => row.name === `GW${leagueStartGw}`)) {
                        const kickoffRow: any = { name: `GW${leagueStartGw}` };
                        for (const tId of teamIds) {
                            const playerEntry = results.find((r: any) => r.entry === tId);
                            const playerName = playerEntry ? playerEntry.player_name.split(' ')[0] : `Team ${tId}`;
                            kickoffRow[playerName] = Number(playerEntry?.event_total || 0);
                        }
                        aggData.push(kickoffRow);
                    }

                    // Sort aggData chronologically by GW number
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
                        .filter((tx) => tx.type === 'payout' && Number.isFinite(Number(tx.gameweek || tx.gw)));
                    setPayoutRows(payoutRowsData);

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
        // Only scroll the horizontal rail — NOT the page/window — to avoid page jumping
        if (!currentEvent || !ledgerRailRef.current) return;
        const targetGw = (isCurrentEventFinished && currentEvent) ? currentEvent + 1 : currentEvent;
        const rail = ledgerRailRef.current;
        const gwCard = rail.querySelector<HTMLElement>(`[data-gw-card="${targetGw}"]`);
        if (!gwCard) return;
        // Container-only horizontal scroll (does NOT touch vertical scroll)
        const targetLeft = gwCard.offsetLeft - rail.clientWidth / 2 + gwCard.clientWidth / 2;
        rail.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }, [currentEvent, isCurrentEventFinished, gwWinnersLedger.length]);

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
        if (!matched) return false;
        if (matched.isActive === false) return false;
        if ((matched as any).isEliminated === true) return false;
        if ((matched as any).playMode === 'sidebets_only') return false;
        const stake = Number(
            leagueRules?.gameweekStake ||
            (league as any)?.gameweekStake ||
            (league as any)?.rules?.gameweekStake ||
            (league as any)?.monthlyFee ||
            0
        );
        const bal = Number(matched.walletBalance || 0);
        return matched.hasPaid === true || bal > 0 || (stake > 0 && bal >= stake);
    };

    // Filter strictly to funded active members who paid for this round (resolves 54 vs 60 issue)
    const eligibleGwStandings = standingsData.filter(isMemberEligibleWinner);
    const maxEligibleGwScore = eligibleGwStandings.reduce((max, r) => Math.max(max, Number(r.event_total || 0)), 0);
    const tiedGwWinners = eligibleGwStandings.filter(r => Number(r.event_total || 0) === maxEligibleGwScore && maxEligibleGwScore > 0);
    const isGwTied = tiedGwWinners.length > 1;

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
        Boolean(m && (m.hasPaid === true || Number(m.walletBalance || 0) > 0 || Number((m as any).totalContributed || 0) > 0 || Number((m as any).totalDeposited || 0) > 0));

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
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-gray-500 group-focus-within:text-[#10B981] transition-colors">
                                <Search className="w-3.5 h-3.5" />
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-60 font-sans font-medium bg-slate-100 dark:bg-[#161d24] border border-slate-200 dark:border-white/10 rounded-xl py-1.5 pl-9 pr-3 text-[11px] sm:text-xs focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all placeholder:text-[11px] placeholder:text-slate-400 dark:placeholder:text-gray-500 text-slate-900 dark:text-white outline-none shadow-sm"
                                placeholder="Search members or teams..."
                            />
                        </div>
                        <button onClick={exportStandingsCSV} className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-wider rounded-xl transition whitespace-nowrap active:scale-95">
                            <Download className="w-3.5 h-3.5" /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {/* Quick Fix Inline FPL ID Linker */}
                {role === 'admin' && (!dbFplLeagueId || (error && !isFplMaintenance)) && (
                    <div className="fc-card bg-[#10B981]/10 border border-[#10B981]/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 w-full">
                        <div className="w-full md:flex-1 min-w-0">
                            <h3 className="font-bold text-[#10B981] flex items-center gap-2 mb-1 text-sm sm:text-base">
                                <Zap className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> {error ? 'Update FPL League Link' : 'Link Official FPL League'}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 break-words">Paste your full FPL Standings URL (e.g. fantasy.premierleague.com/leagues/123456/standings).</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
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
                                className="w-full sm:w-64 bg-[#161d24] border border-[#10B981]/30 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#10B981]"
                            />
                            <button
                                onClick={handleSaveFplId}
                                disabled={isSavingFplId || !inputFplLeagueId}
                                className="bg-[#10B981] text-black px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#10B981]/90 disabled:opacity-50 transition-colors text-xs sm:text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)] w-full sm:w-auto shrink-0 cursor-pointer"
                            >
                                <Save className="w-4 h-4" /> Save Link
                            </button>
                        </div>
                    </div>
                )}

                {/* Graceful banner when using cached standings while FPL is 503 updating */}
                {isCachedStandings && isFplMaintenance && (
                    <div className="fc-card bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                                <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-amber-300 flex items-center gap-2">
                                    <span>Official FPL Servers Updating</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 font-bold uppercase">HTTP 503</span>
                                </p>
                                <p className="text-[11px] text-gray-300 mt-0.5">
                                    Displaying your chama's latest verified standings. Pot calculations and standings will refresh live as soon as Premier League servers finish crunching scores.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const reload = async () => {
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
                                };
                                reload();
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-xs font-bold transition-all shrink-0 self-end sm:self-center cursor-pointer active:scale-95"
                        >
                            Check Live Status
                        </button>
                    </div>
                )}
                {/* Stats swapper + user hero */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Honest Funded Pot Members Card */}
                    <div className="fc-card bg-[#161d24] border border-white/5 rounded-2xl p-5 flex items-center justify-between min-h-[88px]">
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Funded Pot Members</p>
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
                                        <p className="text-2xl font-black text-white">
                                            {eligibleGwStandings.length} <span className="text-sm font-bold text-gray-400">/ {totalPotMembers} Paid</span>
                                        </p>
                                        <p className="text-[10px] font-semibold mt-0.5">
                                            {unpaidCount > 0 ? (
                                                <span className="text-rose-500 font-bold">{unpaidCount} in Red Zone (unpaid)</span>
                                            ) : (
                                                <span className="text-emerald-400 font-bold">All pot members funded ✓</span>
                                            )}
                                            {pendingOnboardingCount > 0 ? <span className="text-amber-400 font-medium"> · {pendingOnboardingCount} Pending Onboarding</span> : null}
                                            {spectatorCount > 0 ? <span className="text-gray-400 font-normal"> · {spectatorCount} Spectators (1v1 Bets)</span> : null}
                                        </p>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-emerald-400" />
                        </div>
                    </div>

                    {/* User hero card */}
                    {myStanding && (
                        <div className="fc-card bg-gradient-to-r from-[#FBBF24]/10 via-[#161d24] to-[#161d24] border border-[#FBBF24]/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                            <div>
                                <p className="text-[10px] font-bold text-[#FBBF24]/70 uppercase tracking-widest mb-1">Your GW Rank</p>
                                <p className="text-2xl font-black text-white">#{myStandingIdx + 1} <span className="text-sm font-bold text-[#FBBF24]">{myStanding.event_total} pts</span></p>
                                <p className="text-[10px] text-gray-500 mt-0.5">Season total: {Number(myStanding.total || 0).toLocaleString()} pts{standingsData[0] && myStandingIdx > 0 ? ` · ${(Number(standingsData[0].total || 0) - Number(myStanding.total || 0)).toLocaleString()} behind #1` : ''}</p>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-center">
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
                                <Trophy className="w-8 h-8 text-[#FBBF24]/40 hidden sm:block" />
                            </div>
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
                                <div className="flex flex-col sm:flex-row gap-2">
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
                                        className="flex-1 bg-[#0b1014] border border-white/15 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 w-full"
                                    />
                                    <button
                                        onClick={handleSaveFplId}
                                        disabled={isSavingFplId || !inputFplLeagueId}
                                        className="bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm transition-all w-full sm:w-auto shrink-0 cursor-pointer"
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
                    isFplMaintenance ? (
                        <div className="fc-card w-full bg-[#161d24] border border-amber-500/25 p-8 sm:p-10 rounded-[2rem] text-center relative overflow-hidden mt-6 shadow-2xl">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 blur-[100px] pointer-events-none" />
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                                <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Chama & Vault Secured
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">Official FPL Servers Updating</h3>
                            <p className="text-sm text-gray-300 max-w-md mx-auto leading-relaxed mb-6">
                                Official Premier League servers are currently crunching matchday scores, bonus points, or undergoing scheduled maintenance right now (HTTP 503). Your chama records and escrow pot are completely safe and will refresh live here automatically once FPL finishes updating.
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
                            {(() => {
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
                                    });

                                // Competition tie-ranking (e.g. 1, 1, 3, 4...)
                                let currentCompetitionRank = 1;
                                const rankedRows = filteredRows.map((row: any, idx: number, arr: any[]) => {
                                    if (idx > 0) {
                                        const prev = arr[idx - 1];
                                        if (Number(row.total) === Number(prev.total)) {
                                            // Tied with previous row!
                                        } else {
                                            currentCompetitionRank = idx + 1;
                                        }
                                    } else {
                                        currentCompetitionRank = 1;
                                    }
                                    const isTied = (idx > 0 && Number(row.total) === Number(arr[idx - 1].total)) ||
                                                   (idx < arr.length - 1 && Number(row.total) === Number(arr[idx + 1].total));
                                    return {
                                        ...row,
                                        displayRank: currentCompetitionRank,
                                        isTied
                                    };
                                });

                                return rankedRows.map((row: any, index: number) => {
                                const rankNum = Number(row.displayRank || index + 1);
                                const isTop1Overall = rankNum === 1;
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
                                const isFunded = Boolean(
                                    matchedMember &&
                                    matchedMember.isActive !== false &&
                                    !isSpectator &&
                                    (matchedMember.hasPaid === true || memberBalance > 0 || (stake > 0 && memberBalance >= stake))
                                );
                                const isGwWinnerRow = Boolean(
                                    isFunded &&
                                    maxEligibleGwScore > 0 &&
                                    Number(row.event_total) === maxEligibleGwScore
                                );
                                const isMe = myStanding && row.id === myStanding.id;
                                const medal = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : null;
                                const podiumBorder = rankNum === 1 ? 'border-l-4 border-l-amber-400' : rankNum === 2 ? 'border-l-4 border-l-slate-300' : rankNum === 3 ? 'border-l-4 border-l-amber-700' : 'border-l-4 border-l-transparent';
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
                                            isTop1Overall ? 'bg-[#10B981]/5 hover:bg-[#10B981]/10' : isInPodium && index > 0 ? 'bg-emerald-500/[0.02] hover:bg-emerald-500/[0.06]' : 'hover:bg-white/[0.04]',
                                            isGwWinnerRow && !isTop1Overall ? 'bg-[#10B981]/10 ring-1 ring-[#10B981]/30' : '',
                                            isMe ? 'ring-1 ring-[#FBBF24]/40' : ''
                                        )}
                                        title={`Tap to view ${row.player_name}'s team lineup`}
                                    >
                                        {/* Rank + Avatar + Name (Row 1 on Mobile, Col 1-5 on Desktop) */}
                                        <div className="flex items-center gap-3 md:col-span-5 w-full">
                                            <span className={clsx('font-extrabold text-lg md:text-base tabular-nums w-7 text-center shrink-0 flex items-center justify-center', isTop1Overall ? 'text-[#10B981]' : 'text-gray-500')}>
                                                {medal || (row.isTied ? `T${rankNum}` : rankNum)}
                                            </span>
                                            <UserAvatar name={row.player_name} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap group-hover:text-emerald-300 transition-colors">
                                                    <span className="truncate max-w-[170px] md:max-w-none">{row.player_name}</span>
                                                    {matchedMember?.id === chairmanId && (
                                                        <span className="bg-[#FBBF24]/10 text-[#FBBF24] text-[8px] px-1 py-0.5 rounded uppercase tracking-widest font-black border border-[#FBBF24]/30">Chair</span>
                                                    )}
                                                    {matchedMember?.id === coAdminId && matchedMember.id !== chairmanId && matchedMember.isActive !== false && (matchedMember.role === 'co-chair' || matchedMember.role === 'admin') && (
                                                        <span className="bg-[#10B981]/10 text-[#10B981] text-[8px] px-1 py-0.5 rounded uppercase tracking-widest font-black border border-[#10B981]/30">Co</span>
                                                    )}
                                                </span>
                                                <p className="text-[11px] text-gray-400 group-hover:text-emerald-400 transition-colors truncate md:hidden flex items-center gap-1 mt-0.5">
                                                    <Shirt className="w-3 h-3 text-emerald-400/80 shrink-0" />
                                                    {row.entry_name}
                                                </p>
                                            </div>
                                        </div>

                                        {/* FPL Team — desktop only */}
                                        <div className="hidden md:flex md:col-span-3 text-gray-400 group-hover:text-emerald-300 transition-colors text-sm italic truncate pr-2 items-center gap-1.5">
                                            <Shirt className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
                                            <span className="truncate">{row.entry_name}</span>
                                        </div>

                                        {/* Stats Row (Row 2 on Mobile, Col 9-12 on Desktop) */}
                                        <div className="flex items-center justify-between md:contents mt-3 md:mt-0 pt-3 md:pt-0 border-t border-white/5 md:border-0 w-full">
                                            <div className="flex flex-col md:block items-center md:col-span-1 md:text-center">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 md:hidden mb-1.5">GW Pts</span>
                                                <span className={clsx(
                                                    'px-2.5 py-1 font-bold rounded-lg text-xs tabular-nums border md:inline-block transition-all',
                                                    isGwWinnerRow
                                                        ? 'bg-[#10B981] text-black font-black border-transparent shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                                                        : 'bg-white/5 text-slate-200 border-white/5'
                                                )}>
                                                    {row.event_total}
                                                </span>
                                            </div>
                                            <div className="flex flex-col md:block items-center md:col-span-1 md:text-center">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 md:hidden mb-1.5">Total</span>
                                                <div className="font-extrabold text-white text-sm tabular-nums">{Number(row.total || 0).toLocaleString()}</div>
                                            </div>
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
                                                {isGwWinnerRow && isCurrentEventFinished && (role === 'admin' || isMe) && (!leagueStartGw || Number(currentEvent) >= leagueStartGw) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFlexCardData({
                                                                winnerName: row.player_name,
                                                                teamName: row.entry_name,
                                                                points: Number(row.event_total || 0),
                                                                amountWon: Math.round((eligibleGwStandings.length * (stake || 100)) * (Number((league as any)?.rules?.weekly || 70) / 100)),
                                                                gameweek: currentEvent || '',
                                                                isJointWinner: isGwTied,
                                                                tiedCount: tiedGwWinners.length
                                                            });
                                                        }}
                                                        className="font-black text-[10px] md:text-xs tracking-tight border px-2.5 py-1 rounded-lg text-[#10B981] border-[#10B981]/40 bg-[#10B981]/15 hover:bg-[#10B981]/25 flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.2)] transition-all active:scale-95 cursor-pointer ml-2"
                                                        title="Share GW Champion Victory Card on WhatsApp"
                                                    >
                                                        <Star className="w-3 h-3 fill-[#10B981] text-[#10B981]" /> Victory Card
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
                                    {leagueStartGw > 1 && (
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 normal-case tracking-normal">
                                            Chama Commenced: GW{leagueStartGw}
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
                            const allKeys = Object.keys(performanceData[0] || {}).filter(k => k !== 'name' && k !== 'Average');
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
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={performanceData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={30} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f1720', borderColor: 'rgba(255,255,255,0.12)', borderRadius: '14px', fontSize: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                                    itemStyle={{ fontWeight: 'bold' }}
                                                />
                                                {leagueStartGw && leagueStartGw > 1 && (
                                                    <ReferenceLine
                                                        x={`GW${leagueStartGw}`}
                                                        stroke="#10B981"
                                                        strokeDasharray="4 4"
                                                        strokeWidth={2}
                                                        label={{
                                                            value: `🏁 Kickoff (GW${leagueStartGw})`,
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
                                const isLeaderFunded = isMemberEligibleWinner(leader);
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
                                                {isLeaderFunded ? (
                                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        ✓ Funded
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-[#FBBF24] border border-amber-500/30" title="Deposit required to claim vault prize">
                                                        ⏳ Pending Deposit
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-black text-white truncate">{leader.player_name}</p>
                                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{leader.entry_name}</p>
                                        </div>
                                        <div className="mt-3 pt-2.5 border-t border-white/5">
                                            <p className="text-base font-black text-emerald-400 tabular-nums">{Number(leader.total || 0).toLocaleString()} pts</p>
                                            <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                                {isLeaderFunded ? (
                                                    Number(leader.total || 0) === Number(topSeasonLeaders[0]?.total || 0)
                                                        ? (isLeaderTied ? 'Tied for Vault Lead' : 'Vault leader')
                                                        : `${Math.max(0, Number(topSeasonLeaders[0]?.total || 0) - Number(leader.total || 0)).toLocaleString()} pts behind`
                                                ) : (
                                                    <span className="text-amber-400/90 font-medium">Deposit required for vault</span>
                                                )}
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
                                        {isCurrentEventFinished ? `Next: GW ${(currentEvent || 0) + 1} (Pending)` : `Now: GW ${currentEvent}`}
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
                                const isApprovedPaid = Boolean(item.isPaid);
                                const targetActiveGw = (isCurrentEventFinished && currentEvent) ? currentEvent + 1 : (currentEvent || 1);
                                const isTargetActiveGw = item.gw === targetActiveGw;
                                const isCurrentGw = currentEvent === item.gw;
                                const isCurrentLive = !isCurrentEventFinished && (Boolean(item.isCurrentLive) || isCurrentGw);
                                return (
                                    <div
                                        key={item.gw}
                                        data-gw-card={item.gw}
                                        className={clsx(
                                            'fc-gw-ledger-card snap-start shrink-0 w-56 sm:w-60 lg:w-52 rounded-xl border p-3.5 transition-all shadow-sm',
                                            isApprovedPaid
                                                ? 'fc-gw-ledger-card-resolved border-emerald-500/30 bg-emerald-500/10'
                                                : isCurrentLive
                                                ? 'border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-500/30'
                                                : isAwaitingPayment
                                                ? 'border-amber-500/40 bg-amber-500/10 ring-1 ring-amber-500/30'
                                                : isPreLeague
                                                ? 'border-slate-300 dark:border-slate-500/25 bg-slate-100/90 dark:bg-slate-500/8 text-slate-700 dark:text-slate-300'
                                                : isVoided || isSkipped
                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                                : isTargetActiveGw
                                                ? 'border-[#FBBF24]/60 bg-[#FBBF24]/10 ring-2 ring-[#FBBF24]/50'
                                                : isCurrentGw
                                                ? 'border-[#FBBF24]/50 bg-[#FBBF24]/10'
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
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                    Paid ✓
                                                </span>
                                            ) : isAwaitingPayment ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40">
                                                    Awaiting Payout
                                                </span>
                                            ) : isTargetActiveGw ? (
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#FBBF24]/20 text-amber-700 dark:text-[#FBBF24] border border-[#FBBF24]/40 animate-pulse">
                                                    Pending
                                                </span>
                                            ) : (
                                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-500 border border-slate-200 dark:border-white/10">
                                                    Upcoming
                                                </span>
                                            )}
                                        </div>
                                        <p className={clsx(
                                            'text-xs font-black truncate',
                                            isApprovedPaid ? 'text-slate-900 dark:text-white' : isCurrentLive ? 'text-amber-400 dark:text-[#FBBF24]' : isPreLeague ? 'text-slate-600 dark:text-slate-400' : isVoided || isSkipped ? 'text-amber-600 dark:text-amber-300' : isTargetActiveGw ? 'text-amber-600 dark:text-[#FBBF24]' : 'text-slate-400 dark:text-gray-500'
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
                                                : item.winnerTeam || (isApprovedPaid ? 'Payout recorded' : isTargetActiveGw ? (isCurrentEventFinished ? 'Next Round Kickoff' : 'Active Round') : 'Pending kickoff')}
                                        </p>
                                        {(isApprovedPaid || isAwaitingPayment) && typeof item.amount === 'number' && item.amount > 0 && (
                                            <p className="text-[10px] font-black text-[#FBBF24] mt-1">KES {item.amount.toLocaleString()}</p>
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
