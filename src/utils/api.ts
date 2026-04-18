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
    const DEFAULT_RENDER_API_URL = 'https://fantasy-chama-api.onrender.com';
    return DEFAULT_RENDER_API_URL;
};
