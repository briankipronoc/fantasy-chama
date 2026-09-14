import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Activity, ShieldCheck, Trophy, Users, AlertTriangle, Lock, Unlock, UserPlus, UserMinus, ShieldAlert, User, Mail, Copy, Share2, RefreshCw, Trash2, Fingerprint, Key, HelpCircle, BookOpen, X, Search, CheckCircle2 } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { db, auth } from '../firebase';
import { doc, updateDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';
import UserAvatar from '../components/UserAvatar';
import DocsModal from '../components/DocsModal';

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
    const [playMode, setPlayMode] = useState<'pot' | 'sidebets_only'>('pot');
    const [isSavingMember, setIsSavingMember] = useState(false);
    const [fplStandings, setFplStandings] = useState<any[]>([]);
    const [isFetchingFpl, setIsFetchingFpl] = useState(false);

    const [leagueName, setLeagueName] = useState('');
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
    const [pendingPhoneMap, setPendingPhoneMap] = useState<Record<string, string>>({});
    const [isSavingPendingPhone, setIsSavingPendingPhone] = useState<string | null>(null);
    const [showPendingOnboarding, setShowPendingOnboarding] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeletingMember, setIsDeletingMember] = useState(false);
    const [showDocsModal, setShowDocsModal] = useState(false);
    const [onboardingSearch, setOnboardingSearch] = useState('');

    const isMemberFunded = (m: any) =>
        m.hasPaid === true || (gameweekStake > 0 && (m.walletBalance || 0) >= gameweekStake);
    const isMemberPending = (m: any) =>
        m.isActive !== false && !isMemberFunded(m) && (m.isPending === true || (!m.phone && !m.phoneNumber));
    const activeMembersCount = members.filter((member) => member.isActive !== false && !isMemberPending(member)).length;
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
        let unsubscribeLeague = () => { };
        if (activeLeagueId) {
            unsubscribeMembers = listenToLeagueMembers(activeLeagueId);
            
            const docRef = doc(db, 'leagues', activeLeagueId);
            unsubscribeLeague = onSnapshot(docRef, async (docSnap) => {
                if (!docSnap.exists()) return;

                const data = docSnap.data();
                setLeagueName(data.name || data.leagueName || '');
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
                        const res = await fetch(`/fpl-api/leagues-classic/${fplId}/standings/`);
                        if (res.ok) {
                            const payload = await res.json();
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
            }, (err) => {
                console.warn('[profile] league settings sync failed:', err);
            });
        }
        return () => {
            try { unsubscribeMembers(); } catch (err) {
                console.warn('[profile] member listener cleanup failed:', err);
            }
            try { unsubscribeLeague(); } catch (err) {
                console.warn('[profile] league listener cleanup failed:', err);
            }
        };
    }, [activeLeagueId, listenToLeagueMembers, role]);

    // Listen to fplLeagueId changes to auto-sync FPL members
    useEffect(() => {
        if (!fplLeagueId || !activeLeagueId || role !== 'admin') return;
        const delayDebounceFn = setTimeout(async () => {
            try {
                setIsFetchingFpl(true);
                const res = await fetch(`/fpl-api/leagues-classic/${fplLeagueId}/standings/`);
                if (res.ok) {
                    const payload = await res.json();
                    if (payload.standings && payload.standings.results) {
                        const results = payload.standings.results;
                        setFplStandings(results);

                        let mergedCount = 0;
                        for (const result of results) {
                            const fplTeamId = String(result.entry);
                            const existingMember = members.find((m: any) => 
                                String(m.fplTeamId) === fplTeamId || 
                                String(m.secondFplTeamId) === fplTeamId
                            );
                            
                            if (!existingMember) {
                                const newMemberRef = doc(collection(db, 'leagues', activeLeagueId, 'memberships'));
                                await setDoc(newMemberRef, {
                                    displayName: result.player_name,
                                    fplTeamName: result.entry_name,
                                    fplTeamId: fplTeamId,
                                    isPending: true,
                                    hasPaid: false,
                                    walletBalance: 0,
                                    paymentStreak: 0,
                                    role: 'member',
                                    joinedAt: new Date().toISOString(),
                                });
                                mergedCount++;
                            }
                        }
                        if (mergedCount > 0) {
                            toast.success(`Imported ${mergedCount} new members from FPL!`);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to auto-sync FPL Teams:', err);
            } finally {
                setIsFetchingFpl(false);
            }
        }, 1500);

        return () => clearTimeout(delayDebounceFn);
    }, [fplLeagueId, activeLeagueId, role, members]);

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
                setPlayMode((currentMember as any).playMode || 'pot');
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
        

        try {
            // Using members[0].id for MVP if activeUserId is a fallback
            const targetMemberId = members.find(m => m.id === activeUserId)?.id || members[0]?.id;

            if (targetMemberId) {
                const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', targetMemberId);
                const updates: any = {
                    displayName: displayName,
                    phone: phoneNumber,
                    avatarSeed: avatarSeed,
                    playMode: playMode,
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
                const currentMember = members.find(m => m.id === targetMemberId);
                const currentBal = Number(currentMember?.walletBalance || 0);
                if (playMode === 'pot' && gameweekStake > 0 && currentBal < gameweekStake) {
                    toast.success('Profile saved! Remember to fund your wallet to activate pot eligibility.', { duration: 4500 });
                } else {
                    toast.success('Profile updated successfully!');
                }
            }
        } catch (error) {
            toast.error('Could not save profile changes.');
            console.error(error);
        } finally {
            setIsSavingMember(false);
            
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
        

        try {
            const leagueRef = doc(db, 'leagues', activeLeagueId);
            const updates: any = {
                gameweekStake: Number(gameweekStake),
                'rules.weekly': Number(weeklyPrizePercent),
                'rules.vault': 100 - Number(weeklyPrizePercent),
                'rules.seasonWinnersCount': effectiveSeasonWinnersCount,
                'rules.seasonWinnersMode': seasonWinnersMode,
                'rules.seasonDistribution': effectiveSeasonDistribution,
                fplLeagueId: fplLeagueId ? Number(fplLeagueId) : null,
                coAdminId: coAdminId || null,
                chairmanPhone: chairmanPhone || null
            };
            if (leagueName.trim()) {
                updates.name = leagueName.trim();
                updates.leagueName = leagueName.trim();
            }
            await setDoc(leagueRef, updates, { merge: true });
            
            // Sync zustand store immediately for responsive header & tabs
            const currentLeague = useStore.getState().league;
            if (currentLeague) {
                useStore.getState().setLeagueSettings({
                    ...currentLeague,
                    name: leagueName.trim() || currentLeague.name,
                });
            }

            localStorage.setItem('chairmanAvatarSeed', avatarSeed);
            toast.success('League rules & name updated successfully!');
            // Re-lock after save
            setIsFinancialsLocked(true);
        } catch (error) {
            toast.error('Could not save league settings.');
            console.error(error);
        } finally {
            setIsSavingAdmin(false);
            
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
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') setShowWarningModal(false);
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => {
                window.clearTimeout(t1);
                window.clearTimeout(t2);
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [showWarningModal]);

    const handleSaveAdmin = (e: React.FormEvent) => {
        e.preventDefault();
        confirmAdminSave();
    };

    const handleShare = () => {
        const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://fantasy-chama.vercel.app';
        const link = `${origin}/login?code=${inviteCode}`;
        const text = `⚽ Join our FPL Chama (${leagueName || 'Tentshakers FC'})!\nLeague Code: *${inviteCode}*\nUse your phone number and the code to join.\nJoin link: ${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleCopy = () => {
        const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://fantasy-chama.vercel.app';
        const link = `${origin}/login?code=${inviteCode}`;
        const text = `⚽ Join our FPL Chama (${leagueName || 'Tentshakers FC'})!\nLeague Code: *${inviteCode}*\nUse your phone number and the code to join.\nJoin link: ${link}`;
        navigator.clipboard.writeText(text);
        toast.success(`Invite message copied to clipboard!`);
    };

    const handleToggleActive = async (memberId: string, currentStatus: boolean) => {
        if (!activeLeagueId) return;
        try {
            await toggleMemberActiveStatus(activeLeagueId, memberId, !currentStatus);
            haptics.success();
            toast.success(`Member ${currentStatus ? 'deactivated' : 'reactivated'} successfully.`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to update member status.');
        }
    };

    const handleDeleteMember = (memberId: string, memberName: string) => {
        setMemberToDelete({ id: memberId, name: memberName });
    };

    const executeDeleteMember = async () => {
        if (!activeLeagueId || !memberToDelete) return;
        setIsDeletingMember(true);
        try {
            const { doc: docFn, deleteDoc: deleteDocFn } = await import('firebase/firestore');
            await deleteDocFn(docFn(db, 'leagues', activeLeagueId, 'memberships', memberToDelete.id));
            toast.success(`Removed ${memberToDelete.name} from league.`);
            setMemberToDelete(null);
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to delete member: ' + (err?.message || 'Error'));
        } finally {
            setIsDeletingMember(false);
        }
    };

    const renderActiveMembersStrip = (extraClassName = '') => {
        // Funded members are considered active regardless of phone status
        // Only show as "Pending Onboarding" if they have no phone AND are not funded
        const pendingMembers = members.filter((m: any) => isMemberPending(m));
        const filteredPendingMembers = pendingMembers.filter((m: any) => {
            if (!onboardingSearch.trim()) return true;
            const q = onboardingSearch.toLowerCase();
            return (m.displayName || '').toLowerCase().includes(q) ||
                   (m.fplTeamName || '').toLowerCase().includes(q);
        });
        const directoryMembers = members.filter((m: any) => !isMemberPending(m));
        return (
        <div className={clsx(
            "fc-active-members-card fc-card bg-[#161d24] border border-white/5 rounded-[2rem] p-5 md:p-6 relative overflow-hidden",
            extraClassName
        )}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-1 text-white">
                        <Users className="w-5 h-5 text-[#10B981]" /> Active Members
                    </h2>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Chama Members</p>
                </div>
                <div className="flex items-center gap-2">
                    {pendingMembers.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                haptics.selection();
                                setShowPendingOnboarding(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.15)] group active:scale-95"
                            title="Click to view and onboard pending FPL members"
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            <span>{pendingMembers.length} Pending Onboarding</span>
                        </button>
                    )}
                    <span className="bg-[#0b1014] text-white border border-white/10 px-3 py-1 rounded-lg text-sm font-black shadow-inner">
                        {activeMembersCount}
                    </span>
                </div>
            </div>

            {/* Centered Interactive Modal: FPL Sync • Pending Onboarding */}
            {showPendingOnboarding && pendingMembers.length > 0 && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setShowPendingOnboarding(false)}
                >
                    <div
                        className="relative w-full max-w-xl bg-[#0c1218] border border-blue-500/30 rounded-3xl shadow-2xl p-5 md:p-6 my-auto flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                                <div>
                                    <h3 className="text-sm md:text-base font-black text-white">
                                        🔗 FPL Sync • Pending Onboarding
                                    </h3>
                                    <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider mt-0.5">
                                        {pendingMembers.length} Members to Activate
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                                >
                                    <Share2 className="w-3 h-3" /> Share Code ({inviteCode || '------'})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPendingOnboarding(false)}
                                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-slate-300 my-3 font-medium leading-relaxed shrink-0">
                            Add M-Pesa phone numbers to imported FPL players to complete onboarding and activate them on the league ledger. Or share the code so members can join directly.
                        </p>

                        {/* Search Bar for Member Matching */}
                        <div className="relative mb-3 shrink-0">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={onboardingSearch}
                                onChange={(e) => setOnboardingSearch(e.target.value)}
                                placeholder="Search member name or FPL team..."
                                className="w-full pl-10 pr-12 py-2.5 bg-[#141b22] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none transition-all"
                            />
                            {onboardingSearch && (
                                <button
                                    type="button"
                                    onClick={() => setOnboardingSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-white uppercase font-bold"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Scrollable Members List */}
                        <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                            {filteredPendingMembers.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-xs">
                                    No pending members match "{onboardingSearch}"
                                </div>
                            ) : (
                                filteredPendingMembers.map((m: any) => (
                                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#141b22] border border-white/10 hover:border-blue-500/40 transition-all">
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                        <UserAvatar name={m.displayName} size="md" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-white break-words leading-tight">{m.displayName}</p>
                                            <p className="text-[11px] text-blue-300 font-semibold break-words mt-0.5">
                                                {m.fplTeamName || 'FPL Team'} <span className="text-slate-400">· Pending Phone</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                        <input
                                            type="tel"
                                            value={pendingPhoneMap[m.id] || m.phoneNumber || ''}
                                            onChange={e => setPendingPhoneMap(prev => ({ ...prev, [m.id]: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) }))}
                                            placeholder="07XXXXXXXX"
                                            className="flex-1 sm:w-36 bg-[#0c1218] border border-white/15 rounded-xl py-2 px-3 text-xs text-white font-mono focus:ring-1 focus:ring-blue-400 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const phone = pendingPhoneMap[m.id] || m.phoneNumber;
                                                if (!phone || phone.length < 9) {
                                                    toast.error('Enter a valid phone number (at least 9 digits)');
                                                    return;
                                                }
                                                setIsSavingPendingPhone(m.id);
                                                try {
                                                    const { doc: docFn, updateDoc: updateDocFn } = await import('firebase/firestore');
                                                    await updateDocFn(docFn(db, 'leagues', activeLeagueId!, 'memberships', m.id), {
                                                        phoneNumber: phone,
                                                        phone: phone,
                                                        isPending: false,
                                                        isActive: true,
                                                    });
                                                    haptics.success();
                                                    toast.success(`${m.displayName} activated!`);
                                                } catch (_e) {
                                                    toast.error('Failed to save. Try again.');
                                                } finally {
                                                    setIsSavingPendingPhone(null);
                                                }
                                            }}
                                            disabled={isSavingPendingPhone === m.id || !((pendingPhoneMap[m.id] || m.phoneNumber)?.length >= 9)}
                                            className="shrink-0 px-3.5 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                        >
                                            {isSavingPendingPhone === m.id ? (
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                '✓ Activate'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )))}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className={clsx(
                "gap-3 pb-2 custom-scrollbar",
                directoryMembers.length <= 6
                    ? "flex flex-wrap items-center"
                    : "grid grid-rows-2 sm:grid-rows-3 grid-flow-col overflow-x-auto auto-cols-max"
            )}>
                {[...directoryMembers]
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
                            <UserAvatar name={member.displayName} size="md" />
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
                                <div className="absolute -top-1 -right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button
                                        onClick={() => handleToggleActive(memberId, isActive)}
                                        className="bg-[#161d24] border border-white/10 rounded-full p-1 shadow-md hover:bg-white/10"
                                        title={isActive ? "Deactivate User" : "Reactivate User"}
                                    >
                                        {isActive ? <UserMinus className="w-2.5 h-2.5 text-amber-400" /> : <UserPlus className="w-2.5 h-2.5 text-[#10B981]" />}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteMember(memberId, member.displayName)}
                                        className="bg-[#161d24] border border-white/10 rounded-full p-1 shadow-md hover:bg-red-500/20 hover:border-red-500/40"
                                        title="Permanently remove user from league"
                                    >
                                        <Trash2 className="w-2.5 h-2.5 text-red-400" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

    return (
        <div className="fc-profile-page min-h-[100dvh] p-5 md:p-10 w-full animate-in fade-in duration-500 pb-6 lg:pb-8 font-sans text-white relative overflow-hidden bg-transparent">
            <div className="absolute inset-0 pointer-events-none opacity-75">
                <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-emerald-500/12 blur-3xl" />
                <div className="absolute bottom-0 right-[4%] h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
            </div>
            <div className="max-w-6xl mx-auto space-y-10">
                <Header role={role || 'member'} title="Profile & Settings" subtitle="Identity, League Controls & Payout Configuration" hideCountdown={true} />

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-6 items-start">
                    <div className={clsx(
                        "flex flex-col gap-4",
                        isAdminView ? 'xl:col-span-7' : 'xl:col-span-12'
                    )}>
                    {/* Member View (Personal Settings) */}
                    <div className={clsx(
                        "fc-profile-details-card fc-card border p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col transition-all duration-500",
                        !hasPaid && !isAdminView
                            ? 'bg-red-950/40 border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.08)]'
                            : 'bg-[#161d24] border-white/5'
                    )}>
                        {/* Phone missing banner - self-registration prompt */}
                        {!hasPaid && !isAdminView && (
                            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-5 text-red-400 text-xs font-bold uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                Red Zone — Contribution Outstanding
                            </div>
                        )}
                        {!phoneNumber && !isAdminView && (
                            <div className="flex items-start gap-3 bg-[#FBBF24]/8 border border-[#FBBF24]/25 rounded-xl p-3.5 mb-4">
                                <AlertTriangle className="w-4 h-4 text-[#FBBF24] flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[#FBBF24] font-bold text-xs mb-0.5">Phone number required</p>
                                    <p className="text-gray-400 text-[10px] leading-relaxed">Add your M-Pesa number below so the chairman can verify your payments and send you payouts.</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-white">
                                    <User className="w-5 h-5 text-[#10B981]" /> Personal Details
                                </h2>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium mt-1 max-w-xl leading-relaxed">
                                    Update the member identity that powers invites, payouts, and FPL matching.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 items-stretch">
                            <div className="flex flex-col items-center justify-start gap-2.5 pt-1">
                                <UserAvatar name={displayName || 'Manager'} size="xl" />
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
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                                        className="fc-input"
                                        placeholder="e.g. 0712345678"
                                    />
                                    {!phoneNumber ? (
                                        <p className="text-[10px] text-[#FBBF24] font-bold mt-1.5 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"></span> Required for payments and payouts
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-[#10B981] font-medium mt-1.5">Used for Pochi payments and M-Pesa payouts.</p>
                                    )}
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
                                    <p className="text-[10px] text-gray-600 dark:text-gray-400 font-medium mt-1.5 leading-relaxed">
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

                                {/* Participation Mode Selector */}
                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest flex items-center gap-1.5">
                                        <Trophy className="w-3 h-3 text-amber-400" /> Chama Participation Mode
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setPlayMode('pot')}
                                            className={clsx(
                                                "p-3 rounded-xl border text-left transition-all cursor-pointer",
                                                playMode === 'pot'
                                                    ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-sm"
                                                    : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-emerald-400">Weekly & Season Pot</span>
                                                {playMode === 'pot' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                            </div>
                                            <p className="text-[10px] text-gray-400 leading-snug">
                                                Active cash pot contender. Eligible for weekly & season prizes when wallet is funded.
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPlayMode('sidebets_only')}
                                            className={clsx(
                                                "p-3 rounded-xl border text-left transition-all cursor-pointer",
                                                playMode === 'sidebets_only'
                                                    ? "border-cyan-500/50 bg-cyan-500/10 text-white shadow-sm"
                                                    : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-cyan-400">Spectator Mode</span>
                                                {playMode === 'sidebets_only' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                                            </div>
                                            <p className="text-[10px] text-gray-400 leading-snug">
                                                Free system visibility. Play 1v1 side bets. Not enrolled in cash pot dues or payouts.
                                            </p>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSavingMember}
                                    className="w-full bg-[#10B981] hover:bg-[#10B981]/80 text-[#0b1014] font-bold rounded-xl py-3.5 transition-colors mt-1 flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
                                >
                                    {isSavingMember ? 'Saving...' : 'Save Changes'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Active Members / Chama Directory — Balanced in Column */}
                    {renderActiveMembersStrip('w-full')}

                    {isAdminView && (
                        <div className="fc-card w-full bg-gradient-to-br from-[#121920] to-[#0b1014] border border-emerald-500/20 p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col shadow-2xl">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[90px] pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-slate-500/10 blur-[90px] pointer-events-none"></div>
                            
                            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                                        <Activity className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h2 className="fc-frosty-title text-base font-black uppercase tracking-wider">
                                            Account & Session Details
                                        </h2>
                                        <p className="text-[10px] text-gray-500 font-medium">Your login credentials and league membership details</p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Active Session
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* Account ID */}
                                <div className="rounded-2xl border border-white/8 bg-black/30 p-3.5 flex flex-col justify-between hover:border-slate-400/30 transition-all">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                            <Fingerprint className="w-3.5 h-3.5 text-slate-400" /> Account ID
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded border border-slate-500/20">Session</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 bg-[#090d11] px-2.5 py-2 rounded-xl border border-white/5">
                                        <span className="text-xs font-mono font-bold text-slate-200">
                                            {auth.currentUser?.uid ? `•••${auth.currentUser.uid.slice(-6)}` : "None"}
                                        </span>
                                        {auth.currentUser?.uid && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(auth.currentUser?.uid || '');
                                                    toast.success('Account ID copied!');
                                                }}
                                                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
                                                title="Copy Account ID"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-2 font-medium">Your active authenticated user ID</p>
                                </div>

                                {/* Chairman ID */}
                                <div className="rounded-2xl border border-white/8 bg-black/30 p-3.5 flex flex-col justify-between hover:border-amber-500/30 transition-all">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Chairman ID
                                        </span>
                                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Primary</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 bg-[#090d11] px-2.5 py-2 rounded-xl border border-white/5">
                                        <span className="text-xs font-mono font-bold text-slate-200">
                                            {chairmanId ? `•••${chairmanId.slice(-6)}` : "None"}
                                        </span>
                                        {chairmanId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(chairmanId || '');
                                                    toast.success('Chairman ID copied!');
                                                }}
                                                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
                                                title="Copy Chairman ID"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-2 font-medium">League Chairman administrator ID</p>
                                </div>

                                {/* Co-Chair ID */}
                                <div className="rounded-2xl border border-white/8 bg-black/30 p-3.5 flex flex-col justify-between hover:border-blue-500/30 transition-all">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Co-Chair ID
                                        </span>
                                        <span className={clsx(
                                            "text-[9px] font-bold px-1.5 py-0.5 rounded border",
                                            coAdminId ? "text-blue-400 bg-blue-500/10 border-blue-500/20" : "text-gray-500 bg-white/5 border-white/10"
                                        )}>
                                            {coAdminId ? "Dual-Sign" : "Unset"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 bg-[#090d11] px-2.5 py-2 rounded-xl border border-white/5">
                                        <span className="text-xs font-mono font-bold text-slate-200">
                                            {coAdminId ? `•••${coAdminId.slice(-6)}` : "None"}
                                        </span>
                                        {coAdminId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(coAdminId || '');
                                                    toast.success('Co-Chair ID copied!');
                                                }}
                                                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
                                                title="Copy Co-Chair ID"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-2 font-medium">Secondary payout approver ID</p>
                                </div>

                                {/* Your Role */}
                                <div className="rounded-2xl border border-white/8 bg-black/30 p-3.5 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                            <Key className="w-3.5 h-3.5 text-emerald-400" /> Your Role
                                        </span>
                                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Verified</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 bg-[#090d11] px-2.5 py-2 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2 text-xs font-black">
                                            <span className={clsx(
                                                "px-2 py-0.5 rounded-lg border text-[11px]",
                                                chairmanId && auth.currentUser?.uid === chairmanId
                                                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                                    : "text-gray-500 border-transparent"
                                            )}>
                                                Chair
                                            </span>
                                            <span className="text-gray-600 font-normal">•</span>
                                            <span className={clsx(
                                                "px-2 py-0.5 rounded-lg border text-[11px]",
                                                coAdminId && auth.currentUser?.uid === coAdminId
                                                    ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                                                    : "text-gray-500 border-transparent"
                                            )}>
                                                Co-Admin
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-2 font-medium">Dual-governance permission status for this session</p>
                                </div>
                            </div>
                        </div>
                    )}
                    </div>

                    {/* Right Column: League Governance & Chama Guides */}
                    {isAdminView && (
                        <div className="xl:col-span-5 flex flex-col gap-4">
                            <div className="fc-card w-full bg-[#161d24] border border-amber-500/20 p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col shadow-2xl">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FBBF24] blur-[100px] opacity-10 transform translate-x-10 -translate-y-10"></div>

                            <h2 className="fc-frosty-title text-xl font-black flex items-center gap-2 mb-2">
                                <Trophy className="w-5 h-5 text-amber-400" /> League Governance
                            </h2>
                            <p className="text-xs text-slate-400 dark:text-gray-400 mb-5 max-w-2xl font-medium">
                                Configure the financial engine, league branding, co-chair permissions, and invite access.
                            </p>

                            {/* Invite Hub Section */}
                            <div className="bg-[#0b1014] border border-white/5 rounded-2xl p-4 mb-5 shadow-inner">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Share Invite Code</h3>
                                    <span className="px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] text-[9px] uppercase font-bold tracking-widest rounded border border-[#10B981]/20">Active</span>
                                </div>
                                <div className="text-center mb-3">
                                    <span className="text-4xl font-black text-amber-400 tracking-widest block mb-1">{inviteCode || '------'}</span>
                                    <p className="text-xs text-gray-400 font-medium">Share this code with players to join with their M-Pesa number.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleCopy} className="flex items-center justify-center gap-2 bg-[#161d24] hover:bg-white/5 text-white font-bold py-3 rounded-xl border border-white/10 transition-colors text-sm shadow-md">
                                        <Copy className="w-4 h-4 text-gray-400" /> Copy
                                    </button>
                                    <button onClick={handleShare} className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 rounded-xl shadow-[0_0_15px_rgba(37,211,102,0.3)] transition-colors text-sm">
                                        <Share2 className="w-4 h-4" /> Share
                                    </button>
                                </div>
                            </div>

                            {/* Rule Modification Form */}
                            <form onSubmit={handleSaveAdmin} className="space-y-4 flex-1 flex flex-col justify-end">
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                            League Name
                                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                                        </label>
                                    </div>
                                    <input
                                        type="text"
                                        disabled={isFinancialsLocked}
                                        value={leagueName}
                                        onChange={(e) => setLeagueName(e.target.value)}
                                        placeholder="e.g. Premier League 24/25"
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-2.5 px-4 text-sm font-bold text-white focus:ring-1 focus:ring-amber-400 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Clean sweep old season names like "Twende sana" to your current active league.</p>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
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
                                    <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-1.5 font-medium leading-relaxed">
                                        Found in your official FPL League URL.<br />Paste the full link: <span className="text-gray-600 dark:text-gray-300 bg-white/5 px-1 py-0.5 rounded">fantasy.premierleague.com/leagues/123456/standings</span> and we will auto-extract the ID.
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
                                    <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-1 font-medium">This number receives Pochi/cash payout references and fallback remittances.</p>
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
                                    <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-1 font-medium">Grants this member permission to approve payouts and edit rules.</p>
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
                                                        toast.error(`Need at least ${neededMembers} active members for ${option.label}.`);
                                                        
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
                                                        : "bg-[#161d24] border-white/5 text-gray-600 dark:text-gray-400 hover:bg-white/[0.02]"
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
                                        className="w-full bg-[#0b1014] hover:bg-[#1a232b] text-gray-600 dark:text-gray-400 hover:text-white border border-white/5 font-bold rounded-xl py-4 flex items-center justify-center gap-2 transition-colors mt-auto text-sm"
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

                            {/* Chama Guides & Constitution Card — Below League Governance, rendered last on mobile */}
                            <div className="fc-card w-full bg-[#161d24] border border-blue-500/20 p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col shadow-xl">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                                            <BookOpen className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <h2 className="fc-frosty-title text-base font-black uppercase tracking-wider">
                                                Chama Guides & Constitution
                                            </h2>
                                            <p className="text-[10px] text-gray-500 font-medium">Official league governance, manual, rules, and FAQ</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { haptics.selection(); setShowDocsModal(true); }}
                                        className="px-3.5 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 hover:text-blue-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                    >
                                        <HelpCircle className="w-3.5 h-3.5" /> Read Documentation
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isAdminView && (
                        <div className="xl:col-span-12">
                            <div className="fc-card w-full bg-[#161d24] border border-blue-500/20 p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col shadow-xl">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                                            <BookOpen className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <h2 className="fc-frosty-title text-base font-black uppercase tracking-wider">
                                                Chama Guides & Constitution
                                            </h2>
                                            <p className="text-[10px] text-gray-500 font-medium">Official league governance, manual, rules, and FAQ</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { haptics.selection(); setShowDocsModal(true); }}
                                        className="px-3.5 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 hover:text-blue-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                    >
                                        <HelpCircle className="w-3.5 h-3.5" /> Read Documentation
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 leading-relaxed">
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

            {/* Custom Confirm Modal for Destructive Actions (No browser localhost alert) */}
            <ConfirmModal
                isOpen={Boolean(memberToDelete)}
                onClose={() => setMemberToDelete(null)}
                onConfirm={executeDeleteMember}
                title="Remove Member from League"
                message={`Permanently remove ${memberToDelete?.name || 'this member'} from this league? This will remove them from the roster.`}
                confirmText="Remove Member"
                cancelText="Cancel"
                variant="danger"
                isLoading={isDeletingMember}
            />

            {/* Chama Constitution & Guides Modal */}
            <DocsModal
                isOpen={showDocsModal}
                onClose={() => setShowDocsModal(false)}
            />

        </div >
    );
}
