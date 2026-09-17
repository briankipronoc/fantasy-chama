import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, UserPlus, ArrowLeft, Check, Smartphone, Trophy, PersonStanding, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, Users, Info, AlertTriangle, X, Share2, Sliders, Copy, RefreshCw, ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc, setDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { normalizeKenyanPhone } from '../utils/phone';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import UserAvatar from '../components/UserAvatar';

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
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Step 2: League
    const [leagueName, setLeagueName] = useState('');
    const [fplLeagueId, setFplLeagueId] = useState('');

    useEffect(() => {
        // 1. Synchronously prefill known details from localStorage immediately
        const savedName = localStorage.getItem('fc-setup-fullName') || localStorage.getItem('activeUserName');
        if (savedName && savedName.trim().toLowerCase() !== 'chairman' && savedName.trim().toLowerCase() !== 'admin') {
            setFullName(savedName.trim());
        }

        const savedEmail = localStorage.getItem('fc-setup-email') || localStorage.getItem('fc-login-email') || localStorage.getItem('activeUserEmail') || auth.currentUser?.email;
        if (savedEmail) {
            setEmail(savedEmail.trim());
            localStorage.setItem('fc-setup-email', savedEmail.trim());
        }

        const savedPhone = localStorage.getItem('fc-setup-phone') || localStorage.getItem('fc-setup-chairmanPayoutPhone') || localStorage.getItem('memberPhone') || localStorage.getItem('activeUserPhone');
        if (savedPhone) {
            setPhone(savedPhone.trim());
            setChairmanPayoutPhone(savedPhone.trim());
        }

        const savedLeagueName = localStorage.getItem('fc-setup-leagueName');
        if (savedLeagueName) setLeagueName(savedLeagueName);

        const savedFplLeagueId = localStorage.getItem('fc-setup-fplLeagueId');
        if (savedFplLeagueId) setFplLeagueId(savedFplLeagueId);

        // 2. Fetch existing active league info if available from Firestore
        const activeLid = localStorage.getItem('activeLeagueId');
        if (activeLid) {
            getDoc(doc(db, 'leagues', activeLid))
                .then(snap => {
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data?.chairmanName && (!savedName || savedName.trim().toLowerCase() === 'chairman' || savedName.trim().toLowerCase() === 'admin')) {
                            setFullName(data.chairmanName);
                            localStorage.setItem('fc-setup-fullName', data.chairmanName);
                        }
                        if (data?.chairmanPhone && !savedPhone) {
                            setPhone(data.chairmanPhone);
                            setChairmanPayoutPhone(data.chairmanPhone);
                            localStorage.setItem('fc-setup-phone', data.chairmanPhone);
                        }
                        if (data?.chairmanEmail && !savedEmail) {
                            setEmail(data.chairmanEmail);
                            localStorage.setItem('fc-setup-email', data.chairmanEmail);
                        }
                    }
                })
                .catch(err => console.warn('Could not read existing league profile:', err));
        }

        // 3. Listen to auth state to capture asynchronous Firebase Auth restoration
        const unsubscribe = onAuthStateChanged(auth, async (currentAuthUser) => {
            if (currentAuthUser && !currentAuthUser.isAnonymous && currentAuthUser.email) {
                setIsExistingChairman(true);
                setRole('admin');
                setEmail(currentAuthUser.email);
                localStorage.setItem('fc-setup-email', currentAuthUser.email);

                if (currentAuthUser.displayName && (!fullName || fullName.trim().toLowerCase() === 'chairman' || fullName.trim().toLowerCase() === 'admin')) {
                    setFullName(currentAuthUser.displayName);
                    localStorage.setItem('fc-setup-fullName', currentAuthUser.displayName);
                }

                // If user is already an authenticated Chairman and has phone/email on record, jump to step 2
                const resolvedPhone = localStorage.getItem('memberPhone') || localStorage.getItem('fc-setup-phone');
                if (resolvedPhone) {
                    setPhone(resolvedPhone);
                    setChairmanPayoutPhone(resolvedPhone);
                }
                setStep(prev => prev === 1 ? 2 : prev);
            }
        });

        return () => unsubscribe();
    }, []);

    // Prompt user before accidental tab close during setup
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (step > 1 && !isSubmitting) {
                e.preventDefault();
                e.returnValue = 'You have unsaved league configuration. Leaving will discard your setup progress.';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [step, isSubmitting]);

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
    const [coAdminIndices, setCoAdminIndices] = useState<number[]>([]);
    const [enrollmentMode, setEnrollmentMode] = useState<'self' | 'manual'>('self');
    const [showAddManualMember, setShowAddManualMember] = useState(false);
    const [chairmanFplSquad, setChairmanFplSquad] = useState<{ entry: number; entryName: string; playerName: string } | null>(null);

    // Dynamic Manager Display Name (Always resolves to manager's actual name from selected FPL squad or auth)
    const effectiveManagerName = useMemo(() => {
        // Priority 1: Match from FPL Standings for the selected Chairman squad
        if (chairmanFplSquad?.entry && fplStandings.length > 0) {
            const matched = fplStandings.find(s => Number(s.entry) === Number(chairmanFplSquad.entry));
            if (matched?.player_name && matched.player_name.trim() && matched.player_name.trim().toLowerCase() !== 'chairman' && matched.player_name.trim().toLowerCase() !== 'admin') {
                return matched.player_name.trim();
            }
        }
        // Priority 2: Chairman squad object playerName
        if (chairmanFplSquad?.playerName && chairmanFplSquad.playerName.trim() && chairmanFplSquad.playerName.trim().toLowerCase() !== 'chairman' && chairmanFplSquad.playerName.trim().toLowerCase() !== 'admin') {
            return chairmanFplSquad.playerName.trim();
        }
        // Priority 3: User entered fullName
        if (fullName && fullName.trim() && fullName.trim().toLowerCase() !== 'chairman' && fullName.trim().toLowerCase() !== 'admin') {
            return fullName.trim();
        }
        // Priority 4: Stored user name in localStorage
        const storedName = localStorage.getItem('fc-setup-fullName') || localStorage.getItem('activeUserName');
        if (storedName && storedName.trim() && storedName.trim().toLowerCase() !== 'chairman' && storedName.trim().toLowerCase() !== 'admin') {
            return storedName.trim();
        }
        // Priority 5: Auth display name
        const authName = auth.currentUser?.displayName;
        if (authName && authName.trim() && authName.trim().toLowerCase() !== 'chairman' && authName.trim().toLowerCase() !== 'admin') {
            return authName.trim();
        }
        return 'League Founder';
    }, [fullName, chairmanFplSquad, fplStandings, auth.currentUser?.displayName]);

    // Auto-heal fullName when effectiveManagerName resolves a genuine manager name
    useEffect(() => {
        if (effectiveManagerName && effectiveManagerName !== 'League Founder' && (!fullName || fullName.trim().toLowerCase() === 'chairman' || fullName.trim().toLowerCase() === 'admin')) {
            setFullName(effectiveManagerName);
            localStorage.setItem('fc-setup-fullName', effectiveManagerName);
            localStorage.setItem('activeUserName', effectiveManagerName);
        }
    }, [effectiveManagerName, fullName]);

    const toggleCoChair = (index: number) => {
        setCoAdminIndices(prev => {
            if (prev.includes(index)) {
                return prev.filter(i => i !== index);
            }
            if (prev.length >= 2) {
                toast.error('Maximum 2 Co-Chairs allowed per league constitution.');
                return prev;
            }
            return [...prev, index];
        });
    };

    // Multi-tier FPL league and standings fetcher with fallback proxies
    const fetchFplLeagueData = async (inputStr: string) => {
        if (!inputStr) return;
        let numericId = inputStr.trim();
        const match = numericId.match(/leagues\/(\d+)/) || numericId.match(/(\d{4,9})/);
        if (match && match[1]) {
            numericId = match[1];
        } else {
            numericId = numericId.replace(/[^0-9]/g, '');
        }

        if (numericId.length < 4) {
            setFplFetchStatus('idle');
            return;
        }

        setFplLeagueId(numericId);
        setFplFetchStatus('loading');

        const endpoints = [
            `/fpl-api/leagues-classic/${numericId}/standings/`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${numericId}/standings/`)}`,
            `https://corsproxy.io/?${encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${numericId}/standings/`)}`
        ];

        let successData: any = null;
        for (const url of endpoints) {
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.league?.name || data?.standings?.results) {
                        successData = data;
                        break;
                    }
                }
            } catch (err) {
                console.warn(`[fpl-fetch] Endpoint failed: ${url}`, err);
            }
        }

        if (successData?.league?.name || successData?.standings?.results) {
            if (successData.league?.name) {
                setLeagueName(successData.league.name);
            }
            setFplFetchStatus('success');
            if (successData.standings?.results) {
                const results = successData.standings.results;
                setFplStandings(results);
                if (results.length >= 2) {
                    setEstimatedMembers(Math.min(20, results.length));
                }

                const cleanFullName = (fullName || '').trim().toLowerCase();
                const matchedChairman = cleanFullName
                    ? results.find((entry: any) => {
                        const pName = (entry.player_name || '').trim().toLowerCase();
                        return pName === cleanFullName || (cleanFullName.length > 3 && (pName.includes(cleanFullName) || cleanFullName.includes(pName)));
                    })
                    : null;

                if (matchedChairman) {
                    const squadObj = {
                        entry: Number(matchedChairman.entry),
                        entryName: matchedChairman.entry_name || 'My Squad',
                        playerName: matchedChairman.player_name || fullName,
                    };
                    setChairmanFplSquad(squadObj);
                    localStorage.setItem('fc-setup-chairmanFplSquad', JSON.stringify(squadObj));
                }

                const imported = results
                    .filter((entry: any) => {
                        if (matchedChairman && Number(entry.entry) === Number(matchedChairman.entry)) return false;
                        return true;
                    })
                    .map((entry: any) => ({
                        displayName: entry.player_name || entry.entry_name || 'FPL Manager',
                        phone: '',
                        fplEntryId: Number(entry.entry),
                        fplTeamName: entry.entry_name,
                    }));
                if (imported.length > 0) {
                    setMembers(imported.slice(0, 19));
                }
                toast.success(`Recovered ${results.length} squads from "${successData.league?.name || numericId}"!`);
            }
        } else {
            setFplFetchStatus('error');
            toast.error('Could not fetch FPL league. Check ID or paste full link.');
        }
    };

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

    const totalSquadsCount = fplStandings.length > 0 ? fplStandings.length : (members.length + (chairmanFplSquad ? 1 : 0));
    const otherMembersCount = chairmanFplSquad ? Math.max(0, totalSquadsCount - 1) : totalSquadsCount;

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
            while (next.length < normalizedCustomWinnerCount) {
                next.push('0');
            }
            return next;
        });
    }, [seasonWinnersMode, normalizedCustomWinnerCount]);

    const passwordStrengthResult = useMemo(() => {
        if (!password) return { label: 'Empty', w1: 'w-0', w2: 'w-0', w3: 'w-0', textColor: 'text-gray-500' };
        if (password.length < 6) return { label: 'Too Short', w1: 'w-1/3 bg-red-500', w2: 'w-0', w3: 'w-0', textColor: 'text-red-500' };
        if (password.length < 10) return { label: 'Medium', w1: 'w-1/3 bg-amber-500', w2: 'w-1/3 bg-amber-500', w3: 'w-0', textColor: 'text-amber-500' };
        return { label: 'Strong', w1: 'w-1/3 bg-[#22c55e]', w2: 'w-1/3 bg-[#22c55e]', w3: 'w-1/3 bg-[#22c55e]', textColor: 'text-[#22c55e]' };
    }, [password]);

    const nextStep = async () => {
        // Universal identity checks before advancing
        if (!email.trim() || !email.includes('@')) {
            toast.error('Chairman login email is required before proceeding. Please complete Step 1.');
            setStep(1);
            return;
        }
        if (!phone.trim()) {
            toast.error('Payout M-Pesa phone number is required before proceeding. Please complete Step 1.');
            setStep(1);
            return;
        }
        if (!fullName.trim() && !effectiveManagerName) {
            toast.error('Full name is required before proceeding. Please enter your name in Step 1.');
            setStep(1);
            return;
        }

        if (step === 1) {
            if (!fullName.trim()) {
                toast.error('Please enter your full name.');
                return;
            }
            if (!email.trim() || !email.includes('@')) {
                toast.error('Please enter a valid email address.');
                return;
            }
            if (!phone.trim()) {
                toast.error('Please enter your M-Pesa phone number.');
                return;
            }
            if (!isExistingChairman && (!auth.currentUser || auth.currentUser.isAnonymous) && (!password || password.length < 6)) {
                toast.error('Please create a secure password (at least 6 characters).');
                return;
            }
            // If already authenticated as this chairman, proceed directly to Step 2
            if (auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.email?.toLowerCase() === email.trim().toLowerCase()) {
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

    const [submitError, setSubmitError] = useState('');

    useEffect(() => {
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

        const savedMembersRaw = localStorage.getItem('fc-setup-members');
        if (savedMembersRaw) {
            try {
                const parsed = JSON.parse(savedMembersRaw);
                if (Array.isArray(parsed) && parsed.length > 0) setMembers(parsed);
            } catch {}
        }

        const savedStandingsRaw = localStorage.getItem('fc-setup-fplStandings');
        if (savedStandingsRaw) {
            try {
                const parsed = JSON.parse(savedStandingsRaw);
                if (Array.isArray(parsed) && parsed.length > 0) setFplStandings(parsed);
            } catch {}
        }

        const savedChairmanSquad = localStorage.getItem('fc-setup-chairmanFplSquad');
        if (savedChairmanSquad) {
            try {
                const parsed = JSON.parse(savedChairmanSquad);
                if (parsed?.entry) {
                    setChairmanFplSquad(parsed);
                }
            } catch {}
        }

        setAllowMultipleTeams(localStorage.getItem('fc-setup-allowMultipleTeams') === 'true');
    }, []);

    useEffect(() => {
        if (chairmanFplSquad) {
            localStorage.setItem('fc-setup-chairmanFplSquad', JSON.stringify(chairmanFplSquad));
        } else {
            localStorage.removeItem('fc-setup-chairmanFplSquad');
        }
    }, [chairmanFplSquad]);

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
        if (members.length > 0) {
            localStorage.setItem('fc-setup-members', JSON.stringify(members));
        }
    }, [members]);

    useEffect(() => {
        if (fplStandings.length > 0) {
            localStorage.setItem('fc-setup-fplStandings', JSON.stringify(fplStandings));
        }
    }, [fplStandings]);

    // Auto-sync FPL league if ID exists but members were not yet loaded
    useEffect(() => {
        if (fplLeagueId && fplLeagueId.length >= 4 && members.length === 0 && fplFetchStatus === 'idle') {
            fetchFplLeagueData(fplLeagueId);
        }
    }, [fplLeagueId]);

    useEffect(() => {
        if (!chairmanPayoutPhone && phone) {
            setChairmanPayoutPhone(phone);
        }
    }, [phone]); // only depend on phone, avoids blocking manual edits

    const handleConfirmLeague = async () => {
        setIsSubmitting(true);
        setSubmitError('');

        try {
            const cleanEmail = (
                email.trim() || 
                auth.currentUser?.email || 
                localStorage.getItem('fc-setup-email') || 
                localStorage.getItem('fc-login-email') || 
                localStorage.getItem('activeUserEmail') || 
                ''
            ).trim();

            if (!cleanEmail || !cleanEmail.includes('@')) {
                setSubmitError('Chairman login email is required. Please return to Step 1 to enter your account email and password.');
                setStep(1);
                setIsSubmitting(false);
                return;
            }

            if (!email.trim() && cleanEmail) {
                setEmail(cleanEmail);
            }

            const resolvedChairmanName = (
                (effectiveManagerName && effectiveManagerName !== 'League Founder' ? effectiveManagerName : '') || 
                (fullName && fullName.trim().toLowerCase() !== 'chairman' && fullName.trim().toLowerCase() !== 'admin' ? fullName.trim() : '') ||
                auth.currentUser?.displayName ||
                'Chairman'
            );

            // Write 1: Create Admin User or reuse existing Chairman session
            let chairmanUser = auth.currentUser;
            if (chairmanUser?.isAnonymous) {
                await signOut(auth);
                chairmanUser = null;
            }

            if (!chairmanUser || chairmanUser.email?.toLowerCase() !== cleanEmail.toLowerCase()) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
                    chairmanUser = userCredential.user;
                } catch (authErr: any) {
                    if (authErr.code === 'auth/email-already-in-use') {
                        if (password) {
                            const signInRes = await signInWithEmailAndPassword(auth, cleanEmail, password);
                            chairmanUser = signInRes.user;
                        } else {
                            setSubmitError('EMAIL_ALREADY_IN_USE');
                            setIsSubmitting(false);
                            return;
                        }
                    } else if (authErr.code === 'auth/invalid-email') {
                        setSubmitError('Please enter a valid email address in Step 1.');
                        setIsSubmitting(false);
                        return;
                    } else {
                        throw authErr;
                    }
                }
            }

            if (resolvedChairmanName && (!chairmanUser.displayName || chairmanUser.displayName !== resolvedChairmanName)) {
                try {
                    await updateProfile(chairmanUser, { displayName: resolvedChairmanName });
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
                chairmanName: resolvedChairmanName,
                chairmanPhone: chairmanPayoutPhone || phone,
                chairmanEmail: cleanEmail,
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

            // Enroll Chairman First (with linked FPL squad if selected)
            const chairmanRef = doc(collection(db, 'leagues', leagueId, 'memberships'));
            const chairmanData: any = {
                displayName: resolvedChairmanName,
                phone: phone,
                hasPaid: false,
                walletBalance: 0,
                role: 'admin',
                trustScore: 100,
                avatarSeed: Math.random().toString(36).substring(7),
                joinedAt: serverTimestamp(),
                isActive: true,
            };

            if (chairmanFplSquad) {
                chairmanData.fplTeamId = chairmanFplSquad.entry;
                chairmanData.fplTeamName = chairmanFplSquad.entryName;
                chairmanData.playMode = 'pot';
            } else {
                chairmanData.playMode = 'admin_only';
                chairmanData.isSpectator = true;
            }

            batch.set(chairmanRef, chairmanData);

            // Filter out any member matching the chairman's squad, phone, or name to prevent duplicate chairman registration
            const cleanPhone = (phone || '').replace(/\D/g, '');
            const cleanFullName = (fullName || '').trim().toLowerCase();
            const uniqueMembers = members.filter(member => {
                if (chairmanFplSquad && Number(member.fplEntryId) === Number(chairmanFplSquad.entry)) return false;
                const mPhone = (member.phone || '').replace(/\D/g, '');
                const mName = (member.displayName || '').trim().toLowerCase();
                const isSamePhone = cleanPhone && mPhone && (cleanPhone.slice(-9) === mPhone.slice(-9));
                const isSameName = cleanFullName && mName && cleanFullName === mName;
                return !isSamePhone && !isSameName;
            });

            // Enroll Other Members
            const coAdminDocIds: string[] = [];
            uniqueMembers.forEach((member, index) => {
                const memberRef = doc(collection(db, 'leagues', leagueId, 'memberships'));
                const isCoAdmin = coAdminIndices.includes(index);

                if (isCoAdmin) {
                    coAdminDocIds.push(memberRef.id);
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

            // If co-chairs were selected, explicitly link them to the root league document
            if (coAdminDocIds.length > 0) {
                const leagueUpdateRef = doc(db, 'leagues', leagueId);
                batch.update(leagueUpdateRef, {
                    coAdminId: coAdminDocIds[0],
                    coAdminIds: coAdminDocIds
                });
            }

            await batch.commit();

            const finalMemberCount = fplStandings.length > 0
                ? fplStandings.length
                : (uniqueMembers.length + (chairmanFplSquad ? 1 : 0));

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
                    message: `${fullName} created ${leagueName} with ${finalMemberCount} members.`,
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
            localStorage.setItem('activeUserName', resolvedChairmanName);
            if (phone) localStorage.setItem('memberPhone', phone);
            if (cleanEmail) localStorage.setItem('fc-login-email', cleanEmail);

            // Ensure role is set (it was set at step 1 but re-confirm after writes)
            setRole('admin');

            // Clean up setup form data from localStorage
            [
                'fc-setup-fullName', 'fc-setup-email', 'fc-setup-phone',
                'fc-setup-chairmanPayoutPhone', 'fc-setup-leagueName', 'fc-setup-fplLeagueId',
                'fc-setup-monthlyFee', 'fc-setup-weeklyPrizePercent', 'fc-setup-seasonWinnersCount',
                'fc-setup-seasonWinnersMode', 'fc-setup-customWinnerCount', 'fc-setup-customWinnerRatios',
                'fc-setup-estimatedMembers', 'fc-setup-allowMultipleTeams',
                'fc-setup-members', 'fc-setup-fplStandings', 'fc-setup-chairmanFplSquad',
            ].forEach(key => localStorage.removeItem(key));

            setStep(5);
            setStepDirection('forward');

        } catch (error: any) {
            console.error('Error creating league or enrolling members:', error);
            if (error.code === 'auth/email-already-in-use') {
                setSubmitError('EMAIL_ALREADY_IN_USE');
            } else if (error.code === 'auth/invalid-email') {
                setSubmitError('Invalid email format. Please return to Step 1 and provide a valid Chairman email.');
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


    // Import all FPL managers from standings as blank-phone members (excluding Chairman's linked squad)
    const handleImportFromFPL = () => {
        if (fplStandings.length === 0) return;
        const imported = fplStandings
            .filter(e => {
                if (chairmanFplSquad && Number(e.entry) === Number(chairmanFplSquad.entry)) return false;
                return true;
            })
            .map(e => ({
                displayName: e.player_name || e.entry_name || 'FPL Manager',
                phone: '',
                fplEntryId: Number(e.entry),
                fplTeamName: e.entry_name, // store FPL team name
            }));
        setMembers(imported.slice(0, 19));
    };

    const handleSelectChairmanSquad = (selectedEntryId: number | null) => {
        if (!selectedEntryId) {
            setChairmanFplSquad(null);
            localStorage.removeItem('fc-setup-chairmanFplSquad');
            if (fplStandings.length > 0) {
                const allImported = fplStandings.map(e => ({
                    displayName: e.player_name || e.entry_name || 'FPL Manager',
                    phone: '',
                    fplEntryId: Number(e.entry),
                    fplTeamName: e.entry_name,
                }));
                setMembers(allImported.slice(0, 19));
            }
            toast.success('Switched to Pure Admin (Non-Playing mode)');
            return;
        }
        const matched = fplStandings.find(e => Number(e.entry) === Number(selectedEntryId));
        if (matched) {
            const chosenPlayerName = (matched.player_name && matched.player_name.trim().toLowerCase() !== 'chairman' && matched.player_name.trim().toLowerCase() !== 'admin')
                ? matched.player_name.trim()
                : (fullName && fullName.trim().toLowerCase() !== 'chairman' && fullName.trim().toLowerCase() !== 'admin')
                    ? fullName.trim()
                    : 'Manager';
            const squadObj = {
                entry: Number(matched.entry),
                entryName: matched.entry_name || 'My Squad',
                playerName: chosenPlayerName,
            };
            setChairmanFplSquad(squadObj);
            localStorage.setItem('fc-setup-chairmanFplSquad', JSON.stringify(squadObj));
            
            // Auto-update Chairman's name from their selected FPL squad
            if (matched.player_name && matched.player_name.trim().toLowerCase() !== 'chairman' && matched.player_name.trim().toLowerCase() !== 'admin') {
                const cleanName = matched.player_name.trim();
                setFullName(cleanName);
                localStorage.setItem('fc-setup-fullName', cleanName);
                localStorage.setItem('activeUserName', cleanName);
            }

            // Remove this squad from the remaining members list using strict Number conversion
            setMembers(prev => prev.filter(m => Number(m.fplEntryId) !== Number(selectedEntryId)));
            toast.success(`Linked profile to "${matched.entry_name}" (${chosenPlayerName})!`);
        }
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

        const cleanFullName = (fullName || effectiveManagerName || '').trim().toLowerCase();
        const cleanChairmanPhone = (phone || '').replace(/\D/g, '');
        const mPhone = (newMemberPhone || '').replace(/\D/g, '');
        const mName = (newMemberName || '').trim().toLowerCase();

        if (cleanFullName && mName === cleanFullName) {
            toast.error(`${effectiveManagerName} is already enrolled as the league administrator.`);
            return;
        }
        if (cleanChairmanPhone && mPhone && cleanChairmanPhone.slice(-9) === mPhone.slice(-9)) {
            toast.error(`This phone number is already registered to ${effectiveManagerName}.`);
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
        <div className={`fc-auth-card w-[95%] sm:w-[540px] max-w-xl mx-auto bg-gradient-to-b from-[#1c272c] to-[#11171a] border border-white/5 rounded-[2rem] p-5 sm:p-7 z-10 shadow-2xl relative ${stepAnimClass}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 to-transparent rounded-[2rem] pointer-events-none"></div>
            <div className="text-center mb-4 relative z-10">
                <h1 className="text-2xl md:text-3xl font-bold mb-1 tracking-tight text-white">
                    {isExistingChairman ? "Create Another League" : "Chairman Sign Up"}
                </h1>
                <p className="text-gray-400 text-xs sm:text-sm">
                    {isExistingChairman 
                        ? "Add another Chama circle under your Chairman account"
                        : "Create your account to set up your FPL league"}
                </p>
            </div>

            <form className="space-y-4 relative z-10" onSubmit={async (e) => { e.preventDefault(); await nextStep(); }}>
                {/* 1. Account Credentials & Security */}
                <div className="p-4 rounded-2xl bg-[#161d24]/80 border border-white/5 space-y-3 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black flex items-center justify-center shrink-0">1</span>
                        <h3 className="text-xs font-black uppercase tracking-wider text-white">Account Credentials & Security</h3>
                    </div>

                    <div>
                        <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">
                            Full Name <Tooltip text="Your legal name as Chairman, shown to members when they join." />
                        </label>
                        <div className="relative">
                            <PersonStanding className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                required
                                type="text"
                                autoComplete="name"
                                value={fullName}
                                onChange={e => setFullName(e.target.value.replace(/[^a-zA-Z\s'\-]/g, ''))}
                                pattern="^[a-zA-Z][a-zA-Z'\-\s]{1,}[a-zA-Z]$"
                                title="Please enter at least two names (e.g., Brian Kiprono)"
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/5 bg-[#0b1014] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FBBF24]/50 text-sm font-medium"
                                placeholder="Enter your legal name"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">
                            Email Address <Tooltip text="Your primary God Mode login ID. We never spam." />
                        </label>
                        <div className="relative">
                            <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/5 bg-[#0b1014] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FBBF24]/50 text-sm font-medium"
                                placeholder="admin@fantasychama.com"
                            />
                        </div>
                        {step1Error && (
                            <div className="mt-2 flex items-start gap-2 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
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

                    {!isExistingChairman && (
                        <div className="space-y-1">
                            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">
                                Secure Password <Tooltip text="Protects the league's financial vault. Treat this like a bank account." />
                            </label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    required={!isExistingChairman}
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-white/5 bg-[#0b1014] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FBBF24]/50 text-sm font-medium"
                                    placeholder="Create a secure password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="px-1 pt-1.5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Security Strength</span>
                                    <span className={clsx("text-[9px] font-bold uppercase tracking-wider", passwordStrengthResult.textColor)}>
                                        {passwordStrengthResult.label}
                                    </span>
                                </div>
                                <div className="h-1 w-full bg-[#0b1014] rounded-full overflow-hidden flex gap-1">
                                    <div className={clsx("h-full rounded-full transition-all duration-300", passwordStrengthResult.w1)}></div>
                                    <div className={clsx("h-full rounded-full transition-all duration-300", passwordStrengthResult.w2)}></div>
                                    <div className={clsx("h-full rounded-full transition-all duration-300", passwordStrengthResult.w3)}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Chairman Payout & Identity Phone */}
                <div className="p-4 rounded-2xl bg-[#161d24]/80 border border-white/5 space-y-3 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black flex items-center justify-center shrink-0">2</span>
                        <h3 className="text-xs font-black uppercase tracking-wider text-white">Verified Remittance Phone</h3>
                    </div>

                    <div>
                        <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">
                            M-Pesa Phone Number <Tooltip text={<span><strong>CRITICAL:</strong> Used as your Chairman login ID and treasury signatory.</span>} />
                        </label>
                        <div className="relative">
                            <Phone className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/5 bg-[#0b1014] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FBBF24]/50 text-sm font-medium"
                                placeholder="e.g. 0712345678 or 254..."
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 leading-tight">
                            🔒 <em>This phone number is locked on file as the primary treasury signatory to prevent fraud.</em>
                        </p>
                    </div>

                    {isExistingChairman && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 mt-2">
                            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1 text-left">
                                <p className="text-[11px] font-bold text-emerald-400">Signed In: {auth.currentUser?.email}</p>
                                <p className="text-[10px] text-gray-300">This new league will be attached to your Chairman portfolio.</p>
                            </div>
                        </div>
                    )}
                </div>

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
            <div className="text-center mb-4 relative z-10">
                <h2 className="text-2xl md:text-3xl font-bold mb-1 tracking-tight text-white">Build Your League's Economy</h2>
                <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm">Configure your chama rules, contributions, and prize distributions.</p>
            </div>
            <div className="w-full max-w-5xl mx-auto space-y-4">
                {/* Section 1: Core Configuration (Clean Top Card with 2-Column Responsive Inputs) */}
                <div className="bg-[#151c18] border border-white/5 p-4 sm:p-5 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3 text-white font-black text-base md:text-lg relative z-10">
                        <span className="size-6 rounded-full bg-[#22c55e] text-black text-xs font-black flex items-center justify-center shrink-0">1</span>
                        <span>Core League Configuration</span>
                    </div>
                    <div className="space-y-4 relative z-10">
                        {/* FPL League Link / ID First for instant prefill */}
                        <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-2xl p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10px] md:text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>Paste FPL League Link or ID (Recommended)</span>
                                </label>
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">1-Click Auto-Fill</span>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={fplLeagueId}
                                    onChange={e => {
                                        let val = e.target.value.trim();
                                        const match = val.match(/leagues\/(\d+)/) || val.match(/(\d{4,9})/);
                                        if (match && match[1]) {
                                            val = match[1];
                                        }
                                        setFplLeagueId(val);
                                        if (val.replace(/[^0-9]/g, '').length >= 4) {
                                            fetchFplLeagueData(val);
                                        }
                                    }}
                                    onPaste={e => {
                                        const pasted = e.clipboardData.getData('text');
                                        if (pasted) {
                                            setTimeout(() => fetchFplLeagueData(pasted), 50);
                                        }
                                    }}
                                    className={clsx(inputClasses, "flex-1")}
                                    placeholder="e.g. https://fantasy.premierleague.com/leagues/2205131/standings/c or 2205131"
                                />
                                <button
                                    type="button"
                                    onClick={() => fetchFplLeagueData(fplLeagueId)}
                                    disabled={fplFetchStatus === 'loading' || !fplLeagueId.trim()}
                                    className="px-4 py-2.5 bg-[#22c55e] hover:bg-[#1fbb59] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer"
                                    title="Connect to FPL and sync all manager squads"
                                >
                                    <RefreshCw className={clsx("w-3.5 h-3.5", fplFetchStatus === 'loading' && "animate-spin")} />
                                    <span>{fplFetchStatus === 'loading' ? 'Syncing...' : 'Sync Teams'}</span>
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">
                                Linking your FPL league automatically pulls your <strong>League Name</strong> and <strong>All Manager Squads</strong> so setup is instant and verified.
                            </p>
                            {fplFetchStatus === 'loading' && (
                                <p className="text-[11px] text-[#FBBF24] flex items-center gap-2 font-bold bg-[#FBBF24]/10 border border-[#FBBF24]/20 p-2.5 rounded-xl">
                                    <span className="w-2.5 h-2.5 bg-[#FBBF24] rounded-full animate-ping shrink-0" />
                                    <span>Connecting to Official Premier League servers & recovering teams...</span>
                                </p>
                            )}
                            {fplFetchStatus === 'success' && (
                                <p className="text-[11px] text-[#22c55e] flex items-center gap-2 font-bold bg-[#22c55e]/10 border border-[#22c55e]/20 p-2.5 rounded-xl">
                                    <Check className="w-4 h-4 shrink-0" />
                                    <span>League "{leagueName}" & {fplStandings.length} squads detected and imported!</span>
                                </p>
                            )}
                            {fplFetchStatus === 'error' && (
                                <div className="text-[11px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex items-center justify-between">
                                    <span>Could not fetch from FPL. Check ID ({fplLeagueId}) or paste full league URL.</span>
                                    <button
                                        type="button"
                                        onClick={() => fetchFplLeagueData(fplLeagueId)}
                                        className="text-white underline hover:text-red-300 ml-2 cursor-pointer"
                                    >
                                        Retry
                                    </button>
                                </div>
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
                                            type="text"
                                            inputMode="numeric"
                                            value={monthlyFee === 0 ? '' : monthlyFee}
                                            placeholder="50"
                                            onFocus={e => e.target.select()}
                                            onChange={e => {
                                                const cleaned = e.target.value.replace(/[^0-9]/g, '');
                                                setMonthlyFee(cleaned === '' ? 0 : parseInt(cleaned, 10));
                                            }}
                                            className="w-full bg-transparent px-3.5 py-3 text-white font-medium text-sm focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#161d24] [-webkit-text-fill-color:white]"
                                        />
                                    </div>
                                    <p className="text-[9px] text-gray-500">Auto-deducted per member per Gameweek (e.g. KES 50)</p>
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
                                        type="text"
                                        inputMode="numeric"
                                        value={estimatedMembers === 0 ? '' : estimatedMembers}
                                        placeholder="10"
                                        onFocus={e => e.target.select()}
                                        onChange={e => {
                                            const cleaned = e.target.value.replace(/[^0-9]/g, '');
                                            setEstimatedMembers(cleaned === '' ? 0 : parseInt(cleaned, 10));
                                        }}
                                        onBlur={() => {
                                            setEstimatedMembers(prev => Math.min(20, Math.max(2, prev || 2)));
                                        }}
                                        className={inputClasses}
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                    {/* Left Card: Distribution Split Logic */}
                    <div className="bg-[#151c18] border border-white/5 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between h-full">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 text-white font-black text-base md:text-lg">
                                    <span className="size-6 rounded-full bg-[#22c55e] text-black text-xs font-black flex items-center justify-center shrink-0">2</span>
                                    <span>Prize Distribution Split</span>
                                </div>
                                <span className="px-2 py-1 bg-[#22c55e]/10 text-[#22c55e] text-[9px] uppercase font-bold tracking-widest rounded border border-[#22c55e]/20">Dynamic Payout</span>
                            </div>

                            {/* Redesigned Percentage Split Display (Unboxed Standout Hero) */}
                            <div className="mb-5 space-y-4">
                                <div className="py-5 px-4 sm:px-6 rounded-2xl bg-gradient-to-r from-[#22c55e]/10 via-black/40 to-[#FBBF24]/10 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-inner">
                                    {/* Left: Weekly Prize Showcase */}
                                    <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse" />
                                            <span className="text-xs font-black uppercase tracking-widest text-[#22c55e]">Weekly Prize</span>
                                        </div>
                                        <div className="flex items-baseline gap-1 my-1">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={weeklyPrizePercent === 0 ? '' : weeklyPrizePercent}
                                                placeholder="0"
                                                onFocus={e => e.target.select()}
                                                onChange={e => {
                                                    const cleaned = e.target.value.replace(/[^0-9]/g, '');
                                                    setWeeklyPrizePercent(cleaned === '' ? 0 : Math.min(100, parseInt(cleaned, 10)));
                                                }}
                                                className="text-4xl sm:text-5xl md:text-6xl font-black font-mono text-[#22c55e] tabular-nums tracking-tight bg-transparent text-center sm:text-left w-24 sm:w-28 outline-none border-b-2 border-[#22c55e]/40 focus:border-[#22c55e] transition-colors py-0.5"
                                            />
                                            <span className="text-2xl sm:text-3xl font-black font-mono text-[#22c55e]">%</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-[11px] font-bold text-gray-400">Top GW Score</span>
                                            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setWeeklyPrizePercent(Math.max(0, weeklyPrizePercent - 5))}
                                                    className="w-6 h-6 rounded bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white text-xs font-black flex items-center justify-center transition-colors cursor-pointer"
                                                    title="Decrease 5%"
                                                >
                                                    -5
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setWeeklyPrizePercent(Math.min(100, weeklyPrizePercent + 5))}
                                                    className="w-6 h-6 rounded bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white text-xs font-black flex items-center justify-center transition-colors cursor-pointer"
                                                    title="Increase 5%"
                                                >
                                                    +5
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Grand Vault Showcase */}
                                    <div className="flex-1 flex flex-col items-center sm:items-end text-center sm:text-right">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-xs font-black uppercase tracking-widest text-[#FBBF24]">Grand Vault</span>
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24] animate-pulse" />
                                        </div>
                                        <div className="flex items-baseline gap-1 my-1">
                                            <span className="text-4xl sm:text-5xl md:text-6xl font-black font-mono text-[#FBBF24] tabular-nums tracking-tight py-0.5">
                                                {100 - weeklyPrizePercent}
                                            </span>
                                            <span className="text-2xl sm:text-3xl font-black font-mono text-[#FBBF24]">%</span>
                                        </div>
                                        <div className="mt-1.5">
                                            <span className="text-[11px] font-bold text-gray-400">Season Podium</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Interactive Range Slider with centered "Move slider to set" guidance */}
                                <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2.5">
                                    <div className="flex items-center justify-center text-[11px] font-bold py-0.5">
                                        <span className="text-[#10B981] flex items-center justify-center gap-1.5 uppercase tracking-wider text-center">
                                            <Sliders className="w-3.5 h-3.5" /> Move slider to set split
                                        </span>
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
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/^0+(?=\d)/, '');
                                                            setCustomWinnerCount(Math.max(1, Math.min(maxAllowedWinners, Number(val) || 1)));
                                                        }}
                                                        className="mt-1 w-full bg-[#161d24] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-[#22c55e] outline-none"
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
                                                            onFocus={(e) => e.target.select()}
                                                            onChange={(e) => {
                                                                const next = [...customWinnerRatios];
                                                                next[idx] = e.target.value.replace(/^0+(?=\d)/, '');
                                                                setCustomWinnerRatios(next);
                                                            }}
                                                            className="flex-1 bg-[#161d24] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:border-[#FBBF24] outline-none"
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
                    <div className="bg-[#151c18] border border-white/5 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between h-full">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="size-6 rounded-full bg-[#22c55e] text-black text-xs font-black flex items-center justify-center shrink-0">3</span>
                                    <div>
                                        <h3 className="font-extrabold text-white text-base md:text-lg">Pot Totals (Live Preview)</h3>
                                        <p className="text-[11px] text-[#22c55e] font-bold mt-0.5">Projected for {estimatedMembers} members · KES {monthlyFee}/GW</p>
                                    </div>
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

                        {/* Step 2 Action Bar with Back & Next */}
                        <div className="pt-4 mt-4 border-t border-white/5 shrink-0 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={prevStep}
                                className="px-5 py-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>
                            <button
                                type="button"
                                onClick={nextStep}
                                className="flex-1 bg-[#FBBF24] hover:bg-[#eab308] text-[#0a100a] font-black text-base py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] shadow-[0_0_20px_rgba(251,191,36,0.15)] cursor-pointer"
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

            {/* 1. Chairman Squad Identification & Treasury Signatory */}
            <div className="max-w-4xl mx-auto bg-[#151c18] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black flex items-center justify-center shrink-0">1</span>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Chairman Squad Claim & Account</h3>
                    </div>
                    {chairmanFplSquad ? (
                        <span className="text-[10px] text-[#10B981] font-semibold bg-[#10B981]/15 border border-[#10B981]/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <Check className="w-3 h-3 text-[#10B981]" /> Squad Linked
                        </span>
                    ) : (
                        <span className="text-[10px] text-[#FBBF24] font-semibold bg-[#FBBF24]/15 border border-[#FBBF24]/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            ⚠️ Select Your Squad
                        </span>
                    )}
                </div>

                {/* Highly Visible Prompt Callout */}
                <div className={clsx(
                    "p-3.5 sm:p-4 rounded-xl border transition-all space-y-3",
                    chairmanFplSquad
                        ? "bg-[#10B981]/10 border-[#10B981]/30"
                        : "bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                )}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <UserAvatar name={effectiveManagerName} size="sm" />
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm text-white leading-tight">{effectiveManagerName}</p>
                                    <span className="text-[9px] font-semibold text-[#FBBF24] uppercase tracking-wider px-2 py-0.5 bg-[#FBBF24]/20 border border-[#FBBF24]/30 rounded">
                                        👑 League Admin
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                    {chairmanPayoutPhone || phone || "Phone on file"} · Payout Remittance Phone Locked
                                </p>
                            </div>
                        </div>

                        {/* Prominent Selector Dropdown */}
                        <div className="w-full md:w-80 shrink-0 space-y-1">
                            <label className="block text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                                {chairmanFplSquad ? `Linked Squad (${effectiveManagerName})` : "👉 Which of these squads is yours?"}
                            </label>
                            <div className="relative">
                                <select
                                    value={chairmanFplSquad?.entry || ''}
                                    onChange={(e) => handleSelectChairmanSquad(e.target.value ? Number(e.target.value) : null)}
                                    className={clsx(
                                        "w-full appearance-none rounded-xl py-2.5 pl-3.5 pr-10 text-xs focus:outline-none cursor-pointer font-semibold border transition-all shadow-sm",
                                        chairmanFplSquad
                                            ? "bg-white dark:bg-[#111820] border-emerald-500/50 dark:border-[#10B981]/50 text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                            : "bg-white dark:bg-[#111820] border-amber-500 dark:border-[#FBBF24] text-gray-900 dark:text-white focus:border-amber-500 ring-2 ring-amber-500/20"
                                    )}
                                >
                                    <option value="" className="bg-white dark:bg-[#0f1720] text-gray-700 dark:text-gray-300 py-1.5 font-medium">🛡️ Pure Admin (Non-Playing, no squad)</option>
                                    {fplStandings.map((s) => (
                                        <option key={s.entry} value={s.entry} className="bg-white dark:bg-[#0f1720] text-gray-900 dark:text-white py-1.5 font-medium">
                                            ⚽ {s.entry_name} — {s.player_name} (#{s.entry})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-amber-500 dark:text-[#FBBF24] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>
                    </div>

                    {chairmanFplSquad ? (
                        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                            <p className="text-[#10B981] font-semibold flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5 shrink-0" />
                                <span>Linked to <strong>{chairmanFplSquad.entryName}</strong> (#{chairmanFplSquad.entry}) — GW scores link to your profile</span>
                            </p>
                            <button
                                type="button"
                                onClick={() => handleSelectChairmanSquad(null)}
                                className="text-[11px] text-gray-400 hover:text-amber-300 underline cursor-pointer"
                            >
                                Switch to Non-Playing
                            </button>
                        </div>
                    ) : (
                        <p className="text-[11px] text-gray-300 leading-tight">
                            💡 <strong>Team Selection:</strong> If you manage one of the imported squads, select it above so your gameweek points and payouts are tracked automatically. If you only administer the league without a team, leave it as <em>Pure Admin</em>.
                        </p>
                    )}
                </div>
            </div>

            {/* 2. Member Enrollment Strategy */}
            <div className="max-w-4xl mx-auto space-y-2">
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black flex items-center justify-center shrink-0">2</span>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Enrollment Strategy</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Mode 1: Self-Onboarding */}
                    <div
                        onClick={() => setEnrollmentMode('self')}
                        className={clsx(
                            "p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 relative overflow-hidden",
                            enrollmentMode === 'self'
                                ? "bg-[#10B981]/15 border-[#10B981] shadow-[0_0_25px_rgba(16,185,129,0.15)]"
                                : "bg-[#161d24] border-white/10 hover:border-white/20 opacity-80"
                        )}
                    >
                        <div className={clsx(
                            "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                            enrollmentMode === 'self' ? "border-[#10B981] bg-[#10B981]" : "border-gray-500"
                        )}>
                            {enrollmentMode === 'self' && <div className="w-2 h-2 rounded-full bg-black" />}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-white text-xs sm:text-sm">Self-Onboarding (Recommended)</span>
                                <span className="text-[9px] bg-[#10B981]/20 text-[#10B981] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Fastest</span>
                            </div>
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                Share a 1-click WhatsApp link. Members enter their own M-Pesa phone number when claiming their squad.
                            </p>
                        </div>
                    </div>

                    {/* Mode 2: Direct Phone Entry */}
                    <div
                        onClick={() => setEnrollmentMode('manual')}
                        className={clsx(
                            "p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 relative overflow-hidden",
                            enrollmentMode === 'manual'
                                ? "bg-[#10B981]/15 border-[#10B981] shadow-[0_0_25px_rgba(16,185,129,0.15)]"
                                : "bg-[#161d24] border-white/10 hover:border-white/20 opacity-80"
                        )}
                    >
                        <div className={clsx(
                            "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                            enrollmentMode === 'manual' ? "border-[#10B981] bg-[#10B981]" : "border-gray-500"
                        )}>
                            {enrollmentMode === 'manual' && <div className="w-2 h-2 rounded-full bg-black" />}
                        </div>
                        <div className="space-y-1">
                            <span className="font-semibold text-white text-xs sm:text-sm">Direct Phone Entry</span>
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                Manually type each member's M-Pesa number right now so they are immediately enrolled.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Recovered Teams & Member Management Panel */}
            <div className="max-w-4xl mx-auto bg-[#151c18] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-black flex items-center justify-center shrink-0">3</span>
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                                {members.length > 0 ? "Recovered Squads Roster" : "League Members"}
                            </h3>
                            <span className="bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 text-xs font-medium px-2 py-0.5 rounded">
                                {fplStandings.length > 0 ? fplStandings.length : (members.length + (chairmanFplSquad ? 1 : 0))} Registered Squads
                            </span>
                            <span className={clsx(
                                "text-xs font-medium px-2.5 py-0.5 rounded-lg border flex items-center gap-1",
                                coAdminIndices.length === 2
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : "bg-white/5 text-gray-300 border-white/10"
                            )}>
                                <Shield className="w-3.5 h-3.5 text-amber-400" />
                                Co-Chairs: {coAdminIndices.length}/2 Assigned
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                            {enrollmentMode === 'self'
                                ? "Members claim their squad via invite link. You can assign up to 2 Co-Chairs as dual signatories for payout approvals."
                                : "Enter M-Pesa phone numbers below. You can assign up to 2 Co-Chairs as dual signatories for payout approvals."}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {fplStandings.length > 0 && (
                            <button
                                type="button"
                                onClick={handleImportFromFPL}
                                className="px-3 py-1.5 rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <RefreshCw className="w-3 h-3" /> Reset Squads ({fplStandings.length})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowAddManualMember(!showAddManualMember)}
                            className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Optional: Only needed if adding a member whose squad is not in the FPL mini-league yet."
                        >
                            <UserPlus className="w-3.5 h-3.5 text-[#22c55e]" />
                            {showAddManualMember ? "Close Form" : "+ Add Member Manually"}
                        </button>
                    </div>
                </div>

                {/* Collapsible Manual Member Addition Form with FPL Team ID Guide */}
                {showAddManualMember && (
                    <form onSubmit={addLocalMember} className="p-4 rounded-xl bg-[#161d24] border border-white/10 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                <UserPlus className="w-3.5 h-3.5 text-[#22c55e]" /> Add Offline / Custom Member
                            </p>
                            <span className="text-[9px] text-gray-400">Optional: For managers not found in FPL standings</span>
                        </div>
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

                        {/* Helper on how to get FPL Team ID */}
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-[11px] text-gray-300 flex items-start gap-2">
                            <Info className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <p className="font-bold text-white text-[11px]">How managers get their FPL Team ID:</p>
                                <p className="text-gray-400 text-[10px]">
                                    Open team on fantasy.premierleague.com → look at the browser URL: <code className="text-emerald-400 font-mono">fantasy.premierleague.com/entry/<strong>1234567</strong>/event/...</code>. The number is their Team ID!
                                </p>
                            </div>
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
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">

                    {/* Recovered FPL Teams & Members */}
                    {members.map((m, i) => {
                        const isCoAdmin = coAdminIndices.includes(i);
                        const isCoAdminLimitReached = coAdminIndices.length >= 2 && !isCoAdmin;

                        return (
                            <div
                                key={i}
                                className={clsx(
                                    "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all",
                                    isCoAdmin
                                        ? "border-amber-500/40 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                                        : "border-white/10 bg-[#161d24]/70 hover:border-white/20"
                                )}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <UserAvatar name={m.displayName || m.fplTeamName} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-sm text-white truncate">
                                                {m.fplTeamName || m.displayName}
                                            </p>
                                            {m.fplEntryId && (
                                                <span className="text-[9px] font-mono font-bold text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.5 rounded border border-[#10B981]/25 shrink-0">
                                                    #{m.fplEntryId}
                                                </span>
                                            )}
                                            {m.secondFplTeamId && (
                                                <span className="text-[9px] font-bold text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/10 px-1.5 py-0.5 rounded tracking-widest uppercase shrink-0">
                                                    Dual
                                                </span>
                                            )}
                                            {isCoAdmin && (
                                                <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded tracking-wider uppercase shrink-0 flex items-center gap-1 shadow-sm">
                                                    <Shield className="w-2.5 h-2.5 text-amber-400" /> Co-Chair
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                                            Manager: <span className="text-gray-200">{m.displayName}</span>
                                            {m.phone && (
                                                <span className="text-[#10B981] ml-2 font-mono font-medium">· {m.phone}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Direct Inline Controls */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {enrollmentMode === 'manual' && (
                                        <div className="relative">
                                            <input
                                                type="tel"
                                                placeholder="07... (M-Pesa #)"
                                                value={m.phone}
                                                onChange={e => {
                                                    const val = normalizeKenyanPhone(e.target.value);
                                                    setMembers(prev => prev.map((mem, idx) => idx === i ? { ...mem, phone: val } : mem));
                                                }}
                                                className="w-40 sm:w-48 bg-[#0e141a] border border-white/10 focus:border-[#10B981]/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none transition-colors"
                                            />
                                        </div>
                                    )}

                                    {/* Co-Chair toggle button with Max 2 check */}
                                    <button
                                        type="button"
                                        title={
                                            isCoAdmin
                                                ? "Remove Co-Chair signatory status"
                                                : isCoAdminLimitReached
                                                    ? "Maximum 2 Co-Chairs already selected"
                                                    : "Assign as Co-Chair (Dual Signatory for Payout Approvals)"
                                        }
                                        onClick={() => toggleCoChair(i)}
                                        disabled={isCoAdminLimitReached}
                                        className={clsx(
                                            "h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all shrink-0 border",
                                            isCoAdmin
                                                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)] cursor-pointer"
                                                : isCoAdminLimitReached
                                                    ? "bg-white/5 text-gray-500 border-white/5 opacity-40 cursor-not-allowed"
                                                    : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-amber-300 border-white/10 cursor-pointer"
                                        )}
                                    >
                                        <Shield className={clsx("w-3.5 h-3.5", isCoAdmin ? "text-amber-400" : isCoAdminLimitReached ? "text-gray-600" : "text-gray-400")} />
                                        <span>{isCoAdmin ? "Co-Chair ✓" : isCoAdminLimitReached ? "Max (2/2)" : "+ Co-Chair"}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            removeLocalMember(i);
                                            setCoAdminIndices(prev =>
                                                prev
                                                    .filter(idx => idx !== i)
                                                    .map(idx => idx > i ? idx - 1 : idx)
                                            );
                                        }}
                                        className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all text-xs shrink-0 cursor-pointer"
                                        title="Remove Manager"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {members.length === 0 && (
                        <div className="text-center py-8 px-4 border border-dashed border-white/15 bg-white/[0.02] rounded-2xl space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-base font-bold text-white">
                                    {fplLeagueId ? `Sync Squads from FPL League #${fplLeagueId}` : "No Members Added Yet"}
                                </p>
                                <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                                    {fplLeagueId
                                        ? "Click below to immediately connect to Premier League servers and pull all manager squads into this circle."
                                        : "Paste your FPL league link in Step 2, or add members manually using the button above."}
                                </p>
                            </div>
                            {fplLeagueId && (
                                <button
                                    type="button"
                                    onClick={() => fetchFplLeagueData(fplLeagueId)}
                                    disabled={fplFetchStatus === 'loading'}
                                    className="px-6 py-3 rounded-xl bg-[#22c55e] hover:bg-[#1fbb59] text-black font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-lg hover:scale-105 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {fplFetchStatus === 'loading' ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                            Fetching Official FPL Teams...
                                        </>
                                    ) : (
                                        <>
                                            <Shield className="w-4 h-4" /> Pull All Squads from FPL #{fplLeagueId}
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Step 3 Footer Action Bar */}
                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={prevStep}
                        className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Rules
                    </button>

                    <p className="text-xs text-gray-400 text-center sm:text-left flex-1 px-2">
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
            <div className="text-center mb-6">
                <p className="text-[10px] text-[#FBBF24] font-bold uppercase tracking-widest mb-2">Final Verification · Step 4 of 4</p>
                <h2 className="text-2xl md:text-3xl font-extrabold mb-2 tracking-tight">Confirm League Details</h2>
                <p className="text-gray-400 text-xs md:text-sm max-w-xl mx-auto">
                    Review your Gameweek stake, pot prize economics, and squads before activating your circle and generating your invite link.
                </p>
            </div>

            <div className="bg-[#151c18] border border-white/5 rounded-3xl p-6 md:p-8 w-full max-w-4xl mx-auto shadow-2xl relative overflow-hidden space-y-6">
                <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 to-transparent rounded-[2rem] pointer-events-none"></div>

                {/* Final Review Notice */}
                <div className="bg-[#22c55e]/10 border border-[#22c55e]/25 p-4 rounded-2xl flex items-start gap-3 relative z-10 shadow-sm">
                    <Shield className="w-5 h-5 text-[#22c55e] shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                        <strong className="block mb-0.5 text-sm tracking-tight text-white">Immutable Economy Rules</strong>
                        <p className="text-[#22c55e]">
                            Once initialized, your Gameweek stake and payout split are locked in smart ledger for fair competition. Managers can self-onboard and claim their squads anytime via your Master Invite Link.
                        </p>
                    </div>
                </div>

                {/* 1. Verified League Identity & Core Metrics */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black flex items-center justify-center shrink-0">1</span>
                        <h3 className="text-sm font-black uppercase tracking-wider text-white">League Identity & Core Rules</h3>
                    </div>

                    {/* Prominent Full-Width League Name Banner */}
                    <div className="bg-[#161d24] rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#22c55e]">Verified League Title</span>
                                <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">FPL #{fplLeagueId || "Manual"}</span>
                            </div>
                            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight break-words">{leagueName || "Premier League"}</h3>
                            <p className="text-xs text-gray-400 mt-1">
                                Circle initialized by <strong className="text-white">{effectiveManagerName}</strong> · Remittance Line: <span className="font-mono text-[#22c55e] font-bold">{chairmanPayoutPhone || phone}</span>
                            </p>
                        </div>
                        <div className="shrink-0">
                            <span className="px-3.5 py-1.5 rounded-xl bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5" /> Immutable Rules
                            </span>
                        </div>
                    </div>

                    {/* 4-Metric Responsive Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-[#161d24] rounded-2xl p-3.5 border border-white/5 flex flex-col justify-between">
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Gameweek Stake</p>
                            <p className="text-[#22c55e] font-black text-base sm:text-lg tabular-nums">KES {monthlyFee} <span className="text-[10px] font-normal text-gray-400">/GW</span></p>
                        </div>
                        <div className="bg-[#161d24] rounded-2xl p-3.5 border border-white/5 flex flex-col justify-between">
                            <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Registered Squads</p>
                            <p className="text-white font-semibold text-base sm:text-lg">
                                {totalSquadsCount} <span className="text-[10px] font-normal text-gray-400">({chairmanFplSquad ? `${otherMembersCount} members + ${effectiveManagerName}` : `${totalSquadsCount} squads`})</span>
                            </p>
                        </div>
                        <div className="bg-[#161d24] rounded-2xl p-3.5 border border-white/5 flex flex-col justify-between">
                            <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Weekly Prize Pot</p>
                            <p className="text-emerald-400 font-semibold text-base sm:text-lg tabular-nums">KES {weeklyPrize} <span className="text-[10px] font-normal text-gray-400">/GW</span></p>
                        </div>
                        <div className="bg-[#161d24] rounded-2xl p-3.5 border border-white/5 flex flex-col justify-between">
                            <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Est. GW Gross Pot</p>
                            <p className="text-amber-400 font-semibold text-base sm:text-lg tabular-nums">KES {totalMonthlyPool} <span className="text-[10px] font-normal text-gray-400">/GW</span></p>
                        </div>
                    </div>
                </div>

                {/* Two-Column Split: 2. Distribution Summary (Left) and 3. Squads & Onboarding Snapshot (Right) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left: 2. Distribution Summary */}
                    <div className="bg-[#111820]/80 border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col justify-between space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
                                <div className="flex items-center gap-2 text-white font-bold text-sm">
                                    <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black flex items-center justify-center shrink-0">2</span>
                                    <Trophy className="w-4 h-4 text-[#FBBF24]" /> Prize Distribution Breakdown
                                </div>
                                <span className="text-xs font-mono text-[#FBBF24] bg-[#FBBF24]/10 px-2.5 py-1 rounded-md border border-[#FBBF24]/20 font-bold">
                                    {weeklyPrizePercent}% / {100 - weeklyPrizePercent}% Split
                                </span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-[#161d24] p-3.5 rounded-xl border border-white/5 text-xs">
                                    <div>
                                        <p className="text-gray-200 font-semibold text-xs">Weekly Gameweek Prize</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{weeklyPrizePercent}% of weekly pot awarded to top GW scorer</p>
                                    </div>
                                    <span className="font-bold text-emerald-400 text-base tabular-nums">KES {weeklyPrize} <span className="text-[10px] text-gray-400 font-normal">/GW</span></span>
                                </div>
                                <div className="flex justify-between items-center bg-[#161d24] p-3.5 rounded-xl border border-white/5 text-xs">
                                    <div>
                                        <p className="text-gray-200 font-semibold text-xs">Grand Season Vault</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{100 - weeklyPrizePercent}% accumulated into season finale pot</p>
                                    </div>
                                    <span className="font-bold text-[#FBBF24] text-base tabular-nums">KES {grandVault * 38} <span className="text-[10px] text-gray-400 font-normal">/38GWs</span></span>
                                </div>
                            </div>
                        </div>

                        {/* Podium Split Pills */}
                        <div className="pt-3 border-t border-white/5 space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Season End Podium Allocations</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                {effectiveSeasonDistribution.slice(0, 3).map((pct, idx) => (
                                    <div key={idx} className="bg-black/40 border border-white/5 rounded-xl py-2 px-1">
                                        <p className="text-[9px] text-amber-400/90 font-bold uppercase tracking-wider">#{idx + 1} {idx === 0 ? 'Champion' : `Tier ${idx + 1}`}</p>
                                        <p className="text-sm font-black text-white mt-0.5">{pct}%</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: 3. Squads & Onboarding Snapshot */}
                    <div className="bg-[#111820]/80 border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col justify-between space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                            <div className="flex items-center gap-2 text-white font-bold text-sm">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-black flex items-center justify-center shrink-0">3</span>
                                <Users className="w-4 h-4 text-[#22c55e]" /> Squads & Claim Status
                            </div>
                            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-bold">
                                {totalSquadsCount} Registered {totalSquadsCount === 1 ? 'Squad' : 'Squads'}
                            </span>
                        </div>

                        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {/* Chairman row with verified squad & phone */}
                            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-xl text-xs shadow-sm gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                        <Shield className="w-4 h-4 text-[#FBBF24]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-white text-sm leading-tight tracking-tight">{effectiveManagerName}</p>
                                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                                                👑 League Admin
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-300 mt-0.5 truncate">
                                            {chairmanFplSquad ? (
                                                <span>Squad: <strong className="text-white font-semibold">{chairmanFplSquad.entryName}</strong> <span className="text-gray-400 font-mono ml-1">(#{chairmanFplSquad.entry})</span></span>
                                            ) : (
                                                <span className="text-gray-400 italic">Pure Admin (Non-Playing)</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-emerald-400 font-mono text-xs font-bold block">{chairmanPayoutPhone || phone}</span>
                                    <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold block mt-0.5">Payout Line</span>
                                </div>
                            </div>

                            {/* Squads preview — filter out chairman's squad to avoid duplicate row */}
                            {members
                                .filter(m => !chairmanFplSquad || Number(m.fplEntryId) !== Number(chairmanFplSquad.entry))
                                .map((m, i) => {
                                    const isCoAdmin = coAdminIndices.includes(i);
                                    return (
                                        <div 
                                            key={i} 
                                            className={clsx(
                                                "flex items-center justify-between p-3 rounded-xl border text-xs gap-3 transition-all",
                                                isCoAdmin ? "bg-amber-500/10 border-amber-500/30" : "bg-[#161d24]/90 hover:bg-[#161d24] border-white/5"
                                            )}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-bold text-white text-sm tracking-tight">{m.fplTeamName || m.displayName}</p>
                                                    {isCoAdmin && (
                                                        <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded tracking-wider uppercase shrink-0 flex items-center gap-1">
                                                            <Shield className="w-2.5 h-2.5 text-amber-400" /> Co-Chair
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                    <span>Manager: <strong className="text-gray-200 font-medium">{m.displayName || "FPL Manager"}</strong></span>
                                                    {m.fplEntryId ? (
                                                        <>
                                                            <span className="text-gray-600 font-bold">•</span>
                                                            <span className="font-mono text-gray-400">#{m.fplEntryId}</span>
                                                        </>
                                                    ) : null}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                {m.phone ? (
                                                    <div>
                                                        <span className="text-gray-200 font-mono text-xs font-semibold bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 block">{m.phone}</span>
                                                        <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider block mt-0.5">Linked</span>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold text-[10px] bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25 whitespace-nowrap">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                                                        Pending Invite Claim
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                            {members.length === 0 && (
                                <div className="text-center py-6 px-3 border border-dashed border-white/10 rounded-xl">
                                    <p className="text-xs font-bold text-white">No external squads pre-linked</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Managers will self-onboard and join using your Master Invite Link in Step 5.</p>
                                </div>
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
                                        className="flex-1 bg-[#22c55e] text-black font-bold py-2.5 rounded-xl text-xs hover:bg-[#1fbb59] transition-all cursor-pointer"
                                    >
                                        Enter Password in Step 1
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/login', { state: { isAdminView: true } })}
                                        className="flex-1 bg-[#FBBF24] text-black font-bold py-2.5 rounded-xl text-xs hover:bg-[#eab308] transition-all cursor-pointer"
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

                {/* Step 4 Action Bar with Refined Gold Activate Button */}
                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
                    <button
                        type="button"
                        onClick={prevStep}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/10 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Members
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmLeague}
                        disabled={isSubmitting}
                        className="flex-1 w-full bg-[#FBBF24] hover:bg-[#eab308] active:scale-[0.99] text-[#0A0E17] font-semibold text-sm sm:text-base py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(251,191,36,0.25)] hover:shadow-[0_0_25px_rgba(251,191,36,0.35)] disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                                <span>Activating League & Generating Signatures...</span>
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4 text-black" />
                                <span>Activate League & Proceed to Share Link</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep5 = () => (
        <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in-95 duration-500 h-full py-4 sm:py-6 max-w-md mx-auto w-full">
            <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center p-3 bg-[#22c55e]/20 rounded-full mb-3">
                    <Check className="w-8 h-8 text-[#22c55e]" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mb-1 tracking-tight text-white">League Created Successfully!</h2>
                <p className="text-gray-400 max-w-sm mx-auto text-xs sm:text-sm">
                    Your league economy is live. Share your Master Invite Code or link so managers claim their squads.
                </p>
            </div>

            {/* 1. Master Invite Code */}
            <div className="bg-[#151c18] border border-[#FBBF24]/30 p-5 sm:p-6 rounded-2xl w-full text-center shadow-[0_0_50px_rgba(251,191,36,0.05)] relative overflow-hidden space-y-1">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black flex items-center justify-center">1</span>
                    <p className="text-[#FBBF24] text-[10px] sm:text-xs font-black uppercase tracking-widest">Master Invite Code</p>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-white drop-shadow-md">
                    {generatedCode.slice(0, 3)} <span className="text-[#FBBF24]">{generatedCode.slice(3, 6)}</span>
                </h1>
            </div>

            {/* 2. Instant Sharing Actions */}
            <div className="w-full space-y-2.5">
                <div className="flex items-center gap-1.5 px-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black flex items-center justify-center">2</span>
                    <p className="text-xs font-black uppercase tracking-wider text-white">Dispatch to WhatsApp Group</p>
                </div>

                <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full bg-[#22c55e] hover:bg-[#1fbb59] text-[#0A0E17] font-black text-base py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)] cursor-pointer"
                >
                    <Share2 className="w-5 h-5" />
                    {copied ? "Opening WhatsApp..." : "Share on WhatsApp"}
                </button>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={handleCopyInviteLink}
                        className="bg-[#161d24] border border-white/10 hover:border-white/20 text-white font-bold py-2.5 px-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <Copy className="w-3.5 h-3.5 text-[#10B981]" />
                        {copiedLink ? "Link Copied!" : "Copy Invite Link"}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyOnlyCode}
                        className="bg-[#161d24] border border-white/10 hover:border-white/20 text-white font-bold py-2.5 px-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <Smartphone className="w-3.5 h-3.5 text-[#FBBF24]" />
                        {copiedCode ? "Code Copied!" : "Copy Code Only"}
                    </button>
                </div>
            </div>

            {/* 3. Enter Command Center */}
            <div className="w-full space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 px-1">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-black flex items-center justify-center">3</span>
                    <p className="text-xs font-black uppercase tracking-wider text-white">League Administration</p>
                </div>

                <button
                    type="button"
                    onClick={() => navigate('/dashboard', { replace: true })}
                    className="w-full bg-[#161d24] border border-white/10 hover:border-white/20 text-white font-bold py-3.5 rounded-xl transition-all shadow-md cursor-pointer hover:bg-white/5"
                >
                    Enter Chairman Command Center →
                </button>

                <p className="text-[10px] text-[#22c55e] border border-[#22c55e]/20 bg-[#22c55e]/5 p-2 rounded text-center">
                    <Shield className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                    Ledger contracts secured and active on Firebase.
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
                <div 
                    onClick={() => {
                        if (step > 1 && step < STEPS) setShowExitModal(true);
                        else navigate('/dashboard');
                    }}
                    className="flex items-center gap-3 cursor-pointer select-none"
                    title="Fantasy Chama"
                >
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
                    <div className={clsx("w-full mx-auto relative group mt-6 mb-4 md:mb-6",
                        step === 2 ? "max-w-5xl" : step === 3 ? "max-w-4xl" : "max-w-3xl")}>
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

            {/* Submitting Loading Overlay Modal */}
            {isSubmitting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-[#0c1219] border border-white/15 rounded-3xl p-7 shadow-[0_25px_60px_rgba(0,0,0,0.9)] relative text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center text-[#22c55e] mx-auto shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                            <span className="w-8 h-8 border-3 border-[#22c55e]/30 border-t-[#22c55e] rounded-full animate-spin" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-tight">Initializing Chama Circle</h3>
                            <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                                Writing ledger contracts, registering your Chairman identity, and locking your prize distribution...
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2.5 px-4 rounded-xl">
                            <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
                            <span>Securing Gameweek Stake & Smart Ledger</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Confirmation Modal */}
            {showExitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-[#0c1219] border border-white/15 rounded-3xl p-6 md:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative text-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-[0_0_24px_rgba(245,158,11,0.2)]">
                            <AlertTriangle className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-black text-white tracking-tight mb-2">
                            Exit Setup Wizard?
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed mb-6">
                            Are you sure you want to exit and stop setting up? Any unsaved league rules or member configurations will be discarded.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => setShowExitModal(false)}
                                className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.05] hover:bg-white/10 text-white font-bold text-sm transition-all"
                            >
                                Keep Setting Up
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
