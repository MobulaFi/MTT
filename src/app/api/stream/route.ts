'use server';

import { MobulaClient } from '@mobula_labs/sdk';

const apiKey = process.env.MOBULA_SERVER_SIDE_KEY;

// Supported stream types
type StreamType = 'fast-trade' | 'pulse-v2' | 'token-details' | 'market-details' | 'ohlcv' | 'position';

export async function POST(request: Request) {
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { streamType, payload } = await request.json() as {
    streamType: StreamType;
    payload: Record<string, unknown>;
  };

  if (!streamType || !payload) {
    return new Response(JSON.stringify({ error: 'Missing streamType or payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Priority: 1. Cookie customRestUrl, 2. Env var, 3. Default
  let restUrl = process.env.MOBULA_SERVER_SIDE_API_URL || 'https://api.mobula.io';
  
  // Check for custom REST URL from cookie (set by ApiSelectorDropdown)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const customRestUrlMatch = cookieHeader.match(/customRestUrl=([^;]+)/);
    if (customRestUrlMatch) {
      try {
        const urlFromCookie = decodeURIComponent(customRestUrlMatch[1]).trim();
        if (urlFromCookie) {
          restUrl = urlFromCookie;
        }
      } catch (e) {
        console.error('Error parsing customRestUrl cookie:', e);
      }
    }
  }

  // Create a new client for this stream
  const client = new MobulaClient({
    restUrl,
    apiKey,
    debug: false,
    timeout: 200000,
  });

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let subscriptionId: string | null = null;
  let isClientDisconnected = false;

  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to the WebSocket stream
      subscriptionId = client.streams.subscribe(
        streamType,
        payload,
        (data: unknown) => {
          if (isClientDisconnected) return;
          
          try {
            const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          } catch (error) {
            console.error('[SSE] Error encoding message:', error);
          }
        },
      );

      // Send initial connection message
      const initMessage = `data: ${JSON.stringify({ event: 'connected', subscriptionId })}\n\n`;
      controller.enqueue(encoder.encode(initMessage));
    },
    cancel() {
      isClientDisconnected = true;
      if (subscriptionId) {
        client.streams.unsubscribe(streamType, subscriptionId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
