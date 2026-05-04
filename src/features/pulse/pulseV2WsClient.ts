/**
 * Direct Pulse V2 WebSocket client with gzip support — no SDK dependency.
 *
 * Why this exists:
 *   The published `@mobula_labs/sdk` (v0.1.x) parses every WS frame as JSON
 *   text. When the server emits gzip binary frames (because the client
 *   subscribed with `compressed: true`), that parse fails silently and the
 *   callback never fires. We can't republish the SDK right now, so Pulse V2
 *   bypasses the SDK entirely on every code path (browser + Node SSE route).
 *
 * What this does:
 *   - Opens a single WS to the Pulse V2 endpoint per subscription.
 *   - Sends `{ type: 'pulse-v2', authorization, payload }`.
 *   - On every frame: if it starts with gzip magic (1F 8B), decompress;
 *     otherwise treat as utf-8 JSON. So the same code works whether or not
 *     the server actually compresses.
 *   - Reconnects with exponential backoff, sends 30s heartbeats.
 *
 * Isomorphic: works in the browser AND inside Next.js Node runtime
 * (DecompressionStream and WebSocket are globals in Node 22+; in Node 18-21
 * we fall back to `node:zlib` for gunzip).
 */

import { getAuthToken } from '@/lib/authTokenManager';
import { DEFAULT_WSS_REGION, WSS_REGIONS } from '@/config/endpoints';

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

const DEFAULT_PULSE_V2_URL = 'wss://pulse-v2-api.mobula.io';

export interface PulseV2Subscription {
  subscriptionId: string;
  unsubscribe: () => void;
}

interface StoredCustomWss {
  type: string;
  url: string;
}

/** Resolve URL from localStorage on the browser; default in Node. */
function resolvePulseV2UrlFromBrowser(): string {
  if (typeof window === 'undefined') return DEFAULT_PULSE_V2_URL;
  try {
    const raw = localStorage.getItem('mobula-api-storage');
    if (!raw) return DEFAULT_PULSE_V2_URL;
    const parsed = JSON.parse(raw) as {
      state?: {
        selectedIndividualWssType?: string;
        customWssUrls?: StoredCustomWss[];
        selectedAllModeWssUrl?: string;
        selectedWssRegion?: string;
      };
    };
    const state = parsed.state ?? {};
    if (state.selectedIndividualWssType === 'pulse-v2') {
      const custom = state.customWssUrls?.find((c) => c.type === 'pulse-v2');
      if (custom?.url) return custom.url;
    }
    if (state.selectedAllModeWssUrl) return state.selectedAllModeWssUrl;
    if (state.selectedWssRegion && state.selectedWssRegion !== DEFAULT_WSS_REGION) {
      const regionUrl = WSS_REGIONS[state.selectedWssRegion as keyof typeof WSS_REGIONS];
      if (regionUrl) return regionUrl;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PULSE_V2_URL;
}

function readClientApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('mobula-api-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { apiKey?: string } };
    return parsed.state?.apiKey?.trim() || null;
  } catch {
    return null;
  }
}

function createPulseV2SubscriptionId(): string {
  const randomId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

  return `mtt-pulse-${Date.now().toString(36)}-${randomId}`;
}

export function ensurePulseV2SubscriptionId(payload: Record<string, unknown>): Record<string, unknown> & {
  subscriptionId: string;
} {
  const existingSubscriptionId = typeof payload.subscriptionId === 'string' ? payload.subscriptionId.trim() : '';

  return {
    ...payload,
    subscriptionId: existingSubscriptionId || createPulseV2SubscriptionId(),
  };
}

async function gunzipToText(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Response(new Blob([bytes as unknown as BlobPart])).body!.pipeThrough(
      new DecompressionStream('gzip'),
    );
    const buf = await new Response(stream).arrayBuffer();
    return new TextDecoder('utf-8').decode(buf);
  }
  // Node fallback (older runtimes)
  const { gunzipSync } = await import('node:zlib');
  return gunzipSync(bytes).toString('utf8');
}

async function decodeFrame(data: unknown): Promise<unknown> {
  if (typeof data === 'string') return data.length > 0 ? JSON.parse(data) : null;

  let bytes: Uint8Array | null = null;
  if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
  else if (data instanceof Uint8Array) bytes = data;
  else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    bytes = new Uint8Array(await data.arrayBuffer());
  } else if (Array.isArray(data)) {
    let total = 0;
    for (const part of data as Uint8Array[]) total += part.byteLength ?? 0;
    bytes = new Uint8Array(total);
    let off = 0;
    for (const part of data as Uint8Array[]) {
      bytes.set(part, off);
      off += part.byteLength;
    }
  }
  if (!bytes || bytes.byteLength === 0) return null;

  if (bytes.byteLength >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1) {
    return JSON.parse(await gunzipToText(bytes));
  }
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

/* ------------------------------------------------------------------ */
/* Core: isomorphic subscribe — pass URL and an api-key resolver       */
/* ------------------------------------------------------------------ */

export interface RawSubscribeOptions {
  url: string;
  /** Resolves an api key (or JWT). Called on every (re)connection. */
  resolveApiKey: () => string | Promise<string | null> | null;
  /** WebSocket constructor. In Node we accept the `ws` package's class too. */
  WebSocketCtor?: typeof WebSocket;
  debug?: boolean;
}

export function subscribePulseV2Raw(
  payload: Record<string, unknown>,
  callback: (data: unknown) => void,
  { url, resolveApiKey, WebSocketCtor, debug = false }: RawSubscribeOptions,
): PulseV2Subscription {
  const WS = WebSocketCtor ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);
  if (!WS) {
    throw new Error('[pulseV2WsClient] No WebSocket implementation available in this runtime');
  }

  let ws: InstanceType<typeof WS> | null = null;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  let lastApiKey = '';
  const subscriptionPayload = ensurePulseV2SubscriptionId(payload);
  const { subscriptionId } = subscriptionPayload;

  const sendSubscribe = () => {
    if (!ws || ws.readyState !== WS.OPEN) return;
    const wantCompressed = subscriptionPayload.compressed !== false;
    // The server-side Zod schema in apps/api/src/wss/adapter.ts:335-348 extracts
    // `compressed` from the TOP-LEVEL of the WS message, not from `payload`, and
    // overwrites whatever was inside `payload` with that top-level value (undefined
    // if absent). So we must put `compressed` BOTH at the top-level (where the
    // schema actually reads it) and inside `payload` (where the docs say it goes).
    const envelope = {
      type: 'pulse-v2',
      authorization: lastApiKey,
      compressed: wantCompressed,
      payload: { ...subscriptionPayload, compressed: wantCompressed },
    };
    ws.send(JSON.stringify(envelope));
    if (debug) console.log('[pulseV2WsClient] subscribe sent', envelope);
  };

  const open = async () => {
    if (closed) return;
    const apiKey = (await resolveApiKey()) ?? '';
    if (!apiKey) {
      console.warn('[pulseV2WsClient] no api key/token available');
      callback({ error: 'No API key available' });
      return;
    }
    lastApiKey = apiKey;

    ws = new WS(url);
    // node `ws` and browser WebSocket both accept binaryType='arraybuffer'
    try {
      (ws as { binaryType?: string }).binaryType = 'arraybuffer';
    } catch {
      /* node-ws ignores this; that's fine — we'll get Buffer instead */
    }

    ws.addEventListener('open', () => {
      attempts = 0;
      sendSubscribe();
      heartbeat = setInterval(() => {
        if (ws?.readyState === WS.OPEN) ws.send(JSON.stringify({ event: 'ping' }));
      }, 30000);
    });

    ws.addEventListener('message', (ev: { data: unknown }) => {
      void (async () => {
        try {
          const msg = await decodeFrame(ev.data);
          if (msg) callback(msg);
        } catch (err) {
          if (debug) console.error('[pulseV2WsClient] decode error', err);
        }
      })();
    });

    ws.addEventListener('close', () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      ws = null;
      if (closed) return;
      attempts += 1;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5));
      reconnectTimer = setTimeout(open, delay);
    });

    ws.addEventListener('error', (e: unknown) => {
      if (debug) console.error('[pulseV2WsClient] ws error', e);
    });
  };

  void open();

  return {
    subscriptionId,
    unsubscribe: () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeat) clearInterval(heartbeat);
      try {
        if (ws?.readyState === WS.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'unsubscribe',
              authorization: lastApiKey,
              payload: { type: 'pulse-v2', subscriptionId },
            }),
          );
        }
      } catch {
        /* ignore */
      }
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Browser convenience wrapper used by lib/sdkClient.ts                 */
/* ------------------------------------------------------------------ */

export interface SubscribeOptions {
  /** When true, use a server-minted JWT via `getAuthToken`. */
  useShortLivedToken?: boolean;
  debug?: boolean;
}

export function subscribePulseV2Compressed(
  payload: Record<string, unknown>,
  callback: (data: unknown) => void,
  { useShortLivedToken = false, debug = false }: SubscribeOptions = {},
): PulseV2Subscription {
  return subscribePulseV2Raw(payload, callback, {
    url: resolvePulseV2UrlFromBrowser(),
    resolveApiKey: async () => {
      if (useShortLivedToken) return (await getAuthToken()) ?? readClientApiKey();
      return readClientApiKey();
    },
    debug,
  });
}
