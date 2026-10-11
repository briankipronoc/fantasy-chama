/**
 * Official Safaricom M-Pesa Person-to-Person (Send Money / Pochi la Biashara) Tariffs
 * Used when disbursing winnings via Pochi so the Chairman does not incur sending charges.
 * Deducts the exact transfer cost from the disbursement while keeping transparent gross records.
 */

export function calculateMpesaSendFee(amount: number): number {
  const amt = Math.max(0, Math.round(Number(amount) || 0));
  if (amt <= 0) return 0;
  if (amt <= 100) return 0; // 1 - 100 KES is free on Safaricom P2P/Pochi
  if (amt <= 500) return 7;
  if (amt <= 1000) return 13;
  if (amt <= 1500) return 23;
  if (amt <= 2500) return 33;
  if (amt <= 3500) return 53;
  if (amt <= 5000) return 57;
  if (amt <= 7500) return 78;
  if (amt <= 10000) return 90;
  if (amt <= 15000) return 100;
  if (amt <= 20000) return 105;
  return 108; // 20,001 - 250,000 KES capped at 108
}

export function calculateNetPayout(grossAmount: number): {
  gross: number;
  fee: number;
  net: number;
} {
  const gross = Math.max(0, Math.round(Number(grossAmount) || 0));
  const fee = calculateMpesaSendFee(gross);
  const net = Math.max(0, gross - fee);
  return { gross, fee, net };
}
