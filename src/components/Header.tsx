import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useNotifications } from './NotificationProvider';
import { Bell, Eye, EyeOff, Shield, Trophy, CheckCircle2, AlertTriangle, Info, CheckCheck, Sun, Moon, HelpCircle, LogOut } from 'lucide-react';

import clsx from 'clsx';
import LeagueRulesModal from './LeagueRulesModal';
import LeagueSwitcher from './LeagueSwitcher';
import DeadlineCountdown from './DeadlineCountdown';
import DocsModal from './DocsModal';
import { auth } from '../firebase';
import { useTheme } from '../hooks/useTheme';
import { onAuthStateChanged } from 'firebase/auth';
import UserAvatar from './UserAvatar';
import { haptics } from '../utils/haptics';

export default function Header({ role, title, subtitle, hideCountdown }: { role: string, title?: string | React.ReactNode, subtitle?: string | React.ReactNode, hideCountdown?: boolean }) {
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id';
    const members = useStore(state => state.members);
    const logout = useStore(state => state.logout);
    const realActiveUser = members.find(m => m.id === activeUserId)?.id || members[0]?.id || activeUserId;
    const { isStealthMode, toggleStealthMode } = useStore();
    const { notifications, markAllAsRead, markAsRead } = useNotifications();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const activeTabState = useState<'personal' | 'system'>('personal');
    const activeTab = activeTabState[0];
    const setActiveTab = activeTabState[1];
    const [notifView, setNotifView] = useState<'all' | 'payout' | 'security' | 'updates'>('all');
    const [showConstitution, setShowConstitution] = useState(false);
    const [showDocsModal, setShowDocsModal] = useState(false);
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 md:gap-0 mb-8 md:mb-10 w-full relative z-50">
            <div className={clsx('fc-header-stage w-full md:w-auto', headerMotion)}>
                <div className="flex items-center gap-3 md:gap-4 w-full">
                    <UserAvatar name={fullDisplayName} size="lg" />
                    <div className="min-w-0 flex-1">
                        <h1 className="fc-frosty-title text-xl sm:text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2 truncate">
                            {title || `${getGreeting()}, ${displayName}!`}
                        </h1>
                        <div className="flex items-center gap-2 mt-1 truncate">
                            {role === 'admin' ? (
                                <Shield className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#22c55e] flex-shrink-0" />
                            ) : (
                                <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#FBBF24] flex-shrink-0" />
                            )}
                            <span className="fc-metallic-badge text-xs md:text-sm tracking-widest uppercase truncate block">
                                {subtitle || (role === 'admin' ? 'Chairman Hub' : 'Member Hub')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0" ref={dropdownRef}>
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
                                    : 'text-gray-600 hover:text-gray-600 dark:text-gray-400'
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
                    className="fc-theme-toggle-mobile sm:hidden p-2.5 border rounded-xl text-gray-600 dark:text-gray-400 hover:text-white transition-all duration-300 ease-out active:scale-95"
                    title={`Theme: ${currentTheme} — tap to cycle`}
                >
                    {currentTheme === 'dark' ? <Moon className="w-5 h-5" /> : currentTheme === 'light' ? <Sun className="w-5 h-5 text-amber-300" /> : <span className="text-[9px] font-black text-emerald-400">OS</span>}
                </button>

                {/* Stealth Mode Toggle */}
                <button
                    onClick={toggleStealthMode}
                    className="fc-stealth-toggle p-2.5 md:p-3 border rounded-xl text-gray-600 dark:text-gray-400 hover:text-white transition-all duration-300 ease-out active:scale-95"
                    title={isStealthMode ? "Disable Stealth Mode" : "Enable Stealth Mode"}
                >
                    {isStealthMode ? <EyeOff className="w-5 h-5 md:w-6 md:h-6 text-[#10B981]" /> : <Eye className="w-5 h-5 md:w-6 md:h-6" />}
                </button>

                {/* Help & Docs */}
                <button
                    onClick={() => setShowDocsModal(true)}
                    className="p-2.5 md:p-3 border border-white/5 rounded-xl text-gray-600 dark:text-gray-400 hover:text-blue-400 hover:border-blue-500/20 transition-all duration-300 ease-out active:scale-95"
                    title="Help & Documentation"
                >
                    <HelpCircle className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                    <button
                        onClick={handleBellClick}
                        className={clsx(
                            "p-2.5 md:p-3 border border-white/5 rounded-xl text-gray-600 dark:text-gray-400 hover:text-white transition-all active:scale-95",
                            isDropdownOpen ? "bg-[#22c55e]/10 border-[#22c55e]/50 text-[#22c55e]" : "bg-[#161d24] hover:bg-white/5"
                        )}
                    >
                        <Bell className={clsx("w-5 h-5 md:w-6 md:h-6 transition-transform", (unreadPersonalCount + unreadSystemCount) > 0 && "fc-bell-shake text-amber-400")} />
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
                                <div className="fc-notif-header px-5 py-3.5 border-b border-white/5 flex justify-between items-center bg-black/30 backdrop-blur-md">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-400/90 mb-0.5">Alerts</p>
                                        <h3 className="font-bold text-sm tracking-wide text-white">Notifications</h3>
                                    </div>
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
                                                className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-400 hover:text-emerald-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                                                title="Mark all as read"
                                            >
                                                <CheckCheck className="w-3.5 h-3.5" />
                                                Mark all as read
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Tabs */}
                                <div className="fc-notif-tabs flex border-b border-white/5 bg-black/15 backdrop-blur-sm">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveTab('personal'); }}
                                        className={clsx(
                                            "fc-notif-tab flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-colors relative flex items-center justify-center gap-2",
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
                                            "fc-notif-tab flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-colors relative flex items-center justify-center gap-2",
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
                                <div className="fc-notif-chip-row px-3 py-2 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto bg-white/[0.02]">
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
                                                'fc-notif-chip px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-colors',
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
                                    className="fc-dropdown-scroll max-h-[380px] overflow-y-auto"
                                >
                                    <div className={clsx('fc-dropdown-scroll max-h-[380px] overflow-y-auto p-2 space-y-2 transition-all duration-300 ease-out', notifListMotion)}>
                                        {filteredNotifs.length > 0 ? filteredNotifs.map((notif) => {
                                            const isRead = notif.readBy?.includes(realActiveUser);
                                            const isFinancial = notif.type === 'transactionSuccess' || notif.isWinnerEvent;
                                            const isWarning = notif.type === 'warning';
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
                                                        "fc-notif-item p-3.5 rounded-2xl border transition-all group flex gap-3 cursor-pointer outline-none relative overflow-hidden",
                                                        isRead
                                                            ? "bg-white/[0.02] border-white/5 opacity-70 hover:opacity-100 hover:bg-white/[0.04]"
                                                            : isFinancial
                                                                ? "bg-gradient-to-r from-amber-500/10 via-[#161d24] to-[#161d24] border-amber-500/30 shadow-[0_4px_16px_rgba(245,158,11,0.08)]"
                                                                : isWarning
                                                                    ? "bg-gradient-to-r from-red-500/10 via-[#161d24] to-[#161d24] border-red-500/30 shadow-[0_4px_16px_rgba(239,68,68,0.08)]"
                                                                    : "bg-[#161d24] border-white/10 hover:border-emerald-500/30"
                                                    )}
                                                >
                                                    <div className="fc-notif-icon mt-1 flex-shrink-0">
                                                        {isFinancial ? (
                                                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                                                <Trophy className="w-4 h-4" />
                                                            </div>
                                                        ) : isWarning ? (
                                                            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                                                                <AlertTriangle className="w-4 h-4" />
                                                            </div>
                                                        ) : notif.type === 'info' ? (
                                                            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                                                <Info className="w-4 h-4" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <span className={clsx(
                                                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                                                isFinancial
                                                                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                                                    : isWarning
                                                                        ? "bg-red-500/15 border-red-500/30 text-red-300"
                                                                        : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                                            )}>
                                                                {isFinancial ? '🏆 Payout / Pot' : isWarning ? '⚠️ Deadline Alert' : 'ℹ️ Chama Sync'}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-mono">
                                                                {formatMessageTime(notif.timestamp)}
                                                            </span>
                                                        </div>
                                                        <p className={clsx(
                                                            "text-xs leading-relaxed font-medium",
                                                            isRead
                                                                ? "text-gray-300"
                                                                : isFinancial
                                                                    ? "text-amber-100 font-semibold"
                                                                    : isWarning
                                                                        ? "text-red-200 font-semibold"
                                                                        : "text-emerald-100"
                                                        )}>
                                                            {notif.message}
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
                                                            "mt-1 flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all",
                                                            isRead
                                                                ? "bg-slate-500/15 border-slate-400/30 text-slate-400 opacity-60"
                                                                : "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:scale-110"
                                                        )}
                                                    >
                                                        {isRead ? <CheckCheck className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            );
                                        }) : (
                                            <div className="fc-notif-empty p-10 text-center text-gray-500">
                                                <Bell className="w-8 h-8 mx-auto mb-3 opacity-30 text-emerald-400" />
                                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">All clear</p>
                                                <p className="text-[11px] text-gray-500 mt-1">No unread alerts in this category.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
                {!hideCountdown && <DeadlineCountdown />}
                <LeagueSwitcher />
                {/* Mobile Quick Sign Out */}
                <button
                    onClick={() => {
                        haptics.selection();
                        try { logout(); } catch {}
                        window.location.href = '/login';
                    }}
                    className="sm:hidden p-2.5 border border-white/5 rounded-xl text-gray-500 hover:text-red-400 hover:border-red-500/20 bg-[#161d24] transition-all active:scale-95 cursor-pointer"
                    title="Sign Out"
                    aria-label="Sign Out"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            {/* League Constitution Modal */}
            <LeagueRulesModal
                isOpen={showConstitution}
                onClose={() => setShowConstitution(false)}
                currentMember={members.find(m => m.id === activeUserId)}
            />

            {/* Docs Modal */}
            <DocsModal
                isOpen={showDocsModal}
                onClose={() => setShowDocsModal(false)}
            />
        </div>
    );
}
