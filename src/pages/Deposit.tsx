import { useState, useEffect } from 'react';
import { Smartphone, Shield, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getApiBaseUrl } from '../utils/api';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import clsx from 'clsx';

export default function Deposit() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    const [phoneNumber, setPhoneNumber] = useState('254700000000');
    const [amountDue, setAmountDue] = useState<number | null>(null);
    const [chairmanPhone, setChairmanPhone] = useState<string>('Not configured');
    const [leagueName, setLeagueName] = useState<string>('Your League');
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (activeLeagueId && members.length === 0) {
            listenToLeagueMembers(activeLeagueId);
        }

        // Fetch dynamic amount due
        if (activeLeagueId) {
            getDoc(doc(db, 'leagues', activeLeagueId)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    const stake = Number(data.gameweekStake ?? data.settings?.gameweekStake ?? 0);
                    setAmountDue(stake > 0 ? stake : null);
                    setChairmanPhone(data.chairmanPhone || 'Not configured');
                    setLeagueName(data.leagueName || 'Your League');
                }
            });
        }
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber) return;

        setIsLoading(true);
        setToast(null);

        try {
            const apiUrl = getApiBaseUrl();
            if (!apiUrl) throw new Error('Payment server is not configured. Set VITE_API_URL for production.');
            const activeUserId = localStorage.getItem('activeUserId') || members.find(m => m.phone === phoneNumber)?.id || 'guest';

            const response = await fetch(`${apiUrl}/api/mpesa/stkpush`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phoneNumber,
                    amount: amountDue || 0,
                    leagueId: activeLeagueId,
                    userId: activeUserId
                })
            });

            const data = await response.json();

            if (data.success) {
                setToast({ message: data.message || 'Awaiting M-Pesa PIN...', type: 'success' });
            } else {
                throw new Error(data.message || 'Payment failed');
            }
        } catch (error: any) {
            setToast({ message: error.message || 'Failed to initiate M-Pesa push. Is the backend running?', type: 'error' });
            console.error(error);
        } finally {
            setIsLoading(false);
            // Auto hide toast
            setTimeout(() => setToast(null), 5000);
        }
    };

    useEffect(() => {
        if (!toast) return;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [toast]);

    return (
        <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#111613] flex flex-col items-center justify-center">

            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#22C55E]/10 mb-4">
                        <Smartphone className="w-8 h-8 text-[#22C55E]" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">Fund the Vault</h1>
                    <p className="text-gray-400 font-medium tracking-wide">
                        Secure M-Pesa deposit to clear your 🔴 Red Zone status.
                    </p>
                </div>

                <div className="bg-[#151c18] border border-white/5 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                    {/* Glassmorphism ambient glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e] blur-[100px] opacity-10 transform translate-x-10 -translate-y-10"></div>

                    <div className="mb-8 text-center">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Amount Due</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-xl font-bold text-gray-400">KES</span>
                            <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{amountDue?.toLocaleString() || '---'}</span>
                        </div>
                    </div>

                    <div className="mb-6 rounded-xl border border-[#22c55e]/20 bg-[#0a100a]/60 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#22c55e] mb-1">Pochi Destination</p>
                        <p className="text-sm font-bold text-white">{leagueName}</p>
                        <p className="text-xs text-gray-400 mt-1">Send to Chairman Pochi Number</p>
                        <p className="text-lg font-black text-[#22c55e] tabular-nums mt-1">{chairmanPhone}</p>
                    </div>

                    <form onSubmit={handlePayment} className="space-y-6 relative z-10">
                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Number</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                                    +254
                                </span>
                                <input
                                    type="text"
                                    value={phoneNumber.replace('254', '')}
                                    onChange={(e) => setPhoneNumber(`254${e.target.value.replace(/\D/g, '').slice(0, 9)}`)}
                                    className="w-full bg-[#0a100a] border border-white/10 rounded-xl py-4 pl-14 pr-4 text-lg font-bold focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] transition-all placeholder:text-gray-600 text-white outline-none"
                                    placeholder="7X XXXXXXX"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !amountDue}
                            className="w-full flex items-center justify-center gap-3 bg-[#22c55e] hover:bg-[#1ea54c] text-[#0a100a] py-4 px-6 rounded-xl font-extrabold text-lg transition-colors disabled:opacity-70"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-[#0a100a] border-t-transparent rounded-full animate-spin"></div>
                                    Awaiting PIN...
                                </>
                            ) : (
                                <>
                                    Pay with M-Pesa <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-xs font-medium">
                        <Shield className="w-4 h-4" /> Protected by Daraja 2.0 Encryption
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            <div className={clsx(
                "fixed top-4 right-4 left-auto w-[calc(100vw-2rem)] md:w-96 p-4 rounded-2xl shadow-2xl transition-all duration-300 transform flex items-start gap-4 z-50 fc-inline-toast",
                toast ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none",
                toast?.type === 'success' ? "fc-inline-toast-success" : "fc-inline-toast-error"
            )}>
                {toast?.type === 'success' ? <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />}
                <div>
                    <h4 className="font-extrabold text-base mb-1">{toast?.type === 'success' ? 'Push Sent' : 'Error'}</h4>
                    <p className="font-medium text-sm leading-tight opacity-90">{toast?.message}</p>
                </div>
            </div>

        </div>
    );
}
