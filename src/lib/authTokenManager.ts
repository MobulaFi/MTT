/**
 * Client-side short-lived auth token manager.
 *
 * Fetches JWTs from /api/auth/token (server mints them with its static key).
 * Decodes the JWT locally to read the real `exp` claim for refresh timing.
 * Proactively refreshes before expiry so there's never a blocking wait.
 *
 * Returns the raw JWT to pass as `apiKey` to MobulaClient.
 * The SDK uses apiKey for both REST (`Authorization: <apiKey>`) and
 * WebSocket (`authorization: <apiKey>` JSON field), so we pass the
 * raw JWT — not "Bearer <jwt>" — to work with both transports.
 */

const REFRESH_MARGIN = 5 * 60_000; // refresh 5 min before real expiry

interface CachedToken {
  jwt: string;       // raw JWT string
  expiresAt: number; // real expiry from JWT `exp` claim (ms)
}

let cachedToken: CachedToken | null = null;
let pendingRefresh: Promise<CachedToken | null> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Decode a JWT payload without verification.
 * JWT format: header.payload.signature — payload is base64url-encoded JSON.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Extract expiry from JWT. Returns Date.now()-based ms timestamp.
 */
function getExpiryFromJwt(jwt: string): number {
  const payload = decodeJwtPayload(jwt);
  if (payload && typeof payload.exp === 'number') {
    return payload.exp * 1000;
  }
  // Fallback: assume 1 hour from now
  return Date.now() + 3_600_000;
}

async function fetchToken(): Promise<CachedToken | null> {
  try {
    const res = await fetch('/api/auth/token', { method: 'POST' });

    if (!res.ok) {
      console.error(`[auth-token] Failed to fetch token (${res.status})`);
      return null;
    }

    const data = await res.json();
    const jwt: string = data.token;

    if (!jwt) {
      console.error('[auth-token] No token in response');
      return null;
    }

    const expiresAt = getExpiryFromJwt(jwt);

    const token: CachedToken = {
      jwt,
      expiresAt,
    };

    cachedToken = token;
    scheduleRefresh(expiresAt);
    console.log(`[client-auth] Token minted: ${jwt}, expires at ${new Date(expiresAt).toISOString()}`);
    return token;
  } catch (err) {
    console.error('[auth-token] Fetch error:', err);
    return null;
  }
}

function scheduleRefresh(expiresAt: number): void {
  if (refreshTimer) clearTimeout(refreshTimer);

  const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN, 0);

  refreshTimer = setTimeout(() => {
    refreshInBackground();
  }, delay);
}

function refreshInBackground(): void {
  if (pendingRefresh) return;

  pendingRefresh = fetchToken().finally(() => {
    pendingRefresh = null;
  });
}

/**
 * Invalidate the current token.
 * Call this when a request fails with 401/429 to force a fresh token.
 */
export function invalidateToken(): void {
  console.log('[client-auth] Token invalidated (401/429), will fetch fresh on next request');
  cachedToken = null;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Get a short-lived auth token (raw JWT).
 * Never blocks on expiry — proactively refreshes so a valid token is always ready.
 * Returns raw JWT string or null if unavailable.
 */
export async function getAuthToken(): Promise<string | null> {
  const now = Date.now();

  if (cachedToken) {
    // Token still valid — return it immediately
    if (cachedToken.expiresAt > now) {
      // Proactively refresh if within margin (non-blocking)
      if (cachedToken.expiresAt - now < REFRESH_MARGIN) {
        console.log(`[client-auth] Token expiring in ${Math.round((cachedToken.expiresAt - now) / 1000)}s, refreshing...`);
        refreshInBackground();
      }
      return cachedToken.jwt;
    }

    // Token expired but a refresh is already in flight — return stale token
    // rather than blocking. The API may still accept it briefly, and if not,
    // the next call will get the fresh one.
    if (pendingRefresh) {
      return cachedToken.jwt;
    }
  }

  // No token at all or expired with no refresh in flight — must fetch
  if (pendingRefresh) {
    const result = await pendingRefresh;
    return result?.jwt ?? null;
  }

  pendingRefresh = fetchToken().finally(() => {
    pendingRefresh = null;
  });

  const result = await pendingRefresh;
  return result?.jwt ?? null;
}
