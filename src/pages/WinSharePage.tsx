// WinSharePage.tsx — OG Social Share Card for GW Winners
// Renders a beautiful trophy page that unfurls correctly when shared on WhatsApp/Twitter.
// URL format: /win?league=NAME&gw=26&winner=Brian&amount=4200

import { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Trophy, Share2, ArrowLeft } from 'lucide-react';

export default function WinSharePage() {
    const [params] = useSearchParams();
    const league = params.get('league') || 'FPL Chama';
    const gw = params.get('gw') || '?';
    const winner = params.get('winner') || 'The Champion';
    const amount = Number(params.get('amount') || 0);

    // Update page title and OG tags dynamically
    useEffect(() => {
        document.title = `🏆 ${winner} wins GW${gw} — ${league} | FantasyChama`;

        const setMeta = (property: string, content: string) => {
            let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
            if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
            el.content = content;
        };

        setMeta('og:title', `🏆 ${winner} wins Gameweek ${gw}!`);
        setMeta('og:description', `${winner} just won KES ${amount.toLocaleString()} from ${league} on FantasyChama. Join the action!`);
        setMeta('og:url', window.location.href);
        setMeta('og:type', 'website');
    }, [league, gw, winner, amount]);

    const shareUrl = window.location.href;
    const shareText = `🏆 ${winner} just won KES ${amount.toLocaleString()} from Gameweek ${gw} on ${league}!\n\nJoin the action on FantasyChama 👇\n${shareUrl}`;

    return (
        <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center px-6 py-12 font-sans">
            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                {/* Trophy Card */}
                <div className="bg-gradient-to-b from-[#1a1500] to-[#0a0e17] border border-amber-500/30 rounded-[2.5rem] p-10 text-center shadow-[0_0_80px_rgba(251,191,36,0.15)] overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(251,191,36,0.3)]">
                        <Trophy className="w-10 h-10 text-amber-400" />
                    </div>

                    <p className="text-xs font-black text-amber-500 uppercase tracking-[0.3em] mb-3">{league} · GW{gw} Champion</p>

                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">{winner}</h1>

                    <p className="text-5xl font-black text-amber-400 tabular-nums tracking-tighter my-6">
                        KES {amount.toLocaleString()}
                    </p>

                    <p className="text-gray-400 text-sm font-medium mb-8">
                        Claimed the Gameweek {gw} pot from {league}.<br />
                        Powered by FantasyChama — automated payouts, zero drama.
                    </p>

                    {/* Share buttons */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => {
                                if (navigator.share) {
                                    navigator.share({ title: `${winner} wins GW${gw}!`, text: shareText, url: shareUrl });
                                } else {
                                    navigator.clipboard.writeText(shareText);
                                    alert('Share text copied to clipboard!');
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 py-4 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                        >
                            <Share2 className="w-4 h-4" /> Share This Win 🏆
                        </button>

                        <Link
                            to="/"
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl transition-all border border-white/5 text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to FantasyChama
                        </Link>
                    </div>
                </div>

                <p className="text-center text-gray-600 text-xs font-medium mt-6">FantasyChama — Kenya&apos;s FPL Pot Engine</p>
            </div>
        </div>
    );
}
