import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'online',
        system: 'Terra In-Cognita Client API',
        timestamp: new Date().toISOString(),
        message: 'This is a Next.js App Router API Route. It runs on the frontend server, separate from the main Express backend.'
    });
}
