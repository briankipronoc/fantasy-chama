import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Trophy, Users, CheckCircle2, AlertTriangle, Lock, Unlock, UserPlus, UserMinus, ShieldAlert, User, Mail, Copy, Share2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import Header from '../components/Header';

export default function Profile() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id'; // Fallback for MVP
    const role = useStore(state => state.role);
    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);
    const toggleMemberActiveStatus = useStore(state => state.toggleMemberActiveStatus);

    // Form states
    const [displayName, setDisplayName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [fplTeamName, setFplTeamName] = useState('');
    const [avatarSeed, setAvatarSeed] = useState('chairman');
    const [isSavingMember, setIsSavingMember] = useState(false);
    const [fplStandings, setFplStandings] = useState<any[]>([]);
    const [isFetchingFpl, setIsFetchingFpl] = useState(false);

    // State for Admin Settings
    const [gameweekStake, setMonthlyContribution] = useState<number>(0);
    const [weeklyPrizePercent, setWeeklyPrizePercent] = useState<number>(70);
    const [seasonWinnersCount, setSeasonWinnersCount] = useState<number>(3);
    const [seasonWinnersMode, setSeasonWinnersMode] = useState<'top1' | 'top3' | 'top5' | 'custom'>('top3');
    const [customWinnerCount, setCustomWinnerCount] = useState<number>(3);
    const [customWinnerRatios, setCustomWinnerRatios] = useState<string[]>(['50', '30', '20']);
    const [fplLeagueId, setFplLeagueId] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [chairmanPhone, setChairmanPhone] = useState('');
    const [coAdminId, setCoAdminId] = useState('');
    const [chairmanId, setChairmanId] = useState<string | null>(null);
    const [isSavingAdmin, setIsSavingAdmin] = useState(false);
    const [showWarningModal, setShowWarningModal] = useState(false);

    const activeMembersCount = members.filter((member) => member.isActive !== false).length;
    const maxAllowedWinners = Math.max(1, Math.min(10, Math.max(1, activeMembersCount)));
    const normalizedCustomWinnerCount = Math.max(1, Math.min(maxAllowedWinners, customWinnerCount));

    const getPresetDistribution = (count: number) => {
        if (count === 1) return [100];
        if (count === 2) return [65, 35];
        if (count === 3) return [50, 30, 20];
        if (count === 4) return [40, 30, 20, 10];
        if (count === 5) return [35, 25, 20, 12, 8];
        if (count === 6) return [30, 22, 16, 12, 10, 10];
        if (count === 7) return [28, 20, 15, 12, 10, 8, 7];
        if (count === 8) return [25, 18, 14, 12, 10, 8, 7, 6];
        if (count === 9) return [24, 18, 13, 11, 10, 8, 6, 5, 5];
        if (count === 10) return [22, 17, 13, 11, 10, 8, 7, 5, 4, 3];
        return [50, 30, 20];
    };

    const normalizeDistribution = (ratioInputs: string[], winnerCount: number) => {
        const parsed = Array.from({ length: winnerCount }, (_, idx) => {
            const raw = Number(ratioInputs[idx] || 0);
            return Number.isFinite(raw) && raw >= 0 ? raw : 0;
        });
        const sum = parsed.reduce((acc, value) => acc + value, 0);
        if (sum <= 0) {
            const base = Math.floor(100 / winnerCount);
            const remainder = 100 - base * winnerCount;
            return parsed.map((_, idx) => base + (idx === 0 ? remainder : 0));
        }
        const scaled = parsed.map((value) => (value / sum) * 100);
        const rounded = scaled.map((value) => Math.floor(value));
        const floorSum = rounded.reduce((acc, value) => acc + value, 0);
        rounded[0] += (100 - floorSum);
        return rounded;
    };

    const baseSeasonWinnersCount = seasonWinnersMode === 'top1'
        ? 1
        : seasonWinnersMode === 'top5'
            ? 5
            : seasonWinnersMode === 'custom'
                ? normalizedCustomWinnerCount
                : 3;
    const effectiveSeasonWinnersCount = Math.min(baseSeasonWinnersCount, maxAllowedWinners);

    const effectiveSeasonDistribution = seasonWinnersMode === 'custom'
        ? normalizeDistribution(customWinnerRatios, effectiveSeasonWinnersCount)
        : getPresetDistribution(effectiveSeasonWinnersCount);
    const rawCustomRatioSummary = customWinnerRatios
        .slice(0, normalizedCustomWinnerCount)
        .map((value, idx) => `#${idx + 1} ${Number(value || 0)}%`)
        .join(' · ');

    // Financial Locks
    const [isFinancialsLocked, setIsFinancialsLocked] = useState(true);

    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [userEmail, setUserEmail] = useState('');

    const scrollPageTop = () => {
        const mainScrollHost = document.querySelector('.fc-main-scroll') as HTMLElement | null;
        if (mainScrollHost) {
            mainScrollHost.scrollTop = 0;
            if ('scrollTo' in mainScrollHost) {
                mainScrollHost.scrollTo({ top: 0, behavior: 'auto' });
            }
        }
        window.scrollTo({ top: 0, behavior: 'auto' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    };

    useEffect(() => {
        let unsubscribeMembers = () => { };
        if (activeLeagueId) {
            unsubscribeMembers = listenToLeagueMembers(activeLeagueId);
            
            // Fetch League Details for everyone so we get fplLeagueId
            const fetchLeagueAndFpl = async () => {
                try {
                    const docRef = doc(db, 'leagues', activeLeagueId);
                    const docSnap = await getDoc(docRef);
                    if (!docSnap.exists()) return;

                    const data = docSnap.data();
                    setMonthlyContribution(data.gameweekStake || 1400);
                    setWeeklyPrizePercent(data.rules?.weekly || 70);
                    setSeasonWinnersCount(data.rules?.seasonWinnersCount || 3);
                    setSeasonWinnersMode(data.rules?.seasonWinnersMode || ((data.rules?.seasonWinnersCount || 3) === 1 ? 'top1' : (data.rules?.seasonWinnersCount || 3) === 5 ? 'top5' : 'top3'));
                    setCustomWinnerCount(data.rules?.seasonWinnersCount || 3);
                    if (Array.isArray(data.rules?.seasonDistribution)) {
                        setCustomWinnerRatios(data.rules.seasonDistribution.map((value: number) => String(value)));
                    }
                    setInviteCode(data.inviteCode || 'N/A');
                    setCoAdminId(data.coAdminId || '');
                    setChairmanPhone(data.chairmanPhone || '');
                    if (data.chairmanId) setChairmanId(data.chairmanId);

                    const fplId = data.fplLeagueId;
                    setFplLeagueId(fplId || '');

                    // If league has an FPL ID, fetch the standings list to let user sync their exact team
                    if (fplId) {
                        try {
                            setIsFetchingFpl(true);
                            const STANDINGS_API_URL = `https://fantasy.premierleague.com/api/leagues-classic/${fplId}/standings/`;
                            const response = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(STANDINGS_API_URL)}`);
                            if (response.ok) {
                                const payload = await response.json();
                                if (payload.standings && payload.standings.results) {
                                    setFplStandings(payload.standings.results);
                                }
                            }
                        } catch (err) {
                            console.error('Failed to sync FPL Teams:', err);
                        } finally {
                            setIsFetchingFpl(false);
                        }
                    }
                } catch (err) {
                    console.warn('[profile] league settings sync failed:', err);
                }
            };
            fetchLeagueAndFpl();
        }
        return () => {
            try { unsubscribeMembers(); } catch (err) {
                console.warn('[profile] member listener cleanup failed:', err);
            }
        };
    }, [activeLeagueId, listenToLeagueMembers, role]);

    // Grab email from Firebase Auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user?.email) setUserEmail(user.email);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Find current member to prepopulate
        if (members.length > 0) {
            const currentMember = members.find(m => m.id === activeUserId) || members[0];
            if (currentMember) {
                setDisplayName(currentMember.displayName || '');
                setPhoneNumber(currentMember.phone || '');
                setFplTeamName((currentMember as any).fplTeamId ? String((currentMember as any).fplTeamId) : '');
                setAvatarSeed((currentMember as any).avatarSeed || ((currentMember.role === 'admin' || role === 'admin') ? 'chairman' : currentMember.displayName));
            }
        }
    }, [members, activeUserId, role]);

    useEffect(() => {
        if (customWinnerCount > maxAllowedWinners) {
            setCustomWinnerCount(maxAllowedWinners);
        }
    }, [customWinnerCount, maxAllowedWinners]);

    useEffect(() => {
        if (seasonWinnersMode !== 'custom') return;
        setCustomWinnerRatios((prev) => {
            const next = [...prev];
            if (next.length > normalizedCustomWinnerCount) return next.slice(0, normalizedCustomWinnerCount);
            if (next.length < normalizedCustomWinnerCount) {
                while (next.length < normalizedCustomWinnerCount) next.push('0');
            }
            return next;
        });
    }, [seasonWinnersMode, normalizedCustomWinnerCount]);

    // Red Zone: is current user unpaid?
    const currentMember = members.find(m => m.id === activeUserId) || members[0];
    const hasPaid = currentMember?.hasPaid ?? true; // default true to avoid false red on load
    const isAdminView = role === 'admin';

    const handleSaveMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeLeagueId) return;

        setIsSavingMember(true);
        setToast(null);

        try {
            // Using members[0].id for MVP if activeUserId is a fallback
            const targetMemberId = members.find(m => m.id === activeUserId)?.id || members[0]?.id;

            if (targetMemberId) {
                const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', targetMemberId);
                const updates: any = {
                    displayName: displayName,
                    phone: phoneNumber,
                    avatarSeed: avatarSeed
                };

                // The dropdown stores the numeric FPL entry ID. Only update if valid.
                if (fplTeamName !== '') {
                    updates.fplTeamId = Number(fplTeamName);
                    
                    // Also find the real name and save it locally just in case
                    const matchedTeam = fplStandings.find((t: any) => String(t.entry) === String(fplTeamName));
                    if (matchedTeam) {
                        updates.fplTeamName = matchedTeam.entry_name;
                    }
                }

                await updateDoc(memberRef, updates);
                setToast({ message: 'Profile updated successfully!', type: 'success' });
            }
        } catch (error) {
            setToast({ message: 'Could not save profile changes.', type: 'error' });
            console.error(error);
        } finally {
            setIsSavingMember(false);
            setTimeout(() => setToast(null), 4000);
        }
    };

    useEffect(() => {
        if (!toast) return;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [toast]);

    const confirmAdminSave = async () => {
        if (!activeLeagueId) return;

        setShowWarningModal(false);
        setIsSavingAdmin(true);
        setToast(null);

        try {
            const leagueRef = doc(db, 'leagues', activeLeagueId);
            await updateDoc(leagueRef, {
                gameweekStake: Number(gameweekStake),
                'rules.weekly': Number(weeklyPrizePercent),
                'rules.vault': 100 - Number(weeklyPrizePercent),
                'rules.seasonWinnersCount': effectiveSeasonWinnersCount,
                'rules.seasonWinnersMode': seasonWinnersMode,
                'rules.seasonDistribution': effectiveSeasonDistribution,
                fplLeagueId: fplLeagueId ? Number(fplLeagueId) : null,
                coAdminId: coAdminId || null,
                chairmanPhone: chairmanPhone || null
            });
            localStorage.setItem('chairmanAvatarSeed', avatarSeed);
            setToast({ message: 'League rules updated successfully!', type: 'success' });
            // Re-lock after save
            setIsFinancialsLocked(true);
        } catch (error) {
            setToast({ message: 'Could not save league settings.', type: 'error' });
            console.error(error);
        } finally {
            setIsSavingAdmin(false);
            setTimeout(() => setToast(null), 4000);
        }
    };

    const handleUnlockFinancials = (e: React.FormEvent) => {
        e.preventDefault();
        scrollPageTop();
        setShowWarningModal(true);
        window.setTimeout(scrollPageTop, 0);
        window.setTimeout(scrollPageTop, 120);
    };

    useEffect(() => {
        if (showWarningModal) {
            scrollPageTop();
            const t1 = window.setTimeout(scrollPageTop, 0);
            const t2 = window.setTimeout(scrollPageTop, 120);
            return () => {
                window.clearTimeout(t1);
                window.clearTimeout(t2);
            };
        }
    }, [showWarningModal]);

    const handleSaveAdmin = (e: React.FormEvent) => {
        e.preventDefault();
        confirmAdminSave();
    };

    const handleShare = () => {
        const link = `https://our-app.com/join?code=${inviteCode}`;
        const text = `Join my Fantasy Chama. Tap the link and enter your M-Pesa number: ${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleCopy = () => {
        const link = `https://our-app.com/join?code=${inviteCode}`;
        navigator.clipboard.writeText(link);
        setToast({ message: 'Invite link copied to clipboard!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
    };

    const handleToggleActive = async (memberId: string, currentStatus: boolean) => {
        if (!activeLeagueId) return;
        try {
            await toggleMemberActiveStatus(activeLeagueId, memberId, !currentStatus);
            setToast({ message: `Member ${currentStatus ? 'deactivated' : 'reactivated'} successfully.`, type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: 'Failed to update member status.', type: 'error' });
        }
    };

    const renderActiveMembersStrip = (extraClassName = '') => (
        <div className={clsx(
            "fc-active-members-card fc-card bg-[#161d24] border border-white/5 rounded-[2rem] p-5 md:p-6 relative overflow-hidden",
            extraClassName
        )}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-1 text-white">
                        <Users className="w-5 h-5 text-[#10B981]" /> Active Members
                    </h2>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Live League Directory</p>
                </div>
                <span className="bg-[#0b1014] text-white border border-white/10 px-3 py-1 rounded-lg text-sm font-black shadow-inner">
                    {members.length}
                </span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {[...members]
                    .sort((a, b) => {
                        const aInactive = a.isActive === false ? 1 : 0;
                        const bInactive = b.isActive === false ? 1 : 0;
                        if (aInactive !== bInactive) return aInactive - bInactive;
                        return String(a.displayName || '').localeCompare(String(b.displayName || ''));
                    })
                    .map(member => {
                    const memberId = String(member.id || '');
                    const isActive = member.isActive !== false;
                    const isChairman = !!chairmanId && memberId === String(chairmanId);
                    const isValidCoChair = !!coAdminId
                        && memberId === String(coAdminId)
                        && !isChairman
                        && isActive
                        && (member.role === 'co-chair' || member.role === 'admin');
                    return (
                        <div key={memberId || `member-${member.displayName}`} className="fc-active-member-tile group relative flex-shrink-0 w-24 h-24 rounded-2xl border border-white/10 bg-[#0f151a] px-2 py-2.5 flex flex-col items-center justify-center gap-1.5">
                            <div className={clsx("w-10 h-10 rounded-full bg-gradient-to-b from-[#1c272c] to-[#0b1014] p-0.5 shadow-lg border border-white/5 group-hover:border-[#10B981]/50 transition-all",
                                !isActive && "opacity-30 grayscale"
                            )}>
                                <img
                                    src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(member as any).avatarSeed || member.displayName}&backgroundColor=transparent`}
                                    alt={member.displayName}
                                    className="w-full h-full rounded-full object-cover bg-[#161d24]"
                                />
                            </div>
                            <div className="text-center flex flex-col items-center gap-1 w-full">
                                <span className={clsx("text-[10px] font-bold block w-full px-1 overflow-hidden text-ellipsis whitespace-nowrap", !isActive ? "text-gray-500 line-through" : "text-white")}>{member.displayName}</span>
                                <div className="flex flex-col items-center gap-1 min-h-5 justify-start">
                                    {isChairman && (
                                        <span className="bg-[#FBBF24]/10 text-[#FBBF24] text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-[#FBBF24]/30 flex items-center gap-1">
                                            <ShieldAlert className="w-2.5 h-2.5" /> Chairman
                                        </span>
                                    )}
                                    {isValidCoChair && (
                                        <span className="bg-[#3B82F6]/10 text-[#3B82F6] text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black border border-[#3B82F6]/30 flex items-center gap-1">
                                            <ShieldCheck className="w-2.5 h-2.5" /> Co-Chair
                                        </span>
                                    )}
                                    {!isChairman && !isValidCoChair && (
                                        <span className={clsx("text-[9px] font-black uppercase tracking-widest block",
                                            !isActive ? "text-gray-600" : (member.hasPaid ? "text-[#10B981]" : "text-red-500")
                                        )}>
                                            {!isActive ? "Inactive" : (member.hasPaid ? "Funded" : "Red Zone")}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {isAdminView && memberId !== activeUserId && (
                                <button
                                    onClick={() => handleToggleActive(memberId, isActive)}
                                    className="absolute -top-1 -right-1 bg-[#161d24] border border-white/10 rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                                    title={isActive ? "Deactivate User" : "Reactivate User"}
                                >
                                    {isActive ? <UserMinus className="w-3 h-3 text-red-400" /> : <UserPlus className="w-3 h-3 text-[#10B981]" />}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="fc-profile-page min-h-[100dvh] p-5 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white relative overflow-hidden bg-transparent">
            <div className="absolute inset-0 pointer-events-none opacity-75">
                <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-emerald-500/12 blur-3xl" />
                <div className="absolute bottom-0 right-[4%] h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
            </div>
            <div className="max-w-6xl mx-auto space-y-10">
                <Header role={role || 'member'} title="Profile & Settings" subtitle="Identity, League Controls & Payout Configuration" />

                <section className="fc-card rounded-3xl border border-[#FBBF24]/20 bg-gradient-to-br from-[#FBBF24]/12 via-[#161d24] to-[#161d24] p-5 md:p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FBBF24]">Profile & Settings</p>
                    <h1 className="text-2xl md:text-3xl font-black text-white mt-2">Member Identity and League Controls</h1>
                    <p className="text-sm text-gray-300 mt-2 max-w-3xl">
                        A transparent control surface for personal profile details, governance access, and payout configuration history across your league.
                    </p>
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                    <div className={clsx(
                        "flex flex-col gap-4",
                        isAdminView ? 'xl:col-span-5' : 'xl:col-span-6'
                    )}>
                    {/* Member View (Personal Settings) */}
                    <div className={clsx(
                        "fc-profile-details-card fc-card border p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col transition-all duration-500",
                        !hasPaid && !isAdminView
                            ? 'bg-red-950/40 border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.08)]'
                            : 'bg-[#161d24] border-white/5'
                    )}>
                        {/* Red Zone banner */}
                        {!hasPaid && !isAdminView && (
                            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-5 text-red-400 text-xs font-bold uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                Red Zone — Contribution Outstanding
                            </div>
                        )}
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-white">
                                    <User className="w-5 h-5 text-[#10B981]" /> Personal Details
                                </h2>
                                <p className="text-[11px] text-gray-400 font-medium mt-1 max-w-xl leading-relaxed">
                                    Update the member identity that powers invites, payouts, and FPL matching.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 items-stretch">
                            <div className="flex flex-col items-center justify-start gap-2.5 pt-1">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1b2b22] to-[#101613] p-1 shadow-xl border border-white/10">
                                    <img
                                        src={`https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed}&backgroundColor=transparent`}
                                        alt="Avatar"
                                        className="w-full h-full rounded-full object-cover bg-[#0b1014]"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
                                    className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 px-2.5 py-1.5 rounded-lg hover:bg-[#10B981]/20 transition-colors border border-[#10B981]/20 text-center leading-tight"
                                >
                                    Generate New Avatar
                                </button>
                            </div>

                            <form onSubmit={handleSaveMember} className="grid grid-cols-1 gap-3.5 items-start w-full">
                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-widest">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all outline-none font-medium placeholder:text-gray-600"
                                        placeholder="Enter your Display Name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-widest">
                                        M-Pesa Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all outline-none font-medium placeholder:text-gray-600"
                                        placeholder="e.g. 254700..."
                                    />
                                    <p className="text-[10px] text-[#10B981] font-medium mt-1.5 leading-relaxed">Essential for automated STK pushes and payouts.</p>
                                </div>

                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-widest">
                                        Link FPL Team
                                    </label>
                                    {isFetchingFpl ? (
                                        <div className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-gray-500 italic">
                                            Syncing with Fantasy Premier League Server...
                                        </div>
                                    ) : fplStandings.length > 0 ? (
                                        <select
                                            value={fplTeamName}
                                            onChange={(e) => setFplTeamName(e.target.value)}
                                            className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all outline-none font-medium text-left appearance-none"
                                        >
                                            <option value="" disabled className="text-gray-500">Select your actual FPL Team</option>
                                            {fplStandings.map((team: any) => (
                                                <option key={team.entry} value={team.entry}>
                                                    {team.entry_name} — (Mgr: {team.player_name})
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={fplTeamName}
                                            onChange={(e) => setFplTeamName(e.target.value)}
                                            className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-gray-500 outline-none font-medium cursor-not-allowed opacity-60"
                                            placeholder="League Standings unavailable."
                                            disabled
                                        />
                                    )}
                                    <p className="text-[10px] text-gray-400 font-medium mt-1.5 leading-relaxed">
                                        Resolves FPL vs M-Pesa name mismatches perfectly.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-widest flex items-center gap-1.5">
                                        <Mail className="w-3 h-3" /> Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={userEmail}
                                        disabled
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3 px-4 text-sm text-gray-500 outline-none font-medium cursor-not-allowed opacity-60"
                                        placeholder="Loading..."
                                    />
                                    <p className="text-[10px] text-gray-600 font-medium mt-1.5 leading-relaxed">Managed by Firebase Auth. Cannot be changed here.</p>
                                </div>

                                    <button
                                        type="submit"
                                        disabled={isSavingMember}
                                        className="w-full bg-[#10B981] hover:bg-[#10B981]/80 text-[#0b1014] font-bold rounded-xl py-3.5 transition-colors mt-1 flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                    >
                                    {isSavingMember ? 'Saving...' : 'Save Changes'}
                                </button>
                            </form>
                        </div>
                    </div>
                    {!isAdminView && renderActiveMembersStrip()}
                    {isAdminView && renderActiveMembersStrip('hidden xl:block')}
                    </div>

                    {/* Admin View (League Command & Invite Hub) */}
                    {isAdminView && (
                        <div className="fc-card xl:col-span-7 bg-[#161d24] border border-[#FBBF24]/20 p-5 rounded-[2rem] relative overflow-hidden flex flex-col">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FBBF24] blur-[100px] opacity-10 transform translate-x-10 -translate-y-10"></div>

                            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                <Trophy className="w-5 h-5 text-[#FBBF24]" /> League Settings
                            </h2>
                            <p className="text-[11px] text-gray-400 mb-6 max-w-2xl">
                                Configure the financial engine, co-chair permissions, and invite access with changes tracked in your operations history.
                            </p>

                            {/* Invite Hub Section */}
                            <div className="bg-[#0b1014] border border-white/5 rounded-2xl p-4 mb-5 shadow-inner">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Share Invite</h3>
                                    <span className="px-2 py-1 bg-[#10B981]/10 text-[#10B981] text-[9px] uppercase font-bold tracking-widest rounded border border-[#10B981]/20">Active</span>
                                </div>
                                <div className="text-center mb-4">
                                    <span className="text-4xl font-black text-[#FBBF24] tracking-widest block mb-1">{inviteCode || '------'}</span>
                                    <p className="text-xs text-gray-500 font-medium tracking-wide">Unique access code for your league.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleCopy} className="flex items-center justify-center gap-2 bg-[#161d24] hover:bg-white/5 text-white font-bold py-3.5 rounded-xl border border-white/5 transition-colors text-sm shadow-md">
                                        <Copy className="w-4 h-4 text-gray-400" /> Copy
                                    </button>
                                    <button onClick={handleShare} className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3.5 rounded-xl shadow-[0_0_15px_rgba(37,211,102,0.3)] transition-colors text-sm">
                                        <Share2 className="w-4 h-4" /> Share
                                    </button>
                                </div>
                            </div>

                            {/* Rule Modification Form */}
                            <form onSubmit={handleSaveAdmin} className="space-y-4 flex-1 flex flex-col justify-end">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                            Gameweek Stake (KES)
                                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        min="100"
                                        disabled={isFinancialsLocked}
                                        value={gameweekStake}
                                        onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-4 text-sm font-bold text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                            FPL League ID
                                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                                        </label>
                                    </div>
                                    <input
                                        type="text"
                                        disabled={isFinancialsLocked}
                                        value={fplLeagueId}
                                        onChange={(e) => {
                                            let val = e.target.value.trim();
                                            const match = val.match(/leagues\/(\d+)\/standings/);
                                            if (match && match[1]) val = match[1];
                                            setFplLeagueId(val.replace(/\D/g, ''));
                                        }}
                                        placeholder="e.g. 123456 or paste Standings URL"
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-4 text-sm font-bold text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1.5 font-medium leading-relaxed">
                                        Found in your official FPL League URL.<br />Paste the full link: <span className="text-gray-300 bg-white/5 px-1 py-0.5 rounded">fantasy.premierleague.com/leagues/123456/standings</span> and we will auto-extract the ID.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Pochi Receiving Number</label>
                                    <input
                                        type="tel"
                                        value={chairmanPhone}
                                        onChange={(e) => setChairmanPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                                        placeholder="e.g. 0712345678"
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-4 text-sm font-bold text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-all outline-none"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 font-medium">This number receives Pochi/cash payout references and fallback remittances.</p>
                                </div>

                                {/* Co-Chair Designation */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                            Designate Co-Chair
                                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                                        </label>
                                    </div>
                                    <select
                                        disabled={isFinancialsLocked}
                                        value={coAdminId}
                                        onChange={(e) => setCoAdminId(e.target.value)}
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-4 text-sm font-bold text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                                    >
                                        <option value="">-- No Co-Chair Selected --</option>
                                        {members.filter(m => m.id !== activeUserId).map(m => (
                                            <option key={m.id} value={m.authUid || m.id}>{m.displayName} {m.authUid ? '' : '(Not Logged In)'}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-gray-400 mt-1 font-medium">Grants this member permission to approve payouts and edit rules.</p>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                            Distribution Split Logic
                                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                                        </label>
                                        <span className="text-xs font-black text-[#FBBF24] px-2 py-1 bg-[#FBBF24]/10 rounded border border-[#FBBF24]/20">{weeklyPrizePercent} / {100 - weeklyPrizePercent}</span>
                                    </div>

                                    <div className="relative pt-2 pb-6">
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            disabled={isFinancialsLocked}
                                            value={weeklyPrizePercent}
                                            onChange={(e) => setWeeklyPrizePercent(Number(e.target.value))}
                                            className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[4px] [&::-webkit-slider-thumb]:border-[#161d24] relative z-10 shadow-lg"
                                            style={{ background: `linear-gradient(to right, #FBBF24 ${weeklyPrizePercent}%, #10B981 ${weeklyPrizePercent}%)` }}
                                        />
                                    </div>

                                    <div className="flex justify-between text-[10px] text-gray-500 mt-[-10px] font-bold uppercase tracking-widest px-1">
                                        <span className="text-[#FBBF24]">Weekly Pot</span>
                                        <span className="text-[#10B981]">Season Vault</span>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                            End of Season Winners
                                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            { key: 'top1', label: 'Top 1' },
                                            { key: 'top3', label: 'Top 3' },
                                            { key: 'top5', label: 'Top 5' },
                                            { key: 'custom', label: 'Custom' },
                                        ].map((option) => (
                                            (() => {
                                                const neededMembers = option.key === 'top5' ? 5 : option.key === 'top3' ? 3 : 1;
                                                const isOptionLockedBySize = option.key !== 'custom' && activeMembersCount < neededMembers;
                                                const isDisabled = isFinancialsLocked || isOptionLockedBySize;
                                                return (
                                            <button
                                                key={option.key}
                                                type="button"
                                                disabled={isDisabled}
                                                onClick={() => {
                                                    if (isOptionLockedBySize) {
                                                        setToast({ message: `Need at least ${neededMembers} active members for ${option.label}.`, type: 'error' });
                                                        setTimeout(() => setToast(null), 2500);
                                                        return;
                                                    }
                                                    const mode = option.key as 'top1' | 'top3' | 'top5' | 'custom';
                                                    setSeasonWinnersMode(mode);
                                                    if (mode === 'top1') setSeasonWinnersCount(1);
                                                    if (mode === 'top3') setSeasonWinnersCount(3);
                                                    if (mode === 'top5') setSeasonWinnersCount(5);
                                                }}
                                                className={clsx(
                                                    "py-3 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                                    seasonWinnersMode === option.key
                                                        ? "bg-[#22c55e]/20 border-[#22c55e]/50 text-[#22c55e]"
                                                        : "bg-[#161d24] border-white/5 text-gray-400 hover:bg-white/[0.02]"
                                                )}
                                                title={isOptionLockedBySize ? `Requires at least ${neededMembers} active members` : undefined}
                                            >
                                                {option.label}
                                            </button>
                                                );
                                            })()
                                        ))}
                                    </div>

                                    <div className="fc-custom-winners-panel mt-3 space-y-3 rounded-xl border border-white/10 bg-[#0b1014]/60 p-3.5">
                                        {seasonWinnersMode === 'custom' && (
                                            <>
                                                <div>
                                                    <label className="fc-custom-winners-label text-[10px] font-black uppercase tracking-widest text-gray-500">Custom winners</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={maxAllowedWinners}
                                                        disabled={isFinancialsLocked}
                                                        value={normalizedCustomWinnerCount}
                                                        onChange={(e) => setCustomWinnerCount(Math.max(1, Math.min(maxAllowedWinners, Number(e.target.value) || 1)))}
                                                        className="fc-custom-winners-count mt-1.5 w-full bg-[#161d24] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                                                    />
                                                    <p className="fc-custom-winners-meta text-[9px] text-gray-500 mt-1">Max now: {maxAllowedWinners} (cannot exceed active members).</p>
                                                </div>

                                                <div className="fc-custom-winners-rows space-y-2">
                                                    {Array.from({ length: normalizedCustomWinnerCount }, (_, idx) => (
                                                        <div key={`profile-ratio-${idx}`} className="flex items-center gap-2">
                                                            <span className="fc-custom-winners-rank w-12 text-[10px] font-black uppercase tracking-widest text-gray-500">#{idx + 1}</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                disabled={isFinancialsLocked}
                                                                value={customWinnerRatios[idx] || '0'}
                                                                onChange={(e) => {
                                                                    const next = [...customWinnerRatios];
                                                                    next[idx] = e.target.value;
                                                                    setCustomWinnerRatios(next);
                                                                }}
                                                                className="fc-custom-winners-input flex-1 bg-[#161d24] border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                                                            />
                                                            <span className="fc-custom-winners-percent text-[10px] font-black text-gray-500">%</span>
                                                            <span className="w-16 text-right text-[10px] font-bold text-[#FBBF24]">{effectiveSeasonDistribution[idx] || 0}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                        <div className="fc-custom-winners-applied rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Applied ratios</p>
                                            <p className="text-[10px] text-[#FBBF24] font-bold mt-1">{effectiveSeasonDistribution.map((ratio, idx) => `#${idx + 1} ${ratio}%`).join(' · ')}</p>
                                            {seasonWinnersMode === 'custom' && (
                                                <p className="text-[9px] text-gray-500 mt-1">Raw input: {rawCustomRatioSummary || 'n/a'}</p>
                                            )}
                                        </div>
                                        {seasonWinnersMode === 'custom' && (
                                            <p className="fc-custom-winners-footnote text-[9px] text-gray-500">Raw custom inputs are auto-normalized to total 100%.</p>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-2">Stored baseline winner count: Top {seasonWinnersCount}.</p>
                                </div>

                                {isFinancialsLocked ? (
                                    <button
                                        type="button"
                                        onClick={handleUnlockFinancials}
                                        className="w-full bg-[#0b1014] hover:bg-[#1a232b] text-gray-400 hover:text-white border border-white/5 font-bold rounded-xl py-4 flex items-center justify-center gap-2 transition-colors mt-auto text-sm"
                                    >
                                        <Unlock className="w-4 h-4" /> Unlock to Edit Rules
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={isSavingAdmin}
                                        className="w-full bg-[#FBBF24] hover:bg-[#eab308] text-[#0b1014] font-black rounded-xl py-4 transition-colors mt-auto text-sm shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                                    >
                                        {isSavingAdmin ? 'Updating Logistics...' : 'Confirm Financial Overhaul'}
                                    </button>
                                )}
                            </form>

                        </div>
                    )}
                    {isAdminView && renderActiveMembersStrip('order-3 xl:hidden')}

                </div>
            </div>

            {/* Warning Modal */}
            {
                showWarningModal && typeof document !== 'undefined' && createPortal(
                    <div className="fc-warning-backdrop fixed inset-0 bg-[#0b1014]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                        <div className="fc-warning-modal fc-card bg-[#161d24] border border-red-500/20 max-w-md w-full rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4 text-red-500">
                                <AlertTriangle className="w-8 h-8" />
                                <h3 className="text-xl font-black tracking-tight">Modify Core Logistics?</h3>
                            </div>
                            <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                                Altering the financial rules mid-season recalculates all projected vaults and weekly payouts. Are you sure you wish to unlock these controls?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowWarningModal(false)}
                                    className="fc-warning-cancel flex-1 px-4 py-3 bg-[#0b1014] text-white hover:bg-white/5 rounded-xl font-bold transition-colors text-sm border border-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowWarningModal(false);
                                        setIsFinancialsLocked(false);
                                    }}
                                    className="fc-warning-confirm flex-1 px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-all text-sm border border-red-500/20"
                                >
                                    Yes, Unlock
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* Toast Notification */}
            <div className={clsx(
                "fixed top-4 right-4 left-auto w-[calc(100vw-2rem)] md:w-96 p-4 rounded-2xl shadow-2xl transition-all duration-300 transform flex items-start gap-4 z-50 fc-inline-toast",
                toast ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none",
                toast?.type === 'success' ? "fc-inline-toast-success" : "fc-inline-toast-error"
            )}>
                {toast?.type === 'success' ? <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />}
                <div>
                    <h4 className="font-extrabold text-base mb-1">{toast?.type === 'success' ? 'Success' : 'Error'}</h4>
                    <p className="font-medium text-sm leading-tight opacity-90">{toast?.message}</p>
                </div>
            </div>

        </div >
    );
}
