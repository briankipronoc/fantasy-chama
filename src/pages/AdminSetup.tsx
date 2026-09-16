import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, UserPlus, ArrowLeft, Check, Smartphone, Trophy, PersonStanding, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, Users, Info, AlertTriangle, X, Share2, Sliders, Copy } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { normalizeKenyanPhone } from '../utils/phone';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STEPS = 5;

export default function AdminSetup() {
    const [step, setStep] = useState(1);
    const [stepDirection, setStepDirection] = useState<'forward' | 'back'>('forward');


    // Interactive Tooltip Component for clean UX guidance
    const Tooltip = ({ text }: { text: React.ReactNode }) => (
        <div className="group relative inline-block ml-1.5 align-middle">
            <Info className="w-3 h-3 text-gray-500 hover:text-[#FBBF24] cursor-help transition-colors" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#0A0E17] border border-white/10 text-[9px] md:text-[10px] text-gray-300 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 normal-case tracking-normal text-center">
                {text}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/10"></div>
            </div>
        </div>
    );

    const navigate = useNavigate();
    const setLeagueSettings = useStore((state) => state.setLeagueSettings);
    const addMemberGlobal = useStore((state) => state.addMember);
    const setRole = useStore((state) => state.setRole);

    // Step 1: Identity
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [chairmanPayoutPhone, setChairmanPayoutPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [step1Error, setStep1Error] = useState('');
    const [isExistingChairman, setIsExistingChairman] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);

    useEffect(() => {
        const storedRole = localStorage.getItem('fc-role') || localStorage.getItem('activeUserRole');
        const activeLeagueId = localStorage.getItem('activeLeagueId');
        const isAuthChairman = Boolean(auth.currentUser || (storedRole === 'admin' && activeLeagueId));

        if (isAuthChairman) {
            setIsExistingChairman(true);
            setRole('admin');
            if (auth.currentUser?.email) setEmail(auth.currentUser.email);
            if (auth.currentUser?.displayName) setFullName(auth.currentUser.displayName);
            
            const storedName = localStorage.getItem('activeUserName');
            if (storedName && !auth.currentUser?.displayName) setFullName(storedName);

            const storedPhone = localStorage.getItem('memberPhone');
            if (storedPhone) {
                setPhone(storedPhone);
                setChairmanPayoutPhone(storedPhone);
            }

            // Immediately jump to step 2 (League Rules & Economy) so the Chairman never re-enters their personal details
            setStep(2);
        }
    }, []);

    // Step 2: League
    const [leagueName, setLeagueName] = useState('');
    const [fplLeagueId, setFplLeagueId] = useState('');
    const [fplFetchStatus, setFplFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [fplStandings, setFplStandings] = useState<any[]>([]); // stores raw FPL standings for Step 3 import
    const [monthlyFee, setMonthlyFee] = useState(200);
    const [weeklyPrizePercent, setWeeklyPrizePercent] = useState(60);
    const [seasonWinnersCount, setSeasonWinnersCount] = useState<number>(3);
    const [seasonWinnersMode, setSeasonWinnersMode] = useState<'top1' | 'top3' | 'top5' | 'custom'>('top3');
    const [customWinnerCount, setCustomWinnerCount] = useState<number>(3);
    const [customWinnerRatios, setCustomWinnerRatios] = useState<string[]>(['50', '30', '20']);
    const [estimatedMembers, setEstimatedMembers] = useState(5);
    const [allowMultipleTeams, setAllowMultipleTeams] = useState(false); // dual-team league toggle
    // Step 3: Members
    const [members, setMembers] = useState<{ displayName: string; phone: string; secondFplTeamId?: number; fplEntryId?: number; fplTeamName?: string }[]>([]);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberPhone, setNewMemberPhone] = useState('');
    const [newMemberSecondTeam, setNewMemberSecondTeam] = useState(''); // second FPL team ID input
    const [coAdminIndex, setCoAdminIndex] = useState<number | null>(null);
    const [enrollmentMode, setEnrollmentMode] = useState<'self' | 'manual'>('self');
    const [showAddManualMember, setShowAddManualMember] = useState(false);

    // Step 4: Code
    const generatedCode = useMemo(() => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }, []);

    const [copied, setCopied] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    // Derived calculations
    const MAX_LEAGUE_MEMBERS = 20;
    const normalizedEstimatedMembers = Math.min(MAX_LEAGUE_MEMBERS, Math.max(2, estimatedMembers));
    const maxAllowedWinners = Math.max(1, Math.min(10, Math.floor(normalizedEstimatedMembers / 2)));
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

    const effectiveSeasonWinnersCount = seasonWinnersMode === 'top1'
        ? 1
        : seasonWinnersMode === 'top5'
            ? 5
            : seasonWinnersMode === 'custom'
                ? normalizedCustomWinnerCount
                : 3;

    const effectiveSeasonDistribution = seasonWinnersMode === 'custom'
        ? normalizeDistribution(customWinnerRatios, effectiveSeasonWinnersCount)
        : getPresetDistribution(effectiveSeasonWinnersCount);

    const totalMonthlyPool = monthlyFee * normalizedEstimatedMembers;
    // Pilot phase calculation: Only M-Pesa transaction fees (1.5%) are deducted for payouts.
    // Platform fee (5%) and Chairman kickback (3.5%) are configured but temporarily waived for pilot.
    const isPilotPhase = true;
    const chairmanCut = isPilotPhase ? 0 : Math.round(totalMonthlyPool * 0.035);
    const mpesaFee = Math.round(totalMonthlyPool * 0.015);
    const platformCut = isPilotPhase ? 0 : Math.round(totalMonthlyPool * 0.05);
    const escrowFee = chairmanCut + mpesaFee + platformCut;
    const netPool = totalMonthlyPool - escrowFee;

    const weeklyPrize = Math.round(netPool * (weeklyPrizePercent / 100));
    const grandVault = netPool - weeklyPrize;

    useEffect(() => {
        if (estimatedMembers > MAX_LEAGUE_MEMBERS) setEstimatedMembers(MAX_LEAGUE_MEMBERS);
    }, [estimatedMembers]);

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
                const preset = getPresetDistribution(normalizedCustomWinnerCount).map(String);
                return preset.slice(0, normalizedCustomWinnerCount);
            }
            if (next.every((value) => Number(value || 0) <= 0)) {
                return getPresetDistribution(normalizedCustomWinnerCount).map(String);
            }
            return next;
        });
    }, [seasonWinnersMode, normalizedCustomWinnerCount]);

    useEffect(() => {
        if (seasonWinnersMode === 'custom') return;
        setCustomWinnerRatios(getPresetDistribution(effectiveSeasonWinnersCount).map(String));
    }, [seasonWinnersMode, effectiveSeasonWinnersCount]);

    const passwordStrengthResult = useMemo(() => {
        let score = 0;
        if (password.length > 5) score += 1;
        if (password.length > 8) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        if (score === 0) return { label: 'Weak', w1: 'w-1/3 bg-white/10', w2: 'w-1/3 bg-white/10', w3: 'w-1/3 bg-white/10', textColor: 'text-gray-500' };
        if (score <= 2) return { label: 'Low', w1: 'w-1/3 bg-red-500', w2: 'w-1/3 bg-white/10', w3: 'w-1/3 bg-white/10', textColor: 'text-red-500' };
        if (score <= 4) return { label: 'Medium', w1: 'w-1/3 bg-[#FBBF24]', w2: 'w-1/3 bg-[#FBBF24]', w3: 'w-1/3 bg-white/10', textColor: 'text-[#FBBF24]' };
        return { label: 'Strong', w1: 'w-1/3 bg-[#22c55e]', w2: 'w-1/3 bg-[#22c55e]', w3: 'w-1/3 bg-[#22c55e]', textColor: 'text-[#22c55e]' };
    }, [password]);

    const nextStep = async () => {
        if (step === 1) {
            if (!fullName.trim()) {
                toast.error('Please enter your full name.');
                return;
            }
            if (!email.trim()) {
                toast.error('Please enter your email address.');
                return;
            }
            if (!phone.trim()) {
                toast.error('Please enter your M-Pesa phone number.');
                return;
            }
            // If already authenticated as this chairman, proceed directly to Step 2
            if (auth.currentUser && auth.currentUser.email?.toLowerCase() === email.trim().toLowerCase()) {
                setRole('admin');
                setStep(2);
                setStepDirection('forward');
                return;
            }

            setIsCheckingEmail(true);
            setStep1Error('');
            try {
                // If user entered a password, check if it matches their existing Chairman account
                if (password && password.length >= 6) {
                    try {
                        const signInRes = await signInWithEmailAndPassword(auth, email.trim(), password);
                        if (signInRes.user) {
                            // Successfully authenticated existing chairman!
                            setIsExistingChairman(true);
                            setRole('admin');
                            setStep(2);
                            setStepDirection('forward');
                            setIsCheckingEmail(false);
                            return;
                        }
                    } catch (signInErr: any) {
                        if (signInErr.code === 'auth/wrong-password') {
                            setStep1Error('This email is registered to an existing Chairman account. Please enter your existing password to link this new league, or use a different email.');
                            setIsCheckingEmail(false);
                            return;
                        } else if (signInErr.code === 'auth/too-many-requests') {
                            setStep1Error('Too many attempts. Please wait a moment.');
                            setIsCheckingEmail(false);
                            return;
                        }
                    }
                }

                await signInWithEmailAndPassword(auth, email.trim(), '__FC_PROBE_PASSWORD_XYZ__');
                setStep1Error('This email is registered to a Chairman account. Enter your existing password above to link this new league.');
                setIsCheckingEmail(false);
                return;
            } catch (err: any) {
                if (err.code === 'auth/wrong-password' || err.code === 'auth/too-many-requests') {
                    setStep1Error('This email belongs to an existing Chairman account. Enter your existing password above to link this new league, or use a new email.');
                    setIsCheckingEmail(false);
                    return;
                } else if (
                    err.code === 'auth/user-not-found' ||
                    err.code === 'auth/invalid-credential' ||
                    err.code === 'auth/invalid-email'
                ) {
                    if (err.code === 'auth/invalid-email') {
                        setStep1Error('Please enter a valid email address.');
                        setIsCheckingEmail(false);
                        return;
                    }
                    // Email is available — proceed normally
                } else {
                    console.warn('[Step1] Email probe skipped due to network/unknown error:', err.code, err.message);
                }
            } finally {
                setIsCheckingEmail(false);
            }
            setRole('admin');
        }
        if (step === 2) {
            if (!leagueName.trim()) {
                toast.error('Please enter a league name or paste an FPL league link/ID.');
                return;
            }
            if (!monthlyFee || monthlyFee < 50) {
                toast.error('Please enter a Gameweek stake (minimum KES 50).');
                return;
            }
            if (fplStandings.length > 0 && members.length === 0) {
                handleImportFromFPL();
            }
            setLeagueSettings({ name: leagueName, monthlyFee, inviteCode: generatedCode });
        }
        if (step === 3) {
            if (enrollmentMode === 'manual' && members.length < 1) {
                toast.error('Please add at least 1 member or switch to Self-Onboarding mode.');
                return;
            }
            // Commit members globally
            members.forEach((m) => addMemberGlobal({ ...m, hasPaid: false, walletBalance: 0 }));
        }
        if (step === 4) {
            // Step 4 handles firebase writes separately inside handleConfirmLeague
            return;
        }
        if (step < STEPS) { setStepDirection('forward'); setStep(step + 1); }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    useEffect(() => {
        setFullName(localStorage.getItem('fc-setup-fullName') || '');
        setEmail(localStorage.getItem('fc-setup-email') || '');
        setPhone(localStorage.getItem('fc-setup-phone') || '');
        setChairmanPayoutPhone(localStorage.getItem('fc-setup-chairmanPayoutPhone') || '');
        setLeagueName(localStorage.getItem('fc-setup-leagueName') || '');
        setFplLeagueId(localStorage.getItem('fc-setup-fplLeagueId') || '');

        const savedMonthlyFee = Number(localStorage.getItem('fc-setup-monthlyFee'));
        if (!Number.isNaN(savedMonthlyFee) && savedMonthlyFee > 0) setMonthlyFee(savedMonthlyFee);

        const savedWeeklyPercent = Number(localStorage.getItem('fc-setup-weeklyPrizePercent'));
        if (!Number.isNaN(savedWeeklyPercent)) setWeeklyPrizePercent(savedWeeklyPercent);

        const savedSeasonWinners = Number(localStorage.getItem('fc-setup-seasonWinnersCount'));
        if ([1, 3, 5].includes(savedSeasonWinners)) {
            setSeasonWinnersCount(savedSeasonWinners);
            setSeasonWinnersMode(savedSeasonWinners === 1 ? 'top1' : savedSeasonWinners === 5 ? 'top5' : 'top3');
        }

        const savedSeasonMode = localStorage.getItem('fc-setup-seasonWinnersMode');
        if (savedSeasonMode === 'top1' || savedSeasonMode === 'top3' || savedSeasonMode === 'top5' || savedSeasonMode === 'custom') {
            setSeasonWinnersMode(savedSeasonMode);
        }

        const savedCustomWinnerCount = Number(localStorage.getItem('fc-setup-customWinnerCount'));
        if (!Number.isNaN(savedCustomWinnerCount) && savedCustomWinnerCount > 0) {
            setCustomWinnerCount(savedCustomWinnerCount);
        }

        const savedCustomRatiosRaw = localStorage.getItem('fc-setup-customWinnerRatios');
        if (savedCustomRatiosRaw) {
            try {
                const parsed = JSON.parse(savedCustomRatiosRaw);
                if (Array.isArray(parsed)) {
                    setCustomWinnerRatios(parsed.map((item) => String(item)));
                }
            } catch (error) {
                console.warn('Could not restore custom winner ratios', error);
            }
        }

        const savedEstimatedMembers = Number(localStorage.getItem('fc-setup-estimatedMembers'));
        if (!Number.isNaN(savedEstimatedMembers) && savedEstimatedMembers > 0) setEstimatedMembers(savedEstimatedMembers);

        setAllowMultipleTeams(localStorage.getItem('fc-setup-allowMultipleTeams') === 'true');
    }, []);

    useEffect(() => { localStorage.setItem('fc-setup-fullName', fullName); }, [fullName]);
    useEffect(() => { localStorage.setItem('fc-setup-email', email); }, [email]);
    useEffect(() => { localStorage.setItem('fc-setup-phone', phone); }, [phone]);
    useEffect(() => { localStorage.setItem('fc-setup-chairmanPayoutPhone', chairmanPayoutPhone); }, [chairmanPayoutPhone]);
    useEffect(() => { localStorage.setItem('fc-setup-leagueName', leagueName); }, [leagueName]);
    useEffect(() => { localStorage.setItem('fc-setup-fplLeagueId', fplLeagueId); }, [fplLeagueId]);
    useEffect(() => { localStorage.setItem('fc-setup-monthlyFee', String(monthlyFee)); }, [monthlyFee]);
    useEffect(() => { localStorage.setItem('fc-setup-weeklyPrizePercent', String(weeklyPrizePercent)); }, [weeklyPrizePercent]);
    useEffect(() => { localStorage.setItem('fc-setup-seasonWinnersCount', String(seasonWinnersCount)); }, [seasonWinnersCount]);
    useEffect(() => { localStorage.setItem('fc-setup-seasonWinnersMode', seasonWinnersMode); }, [seasonWinnersMode]);
    useEffect(() => { localStorage.setItem('fc-setup-customWinnerCount', String(customWinnerCount)); }, [customWinnerCount]);
    useEffect(() => { localStorage.setItem('fc-setup-customWinnerRatios', JSON.stringify(customWinnerRatios)); }, [customWinnerRatios]);
    useEffect(() => { localStorage.setItem('fc-setup-estimatedMembers', String(estimatedMembers)); }, [estimatedMembers]);
    useEffect(() => { localStorage.setItem('fc-setup-allowMultipleTeams', String(allowMultipleTeams)); }, [allowMultipleTeams]);

    useEffect(() => {
        if (!chairmanPayoutPhone && phone) {
            setChairmanPayoutPhone(phone);
        }
    }, [phone]); // only depend on phone, avoids blocking manual edits

    const handleConfirmLeague = async () => {
        setIsSubmitting(true);
        setSubmitError('');

        try {
            // Write 1: Create Admin User or reuse existing Chairman session
            let chairmanUser = auth.currentUser;
            if (!chairmanUser || chairmanUser.email?.toLowerCase() !== email.trim().toLowerCase()) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
                    chairmanUser = userCredential.user;
                } catch (authErr: any) {
                    if (authErr.code === 'auth/email-already-in-use') {
                        const signInRes = await signInWithEmailAndPassword(auth, email.trim(), password);
                        chairmanUser = signInRes.user;
                    } else {
                        throw authErr;
                    }
                }
            }

            if (fullName && (!chairmanUser.displayName || chairmanUser.displayName !== fullName)) {
                try {
                    await updateProfile(chairmanUser, { displayName: fullName });
                } catch (pErr) {
                    console.warn('[AdminSetup] updateProfile skipped:', pErr);
                }
            }

            const chairmanUid = chairmanUser.uid;

            // Write 2: Create the League Document
            const leagueDocRef = await addDoc(collection(db, 'leagues'), {
                leagueName,
                fplLeagueId,
                gameweekStake: monthlyFee,
                chairmanId: chairmanUid,
                chairmanPhone: chairmanPayoutPhone || phone,
                chairmanEmail: email.trim(),
                allowMultipleTeams,
                startGw: null, // Will be set once we know current GW from FPL (auto-populated on first load)
                rules: {
                    weekly: weeklyPrizePercent,
                    vault: 100 - weeklyPrizePercent,
                    seasonWinnersCount: effectiveSeasonWinnersCount,
                    seasonWinnersMode: seasonWinnersMode,
                    seasonDistribution: effectiveSeasonDistribution
                },
                inviteCode: generatedCode,
                createdAt: serverTimestamp()
            });

            const leagueId = leagueDocRef.id;

            // Write 3: Batch Enroll Members (including Chairman)
            const batch = writeBatch(db);

            // Enroll Chairman First
            const chairmanRef = doc(collection(db, 'leagues', leagueId, 'memberships'));
            batch.set(chairmanRef, {
                displayName: fullName,
                phone: phone,
                hasPaid: false,
                walletBalance: 0,
                role: 'admin',
                trustScore: 100,
                avatarSeed: Math.random().toString(36).substring(7),
                joinedAt: serverTimestamp(),
            });

            // Filter out any member matching the chairman's phone or name to prevent duplicate chairman registration
            const cleanPhone = (phone || '').replace(/\D/g, '');
            const cleanFullName = (fullName || '').trim().toLowerCase();
            const uniqueMembers = members.filter(member => {
                const mPhone = (member.phone || '').replace(/\D/g, '');
                const mName = (member.displayName || '').trim().toLowerCase();
                const isSamePhone = cleanPhone && mPhone && (cleanPhone.slice(-9) === mPhone.slice(-9));
                const isSameName = cleanFullName && mName && cleanFullName === mName;
                return !isSamePhone && !isSameName;
            });

            // Enroll Other Members
            let coAdminDocId = null;
            uniqueMembers.forEach((member, index) => {
                const memberRef = doc(collection(db, 'leagues', leagueId, 'memberships'));
                const isCoAdmin = index === coAdminIndex;

                if (isCoAdmin) {
                    coAdminDocId = memberRef.id;
                }

                const memberData: any = {
                    displayName: member.displayName,
                    phone: member.phone,
                    hasPaid: false,
                    walletBalance: 0,
                    role: isCoAdmin ? 'co-chair' : 'member',
                    trustScore: 100,
                    avatarSeed: Math.random().toString(36).substring(7),
                    joinedAt: serverTimestamp(),
                    isActive: true,
                };
                if (member.fplEntryId) memberData.fplTeamId = member.fplEntryId;
                if ((member as any).fplTeamName) memberData.fplTeamName = (member as any).fplTeamName;
                if (member.secondFplTeamId) memberData.secondFplTeamId = member.secondFplTeamId;

                batch.set(memberRef, memberData);
            });

            // If a co-chair was selected, explicitly link them to the root league document
            if (coAdminDocId) {
                const leagueUpdateRef = doc(db, 'leagues', leagueId);
                batch.update(leagueUpdateRef, {
                    coAdminId: coAdminDocId
                });
            }

            await batch.commit();

            await Promise.all([
                addDoc(collection(db, 'leagues', leagueId, 'notifications'), {
                    type: 'info',
                    message: `League setup completed for ${leagueName}. Season rules and member roster are now live.`,
                    timestamp: serverTimestamp(),
                    readBy: [],
                    targetMemberId: null,
                }),
                addDoc(collection(db, 'leagues', leagueId, 'league_events'), {
                    eventType: 'operations',
                    title: 'League setup completed',
                    message: `${fullName} created ${leagueName} with ${members.length + 1} members.`,
                    actorId: chairmanUid,
                    timestamp: serverTimestamp(),
                }),
            ]);

            // Save to userLeagues so the Chairman's league list updates everywhere immediately
            if (cleanPhone) {
                try {
                    const userLeagueRef = doc(db, 'userLeagues', cleanPhone);
                    await setDoc(userLeagueRef, {
                        leagues: arrayUnion({
                            leagueId,
                            leagueName,
                            role: 'admin'
                        })
                    }, { merge: true });
                } catch (ulErr) {
                    console.warn('[AdminSetup] Failed to sync userLeagues doc:', ulErr);
                }
            }

            // Bind the chairman's membership doc ID so the app can load their profile
            localStorage.setItem('activeLeagueId', leagueId);
            localStorage.setItem('activeUserId', chairmanRef.id);
            localStorage.setItem('activeUserRole', 'admin');
            if (phone) localStorage.setItem('memberPhone', phone);

            // Ensure role is set (it was set at step 1 but re-confirm after writes)
            setRole('admin');

            // Clean up setup form data from localStorage
            [
                'fc-setup-fullName', 'fc-setup-email', 'fc-setup-phone',
                'fc-setup-chairmanPayoutPhone', 'fc-setup-leagueName', 'fc-setup-fplLeagueId',
                'fc-setup-monthlyFee', 'fc-setup-weeklyPrizePercent', 'fc-setup-seasonWinnersCount',
                'fc-setup-seasonWinnersMode', 'fc-setup-customWinnerCount', 'fc-setup-customWinnerRatios',
                'fc-setup-estimatedMembers', 'fc-setup-allowMultipleTeams',
            ].forEach(key => localStorage.removeItem(key));

            setStep(5);
            setStepDirection('forward');

        } catch (error: any) {
            console.error('Error creating league or enrolling members:', error);
            if (error.code === 'auth/email-already-in-use') {
                setSubmitError('EMAIL_ALREADY_IN_USE');
            } else if (error.code === 'auth/weak-password') {
                setSubmitError('Password is too weak. Please use at least 6 characters.');
            } else if (error.code === 'auth/network-request-failed') {
                setSubmitError('Network error — check your internet connection and try again.');
            } else {
                setSubmitError(`Setup failed: ${error.message || 'Unknown error'}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const prevStep = () => {
        if (isSubmitting) return;
        if (isExistingChairman && step === 2) {
            setShowExitModal(true);
            return;
        }
        if (step > 1) {
            setStepDirection('back');
            setStep(step - 1);
        }
    };


    // Import all FPL managers from standings as blank-phone members
    const handleImportFromFPL = () => {
        if (fplStandings.length === 0) return;
        const cleanFullName = (fullName || '').trim().toLowerCase();
        const imported = fplStandings
            .filter(e => {
                const pName = (e.player_name || '').trim().toLowerCase();
                return !cleanFullName || pName !== cleanFullName;
            })
            .map(e => ({
                displayName: e.player_name,
                phone: '',
                fplEntryId: e.entry,
                fplTeamName: e.entry_name, // store FPL team name
            }));
        setMembers(imported.slice(0, 19));
    };

    useEffect(() => {
        if (step === 3 && members.length === 0 && fplStandings.length > 0) {
            handleImportFromFPL();
        }
    }, [step, fplStandings.length]);

    const addLocalMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberName || !newMemberPhone) return;
        if (members.length >= 19) return;

        const cleanFullName = (fullName || '').trim().toLowerCase();
        const cleanChairmanPhone = (phone || '').replace(/\D/g, '');
        const mPhone = (newMemberPhone || '').replace(/\D/g, '');
        const mName = (newMemberName || '').trim().toLowerCase();

        if (cleanFullName && mName === cleanFullName) {
            toast.error('Chairman is already enrolled as the league administrator.');
            return;
        }
        if (cleanChairmanPhone && mPhone && cleanChairmanPhone.slice(-9) === mPhone.slice(-9)) {
            toast.error('This phone number is already registered to the Chairman.');
            return;
        }

        const secondTeamId = newMemberSecondTeam ? Number(newMemberSecondTeam) : undefined;
        setMembers([...members, { displayName: newMemberName, phone: newMemberPhone, ...(secondTeamId ? { secondFplTeamId: secondTeamId } : {}) }]);
        setNewMemberName('');
        setNewMemberPhone('');
        setNewMemberSecondTeam('');
    };

    const removeLocalMember = (indexToRemove: number) => {
        setMembers(members.filter((_, idx) => idx !== indexToRemove));
    };

    const handleShareWhatsApp = () => {
        const appUrl = (typeof window !== "undefined" && window.location.origin) ? window.location.origin : (import.meta.env.VITE_APP_URL || "https://fantasy-chama.vercel.app");
        const link = `${appUrl}/login?code=${generatedCode}`;
        const message = `🏆 Join our FPL Chama — *${leagueName || "Premier League"}*!\n\nWeekly cash pots & season prize vault on lock. Scores sync directly with official FPL API.\n\n👉 Join here: ${link}\nLeague Code: *${generatedCode}*`;
        navigator.clipboard.writeText(message);
        setCopied(true);
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyInviteLink = () => {
        const appUrl = (typeof window !== "undefined" && window.location.origin) ? window.location.origin : (import.meta.env.VITE_APP_URL || "https://fantasy-chama.vercel.app");
        const link = `${appUrl}/login?code=${generatedCode}`;
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        toast.success('Invite link copied to clipboard!');
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleCopyOnlyCode = () => {
        navigator.clipboard.writeText(generatedCode);
        setCopiedCode(true);
        toast.success(`League code ${generatedCode} copied!`);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const inputClasses = "w-full pl-12 pr-4 py-3 md:py-3.5 rounded-xl border border-white/5 bg-[#161d24] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all font-medium [&:-webkit-autofill]:bg-[#161d24] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0px_1000px_#161d24_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]";

    const stepAnimClass = stepDirection === 'forward'
        ? 'animate-in fade-in slide-in-from-right-4 duration-400'
        : 'animate-in fade-in slide-in-from-left-4 duration-400';

    const renderStep1 = () => (
        <div className={`fc-auth-card w-[95%] sm:w-[500px] max-w-lg mx-auto bg-gradient-to-b from-[#1c272c] to-[#11171a] border border-white/5 rounded-[2rem] p-6 md:p-8 z-10 shadow-2xl relative ${stepAnimClass}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 to-transparent rounded-[2rem] pointer-events-none"></div>
            <div className="text-center mb-6 relative z-10">
                <h1 className="text-2xl md:text-3xl font-bold mb-1 tracking-tight text-white">
                    {isExistingChairman ? "Create Another League" : "Chairman Sign Up"}
                </h1>
                <p className="text-gray-400 text-sm">
                    {isExistingChairman 
                        ? "Add another Chama circle under your Chairman account"
                        : "Create your account to set up your FPL league"}
                </p>
            </div>

            <form className="space-y-4 relative z-10" onSubmit={async (e) => { e.preventDefault(); await nextStep(); }}>
                <div>
                    <label className="block text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                        Full Name <Tooltip text="Your name as Chairman, shown to members when they join." />
                    </label>
                    <div className="relative">
                        <PersonStanding className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            required
                            type="text"
                            autoComplete="name"
                            value={fullName}
                            onChange={e => setFullName(e.target.value.replace(/[^a-zA-Z\s'\-]/g, ''))}
                            pattern="^[a-zA-Z][a-zA-Z'\-\s]{1,}[a-zA-Z]$"
                            title="Please enter at least two names (e.g., Brian Kiprono)"
                            className={inputClasses}
                            placeholder="Enter your legal name"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                        Email Address <Tooltip text="Your primary God Mode login ID. We never spam." />
                    </label>
                    <div className="relative">
                        <Mail className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            required
                            type="email"
                            autoComplete="email"
                            value={email}
                            pattern="^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
                            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid email address with an @ symbol and domain.')}
                            onChange={e => {
                                (e.target as HTMLInputElement).setCustomValidity('');
                                setEmail(e.target.value);
                                if (step1Error) setStep1Error('');
                            }}
                            className={inputClasses}
                            placeholder="admin@fantasychama.com"
                        />
                    </div>
                    {step1Error && (
                        <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                            <span className="text-red-400 text-[11px] font-bold flex-1">{step1Error}</span>
                            {step1Error.includes('already registered') && (
                                <button
                                    type="button"
                                    onClick={() => navigate('/login', { state: { isAdminView: true } })}
                                    className="text-[#FBBF24] text-[11px] font-black hover:underline whitespace-nowrap flex-shrink-0"
                                >
                                    Log in →
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                        M-Pesa Phone Number <Tooltip text={<span><strong>CRITICAL:</strong> Your Chairman kickbacks are sent directly to this M-Pesa line.</span>} />
                    </label>
                    <div className="relative">
                        <Phone className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            required
                            type="tel"
                            autoComplete="tel"
                            value={phone}
                            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid Kenyan phone number (e.g. 0712345678 or 254...)')}
                            onChange={e => {
                                (e.target as HTMLInputElement).setCustomValidity('');
                                setPhone(normalizeKenyanPhone(e.target.value));
                            }}
                            onBlur={() => {
                                if (phone) setPhone(normalizeKenyanPhone(phone));
                            }}
                            className={inputClasses}
                            placeholder="e.g. 0712345678 or 254..."
                        />
                    </div>
                </div>

                {isExistingChairman ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 my-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5">
                            <Shield className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <p className="text-xs font-black text-emerald-400 uppercase tracking-wider">Active Chairman Session Verified</p>
                            <p className="text-[11px] text-gray-300 mt-0.5">
                                You are signed in as <strong className="text-white">{auth.currentUser?.email}</strong>. This new league will be seamlessly linked to your Chairman account.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5 mb-6">
                        <label className="block text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                            Secure Password <Tooltip text="Protects the league's financial vault. Treat this like a bank account." />
                        </label>
                        <div className="relative">
                            <Lock className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                                required={!isExistingChairman}
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className={inputClasses}
                                placeholder="Create a secure password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className="px-1 pt-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Security Strength</span>
                                <span className={clsx("text-[9px] font-bold uppercase tracking-wider", passwordStrengthResult.textColor)}>
                                    {passwordStrengthResult.label}
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-[#161d24] rounded-full overflow-hidden flex gap-1">
                                <div className={clsx("h-full rounded-full transition-all duration-300", passwordStrengthResult.w1)}></div>
                                <div className={clsx("h-full rounded-full transition-all duration-300", passwordStrengthResult.w2)}></div>
                                <div className={clsx("h-full rounded-full transition-all duration-300", passwordStrengthResult.w3)}></div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-2">
                        <button
                            type="submit"
                            disabled={!fullName || !email || !phone || (!isExistingChairman && !password) || isCheckingEmail}
                            className="w-full bg-[#FBBF24] hover:bg-[#eab308] text-[#0A0E17] font-bold text-base md:text-lg py-3.5 md:py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_24px_rgba(251,191,36,0.28)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isCheckingEmail ? (
                                <><span className="w-4 h-4 border-2 border-[#0A0E17] border-t-transparent rounded-full animate-spin" /> Checking...
                                </>
                            ) : isExistingChairman ? (
                                <><span>Configure New League</span><ArrowRight className="w-5 h-5" /></>
                            ) : (
                                <><span>Create Chairman Account</span><Trophy className="w-5 h-5" /></>
                            )}
                        </button>
                    </div>
            </form>

            {!isExistingChairman && (
                <div className="mt-6 pt-5 border-t border-white/5 text-center relative z-10">
                    <p className="text-[11px] md:text-xs text-gray-600 dark:text-gray-400">
                        Already a Chairman? <button onClick={() => navigate('/login', { state: { isAdminView: true } })} className="text-[#FBBF24] font-bold hover:underline">Log in here.</button>
                    </p>
                </div>
            )}
        </div>
    );

    const renderStep2 = () => (
        <div className={`space-y-6 ${stepAnimClass} w-full col-span-1 md:col-span-2`}>
            <div className="text-center mb-8 relative z-10">
                <h2 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight text-white">Build Your League's Economy</h2>
                <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm">Configure your chama rules, contributions, and prize distributions.</p>
            </div>
            <div className="w-full max-w-5xl mx-auto space-y-6">
                {/* Section 1: Core Configuration (Clean Top Card with 2-Column Responsive Inputs) */}
                <div className="bg-[#151c18] border border-white/5 p-5 md:p-6 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-4 text-white font-bold text-lg relative z-10">
                        <Shield className="w-5 h-5 text-[#22c55e]" /> Core Configuration
                    </div>
                    <div className="space-y-4 relative z-10">
                        {/* FPL League Link / ID First for instant prefill */}
                        <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-2xl p-4">
                            <label className="block text-[10px] md:text-xs font-black text-emerald-400 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                                <span>Paste FPL League Link or ID (Recommended)</span>
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 normal-case font-bold">1-Click Auto-Fill</span>
                            </label>
                            <input type="text" value={fplLeagueId} onChange={e => {
                                let val = e.target.value.trim();
                                // If they paste an FPL Standings link or URL, extract the numeric ID
                                const match = val.match(/leagues\/(\d+)/);
                                if (match && match[1]) {
                                    val = match[1];
                                }
                                const numericId = val.replace(/[^0-9]/g, '');
                                setFplLeagueId(numericId);

                                // Auto-fetch league name and members when ID looks valid
                                if (numericId.length >= 4) {
                                    setFplFetchStatus('loading');
                                    fetch(`/fpl-api/leagues-classic/${numericId}/standings/`)
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data?.league?.name) {
                                                setLeagueName(data.league.name);
                                                setFplFetchStatus('success');
                                                // Store standings and auto-prefill members for Step 3
                                                if (data?.standings?.results) {
                                                    setFplStandings(data.standings.results);
                                                    const memberCount = data.standings.results.length;
                                                    if (memberCount >= 2) setEstimatedMembers(memberCount);
                                                    
                                                    const cleanFullName = (fullName || '').trim().toLowerCase();
                                                    const imported = data.standings.results
                                                        .filter((entry: any) => {
                                                            const pName = (entry.player_name || '').trim().toLowerCase();
                                                            return !cleanFullName || pName !== cleanFullName;
                                                        })
                                                        .map((entry: any) => ({
                                                            displayName: entry.player_name,
                                                            phone: '',
                                                            fplEntryId: entry.entry,
                                                            fplTeamName: entry.entry_name,
                                                        }));
                                                    if (imported.length > 0) {
                                                        setMembers(imported.slice(0, 19));
                                                    }
                                                }
                                            } else {
                                                setFplFetchStatus('error');
                                            }
                                        })
                                        .catch(() => setFplFetchStatus('error'));
                                } else {
                                    setFplFetchStatus('idle');
                                }
                            }} className={inputClasses} placeholder="Paste your FPL League URL or 6-digit ID" />
                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                                Linking with your FPL link automatically pulls your <strong>League Name</strong> and <strong>FPL Managers</strong> so setup is instant and hassle-free.
                            </p>
                            {fplFetchStatus === 'loading' && (
                                <p className="text-[11px] text-[#FBBF24] mt-2 flex items-center gap-1.5 font-bold">
                                    <span className="w-2 h-2 bg-[#FBBF24] rounded-full animate-pulse" /> Connecting to Official FPL servers & auto-filling...
                                </p>
                            )}
                            {fplFetchStatus === 'success' && (
                                <p className="text-[11px] text-[#22c55e] mt-2 flex items-center gap-1.5 font-bold">
                                    <Check className="w-3.5 h-3.5" /> League & {fplStandings.length} members detected! Verified and auto-filled below.
                                </p>
                            )}
                            {fplFetchStatus === 'error' && (
                                <p className="text-[11px] text-red-400 mt-2 font-bold">
                                    Could not auto-fetch league. Check the number or enter details manually below.
                                </p>
                            )}
                        </div>

                        {/* Uniform 2x2 Grid of Core Config Inputs + Cohesive Dual Teams Row */}
                        <div className="space-y-3.5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {/* 1. League Name */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                                        <span>League Name</span>
                                        {fplFetchStatus === 'success' && (
                                            <span className="text-[9px] text-[#22c55e] bg-[#22c55e]/10 px-1.5 py-0.5 rounded border border-[#22c55e]/20 normal-case font-bold">Auto-filled</span>
                                        )}
                                    </label>
                                    <input type="text" value={leagueName} onChange={e => setLeagueName(e.target.value)} className={inputClasses} placeholder="e.g. Nairobi Premier League" />
                                    <p className="text-[9px] text-gray-500">Your Chama circle display title</p>
                                </div>

                                {/* 2. Gameweek Stake */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Gameweek Stake (KES)
                                    </label>
                                    <div className="flex bg-[#161d24] border border-white/5 rounded-xl overflow-hidden focus-within:border-[#FBBF24]/50 focus-within:ring-1 focus-within:ring-[#FBBF24]/50 transition-all">
                                        <span className="bg-[#11171a] px-3.5 flex items-center justify-center text-gray-400 font-bold border-r border-white/5 text-xs">KES</span>
                                        <input
                                            type="number"
                                            value={monthlyFee === 0 ? '' : monthlyFee}
                                            onFocus={e => e.target.select()}
                                            onChange={e => setMonthlyFee(Number(e.target.value))}
                                            className="w-full bg-transparent px-3.5 py-3 text-white font-medium text-sm focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#161d24] [-webkit-text-fill-color:white]"
                                        />
                                    </div>
                                    <p className="text-[9px] text-gray-500">Auto-deducted per member per GW (min KES 50)</p>
                                </div>

                                {/* 3. POCHI / M-PESA # */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider truncate" title="POCHI / M-PESA # (The number receiving funds)">
                                        POCHI / M-PESA #
                                    </label>
                                    <input
                                        type="tel"
                                        value={chairmanPayoutPhone}
                                        onChange={e => setChairmanPayoutPhone(normalizeKenyanPhone(e.target.value))}
                                        onBlur={() => {
                                            if (chairmanPayoutPhone) setChairmanPayoutPhone(normalizeKenyanPhone(chairmanPayoutPhone));
                                        }}
                                        className={inputClasses}
                                        placeholder="0712345678"
                                    />
                                    <p className="text-[9px] text-emerald-400 font-medium">The number receiving funds so Chairman knows</p>
                                </div>

                                {/* 4. Estimated Members */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Members Size (Est.)
                                    </label>
                                    <input
                                        type="number"
                                        min="2"
                                        max="20"
                                        value={estimatedMembers}
                                        onChange={e => setEstimatedMembers(Math.min(20, Math.max(2, Number(e.target.value) || 2)))}
                                        className={inputClasses}
                                        placeholder="10"
                                    />
                                    <p className="text-[9px] text-gray-500">Projections baseline for pot & prize modeling (2 - 20)</p>
                                </div>
                            </div>

                            {/* 5. Allow Dual Teams - Clean Cohesive Full-Width Row */}
                            <div className="flex items-center justify-between bg-[#161d24] border border-white/5 rounded-xl px-4 py-3 hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/25 flex items-center justify-center text-[#10B981] font-bold text-xs shrink-0">
                                        2x
                                    </div>
                                    <div className="min-w-0 pr-2">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-white">Allow Dual Teams</p>
                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">Optional</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Members may register 2 separate FPL teams under one M-Pesa account with independent pot payouts.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAllowMultipleTeams(!allowMultipleTeams)}
                                    className={clsx(
                                        "relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer",
                                        allowMultipleTeams ? "bg-[#10B981]" : "bg-white/10"
                                    )}
                                >
                                    <span className={clsx(
                                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                                        allowMultipleTeams ? "translate-x-5" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Side-by-Side Distribution Split (Left) and Pot Totals Live Preview (Right) with Matching Height */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-stretch">
                    {/* Left Card: Distribution Split Logic */}
                    <div className="bg-[#151c18] border border-white/5 p-5 md:p-6 rounded-2xl shadow-xl flex flex-col justify-between h-full">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-white font-bold text-base md:text-lg">
                                    <Trophy className="w-5 h-5 text-[#FBBF24]" /> Distribution Split Logic
                                </div>
                                <span className="px-2 py-1 bg-[#22c55e]/10 text-[#22c55e] text-[9px] uppercase font-bold tracking-widest rounded border border-[#22c55e]/20">Dynamic Payout</span>
                            </div>

                            {/* Redesigned Percentage Split Cards & Slider */}
                            <div className="mb-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Weekly Prize Pill Card */}
                                    <div className="p-3.5 rounded-xl bg-[#161d24] border border-[#22c55e]/30 flex flex-col items-center text-center relative overflow-hidden">
                                        <div className="absolute top-2 right-2 flex gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setWeeklyPrizePercent(Math.max(0, weeklyPrizePercent - 5))}
                                                className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
                                                title="Decrease 5%"
                                            >
                                                -
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWeeklyPrizePercent(Math.min(100, weeklyPrizePercent + 5))}
                                                className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
                                                title="Increase 5%"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Weekly Prize</span>
                                        <div className="flex items-baseline gap-1 my-0.5">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={weeklyPrizePercent}
                                                onChange={e => setWeeklyPrizePercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                                                className="text-2xl sm:text-3xl font-black text-[#22c55e] tabular-nums tracking-tight bg-transparent text-center w-16 outline-none focus:ring-1 focus:ring-[#22c55e]/50 rounded py-0.5"
                                            />
                                            <span className="text-xl sm:text-2xl font-black text-[#22c55e]">%</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-500 mt-0.5">Top GW Score</span>
                                    </div>

                                    {/* Grand Vault Pill Card */}
                                    <div className="p-3.5 rounded-xl bg-[#161d24] border border-[#FBBF24]/30 flex flex-col items-center text-center">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Grand Vault</span>
                                        <div className="flex items-baseline gap-1 my-0.5">
                                            <span className="text-2xl sm:text-3xl font-black text-[#FBBF24] tabular-nums tracking-tight py-0.5">
                                                {100 - weeklyPrizePercent}
                                            </span>
                                            <span className="text-xl sm:text-2xl font-black text-[#FBBF24]">%</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-500 mt-0.5">Season Podium</span>
                                    </div>
                                </div>

                                {/* Interactive Range Slider with explicit "Move slider to set" guidance */}
                                <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2.5">
                                    <div className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-[#10B981] flex items-center gap-1.5 uppercase tracking-wider">
                                            <Sliders className="w-3.5 h-3.5" /> Move slider to set split
                                        </span>
                                        <span className="text-[#FBBF24] font-mono text-xs">{weeklyPrizePercent}% Weekly · {100 - weeklyPrizePercent}% Vault</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={weeklyPrizePercent}
                                        onChange={(e) => setWeeklyPrizePercent(Number(e.target.value))}
                                        className="fc-range w-full h-2.5 rounded-lg appearance-none cursor-pointer outline-none"
                                        style={{
                                            background: `linear-gradient(to right, #22c55e ${weeklyPrizePercent}%, #FBBF24 ${weeklyPrizePercent}%)`
                                        }}
                                    />
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold px-1 gap-1">
                                        <button type="button" onClick={() => setWeeklyPrizePercent(0)} className="hover:text-white transition-colors cursor-pointer bg-white/5 px-2 py-0.5 rounded">0% (All Vault)</button>
                                        <button type="button" onClick={() => setWeeklyPrizePercent(50)} className="hover:text-white transition-colors cursor-pointer bg-white/5 px-2 py-0.5 rounded">50 / 50 Split</button>
                                        <button type="button" onClick={() => setWeeklyPrizePercent(70)} className="hover:text-white transition-colors cursor-pointer bg-white/5 px-2 py-0.5 rounded">70 / 30 Standard</button>
                                        <button type="button" onClick={() => setWeeklyPrizePercent(100)} className="hover:text-white transition-colors cursor-pointer bg-white/5 px-2 py-0.5 rounded">100% (All Weekly)</button>
                                    </div>
                                </div>

                                {/* Season Winners Selector */}
                                <div className="mt-4 mb-2">
                                    <label className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                                        <Users className="w-4 h-4 text-[#22c55e]" /> End of Season Winners
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { key: 'top1', label: 'Top 1' },
                                            { key: 'top3', label: 'Top 3' },
                                            { key: 'top5', label: 'Top 5' },
                                            { key: 'custom', label: 'Custom' },
                                        ].map((option) => (
                                            <button
                                                key={option.key}
                                                type="button"
                                                onClick={() => {
                                                    const mode = option.key as 'top1' | 'top3' | 'top5' | 'custom';
                                                    setSeasonWinnersMode(mode);
                                                    if (mode === 'top1') setSeasonWinnersCount(1);
                                                    if (mode === 'top3') setSeasonWinnersCount(3);
                                                    if (mode === 'top5') setSeasonWinnersCount(5);
                                                }}
                                                className={clsx(
                                                    "py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                                                    seasonWinnersMode === option.key
                                                        ? "bg-[#22c55e]/20 border-[#22c55e]/50 text-[#22c55e]"
                                                        : "bg-[#161d24] border-white/5 text-gray-600 dark:text-gray-400 hover:bg-white/[0.02]"
                                                )}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>

                                    {seasonWinnersMode === 'custom' && (
                                        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-[#0b1014]/60 p-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Custom winners</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={maxAllowedWinners}
                                                        value={normalizedCustomWinnerCount}
                                                        onChange={(e) => setCustomWinnerCount(Math.max(1, Math.min(maxAllowedWinners, Number(e.target.value) || 1)))}
                                                        className="mt-1 w-full bg-[#161d24] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                                {Array.from({ length: normalizedCustomWinnerCount }, (_, idx) => (
                                                    <div key={`ratio-${idx}`} className="flex items-center gap-2">
                                                        <span className="w-10 text-[10px] font-black uppercase tracking-widest text-gray-500">#{idx + 1}</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={customWinnerRatios[idx] || '0'}
                                                            onChange={(e) => {
                                                                const next = [...customWinnerRatios];
                                                                next[idx] = e.target.value;
                                                                setCustomWinnerRatios(next);
                                                            }}
                                                            className="flex-1 bg-[#161d24] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                                                        />
                                                        <span className="text-[10px] font-black text-gray-500">%</span>
                                                        <span className="w-14 text-right text-[10px] font-bold text-[#FBBF24]">{effectiveSeasonDistribution[idx] || 0}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Metric Pills for Split */}
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                            <div className="bg-[#161d24] border border-white/5 rounded-xl p-3 border-l-2 border-l-[#22c55e]">
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Weekly Payout</p>
                                <h4 className="text-lg font-bold text-white tabular-nums">KES {weeklyPrize.toLocaleString()}</h4>
                            </div>
                            <div className="bg-[#161d24] border border-white/5 rounded-xl p-3 border-l-2 border-l-[#FBBF24]">
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Grand Vault</p>
                                <h4 className="text-lg font-bold text-white tabular-nums">KES {grandVault.toLocaleString()}</h4>
                            </div>
                        </div>
                    </div>

                    {/* Right Card: Pot Totals Live Preview with Next Action */}
                    <div className="bg-[#151c18] border border-white/5 p-5 md:p-6 rounded-2xl shadow-xl flex flex-col justify-between h-full">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-extrabold text-white text-base md:text-lg">Pot Totals (Live Preview)</h3>
                                    <p className="text-[11px] text-[#22c55e] font-bold mt-0.5">Projected for {estimatedMembers} members · KES {monthlyFee}/GW</p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                    Pilot Phase
                                </span>
                            </div>

                            {/* Pot Cards Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                <div className="flex items-center gap-3 bg-[#161d24] p-3.5 rounded-xl border border-white/5">
                                    <div className="w-9 h-9 rounded-xl bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center shrink-0">
                                        <Trophy className="w-4 h-4 text-[#22c55e]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Est. Weekly Pot</p>
                                        <h4 className="text-lg font-black text-white tabular-nums tracking-tight">KES {weeklyPrize.toLocaleString()}</h4>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-[#161d24] p-3.5 rounded-xl border border-white/5">
                                    <div className="w-9 h-9 rounded-xl bg-[#FBBF24]/15 border border-[#FBBF24]/30 flex items-center justify-center shrink-0">
                                        <Shield className="w-4 h-4 text-[#FBBF24]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Est. Season Vault</p>
                                        <h4 className="text-lg font-black text-[#FBBF24] tabular-nums tracking-tight">KES {(grandVault * 38).toLocaleString()}</h4>
                                    </div>
                                </div>
                            </div>

                            {/* Season Projections List */}
                            <div className="pt-3 border-t border-white/5 space-y-2">
                                <h4 className="text-[10px] uppercase tracking-widest font-black text-gray-400">Season Podium Allocations</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {effectiveSeasonDistribution.map((percent, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-[#161d24]/60 px-3 py-2 rounded-xl border border-white/5 text-xs">
                                            <span className="flex items-center gap-1.5 text-gray-300 font-bold">
                                                <span className={clsx("min-w-[24px] text-center inline-block font-black px-1.5 py-0.5 rounded text-[10px]", idx === 0 ? "bg-[#FBBF24]/20 text-[#FBBF24]" : "bg-white/10 text-gray-400")}>#{idx + 1}</span>
                                                {idx === 0 ? 'Champion' : `Tier ${idx + 1}`}
                                            </span>
                                            <span className="font-black tabular-nums text-white">KES {((grandVault * 38) * (percent / 100)).toLocaleString()} <span className="text-[9px] text-gray-400 font-normal">({percent}%)</span></span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Transparent Pilot Fee Breakdown */}
                            <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] uppercase tracking-widest font-black text-gray-400 flex items-center gap-1.5">
                                        <Shield className="w-3 h-3 text-emerald-400" /> Transparent Fee Structure
                                    </h4>
                                    <span className="text-[9px] font-mono text-emerald-400 font-bold">Pilot: 98.5% Net to Members</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                                        <p className="text-[9px] text-emerald-300 font-bold uppercase">Net Pot</p>
                                        <p className="text-sm font-black text-emerald-400">98.5%</p>
                                    </div>
                                    <div className="p-2 rounded-xl bg-[#161d24] border border-white/5">
                                        <p className="text-[9px] text-gray-400 font-bold uppercase">M-Pesa API</p>
                                        <p className="text-sm font-black text-white">1.5%</p>
                                    </div>
                                    <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
                                        <p className="text-[9px] text-gray-500 font-bold uppercase">Platform/Kickback</p>
                                        <p className="text-sm font-black text-gray-400">0% (Waived)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Next: Add Members Action Button inside Right Card bottom */}
                        <div className="pt-4 mt-4 border-t border-white/5 shrink-0">
                            <button
                                type="button"
                                onClick={nextStep}
                                className="w-full bg-[#FBBF24] hover:bg-[#eab308] text-[#0a100a] font-black text-base py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] shadow-[0_0_20px_rgba(251,191,36,0.15)] cursor-pointer"
                            >
                                Next: Add Members <ArrowRight className="w-5 h-5 ml-1" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className={`space-y-6 ${stepAnimClass} w-full`}>
            <div className="text-center mb-4">
                <p className="text-[10px] text-[#FBBF24] font-bold uppercase tracking-widest mb-2">Step 3 of 4</p>
                <h2 className="text-2xl md:text-3xl font-extrabold mb-2 tracking-tight">Enroll League Members</h2>
                <p className="text-gray-400 text-xs md:text-sm max-w-xl mx-auto">
                    {members.length > 0
                        ? `We recovered ${members.length} teams from your FPL link. Choose Self-Onboarding to share an invite link, or manually add M-Pesa numbers directly.`
                        : "Add your members or paste your FPL link to pull all managers automatically."}
                </p>
            </div>

            {/* Quick Rules & Guidance */}
            <div className="max-w-4xl mx-auto bg-[#0f1923] border border-white/10 rounded-2xl px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FBBF24]">Multi-League Guidance</p>
                    <p className="text-[11px] text-gray-300 mt-1">Tell members to use the league switcher every time they move between circles so deposits, standings, and alerts map correctly.</p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#10B981]">Dual-Team Rule</p>
                    <p className="text-[11px] text-gray-300 mt-1">When a member has two entries, keep one phone identity and attach the second FPL ID in this enrollment stage.</p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-300">Co-Chair — What is it?</p>
                    <p className="text-[11px] text-gray-300 mt-1">The Co-Chair acts as a <strong className="text-white">second signatory</strong>. Every payout requires their approval before M-Pesa fires — your built-in fraud check. Tap ⭐ on a member to assign them.</p>
                </div>
            </div>

            {/* Enrollment Mode Choice Cards */}
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Mode 1: Self-Onboarding */}
                <div
                    onClick={() => setEnrollmentMode('self')}
                    className={clsx(
                        "p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 relative overflow-hidden",
                        enrollmentMode === 'self'
                            ? "bg-[#10B981]/15 border-[#10B981] shadow-[0_0_25px_rgba(16,185,129,0.15)]"
                            : "bg-[#161d24] border-white/10 hover:border-white/20 opacity-80"
                    )}
                >
                    <div className={clsx(
                        "size-10 rounded-xl flex items-center justify-center shrink-0 font-bold",
                        enrollmentMode === 'self' ? "bg-[#10B981] text-black" : "bg-white/10 text-gray-400"
                    )}>
                        <Share2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-white">Self-Onboarding Mode</p>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">Recommended</span>
                        </div>
                        <p className="text-[11px] text-gray-300 mt-1 leading-snug">
                            Skip entering phone numbers now! Just click Next to get your WhatsApp invite link. Members claim their team & enter their own M-Pesa number when they join.
                        </p>
                    </div>
                </div>

                {/* Mode 2: Chairman Manual Entry */}
                <div
                    onClick={() => setEnrollmentMode('manual')}
                    className={clsx(
                        "p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 relative overflow-hidden",
                        enrollmentMode === 'manual'
                            ? "bg-[#FBBF24]/15 border-[#FBBF24] shadow-[0_0_25px_rgba(251,191,36,0.15)]"
                            : "bg-[#161d24] border-white/10 hover:border-white/20 opacity-80"
                    )}
                >
                    <div className={clsx(
                        "size-10 rounded-xl flex items-center justify-center shrink-0 font-bold",
                        enrollmentMode === 'manual' ? "bg-[#FBBF24] text-black" : "bg-white/10 text-gray-400"
                    )}>
                        <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-white">Chairman Manual Entry</p>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">Optional</span>
                        </div>
                        <p className="text-[11px] text-gray-300 mt-1 leading-snug">
                            Directly tie M-Pesa numbers into each recovered FPL team below. You can also add custom members not found in FPL.
                        </p>
                    </div>
                </div>
            </div>

            {/* Recovered Teams & Member Management Panel */}
            <div className="max-w-4xl mx-auto bg-[#151c18] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">
                                {members.length > 0 ? "Recovered Teams & Managers" : "League Members"}
                            </h3>
                            <span className="bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 text-xs font-bold px-2 py-0.5 rounded">
                                {members.length + 1} Total Circle
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {enrollmentMode === 'self'
                                ? "Type numbers here if known, or leave them blank so managers self-link their M-Pesa via invite link."
                                : "Enter M-Pesa phone numbers below for direct enrollment."}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {fplStandings.length > 0 && members.length < fplStandings.length && (
                            <button
                                type="button"
                                onClick={handleImportFromFPL}
                                className="px-3 py-1.5 rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <ArrowRight className="w-3 h-3" /> Re-import ({fplStandings.length})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowAddManualMember(!showAddManualMember)}
                            className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <UserPlus className="w-3.5 h-3.5 text-[#22c55e]" />
                            {showAddManualMember ? "Close Manual Form" : "+ Add Non-FPL Member"}
                        </button>
                    </div>
                </div>

                {/* Collapsible Manual Member Addition Form */}
                {showAddManualMember && (
                    <form onSubmit={addLocalMember} className="p-4 rounded-xl bg-[#161d24] border border-white/10 space-y-3 animate-in fade-in duration-200">
                        <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <UserPlus className="w-3.5 h-3.5 text-[#22c55e]" /> Add Custom Member Manually
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Display Name</label>
                                <input
                                    type="text"
                                    value={newMemberName}
                                    onChange={e => setNewMemberName(e.target.value.replace(/[^a-zA-Z\s'\-]/g, ''))}
                                    placeholder="e.g. Kevin Otieno"
                                    className={inputClasses}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">M-Pesa Phone #</label>
                                <input
                                    type="tel"
                                    value={newMemberPhone}
                                    onChange={e => setNewMemberPhone(normalizeKenyanPhone(e.target.value))}
                                    placeholder="0712345678"
                                    className={inputClasses}
                                />
                            </div>
                            {allowMultipleTeams && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">2nd FPL Team ID (Opt)</label>
                                    <input
                                        type="text"
                                        value={newMemberSecondTeam}
                                        onChange={e => setNewMemberSecondTeam(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="e.g. 7890123"
                                        className={inputClasses}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowAddManualMember(false)}
                                className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!newMemberName || !newMemberPhone}
                                className="px-5 py-2 rounded-xl bg-[#22c55e] hover:bg-[#1fbb59] text-black font-bold text-xs disabled:opacity-50 cursor-pointer"
                            >
                                Enroll Custom Member
                            </button>
                        </div>
                    </form>
                )}

                {/* Members List Container */}
                <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                    {/* Chairman card — always pinned at top */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-[#FBBF24]/10 border-[#FBBF24]/30 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="size-9 rounded-xl flex items-center justify-center font-black text-sm border bg-[#FBBF24]/20 text-[#FBBF24] border-[#FBBF24]/30 shrink-0">
                                {fullName ? fullName.charAt(0).toUpperCase() : "C"}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-sm text-white leading-tight">{fullName || "Chairman"}</p>
                                    <span className="text-[9px] font-black text-[#FBBF24] uppercase tracking-widest px-2 py-0.5 bg-[#FBBF24]/20 border border-[#FBBF24]/30 rounded">
                                        👑 Chairman
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                    {phone || "Phone on file"} · League Administrator & Primary Payout Signatory
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] text-[#FBBF24] font-bold bg-black/30 px-2.5 py-1 rounded-lg border border-[#FBBF24]/20 shrink-0">
                            Registered Admin
                        </span>
                    </div>

                    {/* Recovered FPL Teams & Members */}
                    {members.map((m, i) => (
                        <div
                            key={i}
                            className={clsx(
                                "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all",
                                coAdminIndex === i
                                    ? "border-[#FBBF24]/40 bg-[#FBBF24]/8"
                                    : "border-white/10 bg-[#161d24]/70 hover:border-white/20"
                            )}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={clsx(
                                    "size-9 rounded-xl flex items-center justify-center font-bold text-sm border shrink-0",
                                    coAdminIndex === i
                                        ? "bg-[#FBBF24]/20 text-[#FBBF24] border-[#FBBF24]/30"
                                        : "bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/25"
                                )}>
                                    {m.displayName ? m.displayName.charAt(0).toUpperCase() : "M"}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm text-white truncate">
                                            {m.fplTeamName || m.displayName}
                                        </p>
                                        {m.fplEntryId && (
                                            <span className="text-[9px] font-mono font-bold text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.5 rounded border border-[#10B981]/25 shrink-0">
                                                #{m.fplEntryId}
                                            </span>
                                        )}
                                        {m.secondFplTeamId && (
                                            <span className="text-[9px] font-black text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/10 px-1.5 py-0.5 rounded tracking-widest uppercase shrink-0">
                                                Dual
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                                        Manager: <span className="text-gray-200">{m.displayName}</span>
                                        {m.phone ? (
                                            <span className="text-[#10B981] ml-2 font-mono font-medium">· {m.phone}</span>
                                        ) : (
                                            <span className="text-amber-400/80 ml-2 italic text-[10px]">· Self-onboarding link</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Direct Inline Phone Input & Controls */}
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="relative">
                                    <input
                                        type="tel"
                                        placeholder={enrollmentMode === 'self' ? "07... (or leave for link)" : "07... (M-Pesa #)"}
                                        value={m.phone}
                                        onChange={e => {
                                            const val = normalizeKenyanPhone(e.target.value);
                                            setMembers(prev => prev.map((mem, idx) => idx === i ? { ...mem, phone: val } : mem));
                                        }}
                                        className="w-44 sm:w-52 bg-[#0e141a] border border-white/10 focus:border-[#10B981]/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none transition-colors"
                                    />
                                </div>
                                <button
                                    type="button"
                                    title={coAdminIndex === i ? "Remove Co-Chair" : "Make Co-Chair (second payout signatory)"}
                                    onClick={() => setCoAdminIndex(coAdminIndex === i ? null : i)}
                                    className={clsx(
                                        "w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all shrink-0 cursor-pointer",
                                        coAdminIndex === i
                                            ? "bg-[#FBBF24] text-black shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                                            : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-[#FBBF24] border border-white/10"
                                    )}
                                >
                                    ⭐
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        removeLocalMember(i);
                                        if (coAdminIndex === i) setCoAdminIndex(null);
                                        else if (coAdminIndex !== null && coAdminIndex > i) setCoAdminIndex(coAdminIndex - 1);
                                    }}
                                    className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all text-xs shrink-0 cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}

                    {members.length === 0 && (
                        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl space-y-3">
                            <Users className="w-8 h-8 text-gray-500 mx-auto" />
                            <div>
                                <p className="text-sm font-bold text-white">No members added yet</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Paste your FPL league link in Step 2 to recover all teams, or add members manually above.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 3 Footer Action Bar */}
                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-gray-400 text-center sm:text-left">
                        {enrollmentMode === 'self' ? (
                            <span className="text-[#10B981] font-medium flex items-center gap-1.5 justify-center sm:justify-start">
                                <Check className="w-4 h-4" /> Self-onboarding enabled: Share link on WhatsApp after clicking Next.
                            </span>
                        ) : (
                            <span>{members.filter(m => m.phone).length} of {members.length} phone numbers tied directly.</span>
                        )}
                    </p>
                    <button
                        type="button"
                        onClick={nextStep}
                        disabled={enrollmentMode === 'manual' && members.length < 1}
                        className="w-full sm:w-auto px-8 bg-[#22c55e] hover:bg-[#1fbb59] text-[#0A0E17] font-bold text-base py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)] cursor-pointer disabled:opacity-50"
                    >
                        {enrollmentMode === 'self' ? (
                            <>
                                <span>Next: Review & Share Link</span>
                                <ArrowRight className="w-5 h-5" />
                            </>
                        ) : (
                            <>
                                <span>Next: Confirm League</span>
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className={`space-y-6 ${stepAnimClass} w-full`}>
            <div className="text-center mb-8">
                <p className="text-[10px] text-[#FBBF24] font-bold uppercase tracking-widest mb-2">Final Verification</p>
                <h2 className="text-2xl md:text-3xl font-extrabold mb-2 tracking-tight">Confirm League Details</h2>
                <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm">Review your economy and members before activating the league.</p>
            </div>

            <div className="bg-[#151c18] border border-white/5 rounded-2xl p-6 md:p-8 w-full max-w-3xl mx-auto shadow-xl relative overflow-hidden space-y-8">
                <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 to-transparent rounded-[2rem] pointer-events-none"></div>

                <div className="bg-[#22c55e]/10 border border-[#22c55e]/20 p-4 rounded-xl flex items-start gap-3 relative z-10 shadow-sm">
                    <Check className="w-5 h-5 text-[#22c55e] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#22c55e] leading-relaxed">
                        <strong className="block mb-1 text-sm tracking-tight text-white">Final Review</strong>
                        Once you initialize your league, your Gameweek stake and pot rules are saved and locked for fairness. Please review the summary below before creating the league.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#161d24] rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">League Name</p>
                        <p className="text-white font-bold truncate">{leagueName || "N/A"}</p>
                    </div>
                    <div className="bg-[#161d24] rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">FPL League ID</p>
                        <p className="text-white font-bold truncate">{fplLeagueId || "N/A"}</p>
                    </div>
                    <div className="bg-[#161d24] rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Monthly Fee</p>
                        <p className="text-[#22c55e] font-bold tabular-nums">KES {monthlyFee}</p>
                    </div>
                    <div className="bg-[#161d24] rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total Members</p>
                        <p className="text-white font-bold">{members.length + 1} <span className="text-xs text-gray-500 font-normal border border-gray-500/30 px-1 py-[1px] rounded inline-flex ml-1">inc. Chairman</span></p>
                    </div>
                    <div className="bg-[#161d24] rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Gross Pot</p>
                        <p className="text-white font-bold tabular-nums">KES {totalMonthlyPool}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-white font-bold">
                            <Trophy className="w-4 h-4 text-[#FBBF24]" /> Distribution Summary
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-[#0a100a]/50 p-3 rounded-xl border border-white/5 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Weekly Prize ({weeklyPrizePercent}%)</span>
                                <span className="font-bold text-white tabular-nums">KES {weeklyPrize}</span>
                            </div>
                            <div className="flex justify-between items-center bg-[#0a100a]/50 p-3 rounded-xl border border-white/5 text-sm">
                                <span className="text-gray-600 dark:text-gray-400 text-xs">Season Vault ({100 - weeklyPrizePercent}%)</span>
                                <span className="font-bold text-[#FBBF24] tabular-nums text-sm">KES {grandVault * 38} <span className="text-[9px] text-gray-500 font-normal">/38GWs</span></span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-4 text-white font-bold">
                            <Users className="w-4 h-4 text-[#22c55e]" /> Enrolled Members Snapshot
                        </div>
                        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2">
                            {/* Chairman row */}
                            <div className="flex justify-between items-center bg-[#22c55e]/10 p-2.5 rounded-lg border border-[#22c55e]/20 text-xs shadow-sm">
                                <span className="font-bold text-white flex items-center gap-1.5"><Shield className="w-3 h-3 text-[#FBBF24]" /> {fullName}</span>
                                <span className="text-[#22c55e] tabular-nums font-semibold">{phone}</span>
                            </div>

                            {/* Enrolled row */}
                            {members.slice(0, 5).map((m, i) => (
                                <div key={i} className="flex justify-between items-center bg-[#0a100a]/50 p-2.5 rounded-lg border border-white/5 text-xs">
                                    <span className="font-medium text-gray-200 truncate max-w-[160px]">{m.fplTeamName || m.displayName}</span>
                                    <span className="tabular-nums">
                                        {m.phone ? (
                                            <span className="text-gray-300 font-mono">{m.phone}</span>
                                        ) : (
                                            <span className="text-[#FBBF24] font-semibold text-[10px] bg-[#FBBF24]/10 px-1.5 py-0.5 rounded border border-[#FBBF24]/20">
                                                Self-onboard link
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ))}
                            {members.length > 5 && (
                                <div className="text-center text-[10px] text-gray-500 pt-1 font-bold tracking-widest uppercase">+ {members.length - 5} more members</div>
                            )}
                        </div>
                    </div>
                </div>

                {submitError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-xs p-4 rounded-xl mt-4">
                        {submitError === 'EMAIL_ALREADY_IN_USE' ? (
                            <div className="space-y-2">
                                <p className="text-amber-400 font-bold">This email belongs to an existing Chairman account.</p>
                                <p className="text-gray-300 text-xs">Please verify your password in Step 1 to add this new league to your account portfolio.</p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        type="button"
                                        onClick={() => { setStep(1); setStep1Error('Enter your existing password to link this new league.'); setSubmitError(''); }}
                                        className="flex-1 bg-[#22c55e] text-black font-bold py-2.5 rounded-xl text-xs hover:bg-[#1fbb59] transition-all"
                                    >
                                        Enter Password in Step 1
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/login', { state: { isAdminView: true } })}
                                        className="flex-1 bg-[#FBBF24] text-black font-bold py-2.5 rounded-xl text-xs hover:bg-[#eab308] transition-all"
                                    >
                                        Log In as Chairman
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-red-400 font-bold uppercase tracking-widest text-center">{submitError}</p>
                        )}
                    </div>
                )}

                <div className="pt-4 border-t border-white/10">
                    <button
                        onClick={handleConfirmLeague}
                        disabled={isSubmitting}
                        className="w-full bg-[#22c55e] hover:bg-[#1fbb59] text-[#0A0E17] font-bold text-base md:text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)] disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                                Securing League & Generating Signatures...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" /> Activate League & Proceed to Share Link
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep5 = () => (
        <div className="flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-500 h-full py-12">
            <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center p-4 bg-[#22c55e]/20 rounded-full mb-6">
                    <Check className="w-10 h-10 text-[#22c55e]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight text-white">League Created Successfully!</h2>
                <p className="text-gray-400 max-w-sm mx-auto text-xs md:text-sm">
                    Your league economy is live. Share this unique invite code or WhatsApp link so managers self-onboard and claim their teams.
                </p>
            </div>

            <div className="bg-[#151c18] border border-[#FBBF24]/30 p-8 md:p-10 rounded-[2rem] w-full max-w-sm text-center shadow-[0_0_50px_rgba(251,191,36,0.05)] relative overflow-hidden">
                <p className="text-[#FBBF24] text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3">Master Invite Code</p>
                <h1 className="text-5xl md:text-6xl font-black font-mono tracking-widest text-white drop-shadow-md">
                    {generatedCode.slice(0, 3)} <span className="text-[#FBBF24]">{generatedCode.slice(3, 6)}</span>
                </h1>
            </div>

            <div className="w-full max-w-sm space-y-3 mt-6">
                <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full bg-[#22c55e] hover:bg-[#1fbb59] text-[#0A0E17] font-black text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)] cursor-pointer"
                >
                    <Share2 className="w-5 h-5" />
                    {copied ? "Opening WhatsApp..." : "Share on WhatsApp"}
                </button>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={handleCopyInviteLink}
                        className="bg-[#161d24] border border-white/10 hover:border-white/20 text-white font-bold py-3 px-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <Copy className="w-3.5 h-3.5 text-[#10B981]" />
                        {copiedLink ? "Link Copied!" : "Copy Invite Link"}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyOnlyCode}
                        className="bg-[#161d24] border border-white/10 hover:border-white/20 text-white font-bold py-3 px-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <Smartphone className="w-3.5 h-3.5 text-[#FBBF24]" />
                        {copiedCode ? "Code Copied!" : "Copy Code Only"}
                    </button>
                </div>

                <div className="flex items-center gap-3 my-3">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Next Phase</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                </div>

                <button
                    type="button"
                    onClick={() => navigate('/dashboard', { replace: true })}
                    className="w-full bg-[#161d24] border border-white/10 hover:border-white/20 text-white font-bold py-3.5 rounded-xl transition-all shadow-md cursor-pointer hover:bg-white/5"
                >
                    Enter Chairman Command Center
                </button>

                <p className="text-[10px] text-[#22c55e] border border-[#22c55e]/20 bg-[#22c55e]/5 p-2 rounded text-center mt-3">
                    <Shield className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                    League settings and root members successfully transferred and secured in Firebase.
                </p>
            </div>
        </div>
    );

    return (
        <div className="fc-auth-shell min-h-[100dvh] bg-[#0b1014] flex flex-col items-center justify-center relative !overflow-x-hidden overflow-y-auto text-white font-sans w-full py-16 md:py-20">
            {/* ── Ambient background grid ─────────────────────────── */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none z-0" />

            {/* Network background graphic simulation */}
            <div className="fc-auth-network fixed right-[-10%] bottom-[-10%] w-[600px] h-[600px] opacity-20 pointer-events-none">
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
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex items-center gap-1.5 md:gap-2 text-gray-500 text-xs md:text-sm font-medium">
                        <Shield className="w-3 h-3 md:w-4 md:h-4 text-[#22c55e]" />
                        <span>Step {step} of {STEPS - 1}</span>
                    </div>
                    {step < STEPS && (
                        <button
                            type="button"
                            onClick={() => setShowExitModal(true)}
                            className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-red-500/40 bg-white/[0.04] hover:bg-red-500/10 text-gray-400 hover:text-red-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Exit</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="w-full max-w-screen-xl relative mx-auto my-auto z-10 flex flex-col justify-center items-center h-auto min-h-max">
                {step > 1 && step < STEPS && (
                    <div className={clsx("w-full mx-auto relative group mt-8 mb-6 md:mb-8",
                        step === 2 ? "max-w-5xl" : step === 3 ? "max-w-4xl" : "max-w-3xl")}>
                    <button onClick={prevStep} className="absolute -top-8 left-0 text-gray-500 hover:text-white flex items-center gap-1 transition-colors text-[11px] font-bold"
                        style={{ textTransform: 'none', letterSpacing: 'normal' }}>
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>

                    {/* Labeled step progress indicator */}
                    <div className="flex gap-2 w-full">
                        {[
                            { n: 1, label: 'Your Account' },
                            { n: 2, label: 'League Rules' },
                            { n: 3, label: 'Add Members' },
                            { n: 4, label: 'Invite Code' },
                        ].map(({ n, label }) => (
                            <div key={n} className="flex-1 flex flex-col items-center gap-1.5">
                                <div className={clsx(
                                    'h-1.5 w-full rounded-full transition-all duration-500',
                                    n < step ? 'bg-[#22c55e]' : n === step ? 'bg-[#FBBF24]' : 'bg-white/10'
                                )} />
                                <span className={clsx(
                                    'text-[9px] font-bold transition-colors hidden sm:block',
                                    n < step ? 'text-[#22c55e]' : n === step ? 'text-[#FBBF24]' : 'text-white/20'
                                )}>{label}</span>
                            </div>
                        ))}
                    </div>
                    </div>
                )}

                <div className={clsx("transition-all duration-500 mx-auto w-full",
                    step === 1 ? "max-w-2xl" :
                        step === 2 ? "max-w-5xl" :
                            step === 3 ? "max-w-4xl" :
                                step === 4 ? "max-w-3xl" : "max-w-md"
                )}>
                    <div className={clsx("transition-all duration-500 w-full min-h-[500px]")}>
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                        {step === 4 && renderStep4()}
                        {step === 5 && renderStep5()}
                    </div>
                </div>
            </div>

            {/* Exit Confirmation Modal */}
            {showExitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-[#0c1219] border border-white/15 rounded-3xl p-6 md:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative text-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-[0_0_24px_rgba(245,158,11,0.2)]">
                            <AlertTriangle className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-black text-white tracking-tight mb-2">
                            Stop League Creation?
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed mb-6">
                            Are you sure you want to stop now? Any new league settings or custom rules you have configured will be discarded.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => setShowExitModal(false)}
                                className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.05] hover:bg-white/10 text-white font-bold text-sm transition-all"
                            >
                                Keep Editing
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowExitModal(false);
                                    navigate('/dashboard', { replace: true });
                                }}
                                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm shadow-[0_4px_16px_rgba(225,29,72,0.3)] transition-all"
                            >
                                Exit to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute bottom-6 w-full text-center z-10 px-4">
                <p className="text-[8px] md:text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                    © {new Date().getFullYear()} Fantasy Chama Global Wealth Management. All Rights Reserved.
                </p>
            </div>
        </div>
    );
}
