import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useNotifications } from './NotificationProvider';
import { Bell, Eye, EyeOff, Shield, Trophy, CheckCircle2, AlertTriangle, Info, CheckCheck } from 'lucide-react';
import clsx from 'clsx';

export default function Header({ role, title, subtitle }: { role: string, title?: string | React.ReactNode, subtitle?: string | React.ReactNode }) {
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id';
    const members = useStore(state => state.members);
    const { isStealthMode, toggleStealthMode } = useStore();
    const { notifications, unreadCount, markAllAsRead } = useNotifications();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentMember = members.find(m => m.id === activeUserId) || members[0];
    const fullDisplayName = currentMember?.displayName || (role === 'admin' ? 'Chairman' : 'Manager');
    const displayName = fullDisplayName.split(' ')[0];
    const avatarSeed = (currentMember as any)?.avatarSeed || fullDisplayName;

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleBellClick = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleMarkAllRead = (e: React.MouseEvent) => {
        e.stopPropagation();
        markAllAsRead();
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

    return (
        <div className="flex justify-between items-center mb-8 md:mb-10 w-full relative z-50">
            <div>
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
                {/* Stealth Mode Toggle */}
                <button
                    onClick={toggleStealthMode}
                    className="p-2.5 md:p-3 bg-[#161d24] border border-white/5 rounded-xl text-gray-400 hover:text-white transition-all hover:bg-white/5 active:scale-95"
                    title={isStealthMode ? "Disable Stealth Mode" : "Enable Stealth Mode"}
                >
                    {isStealthMode ? <EyeOff className="w-5 h-5 md:w-6 md:h-6 text-[#10B981]" /> : <Eye className="w-5 h-5 md:w-6 md:h-6" />}
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
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 md:top-2.5 md:right-2.5 w-2.5 h-2.5 bg-[#FBBF24] rounded-full border-2 border-[#0b1014] animate-pulse" />
                        )}
                    </button>

                    {/* Dropdown */}
                    {isDropdownOpen && (
                        <>
                            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]" onClick={() => setIsDropdownOpen(false)} />
                            <div className="absolute right-0 mt-3 w-80 md:w-96 bg-[#0e1419]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-[100] animate-in slide-in-from-top-2 fade-in duration-200">
                                {/* Header row with Mark All Read */}
                                <div className="px-5 py-3.5 border-b border-white/5 flex justify-between items-center bg-black/20">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-sm">Operations Feed</h3>
                                        {unreadCount > 0 && (
                                            <span className="text-[10px] font-bold bg-[#FBBF24]/15 text-[#FBBF24] px-2 py-0.5 rounded-full border border-[#FBBF24]/20">
                                                {unreadCount} new
                                            </span>
                                        )}
                                    </div>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={handleMarkAllRead}
                                            className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-emerald-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                                            title="Mark all as read"
                                        >
                                            <CheckCheck className="w-3.5 h-3.5" />
                                            Mark all read
                                        </button>
                                    )}
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
                                    <div className="notif-scroll max-h-[380px] overflow-y-auto divide-y divide-white/[0.04]">
                                        {notifications.length > 0 ? notifications.map((notif) => {
                                            const isRead = notif.readBy?.includes(activeUserId);
                                            return (
                                                <div
                                                    key={notif.id}
                                                    className={clsx(
                                                        "p-4 transition-colors group flex gap-3",
                                                        isRead ? "opacity-50 hover:opacity-70" : "hover:bg-white/[0.04] bg-white/[0.02]"
                                                    )}
                                                >
                                                    <div className="mt-0.5 flex-shrink-0">
                                                        {notif.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
                                                        {notif.type === 'warning' && <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />}
                                                        {notif.type === 'info' && <Info className="w-4 h-4 text-[#60a5fa]" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={clsx(
                                                            "text-xs leading-relaxed",
                                                            notif.type === 'success' ? "text-emerald-300" :
                                                                notif.type === 'warning' ? "text-amber-300" : "text-blue-300"
                                                        )}>
                                                            {notif.message}
                                                        </p>
                                                        <p className="text-[10px] text-gray-600 mt-1 font-medium uppercase tracking-wider">
                                                            {formatMessageTime(notif.timestamp)}
                                                        </p>
                                                    </div>
                                                    {!isRead && (
                                                        <div className="w-2 h-2 bg-[#FBBF24] rounded-full flex-shrink-0 mt-1.5" />
                                                    )}
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
