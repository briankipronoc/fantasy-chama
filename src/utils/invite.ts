/**
 * Utility to extract 6-character league invite codes from raw text,
 * including full WhatsApp invite messages, URLs, bold markdown, and direct codes.
 */
export function extractInviteCode(rawText: string): string {
    if (!rawText) return '';
    const text = rawText.trim();

    // 1. Direct 6-character alphanumeric (with optional whitespace like "Z7V JX4" or "*Z7VJX4*")
    const cleanDirect = text.replace(/[\s*\-_]/g, '').toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(cleanDirect)) {
        return cleanDirect;
    }

    // 2. Query param in URL (?code=Z7VJX4 or &code=Z7VJX4)
    const urlMatch = text.match(/[?&]code=([A-Za-z0-9]{6})\b/i);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1].toUpperCase();
    }

    // 3. Labelled text: "League Code: *Z7VJX4*", "Code: Z7VJX4", "PIN: Z7VJX4", "Invite Code: Z7VJX4"
    const labelMatch = text.match(/(?:league\s*code|invite\s*code|code|pin)\s*[:=]\s*\*?([A-Za-z0-9]{6})\*?/i);
    if (labelMatch && labelMatch[1]) {
        return labelMatch[1].toUpperCase();
    }

    // 4. WhatsApp markdown bold: *Z7VJX4*
    const boldMatch = text.match(/\*([A-Za-z0-9]{6})\*/);
    if (boldMatch && boldMatch[1]) {
        return boldMatch[1].toUpperCase();
    }

    // 5. Look for standalone 6-character alphanumeric token in text
    const tokens = text.split(/[\s\n\r,;:!?()"]+/);
    // Reversed so that codes appearing near the end of invite messages (e.g. League Code: Z7VJX4) take precedence
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const cleaned = token.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (cleaned.length === 6 && /^[A-Z0-9]{6}$/.test(cleaned)) {
            const commonWords = ['JOINED', 'WEEKLY', 'CHANCE', 'POINTS', 'UPDATE', 'FANTAS', 'CHAMAS', 'BEFORE', 'ACTION', 'MEMBER', 'INVITE', 'LEAGUE', 'WINNER', 'SEASON', 'AUTOMAT'];
            if (!commonWords.includes(cleaned)) {
                return cleaned;
            }
        }
    }

    return cleanDirect.slice(0, 6);
}
