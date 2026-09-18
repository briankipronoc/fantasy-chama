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

    const handleDismissOrClose = () => {
        if (activeLeagueId) {
            try {
                localStorage.setItem(`fc_rules_accepted_${activeLeagueId}`, 'true');
                localStorage.setItem(`fc_constitution_dismissed_${activeLeagueId}`, 'true');
                localStorage.setItem('fc_constitution_dismissed', 'true');
                sessionStorage.removeItem('fc_show_constitution_onboarded');
            } catch {}
        }
        onClose();
    };

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDismissOrClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Check if content already fits on screen or is scrolled to bottom
    useEffect(() => {
        if (!isOpen) return;
        if (hasAccepted) {
            setHasScrolledToBottom(true);
            return;
        }

        const checkFit = () => {
            const el = contentRef.current;
            if (!el) return;
            // On tablets / large screens where the entire modal content fits without scrolling,
            // or when already scrolled near bottom, unlock immediately.
            if (el.scrollHeight - el.clientHeight <= 60 || (el.scrollHeight - el.scrollTop - el.clientHeight < 80)) {
                setHasScrolledToBottom(true);
            }
        };

        const timer = setTimeout(checkFit, 100);
        return () => clearTimeout(timer);
    }, [isOpen, hasAccepted]);

    // Track scroll position
    const handleContentScroll = () => {
        if (hasScrolledToBottom || hasAccepted) return;
        const el = contentRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (nearBottom) setHasScrolledToBottom(true);
    };

    const handleAccept = async () => {
        setIsAccepting(true);
        try {
            if (activeLeagueId) {
                try {
                    localStorage.setItem(`fc_rules_accepted_${activeLeagueId}`, 'true');
                    localStorage.setItem(`fc_constitution_dismissed_${activeLeagueId}`, 'true');
                    localStorage.setItem('fc_constitution_dismissed', 'true');
                    sessionStorage.removeItem('fc_show_constitution_onboarded');
                } catch {}
            }

            const targetMemberId = currentMember?.id || localStorage.getItem('activeUserId');
            if (activeLeagueId && targetMemberId) {
                // Asynchronously update Firestore without blocking UI transition if network is slow
                updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', targetMemberId), {
                    hasAcceptedRules: true
                }).catch(err => {
                    console.warn('[rules-modal] Firestore updateDoc failed:', err);
                });
            }

            toast.success('League Constitution accepted! Welcome aboard!');
            onClose();
        } catch (e: any) {
            console.error("Failed to accept rules:", e);
            onClose();
        } finally {
            setIsAccepting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={overlayRef}
            className="fc-rules-overlay fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto p-2 md:p-4"
            onClick={(e) => { if (e.target === overlayRef.current) handleDismissOrClose(); }}
        >
            {/* Backdrop */}
            <div className="fc-rules-backdrop absolute inset-0 bg-black/75 backdrop-blur-md animate-in fade-in duration-200" />

            {/* Modal Body - Centered Card */}
            <div className="fc-rules-modal relative w-full max-w-2xl max-h-[88vh] my-auto flex flex-col bg-[#0d1117] border border-white/10 rounded-2xl md:rounded-[1.75rem] shadow-2xl shadow-black/80 animate-in zoom-in-95 slide-in-from-bottom-3 fade-in duration-300 overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.06),transparent_34%)]" />

                {/* Header */}
                <div className="fc-rules-header sticky top-0 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] flex-shrink-0 bg-[#0d1117]/95 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-4.5 h-4.5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="fc-rules-kicker text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">
                                {hasAccepted ? 'Already Signed' : 'Signature Required'}
                            </p>
                            <h2 className="fc-rules-heading text-base font-black tracking-tight text-white">
                                {leagueName ? `${leagueName} : League Constitution` : 'League Constitution'}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleDismissOrClose}
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                        aria-label="Close"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
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
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (contentRef.current) {
                                            contentRef.current.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' });
                                            setHasScrolledToBottom(true);
                                        }
                                    }}
                                    className="flex items-center gap-1.5 text-gray-400 hover:text-emerald-400 text-xs transition-colors flex-shrink-0 cursor-pointer"
                                >
                                    <ChevronDown className="w-4 h-4 animate-bounce text-emerald-400" />
                                    <span>Scroll rules</span>
                                </button>
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
                    {/* Rules */}
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
                            icon: <Wallet className="w-5 h-5 text-[#10B981] flex-shrink-0" />,
                            iconBg: 'bg-emerald-500/10 border-emerald-500/20',
                            label: 'WALLET ARCHITECTURE',
                            labelColor: 'text-emerald-400',
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
                            icon: <Scale className="w-5 h-5 text-[#FBBF24] flex-shrink-0" />,
                            iconBg: 'bg-amber-500/10 border-amber-500/20',
                            label: 'TRANSPARENCY & DISPUTES',
                            labelColor: 'text-[#FBBF24]',
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
                    <p className="fc-rules-footnote text-[10px] text-gray-500 text-center pb-2">
                        These rules are enforced automatically by the FantasyChama smart escrow system.
                        Questions? Contact your Chairman or use the Dispute feature.
                    </p>
                </div>

                {/* Footer CTA */}
                <div className="px-6 py-4 border-t border-white/[0.06] flex-shrink-0 bg-[#0d1117]/95 space-y-2">
                    {!hasAccepted && !hasScrolledToBottom && (
                        <button
                            type="button"
                            onClick={() => {
                                if (contentRef.current) {
                                    contentRef.current.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' });
                                    setHasScrolledToBottom(true);
                                }
                            }}
                            className="w-full text-center text-[11px] text-gray-400 hover:text-emerald-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer py-0.5"
                        >
                            <ChevronDown className="w-3.5 h-3.5 animate-bounce text-emerald-400" />
                            <span>Tap or scroll to review full constitution</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleAccept}
                        disabled={isAccepting}
                        className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-[0.98] text-sm flex items-center justify-center gap-2 cursor-pointer select-none"
                    >
                        {isAccepting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Entering League...</span>
                            </>
                        ) : hasAccepted ? (
                            <>✓ Constitution Signed · Continue</>
                        ) : (
                            <>🛡️ I Accept & Enter League</>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
