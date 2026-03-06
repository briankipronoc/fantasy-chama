import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, User, ArrowRight, Mail, KeyRound, Phone, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

export default function Login() {
    const location = useLocation();
    const [isAdminView, setIsAdminView] = useState(location.state?.isAdminView || false);

    // Member State
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Admin State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const navigate = useNavigate();
    const setRole = useStore((state) => state.setRole);

    const handleCodeChange = (index: number, value: string) => {
        if (!/^[A-Za-z0-9]*$/.test(value)) return; // Allow alphanumeric

        const newCode = [...code];
        newCode[index] = value.toUpperCase();
        setCode(newCode);

        // Focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullCode = code.join('');

        if (!phone || fullCode.length !== 6) return;

        setError('');
        setIsLoading(true);

        try {
            console.log("1. Member Login Initiated with code:", fullCode);
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
            const membershipsRef = collection(db, 'leagues', leagueId, 'memberships');
            const qMember = query(membershipsRef, where("phone", "==", phone));
            const memberSnapshot = await getDocs(qMember);

            if (memberSnapshot.empty) {
                setError("Your number isn't registered for this league. Contact the Chairman.");
                return;
            }

            // 3. Success! Log them in and send them to the War Room
            const memberData = memberSnapshot.docs[0].data();

            // Save leagueId to local storage or context so the app knows which dashboard to load
            localStorage.setItem('activeLeagueId', leagueId);
            localStorage.setItem('memberPhone', phone);
            setRole('member');
            navigate('/', { state: { welcomeMsg: `Welcome back, ${memberData.displayName}!` } });

        } catch (err) {
            console.error(err);
            setError("Something went wrong connecting to the vault.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please enter both email and password.');
            return;
        }

        setError('');
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
                const leagueData = leagueSnapshot.docs[0];
                localStorage.setItem('activeLeagueId', leagueData.id);
                console.log("5. Active League ID bound to session:", leagueData.id);
            } else {
                console.log("5. No active league ID found for Chairman!");
            }

            console.log("6. Opening War Room portal...");
            setRole('admin');
            navigate('/');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Invalid Chairman credentials.');
            } else {
                setError('Authentication failed. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0b1014] flex flex-col items-center justify-center relative overflow-hidden text-white font-sans w-full">

            {/* Network background graphic simulation (bottom right) */}
            <div className="absolute right-[-10%] bottom-[-10%] w-[600px] h-[600px] opacity-20 pointer-events-none">
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
                <div className="flex items-center gap-1.5 md:gap-2 text-gray-400 text-xs md:text-sm font-medium">
                    <Shield className="w-3 h-3 md:w-4 md:h-4 text-[#FBBF24]" />
                    <span>Secure Wealth Circle</span>
                </div>
            </div>

            {/* Main Card */}
            <div className="w-[90%] max-w-md bg-gradient-to-b from-[#1c272c] to-[#11171a] border border-white/5 rounded-[2rem] p-6 md:p-10 z-10 shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 to-transparent rounded-[2rem] pointer-events-none"></div>

                <div className="text-center mb-8 relative z-10">
                    <h1 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight">
                        {isAdminView ? "Chairman's Portal" : "Enter the League"}
                    </h1>
                    <p className="text-gray-400 text-xs md:text-sm">
                        {isAdminView ? "Manage the league economy & master ledger" : "Exclusive access for high-stakes wealth management"}
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
                            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Phone Number</label>
                            <div className="relative">
                                <Phone className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="tel"
                                    required
                                    pattern="^0[0-9]{9}$"
                                    value={phone}
                                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid 10-digit Kenyan phone number starting with 0 (e.g. 0712345678)')}
                                    onChange={(e) => {
                                        (e.target as HTMLInputElement).setCustomValidity('');
                                        setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10));
                                    }}
                                    placeholder="e.g. 0712345678"
                                    className="w-full bg-[#161d24] border border-white/5 rounded-xl py-3.5 md:py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/50 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider text-center">League Invite Code</label>
                            <div className="flex justify-between gap-1.5 md:gap-2">
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => inputRefs.current[index] = el}
                                        type="text"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleCodeChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        className="w-10 h-12 md:w-12 md:h-14 bg-[#161d24] border border-white/5 rounded-xl text-center text-xl md:text-2xl font-bold text-white focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/50 transition-all shadow-inner"
                                    />
                                ))}
                            </div>
                            <p className="text-center text-[#FBBF24] text-[9px] md:text-[10px] font-bold mt-4 uppercase tracking-widest">Required for Entry</p>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !phone || code.join('').length !== 6}
                            className="w-full bg-[#22C55E] hover:bg-[#1fbb59] text-[#0A0E17] font-bold text-base md:text-lg py-3.5 md:py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? "AUTHENTICATING..." : <>{'JOIN LEAGUE'} <ArrowRight className="w-5 h-5 md:w-6 md:h-6" /></>}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleAdminLogin} className="space-y-6 relative z-10 animate-in fade-in duration-300">
                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Email Address</label>
                            <div className="relative">
                                <Mail className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    required
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
                            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Secure Password</label>
                            <div className="relative">
                                <KeyRound className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-[#161d24] border border-white/5 rounded-xl py-3.5 md:py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all font-medium"
                                />
                            </div>
                            <div className="flex justify-end mt-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!email) {
                                            setError('Please enter your email first to receive a password reset link.');
                                            return;
                                        }
                                        try {
                                            await sendPasswordResetEmail(auth, email);
                                            setError('');
                                            alert(`A secure password reset link has been dispatched to ${email}. Check your inbox.`);
                                        } catch (err: any) {
                                            setError(err.message || 'Failed to dispatch reset link.');
                                        }
                                    }}
                                    className="text-[10px] md:text-xs text-[#FBBF24] font-bold hover:underline opacity-80 transition-opacity"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] md:text-xs font-medium p-3 rounded-lg flex items-start gap-2 mb-4">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
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
                            <p className="text-[11px] md:text-xs text-gray-400">
                                New Chairman? <button type="button" onClick={() => navigate('/setup')} className="text-[#10B981] font-bold hover:underline">Create Account here.</button>
                            </p>
                        </div>
                    </form>
                )}

                <div className="mt-8 flex items-center justify-center gap-4 relative z-10 opacity-60">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest">Authorized Personal Only</span>
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

        </div>
    );
}
