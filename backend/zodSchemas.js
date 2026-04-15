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
    phone: phoneSchema,
    amount: amountSchema,
    remarks: z.string().max(100).optional(),
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
