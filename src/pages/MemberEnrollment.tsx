import { useState, useEffect } from 'react';
import { Shield, UserPlus, Users, Trash2, Wallet, Clock, Lock, Info, Search, RefreshCw, Check, Phone, AlertTriangle, Sparkles, ChevronRight } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import ConfirmModal from '../components/ConfirmModal';

export default function MemberEnrollment() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const { members, listenToLeagueMembers } = useStore();

    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newFplId, setNewFplId] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [addError, setAddError] = useState('');
    const [addSuccess, setAddSuccess] = useState('');

    const [fplLeagueId, setFplLeagueId] = useState<string | null>(null);
    const [fplStandings, setFplStandings] = useState<any[]>([]);
    const [isFetchingFpl, setIsFetchingFpl] = useState(false);
    const [fplError, setFplError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [leagueName, setLeagueName] = useState('');
    const [gameweekStake, setGameweekStake] = useState(0);

    const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);

    useEffect(() => {
        if (!activeLeagueId) return;
        const unsub = listenToLeagueMembers(activeLeagueId);
        getDoc(doc(db, 'leagues', activeLeagueId)).then(snap => {
            if (snap.exists()) {
                const data = snap.data();
                setLeagueName(data.name || data.leagueName || 'Your League');
                setGameweekStake(data.gameweekStake || 0);
                if (data.fplLeagueId) {
                    setFplLeagueId(String(data.fplLeagueId));
                    fetchFplStandings(String(data.fplLeagueId));
                }
            }
        });
        return () => unsub();
    }, [activeLeagueId, listenToLeagueMembers]);

    useEffect(() => {
        if (!fplLeagueId) return;
        fetchFplStandings(fplLeagueId);
    }, [fplLeagueId]);

    const fetchFplStandings = async (id: string) => {
        setIsFetchingFpl(true);
        setFplError('');
        try {
            const res = await fetch(`/fpl-api/leagues-classic/${id}/standings/`);
            if (!res.ok) throw new Error('FPL API unavailable');
            const data = await res.json();
            if (data?.standings?.results) setFplStandings(data.standings.results);
        } catch {
            setFplError('Could not fetch FPL standings. Check your internet connection.');
        } finally {
            setIsFetchingFpl(false);
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeLeagueId || !newName.trim() || !newPhone.trim()) return;
        setAddError(''); setAddSuccess(''); setIsAdding(true);
        try {
            const existing = members.find(m => m.phone === newPhone);
            if (existing) { setAddError(`${existing.displayName} already uses this phone number.`); return; }
            const memberData: any = {
                displayName: newName.trim(), phone: newPhone.trim(),
                hasPaid: false, walletBalance: 0, role: 'member',
                trustScore: 100, avatarSeed: Math.random().toString(36).substring(7),
                joinedAt: serverTimestamp(), isActive: true,
            };
            if (newFplId.trim()) memberData.fplTeamId = Number(newFplId.trim());
            const fplMatch = fplStandings.find(s => s.entry === Number(newFplId));
            if (fplMatch) memberData.fplTeamName = fplMatch.entry_name;
            await addDoc(collection(db, 'leagues', activeLeagueId, 'memberships'), memberData);
            setAddSuccess(`${newName.trim()} added!`);
            setNewName(''); setNewPhone(''); setNewFplId('');
            setTimeout(() => setAddSuccess(''), 3000);
        } catch (err: any) {
            setAddError(err.message || 'Failed to add member. Try again.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleImportFromFpl = (standing: any) => {
        const alreadyExists = members.find(m => m.displayName === standing.player_name || (m as any).fplTeamId === standing.entry);
        if (alreadyExists) return;
        setNewName(standing.player_name);
        setNewFplId(String(standing.entry));
        document.getElementById('member-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleRemoveMember = (memberId: string, memberName: string) => {
        setMemberToRemove({ id: memberId, name: memberName });
    };

    const executeRemoveMember = async () => {
        if (!activeLeagueId || !memberToRemove) return;
        setIsRemoving(true);
        try {
            await deleteDoc(doc(db, 'leagues', activeLeagueId, 'memberships', memberToRemove.id));
            setMemberToRemove(null);
        } catch (err) {
            console.error('Remove failed:', err);
        } finally {
            setIsRemoving(false);
        }
    };

    const activeMembersCount = members.filter(m => m.isActive !== false).length;
    const adminMember = members.find(m => m.role === 'admin');
    const regularMembers = members.filter(m => m.role !== 'admin');
    const membersWithNoPhone = members.filter(m => !m.phone || m.phone === '');
    const filteredFplStandings = fplStandings.filter(s => {
        const already = members.find(m => (m as any).fplTeamId === s.entry);
        const q = searchQuery.toLowerCase();
        return !already && (!q || s.player_name.toLowerCase().includes(q) || s.entry_name.toLowerCase().includes(q));
    });

    const paidCount = members.filter(m => m.hasPaid).length;
    const weeklyPool = gameweekStake * activeMembersCount;

    return (
        <div className="min-h-screen text-white font-sans flex flex-col relative overflow-hidden"
            style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.06) 0%, transparent 55%), #0a0e14' }}>

            {/* Ambient grid */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.018]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '52px 52px' }} />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full pointer-events-none z-0"
                style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 60%)' }} />

            {/* ── HEADER BAR ── */}
            <header className="relative z-50 flex items-center justify-between px-5 md:px-8 py-4 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(10,14,20,0.85)', backdropFilter: 'blur(20px)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[0.75rem] flex items-center justify-center"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <Shield className="h-4.5 w-4.5 text-[#10B981]" style={{ width: 18, height: 18 }} />
                    </div>
                    <div>
                        <p className="font-bold text-sm text-white leading-none">Member Enrollment</p>
                        {leagueName && <p className="text-[10px] text-gray-500 font-medium mt-0.5">{leagueName}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    {membersWithNoPhone.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold"
                            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#FBBF24' }}>
                            <AlertTriangle className="w-3 h-3" />{membersWithNoPhone.length} missing phone
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold fc-pulse-green"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
                        <Users className="w-3 h-3" />{activeMembersCount} Active
                    </div>
                </div>
            </header>

            <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full p-5 md:p-8 space-y-6">

                {/* ── PAGE HERO ── */}
                <div className="max-w-2xl fc-slide-up">
                    <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-3.5 h-3.5 text-[#FBBF24]" />
                        <span className="fc-label text-[#FBBF24]">The Gatekeeper</span>
                    </div>
                    <h1 className="fc-hero-heading text-4xl md:text-5xl text-white mb-3">Member Enrollment</h1>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-lg">
                        Build your league circle. Members log in with their M-Pesa number + the invite code. Import directly from your FPL league in one click.
                    </p>
                </div>

                {/* ── WARNING BANNER ── */}
                {membersWithNoPhone.length > 0 && (
                    <div className="rounded-[1rem] p-4 flex items-start gap-3 fc-slide-up"
                        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
                        <AlertTriangle className="w-5 h-5 text-[#FBBF24] flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[#FBBF24] font-bold text-sm">
                                {membersWithNoPhone.length} member{membersWithNoPhone.length > 1 ? 's' : ''} can't log in yet
                            </p>
                            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
                                Missing phone: <span className="text-gray-400">{membersWithNoPhone.map(m => m.displayName).join(', ')}</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* ── TWO-COLUMN MAIN ── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

                    {/* LEFT: Add Member Form — 2 cols */}
                    <div id="member-form" className="lg:col-span-2 fc-slide-up" style={{ animationDelay: '0.05s' }}>
                        <div className="fc-card rounded-[1.5rem] overflow-hidden h-full">
                            {/* Card header strip */}
                            <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-[0.75rem] flex items-center justify-center"
                                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                        <UserPlus className="w-4.5 h-4.5 text-[#10B981]" style={{ width: 18, height: 18 }} />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-white leading-none">Add New Member</h2>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{members.length}/20 slots filled</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5">
                                <form onSubmit={handleAddMember} className="space-y-4">
                                    {/* Name */}
                                    <div>
                                        <label className="fc-label mb-1.5 block">Full Name</label>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value.replace(/[^a-zA-Z\s'\\-]/g, ''))}
                                            placeholder="e.g. Brian Kipronoh"
                                            required
                                            className="fc-input"
                                        />
                                    </div>

                                    {/* Phone */}
                                    <div>
                                        <label className="fc-label mb-1.5 block">M-Pesa Phone Number</label>
                                        <div className="relative">
                                            <Phone className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                            <input
                                                type="tel"
                                                value={newPhone}
                                                onInvalid={e => (e.target as HTMLInputElement).setCustomValidity('Enter a 10-digit number')}
                                                onChange={e => { (e.target as HTMLInputElement).setCustomValidity(''); setNewPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10)); }}
                                                placeholder="e.g. 0712345678"
                                                pattern="^0[0-9]{9}$"
                                                className="fc-input pl-10"
                                            />
                                        </div>
                                        {newPhone.length === 10 && members.some(m => m.phone === newPhone) && (
                                            <p className="text-[10px] text-[#FBBF24] mt-1.5 flex items-center gap-1 font-bold">
                                                <span className="w-1.5 h-1.5 bg-[#FBBF24] rounded-full" />Already registered
                                            </p>
                                        )}
                                    </div>

                                    {/* FPL ID */}
                                    <div>
                                        <label className="fc-label mb-1.5 block">
                                            FPL Entry ID <span className="text-gray-600 normal-case font-normal tracking-normal">— optional</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newFplId}
                                            onChange={e => setNewFplId(e.target.value.replace(/[^0-9]/g, ''))}
                                            placeholder="e.g. 7890123"
                                            className="fc-input"
                                        />
                                        {newFplId && fplStandings.length > 0 && (() => {
                                            const match = fplStandings.find(s => s.entry === Number(newFplId));
                                            return match ? (
                                                <p className="text-[10px] text-[#10B981] mt-1.5 flex items-center gap-1.5 font-bold">
                                                    <Check className="w-3 h-3" />{match.entry_name}
                                                </p>
                                            ) : null;
                                        })()}
                                    </div>

                                    {/* Feedback */}
                                    {addError && (
                                        <div className="rounded-[0.875rem] p-3 flex items-start gap-2 fc-bounce-in text-xs"
                                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{addError}</span>
                                        </div>
                                    )}
                                    {addSuccess && (
                                        <div className="rounded-[0.875rem] p-3 flex items-start gap-2 fc-bounce-in text-xs"
                                            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
                                            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{addSuccess}</span>
                                        </div>
                                    )}

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={isAdding || !newName.trim() || !newPhone.trim()}
                                        className="w-full font-black py-3.5 px-4 rounded-[0.875rem] flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50"
                                        style={{
                                            background: '#10B981', color: '#030a06',
                                            boxShadow: '0 0 24px rgba(16,185,129,0.2), 0 4px 12px rgba(0,0,0,0.15)',
                                        }}
                                    >
                                        {isAdding ? (
                                            <><span className="w-4 h-4 border-2 border-black/40 border-t-transparent rounded-full animate-spin" /> Adding...</>
                                        ) : (
                                            <><UserPlus className="w-4 h-4" /> Enroll Member</>
                                        )}
                                    </button>
                                </form>

                                {/* Info note */}
                                <div className="mt-4 rounded-[0.875rem] p-3.5 flex gap-2.5"
                                    style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
                                    <Info className="w-3.5 h-3.5 text-[#FBBF24] flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-gray-500 leading-relaxed">
                                        Members log in using their <span className="text-gray-300 font-semibold">M-Pesa number</span> + <span className="text-gray-300 font-semibold">league invite code</span>. Phone numbers must be exact.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Enrolled Circle — 3 cols */}
                    <div className="lg:col-span-3 fc-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div className="fc-card rounded-[1.5rem] flex flex-col overflow-hidden h-full">
                            {/* Header */}
                            <div className="px-5 pt-5 pb-4 flex items-center justify-between"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="flex items-center gap-2.5">
                                    <Users className="w-4.5 h-4.5 text-gray-400" style={{ width: 18, height: 18 }} />
                                    <h2 className="text-base font-bold text-white leading-none">Enrolled Circle</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    {paidCount > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                                            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10B981' }}>
                                            {paidCount} paid
                                        </span>
                                    )}
                                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                                        {members.length} members
                                    </span>
                                </div>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto max-h-[520px]">
                                {members.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                                        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            <Users className="w-7 h-7 text-gray-700" />
                                        </div>
                                        <p className="text-gray-500 font-semibold text-sm mb-1">No members yet</p>
                                        <p className="text-gray-700 text-xs">Add the first member with the form</p>
                                    </div>
                                ) : (
                                    <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                                        {/* Chairman pinned */}
                                        {adminMember && (
                                            <div className="px-5 py-3.5 flex items-center gap-3"
                                                style={{ background: 'rgba(251,191,36,0.04)' }}>
                                                <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                                                    style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}>
                                                    {adminMember.displayName?.charAt(0) || 'C'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-white text-sm truncate leading-none">{adminMember.displayName}</p>
                                                    <p className="text-[10px] text-gray-600 mt-0.5 tabular-nums">{adminMember.phone || '—'}</p>
                                                </div>
                                                <span className="text-[9px] font-black px-2 py-1 rounded flex-shrink-0 uppercase tracking-widest"
                                                    style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#FBBF24' }}>
                                                    👑 Chairman
                                                </span>
                                            </div>
                                        )}
                                        {/* Regular members */}
                                        {regularMembers.map((member, i) => (
                                            <div key={member.id}
                                                className="px-5 py-3.5 flex items-center gap-3 group transition-colors fc-slide-up"
                                                style={{ animationDelay: `${i * 0.03}s` }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                <div className={clsx(
                                                    "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0",
                                                )} style={{
                                                    background: member.isActive !== false ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                                                    border: member.isActive !== false ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(255,255,255,0.07)',
                                                    color: member.isActive !== false ? '#10B981' : '#6b7280',
                                                }}>
                                                    {member.displayName?.charAt(0) || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-white text-sm truncate leading-none">{member.displayName}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {member.phone ? (
                                                            <span className="text-[10px] text-gray-500 tabular-nums">{member.phone}</span>
                                                        ) : (
                                                            <span className="text-[10px] text-[#FBBF24] font-bold flex items-center gap-1">
                                                                <AlertTriangle className="w-2.5 h-2.5" />No phone
                                                            </span>
                                                        )}
                                                        {(member as any).fplTeamName && (
                                                            <span className="text-[9px] text-[#10B981]/60 font-medium truncate">
                                                                · {(member as any).fplTeamName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {member.hasPaid ? (
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                                                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
                                                            Funded
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                                                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
                                                            Pending
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => handleRemoveMember(member.id, member.displayName)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
                                                        style={{ color: '#6b7280' }}
                                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
                                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                        title="Remove member"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── FPL IMPORT SECTION ── */}
                {fplLeagueId && (
                    <div className="fc-card rounded-[1.5rem] p-6 fc-slide-up" style={{ animationDelay: '0.15s' }}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Sparkles className="w-4 h-4 text-[#10B981]" />
                                    <h3 className="font-bold text-white text-base">Import from FPL</h3>
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
                                        League #{fplLeagueId}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500 leading-relaxed">
                                    Click any player to pre-fill their name & FPL ID. Add their phone and hit Enroll.
                                </p>
                            </div>
                            <button
                                onClick={() => fetchFplStandings(fplLeagueId!)}
                                disabled={isFetchingFpl}
                                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-[0.875rem] transition-all disabled:opacity-50"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
                            >
                                <RefreshCw className={clsx('w-3.5 h-3.5', isFetchingFpl && 'animate-spin')} />
                                Refresh
                            </button>
                        </div>

                        {fplError && (
                            <div className="rounded-[0.875rem] p-3 mb-4 text-xs"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
                                {fplError}
                            </div>
                        )}

                        {isFetchingFpl && (
                            <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Fetching FPL standings...</span>
                            </div>
                        )}

                        {fplStandings.length > 0 && (
                            <>
                                <div className="relative mb-4">
                                    <Search className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search by name or team..."
                                        className="fc-input pl-10"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-0.5">
                                    {filteredFplStandings.length === 0 && (
                                        <div className="col-span-full text-center text-gray-500 text-sm py-8">
                                            {searchQuery ? 'No results match your search' : '🎉 All FPL managers enrolled!'}
                                        </div>
                                    )}
                                    {filteredFplStandings.map(standing => (
                                        <button
                                            key={standing.id}
                                            onClick={() => handleImportFromFpl(standing)}
                                            className="flex items-center gap-3 p-3 rounded-[0.875rem] text-left group transition-all"
                                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.2)'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'; }}
                                        >
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0"
                                                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.18)', color: '#10B981' }}>
                                                {standing.rank || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-white text-xs truncate">{standing.player_name}</p>
                                                <p className="text-[9px] text-gray-500 truncate">{standing.entry_name}</p>
                                            </div>
                                            <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-[#10B981] transition-colors flex-shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── STATS ROW ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 fc-slide-up" style={{ animationDelay: '0.2s' }}>
                    {[
                        { label: 'Gameweek Stake', value: `KES ${gameweekStake.toLocaleString()}`, icon: <Wallet className="w-5 h-5" />, accent: 'green' as const },
                        { label: 'Active Members', value: `${activeMembersCount}`, sub: `of ${members.length}`, icon: <Users className="w-5 h-5" />, accent: 'gold' as const },
                        { label: 'Weekly Pool', value: `KES ${weeklyPool.toLocaleString()}`, icon: <Clock className="w-5 h-5" />, accent: 'blue' as const },
                    ].map(stat => (
                        <div key={stat.label} className={`fc-stat-card fc-stat-card-${stat.accent} p-5 flex items-center gap-4`}>
                            <div className="p-3 rounded-[0.875rem] flex-shrink-0" style={{
                                background: stat.accent === 'green' ? 'rgba(16,185,129,0.1)' : stat.accent === 'gold' ? 'rgba(251,191,36,0.1)' : 'rgba(59,130,246,0.1)',
                                border: stat.accent === 'green' ? '1px solid rgba(16,185,129,0.2)' : stat.accent === 'gold' ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(59,130,246,0.2)',
                                color: stat.accent === 'green' ? '#10B981' : stat.accent === 'gold' ? '#FBBF24' : '#3b82f6',
                            }}>
                                {stat.icon}
                            </div>
                            <div>
                                <p className="fc-label mb-1">{stat.label}</p>
                                <p className="text-xl font-black text-white fc-mono leading-none">
                                    {stat.value}
                                    {stat.sub && <span className="text-sm text-gray-500 font-normal ml-1">{stat.sub}</span>}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <ConfirmModal
                isOpen={Boolean(memberToRemove)}
                onClose={() => setMemberToRemove(null)}
                onConfirm={executeRemoveMember}
                title="Remove Member from League"
                message={`Permanently remove ${memberToRemove?.name || 'this member'} from the league roster?`}
                confirmText="Remove Member"
                cancelText="Cancel"
                variant="danger"
                isLoading={isRemoving}
            />
        </div>
    );
}
