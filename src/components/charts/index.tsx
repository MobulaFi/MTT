'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useChartTools } from '@/hooks/useChart';
import { cn } from '@/lib/utils';
import type {
  ChartingLibraryWidgetConstructor,
  ChartingLibraryWidgetOptions,
  IChartingLibraryWidget,
  IOrderLineAdapter,
  ResolutionString,
  Timezone,
} from '../../../public/static/charting_library/charting_library';
import { useChartStore } from '@/store/useChartStore';
import { useThemeStore } from '@/store/useThemeStore';
import { widgetOptionsDefault } from '@/utils/tradingview/helper';
import { DISABLED_FEATURES, ENABLED_FEATURES } from './constants';
import {
  Datafeed,
  type ChartDebugContext,
  type ChartDebugReason,
  type ChartMetricMode,
  type FirstDataPayload,
  getResolutionMs,
  normalizeResolution,
} from './datafeed';
import { prefetchOhlcvData } from '@/lib/prefetch';
import { usePriceDisplayStore } from '@/store/useDisplayPriceStore';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { usePositionForToken } from '@/store/useUserPortfolioStore';

// Lazy-loaded TradingView library — NOT imported at module scope to avoid
// blocking the main thread on pages that don't need the chart (e.g. /trendings).
// The download starts on first call to getTvLibrary() (warmup or chart mount).
let tvLibraryPromise: Promise<typeof import('../../../public/static/charting_library/')> | null = null;

function getTvLibrary() {
  if (!tvLibraryPromise && typeof window !== 'undefined') {
    tvLibraryPromise = import('../../../public/static/charting_library/');
  }
  return tvLibraryPromise;
}

// ── Persistent widget cache ──
// The TradingView widget survives across SPA navigations. On unmount the host
// div is "parked" off-screen; on the next mount it is moved back into the
// chart container and updated via setSymbol() — giving 0ms init on repeat visits.
interface PersistentWidgetState {
  hostDiv: HTMLDivElement;
  widget: IChartingLibraryWidget;
  datafeed: ReturnType<typeof Datafeed>;
}

let persistentWidget: PersistentWidgetState | null = null;

let parkingDiv: HTMLDivElement | null = null;
let chartListenerCleanup: (() => void) | null = null;
let overlayCleanup: (() => void) | null = null;

function ensureParkingDiv(): HTMLDivElement {
  if (!parkingDiv) {
    parkingDiv = document.createElement('div');
    parkingDiv.id = 'tv-chart-parking';
    // Static (non-positioned) container. Children use position:absolute (document-
    // relative, scrolls with page) when active or position:fixed when hidden/warmup.
    parkingDiv.style.cssText = 'width:0;height:0;overflow:visible;pointer-events:none;';
    document.body.appendChild(parkingDiv);
  }
  return parkingDiv;
}

/**
 * Position hostDiv exactly over containerEl using position:absolute.
 * Absolute positioning uses document-relative coordinates so the chart
 * scrolls with the page naturally (including overscroll bounce).
 * The hostDiv is NEVER reparented — this avoids browser iframe reload.
 */
function syncWidgetOverlay(hostDiv: HTMLDivElement, containerEl: HTMLElement) {
  if (overlayCleanup) { overlayCleanup(); overlayCleanup = null; }

  const sync = () => {
    const rect = containerEl.getBoundingClientRect();
    hostDiv.style.position = 'absolute';
    hostDiv.style.top = `${rect.top + window.scrollY}px`;
    hostDiv.style.left = `${rect.left + window.scrollX}px`;
    hostDiv.style.width = `${rect.width}px`;
    hostDiv.style.height = `${rect.height}px`;
    // NOTE: opacity is NOT set here — it's managed by the caller
    // (hidden during symbol change, shown by revealWidget).
    hostDiv.style.pointerEvents = 'auto';
    hostDiv.style.zIndex = '0';
  };
  sync();

  const ro = new ResizeObserver(sync);
  ro.observe(containerEl);
  window.addEventListener('resize', sync);
  // Capture-phase scroll: re-sync when scrollable ancestors shift layout.
  document.addEventListener('scroll', sync, true);

  overlayCleanup = () => {
    ro.disconnect();
    window.removeEventListener('resize', sync);
    document.removeEventListener('scroll', sync, true);
  };
}

/** Hide the widget overlay for warmup or parking (still renders for TV init) */
function hideWidgetOverlay(hostDiv: HTMLDivElement) {
  if (overlayCleanup) { overlayCleanup(); overlayCleanup = null; }
  hostDiv.style.position = 'fixed';
  hostDiv.style.left = '0';
  hostDiv.style.top = '0';
  hostDiv.style.width = '100vw';
  hostDiv.style.height = '100vh';
  hostDiv.style.opacity = '0';
  hostDiv.style.pointerEvents = 'none';
  hostDiv.style.zIndex = '-1';
}

// ── Warmup: pre-create TradingView widget so tools are instant ──
// Called from AppShell at app startup. Creates the widget in a parking div
// with a NullDatafeed (no API calls). When TradingViewChart mounts, the
// REUSE PATH moves the pre-initialized widget into the component.
let warmupStarted = false;
let warmupSuperseded = false; // Set to true when CREATE PATH runs — blocks warmup from setting persistentWidget
let warmupWidgetRef: { hostDiv: HTMLDivElement; widget: IChartingLibraryWidget; datafeed: ReturnType<typeof Datafeed> } | null = null;
let activeChartMountCount = 0;
const DEFAULT_BAR_SPACING = 12;
const DEFAULT_RIGHT_OFFSET = 2;
const CHART_DEBUG_PREFIX = '[Chart Debug]';
let chartDebugIdSequence = 0;

type ChartDebugLevel = 'debug' | 'info' | 'warn' | 'error';

const nextChartDebugId = (prefix: string) => {
  chartDebugIdSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${chartDebugIdSequence.toString(36)}`;
};

const stringifyChartDebug = (payload: Record<string, unknown>) => {
  try {
    return JSON.stringify(payload);
  } catch (error) {
    return JSON.stringify({
      event: payload.event ?? 'stringify_failed',
      scope: payload.scope ?? 'widget',
      error: error instanceof Error ? error.message : 'Unknown stringify error',
    });
  }
};

const writeChartDebug = (level: ChartDebugLevel, payload: Record<string, unknown>) => {
  if (level !== 'warn' && level !== 'error') return;
  const message = `${CHART_DEBUG_PREFIX} ${payload.event ?? 'unknown'}`;
  const serialized = stringifyChartDebug(payload);
  if (level === 'warn') console.warn(message, serialized);
  else console.error(message, serialized);
};

function getChartSymbolBase(baseAsset: TradingViewChartProps['baseAsset'], isPair: boolean): string {
  const fallbackSymbol = baseAsset.address?.slice(0, 8) || 'UNKNOWN';
  const primarySymbol = (isPair ? baseAsset.base?.symbol : baseAsset.symbol) || baseAsset.symbol || fallbackSymbol;
  return `${primarySymbol}/USD`;
}

export function warmupTradingView() {
  if (warmupStarted || persistentWidget || activeChartMountCount > 0 || typeof window === 'undefined') return;
  warmupStarted = true;

  getTvLibrary()?.then(({ widget: Widget }) => {
    if (persistentWidget) return;

    const hostDiv = document.createElement('div');
    // Hidden but rendering at full viewport — TradingView needs to paint during warmup.
    // This div will NEVER be reparented. It stays in parkingDiv forever.
    hostDiv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;opacity:0;pointer-events:none;z-index:-1;';
    ensureParkingDiv().appendChild(hostDiv);

    const datafeed = Datafeed(
      { asset: '__warmup__', chainId: '1', isPair: false, symbol: 'WARMUP' },
      { warmup: true, isUsd: true, metricMode: 'price' },
    );

    const overrides = getDefaultDarkOverrides();
    const tvWidget = new (Widget as ChartingLibraryWidgetConstructor)({
      datafeed,
      symbol: 'WARMUP/USD_PRICE',
      container: hostDiv,
      locale: 'en',
      fullscreen: false,
      autosize: true,
      theme: 'Dark',
      toolbar_bg: '#0A0A0A',
      custom_css_url: '../chart.css',
      disabled_features: DISABLED_FEATURES,
      enabled_features: [...ENABLED_FEATURES],
      loading_screen: { backgroundColor: '#0A0A0A', foregroundColor: '#0A0A0A' },
      settings_overrides: {
        ...overrides,
        'mainSeriesProperties.candleStyle.drawWick': true,
        'mainSeriesProperties.candleStyle.drawBorder': true,
        'scalesProperties.fontSize': 11,
        'scalesProperties.showSeriesLastValue': true,
        'priceScaleProperties.showSeriesLastValue': true,
        'timeScale.rightOffset': DEFAULT_RIGHT_OFFSET,
        'timeScale.barSpacing': DEFAULT_BAR_SPACING,
        'timeScale.visible': true,
        volumePaneSize: 'small',
      },
      overrides: {
        ...overrides,
        'mainSeriesProperties.candleStyle.drawWick': true,
        'mainSeriesProperties.candleStyle.drawBorder': true,
        'scalesProperties.fontSize': 11,
        'scalesProperties.showSeriesLastValue': true,
        'priceScaleProperties.showSeriesLastValue': true,
        'timeScale.rightOffset': DEFAULT_RIGHT_OFFSET,
        'timeScale.barSpacing': DEFAULT_BAR_SPACING,
        'timeScale.visible': true,
        volumePaneSize: 'small',
      },
      studies_overrides: {
        'volume.volume.color.0': '#0ECB81',
        'volume.volume.color.1': '#EA3943',
        'volume.volume.transparency': 50,
      },
      time_frames: [
        { text: '5y', resolution: '1W' as ResolutionString, description: '5 Years' },
        { text: '1y', resolution: '1W' as ResolutionString, description: '1 Year' },
        { text: '6m', resolution: '1W' as ResolutionString, description: '6 Months' },
        { text: '3m', resolution: '60' as ResolutionString, description: '3 Months' },
        { text: '1m', resolution: '60' as ResolutionString, description: '1 Month' },
        { text: '5d', resolution: '5' as ResolutionString, description: '5 Days' },
        { text: '1d', resolution: '1' as ResolutionString, description: '1 Day' },
      ],
      ...widgetOptionsDefault,
    });

    // Track the warmup widget so ADOPT/CREATE PATH can reference it before onChartReady.
    warmupWidgetRef = { hostDiv, widget: tvWidget, datafeed };

    tvWidget.onChartReady(() => {
      warmupWidgetRef = null;
      if (!persistentWidget && !warmupSuperseded) {
        // Iframe fully loaded, toolbar rendered, tools available.
        // Next navigation will use REUSE PATH with instant tools.
        persistentWidget = { hostDiv, widget: tvWidget, datafeed };
      }
      // If superseded: ADOPT PATH is using this widget (will register its own
      // onChartReady callback). If CREATE PATH destroyed it, this callback
      // won't fire at all. Either way, don't destroy here.
    });
  }).catch((err) => {
    console.error('[Chart] Warmup failed:', err);
    warmupStarted = false;
  });
}

// ── Default dark theme overrides (used for warmup + component) ──
function getDefaultDarkOverrides() {
  return {
    'paneProperties.background': '#0A0A0A', 'paneProperties.backgroundType': 'solid',
    'paneProperties.vertGridProperties.color': '#141414', 'paneProperties.horzGridProperties.color': '#141414',
    'paneProperties.crossHairProperties.color': '#1A1A1A',
    'paneProperties.legendProperties.showLegend': true, 'paneProperties.legendProperties.showSeriesTitle': true,
    'paneProperties.legendProperties.showSeriesOHLC': true, 'paneProperties.legendProperties.showStudyTitles': true,
    'paneProperties.legendProperties.showStudyValues': true, 'paneProperties.legendProperties.showBarChange': true,
    'symbolWatermarkProperties.visibility': true,
    'scalesProperties.backgroundColor': '#0A0A0A', 'scalesProperties.lineColor': '#1A1A1A', 'scalesProperties.textColor': '#606060',
    'timeScale.borderColor': '#1A1A1A',
    'mainSeriesProperties.candleStyle.upColor': '#0ECB81', 'mainSeriesProperties.candleStyle.downColor': '#EA3943',
    'mainSeriesProperties.candleStyle.borderUpColor': '#0ECB81', 'mainSeriesProperties.candleStyle.borderDownColor': '#EA3943',
    'mainSeriesProperties.candleStyle.wickUpColor': '#0ECB81', 'mainSeriesProperties.candleStyle.wickDownColor': '#EA3943',
    'mainSeriesProperties.candleStyle.drawWick': true, 'mainSeriesProperties.candleStyle.drawBorder': true,
    'scalesProperties.fontSize': 11, 'scalesProperties.showSeriesLastValue': true,
    'priceScaleProperties.showSeriesLastValue': true,
    'timeScale.rightOffset': DEFAULT_RIGHT_OFFSET, 'timeScale.barSpacing': DEFAULT_BAR_SPACING, 'timeScale.visible': true,
    volumePaneSize: 'small',
  } as Record<string, unknown>;
}


interface TradingViewChartProps {
  baseAsset: {
    address: string;
    blockchain: string;
    symbol?: string;
    priceUSD?: number;
    base?: { symbol?: string };
    quote?: { symbol?: string; priceUSD?: number; logo?: string };
    circulatingSupply?: number;
  };
  mobile?: boolean;
  custom_css_url?: string;
  className?: string;
  isPair?: boolean;
  isUsd?: boolean;
  initialResolution?: string;
  theme?: 'light' | 'dark';
  backgroundColor?: string;
  candleUpColor?: string;
  candleDownColor?: string;
  deployer?: string;
  userAddress?: string;
  showSymbol?: boolean;
  showGridLines?: boolean;
}

declare global {
  interface Window {
    tvWidget?: IChartingLibraryWidget | null;
  }
}

const TradingViewChart = ({
  baseAsset,
  mobile = false,
  custom_css_url = '../chart.css',
  className,
  isPair = false,
  isUsd = true,
  initialResolution,
  theme,
  backgroundColor,
  candleUpColor,
  candleDownColor,
  deployer,
  userAddress,
  showSymbol = true,
  showGridLines = true,
}: TradingViewChartProps) => {
  const { address: walletAddress } = useWalletConnection();
  const effectiveUserAddress = userAddress ?? walletAddress ?? undefined;
  const position = usePositionForToken(baseAsset.address);

  const ref = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<IChartingLibraryWidget | null>(null);
  const datafeedRef = useRef<ReturnType<typeof Datafeed> | null>(null);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRevealRef = useRef<(() => void) | null>(null);
  const pendingRevealFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitialLoadRef = useRef(false);
  const themeEffectRanRef = useRef(false);
  const avgBuyLineRef = useRef<IOrderLineAdapter | null>(null);
  const avgSellLineRef = useRef<IOrderLineAdapter | null>(null);
  const currentSymbolRef = useRef<string>('');
  const targetSymbolRef = useRef<string | null>(null);
  const targetResolutionRef = useRef<string | null>(null);
  const currentModeRef = useRef<{ isPair: boolean; address: string }>({
    isPair,
    address: baseAsset.address,
  });
  const chartSessionIdRef = useRef(nextChartDebugId('chart'));
  const initAttemptIdRef = useRef<string | null>(null);
  const initStartedAtRef = useRef<number | null>(null);
  const symbolRequestIdRef = useRef<string | null>(null);
  const symbolRequestedAtRef = useRef<number | null>(null);
  const previousAssetKeyRef = useRef<string | null>(null);
  const previousResolutionRef = useRef<string | null>(null);
  const activeReasonRef = useRef<ChartDebugReason>('initial_load');
  const debugDedupeRef = useRef(new Map<string, number>());
  const metricModeRef = useRef<ChartMetricMode>('price');
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('price');
  const previousCurrencyRef = useRef<'USD' | 'QUOTE'>('USD');
  const mcapButtonRef = useRef<HTMLElement | null>(null);
  const priceButtonRef = useRef<HTMLElement | null>(null);
  const programmaticResolutionRef = useRef<ResolutionString | null>(null);
  // Use prop if provided, otherwise fall back to persisted user preference from store
  const persistedTimeframe = useChartStore((s) => s.timeframe);
  const initialResolutionRef = useRef<string | undefined>(initialResolution || persistedTimeframe);
  // Determine theme from backgroundColor if theme not provided
  const resolvedTheme = theme || (backgroundColor && (backgroundColor.toLowerCase() === '#ffffff' || backgroundColor.toLowerCase() === '#fff' || 
    (backgroundColor.startsWith('#') && parseInt(backgroundColor.slice(1), 16) > 0xCCCCCC)) ? 'light' : 'dark');
  const themeRef = useRef<'light' | 'dark'>(resolvedTheme);
  const candleUpColorRef = useRef<string | undefined>(candleUpColor);
  const candleDownColorRef = useRef<string | undefined>(candleDownColor);
  const showSymbolRef = useRef<boolean>(showSymbol);
  const showGridLinesRef = useRef<boolean>(showGridLines);
  const { loadSavedTools, saveChartTools } = useChartTools();
  const setIsChartReady = useChartStore((s) => s.setIsChartReady);
  const themeBgColor = useThemeStore((s) => s.colors.bgPrimary);
  const setTimeframe = useChartStore((s) => s.setTimeframe);
  const storeChartLoaded = useChartStore((s) => s.chartLoaded);
  const displayCurrency = usePriceDisplayStore((s) => s.displayCurrency);
  const setDisplayCurrency = usePriceDisplayStore((s) => s.setDisplayCurrency);
  const quoteCurrencySymbolStore = usePriceDisplayStore((s) => s.quoteCurrencySymbol);
  const setQuoteInfoStore = usePriceDisplayStore((s) => s.setQuoteInfo);
  const effectiveDisplayCurrency = useMemo<'USD' | 'QUOTE'>(() => {
    if (!isPair) return 'USD';
    if (metricMode === 'marketcap') return 'USD';
    return displayCurrency;
  }, [displayCurrency, isPair, metricMode]);
  const buildAssetKey = useCallback(() => (
    `${baseAsset.blockchain}:${baseAsset.address}:${isPair ? 'pair' : 'asset'}`
  ), [baseAsset.address, baseAsset.blockchain, isPair]);
  const getElapsedMs = useCallback((startedAt: number | null) => (
    startedAt ? Date.now() - startedAt : null
  ), []);
  const getDebugContext = useCallback((): ChartDebugContext => ({
    chartSessionId: chartSessionIdRef.current,
    initAttemptId: initAttemptIdRef.current ?? undefined,
    symbolRequestId: symbolRequestIdRef.current ?? undefined,
    assetKey: buildAssetKey(),
    previousAssetKey: previousAssetKeyRef.current,
    previousResolution: previousResolutionRef.current,
    reason: activeReasonRef.current,
  }), [buildAssetKey]);
  const logChartEvent = useCallback((
    level: ChartDebugLevel,
    event: string,
    payload: Record<string, unknown> = {},
    options?: { dedupeKey?: string; dedupeMs?: number },
  ) => {
    const now = Date.now();
    if (options?.dedupeKey) {
      const lastAt = debugDedupeRef.current.get(options.dedupeKey) ?? 0;
      if (now - lastAt < (options.dedupeMs ?? 0)) return;
      debugDedupeRef.current.set(options.dedupeKey, now);
    }

    writeChartDebug(level, {
      scope: 'widget',
      ts: now,
      ...getDebugContext(),
      assetAddress: baseAsset.address,
      chainId: baseAsset.blockchain,
      isPair,
      metricMode: metricModeRef.current,
      displayCurrency: effectiveDisplayCurrency,
      currentSymbol: currentSymbolRef.current || null,
      didInitialLoad: didInitialLoadRef.current,
      isInitializing: isInitializingRef.current,
      isMounted: isMountedRef.current,
      event,
      ...payload,
    });
  }, [baseAsset.address, baseAsset.blockchain, effectiveDisplayCurrency, getDebugContext, isPair]);
  const beginSymbolRequest = useCallback((reason: ChartDebugReason, targetSymbol: string) => {
    activeReasonRef.current = reason;
    targetSymbolRef.current = targetSymbol;
    targetResolutionRef.current = normalizeResolution(initialResolutionRef.current || '1S');
    symbolRequestIdRef.current = nextChartDebugId('symbol');
    symbolRequestedAtRef.current = Date.now();
    logChartEvent('info', 'set_symbol_requested', {
      targetSymbol,
      targetResolution: targetResolutionRef.current,
      previousSymbol: currentSymbolRef.current || null,
      symbolRequestId: symbolRequestIdRef.current,
    });
    return symbolRequestIdRef.current;
  }, [logChartEvent]);
  const logSymbolCallback = useCallback((targetSymbol: string, symbolRequestId?: string | null) => {
    logChartEvent('info', 'set_symbol_callback', {
      targetSymbol,
      symbolRequestId: symbolRequestId ?? symbolRequestIdRef.current,
      callbackDelayMs: getElapsedMs(symbolRequestedAtRef.current),
      currentSymbolRefAfter: currentSymbolRef.current || null,
    });
  }, [getElapsedMs, logChartEvent]);
  const chartLoaded = useCallback((source: string = 'unknown') => {
    logChartEvent('info', 'chart_revealed', {
      source,
      hasOverlay: Boolean(overlayRef.current),
      overlayDisplay: overlayRef.current?.style.display ?? null,
      timeSinceInitMs: getElapsedMs(initStartedAtRef.current),
      timeSinceSetSymbolMs: getElapsedMs(symbolRequestedAtRef.current),
    });
    // Hide overlay immediately via DOM -- no React re-render delay
    if (overlayRef.current) overlayRef.current.style.display = 'none';
    storeChartLoaded();
  }, [getElapsedMs, logChartEvent, storeChartLoaded]);
  const flushPendingReveal = useCallback((source: string) => {
    const reveal = pendingRevealRef.current;
    if (!reveal) return;

    pendingRevealRef.current = null;
    if (pendingRevealFallbackRef.current) {
      clearTimeout(pendingRevealFallbackRef.current);
      pendingRevealFallbackRef.current = null;
    }

    logChartEvent('info', 'pending_reveal_flushed', { source });
    reveal();
  }, [logChartEvent]);
  const setChartSymbolWithResolution = useCallback((
    widget: IChartingLibraryWidget,
    _chart: ReturnType<IChartingLibraryWidget['activeChart']>,
    symbol: string,
    callback: () => void,
    resolution?: ResolutionString,
  ) => {
    const chart = widget.activeChart();
    const nextResolution = resolution ?? chart.resolution();
    programmaticResolutionRef.current = nextResolution;
    targetResolutionRef.current = normalizeResolution(nextResolution);
    widget.setSymbol(symbol, nextResolution, callback);
  }, []);
  const primeViewportForResolution = useCallback((
    chart: ReturnType<IChartingLibraryWidget['activeChart']>,
    resolutionInput?: string,
  ) => {
    try {
      const timeScale = chart.getTimeScale();
      const resolution = normalizeResolution(resolutionInput || chart.resolution());
      const resolutionMs = getResolutionMs(resolution);
      const containerWidth = ref.current?.clientWidth ?? 900;
      const visibleBars = Math.floor(containerWidth / DEFAULT_BAR_SPACING);
      const rangeTo = Date.now() + resolutionMs * DEFAULT_RIGHT_OFFSET;
      const rangeFrom = Math.max(0, rangeTo - (visibleBars - 1) * resolutionMs);

      logChartEvent('info', 'viewport_prime_requested', {
        resolution,
        rangeFrom,
        rangeTo,
        visibleBars,
      });

      timeScale.setBarSpacing(DEFAULT_BAR_SPACING);
      timeScale.setRightOffset(DEFAULT_RIGHT_OFFSET);
      void chart.setVisibleRange({
        from: Math.floor(rangeFrom / 1000),
        to: Math.ceil(rangeTo / 1000),
      });
    } catch (error) {
      logChartEvent('warn', 'viewport_prime_error', {
        resolutionInput: resolutionInput ?? null,
        error: error instanceof Error ? error.message : 'Error priming viewport',
      });
    }
  }, [logChartEvent]);
  const resetViewportFromFirstData = useCallback((
    payload?: FirstDataPayload,
    options?: { afterApply?: () => void },
  ) => {
    const widget = widgetRef.current;
    if (!widget || !payload?.lastBarTime || payload.barsCount <= 0) {
      options?.afterApply?.();
      return;
    }

    try {
      const chart = widget.activeChart();
      const timeScale = chart.getTimeScale();
      const resolution = normalizeResolution(payload?.resolution || chart.resolution());
      const resolutionMs = getResolutionMs(resolution);
      const containerWidth = ref.current?.clientWidth ?? 900;
      const maxVisibleBars = Math.floor(containerWidth / DEFAULT_BAR_SPACING);
      const barsToShow = Math.min(Math.max(payload.barsCount, 1), maxVisibleBars);
      const actualBarSpacingMs = payload.barsCount > 1
        ? (payload.lastBarTime - (payload.firstBarTime ?? payload.lastBarTime)) / (payload.barsCount - 1)
        : resolutionMs;
      const effectiveSpacingMs = Math.max(actualBarSpacingMs, resolutionMs);
      const leftPaddingBars = Math.min(
        12,
        Math.max(2, Math.floor(barsToShow * 0.2)),
      );
      const rangeFrom = Math.max(
        payload.firstBarTime ?? 0,
        payload.lastBarTime - (barsToShow + leftPaddingBars) * effectiveSpacingMs,
        0,
      );
      const rangeTo = payload.lastBarTime + effectiveSpacingMs * DEFAULT_RIGHT_OFFSET;
      const visibleRangeFrom = Math.floor(rangeFrom / 1000);
      const visibleRangeTo = Math.ceil(rangeTo / 1000);
      logChartEvent('info', 'viewport_reset_requested', {
        resolution,
        firstBarTime: payload.firstBarTime,
        lastBarTime: payload.lastBarTime,
        barsCount: payload.barsCount,
        barsToShow,
        maxVisibleBars,
        leftPaddingBars,
        rangeFrom,
        rangeTo,
        visibleRangeFrom,
        visibleRangeTo,
      });
      timeScale.setBarSpacing(DEFAULT_BAR_SPACING);
      timeScale.setRightOffset(DEFAULT_RIGHT_OFFSET);
      setTimeout(() => {
        try {
          const visibleRangePromise = chart.setVisibleRange({
            from: visibleRangeFrom,
            to: visibleRangeTo,
          });
          // Do not block reveal/pagination on TradingView's internal promise.
          // On some first-load paths it resolves too late or not at all.
          options?.afterApply?.();
          void visibleRangePromise.then(() => {
            try {
              timeScale.setBarSpacing(DEFAULT_BAR_SPACING);
              timeScale.setRightOffset(DEFAULT_RIGHT_OFFSET);
            } catch { /* noop */ }
            logChartEvent('info', 'viewport_reset_applied', {
              resolution,
              visibleRangeFrom,
              visibleRangeTo,
              barSpacing: DEFAULT_BAR_SPACING,
              rightOffset: DEFAULT_RIGHT_OFFSET,
            });
          }).catch((error) => {
            logChartEvent('error', 'viewport_reset_error', {
              stage: 'apply_async',
              error: error instanceof Error ? error.message : 'Error awaiting visible range',
            });
          });
        } catch (error) {
          logChartEvent('error', 'viewport_reset_error', {
            stage: 'apply',
            error: error instanceof Error ? error.message : 'Error applying visible range',
          });
          options?.afterApply?.();
        }
      }, 0);
    } catch (error) {
      logChartEvent('error', 'viewport_reset_error', {
        stage: 'prepare',
        error: error instanceof Error ? error.message : 'Error resetting visible range',
      });
      options?.afterApply?.();
    }
  }, [logChartEvent]);
  const handleFirstDataReady = useCallback((payload?: FirstDataPayload, options?: { reveal?: () => void; unlock?: () => void }) => {
    const payloadResolution = payload?.resolution ? normalizeResolution(payload.resolution) : null;
    logChartEvent('info', 'first_data_received', {
      hasPayload: Boolean(payload),
      hasReveal: Boolean(options?.reveal),
      hasUnlock: Boolean(options?.unlock),
      barsCount: payload?.barsCount ?? null,
      firstBarTime: payload?.firstBarTime ?? null,
      lastBarTime: payload?.lastBarTime ?? null,
      resolution: payloadResolution,
      targetResolution: targetResolutionRef.current,
      timeSinceSetSymbolMs: getElapsedMs(symbolRequestedAtRef.current),
    });
    if (payloadResolution && targetResolutionRef.current && payloadResolution !== targetResolutionRef.current) {
      logChartEvent('warn', 'first_data_ignored_resolution_mismatch', {
        payloadResolution,
        targetResolution: targetResolutionRef.current,
      });
      options?.unlock?.();
      return;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    didInitialLoadRef.current = true;
    pendingRevealRef.current = options?.reveal ?? (() => chartLoaded('first_data'));
    if (pendingRevealFallbackRef.current) {
      clearTimeout(pendingRevealFallbackRef.current);
    }
    resetViewportFromFirstData(payload, {
      afterApply: () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            flushPendingReveal('first_data_ready');
          });
        });
        setTimeout(() => {
          options?.unlock?.();
        }, 500);
      },
    });
    logChartEvent('info', 'first_data_reveal_requested', {
      timeSinceSetSymbolMs: getElapsedMs(symbolRequestedAtRef.current),
      hasCustomReveal: Boolean(options?.reveal),
    });
    try {
      const chart = widgetRef.current?.activeChart();
      const alreadyReady = chart?.dataReady(() => {
        logChartEvent('info', 'chart_data_ready');
        flushPendingReveal('chart_data_ready');
      }) ?? false;
      logChartEvent('info', 'chart_data_ready_registered', {
        alreadyReady,
      });
      if (alreadyReady) {
        setTimeout(() => {
          flushPendingReveal('chart_data_ready_sync');
        }, 0);
      }
    } catch (error) {
      logChartEvent('warn', 'chart_data_ready_register_error', {
        error: error instanceof Error ? error.message : 'Error registering chart dataReady callback',
      });
    }
    pendingRevealFallbackRef.current = setTimeout(() => {
      flushPendingReveal('fallback_timeout');
    }, 800);
  }, [chartLoaded, flushPendingReveal, getElapsedMs, logChartEvent, resetViewportFromFirstData]);
  const derivedQuoteSymbol = quoteCurrencySymbolStore || baseAsset.quote?.symbol || baseAsset.symbol || 'QUOTE';
  const canToggleCurrency = isPair && Boolean(derivedQuoteSymbol);
  const shouldShowCurrencyToggle = false; // MOB-1687: hide broken USD/SOL toggle for now
  const isCurrencyToggleDisabled = metricMode === 'marketcap';

  const handleCurrencySelect = useCallback(
    (target: 'USD' | 'QUOTE') => {
      if (isCurrencyToggleDisabled || effectiveDisplayCurrency === target) return;
      setDisplayCurrency(target);
    },
    [effectiveDisplayCurrency, isCurrencyToggleDisabled, setDisplayCurrency],
  );

  const updateHeaderButtonStyles = useCallback((mode: ChartMetricMode) => {
    const currentTheme = themeRef.current ?? 'dark';
    const activeColor = '#0ECB81';
    const inactiveColor = currentTheme === 'light' ? '#6B7280' : '#9CA3AF';
    
    if (mcapButtonRef.current) {
      mcapButtonRef.current.style.color = mode === 'marketcap' ? activeColor : inactiveColor;
      mcapButtonRef.current.style.fontWeight = mode === 'marketcap' ? '600' : '400';
    }
    if (priceButtonRef.current) {
      priceButtonRef.current.style.color = mode === 'price' ? activeColor : inactiveColor;
      priceButtonRef.current.style.fontWeight = mode === 'price' ? '600' : '400';
    }
  }, []);

  const handleMetricModeChange = useCallback(
    (mode: ChartMetricMode) => {
      if (metricModeRef.current === mode) return;
      metricModeRef.current = mode;
      setMetricMode(mode);
      updateHeaderButtonStyles(mode);

      if (!isPair) return;

      if (mode === 'marketcap') {
        previousCurrencyRef.current = displayCurrency;
        if (displayCurrency !== 'USD') {
          setDisplayCurrency('USD');
        }
      } else if (mode === 'price' && previousCurrencyRef.current !== displayCurrency) {
        setDisplayCurrency(previousCurrencyRef.current);
      }
    },
    [displayCurrency, isPair, setDisplayCurrency, baseAsset.circulatingSupply, updateHeaderButtonStyles],
  );

  const currencyToggle = shouldShowCurrencyToggle && canToggleCurrency ? (
    <div className="flex overflow-hidden rounded-full border border-borderDefault bg-bgPrimary/80 shadow-sm pointer-events-auto">
      <button
        type="button"
        onClick={() => handleCurrencySelect('USD')}
        disabled={isCurrencyToggleDisabled}
        className={cn(
          'px-3 py-1 text-xs font-semibold transition-colors',
          effectiveDisplayCurrency === 'USD' ? 'bg-success text-white' : 'text-graySlate hover:text-white',
          isCurrencyToggleDisabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        USD
      </button>
      <button
        type="button"
        onClick={() => handleCurrencySelect('QUOTE')}
        disabled={isCurrencyToggleDisabled}
        className={cn(
          'px-3 py-1 text-xs font-semibold transition-colors border-l border-borderDefault/60',
          effectiveDisplayCurrency === 'QUOTE' ? 'bg-success text-white' : 'text-graySlate hover:text-white',
          (isCurrencyToggleDisabled || !canToggleCurrency) && 'opacity-60 cursor-not-allowed',
        )}
      >
        {derivedQuoteSymbol}
      </button>
    </div>
  ) : null;

  const refreshChartData = useCallback((reason: ChartDebugReason = 'token_switch') => {
    if (!widgetRef.current) return;
    
    try {
      widgetRef.current.onChartReady(() => {
        const chart = widgetRef.current?.activeChart();
        const widget = widgetRef.current;
        if (!chart || !widget) return;

        const baseSymbol = getChartSymbolBase(baseAsset, isPair);
        
        const timestamp = Date.now();
        const symbolWithMetric = metricModeRef.current === 'marketcap' 
          ? `${baseSymbol}_MCAP_${timestamp}`
          : `${baseSymbol}_PRICE_${timestamp}`;
        const symbolRequestId = beginSymbolRequest(reason, symbolWithMetric);

        setChartSymbolWithResolution(widget, chart, symbolWithMetric, () => {
          currentSymbolRef.current = symbolWithMetric;
          logSymbolCallback(symbolWithMetric, symbolRequestId);
        }, chart.resolution());
      });
    } catch (error) {
      logChartEvent('error', 'set_symbol_error', {
        reason,
        error: error instanceof Error ? error.message : 'Error refreshing chart data',
      });
    }
  }, [baseAsset, beginSymbolRequest, isPair, logChartEvent, logSymbolCallback, setChartSymbolWithResolution]);

  useEffect(() => {
    initialResolutionRef.current = initialResolution ?? persistedTimeframe;
    const newTheme = theme || (backgroundColor && (backgroundColor.toLowerCase() === '#ffffff' || backgroundColor.toLowerCase() === '#fff' || 
      (backgroundColor.startsWith('#') && parseInt(backgroundColor.slice(1), 16) > 0xCCCCCC)) ? 'light' : 'dark');
    themeRef.current = newTheme;
    candleUpColorRef.current = candleUpColor;
    candleDownColorRef.current = candleDownColor;
    showSymbolRef.current = showSymbol;
    showGridLinesRef.current = showGridLines;
  }, [initialResolution, persistedTimeframe, theme, backgroundColor, candleUpColor, candleDownColor, showSymbol, showGridLines]);

  useEffect(() => {
    if (!isPair || !baseAsset.quote?.symbol) return;
    setQuoteInfoStore(baseAsset.quote.symbol ?? '', baseAsset.quote.priceUSD ?? 1, baseAsset.quote.logo);
  }, [isPair, baseAsset.quote?.symbol, baseAsset.quote?.priceUSD, baseAsset.quote?.logo, setQuoteInfoStore]);

  useEffect(() => {
    if (!datafeedRef.current) return;
    datafeedRef.current.setCurrencyMode(effectiveDisplayCurrency === 'USD');
    // Only refresh after the initial widget load — the first getBars is
    // already triggered by the widget constructor, so skip on mount.
    if (didInitialLoadRef.current) {
      refreshChartData('currency_change');
    }
  }, [effectiveDisplayCurrency, refreshChartData]);

  // Update circulatingSupply — refresh chart if in mcap mode so bars get recalculated
  useEffect(() => {
    if (!datafeedRef.current) return;
    datafeedRef.current.setCirculatingSupply(baseAsset.circulatingSupply);
    if (metricModeRef.current === 'marketcap' && baseAsset.circulatingSupply && baseAsset.circulatingSupply > 0 && didInitialLoadRef.current) {
      refreshChartData('metric_change');
    }
  }, [baseAsset.circulatingSupply, refreshChartData]);

  // Only refresh chart when metric mode actually changes (price <-> marketcap)
  useEffect(() => {
    if (!datafeedRef.current || !widgetRef.current) return;
    datafeedRef.current.setMetricMode(metricMode);
    if (didInitialLoadRef.current) {
      widgetRef.current.onChartReady(() => {
        refreshChartData('metric_change');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricMode]);

  const setupChangeListeners = useCallback(
    (widget: IChartingLibraryWidget) => {
      const chart = widget.activeChart();
      const timeScale = chart.getTimeScale();
      const MAX_BAR_SPACING = 40;
      const MIN_BAR_SPACING = 2;

      const saveState = () => {
        try {
          saveChartTools(chart);
        } catch (error) {
          logChartEvent('error', 'save_chart_state_error', {
            error: error instanceof Error ? error.message : 'Error saving chart state',
          });
        }
      };

      // Clamp zoom: prevent zooming too far in (individual candles) or too far out
      let clamping = false;
      const onBarSpacing = (spacing: number) => {
        if (clamping) return;
        if (spacing > MAX_BAR_SPACING) {
          clamping = true;
          try { timeScale.setBarSpacing(MAX_BAR_SPACING); } catch { /* noop */ }
          clamping = false;
        } else if (spacing < MIN_BAR_SPACING) {
          clamping = true;
          try { timeScale.setBarSpacing(MIN_BAR_SPACING); } catch { /* noop */ }
          clamping = false;
        }
      };

      try {
        chart.onDataLoaded().subscribe(null, () => {
          const currentResolution = normalizeResolution(chart.resolution());
          const effectiveCurrentSymbol = currentSymbolRef.current || targetSymbolRef.current || null;
          const canRevealCurrentRequest = Boolean(
            pendingRevealRef.current &&
            effectiveCurrentSymbol &&
            effectiveCurrentSymbol === targetSymbolRef.current &&
            currentResolution === targetResolutionRef.current
          );
          logChartEvent('info', 'data_loaded_event', {
            timeSinceSetSymbolMs: getElapsedMs(symbolRequestedAtRef.current),
            currentChartSymbol: effectiveCurrentSymbol,
            currentResolution,
            targetSymbol: targetSymbolRef.current,
            targetResolution: targetResolutionRef.current,
            canRevealCurrentRequest,
          });
          saveState();
          if (canRevealCurrentRequest) {
            flushPendingReveal('data_loaded');
          }
        });
        chart.onSymbolChanged().subscribe(null, () => {
          const previousCurrentSymbol = currentSymbolRef.current || null;
          const nextCurrentSymbol = targetSymbolRef.current || currentSymbolRef.current || null;
          if (targetSymbolRef.current) {
            currentSymbolRef.current = targetSymbolRef.current;
          }
          logChartEvent('info', 'symbol_changed_event', {
            previousCurrentSymbol,
            currentChartSymbol: currentSymbolRef.current || null,
            nextCurrentSymbol,
            targetSymbol: targetSymbolRef.current,
          });
          saveState();
        });
        chart.onIntervalChanged().subscribe(null, () => {
          try {
            const nextResolution = chart.resolution();
            const normalizedNextResolution = normalizeResolution(nextResolution);
            const isProgrammaticIntervalChange = programmaticResolutionRef.current === nextResolution;
            logChartEvent('info', 'interval_changed', {
              previousInterval: previousResolutionRef.current,
              nextInterval: nextResolution,
              normalizedNextResolution,
              barSpacingReset: DEFAULT_BAR_SPACING,
              rightOffsetReset: DEFAULT_RIGHT_OFFSET,
              isProgrammaticIntervalChange,
            });
            if (isProgrammaticIntervalChange) {
              programmaticResolutionRef.current = null;
              initialResolutionRef.current = nextResolution;
              previousResolutionRef.current = nextResolution;
              targetResolutionRef.current = normalizedNextResolution;
              setTimeframe(nextResolution);
              return;
            }
            activeReasonRef.current = 'timeframe_change';
            initialResolutionRef.current = nextResolution;
            previousResolutionRef.current = nextResolution;
            targetResolutionRef.current = normalizedNextResolution;
            datafeedRef.current?.resetFirstData();
            setTimeframe(nextResolution);
            timeScale.setBarSpacing(DEFAULT_BAR_SPACING);
            timeScale.setRightOffset(DEFAULT_RIGHT_OFFSET);

            // Single setSymbol call — the unique timestamp symbol forces TV to
            // call resolveSymbol + getBars(firstDataRequest=true). No resetData()
            // needed (it would cause a redundant getBars).
            const timeframeBaseSymbol = getChartSymbolBase(baseAsset, isPair);
            const timeframeSymbol =
              metricModeRef.current === 'marketcap'
                ? `${timeframeBaseSymbol}_MCAP_${Date.now()}`
                : `${timeframeBaseSymbol}_PRICE_${Date.now()}`;
            const timeframeSymbolRequestId = beginSymbolRequest('timeframe_change', timeframeSymbol);
            setChartSymbolWithResolution(widget, chart, timeframeSymbol, () => {
              currentSymbolRef.current = timeframeSymbol;
              previousResolutionRef.current = nextResolution;
              logSymbolCallback(timeframeSymbol, timeframeSymbolRequestId);
              flushPendingReveal('timeframe_set_symbol_callback');
            }, nextResolution);

            saveState();
          } catch (error) {
            logChartEvent('error', 'interval_change_error', {
              error: error instanceof Error ? error.message : 'Error on interval change',
            });
          }
        });
        timeScale.barSpacingChanged().subscribe(null, onBarSpacing);

        // ── Scroll pre-fetch at 80% ──
        // When the user has scrolled left to see ~80% of loaded bars,
        // trigger a background fetch for 300 more older bars so they're
        // in localBarCache before TradingView's own pagination fires.
        let prefetchScheduled = false;
        const onVisibleRangeChanged = (range: { from: number; to: number }) => {
          if (!range || prefetchScheduled) return;
          const datafeed = datafeedRef.current;
          if (!datafeed) return;

          const oldestBarTime = datafeed.getOldestBarTime();
          const cachedCount = datafeed.getCachedBarCount();
          if (!oldestBarTime || cachedCount < 50) return;

          // range.from/to are in seconds (Unix time from TV)
          const visibleFromMs = range.from * 1000;

          // How far into the loaded history has the user scrolled?
          // oldestBarTime = left edge of loaded data
          // When visibleFromMs approaches oldestBarTime, user is near the edge.
          // Trigger prefetch when visible left is within 20% of total visible width from the edge.
          const visibleToMs = range.to * 1000;
          const visibleSpan = visibleToMs - visibleFromMs;
          const bufferMs = visibleSpan * 0.2; // 20% of visible width

          if (visibleFromMs <= oldestBarTime + bufferMs) {
            prefetchScheduled = true;
            const currentResolution = chart.resolution();
            datafeed.prefetchOlderBars(currentResolution);
            // Reset after a short delay to allow re-triggering if user keeps scrolling
            setTimeout(() => { prefetchScheduled = false; }, 1500);
          }
        };
        chart.onVisibleRangeChanged().subscribe(null, onVisibleRangeChanged);
      } catch (error) {
        logChartEvent('error', 'listener_setup_error', {
          error: error instanceof Error ? error.message : 'Error setting up chart listeners',
        });
      }

      return () => {
        try {
          chart.onDataLoaded().unsubscribeAll(null);
          chart.onSymbolChanged().unsubscribeAll(null);
          chart.onIntervalChanged().unsubscribeAll(null);
          chart.onVisibleRangeChanged().unsubscribeAll(null);
          timeScale.barSpacingChanged().unsubscribeAll(null);
        } catch (error) {
          logChartEvent('error', 'listener_cleanup_error', {
            error: error instanceof Error ? error.message : 'Error during cleanup',
          });
        }
      };
    },
    [logChartEvent, saveChartTools, setTimeframe],
  );

  // ── Helper: build the override object (no async, no side effects) ──
  const buildThemeOverrides = useCallback(() => {
    const ctr = themeRef.current ?? 'dark';
    const bgColor = backgroundColor || themeBgColor || (ctr === 'light' ? '#ffffff' : '#0A0A0A');
    const gridColor = ctr === 'light' ? '#E5E7EB' : '#141414';
    const textColor = ctr === 'light' ? '#1F2937' : '#606060';
    const scaleBgColor = backgroundColor || themeBgColor || (ctr === 'light' ? '#ffffff' : '#0A0A0A');
    const lineColor = ctr === 'light' ? '#E5E7EB' : '#1A1A1A';
    const effectiveGridColor = showGridLinesRef.current ? gridColor : 'transparent';
    const upColor = candleUpColorRef.current || '#0ECB81';
    const downColor = candleDownColorRef.current || (ctr === 'light' ? '#EF4444' : '#EA3943');
    const upFmt = upColor.startsWith('#') ? upColor : `#${upColor}`;
    const downFmt = downColor.startsWith('#') ? downColor : `#${downColor}`;
    return {
      'paneProperties.background': bgColor, 'paneProperties.backgroundType': 'solid',
      'paneProperties.vertGridProperties.color': effectiveGridColor, 'paneProperties.horzGridProperties.color': effectiveGridColor,
      'paneProperties.crossHairProperties.color': lineColor,
      'paneProperties.legendProperties.showLegend': showSymbolRef.current, 'paneProperties.legendProperties.showSeriesTitle': showSymbolRef.current,
      'paneProperties.legendProperties.showSeriesOHLC': showSymbolRef.current, 'paneProperties.legendProperties.showStudyTitles': showSymbolRef.current,
      'paneProperties.legendProperties.showStudyValues': showSymbolRef.current, 'paneProperties.legendProperties.showBarChange': showSymbolRef.current,
      'symbolWatermarkProperties.visibility': showSymbolRef.current,
      'scalesProperties.backgroundColor': scaleBgColor, 'scalesProperties.lineColor': lineColor, 'scalesProperties.textColor': textColor,
      'timeScale.borderColor': lineColor,
      'mainSeriesProperties.candleStyle.upColor': upFmt, 'mainSeriesProperties.candleStyle.downColor': downFmt,
      'mainSeriesProperties.candleStyle.borderUpColor': upFmt, 'mainSeriesProperties.candleStyle.borderDownColor': downFmt,
      'mainSeriesProperties.candleStyle.wickUpColor': upFmt, 'mainSeriesProperties.candleStyle.wickDownColor': downFmt,
    };
  }, [backgroundColor, themeBgColor]);

  // ── Apply theme: changeTheme (async) + re-apply overrides ──
  // Only used when the theme ACTUALLY changes (light↔dark), NOT on init.
  const applyTheme = useCallback((tvWidget: IChartingLibraryWidget) => {
    const ctr = themeRef.current ?? 'dark';
    try {
      tvWidget.onChartReady(() => {
        try {
          tvWidget.changeTheme(ctr === 'light' ? 'Light' : 'Dark').then(() => {
            if (!isMountedRef.current) return;
            tvWidget.applyOverrides(buildThemeOverrides());
          });
        } catch {
          // changeTheme unavailable (iframe not loaded) — fall back to overrides only
          try { tvWidget.applyOverrides(buildThemeOverrides()); } catch { /* noop */ }
        }
      });
    } catch {
      // Widget not ready at all — ignore
    }
  }, [buildThemeOverrides]);

  /**
   * Initialize TradingView Chart — with persistent widget reuse
   */
  useLayoutEffect(() => {
    isMountedRef.current = true;
    if (!baseAsset?.address || !ref.current) return;
    activeChartMountCount += 1;
    let releasedActiveChartMount = false;
    const assetKey = buildAssetKey();
    const previousAssetKey = previousAssetKeyRef.current;
    previousAssetKeyRef.current = assetKey;
    initAttemptIdRef.current = nextChartDebugId('init');
    initStartedAtRef.current = Date.now();
    symbolRequestIdRef.current = null;
    symbolRequestedAtRef.current = null;
    activeReasonRef.current = previousAssetKey && previousAssetKey !== assetKey ? 'token_switch' : 'initial_load';
    logChartEvent('info', 'chart_init_start', {
      assetKey,
      previousAssetKey,
      initialResolution: initialResolutionRef.current ?? null,
      hasExistingWidget: Boolean(widgetRef.current),
      hasExistingDatafeed: Boolean(datafeedRef.current),
      containerWidth: ref.current?.clientWidth ?? null,
      containerHeight: ref.current?.clientHeight ?? null,
    });

    // ── Common helpers ──
    const buildAssetPayload = () =>
      isPair
        ? { address: baseAsset.address, chainId: baseAsset.blockchain, priceUSD: baseAsset.priceUSD, isPair: true as const, symbol: baseAsset.symbol, base: baseAsset.base, quote: baseAsset.quote, circulatingSupply: baseAsset.circulatingSupply }
        : { asset: baseAsset.address, chainId: baseAsset.blockchain, priceUSD: baseAsset.priceUSD, isPair: false as const, symbol: baseAsset.symbol, circulatingSupply: baseAsset.circulatingSupply };
    const buildSymbol = () => {
      const base = getChartSymbolBase(baseAsset, isPair);
      // Timestamp suffix guarantees TradingView treats EVERY setSymbol as a NEW
      // symbol → always calls resolveSymbol + getBars. Same format as refreshChartData.
      const ts = Date.now();
      return metricModeRef.current === 'marketcap' ? `${base}_MCAP_${ts}` : `${base}_PRICE_${ts}`;
    };
    const startPrefetch = () => {
      const res = normalizeResolution(initialResolutionRef.current || '1S');
      return prefetchOhlcvData({ isPair, address: baseAsset.address, chainId: baseAsset.blockchain, period: res, isUsd: effectiveDisplayCurrency === 'USD' });
    };
    const parkWidget = () => {
      if (!releasedActiveChartMount) {
        activeChartMountCount = Math.max(0, activeChartMountCount - 1);
        releasedActiveChartMount = true;
      }
      logChartEvent('info', 'cleanup_unmount', {
        hadSafetyTimer: Boolean(safetyTimerRef.current),
        hadPendingReveal: Boolean(pendingRevealRef.current),
        hadChartListeners: Boolean(chartListenerCleanup),
        hadWidget: Boolean(widgetRef.current),
        currentSymbol: currentSymbolRef.current || null,
        targetSymbol: targetSymbolRef.current,
        targetResolution: targetResolutionRef.current,
      });
      isMountedRef.current = false;
      if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
      if (pendingRevealFallbackRef.current) { clearTimeout(pendingRevealFallbackRef.current); pendingRevealFallbackRef.current = null; }
      pendingRevealRef.current = null;
      targetSymbolRef.current = null;
      targetResolutionRef.current = null;
      if (chartListenerCleanup) { chartListenerCleanup(); chartListenerCleanup = null; }
      if (persistentWidget) {
        // Widget is fully ready — hide it (no reparenting! stays in parkingDiv).
        hideWidgetOverlay(persistentWidget!.hostDiv);
      } else if (widgetRef.current) {
        // Widget was created but onChartReady hasn't fired yet (user left quickly).
        // Destroy it — the warmup widget will handle the next navigation.
        try { widgetRef.current.remove(); } catch {}
      }
      widgetRef.current = null; datafeedRef.current = null; window.tvWidget = null;
      isInitializingRef.current = false; didInitialLoadRef.current = false; currentSymbolRef.current = '';
    };

    // ═══════════════════════════════════════════════════
    // REUSE PATH — widget already cached → 0ms init
    // ═══════════════════════════════════════════════════
    if (persistentWidget && !isInitializingRef.current) {
      try {
        const { hostDiv, widget: tvWidget, datafeed } = persistentWidget!;
        const containerEl = ref.current!;

        // Position widget over container. The spinner overlay (z-10) covers the
        // widget (z-0), so old candles are hidden without needing opacity:0.
        syncWidgetOverlay(hostDiv, containerEl);
        hostDiv.style.opacity = '1';

        // Reset the spinner overlay (it was hidden by previous token's chartLoaded())
        const overlayEl = overlayRef.current;
        overlayEl?.style.setProperty('display', '');

        widgetRef.current = tvWidget; datafeedRef.current = datafeed; window.tvWidget = tvWidget;
        // NOTE: didInitialLoadRef stays false until setSymbol completes (revealWidget).
        // This prevents useEffect hooks from calling refreshChartData() during mount,
        // which would fire a second setSymbol() and cancel the one we're about to do.

        // Force TradingView to recalculate layout (iframe was full-viewport during parking).
        window.dispatchEvent(new Event('resize'));
        requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); });

        const ohlcvPrefetch = startPrefetch();
        datafeed.setWarmup(false);
        datafeed.setDebugContext(getDebugContext);
        datafeed.updateBaseAsset(buildAssetPayload());
        datafeed.setCurrencyMode(effectiveDisplayCurrency === 'USD');
        datafeed.setMetricMode(metricModeRef.current);
        datafeed.resetFirstData();
        // onFirstData fires RIGHT AFTER onResult in getBars — before TradingView
        // schedules auto-pagination. Setting the visible range here prevents TV from
        // trying to fill the previous token's scroll position with backward pagination.
        datafeed.setOnFirstData((payload: FirstDataPayload) => {
          handleFirstDataReady(payload, {
            reveal: revealWidget,
            unlock: datafeed.createGuardedUnlock(),
          });
        });
        datafeed.setPrefetchPromise(ohlcvPrefetch);

        const symbol = buildSymbol();
        const overrides = buildThemeOverrides();


        try { tvWidget.applyOverrides(overrides); } catch { /* widget not ready yet */ }

        let revealed = false;
        const revealWidget = () => {
          if (revealed || !isMountedRef.current) return;
          const effectiveCurrentSymbol = currentSymbolRef.current || targetSymbolRef.current || null;
          if (effectiveCurrentSymbol !== symbol) {
            logChartEvent('warn', 'reveal_skipped_symbol_mismatch', {
              source: 'reuse',
              expectedSymbol: symbol,
              currentSymbol: effectiveCurrentSymbol,
              targetSymbol: targetSymbolRef.current,
              currentResolution: normalizeResolution(tvWidget.activeChart().resolution()),
              targetResolution: targetResolutionRef.current,
            });
            return;
          }
          revealed = true;
          currentSymbolRef.current = symbol;
          currentModeRef.current = { isPair, address: baseAsset.address };
          didInitialLoadRef.current = true;
          chartLoaded('reveal_widget');
        };

        // Safety: reveal after 1.5s even if setSymbol callback never fires.
        const revealTimer = setTimeout(revealWidget, 1500);

        const doReuse = () => {
          try {
            const chart = tvWidget.activeChart();
            const targetResolution = initialResolutionRef.current as ResolutionString | undefined;
            // Don't call primeViewportForResolution here — it triggers
            // setVisibleRange which causes extra getBars before data arrives.
            // resetViewportFromFirstData handles this after onFirstData fires.
            if (chartListenerCleanup) { chartListenerCleanup(); chartListenerCleanup = null; }
            chartListenerCleanup = setupChangeListeners(tvWidget);
            const symbolRequestId = beginSymbolRequest(activeReasonRef.current, symbol);
            tvWidget.applyOverrides(overrides);

            const onSymbolReady = () => {
              // Guard: only update refs after our datafeed confirmed new-token
              // data arrived (didInitialLoadRef). The onDataLoaded one-shot from
              // setSymbol can fire for a stale old-token data load; updating refs
              // prematurely would trick the reveal gate in setupChangeListeners.
              if (didInitialLoadRef.current) {
                currentSymbolRef.current = symbol;
                currentModeRef.current = { isPair, address: baseAsset.address };
                previousResolutionRef.current = targetResolution ?? chart.resolution();
              }
              logSymbolCallback(symbol, symbolRequestId);
              tvWidget.applyOverrides(overrides);
            };
            setChartSymbolWithResolution(tvWidget, chart, symbol, onSymbolReady, targetResolution);
          } catch (err) {
            console.error('[Chart] Error in REUSE:', err);
            clearTimeout(revealTimer);
            datafeed.unlockPagination();
            revealWidget();
          }
        };

        try {
          tvWidget.activeChart();
          doReuse();
        } catch {
          tvWidget.onChartReady(() => doReuse());
        }

        setIsChartReady();
        return parkWidget;
      } catch (e) {
        console.error('[Chart] Persistent widget broken, recreating:', e);
        const cleanupFn: (() => void) | undefined = overlayCleanup ?? undefined;
        cleanupFn?.();
        overlayCleanup = null;
        const stalePersistentWidget = persistentWidget;
        try { stalePersistentWidget?.widget.remove(); } catch (_) { /* noop */ }
        const staleHostDiv = stalePersistentWidget?.hostDiv;
        const staleHostParent = staleHostDiv?.parentNode;
        if (staleHostDiv && staleHostParent) {
          const hostDivToRemove = staleHostDiv!;
          const hostParentToUse = staleHostParent!;
          hostParentToUse.removeChild(hostDivToRemove);
        }
        persistentWidget = null;
        widgetRef.current = null; datafeedRef.current = null; window.tvWidget = null;
        // Fall through to CREATE PATH
      }
    }

    // ═══════════════════════════════════════════════════
    // ADOPT PATH — warmup widget in progress, reuse it
    // ═══════════════════════════════════════════════════
    // The warmup widget started initializing at +0ms. Instead of destroying it
    // and creating a new one (which restarts the ~2s TradingView init), adopt
    // the in-progress widget: move it into the real container and reconfigure
    // its datafeed with real asset data. When onChartReady fires, setSymbol().
    if (warmupWidgetRef && !isInitializingRef.current) {
      const { hostDiv, widget: tvWidget, datafeed } = warmupWidgetRef!;
      warmupWidgetRef = null;
      warmupSuperseded = true; // Block warmup's onChartReady from setting persistentWidget
      isInitializingRef.current = true;

      // Position warmup widget over the chart container — NO reparenting.
      // Moving iframes in the DOM causes browsers to reload them, destroying the widget.
      syncWidgetOverlay(hostDiv, ref.current!);
      hostDiv.style.opacity = '1';
      widgetRef.current = tvWidget;
      datafeedRef.current = datafeed;
      window.tvWidget = tvWidget;

      // Start prefetch immediately but keep warmup mode ON.
      // TradingView calls getBars during init — warmup mode returns empty data
      // so we avoid double API calls. We disable warmup in onChartReady right
      // before setSymbol(), which triggers the single real getBars call.
      const ohlcvPrefetch = startPrefetch();
      datafeed.setDebugContext(getDebugContext);
      datafeed.updateBaseAsset(buildAssetPayload());
      datafeed.setCurrencyMode(effectiveDisplayCurrency === 'USD');
      datafeed.setMetricMode(metricModeRef.current);
      datafeed.resetFirstData();
      // onFirstData fires RIGHT AFTER onResult in getBars — set visible range
      // immediately to prevent auto-pagination from filling old scroll position.
      datafeed.setOnFirstData((payload: FirstDataPayload) => {
        handleFirstDataReady(payload, {
          unlock: datafeed.createGuardedUnlock(),
        });
      });

      // Hide our overlay — let TradingView's loading_screen handle the UX
      chartLoaded();

      // Force resize after reparenting (parking div was full-screen, real container is smaller)
      requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); });

      // Safety timeout in case onChartReady never fires
      safetyTimerRef.current = setTimeout(() => {
        safetyTimerRef.current = null;
        if (!isMountedRef.current || didInitialLoadRef.current) return;
        console.warn('[Chart] ADOPT safety timeout: onChartReady never fired, destroying');
        if (overlayCleanup) { overlayCleanup(); overlayCleanup = null; }
        try { tvWidget.remove(); } catch {}
        hostDiv.remove();
        persistentWidget = null;
        widgetRef.current = null; datafeedRef.current = null; window.tvWidget = null;
        isInitializingRef.current = false;
        // Can't easily retry here — user will see spinner and need to navigate again
      }, 8000);

      tvWidget.onChartReady(() => {
        if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
        if (!isMountedRef.current) return;

        persistentWidget = { hostDiv, widget: tvWidget, datafeed };
        didInitialLoadRef.current = true;

        try {
          const chart = tvWidget.activeChart();
          const symbol = buildSymbol();
          const overrides = buildThemeOverrides();
          const targetResolution = initialResolutionRef.current as ResolutionString | undefined;
          // Don't call primeViewportForResolution before setSymbol —
          // resetViewportFromFirstData handles viewport after data arrives.
          if (chartListenerCleanup) { chartListenerCleanup(); chartListenerCleanup = null; }
          chartListenerCleanup = setupChangeListeners(tvWidget);
          const symbolRequestId = beginSymbolRequest(activeReasonRef.current, symbol);

          // Disable warmup and wire prefetch RIGHT before setSymbol
          // so TradingView's getBars uses the real data (single call).
          datafeed.setWarmup(false);
          datafeed.setPrefetchPromise(ohlcvPrefetch);

          tvWidget.applyOverrides(overrides);
          const onSymbolReady = () => {
            currentSymbolRef.current = symbol;
            currentModeRef.current = { isPair, address: baseAsset.address };
            previousResolutionRef.current = targetResolution ?? chart.resolution();
            logSymbolCallback(symbol, symbolRequestId);
            tvWidget.applyOverrides(overrides);
            flushPendingReveal('set_symbol_callback');
          };
          setChartSymbolWithResolution(tvWidget, chart, symbol, onSymbolReady, targetResolution);

          // Re-apply after a frame to catch post-init theme resets
          requestAnimationFrame(() => {
            if (isMountedRef.current) {
              try { tvWidget.applyOverrides(overrides); } catch { /* noop */ }
            }
          });

          setIsChartReady();

          tvWidget.headerReady().then(() => {
            try {
              const currentTheme = themeRef.current ?? 'dark';
              const activeColor = '#0ECB81';
              const inactiveColor = currentTheme === 'light' ? '#6B7280' : '#9CA3AF';
              const toggleButton = tvWidget.createButton({ align: 'left' });
              toggleButton.style.display = 'flex';
              toggleButton.style.alignItems = 'center';
              toggleButton.style.gap = '0';
              toggleButton.style.cursor = 'default';
              toggleButton.style.fontSize = '13px';
              toggleButton.innerHTML = '';
              const priceSpan = document.createElement('span');
              priceSpan.textContent = 'Price';
              priceSpan.style.cursor = 'pointer';
              priceSpan.style.color = metricModeRef.current === 'price' ? activeColor : inactiveColor;
              priceSpan.style.fontWeight = metricModeRef.current === 'price' ? '600' : '400';
              priceSpan.addEventListener('click', () => handleMetricModeChange('price'));
              priceButtonRef.current = priceSpan;
              const separatorSpan = document.createElement('span');
              separatorSpan.textContent = ' / ';
              separatorSpan.style.color = inactiveColor;
              const mcapSpan = document.createElement('span');
              mcapSpan.textContent = 'Mcap';
              mcapSpan.style.cursor = 'pointer';
              mcapSpan.style.color = metricModeRef.current === 'marketcap' ? activeColor : inactiveColor;
              mcapSpan.style.fontWeight = metricModeRef.current === 'marketcap' ? '600' : '400';
              mcapSpan.addEventListener('click', () => handleMetricModeChange('marketcap'));
              mcapButtonRef.current = mcapSpan;
              toggleButton.appendChild(priceSpan);
              toggleButton.appendChild(separatorSpan);
              toggleButton.appendChild(mcapSpan);
            } catch (error) {
              console.error('[Chart] Error creating ADOPT toggle button:', error);
            }
          }).catch(() => {});

          if (targetResolution) {
            setTimeframe(targetResolution);
          }

          loadSavedTools(chart).catch(() => {});
        } catch (error) {
          console.error('[Chart] Error in ADOPT onChartReady:', error);
        } finally {
          isInitializingRef.current = false;
        }
      });

      return parkWidget;
    }

    // ═══════════════════════════════════════════════════
    // CREATE PATH — fallback: no warmup widget available
    // ═══════════════════════════════════════════════════
    if (isInitializingRef.current || widgetRef.current) return;
    isInitializingRef.current = true;
    warmupSuperseded = true;

    const initChart = async () => {
      try {
        const ohlcvPrefetch = startPrefetch();
        const libraryLoadStartedAt = Date.now();
        const { widget: Widget } = await (getTvLibrary() ?? import('../../../public/static/charting_library/'));
        logChartEvent('info', 'tv_library_loaded', {
          loadDurationMs: Date.now() - libraryLoadStartedAt,
          hasContainer: Boolean(ref.current),
          isMounted: isMountedRef.current,
        });
        if (!isMountedRef.current || !ref.current) {
          isInitializingRef.current = false;
          return;
        }

        // Clean up warmup widget — either it already became persistentWidget (race: onChartReady
        // fired during our await) or it's still warming up (tracked in warmupWidgetRef).
        if (persistentWidget) {
          try { persistentWidget.widget.remove(); } catch {}
          persistentWidget.hostDiv.remove();
          persistentWidget = null;
        }
        if (warmupWidgetRef) {
          try { warmupWidgetRef.widget.remove(); } catch {}
          warmupWidgetRef.hostDiv.remove();
          warmupWidgetRef = null;
        }

        const symbol = buildSymbol();

        currentSymbolRef.current = symbol;
        currentModeRef.current = { isPair, address: baseAsset.address };

        // Build correct asset payload for datafeed
        const assetPayload = isPair
          ? {
              address: baseAsset.address, // PAIR address
              chainId: baseAsset.blockchain,
              priceUSD: baseAsset.priceUSD,
              isPair: true,
              symbol: baseAsset.symbol,
              base: baseAsset.base,
              quote: baseAsset.quote,
              circulatingSupply: baseAsset.circulatingSupply,
            }
          : {
              asset: baseAsset.address, // TOKEN address
              chainId: baseAsset.blockchain,
              priceUSD: baseAsset.priceUSD,
              isPair: false,
              symbol: baseAsset.symbol,
              circulatingSupply: baseAsset.circulatingSupply,
            };

        // Initialize datafeed
        if (!datafeedRef.current) {
          datafeedRef.current = Datafeed(assetPayload, {
            isUsd: effectiveDisplayCurrency === 'USD',
            metricMode: metricModeRef.current,
            deployer,
            userAddress: effectiveUserAddress,
            onFirstData: (payload) => {
              handleFirstDataReady(payload, {
                unlock: datafeedRef.current?.createGuardedUnlock() ?? (() => {}),
              });
            },
            getDebugContext,
            warmup: true,
          });
          logChartEvent('info', 'datafeed_configured', {
            datafeedMode: 'create',
            warmup: true,
            hasUserAddress: Boolean(effectiveUserAddress),
            hasDeployer: Boolean(deployer),
          });
        } else {
          datafeedRef.current.setDebugContext(getDebugContext);
          datafeedRef.current.updateBaseAsset(assetPayload);
          datafeedRef.current.setCurrencyMode(effectiveDisplayCurrency === 'USD');
          datafeedRef.current.setMetricMode(metricModeRef.current);
          logChartEvent('info', 'datafeed_configured', {
            datafeedMode: 'update',
            warmup: true,
            hasUserAddress: Boolean(effectiveUserAddress),
            hasDeployer: Boolean(deployer),
          });
        }

        // Create a host div in the permanent parking container (never reparented).
        // Position it over the chart container via CSS overlay.
        const hostDiv = document.createElement('div');
        hostDiv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;opacity:0;pointer-events:none;z-index:-1;';
        ensureParkingDiv().appendChild(hostDiv);
        syncWidgetOverlay(hostDiv, ref.current);
        hostDiv.style.opacity = '1';

        const currentTheme = themeRef.current ?? 'dark';
        const toolbarBgColor = backgroundColor || (currentTheme === 'light' ? '#ffffff' : '#0A0A0A');
        const requestedInitialResolution = (
          initialResolutionRef.current
          ? (initialResolutionRef.current as ResolutionString)
          : widgetOptionsDefault.interval
        );

        const widgetOptions: ChartingLibraryWidgetOptions = {
          datafeed: datafeedRef.current,
          symbol,
          container: hostDiv,
          locale: 'en',
          fullscreen: false,
          autosize: true,
          theme: currentTheme === 'light' ? 'Light' : 'Dark',
          toolbar_bg: toolbarBgColor,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone as Timezone,
          custom_css_url,
          disabled_features: DISABLED_FEATURES,
          enabled_features: [...ENABLED_FEATURES],
          loading_screen: {
            backgroundColor: backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#0A0A0A'),
            foregroundColor: backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#0A0A0A'),
          },
          time_frames: [
            { text: '5y', resolution: '1W' as ResolutionString, description: '5 Years' },
            { text: '1y', resolution: '1W' as ResolutionString, description: '1 Year' },
            { text: '6m', resolution: '1W' as ResolutionString, description: '6 Months' },
            { text: '3m', resolution: '60' as ResolutionString, description: '3 Months' },
            { text: '1m', resolution: '60' as ResolutionString, description: '1 Month' },
            { text: '5d', resolution: '5' as ResolutionString, description: '5 Days' },
            { text: '1d', resolution: '1' as ResolutionString, description: '1 Day' },
          ],
          // settings_overrides takes precedence over theme defaults — the Dark theme
          // would otherwise overwrite our candle colors with its own defaults.
          settings_overrides: {
            ...buildThemeOverrides(),
            'mainSeriesProperties.candleStyle.drawWick': true,
            'mainSeriesProperties.candleStyle.drawBorder': true,
            'scalesProperties.fontSize': 11,
            'scalesProperties.showSeriesLastValue': true,
            'priceScaleProperties.showSeriesLastValue': true,
            'timeScale.rightOffset': DEFAULT_RIGHT_OFFSET,
            'timeScale.barSpacing': DEFAULT_BAR_SPACING,
            'timeScale.visible': true,
            volumePaneSize: 'small',
          },
          overrides: {
            ...buildThemeOverrides(),
            'mainSeriesProperties.candleStyle.drawWick': true,
            'mainSeriesProperties.candleStyle.drawBorder': true,
            'scalesProperties.fontSize': 11,
            'scalesProperties.showSeriesLastValue': true,
            'priceScaleProperties.showSeriesLastValue': true,
            'timeScale.rightOffset': DEFAULT_RIGHT_OFFSET,
            'timeScale.barSpacing': DEFAULT_BAR_SPACING,
            'timeScale.visible': true,
            volumePaneSize: 'small',
          },
          studies_overrides: {
            'volume.volume.color.0': '#0ECB81',
            'volume.volume.color.1': '#EA3943',
            'volume.volume.transparency': 50,
          },
          ...widgetOptionsDefault,
          interval: requestedInitialResolution,
        };

        const tvWidget = new (Widget as ChartingLibraryWidgetConstructor)(widgetOptions);
        widgetRef.current = tvWidget;
        window.tvWidget = tvWidget;
        logChartEvent('info', 'widget_constructed', {
          initialSymbol: symbol,
          interval: widgetOptions.interval,
          requestedInitialResolution,
          theme: widgetOptions.theme,
          customCssUrl: custom_css_url,
          containerWidth: ref.current?.clientWidth ?? null,
          containerHeight: ref.current?.clientHeight ?? null,
        });

        // Ensure TradingView detects the container dimensions correctly.
        // react-resizable-panels may still be computing layout when the widget
        // constructor runs — a deferred resize nudge avoids a 0-height render.
        requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); });

        // Safety timeout: if onChartReady never fires (frozen iframe, load failure),
        // destroy the widget and retry. This handles the random "chart won't load" bug.
        safetyTimerRef.current = setTimeout(() => {
          safetyTimerRef.current = null;
          if (!isMountedRef.current || didInitialLoadRef.current) return;
          logChartEvent('warn', 'safety_timeout_fired', {
            timeSinceInitMs: getElapsedMs(initStartedAtRef.current),
            overlayVisible: overlayRef.current?.style.display !== 'none',
            currentSymbol: currentSymbolRef.current || null,
            containerWidth: ref.current?.clientWidth ?? null,
            containerHeight: ref.current?.clientHeight ?? null,
          });
          if (overlayCleanup) { overlayCleanup(); overlayCleanup = null; }
          try { tvWidget.remove(); } catch {}
          hostDiv.remove();
          persistentWidget = null;
          widgetRef.current = null; datafeedRef.current = null; window.tvWidget = null;
          isInitializingRef.current = false;
          // Show overlay again so user sees spinner during retry
          if (overlayRef.current) overlayRef.current.style.display = '';
          // Re-run init
          logChartEvent('warn', 'init_retry', {
            nextInitAttemptReason: 'safety_timeout',
          });
          initChart();
        }, 8000);

        tvWidget.onChartReady(() => {
          if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
          if (!isMountedRef.current) return;

          // Only expose as persistent AFTER chart is fully ready —
          // next navigation's REUSE PATH will get a widget with tools rendered.
          persistentWidget = { hostDiv, widget: tvWidget, datafeed: datafeedRef.current! };

          try {
            const chart = tvWidget.activeChart();
            const readySymbol = buildSymbol();
            const targetResolution = initialResolutionRef.current as ResolutionString | undefined;
            let revealed = false;
            const revealWidget = () => {
              if (revealed || !isMountedRef.current) return;
              const effectiveCurrentSymbol = currentSymbolRef.current || targetSymbolRef.current || null;
              if (effectiveCurrentSymbol !== readySymbol) {
                logChartEvent('warn', 'reveal_skipped_symbol_mismatch', {
                  source: 'create',
                  expectedSymbol: readySymbol,
                  currentSymbol: effectiveCurrentSymbol,
                  targetSymbol: targetSymbolRef.current,
                  currentResolution: normalizeResolution(chart.resolution()),
                  targetResolution: targetResolutionRef.current,
                });
                return;
              }
              revealed = true;
              didInitialLoadRef.current = true;
              chartLoaded('reveal_widget');
            };
            previousResolutionRef.current = chart.resolution();
            logChartEvent('info', 'chart_ready', {
              timeToReadyMs: getElapsedMs(initStartedAtRef.current),
              readySymbol,
              currentResolution: previousResolutionRef.current,
            });
            try {
              const ts = chart.getTimeScale();
              ts.setBarSpacing(DEFAULT_BAR_SPACING);
              ts.setRightOffset(DEFAULT_RIGHT_OFFSET);
            } catch { /* noop */ }
            // Don't call primeViewportForResolution before setSymbol —
            // resetViewportFromFirstData handles viewport after data arrives.
            if (chartListenerCleanup) { chartListenerCleanup(); chartListenerCleanup = null; }
            chartListenerCleanup = setupChangeListeners(tvWidget);

            // Re-apply overrides after chart ready — constructor overrides may be
            // lost when TradingView initializes its internal theme.
            tvWidget.applyOverrides(buildThemeOverrides());
            // Re-apply after a frame to catch any post-init theme reset by TradingView
            requestAnimationFrame(() => {
              if (isMountedRef.current) {
                try { tvWidget.applyOverrides(buildThemeOverrides()); } catch { /* noop */ }
              }
            });

            datafeedRef.current?.setWarmup(false);
            datafeedRef.current?.setPrefetchPromise(ohlcvPrefetch);
            datafeedRef.current?.resetFirstData();
            datafeedRef.current?.setOnFirstData((payload) => {
              handleFirstDataReady(payload, {
                reveal: revealWidget,
                unlock: datafeedRef.current?.createGuardedUnlock() ?? (() => {}),
              });
            });
            const symbolRequestId = beginSymbolRequest(activeReasonRef.current, readySymbol);
            setChartSymbolWithResolution(tvWidget, chart, readySymbol, () => {
              currentSymbolRef.current = readySymbol;
              currentModeRef.current = { isPair, address: baseAsset.address };
              previousResolutionRef.current = targetResolution ?? chart.resolution();
              logSymbolCallback(readySymbol, symbolRequestId);
              try { tvWidget.applyOverrides(buildThemeOverrides()); } catch { /* noop */ }
              flushPendingReveal('set_symbol_callback');
            }, targetResolution);

            setIsChartReady();

            tvWidget.headerReady().then(() => {
              try {
                const activeColor = '#0ECB81';
                const inactiveColor = currentTheme === 'light' ? '#6B7280' : '#9CA3AF';

                const toggleButton = tvWidget.createButton({ align: 'left' });
                toggleButton.style.display = 'flex';
                toggleButton.style.alignItems = 'center';
                toggleButton.style.gap = '0';
                toggleButton.style.cursor = 'default';
                toggleButton.style.fontSize = '13px';
                toggleButton.innerHTML = '';

                const priceSpan = document.createElement('span');
                priceSpan.textContent = 'Price';
                priceSpan.style.cursor = 'pointer';
                priceSpan.style.color = metricModeRef.current === 'price' ? activeColor : inactiveColor;
                priceSpan.style.fontWeight = metricModeRef.current === 'price' ? '600' : '400';
                priceSpan.addEventListener('click', () => handleMetricModeChange('price'));
                priceButtonRef.current = priceSpan;

                const separatorSpan = document.createElement('span');
                separatorSpan.textContent = ' / ';
                separatorSpan.style.color = inactiveColor;

                const mcapSpan = document.createElement('span');
                mcapSpan.textContent = 'Mcap';
                mcapSpan.style.cursor = 'pointer';
                mcapSpan.style.color = metricModeRef.current === 'marketcap' ? activeColor : inactiveColor;
                mcapSpan.style.fontWeight = metricModeRef.current === 'marketcap' ? '600' : '400';
                mcapSpan.addEventListener('click', () => handleMetricModeChange('marketcap'));
                mcapButtonRef.current = mcapSpan;

                toggleButton.appendChild(priceSpan);
                toggleButton.appendChild(separatorSpan);
                toggleButton.appendChild(mcapSpan);
              } catch (error) {
                logChartEvent('error', 'toggle_button_error', {
                  error: error instanceof Error ? error.message : 'Error creating toggle button',
                });
              }
            }).catch((error) => {
              logChartEvent('error', 'header_ready_error', {
                error: error instanceof Error ? error.message : 'Error waiting for header ready',
              });
            });

            if (targetResolution) {
              setTimeframe(targetResolution);
            }

            // Load saved studies in background — don't block chart display
            loadSavedTools(chart).catch((error) => {
              logChartEvent('error', 'load_saved_tools_error', {
                error: error instanceof Error ? error.message : 'Error loading saved tools',
              });
            });
          } catch (error) {
            logChartEvent('error', 'chart_ready_error', {
              error: error instanceof Error ? error.message : 'Error in chart ready callback',
            });
          } finally {
            isInitializingRef.current = false;
          }
        });
      } catch (error) {
        logChartEvent('error', 'chart_init_error', {
          error: error instanceof Error ? error.message : 'Error initializing TradingView',
        });
        isInitializingRef.current = false;
      }
    };

    initChart();

    return parkWidget;
  }, [baseAsset.address, isPair]); // Re-initialize when component mounts (key forces remount on navigation)

  /**
   * Update marks options when wallet address or deployer changes
   */
  useEffect(() => {
    if (!datafeedRef.current) return;
    datafeedRef.current.updateMarksOptions(deployer, effectiveUserAddress);
    
    // Force chart to refresh marks
    if (widgetRef.current) {
      widgetRef.current.onChartReady(() => {
        try {
          const chart = widgetRef.current?.activeChart();
          if (chart) {
            chart.clearMarks();
            chart.refreshMarks();
          }
        } catch (error) {
          logChartEvent('error', 'refresh_marks_error', {
            error: error instanceof Error ? error.message : 'Error refreshing marks',
          });
        }
      });
    }
  }, [deployer, effectiveUserAddress, logChartEvent]);

  /**
   * Draw avg buy / avg sell horizontal lines from user position data.
   */
  useEffect(() => {
    if (!widgetRef.current || !didInitialLoadRef.current) return;

    const removeLines = () => {
      try { avgBuyLineRef.current?.remove(); } catch { /* noop */ }
      try { avgSellLineRef.current?.remove(); } catch { /* noop */ }
      avgBuyLineRef.current = null;
      avgSellLineRef.current = null;
    };

    removeLines();

    if (!position) return;

    const widget = widgetRef.current;
    try {
      widget.onChartReady(() => {
        const chart = widget.activeChart();

        if (position.avgBuyPriceUSD > 0) {
          avgBuyLineRef.current = chart.createOrderLine()
            .setPrice(position.avgBuyPriceUSD)
            .setText('Avg Buy')
            .setQuantity('')
            .setEditable(false)
            .setCancellable(false)
            .setExtendLeft(true)
            .setLineLength(100)
            .setLineStyle(2) // dashed
            .setLineWidth(1)
            .setLineColor('#0ECB81')
            .setBodyBorderColor('#0ECB81')
            .setBodyBackgroundColor('#0ECB8133')
            .setBodyTextColor('#0ECB81');
        }

        if (position.avgSellPriceUSD > 0) {
          avgSellLineRef.current = chart.createOrderLine()
            .setPrice(position.avgSellPriceUSD)
            .setText('Avg Sell')
            .setQuantity('')
            .setEditable(false)
            .setCancellable(false)
            .setExtendLeft(true)
            .setLineLength(100)
            .setLineStyle(2) // dashed
            .setLineWidth(1)
            .setLineColor('#EA3943')
            .setBodyBorderColor('#EA3943')
            .setBodyBackgroundColor('#EA394333')
            .setBodyTextColor('#EA3943');
        }
      });
    } catch (error) {
      logChartEvent('error', 'avg_price_lines_error', {
        error: error instanceof Error ? error.message : 'Error creating avg price lines',
      });
    }

    return removeLines;
  }, [position?.avgBuyPriceUSD, position?.avgSellPriceUSD, logChartEvent]);

  /**
   * Update theme and chart type when they change.
   * Skip the very first run — the CREATE/REUSE PATH already applies the
   * correct theme via constructor overrides or direct applyOverrides.
   */
  useEffect(() => {
    if (!widgetRef.current || !isMountedRef.current) return;
    if (!didInitialLoadRef.current) return; // not ready yet
    if (!themeEffectRanRef.current) { themeEffectRanRef.current = true; return; }
    applyTheme(widgetRef.current);
  }, [theme, candleUpColor, candleDownColor, backgroundColor, themeBgColor, showSymbol, showGridLines, applyTheme]);

  // Use CSS variable for consistent background - it's already set by the head script or CSS defaults
  // Only use explicit backgroundColor prop if provided (for embeds with custom colors)
  const explicitBgColor = backgroundColor || (theme === 'light' ? '#ffffff' : undefined);

  return (
    <div className="h-full">
      <div 
        className={cn("relative h-full", !explicitBgColor && "bg-bgPrimary")}
        style={explicitBgColor ? { backgroundColor: explicitBgColor } : undefined}
      >
        {currencyToggle && (
          <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2 pointer-events-none">
            {currencyToggle}
          </div>
        )}
        <div
          ref={overlayRef}
          className={cn(
            'absolute z-10 w-full h-full',
            !explicitBgColor && 'bg-bgPrimary',
          )}
          style={explicitBgColor ? { backgroundColor: explicitBgColor } : undefined}
        >
          <div className="w-full h-full flex items-center justify-center canvas-chart">
            <Spinner extraCss="h-[50px] text-success" />
          </div>
        </div>
        <div
          className={cn(
            'flex flex-col rounded-md h-full w-full items-center justify-center relative pointer-events-auto',
            !explicitBgColor && 'bg-bgPrimary',
            className,
          )}
          ref={ref}
          style={explicitBgColor ? { backgroundColor: explicitBgColor } : undefined}
        />
      </div>
    </div>
  );
};

export default TradingViewChart;