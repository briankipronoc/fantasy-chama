import { Outlet, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { LayoutDashboard, BarChart3, AlertTriangle, Settings, LogOut, PanelLeftClose, PanelLeftOpen, Trophy } from 'lucide-react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import clsx from 'clsx';

export default function AppLayout() {
    const role = useStore((state) => state.role);
    const logout = useStore((state) => state.logout);
    const members = useStore((state) => state.members);
    const location = useLocation();
    const navigate = useNavigate();
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => localStorage.getItem('fc-sidebar-collapsed') === '1');
    const [routeTransitionClass, setRouteTransitionClass] = useState('');
    const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
    const [financeBadgePulse, setFinanceBadgePulse] = useState(false);
    const [coChairMemberId, setCoChairMemberId] = useState<string | null>(null);
    const previousFinanceBadgeCountRef = useRef(0);
    const activeUserId = localStorage.getItem('activeUserId');

    if (!role) {
        return <Navigate to="/login" replace />;
    }

    useEffect(() => {
        localStorage.setItem('fc-sidebar-collapsed', isSidebarCollapsed ? '1' : '0');
    }, [isSidebarCollapsed]);

    useEffect(() => {
        setRouteTransitionClass('fc-route-enter');
        const timer = window.setTimeout(() => setRouteTransitionClass(''), 240);
        return () => window.clearTimeout(timer);
    }, [location.pathname]);

    useEffect(() => {
        if (!activeLeagueId || role !== 'admin') {
            setPendingApprovalCount(0);
            return;
        }

        const payoutsRef = collection(db, 'leagues', activeLeagueId, 'pending_payouts');
        const pendingQ = query(payoutsRef, where('status', '==', 'awaiting_approval'));
        const unsub = onSnapshot(pendingQ, (snap) => {
            setPendingApprovalCount(snap.docs.length);
        }, () => {
            setPendingApprovalCount(0);
        });

        return () => {
            try { unsub(); } catch { /* noop */ }
        };
    }, [activeLeagueId, role]);

    useEffect(() => {
        if (!activeLeagueId || role !== 'admin') {
            setCoChairMemberId(null);
            return;
        }

        const leagueRef = doc(db, 'leagues', activeLeagueId);
        const unsub = onSnapshot(leagueRef, (snap) => {
            if (!snap.exists()) {
                setCoChairMemberId(null);
                return;
            }
            const data = snap.data() as { coAdminId?: string };
            setCoChairMemberId(data.coAdminId || null);
        }, () => {
            setCoChairMemberId(null);
        });

        return () => {
            try { unsub(); } catch { /* noop */ }
        };
    }, [activeLeagueId, role]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            if (typing) return;

            if (event.key === '[') {
                setIsSidebarCollapsed(true);
            }
            if (event.key === ']') {
                setIsSidebarCollapsed(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);


    // Navigation Items
    const redZoneCount = members.filter((m) => m.role !== 'admin' && m.isActive !== false && !m.hasPaid).length;
    const adminFinanceBadge = redZoneCount + pendingApprovalCount;

    const adminNavItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'League Table', path: '/standings', icon: BarChart3 },
        { name: 'Red Zone & Finances', path: '/finances', icon: AlertTriangle, badge: adminFinanceBadge > 0 ? adminFinanceBadge : undefined },
        { name: 'Settings & Profile', path: '/profile', icon: Settings },
    ];

    const memberNavItems = [
        { name: 'War Room', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Standings', path: '/standings', icon: BarChart3 },
        { name: 'Finances & Payouts', path: '/finances', icon: AlertTriangle, badge: redZoneCount > 0 ? redZoneCount : undefined },
        { name: 'My Profile', path: '/profile', icon: Settings },
    ];

    const navItems = useMemo(() => role === 'admin' ? adminNavItems : memberNavItems, [role, redZoneCount, adminFinanceBadge]);
    const headerTitle = role === 'admin'
        ? (coChairMemberId && activeUserId === coChairMemberId ? 'Co-Chair Hub' : 'Chairman Hub')
        : 'Members Hub';

    useEffect(() => {
        const currentFinanceBadge = role === 'admin' ? adminFinanceBadge : redZoneCount;
        if (currentFinanceBadge > previousFinanceBadgeCountRef.current) {
            setFinanceBadgePulse(true);
            const pulseTimer = window.setTimeout(() => setFinanceBadgePulse(false), 1200);
            previousFinanceBadgeCountRef.current = currentFinanceBadge;
            return () => window.clearTimeout(pulseTimer);
        }
        previousFinanceBadgeCountRef.current = currentFinanceBadge;
    }, [role, adminFinanceBadge, redZoneCount]);

    const handleLogout = () => {
        try {
            logout();
        } finally {
            navigate('/login', { replace: true });
        }
    };

    return (
        <div className="flex xl:h-screen w-full bg-[#111613] text-white font-sans relative overflow-hidden">
            {/* Desktop Sidebar (Unified) */}
            <nav className={clsx(
                'bg-[#0a100a] hidden lg:flex flex-shrink-0 z-10 relative p-4 xl:p-5 transition-[width] duration-300 ease-out',
                isSidebarCollapsed ? 'w-24' : 'w-72'
            )}>
                <div className="fc-sidebar-shell w-full h-full rounded-3xl border border-white/10 bg-[#0b1014]/85 backdrop-blur-xl p-5 flex flex-col relative overflow-hidden">
                    <div className="fc-sidebar-glow absolute -top-24 -right-20 w-56 h-56 rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none" />

                    <div className={clsx('mb-7 relative z-10 text-center')}>
                        <div className={clsx('mb-3 flex items-center', isSidebarCollapsed ? 'justify-center' : 'justify-between')}>
                            <button
                                onClick={() => setIsSidebarCollapsed(prev => !prev)}
                                className={clsx(
                                    'rounded-xl border border-white/12 bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors inline-flex items-center justify-center',
                                    isSidebarCollapsed ? 'h-11 w-11' : 'h-9 w-9'
                                )}
                                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            >
                                {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                            </button>
                        </div>

                        {!isSidebarCollapsed && (
                            <>
                                <div className="fc-sidebar-brand inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 mb-3">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-400/30">
                                        <Trophy className="w-3.5 h-3.5 text-emerald-300" />
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Fantasy Chama</span>
                                </div>
                                <h2 className="text-2xl font-black tracking-tight text-white mb-1.5">{headerTitle}</h2>
                                <p className="text-[10px] font-bold text-[#22c55e] tracking-widest uppercase">
                                    {role === 'admin' ? 'TRANSPARENCY PORTAL' : 'SECURE WEALTH CIRCLE'}
                                </p>
                            </>
                        )}
                        {isSidebarCollapsed && (
                            <div className="pt-2 flex flex-col items-center gap-2">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-emerald-400/30 bg-emerald-500/12">
                                    <Trophy className="w-4.5 h-4.5 text-emerald-400" />
                                </span>
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">FC</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col space-y-2 flex-1 relative z-10">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/');
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={clsx(
                                        'fc-sidebar-link group flex items-center w-full py-2.5 rounded-xl transition-all font-bold text-sm border relative',
                                        isSidebarCollapsed ? 'fc-sidebar-link-collapsed px-0 justify-center' : 'px-3',
                                        isActive && !isSidebarCollapsed
                                            ? 'fc-sidebar-link-active text-[#d1fae5] border-emerald-500/35 bg-emerald-500/15 shadow-[0_0_16px_rgba(34,197,94,0.12)]'
                                            : isActive && isSidebarCollapsed
                                                ? 'text-emerald-300 border-transparent bg-transparent shadow-none'
                                                : 'text-gray-400 hover:text-white border-transparent hover:bg-white/5'
                                    )}
                                    title={isSidebarCollapsed ? item.name : undefined}
                                >
                                    <span className={clsx(
                                        'inline-flex items-center justify-center rounded-xl transition-colors shrink-0',
                                        isSidebarCollapsed
                                            ? (isActive
                                                ? 'h-11 w-11 border border-emerald-500/40 bg-emerald-500/18 text-emerald-300'
                                                : 'h-11 w-11 border border-white/12 bg-white/[0.02] text-gray-500 group-hover:text-white group-hover:bg-white/[0.05]')
                                            : 'h-8 w-8 border',
                                        !isSidebarCollapsed && isActive ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : '',
                                        !isSidebarCollapsed && !isActive ? 'bg-white/[0.02] border-white/10 text-gray-500 group-hover:text-white' : ''
                                    )}>
                                        <Icon className={clsx(isSidebarCollapsed ? 'h-5.5 w-5.5' : 'h-4.5 w-4.5')} />
                                    </span>
                                    {!isSidebarCollapsed && <span className="tracking-wide text-center flex-1 ml-3">{item.name}</span>}
                                    {!isSidebarCollapsed && typeof item.badge === 'number' && item.badge > 0 && (
                                        <span className={clsx(
                                            'ml-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30',
                                            item.path === '/finances' && financeBadgePulse && 'fc-badge-pulse'
                                        )}>
                                            {item.badge > 99 ? '99+' : item.badge}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Bottom Sign Out */}
                    <div className="mt-auto pt-4 border-t border-white/10 relative z-10">
                        <button
                            onClick={handleLogout}
                            className={clsx(
                                'fc-sidebar-logout w-full rounded-xl transition-all font-bold text-sm border border-red-500/35 bg-[#EF4444]/15 text-red-300 hover:bg-red-500/25',
                                isSidebarCollapsed ? 'h-12 flex items-center justify-center px-0' : 'flex items-center px-2 py-2.5'
                            )}
                            title={isSidebarCollapsed ? 'Sign Out' : undefined}
                        >
                            <span className={clsx(
                                'fc-sidebar-logout-icon inline-flex items-center justify-center rounded-lg',
                                isSidebarCollapsed ? 'h-10 w-10 border border-red-500/35 bg-red-500/20' : 'h-8 w-8 border border-red-500/35 bg-red-500/20'
                            )}>
                                <LogOut className="h-4.5 w-4.5" />
                            </span>
                            {!isSidebarCollapsed && <span className="ml-3 text-center flex-1">Sign Out</span>}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 w-full bg-[#0A0E17] relative overflow-hidden flex flex-col h-screen">
                <div className={clsx('fc-route-stage flex-1 overflow-y-auto pb-24 lg:pb-0 scroll-smooth', routeTransitionClass)}>
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="fc-mobile-dock fixed bottom-0 left-0 right-0 border-t border-white/5 bg-[#0a100a]/90 backdrop-blur-xl flex lg:hidden items-center justify-around p-2.5 z-[100] pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all flex-1 basis-0 max-w-[82px]",
                                isActive ? 'text-[#22c55e] bg-[#22c55e]/12 shadow-[0_0_12px_rgba(34,197,94,0.12)]' : 'text-gray-500 hover:text-white active:scale-95'
                            )}
                        >
                            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                            <span className="text-[9px] sm:text-[10px] font-bold text-center leading-tight truncate w-full">{item.name}</span>
                        </Link>
                    );
                })}
                <button
                    onClick={handleLogout}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all flex-1 basis-0 max-w-[80px] bg-[#EF4444] text-white hover:bg-red-600 active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                    <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-[9px] sm:text-[10px] font-bold text-center leading-tight truncate w-full">Sign Out</span>
                </button>
            </nav>
        </div>
    );
}
