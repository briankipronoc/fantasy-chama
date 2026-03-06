import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, UserPlus, ArrowLeft, Check, Smartphone, Trophy, PersonStanding, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import clsx from 'clsx';

const STEPS = 5;

export default function AdminSetup() {
    const [step, setStep] = useState(1);
    const navigate = useNavigate();
    const setLeagueSettings = useStore((state) => state.setLeagueSettings);
    const addMemberGlobal = useStore((state) => state.addMember);
    const setRole = useStore((state) => state.setRole);

    // Step 1: Identity
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Step 2: League
    const [leagueName, setLeagueName] = useState('');
    const [monthlyFee, setMonthlyFee] = useState(200);
    const [weeklyPrizePercent, setWeeklyPrizePercent] = useState(70);
    const [estimatedMembers, setEstimatedMembers] = useState(5);
    // Step 3: Members
    // Note: FPL Team Name removed as per user request
    const [members, setMembers] = useState<{ displayName: string; phone: string }[]>([]);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberPhone, setNewMemberPhone] = useState('');

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

    // Derived calculations
    const totalMonthlyPool = monthlyFee * estimatedMembers;
    const weeklyPrize = Math.round(totalMonthlyPool * (weeklyPrizePercent / 100));
    const grandVault = Math.round(totalMonthlyPool * ((100 - weeklyPrizePercent) / 100));

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

    const nextStep = () => {
        if (step === 1) {
            setRole('admin');
        }
        if (step === 2) {
            setLeagueSettings({ name: leagueName, monthlyFee, inviteCode: generatedCode });
        }
        if (step === 3) {
            // Commit members globally
            members.forEach((m) => addMemberGlobal({ ...m, hasPaid: false }));
        }
        if (step === 4) {
            // Step 4 handles firebase writes separately inside handleConfirmLeague
            return;
        }
        if (step < STEPS) setStep(step + 1);
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const handleConfirmLeague = async () => {
        setIsSubmitting(true);
        setSubmitError('');

        try {
            // Write 1: Create Admin User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: fullName });

            // Write 2: Create the League Document
            const leagueDocRef = await addDoc(collection(db, 'leagues'), {
                leagueName,
                monthlyContribution: monthlyFee,
                chairmanId: userCredential.user.uid,
                chairmanEmail: email,
                rules: {
                    weekly: weeklyPrizePercent,
                    vault: 100 - weeklyPrizePercent
                },
                inviteCode: generatedCode,
                createdAt: serverTimestamp()
            });

            const leagueId = leagueDocRef.id;

            // Write 2: Batch Enroll Members (including Chairman implicitly)
            const batch = writeBatch(db);

            // Enroll Chairman First
            const chairmanRef = doc(collection(db, 'leagues', leagueId, 'memberships'));
            batch.set(chairmanRef, {
                displayName: fullName,
                phone: phone,
                hasPaid: false,
                trustScore: 100
            });

            // Enroll Other Members
            members.forEach((member) => {
                const memberRef = doc(collection(db, 'leagues', leagueId, 'memberships'));
                batch.set(memberRef, {
                    displayName: member.displayName,
                    phone: member.phone,
                    hasPaid: false,
                    trustScore: 100
                });
            });

            await batch.commit();

            // Store active league and move to success screen
            localStorage.setItem('activeLeagueId', leagueId);
            setStep(5);
        } catch (error: any) {
            console.error("Error creating league or enrolling members:", error);
            console.error("FIREBASE ERROR details:", error);
            if (error.code === 'auth/email-already-in-use') {
                setSubmitError("Email is already registered. Please log in instead.");
            } else {
                setSubmitError(`Creation Failed: ${error.message || "Unknown error occurred"}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const prevStep = () => {
        if (step > 1 && !isSubmitting) setStep(step - 1);
    };

    const addLocalMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberName || !newMemberPhone) return;
        setMembers([...members, { displayName: newMemberName, phone: newMemberPhone }]);
        setNewMemberName('');
        setNewMemberPhone('');
    };

    const removeLocalMember = (indexToRemove: number) => {
        setMembers(members.filter((_, idx) => idx !== indexToRemove));
    };

    const handleCopyCode = () => {
        const fullShareList = [{ displayName: fullName + " (Chairman)", phone }, ...members]
            .map(m => `• ${m.displayName}: ${m.phone}`)
            .join("\n");

        navigator.clipboard.writeText(`🏆 The Big League is Official! 🏆\n\nLeague Code: *${generatedCode}*\nMonthly Fee: KES ${monthlyFee}\n\nSeason Distribution:\nWeekly Pot: KES ${weeklyPrize}\nEnd-of-Season Vault: KES ${grandVault * 38}\n\nEnrolled Members (${members.length + 1}):\n${fullShareList}\n\nJoin at: https://fantasychama.co.ke`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const inputClasses = "w-full pl-12 pr-4 py-3 md:py-3.5 rounded-xl border border-white/5 bg-[#161d24] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FBBF24]/50 focus:ring-1 focus:ring-[#FBBF24]/50 transition-all font-medium [&:-webkit-autofill]:bg-[#161d24] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0px_1000px_#161d24_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]";

    const renderStep1 = () => (
        <div className="w-[95%] sm:w-[500px] max-w-lg mx-auto bg-gradient-to-b from-[#1c272c] to-[#11171a] border border-white/5 rounded-[2rem] p-6 md:p-8 z-10 shadow-2xl relative animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 to-transparent rounded-[2rem] pointer-events-none"></div>
            <div className="text-center mb-6 relative z-10">
                <h1 className="text-2xl md:text-3xl font-bold mb-1 tracking-tight text-white">
                    Chairman Sign Up
                </h1>
                <p className="text-gray-400 text-xs">
                    Begin your journey as a League Chairman.
                </p>
            </div>

            <form className="space-y-4 relative z-10" onSubmit={(e) => { e.preventDefault(); nextStep(); }}>
                <div>
                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Full Name</label>
                    <div className="relative">
                        <PersonStanding className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            required
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                            pattern="^[a-zA-Z]{2,} [a-zA-Z]{2,}.*$"
                            title="Please enter at least two names (e.g., John Doe)"
                            className={inputClasses}
                            placeholder="Enter your legal name"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Email Address</label>
                    <div className="relative">
                        <Mail className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            required
                            type="email"
                            value={email}
                            pattern="^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
                            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid email address with an @ symbol and domain.')}
                            onChange={e => {
                                (e.target as HTMLInputElement).setCustomValidity('');
                                setEmail(e.target.value);
                            }}
                            className={inputClasses}
                            placeholder="admin@fantasychama.com"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">M-Pesa Phone Number</label>
                    <div className="relative">
                        <Phone className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            required
                            type="tel"
                            value={phone}
                            pattern="^0[0-9]{9}$"
                            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid 10-digit Kenyan phone number starting with 0.')}
                            onChange={e => {
                                (e.target as HTMLInputElement).setCustomValidity('');
                                setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10));
                            }}
                            className={inputClasses}
                            placeholder="e.g. 0712345678"
                        />
                    </div>
                </div>

                <div className="space-y-1.5 mb-6">
                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Secure Password</label>
                    <div className="relative">
                        <Lock className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            required
                            type={showPassword ? "text" : "password"}
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

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={!fullName || !email || !phone || !password}
                        className="w-full bg-[#FBBF24] hover:bg-[#eab308] text-[#0A0E17] font-bold text-base md:text-lg py-3.5 md:py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(251,191,36,0.15)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>Create Chairman Account</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </form>

            <div className="mt-6 pt-5 border-t border-white/5 text-center relative z-10">
                <p className="text-[11px] md:text-xs text-gray-400">
                    Already a Chairman? <button onClick={() => navigate('/login', { state: { isAdminView: true } })} className="text-[#10B981] font-bold hover:underline">Log in here.</button>
                </p>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 w-full col-span-1 md:col-span-2">
            <div className="text-center mb-8 relative z-10">
                <h2 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight text-white">Build Your League's Economy</h2>
                <p className="text-gray-400 text-xs md:text-sm">Configure your chama rules, contributions, and prize distributions.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 w-full max-w-5xl mx-auto h-full">
                {/* Column 1: Core Configuration & Split */}
                <div className="space-y-4 flex flex-col h-full">
                    <div className="bg-[#151c18] border border-white/5 p-5 md:p-6 rounded-2xl shadow-lg relative overflow-hidden shrink-0">
                        <div className="flex items-center gap-2 mb-4 text-white font-bold text-lg relative z-10">
                            <Shield className="w-5 h-5 text-[#22c55e]" /> Core Configuration
                        </div>
                        <div className="space-y-4 relative z-10">
                            <div>
                                <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">League Name</label>
                                <input type="text" value={leagueName} onChange={e => setLeagueName(e.target.value)} className={inputClasses} placeholder="e.g. The Alpha Syndicate" />
                            </div>
                            <div>
                                <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Monthly Contribution (KES)</label>
                                <div className="flex bg-[#161d24] border border-white/5 rounded-xl overflow-hidden focus-within:border-[#FBBF24]/50 focus-within:ring-1 focus-within:ring-[#FBBF24]/50 transition-all">
                                    <span className="bg-[#11171a] px-4 flex items-center justify-center text-gray-400 font-bold border-r border-white/5">KES</span>
                                    <input
                                        type="number"
                                        value={monthlyFee === 0 ? '' : monthlyFee}
                                        onChange={e => setMonthlyFee(Number(e.target.value))}
                                        className="w-full bg-transparent px-4 py-3.5 text-white font-medium focus:outline-none [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#161d24] [-webkit-text-fill-color:white]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Estimated Members</label>
                                <input
                                    type="number"
                                    min="2"
                                    value={estimatedMembers}
                                    onChange={e => setEstimatedMembers(Math.max(2, Number(e.target.value)))}
                                    className={inputClasses}
                                    placeholder="e.g. 10"
                                />
                                <p className="text-[9px] text-gray-500 mt-1.5">Used purely for projection below.</p>
                            </div>
                        </div>
                    </div>

                    {/* Distribution Split */}
                    <div className="bg-[#151c18] border border-white/5 p-5 md:p-6 rounded-2xl shadow-lg relative h-full flex flex-col flex-1">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2 text-white font-bold text-lg">
                                <Trophy className="w-5 h-5 text-[#FBBF24]" /> Distribution Split Logic
                            </div>
                            <span className="px-2 py-1 bg-[#22c55e]/10 text-[#22c55e] text-[9px] uppercase font-bold tracking-widest rounded border border-[#22c55e]/20">Dynamic Payout</span>
                        </div>

                        <div className="mb-6 flex-1 flex flex-col justify-center">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <h3 className="text-3xl font-black text-[#22c55e] tabular-nums tracking-tight">{weeklyPrizePercent}%</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Weekly Prize</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="text-3xl font-black text-[#FBBF24] tabular-nums tracking-tight">{100 - weeklyPrizePercent}%</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Grand Vault</p>
                                </div>
                            </div>

                            {/* Interactive Range Slider */}
                            <div className="mt-4 relative mb-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={weeklyPrizePercent}
                                    onChange={(e) => setWeeklyPrizePercent(Number(e.target.value))}
                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer outline-none"
                                    style={{
                                        background: `linear-gradient(to right, #22c55e ${weeklyPrizePercent}%, #FBBF24 ${weeklyPrizePercent}%)`
                                    }}
                                />
                                {/* Hidden style for thumb */}
                                <style dangerouslySetInnerHTML={{
                                    __html: `
                                    input[type=range]::-webkit-slider-thumb {
                                        appearance: none;
                                        width: 20px;
                                        height: 20px;
                                        background: #fff;
                                        border: 2px solid border-white/20;
                                        border-radius: 50%;
                                        cursor: pointer;
                                    }
                                `}} />
                                <div className="flex justify-between mt-2 text-[9px] text-gray-500 font-bold px-1 mb-2">
                                    <span>Season Payout Only</span>
                                    <span>Adjust Split</span>
                                    <span>All Weekly</span>
                                </div>
                                {weeklyPrizePercent === 0 && (
                                    <p className="text-[10px] text-[#eab308] border border-[#eab308]/20 bg-[#eab308]/10 p-2 rounded mt-2">
                                        <Shield className="w-3 h-3 inline-block mr-1" />
                                        <strong>Season-only payouts selected.</strong>
                                        Tip: Weekly prizes help keep members engaged and prevent drop-offs.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#161d24] border border-white/5 rounded-xl p-4 border-l-2 border-l-[#22c55e]">
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Weekly Payout</p>
                                <h4 className="text-xl font-bold text-white mb-1 tabular-nums">KES {weeklyPrize.toLocaleString()}</h4>
                                <p className="text-[10px] text-gray-500 leading-tight">Distributed weekly</p>
                            </div>
                            <div className="bg-[#161d24] border border-white/5 rounded-xl p-4 border-l-2 border-l-[#FBBF24]">
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Grand Vault</p>
                                <h4 className="text-xl font-bold text-white mb-1 tabular-nums">KES {grandVault.toLocaleString()}</h4>
                                <p className="text-[10px] text-gray-500 leading-tight">End-of-season rewards</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Pot Totals */}
                <div className="relative h-full flex flex-col justify-between space-y-4">
                    <div className="bg-[#151c18] border border-white/5 p-5 md:p-6 rounded-2xl shadow-xl flex-1 flex flex-col">
                        <h3 className="font-bold text-white mb-1">Pot Totals (Live Preview)</h3>
                        <p className="text-[10px] md:text-xs text-[#22c55e] mb-6 font-medium">Real-time projection for {estimatedMembers} members</p>

                        <div className="space-y-5 flex-1 flex flex-col justify-center">
                            <div className="flex gap-4 items-center bg-[#161d24] p-4 rounded-xl border border-white/5">
                                <div className="size-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center flex-shrink-0">
                                    <div className="w-4 h-4 border-l-2 border-r-2 border-[#22c55e]"></div>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold uppercase text-gray-400 tracking-widest mb-0.5">Estimated Weekly Pot</p>
                                    <h4 className="text-xl font-bold text-white tabular-nums tracking-tight">KES {weeklyPrize.toLocaleString()}</h4>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center bg-[#161d24] p-4 rounded-xl border border-white/5">
                                <div className="size-10 rounded-full bg-[#FBBF24]/10 flex items-center justify-center flex-shrink-0">
                                    <Trophy className="w-4 h-4 text-[#FBBF24]" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold uppercase text-gray-400 tracking-widest mb-0.5">Estimated Season Vault</p>
                                    <h4 className="text-xl font-bold text-white tabular-nums tracking-tight">KES {(grandVault * 38).toLocaleString()}</h4>
                                    <p className="text-[10px] text-[#22c55e] font-bold mt-1.5 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"></div> Based on 38 GWs
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-white/5">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[11px] md:text-xs font-semibold text-white">Revenue Distribution</span>
                                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">100% Transparent</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-[11px] md:text-sm">
                                    <span className="flex items-center gap-2 text-gray-400"><span className="size-1.5 rounded-full bg-[#22c55e]" /> Weekly Prizes</span>
                                    <span className="font-bold tabular-nums text-white">{weeklyPrizePercent}%</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] md:text-sm">
                                    <span className="flex items-center gap-2 text-gray-400"><span className="size-1.5 rounded-full bg-[#FBBF24]" /> Vault Deposit</span>
                                    <span className="font-bold tabular-nums text-white">{100 - weeklyPrizePercent}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-0 shrink-0">
                        <button
                            onClick={nextStep}
                            disabled={!leagueName || monthlyFee < 100}
                            className="w-full bg-[#FBBF24] hover:bg-[#eab308] text-[#0a100a] font-bold text-base md:text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(251,191,36,0.15)] disabled:opacity-50"
                        >
                            Next: Add Members <ArrowRight className="w-5 h-5 ml-1" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 w-full">
            <div className="text-center mb-8">
                <p className="text-[10px] text-[#FBBF24] font-bold uppercase tracking-widest mb-2">The Gatekeeper</p>
                <h2 className="text-2xl md:text-3xl font-extrabold mb-2 tracking-tight">Member Enrollment</h2>
                <p className="text-gray-400 text-xs md:text-sm">Establish your league's inner circle. Members will be securely invited via code later.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto h-full min-h-[400px]">
                {/* Left side: Add member */}
                <div className="bg-[#151c18] border border-white/5 rounded-2xl p-6 flex flex-col h-full shadow-lg relative overflow-hidden">
                    <div className="flex items-center gap-2 text-white font-bold text-lg mb-6">
                        <UserPlus className="w-5 h-5 text-[#22c55e]" />
                        New Member
                    </div>

                    <form onSubmit={addLocalMember} className="space-y-6 flex-1 relative z-10">
                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Member Display Name</label>
                            <input
                                type="text"
                                value={newMemberName}
                                onChange={e => setNewMemberName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                                placeholder="e.g. John Doe"
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Phone Number</label>
                            <input
                                type="tel"
                                value={newMemberPhone}
                                pattern="^0[0-9]{9}$"
                                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Must be a 10-digit number starting with 0.')}
                                onChange={e => {
                                    (e.target as HTMLInputElement).setCustomValidity('');
                                    setNewMemberPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10));
                                }}
                                placeholder="e.g. 0712345678"
                                className={inputClasses}
                            />
                        </div>
                        {/* FPL Team Name removed for simplicity */}

                        <button
                            type="submit"
                            disabled={!newMemberName || !newMemberPhone}
                            className="w-full bg-[#22c55e] hover:bg-[#1fbb59] text-[#0A0E17] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
                        >
                            <UserPlus className="w-5 h-5" /> Enroll to Circle
                        </button>

                        <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-4 flex gap-3 items-start">
                            <div className="size-5 rounded-full bg-[#FBBF24]/20 text-[#FBBF24] flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">i</div>
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                <strong className="text-white">Tip:</strong> Enrolled members verify themselves when setting up their Profile later using your generated join code.
                            </p>
                        </div>
                    </form>
                </div>

                {/* Right side: Enrolled List */}
                <div className="bg-[#151c18] border border-white/5 rounded-2xl flex flex-col h-full shadow-lg relative overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white">Enrolled Circle</span>
                        </div>
                        <span className="bg-white/10 text-gray-300 text-xs font-bold px-2 py-1 rounded">{members.length} Total</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {members.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                                <Users className="w-12 h-12 text-gray-500 mb-4" />
                                <p className="text-sm font-medium text-gray-400">No managers enrolled yet.<br />Add your first trusted member.</p>
                            </div>
                        ) : (
                            members.map((m, i) => (
                                <div key={i} className="flex justify-between items-center bg-[#0a100a]/50 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-[#22c55e]/20 flex items-center justify-center font-bold text-[#22c55e] border border-[#22c55e]/30">
                                            {m.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-white">{m.displayName}</p>
                                            <p className="text-[10px] text-gray-400">{m.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => removeLocalMember(i)}
                                            className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest px-2 py-1 border border-red-400/20 rounded hover:bg-red-400/10 flex items-center gap-1"
                                        >
                                            Unenroll
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t border-white/5">
                        <button
                            onClick={nextStep}
                            disabled={members.length < 2}
                            className="w-full bg-[#FBBF24] hover:bg-[#eab308] text-[#0A0E17] font-bold text-base md:text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(251,191,36,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Shield className="w-5 h-5" /> {members.length < 2 ? `Add ${2 - members.length} More Member(s)` : "Initialize League & Generate Code"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 w-full">
            <div className="text-center mb-8">
                <p className="text-[10px] text-[#FBBF24] font-bold uppercase tracking-widest mb-2">Final Verification</p>
                <h2 className="text-2xl md:text-3xl font-extrabold mb-2 tracking-tight">Confirm League Details</h2>
                <p className="text-gray-400 text-xs md:text-sm">Review your economy and members before activating the league.</p>
            </div>

            <div className="bg-[#151c18] border border-white/5 rounded-2xl p-6 md:p-8 w-full max-w-3xl mx-auto shadow-xl relative overflow-hidden space-y-8">
                <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 to-transparent rounded-[2rem] pointer-events-none"></div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#161d24] rounded-xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">League Name</p>
                        <p className="text-white font-bold truncate">{leagueName || "N/A"}</p>
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
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total Projected</p>
                        <p className="text-[#FBBF24] font-bold tabular-nums">KES {totalMonthlyPool}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-white font-bold">
                            <Trophy className="w-4 h-4 text-[#FBBF24]" /> Distribution Summary
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-[#0a100a]/50 p-3 rounded-xl border border-white/5 text-sm">
                                <span className="text-gray-400">Weekly Prize ({weeklyPrizePercent}%)</span>
                                <span className="font-bold text-white tabular-nums">KES {weeklyPrize}</span>
                            </div>
                            <div className="flex justify-between items-center bg-[#0a100a]/50 p-3 rounded-xl border border-white/5 text-sm">
                                <span className="text-gray-400 text-xs">Season Vault ({100 - weeklyPrizePercent}%)</span>
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
                            {members.slice(0, 4).map((m, i) => (
                                <div key={i} className="flex justify-between items-center bg-[#0a100a]/50 p-2.5 rounded-lg border border-white/5 text-xs">
                                    <span className="font-medium text-gray-200">{m.displayName}</span>
                                    <span className="text-gray-400 tabular-nums">{m.phone}</span>
                                </div>
                            ))}
                            {members.length > 4 && (
                                <div className="text-center text-[10px] text-gray-500 pt-1 font-bold tracking-widest uppercase">+ {members.length - 4} more members</div>
                            )}
                        </div>
                    </div>
                </div>

                {submitError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-3 rounded-lg text-center mt-4 tracking-widest uppercase">
                        {submitError}
                    </div>
                )}

                <div className="pt-4 border-t border-white/10">
                    <button
                        onClick={handleConfirmLeague}
                        disabled={isSubmitting}
                        className="w-full bg-[#22c55e] hover:bg-[#1fbb59] text-[#0A0E17] font-bold text-base md:text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)] disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isSubmitting ? "Initializing League Vault..." : "Confirm & Generate League Code"}
                        {!isSubmitting && <ArrowRight className="w-5 h-5 ml-1" />}
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
                <p className="text-gray-400 max-w-sm mx-auto">Your league economy is actively monitoring. You must share this unique join code with your enrolled members securely.</p>
            </div>

            <div className="bg-[#151c18] border border-[#FBBF24]/30 p-10 rounded-[2rem] w-full max-w-sm text-center shadow-[0_0_50px_rgba(251,191,36,0.05)] relative overflow-hidden">
                <p className="text-[#FBBF24] text-[10px] md:text-xs font-bold uppercase tracking-widest mb-4">Master Invite Code</p>
                <h1 className="text-5xl md:text-6xl font-black font-mono tracking-widest text-white drop-shadow-md">
                    {generatedCode.slice(0, 3)} <span className="text-[#FBBF24]">{generatedCode.slice(3, 6)}</span>
                </h1>
            </div>

            <div className="w-full max-w-sm space-y-3 mt-8">
                <button onClick={handleCopyCode} className="w-full bg-[#22c55e] hover:bg-[#1fbb59] text-[#0A0E17] font-bold text-base md:text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                    <Smartphone className="w-5 h-5" />
                    {copied ? "Copied!" : "Copy Secure Code"}
                </button>
                <div className="flex items-center gap-3 my-4">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Next Phase</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                </div>
                <button onClick={() => navigate('/')} className="w-full bg-[#161d24] border border-white/5 hover:border-white/20 text-white font-bold py-4 rounded-xl transition-all shadow-md">
                    Enter Chairman Command Center
                </button>
                <p className="text-[10px] text-[#22c55e] border border-[#22c55e]/20 bg-[#22c55e]/5 p-2 rounded text-center mt-4">
                    <Shield className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                    League settings and root members successfully transferred and secured in Firebase.
                </p>
            </div>
        </div>
    );

    return (
        <div className="min-h-[100dvh] bg-[#0b1014] flex flex-col items-center justify-center relative !overflow-x-hidden overflow-y-auto text-white font-sans w-full py-16 md:py-20">
            {/* Network background graphic simulation */}
            <div className="fixed right-[-10%] bottom-[-10%] w-[600px] h-[600px] opacity-20 pointer-events-none">
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
            <div className="absolute top-0 w-full p-4 md:p-8 flex justify-between items-center z-20 bg-gradient-to-b from-[#0b1014] to-transparent">
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
                    <span className="hidden sm:inline">Secure Wealth Circle</span>
                </div>
            </div>

            <div className="w-full max-w-screen-xl relative mx-auto my-auto z-10 flex flex-col justify-center items-center h-auto min-h-max">
                {step > 1 && step < STEPS && (
                    <div className={clsx("w-full mx-auto relative group mt-8 mb-6 md:mb-8",
                        step === 2 ? "max-w-5xl" : step === 3 ? "max-w-4xl" : "max-w-3xl")}>
                        <button onClick={prevStep} className="absolute -top-8 left-0 text-gray-500 hover:text-white flex items-center gap-1 transition-colors text-[11px] font-bold uppercase tracking-widest">
                            <ArrowLeft className="w-4 h-4" /> Go Back
                        </button>

                        <div className="flex gap-1.5 w-full">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className={clsx("h-1 flex-1 rounded-full transition-all duration-500", i < step ? "bg-[#22c55e]" : i === step ? "bg-[#FBBF24]" : "bg-white/10")} />
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

            <div className="absolute bottom-6 w-full text-center z-10 px-4">
                <p className="text-[8px] md:text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                    © {new Date().getFullYear()} Fantasy Chama Global Wealth Management. All Rights Reserved.
                </p>
            </div>
        </div>
    );
}
