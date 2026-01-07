import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const apiUrl = process.env.INTERNAL_API_URL || 'http://localhost:3001';
    const targetUrl = `${apiUrl}/api/login`;

    console.log(`[PROXY] POST /api/login -> ${targetUrl}`);

    try {
        const body = await request.text();

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body,
        });

        const data = await response.text();

        return new NextResponse(data, {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('[PROXY ERROR]', error);
        return NextResponse.json(
            { error: 'Proxy failed', details: (error as Error).message },
            { status: 500 }
        );
    }
}
