export const getApiBaseUrl = (): string => {
    // 1. Prefer Environment Variable if available (Build time)
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    // 2. Client-Side: Use relative path (forces usage of Next.js Rewrite Proxy)
    if (typeof window !== 'undefined') {
        return '';
    }

    // 3. Server-Side Fallback (SSR)
    if (process.env.INTERNAL_API_URL) {
        return process.env.INTERNAL_API_URL;
    }
    return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();
