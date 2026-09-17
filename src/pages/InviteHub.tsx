import { Check, Share2, FileText, Shield, Users, Zap, Wallet, Trophy, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function InviteHub() {
    const [searchParams] = useSearchParams();
    const inviteCode = searchParams.get('code') || "882109";
    const [copied, setCopied] = useState(false);

    const [targetPhone, setTargetPhone] = useState('');
    const [expiresDays, setExpiresDays] = useState('7');

    const handleCopyShare = () => {
        const appUrl = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : (import.meta.env.VITE_APP_URL || 'https://fantasy-chama.vercel.app');
        const expiresAt = Date.now() + (parseInt(expiresDays || '7') * 24 * 60 * 60 * 1000);
        
        let params = `?code=${inviteCode}&e=${expiresAt}`;
        if (targetPhone.trim()) {
            let formattedPhone = targetPhone.trim();
            if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
            params += `&p=${encodeURIComponent(formattedPhone)}`;
        }

        const shareUrl = `${appUrl}/login${params}`;
        
        const message = `🏆 *You've been invited to join Fantasy Chama!*\n\n` +
            `Sign in, link your FPL squad, and join the gameweek money league pot.\n\n` +
            `👉 *Join League:* ${shareUrl}\n\n` +
            `_Invite Code: *${inviteCode}*_`;

        if (navigator.share) {
            navigator.share({
                title: 'Fantasy Chama League Invite',
                text: message,
            }).catch(() => {
                // Fallback to clipboard if share was cancelled or failed
                navigator.clipboard.writeText(message);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
            });
        } else {
            navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };

    return (
        <div className="min-h-screen bg-[#0d1316] text-white font-sans flex flex-col relative overflow-hidden">

            {/* Minimal Top Header */}
            <header className="flex items-center justify-between p-6 px-10 absolute top-0 w-full z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-[#10B981]/10 p-2 rounded-xl text-[#10B981]">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">Fantasy Chama</span>
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-[#1a232b] p-2.5 rounded-xl border border-white/5 text-[#FBBF24] hover:bg-white/5 transition-colors">
                        <Trophy className="w-5 h-5" />
                    </button>
                    <button className="bg-[#1a232b] p-2.5 rounded-xl border border-white/5 text-[#10B981] hover:bg-white/5 transition-colors">
                        <Wallet className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto z-10 pt-24 pb-32">

                {/* Success Header */}
                <div className="flex flex-col items-center text-center mb-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-6 border border-[#10B981]/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative">
                        <div className="absolute inset-0 rounded-full bg-[#10B981] opacity-20 animate-ping"></div>
                        <Check className="w-8 h-8 text-[#10B981] relative z-10" strokeWidth={3} />
                    </div>
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
                        Group Created Successfully!
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-lg max-w-lg leading-relaxed">
                        Your "Elite Investors" chama is live. Now, bring in your members to start the rotation.
                    </p>
                </div>

                {/* Invite Code Block */}
                <div className="w-full max-w-lg mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 relative">
                    {/* Glowing effect strictly surrounding the box */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#FBBF24]/0 via-[#FBBF24]/20 to-[#FBBF24]/0 rounded-3xl blur-xl opacity-75"></div>

                    <div className="bg-[#161d24] border border-[#FBBF24]/30 rounded-2xl p-8 relative flex flex-col items-center shadow-2xl">
                        <h2 className="text-[#FBBF24] text-[11px] font-black tracking-widest uppercase mb-6 text-center shadow-sm">Exclusive Invite Code</h2>

                        <div className="flex items-center justify-center gap-2 md:gap-3 mb-8">
                            {inviteCode.padEnd(6, '-').substring(0, 6).split('').map((digit, index) => (
                                <div key={index} className="flex items-center justify-center">
                                    <div className={`w-10 h-14 md:w-12 md:h-16 flex items-center justify-center bg-[#0d1316] border border-white/10 rounded-xl text-2xl md:text-3xl font-black text-[#FBBF24] shadow-inner ${index === 3 ? 'ml-4' : ''}`}>
                                        {digit}
                                    </div>
                                    {index === 2 && <span className="text-gray-600 font-bold text-2xl mx-1 md:mx-2">-</span>}
                                </div>
                            ))}
                        </div>

                        <div className="w-full space-y-4 mb-6 text-left">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Link Expiry</label>
                                <div className="relative">
                                    <select 
                                        value={expiresDays}
                                        onChange={(e) => setExpiresDays(e.target.value)}
                                        className="w-full appearance-none bg-white dark:bg-[#0d1316] border border-gray-300 dark:border-white/10 rounded-xl py-3 pl-4 pr-10 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 cursor-pointer font-semibold transition-all shadow-sm"
                                    >
                                        <option value="1" className="bg-white dark:bg-[#0d1316] text-gray-900 dark:text-white py-1.5 font-medium">Expire in 24 Hours</option>
                                        <option value="7" className="bg-white dark:bg-[#0d1316] text-gray-900 dark:text-white py-1.5 font-medium">Expire in 7 Days</option>
                                        <option value="30" className="bg-white dark:bg-[#0d1316] text-gray-900 dark:text-white py-1.5 font-medium">Expire in 30 Days</option>
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-[#10B981] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Target Phone (Optional)</label>
                                <input 
                                    type="tel"
                                    value={targetPhone}
                                    onChange={(e) => setTargetPhone(e.target.value)}
                                    placeholder="Lock link to specific number (e.g. 07...)"
                                    className="w-full bg-white dark:bg-[#0d1316] border border-gray-300 dark:border-white/10 rounded-xl py-3 px-4 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all shadow-sm font-medium"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleCopyShare}
                            className="w-full flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold py-4 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98]"
                        >
                            {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                            {copied ? 'Copied to Clipboard!' : 'Copy Link & Share to WhatsApp'}
                        </button>
                    </div>
                </div>

                {/* Invitation Preview */}
                <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                    <div className="flex items-center gap-2 mb-3 px-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500">Invitation Preview</span>
                    </div>
                    <div className="bg-[#161d24] border border-white/5 rounded-xl p-5 md:p-6 text-gray-300 text-sm leading-relaxed shadow-lg font-mono whitespace-pre-wrap">
                        {`🏆 Join our FPL Chama — *Tentshakers FC*!\n\nWeekly cash pots & season prize vault on lock. Scores sync directly with official FPL API.\n\n👉 Join here: https://fantasy-chama.vercel.app/login?code=${inviteCode}\nLeague Code: *${inviteCode}*`}
                    </div>
                </div>

            </main>

            {/* Bottom Features Footer */}
            <footer className="w-full pb-10 flex flex-col items-center justify-center px-6 relative z-10 animate-in fade-in duration-1000 delay-500">
                <div className="flex flex-wrap items-center justify-center gap-x-12 md:gap-x-24 gap-y-6">
                    <div className="flex flex-col items-center gap-3 text-center group">
                        <div className="w-10 h-10 rounded-full bg-[#161d24] border border-white/5 flex items-center justify-center text-[#10B981] group-hover:bg-[#10B981]/10 transition-colors">
                            <Shield className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Secure Vault</span>
                    </div>

                    <div className="flex flex-col items-center gap-3 text-center group">
                        <div className="w-10 h-10 rounded-full bg-[#161d24] border border-white/5 flex items-center justify-center text-[#10B981] group-hover:bg-[#10B981]/10 transition-colors">
                            <Users className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Up to 20 Members</span>
                    </div>

                    <div className="flex flex-col items-center gap-3 text-center group">
                        <div className="w-10 h-10 rounded-full bg-[#161d24] border border-white/5 flex items-center justify-center text-[#10B981] group-hover:bg-[#10B981]/10 transition-colors">
                            <Zap className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Instant Payouts</span>
                    </div>
                </div>
            </footer>

        </div>
    );
}
