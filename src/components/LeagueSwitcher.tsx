// LeagueSwitcher.tsx — Multi-league support for users in more than one Chama.
// Reads the userLeagues/{phone} Firestore document and renders a dropdown
// that lets the user hot-swap their active league context.

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import { ChevronDown, Trophy } from 'lucide-react';

interface LeagueEntry {
    leagueId: string;
    leagueName: string;
    role: string;
}

export default function LeagueSwitcher() {
    const [leagues, setLeagues] = useState<LeagueEntry[]>([]);
    const [open, setOpen] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const phone = localStorage.getItem('memberPhone');
    const activeLeagueId = localStorage.getItem('activeLeagueId');

    useEffect(() => {
        if (!phone) return;
        const ref = doc(db, 'userLeagues', phone);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setLeagues(data.leagues || []);
            }
        }, (error) => {
            console.warn('[league-switcher] snapshot failed:', error?.message || error);
        });
        return () => {
            try { unsub(); } catch (error: any) {
                console.warn('[league-switcher] cleanup failed:', error?.message || error);
            }
        };
    }, [phone]);

    useEffect(() => {
        const hintDismissed = localStorage.getItem('fc-league-switcher-hint-dismissed') === 'true';
        if (!hintDismissed) setShowHint(true);
    }, []);

    // Only render if user is in multiple leagues
    if (leagues.length <= 1) return null;

    const active = leagues.find(l => l.leagueId === activeLeagueId);

    const dismissHint = () => {
        localStorage.setItem('fc-league-switcher-hint-dismissed', 'true');
        setShowHint(false);
    };

    const switchLeague = (league: LeagueEntry) => {
        localStorage.setItem('activeLeagueId', league.leagueId);
        localStorage.setItem('activeUserRole', league.role);
        useStore.getState().setRole(league.role === 'admin' ? 'admin' : 'member');
        // Re-listen to the new league
        useStore.getState().listenToLeagueSettings(league.leagueId);
        useStore.getState().listenToLeagueMembers(league.leagueId);
        setOpen(false);
        window.location.href = '/dashboard'; // full context reset
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all"
            >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="max-w-[100px] truncate">{active?.leagueName || 'Switch League'}</span>
                <span className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-gray-300">
                    {leagues.length} Leagues
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {showHint && !open && (
                <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl border border-emerald-400/30 bg-[#0f1923] p-3 shadow-2xl z-[210]">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Quick Onboarding</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-300">
                        Switching league here rewires your dashboard, wallet activity, and approvals to that selected circle.
                    </p>
                    <button
                        type="button"
                        onClick={dismissHint}
                        className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-300 hover:text-emerald-200"
                    >
                        Understood
                    </button>
                </div>
            )}

            {open && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-[#0f1923] border border-white/10 rounded-2xl shadow-2xl z-[200] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2.5 border-b border-white/5">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Your Leagues</p>
                    </div>
                    {leagues.map((league) => (
                        <button
                            key={league.leagueId}
                            onClick={() => switchLeague(league)}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors ${league.leagueId === activeLeagueId ? 'bg-emerald-500/10' : ''}`}
                        >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${league.leagueId === activeLeagueId ? 'bg-emerald-400' : 'bg-white/20'}`} />
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{league.leagueName}</p>
                                <p className="text-[10px] text-gray-500 capitalize">{league.role}</p>
                            </div>
                            {league.leagueId === activeLeagueId && (
                                <span className="ml-auto text-[9px] text-emerald-400 font-black uppercase tracking-widest">Active</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
