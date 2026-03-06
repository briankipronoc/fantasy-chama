import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Settings, User, Trophy, Share2, AlertTriangle, CheckCircle2, Copy, Lock, Unlock, Users } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import clsx from 'clsx';

export default function Profile() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id'; // Fallback for MVP
    const role = useStore(state => state.role);
    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    // Form states
    const [displayName, setDisplayName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [fplTeamName, setFplTeamName] = useState('');
    const [avatarSeed, setAvatarSeed] = useState('chairman');
    const [isSavingMember, setIsSavingMember] = useState(false);

    // State for Admin Settings
    const [monthlyContribution, setMonthlyContribution] = useState<number>(0);
    const [weeklyPrizePercent, setWeeklyPrizePercent] = useState<number>(70);
    const [fplLeagueId, setFplLeagueId] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [isSavingAdmin, setIsSavingAdmin] = useState(false);
    const [showWarningModal, setShowWarningModal] = useState(false);

    // Financial Locks
    const [isFinancialsLocked, setIsFinancialsLocked] = useState(true);

    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (activeLeagueId) {
            listenToLeagueMembers(activeLeagueId);
            // Fetch League Details for Admin
            if (role === 'admin') {
                const fetchLeague = async () => {
                    const docRef = doc(db, 'leagues', activeLeagueId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setMonthlyContribution(data.monthlyContribution || 1400);
                        setWeeklyPrizePercent(data.rules?.weekly || 70);
                        setFplLeagueId(data.fplLeagueId || '');
                        setInviteCode(data.inviteCode || 'N/A');
                    }
                };
                fetchLeague();
            }
        }
    }, [activeLeagueId, listenToLeagueMembers, role]);

    useEffect(() => {
        // Find current member to prepopulate
        if (members.length > 0) {
            const currentMember = members.find(m => m.id === activeUserId) || members[0];
            if (currentMember) {
                setDisplayName(currentMember.displayName || '');
                setPhoneNumber(currentMember.phone || '');
                setFplTeamName((currentMember as any).fplTeamName || '');
                setAvatarSeed((currentMember as any).avatarSeed || (role === 'admin' ? 'chairman' : currentMember.displayName));
            }
        }
    }, [members, activeUserId, role]);

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
                await updateDoc(memberRef, {
                    displayName: displayName,
                    phone: phoneNumber,
                    fplTeamName: fplTeamName,
                    avatarSeed: avatarSeed
                });
                setToast({ message: 'Profile updated successfully!', type: 'success' });
            }
        } catch (error) {
            setToast({ message: 'Failed to update profile.', type: 'error' });
            console.error(error);
        } finally {
            setIsSavingMember(false);
            setTimeout(() => setToast(null), 4000);
        }
    };

    const confirmAdminSave = async () => {
        if (!activeLeagueId) return;

        setShowWarningModal(false);
        setIsSavingAdmin(true);
        setToast(null);

        try {
            const leagueRef = doc(db, 'leagues', activeLeagueId);
            await updateDoc(leagueRef, {
                monthlyContribution: Number(monthlyContribution),
                'rules.weekly': Number(weeklyPrizePercent),
                'rules.vault': 100 - Number(weeklyPrizePercent),
                fplLeagueId: fplLeagueId
            });
            localStorage.setItem('chairmanAvatarSeed', avatarSeed);
            setToast({ message: 'League rules updated successfully!', type: 'success' });
            // Re-lock after save
            setIsFinancialsLocked(true);
        } catch (error) {
            setToast({ message: 'Failed to update league rules. Security check failed?', type: 'error' });
            console.error(error);
        } finally {
            setIsSavingAdmin(false);
            setTimeout(() => setToast(null), 4000);
        }
    };

    const handleUnlockFinancials = (e: React.FormEvent) => {
        e.preventDefault();
        setShowWarningModal(true);
    };

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

    return (
        <div className="min-h-full p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white bg-[#0b1014]">

            <div className="max-w-5xl mx-auto space-y-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
                        <Settings className="w-8 h-8 text-[#10B981]" /> User Profile
                    </h1>
                    <p className="text-gray-400 font-medium tracking-wide">
                        Manage your personal details and app preferences.
                    </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Member View (Personal Settings) */}
                    <div className={clsx(
                        "bg-[#161d24] border border-white/5 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col h-full",
                        role === 'admin' ? "xl:col-span-4" : "xl:col-span-6"
                    )}>
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white">
                            <User className="w-5 h-5 text-[#3b82f6]" /> Personal Details
                        </h2>

                        {/* Avatar Generation */}
                        <div className="flex flex-col items-center justify-center mb-8">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1c272c] to-[#11171a] p-1 mb-4 shadow-xl border border-white/10">
                                <img
                                    src={`https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed}&backgroundColor=transparent`}
                                    alt="Avatar"
                                    className="w-full h-full rounded-full object-cover bg-[#0b1014]"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
                                className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1.5 rounded-lg hover:bg-[#10B981]/20 transition-colors border border-[#10B981]/20"
                            >
                                Generate New Avatar
                            </button>
                        </div>

                        <form onSubmit={handleSaveMember} className="space-y-6 flex-1 flex flex-col">
                            <div>
                                <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                                    Display Name
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all outline-none font-medium placeholder:text-gray-600"
                                    placeholder="Enter your Display Name"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                                    M-Pesa Phone Number
                                </label>
                                <input
                                    type="text"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all outline-none font-medium placeholder:text-gray-600"
                                    placeholder="e.g. 254700..."
                                />
                                <p className="text-[10px] text-[#10B981] font-medium mt-2">Essential for automated STK pushes and payouts.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                                    FPL Team ID / Name
                                </label>
                                <input
                                    type="text"
                                    value={fplTeamName}
                                    onChange={(e) => setFplTeamName(e.target.value)}
                                    className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:ring-1 focus:ring-[#10B981] focus:border-[#10B981] transition-all outline-none font-medium placeholder:text-gray-600"
                                    placeholder="Enter your FPL Team details"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSavingMember}
                                className="w-full bg-[#10B981] hover:bg-[#10B981]/80 text-[#0b1014] font-bold rounded-xl py-4 transition-colors mt-auto flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            >
                                {isSavingMember ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>

                    {/* Admin View (League Command & Invite Hub) */}
                    {role === 'admin' && (
                        <div className="xl:col-span-8 bg-[#161d24] border border-[#FBBF24]/20 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FBBF24] blur-[100px] opacity-10 transform translate-x-10 -translate-y-10"></div>

                            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                <Trophy className="w-5 h-5 text-[#FBBF24]" /> League Settings
                            </h2>

                            {/* Invite Hub Section */}
                            <div className="bg-[#0b1014] border border-white/5 rounded-2xl p-6 mb-8 shadow-inner">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Share Invite</h3>
                                    <span className="px-2 py-1 bg-[#10B981]/10 text-[#10B981] text-[9px] uppercase font-bold tracking-widest rounded border border-[#10B981]/20">Active</span>
                                </div>
                                <div className="text-center mb-6">
                                    <span className="text-5xl font-black text-white tracking-widest block mb-2">{inviteCode || '------'}</span>
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
                            <form onSubmit={handleSaveAdmin} className="space-y-6 flex-1 flex flex-col justify-end">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                            Monthly Contribution (KES)
                                            {isFinancialsLocked && <Lock className="w-3 h-3 text-red-400" />}
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        min="100"
                                        disabled={isFinancialsLocked}
                                        value={monthlyContribution}
                                        onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3.5 px-4 text-sm font-bold text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        onChange={(e) => setFplLeagueId(e.target.value)}
                                        placeholder="e.g. 123456"
                                        className="w-full bg-[#0b1014] border border-white/10 rounded-xl py-3.5 px-4 text-sm font-bold text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
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

                    {/* Visual League Members Rail */}
                    <div className={clsx(
                        "bg-[#161d24] border border-white/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden",
                        role === 'admin' ? "xl:col-span-12" : "xl:col-span-6"
                    )}>
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-1 text-white">
                                    <Users className="w-5 h-5 text-[#10B981]" /> Active Managers
                                </h2>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Live League Directory</p>
                            </div>
                            <span className="bg-[#0b1014] text-white border border-white/10 px-3 py-1 rounded-lg text-sm font-black shadow-inner">
                                {members.length}
                            </span>
                        </div>

                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                            {members.map(member => (
                                <div key={member.id} className="flex flex-col items-center flex-shrink-0 w-24 gap-3 group">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-b from-[#1c272c] to-[#0b1014] p-0.5 shadow-lg border border-white/5 group-hover:border-[#10B981]/50 transition-colors">
                                        <img
                                            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${(member as any).avatarSeed || member.displayName}&backgroundColor=transparent`}
                                            alt={member.displayName}
                                            className="w-full h-full rounded-full object-cover bg-[#161d24]"
                                        />
                                    </div>
                                    <div className="text-center">
                                        <span className="text-xs font-bold text-white block truncate w-full px-1">{member.displayName}</span>
                                        <span className={clsx("text-[9px] font-black uppercase tracking-widest mt-0.5 block", member.hasPaid ? "text-[#10B981]" : "text-red-500")}>
                                            {member.hasPaid ? "Funded" : "Red Zone"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* Warning Modal */}
            {
                showWarningModal && (
                    <div className="fixed inset-0 bg-[#0b1014]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-[#161d24] border border-red-500/20 max-w-md w-full rounded-2xl p-6 shadow-2xl">
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
                                    className="flex-1 px-4 py-3 bg-[#0b1014] text-white hover:bg-white/5 rounded-xl font-bold transition-colors text-sm border border-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowWarningModal(false);
                                        setIsFinancialsLocked(false);
                                    }}
                                    className="flex-1 px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-all text-sm border border-red-500/20"
                                >
                                    Yes, Unlock
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Toast Notification */}
            <div className={clsx(
                "fixed bottom-24 md:bottom-10 right-4 left-4 md:left-auto md:right-10 md:w-96 p-4 rounded-xl shadow-2xl transition-all duration-300 transform flex items-start gap-4 z-50",
                toast ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none",
                toast?.type === 'success' ? "bg-[#22c55e] text-[#0a100a]" : "bg-red-500 text-white"
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
