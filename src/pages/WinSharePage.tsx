// WinSharePage.tsx — OG Social Share Card for GW Winners & Chairman Announcements
import { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Trophy, Share2, ArrowLeft, Copy, Crown, ShieldCheck } from 'lucide-react';

export default function WinSharePage() {
    const [params] = useSearchParams();
    const league = params.get('league') || 'FPL Chama';
    const gw = params.get('gw') || '?';
    const rawWinner = params.get('winner') || 'The Champion';
    const winner = (rawWinner.trim().split(/\s+/)[0]) || 'The Champion';
    const amount = Number(params.get('amount') || 0);
    const pts = params.get('pts') || '';
    const code = params.get('code') || '';
    const by = params.get('by') || 'winner';
    const isChairman = by === 'chairman';
    const chairman = params.get('chairman') || 'The Chairperson';

    useEffect(() => {
        document.title = isChairman
            ? `📢 Official Communiqué: ${winner} wins GW${gw} — ${league} | FantasyChama`
            : `🏆 ${winner} wins GW${gw} — ${league} | FantasyChama`;
        const setMeta = (property: string, content: string) => {
            let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
            if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
            el.content = content;
        };
        setMeta('og:title', isChairman ? `📢 Official Communiqué: ${winner} wins Gameweek ${gw}!` : `🏆 ${winner} wins Gameweek ${gw}!`);
        setMeta('og:description', isChairman
            ? `Office of the Chairperson officially crowns ${winner} for winning Gameweek ${gw} on ${league}. Disbursed KES ${amount.toLocaleString()}. Join the action!`
            : `${winner} just won KES ${amount.toLocaleString()} from ${league}. ${pts ? `${pts} pts` : ''} Join the action on FantasyChama!`);
        setMeta('og:url', window.location.href);
        setMeta('og:image', 'https://fantasy-chama.vercel.app/og-preview.png');
    }, [league, gw, winner, amount, pts, isChairman]);

    const appOrigin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://fantasy-chama.vercel.app';
    const shareUrl = code
        ? `${appOrigin}/login?code=${code}`
        : appOrigin;
    const shareText = isChairman
        ? `📢 *OFFICIAL CHAMA COMMUNIQUÉ — GW${gw}* 👑\n\nOffice of the Chair officially certifies *${winner}* as the GW${gw} Champion on *${league}* with *${pts ? `${pts} pts` : 'top score'}*!\n💰 Pot Disbursed: *KES ${amount.toLocaleString()}*\nRatified by Chairman ${chairman}.\n\nJoin our Chama 👇\n${shareUrl}${code ? `\nInvite Code: ${code}` : ''}`
        : `🏆 ${winner} just won KES ${amount.toLocaleString()} from Gameweek ${gw} on ${league}!${pts ? ` (${pts} pts)` : ''}\n\nJoin the action on FantasyChama 👇\n${shareUrl}${code ? `\nInvite Code: ${code}` : ''}`;

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({ title: `${winner} wins GW${gw}!`, text: shareText, url: shareUrl });
        } else {
            navigator.clipboard.writeText(shareText);
        }
    };

    return (
        <div className="min-h-screen bg-[#080b10] flex flex-col items-center justify-center px-4 py-10 font-sans relative overflow-hidden">
            {/* Background glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-[120px]" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
            </div>

            <div className="relative z-10 w-full max-w-sm">
                {/* Brand */}
                <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/60 mb-6">
                    {isChairman ? 'Office of the Chairperson • FantasyChama' : 'FantasyChama Official'}
                </p>

                {/* Main card */}
                <div className={`border rounded-[2rem] p-8 text-center relative overflow-hidden ${
                    isChairman
                        ? 'bg-gradient-to-b from-[#091524] via-[#090f17] to-[#04080e] border-emerald-500/40 shadow-[0_0_80px_rgba(16,185,129,0.2)]'
                        : 'bg-gradient-to-b from-[#1c1500] via-[#120f02] to-[#0a0e17] border-amber-500/40 shadow-[0_0_80px_rgba(251,191,36,0.2)]'
                }`}>
                    <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${
                        isChairman ? 'via-emerald-400' : 'via-amber-400'
                    } to-transparent`} />
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 ${
                        isChairman ? 'bg-emerald-500' : 'bg-amber-500'
                    } blur-[60px] opacity-20 pointer-events-none`} />

                    {/* Emblem */}
                    <div className="relative inline-flex mb-5">
                        <div className={`absolute inset-0 rounded-full animate-ping ${
                            isChairman ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                        }`} style={{ animationDuration: '2s' }} />
                        <div className={`relative w-20 h-20 rounded-full p-[2px] ${
                            isChairman
                                ? 'bg-gradient-to-br from-emerald-400 to-teal-700 shadow-[0_0_40px_rgba(16,185,129,0.4)]'
                                : 'bg-gradient-to-br from-amber-400 to-amber-700 shadow-[0_0_40px_rgba(251,191,36,0.4)]'
                        }`}>
                            <div className="w-full h-full rounded-full bg-[#0a0e17] flex items-center justify-center">
                                {isChairman ? (
                                    <Crown className="w-9 h-9 text-emerald-400" />
                                ) : (
                                    <Trophy className="w-9 h-9 text-amber-400" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* League + GW */}
                    <p className={`text-[10px] font-black uppercase tracking-[0.25em] mb-1 ${
                        isChairman ? 'text-emerald-400' : 'text-amber-500/80'
                    }`}>{league}</p>
                    <p className="text-xs font-bold text-gray-400 mb-4">
                        {isChairman ? `Official GW${gw} Ratified Result` : `Gameweek ${gw} Champion`}
                    </p>

                    {/* Winner name */}
                    <h1 className="text-3xl font-black text-white tracking-tight leading-tight mb-2">{winner}</h1>

                    {/* Pts */}
                    {pts && (
                        <p className={`text-sm font-bold mb-4 ${
                            isChairman ? 'text-emerald-400/90' : 'text-amber-400/70'
                        }`}>{pts} points recorded this GW</p>
                    )}

                    {isChairman && (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-bold mb-3">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Officially Certified by Chairman {chairman}</span>
                        </div>
                    )}

                    {/* Amount */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl px-6 py-4 my-4 inline-block w-full">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                            {isChairman ? 'Disbursed via M-Pesa' : 'Payout Received'}
                        </p>
                        <p className={`text-4xl font-black tabular-nums tracking-tight ${
                            isChairman ? 'text-emerald-400' : 'text-amber-400'
                        }`}>KES {amount.toLocaleString()}</p>
                    </div>

                    {/* Invite code chip */}
                    {code && (
                        <div className="flex items-center justify-center gap-2 mb-5">
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2 flex items-center gap-3">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/70 mb-0.5">Join Code</p>
                                    <p className="text-xl font-black text-white tracking-[0.2em]">{code}</p>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText(code)}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                                    title="Copy code"
                                >
                                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                                </button>
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                        Automated FPL pot. Zero drama, instant M-Pesa disbursement.
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleShare}
                            className={`w-full flex items-center justify-center gap-2 py-4 font-black rounded-xl transition-all active:scale-95 shadow-lg text-sm uppercase tracking-widest ${
                                isChairman
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/25'
                                    : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/25'
                            }`}
                        >
                            <Share2 className="w-4 h-4" /> {isChairman ? 'Share Official Proclamation 📢' : 'Share This Win 🏆'}
                        </button>
                        <Link
                            to="/"
                            className="w-full flex items-center justify-center gap-2 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 font-bold rounded-xl transition-all border border-white/5 text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to FantasyChama
                        </Link>
                    </div>
                </div>

                <p className="text-center text-gray-700 text-[10px] font-medium mt-6 tracking-widest uppercase">fantasy-chama.vercel.app</p>
            </div>
        </div>
    );
}
