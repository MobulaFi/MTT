'use server';

import { MobulaClient } from '@mobula_labs/sdk';
import {
  ensurePulseV2SubscriptionId,
  subscribePulseV2Raw,
  type PulseV2Subscription,
} from '@/features/pulse/pulseV2WsClient';

const apiKey = process.env.MOBULA_SERVER_SIDE_KEY;

// Supported stream types
type StreamType = 'fast-trade' | 'pulse-v2' | 'token-details' | 'market-details' | 'ohlcv' | 'position' | 'stream-svm' | 'stream-evm' | 'holders';

const PULSE_V2_DEFAULT_WS_URL = 'wss://pulse-v2-api.mobula.io';

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

  // Allow overriding WS URL for local development (e.g. MOBULA_WS_URL=ws://localhost:4058)
  const wsOverride = process.env.MOBULA_WS_URL;
  const wsUrlMap = wsOverride
    ? Object.fromEntries(
        (['holders', 'fast-trade', 'pulse-v2', 'token-details', 'market-details', 'ohlcv', 'position', 'stream-svm', 'stream-evm'] as const).map(
          (t) => [t, wsOverride],
        ),
      )
    : undefined;

  // Pulse V2 bypasses the SDK entirely (the published version has no gunzip
  // support). Every other stream still goes through the SDK.
  const usePulseDirect = streamType === 'pulse-v2';
  const subscriptionPayload = usePulseDirect ? ensurePulseV2SubscriptionId(payload) : payload;

  // Create a new client only for non-Pulse streams
  const client = usePulseDirect
    ? null
    : new MobulaClient({
        restUrl,
        apiKey,
        debug: false,
        timeout: 200000,
        wsUrlMap,
      });

  // Resolve Pulse V2 WS URL: env override > custom map > default.
  const pulseV2Url = wsUrlMap?.['pulse-v2'] ?? PULSE_V2_DEFAULT_WS_URL;

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let sdkSubscriptionId: string | null =
    usePulseDirect && typeof subscriptionPayload.subscriptionId === 'string' ? subscriptionPayload.subscriptionId : null;
  let pulseSub: PulseV2Subscription | null = null;
  let isClientDisconnected = false;

  const stream = new ReadableStream({
    start(controller) {
      const onData = (data: unknown) => {
        if (isClientDisconnected) return;

        try {
          // Log ALL stream-svm/evm trades for debugging (sent to Datadog via log drain)
          if (streamType.startsWith('stream-')) {
            const d = data as Record<string, unknown>;
            const inner = (d.data ?? d) as Record<string, unknown>;
            const baseToken = inner.baseToken as string;
            const addr0 = inner.addressToken0 as string;
            const isT0Base = baseToken && addr0 && baseToken === addr0;
            const postBal = isT0Base ? inner.rawPostBalance0 : inner.rawPostBalance1;
            const postBalR = isT0Base ? inner.rawPostBalanceRecipient0 : inner.rawPostBalanceRecipient1;
            const rawAmt = Number(inner.tokenAmountRaw);
            const humanAmt = Number(inner.tokenAmount);
            const factor = rawAmt && humanAmt ? rawAmt / humanAmt : null;
            const humanBal = postBal && factor ? Number(postBal) / factor : null;
            const humanBalR = postBalR && factor ? Number(postBalR) / factor : null;
            console.log('[stream-trade]', JSON.stringify({
              type: inner.type,
              sender: (inner.sender as string)?.slice(0, 8),
              recipient: (inner.swapRecipient as string)?.slice(0, 8),
              tokenAmount: inner.tokenAmount,
              tokenAmountRaw: inner.tokenAmountRaw,
              isT0Base,
              postBal,
              postBalR,
              factor,
              humanBal,
              humanBalR,
              hash: (inner.hash as string)?.slice(0, 12),
            }));
          }
          const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(sseMessage));
        } catch (error) {
          console.error('[SSE] Error encoding message:', error);
        }
      };

      if (usePulseDirect) {
        // Direct WS to Pulse V2 with gzip support — does not touch the SDK.
        // Prefer the Node-native global (Node 22+); fall back to `ws`.
        void (async () => {
          const WSCtor =
            (globalThis as { WebSocket?: typeof WebSocket }).WebSocket ??
            ((await import('ws')).default as unknown as typeof WebSocket);
          if (isClientDisconnected) return;
          pulseSub = subscribePulseV2Raw(subscriptionPayload, onData, {
            url: pulseV2Url,
            resolveApiKey: () => apiKey,
            WebSocketCtor: WSCtor,
          });
        })();
      } else if (client) {
        sdkSubscriptionId = client.streams.subscribe(streamType, subscriptionPayload, onData);
      }

      const initMessage = `data: ${JSON.stringify({ event: 'connected', subscriptionId: sdkSubscriptionId })}\n\n`;
      controller.enqueue(encoder.encode(initMessage));
    },
    cancel() {
      isClientDisconnected = true;
      if (pulseSub) {
        pulseSub.unsubscribe();
        pulseSub = null;
      }
      if (client && sdkSubscriptionId) {
        client.streams.unsubscribe(streamType, sdkSubscriptionId);
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
