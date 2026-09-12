// LeagueSwitcher.tsx — Multi-league support for users in one or more Chamas.
// Reads userLeagues from Firestore and store, lets users hot-swap their active circle in 1 click.

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useStore } from '../store/useStore';
import { ChevronDown, Trophy, Check, Plus, Shield, Users } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { useNavigate } from 'react-router-dom';

interface LeagueEntry {
    leagueId: string;
    leagueName: string;
    role: string;
}

interface LeagueSwitcherProps {
    variant?: 'sidebar' | 'header';
}

export default function LeagueSwitcher({ variant = 'header' }: LeagueSwitcherProps) {
    const navigate = useNavigate();
    const [leagues, setLeagues] = useState<LeagueEntry[]>([]);
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const phone = localStorage.getItem('memberPhone');
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeRole = localStorage.getItem('activeUserRole') || localStorage.getItem('fc-role') || 'member';
    const storeLeagueName = useStore((state) => state.league?.name);
    const [currentUid, setCurrentUid] = useState<string | null>(auth.currentUser?.uid || null);

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
            // Add chairman leagues
            chairLeagues.forEach(l => map.set(l.leagueId, l));

            // Ensure currently active league is always represented even before remote sync finishes
            if (activeLeagueId && !map.has(activeLeagueId)) {
                map.set(activeLeagueId, {
                    leagueId: activeLeagueId,
                    leagueName: storeLeagueName || 'Active Chama',
                    role: activeRole,
                });
            }

            setLeagues(Array.from(map.values()));
        };

        if (phone) {
            const ref = doc(db, 'userLeagues', phone);
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
        leagueName: storeLeagueName || 'Active Chama',
        role: activeRole,
    };

    const switchLeague = (league: LeagueEntry) => {
        haptics.selection();
        if (league.leagueId === activeLeagueId) {
            setOpen(false);
            return;
        }
        localStorage.setItem('activeLeagueId', league.leagueId);
        localStorage.setItem('activeUserRole', league.role);
        useStore.getState().setRole(league.role === 'admin' ? 'admin' : 'member');
        useStore.getState().listenToLeagueSettings(league.leagueId);
        useStore.getState().listenToLeagueMembers(league.leagueId);
        setOpen(false);
        window.location.href = '/dashboard';
    };

    const isSidebar = variant === 'sidebar';

    return (
        <div ref={dropdownRef} className={`relative ${isSidebar ? 'w-full' : ''}`}>
            {isSidebar ? (
                <button
                    type="button"
                    onClick={() => { haptics.selection(); setOpen(!open); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-all text-left group cursor-pointer shadow-sm"
                    title="Switch active Chama"
                >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-white block truncate leading-tight">
                                {active.leagueName}
                            </span>
                            <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                                {active.role === 'admin' ? (
                                    <>
                                        <Shield className="w-2.5 h-2.5 text-emerald-400" /> Chairman
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-2.5 h-2.5 text-blue-400" /> Member
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => { haptics.selection(); setOpen(!open); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-xs font-bold text-white transition-all cursor-pointer backdrop-blur-md shadow-sm active:scale-95"
                    title="Switch active Chama"
                >
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="max-w-[110px] truncate">{active.leagueName}</span>
                    {leagues.length > 1 && (
                        <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-black uppercase text-emerald-300">
                            {leagues.length} Chamas
                        </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
                </button>
            )}

            {open && (
                <div className={`absolute ${isSidebar ? 'top-full left-0 right-0 w-full mt-2' : 'top-full right-0 mt-2 w-64'} bg-[#0f1720]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[250] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150`}>
                    <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Your Chamas ({leagues.length})
                        </span>
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            Instant Swap
                        </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                        {leagues.map((league) => {
                            const isCurrent = league.leagueId === activeLeagueId;
                            return (
                                <button
                                    key={league.leagueId}
                                    type="button"
                                    onClick={() => switchLeague(league)}
                                    className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                                        isCurrent 
                                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-white' 
                                            : 'hover:bg-white/5 border border-transparent text-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-gray-600'}`} />
                                        <div className="min-w-0">
                                            <p className="text-xs font-black truncate">{league.leagueName}</p>
                                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">
                                                {league.role === 'admin' ? '👑 Chairman' : '⚽ Manager'}
                                            </p>
                                        </div>
                                    </div>
                                    {isCurrent && (
                                        <span className="shrink-0 flex items-center gap-1 text-[9px] text-emerald-400 font-black uppercase">
                                            <Check className="w-3 h-3" /> Active
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-2 border-t border-white/10 bg-black/20">
                        <button
                            type="button"
                            onClick={() => {
                                haptics.selection();
                                setOpen(false);
                                navigate('/login');
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-gray-200 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                        >
                            <Plus className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Join or Create Another Chama</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
