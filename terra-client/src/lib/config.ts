export const getApiBaseUrl = (): string => {
    // 1. Client-Side: ALWAYS use relative path
    // This ensures requests go to the same origin (e.g., riversun7.synology.me)
    // and let the Next.js Proxy handle routing to the backend.
    if (typeof window !== 'undefined') {
        return '';
    }

    // 2. Server-Side: Prefer INTERNAL_API_URL (Docker)
    if (process.env.INTERNAL_API_URL) {
        return process.env.INTERNAL_API_URL;
    }

    // 3. Server-Side: Fallback to localhost (Local Dev)
    return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();
