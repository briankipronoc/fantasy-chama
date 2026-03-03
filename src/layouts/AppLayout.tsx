import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { LayoutDashboard, BarChart3, AlertTriangle, Banknote, Settings } from 'lucide-react';
import clsx from 'clsx';

export default function AppLayout() {
    const role = useStore((state) => state.role);
    const logout = useStore((state) => state.logout);
    const location = useLocation();

    if (!role) {
        return <Navigate to="/login" replace />;
    }

    // Members get an immersive full-screen wrapper without the fixed admin sidebar
    if (role === 'member') {
        return (
            <div className="flex h-screen w-full bg-[#111613] overflow-hidden text-white font-sans relative pb-20">
                <main className="flex-1 overflow-y-auto w-full">
                    <Outlet />
                </main>

                {/* Mobile/Member Native Bottom Nav */}
                <nav className="fixed bottom-0 left-0 right-0 border-t border-white/5 bg-[#0a100a] flex items-center justify-around p-3 z-50">
                    <Link to="/" className={`flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-[#22c55e]' : 'text-gray-500 hover:text-white'}`}>
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="text-[10px] font-bold">War Room</span>
                    </Link>
                    <Link to="/standings" className={`flex flex-col items-center gap-1 ${location.pathname === '/standings' ? 'text-[#22c55e]' : 'text-gray-500 hover:text-white'}`}>
                        <BarChart3 className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Standings</span>
                    </Link>
                    <Link to="/deposit" className={`flex flex-col items-center gap-1 ${location.pathname === '/deposit' ? 'text-[#22c55e]' : 'text-gray-500 hover:text-white'}`}>
                        <Banknote className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Deposit</span>
                    </Link>
                    <Link to="/finances" className={`flex flex-col items-center gap-1 ${location.pathname === '/finances' ? 'text-[#eab308]' : 'text-gray-500 hover:text-white'}`}>
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Finances</span>
                    </Link>
                    <Link to="/profile" className={`flex flex-col items-center gap-1 ${location.pathname === '/profile' ? 'text-[#22c55e]' : 'text-gray-500 hover:text-white'}`}>
                        <Settings className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Profile</span>
                    </Link>
                    <button onClick={logout} className="flex flex-col items-center gap-1 text-gray-500 hover:text-red-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span className="text-[10px] font-bold">Log Out</span>
                    </button>
                </nav>
            </div>
        );
    }

    // Admin 'Manager Hub' Navigation Items
    const navItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'League Table', path: '/standings', icon: BarChart3 },
        { name: 'Red Zone & Finances', path: '/finances', icon: AlertTriangle },
        { name: 'Settings & Profile', path: '/profile', icon: Settings },
    ];

    return (
        <div className="flex h-screen w-full bg-[#111613] overflow-hidden text-white font-sans">
            {/* Admin 'Manager Hub' Sidebar */}
            <nav className="w-64 border-r border-white/5 bg-[#0a100a] flex flex-col p-6 hidden md:flex">
                <div className="mb-12">
                    <h2 className="text-xl font-bold tracking-tight text-white mb-1">Manager Hub</h2>
                    <p className="text-[10px] font-bold text-[#22c55e] tracking-widest uppercase">TRANSPARENCY PORTAL</p>
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
                                        ? 'bg-[#4ade80] text-[#0a100a] border-[#4ade80] shadow-[0_0_15px_rgba(74,222,128,0.2)]'
                                        : 'text-gray-300 hover:text-white hover:bg-white/5 border-transparent'
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Bottom Status / Chama Goal */}
                <div className="mt-auto bg-[#1a241c] p-4 rounded-2xl border border-white/5">
                    <h4 className="text-[10px] font-bold tracking-widest uppercase text-[#22C55E] mb-2">CHAMA GOAL</h4>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-white font-medium">Monthly Target</span>
                        <span className="text-xs font-bold text-[#22C55E]">82%</span>
                    </div>
                    <div className="w-full bg-[#0a100a] rounded-full h-1.5 overflow-hidden border border-[#22C55E]/20">
                        <div className="bg-[#22C55E] h-full w-[82%] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)] transform translate-[-2px]"></div>
                    </div>
                </div>

                <div className="mt-4">
                    <button onClick={logout} className="flex items-center justify-center gap-2 w-full py-3 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] rounded-xl font-bold text-xs uppercase tracking-widest border border-[#ef4444]/20 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sign Out
                    </button>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-[#111613]">
                <Outlet />
            </main>
        </div>
    );
}
