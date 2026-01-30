import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    // Only proxy /api requests
    if (request.nextUrl.pathname.startsWith('/api/')) {
        const apiUrl = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';
        const targetUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, apiUrl);

        console.log(`[MIDDLEWARE PROXY] ${request.method} ${request.nextUrl.pathname} -> ${targetUrl}`);

        try {
            const body = request.method !== 'GET' && request.method !== 'HEAD'
                ? await request.text()
                : undefined;

            const response = await fetch(targetUrl, {
                method: request.method,
                headers: {
                    'Content-Type': request.headers.get('content-type') || 'application/json',
                },
                body,
            });

            const data = await response.text();

            return new NextResponse(data, {
                status: response.status,
                headers: {
                    'Content-Type': response.headers.get('content-type') || 'application/json',
                },
            });
        } catch (error) {
            console.error('[MIDDLEWARE PROXY ERROR]', error);
            return NextResponse.json(
                { error: 'Proxy failed', details: (error as Error).message },
                { status: 500 }
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/api/:path*',
};
