import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { LayoutDashboard, BarChart3, AlertTriangle, Settings, LogOut, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

export default function AppLayout() {
    const role = useStore((state) => state.role);
    const logout = useStore((state) => state.logout);
    const location = useLocation();

    if (!role) {
        return <Navigate to="/login" replace />;
    }

    // Navigation Items
    const adminNavItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'League Table', path: '/standings', icon: BarChart3 },
        { name: 'Red Zone & Finances', path: '/finances', icon: AlertTriangle },
        { name: 'Settings & Profile', path: '/profile', icon: Settings },
        { name: 'League Rules', path: '/terms', icon: ShieldCheck },
    ];

    const memberNavItems = [
        { name: 'War Room', path: '/', icon: LayoutDashboard },
        { name: 'Standings', path: '/standings', icon: BarChart3 },
        { name: 'Finances & Payouts', path: '/finances', icon: AlertTriangle },
        { name: 'My Profile', path: '/profile', icon: Settings },
        { name: 'League Rules', path: '/terms', icon: ShieldCheck },
    ];

    const navItems = role === 'admin' ? adminNavItems : memberNavItems;
    const headerTitle = role === 'admin' ? 'Chairman Hub' : 'Member Hub';

    return (
        <div className="flex xl:h-screen w-full bg-[#111613] text-white font-sans relative overflow-hidden">
            {/* Desktop Sidebar (Unified) */}
            <nav className="w-64 xl:w-72 border-r border-white/5 bg-[#0a100a] flex-col p-6 hidden lg:flex flex-shrink-0 z-10 relative">
                <div className="mb-10">
                    <h2 className="text-2xl font-black tracking-tight text-white mb-1.5">{headerTitle}</h2>
                    <p className="text-[10px] font-bold text-[#22c55e] tracking-widest uppercase">
                        {role === 'admin' ? 'TRANSPARENCY PORTAL' : 'SECURE WEALTH CIRCLE'}
                    </p>
                </div>

                <div className="flex flex-col space-y-2 flex-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/');
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    'flex items-center gap-4 w-full px-4 py-3.5 rounded-xl transition-all font-bold text-sm border',
                                    isActive
                                        ? 'bg-[#22c55e] text-[#0a100a] border-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent'
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Bottom Sign Out */}
                <div className="mt-auto">
                    <button
                        onClick={logout}
                        className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl transition-all font-bold text-sm bg-[#EF4444] text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                    >
                        <LogOut className="h-5 w-5" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 w-full bg-[#111613] relative overflow-hidden flex flex-col h-screen">
                <div className="flex-1 overflow-y-auto pb-24 lg:pb-0 scroll-smooth">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Native Bottom Nav (Only visible on small/medium screens) */}
            <nav className="fixed bottom-0 left-0 right-0 border-t border-white/5 bg-[#0a100a]/90 backdrop-blur-xl flex lg:hidden items-center justify-around p-2.5 z-[100] pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/');
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all flex-1 basis-0 max-w-[80px]",
                                isActive ? 'text-[#22c55e] bg-[#22c55e]/10' : 'text-gray-500 hover:text-white active:scale-95'
                            )}
                        >
                            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                            <span className="text-[9px] sm:text-[10px] font-bold text-center leading-tight truncate w-full">{item.name}</span>
                        </Link>
                    );
                })}
                <button
                    onClick={logout}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all flex-1 basis-0 max-w-[80px] bg-[#EF4444] text-white hover:bg-red-600 active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                    <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-[9px] sm:text-[10px] font-bold text-center leading-tight truncate w-full">Sign Out</span>
                </button>
            </nav>
        </div>
    );
}
