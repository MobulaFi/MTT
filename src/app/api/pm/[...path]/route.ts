// API Proxy for Prediction Markets endpoints
// Proxies requests to the local API server to avoid CORS/localhost issues when accessing via Coder

import { NextRequest, NextResponse } from 'next/server';

const PM_API_BASE = process.env.PM_API_URL || 'http://localhost:4058/api/2';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathString = path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${PM_API_BASE}/pm/${pathString}${searchParams ? `?${searchParams}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('PM API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from PM API', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathString = path.join('/');
  const url = `${PM_API_BASE}/pm/${pathString}`;

  try {
    const body = await request.json();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('PM API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from PM API', details: String(error) },
      { status: 500 }
    );
  }
}
