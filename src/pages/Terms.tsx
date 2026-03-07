import { Scale, FileText } from 'lucide-react';

export default function Terms() {
    return (
        <div className="min-h-full p-6 md:p-10 text-white font-sans bg-[#0b1014] pb-24 lg:pb-10">
            <div className="w-full max-w-4xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-8 text-center md:text-left flex items-center justify-center md:justify-start gap-3">
                    <Scale className="w-8 h-8 md:w-10 md:h-10 text-[#10B981]" /> Terms & Conditions
                </h1>
                <div className="space-y-6 w-full">
                    <div className="bg-[#161d24]/80 backdrop-blur-md border border-white/5 p-8 rounded-[2rem] shadow-xl">
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                            <Scale className="w-5 h-5 text-[#FBBF24]" /> League Rules (Fantasy Chama)
                        </h2>
                        <ul className="list-disc pl-5 space-y-3 text-gray-300 leading-relaxed text-sm">
                            <li>The designated Chairman holds absolute authority over League settings, including KES monthly/weekly contributions, distribution splits, and penalty overrides.</li>
                            <li>Payments for each Gameweek MUST be secured and cleared via M-Pesa stk push before the official FPL deadline.</li>
                            <li>Any manager remaining in the "Red Zone" (unpaid) at Gameweek lockout automatically forfeits their eligibility for that week's payout pot, regardless of their FPL points haul.</li>
                            <li>The Weekly Pot is distributed proportionately or to the single highest scorer depending on the league's payout schedule. The Season Vault collects funds securely until the conclusion of Gameweek 38.</li>
                            <li>Platform fees or M-Pesa transaction costs may deduct slightly from total payouts. Transparency logs are maintained in the Vault & Red Zone ledger.</li>
                        </ul>
                    </div>

                    <div className="bg-[#161d24]/80 backdrop-blur-md border border-white/5 p-8 rounded-[2rem] shadow-xl">
                        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-[#10B981]" /> Platform Terms of Service
                        </h2>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Fantasy Chama acts strictly as a decentralized ledger and escrow facilitator. We do not run the actual FPL game. All FPL statistics are pulled from FPL's public API. We store your Phone Numbers securely purely for M-Pesa integrations, and no data is shared with third parties.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
