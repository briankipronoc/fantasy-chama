import { Shield, TrendingUp, Wallet, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function PayoutRules() {
    const league = useStore((state) => state.league);
    const members = useStore((state) => state.members);
    const monthlyFee = league?.monthlyFee || 1400; // default 1400 if league not initialized yet
    const activeMembersCount = members.filter((member) => member.isActive !== false).length;
    const configuredWinnersCount = Number((league as any)?.rules?.seasonWinnersCount || (league as any)?.seasonWinnersCount || 3);
    const eligibleWinnersCount = Math.min(configuredWinnersCount, activeMembersCount || configuredWinnersCount);

    // Pot distributions based on PRD: 70/30 split logic
    const weeklyPrize = Math.round(monthlyFee * 0.7);
    const grandVaultCont = Math.round(monthlyFee * 0.3);

    // Assume a 20 member league max limit for the example scaling
    const seasonVaultProj = grandVaultCont * 20 * 38; // KES contribution * 20 max members * 38 weeks

    const getVaultPercentages = (winnerCount: number) => {
        if (winnerCount === 1) return [100];
        if (winnerCount === 3) return [50, 30, 20];
        return [45, 25, 15, 10, 5];
    };

    const configuredDistribution = Array.isArray((league as any)?.rules?.seasonDistribution)
        ? ((league as any).rules.seasonDistribution as any[])
            .map((value) => Number(value || 0))
            .filter((value) => Number.isFinite(value) && value >= 0)
        : [];
    const vaultPercentages = configuredDistribution.length > 0
        ? configuredDistribution
        : getVaultPercentages(configuredWinnersCount);
    const visibleVaultTiers = vaultPercentages.slice(0, eligibleWinnersCount).map((percentage, index) => ({
        place: index + 1,
        percentage,
        value: seasonVaultProj * (percentage / 100),
    }));
    const isCapped = activeMembersCount < configuredWinnersCount;

    return (
        <div className="min-h-screen bg-[#0d1316] text-white p-6 md:p-10 font-sans max-w-5xl mx-auto space-y-12 animate-in fade-in duration-500 pb-24">

            {/* Page Header */}
            <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">League Constitution & Payouts</h1>
                <p className="text-gray-400 text-lg">Transparent breakdown of all funds distributed within the Fantasy Chama Escrow system.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 70/30 Fund Split Architecture */}
                <div className="bg-[#1c272c] border border-white/5 rounded-3xl p-8 flex flex-col justify-between shadow-xl">
                    <div>
                        <div className="flex items-center gap-2 mb-8">
                            <TrendingUp className="w-5 h-5 text-chama-success" />
                            <h2 className="text-xl font-bold uppercase tracking-wider text-slate-200">The 70/30 Mechanism</h2>
                        </div>

                        <p className="text-slate-400 mb-8 leading-relaxed">
                            Every <strong className="text-white">KES {monthlyFee.toLocaleString()}</strong> monthly contribution is automatically routed via Smart Contract into two primary liquidity pools:
                        </p>

                        <div className="space-y-6">
                            <div className="group relative bg-[#11171a] border border-chama-success/20 hover:border-chama-success/50 transition-all rounded-2xl p-5 flex items-center justify-between overflow-hidden">
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-chama-success to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                <div>
                                    <p className="text-[10px] text-chama-success font-bold uppercase tracking-widest mb-1">70% Allocation</p>
                                    <h3 className="text-lg font-bold">Weekly Performance Prize</h3>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black tabular-nums text-white">KES {weeklyPrize.toLocaleString()}</span>
                                    <p className="text-xs text-slate-500">/ per manager</p>
                                </div>
                            </div>

                            <div className="group relative bg-[#11171a] border border-chama-gold/20 hover:border-chama-gold/50 transition-all rounded-2xl p-5 flex items-center justify-between overflow-hidden">
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-chama-gold to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                <div>
                                    <p className="text-[10px] text-chama-gold font-bold uppercase tracking-widest mb-1">30% Allocation</p>
                                    <h3 className="text-lg font-bold">Season End Grand Vault</h3>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black tabular-nums text-white">KES {grandVaultCont.toLocaleString()}</span>
                                    <p className="text-xs text-slate-500">/ per manager</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 bg-[#161d24] border border-white/5 p-4 rounded-xl flex items-start gap-4">
                        <Lock className="w-6 h-6 text-slate-500 shrink-0 mt-1" />
                        <div>
                            <h4 className="text-sm font-bold text-white mb-1">Fully Escrowed</h4>
                            <p className="text-[11px] text-slate-400">All funds are locked to the Safaricom M-Pesa API and cannot be manually withdrawn by the Chairman.</p>
                        </div>
                    </div>
                </div>

                {/* Grand Vault Hierarchy */}
                <div className="bg-gradient-to-b from-[#1c272c] to-[#11171a] border border-chama-gold/30 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_40px_rgba(251,191,36,0.05)]">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <Wallet className="w-48 h-48 text-chama-gold" />
                    </div>

                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-chama-gold" />
                                <h2 className="text-xl font-bold uppercase tracking-wider text-slate-200">The Grand Vault</h2>
                            </div>
                            <span className="bg-chama-gold/10 text-chama-gold text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-md border border-chama-gold/20">
                                Top {configuredWinnersCount}
                            </span>
                        </div>

                        <p className="text-slate-400 mb-8 leading-relaxed max-w-sm">
                            At Gameweek 38, the accumulated Grand Vault is distributed among the league's configured season winners. The ladder automatically stops at the number of active members available.
                        </p>

                        <div className="mb-6 rounded-2xl border border-white/5 bg-black/20 px-4 py-3 flex items-start gap-3">
                            <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                Chairman setting: Top {configuredWinnersCount}. Active members now: {activeMembersCount}. {isCapped ? `Preview capped at Top ${eligibleWinnersCount} until the league grows.` : 'All configured payout tiers are currently available.'}
                            </p>
                        </div>

                        <div className="space-y-4 flex-1">
                            {visibleVaultTiers.map((tier, idx) => (
                                <div key={tier.place} className={`flex items-center justify-between bg-[#161d24] border-l-4 ${tier.place === 1 ? 'border-chama-gold' : tier.place === 2 ? 'border-slate-300' : 'border-amber-700'} p-4 rounded-r-xl border-y border-r border-white/5 bg-gradient-to-r hover:from-white/5 transition-all group`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 text-center text-sm font-black tabular-nums tracking-widest ${idx === 0 ? 'text-chama-gold' : idx === 1 ? 'text-slate-300' : 'text-amber-600'} bg-[#11171a] px-2 py-1.5 rounded border border-white/5 group-hover:scale-105 transition-transform`}>
                                            {tier.percentage}%
                                        </div>
                                        <h4 className="font-bold text-sm md:text-base text-white">{tier.place === 1 ? 'Champion' : `Place #${tier.place}`}</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 text-xs font-bold">~KES</span>
                                        <span className="font-black tabular-nums">{Math.round(tier.value).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {isCapped && (
                            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Capped by league size</p>
                                <p className="text-xs text-amber-50/90 mt-1">
                                    The league currently has only {activeMembersCount} active member{activeMembersCount === 1 ? '' : 's'}, so this preview stops at Top {eligibleWinnersCount} for now.
                                </p>
                            </div>
                        )}

                        <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-chama-success" /> Projections based on the chairman's configured ladder</span>
                            <button className="text-[10px] font-bold uppercase tracking-widest text-[#10B981] hover:text-[#1fbb59] flex items-center gap-1 transition-colors">
                                Rules <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
