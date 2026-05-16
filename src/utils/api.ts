import { auth } from '../firebase';

export const getApiBaseUrl = () => {
    // If Vercel environment provides a URL, use it
    if (import.meta.env.VITE_API_URL) {
        let url = import.meta.env.VITE_API_URL;
        // Strip trailing slash
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        // Normalize HTTP to HTTPS for secure endpoints
        if (url.startsWith('http://') && url.includes('onrender.com')) {
            url = url.replace('http://', 'https://');
        }
        return url;
    }
    // Hardcoded production fallback
    const DEFAULT_RENDER_API_URL = 'https://fantasy-chama.onrender.com';
    return DEFAULT_RENDER_API_URL;
};

/**
 * Authenticated API call helper.
 * Automatically attaches the Firebase ID token as a Bearer Authorization header.
 * Use this for all calls to protected backend routes (b2c, deduct-gw-cost, mpesa/query, etc.)
 *
 * @param url      Full URL of the backend endpoint
 * @param body     JSON body object
 * @returns        The parsed JSON response
 */
export const secureApiPost = async (url: string, body: Record<string, unknown>): Promise<any> => {
    const currentUser = auth.currentUser;

    let idToken: string | null = null;
    if (currentUser) {
        try {
            idToken = await currentUser.getIdToken(/* forceRefresh */ false);
        } catch (err) {
            console.warn('[api] Could not get Firebase ID token:', err);
        }
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok && response.status === 401) {
        throw new Error('Session expired. Please log in again.');
    }
    if (!response.ok && response.status === 403) {
        throw new Error('Access denied. You do not have permission to perform this action.');
    }

    return response.json();
};
