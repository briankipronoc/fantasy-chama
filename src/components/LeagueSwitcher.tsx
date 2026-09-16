import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db, auth } from '../firebase';
import { doc, onSnapshot, collection, query, where, getDocs, setDoc, arrayUnion, serverTimestamp, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useStore } from '../store/useStore';
import { ChevronDown, Trophy, Check, Plus, Shield, Users, Loader2, X, Sparkles, ArrowRight } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { useNavigate } from 'react-router-dom';
import { normalizeKenyanPhone } from '../utils/phone';
import toast from 'react-hot-toast';

interface LeagueEntry {
    leagueId: string;
    leagueName: string;
    role: string;
}

interface LeagueSwitcherProps {
    variant?: 'sidebar' | 'header';
    isCollapsed?: boolean;
}

export default function LeagueSwitcher({ variant = 'header', isCollapsed = false }: LeagueSwitcherProps) {
    const navigate = useNavigate();
    const [leagues, setLeagues] = useState<LeagueEntry[]>([]);
    const [open, setOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [switchingLeagueName, setSwitchingLeagueName] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const phone = localStorage.getItem('memberPhone');
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const storeLeagueName = useStore((state) => (state.league as any)?.leagueName || state.league?.name);
    const cachedLeagueName = localStorage.getItem('activeLeagueName');
    const activeRole = localStorage.getItem('activeUserRole') || localStorage.getItem('fc-role') || 'member';
    const [currentUid, setCurrentUid] = useState<string | null>(auth.currentUser?.uid || null);

    // Join League by Code modal states
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [isSearchingCode, setIsSearchingCode] = useState(false);
    const [foundLeague, setFoundLeague] = useState<{ id: string; name: string; stake: number; memberCount?: number } | null>(null);
    const [codeError, setCodeError] = useState('');
    const [joinPhoneInput, setJoinPhoneInput] = useState(phone || '');
    const [joinNameInput, setJoinNameInput] = useState(localStorage.getItem('activeUserName') || '');
    const [isJoiningLeague, setIsJoiningLeague] = useState(false);

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUid(user ? user.uid : null);
        });
        return () => unsubAuth();
    }, []);

    useEffect(() => {
        let unsubs: Array<() => void> = [];
        let memberLeagues: LeagueEntry[] = [];
        let chairLeagues: LeagueEntry[] = [];

        const updateMerged = () => {
            const map = new Map<string, LeagueEntry>();
            // Add member leagues first
            memberLeagues.forEach(l => map.set(l.leagueId, l));
            // Add chairman leagues (they take precedence for role)
            chairLeagues.forEach(l => map.set(l.leagueId, l));

            // Ensure currently active league is always represented even before remote sync finishes
            if (activeLeagueId && !map.has(activeLeagueId)) {
                map.set(activeLeagueId, {
                    leagueId: activeLeagueId,
                    leagueName: storeLeagueName || cachedLeagueName || 'League',
                    role: activeRole,
                });
            }

            setLeagues(Array.from(map.values()));
        };

        if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            const ref = doc(db, 'userLeagues', cleanPhone || phone);
            const unsubPhone = onSnapshot(ref, (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    memberLeagues = (data.leagues || []) as LeagueEntry[];
                } else {
                    memberLeagues = [];
                }
                updateMerged();
            }, (error) => {
                console.warn('[league-switcher] phone snapshot failed:', error?.message || error);
                updateMerged();
            });
            unsubs.push(unsubPhone);
        } else {
            updateMerged();
        }

        if (currentUid) {
            const leaguesRef = collection(db, 'leagues');
            const qChairman = query(leaguesRef, where('chairmanId', '==', currentUid));
            const unsubChairman = onSnapshot(qChairman, (snap) => {
                chairLeagues = snap.docs.map(d => {
                    const data = d.data();
                    return {
                        leagueId: d.id,
                        leagueName: data.name || data.leagueName || 'Unnamed League',
                        role: 'admin'
                    };
                });
                updateMerged();
            }, (error) => {
                console.warn('[league-switcher] chairman snapshot failed:', error?.message || error);
                updateMerged();
            });
            unsubs.push(unsubChairman);
        }

        return () => {
            unsubs.forEach(u => {
                try { u(); } catch {}
            });
        };
    }, [phone, currentUid, activeLeagueId, storeLeagueName, activeRole]);

    useEffect(() => {
        if (!open) return;
        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const active = leagues.find(l => l.leagueId === activeLeagueId) || {
        leagueId: activeLeagueId || '',
        leagueName: storeLeagueName || cachedLeagueName || 'League',
        role: activeRole,
    };

    const switchLeague = async (league: LeagueEntry) => {
        haptics.selection();
        if (league.leagueId === activeLeagueId) {
            setOpen(false);
            return;
        }

        setIsSwitching(true);
        setSwitchingLeagueName(league.leagueName);

        try {
            // 1. Resolve membership ID in the target league so user profile, wagers, reactions & settings bind accurately
            const membershipsRef = collection(db, 'leagues', league.leagueId, 'memberships');
            let matchedMemberId: string | null = null;
            let matchedPhone: string | null = null;

            if (league.role === 'admin') {
                const qAdmin = query(membershipsRef, where('role', 'in', ['admin', 'co-chair']));
                const adminSnap = await getDocs(qAdmin);
                if (!adminSnap.empty) {
                    const phoneMatch = phone ? adminSnap.docs.find(d => {
                        const p = d.data().phone;
                        return p && (p === phone || p.slice(-9) === phone.slice(-9));
                    }) : null;
                    const targetDoc = phoneMatch || adminSnap.docs[0];
                    matchedMemberId = targetDoc.id;
                    matchedPhone = targetDoc.data().phone || null;
                }
            }

            if (!matchedMemberId && phone) {
                const qPhone = query(membershipsRef, where('phone', '==', phone));
                const phoneSnap = await getDocs(qPhone);
                if (!phoneSnap.empty) {
                    matchedMemberId = phoneSnap.docs[0].id;
                    matchedPhone = phoneSnap.docs[0].data().phone || phone;
                }
            }

            if (!matchedMemberId) {
                const allMembersSnap = await getDocs(membershipsRef);
                if (!allMembersSnap.empty) {
                    const fallbackAdmin = allMembersSnap.docs.find(d => d.data().role === 'admin');
                    if (league.role === 'admin' && fallbackAdmin) {
                        matchedMemberId = fallbackAdmin.id;
                        matchedPhone = fallbackAdmin.data().phone || null;
                    } else {
                        matchedMemberId = allMembersSnap.docs[0].id;
                    }
                }
            }

            localStorage.setItem('activeLeagueId', league.leagueId);
            localStorage.setItem('activeUserRole', league.role);
            if (matchedMemberId) {
                localStorage.setItem('activeUserId', matchedMemberId);
            }
            if (matchedPhone) {
                localStorage.setItem('memberPhone', matchedPhone);
            }

            useStore.getState().setRole(league.role === 'admin' ? 'admin' : 'member');
            useStore.getState().listenToLeagueSettings(league.leagueId);
            useStore.getState().listenToLeagueMembers(league.leagueId);

            setOpen(false);

            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 300);
        } catch (err) {
            console.error('[switchLeague] error resolving membership:', err);
            localStorage.setItem('activeLeagueId', league.leagueId);
            localStorage.setItem('activeUserRole', league.role);
            useStore.getState().setRole(league.role === 'admin' ? 'admin' : 'member');
            window.location.href = '/dashboard';
        }
    };

    const handleSearchCode = async (rawCode: string) => {
        const cleanCode = rawCode.trim().toUpperCase();
        setInviteCodeInput(cleanCode);
        setCodeError('');
        setFoundLeague(null);
        if (cleanCode.length !== 6) return;

        setIsSearchingCode(true);
        try {
            const leaguesRef = collection(db, 'leagues');
            const q = query(leaguesRef, where('inviteCode', '==', cleanCode));
            const snap = await getDocs(q);
            if (snap.empty) {
                setCodeError('No league found matching this 6-character code.');
                setFoundLeague(null);
            } else {
                const lDoc = snap.docs[0];
                const lData = lDoc.data();
                setFoundLeague({
                    id: lDoc.id,
                    name: lData.name || lData.leagueName || 'Unnamed League',
                    stake: Number(lData.gameweekStake || 0),
                });
            }
        } catch (err: any) {
            console.error('[LeagueSwitcher] code search error:', err);
            setCodeError('Unable to search league. Please check network.');
        } finally {
            setIsSearchingCode(false);
        }
    };

    const handleExecuteJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!foundLeague) return;
        const targetPhone = normalizeKenyanPhone(joinPhoneInput || phone || '');
        if (!targetPhone) {
            toast.error('Please enter a valid phone number.');
            return;
        }

        setIsJoiningLeague(true);
        try {
            const membershipsRef = collection(db, 'leagues', foundLeague.id, 'memberships');
            const qPhone = query(membershipsRef, where('phone', '==', targetPhone));
            const memberSnap = await getDocs(qPhone);

            if (memberSnap.empty) {
                await addDoc(membershipsRef, {
                    displayName: joinNameInput.trim() || 'Chama Member',
                    phone: targetPhone,
                    hasPaid: false,
                    walletBalance: 0,
                    role: 'member',
                    trustScore: 100,
                    avatarSeed: Math.random().toString(36).substring(7),
                    joinedAt: serverTimestamp(),
                });
            }

            const cleanPhone = targetPhone.replace(/\D/g, '');
            const userLeagueRef = doc(db, 'userLeagues', cleanPhone);
            await setDoc(userLeagueRef, {
                leagues: arrayUnion({
                    leagueId: foundLeague.id,
                    leagueName: foundLeague.name,
                    role: 'member'
                })
            }, { merge: true });

            localStorage.setItem('memberPhone', targetPhone);
            if (joinNameInput.trim()) {
                localStorage.setItem('activeUserName', joinNameInput.trim());
            }

            toast.success(`Joined ${foundLeague.name}!`);
            setShowJoinModal(false);

            await switchLeague({
                leagueId: foundLeague.id,
                leagueName: foundLeague.name,
                role: 'member'
            });
        } catch (err: any) {
            console.error('[LeagueSwitcher] join error:', err);
            toast.error('Could not join league: ' + (err?.message || 'Error'));
        } finally {
            setIsJoiningLeague(false);
        }
    };

    const isSidebar = variant === 'sidebar';

    return (
        <>
            <div ref={dropdownRef} className={`relative ${isSidebar && !isCollapsed ? 'w-full' : ''}`}>
                {isSidebar ? (
                    isCollapsed ? (
                        <button
                            type="button"
                            onClick={() => { haptics.selection(); setOpen(!open); }}
                            className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center relative cursor-pointer active:scale-95 transition-all group shadow-sm"
                            title={`Active League: ${active.leagueName} (${active.role === 'admin' ? 'Chairman' : 'Member'})`}
                        >
                            <Trophy className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                            {leagues.length > 1 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-black text-black flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse">
                                    {leagues.length}
                                </span>
                            )}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { haptics.selection(); setOpen(!open); }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/60 dark:bg-white/[0.03] hover:bg-slate-200/70 dark:hover:bg-white/[0.07] transition-all text-left group cursor-pointer shadow-sm"
                            title="Switch active League"
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="text-[11px] font-bold text-slate-800 dark:text-white block truncate leading-tight">
                                        {active.leagueName}
                                    </span>
                                    <span className="text-[9px] text-slate-500 dark:text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                                        {active.role === 'admin' ? (
                                            <>
                                                <Shield className="w-2.5 h-2.5 text-emerald-500" /> Chairman
                                            </>
                                        ) : (
                                            <>
                                                <Users className="w-2.5 h-2.5 text-blue-500" /> Member
                                            </>
                                        )}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {leagues.length > 1 && (
                                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-black px-1.5 py-0.2">
                                        {leagues.length}
                                    </span>
                                )}
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                            </div>
                        </button>
                    )
                ) : (
                    <button
                        type="button"
                        onClick={() => { haptics.selection(); setOpen(!open); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white transition-all cursor-pointer backdrop-blur-md shadow-sm active:scale-95"
                        title="Switch active League"
                    >
                        <Trophy className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                        <span className="max-w-[130px] truncate">{active.leagueName}</span>
                        {leagues.length > 1 && (
                            <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-300">
                                {leagues.length} Leagues
                            </span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 dark:text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
                    </button>
                )}

                {open && (
                    <div className={
                        isSidebar && isCollapsed
                            ? "absolute left-full top-0 ml-3 w-64 bg-white/95 dark:bg-[#0c1219]/95 backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl z-[250] overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150 p-1.5 space-y-1"
                            : isSidebar
                                ? "mt-2 w-full bg-white dark:bg-[#090e13] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150 p-1.5 space-y-1"
                                : "absolute top-full right-0 mt-2 w-64 bg-white/95 dark:bg-[#0f1720]/95 backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[250] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                    }>
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">
                                Your Leagues ({leagues.length})
                            </span>
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                Instant Switch
                            </span>
                        </div>

                        <div className="max-h-52 overflow-y-auto custom-scrollbar p-1 space-y-1">
                            {leagues.map((league) => {
                                const isCurrent = league.leagueId === activeLeagueId;
                                return (
                                    <button
                                        key={league.leagueId}
                                        type="button"
                                        onClick={() => switchLeague(league)}
                                        className={`w-full text-left p-2 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                            isCurrent 
                                                ? 'bg-emerald-500/15 border border-emerald-500/30 text-slate-900 dark:text-white' 
                                                : 'hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent text-slate-600 dark:text-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-300 dark:bg-gray-600'}`} />
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold truncate">{league.leagueName}</p>
                                                <p className="text-[9px] text-slate-400 dark:text-gray-400 uppercase tracking-wider font-semibold">
                                                    {league.role === 'admin' ? 'Chairman' : 'Member'}
                                                </p>
                                            </div>
                                        </div>
                                        {isCurrent && (
                                            <span className="shrink-0 flex items-center gap-1 text-[9px] text-emerald-500 dark:text-emerald-400 font-black uppercase">
                                                <Check className="w-3 h-3" /> Active
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pt-2 pb-1 px-1 border-t border-slate-100 dark:border-white/5 space-y-1">
                            <button
                                type="button"
                                onClick={() => {
                                    haptics.selection();
                                    setOpen(false);
                                    navigate('/setup');
                                }}
                                className="w-full py-2 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                            >
                                <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Create Another League</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    haptics.selection();
                                    setOpen(false);
                                    setShowJoinModal(true);
                                }}
                                className="w-full py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-[9.5px] font-bold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                                <span>Join League via Invite Code</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Smooth League Switch Transition Overlay */}
            {isSwitching && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex flex-col items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0c1219] border border-slate-200 dark:border-emerald-500/35 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs mx-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                            <Trophy className="w-7 h-7 text-emerald-500 dark:text-emerald-400 animate-bounce" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Switching League</p>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">{switchingLeagueName}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-gray-300">
                            <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
                            <span>Loading League Hub & Standings...</span>
                        </div>
                    </div>
                </div>
            )}

            {/* In-App Join League by Invite Code Modal */}
            {showJoinModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white dark:bg-[#0d141c] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative text-slate-900 dark:text-white">
                        <button
                            type="button"
                            onClick={() => { setShowJoinModal(false); setFoundLeague(null); setInviteCodeInput(''); }}
                            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black tracking-tight">Join Another League</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-400">Enter the 6-character code from your Chairman</p>
                            </div>
                        </div>

                        <form onSubmit={handleExecuteJoin} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1.5">
                                    6-Character Invite Code
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={inviteCodeInput}
                                        onChange={(e) => handleSearchCode(e.target.value)}
                                        placeholder="e.g. 882109 or KIP4FC"
                                        className="w-full bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/15 rounded-xl px-4 py-3 text-lg font-black tracking-widest uppercase text-center focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-gray-600"
                                        autoFocus
                                    />
                                    {isSearchingCode && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                                        </div>
                                    )}
                                </div>
                                {codeError && (
                                    <p className="text-[11px] font-bold text-red-500 dark:text-red-400 mt-1.5">{codeError}</p>
                                )}
                            </div>

                            {/* Found League Card Preview */}
                            {foundLeague && (
                                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                                            League Found
                                        </span>
                                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                                            KES {foundLeague.stake.toLocaleString()}/GW
                                        </span>
                                    </div>
                                    <p className="text-base font-black text-slate-900 dark:text-white">{foundLeague.name}</p>

                                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-500/20 space-y-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-gray-400 mb-1">
                                                Your M-Pesa Phone Number
                                            </label>
                                            <input
                                                type="tel"
                                                required
                                                value={joinPhoneInput}
                                                onChange={(e) => setJoinPhoneInput(e.target.value)}
                                                placeholder="e.g. 0712345678"
                                                className="w-full bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-gray-400 mb-1">
                                                Your Manager Display Name (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={joinNameInput}
                                                onChange={(e) => setJoinNameInput(e.target.value)}
                                                placeholder="e.g. Brian Kiprono"
                                                className="w-full bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isJoiningLeague}
                                        className="w-full mt-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md disabled:opacity-50"
                                    >
                                        {isJoiningLeague ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Connecting Chama...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Confirm & Join {foundLeague.name}</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
