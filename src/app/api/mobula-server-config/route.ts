import { NextResponse } from 'next/server';
import { REST_ENDPOINTS, DEFAULT_REST_ENDPOINT } from '@/config/endpoints';

export async function GET() {
  const defaultRestUrl = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
  const restUrl = process.env.MOBULA_SERVER_SIDE_API_URL ?? defaultRestUrl;
  const hasApiKey = Boolean(process.env.MOBULA_SERVER_SIDE_KEY?.trim());

  return NextResponse.json({
    restUrl,
    hasApiKey,
  });
}
