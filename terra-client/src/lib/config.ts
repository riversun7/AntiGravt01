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

    // 4. Client-Side: Dynamic Hostname Fallback (PROD/NAS Support)
    // If running in browser, assume Server is on same host but port 3001 (default Docker setup)
    if (typeof window !== 'undefined') {
        const win = window as unknown as { location: { protocol: string, hostname: string } };
        const protocol = win.location.protocol; // http: or https:
        const hostname = win.location.hostname; // localhost or 192.168.x.x or domain.com
        return `${protocol}//${hostname}:3001`;
    }

    // 5. Server-Side Fallback (Local Dev)
    return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();
