/**
 * SDK Client Wrapper
 * - Server mode: calls /api/sdk route (API key stays on server)
 * - Client mode: calls SDK directly (user's API key)
 */

import { MobulaClient } from '@mobula_labs/sdk';
import type { SubscriptionPayload } from '@mobula_labs/sdk';
import type {
  TokenDetailsParams,
  MarketDetailsParams,
  TokenMarketsParams,
  PortfolioParams,
  WalletPositionsParams,
  WalletActivityV2Params,
  WalletV2DeployerParams,
  WalletAnalysisParams,
  WalletHistoryParams,
  TokenPositionsParams,
  TokenTradesParams,
  MarketTokenHoldersParams,
  MarketOHLCVHistoryParams,
  TokenOHLCVHistoryParams,
  SearchParams,
  SwapQuotingQueryParams,
  PulsePayloadParams,
  SwapSendParams,
  WalletPositionParams,
  FastTradesPayloadType,
  TokenDetailsPayloadType,
  MarketDetailsPayloadType,
  OhlcvPayloadType,
  PositionPayloadType,
} from '@mobula_labs/types';
import {
  DEFAULT_REST_ENDPOINT,
  DEFAULT_WSS_REGION,
  REST_ENDPOINTS,
  WSS_REGIONS,
  WSS_TYPES,
} from '@/config/endpoints';

type ApiMode = 'server' | 'client';

// Client-side SDK client cache
let clientSdkClient: MobulaClient | null = null;
let currentClientRestUrl: string = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
let currentClientWssUrlMap: Partial<Record<keyof SubscriptionPayload, string>> = {};

interface StoredCustomWss {
  type: keyof SubscriptionPayload;
  url: string;
  label?: string;
  mode?: string;
}

/**
 * Get current API mode
 * - SSR always uses 'server' mode
 * - Client reads from cookie (set via ApiSelectorDropdown toggle)
 */
export function getCurrentApiMode(): ApiMode {
  if (typeof window === 'undefined') return 'server';
  
  const match = document.cookie.match(/apiKeySource=(server|client)/);
  return (match?.[1] as ApiMode) ?? 'server';
}

/**
 * Get client API key from localStorage
 */
function getClientApiKey(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem('mobula-api-storage');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { state?: { apiKey?: string } };
    const key = parsed.state?.apiKey;
    if (key && typeof key === 'string' && key.trim()) return key.trim();
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Load client settings from localStorage
 */
function loadClientSettings(): void {
  if (typeof window === 'undefined') return;

  const savedUrl = localStorage.getItem('mobula-api-storage');
  if (savedUrl) {
    try {
      const parsed = JSON.parse(savedUrl) as {
        state?: {
          selectedRestUrl?: string;
          currentUrl?: string;
          selectedIndividualWssType?: keyof SubscriptionPayload;
          customWssUrls?: StoredCustomWss[];
          selectedAllModeWssUrl?: string;
          selectedWssRegion?: string;
        };
      };

      if (parsed.state?.selectedRestUrl) {
        currentClientRestUrl = parsed.state.selectedRestUrl;
      } else if (parsed.state?.currentUrl) {
        currentClientRestUrl = parsed.state.currentUrl;
      }

      if (parsed.state?.selectedIndividualWssType) {
        const customUrl = parsed.state?.customWssUrls?.find(
          (c: StoredCustomWss) => c.type === parsed.state?.selectedIndividualWssType
        );
        if (customUrl) {
          const wssType = parsed.state.selectedIndividualWssType as keyof SubscriptionPayload;
          if (wssType) {
            currentClientWssUrlMap[wssType] = customUrl.url;
          }
        }
      } else if (parsed.state?.selectedAllModeWssUrl) {
        const selectedUrl = parsed.state.selectedAllModeWssUrl;
        for (const type of WSS_TYPES) {
          currentClientWssUrlMap[type] = selectedUrl;
        }
      } else if (
        parsed.state?.selectedWssRegion &&
        parsed.state.selectedWssRegion !== DEFAULT_WSS_REGION
      ) {
        const regionUrl = WSS_REGIONS[parsed.state.selectedWssRegion as keyof typeof WSS_REGIONS];
        if (regionUrl) {
          for (const type of WSS_TYPES) {
            currentClientWssUrlMap[type] = regionUrl;
          }
        }
      } else {
        currentClientWssUrlMap = {};
      }
    } catch (e) {
      console.error('Error parsing localStorage:', e);
    }
  }
}

/**
 * Get or create client SDK (for CLIENT mode only - has WebSocket support)
 */
export function getClientSdk(): MobulaClient {
  if (!clientSdkClient) {
    loadClientSettings();
    const wsUrlMapToUse = Object.keys(currentClientWssUrlMap).length > 0 ? currentClientWssUrlMap : undefined;

    clientSdkClient = new MobulaClient({
      restUrl: currentClientRestUrl,
      apiKey: getClientApiKey(),
      debug: true,
      timeout: 200000,
      wsUrlMap: wsUrlMapToUse,
    });
  }
  return clientSdkClient;
}

/**
 * Reinitialize client SDK
 */
export function reinitClientSdk(): void {
  clientSdkClient = null;
  getClientSdk();
}

/**
 * Initialize client SDK with custom settings
 */
export function initClientSdk(
  restUrl: string,
  wsUrlMap?: Partial<Record<keyof SubscriptionPayload, string>>
): MobulaClient {
  if (wsUrlMap) {
    currentClientWssUrlMap = wsUrlMap;
  }
  currentClientRestUrl = restUrl;
  clientSdkClient = null;
  return getClientSdk();
}

/**
 * Update WebSocket URL map
 */
export function updateWssUrlMap(wsUrlMap: Partial<Record<keyof SubscriptionPayload, string>>): void {
  currentClientWssUrlMap = wsUrlMap;
  clientSdkClient = null;
  getClientSdk();
}

// ============================================================================
// SDK Method Wrappers - Auto-route based on mode
// ============================================================================

type SdkMethod = 
  | 'fetchTokenDetails'
  | 'fetchMarketDetails'
  | 'fetchTokenMarkets'
  | 'fetchWalletPortfolio'
  | 'fetchWalletPositions'
  | 'fetchWalletActivity'
  | 'fetchWalletHistory'
  | 'fetchWalletDeployer'
  | 'fetchWalletAnalysis'
  | 'fetchTokenTraderPositions'
  | 'fetchTokenHolderPositions'
  | 'fetchTokenTrades'
  | 'fetchMarketTokenHolders'
  | 'fetchMarketHistoricalPairData'
  | 'fetchMarketOHLCVHistory'
  | 'fetchTokenOHLCVHistory'
  | 'fetchSearchFast'
  | 'fetchSwapQuote'
  | 'fetchPulseV2'
  | 'fetchSystemMetadata'
  | 'swapSend'
  | 'fetchWalletPosition';

/**
 * Call SDK method - routes to /api/sdk in server mode, direct SDK in client mode
 */
async function callSdk<T>(method: SdkMethod, params: Record<string, unknown>): Promise<T> {
  const mode = getCurrentApiMode();

  if (mode === 'server') {
    // Server mode: call /api/sdk route
    const res = await fetch('/api/sdk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'SDK request failed');
    }

    return res.json();
  }

  // Client mode: call SDK directly
  const client = getClientSdk();
  
  switch (method) {
    case 'fetchTokenDetails':
      return client.fetchTokenDetails(params as Parameters<typeof client.fetchTokenDetails>[0]) as Promise<T>;
    case 'fetchMarketDetails':
      return client.fetchMarketDetails(params as Parameters<typeof client.fetchMarketDetails>[0]) as Promise<T>;
    case 'fetchTokenMarkets':
      return client.fetchTokenMarkets(params as Parameters<typeof client.fetchTokenMarkets>[0]) as Promise<T>;
    case 'fetchWalletPortfolio':
      return client.fetchWalletPortfolio(params as Parameters<typeof client.fetchWalletPortfolio>[0]) as Promise<T>;
    case 'fetchWalletPositions':
      return client.fetchWalletPositions(params as Parameters<typeof client.fetchWalletPositions>[0]) as Promise<T>;
    case 'fetchWalletActivity':
      return client.fetchWalletActivity(params as Parameters<typeof client.fetchWalletActivity>[0]) as Promise<T>;
    case 'fetchWalletHistory':
      return client.fetchWalletHistory(params as Parameters<typeof client.fetchWalletHistory>[0]) as Promise<T>;
    case 'fetchWalletDeployer':
      return client.fetchWalletDeployer(params as Parameters<typeof client.fetchWalletDeployer>[0]) as Promise<T>;
    case 'fetchWalletAnalysis':
      return client.fetchWalletAnalysis(params as Parameters<typeof client.fetchWalletAnalysis>[0]) as Promise<T>;
    case 'fetchTokenTraderPositions':
      return client.fetchTokenTraderPositions(params as Parameters<typeof client.fetchTokenTraderPositions>[0]) as Promise<T>;
    case 'fetchTokenHolderPositions':
      return client.fetchTokenHolderPositions(params as Parameters<typeof client.fetchTokenHolderPositions>[0]) as Promise<T>;
    case 'fetchTokenTrades':
      return client.fetchTokenTrades(params as Parameters<typeof client.fetchTokenTrades>[0]) as Promise<T>;
    case 'fetchMarketTokenHolders':
      return client.fetchMarketTokenHolders(params as Parameters<typeof client.fetchMarketTokenHolders>[0]) as Promise<T>;
    case 'fetchMarketHistoricalPairData':
      return client.fetchMarketHistoricalPairData(params as Parameters<typeof client.fetchMarketHistoricalPairData>[0]) as Promise<T>;
    case 'fetchMarketOHLCVHistory':
      return client.fetchMarketOHLCVHistory(params as Parameters<typeof client.fetchMarketOHLCVHistory>[0]) as Promise<T>;
    case 'fetchTokenOHLCVHistory':
      return client.fetchTokenOHLCVHistory(params as Parameters<typeof client.fetchTokenOHLCVHistory>[0]) as Promise<T>;
    case 'fetchSearchFast':
      return client.fetchSearchFast(params as Parameters<typeof client.fetchSearchFast>[0]) as Promise<T>;
    case 'fetchSwapQuote':
      return client.fetchSwapQuote(params as Parameters<typeof client.fetchSwapQuote>[0]) as Promise<T>;
    case 'fetchPulseV2':
      return client.fetchPulseV2(params as Parameters<typeof client.fetchPulseV2>[0]) as Promise<T>;
    case 'fetchSystemMetadata':
      return client.fetchSystemMetadata() as Promise<T>;
    case 'swapSend':
      return client.fetchSwapTransaction(params as Parameters<typeof client.fetchSwapTransaction>[0]) as Promise<T>;
    case 'fetchWalletPosition':
      return client.fetchWalletPosition(params as Parameters<typeof client.fetchWalletPosition>[0]) as Promise<T>;
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

// Export typed wrapper functions
export const sdk = {
  fetchTokenDetails: (params: TokenDetailsParams) =>
    callSdk('fetchTokenDetails', params),
    
  fetchMarketDetails: (params: MarketDetailsParams) =>
    callSdk('fetchMarketDetails', params),
    
  fetchTokenMarkets: (params: TokenMarketsParams) =>
    callSdk('fetchTokenMarkets', params),
    
  fetchWalletPortfolio: (params: PortfolioParams) =>
    callSdk('fetchWalletPortfolio', params),
    
  fetchWalletPositions: (params: WalletPositionsParams) =>
    callSdk('fetchWalletPositions', params),
    
  fetchWalletActivity: (params: WalletActivityV2Params) =>
    callSdk('fetchWalletActivity', params),
    
  fetchWalletHistory: (params: WalletHistoryParams) =>
    callSdk('fetchWalletHistory', params),
    
  fetchWalletDeployer: (params: WalletV2DeployerParams) =>
    callSdk('fetchWalletDeployer', params),
    
  fetchWalletAnalysis: (params: WalletAnalysisParams) =>
    callSdk('fetchWalletAnalysis', params),
    
  fetchTokenTraderPositions: (params: TokenPositionsParams) =>
    callSdk('fetchTokenTraderPositions', params),
    
  fetchTokenHolderPositions: (params: TokenPositionsParams) =>
    callSdk('fetchTokenHolderPositions', params),
    
  fetchTokenTrades: (params: TokenTradesParams) =>
    callSdk('fetchTokenTrades', params),
    
  fetchMarketTokenHolders: (params: MarketTokenHoldersParams) =>
    callSdk('fetchMarketTokenHolders', params),
    
  fetchMarketHistoricalPairData: (params: MarketOHLCVHistoryParams) =>
    callSdk('fetchMarketHistoricalPairData', params),
    
  fetchMarketOHLCVHistory: (params: MarketOHLCVHistoryParams) =>
    callSdk('fetchMarketOHLCVHistory', params),
    
  fetchTokenOHLCVHistory: (params: TokenOHLCVHistoryParams) =>
    callSdk('fetchTokenOHLCVHistory', params),
    
  fetchSearchFast: (params: SearchParams) =>
    callSdk('fetchSearchFast', params),
    
  fetchSwapQuote: (params: SwapQuotingQueryParams) =>
    callSdk('fetchSwapQuote', params),
    
  fetchPulseV2: (params: PulsePayloadParams) =>
    callSdk('fetchPulseV2', params),
    
  fetchSystemMetadata: () =>
    callSdk('fetchSystemMetadata', {}),
    
  swapSend: (params: SwapSendParams) =>
    callSdk('swapSend', params),
    
  fetchWalletPosition: (params: WalletPositionParams) =>
    callSdk('fetchWalletPosition', params),
};

// ============================================================================
// Streams Wrapper - Auto-route WebSocket based on mode
// ============================================================================

type StreamType = 'fast-trade' | 'pulse-v2' | 'token-details' | 'market-details' | 'ohlcv' | 'position';

interface StreamSubscription {
  unsubscribe: () => void;
}

// Track active SSE connections for server mode
const activeServerStreams = new Map<string, { controller: AbortController; eventSource: EventSource | null }>();
let streamIdCounter = 0;

/**
 * Subscribe to a stream - routes to SSE in server mode, direct WebSocket in client mode
 */
function subscribeToStream(
  streamType: StreamType,
  payload: Record<string, unknown>,
  callback: (data: unknown) => void
): StreamSubscription {
  const mode = getCurrentApiMode();

  if (mode === 'server') {
    // Server mode: use SSE endpoint
    const streamId = `stream_${++streamIdCounter}`;
    const controller = new AbortController();

    // Use fetch with streaming for SSE
    const connectSSE = async () => {
      try {
        const response = await fetch('/api/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ streamType, payload }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          console.error('[SSE] Failed to connect:', response.statusText);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.event !== 'connected') {
                  callback(data);
                }
              } catch (e) {
                console.error('[SSE] Parse error:', e);
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('[SSE] Connection error:', error);
        }
      }
    };

    connectSSE();
    activeServerStreams.set(streamId, { controller, eventSource: null });

    return {
      unsubscribe: () => {
        controller.abort();
        activeServerStreams.delete(streamId);
      },
    };
  }

  // Client mode: use SDK WebSocket directly
  const client = getClientSdk();
  const subscriptionId = client.streams.subscribe(streamType, payload, callback);

  return {
    unsubscribe: () => {
      client.streams.unsubscribe(streamType, subscriptionId);
    },
  };
}

/**
 * Streams interface - unified API for WebSocket subscriptions
 */
export const streams = {
  /**
   * Subscribe to fast-trade stream
   */
  subscribeFastTrade: (
    params: FastTradesPayloadType,
    callback: (data: unknown) => void
  ): StreamSubscription => {
    return subscribeToStream('fast-trade', params, callback);
  },

  /**
   * Subscribe to pulse-v2 stream
   */
  subscribePulseV2: (
    params: PulsePayloadParams,
    callback: (data: unknown) => void
  ): StreamSubscription => {
    return subscribeToStream('pulse-v2', params, callback);
  },

  /**
   * Subscribe to token-details stream
   */
  subscribeTokenDetails: (
    params: TokenDetailsPayloadType,
    callback: (data: unknown) => void
  ): StreamSubscription => {
    return subscribeToStream('token-details', params, callback);
  },

  /**
   * Subscribe to market-details stream
   */
  subscribeMarketDetails: (
    params: MarketDetailsPayloadType,
    callback: (data: unknown) => void
  ): StreamSubscription => {
    return subscribeToStream('market-details', params, callback);
  },

  /**
   * Subscribe to ohlcv stream (chart candlestick data)
   */
  subscribeOhlcv: (
    params: OhlcvPayloadType,
    callback: (data: unknown) => void
  ): StreamSubscription => {
    return subscribeToStream('ohlcv', params, callback);
  },

  /**
   * Subscribe to position stream (wallet position updates)
   */
  subscribePosition: (
    params: PositionPayloadType,
    callback: (data: unknown) => void
  ): StreamSubscription => {
    return subscribeToStream('position', params, callback);
  },

  /**
   * Generic subscribe method
   */
  subscribe: (
    streamType: StreamType,
    payload: Record<string, unknown>,
    callback: (data: unknown) => void
  ): StreamSubscription => {
    return subscribeToStream(streamType, payload, callback);
  },
};
