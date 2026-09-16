import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Shield, ArrowRight, Wallet, Smartphone, Copy, Check, Send, Info, AlertCircle, QrCode, Zap, CheckCircle2, MessageCircle, Trophy } from 'lucide-react';
import { useStore } from '../store/useStore';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function Deposit() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const activeUserId = localStorage.getItem('activeUserId');
    const memberPhone = localStorage.getItem('memberPhone') || '';
    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    const [baseStake, setBaseStake] = useState<number>(0);
    const [chairmanPhone, setChairmanPhone] = useState<string>('');
    const [leagueName, setLeagueName] = useState<string>('Your League');
    const [mpesaEnabled, setMpesaEnabled] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);
    const [isSubmittingPochiAck, setIsSubmittingPochiAck] = useState(false);
    const [pochiAckSent, setPochiAckSent] = useState(false);

    const location = useLocation();
    const currentMember = members.find(m => m.id === activeUserId);
    const isUpgrading = location.state?.upgradeMode || (currentMember as any)?.playMode === 'sidebets_only';

    const [paymentMode, setPaymentMode] = useState<'gw'|'month'|'custom'>('gw');
    const [customAmount, setCustomAmount] = useState<string>('');

    const [phoneNumber, setPhoneNumber] = useState(memberPhone.startsWith('0') ? `254${memberPhone.slice(1)}` : memberPhone || '254');

    useEffect(() => {
        if (activeLeagueId && members.length === 0) listenToLeagueMembers(activeLeagueId);
        if (activeLeagueId) {
            getDoc(doc(db, 'leagues', activeLeagueId)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setBaseStake(Number(data.gameweekStake ?? data.settings?.gameweekStake ?? 0));
                    setChairmanPhone(data.chairmanPhone || '');
                    setLeagueName(data.leagueName || 'Your League');
                    setMpesaEnabled(data.mpesaEnabled === true);
                }
            });
        }
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    const getFinalAmount = () => {
        if (paymentMode === 'gw') return baseStake;
        if (paymentMode === 'month') return baseStake * 4;
        return Number(customAmount) || 0;
    };
    const finalAmount = getFinalAmount();

    const handleCopyPhone = () => {
        if (!chairmanPhone) return;
        navigator.clipboard.writeText(chairmanPhone);
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2500);
    };

    const handlePochiAcknowledgement = async () => {
        if (!activeLeagueId || !activeUserId || finalAmount <= 0) return;
        setIsSubmittingPochiAck(true);
        try {
            const currentMember = members.find(m => m.id === activeUserId);
            const calculatedGws = baseStake > 0 ? Math.floor(finalAmount / baseStake) : 0;
            
            await addDoc(collection(db, 'leagues', activeLeagueId, 'wallet_requests'), {
                memberId: activeUserId,
                memberName: currentMember?.displayName || 'Member',
                memberPhone: currentMember?.phone || memberPhone,
                amount: finalAmount,
                calculatedGws,
                note: `Pochi transfer (${paymentMode === 'gw' ? 'This GW' : paymentMode === 'month' ? 'Full Month' : 'Custom'}) — KES ${finalAmount} for ${calculatedGws} GWs`,
                status: 'pending',
                type: 'pochi_deposit',
                createdAt: serverTimestamp(),
            });

            if (activeLeagueId && activeUserId && isUpgrading) {
                try {
                    await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', activeUserId), {
                        playMode: 'pot',
                        updatedAt: serverTimestamp()
                    });
                } catch (e) {
                    console.warn(e);
                }
            }

            setPochiAckSent(true);
            toast.success('Transfer confirmed! Chairman will verify and credit your wallet.');
        } catch {
            toast.error('Failed to send confirmation. Try again.');
        } finally {
            setIsSubmittingPochiAck(false);
        }
    };

    const handleStkPush = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber || finalAmount <= 0) return;
        setIsLoading(true);
        try {
            const { getApiBaseUrl, secureApiPost } = await import('../utils/api');
            const apiUrl = getApiBaseUrl();
            if (!apiUrl) throw new Error('Payment server not configured. Contact chairman.');
            const userId = activeUserId || members.find(m => m.phone === memberPhone)?.id || 'guest';
            const data = await secureApiPost(`${apiUrl}/api/mpesa/stkpush`, { phoneNumber, amount: finalAmount, leagueId: activeLeagueId, userId });
            if (data.success) {
                if (activeLeagueId && activeUserId && isUpgrading) {
                    try {
                        await updateDoc(doc(db, 'leagues', activeLeagueId, 'memberships', activeUserId), {
                            playMode: 'pot',
                            updatedAt: serverTimestamp()
                        });
                    } catch (e) {
                        console.warn(e);
                    }
                }
                toast.success(data.message || 'Check your phone for M-Pesa PIN prompt...');
            } else {
                throw new Error(data.message || 'Payment initiation failed');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to initiate M-Pesa push');
        } finally {
            setIsLoading(false);
        }
    };

    const amountModes = [
        { key: 'gw' as const, label: 'This GW', sublabel: '1 gameweek', amount: baseStake, icon: '⚡' },
        { key: 'month' as const, label: 'Full Month', sublabel: '4 gameweeks', amount: baseStake * 4, icon: '📅' },
        { key: 'custom' as const, label: 'Custom', sublabel: 'Enter amount', amount: 0, icon: '✏️' },
    ];

    const steps = [
        { n: '1', text: 'Open M-Pesa on your phone' },
        { n: '2', text: 'Lipa na M-Pesa → Pochi La Biashara' },
        { n: '3', text: <>Enter <strong className="text-white">{chairmanPhone || '...'}</strong></> },
        { n: '4', text: <>Amount: <strong className="text-[#10B981]">KES {finalAmount > 0 ? finalAmount.toLocaleString() : '...'}</strong></> },
        { n: '5', text: 'Enter your M-Pesa PIN & send' },
    ];

    return (
        <div className="relative p-5 md:p-8 w-full pb-28 font-sans text-white min-h-full overflow-y-auto flex flex-col items-center"
            style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.07) 0%, transparent 60%), #090d11' }}>

            {/* Ambient orbs */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)' }} />
                <div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)' }} />
            </div>

            <div className="relative z-10 w-full max-w-md">

                {/* ── HEADER ── */}
                <div className="text-center mb-8 fc-slide-up">
                    <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-[1.5rem] mb-5 fc-pulse-green"
                        style={{
                            background: 'linear-gradient(145deg, rgba(16,185,129,0.18), rgba(16,185,129,0.06))',
                            border: '1px solid rgba(16,185,129,0.25)',
                        }}>
                        <Wallet className="w-8 h-8 text-[#10B981]" />
                    </div>
                    <p className="fc-label mb-2 text-[#10B981]">Pay into League</p>
                    <h1 className="fc-hero-heading text-3xl md:text-4xl text-white mb-1">{leagueName}</h1>
                    <p className="text-gray-500 text-sm font-medium">Secure · Chairman-verified · Instant credit</p>
                </div>

                {isUpgrading && (
                    <div className="bg-[#FBBF24]/10 border border-[#FBBF24]/30 rounded-2xl p-4 mb-6 text-left flex items-start gap-3 shadow-[0_0_25px_rgba(251,191,36,0.1)]">
                        <Trophy className="w-5 h-5 text-[#FBBF24] shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-black text-[#FBBF24]">Upgrading to Weekly & Season Cash Pot</h3>
                            <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
                                Fund your wallet with at least 1 Gameweek stake to activate cash pot eligibility. You will compete for weekly 1st-place payouts and the season vault jackpot!
                            </p>
                        </div>
                    </div>
                )}

                {/* ── AMOUNT SELECTOR ── */}
                <div className="fc-card rounded-[1.5rem] p-5 mb-4 fc-slide-up" style={{ animationDelay: '0.05s' }}>
                    <p className="fc-label mb-3">Select Amount</p>
                    <div className="grid grid-cols-3 gap-2 mb-5">
                        {amountModes.map(mode => (
                            <button
                                key={mode.key}
                                onClick={() => setPaymentMode(mode.key)}
                                className={`relative py-3.5 px-2 rounded-[0.875rem] text-center transition-all duration-200 overflow-hidden ${
                                    paymentMode === mode.key
                                        ? 'bg-[#10B981]/12 border border-[#10B981]/35'
                                        : 'bg-white/[0.025] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
                                }`}
                            >
                                {paymentMode === mode.key && (
                                    <div className="absolute inset-0 rounded-[0.875rem]"
                                        style={{ boxShadow: 'inset 0 0 20px rgba(16,185,129,0.08)' }} />
                                )}
                                <p className="text-base mb-0.5">{mode.icon}</p>
                                <p className={`text-xs font-bold leading-none ${paymentMode === mode.key ? 'text-[#10B981]' : 'text-white'}`}>
                                    {mode.label}
                                </p>
                                <p className="text-[9px] text-gray-600 mt-1 leading-none">{mode.sublabel}</p>
                                {mode.amount > 0 && (
                                    <p className={`text-[10px] font-black mt-1 tabular-nums ${paymentMode === mode.key ? 'text-[#10B981]/80' : 'text-gray-500'}`}>
                                        {mode.amount.toLocaleString()}
                                    </p>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Amount display */}
                    <div className="rounded-[0.875rem] py-4 px-5 text-center"
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <p className="fc-label mb-2">Total</p>
                        {paymentMode === 'custom' ? (
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-lg font-bold text-gray-400">KES</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={customAmount}
                                    onFocus={e => e.target.select()}
                                    onChange={e => {
                                        const cleaned = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                                        setCustomAmount(cleaned);
                                    }}
                                    placeholder="0"
                                    className="bg-transparent text-5xl font-black text-white tabular-nums w-36 border-b-2 border-[#10B981]/40 focus:border-[#10B981] outline-none text-center transition-colors"
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-lg font-bold text-gray-400">KES</span>
                                <span className="text-5xl font-black text-white tabular-nums fc-mono" style={{ lineHeight: 1 }}>
                                    {finalAmount.toLocaleString()}
                                </span>
                            </div>
                        )}
                        {baseStake > 0 && paymentMode === 'month' && (
                            <p className="text-[10px] text-gray-600 mt-2">= {baseStake.toLocaleString()} × 4 gameweeks</p>
                        )}
                        {baseStake > 0 && paymentMode === 'custom' && Number(customAmount || 0) > 0 && (
                            <p className="text-[10px] text-emerald-500 font-bold mt-2">
                                Covers {Math.floor(Number(customAmount) / baseStake)} gameweek{Math.floor(Number(customAmount) / baseStake) !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>
                </div>

                {/* ── POCHI PRIMARY CARD ── */}
                <div className={`fc-card rounded-[1.5rem] overflow-hidden mb-4 fc-slide-up ${mpesaEnabled ? 'opacity-55' : ''}`}
                    style={{ animationDelay: '0.1s' }}>
                    <div className="p-5" style={{
                        background: 'linear-gradient(145deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)',
                        borderBottom: '1px solid rgba(16,185,129,0.12)',
                    }}>
                        {/* Card header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-[0.875rem] flex items-center justify-center"
                                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
                                <Smartphone className="w-5 h-5 text-[#10B981]" />
                            </div>
                            <div>
                                <p className="font-bold text-white text-sm leading-none mb-0.5">Pochi La Biashara</p>
                                <p className="text-[10px] text-[#10B981] font-semibold">Manual Transfer · Instant</p>
                            </div>
                            <div className="ml-auto">
                                <span className="text-[9px] font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-2.5 py-1 rounded-full uppercase tracking-widest">
                                    ● Primary
                                </span>
                            </div>
                        </div>

                        {chairmanPhone ? (
                            <>
                                {/* Phone display */}
                                <div className="rounded-[0.875rem] p-4 mb-4 flex items-center justify-between"
                                    style={{ background: 'rgba(5,12,9,0.7)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                    <div>
                                        <p className="fc-label mb-1">Send To (Pochi)</p>
                                        <p className="text-2xl font-black text-white tabular-nums tracking-tight fc-mono">{chairmanPhone}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Chairman's Pochi number</p>
                                    </div>
                                    <button
                                        onClick={handleCopyPhone}
                                        className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-[0.75rem] transition-all"
                                        style={{
                                            background: copiedPhone ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.1)',
                                            border: '1px solid rgba(16,185,129,0.3)',
                                            color: '#10B981',
                                        }}
                                    >
                                        {copiedPhone ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                                    </button>
                                </div>

                                {/* Step-by-step instructions */}
                                <div className="rounded-[0.875rem] p-4 mb-4"
                                    style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)' }}>
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <Info className="w-3.5 h-3.5 text-[#FBBF24]" />
                                        <p className="text-[10px] font-bold text-[#FBBF24] uppercase tracking-wider">How to pay</p>
                                    </div>
                                    <div className="space-y-2.5">
                                        {steps.map((step, i) => (
                                            <div key={i} className="flex items-start gap-2.5">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[9px] font-black"
                                                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
                                                    {step.n}
                                                </div>
                                                <p className="text-[11px] text-gray-400 leading-relaxed">{step.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* CTA */}
                                {pochiAckSent ? (
                                    <div className="space-y-3 fc-bounce-in">
                                        <div className="rounded-[0.875rem] p-4 flex items-center gap-3"
                                            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                            <CheckCircle2 className="w-6 h-6 text-[#10B981] flex-shrink-0" />
                                            <div>
                                                <p className="text-[#10B981] font-bold text-sm">Confirmation logged!</p>
                                                <p className="text-gray-400 text-xs mt-0.5">Chairman has received your in-app request.</p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentMember = members.find(m => m.id === activeUserId);
                                                const senderName = currentMember?.displayName || 'A Member';
                                                const msg = `*M-Pesa Pochi Payment Notification*\n\n` +
                                                    `🏆 *League:* ${leagueName}\n` +
                                                    `👤 *Member:* ${senderName} (${currentMember?.phone || memberPhone})\n` +
                                                    `💰 *Amount:* KES ${finalAmount.toLocaleString()}\n\n` +
                                                    `I have sent the funds via Pochi La Biashara. Kindly confirm and credit my wallet on FantasyChama. Thank you!`;
                                                
                                                const targetPhone = chairmanPhone.startsWith('0') ? `254${chairmanPhone.slice(1)}` : chairmanPhone;
                                                window.open(`https://wa.me/${targetPhone || ''}?text=${encodeURIComponent(msg)}`, '_blank');
                                            }}
                                            className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,211,102,0.25)] hover:scale-[1.01] active:scale-95 cursor-pointer"
                                        >
                                            <MessageCircle className="w-4 h-4 fill-current" /> Share Receipt with Chairman on WhatsApp
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handlePochiAcknowledgement}
                                        disabled={isSubmittingPochiAck || finalAmount <= 0}
                                        className="w-full font-black py-4 rounded-[0.875rem] flex items-center justify-center gap-2.5 transition-all text-sm disabled:opacity-50"
                                        style={{
                                            background: finalAmount > 0 ? '#10B981' : 'rgba(16,185,129,0.3)',
                                            color: '#030a06',
                                            boxShadow: finalAmount > 0 ? '0 0 30px rgba(16,185,129,0.25), 0 4px 12px rgba(0,0,0,0.2)' : 'none',
                                        }}
                                    >
                                        {isSubmittingPochiAck ? (
                                            <><span className="w-4 h-4 border-2 border-black/40 border-t-transparent rounded-full animate-spin" /> Confirming...</>
                                        ) : (
                                            <><Send className="w-4 h-4" /> I've Sent KES {finalAmount > 0 ? finalAmount.toLocaleString() : '...'} via Pochi</>
                                        )}
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-6">
                                <AlertCircle className="w-10 h-10 text-[#FBBF24] mx-auto mb-3 opacity-70" />
                                <p className="text-gray-300 text-sm font-semibold">Pochi not configured yet</p>
                                <p className="text-gray-600 text-xs mt-1.5 max-w-[220px] mx-auto leading-relaxed">Ask your chairman to add their Pochi number in Profile settings.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── STK PUSH SECONDARY CARD ── */}
                <div className="fc-card rounded-[1.5rem] overflow-hidden mb-4 fc-slide-up" style={{ animationDelay: '0.15s' }}>
                    <div className={`p-5 ${!mpesaEnabled ? 'opacity-45' : ''}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-[0.875rem] flex items-center justify-center"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <QrCode className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm leading-none mb-0.5">M-Pesa STK Push</p>
                                    <p className="text-[10px] text-gray-500 font-medium">Automated payment prompt</p>
                                </div>
                            </div>
                            {!mpesaEnabled && (
                                <span className="text-[9px] font-bold px-2.5 py-1.5 rounded-full uppercase tracking-widest"
                                    style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                                    Coming Soon
                                </span>
                            )}
                        </div>

                        {!mpesaEnabled ? (
                            <div className="rounded-[0.875rem] p-4"
                                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="flex items-start gap-3">
                                    <Zap className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600 text-[11px] leading-relaxed">
                                        Automatic M-Pesa paybill integration is being configured. Once your chairman enables it, payments will be triggered directly from this app.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleStkPush} className="space-y-4">
                                <div>
                                    <label className="fc-label mb-1.5 block">M-Pesa Number</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-4 flex items-center text-gray-500 text-sm font-bold">+254</span>
                                        <input
                                            type="text"
                                            value={phoneNumber.replace('254', '')}
                                            onChange={e => setPhoneNumber(`254${e.target.value.replace(/\D/g, '').slice(0, 9)}`)}
                                            className="fc-input pl-14"
                                            placeholder="7X XXXXXXX"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading || finalAmount <= 0}
                                    className="w-full flex items-center justify-center gap-2 font-black py-4 px-6 rounded-[0.875rem] text-sm transition-all disabled:opacity-50"
                                    style={{ background: '#FBBF24', color: '#0a0700', boxShadow: '0 0 20px rgba(251,191,36,0.2)' }}
                                >
                                    {isLoading ? (
                                        <><span className="w-4 h-4 border-2 border-black/40 border-t-transparent rounded-full animate-spin" /> Awaiting PIN...</>
                                    ) : (
                                        <>Push KES {finalAmount > 0 ? finalAmount.toLocaleString() : '...'} to my Phone <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-2 flex items-center justify-center gap-2 text-gray-600 text-[10px] font-medium fc-slide-up" style={{ animationDelay: '0.2s' }}>
                    <Shield className="w-3.5 h-3.5" />
                    <span>All payments are chairman-verified before wallet credit</span>
                </div>
            </div>
        </div>
    );
}
