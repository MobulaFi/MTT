'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSurgeStore, type SurgeToken, type OhlcvCandle } from '../store/useSurgeStore';
import { useApiStore } from '@/store/apiStore';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { WSS_REGIONS, DEFAULT_WSS_REGION } from '@/config/endpoints';
import { useUserPortfolioStore } from '@/store/useUserPortfolioStore';
import { prefetchTokenFilters, getRestUrl, getApiKey } from '@/lib/prefetch';
import { fetchQuote as fetchBatchQuote } from './surgeQuotes';
import { NATIVE_TOKEN_ADDRESS } from '@/lib/tokens';

const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;


// Singleton guard: only one active WS connection across all hook instances
let surgeActiveInstances = 0;
let surgeWs: WebSocket | null = null;
let surgeReconnectTimeout: NodeJS.Timeout | null = null;
let surgePingInterval: NodeJS.Timeout | null = null;
let surgeIsUnsubscribing = false;

function restUrlToWsUrl(restUrl: string): string {
  return restUrl.replace(/^http/, 'ws');
}

export function useSurgeData() {
  const isOwnerRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);

  // Individual selectors for reactive state
  const isPaused = useSurgeStore((s) => s.isPaused);
  const selectedChainIds = useSurgeStore((s) => s.selectedChainIds);
  const selectedProtocols = useSurgeStore((s) => s.selectedProtocols);
  const sortBy = useSurgeStore((s) => s.sortBy);

  // Actions via getState() — stable references, no re-renders
  const { setTokens, mergeToken, removeToken, updateTokenOhlcv, updatePosition, clearPositions, setWalletTokens, setLoading, setError } = useSurgeStore.getState();

  // Keep useRef to match original hook count (was positionSubsRef for WSS subs)
  const positionSubsRef = useRef<Array<{ unsubscribe: () => void }>>([]);

  const { solanaAddress, evmAddress } = useWalletConnection();
  // Keep useTradingPanelStore hook to match original hook count
  const balanceRefreshTrigger = useTradingPanelStore((s) => s.balanceRefreshTrigger);

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
    const chainFilter = selectedChainIds.length > 0
      ? { chainId: { in: selectedChainIds } }
      : {};
    const sourceFilter = selectedProtocols.length > 0
      ? { source: { in: selectedProtocols } }
      : {};

    const filters = { ...chainFilter, ...sourceFilter };

    // sortBy maps directly to token/filters model names
    const model = sortBy;

    return {
      mode: 'token' as const,
      views: {
        [model]: {
          model,
          limit: 10,
          ohlcv: true,
          ohlcvTimeframe: '1s',
          ...(Object.keys(filters).length > 0 && { filters }),
        },
      },
    };
  }, [selectedChainIds, selectedProtocols, sortBy]);

  // Load initial data via REST (uses shared prefetch cache)
  const loadInitialData = useCallback(async () => {
    // Only show loading skeleton when there's no cached data
    const hasCachedTokens = useSurgeStore.getState().tokens.length > 0;
    if (!hasCachedTokens) setLoading(true);
    try {
      const data = await prefetchTokenFilters(buildPayload()) as Record<string, unknown> | null;

      if (!data) {
        setTokens([]);
        return;
      }

      const viewData = (data?.views as Record<string, { data: Record<string, unknown>[] }>)?.[sortBy]?.data;
      if (viewData) {
        const tokens: SurgeToken[] = viewData.map(
          (t: Record<string, unknown>) => {
            const token = t.token && typeof t.token === 'object' ? { ...t, ...(t.token as Record<string, unknown>) } : t;
            return token as SurgeToken;
          }
        );
        setTokens(tokens);
      } else {
        setTokens([]);
      }
    } catch (e) {
      console.error('[Surge] Failed to load initial data:', e);
      setError(e instanceof Error ? e.message : 'Failed to load data');
    }
  }, [buildPayload, sortBy, setTokens, setLoading, setError]);

  // WebSocket connection
  const connect = useCallback(() => {
    if (isPaused) return;

    if (surgeWs) {
      surgeWs.close();
      surgeWs = null;
    }

    const ws = new WebSocket(wsUrl());
    surgeWs = ws;

    ws.onopen = () => {
      setIsConnected(true);

      const subscribeMessage = {
        type: 'token-filters',
        authorization: getApiKey(),
        payload: buildPayload(),
      };

      ws.send(JSON.stringify(subscribeMessage));

      // Start ping
      if (surgePingInterval) clearInterval(surgePingInterval);
      surgePingInterval = setInterval(() => {
        if (surgeWs?.readyState === WebSocket.OPEN) {
          surgeWs.send(JSON.stringify({ event: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error || data.event === 'subscribed' || data.event === 'pong') return;

        console.log('[Surge] WS message:', data.type, data.payload?.viewName);

        const viewName = data.payload?.viewName;
        const currentModel = useSurgeStore.getState().sortBy;

        if (viewName !== currentModel) return;

        if (data.type === 'new-token') {
          if (data.payload?.token) {
            const raw = data.payload.token;
            const token =
              raw.token && typeof raw.token === 'object'
                ? { ...raw, ...(raw.token as Record<string, unknown>) }
                : raw;

            // Attach OHLCV init data from new-token payload
            if (Array.isArray(data.payload.ohlcv) && data.payload.ohlcv.length > 0) {
              (token as Record<string, unknown>).ohlcv = data.payload.ohlcv;
            }

            mergeToken(token as SurgeToken);
          }
        } else if (data.type === 'update-token') {
          if (data.payload?.token) {
            const raw = data.payload.token;
            const token =
              raw.token && typeof raw.token === 'object'
                ? { ...raw, ...(raw.token as Record<string, unknown>) }
                : raw;

            // Only update if token already exists — never add partial data
            const existing = useSurgeStore.getState().tokens;
            const key = `${token.address}_${token.chainId}`;
            if (existing.some((t: SurgeToken) => `${t.address}_${t.chainId}` === key)) {
              mergeToken(token as SurgeToken);
            }
          }
        } else if (data.type === 'update-token-ohlcv') {
          if (data.payload?.token && data.payload?.candle) {
            const { address, chainId } = data.payload.token;
            const candle = data.payload.candle as OhlcvCandle;
            if (address && chainId && candle.t) {
              updateTokenOhlcv(address, chainId, candle);
            }
          }
        } else if (data.type === 'remove-token') {
          if (data.payload?.token) {
            const { address, chainId } = data.payload.token;
            removeToken(address, chainId);
          }
        }
      } catch (e) {
        console.error('[Surge] Failed to parse WS message:', e);
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      surgeWs = null;
      if (surgePingInterval) {
        clearInterval(surgePingInterval);
        surgePingInterval = null;
      }

      if (!surgeIsUnsubscribing) {
        surgeReconnectTimeout = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      }
    };
  }, [wsUrl, isPaused, buildPayload, mergeToken, removeToken, updateTokenOhlcv]);

  // Initialize — singleton: only the first instance starts the connection
  useEffect(() => {
    surgeActiveInstances++;
    if (surgeActiveInstances > 1) {
      // Another instance already owns the connection
      return () => { surgeActiveInstances--; };
    }

    isOwnerRef.current = true;
    surgeIsUnsubscribing = false;

    const init = async () => {
      await loadInitialData();
      connect();
    };
    init();

    return () => {
      surgeActiveInstances--;
      if (surgeActiveInstances > 0) {
        // Other instances still alive, keep connection
        isOwnerRef.current = false;
        return;
      }
      surgeIsUnsubscribing = true;
      if (surgeReconnectTimeout) clearTimeout(surgeReconnectTimeout);
      if (surgePingInterval) clearInterval(surgePingInterval);
      if (surgeWs) {
        surgeWs.close();
        surgeWs = null;
      }
    };
  }, [loadInitialData, connect]);

  // Hydrate surge positions from global portfolio store (no duplicate WSS subs)
  // Uses getState() to avoid adding extra hook calls and changing hook count
  useEffect(() => {
    const wallet = solanaAddress || evmAddress;
    if (!wallet) {
      clearPositions();
      return;
    }

    // Suppress lint: positionSubsRef kept for hook count parity with original
    void positionSubsRef.current;

    const globalPositions = useUserPortfolioStore.getState().positions;
    if (globalPositions.length === 0) {
      clearPositions();
      return;
    }

    // Match surge tokens against global portfolio positions
    const tokens = useSurgeStore.getState().tokens;
    const surgeAddrs = new Set(tokens.map((t) => t.address.toLowerCase()));

    clearPositions();
    for (const pos of globalPositions) {
      if (surgeAddrs.has(pos.address.toLowerCase()) && pos.balance > 0) {
        updatePosition(pos.address, {
          balance: pos.balance,
          amountUSD: pos.balanceUSD,
          unrealizedPnlUSD: pos.unrealizedPnlUSD,
          totalPnlUSD: pos.totalPnlUSD,
          avgBuyPriceUSD: pos.avgBuyPriceUSD,
        });
      }
    }

    // Re-check periodically (portfolio store updates via polling + WSS)
    const interval = setInterval(() => {
      const freshPositions = useUserPortfolioStore.getState().positions;
      const freshTokens = useSurgeStore.getState().tokens;
      const addrs = new Set(freshTokens.map((t) => t.address.toLowerCase()));

      for (const pos of freshPositions) {
        if (addrs.has(pos.address.toLowerCase()) && pos.balance > 0) {
          updatePosition(pos.address, {
            balance: pos.balance,
            amountUSD: pos.balanceUSD,
            unrealizedPnlUSD: pos.unrealizedPnlUSD,
            totalPnlUSD: pos.totalPnlUSD,
            avgBuyPriceUSD: pos.avgBuyPriceUSD,
          });
        }
      }
    }, 5_000);

    return () => clearInterval(interval);
  }, [solanaAddress, evmAddress, updatePosition, clearPositions]);

  // Re-check positions when tokens list changes
  const tokensRef = useRef<string>('');
  useEffect(() => {
    const tokens = useSurgeStore.getState().tokens;
    const key = tokens.map((t) => t.address).sort().join(',');
    if (key === tokensRef.current) return;
    tokensRef.current = key;

    const wallet = solanaAddress || evmAddress;
    if (!wallet || tokens.length === 0) return;

    const globalPositions = useUserPortfolioStore.getState().positions;
    const surgeAddrs = new Set(tokens.map((t) => t.address.toLowerCase()));

    for (const pos of globalPositions) {
      if (surgeAddrs.has(pos.address.toLowerCase()) && pos.balance > 0) {
        updatePosition(pos.address, {
          balance: pos.balance,
          amountUSD: pos.balanceUSD,
          unrealizedPnlUSD: pos.unrealizedPnlUSD,
          totalPnlUSD: pos.totalPnlUSD,
          avgBuyPriceUSD: pos.avgBuyPriceUSD,
        });
      }
    }
  });

  // Wallet tokens: read from global portfolio store (populated by UserPortfolioProvider)
  useEffect(() => {
    const wallet = solanaAddress || evmAddress;
    if (!wallet) return;

    const globalWalletTokens = useUserPortfolioStore.getState().walletTokens;
    if (globalWalletTokens.length > 0) {
      setWalletTokens(globalWalletTokens);
    }

    // Poll from global store periodically
    const interval = setInterval(() => {
      const freshTokens = useUserPortfolioStore.getState().walletTokens;
      if (freshTokens.length > 0) {
        setWalletTokens(freshTokens);
      }
    }, 5_000);

    return () => clearInterval(interval);
  }, [solanaAddress, evmAddress, setWalletTokens, balanceRefreshTrigger]);

  // Batch quote polling — every 2s, fetch quotes for ALL visible tokens
  useEffect(() => {
    const wallet = solanaAddress || evmAddress;
    if (!wallet) return;

    const poll = () => {
      const store = useSurgeStore.getState();
      const { tokens, quickBuyAmount, quickSellPercentage, slippage, positions, walletTokens, buyCurrencyAddress } = store;

      if (tokens.length === 0) return;

      // If walletTokens not yet loaded, try reading from global portfolio store directly
      let effectiveWalletTokens = walletTokens;
      if (effectiveWalletTokens.length === 0) {
        const globalWt = useUserPortfolioStore.getState().walletTokens;
        if (globalWt.length > 0) {
          setWalletTokens(globalWt);
          effectiveWalletTokens = globalWt;
        }
      }

      const selected = buyCurrencyAddress === null
        ? effectiveWalletTokens.find(t => t.isNative)
        : effectiveWalletTokens.find(t => t.address === buyCurrencyAddress);
      const quoteInfo = selected || effectiveWalletTokens[0];
      if (!quoteInfo) return;

      const quoteToken = quoteInfo.address;
      const quotePrice = quoteInfo.priceUSD;
      const buyAmountUSD = Number(quickBuyAmount) || 0;
      const sellPct = Number(quickSellPercentage) || 100;

      console.log('[Surge] Batch quoting', tokens.length, 'tokens, quoteToken:', quoteToken, 'buyUSD:', buyAmountUSD);

      for (const token of tokens) {
        fetchBatchQuote(token.address, token.chainId, 'buy', {
          walletAddress: wallet,
          quoteToken,
          quotePrice,
          buyAmountUSD,
          sellPct,
          holdingBalance: 0,
          slippage,
        });

        const position = positions[token.address.toLowerCase()];
        if (position && position.balance > 0) {
          fetchBatchQuote(token.address, token.chainId, 'sell', {
            walletAddress: wallet,
            quoteToken,
            quotePrice,
            buyAmountUSD,
            sellPct,
            holdingBalance: position.balance,
            slippage,
          });
        }
      }
    };

    // Initial poll after short delay to let walletTokens hydrate
    const initialTimeout = setTimeout(poll, 500);
    const interval = setInterval(poll, 2_000);
    return () => { clearTimeout(initialTimeout); clearInterval(interval); };
  }, [solanaAddress, evmAddress, setWalletTokens]);

  return { isConnected };
}
