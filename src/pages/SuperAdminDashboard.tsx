import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Trophy, TrendingUp, Users, Activity, Banknote } from 'lucide-react';

export default function SuperAdminDashboard() {
    const navigate = useNavigate();
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [treasuryEvents, setTreasuryEvents] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalGrossVolume: 0,
        totalPlatformRev: 0,
        totalChairmanPayouts: 0,
        activeLeagues: 0
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

    useEffect(() => {
        // Fetch Treasury Events
        const q = query(collection(db, 'platform_treasury'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            setTreasuryEvents(events);
            
            // Calculate aggregations
            let gross = 0;
            let platformNet = 0;
            let chairmanCut = 0;
            const leagues = new Set();
            
            events.forEach(ev => {
                if (ev.grossPot) gross += Number(ev.grossPot);
                if (ev.platformNetRevenue) platformNet += Number(ev.platformNetRevenue);
                if (ev.chairmanCut) chairmanCut += Number(ev.chairmanCut);
                if (ev.leagueId) leagues.add(ev.leagueId);
            });
            
            setStats({
                totalGrossVolume: gross,
                totalPlatformRev: platformNet,
                totalChairmanPayouts: chairmanCut,
                activeLeagues: leagues.size
            });
        });

        return () => unsubscribe();
    }, [isAuthorized]);

    if (isAuthLoading) {
        return <div className="min-h-screen bg-[#070b10] flex items-center justify-center text-gray-500 font-mono text-sm uppercase tracking-widest">Securing God Mode uplink...</div>;
    }

    if (!isAuthorized) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="min-h-screen bg-[#070b10] text-gray-200 font-sans p-6 md:p-12">
            <header className="flex items-center justify-between border-b border-white/[0.05] pb-6 mb-10">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <Activity className="text-emerald-500 w-8 h-8" />
                        God Mode <span className="text-[#FBBF24]/80 ml-2">Treasury</span>
                    </h1>
                    <p className="text-sm font-bold text-gray-500 mt-2 uppercase tracking-widest">Global Platform Ledger</p>
                </div>
                <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest rounded-xl transition border border-white/10"
                >
                    Exit God Mode
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div className="bg-[#11171a] p-6 rounded-[1.5rem] border border-white/5 shadow-2xl">
                    <p className="text-[10px] font-black uppercase text-gray-500 mb-2 flex items-center gap-2"><Trophy className="w-3.5 h-3.5 text-blue-400"/> Total Gross Volume</p>
                    <p className="text-3xl font-black text-white">KES {stats.totalGrossVolume.toLocaleString()}</p>
                </div>
                <div className="bg-[#11171a] p-6 rounded-[1.5rem] border border-white/5 shadow-2xl">
                    <p className="text-[10px] font-black uppercase text-gray-500 mb-2 flex items-center gap-2"><Banknote className="w-3.5 h-3.5 text-emerald-400"/> Startup Revenue (5%)</p>
                    <p className="text-3xl font-black text-emerald-400">KES {stats.totalPlatformRev.toLocaleString()}</p>
                </div>
                <div className="bg-[#11171a] p-6 rounded-[1.5rem] border border-white/5 shadow-2xl">
                    <p className="text-[10px] font-black uppercase text-gray-500 mb-2 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-[#FBBF24]"/> Chairman Payouts</p>
                    <p className="text-3xl font-black text-[#FBBF24]">KES {stats.totalChairmanPayouts.toLocaleString()}</p>
                </div>
                <div className="bg-[#11171a] p-6 rounded-[1.5rem] border border-white/5 shadow-2xl">
                    <p className="text-[10px] font-black uppercase text-gray-500 mb-2 flex items-center gap-2"><Users className="w-3.5 h-3.5 text-purple-400"/> Active Leagues</p>
                    <p className="text-3xl font-black text-white">{stats.activeLeagues}</p>
                </div>
            </div>

            <div className="bg-[#11171a] border border-white/5 rounded-[1.5rem] overflow-hidden shadow-2xl">
                <div className="px-6 py-5 border-b border-white/[0.05]">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Real-Time Treasury Events</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#0b1014] text-[10px] uppercase font-black tracking-widest text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Gameweek & League</th>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4 text-right">Gross Pot</th>
                                <th className="px-6 py-4 text-right">Chairman Cut</th>
                                <th className="px-6 py-4 text-right">Co-Admin Cut</th>
                                <th className="px-6 py-4 text-right text-emerald-400">Platform Net</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {treasuryEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-xs font-bold uppercase tracking-widest">
                                        No treasury events logged yet.
                                    </td>
                                </tr>
                            ) : treasuryEvents.map((ev: any) => {
                                const ts = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date();
                                return (
                                    <tr key={ev.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-200">{ev.gameweek}</p>
                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{ev.leagueName}</p>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-gray-400">
                                            {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-300">
                                            KES {Number(ev.grossPot || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right text-[#FBBF24] font-medium">
                                            {ev.chairmanCut ? `KES ${Number(ev.chairmanCut).toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-400">
                                            {ev.coAdminCut ? `KES ${Number(ev.coAdminCut).toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right text-emerald-400 font-black">
                                            KES {Number(ev.platformNetRevenue || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
