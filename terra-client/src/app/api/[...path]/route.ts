import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const params = await context.params;
    return proxyRequest(request, params.path);
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const params = await context.params;
    return proxyRequest(request, params.path);
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const params = await context.params;
    return proxyRequest(request, params.path);
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const params = await context.params;
    return proxyRequest(request, params.path);
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const params = await context.params;
    return proxyRequest(request, params.path);
}

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
    const apiUrl = process.env.INTERNAL_API_URL || 'http://localhost:3001';
    const path = pathSegments.join('/');
    const targetUrl = `${apiUrl}/api/${path}`;

    console.log(`[PROXY] ${request.method} /api/${path} -> ${targetUrl}`);

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
        console.error('[PROXY ERROR]', error);
        return NextResponse.json(
            { error: 'Proxy failed', details: (error as Error).message },
            { status: 500 }
        );
    }
}
