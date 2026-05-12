import { z } from 'zod';

// Shared components
export const amountSchema = z.number().int().min(1).max(300000);
export const phoneSchema = z.string().regex(/^2547\d{8}$|^2541\d{8}$|^07\d{8}$|^01\d{8}$/, "Invalid phone number format. Must start with 254/07/01.");
export const idSchema = z.string().min(1).max(100);

export const stkPushSchema = z.object({
    amount: amountSchema,
    phoneNumber: phoneSchema,
    userId: idSchema,
    leagueId: idSchema
});

export const b2cPayoutSchema = z.object({
    potBalance: z.number().int().min(0).optional(),
    phone: phoneSchema,
    amount: amountSchema,
    remarks: z.string().max(100).optional(),
    winnerName: z.string().max(100).optional(),
    gw: z.number().int().min(1).max(38).optional(),
    points: z.number().int().min(0).max(300).optional(),
    userId: idSchema,
    leagueId: idSchema
});

export const deductGwCostSchema = z.object({
    leagueId: idSchema,
    gwCostPerRound: amountSchema,
    gwNumber: z.number().int().min(1).max(38),
    winnerName: z.string().min(1).max(100),
    winnerAmount: amountSchema.optional(),
    payoutMethod: z.enum(['mpesa', 'cash']).optional(),
    chairmanId: idSchema.optional()
});

// Enforce max pot constraint dynamically
export const strictB2cPayoutSchema = b2cPayoutSchema.refine((data) => {
    if (data.potBalance !== undefined) {
        // Mock 4% Admin + 20% HQ fees buffer (24% reserve). Only 76% is technically payable
        const maxWithdrawal = Math.floor(data.potBalance * 0.76);
        return data.amount <= maxWithdrawal;
    }
    return true; // IF pot balance isn't verified here, pass to Firestore rules
}, {
    message: "Requested payout exceeds allowed dynamic limit (Gross Pot minus HQ/Admin fees)."
});
