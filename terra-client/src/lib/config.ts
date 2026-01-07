export const getApiBaseUrl = (): string => {
    // 1. Prefer Environment Variable if available (Build time)
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    // 2. Client-Side: Construct based on window.location
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol; // http: or https:
        const hostname = window.location.hostname; // e.g. localhost, riversun7.synology.me
        // Assume API is always on port 3001
        return `${protocol}//${hostname}:3001`;
    }

    // 3. Server-Side Fallback
    return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();
