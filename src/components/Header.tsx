import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useNotifications } from './NotificationProvider';
import { Bell, Eye, EyeOff, Shield, Trophy, CheckCircle2, AlertTriangle, Info, CheckCheck, Scroll, Sun, Moon } from 'lucide-react';
import clsx from 'clsx';
import LeagueRulesModal from './LeagueRulesModal';
import LeagueSwitcher from './LeagueSwitcher';
import { auth } from '../firebase';
import { useTheme } from '../hooks/useTheme';
import { onAuthStateChanged } from 'firebase/auth';

export default function Header({ role, title, subtitle }: { role: string, title?: string | React.ReactNode, subtitle?: string | React.ReactNode }) {
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id';
    const members = useStore(state => state.members);
    const realActiveUser = members.find(m => m.id === activeUserId)?.id || members[0]?.id || activeUserId;
    const { isStealthMode, toggleStealthMode } = useStore();
    const { notifications, markAllAsRead, markAsRead } = useNotifications();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const activeTabState = useState<'personal' | 'system'>('personal');
    const activeTab = activeTabState[0];
    const setActiveTab = activeTabState[1];
    const [notifView, setNotifView] = useState<'all' | 'payout' | 'security' | 'updates'>('all');
    const [showConstitution, setShowConstitution] = useState(false);
    const [notifListMotion, setNotifListMotion] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { theme: currentTheme, setTheme } = useTheme();
    const [headerMotion, setHeaderMotion] = useState('');

    const currentMember = members.find(m => m.id === realActiveUser) || members.find(m => m.id === activeUserId) || null;
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && user.uid === import.meta.env.VITE_SUPER_ADMIN_UID) {
                setIsSuperAdmin(true);
            } else {
                setIsSuperAdmin(activeUserId === import.meta.env.VITE_SUPER_ADMIN_UID);
            }
        });
        return () => unsubscribe();
    }, [activeUserId]);

    useEffect(() => {
        if (!currentMember) return;
        if (currentMember.id !== realActiveUser) return;
        if (currentMember.hasAcceptedRules !== true && currentMember.role !== 'admin') {
            setShowConstitution(true);
        }
    }, [currentMember, realActiveUser]);

    useEffect(() => {
        setHeaderMotion('fc-header-enter');
        const timer = window.setTimeout(() => setHeaderMotion(''), 220);
        return () => window.clearTimeout(timer);
    }, [location.pathname]);
    const fullDisplayName = currentMember?.displayName || (role === 'admin' ? 'Chairman' : 'Manager');
    const displayName = fullDisplayName.split(' ')[0];
    const avatarSeed = (currentMember as any)?.avatarSeed || fullDisplayName;

    useEffect(() => {
        if (!isDropdownOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsDropdownOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isDropdownOpen]);

    const handleBellClick = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    useEffect(() => {
        if (!isDropdownOpen) return;
        setNotifListMotion('fc-notif-list-enter');
        const timer = window.setTimeout(() => setNotifListMotion(''), 220);
        return () => window.clearTimeout(timer);
    }, [activeTab, notifView, isDropdownOpen]);

    const handleMarkAllRead = (e: React.MouseEvent) => {
        e.stopPropagation();
        markAllAsRead();
    };

    const handleNotificationClick = async (notificationId: string, isRead: boolean) => {
        if (isRead) return;
        await markAsRead(notificationId);
    };

    const notificationCategory = (notif: any): 'payout' | 'security' | 'updates' => {
        const msg = String(notif?.message || '').toLowerCase();
        if (msg.includes('payout') || msg.includes('winner') || msg.includes('gw') || msg.includes('autopilot')) return 'payout';
        if (notif?.type === 'warning' || msg.includes('security') || msg.includes('nudge') || msg.includes('red zone') || msg.includes('approval')) return 'security';
        return 'updates';
    };

    const handleMarkVisibleAsRead = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const targets = filteredNotifs.filter(n => !n.readBy?.includes(realActiveUser));
        await Promise.all(targets.map(n => markAsRead(n.id)));
    };

    const formatMessageTime = (ts: any) => {
        if (!ts) return 'Just now';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const visibleNotifs = notifications.filter(n => !n.targetMemberId || n.targetMemberId === realActiveUser);
    const personalNotifs = visibleNotifs.filter(n => n.targetMemberId === realActiveUser || n.type === 'transactionSuccess');
    const systemNotifs = visibleNotifs.filter(n => !n.targetMemberId && n.type !== 'transactionSuccess');

    const displayNotifs = activeTab === 'personal' ? personalNotifs : systemNotifs;
    const filteredNotifs = displayNotifs.filter((notif) => notifView === 'all' ? true : notificationCategory(notif) === notifView);
    const unreadFilteredCount = filteredNotifs.filter(n => !n.readBy?.includes(realActiveUser)).length;
    const unreadPersonalCount = personalNotifs.filter(n => !n.readBy?.includes(realActiveUser)).length;
    const unreadSystemCount = systemNotifs.filter(n => !n.readBy?.includes(realActiveUser)).length;

    return (
        <div className="flex justify-between items-center mb-8 md:mb-10 w-full relative z-50">
            <div className={clsx('fc-header-stage', headerMotion)}>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 md:h-12 md:w-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full border-2 border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 relative group">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}&backgroundColor=transparent`} alt="User avatar" className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                            {title || `${getGreeting()}, ${displayName}!`}
                            {/* Live sync indicator */}
                            <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                Live
                            </span>
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            {role === 'admin' ? (
                                <Shield className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#22c55e]" />
                            ) : (
                                <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#FBBF24]" />
                            )}
                            <span className="text-gray-400 font-medium text-xs md:text-sm">{subtitle || (role === 'admin' ? 'Level 4 Vault Access' : 'League Member')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3" ref={dropdownRef}>
                {/* Join HQ Trigger */}
                {isSuperAdmin && (
                    <button
                        onClick={() => navigate('/hq')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl text-[#10B981] hover:text-white hover:bg-[#10B981]/80 transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.15)] active:scale-95"
                        title="Access Super Admin HQ"
                    >
                        <Shield className="w-4 h-4" /> Join HQ
                    </button>
                )}

                {/* Theme Toggle — 3-way pill: Dark | System | Light */}
                <div className="fc-theme-toggle-shell hidden sm:flex items-center rounded-xl p-1 gap-0.5">
                    {(['dark', 'system', 'light'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setTheme(mode)}
                            className={`fc-theme-toggle-btn flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                currentTheme === mode
                                    ? mode === 'dark' ? 'bg-slate-700 text-white shadow-sm'
                                    : mode === 'light' ? 'bg-amber-400/20 text-amber-300 shadow-sm'
                                    : 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-400'
                            }`}
                            title={mode === 'dark' ? 'Force dark mode' : mode === 'light' ? 'Force light mode' : 'Auto-match OS theme'}
                        >
                            {mode === 'dark' ? <Moon className="w-3 h-3" /> : mode === 'light' ? <Sun className="w-3 h-3" /> : <span className="text-[9px]">OS</span>}
                            {mode}
                        </button>
                    ))}
                </div>
                {/* Mobile compact cycle */}
                <button
                    onClick={() => setTheme(currentTheme === 'dark' ? 'system' : currentTheme === 'system' ? 'light' : 'dark')}
                    className="fc-theme-toggle-mobile sm:hidden p-2.5 border rounded-xl text-gray-400 hover:text-white transition-all duration-300 ease-out active:scale-95"
                    title={`Theme: ${currentTheme} — tap to cycle`}
                >
                    {currentTheme === 'dark' ? <Moon className="w-5 h-5" /> : currentTheme === 'light' ? <Sun className="w-5 h-5 text-amber-300" /> : <span className="text-[9px] font-black text-emerald-400">OS</span>}
                </button>

                {/* Stealth Mode Toggle */}
                <button
                    onClick={toggleStealthMode}
                    className="fc-stealth-toggle p-2.5 md:p-3 border rounded-xl text-gray-400 hover:text-white transition-all duration-300 ease-out active:scale-95"
                    title={isStealthMode ? "Disable Stealth Mode" : "Enable Stealth Mode"}
                >
                    {isStealthMode ? <EyeOff className="w-5 h-5 md:w-6 md:h-6 text-[#10B981]" /> : <Eye className="w-5 h-5 md:w-6 md:h-6" />}
                </button>

                {/* Constitution Icon Button */}
                <button
                    onClick={() => setShowConstitution(true)}
                    className="fc-constitution-trigger p-2.5 md:p-3 border rounded-xl text-gray-400 hover:text-emerald-400 transition-all duration-300 ease-out hover:border-emerald-500/20 active:scale-95"
                    title="League Constitution"
                >
                    <Scroll className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                    <button
                        onClick={handleBellClick}
                        className={clsx(
                            "p-2.5 md:p-3 border border-white/5 rounded-xl text-gray-400 hover:text-white transition-all active:scale-95",
                            isDropdownOpen ? "bg-[#22c55e]/10 border-[#22c55e]/50 text-[#22c55e]" : "bg-[#161d24] hover:bg-white/5"
                        )}
                    >
                        <Bell className="w-5 h-5 md:w-6 md:h-6" />
                        {(unreadPersonalCount + unreadSystemCount) > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 md:top-0 md:right-0 min-w-[18px] h-[18px] bg-[#FBBF24] rounded-full border-2 border-[#0b1014] flex items-center justify-center animate-pulse">
                                <span className="text-[9px] font-black text-black tabular-nums leading-none">{unreadPersonalCount + unreadSystemCount > 9 ? '9+' : unreadPersonalCount + unreadSystemCount}</span>
                            </span>
                        )}
                    </button>

                    {/* Dropdown */}
                    {isDropdownOpen && typeof document !== 'undefined' && createPortal(
                        <div className="fc-notif-backdrop-wrap fixed inset-0 z-[120]">
                            <div
                                className="fc-notif-backdrop absolute inset-y-0 right-0 bg-black/22 backdrop-blur-xl"
                                style={{ left: 'var(--fc-sidebar-width, 0px)' }}
                                onClick={() => setIsDropdownOpen(false)}
                            />
                            <div className="fc-notif-panel absolute top-3 right-3 md:top-4 md:right-4 w-[min(92vw,28rem)] bg-[#0e1419]/92 border border-white/10 rounded-[1.5rem] shadow-[0_24px_60px_rgba(0,0,0,0.32)] overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-top-3 duration-300 origin-top-right fc-notif-dropdown fc-card">
                                {/* Header row with Mark All Read */}
                                <div className="px-5 py-3.5 border-b border-white/5 flex justify-between items-center bg-black/30 backdrop-blur-md">
                                    <h3 className="font-bold text-sm tracking-wide">Mission Control</h3>
                                    {(unreadPersonalCount > 0 || unreadSystemCount > 0) && (
                                        <div className="flex items-center gap-1.5">
                                            {unreadFilteredCount > 0 && (
                                                <button
                                                    onClick={handleMarkVisibleAsRead}
                                                    className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                                                    title="Mark visible notifications as read"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Mark visible
                                                </button>
                                            )}
                                            <button
                                                onClick={handleMarkAllRead}
                                                className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-emerald-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                                                title="Mark all as read"
                                            >
                                                <CheckCheck className="w-3.5 h-3.5" />
                                                Mark all as read
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-white/5 bg-black/15 backdrop-blur-sm">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveTab('personal'); }}
                                        className={clsx(
                                            "flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-colors relative flex items-center justify-center gap-2",
                                            activeTab === 'personal' ? "text-emerald-400" : "text-gray-500 hover:text-gray-300"
                                        )}
                                    >
                                        Personal
                                        {unreadPersonalCount > 0 && (
                                            <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md text-[10px] leading-none">
                                                {unreadPersonalCount}
                                            </span>
                                        )}
                                        {activeTab === 'personal' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveTab('system'); }}
                                        className={clsx(
                                            "flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-colors relative flex items-center justify-center gap-2",
                                            activeTab === 'system' ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
                                        )}
                                    >
                                        System
                                        {unreadSystemCount > 0 && (
                                            <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md text-[10px] leading-none">
                                                {unreadSystemCount}
                                            </span>
                                        )}
                                        {activeTab === 'system' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                                        )}
                                    </button>
                                </div>
                                {/* Notification Category Chips */}
                                <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto bg-white/[0.02]">
                                    {[
                                        { key: 'all', label: 'All' },
                                        { key: 'payout', label: 'Payouts' },
                                        { key: 'security', label: 'Security' },
                                        { key: 'updates', label: 'Updates' },
                                    ].map((chip) => (
                                        <button
                                            key={chip.key}
                                            onClick={(e) => { e.stopPropagation(); setNotifView(chip.key as any); }}
                                            className={clsx(
                                                'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-colors',
                                                notifView === chip.key
                                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                                    : 'bg-white/[0.03] border-white/10 text-gray-500 hover:text-gray-300'
                                            )}
                                        >
                                            {chip.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Notification list with dark scrollbar */}
                                <div
                                    className="max-h-[380px] overflow-y-auto"
                                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e2935 transparent' }}
                                >
                                    <style>{`
                                        .notif-scroll::-webkit-scrollbar { width: 5px; }
                                        .notif-scroll::-webkit-scrollbar-track { background: transparent; }
                                        .notif-scroll::-webkit-scrollbar-thumb { background: #1e2935; border-radius: 99px; }
                                        .notif-scroll::-webkit-scrollbar-thumb:hover { background: #2d3f4f; }
                                    `}</style>
                                    <div className={clsx('notif-scroll max-h-[380px] overflow-y-auto divide-y divide-white/[0.06] transition-all duration-300 ease-out', notifListMotion)}>
                                        {filteredNotifs.length > 0 ? filteredNotifs.map((notif) => {
                                            const isRead = notif.readBy?.includes(realActiveUser);
                                            return (
                                                <div
                                                    key={notif.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => handleNotificationClick(notif.id, isRead)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            handleNotificationClick(notif.id, isRead);
                                                        }
                                                    }}
                                                    className={clsx(
                                                        "p-4 transition-colors group flex gap-3 cursor-pointer outline-none",
                                                        isRead
                                                            ? "bg-slate-500/[0.08] hover:bg-slate-500/[0.12] opacity-85"
                                                            : "hover:bg-white/[0.04] bg-white/[0.02]"
                                                    )}
                                                >
                                                    <div className="mt-0.5 flex-shrink-0">
                                                        {notif.type === 'success' && <CheckCircle2 className={clsx("w-4 h-4", isRead ? "text-slate-400" : "text-[#10B981]")} />}
                                                        {notif.type === 'transactionSuccess' && <CheckCircle2 className={clsx("w-4 h-4", isRead ? "text-slate-400" : "text-[#10B981]")} />}
                                                        {notif.type === 'warning' && <AlertTriangle className={clsx("w-4 h-4", isRead ? "text-slate-400" : "text-[#ef4444]")} />}
                                                        {notif.type === 'info' && <Info className={clsx("w-4 h-4", isRead ? "text-slate-400" : "text-[#60a5fa]")} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={clsx(
                                                            "text-xs leading-relaxed",
                                                            isRead
                                                                ? "text-slate-300"
                                                                : notif.type === 'success'
                                                                    ? "text-emerald-300"
                                                                    : notif.type === 'transactionSuccess'
                                                                        ? "text-emerald-300"
                                                                        : notif.type === 'warning'
                                                                            ? "text-red-300"
                                                                            : "text-blue-300"
                                                        )}>
                                                            {notif.message}
                                                        </p>
                                                        <p className="text-[10px] text-gray-600 mt-1 font-medium uppercase tracking-wider">
                                                            {formatMessageTime(notif.timestamp)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-label={isRead ? 'Already read' : 'Mark notification as read'}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleNotificationClick(notif.id, isRead);
                                                        }}
                                                        className={clsx(
                                                            "mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors",
                                                            isRead
                                                                ? "bg-slate-500/15 border-slate-400/30 text-slate-400"
                                                                : "bg-blue-500/10 border-blue-400/30 text-blue-400 hover:bg-blue-500/20"
                                                        )}
                                                    >
                                                        {isRead ? <CheckCheck className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            );
                                        }) : (
                                            <div className="p-10 text-center text-gray-600">
                                                <Bell className="w-7 h-7 mx-auto mb-3 opacity-20" />
                                                <p className="text-sm font-medium">All clear. No alerts.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
                <LeagueSwitcher />
            </div>

            {/* League Constitution Modal */}
            <LeagueRulesModal
                isOpen={showConstitution}
                onClose={() => setShowConstitution(false)}
                currentMember={currentMember}
            />
        </div>
    );
}
