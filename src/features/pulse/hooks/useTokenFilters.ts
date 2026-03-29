'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { usePulseFilterStore } from '@/features/pulse/store/usePulseModalFilterStore';
import usePulseDataStore from '@/features/pulse/store/usePulseDataStore';
import { ViewName, type PulseToken } from '@/features/pulse/store/usePulseDataStore';
import { UpdateBatcher } from '@/utils/UpdateBatcher';
import { useApiStore } from '@/store/apiStore';
import { DEFAULT_REST_ENDPOINT, REST_ENDPOINTS, WSS_REGIONS, DEFAULT_WSS_REGION } from '@/config/endpoints';

/**
 * Token Filters WebSocket message types (v3 protocol)
 * 
 * Key differences from Pulse V2:
 * - Uses 'mode: token' instead of 'assetMode: true'
 * - Views are objects not arrays
 * - Update messages contain partial data (diff only)
 * - No 'init' message - initial data comes from REST or first new-token messages
 */
type TokenFiltersResponseType =
  | {
      type: 'new-token';
      payload: {
        viewName: string;
        token: PulseToken;
      };
    }
  | {
      type: 'update-token';
      payload: {
        viewName: string;
        token: PulseToken; // Partial update - only changed fields
      };
    }
  | {
      type: 'remove-token';
      payload: {
        viewName: string;
        token: {
          chainId: string;
          address: string;
        };
      };
    };

export interface UseTokenFiltersOptions {
  enabled?: boolean;
}

import { MOBULA_API_KEY } from '@/lib/mobulaClient';

const PULSE_DEBUG = process.env.NEXT_PUBLIC_PULSE_DEBUG === 'true';

/**
 * Converts REST URL to WebSocket URL
 * http://localhost:4058 -> ws://localhost:4058
 * https://api.mobula.io -> wss://api.mobula.io
 */
function restUrlToWsUrl(restUrl: string): string {
  return restUrl.replace(/^http/, 'ws');
}

const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

// Singleton guard: only one active WS connection across all hook instances
let pulseActiveInstances = 0;
let pulseWs: WebSocket | null = null;
let pulseReconnectTimeout: NodeJS.Timeout | null = null;
let pulsePingInterval: NodeJS.Timeout | null = null;
let pulseIsUnsubscribing = false;
let pulseSubscriptionInProgress = false;

export interface UseTokenFiltersReturn {
  // Data & Status
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  isHydrated: boolean;

  // Subscription States
  isStreaming: boolean;

  // Actions
  applyFilters(): void;
  resetFilters(): void;

  // Debug Info
  debugInfo: {
    payloadStr: string;
    lastMessage: string;
    messageCount: number;
  };
}

export function useTokenFilters(
  { enabled = true }: UseTokenFiltersOptions = {}
): UseTokenFiltersReturn {
  const isOwnerRef = useRef(false);
  const prevPayloadStrRef = useRef<string>('');

  const lastProcessedMessageRef = useRef<string>('');
  const messageCountRef = useRef(0);

  // UI state — start with loading=false when there's cached data
  const [isHydrated, setIsHydrated] = useState(false);
  const hasCachedData = usePulseDataStore.getState().sections.new.tokens.length > 0
    || usePulseDataStore.getState().sections.bonding.tokens.length > 0
    || usePulseDataStore.getState().sections.bonded.tokens.length > 0;
  const [loading, setLoading] = useState(!hasCachedData);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Token state per view for merging partial updates
  const tokenStateRef = useRef<Map<string, Map<string, PulseToken>>>(new Map());
  const appliedSections = usePulseFilterStore((state) => state.appliedSections);
  const filtersVersion = usePulseFilterStore((state) => state.filtersVersion);
  // Create batchers for batching updates using rAF — single batch set() per frame
  const tokenUpdateBatcherRef = useRef<UpdateBatcher<{ view: ViewName; token: PulseToken }>>(
    new UpdateBatcher((updates) => {
      usePulseDataStore.getState().mergeTokensBatch(updates);
    })
  );

  const newTokenBatcherRef = useRef<UpdateBatcher<{ view: ViewName; token: PulseToken }>>(
    new UpdateBatcher((updates) => {
      usePulseDataStore.getState().mergeTokensBatch(updates);
    })
  );

  // Get configured URLs from store
  const selectedAllModeWssUrl = useApiStore((state) => state.selectedAllModeWssUrl);
  const selectedWssRegion = useApiStore((state) => state.selectedWssRegion);

  // Get REST URL using the same logic as getMobulaClient (reads cookie first)
  const getRestUrl = useCallback(() => {
    const defaultRestUrl = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
    let restUrl = process.env.NEXT_PUBLIC_MOBULA_API_URL || defaultRestUrl;
    
    if (typeof document !== 'undefined') {
      const cookie = document.cookie
        .split('; ')
        .find(c => c.trim().startsWith('customRestUrl='));
      
      if (cookie) {
        const urlFromCookie = decodeURIComponent(cookie.split('=')[1]).trim();
        if (urlFromCookie) {
          restUrl = urlFromCookie;
        }
      }
    }
    
    return restUrl;
  }, []);

  // Compute WebSocket URL from WSS config (never derive from REST URL)
  const wsUrl = useMemo(() => {
    if (selectedAllModeWssUrl) return selectedAllModeWssUrl;
    if (selectedWssRegion) {
      const regionUrl = WSS_REGIONS[selectedWssRegion];
      if (regionUrl) return regionUrl;
    }
    return WSS_REGIONS[DEFAULT_WSS_REGION];
  }, [selectedAllModeWssUrl, selectedWssRegion]);

  // Track REST loading state
  const initialDataLoadedRef = useRef(false);
  const restLoadInProgressRef = useRef(false);
  const restDataReadyRef = useRef(false);

  // Hydration timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Build filters object from metrics and audits
   * Converts to token-filters v3 format (camelCase)
   */
  const buildFilters = useCallback((section: typeof appliedSections['new-pairs']) => {
    const filters: Record<string, unknown> = {};

    const parseNumber = (value: string): number | null => {
      if (!value || value.trim() === '') return null;
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    // Keyword filters
    if (section.includeKeywords && section.includeKeywords.trim() !== '') {
      const keywords = section.includeKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
      if (keywords.length > 0) {
        filters.includeKeywords = keywords;
      }
    }

    if (section.excludeKeywords && section.excludeKeywords.trim() !== '') {
      const keywords = section.excludeKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
      if (keywords.length > 0) {
        filters.excludeKeywords = keywords;
      }
    }

    // Metrics filters (camelCase for token-filters v3)
    const volumeMin = parseNumber(section.metrics.volume.min);
    const volumeMax = parseNumber(section.metrics.volume.max);
    if (volumeMin !== null || volumeMax !== null) {
      filters.volumeUSD24h = {};
      if (volumeMin !== null) (filters.volumeUSD24h as Record<string, number>).gte = volumeMin;
      if (volumeMax !== null) (filters.volumeUSD24h as Record<string, number>).lte = volumeMax;
    }

    const marketCapMin = parseNumber(section.metrics.marketCap.min);
    const marketCapMax = parseNumber(section.metrics.marketCap.max);
    if (marketCapMin !== null || marketCapMax !== null) {
      filters.marketCapUSD = {};
      if (marketCapMin !== null) (filters.marketCapUSD as Record<string, number>).gte = marketCapMin;
      if (marketCapMax !== null) (filters.marketCapUSD as Record<string, number>).lte = marketCapMax;
    }

    const liquidityMin = parseNumber(section.metrics.liquidity.min);
    const liquidityMax = parseNumber(section.metrics.liquidity.max);
    if (liquidityMin !== null || liquidityMax !== null) {
      filters.liquidityUSD = {};
      if (liquidityMin !== null) (filters.liquidityUSD as Record<string, number>).gte = liquidityMin;
      if (liquidityMax !== null) (filters.liquidityUSD as Record<string, number>).lte = liquidityMax;
    }

    const bCurveMin = parseNumber(section.metrics.bCurvePercent.min);
    const bCurveMax = parseNumber(section.metrics.bCurvePercent.max);
    if (bCurveMin !== null || bCurveMax !== null) {
      filters.bondingPercentage = {};
      if (bCurveMin !== null) (filters.bondingPercentage as Record<string, number>).gte = bCurveMin;
      if (bCurveMax !== null) (filters.bondingPercentage as Record<string, number>).lte = bCurveMax;
    }

    const txnsMin = parseNumber(section.metrics.txns.min);
    const txnsMax = parseNumber(section.metrics.txns.max);
    if (txnsMin !== null || txnsMax !== null) {
      filters.trades24h = {};
      if (txnsMin !== null) (filters.trades24h as Record<string, number>).gte = txnsMin;
      if (txnsMax !== null) (filters.trades24h as Record<string, number>).lte = txnsMax;
    }

    const numBuysMin = parseNumber(section.metrics.numBuys.min);
    const numBuysMax = parseNumber(section.metrics.numBuys.max);
    if (numBuysMin !== null || numBuysMax !== null) {
      filters.buys24h = {};
      if (numBuysMin !== null) (filters.buys24h as Record<string, number>).gte = numBuysMin;
      if (numBuysMax !== null) (filters.buys24h as Record<string, number>).lte = numBuysMax;
    }

    const numSellsMin = parseNumber(section.metrics.numSells.min);
    const numSellsMax = parseNumber(section.metrics.numSells.max);
    if (numSellsMin !== null || numSellsMax !== null) {
      filters.sells24h = {};
      if (numSellsMin !== null) (filters.sells24h as Record<string, number>).gte = numSellsMin;
      if (numSellsMax !== null) (filters.sells24h as Record<string, number>).lte = numSellsMax;
    }

    // Audits filters
    const holdersMin = parseNumber(section.audits.holders.min);
    const holdersMax = parseNumber(section.audits.holders.max);
    if (holdersMin !== null || holdersMax !== null) {
      filters.holdersCount = {};
      if (holdersMin !== null) (filters.holdersCount as Record<string, number>).gte = holdersMin;
      if (holdersMax !== null) (filters.holdersCount as Record<string, number>).lte = holdersMax;
    }

    const top10HoldersMin = parseNumber(section.audits.top10HoldersPercent.min);
    const top10HoldersMax = parseNumber(section.audits.top10HoldersPercent.max);
    if (top10HoldersMin !== null || top10HoldersMax !== null) {
      filters.top10HoldingsPercentage = {};
      if (top10HoldersMin !== null) (filters.top10HoldingsPercentage as Record<string, number>).gte = top10HoldersMin;
      if (top10HoldersMax !== null) (filters.top10HoldingsPercentage as Record<string, number>).lte = top10HoldersMax;
    }

    const devHoldingMin = parseNumber(section.audits.devHoldingPercent.min);
    const devHoldingMax = parseNumber(section.audits.devHoldingPercent.max);
    if (devHoldingMin !== null || devHoldingMax !== null) {
      filters.devHoldingsPercentage = {};
      if (devHoldingMin !== null) (filters.devHoldingsPercentage as Record<string, number>).gte = devHoldingMin;
      if (devHoldingMax !== null) (filters.devHoldingsPercentage as Record<string, number>).lte = devHoldingMax;
    }

    const snipersMin = parseNumber(section.audits.snipersPercent.min);
    const snipersMax = parseNumber(section.audits.snipersPercent.max);
    if (snipersMin !== null || snipersMax !== null) {
      filters.snipersHoldingsPercentage = {};
      if (snipersMin !== null) (filters.snipersHoldingsPercentage as Record<string, number>).gte = snipersMin;
      if (snipersMax !== null) (filters.snipersHoldingsPercentage as Record<string, number>).lte = snipersMax;
    }

    const insidersMin = parseNumber(section.audits.insidersPercent.min);
    const insidersMax = parseNumber(section.audits.insidersPercent.max);
    if (insidersMin !== null || insidersMax !== null) {
      filters.insidersHoldingsPercentage = {};
      if (insidersMin !== null) (filters.insidersHoldingsPercentage as Record<string, number>).gte = insidersMin;
      if (insidersMax !== null) (filters.insidersHoldingsPercentage as Record<string, number>).lte = insidersMax;
    }

    // Boolean filters
    if (section.audits.dexPaid === true) {
      filters.dexScreenerAdPaid = { equals: true };
    }

    // Socials filters
    if (section.socials.twitter === true) {
      filters.twitter = { isNotNull: true };
    }

    if (section.socials.website === true) {
      filters.website = { isNotNull: true };
    }

    if (section.socials.telegram === true) {
      filters.telegram = { isNotNull: true };
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  }, []);

  /**
   * Build subscription payload for token-filters v3
   * Format: { mode: 'token', views: { viewName: { ... } } }
   */
  const payload = useMemo(() => {
    if (!isHydrated) {
      return null;
    }

    const {
      'new-pairs': newS,
      'final-stretch': bondingS,
      migrated: bondedS,
    } = appliedSections;

    const buildView = (section: typeof newS, model: 'new' | 'bonding' | 'bonded') => {
      const metricFilters = buildFilters(section);
      
      // Protocol filter - convert to source filter for token-filters v3
      const sourceFilter = section.protocols.length > 0 
        ? { source: { in: section.protocols } } 
        : {};
      
      // Chain filter
      const chainFilter = section.chainIds.length > 0
        ? { chainId: { in: section.chainIds } }
        : {};

      const filters = { ...metricFilters, ...sourceFilter, ...chainFilter };

      return {
        model,
        limit: 50,
        ...(Object.keys(filters).length > 0 && { filters }),
      };
    };

    // Token-filters v3 uses object format for views, not array
    const views: Record<string, unknown> = {
      new: buildView(newS, 'new'),
      bonding: buildView(bondingS, 'bonding'),
      bonded: buildView(bondedS, 'bonded'),
    };

    return {
      mode: 'token' as const,
      views,
    };
  }, [isHydrated, appliedSections, filtersVersion, buildFilters]);

  const payloadStr = useMemo(() => {
    return payload ? JSON.stringify(payload) : '';
  }, [payload]);

  /**
   * Get token key for state management — handles both nested and flat formats
   */
  const getTokenKey = useCallback((token: PulseToken) => {
    const flat = token?.token?.address ? token.token : token;
    return `${flat?.address || ''}_${flat?.chainId || ''}`;
  }, []);

  /**
   * Normalize nested token structure to flat.
   * { token: { address, chainId, name }, marketCapUSD } → { address, chainId, name, marketCapUSD }
   * Top-level fields take priority over nested ones.
   */
  const normalizeToken = useCallback((token: PulseToken): PulseToken => {
    if (token.token && typeof token.token === 'object') {
      const { token: nested, ...rest } = token;
      return { ...nested, ...rest } as PulseToken;
    }
    return token;
  }, []);

  /**
   * Merge partial token update with existing state
   * Normalizes tokens to flat format before merging.
   * Filters out undefined/null values to avoid overwriting existing data with empty values.
   */
  const mergeTokenState = useCallback((view: ViewName, partialToken: PulseToken): PulseToken => {
    const normalized = normalizeToken(partialToken);
    let viewState = tokenStateRef.current.get(view);
    if (!viewState) {
      viewState = new Map();
      tokenStateRef.current.set(view, viewState);
    }

    const key = getTokenKey(normalized);
    const existing = viewState.get(key);

    if (existing) {
      // Create new object - existing may be frozen/read-only
      const merged: Record<string, unknown> = { ...existing };
      const partial = normalized as Record<string, unknown>;
      for (const k in partial) {
        const v = partial[k];
        if (v != null) merged[k] = v;
      }
      viewState.set(key, merged as PulseToken);
      return merged as PulseToken;
    }

    viewState.set(key, normalized);
    return normalized;
  }, [getTokenKey, normalizeToken]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (msg: TokenFiltersResponseType) => {
      if (!msg) return;

      // Skip WS messages until REST initial data is ready
      if (!restDataReadyRef.current) {
        if (PULSE_DEBUG) {
          console.log('[TokenFilters] Skipping WS message (REST not ready yet):', msg.type);
        }
        return;
      }

      messageCountRef.current++;

      switch (msg.type) {
        case 'new-token': {
          const viewName = msg.payload.viewName as ViewName;
          const token = msg.payload.token;
          
          if (PULSE_DEBUG) {
            console.log(`[TokenFilters] new-token in ${viewName}:`, token);
          }

          if (viewName && token) {
            mergeTokenState(viewName, token);
            newTokenBatcherRef.current.add({ view: viewName, token });
          }
          break;
        }

        case 'update-token': {
          const viewName = msg.payload.viewName as ViewName;
          const partialToken = msg.payload.token;

          if (PULSE_DEBUG) {
            console.log(`[TokenFilters] update-token in ${viewName}:`, partialToken);
          }

          if (viewName && partialToken) {
            // Only update if token already exists — never add partial data
            const key = getTokenKey(partialToken);
            const viewState = tokenStateRef.current.get(viewName);
            if (viewState && viewState.has(key)) {
              const mergedToken = mergeTokenState(viewName, partialToken);
              tokenUpdateBatcherRef.current.add({ view: viewName, token: mergedToken });
            }
          }
          break;
        }

        case 'remove-token': {
          const viewName = msg.payload.viewName as ViewName;
          const tokenId = msg.payload.token;
          
          if (PULSE_DEBUG) {
            console.log(`[TokenFilters] remove-token from ${viewName}:`, tokenId);
          }

          if (tokenStateRef.current.has(viewName)) {
            const key = getTokenKey(tokenId);
            tokenStateRef.current.get(viewName)!.delete(key);
          }
          break;
        }
      }
    },
    [mergeTokenState, getTokenKey]
  );

  /**
   * Process REST response and populate initial data
   */
  const processRestResponse = useCallback(
    (response: { subscriptionId: string; views: Record<string, { data: PulseToken[] }> }) => {
      if (!response?.views) return;

      // Backend view names match ViewName type: 'new', 'bonding', 'bonded'
      const validViewNames: ViewName[] = ['new', 'bonding', 'bonded'];

      for (const [viewName, viewData] of Object.entries(response.views)) {
        if (!validViewNames.includes(viewName as ViewName) || !viewData?.data) continue;

        const typedViewName = viewName as ViewName;
        for (const token of viewData.data) {
          mergeTokenState(typedViewName, token);
        }
        usePulseDataStore.getState().setTokens(viewName as ViewName, viewData.data);
      }

      if (PULSE_DEBUG) {
        console.log('[TokenFilters] REST data loaded:', response);
      }
    },
    [mergeTokenState]
  );

  /**
   * Load initial data via REST API
   */
  const loadInitialData = useCallback(async () => {
    if (restLoadInProgressRef.current || !payload) {
      return;
    }

    restLoadInProgressRef.current = true;

    try {
      const restUrl = getRestUrl();
      const url = `${restUrl}/api/2/token/filters`;
      
      console.log('[TokenFilters] Fetching initial data from:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOBULA_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`REST request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      processRestResponse(data);
      initialDataLoadedRef.current = true;
      restDataReadyRef.current = true;

      console.log('[TokenFilters] Initial data loaded via REST');
    } catch (e) {
      console.error('[TokenFilters] Failed to load initial data via REST:', e);
      // Don't block WebSocket on REST failure — start processing WS messages
      initialDataLoadedRef.current = false;
      restDataReadyRef.current = true;
    } finally {
      restLoadInProgressRef.current = false;
    }
  }, [payload, getRestUrl, processRestResponse]);

  /**
   * Start ping interval to keep connection alive
   */
  const startPingInterval = useCallback(() => {
    if (pulsePingInterval) {
      clearInterval(pulsePingInterval);
    }

    pulsePingInterval = setInterval(() => {
      if (pulseWs?.readyState === WebSocket.OPEN) {
        pulseWs.send(JSON.stringify({ event: 'ping' }));
      }
    }, PING_INTERVAL);
  }, []);

  /**
   * Stop ping interval
   */
  const stopPingInterval = useCallback(() => {
    if (pulsePingInterval) {
      clearInterval(pulsePingInterval);
      pulsePingInterval = null;
    }
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (pulseSubscriptionInProgress || !payload) {
      return;
    }

    pulseSubscriptionInProgress = true;
    // Only show loading state when there's no cached data to display
    const hasCache = usePulseDataStore.getState().sections.new.tokens.length > 0
      || usePulseDataStore.getState().sections.bonding.tokens.length > 0
      || usePulseDataStore.getState().sections.bonded.tokens.length > 0;
    if (!hasCache) setLoading(true);

    try {
      // Close existing connection
      if (pulseWs) {
        pulseWs.close();
        pulseWs = null;
      }

      if (PULSE_DEBUG) {
        console.log('[TokenFilters] Connecting to', wsUrl);
      }

      const ws = new WebSocket(wsUrl);
      pulseWs = ws;

      ws.onopen = () => {
        console.log('[TokenFilters] WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Send subscription message with FULL payload
        const subscribeMessage = {
          type: 'token-filters',
          authorization: MOBULA_API_KEY,
          payload,
        };

        ws.send(JSON.stringify(subscribeMessage));
        prevPayloadStrRef.current = payloadStr;
        setLoading(false);
        pulseSubscriptionInProgress = false;

        // Start ping interval
        startPingInterval();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle error messages
          if (data.error) {
            console.error('[TokenFilters] Server error:', data.error);
            setError(data.error);
            return;
          }

          // Handle subscribed confirmation
          if (data.event === 'subscribed') {
            console.log('[TokenFilters] Subscription confirmed:', data);
            return;
          }

          // Handle ping/pong
          if (data.event === 'pong') {
            return;
          }

          handleMessage(data as TokenFiltersResponseType);
        } catch (e) {
          console.error('[TokenFilters] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('[TokenFilters] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[TokenFilters] WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        pulseWs = null;
        pulseSubscriptionInProgress = false;
        stopPingInterval();

        // Auto-reconnect if not intentionally closed
        if (!pulseIsUnsubscribing && enabled) {
          pulseReconnectTimeout = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };
    } catch (e) {
      console.error('[TokenFilters] Connect error:', e);
      setError(e instanceof Error ? e.message : 'Connection failed');
      pulseSubscriptionInProgress = false;
      setLoading(false);
    }
  }, [payload, payloadStr, handleMessage, enabled, startPingInterval, stopPingInterval, wsUrl]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    pulseIsUnsubscribing = true;

    if (pulseReconnectTimeout) {
      clearTimeout(pulseReconnectTimeout);
      pulseReconnectTimeout = null;
    }

    stopPingInterval();

    if (pulseWs) {
      pulseWs.close();
      pulseWs = null;
    }

    setIsConnected(false);
    pulseSubscriptionInProgress = false;
  }, [stopPingInterval]);

  /**
   * Main subscription effect — singleton: only first instance starts connection
   */
  useEffect(() => {
    if (!enabled || !isHydrated || !payload) {
      return;
    }

    pulseActiveInstances++;
    if (pulseActiveInstances > 1) {
      return () => { pulseActiveInstances--; };
    }

    isOwnerRef.current = true;

    const payloadChanged = payloadStr !== prevPayloadStrRef.current;

    // Skip if nothing changed and already connected
    if (!payloadChanged && pulseWs?.readyState === WebSocket.OPEN) {
      return () => {
        pulseActiveInstances--;
        if (pulseActiveInstances > 0) {
          isOwnerRef.current = false;
          return;
        }
        disconnect();
      };
    }

    setError(null);

    // Clear token state on reconnect
    tokenStateRef.current.clear();
    messageCountRef.current = 0;
    initialDataLoadedRef.current = false;
    restDataReadyRef.current = false;

    // Disconnect and reconnect with new payload
    pulseIsUnsubscribing = false;

    if (pulseWs) {
      pulseWs.close();
      pulseWs = null;
    }

    // Launch REST and WebSocket in parallel — WS messages are skipped until REST completes
    const timer = setTimeout(() => {
      loadInitialData();
      connect();
    }, 100);

    return () => {
      pulseActiveInstances--;
      if (pulseActiveInstances > 0) {
        isOwnerRef.current = false;
        return;
      }
      clearTimeout(timer);
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isHydrated, payloadStr]);

  /**
   * Apply filters - triggers re-subscription with new payload
   */
  const applyFilters = useCallback(() => {
    // The filter store update will trigger a payload change
    // which will cause re-subscription via the effect
  }, []);

  const resetFilters = useCallback(() => {
    applyFilters();
  }, [applyFilters]);

  /**
   * Cleanup batchers on unmount
   */
  useEffect(() => {
    return () => {
      tokenUpdateBatcherRef.current.clear();
      newTokenBatcherRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loading,
    error,
    isConnected,
    isHydrated,
    isStreaming: isConnected,
    applyFilters,
    resetFilters,
    debugInfo: {
      payloadStr,
      lastMessage: lastProcessedMessageRef.current.substring(0, 100),
      messageCount: messageCountRef.current,
    },
  };
}

export default useTokenFilters;
