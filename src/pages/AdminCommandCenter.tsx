import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import {
  Megaphone,
  Share2,
  RefreshCw,
  Banknote,
  ChevronDown,
  CheckCircle2,
  Trophy,
  AlertTriangle,
  UserPlus,
  Bell,
  ShieldCheck,
  Download,
  ShieldAlert,
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
} from "firebase/firestore";
import { useStore } from "../store/useStore";
import { getApiBaseUrl } from "../utils/api";
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
  const [inviteCode, setInviteCode] = useState("");
  const [gameweekStake, setMonthlyContribution] = useState(0);
  const [rules, setRules] = useState({ weekly: 70, vault: 30 });
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);
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
  const [chairmanId, setChairmanId] = useState<string | null>(null);
  const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
  const [isApprovingPayout, setIsApprovingPayout] = useState<string | null>(
    null,
  );
  const [whatsappReceipt, setWhatsappReceipt] = useState<string | null>(null);
  // const [recentGovernanceEvents, setRecentGovernanceEvents] = useState<any[]>([]);

  // Module 3B: Dispute/Claim alerts
  const [pendingDisputes, setPendingDisputes] = useState<any[]>([]);
  const [processingDispute, setProcessingDispute] = useState<string | null>(
    null,
  );
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
  const [isCurrentEventFinished, setIsCurrentEventFinished] = useState(false);
  const [currentGwNumber, setCurrentGwNumber] = useState<number | null>(null);
  const [firestoreGw, setFirestoreGw] = useState<number | null>(null);

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
  const [newMemberSecondTeam, setNewMemberSecondTeam] = useState("");
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
  const isPilotMode = leagueSettings?.pilotMode === true; // Pilot: no HQ cut yet
  const pendingHQDebt = isPilotMode ? 0 : (leagueSettings?.pendingHQDebt || 0);

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
  const tutorialSeenKey =
    activeLeagueId && activeUserId
      ? `chairman_initialized_${activeLeagueId}_${activeUserId}`
      : null;
  const adminTourSeenKey =
    activeLeagueId && activeUserId
      ? `hasSeenAdminTour_${activeLeagueId}_${activeUserId}`
      : null;
  const coChairMember = members.find((m) => m.id === coAdminId);
  const authUid = auth.currentUser?.uid || null;
  const coAdminMemberAuthUid = coAdminId
    ? members.find((m) => m.id === coAdminId)?.authUid || null
    : null;
  const coAdminResolvedUid = coAdminMemberAuthUid || coAdminId || null;
  const diagnosticsIsChairman = !!authUid && !!chairmanId && authUid === chairmanId;
  const diagnosticsIsCoAdmin = !!authUid && !!coAdminResolvedUid && authUid === coAdminResolvedUid;
  const diagnosticsIsAdmin = diagnosticsIsChairman || diagnosticsIsCoAdmin;
  const diagnosticsStatusTone = diagnosticsIsAdmin
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-red-500/30 bg-red-500/10 text-red-300";
  const diagnosticsStatusLabel = diagnosticsIsAdmin ? "Admin Access: Granted" : "Admin Access: Denied";
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
    if (tutorialSeenKey) localStorage.setItem(tutorialSeenKey, "true");
    setShowTutorial(false);
  };

  const handleToggleAdmin = async (
    memberId: string,
    currentRole: string | undefined,
  ) => {
    if (!activeLeagueId) return;
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

    if (tutorialSeenKey && !localStorage.getItem(tutorialSeenKey)) {
      setShowTutorial(true);
    }

    const initDashboard = async () => {
      try {
        // Fetch the main League document
        const leagueRef = doc(db, "leagues", activeLeagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (leagueSnap.exists()) {
          const data = leagueSnap.data();
          setLeagueName(data.leagueName || "Unnamed League");
          setInviteCode(data.inviteCode || "------");
          setMonthlyContribution(data.gameweekStake || 0);
          setCoAdminId(data.coAdminId || null);
          setChairmanId(data.chairmanId || null);
          setFirestoreGw(data.currentGwNumber || data.currentGw || null);
          if (data.rules) setRules(data.rules);

          try {
            const bootstrapUrl =
              "https://fantasy.premierleague.com/api/bootstrap-static/";
            const bootstrapRes = await fetch(
              `https://corsproxy.io/?${encodeURIComponent(bootstrapUrl)}`,
            );
            if (bootstrapRes.ok) {
              const bootstrapData = await bootstrapRes.json();
              const events = bootstrapData?.events || [];
              const current = events.find((e: any) => e.is_current) || events.find((e: any) => e.is_next);
              setIsCurrentEventFinished(current?.finished === true);
              setCurrentGwNumber(Number(current?.id || 0) || null);
            }
          } catch (bootstrapErr: any) {
            console.warn(
              "[command-center] bootstrap fetch skipped:",
              bootstrapErr?.message || bootstrapErr,
            );
          }

          // Fetch Live GW Winner always for Admin Center
          if (data.fplLeagueId) {
              fetch(
                `https://corsproxy.io/?${encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${data.fplLeagueId}/standings/`)}`,
              )
                .then((res) => res.json())
                .then((fplData) => {
                  const results = fplData?.standings?.results;
                  if (results && results.length > 0) {
                    const winner = results.reduce((prev: any, current: any) =>
                      prev.event_total > current.event_total ? prev : current,
                    );
                    setGwWinner(winner);
                  }
                })
                .catch((err) =>
                  console.error("Could not fetch FPL winner:", err),
                );
            }
          }

        // Initialize Live Ledger
        listenToLeagueMembers(activeLeagueId);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching league:", err);
        navigate("/setup");
      }
    };

    initDashboard();
  }, [activeLeagueId, navigate, listenToLeagueMembers, tutorialSeenKey]);

  // Listen for all payouts (pending + approved) for real-time UI state
  useEffect(() => {
    if (!activeLeagueId) return;
    const pendingRef = collection(
      db,
      "leagues",
      activeLeagueId,
      "pending_payouts",
    );
    // Listen to both awaiting and approved so we can show the right UI state
    const q = query(
      pendingRef,
      where("status", "in", ["awaiting_approval", "approved"]),
    );
    const unsub = onSnapshot(q, (snap) => {
      setPendingPayouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeLeagueId]);

  const hasFinalGwChampion = Boolean(
    gwWinner && isCurrentEventFinished && Number(gwWinner.event_total) > 0,
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
      title: "The Master Ledger",
      description:
        "See who is paid, who is in the red zone, and fund wallets directly from this queue.",
    },
    finance: {
      eyebrow: "Chairman treasury",
      title: "Treasury Operations Board",
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
        message: `✅ Your payment dispute for KES ${dispute.amount?.toLocaleString()} has been approved by the Chairman. You are now in the Green Zone.`,
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

  // Admin Tour
  useEffect(() => {
    if (!adminTourSeenKey || showTutorial || isLoading) return;
    const hasSeenTour = localStorage.getItem(adminTourSeenKey);
    if (!hasSeenTour) {
      try {
        const driverObj = driver({
          showProgress: true,
          smoothScroll: true,
          onNextClick: (_element: any, _step: any, options: any) => {
            const activeIndex = options?.state?.activeIndex ?? 0;
            if (activeIndex === 0) {
              setActiveTab("ledger");
              window.setTimeout(() => options.driver.moveNext(), 250);
              return;
            }
            if (activeIndex === 1) {
              setActiveTab("finance");
              window.setTimeout(() => options.driver.moveNext(), 250);
              return;
            }
            options.driver.moveNext();
          },
          onPrevClick: (_element: any, _step: any, options: any) => {
            const activeIndex = options?.state?.activeIndex ?? 0;
            if (activeIndex === 1) {
              setActiveTab("dashboard");
              window.setTimeout(() => options.driver.movePrevious(), 250);
              return;
            }
            if (activeIndex === 2) {
              setActiveTab("ledger");
              window.setTimeout(() => options.driver.movePrevious(), 250);
              return;
            }
            options.driver.movePrevious();
          },
          steps: [
            {
              element: "#tour-add-member",
              popover: {
                title: "Overview",
                description:
                  "Start in Overview, then use Next to move through Ledger & Access and Finance & Ops.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#master-ledger",
              popover: {
                title: "Ledger & Access",
                description:
                  "Review the master ledger, then continue to Finance & Ops for vault, payouts, and support workflows.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#tour-finance-ops",
              popover: {
                title: "Finance & Ops",
                description:
                  "Use this section for vault tracking, finance approvals, and prefund operations.",
                side: "top",
                align: "start",
              },
            },
          ],
        });
        driverObj.drive();
        localStorage.setItem(adminTourSeenKey, "true");
      } catch (e) {
        console.error("Tour failed to load", e);
      }
    }
  }, [adminTourSeenKey, isLoading, showTutorial]);

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
          message: `Deposit verified for ${memberName}. Account is now in the Green Zone.`,
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
          phoneNumber: targetMember?.phone || "",
          amount: gameweekStake,
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
          message: `Ledger correction recorded for ${memberName}. The mistaken deposit was cancelled and retained in the master ledger for audit.`,
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

  // Dynamic Calculations
  // Math scales properly natively since `members` array is reactive via useStore (which listens to Firestore)
  const filteredMembers = members.filter((m) => {
    if (m.isActive === false) return false;
    if (paymentFilter === "Verified") return m.hasPaid;
    if (paymentFilter === "Red Zone") return !m.hasPaid;
    return true;
  });

  const memberHasFunding = (member: any) => {
    return member.isActive !== false && member.hasPaid === true;
  };

  const fundedMembersCount = members.filter(memberHasFunding).length;
  const activeMembersCount = members.filter(
    (m) => m.isActive !== false,
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
  const redZoneMembers = members.filter(
    (m) => !memberHasFunding(m) && m.role !== "admin" && m.isActive !== false,
  );
  const allPayableMembersFunded =
    activeMembersCount > 0 && fundedMembersCount === activeMembersCount;
  const totalCollected = totalSecured;
  const weeklyPot = totalCollected * (rules.weekly / 100);
  const projectionGwNumber = Math.min(38, Math.max(1, Number(currentGwNumber || 1)));
  const remainingGameweeks = Math.max(1, 39 - projectionGwNumber);
  const seasonVault = totalCollected * remainingGameweeks * (rules.vault / 100);
  const isCoChairSession = !!coAdminId && coAdminId === activeUserId;
  const highRiskTwoWeekMisses = members.filter(
    (member: any) =>
      member.isActive !== false &&
      member.role !== "admin" &&
      Number(member.missedGameweeks || 0) >= 2,
  ).length;
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
      label: "HQ Settled",
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
    const message = `🎯 Join my Fantasy Chama League: *${leagueName}*\n\n🔑 Access Code: *${inviteCode}*\n💰 Weekly Stake: KES ${gameweekStake || 0}\n\nJoin here: https://fantasy-chama.vercel.app`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    showToast("Invite code copied. WhatsApp share opened.");
  };

  const shareWalletFundingReceipt = (payload: {
    memberName: string;
    amount: number;
    method: "mpesa" | "cash";
    receiptId: string;
    cashDate?: string;
  }) => {
    const appUrl = import.meta.env.VITE_APP_URL || "https://fantasy-chama.vercel.app";
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
    setShowAddMemberModal(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openPrefundModal = () => {
    setShowAddMemberModal(false);
    setShowWalletFundModal(false);
    setShowResolveModal(false);
    setPrefundData({});
    setShowPrefundOptions(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      setShowResolveModal(true);
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
        avatarSeed: Math.random().toString(36).substring(7),
        joinedAt: serverTimestamp(),
      };
      if (newMemberSecondTeam)
        dataToSave.secondFplTeamId = Number(newMemberSecondTeam);

      await addDoc(membershipsRef, dataToSave);
      setShowAddMemberModal(false);
      setNewMemberName("");
      setNewMemberPhone("");
      setNewMemberTeam("");
      setNewMemberSecondTeam("");

      // Send Notification
      const notifsRef = collection(
        db,
        "leagues",
        activeLeagueId,
        "notifications",
      );
      await addDoc(notifsRef, {
        type: "info",
        message: `${newMemberName} has joined the league! Welcome to the War Room.`,
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

  const handleBulkNudge = async () => {
    if (!activeLeagueId) return;

    const redZoneMembers = members.filter(
      (m) => !memberHasFunding(m) && m.role !== "admin" && m.isActive !== false,
    );

    if (redZoneMembers.length === 0) {
      showToast("No members in the Red Zone.");
      return;
    }

    setNudgeSent(true);

    for (const member of redZoneMembers) {
      try {
        const notifsRef = collection(
          db,
          "leagues",
          activeLeagueId,
          "notifications",
        );
        await addDoc(notifsRef, {
          type: "warning",
          message: `URGENT Chairman Nudge: Gameweek Deadline approaching. Please complete your active Gameweek contribution to avoid being locked out.`,
          timestamp: serverTimestamp(),
          readBy: [],
          targetMemberId: member.id,
        });
      } catch (err) {
        console.error("Failed to nudge member", member.id, err);
      }
    }

    const redZoneNames = redZoneMembers.map((m) => `• ${m.displayName}`).join("\n");
    const message = `🚨 *${leagueName} Red Zone Alert*\n\nThe following members have not yet deposited for the upcoming Gameweek:\n\n${redZoneNames}\n\nPlease complete your contributions to avoid lockout. 💰⚽`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    showToast("Bulk Nudge saved to system. Opening WhatsApp for group share.");

    setTimeout(() => setNudgeSent(false), 2000);
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
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
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

      const res = await fetch(`${payoutApiUrl}/api/mpesa/stkpush`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: member.phone,
          amount,
          userId: fundTargetMemberId,
          leagueId: activeLeagueId,
        }),
      });

      const data = await res.json();
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
        const bootstrapUrl =
          "https://fantasy.premierleague.com/api/bootstrap-static/";
        const bootstrapRes = await fetch(
          `https://corsproxy.io/?${encodeURIComponent(bootstrapUrl)}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (bootstrapRes.ok) {
          const bootstrapData = await bootstrapRes.json();
          const events = bootstrapData?.events || [];
          const currentEvent = events.find((e: any) => e.is_current) || events.find((e: any) => e.is_next);
          if (currentEvent) {
            gwNumber = Number(currentEvent.id || 0);
            isGwFinished = currentEvent.finished === true;
            setCurrentGwNumber(gwNumber || null);
          }
        }
      } catch (proxyErr) {
        console.warn("[resolve] bootstrap proxy failed, using cached state:", proxyErr);
        // Use cached page-load state — still workable for the pilot
      }

      if (!gwNumber) {
        throw new Error(
          "Current gameweek is unavailable. Check FPL is live and try again.",
        );
      }
      if (!isGwFinished) {
        showToast(
          `GW${gwNumber} is still live. Resolution is only available after final FPL lock.`,
        );
        setShowResolveModal(false);
        return;
      }

      // 1. Fetch live FPL Standings via generic proxy
      const leagueRef = doc(db, "leagues", activeLeagueId);
      const leagueSnap = await getDoc(leagueRef);
      const fplLeagueId = leagueSnap.data()?.fplLeagueId || 314;

      const res = await fetch(
        `https://corsproxy.io/?${encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${fplLeagueId}/standings/`)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch standings");
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
      
      // Map for template logic compatibility below
      const winner = winners[0];

      if (winners.length === 0) {
        showToast(`No eligible paid winner found for GW${gwNumber}.`);
        setIsResolving(false);
        setShowResolveModal(false);
        return;
      }

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
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.55 },
          colors: ["#10B981", "#FBBF24", "#FFFFFF"],
        });
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
        const res = await fetch(`${payoutApiUrl}/api/mpesa/b2c`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: payoutPhone,
            amount: payout.amount,
            winnerName: payout.winnerName,
            remarks: `FantasyChama GW${payout.gw} Approved Payout`,
            userId: payout.winnerId || winnerMember?.id || activeUserId,
            leagueId: activeLeagueId,
            gw: Number(payout.gw || 0),
            points: payoutPoints,
          }),
        });
        data = await res.json();
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
      if (!isPilotMode) {
        // Production: update HQ debt
        await updateDoc(doc(db, "leagues", activeLeagueId), {
          lastResolvedDate: serverTimestamp(),
          lastResolvedGw: Number(payout.gw || 0),
        });
      } else {
        // Pilot mode: just track the date, no HQ debt
        await updateDoc(doc(db, "leagues", activeLeagueId), {
          lastResolvedDate: serverTimestamp(),
          lastResolvedGw: Number(payout.gw || 0),
        });
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
        m.hasPaid ? "Green Zone ✓" : "Red Zone ✗",
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
      import.meta.env.VITE_APP_URL || "https://fantasy-chama.vercel.app";

    const message = [
      `🏆 *${leagueName} — ${payout.gwName || `GW${payout.gw}`} Results*`,
      ``,
      `🥇 *Winner:* ${payout.winnerName} (${payout.points} pts)`,
      `💰 *Payout (91%):* KES ${Number(payout.amount).toLocaleString()} _(Dispatched via M-Pesa ✅)_`,
      `🏦 *Operational Cut (9%):* HQ System & Chairman`,
      `🚨 *Red Zone:* ${unpaidCount} member${unpaidCount !== 1 ? "s" : ""} yet to deposit for next GW.`,
      ``,
      `📊 Check live standings & vault:`,
      `🔗 ${appUrl}`,
      ``,
      `_Powered by FantasyChama — Your Chama runs itself._ ⚡`,
    ].join("\n");

    const encoded = encodeURIComponent(message);
    window.open(`whatsapp://send?text=${encoded}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full text-[#10B981] flex flex-col items-center justify-center font-bold tracking-widest uppercase bg-[#0a0e17]">
        <RefreshCw className="w-8 h-8 animate-spin mb-4" />
        Syncing Ledger...
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "min-h-[100dvh] w-full text-white font-sans relative bg-[#0a0e17]",
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
                <span className="font-bold text-emerald-400">FPL Chama HQ</span>{" "}
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
        <div className="fixed inset-0 z-[90000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0b1014] border border-[#10B981]/30 rounded-[2rem] p-8 shadow-[0_0_80px_rgba(16,185,129,0.15)] relative animate-in fade-in zoom-in-95 duration-500">
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
          "fc-standings-page transition-all duration-700 min-h-screen w-full font-sans text-white relative overflow-hidden",
          isSuspended
            ? "blur-xl opacity-20 pointer-events-none select-none scale-[0.98]"
            : "",
          isWithinGracePeriod ? "pt-12" : "",
        )}
      >
        <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none z-0" />
        <div className="fixed bottom-0 left-0 w-full h-[600px] pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 0% 100%, rgba(16,185,129,0.05) 0%, rgba(10,14,23,0) 60%)' }} />
        {/* Unified Global Toast Notification */}
        <div
          className={clsx(
            "fixed top-4 right-4 px-5 py-3 rounded-2xl text-[13px] font-bold flex items-center gap-3 transition-all duration-500 pointer-events-none z-[9999] shadow-[0_20px_50px_rgba(0,0,0,0.5)] fc-inline-toast fc-inline-toast-success",
            toastMessage
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-2 scale-95",
          )}
        >
          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
          {toastMessage}
        </div>

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8 pb-28">
          {/* Top Header */}
          <Header
            role="admin"
            title={leagueName || "Command Center"}
            subtitle="Chairman Hub"
          />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pt-2 pb-4">
            <div>
              <h2 className="fc-dashboard-header-title text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 mb-1">
                <ShieldCheck className="w-7 h-7 text-[#FBBF24]" /> {tabCopy.dashboard.title}
              </h2>
              <p className="fc-dashboard-header-copy text-sm font-medium max-w-xl leading-relaxed">
                {tabCopy.dashboard.description}
              </p>
            </div>
            
            {!isCoChairSession && (
              <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-start lg:justify-end items-end">
                <button
                  id="tour-add-member"
                  onClick={openAddMemberModal}
                  className="fc-add-member-btn flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-slate-900 dark:text-white text-sm font-bold rounded-xl transition-colors shrink-0 shadow-sm"
                >
                  <UserPlus className="w-4 h-4 text-[#10B981]" /> Add Member
                </button>
                <button
                  onClick={handleBulkNudge}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(239,68,68,0.28)] shrink-0"
                >
                  <Megaphone className="w-4 h-4" /> Bulk Nudge
                </button>
              </div>
            )}

          </div>

          {/* Main Tab Navigation */}
          <div
            className="flex overflow-x-auto gap-2 pb-2 mb-6 border-b border-white/5"
            style={{ scrollbarWidth: "none" }}
          >
            {["dashboard", "ledger", "finance"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={clsx(
                  "px-4 py-2 font-black uppercase tracking-widest text-[10px] sm:text-xs transition-colors whitespace-nowrap",
                  activeTab === tab
                    ? "bg-[#10B981]/10 text-[#10B981] border-b-2 border-[#10B981]"
                    : "text-gray-500 hover:text-gray-300 border-b-2 border-transparent",
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

          <div
            className={
              activeTab === "dashboard"
                ? "block space-y-6 animate-in fade-in duration-500"
                : "hidden"
            }
          >
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
                      "fc-card rounded-2xl border border-[#FBBF24]/24 bg-gradient-to-br from-[#FBBF24]/12 via-[#161d24] to-[#161d24] p-4 hover:border-[#FBBF24]/35 transition-colors shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between",
                      pendingPayouts.length > 0 ? "fc-metric-alert" : "fc-metric-stable",
                    )}
                  >
                    <p className="fc-metric-label text-xs tracking-wide font-semibold">
                      approve payouts
                    </p>
                    <p className="fc-metric-value text-2xl md:text-3xl font-semibold mt-2 tabular-nums">
                      {pendingPayouts.length}
                    </p>
                  </div>
                  <div
                    className={clsx(
                      "fc-card rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d24] via-[#161d24] to-[#0f1419] p-4 hover:border-white/20 transition-colors shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between",
                      redZoneMembers.length > 0 ? "fc-metric-alert" : "fc-metric-stable",
                    )}
                    onClick={() => { setActiveTab("ledger"); setPaymentFilter("Red Zone"); setTimeout(() => window.document.getElementById("master-ledger")?.scrollIntoView({ behavior: "smooth" }), 100); }}
                  >
                    <p className="fc-metric-label text-xs tracking-wide font-semibold">
                      red zone follow-ups
                    </p>
                    <p className="fc-metric-value text-2xl md:text-3xl font-semibold mt-2 tabular-nums">
                      {redZoneMembers.length}
                    </p>
                  </div>
                  <div
                    className={clsx(
                      "fc-card rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d24] via-[#161d24] to-[#0f1419] p-4 hover:border-white/20 transition-colors shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between",
                      pendingDisputes.length > 0 ? "fc-metric-alert" : "fc-metric-stable",
                    )}
                    onClick={() => { setActiveTab("finance"); setTimeout(() => window.document.getElementById("dispute-claims")?.scrollIntoView({ behavior: "smooth" }), 100); }}
                  >
                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">
                      unresolved disputes
                    </p>
                    <p className="fc-metric-value text-2xl md:text-3xl font-semibold mt-2 tabular-nums">
                      {pendingDisputes.length}
                    </p>
                  </div>
                  <div
                    className={clsx(
                      "fc-card rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d24] via-[#161d24] to-[#0f1419] p-4 hover:border-white/20 transition-colors shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between",
                      highRiskTwoWeekMisses > 0 ? "fc-metric-alert" : "fc-metric-stable",
                    )}
                    onClick={() => { setActiveTab("ledger"); setPaymentFilter("Red Zone"); setTimeout(() => window.document.getElementById("master-ledger")?.scrollIntoView({ behavior: "smooth" }), 100); }}
                  >
                    <p className="fc-metric-label text-xs tracking-wide font-semibold text-white">
                      2-week risk members
                    </p>
                    <p className="fc-metric-value text-2xl md:text-3xl font-semibold mt-2 tabular-nums">
                      {highRiskTwoWeekMisses}
                    </p>
                  </div>
                  <div
                    className={clsx(
                      "fc-card rounded-2xl border p-4 transition-colors shadow-[0_10px_24px_rgba(0,0,0,0.18)] min-h-[132px] flex flex-col justify-between",
                      allPayableMembersFunded
                        ? "border-emerald-500/35 bg-gradient-to-br from-emerald-500/14 via-[#161d24] to-[#0f1419] fc-metric-stable"
                        : "border-red-500/35 bg-gradient-to-br from-red-500/14 via-[#161d24] to-[#0f1419] fc-metric-alert",
                    )}
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
                      {fundedMembersCount}/{Math.max(1, members.length)}
                    </p>
                    <p
                      className={clsx(
                        "text-[11px] font-medium mt-1",
                        allPayableMembersFunded
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-red-700 dark:text-red-300",
                      )}
                    >
                      {!allPayableMembersFunded ? "funding incomplete" : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => setShowResolveModal(true)}
                    disabled={!hasFinalGwChampion}
                    className="min-w-[200px] px-4 py-2.5 rounded-xl border border-[#FBBF24]/40 bg-[#FBBF24]/85 text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#F59E0B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center"
                  >
                    {hasFinalGwChampion ? "Resolve / Close GW" : `GW ${currentGwNumber || firestoreGw || '--'} ongoing...`}
                  </button>
                  
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

          {activeTab === "dashboard" && diagnosticsIsAdmin && (
            <section className="mt-8 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#22c55e]">
                      System Diagnostics
                  </h3>
                  <span className={clsx("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border", diagnosticsStatusTone)}>
                      {diagnosticsStatusLabel}
                  </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Auth Node</p>
                      <p className="text-xs font-mono text-gray-300 bg-black/30 px-2 py-1 rounded border border-white/5 w-fit">{authUid ? `•••${authUid.slice(-6)}` : "None"}</p>
                  </div>
                  <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Chairman Key</p>
                      <p className="text-xs font-mono text-gray-300 bg-black/30 px-2 py-1 rounded border border-white/5 w-fit">{chairmanId ? `•••${chairmanId.slice(-6)}` : "None"}</p>
                  </div>
                  <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Co-Admin Key</p>
                      <p className="text-xs font-mono text-gray-300 bg-black/30 px-2 py-1 rounded border border-white/5 w-fit">{coAdminId ? `•••${coAdminId.slice(-6)}` : "None"}</p>
                  </div>
                  <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Perms Flag</p>
                      <div className="flex gap-2 text-[10px] items-center h-full">
                          <span className={diagnosticsIsChairman ? "text-[#22c55e]" : "text-gray-600"}>Chair</span>
                          <span className="text-gray-700">•</span>
                          <span className={diagnosticsIsCoAdmin ? "text-[#22c55e]" : "text-gray-600"}>Co-Admin</span>
                      </div>
                  </div>
              </div>
            </section>
          )}

          {/* Champion Card: show during GW, hide once approved payout exists for this GW */}
          {(() => {
            const approvedForThisGw = pendingPayouts.some(
              (p) => Number(p.gw) === currentGwNumber && p.status === 'approved'
            );
            const awaitingForThisGw = pendingPayouts.some(
              (p) => Number(p.gw) === currentGwNumber && p.status === 'awaiting_approval'
            );
            // Show card if: winner exists + not in finance tab + no approved payout for this GW
            // After approval, hide it (payout done = no card)
            const shouldShowCard = gwWinner && activeTab !== 'finance' && !approvedForThisGw && !awaitingForThisGw;
            return shouldShowCard;
          })() && (
            <div className={clsx("fc-highlight-card bg-gradient-to-r from-[#FBBF24]/10 via-[#F59E0B]/5 to-transparent border border-[#FBBF24]/30 rounded-[2rem] p-5 md:p-6 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-5 transition-all mt-2", resolutionPulse && "fc-burst-success") }>
              <div className="absolute top-0 right-0 w-56 h-56 bg-[#FBBF24] blur-[90px] opacity-10 pointer-events-none" />
              <div className="relative z-10 flex items-center gap-4 w-full md:w-auto">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FBBF24] to-[#B45309] p-[2px] shadow-lg flex-shrink-0 animate-pulse">
                  <div className="w-full h-full bg-[#0b1014] rounded-full flex items-center justify-center border-2 border-[#0b1014]">
                    <Trophy className="w-6 h-6 text-[#FBBF24]" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#FBBF24] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 fill-current" />
                    {hasFinalGwChampion ? "Gameweek Champion" : "Live Leader"}
                  </p>
                  <h3 className="text-xl md:text-2xl font-black text-white leading-tight tracking-tight">
                    {gwWinner.player_name}
                  </h3>
                  <p className="text-sm font-bold text-gray-400 mt-0.5">
                    {gwWinner.entry_name}{" "}
                    <span className="inline-block text-[#10B981] ml-2 px-1.5 py-0.5 bg-[#10B981]/10 rounded border border-[#10B981]/20 tabular-nums">
                      {gwWinner.event_total} pts
                    </span>
                  </p>
                </div>
              </div>
              <div className="relative z-10 flex flex-col items-center justify-center w-full md:w-auto fc-highlight-surface p-5 rounded-2xl border backdrop-blur-sm gap-3">
                <div className="flex flex-col items-center justify-center w-full gap-1.5 text-center">
                  <p className="text-[10px] font-black fc-meta-label uppercase tracking-widest">
                    Projected Payout
                  </p>
                  <p className="text-2xl md:text-3xl font-black text-[#FBBF24] tabular-nums tracking-tight">
                    KES {(
                      members.filter((m) => m.hasPaid && m.isActive !== false).length * gameweekStake * (rules.weekly / 100)
                    ).toLocaleString()}
                  </p>
                </div>
                {hasFinalGwChampion && !pendingPayouts.some((p) => Number(p.gw) === currentGwNumber) && (
                  <button
                    id="tour-resolve-gw"
                    onClick={() => setShowResolveModal(true)}
                    className="fc-highlight-action w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FBBF24] hover:bg-white text-black text-[11px] font-black tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(251,191,36,0.3)] uppercase active:scale-95"
                  >
                    <Trophy className="w-4 h-4" /> Resolve & Payout
                  </button>
                )}
                {pendingPayouts.some((p) => Number(p.gw) === currentGwNumber && p.status === 'awaiting_approval') && (
                  <div className="w-full rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/8 px-4 py-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#FBBF24]">Payout Queued</p>
                    <p className="text-xs text-gray-300 mt-1">Awaiting Co-Chair approval below ↓</p>
                  </div>
                )}
                {pendingPayouts.some((p) => Number(p.gw) === currentGwNumber && p.status === 'approved') && (
                  <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">✓ Payout Dispatched</p>
                    <p className="text-xs text-gray-400 mt-1">GW{currentGwNumber} resolved & paid out</p>
                  </div>
                )}
                {!hasFinalGwChampion && (
                  <div className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Resolve is locked
                    </p>
                    <p className="text-sm font-bold text-white mt-1">
                      GW {currentGwNumber ?? "??"} ongoing...
                    </p>
                  </div>
                )}
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
                    const canCurrentUserApprove = requiresCoChairSignature
                      ? isCoChairSession
                      : !isCoChairSession;
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
                        </div>
                        <div className="flex gap-2 flex-wrap shrink-0">
                          <span className="px-5 py-2.5 bg-black/40 text-[#FBBF24] border border-[#FBBF24]/20 text-[11px] font-black tracking-widest uppercase rounded-xl flex items-center gap-2 shadow-inner">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                            {requiresCoChairSignature
                              ? "Awaiting Co-Chair Signature"
                              : hasValidCoChair
                                ? "Awaiting Chairman Signature"
                                : "Awaiting Chairman Signature (Fallback)"}
                          </span>
                          <button
                            onClick={() => generateWhatsAppReceipt(payout)}
                            className="px-5 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 text-[11px] font-black tracking-widest uppercase rounded-xl transition-colors shadow-inner flex items-center gap-2"
                          >
                            <Share2 className="w-3.5 h-3.5" /> Share
                          </button>
                          <button
                            onClick={() => handleRejectPayout(payout.id)}
                            className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-black tracking-widest uppercase rounded-xl transition-colors shadow-inner flex items-center gap-2"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Reject
                          </button>
                          {canCurrentUserApprove && (
                            <>
                              <button
                                onClick={() => handleApprovePayout(payout)}
                                disabled={isApprovingPayout === payout.id}
                                className="px-5 py-2.5 bg-[#10B981] hover:bg-[#059669] text-black text-[11px] font-black tracking-widest uppercase rounded-xl transition-colors shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-50 flex items-center gap-2"
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
                                  className="px-5 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-black tracking-widest uppercase rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
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
            <section className="fc-vault-explainer space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FBBF24] mb-1">
                  {tabCopy.finance.eyebrow}
                </p>
                <h2 className="text-3xl font-extrabold tracking-tight mb-1 flex items-center gap-3 text-white">
                  <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-[#FBBF24]" />{" "}
                  {tabCopy.finance.title}
                </h2>
                <p className="text-gray-400 text-sm max-w-xl">
                  {tabCopy.finance.description}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!isCoChairSession && (
                  <button
                    onClick={openPrefundModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#FBBF24]/10 border border-[#FBBF24]/30 hover:bg-[#FBBF24]/20 text-[#FBBF24] text-sm font-bold rounded-xl transition-colors"
                  >
                    <Banknote className="w-4 h-4" /> Pilot Prefund
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
              <div className="xl:col-span-12 flex flex-col gap-6 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 w-full">
                  <PotVaultSwapper
                    weeklyPot={weeklyPot}
                    seasonVault={seasonVault}
                    weeklyRulesPercent={rules.weekly}
                    remainingGameweeks={remainingGameweeks}
                    isStealthMode={isStealthMode}
                  />

                  {/* Total Collections Card */}
                  <div
                    id="tour-ledger"
                    className="bg-[#161d24] border border-[#10B981]/10 rounded-[2rem] p-6 md:p-8 relative overflow-hidden shadow-lg hover:border-[#10B981]/30 transition-colors w-full min-h-[220px] flex flex-col justify-center"
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

                {/* Operations Feed — WhatsApp Share Banner appears post-resolution */}
                <div className="fc-ops-feed w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl p-6 md:p-8">
                  <h4 className="flex items-center gap-2 text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-5">
                    <Bell className="w-4 h-4" /> Operations Feed
                  </h4>

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

                  <div className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                    <div className="w-10 h-10 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5 text-[#10B981]" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-white tracking-wide">
                        League Open for Gameweek
                      </h5>
                      <p className="text-xs text-gray-400 mt-1">
                        Accepting deposits for Gameweek ${currentGwNumber || firestoreGw || "--"}. Deadline approaches.
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
        </div>

        <div
          className={
            activeTab === "ledger"
              ? "block space-y-6 animate-in fade-in duration-500"
              : "hidden"
          }
        >
          {/* The Master Ledger Section */}
          <div className="w-full mx-auto">
            <section
              id="master-ledger"
              className="fc-card rounded-4xl border border-[#FBBF24]/20 bg-gradient-to-br from-[#FBBF24]/10 via-[#161d24] to-[#161d24] overflow-hidden shadow-2xl"
            >
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FBBF24] mb-1">
                  {tabCopy.ledger.eyebrow}
                </p>
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {tabCopy.ledger.title}
                </h2>
                <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                  {tabCopy.ledger.description}
                </p>
              </div>
              <div className="flex items-center gap-3 relative">
                <span className="text-xs text-gray-500 font-medium">
                  Filter by:
                </span>
                <button
                  onClick={() => openWalletFundModal()}
                  className="flex items-center gap-2 bg-[#FBBF24]/10 border border-[#FBBF24]/20 px-4 py-2 rounded-lg text-sm text-[#FBBF24] font-bold hover:bg-[#FBBF24]/20 transition-colors min-w-[140px] justify-between"
                >
                  Fund Wallet <Banknote className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="flex items-center gap-2 bg-[#1a232b] border border-white/10 px-4 py-2 rounded-lg text-sm text-white font-bold hover:bg-white/5 transition-colors min-w-[140px] justify-between"
                >
                  {paymentFilter === "All" ? "All Payments" : paymentFilter}{" "}
                  <ChevronDown className="w-4 h-4" />
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
                      Verified (Green Zone)
                    </button>
                    <button
                      onClick={() => {
                        setPaymentFilter("Red Zone");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-[#FBBF24] hover:bg-[#FBBF24]/10 transition-colors"
                    >
                      Red Zone (Unpaid)
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto min-h-[300px]">
              <table className="fc-muted-table w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[#11171a] border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                    <th className="p-4 pl-6 font-medium">Member</th>
                    <th className="p-4 font-medium hidden sm:table-cell">
                      M-Pesa Transaction Code
                    </th>
                    <th className="p-4 font-medium">Wallet Balance</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 pr-6 text-right font-medium">Verify</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-12 text-center text-gray-500 font-medium"
                      >
                        No members found matching this filter.
                      </td>
                    </tr>
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
                        <tr
                          key={row.id}
                          className={clsx(
                            "transition-colors group",
                            memberHasFunding(row)
                              ? "bg-[#10B981]/5 border-l-2 border-[#10B981]"
                              : "hover:bg-white/[0.02] border-l-2 border-transparent",
                          )}
                        >
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={clsx(
                                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border relative overflow-hidden",
                                  memberHasFunding(row)
                                    ? "border-[#10B981]/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] bg-[#10B981]/10"
                                    : "border-white/10 bg-[#161d24]",
                                )}
                              >
                                <img
                                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(row as any).avatarSeed || row.displayName}&backgroundColor=transparent`}
                                  alt={row.displayName}
                                  className={clsx(
                                    "w-full h-full object-cover",
                                    !memberHasFunding(row) && "grayscale opacity-80",
                                  )}
                                />
                              </div>
                              <div>
                                <div className="font-bold text-white leading-tight mb-1 flex items-center gap-2">
                                  {row.displayName}
                                  {(row as any).role === "admin" && (
                                    <span className="bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                                      Admin
                                    </span>
                                  )}
                                  {(row as any).paymentStreak >= 2 && (
                                    <span
                                      className="inline-flex items-center gap-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-black"
                                      title={`${(row as any).paymentStreak}-GW payment streak!`}
                                    >
                                      🔥{(row as any).paymentStreak}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400 leading-none flex items-center gap-2 mt-1">
                                  <span>{row.phone}</span>
                                  <span className="text-white/20">•</span>
                                  <button
                                    onClick={() => handleToggleAdmin(row.id, (row as any).role)}
                                    className="hover:text-white transition-colors"
                                  >
                                    {(row as any).role === "admin" ? "Revoke Admin" : "Make Admin"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 hidden sm:table-cell">
                            <span className="bg-[#11171a] border border-white/5 px-3 py-1.5 rounded-md text-gray-400 font-mono text-xs">
                              M-PESA / BANK
                            </span>
                          </td>
                          <td className="p-4">
                            <div className={clsx("font-bold tabular-nums text-sm", walletColor)}>
                              {isStealthMode ? "****" : `KES ${wallet.toLocaleString()}`}
                            </div>
                            <div className="text-[10px] text-gray-600 font-medium mt-0.5">
                              {gwsLeft > 0 ? `${gwsLeft} GW${gwsLeft !== 1 ? "s" : ""} covered` : "Top up needed"}
                            </div>
                          </td>
                          <td className="p-4">
                            {!memberHasFunding(row) && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a232b] text-[#FBBF24] border border-white/5 text-xs font-bold shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"></div> Red Zone (Unpaid)
                              </span>
                            )}
                            {memberHasFunding(row) && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-xs font-bold shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div> Green Zone (Verified)
                              </span>
                            )}
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <label className="relative inline-flex items-center cursor-pointer ml-auto">
                              <input
                                type="checkbox"
                                className="sr-only peer fc-ledger-verify-input"
                                checked={row.hasPaid}
                                onChange={() => handleTogglePayment(row.id, row.hasPaid, row.displayName)}
                              />
                              <div className="fc-ledger-switch-track w-11 h-6 bg-[#1a232b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981] border border-white/10"></div>
                            </label>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
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

          {showResolveModal && (
            <div className="fc-resolve-modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
              <div className="fc-resolve-modal bg-[#161d24] border border-[#FBBF24]/25 w-full max-w-md rounded-2xl shadow-[0_0_60px_rgba(251,191,36,0.1)] overflow-hidden">
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
                <div className="p-5 space-y-4">
                  {(!isCurrentEventFinished ||
                    !gwWinner ||
                    Number(gwWinner.event_total || 0) <= 0) && (
                    <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-3.5 py-2.5 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-300">Resolution locked</p>
                        <p className="text-[11px] text-red-200/80 mt-0.5">GW must be finished with a positive winner score.</p>
                      </div>
                    </div>
                  )}

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
                </div>

                {/* Footer */}
                <div className="p-5 pt-3 border-t border-white/5 flex items-center gap-3">
                  <button
                    onClick={() => setShowResolveModal(false)}
                    disabled={isResolving}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-gray-400 hover:text-white border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolveGameweek}
                    disabled={isResolving}
                    className="flex-1 px-4 py-2.5 rounded-xl font-black bg-[#FBBF24] hover:bg-[#F59E0B] text-[#111613] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                  >
                    {isResolving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm & Resolve
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
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
                            type="number"
                            min="0"
                            placeholder="0"
                            value={prefundData[m.id] || ""}
                            onChange={(e) =>
                              setPrefundData((prev) => ({
                                ...prev,
                                [m.id]: e.target.value,
                              }))
                            }
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
            <div className="fc-prefund-panel bg-[#161d24] border border-[#10B981]/30 w-full max-w-2xl rounded-4xl p-6 md:p-8 shadow-2xl flex flex-col max-h-[90vh]">
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
                  <select
                    value={fundTargetMemberId}
                    onChange={(e) => setFundTargetMemberId(e.target.value)}
                    className="fc-prefund-input w-full rounded-xl border px-3 py-3"
                  >
                    <option value="">Select member</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Amount (KES)
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="fc-prefund-input w-full rounded-xl border px-3 py-3"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Funding Method
                  </span>
                  <select
                    value={fundMethod}
                    onChange={(e) => {
                      setFundMethod(e.target.value as "mpesa" | "cash");
                      setFundPromptSent(false);
                    }}
                    className="fc-prefund-input w-full rounded-xl border px-3 py-3"
                  >
                    <option value="mpesa">M-Pesa Prompt</option>
                    <option value="cash">Cash Handoff</option>
                  </select>
                </label>

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
                      placeholder="e.g. John Doe"
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
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                      FPL Team Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newMemberTeam}
                      onChange={(e) => setNewMemberTeam(e.target.value)}
                      className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] outline-none"
                      placeholder="e.g. Saka Potatoes"
                    />
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
        </div>
      </div>
    </div>
  );
}
