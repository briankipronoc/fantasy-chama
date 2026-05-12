import fs from 'fs';
let zPath = 'backend/zodSchemas.js';
let zContent = fs.readFileSync(zPath, 'utf8');

zContent = zContent.replace(
`export const b2cPayoutSchema = z.object({`,
`export const b2cPayoutSchema = z.object({
    potBalance: z.number().int().min(0).optional(),`)

zContent += `
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
`;

fs.writeFileSync(zPath, zContent);
console.log("zod schema updated");
