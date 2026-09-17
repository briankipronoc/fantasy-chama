import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useNavigate, Link } from "react-router-dom";
import Header from "../components/Header";
import ChampionFlexCardModal from "../components/ChampionFlexCardModal";
import ConfirmModal from "../components/ConfirmModal";
import UserAvatar from "../components/UserAvatar";
import { DashboardSkeleton } from "../components/Skeleton";
import { haptics } from "../utils/haptics";
import {
  Megaphone,
  Share2,
  RefreshCw,
  RotateCcw,
  Banknote,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Trophy,
  AlertTriangle,
  UserPlus,
  Bell,
  ShieldCheck,
  Download,
  ShieldAlert,
  AlertCircle,
  Swords,
  Users,
  Eye,
  Clock,
  Smartphone,
  Wallet,
  Coins,
  Radio,
  Flame,
  Star,
  X,
} from "lucide-react";
import PotVaultSwapper from "../components/PotVaultSwapper";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  onSnapshot,
  query,
  where,
  increment,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { useStore } from "../store/useStore";
import { getApiBaseUrl, secureApiPost } from "../utils/api";
import clsx from "clsx";
import confetti from "canvas-confetti";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export default function AdminCommandCenter() {
  const navigate = useNavigate();
  const activeLeagueId = localStorage.getItem("activeLeagueId");
  const activeUserId = localStorage.getItem("activeUserId");

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "ledger" | "finance"
  >("dashboard");

  const [leagueName, setLeagueName] = useState("");
  const [chairmanName, setChairmanName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [gameweekStake, setMonthlyContribution] = useState(0);
  const [rules, setRules] = useState({ weekly: 70, vault: 30 });
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [manualResolvePromise, setManualResolvePromise] = useState<{resolve: (value: {gw: number, winner: string} | null) => void, currentGw: number | null} | null>(null);
  const [manualGwInput, setManualGwInput] = useState("");
  const [manualWinnerInput, setManualWinnerInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionPulse, setResolutionPulse] = useState(false);
  const [actionTimeline, setActionTimeline] = useState({
    resolved: false,
    approvalPending: false,
    payoutSent: false,
    confirmed: false,
  });
  const [payoutMethod, setPayoutMethod] = useState<"mpesa" | "cash">("mpesa");
  const [coAdminId, setCoAdminId] = useState<string | null>(null);
  // @ts-ignore
    const [chairmanId, setChairmanId] = useState<string | null>(null);
  const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
  const [isApprovingPayout, setIsApprovingPayout] = useState<string | null>(
    null,
  );
  const [whatsappReceipt, setWhatsappReceipt] = useState<string | null>(null);
  const [liveOpsEvents, setLiveOpsEvents] = useState<any[]>([]);
  const [showOpsModal, setShowOpsModal] = useState(false);
  const [resolveTargetGw, setResolveTargetGw] = useState<number | null>(null);
  const [selectedGwForAction, setSelectedGwForAction] = useState<number | null>(null);
  const [showGwActionModal, setShowGwActionModal] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);
  // const [recentGovernanceEvents, setRecentGovernanceEvents] = useState<any[]>([]);

  // Module 3B: Dispute/Claim alerts
  const [pendingDisputes, setPendingDisputes] = useState<any[]>([]);
  const [processingDispute, setProcessingDispute] = useState<string | null>(null);
  const [pendingPochiRequests, setPendingPochiRequests] = useState<any[]>([]);
  const [processingPochi, setProcessingPochi] = useState<string | null>(null);
  const [hqReceiptCode, setHqReceiptCode] = useState("");
  const [hqPaymentAmount, setHqPaymentAmount] = useState(0);
  const [isSubmittingHqSettlement, setIsSubmittingHqSettlement] =
    useState(false);
  const [latestHqSettlement, setLatestHqSettlement] = useState<any | null>(
    null,
  );
  const [showHqSettlementForm, setShowHqSettlementForm] = useState(false);

  // Phase 29: FPL GW Winner logic
  const [gwWinner, setGwWinner] = useState<any>(null);
  const [rawFplStandings, setRawFplStandings] = useState<any[]>([]);
  const [isFplStandingsLoading, setIsFplStandingsLoading] = useState(true);
  const [showChairmanFlexModal, setShowChairmanFlexModal] = useState(false);
  const [isCurrentEventFinished, setIsCurrentEventFinished] = useState(false);
  const [currentGwNumber, setCurrentGwNumber] = useState<number | null>(null);
  const [nextDeadlineTime, setNextDeadlineTime] = useState<string | null>(null);
  const [firestoreGw, setFirestoreGw] = useState<number | null>(null);
  const [startGw, setStartGw] = useState<number | null>(null);

  // Ref for GW ledger auto-scroll
  const gwLedgerScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gwLedgerScrollRef.current || !(currentGwNumber || firestoreGw)) return;
    const gwNum = currentGwNumber || firestoreGw || 1;
    const target = gwLedgerScrollRef.current.querySelector(`[data-gw="${gwNum}"]`) as HTMLElement | null;
    if (target) {
      // Center the current GW chip in the scroll container
      const container = gwLedgerScrollRef.current;
      const targetLeft = target.offsetLeft;
      const containerWidth = container.clientWidth;
      const scrollTo = targetLeft - containerWidth / 2 + target.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollTo), behavior: 'smooth' });
    }
  }, [currentGwNumber, firestoreGw]);

  const handleNudge = async () => {
    if (!activeLeagueId) return;
    if (!hasValidCoChair) {
      showToast(
        "No Co-Chair configured. Chairman can resolve and pay directly.",
      );
      return;
    }

    const history = JSON.parse(
      localStorage.getItem(`nudge_${activeLeagueId}`) || "[]",
    );
    if (history.length >= 3) {
      showToast("Maximum 3 nudges reached for this payout.");
      return;
    }

    const cooldowns = [0, 60000, 600000, 36000000]; // 0m, 1m, 10m, 10h
    const currentCooldown = cooldowns[history.length];

    if (history.length > 0) {
      const timePassed = Date.now() - history[history.length - 1];
      if (timePassed < currentCooldown) {
        const rem = currentCooldown - timePassed;
        const remainingStr =
          rem < 60000
            ? `${Math.ceil(rem / 1000)}s`
            : rem < 3600000
              ? `${Math.ceil(rem / 60000)}m`
              : `${Math.ceil(rem / 3600000)}h`;
        showToast(
          `Cooldown active. Wait ${remainingStr} before nudging again.`,
        );
        return;
      }
    }

    const newHistory = [...history, Date.now()];
    localStorage.setItem(`nudge_${activeLeagueId}`, JSON.stringify(newHistory));
    setNudgeSent(true);

    await addDoc(collection(db, "leagues", activeLeagueId, "notifications"), {
      type: "warning",
      message: notices.nudge(newHistory.length, pendingPayouts.length),
      timestamp: serverTimestamp(),
      readBy: [],
      targetMemberId: coAdminId as string,
    });
    showToast("Nudge sent! The Co-Chair has been notified.");

    setTimeout(() => setNudgeSent(false), 2000);
  };

  const triggerResolutionPulse = () => {
    setResolutionPulse(true);
    setTimeout(() => setResolutionPulse(false), 1000);
  };

  useEffect(() => {
    if (!activeLeagueId) return;
    const raw = localStorage.getItem(`fc-action-timeline-${activeLeagueId}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setActionTimeline((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore malformed local value
    }
  }, [activeLeagueId]);

  useEffect(() => {
    if (!activeLeagueId) return;
    localStorage.setItem(
      `fc-action-timeline-${activeLeagueId}`,
      JSON.stringify(actionTimeline),
    );
  }, [activeLeagueId, actionTimeline]);

  useEffect(() => {
    // If FPL moved on to a new active gameweek and no pending payouts remain, reset the timeline for the new week.
    if (!isCurrentEventFinished && pendingPayouts.length === 0) {
      setActionTimeline({
        resolved: false,
        approvalPending: false,
        payoutSent: false,
        confirmed: false,
      });
      return;
    }

    if (pendingPayouts.length > 0) {
      setActionTimeline((prev) => ({
        ...prev,
        approvalPending: true,
        resolved: true,
      }));
      return;
    }
    setActionTimeline((prev) => ({ ...prev, approvalPending: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayouts.length]);

  useEffect(() => {
    if (!activeLeagueId) return;
    const eventsQuery = query(
      collection(db, "leagues", activeLeagueId, "notifications"),
      orderBy("timestamp", "desc"),
      limit(12),
    );
    const unsub = onSnapshot(
      eventsQuery,
      () => {
        // Keep listener warm for governance stream readiness.
      },
      (err: any) => {
        console.warn(
          "[admin-command] governance events listener failed:",
          err?.message || err,
        );
        // setRecentGovernanceEvents([]);
      },
    );

    return () => {
      try {
        unsub();
      } catch (err) {
        console.warn("[admin-command] governance events cleanup failed:", err);
      }
    };
  }, [activeLeagueId]);

  useEffect(() => {
    if (!activeLeagueId) return;
    const settlementQuery = query(
      collection(db, "leagues", activeLeagueId, "hq_settlements"),
      orderBy("submittedAt", "desc"),
      limit(1),
    );
    const unsub = onSnapshot(
      settlementQuery,
      (snap) => {
        if (snap.empty) {
          setLatestHqSettlement(null);
          return;
        }
        const latestDoc = snap.docs[0];
        setLatestHqSettlement({ id: latestDoc.id, ...latestDoc.data() });
      },
      (err) => {
        console.warn(
          "[admin-command] hq settlements listener failed:",
          err?.message || err,
        );
        setLatestHqSettlement(null);
      },
    );

    return () => {
      try {
        unsub();
      } catch (err) {
        console.warn("[admin-command] hq settlements cleanup failed:", err);
      }
    };
  }, [activeLeagueId]);

  // Filter & Modal State
  const [paymentFilter, setPaymentFilter] = useState<
    "All" | "Verified" | "Red Zone"
  >("All");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);

  // Manual Member Enrollment
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberTeam, setNewMemberTeam] = useState("");
  const [newMemberFplId, setNewMemberFplId] = useState("");
  const [newMemberSecondTeam, setNewMemberSecondTeam] = useState("");
  const [newMemberPlayMode, setNewMemberPlayMode] = useState<"pot" | "sidebets_only">("pot");
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Pilot Pre-Fund Wallets State
  const [showPrefundOptions, setShowPrefundOptions] = useState(false);
  const [prefundData, setPrefundData] = useState<{ [id: string]: string }>({});
  const [isPrefunding, setIsPrefunding] = useState(false);
  const [prefundUpdateRecentActivity, setPrefundUpdateRecentActivity] = useState(true);
  const [showWalletFundModal, setShowWalletFundModal] = useState(false);
  const [fundTargetMemberId, setFundTargetMemberId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [fundMethod, setFundMethod] = useState<"mpesa" | "cash">("mpesa");
  const [fundTransactionCode, setFundTransactionCode] = useState("");
  const [fundCashDate, setFundCashDate] = useState("");
  const [fundNote, setFundNote] = useState("");
  const [isFundingWallet, setIsFundingWallet] = useState(false);
  const [isSendingWalletPrompt, setIsSendingWalletPrompt] = useState(false);
  const [fundPromptSent, setFundPromptSent] = useState(false);

  // Edit Member modal state
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editTargetMemberId, setEditTargetMemberId] = useState('');
  const [editMemberPhone, setEditMemberPhone] = useState('');
  const [editMemberFplId, setEditMemberFplId] = useState('');
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberPlayMode, setEditMemberPlayMode] = useState<'pot' | 'sidebets_only'>('pot');
  const [isSavingMemberEdit, setIsSavingMemberEdit] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  // Clean Slate / Season Reset state
  const [showCleanSlateModal, setShowCleanSlateModal] = useState(false);
  const [cleanSlateTargetGw, setCleanSlateTargetGw] = useState(10);
  const [cleanSlateConfirmText, setCleanSlateConfirmText] = useState('');
  const [isExecutingCleanSlate, setIsExecutingCleanSlate] = useState(false);

  const recordOperationEvent = async (payload: {
    title: string;
    message: string;
    targetMemberId?: string | null;
    type?: string;
  }) => {
    if (!activeLeagueId) return;

    await Promise.all([
      addDoc(collection(db, "leagues", activeLeagueId, "notifications"), {
        type: payload.type || "info",
        message: payload.message,
        timestamp: serverTimestamp(),
        readBy: [],
        targetMemberId: payload.targetMemberId ?? null,
      }),
      addDoc(collection(db, "leagues", activeLeagueId, "league_events"), {
        eventType: "operations",
        title: payload.title,
        message: payload.message,
        actorId: auth.currentUser?.uid || activeUserId || null,
        targetMemberId: payload.targetMemberId ?? null,
        timestamp: serverTimestamp(),
      }),
    ]);
  };

  useEffect(() => {
    if (
      showAddMemberModal ||
      showPrefundOptions ||
      showResolveModal ||
      showWalletFundModal
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [showAddMemberModal, showPrefundOptions, showResolveModal, showWalletFundModal]);

  // Phase 40: HQ Debt Ledger & Onboarding
  const [showTutorial, setShowTutorial] = useState(false);
  const leagueSettings = useStore((state) => state.league);
  const isPilotMode = leagueSettings?.pilotMode !== false; // Pilot: no HQ cut yet unless commercial explicitly configured
  const pendingHQDebt = isPilotMode ? 0 : (leagueSettings?.pendingHQDebt || 0);
  const [payoutCustomFee, setPayoutCustomFee] = useState<Record<string, number>>({});

  // Auto-Lockout: 48 Hour Grace Period
  const lastResolvedTS = leagueSettings?.lastResolvedDate;
  const lastResolvedDate = lastResolvedTS?.toDate
    ? lastResolvedTS.toDate()
    : new Date();
  const isGracePeriodOver =
    pendingHQDebt > 0 &&
    Date.now() - lastResolvedDate.getTime() > 2 * 24 * 60 * 60 * 1000;

  const isSuspended = leagueSettings?.isSuspended === true || isGracePeriodOver;
  const isWithinGracePeriod =
    pendingHQDebt > 0 &&
    !isGracePeriodOver &&
    leagueSettings?.isSuspended !== true;
  const hqPochiNumber = import.meta.env.VITE_HQ_POCHI_NUMBER || "07XXXXXXXX";

  useEffect(() => {
    if (pendingHQDebt > 0) {
      setHqPaymentAmount(Math.max(1, Math.round(Number(pendingHQDebt || 0))));
    }
  }, [pendingHQDebt]);

  const suspensionNudges = leagueSettings?.suspensionNudges || [];

  const members = useStore((state) => state.members);
  const listenToLeagueMembers = useStore(
    (state) => state.listenToLeagueMembers,
  );
  const togglePaymentStatusGlobal = useStore(
    (state) => state.togglePaymentStatus,
  );
  const isStealthMode = useStore((state) => state.isStealthMode);
  // Store tutorial & tour completion per user account (not per league) so switching or creating leagues never re-triggers the wizard
  const userAccountKey = activeUserId || auth.currentUser?.uid || "chairman";
  const tutorialSeenKey = `chairman_initialized_${userAccountKey}`;
  const adminTourSeenKey = `hasSeenAdminTour_${userAccountKey}`;
  const coChairMember = members.find((m) => m.id === coAdminId);
  
  const hasValidCoChair =
    !!coAdminId &&
    coAdminId !== activeUserId &&
    !!coChairMember &&
    coChairMember.isActive !== false &&
    ((coChairMember as any).role === "admin" ||
      (coChairMember as any).role === "co-chair");
  const notices = {
    nudge: (count: number, total: number) =>
      `Action required: Chairman reminder (${count}/3). Please review ${total} pending payout request${total === 1 ? "" : "s"} now.`,
    payoutApproval: (
      gw: number,
      amount: number,
      winner: string,
      points: number,
    ) =>
      `Payout approval requested: KES ${amount.toLocaleString()} to ${winner} (GW${gw}, ${points} pts).`,
    payoutQueuedChairman: (winner: string, amount: number, points: number) =>
      `Chairman signature required: ${winner} leads with ${points} pts. Dispatch KES ${amount.toLocaleString()} after review.`,
    payoutBroadcast: (
      gw: number,
      winner: string,
      points: number,
      amount: number,
    ) =>
      `Gameweek finalized: ${winner} tops GW${gw} with ${points} pts. Payout KES ${amount.toLocaleString()} is queued.`,
  };

  const handleInitializeOperations = () => {
    localStorage.setItem(tutorialSeenKey, "true");
    localStorage.setItem("chairman_initialized_any", "true");
    localStorage.setItem("chairman_initialized_global", "true");
    if (activeLeagueId) {
      localStorage.setItem(`chairman_initialized_${activeLeagueId}`, "true");
      localStorage.setItem(`chairman_checklist_done_${activeLeagueId}`, "true");
      if (activeUserId) localStorage.setItem(`chairman_initialized_${activeLeagueId}_${activeUserId}`, "true");
    }
    setShowTutorial(false);
  };

  const handleToggleAdmin = async (
    memberId: string,
    currentRole: string | undefined,
  ) => {
    if (!activeLeagueId) return;
    if (memberId === activeUserId || memberId === chairmanId || currentRole === "chairman") {
      setToastMessage("Cannot revoke primary Chairman admin status 👑");
      setTimeout(() => setToastMessage(""), 3000);
      return;
    }
    try {
      await useStore
        .getState()
        .toggleAdminStatus(activeLeagueId, memberId, currentRole);
      setToastMessage(
        currentRole === "admin"
          ? "Admin role revoked 📉"
          : "Promoted to Admin 👑",
      );
      setTimeout(() => setToastMessage(""), 3000);
    } catch (error) {
      console.error("Failed to toggle admin role:", error);
      setToastMessage("Error updating role");
      setTimeout(() => setToastMessage(""), 3000);
    }
  };
  useEffect(() => {
    if (!activeLeagueId) {
      navigate("/setup");
      return;
    }

    const hasDismissed = Boolean(
      localStorage.getItem("chairman_initialized_any") === "true" ||
      localStorage.getItem("chairman_initialized_global") === "true" ||
      (tutorialSeenKey && localStorage.getItem(tutorialSeenKey) === "true") ||
      (activeLeagueId && (
        localStorage.getItem(`chairman_initialized_${activeLeagueId}`) === "true" ||
        localStorage.getItem(`chairman_checklist_done_${activeLeagueId}`) === "true" ||
        (activeUserId && localStorage.getItem(`chairman_initialized_${activeLeagueId}_${activeUserId}`) === "true")
      ))
    );
    if (!hasDismissed && activeLeagueId) {
      setShowTutorial(true);
    } else {
      setShowTutorial(false);
    }

    // Real-time league doc listener — ensures league name/stake/rules update immediately on league switch
    const leagueRef = doc(db, "leagues", activeLeagueId);
    let bootstrapFetched = false;
    const unsubscribeLeague = onSnapshot(leagueRef, async (docSnap: any) => {
      if (!docSnap.exists()) {
        navigate("/setup");
        return;
      }
      const data = docSnap.data();
      setLeagueName(data.name || data.leagueName || "Unnamed League");
      setChairmanName(data.chairmanName || "");
      setInviteCode(data.inviteCode || "------");
      setMonthlyContribution(data.gameweekStake || 0);
      setCoAdminId(data.coAdminId || null);
      setChairmanId(data.chairmanId || null);
      setFirestoreGw(data.currentGwNumber || data.currentGw || null);
      setStartGw(data.startGw || null);
      if (data.rules) setRules(data.rules);

      // Fetch FPL bootstrap only once per mount
      if (!bootstrapFetched) {
        bootstrapFetched = true;
        try {
          const bootstrapRes = await fetch(`/fpl-api/bootstrap-static/`);
          if (bootstrapRes.ok) {
            const bootstrapData = await bootstrapRes.json();
            const events = bootstrapData?.events || [];
            const current = events.find((e: any) => e.is_current) || events.find((e: any) => e.is_next);
            const nextEvent = events.find((e: any) => e.is_next) || current;
            if (nextEvent?.deadline_time) {
              setNextDeadlineTime(nextEvent.deadline_time);
            }
            const fetchedGwId = Number(current?.id || 0) || null;
            let isEventFinished = Boolean(current?.finished === true && current?.data_checked === true);
            if (!isEventFinished && fetchedGwId) {
              try {
                const fixRes = await fetch(`/fpl-api/fixtures/?event=${fetchedGwId}`);
                if (fixRes.ok) {
                  const fixtures = await fixRes.json();
                  if (Array.isArray(fixtures) && fixtures.length > 0) {
                    const allDone = fixtures.every((f: any) =>
                      f.finished === true ||
                      f.finished_provisional === true ||
                      (f.kickoff_time && (Date.now() - new Date(f.kickoff_time).getTime()) > 135 * 60 * 1000)
                    );
                    if (allDone) isEventFinished = true;
                  }
                }
              } catch (e) {
                console.warn("[command-center] fixtures check skipped:", e);
              }
            }
            setIsCurrentEventFinished(isEventFinished);
            setCurrentGwNumber(fetchedGwId);
            const targetStartGw = isEventFinished ? (nextEvent?.id || (fetchedGwId ? fetchedGwId + 1 : 1)) : fetchedGwId;
            if (activeLeagueId) {
              const needsStartGwUpdate = !data.startGw || (isEventFinished && fetchedGwId && Number(data.startGw) <= Number(fetchedGwId));
              if (needsStartGwUpdate) {
                updateDoc(leagueRef, { startGw: targetStartGw }).catch(() => {});
                setStartGw(targetStartGw);
              }
            }
          }
        } catch (bootstrapErr: any) {
          console.warn("[command-center] bootstrap fetch skipped:", bootstrapErr?.message || bootstrapErr);
        }
      }

      // Fetch Live FPL Standings
      if (data.fplLeagueId) {
        setIsFplStandingsLoading(true);
        fetch(`/fpl-api/leagues-classic/${data.fplLeagueId}/standings/`)
          .then(async (res) => {
            if (!res.ok) throw new Error(`FPL Standings failed with status: ${res.status}`);
            return res.json();
          })
          .then((fplData) => {
            const results = fplData?.standings?.results;
            if (results && results.length > 0) {
              setRawFplStandings(results);
            }
          })
          .catch((err) => console.warn("Could not fetch FPL standings:", err?.message || err))
          .finally(() => setIsFplStandingsLoading(false));
      } else {
        setIsFplStandingsLoading(false);
      }

      setIsLoading(false);
    }, (err: any) => {
      console.error("Error watching league:", err);
      navigate("/setup");
    });

    listenToLeagueMembers(activeLeagueId);

    return () => unsubscribeLeague();
  }, [activeLeagueId, navigate, listenToLeagueMembers, tutorialSeenKey]);

  // Reactive calculation of live GW Winner — rigorously filters for funded, active, non-spectator members
  useEffect(() => {
    if (!rawFplStandings || rawFplStandings.length === 0 || members.length === 0) {
      if (rawFplStandings.length > 0 && members.length === 0) {
        // Members are still hydrating from Firestore, keep gwWinner pending without flashing fallbacks
        return;
      }
      setGwWinner(null);
      return;
    }

    const norm = (s: string) => String(s || "").toLowerCase().trim();
    const stake = gameweekStake || 0;

    const eligibleResults = rawFplStandings.filter((r: any) => {
      const dbMember = members.find((m: any) => {
        if (m.fplTeamId && Number(m.fplTeamId) === Number(r.entry)) return true;
        if (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(r.entry)) return true;
        const db = norm(m.displayName);
        return norm(r.player_name).includes(db) || db.includes(norm(r.player_name)) || norm(r.entry_name).includes(db);
      });
      if (!dbMember) return false;
      if (dbMember.isActive === false) return false;
      // Spectators are excluded from cash pot contention
      if ((dbMember as any).playMode === 'sidebets_only') return false;

      // Must be funded (paid dues or sufficient wallet balance)
      const isFunded = dbMember.hasPaid === true || (stake > 0 && (Number(dbMember.walletBalance || 0)) >= stake);
      return isFunded;
    });

    if (eligibleResults.length >= 2) {
      const sorted = [...eligibleResults].sort((a: any, b: any) => Number(b.event_total || 0) - Number(a.event_total || 0));
      const winner = sorted[0];
      const runnerUp = sorted[1];
      const leadMargin = Number(winner?.event_total || 0) - Number(runnerUp?.event_total || 0);
      setGwWinner({
        ...winner,
        runnerUpName: runnerUp?.player_name || runnerUp?.entry_name || '2nd Place',
        leadMargin: Math.max(0, leadMargin),
      });
    } else if (eligibleResults.length === 1) {
      const winner = eligibleResults[0];
      setGwWinner({
        ...winner,
        runnerUpName: 'Awaiting Contender',
        leadMargin: 0,
      });
    } else {
      setGwWinner(null);
    }
  }, [rawFplStandings, members, gameweekStake]);

  // Auto-cleanup duplicate member docs in Firestore (e.g. chairman registered both as admin and member)
  useEffect(() => {
    if (!activeLeagueId) return;
    const cleanupDuplicates = async () => {
      try {
        const { getDocs, collection: colRef, deleteDoc, doc: docRef } = await import('firebase/firestore');
        const snap = await getDocs(colRef(db, 'leagues', activeLeagueId, 'memberships'));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        const seen = new Map<string, any>();
        for (const m of docs) {
          const rawPhone = (m.phone || m.phoneNumber || '').replace(/\D/g, '');
          const cleanName = (m.displayName || '').trim().toLowerCase();
          const phoneKey = rawPhone.length >= 9 ? rawPhone.slice(-9) : '';
          const key = phoneKey ? `p_${phoneKey}` : (cleanName ? `n_${cleanName}` : '');
          if (!key) continue;

          if (seen.has(key)) {
            const existing = seen.get(key);
            if (existing.role === 'admin' && m.role !== 'admin') {
              await deleteDoc(docRef(db, 'leagues', activeLeagueId, 'memberships', m.id));
              console.log('[cleanup] Deleted redundant duplicate member doc:', m.id);
            } else if (m.role === 'admin' && existing.role !== 'admin') {
              await deleteDoc(docRef(db, 'leagues', activeLeagueId, 'memberships', existing.id));
              seen.set(key, m);
              console.log('[cleanup] Deleted redundant duplicate member doc:', existing.id);
            }
          } else {
            seen.set(key, m);
          }
        }
      } catch (err) {
        console.warn('[cleanup] Duplicate membership scan error:', err);
      }
    };
    cleanupDuplicates();
  }, [activeLeagueId]);

  // Listen for all payouts (pending + approved) for real-time UI state
  useEffect(() => {
    if (!activeLeagueId) return;
    const pendingRef = collection(
      db,
      "leagues",
      activeLeagueId,
      "pending_payouts",
    );
    // Listen to awaiting, approved, and forfeited so we can show the right UI state
    const q = query(
      pendingRef,
      where("status", "in", ["awaiting_approval", "approved", "forfeited"]),
    );
    const unsub = onSnapshot(q, (snap) => {
      setPendingPayouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeLeagueId]);

  const hasFinalGwChampion = Boolean(
    gwWinner && isCurrentEventFinished && Number(gwWinner.event_total) > 0,
  );
  // GW is already settled if there's a payout doc for the current GW number
  const gwAlreadySettled = pendingPayouts.some(
    (p: any) => Number(p.gw) === Number(currentGwNumber || 0) && currentGwNumber
  ) || (
    leagueSettings &&
    (leagueSettings as any).lastResolvedGw === currentGwNumber &&
    Boolean(currentGwNumber)
  );
  const tabCopy = {
    dashboard: {
      eyebrow: "Chairman priorities",
      title: "League Control Snapshot",
      description:
        "Quickly scan league risk, payout pressure, and funding health before executing actions below.",
    },
    ledger: {
      eyebrow: "Chairman ledger",
      title: "Payment Tracker",
      description:
        "See who is paid, who is unpaid, and fund wallets directly from this queue.",
    },
    finance: {
      eyebrow: "Chairman treasury",
      title: "Payments & Vault",
      description:
        "Keep invite actions in Overview while you track vault flow, settlement health, and live operations here.",
    },
  } as const;

  // Module 3B: Listen to pending disputes
  useEffect(() => {
    if (!activeLeagueId) return;
    const disputesRef = collection(db, "leagues", activeLeagueId, "disputes");
    const q = query(disputesRef, where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => {
      setPendingDisputes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeLeagueId]);

  // Listen to Pochi wallet requests
  useEffect(() => {
    if (!activeLeagueId) return;
    const reqRef = collection(db, "leagues", activeLeagueId, "wallet_requests");
    const q = query(reqRef, where("status", "==", "pending"), where("type", "==", "pochi_deposit"));
    const unsub = onSnapshot(q, (snap) => {
      setPendingPochiRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeLeagueId]);

  // Listen to league_events for real-time Operations Feed
  useEffect(() => {
    if (!activeLeagueId) return;
    const eventsRef = collection(db, "leagues", activeLeagueId, "league_events");
    const q = query(eventsRef, orderBy("timestamp", "desc"), limit(25));
    const unsub = onSnapshot(q, (snap) => {
      const isStaleEvent = (ev: any) => {
        const msg = String(ev.message || '');
        const type = String(ev.eventType || '');
        const combined = `${msg} ${type}`;
        if (/last\s*season/i.test(combined)) return true;
        const gwMatch = combined.match(/GW\s*(\d+)/i) || combined.match(/Gameweek\s*(\d+)/i);
        const eventGw = ev.gw ? Number(ev.gw) : (gwMatch ? Number(gwMatch[1]) : null);
        if (eventGw && eventGw >= 30) {
          const currentGw = currentGwNumber || firestoreGw || 4;
          if (currentGw < 25) return true;
        }
        return false;
      };

      const valid: any[] = [];
      snap.docs.forEach((d) => {
        const ev = { id: d.id, ...d.data() };
        if (isStaleEvent(ev)) {
          deleteDoc(d.ref).catch(() => {});
        } else {
          valid.push(ev);
        }
      });
      setLiveOpsEvents(valid.slice(0, 8));
    }, (err) => {
      console.warn("[ops-feed] league_events listener failed:", err?.message || err);
    });
    return () => unsub();
  }, [activeLeagueId, currentGwNumber, firestoreGw]);

  // Module 3B: Approve a dispute claim
  const handleApproveDispute = async (dispute: any) => {
    if (!activeLeagueId) return;
    setProcessingDispute(dispute.id);
    try {
      // Increment wallet and mark as paid
      await updateDoc(
        doc(db, "leagues", activeLeagueId, "memberships", dispute.memberId),
        {
          hasPaid: true,
          walletBalance: increment(dispute.amount),
        },
      );
      await updateDoc(
        doc(db, "leagues", activeLeagueId, "disputes", dispute.id),
        { status: "approved" },
      );
      // Notify the member
      await addDoc(collection(db, "leagues", activeLeagueId, "notifications"), {
        type: "success",
        message: `✅ Your payment dispute for KES ${dispute.amount?.toLocaleString()} has been approved by the Chairman. You are now funded.`,
        timestamp: serverTimestamp(),
        readBy: [],
      });
      showToast(`✅ Dispute approved for ${dispute.memberName}`);
    } catch (err: any) {
      console.error("Dispute approve error:", err);
      if (err?.code === "permission-denied") {
        showToast("🔒 Permission Denied: Only admins can approve disputes.");
      } else {
        showToast("Failed to approve dispute. Please try again.");
      }
    } finally {
      setProcessingDispute(null);
    }
  };

  // Module 3B: Reject a dispute claim
  const handleRejectDispute = async (dispute: any) => {
    if (!activeLeagueId) return;
    setProcessingDispute(dispute.id);
    try {
      await updateDoc(
        doc(db, "leagues", activeLeagueId, "disputes", dispute.id),
        { status: "rejected" },
      );
      await addDoc(collection(db, "leagues", activeLeagueId, "notifications"), {
        type: "warning",
        message: `⚠️ Your payment dispute (Receipt: ${dispute.receiptCode}) was reviewed and rejected. Contact your Chairman for more info.`,
        timestamp: serverTimestamp(),
        readBy: [],
      });
      showToast(`Dispute rejected for ${dispute.memberName}`);
    } catch (err: any) {
      console.error("Dispute reject error:", err);
      if (err?.code === "permission-denied") {
        showToast("🔒 Permission Denied: Only admins can reject disputes.");
      } else {
        showToast("Failed to reject dispute. Please try again.");
      }
    } finally {
      setProcessingDispute(null);
    }
  };

  const handleApprovePochi = async (req: any) => {
    if (!activeLeagueId) return;
    setProcessingPochi(req.id);
    try {
      // 1. Update member wallet
      await updateDoc(doc(db, "leagues", activeLeagueId, "memberships", req.memberId), {
        walletBalance: increment(req.amount),
        hasPaid: true, // simplified logic for now
      });
      // 2. Mark request as approved
      await updateDoc(doc(db, "leagues", activeLeagueId, "wallet_requests", req.id), {
        status: "approved"
      });
      // 3. Notify member
      await addDoc(collection(db, "leagues", activeLeagueId, "notifications"), {
        type: "success",
        message: `✅ Your Pochi deposit of KES ${req.amount?.toLocaleString()} has been approved. Your wallet is funded!`,
        timestamp: serverTimestamp(),
        readBy: [],
        targetMemberId: req.memberId,
      });
      showToast(`Pochi payment approved for ${req.memberName}`);
    } catch (err: any) {
      console.error("Pochi approve error:", err);
      showToast("Failed to approve Pochi payment.");
    } finally {
      setProcessingPochi(null);
    }
  };

  const handleRejectPochi = async (req: any) => {
    if (!activeLeagueId) return;
    setProcessingPochi(req.id);
    try {
      await updateDoc(doc(db, "leagues", activeLeagueId, "wallet_requests", req.id), {
        status: "rejected"
      });
      await addDoc(collection(db, "leagues", activeLeagueId, "notifications"), {
        type: "warning",
        message: `⚠️ Your Pochi deposit of KES ${req.amount?.toLocaleString()} was rejected. Please contact the Chairman.`,
        timestamp: serverTimestamp(),
        readBy: [],
        targetMemberId: req.memberId,
      });
      showToast(`Pochi payment rejected for ${req.memberName}`);
    } catch (err: any) {
      console.error("Pochi reject error:", err);
      showToast("Failed to reject Pochi payment.");
    } finally {
      setProcessingPochi(null);
    }
  };

  // Admin Tour - strictly once per user account
  useEffect(() => {
    if (!adminTourSeenKey || showTutorial || isLoading) return;
    const hasSeenTour =
      localStorage.getItem("hasSeenAdminTour_any") === "true" ||
      localStorage.getItem(adminTourSeenKey) === "true" ||
      (activeLeagueId && localStorage.getItem(`hasSeenAdminTour_${activeLeagueId}`) === "true");

    const markTourDone = () => {
      localStorage.setItem(adminTourSeenKey, "true");
      localStorage.setItem("hasSeenAdminTour_any", "true");
      if (activeLeagueId) localStorage.setItem(`hasSeenAdminTour_${activeLeagueId}`, "true");
    };

    if (!hasSeenTour) {
      try {
        const driverObj = driver({
          showProgress: true,
          smoothScroll: true,
          animate: true,
          overlayOpacity: 0.75,
          stagePadding: 12,
          stageRadius: 16,
          popoverClass: "fc-driver-popover",
          nextBtnText: "Next →",
          prevBtnText: "← Back",
          doneBtnText: "Get Started ✨",
          onDestroyStarted: () => {
            markTourDone();
            driverObj.destroy();
          },
          onNextClick: (_element: any, _step: any, options: any) => {
            const activeIndex = options?.state?.activeIndex ?? 0;
            if (activeIndex === 0) {
              setActiveTab("ledger");
              window.setTimeout(() => options.driver.moveNext(), 400);
              return;
            }
            if (activeIndex === 1) {
              setActiveTab("finance");
              window.setTimeout(() => options.driver.moveNext(), 400);
              return;
            }
            options.driver.moveNext();
          },
          onPrevClick: (_element: any, _step: any, options: any) => {
            const activeIndex = options?.state?.activeIndex ?? 0;
            if (activeIndex === 1) {
              setActiveTab("dashboard");
              window.setTimeout(() => options.driver.movePrevious(), 400);
              return;
            }
            if (activeIndex === 2) {
              setActiveTab("ledger");
              window.setTimeout(() => options.driver.movePrevious(), 400);
              return;
            }
            options.driver.movePrevious();
          },
          steps: [
            {
              element: "#tour-add-member",
              popover: {
                title: "🏠 Overview — Your Command Center",
                description:
                  "This is your primary command center. Monitor live GW leaders, pending payouts, and the financial health of your chama at a glance.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#master-ledger",
              popover: {
                title: "📋 Master Ledger — Member Balances",
                description:
                  "See every member's wallet balance, M-Pesa phone number, and contribution status in real time. Record deposits manually or track auto-funded players.",
                side: "top",
                align: "start",
              },
            },
            {
              element: "#tour-finance-ops",
              popover: {
                title: "💸 Finance & Ops — Chama Vault",
                description:
                  "Track live weekly pots, season jackpot growth, and disburse payouts directly via M-Pesa. Everything financial is protected and verified here.",
                side: "top",
                align: "start",
              },
            },
          ],
        });
        driverObj.drive();
        markTourDone();
      } catch (e) {
        console.error("Tour failed to load", e);
      }
    }
  }, [adminTourSeenKey, isLoading, showTutorial, activeLeagueId]);

  const handleTogglePayment = async (
    memberId: string,
    currentStatus: boolean,
    memberName: string,
  ) => {
    if (!activeLeagueId) return;
    try {
      await togglePaymentStatusGlobal(
        activeLeagueId,
        memberId,
        currentStatus,
        gameweekStake,
      );
      haptics.success();
      showToast(
        !currentStatus
          ? `Manual Deposit: Added KES ${gameweekStake} to ${memberName}`
          : `Manual Reversal: Removed KES ${gameweekStake} from ${memberName}`,
      );

      // If we are marking them as paid
      if (!currentStatus) {
        const adminId = localStorage.getItem("activeUserId") || "chairman";
        const notifsRef = collection(
          db,
          "leagues",
          activeLeagueId,
          "notifications",
        );
        await addDoc(notifsRef, {
          type: "success",
          message: `Deposit verified for ${memberName}. Account is now funded.`,
          timestamp: serverTimestamp(),
          readBy: [adminId], // Admin has already read it basically
          targetMemberId: memberId,
        });

        // Write Deposit Transaction to Ledger
        const targetMember = members.find((m) => m.id === memberId);
        const txRef = collection(db, "leagues", activeLeagueId, "transactions");
        await addDoc(txRef, {
          type: "deposit",
          winnerName: memberName,
          memberName: memberName,
          phoneNumber: targetMember?.phone || "",
          amount: gameweekStake,
          gameweek: currentGwNumber || firestoreGw || null,
          gw: currentGwNumber || firestoreGw || null,
          timestamp: serverTimestamp(),
          receiptId:
            "DEP" + Math.random().toString(36).substring(2, 10).toUpperCase(),
        });

        await recordOperationEvent({
          title: "Manual deposit verified",
          message: `Manual deposit recorded for ${memberName}: KES ${Number(gameweekStake || 0).toLocaleString()}.`,
          targetMemberId: memberId,
          type: "success",
        });
      } else {
        const adminId = localStorage.getItem("activeUserId") || "chairman";
        const notifsRef = collection(
          db,
          "leagues",
          activeLeagueId,
          "notifications",
        );
        await addDoc(notifsRef, {
          type: "warning",
          message: `Payment reversal recorded for ${memberName}. The deposit was cancelled and recorded for audit.`,
          timestamp: serverTimestamp(),
          readBy: [adminId],
          targetMemberId: memberId,
        });

        const targetMember = members.find((m) => m.id === memberId);
        const txRef = collection(db, "leagues", activeLeagueId, "transactions");
        await addDoc(txRef, {
          type: "ledger_adjustment",
          source: "manual_reversal",
          amount: gameweekStake ? -gameweekStake : 0,
          memberId,
          memberName,
          phoneNumber: targetMember?.phone || "",
          receiptId:
            "REV" + Math.random().toString(36).substring(2, 10).toUpperCase(),
          note: `Chairman cancelled a mistaken deposit for ${memberName}.`,
          timestamp: serverTimestamp(),
        });

        await recordOperationEvent({
          title: "Ledger adjustment recorded",
          message: `Manual reversal recorded for ${memberName}: KES ${Number(gameweekStake || 0).toLocaleString()}.`,
          targetMemberId: memberId,
          type: "warning",
        });
      }
    } catch (error) {
      console.error("Error toggling payment", error);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleSendReaction = async (emoji: string) => {
    if (!activeLeagueId || !gwWinner) return;
    haptics.celebrate();
    try {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FBBF24', '#10B981', '#F59E0B', '#FFFFFF'],
      });
    } catch {}

    const winnerFirstName = (gwWinner.player_name || 'Champion').split(' ')[0];
    const senderName = 'Chairman';

    try {
      const notifRef = collection(db, 'leagues', activeLeagueId, 'notifications');
      await addDoc(notifRef, {
        type: 'champion_reaction',
        emoji,
        message: `${senderName} sent ${emoji} props to ${winnerFirstName} for GW${currentGwNumber || ''}!`,
        fromName: senderName,
        fromId: auth.currentUser?.uid || 'chairman',
        toWinner: gwWinner.player_name,
        winnerId: gwWinner.id || null,
        gw: currentGwNumber || null,
        timestamp: serverTimestamp(),
      });

      const eventsRef = collection(db, 'leagues', activeLeagueId, 'league_events');
      addDoc(eventsRef, {
        type: 'champion_reaction',
        eventType: 'reaction',
        emoji,
        message: `${senderName} reacted with ${emoji} to ${winnerFirstName}`,
        actor: senderName,
        toWinner: gwWinner.player_name,
        gw: currentGwNumber || null,
        timestamp: serverTimestamp(),
      }).catch(() => {});

      showToast(`Sent ${emoji} props to ${winnerFirstName}!`);
    } catch (err) {
      console.warn('[reaction] could not save:', err);
      showToast(`Sent ${emoji} props to ${winnerFirstName}!`);
    }
  };

  // Dynamic Calculations
  // Math scales properly natively since `members` array is reactive via useStore (which listens to Firestore)
  const memberHasFunding = (member: any) => {
    return (
      member.isActive !== false &&
      (member.hasPaid === true ||
        (gameweekStake > 0 && (member.walletBalance || 0) >= gameweekStake))
    );
  };

  const isPendingMember = (m: any) =>
    m.isActive !== false &&
    !memberHasFunding(m) &&
    (m.isPending === true || (!m.phone && !m.phoneNumber));

  const filteredMembers = members.filter((m) => {
    if (m.isActive === false || isPendingMember(m)) return false;
    if (paymentFilter === "Verified") return memberHasFunding(m);
    if (paymentFilter === "Red Zone") return !memberHasFunding(m) && (m as any).playMode !== "sidebets_only";
    return true;
  });

  const fundedMembersCount = members.filter(memberHasFunding).length;
  const activeMembersCount = members.filter(
    (m) => m.isActive !== false && !isPendingMember(m) && (m as any).playMode !== "sidebets_only",
  ).length;
  const totalSecured = fundedMembersCount * gameweekStake;
  const exactCurrentGwFormula = `${fundedMembersCount} × KES ${Number(gameweekStake || 0).toLocaleString()} = KES ${Number(totalSecured || 0).toLocaleString()}`;

    useEffect(() => {
      if (
        showAddMemberModal ||
        showPrefundOptions ||
        showResolveModal ||
        showWalletFundModal
      ) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, [showAddMemberModal, showPrefundOptions, showResolveModal, showWalletFundModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddMemberModal) setShowAddMemberModal(false);
        if (showPrefundOptions) setShowPrefundOptions(false);
        if (showResolveModal) setShowResolveModal(false);
        if (showWalletFundModal) setShowWalletFundModal(false);
        if (showHqSettlementForm) setShowHqSettlementForm(false);
        if (showTutorial) setShowTutorial(false);
        if (showOpsModal) setShowOpsModal(false);
        if (resolveTargetGw !== null) setResolveTargetGw(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddMemberModal, showPrefundOptions, showResolveModal, showWalletFundModal, showHqSettlementForm, showTutorial, showOpsModal, resolveTargetGw]);
  const redZoneMembers = members.filter(
    (m) => !memberHasFunding(m) && m.role !== "admin" && m.isActive !== false && (m as any).playMode !== "sidebets_only",
  );
  const allPayableMembersFunded =
    activeMembersCount > 0 && fundedMembersCount === activeMembersCount;
  const totalCollected = totalSecured;
  const weeklyPot = totalCollected * (rules.weekly / 100);
  // Effective startGw: use startGw from state or leagueSettings
  // If the current event already concluded without any approved payouts in this chama,
  // the league officially begins at the next upcoming gameweek (e.g. GW5).
  // All prior gameweeks (GW1..4) are strictly voided (pre-league).
  const hasCurrentGwApprovedPayout = pendingPayouts.some(
    (p: any) => Number(p.gw) === (currentGwNumber || 0) && p.status === 'approved'
  );
  const nextPlayableGw = isCurrentEventFinished && currentGwNumber ? currentGwNumber + 1 : (currentGwNumber || firestoreGw || 1);
  const rawStartGw = Number(startGw || (leagueSettings as any)?.startGw || 0);
  const effectiveStartGw = Number(
    (rawStartGw && rawStartGw <= (currentGwNumber || 0) && isCurrentEventFinished && !hasCurrentGwApprovedPayout)
      ? Math.max(rawStartGw, nextPlayableGw)
      : (rawStartGw || nextPlayableGw || 1)
  );
  // Pre-league gameweeks prior to effectiveStartGw are automatically voided/forfeited
  const preLeagueGws = effectiveStartGw > 1 ? Array.from({ length: effectiveStartGw - 1 }, (_, i) => i + 1) : [];
  const forfeitedGws: number[] = Array.from(new Set([
    ...preLeagueGws,
    ...((leagueSettings as any)?.forfeitedGws || []),
    ...pendingPayouts.filter((p: any) => p.status === 'forfeited').map((p: any) => Number(p.gw))
  ]));
  const totalGwsThroughNow = (currentGwNumber || firestoreGw) ? Math.max(0, (currentGwNumber || firestoreGw || 1) - effectiveStartGw + (isCurrentEventFinished ? 1 : 0)) : 0;
  const gwPlayed = Math.max(0, totalGwsThroughNow - forfeitedGws.filter(g => g >= effectiveStartGw && g <= (currentGwNumber || firestoreGw || 38)).length);
  const vaultPerGw = totalCollected * (rules.vault / 100);
  // Season vault: Includes past played GWs vault + current GW secured vault allocation (40% of current GW collections immediately allocated even before release)
  const currentGwVaultSecured = totalCollected * (rules.vault / 100);
  const pastGwsVaultSecured = vaultPerGw * gwPlayed;
  const seasonVault = pastGwsVaultSecured + currentGwVaultSecured;
  const projectedRemainingGws = Math.max(0, 38 - (currentGwNumber || firestoreGw || 1));
  const projectedRemainingGross = projectedRemainingGws * Math.max(1, activeMembersCount) * (gameweekStake || 0);
  const projectedSeasonVault = Math.round((totalCollected + projectedRemainingGross) * (rules.vault / 100));
  const currentMember = members.find((m) => m.id === activeUserId || m.authUid === activeUserId || (auth.currentUser?.uid && m.authUid === auth.currentUser.uid));
  const isCoChairSession = (!!coAdminId && (coAdminId === activeUserId || (auth.currentUser?.uid && coAdminId === auth.currentUser.uid))) || (currentMember?.role === "co-chair");
  // highRiskTwoWeekMisses available via members.filter(...) if needed in future
  const sortedPendingPayouts = [...pendingPayouts]
    .filter((p: any) => p.status === "awaiting_approval")
    .sort((a: any, b: any) => {
      const aTs = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const bTs = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return aTs - bTs;
    });
  const getEffectiveApprovalTarget = (payout: any) => {
    if (payout.approvalTarget === "chairman") return "chairman";
    if (payout.approvalTarget === "co-chair" && hasValidCoChair)
      return "co-chair";
    return hasValidCoChair ? "co-chair" : "chairman";
  };
  const monthlySettlementDay = new Date().getDate();
  const isMonthlySettlementWindow =
    monthlySettlementDay >= 25 || monthlySettlementDay <= 5;
  const shouldShowHqStep =
    isMonthlySettlementWindow ||
    pendingHQDebt > 0 ||
    Boolean(latestHqSettlement);
  const isHqSettled =
    pendingHQDebt <= 0 || latestHqSettlement?.status === "approved";
  // @ts-ignore
  const isTimelineComplete =
    actionTimeline.resolved &&
    !actionTimeline.approvalPending &&
    actionTimeline.payoutSent &&
    actionTimeline.confirmed &&
    (!shouldShowHqStep || isHqSettled);
  // @ts-ignore
  const timelineSteps = [
    {
      key: "resolved",
      label: "Resolve GW",
      hint: "Lock the winner after FPL marks the week as finished.",
      active: actionTimeline.resolved,
    },
    {
      key: "approval",
      label: "Approval Pending",
      hint: "Approve pending payouts or route them to cash handoff.",
      active: actionTimeline.approvalPending,
    },
    {
      key: "sent",
      label: "Payout Sent",
      hint: "Dispatch to M-Pesa or confirm cash handoff.",
      active: actionTimeline.payoutSent,
    },
    {
      key: "confirmed",
      label: "Confirmed",
      hint: "Winner gets notified and ledger is updated.",
      active: actionTimeline.confirmed,
    },
    {
      key: "hq-settled",
      label: "Monthly Fee Paid",
      hint: "Monthly step: submit HQ receipt in the month-end window.",
      active: actionTimeline.confirmed && isHqSettled,
    },
  ].filter((step) => step.key !== "hq-settled" || shouldShowHqStep);

  const scrollToSection = (id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shareInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    const appUrl = (typeof window !== "undefined" && window.location.origin) ? window.location.origin : (import.meta.env.VITE_APP_URL || "https://fantasy-chama.vercel.app");
    const link = `${appUrl}/login?code=${inviteCode}`;
    const host = chairmanName || members.find(m => m.role === 'admin' || m.role === 'chairman')?.displayName || auth.currentUser?.displayName || localStorage.getItem('activeUserName') || localStorage.getItem('fc-setup-fullName') || "The Chairman";
    const lName = leagueName || "our FPL Chama";
    const message = `You're invited by ${host} to join *${lName}* on Fantasy Chama!\n\nWin weekly cash prizes and compete for the end-of-season jackpot. Points and rankings update automatically after every gameweek.\n\nJoin here: ${link}\nLeague Code: *${inviteCode}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    showToast("Invite link copied & WhatsApp opened!");
  };

  const shareWalletFundingReceipt = (payload: {
    memberName: string;
    amount: number;
    method: "mpesa" | "cash";
    receiptId: string;
    cashDate?: string;
  }) => {
    const appUrl = (typeof window !== "undefined" && window.location.origin) ? window.location.origin : (import.meta.env.VITE_APP_URL || "https://fantasy-chama.vercel.app");
    const message = [
      `🧾 *${leagueName} Wallet Funding Receipt*`,
      "",
      `👤 Member: *${payload.memberName}*`,
      `💰 Amount: *KES ${payload.amount.toLocaleString()}*`,
      `💳 Method: *${payload.method === "mpesa" ? "M-Pesa" : "Cash Handoff"}*`,
      `🔖 Receipt: *${payload.receiptId}*`,
      payload.cashDate ? `📅 Cash Date: *${payload.cashDate}*` : "",
      "",
      `🔗 ${appUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const openAddMemberModal = () => {
    setTimeout(() => {
      setShowAddMemberModal(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  };

  const openPrefundModal = () => {
    setShowAddMemberModal(false);
    setShowWalletFundModal(false);
    setShowResolveModal(false);
    setPrefundData({});
    // Defer by one tick to escape the scroll-lock useEffect race that caused the freeze
    setTimeout(() => {
      setShowPrefundOptions(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  };

  // @ts-ignore
  const handleTimelineStepTap = (stepKey: string) => {
    if (stepKey === "resolved") {
      if (!hasFinalGwChampion) {
        showToast(
          "Resolution unlocks once FPL marks the gameweek as finished.",
        );
        return;
      }
      setTimeout(() => setShowResolveModal(true), 0);
      showToast("Resolve modal opened. Confirm payout method and proceed.");
      return;
    }

    if (stepKey === "approval") {
      if (pendingPayouts.length === 0) {
        showToast("No payout approvals are pending right now.");
        return;
      }
      setActiveTab("dashboard");
      setTimeout(() => scrollToSection("pending-payout-queue"), 150);
      showToast("Jumped to approval queue. Choose M-Pesa or cash handoff.");
      return;
    }

    if (stepKey === "sent" || stepKey === "confirmed") {
      setActiveTab("ledger");
      setPaymentFilter("Verified");
      setTimeout(() => scrollToSection("master-ledger"), 150);
      showToast("Viewing verified payouts and ledger confirmation trail.");
      return;
    }

    if (stepKey === "hq-settled") {
      if (pendingHQDebt <= 0 && latestHqSettlement?.status !== "submitted") {
        showToast("HQ is already settled for the current monthly cycle.");
        return;
      }
      setShowHqSettlementForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      showToast("HQ receipt form opened for the monthly settlement step.");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLeagueId || !newMemberName || !newMemberPhone) return;

    setIsAddingMember(true);
    try {
      const membershipsRef = collection(
        db,
        "leagues",
        activeLeagueId,
        "memberships",
      );
      const dataToSave: any = {
        displayName: newMemberName,
        phone: newMemberPhone,
        fplTeamName: newMemberTeam,
        hasPaid: false,
        role: "member",
        playMode: newMemberPlayMode,
        avatarSeed: Math.random().toString(36).substring(7),
        joinedAt: serverTimestamp(),
      };
      if (newMemberFplId)
        dataToSave.fplEntryId = Number(newMemberFplId);
      if (newMemberSecondTeam)
        dataToSave.secondFplTeamId = Number(newMemberSecondTeam);

      await addDoc(membershipsRef, dataToSave);
      setShowAddMemberModal(false);
      setNewMemberName("");
      setNewMemberPhone("");
      setNewMemberTeam("");
      setNewMemberFplId("");
      setNewMemberSecondTeam("");
      setNewMemberPlayMode("pot");

      // Send Notification
      const notifsRef = collection(
        db,
        "leagues",
        activeLeagueId,
        "notifications",
      );
      await addDoc(notifsRef, {
        type: "info",
        message: `${newMemberName} has joined the league! Welcome to FantasyChama.`,
        timestamp: serverTimestamp(),
        readBy: [],
      });

      showToast(`${newMemberName} manually added to the ledger!`);
    } catch (error) {
      console.error("Error adding member:", error);
      showToast("Failed to add member.");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleMemberNudge = (member: any) => {
    const appUrl = window.location.origin;
    const hoursLeft = nextDeadlineTime ? Math.max(0, Math.round((new Date(nextDeadlineTime).getTime() - Date.now()) / (1000 * 60 * 60))) : null;
    const hoursText = hoursLeft !== null ? (hoursLeft > 0 ? `⏳ *~${hoursLeft} hours remaining until deadline*` : `⏳ *Deadline cutoff in progress!*`) : `⏳ *Gameweek deadline approaching*`;
    const pochiText = leagueSettings?.paymentDetails || leagueSettings?.pochiNumber || leagueSettings?.chairmanPhone || '';
    const weeklyPot = Math.round((members.filter(m => m.hasPaid && m.isActive !== false).length || 1) * gameweekStake * (rules.weekly / 100));

    const message = [
      `🚨 *${leagueName} — GW${currentGwNumber || firestoreGw || ''} Deadline Nudge*`,
      ``,
      `Habari *${member.displayName}*! 👋`,
      hoursText,
      `Your *KES ${gameweekStake.toLocaleString()}* stake for Gameweek ${currentGwNumber || firestoreGw || ''} is still pending in the Red Zone.`,
      ``,
      `Don't get locked out of this week's *KES ${weeklyPot.toLocaleString()}* cash prize! 🏆`,
      pochiText ? `📱 Send to Chairman Pochi: *${pochiText}*` : '',
      `👉 Fund wallet instantly: ${appUrl}/dashboard`,
    ].filter(Boolean).join('\n');

    if (member.phone) {
      const phone = member.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    }
    showToast(`Nudged ${member.displayName} via WhatsApp.`);
  };

  const handleBulkNudge = async () => {
    if (!activeLeagueId) return;

    const redZoneMembers = members.filter(
      (m) => !memberHasFunding(m) && m.role !== "admin" && m.isActive !== false && (m as any).playMode !== "sidebets_only",
    );

    if (redZoneMembers.length === 0) {
      showToast("No members in the Red Zone.");
      return;
    }

    const appUrl = window.location.origin;
    const hoursLeft = nextDeadlineTime ? Math.max(0, Math.round((new Date(nextDeadlineTime).getTime() - Date.now()) / (1000 * 60 * 60))) : null;
    const hoursText = hoursLeft !== null ? (hoursLeft > 0 ? `⏳ *~${hoursLeft} hours remaining until deadline*` : `⏳ *Deadline cutoff in progress!*`) : `⏳ *Gameweek deadline approaching*`;
    const pochiText = leagueSettings?.paymentDetails || leagueSettings?.pochiNumber || leagueSettings?.chairmanPhone || '';
    const totalPotAtStake = (members.filter(m => m.isActive !== false && (m as any).playMode !== "sidebets_only").length) * (gameweekStake || 0);
    const weeklyPrize = Math.round(totalPotAtStake * (rules.weekly / 100));

    const message = [
      `🚨 *${leagueName.toUpperCase()} — RED ZONE WAKE UP CALL* 🚨`,
      ``,
      hoursText,
      `Kuna watu wanataka kucheza na jasho ya watu! 😂 Hawa wafuatao ${redZoneMembers.length} bado hawajatoa stake ya KES ${gameweekStake.toLocaleString()}:`,
      ``,
      ...redZoneMembers.map((m, idx) => `${idx + 1}. *${m.displayName}* (${m.teamName || 'FPL Team'})`),
      ``,
      `💰 Weekly Cash Pot: *KES ${weeklyPrize.toLocaleString()}*`,
      pochiText ? `📱 Tuma kakitu via Pochi / M-Pesa: *${pochiText}*` : '',
      ``,
      `⚠️ *Kumbuka: Kama hujaweka kakitu, scores zitakuwa blurred na huwezi kula pot ata ukipata 100 points!*`,
      `👉 Lipa chap chap hapa: ${appUrl}/dashboard`
    ].filter(Boolean).join('\n');
    
    // Open synchronously to avoid browser popup blockers
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    showToast("Bulk Nudge blast opened for WhatsApp.");

    setNudgeSent(true);
    setTimeout(() => setNudgeSent(false), 2000);

    // Process notifications in the background
    Promise.allSettled(redZoneMembers.map(member => {
        const notifsRef = collection(
          db,
          "leagues",
          activeLeagueId,
          "notifications",
        );
        return addDoc(notifsRef, {
          type: "warning",
          message: `URGENT Chairman Nudge: Gameweek Deadline approaching. Please complete your active Gameweek contribution to avoid being locked out.`,
          timestamp: serverTimestamp(),
          readBy: [],
          targetMemberId: member.id,
        });
    })).catch(err => console.error("Failed to bulk nudge", err));
  };

  const handlePrefundSubmit = async () => {
    if (!activeLeagueId) {
      showToast("League is still loading. Try again in a moment.");
      return;
    }
    const entries = Object.entries(prefundData)
      .filter(([_, amount]) => Number(amount) > 0)
      .map(([memberId, amount]) => ({ memberId, amount: Number(amount) }));

    if (entries.length === 0) {
      showToast("Enter amounts for at least one member.");
      return;
    }

    setIsPrefunding(true);
    console.log("[prefund] Starting seed for", entries.length, 'members');
    try {
      const seededMembers: any[] = [];
      
      for (const { memberId, amount } of entries) {
        const member = members.find((item) => item.id === memberId);
        if (!member) {
          console.warn('[prefund] Member not found:', memberId);
          continue;
        }
        
        const currentWallet = Number(member?.walletBalance ?? 0);
        const nextWallet = Math.max(0, currentWallet + amount);
        const walletCoversStake = gameweekStake > 0 ? nextWallet >= gameweekStake : nextWallet > 0;
        const shouldIncreaseStreak = walletCoversStake && !(member as any)?.hasPaid;

        console.log('[prefund] Seeding', member.displayName, '- Current:', currentWallet, 'Add:', amount, 'New:', nextWallet, 'Covers:', walletCoversStake);

        // Update membership doc
        await updateDoc(doc(db, "leagues", activeLeagueId, "memberships", memberId), {
          walletBalance: increment(amount),
          hasPaid: walletCoversStake,
          paymentStreak: increment(shouldIncreaseStreak ? 1 : 0),
        });

        // Create transaction record
        await addDoc(collection(db, "leagues", activeLeagueId, "transactions"), {
          type: "wallet_funding",
          source: "legacy_seed",
          amount,
          userId: memberId,
          memberId,
          memberName: member?.displayName || "Member",
          winnerName: member?.displayName || "Member",
          phoneNumber: member?.phone || "",
          receiptId: `SEED_${Date.now().toString().slice(-6)}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          note: "ADMIN_PREFUND • Pilot pre-fund wallet seed",
          timestamp: serverTimestamp(),
        });

        seededMembers.push({
          id: memberId,
          name: member?.displayName,
          walletDelta: amount,
          hasPaid: walletCoversStake,
        });
      }

      console.log('[prefund] Successfully seeded', seededMembers.length, 'members');

      // Record operation event if toggle is enabled
      if (prefundUpdateRecentActivity) {
        console.log('[prefund] Recording operation event for recent activity');
        await recordOperationEvent({
          title: "Pilot pre-fund completed",
          message: `✅ Bulk legacy wallet seed applied to ${seededMembers.length} member${seededMembers.length === 1 ? '' : 's'}. Wallets updated: ${seededMembers.map(m => `${m.name} +KES ${m.walletDelta.toLocaleString()}`).join(', ')}. No new Daraja prompts triggered.`,
          type: "success",
        });
      }

      showToast(`✅ Pilot Pre-Fund Complete! ${seededMembers.length} wallet${seededMembers.length === 1 ? '' : 's'} seeded.`);
      setShowPrefundOptions(false);
      setPrefundData({});
      setPrefundUpdateRecentActivity(true);
      // Full-screen Robinhood-style confetti
      const end = Date.now() + 2000;
      const frame = () => {
        confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ['#10B981','#FBBF24','#FFFFFF','#60a5fa'] });
        confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ['#10B981','#FBBF24','#FFFFFF','#f472b6'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    } catch (err: any) {
      console.error("[prefund] Error:", err);
      showToast(`❌ Prefund Failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsPrefunding(false);
    }
  };

  const handlePrefundCancel = () => {
    setIsPrefunding(false);
    setShowPrefundOptions(false);
    setPrefundData({});
  };

  const openWalletFundModal = (memberId?: string) => {
    setFundTargetMemberId(memberId || "");
    setFundAmount("");
    setFundMethod("mpesa");
    setFundTransactionCode("");
    setFundCashDate(new Date().toISOString().slice(0, 10));
    setFundNote("");
    setFundPromptSent(false);
    setShowWalletFundModal(true);
  };

  const openEditMemberModal = (member: any) => {
    setEditTargetMemberId(member.id);
    setEditMemberName(member.displayName || '');
    setEditMemberPhone(member.phone || '');
    setEditMemberFplId(String(member.fplTeamId || ''));
    setEditMemberPlayMode((member as any).playMode || 'pot');
    setIsSavingMemberEdit(false);
    setShowEditMemberModal(true);
  };

  const handleSaveMemberEdit = async () => {
    if (!activeLeagueId || !editTargetMemberId) return;
    setIsSavingMemberEdit(true);
    try {
      const updates: Record<string, any> = {};
      if (editMemberPhone) {
        updates.phone = editMemberPhone;
        updates.phoneNumber = editMemberPhone;
        updates.isPending = false;
        updates.isActive = true;
      }
      if (editMemberFplId) updates.fplTeamId = Number(editMemberFplId);
      if (editMemberName) updates.displayName = editMemberName;
      updates.playMode = editMemberPlayMode;
      await import('firebase/firestore').then(({ updateDoc, doc }) =>
        updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', editTargetMemberId), updates)
      );
      await recordOperationEvent({
        title: 'Member Profile Updated',
        message: `Chairman updated profile for ${editMemberName}: mode=${editMemberPlayMode === 'sidebets_only' ? 'Spectator' : 'Cash Pot'}, phone=${editMemberPhone || '—'}, FPL=${editMemberFplId || '—'}`,
        targetMemberId: editTargetMemberId,
        type: 'info',
      });
      showToast('Member profile updated ✅');
      setShowEditMemberModal(false);
    } catch (e: any) {
      showToast('Failed to update: ' + (e.message || 'Unknown error'));
    } finally {
      setIsSavingMemberEdit(false);
    }
  };

  const handleToggleSpectator = async (memberId: string, currentPlayMode?: string) => {
    if (!activeLeagueId || !memberId) return;
    const newMode = currentPlayMode === 'sidebets_only' ? 'pot' : 'sidebets_only';
    try {
      await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', memberId), {
        playMode: newMode
      });
      showToast(newMode === 'sidebets_only' ? 'Member switched to Spectator (1v1 bets only) 👁️' : 'Member enrolled in Weekly & Season Cash Pot 🏆');
    } catch (e: any) {
      showToast('Failed to update status: ' + (e?.message || 'Error'));
    }
  };

  const handleExecuteCleanSlate = async () => {
    if (!activeLeagueId) return;
    if (cleanSlateConfirmText.trim().toUpperCase() !== 'RESET') {
      showToast('Please type RESET to confirm.');
      return;
    }
    setIsExecutingCleanSlate(true);
    try {
      const targetGw = Number(cleanSlateTargetGw) || 10;
      
      // 1. Reset all memberships
      const membershipsRef = collection(db, 'leagues', activeLeagueId, 'memberships');
      const membersSnap = await getDocs(membershipsRef);
      const batch = writeBatch(db);
      membersSnap.docs.forEach((mDoc) => {
        batch.update(mDoc.ref, {
          walletBalance: 0,
          hasPaid: false,
          paymentStreak: 0,
          lastPaymentGw: null,
          joinedAtGw: targetGw,
          nextDueAt: null,
          dueAt: null,
        });
      });
      // Update league settings
      const leagueDocRef = doc(db, 'leagues', activeLeagueId);
      batch.update(leagueDocRef, {
        startGw: targetGw,
        currentGw: targetGw,
        vaultBalance: 0,
        totalPot: 0,
        lastResetAt: serverTimestamp(),
        createdAt: Date.now(),
      });
      await batch.commit();

      // 2. Clear subcollections
      const subcollections = [
        'transactions',
        'side_bets',
        'gw_settlements',
        'hq_settlements',
        'pending_payouts',
        'wallet_topup_requests',
        'payouts',
        'league_events'
      ];
      for (const sub of subcollections) {
        try {
          const subSnap = await getDocs(collection(db, 'leagues', activeLeagueId, sub));
          if (!subSnap.empty) {
            const subBatch = writeBatch(db);
            subSnap.docs.forEach(d => subBatch.delete(d.ref));
            await subBatch.commit();
          }
        } catch (subErr) {
          console.warn(`[clean-slate] clear ${sub} skipped:`, subErr);
        }
      }

      // 3. Post notification
      await addDoc(collection(db, 'leagues', activeLeagueId, 'notifications'), {
        type: 'info',
        message: `🔄 Clean Slate Activated: All wallet balances and transactions reset. Season officially starting from Gameweek ${targetGw}!`,
        timestamp: serverTimestamp(),
        readBy: [],
      });

      setShowCleanSlateModal(false);
      setCleanSlateConfirmText('');
      showToast(`Clean slate complete! League reset to GW${targetGw} ✅`);
    } catch (err: any) {
      console.error('[clean-slate] Failed:', err);
      showToast('Clean slate failed: ' + (err?.message || 'Error'));
    } finally {
      setIsExecutingCleanSlate(false);
    }
  };

  const handleDeleteMember = (memberId: string, memberName: string) => {
    setMemberToDelete({ id: memberId, name: memberName });
  };

  const confirmDeleteMember = async () => {
    if (!activeLeagueId || !memberToDelete) return;
    setIsDeletingMember(true);
    try {
      const { deleteDoc, doc: docRef } = await import('firebase/firestore');
      await deleteDoc(docRef(db, 'leagues', activeLeagueId, 'memberships', memberToDelete.id));
      showToast(`Removed ${memberToDelete.name} from league.`);
      setMemberToDelete(null);
    } catch (e: any) {
      showToast('Failed to remove: ' + (e.message || 'Unknown error'));
    } finally {
      setIsDeletingMember(false);
    }
  };

  useEffect(() => {
    const pendingWalletVerifyRaw = localStorage.getItem('fc-open-wallet-fund-target');
    if (!pendingWalletVerifyRaw) return;

    try {
      const parsed = JSON.parse(pendingWalletVerifyRaw);
      if (parsed?.memberId) {
        openWalletFundModal(parsed.memberId);
        if (parsed.amount) setFundAmount(String(parsed.amount));
        if (parsed.note) setFundNote(String(parsed.note));
        if (parsed.method === 'cash' || parsed.method === 'mpesa') {
          setFundMethod(parsed.method);
        }
      }
    } catch (error) {
      console.warn('[admin-command] wallet verify handoff parse failed:', error);
    } finally {
      localStorage.removeItem('fc-open-wallet-fund-target');
    }
  }, [activeLeagueId]);

  const handleSendWalletPrompt = async () => {
    if (!activeLeagueId || !fundTargetMemberId) {
      showToast("Select a member before sending a prompt.");
      return;
    }

    const amount = Number(fundAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount before sending the prompt.");
      return;
    }

    const member = members.find((m) => m.id === fundTargetMemberId);
    if (!member?.phone) {
      showToast("This member has no phone number on file.");
      return;
    }

    setIsSendingWalletPrompt(true);
    try {
      const payoutApiUrl = getApiBaseUrl();
      if (!payoutApiUrl)
        throw new Error(
          "Payment server is not configured. Set VITE_API_URL for production.",
        );

      const data = await secureApiPost(`${payoutApiUrl}/api/mpesa/stkpush`, {
        phoneNumber: member.phone,
        amount,
        userId: fundTargetMemberId,
        leagueId: activeLeagueId,
      });
      if (!data.success) {
        throw new Error(data.message || "Failed to send M-Pesa prompt.");
      }

      setFundPromptSent(true);
      showToast(`M-Pesa prompt sent to ${member.displayName}. Waiting for callback.`);
    } catch (err: any) {
      console.error("Prompt send failed:", err);
      showToast(`Prompt send failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSendingWalletPrompt(false);
    }
  };

  const handleWalletFundSubmit = async () => {
    if (!activeLeagueId || !fundTargetMemberId) {
      showToast("Select a member to fund.");
      return;
    }

    const amount = Number(fundAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid wallet funding amount.");
      return;
    }

    if (fundMethod === "mpesa" && !fundTransactionCode.trim()) {
      showToast("Enter the M-Pesa transaction code.");
      return;
    }

    if (fundMethod === "cash" && !fundCashDate) {
      showToast("Capture the cash handoff date.");
      return;
    }

    setIsFundingWallet(true);
    try {
      const member = members.find(
        (m) =>
          m.id === fundTargetMemberId ||
          m.authUid === fundTargetMemberId ||
          (m as any).phone === fundTargetMemberId ||
          m.displayName === fundTargetMemberId,
      );
      const targetMemberId = member?.id || fundTargetMemberId;
      const currentWallet = Number((member as any)?.walletBalance ?? 0);
      const nextWallet = Math.max(0, currentWallet + amount);
      const paymentNowCovered = gameweekStake > 0 ? nextWallet >= gameweekStake : nextWallet > 0;
      const shouldIncreaseStreak = paymentNowCovered && !(member as any)?.hasPaid;
      const receiptId =
        fundMethod === "mpesa"
          ? fundTransactionCode.trim().toUpperCase()
          : `CASH_${Date.now().toString().slice(-6)}`;

      if (!member) {
        throw new Error("Member not found in the current league.");
      }

      await updateDoc(doc(db, "leagues", activeLeagueId, "memberships", targetMemberId), {
        walletBalance: increment(amount),
        hasPaid: paymentNowCovered,
        paymentStreak: increment(shouldIncreaseStreak ? 1 : 0),
      });

      await addDoc(collection(db, "leagues", activeLeagueId, "transactions"), {
        type: "wallet_funding",
        source: fundMethod,
        amount,
        userId: targetMemberId,
        memberId: targetMemberId,
        memberName: member?.displayName || "Member",
        winnerName: member?.displayName || "Member",
        phoneNumber: member?.phone || "",
        receiptId,
        cashHandoffDate: fundMethod === "cash" ? fundCashDate : null,
        note: fundNote.trim() || null,
        timestamp: serverTimestamp(),
      });

      await addDoc(collection(db, "leagues", activeLeagueId, "notifications"), {
        type: "success",
        message:
          fundMethod === "mpesa"
            ? `Wallet funded: KES ${amount.toLocaleString()} recorded for ${member?.displayName || "member"} via M-Pesa ${fundTransactionCode.trim().toUpperCase()}.`
            : `Wallet funded: KES ${amount.toLocaleString()} recorded for ${member?.displayName || "member"} via cash handoff on ${fundCashDate}.`,
        timestamp: serverTimestamp(),
        readBy: [],
        targetMemberId,
      });

      setShowWalletFundModal(false);
      showToast(`Wallet funded for ${member?.displayName || "member"}.`);
      shareWalletFundingReceipt({
        memberName: member?.displayName || "Member",
        amount,
        method: fundMethod,
        receiptId,
        cashDate: fundMethod === "cash" ? fundCashDate : undefined,
      });
    } catch (err: any) {
      console.error("Wallet funding failed:", err);
      showToast(`Wallet funding failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsFundingWallet(false);
    }
  };

  const handleResolveGameweek = async () => {
    if (!activeLeagueId) return;
    setIsResolving(true);
    try {
      // Try fetching fresh bootstrap; fall back to cached state if proxy fails
      let gwNumber = currentGwNumber || 0;
      let isGwFinished = isCurrentEventFinished;

      try {
        const bootstrapRes = await fetch(
          `/fpl-api/bootstrap-static/`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (bootstrapRes.ok) {
          const bootstrapData = await bootstrapRes.json();
          const events = bootstrapData?.events || [];
          const currentEvent = events.find((e: any) => e.is_current) || events.find((e: any) => e.is_next);
          if (currentEvent) {
            gwNumber = Number(currentEvent.id || 0);
            isGwFinished = Boolean(currentEvent.finished === true && currentEvent.data_checked === true);
            setCurrentGwNumber(gwNumber || null);
          }
        }
      } catch (proxyErr) {
        console.warn("[resolve] bootstrap proxy failed, using cached state:", proxyErr);
        // Use cached page-load state — still workable for the pilot
      }

      let finalWinnerName = gwWinner?.player_name || "Unknown";
      let finalWinnerId = gwWinner?.id || "unknown";
      
      if (!isGwFinished) {
        setShowResolveModal(false);
        const result = await new Promise<{gw: number, winner: string} | null>((resolve) => {
           setManualResolvePromise({ resolve, currentGw: gwNumber });
        });
        
        if (!result) {
           setIsResolving(false);
           return;
        }
        
        gwNumber = result.gw;
        finalWinnerName = result.winner;
        finalWinnerId = "manual-entry";
      }

      if (!gwNumber || isNaN(gwNumber)) {
        throw new Error(
          "Gameweek number is unavailable. Check FPL is live and try again.",
        );
      }

      const payoutsRef = collection(db, "leagues", activeLeagueId, "payouts");
      const q = query(payoutsRef, where("gw", "==", gwNumber));
      const existing = await getDocs(q);

      if (!existing.empty) {
        throw new Error(`GW${gwNumber} has already been resolved.`);
      }

      await addDoc(payoutsRef, {
        gw: gwNumber,
        amount: weeklyPot,
        winnerId: finalWinnerId,
        winnerName: finalWinnerName,
        status: "awaiting_approval",
        timestamp: serverTimestamp(),
        method: payoutMethod,
        requestedBy: isCoChairSession ? "Co-Chair" : "Chairman",
        approvalTarget: "co-chair",
      });

      // 1. Fetch live FPL Standings via generic proxy
      const leagueRef = doc(db, "leagues", activeLeagueId);
      const leagueSnap = await getDoc(leagueRef);
      const fplLeagueId = leagueSnap.data()?.fplLeagueId;

      if (!fplLeagueId) {
        showToast("Cannot resolve: No FPL League linked. Please connect your official FPL League ID in Settings.");
        setIsResolving(false);
        return;
      }

      const res = await fetch(
        `/fpl-api/leagues-classic/${fplLeagueId}/standings/`
      );
      if (!res.ok) throw new Error("Failed to fetch FPL standings for League ID " + fplLeagueId);
      const data = await res.json();

      const standings = data.standings.results || [];
      // Sort by GW points (event_total)
      const sortedStandings = [...standings].sort(
        (a: any, b: any) =>
          Number(b.event_total || 0) - Number(a.event_total || 0),
      );

      const pendingPayoutQ = query(
        collection(db, "leagues", activeLeagueId, "pending_payouts"),
        where("gw", "==", gwNumber),
        where("status", "==", "awaiting_approval"),
      );
      const existingPending = await getDocs(pendingPayoutQ);
      if (!existingPending.empty) {
        showToast(
          `GW${gwNumber} already has a pending payout approval in queue.`,
        );
        setShowResolveModal(false);
        return;
      }

      // 2. Chama Rule: Filter the top scorer against Firebase memberships list.
      let winners: any[] = [];
      let winningPoints = 0;

      for (const fplManager of sortedStandings) {
        const dbMember = members.find(
          (m) =>
            (m.fplTeamId && Number(m.fplTeamId) === Number(fplManager.entry)) ||
            (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(fplManager.entry)) ||
            m.displayName === fplManager.player_name ||
            (m as any).fplTeamName === fplManager.entry_name,
        );

        if (dbMember && memberHasFunding(dbMember) && Number(fplManager.event_total || 0) > 0) {
            const pts = Number(fplManager.event_total || 0);
            if (winners.length === 0) {
                winners.push(dbMember);
                winningPoints = pts;
            } else if (pts === winningPoints) {
                winners.push(dbMember); // Tied!
            } else {
                break; // Because it's sorted, remaining scores are lower
            }
        }
      }
      
      // Count funded members who participated in this GW
      const fundedParticipants = sortedStandings.filter((fplManager: any) => {
        const dbMember = members.find((m) =>
          (m.fplTeamId && Number(m.fplTeamId) === Number(fplManager.entry)) ||
          (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(fplManager.entry)) ||
          m.displayName === fplManager.player_name ||
          (m as any).fplTeamName === fplManager.entry_name
        );
        return dbMember && memberHasFunding(dbMember);
      });

      const isZeroPotLeague = weeklyPot === 0 || Number(rules.weekly || 0) === 0;

      if (isZeroPotLeague || fundedParticipants.length < 2) {
        // Honorary resolution for season-only / zero-pot leagues / brag rights
        const honoraryWinners: any[] = [];
        let honoraryWinningPoints = 0;

        for (const fplManager of sortedStandings) {
          const dbMember = members.find(
            (m) =>
              (m.fplTeamId && Number(m.fplTeamId) === Number(fplManager.entry)) ||
              (m.secondFplTeamId && Number(m.secondFplTeamId) === Number(fplManager.entry)) ||
              m.displayName === fplManager.player_name ||
              (m as any).fplTeamName === fplManager.entry_name,
          );

          if (dbMember && dbMember.isActive !== false && Number(fplManager.event_total || 0) > 0) {
            const pts = Number(fplManager.event_total || 0);
            if (honoraryWinners.length === 0) {
              honoraryWinners.push(dbMember);
              honoraryWinningPoints = pts;
            } else if (pts === honoraryWinningPoints) {
              honoraryWinners.push(dbMember);
            } else {
              break;
            }
          }
        }

        if (honoraryWinners.length > 0) {
          const pendingPayoutsRef = collection(db, "leagues", activeLeagueId, "pending_payouts");
          for (const w of honoraryWinners) {
            await addDoc(pendingPayoutsRef, {
              winnerId: w.id,
              winnerName: w.displayName + (honoraryWinners.length > 1 ? " (Tie)" : ""),
              winnerPhone: w.phone || "",
              amount: 0,
              points: honoraryWinningPoints,
              gw: gwNumber,
              status: "approved",
              isHonorary: true,
              method: "honorary",
              requestedBy: auth.currentUser?.displayName || "Chairman",
              timestamp: serverTimestamp(),
            });
          }

          const notifsRef = collection(db, "leagues", activeLeagueId, "notifications");
          await addDoc(notifsRef, {
            type: "success",
            message: `🏆 GW${gwNumber} Champion (Honorary): ${honoraryWinners.map(w => w.displayName).join(' & ')} topped with ${honoraryWinningPoints} pts! (Season Standings Updated)`,
            timestamp: serverTimestamp(),
            readBy: [],
          });

          await addDoc(collection(db, "leagues", activeLeagueId, "league_events"), {
            eventType: "resolution",
            message: `GW${gwNumber} resolved (Honorary) — ${honoraryWinners.map(w => w.displayName).join(' & ')} crowned with ${honoraryWinningPoints} pts. 0 KES weekly payout (Season Vault focus).`,
            actor: auth.currentUser?.displayName || "Chairman",
            timestamp: serverTimestamp(),
          });

          setShowResolveModal(false);
          showToast(`GW${gwNumber} resolved! ${honoraryWinners[0].displayName} crowned honorary champion 🏆`);
          triggerResolutionPulse();
          const endTime = Date.now() + 3000;
          const burstFrame = () => {
            confetti({ particleCount: 8, angle: 60, spread: 65, origin: { x: 0, y: 0.75 }, colors: ['#10B981','#FBBF24','#FFFFFF'] });
            confetti({ particleCount: 8, angle: 120, spread: 65, origin: { x: 1, y: 0.75 }, colors: ['#10B981','#FBBF24','#FFFFFF'] });
            if (Date.now() < endTime) requestAnimationFrame(burstFrame);
          };
          burstFrame();
          setActionTimeline((prev) => ({
            ...prev,
            resolved: true,
            approvalPending: false,
            payoutSent: true,
            confirmed: true,
          }));
          setIsResolving(false);
          return;
        }

        // Only void if truly zero active participants
        await addDoc(collection(db, "leagues", activeLeagueId, "pending_payouts"), {
          gw: gwNumber,
          status: "voided",
          reason: `GW${gwNumber} Voided: No active participants with positive scores found.`,
          amount: 0,
          timestamp: serverTimestamp(),
          settledBy: isCoChairSession ? "Co-Chair" : "Chairman",
        });

        await addDoc(collection(db, "leagues", activeLeagueId, "league_events"), {
          eventType: "gw_voided",
          message: `GW${gwNumber} VOIDED — No active participants found with positive scores.`,
          actor: auth.currentUser?.displayName || "Chairman",
          timestamp: serverTimestamp(),
        });

        showToast(`GW${gwNumber} Voided: No active participants scored points.`);
        setIsResolving(false);
        setShowResolveModal(false);
        return;
      }

      if (winners.length === 0) {
        showToast(`No eligible paid winner found for GW${gwNumber}.`);
        setIsResolving(false);
        setShowResolveModal(false);
        return;
      }

      // Map for template logic compatibility below
      const winner = winners[0];

      if (winningPoints <= 0) {
        showToast(
          `GW${gwNumber} has no positive winner score yet. Resolution blocked.`,
        );
        setShowResolveModal(false);
        return;
      }

      const requestedBy = auth.currentUser?.displayName || "🤖 FPL AUTOPILOT";

      if (hasValidCoChair) {
        // Feature: Maker / Checker (Requires Approval)
        const pendingPayoutsRef = collection(db, "leagues", activeLeagueId, "pending_payouts");
        const splitAmount = winners.length > 0 ? Number((weeklyPot / winners.length).toFixed(0)) : 0;
        
        for (const w of winners) {
          await addDoc(pendingPayoutsRef, {
            winnerId: w.id,
            winnerName: w.displayName + (winners.length > 1 ? " (Tie)" : ""),
            winnerPhone: w.phone,
            amount: splitAmount,
            points: winningPoints,
            gw: gwNumber,
            status: "awaiting_approval",
            method: payoutMethod,
            requestedBy,
            approvalTarget: "co-chair",
            timestamp: serverTimestamp(),
          });
        }

        // Notify Co-Chair
        const notifsRef = collection(
          db,
          "leagues",
          activeLeagueId,
          "notifications",
        );
        await addDoc(notifsRef, {
          type: "warning",
          message: notices.payoutApproval(
            gwNumber,
            weeklyPot,
            winner.displayName,
            winningPoints,
          ),
          timestamp: serverTimestamp(),
          readBy: [],
          targetMemberId: coAdminId,
        });

        // Notify Everyone that the GW is locked
        await addDoc(notifsRef, {
          type: "info",
          message: notices.payoutBroadcast(
            gwNumber,
            winner.displayName,
            winningPoints,
            weeklyPot,
          ),
          timestamp: serverTimestamp(),
          readBy: [],
        });

        // Log to Live Escrow Feed
        await addDoc(
          collection(db, "leagues", activeLeagueId, "league_events"),
          {
            eventType: "resolution",
            message: `GW${gwNumber} resolved — ${winner.displayName} leads with ${winningPoints} pts. Payout pending Co-Chair approval.`,
            actor: auth.currentUser?.displayName || "Chairman",
            timestamp: serverTimestamp(),
          },
        );

        setShowResolveModal(false);
        showToast(
          `GW${gwNumber} resolved. Payout sent to Co-Chair for approval.`,
        );
        triggerResolutionPulse();
        const endTime = Date.now() + 3000;
const burstFrame = () => {
  confetti({ particleCount: 8, angle: 60, spread: 65, origin: { x: 0, y: 0.75 }, colors: ['#10B981','#FBBF24','#FFFFFF'] });
  confetti({ particleCount: 8, angle: 120, spread: 65, origin: { x: 1, y: 0.75 }, colors: ['#10B981','#FBBF24','#FFFFFF'] });
  if (Date.now() < endTime) requestAnimationFrame(burstFrame);
};
burstFrame();
        setActionTimeline((prev) => ({
          ...prev,
          resolved: true,
          approvalPending: true,
        }));
      } else {
        // No Co-Chair? Chairman becomes maker-checker and signs the pending payout from the same queue.
        const pendingPayoutsRef = collection(db, "leagues", activeLeagueId, "pending_payouts");
        const splitAmount = winners.length > 0 ? Number((weeklyPot / winners.length).toFixed(0)) : 0;
        for (const w of winners) {
          await addDoc(pendingPayoutsRef, {
            winnerId: w.id,
            winnerName: w.displayName + (winners.length > 1 ? " (Tie)" : ""),
            winnerPhone: w.phone,
            amount: splitAmount,
            points: winningPoints,
            gw: gwNumber,
            status: "awaiting_approval",
            method: payoutMethod,
            requestedBy,
            approvalTarget: "chairman",
            timestamp: serverTimestamp(),
          });
        }

        await addDoc(
          collection(db, "leagues", activeLeagueId, "notifications"),
          {
            type: "warning",
            message: notices.payoutQueuedChairman(
              winner.displayName,
              weeklyPot,
              winningPoints,
            ),
            timestamp: serverTimestamp(),
            readBy: [],
            targetMemberId: activeUserId,
          },
        );

        await addDoc(
          collection(db, "leagues", activeLeagueId, "league_events"),
          {
            eventType: "resolution",
            message: `GW${gwNumber} payout queued for Chairman approval — ${winner.displayName} (${winningPoints} pts).`,
            actor: requestedBy,
            timestamp: serverTimestamp(),
          },
        );

        setShowResolveModal(false);
        showToast(
          `GW${gwNumber} payout request created. Chairman signature required for ${winner.displayName}.`,
        );
        triggerResolutionPulse();
        setActionTimeline((prev) => ({
          ...prev,
          resolved: true,
          approvalPending: true,
        }));
      }
    } catch (error) {
      console.error("Resolution Error:", error);
      showToast(
        `Gameweek Resolution Failed${(error as any)?.message ? `: ${(error as any).message}` : ""}`,
      );
    } finally {
      setIsResolving(false);
    }
  };

  const handleSubmitHqSettlement = async () => {
    if (!activeLeagueId) return;
    if (pendingHQDebt <= 0) {
      showToast("No outstanding HQ debt right now.");
      return;
    }

    const receipt = hqReceiptCode.trim().toUpperCase();
    if (receipt.length < 6) {
      showToast("Enter a valid M-Pesa receipt code before submitting.");
      return;
    }

    const amount = Math.min(
      Math.max(1, Number(hqPaymentAmount || 0)),
      Number(pendingHQDebt || 0),
    );

    setIsSubmittingHqSettlement(true);
    try {
      await addDoc(
        collection(db, "leagues", activeLeagueId, "hq_settlements"),
        {
          leagueId: activeLeagueId,
          leagueName: leagueName || "League",
          amount,
          debtSnapshot: Number(pendingHQDebt || 0),
          receiptCode: receipt,
          channel: "pochi",
          status: "submitted",
          submittedById: activeUserId || auth.currentUser?.uid || null,
          submittedByName: auth.currentUser?.displayName || "Chairman",
          submittedByPhone: localStorage.getItem("memberPhone") || null,
          submittedAt: serverTimestamp(),
        },
      );

      await addDoc(collection(db, "leagues", activeLeagueId, "notifications"), {
        type: "info",
        message: `HQ settlement submitted: receipt ${receipt} for KES ${Number(amount).toLocaleString()}. Waiting HQ verification.`,
        timestamp: serverTimestamp(),
        readBy: [],
      });

      setHqReceiptCode("");
      setShowHqSettlementForm(false);
      showToast(
        "HQ payment receipt submitted. Awaiting SuperAdmin verification.",
      );
    } catch (error: any) {
      console.error("HQ settlement submit failed:", error);
      showToast(
        `Failed to submit HQ receipt: ${error?.message || "Unknown error"}`,
      );
    } finally {
      setIsSubmittingHqSettlement(false);
    }
  };

  // Co-Chair: Approve a pending payout and fire real B2C
  const handleApprovePayout = async (
    payout: any,
    overrideMethod?: "mpesa" | "cash",
  ) => {
    if (!activeLeagueId) return;
    setIsApprovingPayout(payout.id);
    try {
      const payoutPoints = Number(
        payout.points ??
          payout.winningPoints ??
          payout.gwPoints ??
          payout.event_total ??
          0,
      );
      const winnerMember = members.find(
        (member) =>
          member.id === payout.winnerId ||
          member.displayName === payout.winnerName,
      );
      const payoutPhone = payout.winnerPhone || winnerMember?.phone;
      const resolvedMethod = overrideMethod || payout.method || "mpesa";
      const cashHandoffDate = new Date().toISOString().slice(0, 10);

      let data: any = { success: true };
      if (resolvedMethod === "mpesa") {
        if (!payoutPhone) {
          throw new Error(
            "Winner phone number is missing. Update member phone in league settings and retry approval.",
          );
        }
        const payoutApiUrl = getApiBaseUrl();
        if (!payoutApiUrl)
          throw new Error(
            "Payment server is not configured. Set VITE_API_URL for production.",
          );
        data = await secureApiPost(`${payoutApiUrl}/api/mpesa/b2c`, {
          phone: payoutPhone,
          amount: payout.amount,
          winnerName: payout.winnerName,
          remarks: `FantasyChama GW${payout.gw} Approved Payout`,
          userId: payout.winnerId || winnerMember?.id || activeUserId,
          leagueId: activeLeagueId,
          gw: Number(payout.gw || 0),
          points: payoutPoints,
        });
        if (!data.success) throw new Error(data.message);
      }

      // Mark the pending payout as approved in Firestore
      await updateDoc(
        doc(db, "leagues", activeLeagueId, "pending_payouts", payout.id),
        {
          status: "approved",
          method: resolvedMethod,
          cashHandoffDate: resolvedMethod === "cash" ? cashHandoffDate : null,
          approvedBy: auth.currentUser?.displayName || "Co-Chair",
          winnerPhone: payoutPhone || null,
          approvedAt: serverTimestamp(),
        },
      );

      // Deduct gameweek stake from each funded member's wallet directly via Firestore
      const fundedMembers = members.filter(
        (m) => m.isActive !== false && m.hasPaid && gameweekStake > 0,
      );
      for (const m of fundedMembers) {
        const memberRef = doc(
          db,
          "leagues",
          activeLeagueId,
          "memberships",
          m.id,
        );
        const newBalance = Math.max(0, (m.walletBalance || 0) - gameweekStake);
        await updateDoc(memberRef, {
          walletBalance: newBalance,
          hasPaid: newBalance >= gameweekStake,
        });
      }

      // Record the GW deduction in league_events audit log
      await addDoc(
        collection(db, "leagues", activeLeagueId, "league_events"),
        {
          eventType: "gw_deduction",
          message: `GW${payout.gw} stake deducted: KES ${gameweekStake} × ${fundedMembers.length} members. Winner: ${payout.winnerName} (${resolvedMethod}).`,
          actor: auth.currentUser?.displayName || "Chairman",
          timestamp: serverTimestamp(),
        },
      );

      if (resolvedMethod === "cash") {
        await addDoc(
          collection(db, "leagues", activeLeagueId, "transactions"),
          {
            type: "payout",
            amount: payout.amount,
            winnerName: payout.winnerName,
            winnerId: payout.winnerId,
            winnerPhone: payoutPhone || null,
            points: payoutPoints,
            gw: Number(payout.gw || 0),
            receiptId: `CASH_GW${Number(payout.gw || 0)}_${Date.now().toString().slice(-6)}`,
            cashHandoffDate,
            timestamp: serverTimestamp(),
          },
        );

        await addDoc(
          collection(db, "leagues", activeLeagueId, "notifications"),
          {
            type: "transactionSuccess",
            isWinnerEvent: true,
            winnerId: payout.winnerId,
            winnerName: payout.winnerName,
            points: payoutPoints,
            gw: Number(payout.gw || 0),
            message: `Cash handoff confirmed: ${payout.winnerName} received KES ${Number(payout.amount || 0).toLocaleString()} for GW${Number(payout.gw || 0)} (${payoutPoints} pts).`,
            timestamp: serverTimestamp(),
            readBy: [],
          },
        );
      }

      showToast(
        `✅ Approved! ${resolvedMethod === "cash" ? "Cash Handoff logged for" : "B2C Dispatch sent to"} ${payout.winnerName} (KES ${payout.amount.toLocaleString()}).`,
      );
      triggerResolutionPulse();
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10B981", "#FBBF24", "#FFFFFF"],
      });
      // Write lastResolvedDate + lastResolvedGw to league doc for champion card 48h logic
      const grossPot = Number(payout.grossPot || (fundedMembers.length * gameweekStake) || payout.amount || 0);
      const mpesaSendingCost = Number(payoutCustomFee[payout.id] ?? payout.mpesaFee ?? (isPilotMode ? 15 : Math.round(grossPot * 0.015)));

      if (!isPilotMode) {
        // Commercial: update HQ debt (3.5%)
        const currentDebt = Number(leagueSettings?.pendingHQDebt || 0);
        const hqCut = Math.round(grossPot * 0.035);
        await updateDoc(doc(db, "leagues", activeLeagueId), {
          lastResolvedDate: serverTimestamp(),
          lastResolvedGw: Number(payout.gw || 0),
          pendingHQDebt: currentDebt + hqCut,
        });
      } else {
        // Pilot mode: track resolution date with zero HQ debt
        await updateDoc(doc(db, "leagues", activeLeagueId), {
          lastResolvedDate: serverTimestamp(),
          lastResolvedGw: Number(payout.gw || 0),
          pendingHQDebt: 0,
        });
      }

      // Log platform treasury event for HQ Analytics & Ledger
      try {
        await addDoc(collection(db, "platform_treasury"), {
          leagueId: activeLeagueId,
          leagueName: (leagueSettings as any)?.leagueName || "League",
          gameweek: `GW${Number(payout.gw || 0)}`,
          grossPot: grossPot,
          payoutAmount: Number(payout.amount || 0),
          platformNetRevenue: isPilotMode ? 0 : Math.round(grossPot * 0.035),
          chairmanCut: Math.round(grossPot * 0.04),
          coAdminCut: 0,
          mpesaFee: mpesaSendingCost,
          isPilotMode: isPilotMode,
          timestamp: serverTimestamp(),
        });
      } catch (treasuryErr) {
        console.warn("[treasury] Platform treasury logging error:", treasuryErr);
      }
      setActionTimeline((prev) => ({
        ...prev,
        payoutSent: true,
        confirmed: true,
        approvalPending: false,
      }));
    } catch (err: any) {
      const rawMessage = err?.message || "Unknown error during payout approval";
      const message =
        /failed to fetch|networkerror|network error|load failed/i.test(
          String(rawMessage),
        )
          ? "Cannot reach payment server. Confirm Render backend URL and CORS settings."
          : rawMessage;
      showToast(`Approval failed: ${message}`);
    } finally {
      setIsApprovingPayout(null);
    }
  };

  const handleRejectPayout = async (payoutId: string) => {
    if (!activeLeagueId) return;
    await updateDoc(
      doc(db, "leagues", activeLeagueId, "pending_payouts", payoutId),
      {
        status: "rejected",
        rejectedBy: auth.currentUser?.displayName || "Co-Chair",
        rejectedAt: serverTimestamp(),
      },
    );
    showToast("Payout request rejected. Chairman will be notified.");
  };

  const handleForfeitGw = async (targetGw: number, bulkUpto = false) => {
    if (!activeLeagueId) return;
    setIsForfeiting(true);
    try {
      const gwsToForfeit: number[] = bulkUpto
        ? Array.from({ length: targetGw }, (_, i) => i + 1)
        : [targetGw];

      const currentForfeited = new Set<number>((leagueSettings as any)?.forfeitedGws || []);
      gwsToForfeit.forEach(g => currentForfeited.add(g));
      const newForfeitedList = Array.from(currentForfeited).sort((a, b) => a - b);

      const updatePayload: any = {
        forfeitedGws: newForfeitedList,
      };
      if (gwsToForfeit.includes(1)) {
        updatePayload.startGw = targetGw + 1;
        setStartGw(targetGw + 1);
      }

      await updateDoc(doc(db, "leagues", activeLeagueId), updatePayload);

      // Cancel or update pending payout docs for these GWs
      for (const g of gwsToForfeit) {
        const existingPayout = pendingPayouts.find((p: any) => Number(p.gw) === g);
        if (existingPayout) {
          // If it was already approved, refund member stakes
          if (existingPayout.status === "approved" && gameweekStake > 0) {
            const fundedMembers = members.filter((m) => m.isActive !== false);
            for (const m of fundedMembers) {
              const memberRef = doc(db, "leagues", activeLeagueId, "memberships", m.id);
              const refundedBalance = (m.walletBalance || 0) + gameweekStake;
              await updateDoc(memberRef, {
                walletBalance: refundedBalance,
                hasPaid: refundedBalance >= gameweekStake,
              });
            }
          }
          await updateDoc(
            doc(db, "leagues", activeLeagueId, "pending_payouts", existingPayout.id),
            {
              status: "forfeited",
              reason: "Forfeited: league did not play this GW",
              updatedAt: serverTimestamp(),
            }
          );
        } else {
          await addDoc(collection(db, "leagues", activeLeagueId, "pending_payouts"), {
            gw: g,
            status: "forfeited",
            reason: "Forfeited: league did not play this GW",
            amount: 0,
            timestamp: serverTimestamp(),
            settledBy: isCoChairSession ? "Co-Chair" : "Chairman",
          });
        }
      }

      await addDoc(collection(db, "leagues", activeLeagueId, "league_events"), {
        eventType: "gw_forfeited",
        message: bulkUpto
          ? `GW 1–${targetGw} forfeited (unplayed). Stakes & season dues removed.`
          : `GW${targetGw} forfeited (unplayed). Stakes & season dues removed.`,
        actor: isCoChairSession ? "Co-Chair" : "Chairman",
        timestamp: serverTimestamp(),
      });

      showToast(
        bulkUpto
          ? `✓ GW 1–${targetGw} successfully forfeited. Dues & stakes removed!`
          : `✓ GW${targetGw} successfully forfeited. Dues & stakes removed!`
      );
      setShowGwActionModal(false);
    } catch (err: any) {
      console.error("Forfeit GW error:", err);
      showToast(`Failed to forfeit GW: ${err?.message || "Unknown error"}`);
    } finally {
      setIsForfeiting(false);
    }
  };

  const handleUnforfeitGw = async (targetGw: number) => {
    if (!activeLeagueId) return;
    setIsForfeiting(true);
    try {
      const currentForfeited = ((leagueSettings as any)?.forfeitedGws || []).filter(
        (g: number) => g !== targetGw
      );
      await updateDoc(doc(db, "leagues", activeLeagueId), {
        forfeitedGws: currentForfeited,
      });
      const existingPayout = pendingPayouts.find(
        (p: any) => Number(p.gw) === targetGw && p.status === "forfeited"
      );
      if (existingPayout) {
        const { deleteDoc, doc: docRef } = await import("firebase/firestore");
        await deleteDoc(docRef(db, "leagues", activeLeagueId, "pending_payouts", existingPayout.id));
      }
      showToast(`GW${targetGw} restored / un-forfeited.`);
      setShowGwActionModal(false);
    } catch (err: any) {
      showToast(`Failed to restore GW: ${err?.message || "Unknown error"}`);
    } finally {
      setIsForfeiting(false);
    }
  };

  /**
   * Phase 7: Audit CSV Export Engine
   * Generates a downloadable .csv snapshot of the full league ledger.
   */
  const downloadLeagueLedgerCSV = () => {
    const rows = [
      [
        "#",
        "Member Name",
        "Phone",
        "Wallet Balance (KES)",
        "Status",
        "Total Earned (KES)",
        "Role",
      ],
      ...members.map((m, i) => [
        i + 1,
        m.displayName,
        (m as any).phone || "N/A",
        ((m as any).walletBalance ?? 0).toFixed(2),
        m.hasPaid ? "Funded ✓" : "Unpaid ✗",
        ((m as any).totalEarned ?? 0).toFixed(2),
        (m as any).role === "admin" ? "Admin" : "Member",
      ]),
    ];
    const csvContent = rows
      .map((r) =>
        r
          .map(String)
          .map((v) => `"${v.replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${leagueName.replace(/\s/g, "_")}_Ledger_Audit.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✅ Audit CSV exported successfully");
  };

  /**
   * WhatsApp Receipt Generator
   * Creates a rich formatted summary of the GW result for sharing to the group.
   */
  const generateWhatsAppReceipt = (payout: any) => {
    const unpaidCount = members.filter(
      (m) => !m.hasPaid && m.role !== "admin" && m.isActive !== false,
    ).length;
    const appUrl =
      (typeof window !== "undefined" && window.location.origin) ? window.location.origin : (import.meta.env.VITE_APP_URL || "https://fantasychama.vercel.app");
    const method = payout.method === "cash" ? "Cash Handoff 💵" : "M-Pesa ✅";

    const message = [
      `🏆 *${leagueName.toUpperCase()} — GW${payout.gw} OFFICIAL BULLETIN* 🚨`,
      ``,
      `🥇 Mwizi wa points this week is *${payout.winnerName}* na *${payout.points} pts*! 👑`,
      `💰 Payout: *KES ${Number(payout.amount).toLocaleString()}* imetumwa safi via ${method}.`,
      ``,
      `👏 Wengine poleni sana kwa mshtuko wa moyo! Alama zilikataa lakini weekend ijayo kimeumana tena! 🏃‍♂️💨`,
      ``,
      unpaidCount > 0
        ? `⚠️ *RED ZONE CALLOUT*: Kuna watu ${unpaidCount} bado hawajatuma kakitu. Treasurer halali na pochi haina huruma kabla deadline!`
        : `✅ Watu wote wako funded kishujaa. Hatutaki vilio deadline ikipita!`,
      ``,
      `📊 Angalia live table & wallet yako:`,
      `👉 ${appUrl}/dashboard`,
    ].join("\n");

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="fc-admin-loading min-h-screen w-full font-sans text-slate-900 dark:text-white bg-transparent py-6 md:py-10">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "min-h-[100dvh] w-full text-slate-900 dark:text-white font-sans relative bg-transparent",
        isSuspended ? "overflow-hidden h-screen" : "",
      )}
    >
      {/* Phase 40: HQ Debt Banner (Grace Period Warning) */}
      {isWithinGracePeriod && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 text-center py-2.5 px-4 flex items-center justify-center gap-3 fixed top-0 w-full z-[80] animate-in slide-in-from-top">
          <AlertTriangle className="w-4 h-4 text-yellow-500 animate-pulse" />
          <p className="text-[10px] sm:text-xs font-bold font-mono text-yellow-200 uppercase tracking-widest truncate">
            HQ Action Required: Owed Platform Fee is{" "}
            <span className="text-black bg-yellow-500 px-1.5 py-0.5 rounded ml-1">
              KES {pendingHQDebt.toLocaleString()}
            </span>
            . Settle via Pochi [{hqPochiNumber}] within 48h to avoid suspension.
          </p>
          <button
            onClick={() => setShowHqSettlementForm((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/20 text-[10px] font-black uppercase tracking-widest text-yellow-100"
          >
            {showHqSettlementForm ? "Hide Receipt Form" : "Submit HQ Receipt"}
          </button>
        </div>
      )}

      {isWithinGracePeriod && showHqSettlementForm && (
        <div className="fixed top-12 w-full z-[79] px-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-yellow-500/35 bg-[#1a1500] px-4 py-3 shadow-2xl">
            <p className="text-[10px] uppercase tracking-widest text-yellow-300 font-black mb-2">
              Submit HQ Settlement Receipt
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={hqReceiptCode}
                onChange={(e) =>
                  setHqReceiptCode(e.target.value.toUpperCase().trim())
                }
                placeholder="M-Pesa Receipt (e.g. QWE123ABC)"
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-black/30 border border-white/15 text-white text-sm"
              />
              <input
                type="number"
                min="1"
                max={Math.max(1, Number(pendingHQDebt || 1))}
                value={hqPaymentAmount}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  setHqPaymentAmount(Math.max(1, Number(e.target.value || 0)))
                }
                className="px-3 py-2 rounded-xl bg-black/30 border border-white/15 text-white text-sm"
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <p className="text-[10px] text-yellow-100/80">
                Latest HQ status:{" "}
                <span className="font-black uppercase">
                  {latestHqSettlement?.status || "none submitted yet"}
                </span>
              </p>
              <button
                onClick={handleSubmitHqSettlement}
                disabled={isSubmittingHqSettlement}
                className="px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
              >
                {isSubmittingHqSettlement ? "Submitting..." : "Send Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 40: Chairman Suspension Lockout */}
      {isSuspended && (
        <div className="fixed inset-0 z-[100000] bg-black/70 backdrop-blur-3xl flex items-center justify-center p-4 overflow-hidden animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0b1014]/90 border border-red-500/50 rounded-[2rem] p-6 sm:p-8 text-center shadow-[0_0_100px_rgba(239,68,68,0.2)] flex flex-col items-center gap-6 relative z-10 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/30 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.3)]">
              <ShieldCheck className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">
                Access Revoked
              </h2>
              <p className="text-sm font-medium text-gray-400">
                This platform has been suspended by{" "}
                <span className="font-bold text-emerald-400">FantasyChama</span>{" "}
                due to unpaid platform revenue fees.
              </p>
            </div>

            <div className="w-full bg-[#161d24] border border-white/5 rounded-xl p-5 text-left shadow-inner">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                Total Due
              </p>
              <p className="text-3xl font-black text-red-400 tabular-nums tracking-tight">
                KES {pendingHQDebt.toLocaleString()}
              </p>

              <hr className="border-white/5 my-4" />

              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5" /> HQ Pochi Instructions
              </p>
              <ol className="text-xs text-gray-300 space-y-2 list-decimal pl-4 marker:text-gray-500">
                <li>
                  Open M-Pesa Menu &gt; <strong>Pochi La Biashara</strong>
                </li>
                <li>
                  Send to HQ Mobile: <strong>{hqPochiNumber}</strong>
                </li>
                <li>
                  Enter Amount: <strong>KES {pendingHQDebt}</strong>
                </li>
              </ol>
            </div>

            <div className="w-full bg-[#161d24] border border-white/10 rounded-xl p-4 text-left">
              <p className="text-[10px] font-black text-yellow-300 uppercase tracking-widest mb-2">
                Submit Proof to HQ
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={hqReceiptCode}
                  onChange={(e) =>
                    setHqReceiptCode(e.target.value.toUpperCase().trim())
                  }
                  placeholder="Receipt code"
                  className="sm:col-span-2 px-3 py-2 rounded-lg bg-black/30 border border-white/15 text-white text-sm"
                />
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, Number(pendingHQDebt || 1))}
                  value={hqPaymentAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setHqPaymentAmount(Math.max(1, Number(e.target.value || 0)))
                  }
                  className="px-3 py-2 rounded-lg bg-black/30 border border-white/15 text-white text-sm"
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-2">
                Status:{" "}
                <span className="font-black uppercase text-gray-300">
                  {latestHqSettlement?.status || "awaiting submission"}
                </span>
              </p>
            </div>

            {suspensionNudges.length > 0 && (
              <div className="w-full text-center bg-red-900/10 border border-red-500/10 rounded-xl p-3">
                <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 animate-bounce" /> Live Member
                  Complaints
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {suspensionNudges.slice(0, 5).map((n: string, i: number) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-[10px] font-bold text-red-300 shadow-sm"
                    >
                      {n} represents 😤
                    </span>
                  ))}
                  {suspensionNudges.length > 5 && (
                    <span className="text-[10px] text-gray-500 font-bold">
                      +{suspensionNudges.length - 5} others
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="w-full space-y-3 mt-2">
              <button
                onClick={handleSubmitHqSettlement}
                disabled={isSubmittingHqSettlement}
                className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isSubmittingHqSettlement
                  ? "Submitting Proof..."
                  : "I Have Paid HQ (Submit Receipt)"}
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-bold uppercase tracking-widest text-[11px] rounded-xl transition-all border border-white/5"
              >
                Sign out for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HQ Onboarding Tutorial Overlay */}
      {showTutorial && !isSuspended && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) handleInitializeOperations();
          }}
          className="fixed inset-0 z-[90000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-2xl bg-[#0b1014] border border-[#10B981]/30 rounded-[2rem] p-8 shadow-[0_0_80px_rgba(16,185,129,0.15)] relative animate-in fade-in zoom-in-95 duration-300">
            <button
              type="button"
              onClick={handleInitializeOperations}
              className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer z-20"
              title="Close & Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#10B981] blur-[150px] opacity-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FBBF24] blur-[150px] opacity-10 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-[#10B981]/20 border border-[#10B981]/40 rounded-full flex items-center justify-center mb-6">
                <Trophy className="w-8 h-8 text-[#10B981]" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">
                Welcome to Command Center!
              </h2>
              <p className="text-gray-400 mb-8 max-w-md">
                Your league is successfully deployed. Here's a quick 4-step
                checklist to running a flawless FPL Chama.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left mb-8">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4">
                  <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center flex-shrink-0">
                    <Banknote className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-1">
                      1. Fund Wallets
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Members send M-Pesa. You hit "Pilot Prefund" or click
                      their wallet to manually record the deposit.
                    </p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4">
                  <div className="w-8 h-8 bg-[#FBBF24]/20 rounded flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-4 h-4 text-[#FBBF24]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-1">
                      2. Resolve GWs
                    </p>
                    <p className="text-[11px] text-gray-500">
                      We auto-fetch the FPL winner. Click "Resolve". It secures
                      funds and assigns the money to the winner.
                    </p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4">
                  <div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-1">
                      3. Co-Admin Approval
                    </p>
                    <p className="text-[11px] text-gray-500">
                      If a Co-Chair exists, payout needs approval. If none is
                      assigned, Chairman executes directly.
                    </p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">
                      4. HQ Platform Cut
                    </p>
                    <p className="text-[11px] text-gray-500">
                      We take a 5% cut. Watch the red warning banner, then
                      settle your debt to HQ via Pochi La Biashara.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleInitializeOperations}
                className="px-8 py-3.5 bg-[#10B981] hover:bg-[#059669] text-black font-black uppercase tracking-widest text-sm rounded-xl transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                Initialize Operations
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={clsx(
          "min-h-screen w-full font-sans text-white relative overflow-hidden bg-transparent",
          isSuspended
            ? "blur-xl opacity-20 pointer-events-none select-none scale-[0.98]"
            : "",
          isWithinGracePeriod ? "pt-12" : "",
        )}
      >
        {/* Ambient Lighting Background — smoothly blended without lines */}
        <div className="absolute inset-0 pointer-events-none opacity-60">
          <div className="absolute -top-24 right-[10%] h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute bottom-10 left-[8%] h-80 w-80 rounded-full bg-amber-500/8 blur-3xl" />
        </div>
        {/* Unified Global Toast Notification */}
        <div
          className={clsx(
            "fixed top-4 right-4 px-5 py-3 rounded-2xl text-[13px] font-bold flex items-center gap-3 transition-all duration-500 pointer-events-none z-[9999] shadow-[0_20px_50px_rgba(0,0,0,0.5)] fc-inline-toast fc-inline-toast-success",
            toastMessage
              ? "opacity-100 translate-y-0 scale-100 visible"
              : "opacity-0 -translate-y-2 scale-95 invisible",
          )}
        >
          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
          {toastMessage}
        </div>

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8 pb-6 lg:pb-8">
          {/* Top Header */}
          <Header
            role="admin"
            title={leagueName || "Command Center"}
            subtitle="Chairman Hub"
          />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pt-1 pb-2">
            <div>
              <h2 className="fc-dashboard-header-title text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 mb-1">
                <ShieldCheck className="w-7 h-7 text-[#FBBF24]" /> {tabCopy.dashboard.title}
              </h2>
              <p className="fc-dashboard-header-copy text-sm font-medium max-w-xl leading-relaxed">
                {tabCopy.dashboard.description}
              </p>
            </div>
            
            {!isCoChairSession && (
              <div className="flex flex-wrap gap-2.5 w-full lg:w-auto justify-start lg:justify-end items-end">
                <button
                  id="tour-add-member"
                  onClick={openAddMemberModal}
                  className="fc-add-member-btn flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-slate-900 dark:text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shrink-0 shadow-sm"
                >
                  <UserPlus className="w-4 h-4 text-[#10B981]" /> Add Member
                </button>
                <button
                  onClick={handleBulkNudge}
                  className="flex items-center justify-center gap-2 px-3.5 py-2 bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(239,68,68,0.28)] shrink-0"
                >
                  <Megaphone className="w-4 h-4" /> Bulk Nudge
                </button>
                <button
                  onClick={() => {
                    setCleanSlateTargetGw(currentGwNumber || 10);
                    setCleanSlateConfirmText('');
                    setShowCleanSlateModal(true);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer"
                  title="Clean Slate / Reset Season Wallets & Ledger"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-red-400" /> Clean Slate
                </button>
              </div>
            )}

          </div>

          {/* Main Tab Navigation */}
          <div
            className="flex items-center justify-between gap-2 pb-1 mb-3 border-b border-slate-200 dark:border-white/5"
          >
            <div className="flex overflow-x-auto gap-2" style={{ scrollbarWidth: "none" }}>
              {["dashboard", "ledger", "finance"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={clsx(
                    "px-3.5 py-1.5 font-black uppercase tracking-widest text-[10px] sm:text-xs transition-colors whitespace-nowrap",
                    activeTab === tab
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-[#10B981] border-b-2 border-emerald-500 dark:border-[#10B981]"
                      : "text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300 border-b-2 border-transparent",
                  )}
                >
                  {tab === "dashboard"
                    ? "Overview"
                    : tab === "ledger"
                      ? "Ledger & Access"
                      : "Finance & Ops"}
                </button>
              ))}
            </div>

            {activeTab === "finance" && !isCoChairSession && (
              <button
                onClick={openPrefundModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FBBF24]/10 border border-[#FBBF24]/30 hover:bg-[#FBBF24]/20 text-[#FBBF24] text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <Banknote className="w-3.5 h-3.5" /> Pilot Prefund
              </button>
            )}
          </div>

          <div
            className={
              activeTab === "dashboard"
                ? "block space-y-4 animate-in fade-in duration-500"
                : "hidden"
            }
          >
            {/* Unified Comprehensive Live Leader & Matchday Pulse Board */}
            {(() => {
              const approvedForThisGw = pendingPayouts.some(
                (p) => Number(p.gw) === currentGwNumber && p.status === 'approved'
              );
              const awaitingForThisGw = pendingPayouts.some(
                (p) => Number(p.gw) === currentGwNumber && p.status === 'awaiting_approval'
              );
              const isResolved = approvedForThisGw || awaitingForThisGw;
              const leaderName = gwWinner?.player_name || null;
              const leaderTeam = gwWinner?.entry_name || null;
              const leaderPoints = gwWinner?.event_total !== undefined ? gwWinner.event_total : null;
              const leadMargin = gwWinner?.leadMargin !== undefined ? gwWinner.leadMargin : null;
              const runnerUp = gwWinner?.runnerUpName || null;
              const calculatedPot = Math.round(
                members.filter((m) => m.hasPaid && m.isActive !== false && (m as any).playMode !== 'sidebets_only').length * gameweekStake * (rules.weekly / 100)
              ) || weeklyPot || 0;

              const finishedAtStored = Number(localStorage.getItem(`fc_gw_${currentGwNumber}_finished_at`) || 0);
              const hoursSinceFinished = finishedAtStored ? (Date.now() - finishedAtStored) / (1000 * 60 * 60) : 0;
              const hoursUntilNextDeadline = nextDeadlineTime ? (new Date(nextDeadlineTime).getTime() - Date.now()) / (1000 * 60 * 60) : Infinity;

              // Rule: Winner crowned active for up to 48h after end of GW AND up to 36h before next GW deadline
              const isCelebrationWindowActive = Boolean(
                isCurrentEventFinished &&
                (finishedAtStored ? hoursSinceFinished <= 48 : true) &&
                hoursUntilNextDeadline > 36
              );

              return (
                <div
                  className={clsx(
                    "fc-card relative overflow-hidden rounded-3xl sm:rounded-[2rem] border transition-all shadow-xl p-5 sm:p-6 mb-2",
                    "bg-white dark:bg-gradient-to-r dark:from-[#181409] dark:via-[#161d24] dark:to-[#0f141a]",
                    "border-amber-400/40 dark:border-[#FBBF24]/30",
                    resolutionPulse && "fc-burst-success"
                  )}
                >
                  {/* Subtle ambient glows for visual depth */}
                  <div className="absolute top-0 right-0 w-80 h-32 bg-amber-500/10 dark:bg-[#FBBF24]/10 blur-[80px] pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-64 h-32 bg-emerald-500/10 blur-[80px] pointer-events-none" />

                  {/* Top Header Row: Matchday Pulse + Live Status + Live Standings Link */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200/80 dark:border-white/10 relative z-10">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 shadow-xs">
                        <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                        Matchday Pulse • GW{currentGwNumber || 4} {isCurrentEventFinished ? (isCelebrationWindowActive ? "Finished" : "Finalized") : "Live"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">
                        <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" /> High Score Active
                      </span>
                      <span className="text-xs text-slate-500 dark:text-gray-400 font-medium hidden lg:inline ml-1">
                        {isCurrentEventFinished 
                          ? (isCelebrationWindowActive ? "Official final standings locked in." : "GW finalized · Upcoming Gameweek deadline approaching.") 
                          : "Scores updating in real-time as fixtures progress."}
                      </span>
                    </div>

                    <Link
                      to="/standings"
                      onClick={() => haptics.selection()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10 text-xs font-bold transition-all active:scale-95 shadow-xs"
                      title="View complete live mini-league table"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>Live Standings</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-gray-400" />
                    </Link>
                  </div>

                  {/* Main Leader & Pot Row — responsive xl:flex-row to prevent half-screen compression */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
                    {/* Left: Leader Profile & Margins */}
                    <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                      {leaderName ? (
                        <>
                          <div className="relative shrink-0 mt-1 sm:mt-0">
                            <div className="absolute inset-0 rounded-full bg-amber-500/20 dark:bg-[#FBBF24]/20 animate-ping" />
                            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl sm:rounded-full bg-gradient-to-br from-amber-400 to-amber-600 p-[2px] shadow-[0_0_25px_rgba(251,191,36,0.35)] flex items-center justify-center">
                              <div className="w-full h-full bg-slate-900 rounded-2xl sm:rounded-full flex items-center justify-center">
                                <Trophy className="w-6 h-6 text-amber-400" />
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 text-amber-500 dark:text-[#FBBF24]">
                                {isCelebrationWindowActive ? (
                                  <>
                                    <Star className="w-3.5 h-3.5 fill-[#FBBF24] text-[#FBBF24]" />
                                    GW {currentGwNumber || 4} Champion Crowned
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="w-3.5 h-3.5 fill-current" />
                                    POT LEADER
                                  </>
                                )}
                              </p>
                              <span
                                className={clsx(
                                  "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                  isCurrentEventFinished
                                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:border-[#FBBF24]/40 dark:bg-[#FBBF24]/10 dark:text-[#FBBF24]"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
                                )}
                              >
                                {isCurrentEventFinished ? `GW${currentGwNumber || 4} Final` : `GW${currentGwNumber || 4} Live`}
                              </span>
                            </div>

                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                              {leaderName} {leaderTeam && <span className="text-sm font-bold text-gray-500 dark:text-gray-400">({leaderTeam})</span>}
                            </h3>

                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <p className="text-xs text-slate-600 dark:text-slate-300">
                                Clinched the pot with <span className="text-emerald-600 dark:text-[#10B981] font-black">{leaderPoints} pts</span>
                                {leadMargin ? ` (+${leadMargin} pts ahead)` : ''} · Payout Yielded: <span className="text-amber-600 dark:text-[#FBBF24] font-black">KES {calculatedPot.toLocaleString()}</span>
                              </p>
                            </div>

                            {/* Quick Emoji Reactions from Chairman — well-grouped to prevent awkward wrapping */}
                            {(() => {
                              const isMeLeader = Boolean(
                                (leaderName && (
                                  leaderName.toLowerCase() === (currentMember?.displayName || '').toLowerCase() ||
                                  leaderName.toLowerCase() === (chairmanName || '').toLowerCase() ||
                                  (auth.currentUser?.displayName && leaderName.toLowerCase() === auth.currentUser.displayName.toLowerCase())
                                )) ||
                                ((((currentMember as any)?.fplTeamName || currentMember?.teamName) && leaderTeam && (((currentMember as any)?.fplTeamName || currentMember?.teamName)).toLowerCase() === leaderTeam.toLowerCase()))
                              );

                              if (isMeLeader) {
                                return (
                                  <div className="mt-3 flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
                                      👑 You are leading this round!
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 shrink-0">
                                    Send Props to {leaderName.split(' ')[0]} 💬
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {['👏', '🐐', '🔥', '🥩', '🧂', '🫡'].map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleSendReaction(emoji)}
                                        className="w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 hover:border-amber-400/50 bg-slate-100/80 dark:bg-white/5 hover:bg-amber-500/20 flex items-center justify-center text-sm transition-all hover:scale-110 active:scale-90 cursor-pointer shadow-xs shrink-0"
                                        title={`Send ${emoji} to ${leaderName}`}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {!isCurrentEventFinished && leadMargin !== null && leadMargin !== undefined && (
                              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  +{leadMargin} pts ahead of {runnerUp || 'Challenger'}
                                </span>
                                <span
                                  className={clsx(
                                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                                    leadMargin >= 15
                                      ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300"
                                      : leadMargin >= 5
                                      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300"
                                      : "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300 animate-pulse"
                                  )}
                                >
                                  {leadMargin >= 15 ? "Dominant Lead 🛡️" : leadMargin >= 5 ? "Contested Lead ⚔️" : "Nail-Biter 🔥"}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3.5 py-2">
                          <div className={clsx(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                            isFplStandingsLoading
                              ? "bg-amber-500/10 border-amber-500/25 animate-pulse text-amber-400"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-400"
                          )}>
                            <Trophy className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {isFplStandingsLoading && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-[#FBBF24]">
                                {isFplStandingsLoading ? "Syncing FPL Matchday" : "Funded Pot Contenders"}
                              </p>
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                              {isFplStandingsLoading
                                ? `Syncing GW${currentGwNumber || ''} Standings...`
                                : "Awaiting Funded Pot Contenders"}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              {isFplStandingsLoading
                                ? "Matching official FPL points with funded member wallets."
                                : "Members must fund their wallet to qualify for the weekly cash pot."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Projected Pot + Action Buttons — Resolve placed directly below Projected Cash Pot with matching length */}
                    <div className="flex flex-col gap-2.5 w-full sm:w-56 md:w-64 pt-3 xl:pt-0 border-t xl:border-t-0 xl:border-l xl:pl-6 border-slate-200/80 dark:border-white/10 shrink-0">
                      <div className="w-full rounded-2xl px-4 sm:px-5 py-3 border text-center flex flex-col items-center justify-center bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 shadow-xs">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-0.5 text-center">
                          Projected Cash Pot
                        </p>
                        <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-[#FBBF24] tabular-nums tracking-tight text-center">
                          KES {isStealthMode ? "****" : calculatedPot.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium mt-0.5 text-center">
                          {members.filter((m) => m.hasPaid && m.isActive !== false && (m as any).playMode !== 'sidebets_only').length} active contributions
                        </p>
                      </div>

                      {/* Resolve button directly below Projected Cash Pot — matching width */}
                      <button
                        id="tour-resolve-gw"
                        onClick={() => setTimeout(() => setShowResolveModal(true), 0)}
                        disabled={isResolved}
                        className={clsx(
                          "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black tracking-wide rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs whitespace-nowrap",
                          isResolved
                            ? "bg-slate-200 text-slate-500 border border-slate-300 dark:bg-white/10 dark:border-white/10 dark:text-gray-400 cursor-not-allowed"
                            : "bg-[#FBBF24] hover:bg-amber-400 text-slate-950 font-black border border-amber-300 shadow-[0_2px_12px_rgba(251,191,36,0.25)]"
                        )}
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>{isResolved ? "Resolved ✓" : "Resolve"}</span>
                      </button>

                      {leaderName && (
                        <button
                          onClick={() => {
                            haptics.celebrate();
                            setShowChairmanFlexModal(true);
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-500/35 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 dark:border-emerald-500/30 text-xs font-bold tracking-wide transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                          title="Generate Champion Victory Card for WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Victory Card</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
              <div className="xl:col-span-8 fc-highlight-card fc-command-board rounded-4xl border border-amber-300/40 dark:border-[#FBBF24]/24 bg-gradient-to-br from-amber-100 via-white to-slate-100 dark:from-[#FBBF24]/12 dark:via-[#161d24] dark:to-[#161d24] p-5 md:p-7 shadow-xl">
                <div className="flex flex-col items-center text-center gap-5 mb-5">
                  <div className="max-w-2xl space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 dark:text-[#FBBF24] mb-2">
                      Chairman priorities
                    </p>
                    <h3 className="fc-command-board-title fc-command-board-title-heading text-3xl md:text-4xl font-black tracking-tight drop-shadow-sm" style={{ color: '#1f2937' }}>
                      Priority Actions
                    </h3>
                    <p className="fc-command-board-copy text-sm md:text-base mt-2 max-w-xl mx-auto leading-relaxed" style={{ color: '#334155' }}>
                      Resolve the highest-risk items first, then move into the ledger and finance queues.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 w-full">
                  <div
                    className={clsx(
                      "fc-card rounded-2xl border border-[#FBBF24]/24 bg-gradient-to-br from-[#FBBF24]/12 via-[#161d24] to-[#161d24] p-4 hover:border-[#FBBF24]/40 transition-all shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between cursor-pointer active:scale-95",
                      sortedPendingPayouts.length > 0 ? "fc-metric-alert" : "fc-metric-stable",
                    )}
                    onClick={() => {
                      if (sortedPendingPayouts.length > 0) {
                        setActiveTab("dashboard");
                        setTimeout(() => scrollToSection("pending-payout-queue"), 100);
                        showToast("Viewing pending payout approvals.");
                      } else {
                        setActiveTab("dashboard");
                        showToast("All payouts are up to date! 0 approvals pending.");
                      }
                    }}
                    title="Tap to review payout approvals"
                  >
                    <p className="fc-metric-label text-xs tracking-wide font-semibold">
                      approve payouts
                    </p>
                    <p className="fc-metric-value text-2xl md:text-3xl font-semibold mt-2 tabular-nums">
                      {sortedPendingPayouts.length}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {sortedPendingPayouts.length > 0 ? "Action required" : "All cleared ✓"}
                    </p>
                  </div>
                  <div
                    className={clsx(
                      "fc-card rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d24] via-[#161d24] to-[#0f1419] p-4 hover:border-amber-500/40 transition-all shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between cursor-pointer active:scale-95",
                      redZoneMembers.length > 0 ? "fc-metric-alert" : "fc-metric-stable",
                    )}
                    onClick={() => {
                      setActiveTab("ledger");
                      setPaymentFilter("Red Zone");
                      setTimeout(() => scrollToSection("master-ledger"), 100);
                      showToast(`Viewing ${redZoneMembers.length} Red Zone members in ledger.`);
                    }}
                    title="Tap to view Red Zone members"
                  >
                    <p className="fc-metric-label text-xs tracking-wide font-semibold">
                      red zone follow-ups
                    </p>
                    <p className="fc-metric-value text-2xl md:text-3xl font-semibold mt-2 tabular-nums">
                      {redZoneMembers.length}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {redZoneMembers.length > 0 ? "Tap to send reminders" : "All members funded ✓"}
                    </p>
                  </div>
                  <div
                    className={clsx(
                      "fc-card rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d24] via-[#161d24] to-[#0f1419] p-4 hover:border-blue-500/40 transition-all shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between cursor-pointer active:scale-95",
                      pendingDisputes.length > 0 ? "fc-metric-alert" : "fc-metric-stable",
                    )}
                    onClick={() => {
                      setActiveTab("finance");
                      setTimeout(() => scrollToSection("dispute-claims"), 100);
                      showToast(pendingDisputes.length > 0 ? "Viewing unresolved disputes." : "No disputes pending! Viewing claims history.");
                    }}
                    title="Tap to view payment disputes"
                  >
                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">
                      unresolved disputes
                    </p>
                    <p className="fc-metric-value text-2xl md:text-3xl font-semibold mt-2 tabular-nums">
                      {pendingDisputes.length}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {pendingDisputes.length > 0 ? "Review payment claims" : "Zero active disputes ✓"}
                    </p>
                  </div>
                  <div
                    className={clsx(
                      "fc-card rounded-2xl border p-4 transition-all shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between cursor-pointer active:scale-95",
                      gwAlreadySettled
                        ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/12 via-[#161d24] to-[#161d24] hover:border-emerald-400/60 shadow-[0_0_18px_rgba(16,185,129,0.15)]"
                        : "border-white/10 bg-gradient-to-br from-[#FBBF24]/10 via-[#161d24] to-[#161d24] hover:border-[#FBBF24]/50 hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                    )}
                    onClick={() => {
                      setShowResolveModal(true);
                      showToast(gwAlreadySettled ? `Viewing GW${currentGwNumber || ''} settlement summary.` : `Opening GW${currentGwNumber || ''} payout resolution.`);
                    }}
                    title={gwAlreadySettled ? "Tap to review GW settlement" : "Tap to settle GW winner"}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <p className={clsx(
                        "fc-metric-label text-xs tracking-wide font-semibold",
                        gwAlreadySettled ? "text-emerald-300" : isCurrentEventFinished ? "text-white" : "text-emerald-400"
                      )}>
                        {gwAlreadySettled
                          ? "GW Settled ✓"
                          : Number(rules?.weekly ?? 70) === 0
                            ? (isCurrentEventFinished ? "Standings Updated ✓" : "Season Vault Mode")
                            : "Settle GW Winner"
                        }
                      </p>
                      {gwAlreadySettled ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      ) : !isCurrentEventFinished ? (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      ) : null}
                    </div>

                    <div className="my-auto py-1 flex flex-col items-center justify-center text-center w-full">
                      <span className={clsx(
                        "text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-block max-w-full truncate",
                        gwAlreadySettled 
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" 
                          : isCurrentEventFinished
                            ? "text-[#FBBF24] bg-amber-500/15 border border-amber-500/30"
                            : "text-emerald-300 bg-emerald-500/10 border border-emerald-500/30"
                      )}>
                        {gwAlreadySettled 
                          ? `GW${currentGwNumber || ''} Settled ✓` 
                          : isCurrentEventFinished
                            ? `Pay GW${currentGwNumber || ''} Winner`
                            : "Fixtures in Progress"}
                      </span>
                    </div>

                    <p className="text-[10px] text-gray-500 text-center font-medium">
                      {gwAlreadySettled
                        ? "Tap to review settlement"
                        : isCurrentEventFinished
                          ? "Tap to disburse or resolve"
                          : "Resolves after final whistle"}
                    </p>
                  </div>
                  <div
                    className={clsx(
                      "fc-card rounded-2xl border p-4 transition-all shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between cursor-pointer active:scale-95",
                      allPayableMembersFunded
                        ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/14 via-[#161d24] to-[#0f1419] shadow-[0_0_18px_rgba(16,185,129,0.15)] fc-metric-stable hover:border-emerald-400/50"
                        : "border-red-500/35 bg-gradient-to-br from-red-500/14 via-[#161d24] to-[#0f1419] fc-metric-alert hover:border-red-400/50",
                    )}
                    onClick={() => {
                      setActiveTab("ledger");
                      setPaymentFilter(allPayableMembersFunded ? "Verified" : "Red Zone");
                      setTimeout(() => scrollToSection("master-ledger"), 100);
                      showToast(allPayableMembersFunded ? "Viewing funded members in ledger." : "Viewing unfunded members in ledger.");
                    }}
                    title="Tap to view member payment statuses in ledger"
                  >
                    <p
                      className={clsx(
                        "fc-metric-label text-xs tracking-wide font-semibold",
                        allPayableMembersFunded
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-red-700 dark:text-red-300",
                      )}
                    >
                      members paid
                    </p>
                    <p className="fc-metric-value text-2xl md:text-3xl font-semibold mt-2 tabular-nums">
                      {fundedMembersCount}/{Math.max(1, activeMembersCount)}
                    </p>
                    <p
                      className={clsx(
                        "text-[10px] font-medium mt-1",
                        allPayableMembersFunded
                          ? "text-emerald-400/80"
                          : "text-red-400/80 font-bold",
                      )}
                    >
                      {!allPayableMembersFunded ? "funding incomplete · Tap to inspect" : "100% funded ✓"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {/* Action buttons removed as requested */}
                </div>
              </div>

              <div className="fc-invite-card xl:col-span-4 w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
                <div className="fc-invite-card-body p-8 flex flex-col justify-center relative min-h-[220px] bg-gradient-to-b from-[#1a232b] to-[#161d24] h-full">
                  <span className="text-[#10B981] text-xs font-bold tracking-widest uppercase mb-4 mt-4">
                    Master Invite Code
                  </span>
                  <div className="text-5xl lg:text-6xl font-black text-[#FBBF24] tracking-tight mb-6 tabular-nums">
                    {inviteCode.slice(0, 3)} {inviteCode.slice(3, 6)}
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-8">
                    Share this 6-digit PIN to grant access to{" "}
                    <strong>{leagueName}</strong>.
                  </p>
                  <div className="flex flex-col gap-3 mt-auto">
                    <button
                      onClick={shareInviteCode}
                      className="fc-invite-share flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-extrabold rounded-xl transition-colors shadow-[0_0_15px_rgba(37,211,102,0.3)]"
                    >
                      <Share2 className="w-4 h-4" /> Share via WhatsApp
                    </button>
                    <button
                      className="fc-invite-regenerate flex items-center justify-center gap-2 w-full py-3 hover:bg-white/5 border border-white/10 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                      disabled
                    >
                      <RefreshCw className="w-4 h-4" /> Regenerate
                    </button>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {pendingHQDebt > 0 && !isSuspended && (
            <section
              id="hq-settlement-workflow"
              className="fc-card rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4 md:p-5"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-yellow-300">
                    HQ Settlement Workflow
                  </h3>
                  <p className="text-xs text-gray-300 mt-1">
                    1) Pay HQ via Pochi ({hqPochiNumber}) 2) Submit receipt here
                    3) SuperAdmin verifies 4) Debt clears and next GW runs
                    cleanly.
                  </p>
                  {latestHqSettlement && (
                    <p className="text-[10px] text-gray-400 mt-2">
                      Latest submission:{" "}
                      <span className="font-black uppercase text-white">
                        {latestHqSettlement.status}
                      </span>
                      {latestHqSettlement.receiptCode
                        ? ` • ${latestHqSettlement.receiptCode}`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    value={hqReceiptCode}
                    onChange={(e) =>
                      setHqReceiptCode(e.target.value.toUpperCase().trim())
                    }
                    placeholder="Paste M-Pesa receipt"
                    className="px-3 py-2 rounded-xl border border-white/15 bg-black/20 text-sm text-white"
                  />
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, Number(pendingHQDebt || 1))}
                    value={hqPaymentAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      setHqPaymentAmount(
                        Math.max(1, Number(e.target.value || 0)),
                      )
                    }
                    className="px-3 py-2 rounded-xl border border-white/15 bg-black/20 text-sm text-white w-32"
                  />
                  <button
                    onClick={handleSubmitHqSettlement}
                    disabled={isSubmittingHqSettlement}
                    className="px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-60"
                  >
                    {isSubmittingHqSettlement ? "Sending..." : "Send to HQ"}
                  </button>
                </div>
              </div>
            </section>
          )}

          

          {/* GW Winners Ledger — scroll card, placed before stats */}
          {activeTab === 'dashboard' && (
            <div className="w-full bg-slate-50 dark:bg-[#161d24] border border-slate-200 dark:border-white/5 rounded-2xl p-4 md:p-5 overflow-hidden shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-gray-400 flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-[#FBBF24]" /> Gameweek Winners Ledger
                  </h4>
                  {forfeitedGws.length > 0 && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 shadow-sm">
                      {forfeitedGws.length} Voided
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-widest">
                    {isCurrentEventFinished ? `NEXT: GW ${nextPlayableGw} · PENDING` : `NOW: GW ${currentGwNumber || firestoreGw || '--'}`}
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-gray-500 hidden sm:inline">
                    · Tap any GW to manage / forfeit
                  </span>
                </div>
              </div>
              <div ref={gwLedgerScrollRef} className="flex md:justify-center gap-2 overflow-x-auto snap-x pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                {Array.from({ length: 38 }, (_, i) => i + 1)
                  .filter(gw => gw <= Math.max(effectiveStartGw, nextPlayableGw))
                  .map((gw) => {
                  const approvedPayout = pendingPayouts.find(
                    (p) => Number(p.gw) === gw && p.status === 'approved'
                  );
                  const pendingPayout = pendingPayouts.find(
                    (p) => Number(p.gw) === gw && p.status === 'awaiting_approval'
                  );
                  const isPreLeague = effectiveStartGw > 1 && gw < effectiveStartGw;
                  const isForfeited = isPreLeague || pendingPayouts.some(
                    (p) => Number(p.gw) === gw && p.status === 'forfeited'
                  ) || (leagueSettings?.forfeitedGws || []).includes(gw);
                  const isCurrent = gw === (currentGwNumber || firestoreGw);
                  const isNextPending = isCurrentEventFinished && gw === nextPlayableGw;
                  const isSkipped = !approvedPayout && !pendingPayout && !isForfeited && !isCurrent && !isNextPending && gw < (currentGwNumber || firestoreGw || 99);
                  return (
                    <button
                      key={gw}
                      type="button"
                      data-gw={gw}
                      title={
                        isPreLeague
                          ? `GW${gw} occurred before league start (GW${effectiveStartGw}) — voided`
                          : isForfeited
                          ? `GW${gw} is forfeited (no play) — click to manage`
                          : approvedPayout
                          ? `GW${gw} won by ${approvedPayout.winnerName} — click to view`
                          : pendingPayout
                          ? `GW${gw} payout pending approval — click to view`
                          : isNextPending
                          ? `GW${gw} is the upcoming round (pending kickoff)`
                          : isSkipped
                          ? `GW${gw} is unsettled — click to forfeit or resolve`
                          : isCurrent
                          ? `GW${gw} is currently live`
                          : undefined
                      }
                      onClick={() => {
                        setSelectedGwForAction(gw);
                        setShowGwActionModal(true);
                      }}
                      className={`snap-center flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all min-w-[64px] text-left cursor-pointer ${
                        approvedPayout
                          ? 'border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-500/70 hover:bg-emerald-500/20'
                          : pendingPayout
                          ? 'border-[#FBBF24]/40 bg-[#FBBF24]/10 hover:border-[#FBBF24]/70 hover:bg-[#FBBF24]/20'
                          : isForfeited
                          ? 'border-slate-300 dark:border-white/10 bg-white dark:bg-black/40 hover:border-slate-400 dark:hover:border-white/20 hover:bg-slate-100 dark:hover:bg-white/5 opacity-90 text-slate-800 dark:text-gray-200 shadow-sm'
                          : isNextPending
                          ? 'border-sky-500/40 bg-sky-500/10 hover:border-sky-500/70 hover:bg-sky-500/20'
                          : isCurrent
                          ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                          : isSkipped
                          ? 'border-amber-500/35 bg-amber-500/10 hover:border-amber-500/65 hover:bg-amber-500/20 animate-pulse'
                          : 'border-slate-200 dark:border-white/5 bg-transparent hover:border-slate-300 dark:hover:border-white/15'
                      }`}
                    >
                      <span className={`text-[9px] font-black uppercase tracking-widest ${
                        isNextPending ? 'text-sky-600 dark:text-sky-400 font-black' : isCurrent ? 'text-slate-900 dark:text-white font-black' : isForfeited ? 'text-slate-700 dark:text-gray-300 font-bold' : isSkipped ? 'text-amber-500 dark:text-amber-400' : approvedPayout ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-500 dark:text-gray-400'
                      }`}>GW{gw}</span>
                      <span className={`text-[8px] font-bold ${
                        approvedPayout
                          ? (Number(approvedPayout.amount || 0) === 0 ? 'text-amber-500 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400')
                          : pendingPayout
                          ? 'text-amber-500 dark:text-[#FBBF24]'
                          : isForfeited
                          ? 'text-rose-600 dark:text-rose-400 font-black'
                          : isNextPending
                          ? 'text-sky-600 dark:text-sky-400 font-black'
                          : isCurrent
                          ? 'text-emerald-600 dark:text-emerald-400 font-black'
                          : isSkipped
                          ? 'text-amber-500 dark:text-amber-400'
                          : 'text-slate-400 dark:text-gray-600'
                      }`}>
                        {approvedPayout
                          ? (Number(approvedPayout.amount || 0) === 0 ? '🏆 Crown' : '✓ Paid')
                          : pendingPayout
                          ? '⏳ Pending'
                          : isForfeited
                          ? '🚫 Void'
                          : isNextPending
                          ? '⏳ Pending'
                          : isCurrent
                          ? (isCurrentEventFinished ? 'Final' : 'Live')
                          : isSkipped
                          ? '⚠ Skip'
                          : '—'}
                      </span>
                      {approvedPayout && (
                        <span className="text-[8px] text-emerald-600 dark:text-emerald-300 font-bold truncate max-w-[56px] text-center">
                          {approvedPayout.winnerName?.split(' ')[0]}
                        </span>
                      )}
                      {isForfeited && (
                        <span className="text-[7px] text-slate-600 dark:text-gray-400 font-extrabold uppercase tracking-widest">{isPreLeague ? 'Pre-League' : 'Forfeited'}</span>
                      )}
                      {isNextPending && (
                        <span className="text-[7px] text-sky-600 dark:text-sky-400 font-bold uppercase tracking-widest">Upcoming</span>
                      )}
                      {isSkipped && (
                        <span className="text-[7px] text-amber-500 dark:text-amber-300 font-black uppercase tracking-widest">Tap</span>
                      )}
                      {isCurrent && !isCurrentEventFinished && (
                        <span className="text-[7px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">Active</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}



          {/* Co-Chair: Pending Payout Approval Panel */}

          {sortedPendingPayouts.length > 0 && (
            <section id="pending-payout-queue" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold flex items-center gap-2 text-[#FBBF24]">
                  <AlertTriangle className="w-5 h-5" />{" "}
                  {isCoChairSession
                    ? "Co-Chair Inbox: Awaiting Approval"
                    : "Maker/Checker: Awaiting Approval"}
                </h2>
                {hasValidCoChair && (
                  <button
                    disabled={nudgeSent}
                    onClick={handleNudge}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#FBBF24] hover:bg-[#eab308] text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors active:scale-95 disabled:opacity-50"
                  >
                    {nudgeSent ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Bell className="w-3 h-3" />
                    )}
                    {nudgeSent ? "Nudged ✓" : "Nudge Co-Chair"}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {sortedPendingPayouts.map((payout) =>
                  (() => {
                    const effectiveApprovalTarget =
                      getEffectiveApprovalTarget(payout);
                    const legacyApprovalTarget =
                      !payout.approvalTarget ||
                      (payout.approvalTarget === "co-chair" &&
                        !hasValidCoChair);
                    const requiresCoChairSignature =
                      effectiveApprovalTarget === "co-chair";
                    const canCurrentUserApprove = true; // Pilot Override: Allow Chairman to approve any payout immediately without strict Maker/Checker.
                    const winnerMember = members.find(
                      (member) =>
                        member.id === payout.winnerId ||
                        member.displayName === payout.winnerName,
                    );
                    const payoutPhone =
                      payout.winnerPhone || winnerMember?.phone;
                    const duplicateCandidate =
                      sortedPendingPayouts.filter(
                        (item: any) =>
                          Number(item.gw) === Number(payout.gw) &&
                          item.status === "awaiting_approval",
                      ).length > 1;
                    const payoutAgeMs = payout.timestamp?.toDate
                      ? Date.now() - payout.timestamp.toDate().getTime()
                      : 0;
                    const payoutAgeMins = Math.max(
                      0,
                      Math.floor(payoutAgeMs / (1000 * 60)),
                    );
                    return (
                      <div
                        key={payout.id}
                        className={clsx(
                          "bg-[#FBBF24]/10 border border-[#FBBF24]/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300",
                          resolutionPulse && "fc-burst-success",
                        )}
                      >
                        <div>
                          <p className="text-white font-bold text-sm">
                            {payout.gwName || `GW${payout.gw}`} Payout Request
                          </p>
                          <p className="text-gray-300 text-sm mt-1">
                            <span className="text-[#FBBF24] font-bold">
                              KES {Number(payout.amount).toLocaleString()}
                            </span>{" "}
                            → {payout.winnerName} ({payout.winnerPhone})
                          </p>
                          <p className="text-gray-500 text-[10px] mt-1 uppercase tracking-widest font-bold">
                            Requested by: {payout.requestedBy || "Chairman"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {!payoutPhone && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-300">
                                Missing phone
                              </span>
                            )}
                            {duplicateCandidate && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">
                                Possible duplicate
                              </span>
                            )}
                            {legacyApprovalTarget && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-sky-500/30 bg-sky-500/10 text-sky-300">
                                Legacy approval target
                              </span>
                            )}
                            <span
                              className={clsx(
                                "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border",
                                payoutAgeMins > 30
                                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                                  : "border-white/20 bg-white/10 text-gray-300",
                              )}
                            >
                              SLA age: {payoutAgeMins}m
                            </span>
                          </div>

                          {/* M-Pesa Actual Cost Input */}
                          <div className="flex items-center gap-2 mt-2.5 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 w-fit">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">M-Pesa Fee:</span>
                            <span className="text-xs text-emerald-400 font-mono">KES</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={payoutCustomFee[payout.id] ?? payout.mpesaFee ?? (isPilotMode ? 15 : Math.round(Number(payout.grossPot || payout.amount || 0) * 0.015))}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setPayoutCustomFee(prev => ({ ...prev, [payout.id]: Math.max(0, Number(e.target.value)) }))}
                              className="w-16 bg-black/60 border border-white/10 rounded px-2 py-0.5 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                              placeholder="15"
                              title="Enter actual M-Pesa B2C / sending fee incurred"
                            />
                            <span className="text-[9px] text-gray-500">{isPilotMode ? "Pilot Cost" : "1.5% network"}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap w-full sm:w-auto mt-2 sm:mt-0 items-center">
                          <span className="flex-1 sm:flex-initial px-4 py-2.5 bg-black/40 text-[#FBBF24] border border-[#FBBF24]/20 text-[10px] sm:text-[11px] font-black tracking-widest uppercase rounded-xl flex items-center justify-center gap-2 shadow-inner">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                            {requiresCoChairSignature
                              ? "Awaiting Co-Chair Signature"
                              : hasValidCoChair
                                ? "Awaiting Chairman Signature"
                                : "Awaiting Chairman Signature (Fallback)"}
                          </span>
                          <button
                            onClick={() => generateWhatsAppReceipt(payout)}
                            className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 text-[10px] sm:text-[11px] font-black tracking-widest uppercase rounded-xl transition-colors shadow-inner flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" /> Share
                          </button>
                          <button
                            onClick={() => handleRejectPayout(payout.id)}
                            className="flex-1 sm:flex-initial px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] sm:text-[11px] font-black tracking-widest uppercase rounded-xl transition-colors shadow-inner flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Reject
                          </button>
                          {canCurrentUserApprove && (
                            <>
                              <button
                                onClick={() => handleApprovePayout(payout)}
                                disabled={isApprovingPayout === payout.id}
                                className="w-full sm:w-auto px-5 py-2.5 bg-[#10B981] hover:bg-[#059669] text-black text-[11px] font-black tracking-widest uppercase rounded-xl transition-colors shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                              >
                                {isApprovingPayout === payout.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                {payout.method === "cash"
                                  ? "Confirm Cash Handoff"
                                  : "Approve M-Pesa"}
                              </button>
                              {payout.method !== "cash" && (
                                <button
                                  onClick={() =>
                                    handleApprovePayout(payout, "cash")
                                  }
                                  disabled={isApprovingPayout === payout.id}
                                  className="w-full sm:w-auto px-5 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-black tracking-widest uppercase rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Banknote className="w-3.5 h-3.5" />
                                  Cash Handoff
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })(),
                )}
              </div>
            </section>
          )}
        </div>

        <div
          id="tour-finance-ops"
          className={
            activeTab === "finance"
              ? "block animate-in fade-in duration-500"
              : "hidden"
          }
        >
          {/* Generate League Access Section */}
          <section className="fc-vault-explainer space-y-4 px-1 sm:px-3">

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-8 w-full">
              <div className="xl:col-span-12 flex flex-col gap-5 md:gap-8 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 w-full">
                  <PotVaultSwapper
                    weeklyPot={weeklyPot}
                    seasonVault={seasonVault}
                    projectedSeasonVault={projectedSeasonVault}
                    weeklyRulesPercent={rules.weekly}
                    isStealthMode={isStealthMode}
                  />

                  {/* Total Collections Card */}
                  <div
                    id="tour-ledger"
                    className="bg-[#161d24] border border-[#10B981]/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 md:p-8 relative overflow-hidden shadow-lg hover:border-[#10B981]/30 transition-colors w-full min-h-[220px] flex flex-col justify-center"
                  >
                    <div className="absolute top-6 right-6 opacity-[0.03] pointer-events-none">
                      <Banknote className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center border border-[#10B981]/20">
                          <Banknote className="w-5 h-5 text-[#10B981]" />
                        </div>
                        <span className="text-[10px] font-bold tracking-widest text-[#10B981] uppercase bg-[#10B981]/10 px-2.5 py-1 rounded-md border border-[#10B981]/20">
                          Live Sync
                        </span>
                      </div>
                      <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2">
                        Current GW Collections
                      </p>
                      <div className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
                        KES{" "}
                        {isStealthMode
                          ? "****"
                          : totalCollected.toLocaleString()}
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        {exactCurrentGwFormula}
                      </p>
                      <div className="flex items-center gap-2 text-[#10B981] text-[10px] md:text-xs font-bold mt-4">
                        {fundedMembersCount} members fully funded
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operations Feed — dynamic based on GW state */}
                <div className="fc-ops-feed w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl p-6 sm:p-8 md:p-10">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 uppercase tracking-widest">
                      <Bell className="w-4 h-4" /> Operations Feed
                    </h4>
                    {liveOpsEvents.length > 3 && (
                      <button
                        onClick={() => setShowOpsModal(true)}
                        className="text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        View All ({liveOpsEvents.length})
                      </button>
                    )}
                  </div>

                  {/* WhatsApp Receipt Share Card — appears after GW resolution */}
                  {whatsappReceipt && (
                    <div className="mb-4 bg-[#0a1f12] border border-green-600/30 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">📲</span>
                        <span className="text-green-400 text-xs font-black uppercase tracking-widest">
                          GW Resolution Receipt Ready
                        </span>
                      </div>
                      <pre className="text-[10px] text-gray-300 whitespace-pre-wrap font-mono bg-black/30 rounded-xl p-3 mb-3 leading-relaxed border border-white/5 max-h-40 overflow-y-auto">
                        {whatsappReceipt}
                      </pre>
                      <div className="flex gap-2">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(whatsappReceipt)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-white text-xs font-black rounded-xl transition-colors"
                        >
                          Share to WhatsApp Group
                        </a>
                        <button
                          onClick={() => setWhatsappReceipt(null)}
                          className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold rounded-xl transition-colors border border-white/5"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Live operation events — show latest 3 only */}
                  {liveOpsEvents.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {liveOpsEvents.slice(0, 3).map((evt: any) => {
                        const ts = evt.timestamp?.toDate ? evt.timestamp.toDate() : null;
                        const isSuccess = evt.type === 'success' || String(evt.message || '').startsWith('✅');
                        const isWarning = evt.type === 'warning' || String(evt.message || '').startsWith('⚠️');
                        return (
                          <div key={evt.id} className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className={clsx(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs",
                              isSuccess ? "bg-emerald-500/10 border border-emerald-500/20" : isWarning ? "bg-amber-500/10 border border-amber-500/20" : "bg-blue-500/10 border border-blue-500/20"
                            )}>
                              {isSuccess ? '✅' : isWarning ? '⚠️' : 'ℹ️'}
                            </div>
                            <div className="flex-1 min-w-0">
                              {evt.title && <p className="text-xs font-bold text-white truncate">{evt.title}</p>}
                              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{evt.message}</p>
                              {ts && <span className="text-[9px] font-bold text-gray-600 tracking-widest uppercase mt-1 block">{ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {ts.toLocaleDateString()}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Dynamic GW status card */}
                  <div className={clsx(
                    "flex gap-4 p-4 rounded-xl border transition-colors",
                    gwAlreadySettled
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : isCurrentEventFinished
                        ? "bg-amber-500/5 border-amber-500/20"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                  )}>
                    <div className={clsx(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      gwAlreadySettled
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : isCurrentEventFinished
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : "bg-[#10B981]/10 border border-[#10B981]/20"
                    )}>
                      {gwAlreadySettled
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        : isCurrentEventFinished
                          ? <Trophy className="w-5 h-5 text-amber-400" />
                          : <UserPlus className="w-5 h-5 text-[#10B981]" />
                      }
                    </div>
                    <div>
                      <h5 className={clsx(
                        "text-sm font-bold tracking-wide",
                        gwAlreadySettled ? "text-emerald-300" : isCurrentEventFinished ? "text-amber-300" : "text-white"
                      )}>
                        {gwAlreadySettled
                          ? `GW${currentGwNumber || ''} Settled ✓`
                          : isCurrentEventFinished
                            ? (Number(rules?.weekly ?? 70) === 0
                                ? `GW${currentGwNumber || ''} Concluded — Standings Updated`
                                : `GW${currentGwNumber || ''} Ended — Settle Winner Now`)
                            : `League Open for Gameweek ${currentGwNumber || firestoreGw || '--'}`
                        }
                      </h5>
                      <p className="text-xs text-gray-400 mt-1">
                        {gwAlreadySettled
                          ? `Winner paid. System is preparing for GW${currentGwNumber ? currentGwNumber + 1 : ''}.`
                          : isCurrentEventFinished
                            ? (Number(rules?.weekly ?? 70) === 0
                                ? `GW${currentGwNumber || ''} matches finished on FPL. 100% Season Vault league — points credited to championship table.`
                                : `GW${currentGwNumber || ''} is finished on FPL. Go to Priority Actions → Settle GW Winner.`)
                            : `Accepting deposits for Gameweek ${currentGwNumber || firestoreGw || '--'}. Deadline approaches.`
                        }
                      </p>
                      <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-2 block">
                        System
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Module 3B: Dispute Claim Alerts */}
          {pendingDisputes.length > 0 && (
            <section className="bg-[#1a1500] border border-[#FBBF24]/25 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 px-6 border-b border-[#FBBF24]/20 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />
                <h3 className="font-bold text-[#FBBF24] text-sm tracking-wide">
                  Payment Dispute Claims
                </h3>
                <span className="ml-auto bg-[#FBBF24]/20 text-[#FBBF24] text-[10px] font-black px-2 py-0.5 rounded-full border border-[#FBBF24]/30">
                  {pendingDisputes.length} pending
                </span>
              </div>
              <div className="divide-y divide-[#FBBF24]/10">
                {pendingDisputes.map((dispute) => (
                  <div
                    key={dispute.id}
                    className="p-4 px-6 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white text-sm">
                          {dispute.memberName}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {dispute.phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-400">
                          Claims receipt:
                        </span>
                        <span className="font-mono text-xs bg-[#FBBF24]/10 text-[#FBBF24] px-2 py-0.5 rounded border border-[#FBBF24]/20">
                          {dispute.receiptCode}
                        </span>
                        <span className="text-xs text-gray-400">
                          for KES {dispute.amount?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRejectDispute(dispute)}
                        disabled={processingDispute === dispute.id}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl border border-red-500/20 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveDispute(dispute)}
                        disabled={processingDispute === dispute.id}
                        className="px-4 py-2 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] text-xs font-bold rounded-xl border border-[#10B981]/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {processingDispute === dispute.id ? (
                          <span className="animate-pulse">...</span>
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        Approve & Grant Access
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pochi Payment Alerts */}
          {pendingPochiRequests.length > 0 && (
            <section className="bg-[#1a1500] border border-emerald-500/25 rounded-2xl overflow-hidden shadow-2xl mt-6">
              <div className="p-4 px-6 border-b border-emerald-500/20 flex items-center gap-3">
                <Banknote className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-emerald-400 text-sm tracking-wide">
                  Pending Pochi Payments
                </h3>
                <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {pendingPochiRequests.length} pending
                </span>
              </div>
              <div className="divide-y divide-emerald-500/10">
                {pendingPochiRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 px-6 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white text-sm">
                          {req.memberName}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {req.phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-400">
                          Sent:
                        </span>
                        <span className="font-mono text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                          KES {req.amount?.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400">
                          covers {gameweekStake > 0 ? Math.floor(req.amount / gameweekStake) : '—'} GWs
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleRejectPochi(req)}
                        disabled={processingPochi === req.id}
                        className="flex-1 sm:flex-initial px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl border border-red-500/20 transition-colors disabled:opacity-50 text-center"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprovePochi(req)}
                        disabled={processingPochi === req.id}
                        className="flex-1 sm:flex-initial px-4 py-2 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] text-xs font-bold rounded-xl border border-[#10B981]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {processingPochi === req.id ? (
                          <span className="animate-pulse">...</span>
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        Approve & Fund
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div
          className={
            activeTab === "ledger"
              ? "block space-y-4 animate-in fade-in duration-500"
              : "hidden"
          }
        >
          {/* The Master Ledger Section */}
          <div className="w-full space-y-4">
            {/* Quick Ledger Overview Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="fc-card rounded-2xl p-4 sm:p-5 border border-amber-300/30 dark:border-[#FBBF24]/20 bg-gradient-to-br from-amber-500/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] flex items-center justify-between shadow-md">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-[#FBBF24]">Total Members</p>
                  <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white mt-1">{members.length}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Registered in league</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-[#FBBF24]/10 border border-[#FBBF24]/20 flex items-center justify-center text-amber-500 dark:text-[#FBBF24]">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="fc-card rounded-2xl p-4 sm:p-5 border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] flex items-center justify-between shadow-md">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Funded / Active</p>
                  <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white mt-1">
                    {members.filter(m => memberHasFunding(m)).length}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Eligible for GW pot</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="fc-card rounded-2xl p-4 sm:p-5 border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-white dark:via-[#161d24] to-white dark:to-[#161d24] flex items-center justify-between shadow-md">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Pending Deposit</p>
                  <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white mt-1">
                    {members.filter(m => !memberHasFunding(m)).length}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Top-up required</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </div>

            <section
              id="master-ledger"
              className="fc-card rounded-3xl sm:rounded-4xl border border-amber-300/40 dark:border-[#FBBF24]/20 bg-gradient-to-br from-amber-50/50 via-white to-slate-50/50 dark:from-[#FBBF24]/10 dark:via-[#161d24] dark:to-[#161d24] overflow-hidden shadow-2xl"
            >
            <div className="p-5 sm:p-6 border-b border-black/5 dark:border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600 dark:text-[#FBBF24] mb-1">
                  {tabCopy.ledger.eyebrow}
                </p>
                <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                  {tabCopy.ledger.title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xl font-medium">
                  {tabCopy.ledger.description}
                </p>
              </div>
              <div className="flex items-center flex-wrap gap-2.5 sm:justify-end relative">
                <span className="text-xs text-gray-500 font-medium hidden sm:inline">
                  Filter:
                </span>
                <button
                  onClick={() => openWalletFundModal()}
                  className="flex items-center gap-2 bg-[#FBBF24]/10 border border-[#FBBF24]/30 px-3.5 py-2 rounded-xl text-xs sm:text-sm text-amber-600 dark:text-[#FBBF24] font-bold hover:bg-[#FBBF24]/20 transition-colors active:scale-95 cursor-pointer"
                >
                  <Banknote className="w-4 h-4" /> Fund Wallet
                </button>
                <button
                  onClick={() => navigate('/sidebets')}
                  className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-500/20 transition-colors active:scale-95 cursor-pointer"
                >
                  <Swords className="w-4 h-4" /> Side Bets
                </button>
                <button
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="flex items-center gap-2 bg-black/5 dark:bg-[#1a232b] border border-black/10 dark:border-white/10 px-3.5 py-2 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white font-bold hover:bg-black/10 dark:hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
                >
                  {paymentFilter === "All" ? "All Payments" : paymentFilter}{" "}
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {/* Dropdown Menu */}
                {isFilterDropdownOpen && (
                  <div className="absolute top-full mt-2 right-0 w-48 max-h-56 overflow-y-auto fc-dropdown-scroll bg-[#161d24] border border-white/10 rounded-xl shadow-2xl z-20">
                    <button
                      onClick={() => {
                        setPaymentFilter("All");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-white hover:bg-[#1a232b] transition-colors"
                    >
                      All Payments
                    </button>
                    <button
                      onClick={() => {
                        setPaymentFilter("Verified");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-[#10B981] hover:bg-[#10B981]/10 transition-colors"
                    >
                      Funded
                    </button>
                    <button
                      onClick={() => {
                        setPaymentFilter("Red Zone");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-[#FBBF24] hover:bg-[#FBBF24]/10 transition-colors"
                    >
                      Unpaid
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="divide-y divide-white/[0.04] min-h-[300px]">
              {filteredMembers.length === 0 ? (
                <div className="p-12 text-center text-gray-500 font-medium text-sm">
                  No members found matching this filter.
                </div>
              ) : (
                filteredMembers.map((row) => {
                  const wallet = (row as any).walletBalance ?? 0;
                  const gwCost = gameweekStake;
                  const gwsLeft = gwCost > 0 ? Math.floor(wallet / gwCost) : 0;
                  const walletColor =
                    wallet <= 0
                      ? "text-red-400"
                      : gwsLeft >= 2
                        ? "text-[#10B981]"
                        : "text-[#FBBF24]";
                  return (
                    <div
                      key={row.id}
                      className={clsx(
                        "px-4 py-3.5 flex flex-wrap sm:flex-nowrap items-center gap-3 transition-colors group",
                        memberHasFunding(row)
                          ? "bg-[#10B981]/5 border-l-2 border-[#10B981]"
                          : "hover:bg-white/[0.02] border-l-2 border-transparent",
                      )}
                    >
                      {/* Avatar */}
                      <UserAvatar name={row.displayName} size="md" />

                      {/* Name + actions */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                          <span className="font-bold text-white text-sm leading-tight truncate max-w-[130px] sm:max-w-none">{row.displayName}</span>
                          {(row as any).role === "admin" && (
                            <span className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Admin</span>
                          )}
                          {(row as any).paymentStreak >= 2 && (
                            <span className="inline-flex items-center gap-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-black" title={`${(row as any).paymentStreak}-GW streak!`}>
                              🔥{(row as any).paymentStreak}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{row.phone || '—'}</span>
                          <span className="text-white/20">•</span>
                          {row.id !== activeUserId && row.id !== chairmanId && (row as any).role !== "chairman" && (row as any).authUid !== auth.currentUser?.uid && (
                            <>
                              <button onClick={() => handleToggleAdmin(row.id, (row as any).role)} className="hover:text-white transition-colors">
                                {(row as any).role === "admin" ? "Revoke Admin" : "Make Admin"}
                              </button>
                              <span className="text-white/20">•</span>
                            </>
                          )}
                          <button onClick={() => openEditMemberModal(row)} className="hover:text-[#FBBF24] transition-colors">✏️ Edit</button>
                          <span className="text-white/20">•</span>
                          <button
                            onClick={() => handleToggleSpectator(row.id, (row as any).playMode)}
                            className={clsx(
                              "transition-colors",
                              (row as any).playMode === "sidebets_only" ? "text-indigo-400 hover:text-indigo-300 font-bold" : "hover:text-indigo-400"
                            )}
                            title={(row as any).playMode === "sidebets_only" ? "Switch member to Weekly & Season Cash Pot" : "Set member as Spectator (1v1 side bets only)"}
                          >
                            {(row as any).playMode === "sidebets_only" ? "Switch to Pot" : "Make Spectator"}
                          </button>
                          <span className="text-white/20">•</span>
                          <button onClick={() => handleDeleteMember(row.id, row.displayName)} className="text-red-400/80 hover:text-red-300 transition-colors">🗑️ Remove</button>
                        </div>
                      </div>

                      {/* Wallet + Status — hidden on xs, shown sm+ */}
                      <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                        <div className={clsx("font-bold tabular-nums text-sm", walletColor)}>
                          {isStealthMode ? "****" : `KES ${wallet.toLocaleString()}`}
                        </div>
                        <div className="text-[10px] text-gray-600 font-medium">
                          {(row as any).playMode === "sidebets_only" ? "Side-bets only" : gwsLeft > 0 ? `${gwsLeft} GW${gwsLeft !== 1 ? "s" : ""} covered` : "Top up needed"}
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2">
                        {(row as any).playMode === "sidebets_only" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold" title="Spectator & 1v1 Side-Bets Only">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span>Spectator</span>
                          </span>
                        ) : memberHasFunding(row) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-[10px] font-bold">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                            <span className="hidden sm:inline">Funded</span>
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/20 text-[10px] font-bold">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
                              <span className="hidden sm:inline">Unpaid</span>
                            </span>
                            <button 
                              onClick={() => handleMemberNudge(row)}
                              className="px-2 py-1 bg-[#FBBF24]/10 hover:bg-[#FBBF24]/20 border border-[#FBBF24]/20 text-[#FBBF24] rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1 active:scale-95"
                            >
                              <Bell className="w-3 h-3" /> <span className="hidden sm:inline">Nudge</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Toggle */}
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer fc-ledger-verify-input"
                          checked={row.hasPaid}
                          onChange={() => handleTogglePayment(row.id, row.hasPaid, row.displayName)}
                        />
                        <div className="fc-ledger-switch-track w-11 h-6 bg-[#1a232b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981] border border-white/10" />
                      </label>
                    </div>
                  );
                })
              )}
            </div>

            {/* Table Footer */}
            <div className="p-4 px-6 border-t border-white/5 flex items-center justify-between text-sm text-gray-500">
              <span>Showing {filteredMembers.length} members</span>
              <div className="flex gap-2">
                <button
                  onClick={downloadLeagueLedgerCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors font-bold text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Export Audit CSV
                </button>
                <button className="px-4 py-2 bg-[#1a232b] border border-white/5 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-medium">
                  Prev
                </button>
                <button className="px-4 py-2 bg-[#1a232b] border border-white/5 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-medium">
                  Next
                </button>
              </div>
            </div>
          </section>
          </div>

          {/* Gameweek Action / Forfeit Modal */}
          {showGwActionModal && selectedGwForAction && createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-[#161d24] border border-white/15 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#FBBF24]/10 border border-[#FBBF24]/25 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-[#FBBF24]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight">
                        Gameweek {selectedGwForAction} Action
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        Manage settlement, payouts or forfeit unplayed rounds
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGwActionModal(false)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Content */}
                {(() => {
                  const targetApproved = pendingPayouts.find((p: any) => Number(p.gw) === selectedGwForAction && p.status === 'approved');
                  const targetPending = pendingPayouts.find((p: any) => Number(p.gw) === selectedGwForAction && p.status === 'awaiting_approval');
                  const targetPreLeague = effectiveStartGw > 1 && selectedGwForAction < effectiveStartGw;
                  const targetForfeited = targetPreLeague || pendingPayouts.some((p: any) => Number(p.gw) === selectedGwForAction && p.status === 'forfeited') || (leagueSettings?.forfeitedGws || []).includes(selectedGwForAction);

                  if (targetPreLeague) {
                    return (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-gray-600/30 bg-gray-800/30 p-4">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-base">🚫</span>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-200">
                              Gameweek {selectedGwForAction} is Voided (Pre-League)
                            </p>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            This Gameweek occurred before your league officially started (League started at GW{effectiveStartGw}). No stakes were collected and member balances remained untouched.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (targetForfeited) {
                    return (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-gray-600/30 bg-gray-800/30 p-4">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-base">🚫</span>
                            <p className="text-xs font-black uppercase tracking-wider text-gray-200">
                              Gameweek {selectedGwForAction} is Forfeited
                            </p>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            This Gameweek is marked as unplayed. No pot or stakes were deducted, and deposited funds remain intact in member wallets.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnforfeitGw(selectedGwForAction)}
                          disabled={isForfeiting}
                          className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {isForfeiting ? <RefreshCw className="w-4 h-4 animate-spin" /> : `Reopen / Restore GW ${selectedGwForAction}`}
                        </button>
                      </div>
                    );
                  }

                  if (targetApproved) {
                    const isZeroPot = Number(targetApproved.amount || 0) === 0;
                    return (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                              {isZeroPot ? "🏆 Honorary Winner" : "✓ Settled & Paid"}
                            </span>
                            <span className="text-sm font-black text-[#FBBF24]">
                              {isZeroPot ? "Bragging Rights" : `KES ${Number(targetApproved.amount || 0).toLocaleString()}`}
                            </span>
                          </div>
                          <p className="text-sm text-white font-bold">{targetApproved.winnerName}</p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {isZeroPot 
                              ? `Topped GW with ${targetApproved.points || '--'} pts · Season Vault League` 
                              : `Disbursement: ${targetApproved.method === 'cash' ? 'Cash Handoff' : 'M-Pesa B2C'}`}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                          <p className="text-xs font-bold text-red-300 mb-1">Resolved in error?</p>
                          <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                            If your league did not actually play GW{selectedGwForAction}, you can forfeit it. This reverts the payout and refunds the KES {gameweekStake.toLocaleString()} stake back into each member's wallet balance.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleForfeitGw(selectedGwForAction)}
                            disabled={isForfeiting}
                            className="w-full py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            {isForfeiting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Forfeit & Refund Member Stakes'}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (targetPending) {
                    return (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-[#FBBF24]/30 bg-[#FBBF24]/10 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-[#FBBF24] uppercase tracking-widest">⏳ Pending Approval</span>
                            <span className="text-sm font-black text-[#FBBF24]">KES {Number(targetPending.amount || 0).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-white font-bold">{targetPending.winnerName}</p>
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setShowGwActionModal(false);
                              handleApprovePayout(targetPending);
                            }}
                            className="w-full py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-black text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve Payout
                          </button>
                          <button
                            type="button"
                            onClick={() => handleForfeitGw(selectedGwForAction)}
                            disabled={isForfeiting}
                            className="w-full py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            {isForfeiting ? <RefreshCw className="w-4 h-4 animate-spin" /> : `Did Not Play — Forfeit GW ${selectedGwForAction}`}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Default: Unsettled / Unplayed GW
                  return (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
                        GW{selectedGwForAction} is unsettled. Choose whether your league competed or did not play:
                      </div>

                      {/* Choice 1: Forfeit / Skip */}
                      <div className="p-4 rounded-2xl border border-white/10 bg-black/30 hover:border-gray-500/40 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                            <span>⛔</span> Forfeit / Skip Gameweek
                          </p>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                            Didn't Play
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                          Mark as unplayed because your league started later. Removes this GW from required season dues and ensures <strong>no money or stakes are deducted</strong> from member wallets.
                        </p>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleForfeitGw(selectedGwForAction, false)}
                            disabled={isForfeiting}
                            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            {isForfeiting ? <RefreshCw className="w-4 h-4 animate-spin" /> : `Forfeit GW ${selectedGwForAction}`}
                          </button>

                          {selectedGwForAction > 1 && (
                            <button
                              type="button"
                              onClick={() => handleForfeitGw(selectedGwForAction, true)}
                              disabled={isForfeiting}
                              className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              {isForfeiting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : `⚡ Forfeit All GW 1 through ${selectedGwForAction}`}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Choice 2: Played & Resolve Winner */}
                      <div className="p-4 rounded-2xl border border-[#FBBF24]/25 bg-[#FBBF24]/5 hover:border-[#FBBF24]/40 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-[#FBBF24]" /> Resolve Winner & Pay Out
                          </p>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                            Played
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                          If your league actually competed in GW{selectedGwForAction}: fetch official standings, finalize the winner, and queue the KES {weeklyPot.toLocaleString()} pot payout.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowGwActionModal(false);
                            setResolveTargetGw(selectedGwForAction);
                            setTimeout(() => setShowResolveModal(true), 0);
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-[#FBBF24] hover:bg-[#F59E0B] text-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                        >
                          <Trophy className="w-3.5 h-3.5" /> Resolve GW {selectedGwForAction} Winner
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-5 pt-3 border-t border-white/10 text-right">
                  <button
                    type="button"
                    onClick={() => setShowGwActionModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Champion WhatsApp Flex Card Modal for Chairman */}
          {showChairmanFlexModal && gwWinner && (
            <ChampionFlexCardModal
              isOpen={showChairmanFlexModal}
              onClose={() => setShowChairmanFlexModal(false)}
              winnerName={gwWinner.player_name || "Gameweek Champion"}
              teamName={gwWinner.entry_name}
              points={gwWinner.event_total || 0}
              gameweek={gwWinner.event || currentGwNumber || firestoreGw || ""}
              amountWon={Math.round(
                members.filter((m) => m.hasPaid && m.isActive !== false).length *
                  gameweekStake *
                  (rules.weekly / 100)
              )}
              leagueName={leagueName || "FantasyChama"}
              leagueCode={(leagueSettings as any)?.code || ''}
            />
          )}
          </div>
        </div>

        {/* Global Modals (accessible from all tabs) */}
        {showResolveModal && createPortal(
            <div className="fc-resolve-modal-overlay fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
              <div className="fc-resolve-modal bg-[#161d24] border border-[#FBBF24]/25 w-full max-w-md rounded-2xl shadow-[0_0_60px_rgba(251,191,36,0.1)] overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FBBF24]/10 flex items-center justify-center border border-[#FBBF24]/20">
                      <Trophy className="w-5 h-5 text-[#FBBF24]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight">Resolve Gameweek</h3>
                      <p className="text-[11px] text-gray-500 font-medium">Finalize winner & queue payout</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 overflow-y-auto">
                  {!isCurrentEventFinished && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-white">Gameweek {currentGwNumber || ''} Fixtures Still in Play</p>
                        <p className="text-[11px] text-amber-200/80 leading-relaxed">
                          Matches are currently active. Official FPL scores, bonus points, and rankings will finalize once the Premier League marks all fixtures finished.
                        </p>
                      </div>
                    </div>
                  )}

                  {weeklyPot === 0 ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Trophy className="w-5 h-5" />
                        <p className="text-xs font-black uppercase tracking-wider">Honorary Gameweek Crown (KES 0 Cash Pot)</p>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        This league operates on Season Vault focus or zero weekly cash pot. Resolving will officially award Gameweek {currentGwNumber || ''} bragging rights and crown the top-scoring manager on the ledger without disbursing cash.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Payout summary */}
                      <div className="rounded-xl border border-white/8 bg-black/20 p-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Winner Payout</p>
                          <p className="text-2xl font-black text-[#FBBF24] tabular-nums mt-0.5">
                            KES {isStealthMode ? "****" : weeklyPot.toLocaleString()}
                          </p>
                        </div>
                        <Banknote className="w-8 h-8 text-[#FBBF24]/30" />
                      </div>

                      {/* Method toggle */}
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Disbursement Method</p>
                        <div className="flex bg-black/30 rounded-xl p-1 border border-white/5">
                          <button
                            onClick={() => setPayoutMethod("mpesa")}
                            className={clsx(
                              "flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                              payoutMethod === "mpesa"
                                ? "bg-[#10B981]/15 text-[#10B981] shadow-sm border border-[#10B981]/25"
                                : "text-gray-500 hover:text-gray-300 border border-transparent"
                            )}
                          >
                            M-Pesa B2C
                          </button>
                          <button
                            onClick={() => setPayoutMethod("cash")}
                            className={clsx(
                              "flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                              payoutMethod === "cash"
                                ? "bg-[#FBBF24]/15 text-[#FBBF24] shadow-sm border border-[#FBBF24]/25"
                                : "text-gray-500 hover:text-gray-300 border border-transparent"
                            )}
                          >
                            Cash Handoff
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="p-5 pt-3 border-t border-white/5 flex items-center gap-3">
                  <button
                    onClick={() => setShowResolveModal(false)}
                    disabled={isResolving}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-gray-400 hover:text-white border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolveGameweek}
                    disabled={isResolving}
                    className="flex-1 px-4 py-2.5 rounded-xl font-black bg-[#FBBF24] hover:bg-[#F59E0B] text-[#111613] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-[0_0_20px_rgba(251,191,36,0.2)] cursor-pointer"
                  >
                    {isResolving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        {weeklyPot === 0 ? "Crown GW Winner 🏆" : "Confirm & Resolve"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Pilot Pre-Fund Modal */}
          {showPrefundOptions && (
            <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-8 bg-[#0a100a]/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
              <div className="fc-prefund-panel bg-[#161d24] border border-[#FBBF24]/30 w-full max-w-2xl rounded-3xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#FBBF24]/10 flex items-center justify-center border border-[#FBBF24]/20">
                      <Banknote className="w-6 h-6 text-[#FBBF24]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight">
                        Pilot Mode: Pre-Fund Wallets
                      </h3>
                      <p className="text-gray-400 text-xs font-medium mt-1">
                        Bulk seed legacy contributions (offline cash/M-Pesa)
                        into member wallets without triggering new Daraja
                        prompts.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 mb-6 px-1 border-t border-b border-white/5 py-4 space-y-3 custom-scrollbar">
                  {members.filter((m) => m.isActive !== false).length === 0 ? (
                    <div className="flex items-center justify-center h-28 text-sm text-gray-400">No active members to pre-fund.</div>
                  ) : (
                    members
                      .filter((m) => m.isActive !== false)
                      .map((m) => (
                      <div
                        key={m.id}
                        className="fc-prefund-row flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-xl transition-colors"
                      >
                        <div>
                          <p className="text-white font-bold text-sm flex items-center gap-2">
                            {m.displayName}{" "}
                            {m.role === "admin" && (
                              <ShieldCheck className="w-3.5 h-3.5 text-[#FBBF24]" />
                            )}
                          </p>
                          <p className="text-gray-500 text-[10px] tracking-widest mt-0.5">
                            Wallet: KES {m.walletBalance?.toLocaleString() || 0}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-bold">
                            KES
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={prefundData[m.id] || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                              setPrefundData((prev) => ({
                                ...prev,
                                [m.id]: cleaned,
                              }));
                            }}
                            className="fc-prefund-input w-36 rounded-lg py-2 px-3 text-sm focus:border-[#FBBF24]/50 focus:outline-none transition-all tabular-nums text-right"
                          />
                        </div>
                      </div>
                      ))
                  )}
                </div>

                {/* Toggle for Update Recent Activity */}
                <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={prefundUpdateRecentActivity}
                    onChange={(e) => setPrefundUpdateRecentActivity(e.target.checked)}
                    className="w-4 h-4 accent-[#FBBF24] cursor-pointer"
                    id="prefund-update-activity"
                  />
                  <label htmlFor="prefund-update-activity" className="flex-1 cursor-pointer text-sm text-gray-300">
                    <span className="font-bold text-white">Update Recent Activity</span>
                    <p className="text-xs text-gray-500 mt-0.5">Log this prefund operation to notifications & league events (visible to all members)</p>
                  </label>
                </div>

                <div className="flex gap-3 mt-auto shrink-0">
                  <button
                    type="button"
                    onClick={handlePrefundCancel}
                    className="fc-modal-secondary flex-1 py-3.5 font-bold uppercase tracking-widest text-xs rounded-xl transition-colors border"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePrefundSubmit}
                    disabled={
                      isPrefunding || Object.keys(prefundData).length === 0
                    }
                    className="flex-1 py-3.5 bg-[#FBBF24] hover:bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl transition-colors shadow-[0_0_15px_rgba(251,191,36,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    {isPrefunding ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirm & Seed Wallets"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        {showWalletFundModal && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-[#0a100a]/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="fc-prefund-panel bg-[#161d24] border border-[#10B981]/30 w-full max-w-2xl rounded-3xl p-5 sm:p-6 md:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#10B981]">
                    Direct Wallet Funding
                  </p>
                  <h3 className="text-2xl font-black text-white tracking-tight mt-1">
                    Fund a member wallet
                  </h3>
                  <p className="text-gray-400 text-xs font-medium mt-1">
                    Record an M-Pesa prompt or cash handoff directly on the ledger.
                  </p>
                </div>
                <button
                  onClick={() => setShowWalletFundModal(false)}
                  className="fc-modal-secondary px-3 py-2 rounded-lg border text-xs font-bold"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Member
                  </span>
                  <div className="relative">
                    <select
                      value={fundTargetMemberId}
                      onChange={(e) => setFundTargetMemberId(e.target.value)}
                      className="fc-prefund-input w-full appearance-none rounded-xl border border-gray-300 dark:border-white/10 px-3.5 py-3 pr-10 bg-white dark:bg-[#0d1316] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 focus:border-[#10B981] cursor-pointer font-semibold shadow-sm transition-all"
                    >
                      <option value="" className="bg-white dark:bg-[#0d1316] text-gray-500 dark:text-gray-400 py-1.5 font-medium">Select member</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id} className="bg-white dark:bg-[#0d1316] text-gray-900 dark:text-white py-1.5 font-medium">
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-[#10B981] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-400" /> Amount (KES)
                  </span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">KES</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fundAmount}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                        setFundAmount(cleaned);
                      }}
                      placeholder="e.g. 500"
                      className="fc-prefund-input w-full rounded-xl border pl-14 pr-4 py-3 text-base font-bold text-white focus:border-emerald-500"
                    />
                  </div>
                </label>

                <div className="space-y-2 md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-emerald-400" /> Funding Method
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setFundMethod("mpesa");
                        setFundPromptSent(false);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3.5 cursor-pointer ${
                        fundMethod === "mpesa"
                          ? "bg-emerald-500/15 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        fundMethod === "mpesa" ? "bg-emerald-500 text-slate-950 font-black" : "bg-white/10 text-gray-400"
                      }`}>
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white leading-tight">M-Pesa STK Prompt</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Send PIN prompt to phone</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFundMethod("cash");
                        setFundPromptSent(false);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3.5 cursor-pointer ${
                        fundMethod === "cash"
                          ? "bg-amber-500/15 border-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-500"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        fundMethod === "cash" ? "bg-amber-500 text-slate-950 font-black" : "bg-white/10 text-gray-400"
                      }`}>
                        <Banknote className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white leading-tight">Cash Handoff</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Record cash / Pochi transfer</p>
                      </div>
                    </button>
                  </div>
                </div>

                {fundMethod === "mpesa" ? (
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Transaction Code for Manual Confirm
                    </span>
                    <input
                      type="text"
                      value={fundTransactionCode}
                      onChange={(e) => setFundTransactionCode(e.target.value.toUpperCase())}
                      placeholder="e.g. QWE123ABC"
                      className="fc-prefund-input w-full rounded-xl border px-3 py-3"
                    />
                    <p className="text-[10px] text-gray-500 font-medium">
                      Send prompt first, then wait for the callback. Use manual confirm only if needed.
                    </p>
                  </label>
                ) : (
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Cash Handoff Date
                    </span>
                    <input
                      type="date"
                      value={fundCashDate}
                      onChange={(e) => setFundCashDate(e.target.value)}
                      className="fc-prefund-input w-full rounded-xl border px-3 py-3"
                    />
                  </label>
                )}

                  {fundMethod === "mpesa" && fundPromptSent && (
                    <div className="md:col-span-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 font-medium">
                      Prompt sent. Waiting for callback. Use Manual Confirm only if the callback does not arrive.
                    </div>
                  )}

                <label className="space-y-2 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Note
                  </span>
                  <input
                    type="text"
                    value={fundNote}
                    onChange={(e) => setFundNote(e.target.value)}
                    placeholder="Optional note"
                    className="fc-prefund-input w-full rounded-xl border px-3 py-3"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                <button
                  onClick={() => setShowWalletFundModal(false)}
                  className="fc-modal-secondary px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-widest"
                >
                  Cancel
                </button>
                {fundMethod === "mpesa" ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSendWalletPrompt}
                      disabled={isSendingWalletPrompt || fundPromptSent}
                      className="px-5 py-3 rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/12 text-[#FBBF24] text-xs font-black uppercase tracking-widest disabled:opacity-60"
                    >
                      {isSendingWalletPrompt
                        ? "Sending Prompt..."
                        : fundPromptSent
                          ? "Prompt Sent"
                          : "Send Prompt"}
                    </button>
                    <button
                      type="button"
                      onClick={handleWalletFundSubmit}
                      disabled={isFundingWallet}
                      className="px-5 py-3 rounded-xl border border-[#10B981]/30 bg-[#10B981] text-black text-xs font-black uppercase tracking-widest disabled:opacity-60"
                    >
                      {isFundingWallet ? "Confirming..." : "Manual Confirm"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleWalletFundSubmit}
                    disabled={isFundingWallet}
                    className="px-5 py-3 rounded-xl border border-[#10B981]/30 bg-[#10B981] text-black text-xs font-black uppercase tracking-widest disabled:opacity-60"
                  >
                    {isFundingWallet ? "Confirming..." : "Confirm Cash Handoff"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

          {/* Complete Add Member Modal */}
          {showAddMemberModal && (
            <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-8 bg-[#0a100a]/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
              <div className="bg-[#161d24] border border-[#10B981]/30 w-full max-w-md rounded-3xl p-8 shadow-2xl text-left">
                <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-6 border border-[#10B981]/20">
                  <UserPlus className="w-8 h-8 text-[#10B981]" />
                </div>

                <h3 className="text-2xl font-black text-white mb-2 tracking-tight">
                  Manual Enrollment
                </h3>
                <p className="text-gray-400 text-sm mb-6 font-medium">
                  Need to bypass the PIN? Fill out these details to directly add
                  a new manager to the live ledger. Math scaling will adjust
                  automatically.
                </p>

                <form onSubmit={handleAddMember} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] outline-none"
                      placeholder="e.g. David Kariuki"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                      M-Pesa Number
                    </label>
                    <input
                      type="text"
                      required
                      pattern="^0[0-9]{9}$"
                      value={newMemberPhone}
                      onChange={(e) =>
                        setNewMemberPhone(
                          e.target.value.replace(/[^0-9]/g, "").slice(0, 10),
                        )
                      }
                      className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] outline-none"
                      placeholder="e.g. 0712345678"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                        FPL Team Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={newMemberTeam}
                        onChange={(e) => setNewMemberTeam(e.target.value)}
                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:ring-1 focus:ring-[#10B981] outline-none"
                        placeholder="e.g. Saka Potatoes"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                        <span>FPL Team ID (Optional)</span>
                        <span className="text-[10px] text-emerald-400 font-normal">from fantasy.premierleague.com</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newMemberFplId}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setNewMemberFplId(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:ring-1 focus:ring-[#10B981] outline-none font-mono"
                        placeholder="e.g. 2205131"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 leading-tight">
                        💡 <em>In FPL app/browser, open team URL: <span className="font-mono text-amber-300">fantasy.premierleague.com/entry/<strong>XXXXXX</strong></span> — the number is their Team ID.</em>
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                      Participation Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setNewMemberPlayMode("pot")}
                        className={clsx(
                          "p-3 rounded-xl border text-left transition-all cursor-pointer",
                          newMemberPlayMode === "pot"
                            ? "bg-[#10B981]/15 border-[#10B981]/50 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                            : "bg-[#0b1014] border-white/10 text-gray-400 hover:border-white/20"
                        )}
                      >
                        <p className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5" /> Participate
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                          Full cash pot player. Competes for weekly & season podium prizes.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewMemberPlayMode("sidebets_only")}
                        className={clsx(
                          "p-3 rounded-xl border text-left transition-all cursor-pointer",
                          newMemberPlayMode === "sidebets_only"
                            ? "bg-indigo-500/15 border-indigo-500/50 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                            : "bg-[#0b1014] border-white/10 text-gray-400 hover:border-white/20"
                        )}
                      >
                        <p className="text-xs font-black text-indigo-400 flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" /> Spectate
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                          Free viewer on standings & 1v1 wagers only. Excluded from pot fees.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                      2nd FPL Entry ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={newMemberSecondTeam}
                      onChange={(e) =>
                        setNewMemberSecondTeam(
                          e.target.value.replace(/[^0-9]/g, ""),
                        )
                      }
                      className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] outline-none"
                      placeholder="Dual team members only"
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-white/10 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowAddMemberModal(false)}
                      className="flex-1 py-3.5 bg-[#0b1014] hover:bg-white/5 text-gray-400 font-bold uppercase tracking-widest text-xs rounded-xl transition-colors border border-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isAddingMember}
                      className="flex-1 py-3.5 bg-[#10B981] hover:bg-[#10B981]/90 text-black font-black uppercase tracking-widest text-xs rounded-xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {isAddingMember ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        "Enroll Member"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Edit Member Modal ─────────────────────────── */}
          {showEditMemberModal && (
            <div className="fixed inset-0 z-[99998] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
              <div className="w-full max-w-md bg-[#161d24] border border-white/10 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#FBBF24]">Chairman Edit</p>
                    <h3 className="text-base font-black text-white">Update Member Profile</h3>
                  </div>
                  <button
                    onClick={() => setShowEditMemberModal(false)}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs text-amber-300/80">
                    Changes are logged to the Operations Feed for full audit trail.
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">Display Name</label>
                    <input
                      type="text"
                      value={editMemberName}
                      onChange={e => setEditMemberName(e.target.value)}
                      className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-[#FBBF24]/50 outline-none"
                      placeholder="e.g. Kevin Otieno"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">M-Pesa Phone</label>
                    <input
                      type="tel"
                      value={editMemberPhone}
                      onChange={e => setEditMemberPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                      className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white font-mono focus:ring-1 focus:ring-[#FBBF24]/50 outline-none"
                      placeholder="0712345678"
                    />
                    <p className="text-[10px] text-gray-600 mt-1.5">This number controls login & M-Pesa payouts. Double-check before saving.</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">FPL Team ID</label>
                    <input
                      type="text"
                      value={editMemberFplId}
                      onChange={e => setEditMemberFplId(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white font-mono focus:ring-1 focus:ring-[#FBBF24]/50 outline-none"
                      placeholder="e.g. 1234567"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">Participation Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditMemberPlayMode('pot')}
                        className={clsx(
                          "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer",
                          editMemberPlayMode === 'pot'
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-sm"
                            : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20"
                        )}
                      >
                        🏆 Cash Pot
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditMemberPlayMode('sidebets_only')}
                        className={clsx(
                          "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer",
                          editMemberPlayMode === 'sidebets_only'
                            ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300 shadow-sm"
                            : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20"
                        )}
                      >
                        👁️ Spectator (1v1)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-5 flex gap-3">
                  <button
                    onClick={() => setShowEditMemberModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveMemberEdit}
                    disabled={isSavingMemberEdit}
                    className="flex-1 py-2.5 rounded-xl bg-[#FBBF24] hover:bg-[#eab308] text-black text-sm font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingMemberEdit
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : '✓ Save Changes'
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Clean Slate / Season Reset Modal ─────────────────────────── */}
          {showCleanSlateModal && (
            <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
              <div className="w-full max-w-md bg-[#161d24] border border-red-500/30 rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-in zoom-in-95 duration-200 overflow-hidden text-white">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-red-400">Danger Zone</p>
                      <h3 className="text-base font-black">Clean Slate / Season Reset</h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCleanSlateModal(false)}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 leading-relaxed">
                    <span className="font-bold">⚠️ Warning:</span> This will reset all member wallet balances to <span className="font-bold">KES 0</span>, reset all payment statuses to unpaid, and clear all transactions, wagers, and payouts on the ledger. Member squads, phone numbers, and WhatsApp links are safely preserved.
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">
                      New Official Starting Round
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-400">Gameweek</span>
                      <input
                        type="number"
                        min="1"
                        max="38"
                        value={cleanSlateTargetGw}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setCleanSlateTargetGw(Math.max(1, Math.min(38, Number(e.target.value || 1))))}
                        className="w-24 bg-[#0b1014] border border-white/10 rounded-xl py-2 px-3 text-center text-sm font-bold text-white focus:ring-1 focus:ring-red-500/50 outline-none"
                      />
                      <span className="text-xs text-gray-500 font-medium">e.g. 10 (players start clean from GW10)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">
                      Type <span className="text-red-400 font-mono font-black">RESET</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={cleanSlateConfirmText}
                      onChange={(e) => setCleanSlateConfirmText(e.target.value)}
                      placeholder="RESET"
                      className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white font-mono uppercase tracking-widest focus:ring-1 focus:ring-red-500/50 outline-none"
                    />
                  </div>
                </div>

                <div className="px-6 pb-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCleanSlateModal(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isExecutingCleanSlate || cleanSlateConfirmText.trim().toUpperCase() !== 'RESET'}
                    onClick={handleExecuteCleanSlate}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-30 shadow-lg shadow-red-900/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isExecutingCleanSlate ? 'Resetting...' : 'Execute Clean Slate'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {manualResolvePromise && (
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-[#0b1014] border border-white/10 rounded-[2rem] shadow-2xl p-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-xl font-black text-white mb-2 tracking-tight">Manual GW Resolution</h3>
                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                  FPL GW{manualResolvePromise.currentGw || '?'} is still ongoing or API is down. Enter the details manually to force payout.
                </p>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">Gameweek Number</label>
                    <input
                      type="number"
                      value={manualGwInput}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setManualGwInput(e.target.value)}
                      placeholder="e.g. 37"
                      className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-white font-mono focus:ring-1 focus:ring-amber-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">Winner's Exact Name</label>
                    <input
                      type="text"
                      value={manualWinnerInput}
                      onChange={(e) => setManualWinnerInput(e.target.value)}
                      placeholder="e.g. Kevin Sifuna"
                      className="w-full bg-[#161d24] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-amber-500/50 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      manualResolvePromise.resolve(null);
                      setManualResolvePromise(null);
                    }}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const gw = parseInt(manualGwInput, 10);
                      if (isNaN(gw) || !manualWinnerInput.trim()) {
                        showToast("Please enter a valid GW number and winner name.");
                        return;
                      }
                      manualResolvePromise.resolve({ gw, winner: manualWinnerInput.trim() });
                      setManualResolvePromise(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black transition-all"
                  >
                    Force Resolve
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Ops Feed Full Modal */}
          {showOpsModal && (
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setShowOpsModal(false)}>
              <div className="w-full max-w-lg bg-[#0b1014] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                    <Bell className="w-4 h-4 text-emerald-400" /> All Operations ({liveOpsEvents.length})
                  </h3>
                  <button onClick={() => setShowOpsModal(false)} className="w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-lg font-bold">×</button>
                </div>
                <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
                  {liveOpsEvents.map((evt: any) => {
                    const ts = evt.timestamp?.toDate ? evt.timestamp.toDate() : null;
                    const isSuccess = evt.type === 'success' || String(evt.message || '').startsWith('✅');
                    const isWarning = evt.type === 'warning' || String(evt.message || '').startsWith('⚠️');
                    return (
                      <div key={evt.id} className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className={clsx(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs",
                          isSuccess ? "bg-emerald-500/10 border border-emerald-500/20" : isWarning ? "bg-amber-500/10 border border-amber-500/20" : "bg-blue-500/10 border border-blue-500/20"
                        )}>
                          {isSuccess ? '✅' : isWarning ? '⚠️' : 'ℹ️'}
                        </div>
                        <div className="flex-1 min-w-0">
                          {evt.title && <p className="text-xs font-bold text-white truncate">{evt.title}</p>}
                          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{evt.message}</p>
                          {ts && <span className="text-[9px] font-bold text-gray-600 tracking-widest uppercase mt-1 block">{ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {ts.toLocaleDateString()}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Custom Delete Member Confirmation Modal */}
          <ConfirmModal
            isOpen={!!memberToDelete}
            onClose={() => !isDeletingMember && setMemberToDelete(null)}
            onConfirm={confirmDeleteMember}
            title="Remove Member"
            message={`Are you sure you want to remove ${memberToDelete?.name || 'this member'} from this league? This will permanently delete this membership record.`}
            confirmText="Remove Member"
            variant="danger"
            isLoading={isDeletingMember}
          />
        </div>
  );
}

