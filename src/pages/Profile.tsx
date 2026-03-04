import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Settings, User, Trophy, Share2, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import clsx from 'clsx';

export default function Profile() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id'; // Fallback for MVP
    const role = useStore(state => state.role);
    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    // State for Member Settings
    const [phoneNumber, setPhoneNumber] = useState('');
    const [fplTeamName, setFplTeamName] = useState('');
    const [isSavingMember, setIsSavingMember] = useState(false);

    // State for Admin Settings
    const [monthlyContribution, setMonthlyContribution] = useState<number>(0);
    const [weeklyPrizePercent, setWeeklyPrizePercent] = useState<number>(70);
    const [inviteCode, setInviteCode] = useState('');
    const [isSavingAdmin, setIsSavingAdmin] = useState(false);
    const [showWarningModal, setShowWarningModal] = useState(false);

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
            // For the sake of the prototype, we just grab the first member if we don't have a specific auth ID matcher
            // Ideally we match `activeUserId` or phone number.
            const currentMember = members.find(m => m.id === activeUserId) || members[0];
            if (currentMember) {
                setPhoneNumber(currentMember.phone || '');
                setFplTeamName((currentMember as any).fplTeamName || '');
            }
        }
    }, [members, activeUserId]);

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
                    phone: phoneNumber,
                    fplTeamName: fplTeamName
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
                'rules.vault': 100 - Number(weeklyPrizePercent)
            });
            setToast({ message: 'League rules updated successfully!', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to update league rules. Security check failed?', type: 'error' });
            console.error(error);
        } finally {
            setIsSavingAdmin(false);
            setTimeout(() => setToast(null), 4000);
        }
    };

    const handleSaveAdmin = (e: React.FormEvent) => {
        e.preventDefault();
        setShowWarningModal(true);
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
        <div className="min-h-full p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white bg-[#0A0E17]">

            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
                        <Settings className="w-8 h-8 text-[#22c55e]" /> User Profile
                    </h1>
                    <p className="text-gray-400 font-medium tracking-wide">
                        Manage your personal details and app preferences.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Member View (Personal Settings) */}
                    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl shadow-xl backdrop-blur-sm relative overflow-hidden">
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                            <User className="w-5 h-5 text-[#3b82f6]" /> Personal Details
                        </h2>

                        <form onSubmit={handleSaveMember} className="space-y-5">
                            <div>
                                <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    M-Pesa Phone Number
                                </label>
                                <input
                                    type="text"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full bg-[#05080f] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] transition-all outline-none"
                                    placeholder="e.g. 254700..."
                                />
                                <p className="text-[10px] text-gray-500 mt-2">Essential for automated STK pushes and payouts.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    FPL Team ID / Name
                                </label>
                                <input
                                    type="text"
                                    value={fplTeamName}
                                    onChange={(e) => setFplTeamName(e.target.value)}
                                    className="w-full bg-[#05080f] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] transition-all outline-none"
                                    placeholder="Enter your FPL Team details"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSavingMember}
                                className="w-full bg-[#22c55e] hover:bg-[#1ea54c] text-[#0a100a] font-bold rounded-xl py-3.5 transition-colors mt-6"
                            >
                                {isSavingMember ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>

                    {/* Admin View (League Command & Invite Hub) */}
                    {role === 'admin' && (
                        <div className="bg-[#151c18] border border-white/5 p-6 rounded-2xl shadow-xl backdrop-blur-sm relative overflow-hidden flex flex-col">

                            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                                <Trophy className="w-5 h-5 text-[#FBBF24]" /> League Settings
                            </h2>

                            {/* Invite Hub Section */}
                            <div className="bg-[#0A0E17] border border-white/5 rounded-xl p-5 mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Share Invite</h3>
                                    <span className="px-2 py-1 bg-[#22c55e]/10 text-[#22c55e] text-[9px] uppercase font-bold tracking-widest rounded border border-[#22c55e]/20">Active</span>
                                </div>
                                <div className="text-center mb-6">
                                    <span className="text-4xl font-black text-white tracking-widest block mb-2">{inviteCode || '------'}</span>
                                    <p className="text-xs text-gray-500 font-medium">Unique 6-digit access code for your league.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleCopy} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-lg border border-white/10 transition-colors text-sm">
                                        <Copy className="w-4 h-4" /> Copy Link
                                    </button>
                                    <button onClick={handleShare} className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 rounded-lg shadow-lg transition-colors text-sm">
                                        <Share2 className="w-4 h-4" /> WhatsApp
                                    </button>
                                </div>
                            </div>

                            {/* Rule Modification Form */}
                            <form onSubmit={handleSaveAdmin} className="space-y-6 flex-1 flex flex-col justify-end">
                                <div>
                                    <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                        Monthly Contribution (KES)
                                    </label>
                                    <input
                                        type="number"
                                        min="100"
                                        value={monthlyContribution}
                                        onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                        className="w-full bg-[#05080f] border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white focus:ring-1 focus:ring-[#FBBF24] focus:border-[#FBBF24] transition-all outline-none"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Distribution Split Logic
                                        </label>
                                        <span className="text-xs font-bold text-[#FBBF24]">{weeklyPrizePercent} / {100 - weeklyPrizePercent}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={weeklyPrizePercent}
                                        onChange={(e) => setWeeklyPrizePercent(Number(e.target.value))}
                                        className="w-full h-2 bg-[#05080f] rounded-lg appearance-none cursor-pointer accent-[#FBBF24]"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-widest">
                                        <span>Weekly</span>
                                        <span>Vault</span>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSavingAdmin}
                                    className="w-full bg-[#FBBF24] hover:bg-[#f59e0b] text-[#0a100a] font-bold rounded-xl py-3.5 transition-colors mt-4"
                                >
                                    {isSavingAdmin ? 'Updating Rules...' : 'Update Financial Rules'}
                                </button>
                            </form>

                        </div>
                    )}
                </div>

            </div>

            {/* Confirmation Modal */}
            {showWarningModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-[#151c18] border border-white/10 max-w-md w-full rounded-2xl p-6 shadow-2xl relative">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 mx-auto">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-xl font-black text-center text-white mb-2">Are you sure?</h3>
                        <p className="text-gray-400 text-center text-sm mb-6">
                            Changing financial rules will affect all future gameweek payouts and vault projections. This action is logged.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowWarningModal(false)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAdminSave}
                                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors"
                            >
                                Confirm Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

        </div>
    );
}
