import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Trophy, TrendingUp, Users, Activity, Banknote, Shield, Zap, ArrowUpRight, Eye, EyeOff, BarChart3 } from 'lucide-react';

export default function SuperAdminDashboard() {
    const navigate = useNavigate();
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [treasuryEvents, setTreasuryEvents] = useState<any[]>([]);
    const [leagues, setLeagues] = useState<any[]>([]);
    const [stealthMode, setStealthMode] = useState(false);
    const [stats, setStats] = useState({
        totalGrossVolume: 0,
        totalPlatformRev: 0,
        totalChairmanPayouts: 0,
        totalCoAdminPayouts: 0,
        totalSafaricomFees: 0,
        activeLeagues: 0,
        totalResolutions: 0
    });

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user && user.uid === import.meta.env.VITE_SUPER_ADMIN_UID) {
                setIsAuthorized(true);
            } else {
                setIsAuthorized(false);
            }
            setIsAuthLoading(false);
        });
        return () => unsubscribeAuth();
    }, []);

    // Fetch Treasury Events
    useEffect(() => {
        if (!isAuthorized) return;
        const q = query(collection(db, 'platform_treasury'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            setTreasuryEvents(events);

            let gross = 0, platformNet = 0, chairmanCut = 0, coAdminCut = 0, safaricomFee = 0;
            const leagueSet = new Set();
            events.forEach(ev => {
                if (ev.grossPot) gross += Number(ev.grossPot);
                if (ev.platformNetRevenue) platformNet += Number(ev.platformNetRevenue);
                if (ev.chairmanCut) chairmanCut += Number(ev.chairmanCut);
                if (ev.coAdminCut) coAdminCut += Number(ev.coAdminCut);
                if (ev.mpesaFee) safaricomFee += Number(ev.mpesaFee);
                if (ev.leagueId) leagueSet.add(ev.leagueId);
            });

            setStats({
                totalGrossVolume: gross,
                totalPlatformRev: platformNet,
                totalChairmanPayouts: chairmanCut,
                totalCoAdminPayouts: coAdminCut,
                totalSafaricomFees: safaricomFee,
                activeLeagues: leagueSet.size,
                totalResolutions: events.length
            });
        });
        return () => unsubscribe();
    }, [isAuthorized]);

    // Fetch All Leagues
    useEffect(() => {
        if (!isAuthorized) return;
        const fetchLeagues = async () => {
            try {
                const snap = await getDocs(collection(db, 'leagues'));
                const leagueList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setLeagues(leagueList);
            } catch (err) {
                console.error("Failed to fetch leagues:", err);
            }
        };
        fetchLeagues();
    }, [isAuthorized]);

    const fmt = (n: number) => stealthMode ? '****' : `KES ${n.toLocaleString()}`;

    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-[#070b10] flex items-center justify-center text-gray-500 font-mono text-sm uppercase tracking-widest">
                <Zap className="w-5 h-5 animate-pulse mr-3 text-emerald-500" />
                Securing HQ uplink...
            </div>
        );
    }

    if (!isAuthorized) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="min-h-screen text-gray-200 font-sans"
            style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 60%), #070b10' }}
        >
            <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 md:py-12 space-y-8">
                {/* Header */}
                <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.05] pb-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Shield className="text-emerald-500 w-5 h-5" />
                            </div>
                            HQ <span className="text-emerald-500">Treasury</span>
                        </h1>
                        <p className="text-sm font-bold text-gray-500 mt-1.5 uppercase tracking-widest">
                            Platform Command • {stats.totalResolutions} GW Resolutions Logged
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setStealthMode(!stealthMode)}
                            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition border border-white/10"
                            title="Toggle figures"
                        >
                            {stealthMode ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest rounded-xl transition border border-white/10"
                        >
                            Exit HQ
                        </button>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Gross Volume', value: fmt(stats.totalGrossVolume), color: 'text-white', icon: <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> },
                        { label: 'Platform Revenue (5%)', value: fmt(stats.totalPlatformRev), color: 'text-emerald-400', icon: <Banknote className="w-3.5 h-3.5 text-emerald-400" /> },
                        { label: 'Chairman Kickbacks', value: fmt(stats.totalChairmanPayouts), color: 'text-[#FBBF24]', icon: <Trophy className="w-3.5 h-3.5 text-[#FBBF24]" /> },
                        { label: 'Co-Admin Kickbacks', value: fmt(stats.totalCoAdminPayouts), color: 'text-gray-300', icon: <Users className="w-3.5 h-3.5 text-purple-400" /> },
                        { label: 'Safaricom Fees', value: fmt(stats.totalSafaricomFees), color: 'text-red-400', icon: <TrendingUp className="w-3.5 h-3.5 text-red-400" /> },
                        { label: 'Active Leagues', value: stealthMode ? '**' : String(stats.activeLeagues), color: 'text-white', icon: <Activity className="w-3.5 h-3.5 text-cyan-400" /> },
                    ].map((stat, i) => (
                        <div key={i} className="bg-[#0d1218] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                            <p className="text-[9px] font-black uppercase text-gray-600 mb-2 flex items-center gap-1.5 tracking-widest">{stat.icon} {stat.label}</p>
                            <p className={`text-lg md:text-xl font-black ${stat.color} tabular-nums tracking-tight`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Active Leagues Cards */}
                {leagues.length > 0 && (
                    <section>
                        <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-emerald-500" /> Registered Leagues ({leagues.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {leagues.map((league: any) => {
                                const leagueRevenue = treasuryEvents
                                    .filter(e => e.leagueId === league.id)
                                    .reduce((acc, e) => acc + Number(e.platformNetRevenue || 0), 0);
                                const leagueGWs = treasuryEvents.filter(e => e.leagueId === league.id).length;

                                return (
                                    <div key={league.id} className="bg-[#0d1218] border border-white/5 rounded-xl p-4 hover:border-emerald-500/20 transition-colors group">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-black text-white truncate">{league.leagueName || league.id}</h3>
                                            <ArrowUpRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-emerald-500 transition-colors" />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <p className="text-[9px] font-bold text-gray-600 uppercase">Stake</p>
                                                <p className="text-sm font-black text-white tabular-nums">KES {(league.gameweekStake || 0).toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-gray-600 uppercase">GWs</p>
                                                <p className="text-sm font-black text-emerald-400 tabular-nums">{leagueGWs}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-gray-600 uppercase">Revenue</p>
                                                <p className="text-sm font-black text-[#FBBF24] tabular-nums">{stealthMode ? '****' : `KES ${leagueRevenue.toLocaleString()}`}</p>
                                            </div>
                                        </div>
                                        {league.fplLeagueId && (
                                            <p className="text-[9px] font-mono text-gray-600 mt-2 truncate">FPL: {league.fplLeagueId}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Treasury Events Table */}
                <div className="bg-[#0d1218] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Treasury Events</h3>
                        <span className="text-[10px] font-bold text-gray-600 bg-white/5 px-2 py-0.5 rounded">{treasuryEvents.length} records</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-[#080c11] text-[9px] uppercase font-black tracking-widest text-gray-600">
                                <tr>
                                    <th className="px-5 py-3">GW & League</th>
                                    <th className="px-5 py-3">Time</th>
                                    <th className="px-5 py-3 text-right">Gross</th>
                                    <th className="px-5 py-3 text-right">Chairman</th>
                                    <th className="px-5 py-3 text-right">Co-Admin</th>
                                    <th className="px-5 py-3 text-right">M-Pesa Fee</th>
                                    <th className="px-5 py-3 text-right text-emerald-400">Platform</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.02]">
                                {treasuryEvents.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-16 text-center text-gray-600 text-xs font-bold uppercase tracking-widest">
                                            <Zap className="w-6 h-6 mx-auto mb-2 text-gray-700" />
                                            No treasury events logged yet. Revenue will appear after the first GW resolution.
                                        </td>
                                    </tr>
                                ) : treasuryEvents.map((ev: any) => {
                                    const ts = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date();
                                    return (
                                        <tr key={ev.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-5 py-3.5">
                                                <p className="font-bold text-gray-200 text-xs">{ev.gameweek}</p>
                                                <p className="text-[10px] text-gray-600 font-mono mt-0.5">{ev.leagueName}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-[11px] font-mono text-gray-500">
                                                {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-bold text-gray-300 text-xs">
                                                {stealthMode ? '****' : `KES ${Number(ev.grossPot || 0).toLocaleString()}`}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-[#FBBF24] font-medium text-xs">
                                                {ev.chairmanCut ? (stealthMode ? '****' : `KES ${Number(ev.chairmanCut).toLocaleString()}`) : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-medium text-gray-400 text-xs">
                                                {ev.coAdminCut ? (stealthMode ? '****' : `KES ${Number(ev.coAdminCut).toLocaleString()}`) : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-medium text-red-400/70 text-xs">
                                                {ev.mpesaFee ? (stealthMode ? '****' : `KES ${Number(ev.mpesaFee).toLocaleString()}`) : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-emerald-400 font-black text-xs">
                                                {stealthMode ? '****' : `KES ${Number(ev.platformNetRevenue || 0).toLocaleString()}`}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <footer className="text-center text-[10px] text-gray-700 font-mono uppercase tracking-widest py-4 border-t border-white/[0.03]">
                    FantasyChama HQ • Platform Treasury • {new Date().getFullYear()}
                </footer>
            </div>
        </div>
    );
}
