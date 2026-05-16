import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, Wallet, AlertTriangle, Scale, Shield, Loader2, ChevronDown } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface LeagueRulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentMember: any;
    leagueName?: string;
    chairmanName?: string;
}

export default function LeagueRulesModal({ isOpen, onClose, currentMember, leagueName, chairmanName }: LeagueRulesModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const [gameweekStake, setMonthlyContribution] = useState<number | null>(null);
    const [isAccepting, setIsAccepting] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

    const hasAccepted = currentMember?.hasAcceptedRules === true || currentMember?.role === 'admin';

    useEffect(() => {
        if (!activeLeagueId) return;
        getDoc(doc(db, 'leagues', activeLeagueId)).then(snap => {
            if (snap.exists()) setMonthlyContribution(snap.data().gameweekStake || 0);
        }).catch((error) => {
            console.warn('[rules modal] getDoc failed:', error?.message || error);
        });
    }, [activeLeagueId]);

    // Close on Escape key only if they have accepted
    useEffect(() => {
        if (!isOpen || !hasAccepted) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose, hasAccepted]);

    // Prevent body scroll when open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setHasScrolledToBottom(hasAccepted); // if already accepted, unlock immediately
        const timer = window.requestAnimationFrame(() => {
            if (contentRef.current) contentRef.current.scrollTop = 0;
            if (overlayRef.current) overlayRef.current.scrollTop = 0;
        });
        return () => window.cancelAnimationFrame(timer);
    }, [isOpen, hasAccepted]);

    // Track scroll position to unlock the sign button
    const handleContentScroll = () => {
        if (hasScrolledToBottom || hasAccepted) return;
        const el = contentRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (nearBottom) setHasScrolledToBottom(true);
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={overlayRef}
            className="fc-rules-overlay fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto p-2 md:p-4"
            onClick={(e) => { if (e.target === overlayRef.current && hasAccepted) onClose(); }}
        >
            {/* Backdrop */}
            <div className="fc-rules-backdrop absolute inset-0 bg-black/70 animate-in fade-in duration-200" />

            {/* Modal Body */}
            <div className="fc-rules-modal relative w-full md:w-[min(96vw,72rem)] h-[calc(100dvh-1rem)] md:h-[calc(100dvh-2rem)] max-h-[calc(100dvh-1rem)] md:max-h-[calc(100dvh-2rem)] flex flex-col bg-[#0d1117] border border-white/10 rounded-2xl md:rounded-[1.75rem] shadow-2xl shadow-black/70 animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.06),transparent_34%)]" />

                {/* Header */}
                <div className="fc-rules-header sticky top-0 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] flex-shrink-0 bg-[#0d1117]/90 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-4.5 h-4.5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="fc-rules-kicker text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">
                                {hasAccepted ? 'Already Signed' : 'Signature Required'}
                            </p>
                            <h2 className="fc-rules-heading text-base font-black tracking-tight text-white">
                                {leagueName ? `${leagueName} — League Constitution` : 'League Constitution'}
                            </h2>
                        </div>
                    </div>
                    {hasAccepted && (
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-white transition-all active:scale-95"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* First-login intro banner */}
                {!hasAccepted && (
                    <div className="px-6 pt-5 pb-0 flex-shrink-0">
                        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="flex-1">
                                <p className="text-sm font-black text-white mb-1">
                                    Welcome to {leagueName || 'the league'}!
                                </p>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Before you enter, read and accept the rules below.
                                    {chairmanName && <> <span className="text-emerald-400 font-bold">{chairmanName}</span> has set these terms for all members.</>}
                                    {gameweekStake && <> Your weekly stake is <span className="text-[#FBBF24] font-bold">KES {gameweekStake.toLocaleString()}</span>.</>}
                                </p>
                            </div>
                            {!hasScrolledToBottom && (
                                <div className="flex items-center gap-1.5 text-gray-500 text-xs animate-bounce flex-shrink-0">
                                    <ChevronDown className="w-4 h-4" />
                                    <span>Scroll to unlock</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Scrollable Content */}
                <div
                    ref={contentRef}
                    onScroll={handleContentScroll}
                    className="fc-rules-content overflow-y-auto flex-1 px-6 py-5 space-y-4"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e2935 transparent' }}
                >
                    {hasAccepted && (
                        <div className="fc-rules-accepted-banner rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 mb-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">You are good to go</p>
                            <p className="text-sm text-emerald-50/90 mt-1">You have already accepted the constitution. Review it anytime without signing again.</p>
                        </div>
                    )}
                    {/* Rules map moved inline */}
                    {[
                        {
                            id: 'escrow',
                            icon: <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
                            iconBg: 'bg-emerald-500/10 border-emerald-500/20',
                            label: 'THE ESCROW SYSTEM',
                            labelColor: 'text-emerald-400',
                            title: 'Trustless Vault',
                            body: 'Your funds are secured in the FantasyChama Vault and are visible to every member in real-time. No Chairman holds your money in a personal account. Payouts are dispatched automatically via Safaricom M-Pesa B2C the moment a Gameweek resolves and the Co-Chair countersigns.',
                        },
                        {
                            id: 'wallet',
                            icon: <Wallet className="w-5 h-5 text-blue-400 flex-shrink-0" />,
                            iconBg: 'bg-blue-500/10 border-blue-500/20',
                            label: 'WALLET ARCHITECTURE',
                            labelColor: 'text-blue-400',
                            title: 'Deposit Once. Play All Season.',
                            body: `There are no weekly manual transfers. Deposit your contribution securely via M-Pesa STK Push (e.g. KES ${gameweekStake !== null ? gameweekStake : '...'}) and the system automatically deducts your Gameweek stake before each FPL deadline. Top up at any time from the Deposit screen.`,
                        },
                        {
                            id: 'redzone',
                            icon: <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />,
                            iconBg: 'bg-red-500/10 border-red-500/20',
                            label: '🚨 THE GOLDEN RULE',
                            labelColor: 'text-red-400',
                            title: 'Green Zone vs. Red Zone',
                            body: null,
                            custom: (
                                <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
                                    <p>
                                        If your wallet balance cannot cover the Gameweek stake when the deadline arrives,
                                        you are automatically placed in the <span className="text-red-400 font-bold">Red Zone</span>.
                                    </p>
                                    <div className="fc-golden-rule-alert bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                                        <p className="font-black text-red-400 text-xs uppercase tracking-widest mb-1">No Exceptions</p>
                                        <p>
                                                If you are the <strong className="fc-golden-rule-strong text-white">top FPL scorer</strong> in a Gameweek but your wallet is in the Red Zone,
                                            you <strong className="text-red-400">forfeit the weekly pot</strong>. The winnings go to the next
                                            highest-scoring member in the <span className="text-emerald-400 font-bold">Green Zone</span>.
                                        </p>
                                    </div>
                                        <p className="fc-golden-rule-note text-xs text-gray-500">
                                        The Red Zone banner on your dashboard persists until you top up.
                                    </p>
                                </div>
                            ),
                        },
                        {
                            id: 'transparency',
                            icon: <Scale className="w-5 h-5 text-purple-400 flex-shrink-0" />,
                            iconBg: 'bg-purple-500/10 border-purple-500/20',
                            label: 'TRANSPARENCY & DISPUTES',
                            labelColor: 'text-purple-400',
                            title: 'Maker/Checker & Claim Payment',
                            body: 'All payouts require Maker/Checker Co-Chair approval to make sure no single person can unilaterally move funds. If an M-Pesa STK Push fails or your balance doesn\'t update, use the "Claim Payment" feature in your Profile with your M-Pesa SMS receipt code. The Chairman will verify and credit your wallet.',
                        },
                    ].map((rule) => (
                        <div
                            key={rule.id}
                            className={`fc-rules-card rounded-2xl border p-5 ${rule.id === 'redzone'
                                ? 'bg-amber-950/20 border-amber-500/20'
                                : 'bg-white/[0.02] border-white/[0.06]'
                                }`}
                        >
                            <div className="flex items-start gap-3 mb-3">
                                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${rule.iconBg}`}>
                                    {rule.icon}
                                </div>
                                <div>
                                    <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${rule.labelColor}`}>
                                        {rule.label}
                                    </p>
                                    <h3 className="fc-rules-title font-black text-sm text-white">{rule.title}</h3>
                                </div>
                            </div>
                            {rule.custom ?? (
                                <p className="fc-rules-body text-sm text-gray-600 dark:text-gray-400 leading-relaxed pl-12">
                                    {rule.body}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* Footer note */}
                    <p className="fc-rules-footnote text-[10px] text-gray-600 text-center pb-2">
                        These rules are enforced automatically by the FantasyChama smart escrow system.
                        Questions? Contact your Chairman or use the Dispute feature.
                    </p>
                </div>

                {/* Footer CTA - Only show if they haven't accepted yet */}
                {!hasAccepted && (
                    <div className="px-6 py-4 border-t border-white/[0.06] flex-shrink-0 bg-[#0d1117]/80 space-y-2">
                        {!hasScrolledToBottom && (
                            <p className="text-center text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
                                <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
                                Read the full constitution to unlock your signature
                            </p>
                        )}
                        <button
                            onClick={async () => {
                                if (!hasScrolledToBottom) return;
                                setIsAccepting(true);
                                try {
                                    if (activeLeagueId && currentMember) {
                                        await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', currentMember.id), {
                                            hasAcceptedRules: true
                                        });
                                    }
                                    onClose();
                                } catch (e: any) {
                                    console.error("Failed to accept rules:", e);
                                    toast.error(e.message || "Failed to save preference. Please check your connection.");
                                } finally {
                                    setIsAccepting(false);
                                }
                            }}
                            disabled={isAccepting || !hasScrolledToBottom}
                            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                        >
                            {isAccepting
                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                : hasScrolledToBottom
                                    ? <>🛡️ I Accept — Enter the War Room</>
                                    : <>Scroll to unlock signature</>
                            }
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
