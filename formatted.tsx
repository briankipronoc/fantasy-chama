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
  Star,
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
    if (pendingPayouts.length > 0) {
      setActionTimeline((prev) => ({
        ...prev,
        approvalPending: true,
        resolved: true,
      }));
      return;
    }
    setActionTimeline((prev) => ({ ...prev, approvalPending: false }));
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
      (snap) => {
        const events = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as any)
          .filter((item) =>
            /approve|reject|resolve|rule|payout|co-chair|chairman/i.test(
              item.message || "",
            ),
          );
        // setRecentGovernanceEvents(events);
      },
      (err) => {
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

  // Phase 40: HQ Debt Ledger & Onboarding
  const [showTutorial, setShowTutorial] = useState(false);
  const leagueSettings = useStore((state) => state.league);
  const pendingHQDebt = leagueSettings?.pendingHQDebt || 0;

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
  const role = useStore((state) => state.role);
  const tutorialSeenKey =
    activeLeagueId && activeUserId
      ? `chairman_initialized_${activeLeagueId}_${activeUserId}`
      : null;
  const adminTourSeenKey =
    activeLeagueId && activeUserId
      ? `hasSeenAdminTour_${activeLeagueId}_${activeUserId}`
      : null;
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
          if (data.rules) setRules(data.rules);

          try {
            const bootstrapUrl =
              "https://fantasy.premierleague.com/api/bootstrap-static/";
            const bootstrapRes = await fetch(
              `https://corsproxy.io/?${encodeURIComponent(bootstrapUrl)}`,
            );
            if (bootstrapRes.ok) {
              const bootstrapData = await bootstrapRes.json();
              const current = (bootstrapData?.events || []).find(
                (event: any) => event.is_current,
              );
              setIsCurrentEventFinished(current?.finished === true);
            }
          } catch (bootstrapErr: any) {
            console.warn(
              "[command-center] bootstrap fetch skipped:",
              bootstrapErr?.message || bootstrapErr,
            );
          }

          // Fetch Live GW Winner with 'Banner Off' Heuristic
          if (data.fplLeagueId) {
            const lastDate = data.lastResolvedDate?.toDate();
            const daysSince = lastDate
              ? (new Date().getTime() - lastDate.getTime()) / (1000 * 3600 * 24)
              : 0;

            // Show banner if never resolved, OR if we are within 2 days of resolution (celebrating), OR if it's been > 5 days (new GW starting)
            const shouldShowBanner =
              !lastDate || daysSince <= 2 || daysSince > 5;

            if (shouldShowBanner) {
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

  // Listen for pending payouts in real-time (for Co-Chair approval)
  useEffect(() => {
    if (!activeLeagueId) return;
    const pendingRef = collection(
      db,
      "leagues",
      activeLeagueId,
      "pending_payouts",
    );
    const q = query(pendingRef, where("status", "==", "awaiting_approval"));
    const unsub = onSnapshot(q, (snap) => {
      setPendingPayouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeLeagueId]);

  const hasFinalGwChampion = Boolean(
    gwWinner && isCurrentEventFinished && Number(gwWinner.event_total) > 0,
  );

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
          steps: [
            {
              element: "#tour-add-member",
              popover: {
                title: "Add League Members",
                description:
                  "Start by manually enrolling members into the Chama using their M-Pesa phone number.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#tour-resolve-gw",
              popover: {
                title: "Resolve Gameweeks",
                description:
                  "At the end of an FPL gameweek, click this to automatically calculate the highest scorer and dispatch the weekly pot.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#tour-ledger",
              popover: {
                title: "Live Ledger Tracker",
                description:
                  "Monitor all deposits here. Once you mark a member as Paid, the ledger updates in real-time.",
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
      }
    } catch (error) {
      console.error("Error toggling payment", error);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
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

  const paidMembersCount = members.filter(
    (m) => m.hasPaid && m.isActive !== false,
  ).length;
  const redZoneMembers = members.filter(
    (m) => !m.hasPaid && m.role !== "admin" && m.isActive !== false,
  );
  const totalCollected = paidMembersCount * gameweekStake;
  const weeklyPot = totalCollected * (rules.weekly / 100);
  // Formula: Active members * Gameweek Stake * 38 GWs * Vault Percentage
  const seasonVault = members.length * gameweekStake * 38 * (rules.vault / 100);
  const isCoChairSession = !!coAdminId && coAdminId === activeUserId;
  const stalePendingPayouts = pendingPayouts.filter((payout: any) => {
    const ts = payout.timestamp?.toDate
      ? payout.timestamp.toDate().getTime()
      : 0;
    return ts > 0 && Date.now() - ts > 30 * 60 * 1000;
  });
  const missingWinnerPhoneCount = pendingPayouts.filter((payout: any) => {
    const winnerMember = members.find(
      (member) =>
        member.id === payout.winnerId ||
        member.displayName === payout.winnerName,
    );
    return !(payout.winnerPhone || winnerMember?.phone);
  }).length;
  const highRiskTwoWeekMisses = members.filter(
    (member: any) =>
      member.isActive !== false &&
      member.role !== "admin" &&
      Number(member.missedGameweeks || 0) >= 2,
  ).length;
  const preflightChecks = [
    { label: "At least one paid member", ok: paidMembersCount > 0 },
    {
      label: "No pending payout with missing winner phone",
      ok: missingWinnerPhoneCount === 0,
    },
    {
      label: "No stale approvals older than 30 min",
      ok: stalePendingPayouts.length === 0,
    },
    {
      label: "No unresolved disputes blocking trust",
      ok: pendingDisputes.length === 0,
    },
  ];
  // const hasPreflightBlockers = preflightChecks.some((check) => !check.ok);
  const sortedPendingPayouts = [...pendingPayouts].sort((a: any, b: any) => {
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

    showToast("Bulk Nudge dispatched via SMS to all Red Zone members!");

    // Actually push to members' individual notification feeds
    const redZoneMembers = members.filter(
      (m) => !m.hasPaid && m.role !== "admin" && m.isActive !== false,
    );

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
  };

  const handlePrefundSubmit = async () => {
    if (!activeLeagueId) return;
    const entries = Object.entries(prefundData)
      .filter(([_, amount]) => Number(amount) > 0)
      .map(([memberId, amount]) => ({ memberId, amount: Number(amount) }));

    if (entries.length === 0) {
      showToast("Enter amounts for at least one member.");
      return;
    }

    setIsPrefunding(true);
    try {
      const payoutApiUrl = getApiBaseUrl();
      if (!payoutApiUrl)
        throw new Error(
          "Payment server is not configured. Set VITE_API_URL for production.",
        );
      const res = await fetch(`${payoutApiUrl}/api/league/prefund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: activeLeagueId,
          chairmanId: auth.currentUser?.uid,
          entries: entries,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Pilot Pre-Fund Complete! ${entries.length} wallets updated.`,
        );
        setShowPrefundOptions(false);
        setPrefundData({});
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      } else {
        throw new Error(data.message || "Error executing pre-fund.");
      }
    } catch (err: any) {
      console.error("Prefund failed:", err);
      showToast(`Prefund Failed: ${err.message}`);
    } finally {
      setIsPrefunding(false);
    }
  };

  const handleResolveGameweek = async () => {
    if (!activeLeagueId) return;
    setIsResolving(true);
    try {
      const bootstrapUrl =
        "https://fantasy.premierleague.com/api/bootstrap-static/";
      const bootstrapRes = await fetch(
        `https://corsproxy.io/?${encodeURIComponent(bootstrapUrl)}`,
      );
      if (!bootstrapRes.ok)
        throw new Error("Failed to fetch current gameweek status.");
      const bootstrapData = await bootstrapRes.json();
      const currentEvent = (bootstrapData?.events || []).find(
        (event: any) => event.is_current,
      );
      const gwNumber = Number(currentEvent?.id || 0);
      const isGwFinished = currentEvent?.finished === true;

      if (!gwNumber) {
        throw new Error(
          "Current gameweek is unavailable from FPL. Try again shortly.",
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
      let winner: any = null;
      let winningPoints = 0;

      for (const fplManager of sortedStandings) {
        // Match via team IDs, displayName, or fplTeamName
        const dbMember = members.find(
          (m) =>
            (m.fplTeamId && Number(m.fplTeamId) === Number(fplManager.entry)) ||
            (m.secondFplTeamId &&
              Number(m.secondFplTeamId) === Number(fplManager.entry)) ||
            m.displayName === fplManager.player_name ||
            (m as any).fplTeamName === fplManager.entry_name,
        );

        if (dbMember) {
          if (
            dbMember.hasPaid &&
            dbMember.isActive !== false &&
            Number(fplManager.event_total || 0) > 0
          ) {
            winner = dbMember;
            winningPoints = Number(fplManager.event_total || 0);
            break;
          }
        }
      }

      if (!winner) {
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
        const pendingPayoutsRef = collection(
          db,
          "leagues",
          activeLeagueId,
          "pending_payouts",
        );
        await addDoc(pendingPayoutsRef, {
          winnerId: winner.id,
          winnerName: winner.displayName,
          winnerPhone: winner.phone,
          amount: weeklyPot,
          points: winningPoints,
          gw: gwNumber,
          status: "awaiting_approval",
          method: payoutMethod,
          requestedBy,
          approvalTarget: "co-chair",
          timestamp: serverTimestamp(),
        });

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
        const pendingPayoutsRef = collection(
          db,
          "leagues",
          activeLeagueId,
          "pending_payouts",
        );
        await addDoc(pendingPayoutsRef, {
          winnerId: winner.id,
          winnerName: winner.displayName,
          winnerPhone: winner.phone,
          amount: weeklyPot,
          points: winningPoints,
          gw: gwNumber,
          status: "awaiting_approval",
          method: payoutMethod,
          requestedBy,
          approvalTarget: "chairman",
          timestamp: serverTimestamp(),
        });

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
  const handleApprovePayout = async (payout: any) => {
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

      let data: any = { success: true };
      if (payout.method === "mpesa" || !payout.method) {
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
          approvedBy: auth.currentUser?.displayName || "Co-Chair",
          winnerPhone: payoutPhone || null,
          approvedAt: serverTimestamp(),
        },
      );

      // Fire proper deduct-gw-cost backend logic to accurately decrement wallets and flag red zones
      const gwApiUrl = getApiBaseUrl();
      if (!gwApiUrl)
        throw new Error(
          "Payment server is not configured. Set VITE_API_URL for production.",
        );
      await fetch(`${gwApiUrl}/api/league/deduct-gw-cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: activeLeagueId,
          gwCostPerRound: gameweekStake,
          gwNumber: payout.gw,
          winnerName: payout.winnerName,
          payoutMethod: payout.method,
          chairmanId: auth.currentUser?.uid,
          winnerAmount: payout.amount,
        }),
      });

      if (payout.method === "cash") {
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
        `✅ Approved! ${payout.method === "cash" ? "Cash Handoff logged for" : "B2C Dispatch sent to"} ${payout.winnerName} (KES ${payout.amount.toLocaleString()}).`,
      );
      triggerResolutionPulse();
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10B981", "#FBBF24", "#FFFFFF"],
      });
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
          "transition-all duration-700 w-full flex-1 flex flex-col",
          isSuspended
            ? "blur-xl opacity-20 pointer-events-none select-none scale-[0.98] h-screen overflow-hidden"
            : "",
          isWithinGracePeriod ? "pt-12" : "",
        )}
      >
        {/* Unified Global Toast Notification */}
        <div
          className={clsx(
            "fixed bottom-12 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-full text-[13px] font-bold flex items-center gap-3 transition-all duration-500 pointer-events-none z-[9999] shadow-[0_20px_50px_rgba(0,0,0,0.5)] fc-inline-toast fc-inline-toast-success",
            toastMessage
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-8 scale-95",
          )}
        >
          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
          {toastMessage}
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 md:py-10 space-y-10">
          {/* Top Header */}
          <Header
            role="admin"
            title={leagueName || "Command Center"}
            subtitle="Chairman Hub"
          />

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
            <div className="fc-card rounded-2xl border border-white/10 bg-[#161d24]/85 p-4 md:p-5 w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Weekly Command Board
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  High Signal
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 hover:bg-emerald-500/15 transition-colors">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-black">
                    Approve Payouts
                  </p>
                  <p className="text-2xl font-black text-white mt-1 tabular-nums">
                    {pendingPayouts.length}
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3 hover:bg-white/[0.04] transition-colors">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">
                    Red Zone Follow-ups
                  </p>
                  <p className="text-2xl font-black text-white mt-1 tabular-nums">
                    {redZoneMembers.length}
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3 hover:bg-white/[0.04] transition-colors">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">
                    Unresolved Disputes
                  </p>
                  <p className="text-2xl font-black text-white mt-1 tabular-nums">
                    {pendingDisputes.length}
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3 hover:bg-white/[0.04] transition-colors">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">
                    2-Week Risk Members
                  </p>
                  <p className="text-2xl font-black text-white mt-1 tabular-nums">
                    {highRiskTwoWeekMisses}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setShowResolveModal(true)}
                  className="px-3 py-2 rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/12 text-[#FBBF24] text-[10px] font-black uppercase tracking-widest"
                >
                  Resolve / Close GW
                </button>
                <button
                  onClick={() => setPaymentFilter("Red Zone")}
                  className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/12 text-red-300 text-[10px] font-black uppercase tracking-widest"
                >
                  Open Red Zone
                </button>
                <button
                  onClick={() => navigate("/finances")}
                  className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/12 text-emerald-300 text-[10px] font-black uppercase tracking-widest"
                >
                  Open Finance Queue
                </button>
              </div>
            </div>
          </div>

          {pendingHQDebt > 0 && !isSuspended && (
            <section className="fc-card rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4 md:p-5">
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

          {/* Chairman Action Timeline */}
          <section className="fc-card rounded-2xl border border-white/10 bg-[#161d24]/85 p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                Resolution Timeline
              </h3>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                Live
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
              {[
                {
                  key: "resolved",
                  label: "Resolve GW",
                  active: actionTimeline.resolved,
                },
                {
                  key: "approval",
                  label: "Approval Pending",
                  active: actionTimeline.approvalPending,
                },
                {
                  key: "sent",
                  label: "Payout Sent",
                  active: actionTimeline.payoutSent,
                },
                {
                  key: "confirmed",
                  label: "Confirmed",
                  active: actionTimeline.confirmed,
                },
                {
                  key: "hq-settled",
                  label: "HQ Settled",
                  active:
                    pendingHQDebt <= 0 ||
                    latestHqSettlement?.status === "approved",
                },
              ].map((step, idx) => (
                <div
                  key={step.key}
                  className={clsx(
                    "rounded-xl border p-3 transition-all duration-300 relative",
                    step.active
                      ? "border-emerald-500/35 bg-emerald-500/10"
                      : "border-white/10 bg-black/20",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={clsx(
                        "text-[10px] font-black uppercase tracking-widest",
                        step.active ? "text-emerald-300" : "text-gray-500",
                      )}
                    >
                      Step {idx + 1}
                    </span>
                    <span
                      className={clsx(
                        "h-2 w-2 rounded-full",
                        step.active
                          ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                          : "bg-gray-600",
                      )}
                    />
                  </div>
                  <p
                    className={clsx(
                      "text-xs font-bold",
                      step.active ? "text-white" : "text-gray-400",
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Live Gameweek Winner Gold UI */}
          {gwWinner && (
            <div
              className={clsx(
                "fc-highlight-card bg-gradient-to-r from-[#FBBF24]/10 via-[#F59E0B]/5 to-transparent border border-[#FBBF24]/30 rounded-[2rem] p-6 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-[0_0_40px_rgba(251,191,36,0.1)] transition-all animate-in zoom-in-95 duration-500 mt-4 mb-2",
                resolutionPulse && "fc-burst-success",
              )}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#FBBF24] blur-[100px] opacity-10 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#F59E0B] blur-[80px] opacity-10 pointer-events-none"></div>

              <div className="relative z-10 flex items-center gap-5 w-full md:w-auto">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FBBF24] to-[#B45309] p-[2px] shadow-lg flex-shrink-0 animate-pulse">
                  <div className="w-full h-full bg-[#0b1014] rounded-full flex items-center justify-center border-2 border-[#0b1014]">
                    <Trophy className="w-7 h-7 text-[#FBBF24]" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#FBBF24] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Star className="w-3 h-3 fill-current" />{" "}
                    {hasFinalGwChampion ? "Gameweek Champion" : "Live Leader"}
                  </p>
                  <h3 className="text-2xl font-black text-white leading-tight tracking-tight">
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

              <div className="relative z-10 flex flex-col items-center flex-shrink-0 justify-center w-full md:w-auto fc-highlight-surface p-6 rounded-2xl border backdrop-blur-sm gap-4 transition-colors hover:bg-black">
                <div className="flex flex-col items-center justify-center w-full gap-1.5 text-center">
                  <p className="text-[10px] font-black fc-meta-label uppercase tracking-widest">
                    Projected Payout
                  </p>
                  <p className="text-3xl font-black text-[#FBBF24] tabular-nums tracking-tight">
                    KES{" "}
                    {(
                      members.filter((m) => m.hasPaid && m.isActive !== false)
                        .length *
                      gameweekStake *
                      (rules.weekly / 100)
                    ).toLocaleString()}
                  </p>
                </div>
                {role === "admin" && (
                  <button
                    id="tour-resolve-gw"
                    onClick={() => setShowResolveModal(true)}
                    className="fc-highlight-action w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#FBBF24] hover:bg-white text-black text-[11px] font-black tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(251,191,36,0.3)] uppercase active:scale-95"
                  >
                    <Trophy className="w-4 h-4" /> Resolve & Payout
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Co-Chair: Pending Payout Approval Panel */}
          {pendingPayouts.length > 0 && (
            <section className="space-y-4">
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
                              Resolve & Pay
                            </button>
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
          className={
            activeTab === "finance"
              ? "block animate-in fade-in duration-500"
              : "hidden"
          }
        >
          {/* Generate League Access Section */}
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight mb-1 flex items-center gap-3">
                  <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-[#10B981]" />{" "}
                  League Access & Economy
                </h2>
                <p className="text-gray-400 text-sm">
                  Control your league entry and monitor the live vault deposits.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!isCoChairSession && (
                  <button
                    onClick={() => setShowPrefundOptions(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#FBBF24]/10 border border-[#FBBF24]/30 hover:bg-[#FBBF24]/20 text-[#FBBF24] text-sm font-bold rounded-xl transition-colors"
                  >
                    <Banknote className="w-4 h-4" /> Pilot Prefund
                  </button>
                )}
                {!isCoChairSession && (
                  <button
                    id="tour-add-member"
                    onClick={() => setShowAddMemberModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#1a232b] hover:bg-white/5 text-white text-sm font-bold rounded-xl transition-colors border border-white/5"
                  >
                    <UserPlus className="w-4 h-4 text-[#10B981]" /> Add Member
                  </button>
                )}
                {!isCoChairSession && (
                  <button
                    onClick={handleBulkNudge}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#10B981] hover:bg-[#10B981]/90 text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  >
                    <Megaphone className="w-4 h-4" /> Bulk Nudge
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
              <div className="xl:col-span-8 flex flex-col gap-6 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 w-full">
                  <PotVaultSwapper
                    weeklyPot={weeklyPot}
                    seasonVault={seasonVault}
                    weeklyRulesPercent={rules.weekly}
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
                      <div className="flex items-center gap-2 text-[#10B981] text-[10px] md:text-xs font-bold mt-4">
                        {paidMembersCount} members fully paid
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
                        Accepting deposits for Gameweek 26. Deadline approaches.
                      </p>
                      <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase mt-2 block">
                        System
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="fc-invite-card xl:col-span-4 w-full bg-[#161d24] border border-white/5 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
                <div className="fc-invite-card-body p-8 flex flex-col justify-center relative min-h-[220px] bg-gradient-to-b from-[#1a232b] to-[#161d24] h-full">
                  {/* Toast Notification Moved to App Root */}

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
                      onClick={() => {
                        navigator.clipboard.writeText(inviteCode);
                        const msg = `🎯 Join my Fantasy Chama League: *${leagueName}*\n\n🔑 Access Code: *${inviteCode}*\n💰 Weekly Stake: KES ${gameweekStake || 0}\n\nJoin here: https://fantasychama.com`;
                        window.open(
                          `https://wa.me/?text=${encodeURIComponent(msg)}`,
                          "_blank",
                        );
                      }}
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
          <section className="bg-[#161d24] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">
                The Master Ledger
              </h2>
              <div className="flex items-center gap-3 relative">
                <span className="text-xs text-gray-500 font-medium">
                  Filter by:
                </span>
                <button
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="flex items-center gap-2 bg-[#1a232b] border border-white/10 px-4 py-2 rounded-lg text-sm text-white font-bold hover:bg-white/5 transition-colors min-w-[140px] justify-between"
                >
                  {paymentFilter === "All" ? "All Payments" : paymentFilter}{" "}
                  <ChevronDown className="w-4 h-4" />
                </button>

                {/* Dropdown Menu */}
                {isFilterDropdownOpen && (
                  <div className="absolute top-full mt-2 right-0 w-48 bg-[#161d24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20">
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
              <table className="w-full text-left border-collapse min-w-[600px]">
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
                      const gwCost = gameweekStake; // fallback until gwCostPerRound is set
                      const gwsLeft =
                        gwCost > 0 ? Math.floor(wallet / gwCost) : 0;
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
                            row.hasPaid
                              ? "bg-[#10B981]/5 border-l-2 border-[#10B981]"
                              : "hover:bg-white/[0.02] border-l-2 border-transparent",
                          )}
                        >
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={clsx(
                                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border relative overflow-hidden",
                                  row.hasPaid
                                    ? "border-[#10B981]/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] bg-[#10B981]/10"
                                    : "border-white/10 bg-[#161d24]",
                                )}
                              >
                                <img
                                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(row as any).avatarSeed || row.displayName}&backgroundColor=transparent`}
                                  alt={row.displayName}
                                  className={clsx(
                                    "w-full h-full object-cover",
                                    !row.hasPaid && "grayscale opacity-80",
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
                                  {/* Phase 8: Streak Badge */}
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
                                    onClick={() =>
                                      handleToggleAdmin(
                                        row.id,
                                        (row as any).role,
                                      )
                                    }
                                    className="hover:text-white transition-colors"
                                  >
                                    {(row as any).role === "admin"
                                      ? "Revoke Admin"
                                      : "Make Admin"}
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
                            <div
                              className={clsx(
                                "font-bold tabular-nums text-sm",
                                walletColor,
                              )}
                            >
                              {isStealthMode
                                ? "****"
                                : `KES ${wallet.toLocaleString()}`}
                            </div>
                            <div className="text-[10px] text-gray-600 font-medium mt-0.5">
                              {gwsLeft > 0
                                ? `${gwsLeft} GW${gwsLeft !== 1 ? "s" : ""} covered`
                                : "Top up needed"}
                            </div>
                          </td>
                          <td className="p-4">
                            {!row.hasPaid && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a232b] text-[#FBBF24] border border-white/5 text-xs font-bold shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"></div>{" "}
                                Red Zone (Unpaid)
                              </span>
                            )}
                            {row.hasPaid && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-xs font-bold shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>{" "}
                                Green Zone (Verified)
                              </span>
                            )}
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <label className="relative inline-flex items-center cursor-pointer ml-auto">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={row.hasPaid}
                                onChange={() =>
                                  handleTogglePayment(
                                    row.id,
                                    row.hasPaid,
                                    row.displayName,
                                  )
                                }
                              />
                              <div className="w-11 h-6 bg-[#1a232b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981] border border-white/10"></div>
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

          {/* Gameweek Resolution Modal */}
          {showResolveModal && (
            <div className="fc-resolve-modal-overlay fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-[#0a100a]/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
              <div className="fc-resolve-modal bg-[#161d24] border border-[#FBBF24]/30 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl my-4 sm:my-0 max-h-[92vh] overflow-y-auto">
                <div className="w-12 h-12 rounded-full bg-[#FBBF24]/10 flex items-center justify-center mb-6 border border-[#FBBF24]/20">
                  <AlertTriangle className="w-6 h-6 text-[#FBBF24]" />
                </div>

                <h3 className="text-xl font-bold text-white mb-2">
                  End-of-Gameweek Resolution
                </h3>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  <strong className="text-[#FBBF24] font-bold">
                    Are you sure?
                  </strong>{" "}
                  This will calculate the top scorer, execute the selected
                  payout method, dispatch{" "}
                  <span className="text-white font-bold tracking-tight">
                    KES {isStealthMode ? "****" : weeklyPot.toLocaleString()}
                  </span>{" "}
                  to the winner, and record the gameweek in the audit log
                  permanently.
                </p>

                {(!isCurrentEventFinished ||
                  !gwWinner ||
                  Number(gwWinner.event_total || 0) <= 0) && (
                  <div className="fc-resolve-lock-banner mb-5 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-300">
                      Resolution locked
                    </p>
                    <p className="text-xs text-red-100/90 mt-1">
                      You can only resolve after FPL marks the current gameweek
                      as finished and the winner has a positive GW score.
                    </p>
                  </div>
                )}

                {/* Payout Method Toggle */}
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">
                    Disbursement Method
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPayoutMethod("mpesa")}
                      className={`fc-disburse-option flex-1 flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${payoutMethod === "mpesa" ? "bg-[#10B981]/10 border-[#10B981]/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "bg-[#0a100a] text-gray-500 border-white/5 hover:border-white/20"}`}
                    >
                      <div
                        className={`font-black uppercase tracking-widest mb-1 text-sm ${payoutMethod === "mpesa" ? "text-[#10B981]" : ""}`}
                      >
                        M-Pesa B2C
                      </div>
                      <div className="text-[10px] opacity-90 text-center font-bold">
                        Instant API disbursement + callback receipt
                      </div>
                    </button>
                    <button
                      onClick={() => setPayoutMethod("cash")}
                      className={`fc-disburse-option flex-1 flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${payoutMethod === "cash" ? "bg-[#FBBF24]/10 border-[#FBBF24]/50 shadow-[0_0_15px_rgba(251,191,36,0.15)]" : "bg-[#0a100a] text-gray-500 border-white/5 hover:border-white/20"}`}
                    >
                      <div
                        className={`font-black uppercase tracking-widest mb-1 text-sm ${payoutMethod === "cash" ? "text-[#FBBF24]" : ""}`}
                      >
                        Cash Handoff
                      </div>
                      <div className="text-[10px] opacity-90 text-center font-bold">
                        Manual payout + mandatory receipt/audit logging
                      </div>
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400">
                    Selected:{" "}
                    <span className="font-black text-white uppercase">
                      {payoutMethod === "mpesa" ? "M-Pesa B2C" : "Cash Handoff"}
                    </span>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4 mt-8">
                  <button
                    onClick={() => setShowResolveModal(false)}
                    disabled={isResolving}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolveGameweek}
                    disabled={isResolving}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black bg-[#FBBF24] hover:bg-white text-[#111613] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResolving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />{" "}
                        Disbursing...
                      </>
                    ) : (
                      <>
                        <Banknote className="w-4 h-4" /> Disburse Funds
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pilot Pre-Fund Modal */}
          {showPrefundOptions && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a100a]/90 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-[#161d24] border border-[#FBBF24]/30 w-full max-w-2xl rounded-3xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#FBBF24]/10 flex items-center justify-center border border-[#FBBF24]/20">
                      <Banknote className="w-6 h-6 text-[#FBBF24]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        Pilot Mode: Pre-Fund Wallets{" "}
                        <span className="bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 rounded uppercase">
                          Admin Only
                        </span>
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
                  {members
                    .filter((m) => m.isActive !== false)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#0a100a]/50 border border-white/10 rounded-xl hover:bg-[#0a100a] transition-colors"
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
                            value={prefundData[m.id] || ""}
                            onChange={(e) =>
                              setPrefundData((prev) => ({
                                ...prev,
                                [m.id]: e.target.value,
                              }))
                            }
                            placeholder="Amount paid offline"
                            className="w-36 bg-[#1a232b] border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#FBBF24]/50 focus:outline-none transition-all tabular-nums text-right"
                          />
                        </div>
                      </div>
                    ))}
                </div>
                <div className="flex gap-3 mt-auto shrink-0">
                  <button
                    onClick={() => {
                      setShowPrefundOptions(false);
                      setPrefundData({});
                    }}
                    className="flex-1 py-3.5 bg-[#0b1014] hover:bg-white/5 text-gray-400 font-bold uppercase tracking-widest text-xs rounded-xl transition-colors border border-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePrefundSubmit}
                    disabled={
                      isPrefunding || Object.keys(prefundData).length === 0
                    }
                    className="flex-1 py-3.5 bg-[#FBBF24] hover:bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl transition-colors shadow-[0_0_15px_rgba(251,191,36,0.2)] disabled:opacity-50 flex justify-center items-center gap-2"
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

          {/* Complete Add Member Modal */}
          {showAddMemberModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a100a]/90 backdrop-blur-md animate-in fade-in duration-200">
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
