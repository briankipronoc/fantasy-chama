import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Shield, User, ArrowRight, ArrowLeft, Mail, KeyRound, Phone, Smartphone, AlertCircle, Eye, EyeOff, Trophy, Swords, Sparkles, CheckCircle2, X, Search, Check, ChevronDown, Crown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, updateDoc, addDoc, doc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signInAnonymously, sendPasswordResetEmail } from 'firebase/auth';
import { normalizeKenyanPhone, getPhoneVariants } from '../utils/phone';

export default function Login() {
    const location = useLocation();
    const [isAdminView, setIsAdminView] = useState(location.state?.isAdminView || false);

    // Member State
    const [phone, setPhone] = useState('');
    const [isPhoneLocked, setIsPhoneLocked] = useState(false);
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Self-onboarding state (for users joining via WhatsApp invite code)
    const [showSelfOnboardModal, setShowSelfOnboardModal] = useState(false);
    const [onboardData, setOnboardData] = useState<{
        leagueId: string;
        leagueName: string;
        monthlyFee: number;
        phone: string;
        userUid: string;
        currentGw: number;
        unlinkedTeams: any[];
        invitedBy: string;
    } | null>(null);
    const [selectedTeamClaim, setSelectedTeamClaim] = useState<string>('custom');
    const [onboardManagerName, setOnboardManagerName] = useState('');
    const [onboardTeamName, setOnboardTeamName] = useState('');
    const [customFplId, setCustomFplId] = useState('');
    const [onboardSearch, setOnboardSearch] = useState('');
    const [onboardPlayMode, setOnboardPlayMode] = useState<'pot' | 'season_only' | 'sidebets_only'>('pot');
    const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);
    const [onboardStep, setOnboardStep] = useState<1 | 2 | 3>(1);
    const [onboardError, setOnboardError] = useState('');
    const [previewLeague, setPreviewLeague] = useState<{
        name: string;
        memberNames: string[];
        totalMembers: number;
    } | null>(null);

    const [loginTransition, setLoginTransition] = useState<{
        leagueName: string;
        memberName: string;
        members: string[];
        totalCount: number;
        step: number;
    } | null>(null);

    const filteredUnlinkedTeams = useMemo(() => {
        if (!onboardData?.unlinkedTeams) return [];
        if (!onboardSearch.trim()) return onboardData.unlinkedTeams;
        const q = onboardSearch.toLowerCase().trim();
        return onboardData.unlinkedTeams.filter((t: any) =>
            (t.displayName || '').toLowerCase().includes(q) ||
            (t.fplTeamName || '').toLowerCase().includes(q) ||
            (t.teamName || '').toLowerCase().includes(q)
        );
    }, [onboardData?.unlinkedTeams, onboardSearch]);

    // Admin State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [infoMessage, setInfoMessage] = useState('');
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    const navigate = useNavigate();
    const setRole = useStore((state) => state.setRole);

    // Mount Effect: handle URL invite codes and restore preferences
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code');
        const urlExpires = params.get('e');
        const urlPhone = params.get('phone') || params.get('p');

        if (urlExpires && Date.now() > parseInt(urlExpires)) {
            setError('This invite link has expired. Request a new one from your Chairman.');
            return;
        }

        if (urlCode && urlCode.length === 6) {
            // Invite link is strictly for a member joining this league!
            // Never show Chairman Sign In when following an invite link
            setIsAdminView(false);
            localStorage.setItem('fc-login-admin-view', 'false');

            const upperCode = urlCode.toUpperCase();
            const chars = upperCode.split('');
            setCode(chars);

            let initialPhone = '';
            if (urlPhone) {
                initialPhone = normalizeKenyanPhone(urlPhone);
                setPhone(initialPhone);
                setIsPhoneLocked(true);
            } else {
                initialPhone = localStorage.getItem('fc-login-phone') || '';
                setPhone(initialPhone);
            }

            // Auto-launch the Self-Onboarding Wizard immediately for the invited member
            startOnboardingForLeague(upperCode, initialPhone);
        } else {
            const savedAdminView = localStorage.getItem('fc-login-admin-view');
            if (savedAdminView !== null) setIsAdminView(savedAdminView === 'true');

            setPhone(localStorage.getItem('fc-login-phone') || '');
            const savedCode = (localStorage.getItem('fc-login-code') || '').slice(0, 6);
            setCode(Array.from({ length: 6 }, (_, index) => savedCode[index] || ''));
        }

        setEmail(localStorage.getItem('fc-login-email') || '');
    }, []);

    useEffect(() => { localStorage.setItem('fc-login-admin-view', String(isAdminView)); }, [isAdminView]);
    useEffect(() => { localStorage.setItem('fc-login-phone', phone); }, [phone]);
    useEffect(() => { localStorage.setItem('fc-login-email', email); }, [email]);
    useEffect(() => { localStorage.setItem('fc-login-code', code.join('')); }, [code]);

    const handleCodeChange = (index: number, value: string) => {
        if (!/^[A-Za-z0-9]*$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value.toUpperCase();
        setCode(newCode);
        if (value && index < 5) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    // OTP Paste handler — distributes a pasted 6-char string across all cells
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\s/g, '').toUpperCase().slice(0, 6);
        if (!/^[A-Za-z0-9]+$/.test(pasted)) return;
        const newCode = ['', '', '', '', '', ''];
        pasted.split('').forEach((char, i) => { newCode[i] = char; });
        setCode(newCode);
        // Focus the last filled box
        const lastIdx = Math.min(pasted.length - 1, 5);
        setTimeout(() => inputRefs.current[lastIdx]?.focus(), 0);
    };

    // Pre-warm anonymous session on mount to eliminate cold-start auth latency
    useEffect(() => {
        if (!auth.currentUser) {
            signInAnonymously(auth).catch(err => {
                console.warn("[login] Pre-auth anonymous session deferred:", err);
            });
        }
    }, []);

    // Social proof: preview who has already joined the league when 6-digit code is ready
    useEffect(() => {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setPreviewLeague(null);
            return;
        }

        let isMounted = true;
        (async () => {
            try {
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
                const leaguesRef = collection(db, 'leagues');
                const qLeague = query(leaguesRef, where("inviteCode", "==", fullCode));
                const snap = await getDocs(qLeague);
                if (snap.empty || !isMounted) return;

                const leagueDoc = snap.docs[0];
                const lData = leagueDoc.data();
                const membershipsRef = collection(db, 'leagues', leagueDoc.id, 'memberships');
                const membersSnap = await getDocs(membershipsRef);
                
                if (!isMounted) return;
                const names: string[] = [];
                membersSnap.docs.forEach(docSnap => {
                    const d = docSnap.data();
                    const rawName = (d.displayName || d.name || '').trim();
                    if (rawName && d.isActive !== false && d.role !== 'admin') {
                        const firstName = rawName.split(' ')[0];
                        if (firstName && !names.includes(firstName)) {
                            names.push(firstName);
                        }
                    }
                });

                setPreviewLeague({
                    name: lData.name || 'FPL Chama',
                    memberNames: names.slice(0, 3),
                    totalMembers: membersSnap.docs.filter(d => d.data().isActive !== false && d.data().role !== 'admin').length,
                });
            } catch (err) {
                console.warn("Could not fetch preview league members:", err);
            }
        })();

        return () => { isMounted = false; };
    }, [code]);

    const startOnboardingForLeague = async (fullCode: string, userPhone?: string) => {
        if (!fullCode || fullCode.length !== 6) return;

        setError('');
        setInfoMessage('');
        setIsLoading(true);

        try {
            console.log("1. Member Onboarding/Login Initiated with code:", fullCode);

            // Ensure anonymous Firebase Auth session exists BEFORE querying leagues/memberships
            let currentAuthUser = auth.currentUser;
            if (!currentAuthUser) {
                try {
                    const userCredential = await signInAnonymously(auth);
                    currentAuthUser = userCredential.user;
                } catch (authErr) {
                    console.warn("[login] Auth sign-in retry:", authErr);
                    const userCredential = await signInAnonymously(auth);
                    currentAuthUser = userCredential.user;
                }
            }
            const userUid = currentAuthUser?.uid || 'anon_' + Date.now();

            // 1. Find the League by the 6-Digit Code
            const leaguesRef = collection(db, 'leagues');
            const qLeague = query(leaguesRef, where("inviteCode", "==", fullCode.toUpperCase()));

            let leagueSnapshot: any;
            try {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database connection timeout. Check your network.")), 25000));
                leagueSnapshot = await Promise.race([getDocs(qLeague), timeoutPromise]);
            } catch (queryErr) {
                console.warn("First query attempt delayed, retrying immediately...", queryErr);
                leagueSnapshot = await getDocs(qLeague);
            }

            if (!leagueSnapshot || leagueSnapshot.empty) {
                console.warn("Invalid Invite Code verified on DB.");
                setError("Invalid Invite Code. Ask your Chairman.");
                return;
            }

            const leagueData = leagueSnapshot.docs[0];
            const leagueId = leagueData.id;

            // 2. Check if the user is already on the Chairman's pre-approved / loaded member list
            const membershipsRef = collection(db, 'leagues', leagueId, 'memberships');
            const allMembersSnap = await getDocs(membershipsRef);

            const activePhone = userPhone || phone;
            if (activePhone) {
                const phoneVariants = getPhoneVariants(activePhone);
                const normalizedInput = normalizeKenyanPhone(activePhone);
                const cleanDigitsInput = activePhone.replace(/\D/g, '');

                const matchedMemberDoc = allMembersSnap.docs.find(d => {
                    const data = d.data();
                    const p1 = data.phone ? normalizeKenyanPhone(String(data.phone)) : '';
                    const p2 = data.phoneNumber ? normalizeKenyanPhone(String(data.phoneNumber)) : '';
                    const cleanP1 = String(data.phone || '').replace(/\D/g, '');
                    const cleanP2 = String(data.phoneNumber || '').replace(/\D/g, '');

                    const matchesVariant = phoneVariants.includes(data.phone) || phoneVariants.includes(data.phoneNumber);
                    const matchesNormalized = (p1 && p1 === normalizedInput) || (p2 && p2 === normalizedInput);
                    const matchesLast9 = cleanDigitsInput.length >= 8 && (
                        (cleanP1.length >= 8 && cleanP1.endsWith(cleanDigitsInput.slice(-8))) ||
                        (cleanP2.length >= 8 && cleanP2.endsWith(cleanDigitsInput.slice(-8))) ||
                        (cleanDigitsInput.length >= 9 && cleanP1.endsWith(cleanDigitsInput.slice(-9))) ||
                        (cleanDigitsInput.length >= 9 && cleanP2.endsWith(cleanDigitsInput.slice(-9)))
                    );

                    return (matchesVariant || matchesNormalized || matchesLast9) && data.isPending !== true;
                });

                if (matchedMemberDoc) {
                    const memberDocRef = matchedMemberDoc.ref;
                    try {
                        await updateDoc(memberDocRef, { authUid: userUid });
                    } catch (updateErr) {
                        console.warn("[login] Non-critical: could not update authUid on member document:", updateErr);
                    }

                    const memberData = matchedMemberDoc.data();

                    // Save session to localStorage
                    localStorage.setItem('activeLeagueId', leagueId);
                    localStorage.setItem('memberPhone', activePhone);
                    localStorage.setItem('activeUserId', memberDocRef.id);

                    // Clear sensitive login inputs from localStorage after success
                    localStorage.removeItem('fc-login-code');
                    localStorage.removeItem('fc-login-phone');

                    // Extract active member names to show the user during the warm-up transition
                    const rawNames: string[] = [];
                    allMembersSnap.docs.forEach(docSnap => {
                        const d = docSnap.data();
                        const raw = (d.displayName || d.name || '').trim();
                        if (raw && d.isActive !== false && d.role !== 'admin') {
                            const first = raw.split(' ')[0];
                            if (first && !rawNames.includes(first)) rawNames.push(first);
                        }
                    });

                    const leagueDocData = leagueData.data();
                    const leagueDisplayName = leagueDocData?.name || 'FPL Chama';

                    setLoginTransition({
                        leagueName: leagueDisplayName,
                        memberName: memberData.displayName || 'Manager',
                        members: rawNames,
                        totalCount: allMembersSnap.docs.filter(d => d.data().isActive !== false && d.data().role !== 'admin').length,
                        step: 1
                    });

                    setTimeout(() => {
                        setLoginTransition(prev => prev ? { ...prev, step: 2 } : null);
                    }, 1100);

                    setTimeout(() => {
                        setLoginTransition(prev => prev ? { ...prev, step: 3 } : null);
                    }, 2300);

                    setTimeout(() => {
                        setShowSelfOnboardModal(false);
                        setRole('member');
                        navigate('/dashboard', { state: { welcomeMsg: `Welcome back, ${memberData.displayName}!` }, replace: true });
                    }, 3500);

                    return;
                }
            }

            // User is not yet registered: launch Self-Onboarding wizard
            console.log("Loading league details for self-onboarding wizard...");
            const unlinked = allMembersSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(m => (!m.phone && !m.phoneNumber) || m.isPending === true);

            const leagueDocData = leagueData.data();
            const leagueFplId = leagueDocData?.fplLeagueId;

            // If Chairman set up an FPL league number, pull unclaimed squads strictly for THIS league
            if (leagueFplId) {
                try {
                    const existingClaimedIds = new Set(
                        allMembersSnap.docs
                            .map(d => d.data())
                            .filter((m: any) => (m.phone || m.phoneNumber) && m.isPending !== true)
                            .map((m: any) => String(m.fplTeamId || m.entry || ''))
                            .filter(Boolean)
                    );
                    const existingClaimedNames = new Set(
                        allMembersSnap.docs
                            .map(d => d.data())
                            .filter((m: any) => (m.phone || m.phoneNumber) && m.isPending !== true)
                            .map((m: any) => (m.displayName || '').toLowerCase().trim())
                            .filter(Boolean)
                    );

                    const standingsRes = await fetch(`/fpl-api/leagues-classic/${leagueFplId}/standings/`);
                    if (standingsRes.ok) {
                        const standingsData = await standingsRes.json();
                        const results = standingsData?.standings?.results || [];

                        const fplUnlinked = results
                            .filter((r: any) =>
                                !existingClaimedIds.has(String(r.entry)) &&
                                !existingClaimedNames.has((r.player_name || '').toLowerCase().trim()) &&
                                !unlinked.some((u: any) => String(u.fplTeamId || u.entry) === String(r.entry) || (u.displayName || '').toLowerCase().trim() === (r.player_name || '').toLowerCase().trim())
                            )
                            .map((r: any) => ({
                                id: `fpl_${r.entry}`,
                                isFplApiImport: true,
                                displayName: r.player_name,
                                fplTeamName: r.entry_name,
                                teamName: r.entry_name,
                                fplTeamId: r.entry,
                                entry: r.entry,
                                isPending: true,
                            }));

                        unlinked.push(...fplUnlinked);
                    }
                } catch (fplErr) {
                    console.warn("Could not fetch FPL standings for league self-onboarding:", fplErr);
                }
            }

            let detectedGw = leagueDocData?.currentGw || leagueDocData?.startGw || 1;
            try {
                const res = await fetch('/fpl-api/bootstrap-static/');
                if (res.ok) {
                    const boot = await res.json();
                    const cur = boot.events?.find((ev: any) => ev.is_current) || boot.events?.find((ev: any) => ev.is_next);
                    if (cur?.id) detectedGw = cur.id;
                }
            } catch {
                // fallback to detectedGw
            }

            const chairmanMember = allMembersSnap.docs
                .map(d => d.data())
                .find((m: any) => m.role === 'admin' || m.role === 'chairman');
            const invitedBy = leagueDocData?.chairmanName || chairmanMember?.displayName || 'The Chairman';
            const finalLeagueName = leagueDocData?.leagueName || leagueDocData?.name || 'Fantasy Chama';
            const finalMonthlyFee = Number(leagueDocData?.monthlyFee || leagueDocData?.gameweekStake || 0);

            setOnboardData({
                leagueId,
                leagueName: finalLeagueName,
                monthlyFee: finalMonthlyFee,
                phone: activePhone || '',
                userUid,
                currentGw: detectedGw,
                unlinkedTeams: unlinked,
                invitedBy,
            });

            if (unlinked.length > 0) {
                setSelectedTeamClaim(unlinked[0].id);
                setOnboardManagerName(unlinked[0].displayName || '');
                setOnboardTeamName(unlinked[0].fplTeamName || unlinked[0].teamName || '');
            } else {
                setSelectedTeamClaim('custom');
                setOnboardManagerName('');
                setOnboardTeamName('');
            }

            setOnboardStep(1);
            setShowSelfOnboardModal(true);

        } catch (err) {
            console.error(err);
            setError("Something went wrong connecting to the vault. Check your internet connection.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullCode = code.join('');
        if (!phone || fullCode.length !== 6) return;
        await startOnboardingForLeague(fullCode, phone);
    };

    const handleCompleteOnboarding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!onboardData) return;
        setOnboardError('');
        setIsOnboardingSubmitting(true);

        try {
            const rawPhone = (phone || onboardData.phone || '').trim();
            const targetPhone = normalizeKenyanPhone(rawPhone);
            if (!targetPhone || targetPhone.length < 10) {
                setOnboardError('Please enter a valid Kenyan M-Pesa phone number (e.g. 0712345678).');
                setIsOnboardingSubmitting(false);
                return;
            }

            // Ensure anonymous Firebase Auth session exists before querying or writing memberships
            let currentAuthUser = auth.currentUser;
            if (!currentAuthUser) {
                try {
                    const userCredential = await signInAnonymously(auth);
                    currentAuthUser = userCredential.user;
                } catch (authErr) {
                    console.warn("[onboarding] Auth sign-in retry:", authErr);
                    try {
                        const userCredential = await signInAnonymously(auth);
                        currentAuthUser = userCredential.user;
                    } catch (e) {
                        console.error("[onboarding] Critical auth failure:", e);
                    }
                }
            }
            const activeAuthUid = currentAuthUser?.uid || onboardData.userUid;

            // If this phone is already an active member in this league, sign them in directly!
            let matchedExisting: any = null;
            if (selectedTeamClaim === 'custom') {
                try {
                    const membershipsRef = collection(db, 'leagues', onboardData.leagueId, 'memberships');
                    const allMembersSnap = await getDocs(membershipsRef);
                    matchedExisting = allMembersSnap.docs.find(d => {
                        const data = d.data();
                        const p1 = data.phone ? normalizeKenyanPhone(String(data.phone)) : '';
                        const p2 = data.phoneNumber ? normalizeKenyanPhone(String(data.phoneNumber)) : '';
                        return (p1 === targetPhone || p2 === targetPhone) && data.isPending !== true;
                    });
                } catch (e) {
                    console.warn("[onboarding] Existing member check warning:", e);
                }
            }

            if (matchedExisting) {
                localStorage.setItem('activeLeagueId', onboardData.leagueId);
                localStorage.setItem('memberPhone', targetPhone);
                localStorage.setItem('activeUserId', matchedExisting.id);
                localStorage.setItem('activeUserName', matchedExisting.data().displayName || 'Manager');
                setShowSelfOnboardModal(false);
                setRole('member');
                navigate('/dashboard', { state: { welcomeMsg: `Welcome back, ${matchedExisting.data().displayName}!` }, replace: true });
                return;
            }

            let finalDisplayName = onboardManagerName.trim();
            let finalTeamName = onboardTeamName.trim();

            if (selectedTeamClaim !== 'custom') {
                const claimed = onboardData.unlinkedTeams.find(t => t.id === selectedTeamClaim);
                if (claimed) {
                    if (!finalDisplayName) finalDisplayName = claimed.displayName || '';
                    if (!finalTeamName) finalTeamName = claimed.fplTeamName || claimed.teamName || claimed.displayName || '';
                }
            }

            if (!finalDisplayName) {
                finalDisplayName = onboardManagerName.trim() || 'Manager';
            }
            if (!finalTeamName) {
                finalTeamName = onboardTeamName.trim() || finalDisplayName || 'FPL Squad';
            }

            let memberId = selectedTeamClaim;

            if (selectedTeamClaim !== 'custom' && !selectedTeamClaim.startsWith('fpl_')) {
                const claimed = onboardData.unlinkedTeams.find(t => t.id === selectedTeamClaim);
                const memberRef = doc(db, 'leagues', onboardData.leagueId, 'memberships', selectedTeamClaim);
                await updateDoc(memberRef, {
                    phone: targetPhone,
                    displayName: finalDisplayName,
                    fplTeamName: finalTeamName || finalDisplayName,
                    teamName: finalTeamName || finalDisplayName,
                    fplTeamId: claimed?.fplTeamId || claimed?.entry || null,
                    isPending: false,
                    isActive: true,
                    role: claimed?.role || 'member',
                    playMode: onboardPlayMode,
                    joinedGw: onboardData.currentGw,
                    authUid: activeAuthUid,
                    walletBalance: 0,
                    hasPaid: false,
                    updatedAt: serverTimestamp(),
                });
            } else {
                const claimed = onboardData.unlinkedTeams.find(t => t.id === selectedTeamClaim);
                const numericFplId = claimed?.fplTeamId || claimed?.entry || (customFplId.trim() && !isNaN(Number(customFplId.trim())) ? Number(customFplId.trim()) : null);

                const docRef = await addDoc(collection(db, 'leagues', onboardData.leagueId, 'memberships'), {
                    phone: targetPhone,
                    displayName: finalDisplayName,
                    fplTeamName: finalTeamName || finalDisplayName,
                    teamName: finalTeamName || finalDisplayName,
                    fplTeamId: numericFplId,
                    isPending: false,
                    isActive: true,
                    role: 'member',
                    playMode: onboardPlayMode,
                    joinedGw: onboardData.currentGw,
                    authUid: activeAuthUid,
                    walletBalance: 0,
                    hasPaid: false,
                    totalEarned: 0,
                    paymentStreak: 0,
                    createdAt: serverTimestamp(),
                });
                memberId = docRef.id;
            }

            // Non-blocking background sync for userLeagues and join notification
            const leagueId = onboardData.leagueId;
            const leagueName = onboardData.leagueName;
            (async () => {
                try {
                    const userLeagueRef = doc(db, 'userLeagues', targetPhone);
                    const snap = await getDoc(userLeagueRef);
                    const currentLeagues = snap.exists() ? (snap.data().leagues || []) : [];
                    if (!currentLeagues.includes(leagueId)) {
                        await setDoc(userLeagueRef, {
                            phone: targetPhone,
                            leagues: [...currentLeagues, leagueId],
                            updatedAt: serverTimestamp()
                        }, { merge: true });
                    }
                } catch (ulErr) {
                    console.warn("[onboarding] Background userLeagues sync:", ulErr);
                }

                try {
                    const tierLabel = onboardPlayMode === 'pot' 
                        ? '🏆 Cash Pot Contributor' 
                        : onboardPlayMode === 'season_only'
                        ? '👑 Season Vault Only'
                        : '🛡️ Spectator & Side-Bets Only';
                    await addDoc(collection(db, 'leagues', leagueId, 'notifications'), {
                        type: 'member_joined',
                        eventType: 'member_joined',
                        title: 'New Member Self-Onboarded',
                        message: `${finalDisplayName} joined ${leagueName} (${tierLabel}).`,
                        createdAt: serverTimestamp(),
                    });
                } catch (notifErr) {
                    console.warn("[onboarding] Background notification:", notifErr);
                }
            })().catch(bgErr => console.warn("[onboarding] Background tasks:", bgErr));

            // Save active session to localStorage
            localStorage.setItem('activeLeagueId', leagueId);
            localStorage.setItem('memberPhone', targetPhone);
            localStorage.setItem('activeUserId', memberId);
            localStorage.setItem('activeUserName', finalDisplayName);

            // Clean up old dismissed flags so constitution displays once for newly onboarded profile
            try {
                localStorage.removeItem('fc_constitution_dismissed');
                localStorage.removeItem(`fc_rules_accepted_${leagueId}`);
                localStorage.removeItem(`fc_constitution_dismissed_${leagueId}`);
                sessionStorage.setItem('fc_show_constitution_onboarded', 'true');
            } catch {}

            localStorage.removeItem('fc-login-code');
            localStorage.removeItem('fc-login-phone');

            setShowSelfOnboardModal(false);
            setRole('member');
            navigate('/dashboard', {
                state: {
                    welcomeMsg: `Welcome to ${leagueName}, ${finalDisplayName}! ${onboardPlayMode === 'sidebets_only' ? 'You are in Free Spectator & Side-Bets mode.' : 'Your spot in the chama is confirmed.'}`,
                    showConstitution: true
                },
                replace: true,
            });

        } catch (err: any) {
            console.error("Self-onboarding error:", err);
            setOnboardError(err?.message || "Failed to complete onboarding. Please try again.");
        } finally {
            setIsOnboardingSubmitting(false);
        }
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please enter both email and password.');
            return;
        }

        setError('');
        setInfoMessage('');
        setIsLoading(true);

        try {
            console.log("1. Authenticating Chairman with Firebase Auth...");
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("2. Auth Success! User UID:", user.uid);

            console.log("3. Creating connection to master ledger...");
            const leaguesRef = collection(db, 'leagues');
            const qLeague = query(leaguesRef, where("chairmanId", "==", user.uid));

            // Firebase Firestore sometimes hangs infinitely if the connection is blocked by adblockers.
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database connection timeout. Ensure you are not blocking Firebase (e.g. Brave Shields, Adblocker).")), 10000));
            const fetchPromise = getDocs(qLeague);

            const leagueSnapshot = await Promise.race([fetchPromise, timeoutPromise]) as any;

            console.log("4. Connection established. Returned snapshot size:", leagueSnapshot.size);

            if (!leagueSnapshot.empty) {
                // Prefer currently active league if it belongs to this chairman
                const existingActiveId = localStorage.getItem('activeLeagueId');
                const matchedDoc = existingActiveId ? leagueSnapshot.docs.find((d: any) => d.id === existingActiveId) : null;

                // Otherwise sort by newest created league
                const sortedDocs = [...leagueSnapshot.docs].sort((a: any, b: any) => {
                    const aTs = a.data()?.createdAt?.toDate ? a.data().createdAt.toDate().getTime() : 0;
                    const bTs = b.data()?.createdAt?.toDate ? b.data().createdAt.toDate().getTime() : 0;
                    return bTs - aTs;
                });

                const selectedDoc = matchedDoc || sortedDocs[0];
                const leagueId = selectedDoc.id;
                const leagueData = selectedDoc.data();
                localStorage.setItem('activeLeagueId', leagueId);
                if (leagueData?.chairmanPhone) {
                    localStorage.setItem('memberPhone', leagueData.chairmanPhone);
                }
                console.log("5. Active League ID bound to session:", leagueId);

                // Find the Chairman's membership doc to set activeUserId and phone
                const membershipsRef = collection(db, 'leagues', leagueId, 'memberships');
                const qAdminMember = query(membershipsRef, where("role", "==", "admin"));
                const adminMemberSnap = await getDocs(qAdminMember);
                if (!adminMemberSnap.empty) {
                    const adminDoc = adminMemberSnap.docs[0];
                    localStorage.setItem('activeUserId', adminDoc.id);
                    if (adminDoc.data()?.phone) {
                        localStorage.setItem('memberPhone', adminDoc.data().phone);
                    }
                }

            } else {
                console.log("5. No active league ID found for Chairman!");
            }

            console.log("6. Opening Dashboard portal...");
            setRole('admin');
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            console.error(err);
            if (
                err.code === 'auth/invalid-credential' ||
                err.code === 'auth/user-not-found' ||
                err.code === 'auth/wrong-password' ||
                err.code === 'auth/invalid-email'
            ) {
                setError('Invalid email or password. Check your credentials and try again.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Too many failed attempts. Please wait a few minutes or reset your password.');
            } else if (err.message?.includes('timeout')) {
                setError('Connection timeout — check your internet or disable any ad-blockers.');
            } else {
                setError('Authentication failed. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fc-auth-shell min-h-screen bg-[#0b1014] flex flex-col items-center justify-center relative overflow-hidden text-white font-sans w-full">

            {/* ── Ambient background grid ─────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none z-0" />

            {/* Network background graphic simulation (bottom right) */}
            <div className="fc-auth-network absolute right-[-10%] bottom-[-10%] w-[600px] h-[600px] opacity-20 pointer-events-none">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <path fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" d="M10,100 L190,100 M100,10 L100,190 M30,30 L170,170 M30,170 L170,30" />
                    <circle cx="10" cy="100" r="1.5" fill="rgba(255,255,255,0.3)" />
                    <circle cx="190" cy="100" r="1.5" fill="rgba(255,255,255,0.3)" />
                    <circle cx="100" cy="10" r="1.5" fill="rgba(255,255,255,0.3)" />
                    <circle cx="100" cy="190" r="1.5" fill="rgba(255,255,255,0.3)" />
                    <circle cx="100" cy="100" r="3" fill="rgba(255,255,255,0.5)" />
                </svg>
            </div>

            {/* Header Elements */}
            <div className="absolute top-0 w-full p-6 md:p-8 flex justify-between items-center z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-[#10B981] p-1.5 md:p-2 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <div className="w-4 h-4 md:w-5 md:h-5 border-[2.5px] border-[#0b1014] rounded-md flex items-center justify-center relative">
                            <div className="w-1.5 h-1.5 bg-[#0b1014] rounded-sm absolute right-0.5"></div>
                        </div>
                    </div>
                    <span className="font-extrabold text-lg md:text-xl tracking-wide">FANTASY <span className="text-[#10B981]">CHAMA</span></span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 text-gray-500 text-xs md:text-sm font-medium">
                    <Shield className="w-3 h-3 md:w-4 md:h-4 text-[#22c55e]" />
                    <span>{isAdminView ? 'Chairman Login' : 'Member Login'}</span>
                </div>
            </div>

            {/* Main Card */}
            <div className="fc-auth-card w-[90%] max-w-md bg-gradient-to-b from-[#1c272c] to-[#11171a] border border-white/5 rounded-[2rem] p-6 md:p-10 z-10 shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 to-transparent rounded-[2rem] pointer-events-none"></div>

                {/* Staged Loading Overlay — reveals who has joined and preloads dashboard in background */}
                {loginTransition && (
                    <div className="absolute inset-0 z-30 bg-white/95 dark:bg-[#10171d]/95 backdrop-blur-2xl rounded-[2rem] p-6 md:p-8 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-300 border border-slate-200 dark:border-emerald-500/30 shadow-2xl text-slate-900 dark:text-white">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-4">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10B981]" />
                                Vault Connected
                            </div>
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                {loginTransition.leagueName}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 font-medium">
                                Welcome back, <span className="text-slate-900 dark:text-white font-bold">{loginTransition.memberName}</span>
                            </p>
                        </div>

                        {/* Member preview badges */}
                        <div className="p-4 rounded-2xl bg-slate-100/90 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 space-y-2.5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-400">
                                Active League Managers ({loginTransition.totalCount})
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {loginTransition.members.slice(0, 4).map((mName, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        {mName}
                                    </span>
                                ))}
                                {loginTransition.totalCount > 4 && (
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 px-1">
                                        +{loginTransition.totalCount - 4} others
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Dynamic Progress Steps */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-gray-300">
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-emerald-500 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                    {loginTransition.step === 1 && "Connecting to Escrow Vault..."}
                                    {loginTransition.step === 2 && "Syncing Managers & Standings..."}
                                    {loginTransition.step === 3 && "Opening Live Dashboard..."}
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">
                                    {loginTransition.step === 1 ? '35%' : loginTransition.step === 2 ? '75%' : '100%'}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out rounded-full"
                                    style={{ width: loginTransition.step === 1 ? '35%' : loginTransition.step === 2 ? '75%' : '100%' }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-center mb-8 relative z-10">
                    <h1 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight">
                        {isAdminView ? "Chairman Sign In" : "Join Your League"}
                    </h1>
                    <p className="text-gray-400 text-xs md:text-sm">
                        {isAdminView ? "Sign in to manage your league, members and payouts" : "Enter the invite code your chairman shared with you"}
                    </p>
                </div>

                {!isAdminView ? (
                    <form onSubmit={handleJoin} className="space-y-6 relative z-10 animate-in fade-in duration-300">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] md:text-xs font-medium p-3 rounded-lg flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Social proof: Show who has joined when invite code is prefilled or typed */}
                        {previewLeague && (
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm shrink-0 border border-emerald-500/30 shadow-sm">
                                    🏆
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-white truncate">
                                        {previewLeague.name}
                                    </p>
                                    <p className="text-[11px] text-emerald-300 font-medium truncate mt-0.5">
                                        {previewLeague.memberNames.length > 0
                                            ? `Join ${previewLeague.memberNames.join(', ')}${previewLeague.totalMembers > previewLeague.memberNames.length ? ` +${previewLeague.totalMembers - previewLeague.memberNames.length} others` : ''}`
                                            : `${previewLeague.totalMembers} managers competing`}
                                    </p>
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                    Active Pot
                                </span>
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Phone Number</label>
                            <div className="relative">
                                <Phone className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="tel"
                                    required
                                    autoComplete="tel"
                                    value={phone}
                                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid phone number')}
                                    disabled={isPhoneLocked}
                                    onChange={(e) => {
                                        (e.target as HTMLInputElement).setCustomValidity('');
                                        setPhone(normalizeKenyanPhone(e.target.value));
                                    }}
                                    onBlur={() => {
                                        if (phone) setPhone(normalizeKenyanPhone(phone));
                                    }}
                                    placeholder="0712 345 678"
                                    className="w-full bg-[#161d24] border border-white/5 rounded-xl py-3.5 md:py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">6-Character Invite Code</label>
                                <span className="text-[10px] text-gray-500 font-mono tracking-wider">e.g. CHM789</span>
                            </div>
                            <div className="flex justify-between gap-1.5 md:gap-2">
                                {code.map((digit, index) => {
                                    const hintChar = ['C', 'H', 'M', '7', '8', '9'][index];
                                    return (
                                        <input
                                            key={index}
                                            ref={(el) => inputRefs.current[index] = el}
                                            type="text"
                                            inputMode="text"
                                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                            maxLength={1}
                                            value={digit}
                                            placeholder={hintChar}
                                            onChange={(e) => handleCodeChange(index, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(index, e)}
                                            onPaste={handlePaste}
                                            className="w-10 h-12 md:w-12 md:h-14 bg-[#161d24] border border-white/5 rounded-xl text-center text-xl md:text-2xl font-bold text-white placeholder:text-gray-700/50 focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/50 transition-all shadow-inner uppercase"
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !phone || code.join('').length !== 6 || Boolean(loginTransition)}
                            className="w-full bg-[#22C55E] hover:bg-[#1fbb59] text-[#0A0E17] font-bold text-base md:text-lg py-3.5 md:py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading || loginTransition ? (
                                <><span className="w-5 h-5 border-2 border-[#0A0E17] border-t-transparent rounded-full animate-spin" /> Verifying & Connecting...</>
                            ) : (
                                <>Enter League <ArrowRight className="w-5 h-5 md:w-6 md:h-6" /></>
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleAdminLogin} className="space-y-6 relative z-10 animate-in fade-in duration-300">
                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Email Address</label>
                            <div className="relative">
                                <Mail className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    required
                                    autoComplete="email"
                                    pattern="^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
                                    value={email}
                                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid email address (e.g. name@domain.com)')}
                                    onChange={(e) => {
                                        (e.target as HTMLInputElement).setCustomValidity('');
                                        setEmail(e.target.value);
                                    }}
                                    placeholder="chairman@fantasychama.co.ke"
                                    className="w-full bg-[#161d24] border border-white/5 rounded-xl py-3.5 md:py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Secure Password</label>
                            <div className="relative">
                                <KeyRound className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-[#161d24] border border-white/5 rounded-xl py-3.5 md:py-4 pl-12 pr-12 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            <div className="flex justify-end mt-2">
                                <button
                                    type="button"
                                    disabled={isResettingPassword}
                                    onClick={async () => {
                                        setInfoMessage('');
                                        if (!email) {
                                            setError('Please enter your email first to receive a password reset link.');
                                            return;
                                        }
                                        setIsResettingPassword(true);
                                        try {
                                            const actionCodeSettings = {
                                                url: `${window.location.origin}/login`,
                                                handleCodeInApp: false,
                                            };
                                            await sendPasswordResetEmail(auth, email, actionCodeSettings);
                                            setError('');
                                            setInfoMessage(`A secure password reset link has been sent to ${email}. Check your inbox and spam folder. The link expires in 1 hour.`);
                                        } catch (err: any) {
                                            setError(err.message || 'Failed to dispatch reset link.');
                                        } finally {
                                            setIsResettingPassword(false);
                                        }
                                    }}
                                    className="text-[10px] md:text-xs text-[#FBBF24] font-bold hover:underline opacity-80 transition-opacity disabled:opacity-50"
                                >
                                    {isResettingPassword ? 'Sending link...' : 'Forgot password?'}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] md:text-xs font-medium p-3 rounded-lg flex items-start gap-2 mb-4">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {infoMessage && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] md:text-xs font-medium p-3 rounded-lg flex items-start gap-2 mb-4">
                                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{infoMessage}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !email || !password}
                            className="w-full bg-[#FBBF24] hover:bg-[#eab308] text-[#0A0E17] font-bold text-base md:text-lg py-3.5 md:py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(251,191,36,0.15)] mt-2 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isLoading ? "AUTHENTICATING..." : <>AUTHENTICATE <ArrowRight className="w-5 h-5 md:w-6 md:h-6" /></>}
                        </button>

                        <div className="mt-4 text-center">
                            <p className="text-[11px] md:text-xs text-gray-600 dark:text-gray-400">
                                New Chairman? <button type="button" onClick={() => navigate('/setup')} className="text-[#10B981] font-bold hover:underline">Create Account here.</button>
                            </p>
                        </div>
                    </form>
                )}

                <div className="mt-8 flex items-center justify-center gap-4 relative z-10 opacity-60">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[8px] md:text-[10px] text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest">Authorized Personal Only</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                </div>
            </div>

            <button
                onClick={() => {
                    setError('');
                    setIsAdminView(!isAdminView);
                }}
                className="mt-8 flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs md:text-sm font-bold uppercase tracking-wider z-10"
            >
                {isAdminView ? <User className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                {isAdminView ? "Member Sign-In" : "Chairman Access"}
            </button>

            <div className="absolute bottom-6 w-full text-center z-10 px-4">
                <p className="text-[8px] md:text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                    © {new Date().getFullYear()} Fantasy Chama Global Wealth Management. All Rights Reserved.
                </p>
            </div>

            {/* ── Modal: Self-Onboarding Wizard ──────────────────── */}
            {showSelfOnboardModal && onboardData && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-lg bg-gradient-to-b from-[#1c272c] to-[#11171a] border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl relative text-white animate-in zoom-in-95 duration-200 my-8">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setShowSelfOnboardModal(false)}
                            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Header */}
                        <div className="text-center mb-5">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl md:text-2xl font-black tracking-tight mb-1">
                                Welcome to {onboardData.leagueName}!
                            </h2>
                            <p className="text-xs text-gray-300">
                                Invited by <span className="text-[#FBBF24] font-bold">{onboardData.invitedBy}</span>
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                WhatsApp Invite Code <span className="text-emerald-400 font-mono font-bold">{code.join('')}</span>
                            </p>
                            {previewLeague && previewLeague.memberNames.length > 0 && (
                                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-semibold">
                                    <span>👥 Join <strong className="text-white">{previewLeague.memberNames.join(', ')}</strong></span>
                                    {previewLeague.totalMembers > previewLeague.memberNames.length && (
                                        <span className="text-emerald-400 font-normal">+{previewLeague.totalMembers - previewLeague.memberNames.length} others</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Gameweek Join Pill */}
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-4 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div className="text-[11px] leading-relaxed text-gray-300">
                                <span className="font-bold text-white">Joining from Gameweek {onboardData.currentGw}:</span> Your contributions only apply from this round forward. You are never back-charged for earlier gameweeks!
                            </div>
                        </div>

                        {/* Progressive Stepper Header */}
                        <div className="flex items-center justify-between gap-1.5 mb-5 px-1">
                            {[
                                { step: 1, label: '1. Squad', icon: Shield },
                                { step: 2, label: '2. Tier', icon: Trophy },
                                { step: 3, label: '3. Confirm', icon: CheckCircle2 }
                            ].map((s) => {
                                const isCurrent = onboardStep === s.step;
                                const isPast = onboardStep > s.step;
                                const Icon = s.icon;
                                return (
                                    <button
                                        key={s.step}
                                        type="button"
                                        onClick={() => {
                                            if (s.step < onboardStep) {
                                                setOnboardStep(s.step as any);
                                            } else if (s.step === 2) {
                                                let name = onboardManagerName.trim();
                                                if (selectedTeamClaim !== 'custom') {
                                                    const matched = onboardData.unlinkedTeams.find(t => t.id === selectedTeamClaim);
                                                    if (matched) name = name || matched.displayName || '';
                                                }
                                                if (!name) {
                                                    setOnboardError('Please complete Step 1 (Manager Name) first.');
                                                    return;
                                                }
                                                setOnboardError('');
                                                setOnboardStep(2);
                                            } else if (s.step === 3) {
                                                let name = onboardManagerName.trim();
                                                if (selectedTeamClaim !== 'custom') {
                                                    const matched = onboardData.unlinkedTeams.find(t => t.id === selectedTeamClaim);
                                                    if (matched) name = name || matched.displayName || '';
                                                }
                                                if (!name) {
                                                    setOnboardError('Please complete Step 1 (Manager Name) first.');
                                                    return;
                                                }
                                                setOnboardError('');
                                                setOnboardStep(3);
                                            }
                                        }}
                                        className={clsx(
                                            "flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all",
                                            isCurrent
                                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm"
                                                : isPast
                                                    ? "bg-white/5 text-gray-300 border border-white/10 hover:border-emerald-500/30 cursor-pointer"
                                                    : "bg-white/[0.02] text-gray-600 border border-white/5 cursor-not-allowed"
                                        )}
                                    >
                                        <Icon className={clsx("w-3 h-3", isCurrent ? "text-emerald-400" : isPast ? "text-emerald-500" : "text-gray-600")} />
                                        <span className="truncate">{s.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {onboardError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium p-3 rounded-xl mb-4 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{onboardError}</span>
                            </div>
                        )}

                        <form onSubmit={handleCompleteOnboarding} className="space-y-4">
                            {/* STEP 1: Link FPL Team & Name */}
                            {onboardStep === 1 && (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                            Link Your FPL Team & Profile
                                        </label>
                                        <span className="text-[10px] text-emerald-400 font-bold">Step 1 of 3</span>
                                    </div>

                                    {onboardData.unlinkedTeams.length > 0 && (
                                        <div className="space-y-2 mb-2">
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                <input
                                                    type="text"
                                                    value={onboardSearch}
                                                    onChange={(e) => setOnboardSearch(e.target.value)}
                                                    placeholder="Search your name or FPL team..."
                                                    className="w-full bg-[#12181f] border border-white/10 rounded-xl py-2 pl-9 pr-7 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50"
                                                />
                                                {onboardSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setOnboardSearch('')}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>

                                            <div className="relative">
                                                <select
                                                    value={selectedTeamClaim}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setSelectedTeamClaim(val);
                                                        if (val !== 'custom') {
                                                            const matched = onboardData.unlinkedTeams.find(t => t.id === val);
                                                            if (matched) {
                                                                setOnboardManagerName(matched.displayName || '');
                                                                setOnboardTeamName(matched.fplTeamName || matched.teamName || '');
                                                            }
                                                        }
                                                    }}
                                                    className="w-full appearance-none bg-white dark:bg-[#161d24] border border-gray-300 dark:border-white/10 rounded-xl py-2.5 pl-3 pr-9 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer font-semibold shadow-sm transition-all"
                                                >
                                                    <optgroup label={filteredUnlinkedTeams.length > 0 ? `Select Your Team (${filteredUnlinkedTeams.length} available)` : "No exact matches"} className="bg-white dark:bg-[#161d24] text-gray-900 dark:text-white">
                                                        {filteredUnlinkedTeams.map((t) => (
                                                            <option key={t.id} value={t.id} className="bg-white dark:bg-[#161d24] text-gray-900 dark:text-white py-1.5 font-medium">
                                                                {t.displayName} — {t.fplTeamName || t.teamName || 'FPL Squad'}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                    <option value="custom" className="bg-white dark:bg-[#161d24] text-amber-600 dark:text-amber-300 font-bold py-1.5">➕ Not in list / Enter manually</option>
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>
                                    )}

                                    {selectedTeamClaim !== 'custom' ? (
                                        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 flex items-center justify-between text-xs mb-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                                    <Check className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-xs font-bold text-white block truncate">
                                                        {onboardTeamName || 'Selected FPL Squad'}
                                                    </span>
                                                    <span className="text-[11px] text-emerald-400 truncate block">
                                                        Manager: {onboardManagerName || 'Verified'}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedTeamClaim('custom')}
                                                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline shrink-0 ml-2"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5 mb-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                                        Your Name (Manager) *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={onboardManagerName}
                                                        onChange={(e) => setOnboardManagerName(e.target.value)}
                                                        placeholder="Your Full Name"
                                                        className="w-full bg-[#161d24] border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                                        FPL Team Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={onboardTeamName}
                                                        onChange={(e) => setOnboardTeamName(e.target.value)}
                                                        placeholder="Team Name"
                                                        className="w-full bg-[#161d24] border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                                                    <span>FPL Team ID (Optional)</span>
                                                    <span className="text-[8px] text-gray-500 font-normal">from fantasy.premierleague.com</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={customFplId}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => setCustomFplId(e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, ''))}
                                                    placeholder="Numeric Team ID"
                                                    className="w-full bg-[#161d24] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 font-mono"
                                                />
                                                <p className="text-[10px] text-gray-400 mt-1 leading-tight">
                                                    💡 <em>In FPL app/browser, open team URL: <span className="font-mono text-amber-300">fantasy.premierleague.com/entry/<strong>XXXXXX</strong></span> — the number is your Team ID.</em>
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Verified Phone Indicator */}
                                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-[11px] text-gray-400">
                                        <span>Payout Phone (M-Pesa):</span>
                                        <span className="text-white font-mono font-bold flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                            {onboardData.phone}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            let name = onboardManagerName.trim();
                                            let squad = onboardTeamName.trim();
                                            if (selectedTeamClaim !== 'custom') {
                                                const matched = onboardData.unlinkedTeams.find(t => t.id === selectedTeamClaim);
                                                if (matched) {
                                                    name = name || matched.displayName || '';
                                                    squad = squad || matched.fplTeamName || matched.teamName || matched.displayName || '';
                                                }
                                            }
                                            if (!name) {
                                                setOnboardError('Please enter or select your Manager Name to proceed.');
                                                return;
                                            }
                                            setOnboardManagerName(name);
                                            setOnboardTeamName(squad);
                                            setOnboardError('');
                                            setOnboardStep(2);
                                        }}
                                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#0A0E17] font-black text-xs uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer mt-2"
                                    >
                                        <span>Next: Choose Participation Tier</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* STEP 2: Choose Participation Tier */}
                            {onboardStep === 2 && (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                            Choose Your Participation Tier
                                        </label>
                                        <span className="text-[10px] text-emerald-400 font-bold">Step 2 of 3</span>
                                    </div>

                                    <div className="space-y-2.5">
                                        {/* Option 1: Cash Pot (Weekly + Season Vault) */}
                                        <div
                                            onClick={() => setOnboardPlayMode('pot')}
                                            className={`cursor-pointer rounded-2xl p-3.5 border transition-all relative ${
                                                onboardPlayMode === 'pot'
                                                    ? 'bg-emerald-500/15 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/40'
                                                    : 'bg-[#161d24] border-white/5 opacity-70 hover:opacity-100 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-black flex items-center gap-1.5 text-white">
                                                    <Trophy className="w-4 h-4 text-[#FBBF24]" /> Full Pot (Weekly + Season)
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/20">
                                                    KES {onboardData.monthlyFee.toLocaleString()}/GW
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-300 leading-snug mb-2">
                                                Compete for every round's gameweek cash prize + qualify for the end-of-season championship vault.
                                            </p>
                                            <span className="text-[10px] font-bold text-emerald-400 block">
                                                ✓ Weekly Round Cash & Season Championship Vault
                                            </span>
                                        </div>

                                        {/* Option 2: Season Vault Only */}
                                        <div
                                            onClick={() => setOnboardPlayMode('season_only')}
                                            className={`cursor-pointer rounded-2xl p-3.5 border transition-all relative ${
                                                onboardPlayMode === 'season_only'
                                                    ? 'bg-amber-500/15 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/40'
                                                    : 'bg-[#161d24] border-white/5 opacity-70 hover:opacity-100 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-black flex items-center gap-1.5 text-white">
                                                    <Crown className="w-4 h-4 text-amber-400" /> Season Vault Only
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                                    Season Jackpot Focus
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-300 leading-snug mb-2">
                                                Focus entirely on the 38-gameweek overall championship. No weekly round pot dues required.
                                            </p>
                                            <span className="text-[10px] font-bold text-amber-400 block">
                                                ✓ Overall Season Standings & Trophy Vault Focus
                                            </span>
                                        </div>

                                        {/* Option 3: Spectator & Side-Bets Only */}
                                        <div
                                            onClick={() => setOnboardPlayMode('sidebets_only')}
                                            className={`cursor-pointer rounded-2xl p-3.5 border transition-all relative ${
                                                onboardPlayMode === 'sidebets_only'
                                                    ? 'bg-indigo-500/15 border-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/40'
                                                    : 'bg-[#161d24] border-white/5 opacity-70 hover:opacity-100 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-black flex items-center gap-1.5 text-white">
                                                    <Swords className="w-4 h-4 text-indigo-400" /> Free Spectator & Side-Bets
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                                    Free Entry
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-300 leading-snug mb-2">
                                                Follow live league standings for free. Challenge rivals to 1v1 M-Pesa cash side bets whenever you want!
                                            </p>
                                            <span className="text-[10px] font-bold text-indigo-400 block">
                                                ✓ 1v1 P2P Side Bets · Zero Chama Dues
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setOnboardStep(1)}
                                            className="px-5 py-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" /> Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOnboardStep(3)}
                                            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-[#0A0E17] font-black text-xs sm:text-sm uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                                        >
                                            <span>Next: Review & Confirm</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Review & Confirm */}
                            {onboardStep === 3 && (
                                <div className="space-y-3 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                            Review Your Profile & Join
                                        </label>
                                        <span className="text-[10px] text-emerald-400 font-bold">Step 3 of 3</span>
                                    </div>

                                    {/* Summary Card */}
                                    <div className="rounded-2xl border border-emerald-500/30 bg-[#121920] p-4 space-y-2.5 shadow-inner">
                                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                            <span className="text-[11px] text-gray-400">League:</span>
                                            <span className="text-xs font-black text-white">{onboardData.leagueName}</span>
                                        </div>
                                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                            <span className="text-[11px] text-gray-400">Manager:</span>
                                            <span className="text-xs font-black text-emerald-400">{onboardManagerName || 'Manager'}</span>
                                        </div>
                                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                            <span className="text-[11px] text-gray-400">FPL Squad:</span>
                                            <span className="text-xs font-bold text-white truncate max-w-[180px]">{onboardTeamName || 'FPL Squad'}</span>
                                        </div>
                                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                            <span className="text-[11px] text-gray-400">Selected Tier:</span>
                                            <span className={clsx(
                                                "text-xs font-black px-2 py-0.5 rounded-lg border",
                                                onboardPlayMode === 'pot'
                                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                                    : onboardPlayMode === 'season_only'
                                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                                    : "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                                            )}>
                                                {onboardPlayMode === 'pot'
                                                    ? `🏆 Full Pot (KES ${onboardData.monthlyFee}/GW)`
                                                    : onboardPlayMode === 'season_only'
                                                    ? '👑 Season Vault Only'
                                                    : '🛡️ Spectator & Bets (Free)'}
                                            </span>
                                        </div>
                                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                                                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span>M-Pesa Payout Number</span>
                                                    <span className="text-emerald-400 font-bold">*</span>
                                                </label>
                                                <span className="text-[10px] text-emerald-400 font-medium">Instant Winnings</span>
                                            </div>
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setPhone(val);
                                                    if (onboardData) {
                                                        setOnboardData({ ...onboardData, phone: val });
                                                    }
                                                }}
                                                placeholder="e.g. 0712 345 678"
                                                className="w-full bg-[#161d24] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder:text-gray-500 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-bold"
                                                required
                                            />
                                            <p className="text-[10px] text-gray-400 leading-snug">
                                                Weekly cash prizes and payouts will be sent directly to this Safaricom M-Pesa number.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setOnboardStep(2)}
                                            className="px-5 py-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" /> Back
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isOnboardingSubmitting}
                                            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-[#0A0E17] font-black text-xs sm:text-sm uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] active:scale-95 disabled:opacity-50 cursor-pointer"
                                        >
                                            {isOnboardingSubmitting ? (
                                                <><span className="w-4 h-4 border-2 border-[#0A0E17] border-t-transparent rounded-full animate-spin" /> Activating Profile...</>
                                            ) : (
                                                <><span>Complete & Enter League</span> <ArrowRight className="w-4 h-4" /></>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
