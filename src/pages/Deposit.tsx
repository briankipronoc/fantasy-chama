import { Wallet, Smartphone, ShieldCheck, ShoppingCart, HelpCircle } from 'lucide-react';

export default function Deposit() {
    return (
        <div className="p-6 md:p-10 w-full animate-in fade-in duration-500 pb-24 font-sans text-white h-full overflow-y-auto bg-[#111613]">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Deposit Funds</h1>
                    <p className="text-[#22c55e] font-medium tracking-wide">Securely contribute to your chama circle</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-white">
                    {/* Main Payment Form */}
                    <div className="lg:col-span-2 flex flex-col gap-6">

                        {/* M-Pesa STK Feature Card */}
                        <div className="relative overflow-hidden rounded-2xl bg-[#151c18] border border-white/5 p-6 flex flex-col md:flex-row gap-6 items-center shadow-lg">
                            <div className="w-full md:w-1/3 aspect-video rounded-xl bg-cover bg-center flex items-center justify-center bg-[#0a100a] border border-[#22c55e]/20" style={{ backgroundImage: "linear-gradient(rgba(10,16,10,0.8), rgba(10,16,10,0.8))" }}>
                                <Smartphone className="text-[#22c55e] w-12 h-12" />
                            </div>
                            <div className="flex-1 flex flex-col gap-2 text-center md:text-left">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#22c55e]">Recommended Method</span>
                                <h3 className="text-2xl font-extrabold text-white">M-Pesa STK Push</h3>
                                <p className="text-gray-400 text-sm">Fast & secure mobile money transfer. A prompt will appear on your phone to enter your PIN.</p>
                            </div>
                        </div>

                        {/* Input Fields Section */}
                        <div className="bg-[#1a241c] rounded-2xl p-6 md:p-8 border border-white/5 shadow-lg flex flex-col gap-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                <Wallet className="text-[#22c55e] w-6 h-6" />
                                Transaction Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Amount to Deposit (KES)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">KES</span>
                                        <input
                                            type="number"
                                            className="w-full pl-14 pr-4 py-4 rounded-xl bg-[#0a100a] border border-white/10 focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] text-xl font-bold text-white transition-all outline-none"
                                            defaultValue="1400"
                                        />
                                    </div>
                                    <p className="text-[11px] font-bold text-[#eab308]">Suggested: Monthly Contribution</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">M-Pesa Phone Number</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                            <Smartphone className="w-5 h-5" />
                                        </span>
                                        <input
                                            type="tel"
                                            className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#0a100a] border border-white/10 focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] text-xl font-bold text-white transition-all outline-none"
                                            placeholder="07XX XXX XXX"
                                            defaultValue="0712 345 678"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button className="w-full py-5 rounded-xl bg-[#4ade80] hover:bg-[#22c55e] text-[#0a100a] font-extrabold text-lg flex items-center justify-center gap-3 transition-colors shadow-[0_0_20px_rgba(34,197,94,0.15)] mt-4">
                                <span className="material-symbols-outlined font-bold">send_to_mobile</span>
                                PAY WITH M-PESA
                            </button>
                        </div>

                        {/* Security Guarantee */}
                        <div className="flex items-start gap-4 p-5 rounded-xl bg-[#0a100a] border-l-4 border-[#22c55e] border-y border-y-white/5 border-r border-r-white/5 shadow-md">
                            <ShieldCheck className="text-[#22c55e] w-8 h-8 shrink-0" />
                            <div>
                                <h4 className="font-bold text-white mb-1">Security Guarantee</h4>
                                <p className="text-sm text-gray-400 leading-relaxed font-medium">
                                    Your funds are held in a secure, audited escrow vault. Contributions are only released based on the chama's smart contract rules. Encrypted by AES-256.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Transaction Preview (Right Sidebar) */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-[#151c18] border border-[#22c55e]/20 rounded-2xl p-6 shadow-lg lg:sticky lg:top-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e] blur-[100px] opacity-10"></div>
                            <h3 className="text-lg font-bold mb-4 pb-4 border-b border-white/5 text-white relative z-10">Transaction Preview</h3>

                            <div className="flex flex-col gap-4 relative z-10">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400 font-medium tracking-wide">Purpose</span>
                                    <span className="font-bold text-white">March 2026 Monthly Fee</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400 font-medium tracking-wide">Circle Name</span>
                                    <span className="font-bold text-white">Nairobi Elite Chama 2024</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400 font-medium tracking-wide">Transaction Fee</span>
                                    <span className="font-bold text-[#eab308]">KES 0.00</span>
                                </div>

                                <hr className="border-white/5 my-2" />

                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1 mt-2">Total Due</span>
                                        <span className="text-3xl font-extrabold text-[#22c55e] tabular-nums">KES 1,400</span>
                                    </div>
                                    <ShoppingCart className="text-gray-600 w-8 h-8" />
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5 relative z-10">
                                <p className="text-[9px] text-center text-[#22c55e]/60 uppercase tracking-widest font-extrabold text-shadow-sm">Powered by Safaricom Daraja</p>
                            </div>
                        </div>

                        {/* Help Card */}
                        <div className="bg-[#1a241c] rounded-2xl p-6 border border-white/5 text-center shadow-lg">
                            <h4 className="font-bold text-white mb-2">Need Help?</h4>
                            <p className="text-sm text-gray-400 mb-5 font-medium">Our support team is available 24/7 for deposit issues.</p>
                            <button className="text-[#22c55e] font-bold text-[13px] tracking-wide flex items-center justify-center gap-2 w-full py-3 border border-[#22c55e]/20 rounded-xl hover:bg-[#22c55e]/10 transition-colors">
                                <HelpCircle className="w-4 h-4" />
                                CONTACT SUPPORT
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
