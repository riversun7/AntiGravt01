export const getApiBaseUrl = (): string => {
    // 1. Client-Side: Use relative path (forces usage of Next.js Rewrite Proxy)
    // This is important for Docker deployment where client and server are separate containers
    if (typeof window !== 'undefined') {
        return '';
    }

    // 2. Server-Side: Prefer INTERNAL_API_URL for SSR (Docker internal communication)
    if (process.env.INTERNAL_API_URL) {
        return process.env.INTERNAL_API_URL;
    }

    // 3. Server-Side: Fallback to NEXT_PUBLIC_API_URL
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    // 4. Ultimate fallback
    return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();
