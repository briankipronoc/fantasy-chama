import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useNotifications } from './NotificationProvider';
import { Bell, Eye, EyeOff, Shield, Trophy, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import clsx from 'clsx';

export default function Header({ role, title, subtitle }: { role: string, title?: string | React.ReactNode, subtitle?: string | React.ReactNode }) {
    const activeUserId = localStorage.getItem('activeUserId') || 'current-user-fallback-id';
    const members = useStore(state => state.members);
    const { isStealthMode, toggleStealthMode } = useStore();
    const { notifications, unreadCount, markAsRead } = useNotifications();
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
        if (!isDropdownOpen && unreadCount > 0) {
            markAsRead();
        }
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
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight">{title || `${getGreeting()}, ${displayName}!`}</h1>
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
                            <span className="absolute top-2 right-2 md:top-2.5 md:right-2.5 w-2.5 h-2.5 bg-[#FBBF24] rounded-full border-2 border-[#0b1014] animate-pulse"></span>
                        )}
                    </button>

                    {/* Dropdown Overlay */}
                    {isDropdownOpen && (
                        <>
                            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]" onClick={() => setIsDropdownOpen(false)}></div>
                            <div className="absolute right-0 mt-3 w-80 md:w-96 bg-[#161d24]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-top-2 fade-in duration-200">
                                <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                                    <h3 className="font-bold text-sm">Operations Feed</h3>
                                    <span className="text-xs font-semibold bg-white/10 px-2 py-1 rounded-md text-gray-300">{notifications.length} Alerts</span>
                                </div>
                                <div className="max-h-[350px] overflow-y-auto">
                                    {notifications.length > 0 ? (
                                        <div className="divide-y divide-white/5">
                                            {notifications.map((notif) => (
                                                <div key={notif.id} className="p-4 hover:bg-white/5 transition-colors group flex gap-3">
                                                    <div className="mt-1 flex-shrink-0">
                                                        {notif.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#10B981]" />}
                                                        {notif.type === 'warning' && <AlertTriangle className="w-5 h-5 text-[#EF4444]" />}
                                                        {notif.type === 'info' && <Info className="w-5 h-5 text-[#FBBF24]" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={clsx("text-sm leading-snug",
                                                            notif.type === 'success' ? "text-[#10B981]" :
                                                                notif.type === 'warning' ? "text-[#EF4444]" : "text-[#FBBF24]"
                                                        )}>
                                                            {notif.message}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500 mt-1.5 font-medium uppercase tracking-wider">
                                                            {formatMessageTime(notif.timestamp)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-gray-500">
                                            <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm font-medium">No alerts right now.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
