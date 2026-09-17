import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useNotifications } from './NotificationProvider';
import { Bell, Eye, EyeOff, Shield, Trophy, CheckCircle2, AlertTriangle, Info, CheckCheck, Sun, Moon, Laptop, LogOut } from 'lucide-react';

import clsx from 'clsx';
import LeagueRulesModal from './LeagueRulesModal';
import DeadlineCountdown from './DeadlineCountdown';
import LeagueSwitcher from './LeagueSwitcher';
import { useTheme } from '../hooks/useTheme';
import UserAvatar from './UserAvatar';
import { haptics } from '../utils/haptics';

export default function Header({ role, title, subtitle, hideCountdown, hideExtraControls }: { role: string, title?: string | React.ReactNode, subtitle?: string | React.ReactNode, hideCountdown?: boolean, hideExtraControls?: boolean }) {
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id';
    const shouldHideExtraControls = Boolean(hideExtraControls || role === 'member' || subtitle === 'Member Hub');
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
    const [notifListMotion, setNotifListMotion] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const { theme: currentTheme, setTheme } = useTheme();
    const [headerMotion, setHeaderMotion] = useState('');

    const currentMember = members.find(m => m.id === realActiveUser) || members.find(m => m.id === activeUserId) || null;

    // Unsolicited auto-popup removed — constitution is accessible on-demand or on designated first-login

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

    const handleNotificationClick = async (notifOrId: any, isRead: boolean) => {
        if (isRead) return;
        if (typeof notifOrId === 'object' && Array.isArray(notifOrId.allIds)) {
            await Promise.all(notifOrId.allIds.map((id: string) => markAsRead(id)));
        } else if (typeof notifOrId === 'string') {
            await markAsRead(notifOrId);
        }
    };

    const notificationCategory = (notif: any): 'payout' | 'security' | 'updates' => {
        const msg = String(notif?.message || '').toLowerCase();
        if (msg.includes('payout') || msg.includes('winner') || msg.includes('gw') || msg.includes('autopilot')) return 'payout';
        if (notif?.type === 'warning' || msg.includes('security') || msg.includes('nudge') || msg.includes('red zone') || msg.includes('approval')) return 'security';
        return 'updates';
    };

    const handleMarkVisibleAsRead = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const allTargetIds: string[] = [];
        filteredNotifs.forEach((n: any) => {
            if (n.allIds && Array.isArray(n.allIds)) {
                allTargetIds.push(...n.allIds);
            } else if (!n.readBy?.includes(realActiveUser)) {
                allTargetIds.push(n.id);
            }
        });
        await Promise.all(Array.from(new Set(allTargetIds)).map(id => markAsRead(id)));
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
    const rawFilteredNotifs = displayNotifs.filter((notif) => notifView === 'all' ? true : notificationCategory(notif) === notifView);

    // Smart notification grouping: combine props, repetitive sync notifications, and member join events into clean, aggregated items
    const filteredNotifs = useMemo(() => {
        const groupedMap = new Map<string, any>();
        const result: any[] = [];

        for (const notif of rawFilteredNotifs) {
            const msg = String(notif?.message || '');
            const eventType = (notif as any)?.eventType || notif?.type;

            // 1. Group member join / onboarding notifications
            const isJoinNotif = eventType === 'member_joined' 
                || (notif as any)?.title === 'New Member Self-Onboarded' 
                || msg.includes('joined') && (msg.includes('Contributor') || msg.includes('Vault Only') || msg.includes('Spectator') || msg.includes('League'));
            
            if (isJoinNotif) {
                const joinMatch = msg.match(/^(.+?)\s+joined\s+(.+?)(?:\s+\((.+?)\))?\./i);
                const memberName = joinMatch ? joinMatch[1].trim() : (msg.split(' joined')[0] || 'A manager');
                const groupKey = 'group_members_joined';

                if (groupedMap.has(groupKey)) {
                    const existing = groupedMap.get(groupKey);
                    if (!existing.members.includes(memberName)) {
                        existing.members.push(memberName);
                    }
                    existing.allIds.push(notif.id);
                    existing.count += 1;
                    if (!notif.readBy?.includes(realActiveUser)) {
                        existing.isUnread = true;
                    }
                } else {
                    const groupItem = {
                        ...notif,
                        isGroup: true,
                        groupType: 'join',
                        count: 1,
                        members: [memberName],
                        allIds: [notif.id],
                        isUnread: !notif.readBy?.includes(realActiveUser),
                        originalMessage: msg
                    };
                    groupedMap.set(groupKey, groupItem);
                    result.push(groupItem);
                }
                continue;
            }

            // 2. Group "sent <emoji> props to <Name> for GW<X>" cheers
            const propsMatch = msg.match(/^(.+?)\s+sent\s+(.+?)\s+props\s+to\s+(.+?)\s+for\s+(GW\d+)/i);
            if (propsMatch) {
                const [, sender, emoji, recipient, gw] = propsMatch;
                const groupKey = `props_${recipient.trim().toLowerCase()}_${gw.trim().toLowerCase()}`;
                
                if (groupedMap.has(groupKey)) {
                    const existing = groupedMap.get(groupKey);
                    if (!existing.senders.includes(sender)) {
                        existing.senders.push(sender);
                    }
                    if (!existing.emojis.includes(emoji)) {
                        existing.emojis.push(emoji);
                    }
                    existing.allIds.push(notif.id);
                    existing.count += 1;
                    // If any in group is unread, group counts as unread
                    if (!notif.readBy?.includes(realActiveUser)) {
                        existing.isUnread = true;
                    }
                } else {
                    const groupItem = {
                        ...notif,
                        isGroup: true,
                        groupType: 'props',
                        count: 1,
                        senders: [sender],
                        emojis: [emoji],
                        recipient,
                        gw,
                        allIds: [notif.id],
                        isUnread: !notif.readBy?.includes(realActiveUser),
                        originalMessage: msg
                    };
                    groupedMap.set(groupKey, groupItem);
                    result.push(groupItem);
                }
                continue;
            }

            // Standalone notifications
            result.push({
                ...notif,
                allIds: [notif.id],
                isUnread: !notif.readBy?.includes(realActiveUser)
            });
        }

        // Format grouped messages for clean digestion
        return result.map(item => {
            if (item.isGroup && item.count > 1) {
                if (item.groupType === 'join') {
                    const membersList = item.members.length === 2
                        ? `${item.members[0]} and ${item.members[1]}`
                        : item.members.length > 2
                            ? `${item.members[0]}, ${item.members[1]} +${item.members.length - 2} other managers`
                            : item.members[0];
                    return {
                        ...item,
                        message: `🎉 ${membersList} self-onboarded to the league! (${item.count} new managers)`
                    };
                }

                if (item.groupType === 'props') {
                    const sendersText = item.senders.length === 2 
                        ? `${item.senders[0]} and ${item.senders[1]}`
                        : item.senders.length > 2 
                            ? `${item.senders[0]}, ${item.senders[1]} +${item.senders.length - 2} others`
                            : item.senders[0];
                    const emojisJoined = item.emojis.join(' ');
                    return {
                        ...item,
                        message: `${sendersText} sent ${emojisJoined} props to ${item.recipient} for ${item.gw}! (${item.count} cheers)`
                    };
                }
            }
            return item;
        });
    }, [rawFilteredNotifs, realActiveUser]);

    const unreadFilteredCount = filteredNotifs.filter((n: any) => n.isUnread).length;
    const unreadPersonalCount = personalNotifs.filter(n => !n.readBy?.includes(realActiveUser)).length;
    const unreadSystemCount = systemNotifs.filter(n => !n.readBy?.includes(realActiveUser)).length;

    return (
        <div className="flex flex-col gap-2.5 mb-5 md:mb-7 w-full relative z-50">
            {/* Row 1: League Title/Hub on the left, League Switcher directly to the right */}
            <div className="flex items-center justify-between gap-3 w-full">
                <div className={clsx('fc-header-stage flex items-center gap-3 md:gap-4 min-w-0 flex-1', headerMotion)}>
                    <UserAvatar name={fullDisplayName} size="lg" />
                    <div className="min-w-0 flex-1">
                        <h1 className="fc-frosty-title text-lg sm:text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2 truncate text-slate-900 dark:text-white">
                            {title || `${getGreeting()}, ${displayName}!`}
                        </h1>
                        <div className="flex items-center gap-2 mt-1 truncate">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-white/[0.04] backdrop-blur-md shadow-sm">
                                {role === 'admin' ? (
                                    <Shield className="w-3 h-3 text-[#22c55e] shrink-0" />
                                ) : (
                                    <Trophy className="w-3 h-3 text-[#FBBF24] shrink-0" />
                                )}
                                <span className="fc-metallic-badge text-[10px] md:text-xs tracking-widest uppercase truncate font-bold text-slate-700 dark:text-gray-300">
                                    {subtitle || (role === 'admin' ? 'Chairman Hub' : 'Member Hub')}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* League Switcher & Notifications Bell directly to the right of the League Title */}
                <div className="shrink-0 flex items-center gap-2">
                    <LeagueSwitcher variant="header" />
                    {shouldHideExtraControls && (
                        <div className="relative">
                            <button
                                onClick={handleBellClick}
                                className={clsx(
                                    "p-2 sm:p-2.5 border rounded-xl transition-all active:scale-95 cursor-pointer",
                                    isDropdownOpen
                                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                                        : "bg-slate-100/80 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                )}
                            >
                                <Bell className={clsx("w-4 h-4 sm:w-5 sm:h-5 transition-transform", (unreadPersonalCount + unreadSystemCount) > 0 && "fc-bell-shake text-amber-500 dark:text-amber-400")} />
                                {(unreadPersonalCount + unreadSystemCount) > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-amber-500 rounded-full border-2 border-white dark:border-[#0b1014] flex items-center justify-center animate-pulse">
                                        <span className="text-[9px] font-black text-black tabular-nums leading-none">{unreadPersonalCount + unreadSystemCount > 9 ? '9+' : unreadPersonalCount + unreadSystemCount}</span>
                                    </span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Row 2: Action Icons neatly right-aligned below the League Switcher (Admins only) */}
            {!shouldHideExtraControls && (
                <div className="flex flex-wrap items-center justify-end gap-2 md:gap-2.5 w-full" ref={dropdownRef}>

                    {/* Theme Toggle — 3-way pill: Dark | OS / System | Light */}
                    <div className="fc-theme-toggle-shell flex items-center rounded-xl p-0.5 gap-0.5 bg-slate-100/90 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 shadow-sm">
                        {(['dark', 'system', 'light'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setTheme(mode)}
                                className={`fc-theme-toggle-btn flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    currentTheme === mode
                                        ? mode === 'dark' 
                                            ? 'bg-slate-800 text-white shadow-sm'
                                            : mode === 'light' 
                                                ? 'bg-amber-400/25 text-amber-700 dark:text-amber-300 shadow-sm'
                                                : 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'
                                }`}
                                title={mode === 'dark' ? 'Dark theme' : mode === 'light' ? 'Light theme' : 'Default system settings'}
                                aria-label={`Set theme to ${mode}`}
                            >
                                {mode === 'dark' ? (
                                    <Moon className="w-3 h-3 text-indigo-400" />
                                ) : mode === 'light' ? (
                                    <Sun className="w-3 h-3 text-amber-500" />
                                ) : (
                                    <Laptop className="w-3 h-3 text-emerald-500" />
                                )}
                                <span className="text-[9px] sm:text-[10px] font-bold tracking-tight">{mode === 'system' ? 'OS' : mode}</span>
                            </button>
                        ))}
                    </div>

                    {/* Stealth Mode Toggle */}
                    <button
                        onClick={toggleStealthMode}
                        className="fc-stealth-toggle p-2 sm:p-2.5 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95"
                        title={isStealthMode ? "Disable Stealth Mode" : "Enable Stealth Mode"}
                    >
                        {isStealthMode ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>

                    {/* Notifications Bell */}
                    <div className="relative">
                        <button
                            onClick={handleBellClick}
                            className={clsx(
                                "p-2 sm:p-2.5 border rounded-xl transition-all active:scale-95",
                                isDropdownOpen
                                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                                    : "bg-slate-100/80 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <Bell className={clsx("w-4 h-4 sm:w-5 sm:h-5 transition-transform", (unreadPersonalCount + unreadSystemCount) > 0 && "fc-bell-shake text-amber-500 dark:text-amber-400")} />
                            {(unreadPersonalCount + unreadSystemCount) > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-amber-500 rounded-full border-2 border-white dark:border-[#0b1014] flex items-center justify-center animate-pulse">
                                    <span className="text-[9px] font-black text-black tabular-nums leading-none">{unreadPersonalCount + unreadSystemCount > 9 ? '9+' : unreadPersonalCount + unreadSystemCount}</span>
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Mobile Quick Sign Out */}
                    <button
                        onClick={async () => {
                            haptics.selection();
                            try { await logout(); } catch {}
                            window.location.replace('/login');
                        }}
                        className="sm:hidden p-2.5 border border-white/5 rounded-xl text-gray-500 hover:text-red-400 hover:border-red-500/20 bg-[#161d24] transition-all active:scale-95 cursor-pointer"
                        title="Sign Out"
                        aria-label="Sign Out"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Dropdown */}
            {isDropdownOpen && typeof document !== 'undefined' && createPortal(
                <div className="fc-notif-backdrop-wrap fixed inset-0 z-[120]">
                    <div
                        className="fc-notif-backdrop absolute inset-y-0 right-0 bg-black/22 backdrop-blur-xl"
                        style={{ left: 'var(--fc-sidebar-width, 0px)' }}
                        onClick={() => setIsDropdownOpen(false)}
                    />
                            <div className="fc-notif-panel absolute top-3 right-3 md:top-4 md:right-4 w-[min(92vw,28rem)] bg-white/95 dark:bg-[#0e1419]/95 border border-slate-200 dark:border-white/10 rounded-[1.5rem] shadow-[0_24px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.32)] overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-top-3 duration-300 origin-top-right fc-notif-dropdown fc-card">
                                {/* Header row with Mark All Read */}
                                <div className="fc-notif-header px-5 py-3.5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/80 dark:bg-black/30 backdrop-blur-md">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400 mb-0.5">Alerts</p>
                                        <h3 className="font-bold text-sm tracking-wide text-slate-900 dark:text-white">Notifications</h3>
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
                                <div className="fc-notif-tabs flex border-b border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-black/15 backdrop-blur-sm">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveTab('personal'); }}
                                        className={clsx(
                                            "fc-notif-tab flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-colors relative flex items-center justify-center gap-2",
                                            activeTab === 'personal' ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
                                        )}
                                    >
                                        Personal
                                        {unreadPersonalCount > 0 && (
                                            <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md text-[10px] leading-none">
                                                {unreadPersonalCount}
                                            </span>
                                        )}
                                        {activeTab === 'personal' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveTab('system'); }}
                                        className={clsx(
                                            "fc-notif-tab flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-colors relative flex items-center justify-center gap-2",
                                            activeTab === 'system' ? "text-blue-600 dark:text-blue-400 font-black" : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
                                        )}
                                    >
                                        System
                                        {unreadSystemCount > 0 && (
                                            <span className="bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md text-[10px] leading-none">
                                                {unreadSystemCount}
                                            </span>
                                        )}
                                        {activeTab === 'system' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                                        )}
                                    </button>
                                </div>
                                {/* Notification Category Chips */}
                                <div className="fc-notif-chip-row px-3 py-2 border-b border-slate-200 dark:border-white/5 flex items-center gap-1.5 overflow-x-auto bg-slate-50/50 dark:bg-white/[0.02]">
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
                                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-slate-100 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
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
                                        {filteredNotifs.length > 0 ? filteredNotifs.map((notif: any) => {
                                            const isRead = notif.readBy?.includes(realActiveUser);
                                            const isFinancial = notif.type === 'transactionSuccess' || notif.isWinnerEvent;
                                            const isWarning = notif.type === 'warning';
                                            return (
                                                <div
                                                    key={notif.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => handleNotificationClick(notif, isRead)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            handleNotificationClick(notif, isRead);
                                                        }
                                                    }}
                                                    className={clsx(
                                                        "fc-notif-item p-3.5 rounded-2xl border transition-all group flex gap-3 cursor-pointer outline-none relative overflow-hidden",
                                                        isRead
                                                            ? "bg-slate-100/70 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 opacity-80 hover:opacity-100 hover:bg-slate-200/60 dark:hover:bg-white/[0.04]"
                                                            : isFinancial
                                                                ? "bg-amber-50/90 dark:bg-gradient-to-r dark:from-amber-500/10 dark:via-[#161d24] dark:to-[#161d24] border-amber-300 dark:border-amber-500/30 shadow-[0_4px_16px_rgba(245,158,11,0.08)]"
                                                                : isWarning
                                                                    ? "bg-red-50/90 dark:bg-gradient-to-r dark:from-red-500/10 dark:via-[#161d24] dark:to-[#161d24] border-red-300 dark:border-red-500/30 shadow-[0_4px_16px_rgba(239,68,68,0.08)]"
                                                                    : "bg-emerald-50/90 dark:bg-[#161d24] border-emerald-300 dark:border-white/10 hover:border-emerald-500/40"
                                                    )}
                                                >
                                                    <div className="fc-notif-icon mt-1 flex-shrink-0">
                                                        {isFinancial ? (
                                                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
                                                                <Trophy className="w-4 h-4" />
                                                            </div>
                                                        ) : isWarning ? (
                                                            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-500 dark:text-red-400">
                                                                <AlertTriangle className="w-4 h-4" />
                                                            </div>
                                                        ) : notif.type === 'info' ? (
                                                            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500 dark:text-blue-400">
                                                                <Info className="w-4 h-4" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <span className={clsx(
                                                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                                                isFinancial
                                                                    ? "bg-amber-100 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
                                                                    : isWarning
                                                                        ? "bg-red-100 dark:bg-red-500/15 border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-300"
                                                                        : "bg-emerald-100 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                                            )}>
                                                                {isFinancial ? '🏆 Payout / Pot' : isWarning ? '⚠️ Deadline Alert' : 'ℹ️ Chama Sync'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                                                                {formatMessageTime(notif.timestamp)}
                                                            </span>
                                                        </div>
                                                        <p className={clsx(
                                                            "text-xs leading-relaxed font-medium break-words overflow-hidden [overflow-wrap:anywhere] [word-break:break-word]",
                                                            isRead
                                                                ? "text-slate-600 dark:text-gray-300"
                                                                : isFinancial
                                                                    ? "text-amber-950 dark:text-amber-100 font-semibold"
                                                                    : isWarning
                                                                        ? "text-red-950 dark:text-red-200 font-semibold"
                                                                        : "text-emerald-950 dark:text-emerald-100 font-semibold"
                                                        )} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                                            {notif.message}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-label={isRead ? 'Already read' : 'Mark notification as read'}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleNotificationClick(notif, isRead);
                                                        }}
                                                        className={clsx(
                                                            "mt-1 flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all",
                                                            isRead
                                                                ? "bg-slate-200/60 dark:bg-slate-500/15 border-slate-300 dark:border-slate-400/30 text-slate-500 dark:text-slate-400 opacity-70"
                                                                : "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-300 hover:scale-110"
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

            {/* GW Deadline Timer positioned neatly under action icons */}
            {!hideCountdown && (
                <div className="flex items-center justify-end w-full">
                    <DeadlineCountdown />
                </div>
            )}

            {/* League Constitution Modal */}
            <LeagueRulesModal
                isOpen={showConstitution}
                onClose={() => setShowConstitution(false)}
                currentMember={currentMember}
            />
        </div>
    );
}
