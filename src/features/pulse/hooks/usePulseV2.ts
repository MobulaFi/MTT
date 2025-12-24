'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { getMobulaClient } from '@/lib/mobulaClient';
import type { MobulaClient } from '@mobula_labs/sdk';
import type { PulseResponse, PulseViewData } from '@mobula_labs/types';
import { usePulseV2Store } from '@/features/pulse/store/usePulseV2Store';
import { usePulseFilterStore } from '@/features/pulse/store/usePulseModalFilterStore';
import usePulseDataStore from '@/features/pulse/store/usePulseDataStore';
import { ViewName, type PulseToken } from '@/features/pulse/store/usePulseDataStore';
import { UpdateBatcher } from '@/utils/UpdateBatcher';

type WssPulseV2ResponseType =
  | {
      type: 'init';
      payload: {
        new?: PulseViewData;
        bonding?: PulseViewData;
        bonded?: PulseViewData;
      };
    }
  | {
      type: 'update-token';
      payload: {
        viewName: string;
        token: PulseToken;
      };
    };

export interface UsePulseV2Options {
  enabled?: boolean;
  compressed?: boolean;
}

const PAUSE_TIMEOUT = 500;
const PULSE_DEBUG = process.env.NEXT_PUBLIC_PULSE_DEBUG === 'true';

export interface UsePulseV2Return {
  // Data & Status
  data: WssPulseV2ResponseType | null;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  isHydrated: boolean;
  hasInitialData: boolean;

  // Subscription States
  isPaused: boolean;
  isReconnecting: boolean;
  isStreaming: boolean;

  // Actions
  pauseSubscription(): void;
  resumeSubscription(): void;
  applyFilters(): void;
  resetFilters(): void;

  // Debug Info
  debugInfo: {
    subscriptionId: string | null;
    payloadStr: string;
    lastMessage: string;
    messageCount: number;
    isPausedInternal: boolean;
  };
}

export function usePulseV2(
  address: string,
  blockchain: string,
  { enabled = true, compressed = false }: UsePulseV2Options = {}
): UsePulseV2Return {
  const clientRef = useRef<MobulaClient | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const prevPayloadStrRef = useRef<string>('');
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnsubscribingRef = useRef(false);
  const subscriptionInProgressRef = useRef(false);
  const initialDataLoadedRef = useRef(false);
  const restLoadInProgressRef = useRef(false);

  const lastProcessedMessageRef = useRef<string>('');
  const messageCountRef = useRef(0);

  // UI state (pause/resume/reconnect states)
  const [isPaused, setIsPaused] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Internal pause state (independent of UI pause)
  const [isSubscriptionPausedInternal, setIsSubscriptionPausedInternal] = useState(false);

  // Create batchers for batching updates using rAF
  const tokenUpdateBatcherRef = useRef<UpdateBatcher<{ view: ViewName; token: PulseToken }>>(
    new UpdateBatcher((updates) => {
      // Batch apply all token updates
      updates.forEach(({ view, token }) => {
        pulseDataStore.mergeToken(view, token);
      });
    })
  );

  const initBatcherRef = useRef<UpdateBatcher<WssPulseV2ResponseType>>(
    new UpdateBatcher((updates) => {
      // Process only the latest init message
      const latestInit = updates[updates.length - 1];
      if (latestInit.type === 'init') {
        const payload = latestInit.payload;
        if (payload.new?.data) {
          const newTokens = Array.isArray(payload.new.data) ? payload.new.data : [payload.new.data];
          pulseDataStore.setTokens('new', newTokens);
        }
        if (payload.bonding?.data) {
          const bondingTokens = Array.isArray(payload.bonding.data) ? payload.bonding.data : [payload.bonding.data];
          pulseDataStore.setTokens('bonding', bondingTokens);
        }
        if (payload.bonded?.data) {
          const bondedTokens = Array.isArray(payload.bonded.data) ? payload.bonded.data : [payload.bonded.data];
          pulseDataStore.setTokens('bonded', bondedTokens);
        }
      }
    })
  );

  const appliedSections = usePulseFilterStore((state) => state.appliedSections);
  const filtersVersion = usePulseFilterStore((state) => state.filtersVersion);
  const { data, loading, error, setData, setLoading, setError } = usePulseV2Store();
  const pulseDataStore = usePulseDataStore();

  // Hydration timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Build filters object from metrics and audits
   */
  const buildFilters = useCallback((section: typeof appliedSections['new-pairs']) => {
    const filters: Record<string, { gte?: number; lte?: number; equals?: boolean | string; not?: null } | boolean | number | string[]> = {};

    const parseNumber = (value: string): number | null => {
      if (!value || value.trim() === '') return null;
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    // Keyword filters - convert comma-separated strings to arrays
    if (section.includeKeywords && section.includeKeywords.trim() !== '') {
      const keywords = section.includeKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      if (keywords.length > 0) {
        filters.includeKeywords = keywords;
      }
    }

    if (section.excludeKeywords && section.excludeKeywords.trim() !== '') {
      const keywords = section.excludeKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      if (keywords.length > 0) {
        filters.excludeKeywords = keywords;
      }
    }

    // Metrics filters
    const volumeMin = parseNumber(section.metrics.volume.min);
    const volumeMax = parseNumber(section.metrics.volume.max);
    if (volumeMin !== null || volumeMax !== null) {
      filters.volume_24h = {};
      if (volumeMin !== null) filters.volume_24h.gte = volumeMin;
      if (volumeMax !== null) filters.volume_24h.lte = volumeMax;
    }

    const marketCapMin = parseNumber(section.metrics.marketCap.min);
    const marketCapMax = parseNumber(section.metrics.marketCap.max);
    if (marketCapMin !== null || marketCapMax !== null) {
      filters.market_cap = {};
      if (marketCapMin !== null) filters.market_cap.gte = marketCapMin;
      if (marketCapMax !== null) filters.market_cap.lte = marketCapMax;
    }

    const liquidityMin = parseNumber(section.metrics.liquidity.min);
    const liquidityMax = parseNumber(section.metrics.liquidity.max);
    if (liquidityMin !== null || liquidityMax !== null) {
      filters.liquidity = {};
      if (liquidityMin !== null) filters.liquidity.gte = liquidityMin;
      if (liquidityMax !== null) filters.liquidity.lte = liquidityMax;
    }

    const bCurveMin = parseNumber(section.metrics.bCurvePercent.min);
    const bCurveMax = parseNumber(section.metrics.bCurvePercent.max);
    if (bCurveMin !== null || bCurveMax !== null) {
      filters.bonding_percentage = {};
      if (bCurveMin !== null) filters.bonding_percentage.gte = bCurveMin;
      if (bCurveMax !== null) filters.bonding_percentage.lte = bCurveMax;
    }

    const globalFeesMin = parseNumber(section.metrics.globalFeesPaid.min);
    const globalFeesMax = parseNumber(section.metrics.globalFeesPaid.max);
    if (globalFeesMin !== null || globalFeesMax !== null) {
      filters.fees_paid_24h = {};
      if (globalFeesMin !== null) filters.fees_paid_24h.gte = globalFeesMin;
      if (globalFeesMax !== null) filters.fees_paid_24h.lte = globalFeesMax;
    }

    const txnsMin = parseNumber(section.metrics.txns.min);
    const txnsMax = parseNumber(section.metrics.txns.max);
    if (txnsMin !== null || txnsMax !== null) {
      filters.trades_24h = {};
      if (txnsMin !== null) filters.trades_24h.gte = txnsMin;
      if (txnsMax !== null) filters.trades_24h.lte = txnsMax;
    }

    const numBuysMin = parseNumber(section.metrics.numBuys.min);
    const numBuysMax = parseNumber(section.metrics.numBuys.max);
    if (numBuysMin !== null || numBuysMax !== null) {
      filters.buys_24h = {};
      if (numBuysMin !== null) filters.buys_24h.gte = numBuysMin;
      if (numBuysMax !== null) filters.buys_24h.lte = numBuysMax;
    }

    const numSellsMin = parseNumber(section.metrics.numSells.min);
    const numSellsMax = parseNumber(section.metrics.numSells.max);
    if (numSellsMin !== null || numSellsMax !== null) {
      filters.sells_24h = {};
      if (numSellsMin !== null) filters.sells_24h.gte = numSellsMin;
      if (numSellsMax !== null) filters.sells_24h.lte = numSellsMax;
    }

    // Audits filters
    const holdersMin = parseNumber(section.audits.holders.min);
    const holdersMax = parseNumber(section.audits.holders.max);
    if (holdersMin !== null || holdersMax !== null) {
      filters.holders_count = {};
      if (holdersMin !== null) filters.holders_count.gte = holdersMin;
      if (holdersMax !== null) filters.holders_count.lte = holdersMax;
    }

    const proTradersMin = parseNumber(section.audits.proTraders.min);
    const proTradersMax = parseNumber(section.audits.proTraders.max);
    if (proTradersMin !== null || proTradersMax !== null) {
      filters.pro_traders_count = {};
      if (proTradersMin !== null) filters.pro_traders_count.gte = proTradersMin;
      if (proTradersMax !== null) filters.pro_traders_count.lte = proTradersMax;
    }

    const ageMin = parseNumber(section.audits.age.min);
    const ageMax = parseNumber(section.audits.age.max);
    if (ageMin !== null || ageMax !== null) {
      filters.created_at_offset = {};
      
      const convertToSeconds = (value: number, unit: string): number => {
        switch (unit.toUpperCase()) {
          case 'S':
            return value; // seconds
          case 'MIN':
            return value * 60; // minutes to seconds
          case 'H':
            return value * 3600; // hours to seconds
          case 'D':
            return value * 86400; // days to seconds
          case 'W':
            return value * 604800; // weeks to seconds
          case 'M':
            return value * 2592000; // months to seconds (30 days)
          case 'Y':
            return value * 31536000; // years to seconds (365 days)
          default:
            return value * 3600; // default to hours
        }
      };
      
      if (ageMin !== null) {
        filters.created_at_offset.gte = convertToSeconds(ageMin, section.audits.age.unit);
      }
      if (ageMax !== null) {
        filters.created_at_offset.lte = convertToSeconds(ageMax, section.audits.age.unit);
      }
    }

    const top10HoldersMin = parseNumber(section.audits.top10HoldersPercent.min);
    const top10HoldersMax = parseNumber(section.audits.top10HoldersPercent.max);
    if (top10HoldersMin !== null || top10HoldersMax !== null) {
      filters.top10_holders_percent = {};
      if (top10HoldersMin !== null) filters.top10_holders_percent.gte = top10HoldersMin;
      if (top10HoldersMax !== null) filters.top10_holders_percent.lte = top10HoldersMax;
    }

    const devHoldingMin = parseNumber(section.audits.devHoldingPercent.min);
    const devHoldingMax = parseNumber(section.audits.devHoldingPercent.max);
    if (devHoldingMin !== null || devHoldingMax !== null) {
      filters.dev_holdings_percentage = {};
      if (devHoldingMin !== null) filters.dev_holdings_percentage.gte = devHoldingMin;
      if (devHoldingMax !== null) filters.dev_holdings_percentage.lte = devHoldingMax;
    }

    const snipersMin = parseNumber(section.audits.snipersPercent.min);
    const snipersMax = parseNumber(section.audits.snipersPercent.max);
    if (snipersMin !== null || snipersMax !== null) {
      filters.snipers_holdings_percentage = {};
      if (snipersMin !== null) filters.snipers_holdings_percentage.gte = snipersMin;
      if (snipersMax !== null) filters.snipers_holdings_percentage.lte = snipersMax;
    }

    const insidersMin = parseNumber(section.audits.insidersPercent.min);
    const insidersMax = parseNumber(section.audits.insidersPercent.max);
    if (insidersMin !== null || insidersMax !== null) {
      filters.insiders_holdings_percentage = {};
      if (insidersMin !== null) filters.insiders_holdings_percentage.gte = insidersMin;
      if (insidersMax !== null) filters.insiders_holdings_percentage.lte = insidersMax;
    }

    const bundleMin = parseNumber(section.audits.bundlePercent.min);
    const bundleMax = parseNumber(section.audits.bundlePercent.max);
    if (bundleMin !== null || bundleMax !== null) {
      filters.bundlers_holdings_percentage = {};
      if (bundleMin !== null) filters.bundlers_holdings_percentage.gte = bundleMin;
      if (bundleMax !== null) filters.bundlers_holdings_percentage.lte = bundleMax;
    }

    const devMigrationMin = parseNumber(section.audits.devMigration.min);
    const devMigrationMax = parseNumber(section.audits.devMigration.max);
    if (devMigrationMin !== null || devMigrationMax !== null) {
      filters.deployer_migrations_count = {};
      if (devMigrationMin !== null) filters.deployer_migrations_count.gte = devMigrationMin;
      if (devMigrationMax !== null) filters.deployer_migrations_count.lte = devMigrationMax;
    }

    // Boolean filters - only add if explicitly true
    if (section.audits.dexPaid === true) {
      filters.dexscreener_ad_paid = { equals: true };
    }

    if (section.audits.caEndsInPump === true) {
      filters.ca_ends_in_pump = { gte: 1 };
    }

    // Socials filters
    const twitterReusesMin = parseNumber(section.socials.twitterReuses.min);
    const twitterReusesMax = parseNumber(section.socials.twitterReuses.max);
    if (twitterReusesMin !== null || twitterReusesMax !== null) {
      filters.twitter_reuses_count = {};
      if (twitterReusesMin !== null) filters.twitter_reuses_count.gte = twitterReusesMin;
      if (twitterReusesMax !== null) filters.twitter_reuses_count.lte = twitterReusesMax;
    }

    // Boolean social filters
    // Check if individual social fields are present (not null) - only if explicitly true
    if (section.socials.twitter === true) {
      filters.twitter = { not: null };
    }

    if (section.socials.website === true) {
      filters.website = { not: null };
    }

    if (section.socials.telegram === true) {
      filters.telegram = { not: null };
    }

    // Use min_socials for "at least one social" (1 = at least one of twitter/telegram/website)
    if (section.socials.atLeastOneSocial === true) {
      filters.min_socials = 1;
    }

    // Filter for tokens that are currently live on PumpLive
    if (section.socials.onlyPumpLive === true) {
      filters.live_status = { equals: 'pump_live' };
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  }, []);

  /**
   * Build subscription payload from filter state
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

    const buildView = (section: typeof newS, name: string, model: 'new' | 'bonding' | 'bonded') => {
      const metricFilters = buildFilters(section);
      const protocolFilter = section.protocols.length > 0 ? { preBondingFactory: { in: section.protocols } } : {};
      
      const filters = { ...metricFilters, ...protocolFilter };
      
      return {
        name,
        chainId: section.chainIds,
        limit: 50,
        model,
        ...(Object.keys(filters).length > 0 && { filters }),
      };
    };

    const views = [
      buildView(bondingS, 'bonding', 'bonding'),
      buildView(bondedS, 'bonded', 'bonded'),
      buildView(newS, 'new', 'new'),
    ];

    return {
      assetMode: true,
      compressed,
      views,
    };
  }, [isHydrated, appliedSections, compressed, filtersVersion, buildFilters]);

  const payloadStr = useMemo(() => {
    return payload ? JSON.stringify(payload) : '';
  }, [payload]);

  /**
   * Get or initialize Mobula client
   */
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = getMobulaClient();

      if (!clientRef.current) {
        console.error('[usePulseV2] Failed to get client');
        setError('Failed to initialize Mobula client');
        return null;
      }

      if (!clientRef.current.streams) {
        console.error('[usePulseV2] Client does not have streams');
        setError('Client does not support streams');
        return null;
      }
    }

    return clientRef.current;
  }, [setError]);

  /**
   * Process REST response data (same format as WebSocket init)
   */
  const processRestResponse = useCallback(
    (restData: PulseResponse) => {
      if (!restData || typeof restData !== 'object' || Buffer.isBuffer(restData)) {
        return;
      }

      // Process all views in parallel for better performance
      const processView = (view: 'new' | 'bonding' | 'bonded', viewData: unknown) => {
        if (viewData && typeof viewData === 'object' && 'data' in viewData) {
          const viewDataTyped = viewData as PulseViewData;
          const tokens = Array.isArray(viewDataTyped.data)
            ? viewDataTyped.data
            : [viewDataTyped.data];
          pulseDataStore.setTokens(view, tokens);
          return viewDataTyped;
        }
        return undefined;
      };

      const newView = processView('new', restData.new);
      const bondingView = processView('bonding', restData.bonding);
      const bondedView = processView('bonded', restData.bonded);

      // Create a synthetic init message for compatibility
      const syntheticInit: WssPulseV2ResponseType = {
        type: 'init',
        payload: {
          new: newView,
          bonding: bondingView,
          bonded: bondedView,
        },
      };
      setData(syntheticInit);
    },
    [pulseDataStore, setData]
  );

  /**
   * Load initial data via REST API for faster page load
   * Sets loading state only during REST call
   */
  const loadInitialData = useCallback(async () => {
    if (restLoadInProgressRef.current || !payload) {
      return;
    }

    restLoadInProgressRef.current = true;
    setLoading(true);

    try {
      const client = getClient();
      if (!client) {
        return;
      }

      // Use filter state params from payload, fallback to defaults
      const restPayload = payload
        ? {
            assetMode: payload.assetMode ?? true,
            compressed: payload.compressed ?? false,
            views: payload.views,
          }
        : {
            model: 'default' as const,
            assetMode: true,
            compressed: false,
            chainId: ['solana:solana'],
          };

      const restResponse = await client.fetchPulseV2(restPayload);
      processRestResponse(restResponse);
      initialDataLoadedRef.current = true;
    } catch (e) {
      console.error('[usePulseV2] Failed to load initial data via REST:', e);
      // Don't block WebSocket on REST failure - WebSocket will provide the data
      // Mark as attempted so we don't keep retrying REST, but allow WebSocket to proceed
      initialDataLoadedRef.current = false;
      // Don't set error here, let WebSocket handle it
    } finally {
      restLoadInProgressRef.current = false;
      setLoading(false);
    }
  }, [getClient, payload, processRestResponse, setLoading]);

  /**
   * Unsubscribe from old subscription
   */
  const unsubscribeFromOld = useCallback(() => {
    if (subscriptionIdRef.current && clientRef.current?.streams) {
      try {
        clientRef.current.streams.unsubscribe('pulse-v2', subscriptionIdRef.current);
      } catch (e) {
        console.warn('[usePulseV2] Unsubscribe error:', e);
      }
    }
    subscriptionIdRef.current = null;
  }, []);

  /**
   * Handle incoming WebSocket messages
   * 
   * Features:
   * - Skip updates when subscription is paused
   * - Route updates to appropriate data store views
   * - Deduplicate token updates
   * - Batch updates using rAF for 60fps performance
   * - Log token activity
   */
  const handleMessage = useCallback(
    (msg: WssPulseV2ResponseType) => {
      // Skip processing if paused
      if (isSubscriptionPausedInternal) {
        return;
      }

      if (!msg) return;

      // Track message count
      messageCountRef.current++;

      // Log token-specific updates
      if (msg.type === 'update-token') {
        const getViewName = msg.payload.viewName as ViewName;
        const token = msg.payload.token;
        if (PULSE_DEBUG) {
          const tokenRecord = token as Record<string, unknown>;
          const getTokenName = (tokenRecord?.name as string) || 'Unknown';
          const getTokenAddress = (tokenRecord?.address as string) || 'Unknown';
          const getCreatedAt = (tokenRecord?.createdAt as string) || new Date().toISOString();

          const ageInSeconds = Math.floor(
            (Date.now() - new Date(getCreatedAt).getTime()) / 1000
          );

        }

        // Queue update instead of immediate processing (batched via rAF)
        if (getViewName && token) {
          tokenUpdateBatcherRef.current.add({ view: getViewName, token });
        }
      }

      if (msg.type === 'init') {
        // Queue init message (batched via rAF)
        initBatcherRef.current.add(msg);
      }

      // Store raw data for compatibility with existing code (still immediate for compatibility)
      setData(msg);
    },
    [setData, isSubscriptionPausedInternal, pulseDataStore]
  );

  /**
   * Subscribe to WebSocket stream
   * Prevent concurrent subscription attempts
   * Connects in background after REST data is loaded
   */
  const subscribeToStream = useCallback(async () => {
    if (subscriptionInProgressRef.current) {
      return;
    }

    subscriptionInProgressRef.current = true;

    try {
      const client = getClient();
      if (!client || !payload) {
        return;
      }

      subscriptionIdRef.current = client.streams.subscribe('pulse-v2', payload, (data: unknown) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof (data as { error: string }).error === 'string'
        ) {
          const errorMessage =
            (data as { error?: string; message?: string }).error ||
            (data as { message?: string }).message ||
            'WSS error';

          if (errorMessage.includes('No subscription found')) {
            console.warn('[usePulseV2] Transient error - will retry on next trigger');
            return;
          }

          setError(errorMessage);
          return;
        }

        handleMessage(data as WssPulseV2ResponseType);
      });
      prevPayloadStrRef.current = payloadStr;

    } catch (e) {
      console.error('[usePulseV2] Subscribe error:', e);
      setError(e instanceof Error ? e.message : 'Subscribe failed');
    } finally {
      subscriptionInProgressRef.current = false;
    }
  }, [getClient, payload, payloadStr, handleMessage, setError]);

  /**
   * Load initial data via REST API ONCE on first page load
   * After that, only WebSocket is used for all updates
   */
  useEffect(() => {
    if (!enabled || !blockchain || !isHydrated || !payload) {
      return;
    }

    // Only load REST data once on initial load, never again
    if (!initialDataLoadedRef.current && !restLoadInProgressRef.current) {
      loadInitialData();
    }
  }, [enabled, blockchain, isHydrated, payload, loadInitialData]);

  /**
   * Main subscription effect
   * Handles payload changes and re-subscription
   * Connects WebSocket regardless of REST API status (REST is optional for faster initial load)
   */
  useEffect(() => {
    if (!enabled || !blockchain || !isHydrated || !payload) {
      return;
    }

    const payloadChanged = payloadStr !== prevPayloadStrRef.current;

    // Skip if nothing changed and already subscribed
    if (!payloadChanged && subscriptionIdRef.current) {
      return;
    }

    // Don't wait for REST - WebSocket should proceed independently
    // REST is just for faster initial load, but WebSocket is the primary data source

    setError(null);

    isUnsubscribingRef.current = true;
    unsubscribeFromOld();

    // Reset message tracking on resubscribe
    lastProcessedMessageRef.current = '';
    messageCountRef.current = 0;

    // Wait for cleanup, then subscribe to WebSocket
    const timer = setTimeout(() => {
      isUnsubscribingRef.current = false;
      subscribeToStream();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [
    enabled,
    blockchain,
    isHydrated,
    payloadStr,
    payload,
    unsubscribeFromOld,
    subscribeToStream,
    setError,
  ]);

  /**
   * Apply filters with UI pause/resume cycle
   * Prevents flickering during subscription update
   */
  const applyFilters = useCallback(() => {
    setIsPaused(true);
    setIsReconnecting(true);

    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);

    pauseTimeoutRef.current = setTimeout(() => {
      setIsReconnecting(false);
      setIsPaused(false);
    }, PAUSE_TIMEOUT);
  }, []);

  const resetFilters = useCallback(() => {
    applyFilters();
  }, [applyFilters]);

  /**
   * Pause subscription (user action)
   * Stops processing new messages
   */
  const pauseSubscription = useCallback(() => {
    setIsSubscriptionPausedInternal(true);
  }, []);

  /**
   * Resume subscription (user action)
   * Resumes processing new messages
   */
  const resumeSubscription = useCallback(() => {
    setIsSubscriptionPausedInternal(false);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);

      // Clear batchers
      tokenUpdateBatcherRef.current.clear();
      initBatcherRef.current.clear();

      if (
        subscriptionIdRef.current &&
        clientRef.current?.streams &&
        !isUnsubscribingRef.current
      ) {
        try {
          unsubscribeFromOld();
        } catch (e) {
          console.warn('[usePulseV2] Cleanup error:', e);
        }
      }
    };
  }, [unsubscribeFromOld]);

  return {
    data,
    loading,
    error,
    isConnected: !!subscriptionIdRef.current,
    isHydrated,
    hasInitialData: initialDataLoadedRef.current,
    isPaused,
    isReconnecting,
    isStreaming: !isPaused && !isReconnecting && !!subscriptionIdRef.current,
    pauseSubscription,
    resumeSubscription,
    applyFilters,
    resetFilters,
    debugInfo: {
      subscriptionId: subscriptionIdRef.current,
      payloadStr,
      lastMessage: lastProcessedMessageRef.current.substring(0, 100),
      messageCount: messageCountRef.current,
      isPausedInternal: isSubscriptionPausedInternal,
    },
  };
}

export default usePulseV2;