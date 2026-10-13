/**
 * Phone number normalization utilities for Kenyan mobile numbers (Safaricom / Airtel / Telkom).
 */

/**
 * Formats user input into a standard 10-digit Kenyan phone number (e.g. 0712345678 or 0112345678).
 * Intelligently converts:
 * - "+254712345678" -> "0712345678"
 * - "254712345678"  -> "0712345678"
 * - "712345678"     -> "0712345678"
 * - Auto-corrects as the user types or pastes.
 */
export function normalizeKenyanPhone(input: string): string {
    if (!input) return '';
    let cleaned = input.trim().replace(/[^0-9+]/g, '');

    // Handle +254 prefix
    if (cleaned.startsWith('+254')) {
        cleaned = '0' + cleaned.slice(4);
    } 
    // Handle 254 prefix (when typing 2547... or pasting full 254...)
    else if (cleaned.startsWith('254') && cleaned.length >= 4) {
        cleaned = '0' + cleaned.slice(3);
    } 
    // Handle 9-digit format starting with 7 or 1 (e.g. 712345678)
    else if ((cleaned.startsWith('7') || cleaned.startsWith('1')) && cleaned.length === 9) {
        cleaned = '0' + cleaned;
    }

    // Keep digits only and clamp to 10 digits
    return cleaned.replace(/[^0-9]/g, '').slice(0, 10);
}

/**
 * Returns all possible representations of a Kenyan phone number
 * so queries match regardless of how the Chairman originally recorded it.
 */
export function getPhoneVariants(phone: string): string[] {
    const raw = phone.trim();
    const normalized = normalizeKenyanPhone(raw);
    
    if (!normalized || normalized.length < 10) {
        return raw ? [raw] : [];
    }

    const nineDigits = normalized.slice(1); // e.g. "712345678"
    return Array.from(new Set([
        raw,
        normalized,            // "0712345678"
        `254${nineDigits}`,    // "254712345678"
        `+254${nineDigits}`,   // "+254712345678"
        nineDigits             // "712345678"
    ])).filter(Boolean);
}

/**
 * Formats a Kenyan phone number into standard international format for WhatsApp (wa.me/254...).
 * Strips '+', leading '0', spaces, and prepends 254 if missing.
 */
export function formatWhatsAppPhone(phone: string): string {
    if (!phone) return '';
    const norm = normalizeKenyanPhone(phone);
    if (norm && norm.length === 10 && norm.startsWith('0')) {
        return '254' + norm.slice(1);
    }
    const digits = phone.trim().replace(/[^0-9]/g, '');
    if (digits.startsWith('0') && digits.length === 10) {
        return '254' + digits.slice(1);
    }
    if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
        return '254' + digits;
    }
    if (digits.startsWith('254') && digits.length === 12) {
        return digits;
    }
    return digits;
}
