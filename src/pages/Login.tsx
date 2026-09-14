import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, User, ArrowRight, Mail, KeyRound, Phone, AlertCircle, Eye, EyeOff, Trophy, Swords, Sparkles, CheckCircle2, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, updateDoc, addDoc, doc, serverTimestamp } from 'firebase/firestore';
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
    const [onboardPlayMode, setOnboardPlayMode] = useState<'pot' | 'sidebets_only'>('pot');
    const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);
    const [onboardError, setOnboardError] = useState('');

    // Admin State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [infoMessage, setInfoMessage] = useState('');
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    const navigate = useNavigate();
    const setRole = useStore((state) => state.setRole);

    useEffect(() => {
        const savedAdminView = localStorage.getItem('fc-login-admin-view');
        if (savedAdminView !== null) setIsAdminView(savedAdminView === 'true');

        setPhone(localStorage.getItem('fc-login-phone') || '');
        setEmail(localStorage.getItem('fc-login-email') || '');

        const savedCode = (localStorage.getItem('fc-login-code') || '').slice(0, 6);
        setCode(Array.from({ length: 6 }, (_, index) => savedCode[index] || ''));
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

    // Auto-fill from URL params (for expiring targeted invite links)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code');
        const urlExpires = params.get('e');
        const urlPhone = params.get('phone');
        
        if (urlExpires && Date.now() > parseInt(urlExpires)) {
            setError('This invite link has expired. Request a new one from your Chairman.');
            return;
        }

        if (urlCode && urlCode.length === 6) {
            const chars = urlCode.toUpperCase().split('');
            setCode(chars);
        }
        
        if (urlPhone) {
            setPhone(normalizeKenyanPhone(urlPhone));
            setIsPhoneLocked(true);
        }
    }, []);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullCode = code.join('');

        if (!phone || fullCode.length !== 6) return;

        setError('');
        setInfoMessage('');
        setIsLoading(true);

        try {
            console.log("1. Member Login Initiated with code:", fullCode);

            // Ensure anonymous Firebase Auth session exists BEFORE querying leagues/memberships
            let currentAuthUser = auth.currentUser;
            if (!currentAuthUser) {
                const userCredential = await signInAnonymously(auth);
                currentAuthUser = userCredential.user;
            }
            const userUid = currentAuthUser.uid;

            // 1. Find the League by the 6-Digit Code
            const leaguesRef = collection(db, 'leagues');
            const qLeague = query(leaguesRef, where("inviteCode", "==", fullCode));

            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database connection timeout. Ensure you are not blocking Firebase (e.g. Brave Shields, Adblocker).")), 10000));
            const fetchPromise = getDocs(qLeague);

            console.log("2. Querying master ledger for invite code...");
            const leagueSnapshot = await Promise.race([fetchPromise, timeoutPromise]) as any;

            console.log("3. Query returned snapshot size:", leagueSnapshot.size);

            if (leagueSnapshot.empty) {
                console.warn("Invalid Invite Code verified on DB.");
                setError("Invalid Invite Code. Ask your Chairman.");
                return;
            }

            const leagueData = leagueSnapshot.docs[0];
            const leagueId = leagueData.id;

            // 2. Check if the user's phone number is on the Chairman's pre-approved list
            const phoneVariants = getPhoneVariants(phone);

            const membershipsRef = collection(db, 'leagues', leagueId, 'memberships');
            const qMember = query(membershipsRef, where("phone", "in", phoneVariants));
            const memberSnapshot = await getDocs(qMember);

            if (memberSnapshot.empty) {
                // If member's phone isn't pre-registered, launch Self-Onboarding wizard
                console.log("Phone not found. Loading league details for self-onboarding wizard...");
                const allMembersSnap = await getDocs(membershipsRef);
                const unlinked = allMembersSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .filter(m => (!m.phone && !m.phoneNumber) || m.isPending === true);

                let detectedGw = leagueData.data()?.currentGw || leagueData.data()?.startGw || 1;
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
                const invitedBy = leagueData.data()?.chairmanName || chairmanMember?.displayName || 'The Chairman';

                setOnboardData({
                    leagueId,
                    leagueName: leagueData.data()?.name || 'Fantasy Chama',
                    monthlyFee: leagueData.data()?.monthlyFee || 0,
                    phone,
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

                setShowSelfOnboardModal(true);
                return;
            }

            // 3. Update the member document with the active session UID to bypass Firestore Rules securely
            const memberDocRef = memberSnapshot.docs[0].ref;
            await updateDoc(memberDocRef, { authUid: userUid });

            const memberData = memberSnapshot.docs[0].data();

            // Save session to localStorage
            localStorage.setItem('activeLeagueId', leagueId);
            localStorage.setItem('memberPhone', phone);
            localStorage.setItem('activeUserId', memberDocRef.id);

            // Clear sensitive login inputs from localStorage after success
            localStorage.removeItem('fc-login-code');
            localStorage.removeItem('fc-login-phone');
            
            // strictly set role to member
            setRole('member');
            navigate('/dashboard', { state: { welcomeMsg: `Welcome back, ${memberData.displayName}!` }, replace: true });

        } catch (err) {
            console.error(err);
            setError("Something went wrong connecting to the vault. Check your internet connection.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompleteOnboarding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!onboardData) return;
        setOnboardError('');
        setIsOnboardingSubmitting(true);

        try {
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
                setOnboardError('Please enter your Manager / Display Name.');
                setIsOnboardingSubmitting(false);
                return;
            }

            let memberId = selectedTeamClaim;

            if (selectedTeamClaim !== 'custom') {
                const memberRef = doc(db, 'leagues', onboardData.leagueId, 'memberships', selectedTeamClaim);
                await updateDoc(memberRef, {
                    phone: onboardData.phone,
                    displayName: finalDisplayName,
                    fplTeamName: finalTeamName || finalDisplayName,
                    teamName: finalTeamName || finalDisplayName,
                    isPending: false,
                    isActive: true,
                    playMode: onboardPlayMode,
                    joinedGw: onboardData.currentGw,
                    authUid: onboardData.userUid,
                    walletBalance: 0,
                    hasPaid: false,
                    updatedAt: serverTimestamp(),
                });
            } else {
                const docRef = await addDoc(collection(db, 'leagues', onboardData.leagueId, 'memberships'), {
                    phone: onboardData.phone,
                    displayName: finalDisplayName,
                    fplTeamName: finalTeamName || finalDisplayName,
                    teamName: finalTeamName || finalDisplayName,
                    isPending: false,
                    isActive: true,
                    role: 'member',
                    playMode: onboardPlayMode,
                    joinedGw: onboardData.currentGw,
                    authUid: onboardData.userUid,
                    walletBalance: 0,
                    hasPaid: false,
                    totalEarned: 0,
                    paymentStreak: 0,
                    createdAt: serverTimestamp(),
                });
                memberId = docRef.id;
            }

            // Post join notification to league
            try {
                await addDoc(collection(db, 'leagues', onboardData.leagueId, 'notifications'), {
                    type: 'member_joined',
                    eventType: 'member_joined',
                    title: 'New Member Self-Onboarded',
                    message: `${finalDisplayName} joined ${onboardData.leagueName} (${onboardPlayMode === 'pot' ? '🏆 Cash Pot Contributor' : '🛡️ Spectator & Side-Bets Only'}).`,
                    createdAt: serverTimestamp(),
                });
            } catch (notifErr) {
                console.warn("Could not post join notification:", notifErr);
            }

            // Save session to localStorage
            localStorage.setItem('activeLeagueId', onboardData.leagueId);
            localStorage.setItem('memberPhone', onboardData.phone);
            localStorage.setItem('activeUserId', memberId);

            localStorage.removeItem('fc-login-code');
            localStorage.removeItem('fc-login-phone');

            setRole('member');
            navigate('/dashboard', {
                state: {
                    welcomeMsg: `Welcome to ${onboardData.leagueName}, ${finalDisplayName}! ${onboardPlayMode === 'sidebets_only' ? 'You are in Free Spectator & Side-Bets mode.' : 'Your spot in the chama is confirmed.'}`
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

            console.log("6. Opening War Room portal...");
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

                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Phone Number</label>
                            <div className="relative">
                                <Phone className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="tel"
                                    required
                                    autoComplete="tel"
                                    value={phone}
                                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid Kenyan phone number (e.g. 0712345678 or 254...)')}
                                    disabled={isPhoneLocked}
                                    onChange={(e) => {
                                        (e.target as HTMLInputElement).setCustomValidity('');
                                        setPhone(normalizeKenyanPhone(e.target.value));
                                    }}
                                    onBlur={() => {
                                        if (phone) setPhone(normalizeKenyanPhone(phone));
                                    }}
                                    placeholder="e.g. 0712345678 or 254..."
                                    className="w-full bg-[#161d24] border border-white/5 rounded-xl py-3.5 md:py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Your 6-Character Invite Code</label>
                            <p className="text-[10px] text-gray-500 mb-3">Your chairman sent this via WhatsApp. It looks like: <span className="text-amber-400 font-mono font-bold">ABC123</span></p>
                            <div className="flex justify-between gap-1.5 md:gap-2">
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => inputRefs.current[index] = el}
                                        type="text"
                                        inputMode="text"
                                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleCodeChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        onPaste={handlePaste}
                                        className="w-10 h-12 md:w-12 md:h-14 bg-[#161d24] border border-white/5 rounded-xl text-center text-xl md:text-2xl font-bold text-white focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/50 transition-all shadow-inner uppercase"
                                    />
                                ))}
                            </div>
                            <p className="text-center text-gray-600 text-[9px] mt-2">You can paste the code directly — all 6 boxes fill automatically</p>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !phone || code.join('').length !== 6}
                            className="w-full bg-[#22C55E] hover:bg-[#1fbb59] text-[#0A0E17] font-bold text-base md:text-lg py-3.5 md:py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <><span className="w-5 h-5 border-2 border-[#0A0E17] border-t-transparent rounded-full animate-spin" /> Opening your dashboard...</>
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
                        </div>

                        {/* Gameweek Join Pill */}
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-4 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div className="text-[11px] leading-relaxed text-gray-300">
                                <span className="font-bold text-white">Joining from Gameweek {onboardData.currentGw}:</span> Your contributions only apply from this round forward. You are never back-charged for earlier gameweeks!
                            </div>
                        </div>

                        {onboardError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium p-3 rounded-xl mb-4 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{onboardError}</span>
                            </div>
                        )}

                        <form onSubmit={handleCompleteOnboarding} className="space-y-4">
                            {/* Step 1: Claim FPL Team or Enter */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                    1. Link Your FPL Team
                                </label>

                                {onboardData.unlinkedTeams.length > 0 && (
                                    <div className="mb-2.5">
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
                                            className="w-full bg-[#161d24] border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                                        >
                                            <optgroup label="Select Your Team (Imported by Chairman)">
                                                {onboardData.unlinkedTeams.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.displayName} ({t.fplTeamName || t.teamName || 'FPL Team'})
                                                    </option>
                                                ))}
                                            </optgroup>
                                            <option value="custom">➕ Not in list / Enter manually</option>
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                            Your Name (Manager)
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={onboardManagerName}
                                            onChange={(e) => setOnboardManagerName(e.target.value)}
                                            placeholder="e.g. Antonio Kipyegon"
                                            className="w-full bg-[#161d24] border border-white/5 rounded-xl py-2.5 px-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
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
                                            placeholder="e.g. Kipyegon Stars"
                                            className="w-full bg-[#161d24] border border-white/5 rounded-xl py-2.5 px-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Choose Mode */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                    2. Choose Your Participation Tier
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Option 1: Cash Pot */}
                                    <div
                                        onClick={() => setOnboardPlayMode('pot')}
                                        className={`cursor-pointer rounded-2xl p-3.5 border transition-all relative ${
                                            onboardPlayMode === 'pot'
                                                ? 'bg-emerald-500/10 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                                : 'bg-[#161d24] border-white/5 opacity-70 hover:opacity-100 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-black flex items-center gap-1.5 text-white">
                                                <Trophy className="w-4 h-4 text-[#FBBF24]" /> Cash Pot
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/20">
                                                KES {onboardData.monthlyFee.toLocaleString()}/GW
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 leading-snug mb-2">
                                            Compete for weekly 1st place payouts and season vault jackpot.
                                        </p>
                                        <span className="text-[9px] font-bold text-emerald-400 block">
                                            ✓ Weekly & Season Vault Eligible
                                        </span>
                                    </div>

                                    {/* Option 2: Spectator & Side-Bets Only */}
                                    <div
                                        onClick={() => setOnboardPlayMode('sidebets_only')}
                                        className={`cursor-pointer rounded-2xl p-3.5 border transition-all relative ${
                                            onboardPlayMode === 'sidebets_only'
                                                ? 'bg-cyan-500/10 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                                : 'bg-[#161d24] border-white/5 opacity-70 hover:opacity-100 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-black flex items-center gap-1.5 text-white">
                                                <Swords className="w-4 h-4 text-cyan-400" /> Spectator & Bets
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                                Free Entry
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 leading-snug mb-2">
                                            Zero weekly pot dues. Challenge rivals to 1v1 M-Pesa cash side bets anytime!
                                        </p>
                                        <span className="text-[9px] font-bold text-cyan-400 block">
                                            ✓ 1v1 Side Bets · Test for Next Season
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isOnboardingSubmitting}
                                className="w-full bg-[#22C55E] hover:bg-[#1fbb59] text-[#0A0E17] font-bold text-sm md:text-base py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] shadow-[0_0_20px_rgba(34,197,94,0.2)] mt-2 disabled:opacity-50"
                            >
                                {isOnboardingSubmitting ? (
                                    <><span className="w-4 h-4 border-2 border-[#0A0E17] border-t-transparent rounded-full animate-spin" /> Activating Profile...</>
                                ) : (
                                    <>Complete Onboarding & Enter League <ArrowRight className="w-4 h-4" /></>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
