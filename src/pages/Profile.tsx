import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ShieldCheck, Trophy, Users, AlertTriangle, Lock, UserPlus, UserMinus, ShieldAlert, User, Mail, Copy, Share2, RefreshCw, Trash2, Fingerprint, Key, BookOpen, X, Search, CheckCircle2, ChevronDown, Crown, Camera, Loader2, Sparkles } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { db, auth } from '../firebase';
import { doc, updateDoc, setDoc, getDoc, deleteDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import { compressProfileImage } from '../utils/imageCompressor';
import { getPhoneVariants } from '../utils/phone';
import clsx from 'clsx';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';
import UserAvatar from '../components/UserAvatar';
import DocsModal from '../components/DocsModal';

export default function Profile() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id'; // Fallback for MVP
    const navigate = useNavigate();
    const role = useStore(state => state.role);
    const setRole = useStore(state => state.setRole);
    const members = useStore(state => state.members);
    const currentUser = members.find(m => m.id === activeUserId || (m.authUid && m.authUid === activeUserId));
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);
    const toggleMemberActiveStatus = useStore(state => state.toggleMemberActiveStatus);
    const { theme, setTheme } = useTheme();

    // Form states
    const [displayName, setDisplayName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [fplTeamName, setFplTeamName] = useState('');
    const [avatarSeed, setAvatarSeed] = useState('chairman');
    const [photoUrl, setPhotoUrl] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('fc_user_avatar') || null;
        }
        return null;
    });
    const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
    const [photoCompressStats, setPhotoCompressStats] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [playMode, setPlayMode] = useState<'pot' | 'sidebets_only'>('pot');
    const [isSavingMember, setIsSavingMember] = useState(false);
    const [fplStandings, setFplStandings] = useState<any[]>([]);
    const [isFetchingFpl, setIsFetchingFpl] = useState(false);

    // Sync avatar from cloud users collection on mount if available
    useEffect(() => {
        const checkCloudAvatar = async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            try {
                const userSnap = await getDoc(doc(db, 'users', uid));
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    const cloudAvatar = data.photoURL || data.avatarUrl || data.photoUrl;
                    if (cloudAvatar) {
                        setPhotoUrl(cloudAvatar);
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('fc_user_avatar', cloudAvatar);
                        }
                    }
                }
            } catch (err) {
                console.warn('[profile] Could not check cloud avatar:', err);
            }
        };
        checkCloudAvatar();
    }, []);

    const [leagueName, setLeagueName] = useState('');
    const [gameweekStake, setMonthlyContribution] = useState<number>(0);
    const [weeklyPrizePercent, setWeeklyPrizePercent] = useState<number>(70);
    const [seasonWinnersCount, setSeasonWinnersCount] = useState<number>(3);
    const [seasonWinnersMode, setSeasonWinnersMode] = useState<'top1' | 'top3' | 'top5' | 'custom'>('top3');
    const [customWinnerCount, setCustomWinnerCount] = useState<number>(3);
    const [customWinnerRatios, setCustomWinnerRatios] = useState<string[]>(['50', '30', '20']);
    const [fplLeagueId, setFplLeagueId] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [chairmanName, setChairmanName] = useState('');
    const [chairmanPhone, setChairmanPhone] = useState('');
    const [coAdminId, setCoAdminId] = useState('');
    const [chairmanId, setChairmanId] = useState<string | null>(null);
    const [isSavingAdmin, setIsSavingAdmin] = useState(false);
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [dangerZoneTab, setDangerZoneTab] = useState<'succession' | 'delete'>('succession');
    const [pendingPhoneMap, setPendingPhoneMap] = useState<Record<string, string>>({});
    const [isSavingPendingPhone, setIsSavingPendingPhone] = useState<string | null>(null);
    const [showPendingOnboarding, setShowPendingOnboarding] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeletingMember, setIsDeletingMember] = useState(false);
    const [showDocsModal, setShowDocsModal] = useState(false);
    const [onboardingSearch, setOnboardingSearch] = useState('');
    const [showRetireModal, setShowRetireModal] = useState(false);
    const [selectedSuccessorId, setSelectedSuccessorId] = useState('');
    const [isRetiring, setIsRetiring] = useState(false);
    const [showDeleteLeagueModal, setShowDeleteLeagueModal] = useState(false);
    const [isDeletingLeague, setIsDeletingLeague] = useState(false);
    const [showLeagueSettingsModal, setShowLeagueSettingsModal] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showDangerZoneModal, setShowDangerZoneModal] = useState(false);
    const [showSessionModal, setShowSessionModal] = useState(false);

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
                setChairmanName(data.chairmanName || '');
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
    const membersRef = useRef(members);
    useEffect(() => {
        membersRef.current = members;
    }, [members]);

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
                        const currentMembers = membersRef.current;
                        const norm = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        for (const result of results) {
                            const fplTeamId = String(result.entry);
                            const existingMember = currentMembers.find((m: any) => {
                                if (m.fplTeamId && String(m.fplTeamId) === fplTeamId) return true;
                                if (m.secondFplTeamId && String(m.secondFplTeamId) === fplTeamId) return true;
                                const nameMatch = norm(m.displayName) && (norm(m.displayName) === norm(result.player_name) || norm(m.displayName).includes(norm(result.player_name)) || norm(result.player_name).includes(norm(m.displayName)));
                                const teamMatch = norm(m.fplTeamName || (m as any).teamName) && (norm(m.fplTeamName || (m as any).teamName) === norm(result.entry_name) || norm(m.fplTeamName || (m as any).teamName).includes(norm(result.entry_name)) || norm(result.entry_name).includes(norm(m.fplTeamName || (m as any).teamName)));
                                return (nameMatch && teamMatch) || (nameMatch && !m.fplTeamId) || (teamMatch && !m.fplTeamId);
                            });
                            
                            if (existingMember) {
                                if (!existingMember.fplTeamId || !(existingMember.fplTeamName || existingMember.teamName)) {
                                    updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', existingMember.id), {
                                        fplTeamId: fplTeamId,
                                        fplTeamName: result.entry_name,
                                        teamName: result.entry_name
                                    }).catch(() => {});
                                }
                            } else {
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
    }, [fplLeagueId, activeLeagueId, role]);

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
            const currentMember = members.find(m => m.id === activeUserId)
                || members.find(m => (m as any).userId === activeUserId)
                || (role === 'admin' ? members.find(m => m.role === 'admin' || (m as any).isAdmin || (m as any).isChairman) : undefined)
                || members[0];
            if (currentMember) {
                setDisplayName(currentMember.displayName || '');
                setPhoneNumber(currentMember.phone || '');
                setFplTeamName((currentMember as any).fplTeamId ? String((currentMember as any).fplTeamId) : '');
                setAvatarSeed((currentMember as any).avatarSeed || ((currentMember.role === 'admin' || role === 'admin') ? 'chairman' : currentMember.displayName));
                const persistentAvatar = (currentMember as any).photoUrl 
                    || (currentMember as any).avatarUrl 
                    || (typeof window !== 'undefined' ? localStorage.getItem('fc_user_avatar') : null)
                    || auth.currentUser?.photoURL 
                    || null;
                if (persistentAvatar) {
                    setPhotoUrl(persistentAvatar);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('fc_user_avatar', persistentAvatar);
                    }
                }
            }
        }
    }, [members, activeUserId, role]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsCompressingPhoto(true);
            const result = await compressProfileImage(file, 256, 0.82);
            setPhotoUrl(result.dataUrl);
            setPhotoCompressStats(`${result.originalSizeKb} KB → ${result.compressedSizeKb} KB`);
            if (typeof window !== 'undefined') {
                localStorage.setItem('fc_user_avatar', result.dataUrl);
            }
            haptics.success();
            toast.success(`Photo compressed & updated (${result.compressedSizeKb} KB)!`, { icon: '📸' });

            if (activeLeagueId) {
                const targetMember = members.find(m => m.id === activeUserId)
                    || members.find(m => (m as any).userId === activeUserId)
                    || (role === 'admin' ? members.find(m => m.role === 'admin' || (m as any).isAdmin || (m as any).isChairman) : undefined)
                    || members[0];
                if (targetMember?.id) {
                    await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', targetMember.id), {
                        photoUrl: result.dataUrl,
                        avatarUrl: result.dataUrl,
                        updatedAt: serverTimestamp(),
                    });
                }
            }
            if (auth.currentUser?.uid) {
                await setDoc(doc(db, 'users', auth.currentUser.uid), {
                    photoURL: result.dataUrl,
                    avatarUrl: result.dataUrl,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            }
        } catch (err: any) {
            console.error('Failed to compress/save photo:', err);
            haptics.warning();
            toast.error(err?.message || 'Could not process image file.');
        } finally {
            setIsCompressingPhoto(false);
            e.target.value = '';
        }
    };

    const handleRemovePhoto = async () => {
        try {
            setPhotoUrl(null);
            setPhotoCompressStats(null);
            if (typeof window !== 'undefined') {
                localStorage.removeItem('fc_user_avatar');
            }
            haptics.selection();
            toast.success('Custom profile photo removed');

            if (activeLeagueId) {
                const targetMember = members.find(m => m.id === activeUserId)
                    || members.find(m => (m as any).userId === activeUserId)
                    || (role === 'admin' ? members.find(m => m.role === 'admin' || (m as any).isAdmin || (m as any).isChairman) : undefined)
                    || members[0];
                if (targetMember?.id) {
                    await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', targetMember.id), {
                        photoUrl: null,
                        avatarUrl: null,
                        updatedAt: serverTimestamp(),
                    });
                }
            }
            if (auth.currentUser?.uid) {
                await setDoc(doc(db, 'users', auth.currentUser.uid), {
                    photoURL: null,
                    avatarUrl: null,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            }
        } catch (err: any) {
            console.error('Failed to remove photo:', err);
        }
    };

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
    const hasPaid = currentMember ? isMemberFunded(currentMember) : true; // default true to avoid false red on load
    const isAdminView = role === 'admin';

    const handleSaveMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeLeagueId) return;

        setIsSavingMember(true);

        try {
            const targetMember = members.find(m => m.id === activeUserId)
                || members.find(m => (m as any).userId === activeUserId)
                || (role === 'admin' ? members.find(m => m.role === 'admin' || (m as any).isAdmin || (m as any).isChairman) : undefined)
                || members[0];
            const targetMemberId = targetMember?.id;

            if (targetMemberId) {
                const memberRef = doc(db, 'leagues', activeLeagueId, 'memberships', targetMemberId);
                const updates: any = {
                    displayName: displayName,
                    phone: phoneNumber,
                    avatarSeed: avatarSeed,
                    playMode: playMode,
                    photoUrl: photoUrl || (typeof window !== 'undefined' ? localStorage.getItem('fc_user_avatar') : null) || null,
                    avatarUrl: photoUrl || (typeof window !== 'undefined' ? localStorage.getItem('fc_user_avatar') : null) || null,
                    updatedAt: serverTimestamp(),
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
            const matchedCoChair = members.find(m => m.id === coAdminId || (m.authUid && m.authUid === coAdminId) || m.role === 'co-chair');
            const targetCoAdminId = matchedCoChair ? matchedCoChair.id : (coAdminId || null);

            const updates: any = {
                gameweekStake: Number(gameweekStake),
                'rules.weekly': Number(weeklyPrizePercent),
                'rules.vault': 100 - Number(weeklyPrizePercent),
                'rules.seasonWinnersCount': effectiveSeasonWinnersCount,
                'rules.seasonWinnersMode': seasonWinnersMode,
                'rules.seasonDistribution': effectiveSeasonDistribution,
                fplLeagueId: fplLeagueId ? Number(fplLeagueId) : null,
                coAdminId: targetCoAdminId,
                chairmanPhone: chairmanPhone || null
            };
            if (leagueName.trim()) {
                updates.name = leagueName.trim();
                updates.leagueName = leagueName.trim();
            }
            await setDoc(leagueRef, updates, { merge: true });

            if (targetCoAdminId) {
                const coChairRef = doc(db, 'leagues', activeLeagueId, 'memberships', targetCoAdminId);
                await updateDoc(coChairRef, { role: 'co-chair' }).catch(() => {});
                const formerCoChairs = members.filter(m => m.id !== targetCoAdminId && m.role === 'co-chair' && m.id !== chairmanId);
                for (const former of formerCoChairs) {
                    await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', former.id), { role: 'member' }).catch(() => {});
                }
            } else if (coAdminId === '') {
                const formerCoChairs = members.filter(m => m.role === 'co-chair' && m.id !== chairmanId);
                for (const former of formerCoChairs) {
                    await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', former.id), { role: 'member' }).catch(() => {});
                }
            }
            
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
            setShowLeagueSettingsModal(false);
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
        const link = `${origin}/join?code=${inviteCode}`;
        const host = chairmanName || members.find(m => m.role === 'admin' || m.role === 'chairman')?.displayName || displayName || localStorage.getItem('activeUserName') || localStorage.getItem('fc-setup-fullName') || 'The Chairman';
        const text = `You're invited by ${host} to join *${leagueName || 'our FPL Chama'}* on Fantasy Chama!\n\nWin weekly cash prizes and compete for the end-of-season jackpot. Points and rankings update automatically after every gameweek.\n\nJoin here: ${link}\nLeague Code: *${inviteCode}*`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleCopy = () => {
        const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://fantasy-chama.vercel.app';
        const link = `${origin}/join?code=${inviteCode}`;
        const host = chairmanName || members.find(m => m.role === 'admin' || m.role === 'chairman')?.displayName || displayName || localStorage.getItem('activeUserName') || localStorage.getItem('fc-setup-fullName') || 'The Chairman';
        const text = `You're invited by ${host} to join *${leagueName || 'our FPL Chama'}* on Fantasy Chama!\n\nWin weekly cash prizes and compete for the end-of-season jackpot. Points and rankings update automatically after every gameweek.\n\nJoin here: ${link}\nLeague Code: *${inviteCode}*`;
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

    const handleRetireChairman = async () => {
        if (!activeLeagueId || !selectedSuccessorId) {
            toast.error('Please select a manager to succeed as Chairman.');
            return;
        }
        const successor = members.find(m => m.id === selectedSuccessorId);
        if (!successor) {
            toast.error('Selected manager could not be found.');
            return;
        }

        setIsRetiring(true);
        try {
            const { doc: docFn, updateDoc: updateDocFn, collection: collFn, addDoc: addDocFn } = await import('firebase/firestore');

            const successorPhone = successor.phone || successor.phoneNumber || '';
            // 1. Update League Document
            await updateDocFn(docFn(db, 'leagues', activeLeagueId), {
                chairmanId: successor.id,
                chairmanPhone: successorPhone,
                coAdminId: coAdminId === successor.id ? null : (coAdminId || null)
            });

            // 2. Promote successor to admin
            await updateDocFn(docFn(db, 'leagues', activeLeagueId, 'memberships', successor.id), {
                role: 'admin',
                isChairman: true,
                isActive: true
            });

            // 3. Demote current user (former chairman) to standard member
            const currentChairmanMember = members.find(m => m.id === activeUserId || (m.authUid && m.authUid === activeUserId) || m.role === 'admin');
            if (currentChairmanMember && currentChairmanMember.id !== successor.id) {
                await updateDocFn(docFn(db, 'leagues', activeLeagueId, 'memberships', currentChairmanMember.id), {
                    role: 'member',
                    isChairman: false
                });
            }

            // 4. Log governance event
            try {
                const eventsRef = collFn(db, 'leagues', activeLeagueId, 'league_events');
                await addDocFn(eventsRef, {
                    type: 'chairman_succession',
                    message: `Chairman stepped down. Chairmanship successfully transferred to ${successor.displayName}.`,
                    actor: currentUser?.displayName || 'Chairman',
                    successor: successor.displayName,
                    timestamp: new Date().toISOString()
                });
            } catch {}

            haptics.celebrate();
            toast.success(`You have stepped down. ${successor.displayName} is now the League Chairman!`);
            setShowRetireModal(false);
            setRole('member');
            setTimeout(() => {
                navigate('/dashboard', { replace: true });
            }, 1200);
        } catch (err: any) {
            console.error('Failed to transfer chairmanship:', err);
            toast.error('Failed to transfer role: ' + (err?.message || 'Error'));
        } finally {
            setIsRetiring(false);
        }
    };

    const handleDeleteLeague = async () => {
        if (!activeLeagueId) return;
        const deletingLeagueId = activeLeagueId;
        setShowDeleteLeagueModal(false);
        setIsDeletingLeague(true);
        try {
            haptics.warning();

            // 1. Soft-delete and attempt hard-delete with timeout race
            const deleteWork = (async () => {
                try {
                    await updateDoc(doc(db, 'leagues', deletingLeagueId), {
                        isDeleted: true,
                        status: 'deleted',
                        deletedAt: serverTimestamp(),
                    });
                } catch (e) {
                    console.warn('Soft delete leagueDoc error (non-fatal):', e);
                }
                try {
                    await deleteDoc(doc(db, 'leagues', deletingLeagueId));
                } catch (e) {
                    console.warn('Delete leagueDoc error (non-fatal):', e);
                }
            })();

            await Promise.race([
                deleteWork,
                new Promise(resolve => setTimeout(resolve, 2000))
            ]);

            // 2. Remove this league from the chairman's userLeagues documents (check all phone variants)
            const candidatePhones = [
                phoneNumber,
                currentUser?.phone,
                currentUser?.phoneNumber,
                chairmanPhone,
                localStorage.getItem('memberPhone'),
                localStorage.getItem('userPhone')
            ].filter(Boolean) as string[];

            const allCleanPhones = new Set<string>();
            candidatePhones.forEach(p => {
                getPhoneVariants(p).forEach(v => {
                    const clean = v.replace(/[^0-9]/g, '');
                    if (clean) allCleanPhones.add(clean);
                });
                const directClean = p.replace(/[^0-9]/g, '');
                if (directClean) allCleanPhones.add(directClean);
            });

            let nextLeagueId: string | null = null;

            for (const cleanPhone of allCleanPhones) {
                try {
                    const ulRef = doc(db, 'userLeagues', cleanPhone);
                    const ulSnap = await getDoc(ulRef);
                    if (ulSnap.exists()) {
                        const existingLeagues = ulSnap.data().leagues || [];
                        const remaining = existingLeagues.filter((l: any) => 
                            l.leagueId !== deletingLeagueId && l.id !== deletingLeagueId && !l.isDeleted && l.status !== 'deleted'
                        );
                        await setDoc(ulRef, { leagues: remaining }, { merge: true });
                        if (!nextLeagueId && remaining.length > 0) {
                            nextLeagueId = remaining[0].leagueId || remaining[0].id || null;
                        }
                    }
                } catch (e) {
                    console.warn('userLeagues cleanup error (non-fatal):', e);
                }
            }

            // 3. Clear current league session
            if (localStorage.getItem('activeLeagueId') === deletingLeagueId) {
                localStorage.removeItem('activeLeagueId');
                localStorage.removeItem('activeLeagueName');
                localStorage.removeItem('activeRole');
                localStorage.removeItem('activeUserRole');
            }
            toast.success(`League "${leagueName || 'League'}" deleted.`);

            // 4. If user has another league, switch to it; otherwise go to setup
            if (nextLeagueId) {
                localStorage.setItem('activeLeagueId', nextLeagueId);
                useStore.getState().setActiveLeagueId(nextLeagueId);
                setTimeout(() => {
                    navigate('/admin', { replace: true });
                }, 400);
            } else {
                useStore.getState().setActiveLeagueId(null);
                setTimeout(() => {
                    navigate('/setup', { replace: true });
                }, 400);
            }
        } catch (err: any) {
            console.error('Failed to delete league:', err);
            toast.error('Failed to delete league: ' + (err?.message || 'Error'));
        } finally {
            setIsDeletingLeague(false);
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
            "fc-active-members-card fc-card bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/5 rounded-[2rem] p-5 md:p-6 relative overflow-hidden h-fit shadow-xl text-slate-900 dark:text-white",
            extraClassName
        )}>
            {!extraClassName && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-1 text-slate-900 dark:text-white">
                            <Users className="w-5 h-5 text-[#10B981]" /> Active Members
                        </h2>
                        <p className="text-slate-500 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest">Chama Members</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {pendingMembers.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    haptics.selection();
                                    setShowPendingOnboarding(true);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.15)] group active:scale-95"
                                title="Click to view and onboard pending FPL members"
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span>{pendingMembers.length} Pending Onboarding</span>
                            </button>
                        )}
                        <span className="bg-slate-100 dark:bg-[#0b1014] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 px-3 py-1 rounded-lg text-sm font-black shadow-inner">
                            {activeMembersCount}
                        </span>
                    </div>
                </div>
            )}

            {/* Centered Interactive Modal: FPL Sync • Pending Onboarding */}
            {showPendingOnboarding && pendingMembers.length > 0 && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setShowPendingOnboarding(false)}
                >
                    <div
                        className="relative w-full max-w-xl bg-white dark:bg-[#0c1218] border border-slate-200 dark:border-emerald-500/30 rounded-[2rem] shadow-2xl p-5 md:p-6 my-auto flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden text-slate-900 dark:text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/10 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <div>
                                    <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white">
                                        🔗 FPL Sync • Pending Onboarding
                                    </h3>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mt-0.5">
                                        {pendingMembers.length} Members to Activate
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                                >
                                    <Share2 className="w-3 h-3" /> Share Code ({inviteCode || '------'})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPendingOnboarding(false)}
                                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95 cursor-pointer"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 my-3 font-medium leading-relaxed shrink-0">
                            Add M-Pesa phone numbers to imported FPL players to complete onboarding and activate them on the league ledger. Or share the code so members can join directly.
                        </p>

                        {/* Search Bar for Member Matching */}
                        <div className="relative mb-3 shrink-0">
                            <Search className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={onboardingSearch}
                                onChange={(e) => setOnboardingSearch(e.target.value)}
                                placeholder="Search member name or FPL team..."
                                className="w-full pl-10 pr-12 py-2.5 bg-slate-50 dark:bg-[#141b22] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-all"
                            />
                            {onboardingSearch && (
                                <button
                                    type="button"
                                    onClick={() => setOnboardingSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white uppercase font-bold"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Scrollable Members List */}
                        <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                            {filteredPendingMembers.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 dark:text-gray-500 text-xs font-medium">
                                    No pending members match "{onboardingSearch}"
                                </div>
                            ) : (
                                filteredPendingMembers.map((m: any) => (
                                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#141b22] border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 transition-all">
                                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                        <UserAvatar name={m.displayName} size="md" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-slate-900 dark:text-white break-words leading-tight">{m.displayName}</p>
                                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold break-words mt-0.5">
                                                {m.fplTeamName || 'FPL Team'} <span className="text-slate-500 dark:text-slate-400">· Pending Phone</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                        <input
                                            type="tel"
                                            value={pendingPhoneMap[m.id] || m.phoneNumber || ''}
                                            onChange={e => setPendingPhoneMap(prev => ({ ...prev, [m.id]: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) }))}
                                            placeholder="07XXXXXXXX"
                                            className="flex-1 sm:w-36 bg-white dark:bg-[#0c1218] border border-slate-300 dark:border-white/15 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white font-mono focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
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
                                                    const { doc: docFn, updateDoc: updateDocFn, deleteDoc: deleteDocFn } = await import('firebase/firestore');
                                                    const norm = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                                    
                                                    // Check if an existing member matches name or squad
                                                    const existingActive = members.find((existing: any) => 
                                                        existing.id !== m.id &&
                                                        ((norm(existing.displayName) && norm(existing.displayName) === norm(m.displayName)) ||
                                                         (norm((existing as any).fplTeamName) && norm((existing as any).fplTeamName) === norm(m.fplTeamName)) ||
                                                         (norm((existing as any).teamName) && norm((existing as any).teamName) === norm(m.fplTeamName)))
                                                    );

                                                    if (existingActive) {
                                                        const combinedPaid = Boolean(existingActive.hasPaid || m.hasPaid);
                                                        const combinedBalance = Math.max(Number(existingActive.walletBalance || 0), Number(m.walletBalance || 0));
                                                        await updateDocFn(docFn(db, 'leagues', activeLeagueId!, 'memberships', existingActive.id), {
                                                            phoneNumber: phone,
                                                            phone: phone,
                                                            fplTeamId: m.fplTeamId || existingActive.fplTeamId || null,
                                                            fplTeamName: m.fplTeamName || (existingActive as any).fplTeamName || null,
                                                            isPending: false,
                                                            isActive: true,
                                                            hasPaid: combinedPaid,
                                                            walletBalance: combinedBalance,
                                                        });
                                                        await deleteDocFn(docFn(db, 'leagues', activeLeagueId!, 'memberships', m.id));
                                                    } else {
                                                        await updateDocFn(docFn(db, 'leagues', activeLeagueId!, 'memberships', m.id), {
                                                            phoneNumber: phone,
                                                            phone: phone,
                                                            isPending: false,
                                                            isActive: true,
                                                        });
                                                    }
                                                    haptics.success();
                                                    toast.success(`${m.displayName} activated!`);
                                                } catch (_e) {
                                                    toast.error('Failed to save. Try again.');
                                                } finally {
                                                    setIsSavingPendingPhone(null);
                                                }
                                            }}
                                            disabled={isSavingPendingPhone === m.id || !((pendingPhoneMap[m.id] || m.phoneNumber)?.length >= 9)}
                                            className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-black text-xs font-black transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
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

            <div className="grid grid-cols-2 min-[440px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
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
                    const rawName = String(member.displayName || 'Member').trim();
                    const formattedName = rawName.length > 22 ? `${rawName.slice(0, 20)}...` : rawName;

                    return (
                        <div key={memberId || `member-${member.displayName}`} className="fc-active-member-tile group relative w-full min-h-[86px] sm:min-h-[90px] h-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0f151a] p-2 flex flex-col items-center justify-center gap-1.5 shadow-xs hover:border-emerald-500/40 dark:hover:border-white/20 transition-all">
                            <UserAvatar name={member.displayName} size="xs" />
                            <div className="text-center flex flex-col items-center gap-0.5 w-full min-w-0">
                                <span
                                    title={rawName}
                                    className={clsx(
                                        "text-[10.5px] sm:text-[11px] font-bold block w-full px-1 overflow-hidden text-ellipsis whitespace-nowrap text-center",
                                        !isActive ? "text-gray-400 line-through" : "text-slate-800 dark:text-white"
                                    )}
                                >
                                    {formattedName}
                                </span>
                                <div className="flex flex-col items-center justify-center">
                                    {isChairman && (
                                        <span className="bg-[#FBBF24]/10 text-amber-600 dark:text-[#FBBF24] text-[7.5px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-black border border-[#FBBF24]/30 flex items-center gap-0.5">
                                            <ShieldAlert className="w-2 h-2" /> Chairman
                                        </span>
                                    )}
                                    {isValidCoChair && (
                                        <span className="bg-[#3B82F6]/10 text-blue-600 dark:text-[#3B82F6] text-[7.5px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-black border border-[#3B82F6]/30 flex items-center gap-0.5">
                                            <ShieldCheck className="w-2 h-2" /> Co-Chair
                                        </span>
                                    )}
                                    {!isChairman && !isValidCoChair && (
                                        <span className={clsx("text-[8px] font-black uppercase tracking-wider block px-1.5 py-0.5 rounded-md",
                                            !isActive ? "text-gray-400 dark:text-gray-600 bg-gray-500/10" : (isMemberFunded(member) ? "text-emerald-600 dark:text-[#10B981] bg-emerald-500/10 border border-emerald-500/20" : "text-red-500 bg-red-500/10 border border-red-500/20")
                                        )}>
                                            {!isActive ? "Inactive" : (isMemberFunded(member) ? "Funded" : "Red Zone")}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {isAdminView && memberId !== activeUserId && (
                                <div className="absolute -top-1 -right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button
                                        onClick={() => handleToggleActive(memberId, isActive)}
                                        className="bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/10 rounded-full p-1 shadow-md hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                                        title={isActive ? "Deactivate User" : "Reactivate User"}
                                    >
                                        {isActive ? <UserMinus className="w-2.5 h-2.5 text-amber-500" /> : <UserPlus className="w-2.5 h-2.5 text-emerald-600 dark:text-[#10B981]" />}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteMember(memberId, member.displayName)}
                                        className="bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/10 rounded-full p-1 shadow-md hover:bg-red-50 dark:hover:bg-red-500/20 hover:border-red-300 dark:hover:border-red-500/40 cursor-pointer"
                                        title="Permanently remove user from league"
                                    >
                                        <Trash2 className="w-2.5 h-2.5 text-red-500 dark:text-red-400" />
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

    const renderLeagueGovernance = () => (
        <div className="fc-card w-full bg-white dark:bg-[#161d24] border border-amber-300/70 dark:border-amber-500/20 p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col shadow-xl text-slate-900 dark:text-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FBBF24] blur-[100px] opacity-10 transform translate-x-10 -translate-y-10 pointer-events-none"></div>

            <h2 className="fc-frosty-title text-xl font-black flex items-center gap-2 mb-2 text-slate-900 dark:text-white">
                <Trophy className="w-5 h-5 text-amber-500 dark:text-amber-400" /> League Governance
            </h2>
            <p className="text-xs text-slate-600 dark:text-gray-400 mb-5 max-w-2xl font-medium">
                Configure the financial engine, league branding, co-chair permissions, and invite access.
            </p>

            {/* Invite Hub Section */}
            <div className="bg-slate-50 dark:bg-[#0b1014] border border-slate-200 dark:border-white/5 rounded-2xl p-4 mb-5 shadow-inner">
                <div className="flex justify-between items-center mb-3">
                    <h3
                        className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400"
                        style={{
                            background: 'linear-gradient(90deg, #D97706 0%, #F59E0B 50%, #B45309 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Master Invite Code
                    </h3>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] uppercase font-bold tracking-widest rounded border border-amber-500/20">Active</span>
                </div>
                <div className="text-center mb-3">
                    <span
                        className="fc-master-invite-code text-4xl font-black tracking-widest block mb-1 select-all !text-[#FBBF24]"
                        style={{
                            color: '#FBBF24',
                            textShadow: '0 2px 20px rgba(251,191,36,0.4)',
                        }}
                    >
                        {inviteCode || '------'}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Share this code with players to join with their M-Pesa number.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleCopy} className="flex items-center justify-center gap-2 bg-white dark:bg-[#161d24] hover:bg-slate-100 dark:hover:bg-white/5 text-slate-800 dark:text-white font-bold py-3 rounded-xl border border-slate-300 dark:border-white/10 transition-colors text-sm shadow-sm cursor-pointer active:scale-95">
                        <Copy className="w-4 h-4 text-slate-500 dark:text-gray-400" /> Copy
                    </button>
                    <button onClick={handleShare} className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 rounded-xl shadow-[0_0_15px_rgba(37,211,102,0.3)] transition-colors text-sm cursor-pointer active:scale-95">
                        <Share2 className="w-4 h-4" /> Share
                    </button>
                </div>
            </div>

            {/* Quick summary strip */}
            <div className="flex flex-wrap items-center gap-2 mb-3.5 text-[11px] font-bold">
                <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300">
                    Stake: <strong className="text-emerald-600 dark:text-emerald-400">KES {gameweekStake.toLocaleString()}</strong>
                </span>
                <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300">
                    Split: <strong className="text-amber-600 dark:text-amber-400">{weeklyPrizePercent}% Weekly / {100 - weeklyPrizePercent}% Vault</strong>
                </span>
                <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300">
                    Winners: <strong className="text-amber-600 dark:text-amber-400">Top {seasonWinnersCount}</strong>
                </span>
            </div>

            {/* Configure League Settings Modal Trigger */}
            <button
                type="button"
                onClick={() => {
                    haptics.selection();
                    setShowLeagueSettingsModal(true);
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between border border-slate-200 dark:border-white/10 transition-all cursor-pointer mb-2 active:scale-[0.98] group"
            >
                <span className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                    <span>League Settings & Constitution Rules</span>
                </span>
                <span className="text-amber-600 dark:text-[#FBBF24] font-black text-xs flex items-center gap-1">
                    Configure →
                </span>
            </button>
        </div>
    );

    const renderLeagueSettingsForm = () => (
        <form onSubmit={handleSaveAdmin} className="space-y-4">
            {/* Modal & Form Title Header */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                            League Settings & Constitution Rules
                        </h2>
                        <p className="text-[10px] text-slate-600 dark:text-gray-400 font-medium">
                            Official Constitution, Pot Splits & Governance Parameters
                        </p>
                    </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider self-start sm:self-auto">
                    Active League Config
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Col 1: League Name */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
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
                        className="w-full bg-slate-50 dark:bg-[#0b1014] border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-400 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    />
                    <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-1">Clean sweep old season names to active league.</p>
                </div>

                {/* Col 2: Gameweek Stake */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            Gameweek Stake (KES)
                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                        </label>
                    </div>
                    <input
                        type="text"
                        inputMode="numeric"
                        disabled={isFinancialsLocked}
                        value={gameweekStake === 0 ? '' : gameweekStake}
                        placeholder="50"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9]/g, '');
                            setMonthlyContribution(cleaned === '' ? 0 : parseInt(cleaned, 10));
                        }}
                        className="w-full bg-slate-50 dark:bg-[#0b1014] border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-colors outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-1">Dues required per manager each round.</p>
                </div>

                {/* Col 1: FPL League ID */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
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
                        placeholder="e.g. 123456 or paste standings URL"
                        className="w-full bg-slate-50 dark:bg-[#0b1014] border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-colors outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-1">Auto-extracts from official FPL standings URL.</p>
                </div>

                {/* Col 2: Pochi Receiving Number */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">Pochi Receiving Number</label>
                    </div>
                    <input
                        type="tel"
                        value={chairmanPhone}
                        onChange={(e) => setChairmanPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                        placeholder="e.g. 0712345678"
                        className="w-full bg-slate-50 dark:bg-[#0b1014] border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-colors outline-none"
                    />
                    <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-1">Receives Pochi and fallback remittance references.</p>
                </div>

                {/* Col 1: Co-Chair Designation */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            Designate Co-Chair
                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                        </label>
                    </div>
                    <div className="relative">
                        {(() => {
                            const matchedCoChair = members.find(m => m.id === coAdminId || (m.authUid && m.authUid === coAdminId) || m.role === 'co-chair');
                            const resolvedCoAdminValue = matchedCoChair ? matchedCoChair.id : (coAdminId || '');
                            return (
                                <select
                                    disabled={isFinancialsLocked}
                                    value={resolvedCoAdminValue}
                                    onChange={(e) => setCoAdminId(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-[#0c1218] border border-slate-300 dark:border-white/10 rounded-xl py-2 pl-3 pr-9 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FBBF24]/20 focus:border-[#FBBF24] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
                                >
                                    <option value="" className="bg-white dark:bg-[#0c1218] text-gray-500 dark:text-gray-400 py-1 font-medium">-- No Co-Chair Selected --</option>
                                    {members.filter(m => m.id !== activeUserId && m.authUid !== activeUserId && m.id !== chairmanId && (m as any).role !== 'chairman').map(m => (
                                        <option key={m.id} value={m.id} className="bg-white dark:bg-[#0c1218] text-gray-900 dark:text-white py-1 font-medium">
                                            {m.displayName} {((m as any).fplTeamName || m.teamName) ? `(${((m as any).fplTeamName || m.teamName)})` : ''} {m.role === 'co-chair' ? '👑 Active Co-Chair' : ''}
                                        </option>
                                    ))}
                                </select>
                            );
                        })()}
                        <ChevronDown className="w-4 h-4 text-amber-500 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-1">Dual-signatory permissions for payouts & rules.</p>
                </div>

                {/* Col 2: Distribution Split Logic */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            Distribution Split
                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                        </label>
                        <span className="text-[10px] font-black text-amber-600 dark:text-[#FBBF24] px-2 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                            {weeklyPrizePercent}% Weekly / {100 - weeklyPrizePercent}% Vault
                        </span>
                    </div>

                    <div className="pt-2 pb-1">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            disabled={isFinancialsLocked}
                            value={weeklyPrizePercent}
                            onChange={(e) => setWeeklyPrizePercent(Number(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-amber-500 relative z-10 shadow-sm"
                            style={{ background: `linear-gradient(to right, #FBBF24 ${weeklyPrizePercent}%, #10B981 ${weeklyPrizePercent}%)` }}
                        />
                    </div>

                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider px-0.5">
                        <span className="text-amber-500">Weekly Pot ({weeklyPrizePercent}%)</span>
                        <span className="text-emerald-500">Season Vault ({100 - weeklyPrizePercent}%)</span>
                    </div>
                </div>
            </div>

            {/* End of Season Winners: Compact Selector */}
            <div className="pt-1 border-t border-slate-200/60 dark:border-white/5">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        End of Season Winners
                        {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                    </label>
                    <span className="text-[10px] text-amber-600 dark:text-[#FBBF24] font-bold">
                        Applied: {effectiveSeasonDistribution.map((ratio, idx) => `#${idx + 1} ${ratio}%`).join(' · ')}
                    </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
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
                                        "py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                        seasonWinnersMode === option.key
                                            ? "bg-[#22c55e]/20 border-[#22c55e]/60 text-[#22c55e]"
                                            : "bg-slate-50 dark:bg-[#161d24] border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                                    )}
                                    title={isOptionLockedBySize ? `Requires at least ${neededMembers} active members` : undefined}
                                >
                                    {option.label}
                                </button>
                            );
                        })()
                    ))}
                </div>

                {seasonWinnersMode === 'custom' && (
                    <div className="mt-2.5 space-y-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#0b1014]/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400">Custom winners (max {maxAllowedWinners})</label>
                            <input
                                type="number"
                                min="1"
                                max={maxAllowedWinners}
                                disabled={isFinancialsLocked}
                                value={normalizedCustomWinnerCount}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/^0+(?=\d)/, '');
                                    setCustomWinnerCount(Math.max(1, Math.min(maxAllowedWinners, Number(val) || 1)));
                                }}
                                className="w-16 bg-white dark:bg-[#161d24] border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 dark:text-white disabled:opacity-50 text-center"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Array.from({ length: normalizedCustomWinnerCount }, (_, idx) => (
                                <div key={`profile-ratio-${idx}`} className="flex items-center gap-2 bg-white dark:bg-[#161d24] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
                                    <span className="text-[10px] font-black uppercase text-slate-500 dark:text-gray-400 w-8">#{idx + 1}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        disabled={isFinancialsLocked}
                                        value={customWinnerRatios[idx] || '0'}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => {
                                            const next = [...customWinnerRatios];
                                            next[idx] = e.target.value.replace(/^0+(?=\d)/, '');
                                            setCustomWinnerRatios(next);
                                        }}
                                        className="w-14 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 text-xs font-bold text-slate-900 dark:text-white text-center"
                                    />
                                    <span className="text-[10px] text-slate-400">%</span>
                                    <span className="ml-auto text-[10px] font-bold text-amber-500">{effectiveSeasonDistribution[idx] || 0}% eff.</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[9px] text-slate-500 dark:text-gray-400 mt-1">Raw inputs: {rawCustomRatioSummary || 'n/a'} (auto-normalized to 100%)</p>
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2">
                {isFinancialsLocked ? (
                    <button
                        type="button"
                        onClick={handleUnlockFinancials}
                        className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-[#161d24] dark:hover:bg-white/5 border border-red-500/30 text-red-500 dark:text-red-400 font-bold rounded-xl py-3 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer shadow-sm"
                    >
                        <Lock className="w-4 h-4" /> Unlock to Modify League Rules
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setIsFinancialsLocked(true)}
                            className="w-1/3 bg-slate-100 hover:bg-slate-200 dark:bg-[#161d24] dark:hover:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-gray-400 font-bold rounded-xl py-3 transition-colors text-xs sm:text-sm cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSavingAdmin}
                            className="w-2/3 bg-[#FBBF24] hover:bg-[#FBBF24]/90 text-slate-950 font-black rounded-xl py-3 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer shadow-md shadow-amber-500/20"
                        >
                            {isSavingAdmin ? 'Saving...' : 'Save League Settings'}
                        </button>
                    </div>
                )}
            </div>
        </form>
    );

    const renderLeagueSettingsModal = () => (
        showLeagueSettingsModal && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                <div className="bg-white dark:bg-[#121820] border border-slate-200 dark:border-white/10 rounded-[2rem] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl relative text-slate-900 dark:text-white overflow-hidden">
                    <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#161d24]/95 backdrop-blur-sm shrink-0 sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                    League Settings & Constitution Rules
                                </h3>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">
                                    Configure league name, gameweek stake, payout splits, and co-chair
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { haptics.selection(); setShowLeagueSettingsModal(false); }}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-5 sm:p-6 overflow-y-auto flex-1">
                        {renderLeagueSettingsForm()}
                    </div>
                </div>
            </div>,
            document.body
        )
    );

    const renderOwnershipAndDangerZoneCard = (extraClassName = '') => (
        <div className={clsx("fc-card w-full bg-gradient-to-br from-rose-50/70 via-white to-red-50/50 dark:from-[#161418] dark:via-[#1a1317] dark:to-[#1e1014] border border-rose-200/80 dark:border-rose-500/25 p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col shadow-xl", extraClassName)}>
            {/* Tab controls */}
            <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-black/40 p-1 rounded-xl border border-slate-300 dark:border-white/10 w-fit shrink-0 mb-4">
                <button
                    type="button"
                    onClick={() => { haptics.selection(); setDangerZoneTab('succession'); }}
                    className={clsx(
                        "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                        dangerZoneTab === 'succession'
                            ? "bg-rose-500 text-white shadow-sm"
                            : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                >
                    <Crown className="w-3.5 h-3.5" /> Succession
                </button>
                <button
                    type="button"
                    onClick={() => { haptics.selection(); setDangerZoneTab('delete'); }}
                    className={clsx(
                        "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                        dangerZoneTab === 'delete'
                            ? "bg-red-600 text-white shadow-sm"
                            : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                >
                    <Trash2 className="w-3.5 h-3.5" /> Delete League
                </button>
            </div>

            {dangerZoneTab === 'succession' ? (
                <div className="space-y-3 animate-in fade-in duration-200">
                    <p className="text-xs text-slate-600 dark:text-gray-400 font-medium">
                        Step down and safely transfer chairmanship to your Co-Chair or select an eligible manager.
                    </p>
                    {coAdminId && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Designated Successor (Co-Chair)</p>
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {members.find(m => m.id === coAdminId || (m.authUid && m.authUid === coAdminId))?.displayName || 'Active Co-Chair'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedSuccessorId(coAdminId);
                                    setShowRetireModal(true);
                                }}
                                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition active:scale-95 shrink-0 shadow-sm cursor-pointer"
                            >
                                Pass to Co-Chair →
                            </button>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-bold text-slate-700 dark:text-gray-400 uppercase tracking-widest block mb-1.5">
                            Or Transfer Chairmanship to Any Manager:
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select
                                value={selectedSuccessorId}
                                onChange={(e) => setSelectedSuccessorId(e.target.value)}
                                className="flex-1 bg-white dark:bg-[#0c1218] border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 shadow-xs transition-colors"
                            >
                                <option value="" className="bg-white dark:bg-[#0c1218] text-slate-500 dark:text-gray-400">-- Choose New Chairman --</option>
                                {members.filter(m => m.id !== activeUserId && m.authUid !== activeUserId && m.isActive !== false).map(m => (
                                    <option key={m.id} value={m.id} className="bg-white dark:bg-[#0c1218] text-slate-900 dark:text-white">
                                        {m.displayName} {((m as any).fplTeamName || m.teamName) ? `(${((m as any).fplTeamName || m.teamName)})` : ''} {m.id === coAdminId ? '👑 Co-Chair' : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                disabled={!selectedSuccessorId}
                                onClick={() => setShowRetireModal(true)}
                                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-200 dark:disabled:bg-white/10 disabled:text-slate-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs font-black transition active:scale-95 shrink-0 shadow-sm cursor-pointer"
                            >
                                Transfer Role
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 animate-in fade-in duration-200">
                    <p className="text-xs text-slate-600 dark:text-red-200/80 leading-relaxed font-medium">
                        Once deleted, all gameweek records, member registrations, pots, and settings for <strong className="text-slate-900 dark:text-white">{leagueName || 'this league'}</strong> will be permanently removed. This action cannot be reversed.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            haptics.warning();
                            setShowDeleteLeagueModal(true);
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition active:scale-95 shadow-md shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer border border-red-500"
                    >
                        <Trash2 className="w-4 h-4" /> Delete League Permanently
                    </button>
                </div>
            )}
        </div>
    );

    const renderSessionDetailsContent = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Account ID */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                        <Fingerprint className="w-3.5 h-3.5 text-slate-400" /> Your Authenticated ID
                    </span>
                    <div className="flex items-center justify-between gap-1.5 bg-white dark:bg-[#090d11] px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/5">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate select-all">
                            {auth.currentUser?.uid || "None"}
                        </span>
                        {auth.currentUser?.uid && (
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(auth.currentUser?.uid || '');
                                    toast.success('Account ID copied!');
                                }}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-emerald-500 transition cursor-pointer shrink-0"
                                title="Copy Account ID"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Role */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 p-3.5 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                        <Key className="w-3.5 h-3.5 text-emerald-500" /> Assigned Role
                    </span>
                    <div className="flex items-center justify-between bg-white dark:bg-[#090d11] px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/5">
                        <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">
                            {chairmanId && auth.currentUser?.uid === chairmanId ? 'Chairman (Owner)' : (coAdminId && auth.currentUser?.uid === coAdminId ? 'Co-Chair' : 'Member')}
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                </div>

                {/* Chairman ID */}
                {chairmanId && (
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 p-3.5 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Chairman ID
                        </span>
                        <div className="flex items-center justify-between gap-1.5 bg-white dark:bg-[#090d11] px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/5">
                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate select-all">
                                {chairmanId}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(chairmanId || '');
                                    toast.success('Chairman ID copied!');
                                }}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-amber-500 transition cursor-pointer shrink-0"
                                title="Copy Chairman ID"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Co-Chair ID */}
                {coAdminId && (
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 p-3.5 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> Co-Chair ID
                        </span>
                        <div className="flex items-center justify-between gap-1.5 bg-white dark:bg-[#090d11] px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/5">
                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate select-all">
                                {coAdminId}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(coAdminId || '');
                                    toast.success('Co-Chair ID copied!');
                                }}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-blue-500 transition cursor-pointer shrink-0"
                                title="Copy Co-Chair ID"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-relaxed font-medium">
                These cryptographic keys are used to enforce security rules in Firebase Firestore. They guarantee that only verified administrators can initiate payouts or alter league configurations.
            </p>
        </div>
    );

    const renderThemeSelector = () => (
        <div className="fc-card w-full bg-white dark:bg-gradient-to-br dark:from-[#0f141a] dark:to-[#080c10] border border-slate-200 dark:border-white/10 p-4 sm:p-5 rounded-3xl relative overflow-hidden flex flex-col shadow-xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between gap-3 mb-3.5">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white leading-tight">
                            Interface & Theme
                        </h2>
                        <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">Personalize visual aesthetics and display</p>
                    </div>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    {theme === 'stealth' ? 'Stealth OLED' : theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System OS'}
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                    { key: 'dark', label: 'Dark Mode', icon: '🌙' },
                    { key: 'stealth', label: 'Stealth Mode', icon: '🛡️' },
                    { key: 'system', label: 'System Auto', icon: '💻' },
                    { key: 'light', label: 'Light Mode', icon: '☀️' },
                ].map((t) => {
                    const isSelected = theme === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => {
                                haptics.selection();
                                setTheme(t.key as any);
                                toast.success(`${t.label} activated`);
                            }}
                            className={clsx(
                                "p-3 rounded-2xl border text-left transition-all duration-200 relative flex flex-col justify-between cursor-pointer select-none active:scale-95 min-h-[64px]",
                                isSelected
                                    ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 shadow-md ring-2 ring-emerald-500/30"
                                    : "bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                            )}
                        >
                            <div className="flex items-center justify-between w-full mb-1">
                                <span className="text-xl sm:text-2xl leading-none drop-shadow-xs">{t.icon}</span>
                                {isSelected ? (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Active</span>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981] animate-pulse" />
                                    </div>
                                ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20" />
                                )}
                            </div>
                            <div>
                                <p className={clsx(
                                    "text-xs sm:text-sm font-black tracking-tight leading-tight",
                                    isSelected ? "text-emerald-700 dark:text-emerald-300 font-extrabold" : "text-slate-800 dark:text-white"
                                )}>
                                    {t.label}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const isSuperAdminUser = Boolean(
        auth.currentUser?.email?.toLowerCase() === 'cbrian@kabarak.ac.ke' ||
        auth.currentUser?.uid === import.meta.env.VITE_SUPER_ADMIN_UID ||
        activeUserId === import.meta.env.VITE_SUPER_ADMIN_UID ||
        role === 'admin' ||
        localStorage.getItem('isSuperAdmin') === 'true'
    );

    return (
        <div className="fc-profile-page min-h-[100dvh] p-5 md:p-10 w-full animate-in fade-in duration-500 pb-6 lg:pb-8 font-sans text-slate-900 dark:text-white relative overflow-hidden bg-transparent">
            <div className="absolute inset-0 pointer-events-none opacity-75">
                <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-emerald-500/12 blur-3xl" />
            </div>
            <div className="max-w-6xl mx-auto space-y-8">
                <Header role={role || 'member'} title="Profile & Settings" subtitle="Identity · League · Controls" hideCountdown={true} />

                {/* SuperAdmin HQ Platform Command Bar */}
                {isSuperAdminUser && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-transparent border border-purple-500/30 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                        SuperAdmin HQ
                                    </h3>
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                                        Platform Control
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-gray-400 font-medium mt-0.5">
                                    Cross-league management, live financial telemetry, payout audits & master admin tools.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                haptics.selection();
                                navigate('/hq');
                            }}
                            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-purple-600/25 flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-stretch sm:self-auto justify-center"
                        >
                            <span>Launch SuperAdmin HQ</span>
                            <span>↗</span>
                        </button>
                    </div>
                )}

                {/* Top Section: Personal Details + League Governance side-by-side on desktop */}
                <div className={clsx(
                    "grid gap-5 md:gap-6 items-start",
                    isAdminView ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
                )}>
                    {/* Member View (Personal Settings) */}
                    <div className={clsx(
                        "fc-profile-details-card fc-card border p-5 md:p-6 rounded-[2rem] relative overflow-hidden flex flex-col transition-all duration-500",
                        !hasPaid && !isAdminView
                            ? 'bg-red-950/40 border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.08)]'
                            : 'bg-white dark:bg-[#161d24] border-slate-200 dark:border-white/5 shadow-xl text-slate-900 dark:text-white'
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
                        <div className="mb-4">
                            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                <User className="w-5 h-5 text-[#10B981]" /> Personal Details
                            </h2>
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium mt-1 max-w-xl leading-relaxed">
                                Update the member identity that powers invites, payouts, and FPL matching.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 items-stretch">
                            <div className="flex flex-col sm:flex-row items-center justify-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5">
                                <div className="relative group shrink-0">
                                    <UserAvatar name={displayName || 'Manager'} photoUrl={photoUrl} size="xl" className="ring-2 ring-emerald-500/30 shadow-lg" />
                                    {isCompressingPhoto && (
                                        <div className="absolute inset-0 rounded-full bg-black/70 backdrop-blur-xs flex items-center justify-center">
                                            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handlePhotoUpload}
                                        />
                                        <button
                                            type="button"
                                            disabled={isCompressingPhoto}
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:border-emerald-500/30 dark:text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                                        >
                                            <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                            <span>{photoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                                        </button>
                                        {photoUrl && (
                                            <button
                                                type="button"
                                                onClick={handleRemovePhoto}
                                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 dark:border-rose-500/30 dark:text-rose-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                                            >
                                                <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                                <span>Remove</span>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                        {photoCompressStats ? (
                                            <span className="text-emerald-500 dark:text-emerald-400 font-bold flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" /> Auto-compressed: {photoCompressStats}
                                            </span>
                                        ) : (
                                            'Any image format auto-compresses for instant, lightweight loading.'
                                        )}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveMember} className="grid grid-cols-1 gap-3.5 items-start w-full">
                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-slate-600 dark:text-gray-400 mb-1.5 uppercase tracking-widest">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-[#0b1014] border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all outline-none font-medium placeholder:text-slate-400 dark:placeholder:text-gray-600"
                                        placeholder="Enter your Display Name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-slate-600 dark:text-gray-400 mb-1.5 uppercase tracking-widest">
                                        M-Pesa Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                                        className="w-full bg-slate-50 dark:bg-[#0b1014] border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all outline-none font-medium placeholder:text-slate-400 dark:placeholder:text-gray-600"
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
                                    <label className="block text-[10px] md:text-xs font-bold text-slate-600 dark:text-gray-400 mb-1.5 uppercase tracking-widest">
                                        Link FPL Team
                                    </label>
                                    {isFetchingFpl ? (
                                        <div className="w-full bg-slate-100 dark:bg-[#0b1014] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-slate-500 dark:text-gray-400 italic">
                                            Syncing with Fantasy Premier League Server...
                                        </div>
                                    ) : fplStandings.length > 0 ? (
                                        <div className="relative">
                                            <select
                                                value={fplTeamName}
                                                onChange={(e) => setFplTeamName(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-[#0c1218] border border-slate-300 dark:border-white/10 rounded-xl py-3 pl-4 pr-11 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#10B981]/20 focus:border-[#10B981] transition-all outline-none text-left appearance-none cursor-pointer shadow-sm hover:border-[#10B981]/50"
                                            >
                                                <option value="" disabled className="text-gray-500 dark:text-gray-400 bg-white dark:bg-[#0c1218]">Select your actual FPL Team</option>
                                                {fplStandings.map((team: any) => (
                                                    <option key={team.entry} value={team.entry} className="bg-white dark:bg-[#0c1218] text-gray-900 dark:text-white py-1.5 font-medium">
                                                        {team.entry_name} — (Mgr: {team.player_name})
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-[#10B981] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={fplTeamName}
                                            onChange={(e) => setFplTeamName(e.target.value)}
                                            className="w-full bg-slate-100 dark:bg-[#0b1014] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-slate-500 dark:text-gray-400 outline-none font-medium cursor-not-allowed opacity-60"
                                            placeholder="League Standings unavailable."
                                            disabled
                                        />
                                    )}
                                    <p className="text-[10px] text-gray-600 dark:text-gray-400 font-medium mt-1.5 leading-relaxed">
                                        Resolves FPL vs M-Pesa name mismatches perfectly.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-slate-600 dark:text-gray-400 mb-1.5 uppercase tracking-widest flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5" /> Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={userEmail}
                                        disabled
                                        className="w-full bg-slate-100 dark:bg-[#0b1014] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 text-sm text-slate-500 dark:text-gray-400 outline-none font-medium cursor-not-allowed opacity-60"
                                        placeholder="Loading..."
                                    />
                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium mt-1.5 leading-relaxed">Managed by Firebase Auth. Cannot be changed here.</p>
                                </div>

                                {/* Participation Mode Selector */}
                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-slate-600 dark:text-gray-400 mb-1.5 uppercase tracking-widest flex items-center gap-1.5">
                                        <Trophy className="w-3 h-3 text-amber-500 dark:text-amber-400" /> Chama Participation Mode
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setPlayMode('pot')}
                                            className={clsx(
                                                "p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-sm",
                                                playMode === 'pot'
                                                    ? "border-emerald-500/60 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-950 dark:text-white ring-1 ring-emerald-500/30"
                                                    : "border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-black/20 text-slate-600 dark:text-gray-400 hover:border-slate-300 dark:hover:border-white/20"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Weekly & Season Pot</span>
                                                {playMode === 'pot' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-snug">
                                                Active cash pot contender. Eligible for weekly & season prizes when wallet is funded.
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPlayMode('sidebets_only')}
                                            className={clsx(
                                                "p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-sm",
                                                playMode === 'sidebets_only'
                                                    ? "border-indigo-500/60 bg-indigo-50/80 dark:bg-indigo-500/15 text-indigo-950 dark:text-white ring-1 ring-indigo-500/30"
                                                    : "border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-black/20 text-slate-600 dark:text-gray-400 hover:border-slate-300 dark:hover:border-white/20"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">Spectator Mode</span>
                                                {playMode === 'sidebets_only' && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-snug">
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

                    {/* League Governance + Executive Hub: Cleanly balanced side-by-side with Personal Details */}
                    {isAdminView && (
                        <div className="space-y-4">
                            {renderLeagueGovernance()}

                            {/* Executive Controls: 2x2 grid nestled directly below League Governance to eliminate dead space */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                            Executive Controls & Hub
                                        </h3>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">
                                            Quick access to roster, rules, security, and credentials
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Tile 1: Members Directory */}
                                    <div
                                        onClick={() => {
                                            haptics.selection();
                                            setShowMembersModal(true);
                                        }}
                                        className="fc-card group p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[130px] text-slate-900 dark:text-white"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                                <Users className="w-4 h-4" />
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                {activeMembersCount} Members
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                                Active Members
                                            </h4>
                                            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium mt-0.5 leading-snug">
                                                Roster, activation status & onboarding
                                            </p>
                                        </div>
                                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                            <span>Manage Roster</span>
                                            <span>→</span>
                                        </div>
                                    </div>

                                    {/* Tile 2: Succession & League Controls */}
                                    <div
                                        onClick={() => {
                                            haptics.selection();
                                            setShowDangerZoneModal(true);
                                        }}
                                        className="fc-card group p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#161d24] border border-rose-200/80 dark:border-rose-500/25 hover:border-rose-400 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[130px] text-slate-900 dark:text-white"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                                                <ShieldAlert className="w-4 h-4" />
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                Admin
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                                Succession & Controls
                                            </h4>
                                            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium mt-0.5 leading-snug">
                                                Transfer chairmanship or delete league
                                            </p>
                                        </div>
                                        <div className="mt-2.5 pt-2 border-t border-rose-100 dark:border-white/5 flex items-center justify-between text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                            <span>Open Controls</span>
                                            <span>→</span>
                                        </div>
                                    </div>

                                    {/* Tile 3: Chama Constitution & Docs */}
                                    <div
                                        onClick={() => {
                                            haptics.selection();
                                            setShowDocsModal(true);
                                        }}
                                        className="fc-card group p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/10 hover:border-amber-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[130px] text-slate-900 dark:text-white"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                                                <BookOpen className="w-4 h-4" />
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                Guide
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                                Chama Constitution
                                            </h4>
                                            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium mt-0.5 leading-snug">
                                                Official rulebook, payout schedule & FAQ
                                            </p>
                                        </div>
                                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                            <span>Read Manual</span>
                                            <span>→</span>
                                        </div>
                                    </div>

                                    {/* Tile 4: Account & Security */}
                                    <div
                                        onClick={() => {
                                            haptics.selection();
                                            setShowSessionModal(true);
                                        }}
                                        className="fc-card group p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/10 hover:border-blue-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[130px] text-slate-900 dark:text-white"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                                <Fingerprint className="w-4 h-4" />
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                Security
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                Session Credentials
                                            </h4>
                                            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium mt-0.5 leading-snug">
                                                Authenticated UID, Chairman ID & tokens
                                            </p>
                                        </div>
                                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                            <span>View Credentials</span>
                                            <span>→</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Member View Chama Hub & Utilities (Only for non-admin) */}
                {!isAdminView && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                    Chama Hub & Utilities
                                </h3>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">
                                    Quick access to roster, rules, security, and credentials
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            {/* Member Tile 1: Active Members Directory */}
                            <div
                                onClick={() => {
                                    haptics.selection();
                                    setShowMembersModal(true);
                                }}
                                className="fc-card group p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[140px] text-slate-900 dark:text-white"
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        {activeMembersCount} Members
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                        Active Members
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium mt-0.5 leading-snug">
                                        View roster & member status
                                    </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <span>View Roster</span>
                                    <span>→</span>
                                </div>
                            </div>

                            {/* Member Tile 2: Chama Constitution & Docs */}
                            <div
                                onClick={() => {
                                    haptics.selection();
                                    setShowDocsModal(true);
                                }}
                                className="fc-card group p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/10 hover:border-amber-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[140px] text-slate-900 dark:text-white"
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        Guide
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                        Chama Constitution
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium mt-0.5 leading-snug">
                                        Official rulebook, payout schedule & FAQ manual
                                    </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                    <span>Read Manual</span>
                                    <span>→</span>
                                </div>
                            </div>

                            {/* Member Tile 3: Account & Security */}
                            <div
                                onClick={() => {
                                    haptics.selection();
                                    setShowSessionModal(true);
                                }}
                                className="fc-card group p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161d24] border border-slate-200 dark:border-white/10 hover:border-blue-500/50 shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[140px] text-slate-900 dark:text-white"
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                        <Fingerprint className="w-5 h-5" />
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        Security
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        Session Credentials
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium mt-0.5 leading-snug">
                                        Authenticated UID & access tokens
                                    </p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                    <span>View Credentials</span>
                                    <span>→</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Theme switcher */}
                {renderThemeSelector()}
            </div>

            {/* Members Directory Modal */}
            {showMembersModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#121820] border border-slate-200 dark:border-white/10 rounded-[2rem] p-5 sm:p-7 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-slate-900 dark:text-white">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#121820]/95 backdrop-blur-sm z-20">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-xs">
                                    <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                        Active Members Directory
                                    </h3>
                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">
                                        {activeMembersCount} registered managers · Click members to manage
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { haptics.selection(); setShowMembersModal(false); }}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {renderActiveMembersStrip('!border-0 !shadow-none !bg-transparent !p-0')}
                    </div>
                </div>,
                document.body
            )}

            {/* League Settings & Rules Modal */}
            {renderLeagueSettingsModal()}

            {/* Danger Zone / Succession Modal */}
            {showDangerZoneModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#121820] border border-rose-300 dark:border-rose-500/30 rounded-[2rem] p-5 sm:p-7 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-slate-900 dark:text-white">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-rose-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#121820]/95 backdrop-blur-sm z-20">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shadow-xs">
                                    <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                        Succession & League Controls
                                    </h3>
                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">
                                        Transfer ownership or delete the entire chama
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { haptics.selection(); setShowDangerZoneModal(false); }}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {renderOwnershipAndDangerZoneCard('!border-0 !shadow-none !bg-transparent !p-0')}
                    </div>
                </div>,
                document.body
            )}

            {/* Session Credentials Modal */}
            {showSessionModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#121820] border border-slate-200 dark:border-white/10 rounded-[2rem] p-5 sm:p-7 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-slate-900 dark:text-white">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#121820]/95 backdrop-blur-sm z-20">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shadow-xs">
                                    <Fingerprint className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                        Account & Session Credentials
                                    </h3>
                                    <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">
                                        Cryptographic identifiers and authenticated session details
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { haptics.selection(); setShowSessionModal(false); }}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {renderSessionDetailsContent()}
                    </div>
                </div>,
                document.body
            )}

            {/* Warning Modal */}
            <ConfirmModal
                isOpen={showWarningModal}
                onClose={() => setShowWarningModal(false)}
                onConfirm={() => {
                    setShowWarningModal(false);
                    setIsFinancialsLocked(false);
                }}
                title="Modify Core Logistics?"
                message="Altering the financial rules mid-season recalculates all projected vaults and weekly payouts. Are you sure you wish to unlock these controls?"
                confirmText="Yes, Unlock"
                cancelText="Cancel"
                variant="warning"
            />

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

            {/* Chairman Retirement & Succession Confirmation Modal */}
            <ConfirmModal
                isOpen={showRetireModal}
                onClose={() => setShowRetireModal(false)}
                onConfirm={handleRetireChairman}
                title="Transfer Chairmanship & Step Down?"
                message={`Are you sure you want to transfer full Chairmanship to ${members.find(m => m.id === selectedSuccessorId)?.displayName || 'the selected manager'}? They will become the primary administrator with authority over the pot, payouts, and rules. You will return to a standard member.`}
                confirmText="Yes, Transfer Chairmanship"
                cancelText="Cancel"
                variant="danger"
                isLoading={isRetiring}
            />

            {/* Delete League Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteLeagueModal}
                onClose={() => setShowDeleteLeagueModal(false)}
                onConfirm={handleDeleteLeague}
                title={`Delete ${leagueName || 'League'}?`}
                message={`Are you completely sure you want to permanently delete "${leagueName || 'this league'}"? All member rosters, gameweek history, pots, and settings will be permanently erased. This action cannot be reversed.`}
                confirmText="Yes, Delete League"
                cancelText="Cancel"
                variant="danger"
                isLoading={isDeletingLeague}
            />

            {/* Chama Constitution & Guides Modal */}
            <DocsModal
                isOpen={showDocsModal}
                onClose={() => setShowDocsModal(false)}
            />

        </div>
    );
}
