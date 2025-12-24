'use client';

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
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
import { Datafeed } from './datafeed';
import { overrides } from './theme';
import { useRenderCounter } from '@/utils/useRenderCounter';

interface TradingViewChartProps {
  baseAsset: {
    address: string;
    blockchain: string;
    symbol?: string;
    priceUSD?: number;
    base?: { symbol?: string };
    quote?: { symbol?: string };
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
}: TradingViewChartProps) => {
  // Render counter for diagnostics
  useRenderCounter('TradingViewChart');

  const ref = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<IChartingLibraryWidget | null>(null);
  const datafeedRef = useRef<any>(null);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);
  const currentSymbolRef = useRef<string>('');
  const currentModeRef = useRef<{ isPair: boolean; address: string }>({
    isPair,
    address: baseAsset.address,
  });
  const initialResolutionRef = useRef<string | undefined>(initialResolution);
  // Determine theme from backgroundColor if theme not provided
  const resolvedTheme = theme || (backgroundColor && (backgroundColor.toLowerCase() === '#ffffff' || backgroundColor.toLowerCase() === '#fff' || 
    (backgroundColor.startsWith('#') && parseInt(backgroundColor.slice(1), 16) > 0xCCCCCC)) ? 'light' : 'dark');
  const themeRef = useRef<'light' | 'dark'>(resolvedTheme);
  const candleUpColorRef = useRef<string | undefined>(candleUpColor);
  const candleDownColorRef = useRef<string | undefined>(candleDownColor);

  useEffect(() => {
    initialResolutionRef.current = initialResolution;
    const newTheme = theme || (backgroundColor && (backgroundColor.toLowerCase() === '#ffffff' || backgroundColor.toLowerCase() === '#fff' || 
      (backgroundColor.startsWith('#') && parseInt(backgroundColor.slice(1), 16) > 0xCCCCCC)) ? 'light' : 'dark');
    themeRef.current = newTheme;
    candleUpColorRef.current = candleUpColor;
    candleDownColorRef.current = candleDownColor;
  }, [initialResolution, theme, backgroundColor, candleUpColor, candleDownColor]);

  const { loadSavedTools, saveChartTools } = useChartTools();
  // Use granular selectors to prevent unnecessary re-renders
  const isChartLoading = useChartStore((s) => s.isChartLoading);
  const setIsChartReady = useChartStore((s) => s.setIsChartReady);
  // Get theme background color from store
  const themeBgColor = useThemeStore((s) => s.colors.bgPrimary);
  const setTimeframe = useChartStore((s) => s.setTimeframe);
  const chartLoaded = useChartStore((s) => s.chartLoaded);

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

    if (!baseAsset?.address || !ref.current) {
      console.warn('Invalid baseAsset or ref not available');
      return;
    }

    if (isInitializingRef.current || widgetRef.current) return;
    isInitializingRef.current = true;

    const initChart = async () => {
      try {
        const { widget: Widget } = await import('../../../public/static/charting_library/');
        if (!isMountedRef.current || !ref.current) {
          isInitializingRef.current = false;
          return;
        }

        // Build symbol for display
        const symbol = isPair
          ? `${baseAsset.base?.symbol ?? baseAsset.symbol}/USD`
          : `${baseAsset.symbol}/USD`;

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
            }
          : {
              asset: baseAsset.address, // TOKEN address
              chainId: baseAsset.blockchain,
              priceUSD: baseAsset.priceUSD,
              isPair: false,
              symbol: baseAsset.symbol,
            };

        // Initialize datafeed
        if (!datafeedRef.current) {
          datafeedRef.current = Datafeed(assetPayload, isUsd);
        } else {
          datafeedRef.current.updateBaseAsset(assetPayload);
        }

        const currentTheme = themeRef.current ?? 'dark';
        
        const widgetOptions: ChartingLibraryWidgetOptions = {
          datafeed: datafeedRef.current,
          symbol,
          container: ref.current,
          locale: 'en',
          fullscreen: false,
          autosize: true,
          theme: currentTheme === 'light' ? 'Light' : 'Dark',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone as Timezone,
          custom_css_url,
          disabled_features: [...DISABLED_FEATURES, 'create_volume_indicator_by_default'],
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
              'paneProperties.vertGridProperties.color': gridColor,
              'paneProperties.horzGridProperties.color': gridColor,
              'paneProperties.crossHairProperties.color': lineColor,
              
              // Legend
              'paneProperties.legendProperties.showLegend': true,
              'paneProperties.legendProperties.showStudyTitles': true,
              'paneProperties.legendProperties.showSeriesTitle': true,
              'paneProperties.legendProperties.showStudyValues': true,
              
              // Scales
              'scalesProperties.backgroundColor': scaleBgColor,
              'scalesProperties.lineColor': lineColor,
              'scalesProperties.textColor': textColor,
              'scalesProperties.fontSize': 11,
              'scalesProperties.showSeriesLastValue': true,
              'priceScaleProperties.showSeriesLastValue': true,
              
              // Symbol watermark
              'symbolWatermarkProperties.visibility': false,
              
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

        const tvWidget = new (Widget as ChartingLibraryWidgetConstructor)(widgetOptions);
        widgetRef.current = tvWidget;
        window.tvWidget = tvWidget;

        tvWidget.onChartReady(async () => {
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
            
            const overrides: any = {
              'paneProperties.background': bgColor,
              'paneProperties.vertGridProperties.color': gridColor,
              'paneProperties.horzGridProperties.color': gridColor,
              'paneProperties.backgroundType': 'solid',
              'paneProperties.crossHairProperties.color': lineColor,
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
            setIsChartReady();
            chartLoaded();
          } catch (error) {
            console.error('Error in chart ready callback:', error);
          } finally {
            isInitializingRef.current = false;
          }
        });
      } catch (error) {
        console.error('Error initializing TradingView:', error);
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
        
        const overrides: any = {
          'paneProperties.background': bgColor,
          'paneProperties.vertGridProperties.color': gridColor,
          'paneProperties.horzGridProperties.color': gridColor,
          'paneProperties.crossHairProperties.color': lineColor,
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
  }, [theme, candleUpColor, candleDownColor, backgroundColor, themeBgColor]);

  // Use CSS variable for consistent background - it's already set by the head script or CSS defaults
  // Only use explicit backgroundColor prop if provided (for embeds with custom colors)
  const explicitBgColor = backgroundColor || (theme === 'light' ? '#ffffff' : undefined);

  return (
    <div className="h-full">
      <div 
        className={cn("relative h-full", !explicitBgColor && "bg-bgPrimary")}
        style={explicitBgColor ? { backgroundColor: explicitBgColor } : undefined}
      >
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