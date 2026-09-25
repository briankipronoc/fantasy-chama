import { useState, useEffect, useMemo } from 'react';
import { useCountUp } from '../hooks/useCountUp';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import LeagueRulesModal from '../components/LeagueRulesModal';
import { Trophy, BarChart3, Banknote, ShieldCheck, AlertCircle, Zap, Check, Activity, Terminal, AlertTriangle, RefreshCw, CheckCircle2, Share2, Star, Send, AlertOctagon, Bell, Smartphone, Wallet, MessageCircle, Calendar, Flame, Swords, ArrowRight } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, where, updateDoc, orderBy, limit, arrayUnion, deleteDoc } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import { getApiBaseUrl, secureApiPost } from '../utils/api';
import { useNotifications } from '../components/NotificationProvider';
import PotVaultSwapper from '../components/PotVaultSwapper';
import clsx from 'clsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DashboardSkeleton } from '../components/Skeleton';
import ChampionFlexCardModal from '../components/ChampionFlexCardModal';
import { haptics } from '../utils/haptics';
import confetti from 'canvas-confetti';

export default function MemberDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserIdStored = localStorage.getItem('activeUserId');
    const memberPhone = localStorage.getItem('memberPhone');

    const [gameweekStake, setMonthlyContribution] = useState(0);
    const [leagueName, setLeagueName] = useState('');
    const [rules, setRules] = useState({ weekly: 70, vault: 30 });
    const [coAdminId, setCoAdminId] = useState<string | null>(null);
    const [chairmanPhone, setChairmanPhone] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
    const [isPushingMpesa, setIsPushingMpesa] = useState(false);

    // Module 3B: Dispute/Claim state
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [claimReceiptCode, setClaimReceiptCode] = useState('');
    const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
    const [claimSubmitted, setClaimSubmitted] = useState(false);

    // Wallet top-up + winnings credit request state
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState(0);
    const [topUpNote, setTopUpNote] = useState('');
    const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);
    const [isRequestingWalletCredit, setIsRequestingWalletCredit] = useState(false);

    // Module 4A: Winner confirmation state
    const [winnerConfirmation, setWinnerConfirmation] = useState<any>(null);

    // Phase 10.5: Live Escrow Feed
    const [liveEvents, setLiveEvents] = useState<any[]>([]);

    // Phase 29: FPL GW Winner + full standings
    const [gwWinner, setGwWinner] = useState<any>(null);
    const [fplStandings, setFplStandings] = useState<any[]>([]);
    const [rawFplStandings, setRawFplStandings] = useState<any[]>([]);
    const [activeUserSideBets, setActiveUserSideBets] = useState<any[]>([]);
    const [currentFplEvent, setCurrentFplEvent] = useState<{
        id: number;
        name?: string;
        finished: boolean;
        deadlineTime?: string;
        nextId?: number;
        nextName?: string;
        nextDeadlineTime?: string;
        isPreparingForNextGw?: boolean;
    } | null>(null);

    // Phase 30: panel toggles
    const [showFeedPanelMobile, setShowFeedPanelMobile] = useState(false);
    const [showFlexModal, setShowFlexModal] = useState(false);
    // const [showAllWinners, setShowAllWinners] = useState(false);

    // Phase 31: Real FPL Performance Trajectory
    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [leagueStartGw, setLeagueStartGw] = useState<number>(() => Number((useStore.getState().league as any)?.startGw || 1));

    // Co-Admin State
    const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
    const [isApprovingPayout, setIsApprovingPayout] = useState<string | null>(null);
    const [nudgeSent, setNudgeSent] = useState(false);
    const [userLeagueCount, setUserLeagueCount] = useState(1);
    const [activeLeagueRole, setActiveLeagueRole] = useState<string>('member');
    const [showLeagueGuide, setShowLeagueGuide] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [isUpgradingToPot, setIsUpgradingToPot] = useState(false);
    const [activeReactionAnim, setActiveReactionAnim] = useState<{ emoji: string; isExiting: boolean } | null>(null);

    const members = useStore(state => state.members);
    const logout = useStore(state => state.logout);
    const leagueSettings = useStore(state => state.league);
    
    // Auto-Lockout: 48 Hour Grace Period
    const pendingHQDebt = leagueSettings?.pendingHQDebt || 0;
    const lastResolvedTS = leagueSettings?.lastResolvedDate;
    const lastResolvedDate = lastResolvedTS?.toDate ? lastResolvedTS.toDate() : new Date();
    const isGracePeriodOver = pendingHQDebt > 0 && (Date.now() - lastResolvedDate.getTime()) > (2 * 24 * 60 * 60 * 1000);
    const isSuspended = leagueSettings?.isSuspended === true || isGracePeriodOver;
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);
    const listenToLeagueTransactions = useStore(state => state.listenToLeagueTransactions);
    const transactions = useStore(state => state.transactions);
    const [showPochiInstructions, setShowPochiInstructions] = useState(false);
    const [isNudgingHQ, setIsNudgingHQ] = useState(false);


    const handleNudgeHQ = async () => {
        if (!activeLeagueId || !currentUser) return;
        setIsNudgingHQ(true);
        try {
            const leagueRef = doc(db, 'leagues', activeLeagueId);
            await updateDoc(leagueRef, {
                suspensionNudges: arrayUnion((currentUser?.displayName || 'Member').split(' ')[0])
            });
            showToast("Chairman has been notified.", "success");
        } catch (error) {
            console.error("Nudge Error:", error);
            showToast("Failed to nudge Chairman.", "error");
        } finally {
            setIsNudgingHQ(false);
        }
    };
    const isStealthMode = useStore(state => state.isStealthMode);
    const role = useStore(state => state.role);
    const { notifications } = useNotifications();

    const chairmanMember = members.find((member) => {
        const mRole = (member as any).role;
        return member.id === coAdminId || mRole === 'admin' || mRole === 'chairman';
    });
    const currentUser = members.find(m => m.id === activeUserIdStored)
        || members.find(m => m.phone === memberPhone)
        || (role === 'admin' ? chairmanMember : undefined)
        || (role === 'admin' ? members.find(m => (m as any).role === 'admin') : undefined);
    const walletBalance = currentUser?.walletBalance || 0;
    const isSpectator = currentUser?.playMode === 'sidebets_only';
    const hasPaid = currentUser?.hasPaid || (gameweekStake > 0 && walletBalance >= gameweekStake);
    const activeUserId = currentUser?.id || activeUserIdStored || 'dummy';
    const coChairMember = members.find(m => m.id === coAdminId);
    const payoutApproverId = coAdminId
        && coAdminId !== activeUserId
        && coChairMember
        && coChairMember.isActive !== false
        && (((coChairMember as any).role === 'admin') || ((coChairMember as any).role === 'co-chair'))
        ? coAdminId
        : null;

    useEffect(() => {
        if (!activeLeagueId) {
            navigate('/login');
            return;
        }
        if (!memberPhone && role !== 'admin') {
            navigate('/login');
            return;
        }

        // Setup real-time listener for the League document
        const leagueRef = doc(db, 'leagues', activeLeagueId);
        const unsubscribeLeague = onSnapshot(leagueRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMonthlyContribution(data.gameweekStake || 0);
                setLeagueName(data.name || data.leagueName || '');
                if (data.rules) setRules(data.rules);
                setCoAdminId(data.coAdminId || null);
                setChairmanPhone(data.chairmanPhone || null);
                if (data.startGw || data.startGameweek || data.rules?.startGw) {
                    setLeagueStartGw(Number(data.startGw || data.startGameweek || data.rules?.startGw || 1));
                }

                // Phase 29: Fetch FPL GW Winner continuously with caching and 503 resilience
                if (data.fplLeagueId) {
                    const standingsCacheKey = `fpl_standings_${data.fplLeagueId}`;
                    const cachedStandingsRaw = localStorage.getItem(standingsCacheKey);

                    if (cachedStandingsRaw) {
                        try {
                            const parsed = JSON.parse(cachedStandingsRaw);
                            if (parsed?.data && parsed.data.length > 0) {
                                setRawFplStandings(parsed.data);
                            }
                        } catch {}
                    }

                    fetch(`/fpl-api/leagues-classic/${data.fplLeagueId}/standings/`)
                        .then(res => {
                            if (!res.ok) throw new Error(`FPL Standings returned ${res.status}`);
                            return res.json();
                        })
                        .then(fplData => {
                            const results = fplData?.standings?.results;
                            if (results && results.length > 0) {
                                setRawFplStandings(results);
                                try {
                                    localStorage.setItem(standingsCacheKey, JSON.stringify({ timestamp: Date.now(), data: results }));
                                } catch {}
                            }
                        })
                        .catch(err => {
                            console.warn("Could not fetch fresh FPL winner/standings, relying on cache:", err?.message || err);
                        });
                }
            }
        }, (err: any) => {
            console.error("Error listening to league:", err);
            navigate('/login');
        });

        // Initialize Live Ledger for Members
        const unsubscribeMembers = listenToLeagueMembers(activeLeagueId);
        const unsubscribeTransactions = listenToLeagueTransactions(activeLeagueId);

        // Update lastLoginAt for retention tracking
        if (activeUserId && activeUserId !== 'dummy') {
            const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', activeUserId);
            updateDoc(memberRef, { 
                lastLoginAt: serverTimestamp() 
            }).catch(e => console.error("Failed to update last login", e));
        }

        if (location.state?.welcomeMsg) {
            setToastMessage(location.state.welcomeMsg);
            setToastType('success');
            setTimeout(() => setToastMessage(''), 4000);
            window.history.replaceState({}, document.title);
        }

        return () => {
            try {
                unsubscribeLeague();
            } catch (error: any) {
                console.warn('[member-dashboard] unsubscribeLeague failed:', error?.message || error);
            }
            try {
                unsubscribeMembers();
            } catch (error: any) {
                console.warn('[member-dashboard] unsubscribeMembers failed:', error?.message || error);
            }
            try {
                unsubscribeTransactions();
            } catch (error: any) {
                console.warn('[member-dashboard] unsubscribeTransactions failed:', error?.message || error);
            }
        };
    }, [activeLeagueId, memberPhone, navigate, listenToLeagueMembers, listenToLeagueTransactions, location.state, currentUser?.fplTeamId, currentUser?.secondFplTeamId]);

    useEffect(() => {
        if (members.length === 0) return;
        if (!leagueName) return;
        setIsLoading(false);

        // Check if already dismissed or accepted in this league
        const isDismissedOrAccepted = Boolean(
            activeLeagueId && (
                localStorage.getItem(`fc_rules_accepted_${activeLeagueId}`) === 'true' ||
                localStorage.getItem(`fc_constitution_dismissed_${activeLeagueId}`) === 'true' ||
                localStorage.getItem('fc_constitution_dismissed') === 'true'
            )
        );

        if (isDismissedOrAccepted) return;

        const shouldForceShowConstitution = Boolean(
            location.state?.showConstitution ||
            sessionStorage.getItem('fc_show_constitution_onboarded') === 'true'
        );

        if (shouldForceShowConstitution || (currentUser && currentUser?.role !== 'admin' && !(currentUser as any)?.hasAcceptedRules)) {
            const timer = setTimeout(() => setShowRulesModal(true), 350);
            return () => clearTimeout(timer);
        }
    }, [members.length, currentUser, leagueName, activeLeagueId, location.state]);

    // Build league-wide GW average and user trajectory from GW1 to latest completed GW
    useEffect(() => {
        if (!rawFplStandings || rawFplStandings.length === 0) return;

        const myFplId = Number(currentUser?.fplTeamId || 0);
        const secondFplId = Number(currentUser?.secondFplTeamId || 0);
        const myName = (currentUser?.displayName || '').trim().toLowerCase();

        // Find my entry in raw standings if fplTeamId wasn't directly linked yet
        let matchedMyEntryId = myFplId || secondFplId;
        if (!matchedMyEntryId && myName) {
            const matched = rawFplStandings.find((r: any) => {
                const pName = (r.player_name || '').toLowerCase();
                const eName = (r.entry_name || '').toLowerCase();
                return pName.includes(myName) || myName.includes(pName) || eName.includes(myName);
            });
            if (matched?.entry) matchedMyEntryId = Number(matched.entry);
        }

        const topTeams = rawFplStandings.slice(0, 8).map((r: any) => Number(r.entry));
        const allMemberTeamIds = members
            .map((m: any) => Number(m.fplTeamId || m.secondFplTeamId || 0))
            .filter((id: number) => id > 0);

        const teamIds = [
            ...new Set([
                ...topTeams,
                ...allMemberTeamIds,
                ...(matchedMyEntryId ? [matchedMyEntryId] : [])
            ])
        ].filter(Boolean);

        if (teamIds.length === 0) return;

        let isMounted = true;

        const runFetch = async () => {
            const gwMap = new Map<number, any>();

            const historyResults = await Promise.allSettled(
                teamIds.map(async (tId) => {
                    const histCacheKey = `fpl_history_${tId}`;
                    let histData: any = null;
                    try {
                        const r = await fetch(`/fpl-api/entry/${tId}/history/`);
                        if (r.ok) {
                            histData = await r.json();
                            if (histData?.current) {
                                localStorage.setItem(histCacheKey, JSON.stringify({ timestamp: Date.now(), data: histData }));
                            }
                        }
                    } catch {}

                    if (!histData) {
                        const cached = localStorage.getItem(histCacheKey);
                        if (cached) {
                            try { histData = JSON.parse(cached).data; } catch {}
                        }
                    }
                    return { tId, histData };
                })
            );

            if (!isMounted) return;

            // Clamp to max completed or live gameweek
            const isUpcomingUnplayed = currentFplEvent?.deadlineTime
                ? Date.now() < new Date(currentFplEvent.deadlineTime).getTime()
                : Boolean(currentFplEvent?.isPreparingForNextGw);

            const maxPlayedGw = isUpcomingUnplayed
                ? Math.max(1, (currentFplEvent?.id || 2) - 1)
                : (currentFplEvent?.id || 1);

            for (const result of historyResults) {
                if (result.status !== 'fulfilled') continue;
                const { tId, histData } = result.value;
                const current = histData?.current;
                if (current && current.length > 0) {
                    const relevant = current.filter((gw: any) => Number(gw.event) <= maxPlayedGw);
                    const playerEntry = rawFplStandings.find((r: any) => Number(r.entry) === tId);
                    const playerName = playerEntry ? playerEntry.player_name.split(' ')[0] : `Team ${tId}`;
                    const isMe = tId === matchedMyEntryId;

                    for (const gw of relevant) {
                        const evNum = Number(gw.event);
                        if (!gwMap.has(evNum)) {
                            gwMap.set(evNum, { name: `GW${evNum}` });
                        }
                        const row = gwMap.get(evNum);
                        const pts = Number(gw.points || 0);
                        row[playerName] = pts;
                        if (isMe) {
                            row['You'] = pts;
                        }
                    }
                }
            }

            let aggData: any[] = Array.from(gwMap.values());

            if (aggData.length > 0) {
                aggData.sort((a, b) => {
                    const numA = parseInt(String(a.name || '').replace(/\D/g, ''), 10) || 0;
                    const numB = parseInt(String(b.name || '').replace(/\D/g, ''), 10) || 0;
                    return numA - numB;
                });

                const finalData = aggData.map(row => {
                    const scores = Object.keys(row)
                        .filter(k => k !== 'name' && k !== 'Average' && k !== 'You')
                        .map(k => Number(row[k]))
                        .filter(n => Number.isFinite(n));
                    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;
                    return {
                        ...row,
                        Average: avg
                    };
                });

                if (isMounted) {
                    setPerformanceData(finalData);
                }
            }
        };

        runFetch();

        return () => {
            isMounted = false;
        };
    }, [rawFplStandings, currentUser?.fplTeamId, currentUser?.secondFplTeamId, currentUser?.displayName, currentFplEvent?.id, currentFplEvent?.deadlineTime, members]);

    useEffect(() => {
        const fetchCurrentEvent = async () => {
            try {
                const response = await fetch(`/fpl-api/bootstrap-static/`);
                if (!response.ok) return;
                const data = await response.json();
                const events = data?.events || [];
                const rawCurrent = events.find((event: any) => event.is_current);
                const rawPrevious = events.find((event: any) => event.is_previous) || events.filter((e: any) => e.finished).pop();
                const rawNext = events.find((event: any) => event.is_next);

                if (!rawCurrent && !rawPrevious) return;

                // Check if rawCurrent has kicked off yet
                const isCurrentStarted = rawCurrent?.deadline_time 
                    ? Date.now() >= new Date(rawCurrent.deadline_time).getTime() 
                    : false;

                // If rawCurrent is finished, evaluate rawCurrent.
                // If rawCurrent hasn't started yet, evaluate rawPrevious (e.g. GW ended Tuesday night, next GW starts Friday).
                const completedCandidate = rawCurrent?.finished 
                    ? rawCurrent 
                    : (!isCurrentStarted && rawPrevious ? rawPrevious : rawCurrent);

                let isGwFinished = completedCandidate?.finished === true;
                let gwFinishedTimestamp = 0;

                if (completedCandidate?.id) {
                    try {
                        const fixRes = await fetch(`/fpl-api/fixtures/?event=${completedCandidate.id}`);
                        if (fixRes.ok) {
                            const fixtures = await fixRes.json();
                            if (Array.isArray(fixtures) && fixtures.length > 0) {
                                // Double gameweeks & postponed matches:
                                // Postponed fixtures do not block gameweek completion
                                const allDone = fixtures.every((f: any) =>
                                    f.finished === true ||
                                    f.finished_provisional === true ||
                                    f.postponed === true ||
                                    (f.kickoff_time && (Date.now() - new Date(f.kickoff_time).getTime()) > 135 * 60 * 1000)
                                );
                                if (allDone) isGwFinished = true;

                                // Timestamp of the final match whistle
                                fixtures.forEach((f: any) => {
                                    if (f.kickoff_time && !f.postponed) {
                                        const end = new Date(f.kickoff_time).getTime() + (115 * 60 * 1000);
                                        if (end > gwFinishedTimestamp) gwFinishedTimestamp = end;
                                    }
                                });
                            }
                        }
                    } catch (e) {
                        console.warn('[member-dashboard] fixtures check skipped:', e);
                    }
                }

                const storedKey = `fc_gw_${completedCandidate?.id}_finished_at`;
                if (isGwFinished) {
                    if (!gwFinishedTimestamp) {
                        const storedVal = localStorage.getItem(storedKey);
                        gwFinishedTimestamp = storedVal ? Number(storedVal) : Date.now();
                    }
                    localStorage.setItem(storedKey, String(gwFinishedTimestamp));
                }

                // The upcoming gameweek deadline to measure reaction window against
                const upcomingDeadlineTime = (!isCurrentStarted && rawPrevious && completedCandidate?.id === rawPrevious.id)
                    ? rawCurrent?.deadline_time
                    : rawNext?.deadline_time;

                const isNextGwKickedOff = rawNext?.deadline_time 
                    ? Date.now() >= new Date(rawNext.deadline_time).getTime() 
                    : (rawCurrent?.deadline_time ? Date.now() >= new Date(rawCurrent.deadline_time).getTime() : false);

                const nextDeadlineMs = upcomingDeadlineTime ? new Date(upcomingDeadlineTime).getTime() : null;
                const hoursUntilNextDeadline = nextDeadlineMs ? (nextDeadlineMs - Date.now()) / (1000 * 60 * 60) : Infinity;

                // Reigning Champion Rule:
                // Active until 36h before the next GW deadline (unless next GW has already kicked off)
                const isCelebrationWindowActive = Boolean(
                    completedCandidate &&
                    isGwFinished &&
                    !isNextGwKickedOff &&
                    hoursUntilNextDeadline > 36
                );

                let activeEventToDisplay: any;
                let isPreparingForNext = false;

                if (isCelebrationWindowActive && completedCandidate) {
                    // Keep winner podium and WhatsApp card active
                    activeEventToDisplay = completedCandidate;
                    isPreparingForNext = false;
                } else if (!isCurrentStarted && rawCurrent) {
                    activeEventToDisplay = rawCurrent;
                    isPreparingForNext = true;
                    isGwFinished = false;
                } else {
                    activeEventToDisplay = completedCandidate || rawCurrent || rawPrevious;
                    isPreparingForNext = isGwFinished && isNextGwKickedOff;
                }

                setCurrentFplEvent({
                    id: activeEventToDisplay.id,
                    name: activeEventToDisplay.name || `Gameweek ${activeEventToDisplay.id}`,
                    finished: isCelebrationWindowActive ? true : isGwFinished,
                    deadlineTime: activeEventToDisplay.deadline_time,
                    nextId: rawNext?.id || activeEventToDisplay.id + 1,
                    nextName: rawNext?.name || `Gameweek ${rawNext?.id || activeEventToDisplay.id + 1}`,
                    nextDeadlineTime: rawNext?.deadline_time || upcomingDeadlineTime,
                    isPreparingForNextGw: isPreparingForNext,
                });

                // Auto-persist startGw if the league doesn't have it yet
                const leagueRef2 = activeLeagueId ? (await import('firebase/firestore').then(({ doc, getDoc }) => getDoc(doc(db, 'leagues', activeLeagueId)))) : null;
                if (leagueRef2 && activeLeagueId && leagueRef2.data()?.startGw == null) {
                    import('firebase/firestore').then(({ doc, updateDoc }) => {
                        updateDoc(doc(db, 'leagues', activeLeagueId), { startGw: activeEventToDisplay.id }).catch(() => {});
                    });
                }
            } catch (err) {
                console.warn('Could not fetch current FPL event', err);
            }
        };

        fetchCurrentEvent();
    }, []);

    // Dynamically calculate active Chama standings and GW winner from raw FPL results + Chama memberships
    useEffect(() => {
        if (!rawFplStandings || rawFplStandings.length === 0) {
            setFplStandings([]);
            setGwWinner(null);
            return;
        }

        const norm = (s: string) => String(s || '').toLowerCase().trim();
        const effectiveStake = Number(gameweekStake || 0);

        // Match each FPL entry to a Chama member — covers fplTeamId, secondFplTeamId, and fuzzy name
        const matchMember = (r: any) => members.find((m: any) => {
            if (m.fplTeamId && Number(m.fplTeamId) === Number(r.entry)) return true;
            if (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(r.entry)) return true;
            const db = norm(m.displayName);
            return norm(r.player_name).includes(db) || db.includes(norm(r.player_name)) || norm(r.entry_name || '').includes(db);
        });

        // GW Standings card — show ALL active, non-spectator Chama members regardless of payment
        const chamaResults = rawFplStandings
            .map((r: any) => ({ entry: r, member: matchMember(r) }))
            .filter(({ member }) => member && member.isActive !== false && (member as any).playMode !== 'sidebets_only')
            .sort((a: any, b: any) => Number(b.entry.event_total || 0) - Number(a.entry.event_total || 0))
            .map(({ entry }) => entry);

        setFplStandings(chamaResults);

        // GW Winner — only from funded/eligible members (Chama Rule)
        const eligibleResults = chamaResults.filter((r: any) => {
            const dbMember = matchMember(r);
            if (!dbMember) return false;
            if ((dbMember as any).isEliminated === true) return false;
            const isFunded = dbMember.hasPaid === true || (effectiveStake > 0 && Number(dbMember.walletBalance || 0) >= effectiveStake);
            return isFunded;
        });

        if (eligibleResults.length >= 1 && Number(eligibleResults[0]?.event_total || 0) > 0) {
            const winner = eligibleResults[0];
            const runnerUp = eligibleResults[1] || null;
            const leadMargin = runnerUp ? Number(winner?.event_total || 0) - Number(runnerUp?.event_total || 0) : 0;
            setGwWinner({
                ...winner,
                runnerUpName: runnerUp?.player_name || runnerUp?.entry_name || null,
                leadMargin: Math.max(0, leadMargin),
            });
        } else {
            setGwWinner(null);
        }
    }, [rawFplStandings, members, gameweekStake]);

    // ── missedGameweeks client-side computation ──────────────────────────────
    // Runs whenever transactions or currentFplEvent changes. Computes the number
    // of consecutive gameweeks the current user has missed, then writes it back
    // to Firestore so the Arrears Warning Banner has authoritative data.
    useEffect(() => {
        if (!activeLeagueId || !currentUser?.id || !currentFplEvent?.id || gameweekStake <= 0) return;
        if (isSpectator) return; // spectators are never in arrears

        const currentGw = currentFplEvent.finished ? currentFplEvent.id : (currentFplEvent.id - 1);
        if (currentGw <= 0) return;

        const leagueStart = Number(leagueStartGw || 1);
        const memberJoinedGw = Number((currentUser as any).joinedGw || leagueStart);

        // Walk backwards from the most recently finished GW
        let consecutiveMissed = 0;
        for (let gw = currentGw; gw >= Math.max(leagueStart, memberJoinedGw); gw--) {
            // Check if there's any valid inflow transaction tagged to this GW for this member
            const paid = transactions.some((tx: any) => {
                if (String(tx.userId || tx.memberId || '') !== String(currentUser.id)) return false;
                if (tx.status === 'failed' || tx.status === 'reversed' || tx.status === 'refunded') return false;
                if (Number(tx.amount || 0) < gameweekStake) return false;
                const txGw = Number(tx.gameweek || tx.gw || 0);
                return txGw === gw;
            });
            if (paid) break; // chain broken — stop counting
            consecutiveMissed++;
            if (consecutiveMissed >= 3) break; // cap at 3 for UI clarity
        }

        const storedMissed = Number((currentUser as any).missedGameweeks || 0);
        if (consecutiveMissed !== storedMissed) {
            const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', currentUser.id);
            updateDoc(memberRef, { missedGameweeks: consecutiveMissed }).catch(() => {});
        }
    }, [transactions, currentFplEvent?.id, currentFplEvent?.finished, currentUser?.id, activeLeagueId, gameweekStake, leagueStartGw, isSpectator]);

    useEffect(() => {
        if (!activeLeagueId) return;
        const eventsRef = collection(db, 'leagues', activeLeagueId, 'league_events');
        const q = query(eventsRef, orderBy('timestamp', 'desc'), limit(30));
        const unsub = onSnapshot(q, snap => {
            const isStaleEvent = (ev: any) => {
                const msg = String(ev.message || '');
                const type = String(ev.eventType || '');
                const combined = `${msg} ${type}`;
                if (/last\s*season/i.test(combined)) return true;
                const gwMatch = combined.match(/GW\s*(\d+)/i) || combined.match(/Gameweek\s*(\d+)/i);
                const eventGw = ev.gw ? Number(ev.gw) : (gwMatch ? Number(gwMatch[1]) : null);
                if (eventGw && eventGw >= 30) {
                    const currentGw = currentFplEvent?.id || 4;
                    if (currentGw < 25) return true;
                }
                return false;
            };

            const valid: any[] = [];
            snap.docs.forEach(d => {
                const ev = { id: d.id, ...d.data() };
                if (isStaleEvent(ev)) {
                    if (role === 'admin') {
                        deleteDoc(d.ref).catch(() => {});
                    }
                } else {
                    valid.push(ev);
                }
            });
            setLiveEvents(valid);
        }, (error) => {
            console.warn('[member-dashboard] live events listener failed:', error?.message || error);
        });
        return () => {
            try {
                unsub();
            } catch (error: any) {
                console.warn('[member-dashboard] live events unsubscribe failed:', error?.message || error);
            }
        };
    }, [activeLeagueId, role, currentFplEvent?.id]);

    // Co-Chair: Listen for Pending Payouts
    useEffect(() => {
        if (!activeLeagueId || currentUser?.id !== coAdminId) return;
        const q = query(
            collection(db, 'leagues', activeLeagueId, 'pending_payouts'),
            where('status', '==', 'awaiting_approval')
        );
        const unsub = onSnapshot(q, snap => {
            setPendingPayouts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.warn('[member-dashboard] pending payouts listener failed:', error?.message || error);
        });
        return () => {
            try {
                unsub();
            } catch (error: any) {
                console.warn('[member-dashboard] pending payouts unsubscribe failed:', error?.message || error);
            }
        };
    }, [activeLeagueId, currentUser?.id, coAdminId]);

    // Listen for Active/Pending 1v1 Side Bets for the logged-in member
    useEffect(() => {
        if (!activeLeagueId || !currentUser?.id) return;
        const betsRef = collection(db, 'leagues', activeLeagueId, 'side_bets');
        const unsub = onSnapshot(betsRef, (snap) => {
            const myBets = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(b => 
                    (b.challenger?.id === currentUser.id || b.opponent?.id === currentUser.id) &&
                    b.status !== 'resolved' &&
                    b.status !== 'declined'
                );
            setActiveUserSideBets(myBets);
        }, (err) => {
            console.warn('[member-dashboard] side bets listener failed:', err?.message || err);
        });
        return () => {
            try { unsub(); } catch {}
        };
    }, [activeLeagueId, currentUser?.id]);

    useEffect(() => {
        if (!memberPhone) return;
        const leaguesRef = doc(db, 'userLeagues', memberPhone);
        const unsub = onSnapshot(leaguesRef, (snap) => {
            if (!snap.exists()) {
                setUserLeagueCount(1);
                setActiveLeagueRole('member');
                return;
            }

            const data = snap.data();
            const leagues = Array.isArray(data?.leagues) ? data.leagues : [];
            setUserLeagueCount(Math.max(1, leagues.length));

            const selected = leagues.find((league: any) => league?.leagueId === activeLeagueId);
            setActiveLeagueRole(selected?.role || 'member');
        }, (error) => {
            console.warn('[member-dashboard] user leagues listener failed:', error?.message || error);
        });

        return () => {
            try {
                unsub();
            } catch (error: any) {
                console.warn('[member-dashboard] user leagues unsubscribe failed:', error?.message || error);
            }
        };
    }, [activeLeagueId, memberPhone]);

    useEffect(() => {
        if (!activeLeagueId) return;
        const hasDualTeam = Boolean(currentUser?.secondFplTeamId);
        const shouldGuide = userLeagueCount > 1 || hasDualTeam;
        const guideKey = `fc-member-league-guide-dismissed-${activeLeagueId}-${activeUserId}`;
        const dismissed = localStorage.getItem(guideKey) === 'true';
        setShowLeagueGuide(shouldGuide && !dismissed);
    }, [activeLeagueId, activeUserId, currentUser?.secondFplTeamId, userLeagueCount]);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => setToastMessage(''), 3000);
    };

    const handleUpgradeToPot = async () => {
        if (!activeLeagueId || !currentUser?.id) return;
        setIsUpgradingToPot(true);
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', currentUser.id), {
                playMode: 'pot',
                updatedAt: serverTimestamp()
            });

            if (walletBalance < gameweekStake) {
                showToast(`Upgraded to Cash Pot! Fund at least KES ${(gameweekStake - walletBalance).toLocaleString()} to activate your Gameweek round. Opening deposit...`, 'info');
                setTimeout(() => {
                    navigate('/deposit', { state: { upgradeMode: true } });
                }, 1200);
            } else {
                showToast("Upgraded to Weekly & Season Cash Pot! You are funded and eligible for this round.", 'success');
            }
        } catch (err: any) {
            console.error("Failed to upgrade:", err);
            showToast("Failed to switch mode. Please try again.", 'error');
        } finally {
            setIsUpgradingToPot(false);
        }
    };

    const handleMpesaSTKPush = async (amount = gameweekStake) => {
        if (!activeLeagueId || !currentUser || !memberPhone) return;
        setIsSubmittingTopUp(true);
        setIsPushingMpesa(true);
        try {
            const apiUrl = getApiBaseUrl();
            if (!apiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
            const requestAmount = Math.max(1, Math.floor(Number(amount || 0)));
            const data = await secureApiPost(`${apiUrl}/api/mpesa/stkpush`, {
                phoneNumber: memberPhone,
                amount: requestAmount,
                userId: activeUserId,
                leagueId: activeLeagueId
            });
            if (data.success) {
                showToast("STK Push sent! Awaiting M-Pesa PIN...", "success");
            } else {
                showToast(data.message || "Failed to initiate M-Pesa STK Push.", "error");
            }
        } catch (error) {
            console.error("STK Push Error:", error);
            const message = (error as any)?.message || '';
            if (/failed to fetch|networkerror|network error|load failed/i.test(message)) {
                showToast("Network Error: Could not reach payment server.", "error");
            } else {
                showToast(`Top-up failed: ${message || 'Unknown error'}`, "error");
            }
        } finally {
            setIsPushingMpesa(false);
            setIsSubmittingTopUp(false);
        }
    };

    const handleRequestWalletCredit = async () => {
        if (!activeLeagueId || !currentUser) return;

        const amount = Math.max(1, Math.floor(Number(topUpAmount || 0)));
        if (amount <= 0) {
            showToast('Enter a valid amount before sending the request.', 'error');
            return;
        }

        setIsRequestingWalletCredit(true);
        try {
            await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
                type: 'info',
                message: `${currentUser?.displayName || 'Member'} requested KES ${amount.toLocaleString()} wallet credit${topUpNote.trim() ? ` — ${topUpNote.trim()}` : ''}. Please credit the wallet from winnings or reconcile manually.`,
                timestamp: serverTimestamp(),
                readBy: [],
                targetMemberId: chairmanMember?.id || coAdminId || undefined
            });

            await addDoc(collection(db, 'leagues', activeLeagueId, 'wallet_topup_requests'), {
                memberId: currentUser?.id || activeUserIdStored || 'unknown',
                memberName: currentUser?.displayName || 'Member',
                amount,
                note: topUpNote.trim() || null,
                status: 'pending',
                source: 'winnings_request',
                requestedAt: serverTimestamp(),
                requestedById: currentUser?.id || activeUserIdStored || 'unknown',
                requestedByName: currentUser?.displayName || 'Member',
                targetMemberId: chairmanMember?.id || coAdminId || null
            });

            showToast('Wallet credit request sent to the Chairman.', 'success');
            setShowTopUpModal(false);
            setTopUpNote('');
        } catch (error: any) {
            console.error('Wallet credit request failed:', error);
            showToast(`Could not send request: ${error?.message || 'Unknown error'}`, 'error');
        } finally {
            setIsRequestingWalletCredit(false);
        }
    };

    // Module 3B: Submit a payment dispute
    const handleClaimPayment = async () => {
        if (!claimReceiptCode.trim() || !activeLeagueId || !currentUser) return;
        setIsSubmittingClaim(true);
        try {
            await addDoc(collection(db, 'leagues', activeLeagueId, 'disputes'), {
                memberId: currentUser?.id || activeUserIdStored || 'unknown',
                memberName: currentUser?.displayName || 'Member',
                phone: currentUser?.phone || memberPhone || '',
                receiptCode: claimReceiptCode.trim().toUpperCase(),
                amount: gameweekStake,
                status: 'pending',
                timestamp: serverTimestamp()
            });
            setClaimSubmitted(true);
            setTimeout(() => { setShowClaimModal(false); setClaimSubmitted(false); setClaimReceiptCode(''); }, 3000);
        } catch (err: any) {
            console.error('Claim submit error:', err);
            if (err?.code === 'permission-denied') {
                showToast('🔒 Permission Denied: Could not submit claim.', 'error');
            }
        } finally {
            setIsSubmittingClaim(false);
        }
    };

    const handleNudge = async () => {
        if (!activeLeagueId) return;
        if (!payoutApproverId) {
            showToast('No Co-Chair assigned. Chairman executes payouts directly.', 'info');
            return;
        }
        
        const history = JSON.parse(localStorage.getItem(`nudge_${activeLeagueId}`) || "[]");
        if (history.length >= 3) {
            showToast('Maximum 3 nudges reached for this payout.', 'error');
            return;
        }
        
        const cooldowns = [0, 60000, 600000, 36000000]; // 0m, 1m, 10m, 10h
        const currentCooldown = cooldowns[history.length];
        
        if (history.length > 0) {
            const timePassed = Date.now() - history[history.length - 1];
            if (timePassed < currentCooldown) {
                const rem = currentCooldown - timePassed;
                const remainingStr = rem < 60000 ? `${Math.ceil(rem/1000)}s` : 
                                     rem < 3600000 ? `${Math.ceil(rem/60000)}m` : 
                                     `${Math.ceil(rem/3600000)}h`;
                showToast(`Cooldown active. Wait ${remainingStr} before nudging again.`, 'error');
                return;
            }
        }

        const newHistory = [...history, Date.now()];
        localStorage.setItem(`nudge_${activeLeagueId}`, JSON.stringify(newHistory));
        setNudgeSent(true); 
        
        await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
            type: 'warning',
            message: `🔔 The members are nudging the Co-Chair to approve the pending payout (${newHistory.length}/3)! Please review ASAP.`,
            timestamp: serverTimestamp(),
            readBy: [],
            targetMemberId: payoutApproverId
        });
        showToast('Nudge sent! The Co-Chair has been notified.', 'success');
        
        setTimeout(() => setNudgeSent(false), 2000);
    };

    // Co-Chair: Approve Payout
    const handleApprovePayout = async (payout: any) => {
        if (!activeLeagueId) return;
        setIsApprovingPayout(payout.id);
        try {
            const payoutApiUrl = getApiBaseUrl();
            if (!payoutApiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
            const data = await secureApiPost(`${payoutApiUrl}/api/mpesa/b2c`, {
                phone: payout.winnerPhone,
                amount: payout.amount,
                winnerName: payout.winnerName,
                remarks: `FantasyChama GW${payout.gw} Approved Payout`,
                userId: payout.winnerId,
                leagueId: activeLeagueId
            });
            if (!data.success) throw new Error(data.message);

            await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payout.id), {
                status: 'approved',
                approvedBy: currentUser?.displayName || 'Co-Chair',
                approvedAt: serverTimestamp()
            });

            // Reset all members to Red Zone
            const membershipsRef = collection(db, 'leagues', activeLeagueId, 'memberships');
            await Promise.all(members.map(m => updateDoc(doc(membershipsRef, m.id), { hasPaid: false })));

            showToast(`✅ Approved! KES ${payout.amount.toLocaleString()} dispatched to ${payout.winnerName}.`);
        } catch (err: any) {
            showToast(`Approval failed: ${err.message}`, 'error');
        } finally {
            setIsApprovingPayout(null);
        }
    };

    const handleRejectPayout = async (payoutId: string) => {
        if (!activeLeagueId) return;
        await updateDoc(doc(db, 'leagues', activeLeagueId, 'pending_payouts', payoutId), {
            status: 'rejected',
            rejectedBy: currentUser?.displayName || 'Co-Chair',
            rejectedAt: serverTimestamp()
        });
        showToast('Payout request rejected. Chairman will be notified.');
    };

    const generateWhatsAppReceipt = (payout: any) => {
        const unpaidCount = members.filter(m => !m.hasPaid && m.role !== 'admin' && m.isActive !== false).length;
        const appUrl = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : (import.meta.env.VITE_APP_URL || 'https://fantasychama.vercel.app');
        const method = payout.method === 'cash' ? 'Cash Handoff 💵' : 'M-Pesa ✅';

        const message = [
            `🏆 *${leagueName.toUpperCase()} — GW${payout.gw} WINNER'S PODIUM* 🚨`,
            ``,
            `🥇 Mwizi wa points this week is *${payout.winnerName}* na *${payout.points} pts*! 👑`,
            `💰 Payout: *KES ${Number(payout.amount).toLocaleString()}* imetumwa safi via ${method}.`,
            ``,
            `👏 Wengine poleni kwa mshtuko wa moyo! Alama zilikataa lakini weekend ijayo kimeumana tena! 🏃‍♂️💨`,
            ``,
            unpaidCount > 0
                ? `⚠️ *RED ZONE CALLOUT*: Kuna watu ${unpaidCount} bado hawajatuma kakitu. Treasurer halali na pochi haina huruma kabla deadline!`
                : `✅ Watu wote wako funded kishujaa. Hatutaki vilio deadline ikipita!`,
            ``,
            `📊 Angalia live table & wallet yako:`,
            `👉 ${appUrl}/dashboard`,
        ].join('\n');

        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    };


    // Module 4A: Confirm receipt
    const handleConfirmWinnings = async () => {
        if (!activeLeagueId || !winnerConfirmation) return;
        try {
            await updateDoc(doc(db, 'leagues', activeLeagueId, 'winner_confirmations', winnerConfirmation.id), {
                status: 'confirmed'
            });
            showToast('✅ Payout confirmed! Thank you.', 'success');
        } catch (err: any) {
            console.error('Confirm error:', err);
            if (err?.code === 'permission-denied') {
                showToast('🔒 Permission Denied: You can only confirm your own payout.', 'error');
            }
        }
    };

    const handleSendReaction = async (emoji: string) => {
        if (!activeLeagueId || !gwWinner) return;

        // Check if user has already sent 2 distinct emojis
        if (mySentEmojis.length >= 2 && !mySentEmojis.includes(emoji)) {
            showToast('You can only send up to 2 props per gameweek!', 'error');
            return;
        }

        haptics.celebrate();
        try {
            confetti({
                particleCount: 40,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FBBF24', '#10B981', '#F59E0B', '#FFFFFF']
            });
        } catch (_c) {}
        setActiveReactionAnim({ emoji, isExiting: false });
        setTimeout(() => {
            setActiveReactionAnim(prev => prev ? { ...prev, isExiting: true } : null);
        }, 1600);
        setTimeout(() => {
            setActiveReactionAnim(null);
        }, 2200);

        const winnerFirstName = (gwWinner.player_name || 'Champion').split(' ')[0];
        const senderName = currentUser?.displayName || 'Member';

        try {
            const notifRef = collection(db, 'leagues', activeLeagueId, 'notifications');
            await addDoc(notifRef, {
                type: 'champion_reaction',
                emoji,
                message: `${senderName} sent ${emoji} props to ${winnerFirstName} for GW${currentFplEvent?.id || ''}!`,
                fromName: senderName,
                fromId: activeUserId,
                toWinner: gwWinner.player_name,
                winnerId: gwWinner.id || null,
                gw: currentFplEvent?.id || null,
                timestamp: serverTimestamp(),
                readBy: [activeUserId],
            });

            if (role === 'admin') {
                const eventsRef = collection(db, 'leagues', activeLeagueId, 'league_events');
                addDoc(eventsRef, {
                    type: 'champion_reaction',
                    eventType: 'reaction',
                    emoji,
                    message: `${senderName} reacted with ${emoji} to ${winnerFirstName}`,
                    actor: senderName,
                    toWinner: gwWinner.player_name,
                    gw: currentFplEvent?.id || null,
                    timestamp: serverTimestamp(),
                }).catch(() => {});
            }

            showToast(`Sent ${emoji} props to ${winnerFirstName}!`, 'success');
        } catch (err) {
            console.warn('[reaction] could not save:', err);
            showToast(`Sent ${emoji} props to ${winnerFirstName}!`, 'success');
        }
    };

    // Module 4A: Listen for pending winner confirmations for this user
    useEffect(() => {
        if (!activeLeagueId || !currentUser?.id) return;
        const q = query(
            collection(db, 'leagues', activeLeagueId, 'winner_confirmations'),
            where('winnerId', '==', currentUser.id),
            where('status', '==', 'pending_confirmation')
        );
        const unsub = onSnapshot(q, snap => {
            if (!snap.empty) setWinnerConfirmation({ id: snap.docs[0].id, ...snap.docs[0].data() });
            else setWinnerConfirmation(null);
        }, (error) => {
            console.warn('[member-dashboard] winner confirmations listener failed:', error?.message || error);
            setWinnerConfirmation(null);
        });
        return () => unsub();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeLeagueId, currentUser?.id]);

    // Dynamic Calculations
    const isMemberFunded = (m: any) => Boolean((m.hasPaid || (gameweekStake > 0 && Number(m.walletBalance || 0) >= gameweekStake)) && m.isActive !== false && !(m as any).isEliminated && !(m as any).isPending);
    const paidMembersCount = members.filter(isMemberFunded).length;
    const totalCollected = paidMembersCount * gameweekStake;
    const weeklyPot = totalCollected * (rules.weekly / 100);

    // Count-up animated values for wallet
    const animatedWalletBalance = useCountUp(walletBalance, 700);

    // Clamp leagueStartGw to currentEvent so DB drift (e.g. DB=6, actual=5) never makes the current GW pre-league
    const effectiveMdStartGw = currentFplEvent?.id ? Math.min(leagueStartGw, currentFplEvent.id) : leagueStartGw;
    const isPreLeagueGw = Boolean(currentFplEvent?.id && leagueStartGw > 1 && currentFplEvent.id < effectiveMdStartGw);

    // Season vault: use actual GWs remaining since league start (GW38 - effectiveStart + 1)
    const totalLeagueGws = Math.max(1, 38 - effectiveMdStartGw + 1);
    const vaultPercent = Number(rules.vault ?? (100 - rules.weekly));
    const vaultMultiplier = (vaultPercent > 0 ? vaultPercent : 30) / 100;
    const activeContendersCount = members.filter(m => m.isActive !== false && !(m as any).isEliminated && !(m as any).isPending).length;
    const seasonVaultProjected = activeContendersCount * gameweekStake * totalLeagueGws * vaultMultiplier;

    // Actual accumulated season vault to date (net of any reversals/refunds)
    const isTxValidInflow = (tx: any) => {
        const type = String(tx.type || '').toLowerCase();
        const isContributionType = type === 'deposit' || type === 'payment' || type === 'contribution' || type === 'wallet_funding' || type === 'wallet_prefund' || type === 'manual_deposit' || (type === 'ledger_adjustment' && Number(tx.amount || 0) > 0 && tx.source !== 'manual_reversal');
        if (!isContributionType) return false;
        if (tx.source === 'manual_reversal') return false;
        if (Number(tx.amount || 0) <= 0) return false;
        const status = String(tx.status || '').toLowerCase();
        if (status === 'reversed' || status === 'failed' || status === 'cancelled' || status === 'voided' || status === 'refunded' || tx.isReversed === true || tx.reversed === true) {
            return false;
        }
        return true;
    };
    const isTxRefundOrReversal = (tx: any) => {
        const type = String(tx.type || '').toLowerCase();
        const status = String(tx.status || '').toLowerCase();
        return (
            type === 'refund' ||
            type === 'reversal' ||
            tx.source === 'manual_reversal' ||
            tx.category === 'refund' ||
            status === 'refund' ||
            status === 'refunded' ||
            (type === 'ledger_adjustment' && (tx.source === 'manual_reversal' || Number(tx.amount || 0) < 0)) ||
            Number(tx.amount || 0) < 0
        );
    };
    const grossInflows = (transactions || [])
        .filter(isTxValidInflow)
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
    const totalRefunds = (transactions || [])
        .filter(isTxRefundOrReversal)
        .reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount || 0)), 0);
    const netCollectedSoFar = Math.max(0, grossInflows - totalRefunds);
    const seasonVaultFromTxs = Math.round(netCollectedSoFar * vaultMultiplier);

    const completedRounds = currentFplEvent?.id 
        ? Math.max(0, (currentFplEvent.finished ? currentFplEvent.id : currentFplEvent.id - 1) - effectiveMdStartGw + 1)
        : 0;
    const maxVaultForCompleted = completedRounds * paidMembersCount * gameweekStake * vaultMultiplier;
    const fallbackVaultAccumulated = maxVaultForCompleted;
    const seasonVaultAccumulated = completedRounds > 0
        ? (seasonVaultFromTxs > 0 ? Math.min(maxVaultForCompleted, seasonVaultFromTxs) : fallbackVaultAccumulated)
        : (seasonVaultFromTxs > 0 ? Math.min(paidMembersCount * gameweekStake * vaultMultiplier, seasonVaultFromTxs) : fallbackVaultAccumulated);

    // Upcoming GW Funding Status (Red Zone)
    const isTargetGwUpcoming = Boolean(currentFplEvent?.finished || currentFplEvent?.isPreparingForNextGw);
    const activeFundingGw = isTargetGwUpcoming 
        ? (currentFplEvent?.nextId || (currentFplEvent?.id ? currentFplEvent.id + 1 : 1))
        : (currentFplEvent?.id || 1);

    // If target GW is upcoming, funds must cover the upcoming round beyond any already completed rounds
    const hasPaidUpcoming = (walletBalance >= 2 * gameweekStake) || (!currentUser?.hasPaid && walletBalance >= gameweekStake);
    const isCurrentFunded = isTargetGwUpcoming ? hasPaidUpcoming : hasPaid;

    // Dynamic Winner calculation:
    // A gameweek is only voided if active funded participants < 2 AND voided in governance
    const fundedMembersCount = members.filter(m => (m.hasPaid || (Number(m.walletBalance || 0) >= gameweekStake)) && m.isActive !== false && !(m as any).isEliminated).length;
    const isCurrentGwVoided = Boolean(
        fundedMembersCount < 2 &&
        notifications.some((n: any) => n.eventType === 'gw_voided' && Number(n.gw || n.gameweek) === Number(currentFplEvent?.id))
    );

    const payoutDestinationPhone = chairmanPhone || members.find(m => m.role === 'admin' || (m as any).role === 'chairman')?.phone || 'Chairman Number';
    const hasDualTeam = Boolean(currentUser?.secondFplTeamId);

    const dismissLeagueGuide = () => {
        if (!activeLeagueId) return;
        const guideKey = `fc-member-league-guide-dismissed-${activeLeagueId}-${activeUserId}`;
        localStorage.setItem(guideKey, 'true');
        setShowLeagueGuide(false);
    };

    // Phase 30: Is the logged-in user the current GW Winner?
    const isCurrentUserGwWinner = Boolean(
        !isCurrentGwVoided &&
        gwWinner &&
        Number(gwWinner.event_total) > 0 &&
        currentUser && (
            (currentUser.fplTeamId && Number(currentUser.fplTeamId) === Number(gwWinner.entry)) ||
            (currentUser.secondFplTeamId && Number(currentUser.secondFplTeamId) === Number(gwWinner.entry)) ||
            currentUser.displayName?.toLowerCase().includes(gwWinner.player_name?.toLowerCase()) ||
            gwWinner.player_name?.toLowerCase().includes(currentUser.displayName?.toLowerCase())
        )
    );
    const hasFinalGwChampion = Boolean(
        !isPreLeagueGw &&
        !isCurrentGwVoided &&
        !currentFplEvent?.isPreparingForNextGw &&
        currentFplEvent?.finished &&
        gwWinner &&
        Number(gwWinner.event_total) > 0
    );
    const isRecentWinner = isCurrentUserGwWinner && hasFinalGwChampion;

    // GW score / rank for the greeting card chip (derived from fplStandings so no extra fetch)
    const myFplStandingsEntry = fplStandings.length > 0
        ? fplStandings.find((e: any) =>
            (currentUser?.fplTeamId && Number(e.entry) === Number(currentUser.fplTeamId)) ||
            (currentUser?.secondFplTeamId && Number(e.entry) === Number(currentUser.secondFplTeamId)) ||
            currentUser?.displayName?.toLowerCase().includes(e.player_name?.toLowerCase())
          )
        : null;
    const myGwScore = myFplStandingsEntry ? Number(myFplStandingsEntry.event_total ?? 0) : null;
    const myGwRank = myFplStandingsEntry
        ? fplStandings.findIndex((e: any) => e.entry === myFplStandingsEntry.entry) + 1
        : null;
    const completedLeagueGws = Math.max(0, completedRounds);
    const seasonProgressPct = totalLeagueGws > 0 ? Math.round((completedLeagueGws / totalLeagueGws) * 100) : 0;

    // Set of distinct emojis already sent by the current user for this gameweek (max 2 distinct allowed)
    const mySentEmojis = useMemo<string[]>(() => {
        const targetGw = Number(currentFplEvent?.id);
        const sent = new Set<string>();
        notifications.forEach((n: any) => {
            if (
                (n.type === 'champion_reaction' || n.eventType === 'reaction') &&
                (!n.gw || Number(n.gw) === targetGw) &&
                (n.fromId === activeUserId || (currentUser?.displayName && n.fromName === currentUser.displayName))
            ) {
                if (n.emoji) sent.add(n.emoji);
            }
        });
        return Array.from(sent);
    }, [notifications, currentFplEvent?.id, activeUserId, currentUser?.displayName]);

    // Aggregate real-time reactions for this GW champion (WhatsApp/iMessage style)
    interface ChampionReactionSummary {
        emoji: string;
        count: number;
        senders: string[];
        hasReacted: boolean;
    }

    const gwChampionReactions = useMemo<ChampionReactionSummary[]>(() => {
        const targetGw = Number(currentFplEvent?.id);
        const reactions = notifications.filter((n: any) => 
            (n.type === 'champion_reaction' || n.eventType === 'reaction') && 
            (!n.gw || Number(n.gw) === targetGw)
        );

        const map = new Map<string, { count: number; senders: string[]; hasReacted: boolean }>();
        reactions.forEach((r: any) => {
            const emoji = r.emoji;
            if (!emoji) return;
            const entry = map.get(emoji) || { count: 0, senders: [], hasReacted: false };
            entry.count += 1;
            if (r.fromName && !entry.senders.includes(r.fromName)) {
                entry.senders.push(r.fromName);
            }
            if (r.fromId === activeUserId || (currentUser?.displayName && r.fromName === currentUser.displayName)) {
                entry.hasReacted = true;
            }
            map.set(emoji, entry);
        });

        return Array.from(map.entries()).map(([emoji, data]) => ({
            emoji,
            ...data
        })).sort((a, b) => b.count - a.count);
    }, [notifications, currentFplEvent?.id, activeUserId, currentUser?.displayName]);

    // Trigger celebratory confetti for the GW winner
    useEffect(() => {
        if (isCurrentUserGwWinner) {
            haptics.celebrate();
            import('canvas-confetti').then((module) => {
                const confetti = module.default;
                confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#FBBF24', '#10B981', '#F59E0B', '#FFFFFF'],
                });
            }).catch(() => {});
        }
    }, [isCurrentUserGwWinner]);



    // Greeting for member header
    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };
    const greetingText = getGreeting();
    const firstName = (currentUser?.displayName || 'Manager').split(' ')[0];
    const currentGwBadge = currentFplEvent
        ? `GW ${currentFplEvent.id} ${currentFplEvent.finished ? 'Complete' : 'Live'}`
        : gwWinner?.event
            ? `GW ${gwWinner.event} Active`
            : 'GW Active';
    /* const ledgerMembers = [...members].sort((a, b) => {
        if (!!a.hasPaid !== !!b.hasPaid) return a.hasPaid ? 1 : -1; // Red Zone first
        if (a.id === currentUser?.id) return -1;
        if (b.id === currentUser?.id) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
    }); */

    // FAB actions are now rendered via FloatingActionBubble component

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className={clsx(
            "fc-member-dashboard min-h-[100dvh] text-slate-900 dark:text-white flex flex-col font-sans relative pb-6 w-full overflow-x-hidden bg-slate-50 dark:bg-[#0b1014] transition-colors duration-300",
            isSuspended ? "overflow-hidden h-screen" : ""
        )}>
            {/* Constitution first-login modal */}
            <LeagueRulesModal
                isOpen={showRulesModal}
                onClose={() => {
                    sessionStorage.removeItem('fc_show_constitution_onboarded');
                    if (location.state?.showConstitution) {
                        try {
                            window.history.replaceState({ ...location.state, showConstitution: false }, document.title);
                        } catch {}
                    }
                    if (activeLeagueId) {
                        try {
                            localStorage.setItem(`fc_rules_accepted_${activeLeagueId}`, 'true');
                            localStorage.setItem(`fc_constitution_dismissed_${activeLeagueId}`, 'true');
                            localStorage.setItem('fc_constitution_dismissed', 'true');
                        } catch {}
                    }
                    setShowRulesModal(false);
                }}
                currentMember={currentUser}
                leagueName={leagueName}
                chairmanName={members.find(m => (m as any).role === 'admin')?.displayName}
            />

            {/* Champion WhatsApp Flex Card Modal */}
            <ChampionFlexCardModal
                isOpen={showFlexModal}
                onClose={() => setShowFlexModal(false)}
                winnerName={gwWinner?.player_name || currentUser?.displayName || firstName || 'Champion'}
                teamName={gwWinner?.entry_name || (currentUser?.fplTeamId ? `Team ${currentUser.fplTeamId}` : undefined)}
                points={gwWinner?.event_total || 0}
                gameweek={gwWinner?.event || currentFplEvent?.id || ''}
                amountWon={Math.round((members.filter(m => m.hasPaid && m.isActive !== false).length * gameweekStake) * (rules.weekly / 100))}
                leagueName={leagueName}
                leagueCode={(leagueSettings as any)?.code || ''}
            />

            {/* Phase 40: HQ Suspension Lockout Overlay */}
            {isSuspended && (
                <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden">
                    <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(239,68,68,0.05) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
                    <div className="w-full max-w-md bg-[#0b1014]/90 border-2 border-red-500/50 rounded-3xl p-8 text-center shadow-[0_0_80px_rgba(239,68,68,0.2)] flex flex-col items-center gap-6 relative z-10 animate-in zoom-in-95 duration-500">
                        <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/30 rounded-full flex flex-col items-center justify-center">
                            <AlertOctagon className="w-10 h-10 text-red-500 animate-bounce" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">League Suspended</h2>
                            <p className="text-sm text-gray-400 max-w-sm">
                                The Chairman's platform subscription requires settlement. Once resolved, standard gameweek gameplay will instantly resume.
                            </p>
                        </div>
                        <div className="w-full flex flex-col gap-3 mt-2">
                            <button
                                onClick={handleNudgeHQ}
                                disabled={isNudgingHQ}
                                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                <Bell className="w-4 h-4" />
                                {isNudgingHQ ? "Reminding..." : "Remind Chairman"}
                            </button>
                            <button 
                                onClick={() => {
                                    try { logout(); } catch {}
                                    window.location.href = '/login';
                                }}
                                className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={clsx("transition-all duration-700 w-full flex-1 flex flex-col", isSuspended ? "blur-xl opacity-30 pointer-events-none select-none scale-[0.98]" : "")}>

            {/* Subtle Top Ambient Glow for GW Winner */}
            {isCurrentUserGwWinner && (
                <div className="fixed inset-0 pointer-events-none z-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#FBBF24] blur-[220px] opacity-[0.05]"></div>
                </div>
            )}

            {/* Quick Reaction Floating Animation Burst */}
            {activeReactionAnim && (
                <div className={clsx(
                    "fixed inset-0 pointer-events-none z-[100] flex items-center justify-center overflow-hidden transition-all duration-500 ease-out",
                    activeReactionAnim.isExiting ? "opacity-0 -translate-y-16 scale-125" : "opacity-100 translate-y-0 scale-100"
                )}>
                    <div className="relative flex flex-col items-center animate-in zoom-in-75 duration-300">
                        <div className="text-8xl md:text-9xl animate-bounce drop-shadow-[0_0_50px_rgba(251,191,36,0.9)] select-none">
                            {activeReactionAnim.emoji}
                        </div>
                        <div className="absolute -top-10 -left-10 text-4xl animate-ping opacity-75">{activeReactionAnim.emoji}</div>
                        <div className="absolute -top-14 right-6 text-5xl animate-bounce opacity-85">{activeReactionAnim.emoji}</div>
                        <div className="absolute top-14 -right-10 text-4xl animate-pulse opacity-75">{activeReactionAnim.emoji}</div>
                        <div className="mt-4 px-4 py-1.5 rounded-full bg-black/85 border border-amber-400/50 backdrop-blur-md text-amber-300 text-xs font-black uppercase tracking-widest shadow-2xl">
                            Props Sent! ✓
                        </div>
                    </div>
                </div>
            )}
            {/* Background Element — Neutral subtle lines */}
            <div className="fixed right-[-10%] bottom-[-10%] w-[600px] h-[600px] opacity-15 pointer-events-none z-0">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <path fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" d="M10,100 L190,100 M100,10 L100,190 M30,30 L170,170 M30,170 L170,30" />
                    <circle cx="10" cy="100" r="1.5" fill="rgba(255,255,255,0.2)" />
                    <circle cx="190" cy="100" r="1.5" fill="rgba(255,255,255,0.2)" />
                    <circle cx="100" cy="10" r="1.5" fill="rgba(255,255,255,0.2)" />
                    <circle cx="100" cy="190" r="1.5" fill="rgba(255,255,255,0.2)" />
                    <circle cx="100" cy="100" r="3" fill="rgba(255,255,255,0.3)" />
                </svg>
            </div>

            {/* Toast Notification */}
            <div className={clsx(
                "fixed top-4 right-4 left-4 sm:left-auto max-w-[calc(100vw-2rem)] sm:max-w-md px-5 py-3 rounded-2xl text-[13px] font-bold flex items-center gap-3 transition-all duration-500 pointer-events-none z-[9999] shadow-[0_20px_50px_rgba(0,0,0,0.5)] fc-inline-toast",
                toastMessage ? "opacity-100 translate-y-0 scale-100 visible" : "opacity-0 -translate-y-2 scale-95 invisible",
                toastType === 'error'
                    ? "fc-inline-toast-error"
                    : toastType === 'info'
                        ? "fc-inline-toast-info"
                        : "fc-inline-toast-success"
            )}>
                {toastType === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                )}
                {toastMessage}
            </div>

            {/* Top Navigation Frame */}
            <div className="fc-member-top-rail pt-2 md:pt-4 px-4 md:px-8 w-full max-w-6xl mx-auto space-y-3">
                <Header
                    role="member"
                    title={leagueName || 'The Big League'}
                    subtitle="Member Hub"
                    hideExtraControls={true}
                />

                {/* ── GREETING CARD — First thing member sees ── */}
                <section className={clsx(
                    "fc-card mt-3 mb-3 rounded-3xl border p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4",
                    isCurrentUserGwWinner
                        ? "border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24]"
                        : isSpectator
                            ? "border-indigo-500/25 bg-gradient-to-br from-indigo-500/8 via-white dark:via-[#0f1823] to-white dark:to-[#0f1823]"
                            : isCurrentFunded
                                ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-white dark:via-[#0f1823] to-white dark:to-[#0f1823]"
                                : "border-red-400/20 bg-gradient-to-br from-red-400/6 via-white dark:via-[#0f1823] to-white dark:to-[#0f1823]"
                )}>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400 mb-2">
                            {isSpectator ? 'Spectator Mode · Side-Bets Active' : (isCurrentFunded ? '✓ Contribution Secured' : 'Action Required')}
                        </p>
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl md:text-3xl">
                                {greetingText === 'Good morning' ? '🌅' : greetingText === 'Good afternoon' ? '☀️' : '🌙'}
                            </span>
                            <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                {greetingText},{' '}
                                <span className={clsx(
                                    "bg-clip-text text-transparent bg-gradient-to-r",
                                    isCurrentUserGwWinner ? "from-amber-500 to-yellow-400" : isSpectator ? "from-indigo-400 to-purple-400" : isCurrentFunded ? "from-emerald-500 to-emerald-400" : "from-rose-500 to-red-400"
                                )}>
                                    {firstName}!
                                </span>
                            </p>
                        </div>
                        {!isCurrentFunded && !isSpectator && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Pay KES {gameweekStake.toLocaleString()} via M-Pesa to stay eligible.
                            </p>
                        )}
                        {/* 2A: GW Score chip — shown once the GW is confirmed finished */}
                        {myGwScore !== null && myGwScore > 0 && currentFplEvent?.finished && !isCurrentUserGwWinner && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border bg-slate-800/60 border-white/10 text-slate-200 shadow-sm">
                                    <span className="text-slate-400">GW{currentFplEvent.id}</span>
                                    <span className="text-white">{myGwScore} pts</span>
                                    {myGwRank !== null && (
                                        <span className={clsx(
                                            "px-1.5 py-0.5 rounded-md text-[9px] font-black",
                                            myGwRank === 1 ? "bg-amber-400/20 text-amber-400" :
                                            myGwRank <= 3 ? "bg-emerald-500/20 text-emerald-400" :
                                            "bg-slate-700/50 text-slate-400"
                                        )}>
                                            {myGwRank === 1 ? '🥇 1st' : myGwRank === 2 ? '🥈 2nd' : myGwRank === 3 ? '🥉 3rd' : `#${myGwRank}`}
                                        </span>
                                    )}
                                </span>
                            </div>
                        )}
                        {/* Feature E: Season progress bar */}
                        {completedLeagueGws > 0 && totalLeagueGws > 0 && (
                            <div className="mt-3 w-full max-w-xs">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">Season Progress</span>
                                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-500 tabular-nums">
                                        GW{effectiveMdStartGw + completedLeagueGws - 1} of GW38 · {seasonProgressPct}%
                                    </span>
                                </div>
                                <div className="h-1 w-full rounded-full bg-slate-800/60 dark:bg-white/8 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
                                        style={{ width: `${seasonProgressPct}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx(
                            "text-[11px] font-bold uppercase tracking-widest border px-3 py-1 rounded-full w-fit",
                            isCurrentFunded
                                ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300 bg-emerald-500/10"
                                : "border-red-500/30 text-red-500 dark:text-red-300 bg-red-500/10"
                        )}>
                            {currentGwBadge}
                        </span>
                        {!isCurrentFunded && !isSpectator && (
                            <button
                                onClick={() => handleMpesaSTKPush(gameweekStake)}
                                disabled={isPushingMpesa}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-50 transition-all active:scale-95 shadow-md"
                            >
                                {isPushingMpesa ? 'Sending...' : 'Pay Now'}
                            </button>
                        )}
                    </div>
                </section>

                {/* Phase 30: GW Champion Crowned Celebration (Right after Greeting) */}
                {hasFinalGwChampion && gwWinner ? (
                    isCurrentUserGwWinner ? (
                        <div className="w-full rounded-[2rem] border-2 border-[#FBBF24]/50 bg-gradient-to-r from-[#FBBF24]/15 via-[#F59E0B]/10 to-[#FBBF24]/15 px-6 py-5 flex flex-col sm:flex-row items-center gap-5 animate-in zoom-in-95 duration-700 shadow-[0_0_40px_rgba(251,191,36,0.15)] relative overflow-hidden mb-3">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-[#FBBF24] blur-[120px] opacity-10 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#F59E0B] blur-[80px] opacity-10 pointer-events-none"></div>
                            <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-[#FBBF24] to-[#B45309] p-[3px] shadow-[0_0_30px_rgba(251,191,36,0.3)] flex-shrink-0 animate-pulse">
                                <div className="w-full h-full bg-[#0b1014] rounded-full flex items-center justify-center">
                                    <Trophy className="w-9 h-9 text-[#FBBF24]" />
                                </div>
                            </div>
                            <div className="relative z-10 text-center sm:text-left flex-1">
                                <p className="text-[10px] font-black text-[#FBBF24] uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5 justify-center sm:justify-start">
                                    <Star className="w-3 h-3 fill-current" /> You Are This Gameweek's Champion!
                                </p>
                                <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">
                                    Congratulations, {firstName}!
                                </h3>
                                <p className="fc-gw-winner-subline text-sm font-bold text-gray-200 mt-1">
                                    You scored <span className="text-[#10B981] font-black">{gwWinner.event_total} pts</span> — the highest in the league this week.
                                </p>
                                {/* WhatsApp/iMessage Received Reaction Badges for Winner */}
                                {gwChampionReactions.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mr-1">Props Received:</span>
                                        {gwChampionReactions.map(({ emoji, count, senders }) => (
                                            <span
                                                key={emoji}
                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-400/50 text-amber-200 shadow-sm"
                                                title={`Sent by: ${senders.join(', ')}`}
                                            >
                                                <span className="text-sm leading-none">{emoji}</span>
                                                <span className="text-[11px] font-black tabular-nums">{count}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="fc-win-payout-card relative z-10 p-4 rounded-2xl text-center flex-shrink-0">
                                <p className="text-[9px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-1">Your Payout</p>
                                <p className="text-2xl font-black text-[#FBBF24] tabular-nums">KES {((members.filter(m => m.hasPaid && m.isActive !== false).length * gameweekStake) * (rules.weekly / 100)).toLocaleString()}</p>
                            </div>
                            {/* Phase 8: Flex on WhatsApp */}
                            <button
                                onClick={() => {
                                    haptics.celebrate();
                                    setShowFlexModal(true);
                                }}
                                className="fc-share-win-btn relative z-10 flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-xl transition-all duration-300 ease-out active:scale-95 shadow-lg shadow-amber-950/40"
                            >
                                🏆 Victory Card
                            </button>
                        </div>
                    ) : (
                        <div className="w-full rounded-[2rem] border border-amber-500/30 bg-gradient-to-br from-[#1b170c] via-[#161d24] to-[#0c1218] p-5 md:p-6 shadow-2xl relative overflow-hidden mb-3">
                            <div className="absolute top-0 right-0 w-80 h-40 bg-[#FBBF24]/10 blur-[100px] pointer-events-none" />
                            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_24px_rgba(251,191,36,0.2)]">
                                        <Trophy className="w-7 h-7 md:w-8 md:h-8 text-[#FBBF24]" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FBBF24] flex items-center gap-1">
                                                <Star className="w-3 h-3 fill-[#FBBF24]" /> GW {currentFplEvent?.id || ''} Champion Crowned
                                            </span>
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-black text-white leading-tight mt-0.5">
                                            {gwWinner.player_name} <span className="text-sm font-bold text-gray-400">({gwWinner.entry_name || 'Champion'})</span>
                                        </h3>
                                        <p className="text-xs text-slate-300 mt-1">
                                            Clinched the pot with <span className="text-[#10B981] font-black">{gwWinner.event_total} pts</span>
                                            {gwWinner.leadMargin ? ` (+${gwWinner.leadMargin} pts ahead)` : ''} · Payout Yielded: <span className="text-[#FBBF24] font-black">KES {((members.filter(m => m.hasPaid && m.isActive !== false).length * gameweekStake) * (rules.weekly / 100)).toLocaleString()}</span>
                                        </p>
                                        {/* WhatsApp / iMessage Style Reaction Badges */}
                                        {gwChampionReactions.length > 0 && (
                                            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                                                {gwChampionReactions.map(({ emoji, count, senders, hasReacted }) => (
                                                    <span
                                                        key={emoji}
                                                        className={clsx(
                                                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all shadow-sm select-none",
                                                            hasReacted
                                                                ? "bg-amber-500/30 border border-amber-400 text-amber-200 ring-1 ring-amber-400/50 scale-105"
                                                                : "bg-white/10 border border-white/10 text-gray-200"
                                                        )}
                                                        title={`Reacted by: ${senders.join(', ')}`}
                                                    >
                                                        <span className="text-sm leading-none">{emoji}</span>
                                                        <span className="text-[11px] font-black tabular-nums">{count}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Quick Emoji Reactions to the Champion */}
                                {(() => {
                                    const isCurrentUserGwWinner = Boolean(
                                        (currentUser?.displayName && gwWinner?.player_name && currentUser.displayName.toLowerCase() === gwWinner.player_name.toLowerCase()) ||
                                        (((currentUser as any)?.fplTeamName || currentUser?.teamName) && gwWinner?.entry_name && ((currentUser as any)?.fplTeamName || currentUser?.teamName).toLowerCase() === gwWinner.entry_name.toLowerCase()) ||
                                        (currentUser?.fplTeamId && gwWinner?.entry && Number(currentUser.fplTeamId) === Number(gwWinner.entry)) ||
                                        (currentUser?.id && (gwWinner as any)?.memberId && currentUser.id === (gwWinner as any).memberId)
                                    );

                                    if (isCurrentUserGwWinner) {
                                        return (
                                            <div className="w-full lg:w-auto bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex flex-col items-center justify-center gap-1 flex-shrink-0">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                                                    👑 You are the GW {currentFplEvent?.id || ''} Champion!
                                                </p>
                                                <p className="text-[10px] text-gray-300 font-medium">Bask in the victory — pot secured & brag recorded.</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="w-full lg:w-auto bg-black/40 border border-white/10 rounded-2xl p-3 flex flex-col gap-2 flex-shrink-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
                                                    Send Props to {gwWinner.player_name.split(' ')[0]} 💬
                                                </p>
                                                <span className="text-[9px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 tabular-nums">
                                                    {mySentEmojis.length}/2 sent
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {['👏', '🐐', '🔥', '🥩', '🧂', '🫡'].map(emoji => {
                                                    const isSelected = mySentEmojis.includes(emoji);
                                                    const isLocked = mySentEmojis.length >= 2 && !isSelected;
                                                    return (
                                                        <button
                                                            key={emoji}
                                                            type="button"
                                                            disabled={isLocked}
                                                            onClick={() => handleSendReaction(emoji)}
                                                            className={clsx(
                                                                "relative w-10 h-10 rounded-xl border flex items-center justify-center text-lg transition-all shadow-sm select-none",
                                                                isSelected
                                                                    ? "bg-amber-500/30 border-amber-400 text-amber-300 ring-2 ring-amber-400/50 scale-105 cursor-pointer"
                                                                    : isLocked
                                                                    ? "bg-white/5 border-white/5 opacity-40 cursor-not-allowed"
                                                                    : "bg-white/5 hover:bg-amber-500/25 border-white/10 hover:border-amber-400/50 hover:scale-110 active:scale-90 cursor-pointer"
                                                            )}
                                                            title={isSelected ? `You sent ${emoji} (Sent ✓)` : isLocked ? 'Limit of 2 props reached' : `React with ${emoji}`}
                                                        >
                                                            {emoji}
                                                            {isSelected && (
                                                                <span className="absolute -top-1 -right-1 text-[8px] bg-emerald-500 text-black font-black rounded-full px-1 shadow-sm leading-tight">
                                                                    ✓
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )
                ) : gwWinner && !currentFplEvent?.finished ? (
                    <div className="fc-gw-live-banner w-full rounded-[2rem] border border-white/10 bg-[#161d24]/90 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-2xl shadow-black/30 mb-3">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-7 h-7 text-[#FBBF24]" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <p className="text-[10px] font-black text-[#FBBF24] uppercase tracking-[0.2em]">Gameweek still live</p>
                                <span className={clsx(
                                    "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                    gwWinner.leadMargin >= 15
                                        ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                                        : gwWinner.leadMargin >= 5
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                        : "bg-red-500/10 border-red-500/30 text-red-300 animate-pulse"
                                )}>
                                    {gwWinner.leadMargin >= 15 ? "Dominant" : gwWinner.leadMargin >= 5 ? "Contested ⚔️" : "Nail-Biter 🔥"}
                                </span>
                            </div>
                            <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">Champion banner is locked until FPL finishes this GW.</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Current standings are still moving, so the dashboard waits for the final whistle before naming a winner.</p>
                        </div>
                    </div>
                ) : null}

                {/* ── Active / Upcoming 1v1 Side Bet Banner (Below GW Champion) ── */}
                {activeUserSideBets && activeUserSideBets.length > 0 && (() => {
                    const bet = activeUserSideBets[0];
                    const isChallenger = bet.challenger?.id === currentUser?.id;
                    const rivalName = isChallenger ? bet.opponent?.displayName || 'Opponent' : bet.challenger?.displayName || 'Challenger';
                    const isActionRequired = !isChallenger && !bet.opponent?.signed;
                    
                    return (
                        <section className="mb-3 rounded-3xl border border-amber-500/35 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg backdrop-blur-md animate-in fade-in duration-300">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0 shadow-sm">
                                    <Swords className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">1v1 Side Bet Wager</span>
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">KES {bet.stake?.toLocaleString() || '500'} STAKE</span>
                                    </div>
                                    <h4 className="text-sm md:text-base font-black text-white truncate">
                                        vs {rivalName}: "{bet.terms?.title || bet.terms?.description || 'Custom Wager'}"
                                    </h4>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {bet.status === 'active'
                                            ? '🔥 Match is live! Highest score takes the bag.'
                                            : isActionRequired
                                                ? '⚠️ You have been challenged! Review and accept before deadline.'
                                                : '⏳ Awaiting Chairman approval / opponent signature.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <button
                                    onClick={() => navigate('/sidebets')}
                                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0a0e17] font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>{isActionRequired ? 'Review & Accept' : 'View Wagers'}</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </section>
                    );
                })()}

                {showLeagueGuide && (
                    <div className="rounded-2xl border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3.5 animate-in fade-in slide-in-from-top-1 duration-300 mb-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#10B981]">Two Teams Setup</p>
                            </div>
                            <button
                                type="button"
                                onClick={dismissLeagueGuide}
                                className="text-[10px] font-black uppercase tracking-widest text-[#10B981] hover:text-emerald-300 cursor-pointer"
                            >
                                Dismiss
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">League Context</p>
                                <p className="text-[11px] text-gray-200 mt-1 leading-relaxed">
                                    You are in <span className="font-black text-white">{userLeagueCount}</span> league{userLeagueCount > 1 ? 's' : ''}. Use the top switcher to choose which wallet and approvals you are viewing.
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Team Eligibility</p>
                                <p className="text-[11px] text-gray-200 mt-1 leading-relaxed">
                                    {hasDualTeam
                                        ? 'Your second FPL team is active for this league, and both teams can independently win a gameweek.'
                                        : 'Only one FPL team is attached to your profile here. Add a second team from profile if your chairman allows dual mode.'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                                <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Your Access</p>
                                <p className="text-[11px] text-gray-200 mt-1 leading-relaxed">
                                    Active role in this league: <span className="font-black text-[#FBBF24] capitalize">{activeLeagueRole}</span>.
                                    {activeLeagueRole === 'admin' || activeLeagueRole === 'co-chair' ? ' You can approve governance actions tied to this circle.' : ' Governance actions stay read-only in member mode.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                        {/* Phase 10.5: Action Required Banner — static, high-visibility, never a toast */}
                        {(currentUser && (winnerConfirmation || (!hasPaid && !isSpectator))) && (
                            <div className={clsx(
                                "w-full rounded-2xl border px-4 py-3 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300",
                                winnerConfirmation
                                    ? "bg-[#1c1a09] border-[#FBBF24]/40 shadow-[0_0_20px_rgba(251,191,36,0.1)]"
                                    : "bg-red-950/40 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.08)]"
                            )}>
                                <span className="text-xl flex-shrink-0">{winnerConfirmation ? '🏆' : '⚠️'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={clsx(
                                        "font-extrabold text-sm leading-tight",
                                        winnerConfirmation ? "text-[#FBBF24]" : "text-red-400"
                                    )}>
                                        {winnerConfirmation
                                            ? `ACTION REQUIRED: Confirm receipt of KES ${winnerConfirmation.amount?.toLocaleString()}`
                                            : 'ACTION REQUIRED: Pay before the FPL deadline'}
                                    </p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        {winnerConfirmation
                                            ? 'Tap below once you receive the funds in your M-Pesa'
                                            : `Your wallet balance is empty. Pay KES ${gameweekStake.toLocaleString()} to stay eligible.`}
                                    </p>
                                </div>
                                {winnerConfirmation && (
                                    <button
                                        onClick={handleConfirmWinnings}
                                        className="flex-shrink-0 bg-[#FBBF24] hover:bg-[#eab308] text-black text-xs font-black px-3 py-2 rounded-xl transition-colors"
                                    >
                                        Confirm ✓
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Spectator Mode Banner */}
                        {currentUser && isSpectator && (
                            <div className="w-full rounded-2xl border border-indigo-500/30 bg-indigo-950/20 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(99,102,241,0.08)] animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl flex-shrink-0">👁️</span>
                                    <div>
                                        <p className="font-extrabold text-sm text-indigo-400 dark:text-indigo-300 leading-tight">
                                            Spectator & Side-Bets Mode Active
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            You are not charged weekly pot stakes. You can challenge rivals to 1v1 M-Pesa side bets anytime!
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                        onClick={() => navigate('/sidebets')}
                                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-black hover:opacity-90 transition-all flex items-center gap-1.5"
                                    >
                                        <Swords className="w-3.5 h-3.5" /> Side Bets
                                    </button>
                                    <button
                                        onClick={handleUpgradeToPot}
                                        disabled={isUpgradingToPot}
                                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-black text-xs font-black transition-all flex items-center gap-1 disabled:opacity-50 shadow-md shadow-emerald-500/20 active:scale-95"
                                    >
                                        <Trophy className="w-3.5 h-3.5" />
                                        {walletBalance >= gameweekStake ? "Activate Pot" : "Fund & Join Pot 🏆"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── ARREARS WARNING BANNER — shows when member has missed GW payments ── */}
                        {currentUser && !isSpectator && (currentUser as any).missedGameweeks > 0 && (
                            <div className={clsx(
                                "w-full rounded-2xl border px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300",
                                (currentUser as any).missedGameweeks >= 2
                                    ? "border-red-500/40 bg-red-950/25 shadow-[0_0_20px_rgba(239,68,68,0.08)]"
                                    : "border-amber-500/35 bg-amber-950/20"
                            )}>
                                <div className="flex items-center gap-3">
                                    <span className={clsx(
                                        "text-xl flex-shrink-0",
                                        (currentUser as any).missedGameweeks >= 2 ? "animate-pulse" : ""
                                    )}>
                                        {(currentUser as any).missedGameweeks >= 2 ? '🚨' : '⚠️'}
                                    </span>
                                    <div>
                                        <p className={clsx(
                                            "font-extrabold text-sm leading-tight",
                                            (currentUser as any).missedGameweeks >= 2 ? "text-red-400" : "text-amber-300"
                                        )}>
                                            {(currentUser as any).missedGameweeks >= 2
                                                ? `CRITICAL: ${(currentUser as any).missedGameweeks} Consecutive Missed Gameweeks`
                                                : `Payment Arrears — GW${currentFplEvent?.id || ''} Skipped`}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            {(currentUser as any).missedGameweeks >= 2
                                                ? `Missing 2+ consecutive GWs will permanently disqualify you from the Season Vault. Clear KES ${((currentUser as any).missedGameweeks * gameweekStake).toLocaleString()} in arrears immediately.`
                                                : `Your GW contribution is overdue. Pay before the next deadline to remain vault-eligible and avoid disqualification.`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleMpesaSTKPush((currentUser as any).missedGameweeks * gameweekStake || gameweekStake)}
                                    disabled={isPushingMpesa}
                                    className={clsx(
                                        "flex-shrink-0 px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-50",
                                        (currentUser as any).missedGameweeks >= 2
                                            ? "bg-red-500 hover:bg-red-400 text-white shadow-md shadow-red-950/40"
                                            : "bg-amber-500 hover:bg-amber-400 text-black"
                                    )}
                                >
                                    {isPushingMpesa ? 'Sending...' : `Clear KES ${((currentUser as any).missedGameweeks * gameweekStake || gameweekStake).toLocaleString()}`}
                                </button>
                            </div>
                        )}

                        {/* Gameweek Preparation Stage — Displayed once the finished GW concludes */}
                        {currentFplEvent?.isPreparingForNextGw && (
                            <div className="w-full rounded-[2rem] border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[#0e171b] to-emerald-950/30 p-6 shadow-2xl relative overflow-hidden mt-4 mb-2 animate-in fade-in duration-500">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500 blur-[130px] opacity-10 pointer-events-none" />
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                            <Calendar className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    Preparing for {currentFplEvent.nextName || `Gameweek ${currentFplEvent.nextId}`}
                                                </span>
                                                {currentFplEvent.nextDeadlineTime && (
                                                    <span className="text-[11px] text-gray-400 font-medium">
                                                        Deadline: {new Date(currentFplEvent.nextDeadlineTime).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                                                {hasPaid 
                                                    ? "You're Locked In for the Next Gameweek 🔒" 
                                                    : "Fund Your Wallet for the Next Gameweek ⚡"}
                                            </h3>
                                            <p className="text-xs text-gray-300 mt-1 max-w-xl leading-relaxed">
                                                {hasPaid
                                                    ? `Your KES ${gameweekStake.toLocaleString()} stake is covered from your wallet balance (KES ${walletBalance.toLocaleString()}). Tweak your team and prepare your lineup!`
                                                    : `Deposit your KES ${gameweekStake.toLocaleString()} weekly stake before the deadline to compete for the ${leagueName} weekly pot.`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                                        {!hasPaid ? (
                                            <button
                                                onClick={() => navigate('/deposit')}
                                                className="flex-1 md:flex-initial px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                                            >
                                                <Wallet className="w-4 h-4" />
                                                Fund Wallet (KES {gameweekStake})
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate('/sidebets')}
                                                className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                                            >
                                                <Flame className="w-4 h-4 text-amber-400" />
                                                Challenge in Side Bets
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigate('/standings')}
                                            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <BarChart3 className="w-4 h-4 text-blue-400" />
                                            Standings
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}



                        {!currentFplEvent?.isPreparingForNextGw && !gwWinner && members.length > 0 && (
                            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                                        <Trophy className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-amber-300 uppercase tracking-wider">
                                            No Eligible Funded Winner
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            Chama Rule: Minimum 2 funded managers required to contest the pot. Unfunded managers cannot claim prize money.
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                    {members.filter(m => m.hasPaid && m.isActive !== false).length} Funded
                                </span>
                            </div>
                        )}
            </div>

            {/* Main Content — Dense Grid Layout */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 pb-6 lg:pb-8 z-10 relative mt-2">

                {/* === ROW 1: GW Standings & Rank (6) on top, Upcoming GW Status / Action Required (6) === */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4 items-stretch">
                    {/* GW Rank Card — live standings from FPL (Placed on Top) */}
                    <div className="lg:col-span-6 bg-[#161d24] border border-white/5 shadow-2xl shadow-black/50 rounded-[1.5rem] p-5 flex flex-col justify-between h-full overflow-hidden">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                    <Star className="w-3.5 h-3.5 text-[#FBBF24]" /> Gameweek Rank
                                </h4>
                                {gwWinner && (
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#10B981]/20 bg-[#10B981]/10 text-[#10B981]">
                                        {currentFplEvent?.finished ? 'Final' : 'Live'}
                                    </span>
                                )}
                            </div>

                            {/* Your GW Rank — prominent stat chip */}
                            {(() => {
                                const topScore = fplStandings.length > 0 ? Number(fplStandings[0]?.event_total ?? 0) : 0;
                                const tiedTopWinners = fplStandings.filter((e: any) => Number(e.event_total ?? 0) === topScore && topScore > 0);
                                const isSplitPot = tiedTopWinners.length > 1;

                                const myRankEntry = fplStandings.findIndex((e: any) =>
                                    (currentUser?.fplTeamId && Number(e.entry) === Number(currentUser.fplTeamId)) ||
                                    (currentUser?.secondFplTeamId && Number(e.entry) === Number(currentUser.secondFplTeamId)) ||
                                    currentUser?.displayName?.toLowerCase().includes(e.player_name?.toLowerCase())
                                );
                                const myEntry = myRankEntry >= 0 ? fplStandings[myRankEntry] : null;
                                const myPoints = Number(myEntry?.event_total ?? 0);
                                const isRankOne = (myPoints === topScore && topScore > 0) || myRankEntry === 0 || isRecentWinner || isCurrentUserGwWinner;
                                const rank = myRankEntry + 1;

                                return myEntry ? (
                                    <>
                                        <div className={clsx(
                                            "rounded-2xl border px-3.5 py-3 mb-3 flex items-center justify-between",
                                            isRankOne
                                                ? "border-[#FBBF24]/50 bg-gradient-to-r from-[#FBBF24]/15 to-[#FBBF24]/5 shadow-[0_0_20px_rgba(251,191,36,0.1)]"
                                                : "border-emerald-500/30 bg-emerald-500/8"
                                        )}>
                                            <div className="flex items-center gap-2.5">
                                                <div className={clsx(
                                                    "w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0",
                                                    isRankOne ? "bg-[#FBBF24]/20 text-[#FBBF24]" : "bg-emerald-500/20 text-emerald-300"
                                                )}>
                                                    {isRankOne ? '🥇' : `#${rank}`}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                        {isRankOne ? (isSplitPot ? 'Tied for 1st' : 'GW Leader') : 'Your GW Rank'}
                                                    </p>
                                                    <p className="text-sm font-black text-white leading-tight">{firstName}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-black text-[#FBBF24] tabular-nums leading-tight">{myEntry.event_total ?? 0}</p>
                                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">
                                                    {isRankOne && isSplitPot ? `Split Pot (1/${tiedTopWinners.length})` : 'GW pts'}
                                                </p>
                                            </div>
                                        </div>
                                        {isRankOne && (
                                            <button
                                                type="button"
                                                onClick={() => setShowFlexModal(true)}
                                                className="w-full mb-3 py-2 px-3 rounded-xl bg-gradient-to-r from-[#FBBF24] to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-[#FBBF24]/20 active:scale-[0.98] transition-all cursor-pointer"
                                            >
                                                <Trophy className="w-3.5 h-3.5 text-slate-950" />
                                                Share Victory Card
                                            </button>
                                        )}
                                    </>
                                ) : fplStandings.length > 0 ? (
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 mb-3 flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                                            <Star className="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Your Rank</p>
                                            <p className="text-xs text-gray-400">Link your FPL ID in Settings</p>
                                        </div>
                                    </div>
                                ) : null;
                            })()}

                            {/* GW Pot Leader(s) — only #1 wins (supports tie split) */}
                            {(() => {
                                const topScore = fplStandings.length > 0 ? Number(fplStandings[0]?.event_total ?? 0) : 0;
                                const tiedTopWinners = fplStandings.filter((e: any) => Number(e.event_total ?? 0) === topScore && topScore > 0);
                                const isSplit = tiedTopWinners.length > 1;

                                if (fplStandings.length === 0) {
                                    return <div className="text-xs text-gray-600 font-bold tracking-widest uppercase py-4 text-center">Waiting for FPL data…</div>;
                                }

                                return (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 pb-1">
                                            <span>GW Pot Winner{isSplit ? 's (Tied — Split Pot)' : ''}</span>
                                            <span>Score</span>
                                        </div>
                                        {tiedTopWinners.map((entry: any) => {
                                            const isMe = (currentUser?.fplTeamId && Number(entry.entry) === Number(currentUser.fplTeamId)) ||
                                                (currentUser?.secondFplTeamId && Number(entry.entry) === Number(currentUser.secondFplTeamId));
                                            return (
                                                <div key={entry.entry} className={clsx(
                                                    'flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors border',
                                                    isMe ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-[#FBBF24]/10 border-[#FBBF24]/30 text-white'
                                                )}>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-base flex-shrink-0">🥇</span>
                                                        <span className="text-xs font-bold truncate">{entry.player_name?.split(' ')[0]}</span>
                                                        {isMe && <span className="text-[9px] text-emerald-400 font-black">(you)</span>}
                                                        {isSplit && (
                                                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                                                Split KES {Math.round((weeklyPot || 0) / tiedTopWinners.length).toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-black text-[#FBBF24] tabular-nums flex-shrink-0">{entry.event_total ?? 0} pts</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/standings')}
                            className="w-full mt-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-emerald-400 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                            View Full Standings →
                        </button>
                    </div>

                    {/* Personal Status + Pay Action (Action Required) */}
                    {currentUser && (
                        <div className={clsx(
                            "fc-member-status-card",
                            "lg:col-span-6 rounded-[1.5rem] p-5 border relative overflow-hidden shadow-xl border-white/5 shadow-black/50 flex flex-col justify-between h-full",
                            isRecentWinner ? "bg-[#1c272c] border-[#FBBF24]/50 shadow-[0_0_30px_rgba(251,191,36,0.12)]" :
                                (isCurrentGwVoided ? "bg-amber-500/5 border-amber-500/20" :
                                    (isSpectator ? "bg-indigo-500/5 border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.08)]" :
                                        (isCurrentFunded ? "bg-[#10B981]/5 border-[#10B981]/20" : "bg-red-500/5 border-red-500/20")))
                        )}>
                            {isRecentWinner && (
                                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#FBBF24] to-transparent" />
                            )}
                            <div>
                                {/* Status Label */}
                                <span className={clsx(
                                    "text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 mb-2",
                                    isRecentWinner ? "text-[#FBBF24]" :
                                        (isCurrentGwVoided ? "text-amber-400" :
                                            (isSpectator ? "text-indigo-400" : (isCurrentFunded ? "text-[#10B981]" : "text-red-400")))
                                )}>
                                    <span className={clsx(
                                        "w-1.5 h-1.5 rounded-full animate-pulse",
                                        isRecentWinner ? "bg-[#FBBF24]" :
                                            (isCurrentGwVoided ? "bg-amber-400" :
                                                (isSpectator ? "bg-indigo-400" : (isCurrentFunded ? "bg-[#10B981]" : "bg-red-500")))
                                    )} />
                                    {isSpectator ? "Spectator & Side-Bets Active" : (isTargetGwUpcoming ? `Upcoming GW${activeFundingGw} Status` : "Your Gameweek Status")}
                                </span>
                                <h3 className={clsx("text-xl font-black tracking-tight mb-1.5", isRecentWinner ? "text-[#FBBF24]" : (isSpectator ? "text-indigo-300" : "text-white"))}>
                                    {isRecentWinner
                                        ? "Champion of the Week 🏆"
                                        : (isCurrentGwVoided
                                            ? "Gameweek Voided ⚠️"
                                            : (isSpectator
                                                ? "Spectator & Side-Bets Only"
                                                : (isCurrentFunded ? "Verified & Active" : "Action Required")))}
                                </h3>
                                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                                    {isRecentWinner
                                        ? "Incredible! You secured the highest points this GW. Payout processing."
                                        : (isCurrentGwVoided
                                            ? "Contest requires at least 2 funded managers to disburse the weekly pot. All funds and balances are preserved."
                                            : (isSpectator
                                                ? "You chose not to play the weekly and season cash pot. No weekly dues or arrears apply to you! You can freely track standings, banter, and challenge any rival to 1v1 M-Pesa cash side bets."
                                                : (isCurrentFunded
                                                    ? (isTargetGwUpcoming
                                                        ? `Your contribution for Gameweek ${activeFundingGw} is secured from your balance. Tweak your lineup before deadline.`
                                                        : `Your contribution is secured. Eligible for this GW's pot. Wallet covers your next ${gameweekStake > 0 ? Math.floor(walletBalance / gameweekStake) : 0} Gameweeks.`)
                                                    : (isTargetGwUpcoming
                                                        ? `Gameweek ${currentFplEvent?.id} is completed. Your KES ${gameweekStake.toLocaleString()} stake is now due for Gameweek ${activeFundingGw}. Deposit before kickoff.`
                                                        : `Contribution for GW${currentFplEvent?.id || 1} pending. Please pay your KES ${gameweekStake.toLocaleString()} contribution to remain active and eligible for the cash pot.`))))}
                                </p>

                                {/* Wallet coverage info pill */}
                                {!isSpectator && !isCurrentGwVoided && (
                                    <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-1 mb-3">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-gray-400 font-medium">Gameweek Stake</span>
                                            <span className="font-bold text-white tabular-nums">
                                                KES {gameweekStake.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs font-semibold">
                                            <span className="text-gray-300">
                                                {isCurrentFunded ? `Secured: KES ${gameweekStake.toLocaleString()}` : `Due: KES ${gameweekStake.toLocaleString()}`}
                                            </span>
                                            <span className="text-gray-400 text-[11px]">
                                                Wallet: <strong className="text-white">KES {animatedWalletBalance.toLocaleString()}</strong>
                                            </span>
                                        </div>
                                        {gameweekStake > 0 && walletBalance >= gameweekStake && (
                                            <p className="text-[10px] text-emerald-400/90 font-medium">
                                                {isTargetGwUpcoming && walletBalance >= 2 * gameweekStake ? (
                                                    `Auto-covers ${Math.floor(walletBalance / gameweekStake) - 1} upcoming round${Math.floor(walletBalance / gameweekStake) - 1 > 1 ? 's' : ''} (GW${activeFundingGw} → GW${activeFundingGw + Math.floor(walletBalance / gameweekStake) - 2})`
                                                ) : !isTargetGwUpcoming ? (
                                                    `Auto-covers ${Math.floor(walletBalance / gameweekStake)} round${Math.floor(walletBalance / gameweekStake) > 1 ? 's' : ''} (GW${currentFplEvent?.id || 1} → GW${(currentFplEvent?.id || 1) + Math.floor(walletBalance / gameweekStake) - 1})`
                                                ) : (
                                                    `Wallet covers completed GW${currentFplEvent?.id}. Deposit KES ${(gameweekStake - (walletBalance % gameweekStake)).toLocaleString()} to activate GW${activeFundingGw}.`
                                                )}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {isSpectator ? (
                                <div className="flex flex-col gap-2 mt-auto">
                                    <button
                                        onClick={() => navigate('/sidebets')}
                                        className="w-full px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:scale-[0.98]"
                                    >
                                        <Swords className="w-4 h-4" />
                                        Place Head-to-Head Side Bet
                                    </button>
                                    <button
                                        onClick={handleUpgradeToPot}
                                        disabled={isUpgradingToPot}
                                        className="w-full px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.98]"
                                    >
                                        <Trophy className="w-3.5 h-3.5 text-[#FBBF24]" />
                                        {isUpgradingToPot
                                            ? "Activating..."
                                            : walletBalance >= gameweekStake
                                                ? `Activate Cash Pot (Wallet Funded ✓)`
                                                : `Fund Wallet to Upgrade (KES ${gameweekStake.toLocaleString()}/GW)`}
                                    </button>
                                </div>
                            ) : !isCurrentFunded && !isCurrentGwVoided ? (
                                <div className="flex flex-col gap-2 mt-auto">
                                    <div className="flex items-baseline justify-center gap-1.5 mb-2 mt-1">
                                        <span className="text-3xl font-black text-white tracking-tight tabular-nums">
                                            {gameweekStake.toLocaleString()}
                                        </span>
                                        <span className="text-white text-xs font-bold tracking-widest uppercase">KES</span>
                                    </div>
                                    <button
                                        onClick={() => setShowPochiInstructions(!showPochiInstructions)}
                                        className="w-full px-4 py-2.5 rounded-xl font-bold text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Banknote className="w-5 h-5 group-hover:-rotate-6 transition-transform" />
                                        Pay via Pochi La Biashara
                                    </button>

                                    {showPochiInstructions && (
                                        <div className="bg-[#1c1a09] border border-[#FBBF24]/30 rounded-xl p-3 text-left animate-in fade-in zoom-in-95 duration-200 mt-1">
                                            <p className="text-[11px] font-bold text-[#FBBF24] uppercase tracking-widest mb-1.5 flex items-center gap-1"><Smartphone className="w-3 h-3" /> Pochi Instructions</p>
                                            <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 pl-4 list-decimal marker:text-gray-500">
                                                <li>Go to M-Pesa Menu &gt; <strong>Pochi La Biashara</strong></li>
                                                <li>Send to Mobile No. <strong>{payoutDestinationPhone}</strong></li>
                                                <li>Amount: <strong>KES {gameweekStake}</strong></li>
                                            </ol>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-gray-600 dark:text-gray-400">
                                        Destination: <span className="font-black text-[#10B981]">{payoutDestinationPhone}</span>
                                    </div>

                                    <div className="flex justify-end mt-1">
                                        <button
                                            onClick={() => { setShowClaimModal(true); setClaimSubmitted(false); setClaimReceiptCode(''); }}
                                            className="text-[11px] text-[#FBBF24]/80 hover:text-[#FBBF24] underline underline-offset-2 transition-colors flex items-center gap-1 font-bold"
                                        >
                                            Claim M-Pesa Receipt via WhatsApp →
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                            {isCurrentFunded && !isCurrentGwVoided && (
                                <div className="flex items-center gap-2 text-[#10B981]/70 text-xs font-bold mt-auto">
                                    <Check className="w-4 h-4" /> Contribution confirmed
                                </div>
                            )}

                            {/* BG graphic */}
                            <div className="absolute -right-3 -bottom-3 opacity-[0.04] pointer-events-none">
                                {isRecentWinner ? <Trophy className="w-28 h-28 text-[#FBBF24]" /> : (hasPaid ? <ShieldCheck className="w-24 h-24" /> : <AlertCircle className="w-24 h-24" />)}
                            </div>
                        </div>
                    )}
                </div>

                {/* === ROW 1.5: Co-Chair Maker/Checker (Conditional) === */}
                {(currentUser?.id === coAdminId || currentUser?.authUid === coAdminId || currentUser?.role === 'co-chair') && pendingPayouts.length > 0 && (
                    <div className="mb-4 bg-[#FBBF24]/10 border border-[#FBBF24]/40 rounded-[1.5rem] p-5 shadow-2xl overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-5 h-5 text-[#FBBF24] animate-pulse" />
                            <h3 className="text-xl font-black text-[#FBBF24] tracking-tight">Co-Chair Duty: Awaiting Approval</h3>
                        </div>
                        <div className="space-y-3">
                            {pendingPayouts.map((payout) => (
                                <div key={payout.id} className="bg-black/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-white font-bold text-sm tracking-wide">{payout.gwName || `GW${payout.gw}`} Payout Request</p>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                                            <span className="text-[#FBBF24] font-black tracking-tight">KES {Number(payout.amount).toLocaleString()}</span> → {payout.winnerName} ({payout.winnerPhone})
                                        </p>
                                        <p className="text-gray-500 text-[10px] mt-1 uppercase tracking-widest font-bold">Requested by: {payout.requestedBy || 'Chairman'}</p>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => handleRejectPayout(payout.id)}
                                            className="flex-1 sm:flex-none px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprovePayout(payout)}
                                            disabled={isApprovingPayout === payout.id}
                                            className="flex-1 sm:flex-none px-5 py-2.5 bg-[#10B981] hover:bg-[#10b981]/90 text-black text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            {isApprovingPayout === payout.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            {isApprovingPayout === payout.id ? 'Approving...' : 'Approve & Pay'}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => generateWhatsAppReceipt(payout)}
                                        className="sm:hidden lg:flex px-4 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors items-center justify-center gap-1.5 active:scale-95 text-center w-full sm:w-auto"
                                    >
                                        <Share2 className="w-3.5 h-3.5" /> Share
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Member Nudge: If pending payouts exist but user is NOT co-chair, show a nudge button */}
                {pendingPayouts.length > 0 && payoutApproverId && currentUser?.id !== payoutApproverId && (
                    <div className="mb-4 bg-[#FBBF24]/5 border border-[#FBBF24]/20 rounded-[1.5rem] p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Trophy className="w-5 h-5 text-[#FBBF24] flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-[#FBBF24]">Payout Awaiting Approval</p>
                                <p className="text-[10px] text-gray-500 font-medium">The Co-Chair needs to approve the payout before it's dispatched.</p>
                            </div>
                        </div>
                        <button
                            disabled={nudgeSent}
                            onClick={handleNudge}
                            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[#FBBF24] hover:bg-[#eab308] text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors active:scale-95 disabled:opacity-50"
                        >
                            {nudgeSent ? <CheckCircle2 className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                            {nudgeSent ? 'Nudged ✓' : 'Nudge'}
                        </button>
                    </div>
                )}

                {/* === ROW 2: Pot & Vault Banner === */}
                <div className="mb-4">
                    <PotVaultSwapper
                        weeklyPot={weeklyPot}
                        seasonVault={seasonVaultAccumulated}
                        weeklyRulesPercent={rules.weekly}
                        isStealthMode={isStealthMode}
                        projectedSeasonVault={seasonVaultProjected}
                        leagueStartGw={effectiveMdStartGw}
                    />
                </div>

                {/* === ROW 3: Performance Trajectory Chart === */}
                <div className="fc-member-chart mb-4 bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/5 shadow-xl rounded-[1.5rem] p-5 flex flex-col justify-between text-slate-900 dark:text-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div>
                            <h4 className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-gray-300 uppercase tracking-wider">
                                <BarChart3 className="w-3.5 h-3.5 text-emerald-500" /> Your Performance Trajectory
                                {effectiveMdStartGw > 1 && (
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 normal-case tracking-normal">
                                        Chama Commenced: GW{effectiveMdStartGw}
                                    </span>
                                )}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium mt-0.5">
                                Recent Gameweek points progression comparing your personal score against the league average.
                            </p>
                        </div>
                        <span className="text-slate-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                            {effectiveMdStartGw > 1 ? `Commenced GW${effectiveMdStartGw}` : 'Recent Gameweeks'}
                        </span>
                    </div>

                    {/* Trajectory Legend Badges */}
                    {performanceData.length > 0 && (() => {
                        const allKeys = Object.keys(performanceData[0] || {}).filter(k => k !== 'name' && k !== 'Average');
                        const myFplEntry = rawFplStandings?.find((r: any) => 
                            (currentUser?.fplTeamId && Number(r.entry) === Number(currentUser.fplTeamId)) ||
                            (currentUser?.secondFplTeamId && Number(r.entry) === Number(currentUser.secondFplTeamId))
                        );
                        const myFplFirstName = myFplEntry?.player_name ? myFplEntry.player_name.split(' ')[0] : null;
                        const myFirstName = (currentUser?.displayName || '').trim().split(' ')[0];
                        const myKey = (myFplFirstName && allKeys.includes(myFplFirstName))
                            ? myFplFirstName
                            : (allKeys.find(k => myFirstName && (k.toLowerCase().includes(myFirstName.toLowerCase()) || myFirstName.toLowerCase().includes(k.toLowerCase()))) || (allKeys.includes('You') ? 'You' : allKeys[0]) || 'You');
                        const lastScore = performanceData[performanceData.length - 1]?.['You'] ?? performanceData[performanceData.length - 1]?.[myKey];

                        return (
                            <div className="flex items-center gap-2 flex-wrap mb-3">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-xs bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
                                    <span>{myFirstName || myKey} <strong className="text-emerald-600 dark:text-emerald-400">(You)</strong></span>
                                    {lastScore !== undefined && (
                                        <span className="text-[10px] font-black opacity-80 tabular-nums ml-0.5">
                                            {lastScore} pts
                                        </span>
                                    )}
                                </div>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 shadow-xs">
                                    <span className="w-3 h-0.5 bg-amber-500 inline-block border-t border-dashed" />
                                    <span>League Avg</span>
                                </div>
                                {effectiveMdStartGw > 1 && (
                                    <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-gray-400 font-medium ml-auto">
                                        <span>Official Chama Play: GW{effectiveMdStartGw}+</span>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <div className="h-56 w-full">
                        {performanceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performanceData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={28} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f1720', borderColor: 'rgba(255,255,255,0.12)', borderRadius: '12px', fontSize: '12px', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                />
                                {effectiveMdStartGw && effectiveMdStartGw > 1 && (
                                    <ReferenceLine
                                        x={`GW${effectiveMdStartGw}`}
                                        stroke="#10B981"
                                        strokeDasharray="4 4"
                                        strokeWidth={2}
                                        label={{
                                            value: `🏁 Kickoff (GW${effectiveMdStartGw})`,
                                            position: 'insideTopLeft',
                                            fill: '#10B981',
                                            fontSize: 10,
                                            fontWeight: 800,
                                            offset: 8
                                        }}
                                    />
                                )}
                                {(() => {
                                    const allKeys = Object.keys(performanceData[0] || {}).filter(k => k !== 'name' && k !== 'Average');
                                    const myFplEntry = rawFplStandings?.find((r: any) => 
                                        (currentUser?.fplTeamId && Number(r.entry) === Number(currentUser.fplTeamId)) ||
                                        (currentUser?.secondFplTeamId && Number(r.entry) === Number(currentUser.secondFplTeamId))
                                    );
                                    const myFplFirstName = myFplEntry?.player_name ? myFplEntry.player_name.split(' ')[0] : null;
                                    const myFirstName = (currentUser?.displayName || '').trim().split(' ')[0];
                                    const myKey = (myFplFirstName && allKeys.includes(myFplFirstName))
                                        ? myFplFirstName
                                        : (allKeys.find(k => myFirstName && (k.toLowerCase().includes(myFirstName.toLowerCase()) || myFirstName.toLowerCase().includes(k.toLowerCase()))) || (allKeys.includes('You') ? 'You' : allKeys[0]));

                                    const plotKey = performanceData[0]?.['You'] !== undefined ? 'You' : myKey;

                                    return plotKey ? (
                                        <Line
                                            key={plotKey}
                                            type="monotone"
                                            dataKey={plotKey}
                                            stroke="#10B981"
                                            strokeWidth={3.5}
                                            dot={{ r: 4.5, fill: '#10B981', strokeWidth: 0 }}
                                            activeDot={{ r: 6 }}
                                            name={`${myFirstName || myKey} (You)`}
                                            animationDuration={800}
                                            animationEasing="ease-out"
                                        />
                                    ) : null;
                                })()}
                                <Line type="monotone" dataKey="Average" stroke="#FBBF24" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 3, fill: '#FBBF24', strokeWidth: 0 }} name="League Avg" animationDuration={800} animationEasing="ease-out" />
                            </LineChart>
                        </ResponsiveContainer>
                        ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-6">
                            <BarChart3 className="w-8 h-8 text-slate-300 dark:text-gray-700 mb-2" />
                            <p className="text-xs font-bold text-slate-600 dark:text-gray-400">Link your FPL team in Profile</p>
                            <p className="text-[10px] text-slate-400 dark:text-gray-600 mt-1">to view your real gameweek trajectory.</p>
                        </div>
                        )}
                    </div>
                </div>

                {/* === ROW 4: Live Escrow Feed === */}
                <div className="fc-member-feed w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/5 rounded-[1.5rem] overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        <h4 className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">League Activity</h4>
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse ml-1" />
                        <span className="ml-auto font-mono text-[10px] text-slate-500 dark:text-gray-500 font-bold">{leagueName}</span>
                        <button
                            onClick={() => setShowFeedPanelMobile(prev => !prev)}
                            className="sm:hidden text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300"
                        >
                            {showFeedPanelMobile ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <div
                        className={clsx('h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.03] font-mono', !showFeedPanelMobile && 'hidden sm:block')}
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#10B981 transparent' }}
                    >
                        {liveEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-gray-600">
                                <Terminal className="w-6 h-6 mb-2 opacity-40" />
                                <span className="text-[11px] tracking-widest uppercase font-bold">Standing by for events...</span>
                            </div>
                        ) : liveEvents.map(ev => {
                            const ts = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date();
                            const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const eventTypeUpper = String(ev.eventType || '').toUpperCase();
                            const tagColor = eventTypeUpper.includes('PAYMENT') || eventTypeUpper.includes('DEPOSIT') ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                                eventTypeUpper.includes('RESOLUTION') || eventTypeUpper.includes('WINNER') ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30' :
                                    eventTypeUpper.includes('FORFEIT') ? 'text-rose-700 dark:text-rose-400 bg-rose-500/15 border border-rose-500/30' :
                                        eventTypeUpper.includes('OPERATION') ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-500/15 border border-indigo-500/30' :
                                            'text-slate-600 dark:text-gray-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10';
                            return (
                                <div key={ev.id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors animate-in fade-in duration-300">
                                    <span className="text-slate-400 dark:text-gray-500 text-[10px] w-14 flex-shrink-0 font-bold">{timeStr}</span>
                                    <span className={clsx('text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0', tagColor)}>
                                        {ev.eventType || 'OPERATIONS'}
                                    </span>
                                    <span className="text-[11px] text-slate-700 dark:text-gray-300 truncate font-medium">{ev.message}</span>
                                    {ev.actor && <span className="ml-auto text-[10px] text-slate-400 dark:text-gray-500 flex-shrink-0 font-bold">@{ev.actor}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>

            {/* Wallet Top-Up Modal */}
            {showTopUpModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#111820]/95 border border-[#10B981]/20 rounded-3xl p-7 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="mb-5">
                            <div className="flex items-center gap-2 mb-1">
                                <Wallet className="w-5 h-5 text-[#10B981]" />
                                <h3 className="text-xl font-extrabold text-white">Top Up Wallet</h3>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Send any amount to your wallet. Your current balance is not reduced, and the top-up is added separately once M-Pesa confirms it.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Amount to Top Up</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={topUpAmount === 0 ? '' : topUpAmount}
                                    placeholder="100"
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                        const cleaned = e.target.value.replace(/[^0-9]/g, '');
                                        setTopUpAmount(cleaned === '' ? 0 : Math.min(300000, parseInt(cleaned, 10)));
                                    }}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#10B981]/50 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Note for Chairman or Self</label>
                                <textarea
                                    rows={3}
                                    value={topUpNote}
                                    onChange={(e) => setTopUpNote(e.target.value)}
                                    placeholder="Optional: 'Use my GW winnings' or 'Add extra funds for next 3 GWs'"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#10B981]/50 transition-colors resize-none"
                                />
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                <p>Wallet balance: <span className="font-black text-white">KES {animatedWalletBalance.toLocaleString()}</span></p>
                                <p>Current GW stake: <span className="font-black text-white">KES {gameweekStake.toLocaleString()}</span></p>
                                <p>Top-up amount: <span className="font-black text-[#10B981]">KES {Math.max(1, Number(topUpAmount || 0)).toLocaleString()}</span></p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowTopUpModal(false);
                                        setTopUpNote('');
                                    }}
                                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-600 dark:text-gray-400 text-sm font-bold rounded-xl transition-colors border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={topUpNote.trim() ? handleRequestWalletCredit : () => handleMpesaSTKPush(topUpAmount)}
                                    disabled={isSubmittingTopUp || isRequestingWalletCredit || !Number(topUpAmount || 0)}
                                    className="flex-1 px-4 py-3 bg-[#10B981] hover:bg-[#10B981]/90 text-black text-sm font-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmittingTopUp || isRequestingWalletCredit ? <><Zap className="w-4 h-4 animate-pulse" /> Sending...</> : <><Banknote className="w-4 h-4" /> {topUpNote.trim() ? 'Request Credit' : 'Send STK Push'}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Module 3B: Claim Payment Modal */}
            {showClaimModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#111820]/95 border border-[#FBBF24]/20 rounded-3xl p-7 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                        {claimSubmitted ? (
                            <div className="text-center py-4 space-y-4">
                                <div className="w-14 h-14 rounded-full bg-[#FBBF24]/10 border border-[#FBBF24]/30 flex items-center justify-center mx-auto">
                                    <Check className="w-7 h-7 text-[#FBBF24]" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-extrabold text-white mb-1">Claim Submitted ✓</h3>
                                    <p className="text-sm text-gray-400">Your claim has been logged for the Chairman's review.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const targetPhone = (payoutDestinationPhone || chairmanPhone || '').startsWith('0') 
                                            ? `254${(payoutDestinationPhone || chairmanPhone || '').slice(1)}` 
                                            : (payoutDestinationPhone || chairmanPhone || '');
                                        const msg = `*M-Pesa Payment Claim*\n\n` +
                                            `🏆 *League:* ${leagueName || 'FantasyChama'}\n` +
                                            `👤 *Member:* ${currentUser?.displayName || 'Member'} (${memberPhone || ''})\n` +
                                            `🧾 *M-Pesa Code:* ${claimReceiptCode}\n\n` +
                                            `I have logged my payment claim in FantasyChama. Please confirm and update my wallet status!`;
                                        window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                    }}
                                    className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,211,102,0.25)]"
                                >
                                    <MessageCircle className="w-4 h-4 fill-current" /> Notify Chairman via WhatsApp
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[#FBBF24] text-lg">🚨</span>
                                        <h3 className="text-xl font-extrabold text-white">Claim Payment</h3>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Paid via M-Pesa but still showing unpaid? Submit your receipt and the Chairman will verify it within 24h.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Receipt Code</label>
                                        <input
                                            type="text"
                                            value={claimReceiptCode}
                                            onChange={e => setClaimReceiptCode(e.target.value.toUpperCase())}
                                            placeholder="e.g. SCL90XXXXXX"
                                            className="w-full bg-white/5 border border-[#FBBF24]/20 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[#FBBF24]/50 transition-colors"
                                        />
                                    </div>
                                    <div className="bg-[#FBBF24]/5 border border-[#FBBF24]/15 rounded-xl p-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                        The Chairman will receive an alert to cross-check your M-Pesa receipt with their records. False claims may result in suspension.
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowClaimModal(false)}
                                            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-600 dark:text-gray-400 text-sm font-bold rounded-xl transition-colors border border-white/10"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleClaimPayment}
                                            disabled={isSubmittingClaim || !claimReceiptCode.trim()}
                                            className="flex-1 px-4 py-3 bg-[#FBBF24] hover:bg-[#eab308] text-black text-sm font-black rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isSubmittingClaim ? <Zap className="w-4 h-4 animate-pulse" /> : null}
                                            {isSubmittingClaim ? 'Submitting...' : 'Submit Claim 🚨'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
