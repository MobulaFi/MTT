'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useChartTools } from '@/hooks/useChart';
import { cn } from '@/lib/utils';
import type {
  ChartingLibraryWidgetConstructor,
  ChartingLibraryWidgetOptions,
  IChartingLibraryWidget,
  ResolutionString,
  Timezone,
} from '../../../public/static/charting_library/charting_library';
import { useChartStore } from '@/store/useChartStore';
import { useThemeStore } from '@/store/useThemeStore';
import { widgetOptionsDefault } from '@/utils/tradingview/helper';
import { DISABLED_FEATURES, ENABLED_FEATURES } from './constants';
import { Datafeed, type ChartMetricMode } from './datafeed';
import { overrides } from './theme';
import { useRenderCounter } from '@/utils/useRenderCounter';
import { usePriceDisplayStore } from '@/store/useDisplayPriceStore';
import { useWalletConnection } from '@/hooks/useWalletConnection';

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
  // Render counter for diagnostics
  useRenderCounter('TradingViewChart');

  const { address: walletAddress } = useWalletConnection();
  const effectiveUserAddress = userAddress ?? walletAddress ?? undefined;

  const ref = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<IChartingLibraryWidget | null>(null);
  const datafeedRef = useRef<ReturnType<typeof Datafeed> | null>(null);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);
  const currentSymbolRef = useRef<string>('');
  const currentModeRef = useRef<{ isPair: boolean; address: string }>({
    isPair,
    address: baseAsset.address,
  });
  const metricModeRef = useRef<ChartMetricMode>('price');
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('price');
  const previousCurrencyRef = useRef<'USD' | 'QUOTE'>('USD');
  const mcapButtonRef = useRef<HTMLElement | null>(null);
  const priceButtonRef = useRef<HTMLElement | null>(null);
  const initialResolutionRef = useRef<string | undefined>(initialResolution);
  // Determine theme from backgroundColor if theme not provided
  const resolvedTheme = theme || (backgroundColor && (backgroundColor.toLowerCase() === '#ffffff' || backgroundColor.toLowerCase() === '#fff' || 
    (backgroundColor.startsWith('#') && parseInt(backgroundColor.slice(1), 16) > 0xCCCCCC)) ? 'light' : 'dark');
  const themeRef = useRef<'light' | 'dark'>(resolvedTheme);
  const candleUpColorRef = useRef<string | undefined>(candleUpColor);
  const candleDownColorRef = useRef<string | undefined>(candleDownColor);
  const showSymbolRef = useRef<boolean>(showSymbol);
  const showGridLinesRef = useRef<boolean>(showGridLines);

  const { loadSavedTools, saveChartTools } = useChartTools();
  const isChartLoading = useChartStore((s) => s.isChartLoading);
  const setIsChartReady = useChartStore((s) => s.setIsChartReady);
  const themeBgColor = useThemeStore((s) => s.colors.bgPrimary);
  const setTimeframe = useChartStore((s) => s.setTimeframe);
  const chartLoaded = useChartStore((s) => s.chartLoaded);
  const displayCurrency = usePriceDisplayStore((s) => s.displayCurrency);
  const setDisplayCurrency = usePriceDisplayStore((s) => s.setDisplayCurrency);
  const quoteCurrencySymbolStore = usePriceDisplayStore((s) => s.quoteCurrencySymbol);
  const setQuoteInfoStore = usePriceDisplayStore((s) => s.setQuoteInfo);

  const effectiveDisplayCurrency = useMemo<'USD' | 'QUOTE'>(() => {
    if (!isPair) return 'USD';
    if (metricMode === 'marketcap') return 'USD';
    return displayCurrency;
  }, [displayCurrency, isPair, metricMode]);

  const derivedQuoteSymbol = quoteCurrencySymbolStore || baseAsset.quote?.symbol || baseAsset.symbol || 'QUOTE';
  const canToggleCurrency = isPair && Boolean(derivedQuoteSymbol);
  const shouldShowCurrencyToggle = false; // MOB-1687: hide broken USD/SOL toggle for now
  const isCurrencyToggleDisabled = metricMode === 'marketcap';
  const hasSupply = Boolean(baseAsset.circulatingSupply && baseAsset.circulatingSupply > 0);

  const handleCurrencySelect = useCallback(
    (target: 'USD' | 'QUOTE') => {
      if (isCurrencyToggleDisabled || effectiveDisplayCurrency === target) return;
      setDisplayCurrency(target);
    },
    [effectiveDisplayCurrency, isCurrencyToggleDisabled, setDisplayCurrency],
  );

  const updateHeaderButtonStyles = useCallback((mode: ChartMetricMode) => {
    const currentTheme = themeRef.current ?? 'dark';
    const activeColor = '#18C722';
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

  const refreshChartData = useCallback(() => {
    if (!widgetRef.current) return;
    
    try {
      widgetRef.current.onChartReady(() => {
        const chart = widgetRef.current?.activeChart();
        if (!chart) return;

        const baseSymbol = isPair
          ? `${baseAsset.base?.symbol ?? baseAsset.symbol}/USD`
          : `${baseAsset.symbol}/USD`;
        
        const timestamp = Date.now();
        const symbolWithMetric = metricModeRef.current === 'marketcap' 
          ? `${baseSymbol}_MCAP_${timestamp}`
          : `${baseSymbol}_PRICE_${timestamp}`;
        currentSymbolRef.current = symbolWithMetric;
        
        console.log('Refreshing chart data with metric:', metricModeRef.current, 'symbol:', symbolWithMetric);
        chart.setSymbol(symbolWithMetric, () => {
          console.log('Symbol set callback executed for:', symbolWithMetric);
          console.log('getBars should have been called by TradingView now');
        });
      });
    } catch (error) {
      console.error('Error refreshing chart data:', error);
    }
  }, [isPair, baseAsset.symbol, baseAsset.base?.symbol]);

  useEffect(() => {
    initialResolutionRef.current = initialResolution;
    const newTheme = theme || (backgroundColor && (backgroundColor.toLowerCase() === '#ffffff' || backgroundColor.toLowerCase() === '#fff' || 
      (backgroundColor.startsWith('#') && parseInt(backgroundColor.slice(1), 16) > 0xCCCCCC)) ? 'light' : 'dark');
    themeRef.current = newTheme;
    candleUpColorRef.current = candleUpColor;
    candleDownColorRef.current = candleDownColor;
    showSymbolRef.current = showSymbol;
    showGridLinesRef.current = showGridLines;
  }, [initialResolution, theme, backgroundColor, candleUpColor, candleDownColor, showSymbol, showGridLines]);

  useEffect(() => {
    if (!isPair || !baseAsset.quote?.symbol) return;
    setQuoteInfoStore(baseAsset.quote.symbol ?? '', baseAsset.quote.priceUSD ?? 1, baseAsset.quote.logo);
  }, [isPair, baseAsset.quote?.symbol, baseAsset.quote?.priceUSD, baseAsset.quote?.logo, setQuoteInfoStore]);

  useEffect(() => {
    if (!datafeedRef.current) return;
    datafeedRef.current.setCurrencyMode(effectiveDisplayCurrency === 'USD');
    refreshChartData();
  }, [effectiveDisplayCurrency, refreshChartData]);

  useEffect(() => {
    if (!datafeedRef.current || !widgetRef.current) return;
    datafeedRef.current.setMetricMode(metricMode);
    datafeedRef.current.setCirculatingSupply(baseAsset.circulatingSupply);
    widgetRef.current.onChartReady(() => {
      refreshChartData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricMode, baseAsset.circulatingSupply]);

  const setupChangeListeners = useCallback(
    (widget: IChartingLibraryWidget) => {
      const chart = widget.activeChart();
      const saveState = () => {
        try {
          saveChartTools(chart);
        } catch (error) {
          console.error('Error saving chart state:', error);
        }
      };

      try {
        chart.onDataLoaded().subscribe(null, saveState);
        chart.onSymbolChanged().subscribe(null, saveState);
        chart.onIntervalChanged().subscribe(null, () => {
          try {
            setTimeframe(chart.resolution());
            saveState();
          } catch (error) {
            console.error('Error on interval change:', error);
          }
        });
      } catch (error) {
        console.error('Error setting up chart listeners:', error);
      }

      return () => {
        try {
          chart.onDataLoaded().unsubscribeAll(null);
          chart.onSymbolChanged().unsubscribeAll(null);
          chart.onIntervalChanged().unsubscribeAll(null);
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      };
    },
    [saveChartTools, setTimeframe],
  );

  /**
   * Initialize TradingView Chart
   */
  useEffect(() => {
    isMountedRef.current = true;

    console.log('[Chart Debug] useEffect triggered', {
      address: baseAsset?.address,
      refAvailable: !!ref.current,
      isInitializing: isInitializingRef.current,
      widgetExists: !!widgetRef.current,
    });

    if (!baseAsset?.address || !ref.current) {
      console.warn('[Chart Debug] Invalid baseAsset or ref not available');
      return;
    }

    if (isInitializingRef.current || widgetRef.current) {
      console.log('[Chart Debug] Already initializing or widget exists, skipping');
      return;
    }
    isInitializingRef.current = true;

    const initChart = async () => {
      try {
        console.log('[Chart Debug] Starting chart initialization...');
        const { widget: Widget } = await import('../../../public/static/charting_library/');
        console.log('[Chart Debug] TradingView library loaded');
        if (!isMountedRef.current || !ref.current) {
          isInitializingRef.current = false;
          return;
        }

        const baseSymbol = isPair
          ? `${baseAsset.base?.symbol ?? baseAsset.symbol}/USD`
          : `${baseAsset.symbol}/USD`;
        const symbol = metricModeRef.current === 'marketcap' 
          ? `${baseSymbol}_MCAP`
          : `${baseSymbol}_PRICE`;

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
          });
        } else {
          datafeedRef.current.updateBaseAsset(assetPayload);
          datafeedRef.current.setCurrencyMode(effectiveDisplayCurrency === 'USD');
          datafeedRef.current.setMetricMode(metricModeRef.current);
        }

        const currentTheme = themeRef.current ?? 'dark';
        const toolbarBgColor = backgroundColor || (currentTheme === 'light' ? '#ffffff' : '#121319');
        
        const widgetOptions: ChartingLibraryWidgetOptions = {
          datafeed: datafeedRef.current,
          symbol,
          container: ref.current,
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
            backgroundColor: backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#0B0E14'),
            foregroundColor: backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#0B0E14'),
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
          overrides: (() => {
            // Don't use base overrides for embeds - they have hardcoded dark colors
            // Build theme-aware overrides from scratch
            // Use backgroundColor prop if provided, otherwise use theme bgPrimary from store
            const bgColor = backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#0F1016');
            const gridColor = currentTheme === 'light' ? '#E5E7EB' : '#22242D';
            const textColor = currentTheme === 'light' ? '#1F2937' : '#8C8F9D';
            // Use theme bgPrimary for scale background if no backgroundColor prop
            const scaleBgColor = backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#121319');
            const lineColor = currentTheme === 'light' ? '#E5E7EB' : '#2A2E39';
            const upColor = candleUpColorRef.current || '#18C722';
            const downColor = candleDownColorRef.current || (currentTheme === 'light' ? '#EF4444' : '#FFFFFF');
            const upColorFormatted = upColor.startsWith('#') ? upColor : `#${upColor}`;
            const downColorFormatted = downColor.startsWith('#') ? downColor : `#${downColor}`;
            
            // If grid lines are disabled, use transparent color
            const effectiveGridColor = showGridLinesRef.current ? gridColor : 'transparent';
            
            return {
              // Candle style
              'mainSeriesProperties.candleStyle.upColor': upColorFormatted,
              'mainSeriesProperties.candleStyle.downColor': downColorFormatted,
              'mainSeriesProperties.candleStyle.borderUpColor': upColorFormatted,
              'mainSeriesProperties.candleStyle.borderDownColor': downColorFormatted,
              'mainSeriesProperties.candleStyle.wickUpColor': upColorFormatted,
              'mainSeriesProperties.candleStyle.wickDownColor': downColorFormatted,
              'mainSeriesProperties.candleStyle.drawWick': true,
              'mainSeriesProperties.candleStyle.drawBorder': true,
              
              // Pane properties
              'paneProperties.background': bgColor,
              'paneProperties.backgroundType': 'solid',
              'paneProperties.vertGridProperties.color': effectiveGridColor,
              'paneProperties.horzGridProperties.color': effectiveGridColor,
              'paneProperties.crossHairProperties.color': lineColor,
              
              // Legend - control symbol visibility
              'paneProperties.legendProperties.showLegend': showSymbolRef.current,
              'paneProperties.legendProperties.showSeriesTitle': showSymbolRef.current,
              'paneProperties.legendProperties.showSeriesOHLC': showSymbolRef.current,
              'paneProperties.legendProperties.showStudyTitles': showSymbolRef.current,
              'paneProperties.legendProperties.showStudyValues': showSymbolRef.current,
              'paneProperties.legendProperties.showBarChange': showSymbolRef.current,
              
              // Scales
              'scalesProperties.backgroundColor': scaleBgColor,
              'scalesProperties.lineColor': lineColor,
              'scalesProperties.textColor': textColor,
              'scalesProperties.fontSize': 11,
              'scalesProperties.showSeriesLastValue': true,
              'priceScaleProperties.showSeriesLastValue': true,
              
              // Symbol watermark
              'symbolWatermarkProperties.visibility': showSymbolRef.current,
              
              // Time scale
              'timeScale.rightOffset': 5,
              'timeScale.barSpacing': 6,
              'timeScale.borderColor': lineColor,
              'timeScale.visible': true,
              
              volumePaneSize: 'small',
            };
          })(),
          studies_overrides: {
            'volume.volume.color.0': '#18C722',
            'volume.volume.color.1': '#FFFFFF',
            'volume.volume.transparency': 50,
          },
          ...widgetOptionsDefault,
          // Override interval if initialResolution is provided
          interval: initialResolutionRef.current ? (initialResolutionRef.current as ResolutionString) : widgetOptionsDefault.interval,
        };

        console.log('[Chart Debug] Creating TradingView widget with options:', {
          symbol: widgetOptions.symbol,
          theme: widgetOptions.theme,
          containerExists: !!widgetOptions.container,
        });
        const tvWidget = new (Widget as ChartingLibraryWidgetConstructor)(widgetOptions);
        widgetRef.current = tvWidget;
        window.tvWidget = tvWidget;
        console.log('[Chart Debug] Widget created, waiting for onChartReady...');

        tvWidget.onChartReady(async () => {
          console.log('[Chart Debug] onChartReady fired!');
          if (!isMountedRef.current) return;

          try {
            const chart = tvWidget.activeChart();
            chart.getTimeScale().setRightOffset(15);

            const currentTheme = themeRef.current ?? 'dark';
            // Use backgroundColor prop if provided, otherwise use theme bgPrimary from store
            const bgColor = backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#0F1016');
            const gridColor = currentTheme === 'light' ? '#E5E7EB' : '#22242D';
            const textColor = currentTheme === 'light' ? '#1F2937' : '#C8C9D1';
            
            // Build overrides object with all theme-aware properties
            // Use theme bgPrimary for scale background if no backgroundColor prop
            const scaleBgColor = backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#121319');
            const lineColor = currentTheme === 'light' ? '#E5E7EB' : '#2A2E39';
            
            // If grid lines are disabled, use transparent color
            const effectiveGridColor = showGridLinesRef.current ? gridColor : 'transparent';
            
            const overrides: Record<string, string | number | boolean> = {
              'paneProperties.background': bgColor,
              'paneProperties.vertGridProperties.color': effectiveGridColor,
              'paneProperties.horzGridProperties.color': effectiveGridColor,
              'paneProperties.backgroundType': 'solid',
              'paneProperties.crossHairProperties.color': lineColor,
              'paneProperties.legendProperties.showLegend': showSymbolRef.current,
              'paneProperties.legendProperties.showSeriesTitle': showSymbolRef.current,
              'paneProperties.legendProperties.showSeriesOHLC': showSymbolRef.current,
              'paneProperties.legendProperties.showStudyTitles': showSymbolRef.current,
              'paneProperties.legendProperties.showStudyValues': showSymbolRef.current,
              'paneProperties.legendProperties.showBarChange': showSymbolRef.current,
              'symbolWatermarkProperties.visibility': showSymbolRef.current,
              'scalesProperties.backgroundColor': scaleBgColor,
              'scalesProperties.lineColor': lineColor,
              'scalesProperties.textColor': textColor,
              'timeScale.borderColor': lineColor,
            };

            // Apply candlestick colors if provided
            const upColor = candleUpColorRef.current || '#18C722';
            const downColor = candleDownColorRef.current || (currentTheme === 'light' ? '#EF4444' : '#FFFFFF');
            
            // Ensure colors have # prefix
            const upColorFormatted = upColor.startsWith('#') ? upColor : `#${upColor}`;
            const downColorFormatted = downColor.startsWith('#') ? downColor : `#${downColor}`;
            
            overrides['mainSeriesProperties.candleStyle.upColor'] = upColorFormatted;
            overrides['mainSeriesProperties.candleStyle.downColor'] = downColorFormatted;
            overrides['mainSeriesProperties.candleStyle.borderUpColor'] = upColorFormatted;
            overrides['mainSeriesProperties.candleStyle.borderDownColor'] = downColorFormatted;
            overrides['mainSeriesProperties.candleStyle.wickUpColor'] = upColorFormatted;
            overrides['mainSeriesProperties.candleStyle.wickDownColor'] = downColorFormatted;

            tvWidget.applyOverrides(overrides);

            // Wait for header to be ready before creating buttons
            if (hasSupply) {
              tvWidget.headerReady().then(() => {
                try {
                  const activeColor = '#18C722';
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
                  console.error('[Chart Debug] Error creating toggle button:', error);
                }
              }).catch((error) => {
                console.error('[Chart Debug] Error waiting for header ready:', error);
              });
            }

            // Set initial resolution if provided
            if (initialResolutionRef.current) {
              try {
                chart.setResolution(initialResolutionRef.current as ResolutionString, () => {
                  setTimeframe(initialResolutionRef.current!);
                });
              } catch (error) {
                console.error('Error setting initial resolution:', error);
              }
            }

            await loadSavedTools(chart);
            setupChangeListeners(tvWidget);
            console.log('[Chart Debug] Setting chart as ready and loaded');
            setIsChartReady();
            chartLoaded();
          } catch (error) {
            console.error('[Chart Debug] Error in chart ready callback:', error);
          } finally {
            isInitializingRef.current = false;
          }
        });
      } catch (error) {
        console.error('[Chart Debug] Error initializing TradingView:', error);
        isInitializingRef.current = false;
      }
    };

    initChart();

    return () => {
      isMountedRef.current = false;
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (e) {
          console.error('Error removing widget:', e);
        } finally {
          widgetRef.current = null;
        }
      }
      window.tvWidget = null;
      isInitializingRef.current = false;
      currentSymbolRef.current = '';
    };
  }, [baseAsset.address, isPair]); // Only re-initialize if baseAsset or isPair changes

  /**
   * Handle baseAsset/mode changes
   */
  useEffect(() => {
    if (!widgetRef.current || !baseAsset?.address) return;

    const modeChanged = currentModeRef.current.isPair !== isPair;
    const addressChanged = currentModeRef.current.address !== baseAsset.address;

    if (!modeChanged && !addressChanged) return;

    const newSymbol = isPair
      ? `${baseAsset.base?.symbol ?? baseAsset.symbol}/USD`
      : `${baseAsset.symbol}/USD`;

    const assetPayload = isPair
      ? {
          address: baseAsset.address, // PAIR address
          chainId: baseAsset.blockchain,
          isPair: true,
          priceUSD: baseAsset.priceUSD,
          symbol: baseAsset.symbol,
          base: baseAsset.base,
          quote: baseAsset.quote,
        }
      : {
          asset: baseAsset.address, // TOKEN address
          chainId: baseAsset.blockchain,
          isPair: false,
          priceUSD: baseAsset.priceUSD,
          symbol: baseAsset.symbol,
        };

    if (datafeedRef.current) {
      datafeedRef.current.updateBaseAsset(assetPayload);
    }

    widgetRef.current.onChartReady(() => {
      widgetRef.current?.activeChart()?.setSymbol(newSymbol, () => {
        currentSymbolRef.current = newSymbol;
        currentModeRef.current = { isPair, address: baseAsset.address };
      });
    });
  }, [baseAsset.address, isPair, baseAsset.symbol, baseAsset.blockchain]);

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
          console.error('Error refreshing marks:', error);
        }
      });
    }
  }, [deployer, effectiveUserAddress]);

  /**
   * Update theme and chart type when they change
   */
  useEffect(() => {
    if (!widgetRef.current || !isMountedRef.current) return;

    widgetRef.current.onChartReady(() => {
      try {
        const chart = widgetRef.current?.activeChart();
        if (!chart) return;

        const currentTheme = themeRef.current ?? 'dark';
        // Use backgroundColor prop if provided, otherwise use theme bgPrimary from store
        const bgColor = backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#0F1016');
        const gridColor = currentTheme === 'light' ? '#E5E7EB' : '#22242D';
        const textColor = currentTheme === 'light' ? '#1F2937' : '#C8C9D1';

        // Update theme
        widgetRef.current?.changeTheme(currentTheme === 'light' ? 'Light' : 'Dark');

        // Update candlestick colors
        const upColor = candleUpColorRef.current || '#18C722';
        const downColor = candleDownColorRef.current || (currentTheme === 'light' ? '#EF4444' : '#FFFFFF');

        // Ensure colors have # prefix
        const upColorFormatted = upColor.startsWith('#') ? upColor : `#${upColor}`;
        const downColorFormatted = downColor.startsWith('#') ? downColor : `#${downColor}`;

        // Use theme bgPrimary for scale background if no backgroundColor prop
        const scaleBgColor = backgroundColor || themeBgColor || (currentTheme === 'light' ? '#ffffff' : '#121319');
        const lineColor = currentTheme === 'light' ? '#E5E7EB' : '#2A2E39';
        
        // If grid lines are disabled, use transparent color
        const effectiveGridColor = showGridLinesRef.current ? gridColor : 'transparent';
        
        const overrides: Record<string, string | number | boolean> = {
          'paneProperties.background': bgColor,
          'paneProperties.vertGridProperties.color': effectiveGridColor,
          'paneProperties.horzGridProperties.color': effectiveGridColor,
          'paneProperties.crossHairProperties.color': lineColor,
          'paneProperties.legendProperties.showLegend': showSymbolRef.current,
          'paneProperties.legendProperties.showSeriesTitle': showSymbolRef.current,
          'paneProperties.legendProperties.showSeriesOHLC': showSymbolRef.current,
          'paneProperties.legendProperties.showStudyTitles': showSymbolRef.current,
          'paneProperties.legendProperties.showStudyValues': showSymbolRef.current,
          'paneProperties.legendProperties.showBarChange': showSymbolRef.current,
          'symbolWatermarkProperties.visibility': showSymbolRef.current,
          'scalesProperties.backgroundColor': scaleBgColor,
          'scalesProperties.lineColor': lineColor,
          'scalesProperties.textColor': textColor,
          'timeScale.borderColor': lineColor,
          'mainSeriesProperties.candleStyle.upColor': upColorFormatted,
          'mainSeriesProperties.candleStyle.downColor': downColorFormatted,
          'mainSeriesProperties.candleStyle.borderUpColor': upColorFormatted,
          'mainSeriesProperties.candleStyle.borderDownColor': downColorFormatted,
          'mainSeriesProperties.candleStyle.wickUpColor': upColorFormatted,
          'mainSeriesProperties.candleStyle.wickDownColor': downColorFormatted,
        };

        widgetRef.current?.applyOverrides(overrides);
      } catch (error) {
        console.error('Error updating theme/colors:', error);
      }
    });
  }, [theme, candleUpColor, candleDownColor, backgroundColor, themeBgColor, showSymbol, showGridLines]);

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
          className={cn(
            'absolute z-10 w-full h-full transition-opacity duration-300 ease-in-out',
            !explicitBgColor && 'bg-bgPrimary',
            isChartLoading ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          style={explicitBgColor ? { backgroundColor: explicitBgColor } : undefined}
        >
          <div className="w-full h-full flex items-center justify-center canvas-chart">
            <Spinner extraCss="h-[50px] text-success" />
          </div>
        </div>
        <div
          className={cn(
            'flex flex-col rounded-md h-full w-full items-center justify-center relative transition-opacity duration-300 pointer-events-auto',
            !explicitBgColor && 'bg-bgPrimary',
            isChartLoading ? 'opacity-0' : 'opacity-100',
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