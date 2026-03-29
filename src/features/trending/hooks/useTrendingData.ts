'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTrendingStore, type TrendingToken } from '../store/useTrendingStore';
import { useApiStore } from '@/store/apiStore';
import { WSS_REGIONS, DEFAULT_WSS_REGION } from '@/config/endpoints';
import { prefetchTokenFilters, getRestUrl, getApiKey } from '@/lib/prefetch';

const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

// Singleton guard: only one active WS connection across all hook instances
let trendingActiveInstances = 0;
let trendingWs: WebSocket | null = null;
let trendingReconnectTimeout: NodeJS.Timeout | null = null;
let trendingPingInterval: NodeJS.Timeout | null = null;
let trendingIsUnsubscribing = false;

function restUrlToWsUrl(restUrl: string): string {
  return restUrl.replace(/^http/, 'ws');
}

export function useTrendingData() {
  const isOwnerRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);

  // Individual selectors for reactive state
  const isPaused = useTrendingStore((s) => s.isPaused);
  const selectedChainIds = useTrendingStore((s) => s.selectedChainIds);
  const selectedProtocols = useTrendingStore((s) => s.selectedProtocols);
  const model = useTrendingStore((s) => s.model);
  const backendSortBy = useTrendingStore((s) => s.backendSortBy);
  const backendSortOrder = useTrendingStore((s) => s.backendSortOrder);
  const filters = useTrendingStore((s) => s.filters);

  // Actions via getState() — stable references, no re-renders
  const { setTokens, mergeToken, removeToken, setLoading, setError } = useTrendingStore.getState();

  const selectedAllModeWssUrl = useApiStore((state) => state.selectedAllModeWssUrl);
  const selectedWssRegion = useApiStore((state) => state.selectedWssRegion);

  const wsUrl = useCallback(() => {
    if (selectedAllModeWssUrl) return selectedAllModeWssUrl;
    if (selectedWssRegion) {
      const regionUrl = WSS_REGIONS[selectedWssRegion as keyof typeof WSS_REGIONS];
      if (regionUrl) return regionUrl;
    }
    return WSS_REGIONS[DEFAULT_WSS_REGION];
  }, [selectedAllModeWssUrl, selectedWssRegion]);

  const buildPayload = useCallback(() => {
    // Always read fresh from store to handle hydration timing
    const state = useTrendingStore.getState();
    const filterObj: Record<string, unknown> = {};

    if (state.selectedChainIds.length > 0) {
      filterObj.chainId = { in: state.selectedChainIds };
    }
    if (state.selectedProtocols.length > 0) {
      filterObj.source = { in: state.selectedProtocols };
    }

    // Apply user-defined min/max filters
    for (const f of state.filters) {
      if (f.min !== undefined || f.max !== undefined) {
        const op: Record<string, number> = {};
        if (f.min !== undefined) op.gte = f.min;
        if (f.max !== undefined) op.lte = f.max;
        filterObj[f.field] = op;
      }
    }

    const viewDef: Record<string, unknown> = {
      model: state.model,
      limit: 50,
    };

    // Only send sortBy/sortOrder if the user explicitly set overrides
    if (state.backendSortBy) {
      viewDef.sortBy = state.backendSortBy;
      viewDef.sortOrder = state.backendSortOrder;
    }

    if (Object.keys(filterObj).length > 0) {
      viewDef.filters = filterObj;
    }

    return {
      mode: 'token' as const,
      views: {
        [state.model]: viewDef,
      },
    };
  }, [selectedChainIds, selectedProtocols, model, backendSortBy, backendSortOrder, filters]);

  const loadInitialData = useCallback(async () => {
    // Only show loading skeleton when there's no cached data
    const hasCachedTokens = useTrendingStore.getState().tokens.length > 0;
    if (!hasCachedTokens) setLoading(true);
    try {
      const data = await prefetchTokenFilters(buildPayload()) as Record<string, unknown> | null;

      if (!data) {
        setTokens([]);
        return;
      }

      const currentModel = useTrendingStore.getState().model;
      const viewData = (data?.views as Record<string, { data: Record<string, unknown>[] }>)?.[currentModel]?.data;

      if (viewData) {
        const tokens: TrendingToken[] = viewData.map(
          (t: Record<string, unknown>) => {
            const merged = t.token && typeof t.token === 'object' ? { ...t, ...(t.token as Record<string, unknown>) } : { ...t };
            if (!merged.name && merged.tokenName) merged.name = merged.tokenName;
            if (!merged.symbol && merged.tokenSymbol) merged.symbol = merged.tokenSymbol;
            if (!merged.logo && merged.tokenLogo) merged.logo = merged.tokenLogo;
            return merged as TrendingToken;
          }
        );
        setTokens(tokens);
      } else {
        setTokens([]);
      }
    } catch (e) {
      console.error('[Trending] Failed to load initial data:', e);
      setError(e instanceof Error ? e.message : 'Failed to load data');
    }
  }, [buildPayload, setTokens, setLoading, setError]);

  // WebSocket connection
  const connect = useCallback(() => {
    if (isPaused) return;

    if (trendingWs) {
      trendingWs.close();
      trendingWs = null;
    }

    const ws = new WebSocket(wsUrl());
    trendingWs = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'token-filters',
        authorization: getApiKey(),
        payload: buildPayload(),
      }));

      if (trendingPingInterval) clearInterval(trendingPingInterval);
      trendingPingInterval = setInterval(() => {
        if (trendingWs?.readyState === WebSocket.OPEN) {
          trendingWs.send(JSON.stringify({ event: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error || data.event === 'subscribed' || data.event === 'pong') return;

        const viewName = data.payload?.viewName;
        const currentModel = useTrendingStore.getState().model;
        if (viewName !== currentModel) return;

        if (data.type === 'new-token') {
          if (data.payload?.token) {
            const raw = data.payload.token;
            const merged =
              raw.token && typeof raw.token === 'object'
                ? { ...raw, ...(raw.token as Record<string, unknown>) }
                : { ...raw };
            if (!merged.name && merged.tokenName) merged.name = merged.tokenName;
            if (!merged.symbol && merged.tokenSymbol) merged.symbol = merged.tokenSymbol;
            if (!merged.logo && merged.tokenLogo) merged.logo = merged.tokenLogo;
            mergeToken(merged as TrendingToken);
          }
        } else if (data.type === 'update-token') {
          if (data.payload?.token) {
            const raw = data.payload.token;
            const merged =
              raw.token && typeof raw.token === 'object'
                ? { ...raw, ...(raw.token as Record<string, unknown>) }
                : { ...raw };
            if (!merged.name && merged.tokenName) merged.name = merged.tokenName;
            if (!merged.symbol && merged.tokenSymbol) merged.symbol = merged.tokenSymbol;
            if (!merged.logo && merged.tokenLogo) merged.logo = merged.tokenLogo;

            // Only update if token already exists — never add partial data
            const existing = useTrendingStore.getState().tokens;
            const key = `${merged.address}_${merged.chainId}`;
            if (existing.some((t: TrendingToken) => `${t.address}_${t.chainId}` === key)) {
              mergeToken(merged as TrendingToken);
            }
          }
        } else if (data.type === 'remove-token') {
          if (data.payload?.token) {
            const { address, chainId } = data.payload.token;
            removeToken(address, chainId);
          }
        }
      } catch (e) {
        console.error('[Trending] Failed to parse WS message:', e);
      }
    };

    ws.onerror = () => setIsConnected(false);

    ws.onclose = () => {
      setIsConnected(false);
      trendingWs = null;
      if (trendingPingInterval) {
        clearInterval(trendingPingInterval);
        trendingPingInterval = null;
      }
      if (!trendingIsUnsubscribing) {
        trendingReconnectTimeout = setTimeout(() => connect(), RECONNECT_DELAY);
      }
    };
  }, [wsUrl, isPaused, buildPayload, mergeToken, removeToken]);

  useEffect(() => {
    trendingActiveInstances++;
    if (trendingActiveInstances > 1) {
      return () => { trendingActiveInstances--; };
    }

    isOwnerRef.current = true;
    trendingIsUnsubscribing = false;

    const init = async () => {
      await loadInitialData();
      connect();
    };
    init();

    return () => {
      trendingActiveInstances--;
      if (trendingActiveInstances > 0) {
        isOwnerRef.current = false;
        return;
      }
      trendingIsUnsubscribing = true;
      if (trendingReconnectTimeout) clearTimeout(trendingReconnectTimeout);
      if (trendingPingInterval) clearInterval(trendingPingInterval);
      if (trendingWs) {
        trendingWs.close();
        trendingWs = null;
      }
    };
  }, [loadInitialData, connect]);

  return { isConnected };
}
