import { NextResponse } from 'next/server';
import { REST_ENDPOINTS, DEFAULT_REST_ENDPOINT } from '@/config/endpoints';

const STATIC_KEY = process.env.MOBULA_SERVER_SIDE_KEY;
const DEFAULT_EXPIRES_IN = 3_600_000; // 1 hour
const REQUEST_LIMIT = 100000;

/**
 * POST /api/auth/token
 *
 * Mints a short-lived JWT using the server's static API key.
 * Returns the token to the client for direct use with `Authorization: Bearer <token>`.
 */
export async function POST() {
  if (!STATIC_KEY) {
    return NextResponse.json(
      { error: 'Server API key not configured' },
      { status: 500 },
    );
  }

  const restUrl = process.env.MOBULA_SERVER_SIDE_API_URL || REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];

  try {
    const res = await fetch(`${restUrl}/api/2/auth/tokens`, {
      method: 'POST',
      headers: {
        Authorization: STATIC_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expiresIn: DEFAULT_EXPIRES_IN,
        count: 1,
        requestLimit: REQUEST_LIMIT,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[auth/token] Token creation failed (${res.status}):`, body);
      return NextResponse.json(
        { error: 'Failed to create token' },
        { status: res.status },
      );
    }

    const data = await res.json();
    const token: string = data.createApiTokens?.[0]?.token ?? data.data?.token ?? data.token;

    if (!token) {
      console.error('[auth/token] No token in response. Full data:', JSON.stringify(data));
      return NextResponse.json(
        { error: 'No token in response' },
        { status: 500 },
      );
    }

    return NextResponse.json({ token });
  } catch (err) {
    console.error('[auth/token] Error:', err);
    return NextResponse.json(
      { error: 'Token creation failed' },
      { status: 500 },
    );
  }
}
