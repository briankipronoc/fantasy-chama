import { useState, useEffect } from 'react';
import { Shield, ArrowRight, Wallet } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getApiBaseUrl } from '../utils/api';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function Deposit() {
    const activeLeagueId = localStorage.getItem('activeLeagueId');
    const members = useStore(state => state.members);
    const listenToLeagueMembers = useStore(state => state.listenToLeagueMembers);

    const [phoneNumber, setPhoneNumber] = useState('254700000000');
    const [baseStake, setBaseStake] = useState<number>(0);
    const [chairmanPhone, setChairmanPhone] = useState<string>('Not configured');
    const [leagueName, setLeagueName] = useState<string>('Your League');
    const [isLoading, setIsLoading] = useState(false);

    // Payment modes: 'gw', 'month', 'custom'
    const [paymentMode, setPaymentMode] = useState<'gw'|'month'|'custom'>('gw');
    const [customAmount, setCustomAmount] = useState<string>('');

    useEffect(() => {
        if (activeLeagueId && members.length === 0) {
            listenToLeagueMembers(activeLeagueId);
        }

        if (activeLeagueId) {
            getDoc(doc(db, 'leagues', activeLeagueId)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    const stake = Number(data.gameweekStake ?? data.settings?.gameweekStake ?? 0);
                    setBaseStake(stake);
                    setChairmanPhone(data.chairmanPhone || 'Not configured');
                    setLeagueName(data.leagueName || 'Your League');
                }
            });
        }
    }, [activeLeagueId, listenToLeagueMembers, members.length]);

    const getFinalAmount = () => {
        if (paymentMode === 'gw') return baseStake;
        if (paymentMode === 'month') return baseStake * 4;
        return Number(customAmount) || 0;
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = getFinalAmount();
        if (!phoneNumber || amount <= 0) return;

        setIsLoading(true);

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
                    amount: amount,
                    leagueId: activeLeagueId,
                    userId: activeUserId
                })
            });

            const data = await response.json();

            if (data.success) {
                toast.success(data.message || 'Awaiting M-Pesa PIN...');
            } else {
                throw new Error(data.message || 'Payment failed');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to initiate M-Pesa push. Is the backend running?');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const finalAmount = getFinalAmount();

    return (
        <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#111613] flex flex-col items-center justify-center">

            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#22C55E]/10 mb-4">
                        <Wallet className="w-8 h-8 text-[#22C55E]" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">Top Up Wallet</h1>
                    <p className="text-gray-600 dark:text-gray-400 font-medium text-sm tracking-wide">
                        Add funds to your FantasyChama wallet via M-Pesa.
                    </p>
                </div>

                <div className="bg-[#151c18] border border-white/5 p-6 md:p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e] blur-[100px] opacity-10 transform translate-x-10 -translate-y-10"></div>

                    <div className="mb-6 flex gap-2">
                        <button 
                            type="button"
                            onClick={() => setPaymentMode('month')}
                            className={`flex-1 py-2 px-1 rounded-lg border text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${paymentMode === 'month' ? 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e]' : 'bg-transparent border-gray-700 text-gray-500'}`}
                        >
                            Month (4 GWs)
                        </button>
                        <button 
                            type="button"
                            onClick={() => setPaymentMode('gw')}
                            className={`flex-1 py-2 px-1 rounded-lg border text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${paymentMode === 'gw' ? 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e]' : 'bg-transparent border-gray-700 text-gray-500'}`}
                        >
                            This GW
                        </button>
                        <button 
                            type="button"
                            onClick={() => setPaymentMode('custom')}
                            className={`flex-1 py-2 px-1 rounded-lg border text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${paymentMode === 'custom' ? 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e]' : 'bg-transparent border-gray-700 text-gray-500'}`}
                        >
                            Custom
                        </button>
                    </div>

                    <div className="mb-8 text-center transition-all">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Deposit Amount</p>
                        
                        {paymentMode === 'custom' ? (
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-xl font-bold text-gray-600 dark:text-gray-400">KES</span>
                                <input 
                                    type="number" 
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    placeholder="e.g. 50"
                                    className="bg-transparent text-5xl font-black text-white tabular-nums tracking-tighter w-32 border-b-2 border-[#22c55e]/50 focus:border-[#22c55e] outline-none text-center"
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-xl font-bold text-gray-600 dark:text-gray-400">KES</span>
                                <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{finalAmount.toLocaleString()}</span>
                            </div>
                        )}
                        {paymentMode === 'custom' && (
                            <p className="text-[10px] mt-2 text-yellow-500/80 uppercase font-black tracking-widest">💸 Student / Micro Payment</p>
                        )}
                    </div>

                    <div className="mb-6 rounded-xl border border-[#22c55e]/20 bg-[#0a100a]/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#22c55e] mb-1">Pochi Transfer</p>
                            <p className="text-sm font-bold text-white">{leagueName}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">To Chairman: <span className="text-white font-bold">{chairmanPhone}</span></p>
                        </div>
                    </div>

                    <form onSubmit={handlePayment} className="space-y-6 relative z-10">
                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">M-Pesa Number</label>
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
                            disabled={isLoading || finalAmount <= 0}
                            className="w-full flex items-center justify-center gap-3 bg-[#22c55e] hover:bg-[#1ea54c] text-[#0a100a] py-4 px-6 rounded-xl font-extrabold text-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-[#0a100a] border-t-transparent rounded-full animate-spin"></div>
                                    Awaiting PIN...
                                </>
                            ) : (
                                <>
                                    Top Up {finalAmount > 0 ? `KES ${finalAmount}` : ''} <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-xs font-medium">
                        <Shield className="w-4 h-4" /> Protected by Daraja 2.0 Encryption
                    </div>
                </div>
            </div>
        </div>
    );
}
