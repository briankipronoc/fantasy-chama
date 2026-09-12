// HeadToHeadModal.tsx — Mini-League Radar: Side-by-Side Manager Battle with Kenyan Banter
import { useState, useMemo } from 'react';
import { X, Swords, Flame, Share2 } from 'lucide-react';
import { haptics } from '../utils/haptics';
import UserAvatar from './UserAvatar';

export interface H2HManager {
    id?: string;
    entry: number;
    player_name: string;
    entry_name: string;
    event_total: number;
    total: number;
    rank?: number;
    captain?: string;
    chipsUsed?: string[];
    transfersCost?: number;
}

interface HeadToHeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    managers: H2HManager[];
    initialManagerAId?: number;
    initialManagerBId?: number;
    currentGw?: number;
    leagueName?: string;
}

export default function HeadToHeadModal({
    isOpen,
    onClose,
    managers,
    initialManagerAId,
    initialManagerBId,
    currentGw = 3,
    leagueName = 'Fantasy Chama',
}: HeadToHeadModalProps) {
    if (!isOpen || managers.length < 2) return null;

    const defaultA = initialManagerAId || managers[0]?.entry;
    const defaultB = initialManagerBId || managers[1]?.entry || managers[0]?.entry;

    const [managerAId, setManagerAId] = useState<number>(defaultA);
    const [managerBId, setManagerBId] = useState<number>(defaultB === defaultA ? (managers[1]?.entry || defaultA) : defaultB);

    const managerA = useMemo(() => managers.find(m => m.entry === managerAId) || managers[0], [managers, managerAId]);
    const managerB = useMemo(() => managers.find(m => m.entry === managerBId) || managers[1] || managers[0], [managers, managerBId]);

    const gwDiff = managerA.event_total - managerB.event_total;
    const overallDiff = managerA.total - managerB.total;

    // Authentic Kenyan FPL Chama Banter Engine
    const banterVerdict = useMemo(() => {
        if (gwDiff > 30) {
            return {
                title: '🥷 MWIZI WA POINTS CONFIRMED!',
                subtitle: `${managerA.player_name} anamvuta ${managerB.player_name} kama toroli. Vumbi tu!`,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10 border-emerald-500/30'
            };
        }
        if (gwDiff > 15) {
            return {
                title: '🍳 COOKING VS COOKED',
                subtitle: `${managerA.player_name} amewasha moto, ${managerB.player_name} anapumua kwa mashine ya ICU!`,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10 border-amber-500/30'
            };
        }
        if (gwDiff > 0) {
            return {
                title: '⚔️ VITA YA PANZI',
                subtitle: `Gap ni ya points ${gwDiff}. Dakika za mwisho zitatoa mtu jasho ya shingo!`,
                color: 'text-cyan-400',
                bg: 'bg-cyan-500/10 border-cyan-500/30'
            };
        }
        if (gwDiff === 0) {
            return {
                title: '🤝 DEADLOCK YA WAGANGA',
                subtitle: 'Hakuna anayecheka hapa — alama zimefungamana kama ugali na sukuma!',
                color: 'text-purple-400',
                bg: 'bg-purple-500/10 border-purple-500/30'
            };
        }
        if (gwDiff < -30) {
            return {
                title: '💀 CHAPATI BARIDI DETECTED',
                subtitle: `${managerB.player_name} amemkalisha ${managerA.player_name} chini bila huruma!`,
                color: 'text-red-400',
                bg: 'bg-red-500/10 border-red-500/30'
            };
        }
        return {
            title: '🔥 KIMEUMANA!',
            subtitle: `${managerB.player_name} ako mbele kwa points ${Math.abs(gwDiff)}. Mwizi wa points ameshikwa!`,
            color: 'text-rose-400',
            bg: 'bg-rose-500/10 border-rose-500/30'
        };
    }, [gwDiff, managerA.player_name, managerB.player_name]);

    const handleShareWhatsApp = () => {
        haptics.selection();
        const appUrl = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://fantasychama.vercel.app';
        const lines = [
            `⚔️ *${leagueName.toUpperCase()} — H2H RADAR CLASH* ⚔️`,
            ``,
            `🥊 *${managerA.player_name}* (${managerA.entry_name})`,
            `   GW Points: *${managerA.event_total} pts* | Season: ${managerA.total} pts`,
            `   vs`,
            `🥊 *${managerB.player_name}* (${managerB.entry_name})`,
            `   GW Points: *${managerB.event_total} pts* | Season: ${managerB.total} pts`,
            ``,
            `📊 *Score Gap:* ${gwDiff >= 0 ? `+${gwDiff} pts for ${managerA.player_name}` : `+${Math.abs(gwDiff)} pts for ${managerB.player_name}`}`,
            `📣 *Verdict:* ${banterVerdict.title}`,
            `_${banterVerdict.subtitle}_`,
            ``,
            `Angalia live battle & standings:`,
            `👉 ${appUrl}/standings`
        ];
        const text = encodeURIComponent(lines.join('\n'));
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-xl bg-[#0e151c] border border-white/15 rounded-3xl p-5 sm:p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh]">
                <div className="absolute -top-24 -left-20 w-56 h-56 rounded-full bg-emerald-500/15 blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-20 w-56 h-56 rounded-full bg-amber-500/15 blur-[80px] pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <Swords className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                                Head-to-Head Radar
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 uppercase">
                                    GW{currentGw}
                                </span>
                            </h3>
                            <p className="text-[10.5px] text-gray-400 font-medium">Direct manager showdown & banter breakdown</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => { haptics.selection(); onClose(); }}
                        className="p-2 rounded-xl text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition cursor-pointer"
                        title="Close Radar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Selectors */}
                <div className="grid grid-cols-2 gap-3 my-4 relative z-10">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                            Manager A
                        </label>
                        <select
                            value={managerAId}
                            onChange={(e) => setManagerAId(Number(e.target.value))}
                            className="w-full bg-[#080d12] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-400 cursor-pointer"
                        >
                            {managers.map(m => (
                                <option key={`opt-a-${m.entry}`} value={m.entry}>
                                    {m.player_name} ({m.event_total} pts)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                            Manager B (Rival)
                        </label>
                        <select
                            value={managerBId}
                            onChange={(e) => setManagerBId(Number(e.target.value))}
                            className="w-full bg-[#080d12] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-400 cursor-pointer"
                        >
                            {managers.map(m => (
                                <option key={`opt-b-${m.entry}`} value={m.entry}>
                                    {m.player_name} ({m.event_total} pts)
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Faceoff Stage */}
                <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-0.5">
                    <div className="grid grid-cols-11 items-center gap-2 p-4 rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-950/30 via-[#0a0f14] to-amber-950/30">
                        {/* Manager A */}
                        <div className="col-span-5 flex flex-col items-center text-center">
                            <UserAvatar name={managerA.player_name} size="lg" />
                            <h4 className="text-sm font-black text-white mt-2 truncate w-full">{managerA.player_name}</h4>
                            <p className="text-[10.5px] text-gray-400 truncate w-full">{managerA.entry_name}</p>
                            <div className="mt-2.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                                <span className="text-2xl font-black text-emerald-300">{managerA.event_total}</span>
                                <span className="text-[10px] font-bold text-emerald-400 ml-1">pts</span>
                            </div>
                        </div>

                        {/* VS Divider */}
                        <div className="col-span-1 flex flex-col items-center justify-center">
                            <span className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[10px] font-black text-amber-400">
                                VS
                            </span>
                        </div>

                        {/* Manager B */}
                        <div className="col-span-5 flex flex-col items-center text-center">
                            <UserAvatar name={managerB.player_name} size="lg" />
                            <h4 className="text-sm font-black text-white mt-2 truncate w-full">{managerB.player_name}</h4>
                            <p className="text-[10.5px] text-gray-400 truncate w-full">{managerB.entry_name}</p>
                            <div className="mt-2.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30">
                                <span className="text-2xl font-black text-amber-300">{managerB.event_total}</span>
                                <span className="text-[10px] font-bold text-amber-400 ml-1">pts</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Comparison Table */}
                    <div className="space-y-2">
                        {/* GW Score Gap */}
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                            <span className="font-bold text-white">{managerA.event_total} pts</span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Gameweek Points</span>
                            <span className="font-bold text-white">{managerB.event_total} pts</span>
                        </div>

                        {/* Overall Season Total */}
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-200">{managerA.total.toLocaleString()} pts</span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Overall Season</span>
                            <span className="font-bold text-slate-200">{managerB.total.toLocaleString()} pts</span>
                        </div>

                        {/* Net Differential */}
                        <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                            <span className="text-[11px] font-bold text-gray-400">Overall Points Gap:</span>
                            <span className="font-black text-sm text-emerald-400">
                                {overallDiff > 0 ? `+${overallDiff} to ${managerA.player_name}` : overallDiff < 0 ? `+${Math.abs(overallDiff)} to ${managerB.player_name}` : 'Tied on points'}
                            </span>
                        </div>
                    </div>

                    {/* Banter Verdict Banner */}
                    <div className={`p-4 rounded-2xl border ${banterVerdict.bg} text-center space-y-1`}>
                        <div className={`text-xs font-black tracking-wider flex items-center justify-center gap-1.5 ${banterVerdict.color}`}>
                            <Flame className="w-4 h-4" />
                            {banterVerdict.title}
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-medium">
                            {banterVerdict.subtitle}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-white/10 flex items-center gap-2 mt-auto relative z-10">
                    <button
                        type="button"
                        onClick={handleShareWhatsApp}
                        className="flex-1 py-3 px-4 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(37,211,102,0.3)] flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                        <Share2 className="w-4 h-4" />
                        Share H2H Banter on WhatsApp
                    </button>
                    <button
                        type="button"
                        onClick={() => { haptics.selection(); onClose(); }}
                        className="py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white transition cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
