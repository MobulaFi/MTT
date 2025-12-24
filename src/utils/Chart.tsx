import type {
  Bar,
  ChartingLibraryWidgetOptions,
  HistoryMetadata,
  IBasicDataFeed,
  LanguageCode,
  LibrarySymbolInfo,
  ResolutionString,
  SearchSymbolResultItem,
  Timezone,
} from '../../public/static/charting_library/charting_library';

export enum TRADING_VIEW_DEFAULTS {
  LIBRARY_PATH = '/static/charting_library/',
  CHARTS_STORAGE_URL = 'https://saveload.tradingview.com',
  CHARTS_STORAGE_API_VERSION = '1.1',
  CLIENT_ID = 'tradingview.com',
  USER_ID = 'public_user_id',
  CONTAINER_ID_SPOT = 'tv_chart_container',
  INTERVAL = '60',
}

export interface TradingViewChartProps {
  mobile?: boolean;
  params: any;
  className?: string;
}

export interface ChartElement {
  id: string;
  name: string;
  [key: string]: any;
}

export interface ChartState {
  studies: ChartElement[];
  interval: string;
}

export interface CustomDatafeed extends IBasicDataFeed {
  onReady: (callback: (configuration: { supported_resolutions: ResolutionString[] }) => void) => void;
  resolveSymbol: (
    symbolName: string,
    onResolve: (symbolInfo: LibrarySymbolInfo) => void,
    onError: (reason: string) => void,
  ) => void;
  getBars: (
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: { from: number; to: number; firstDataRequest: boolean },
    onResult: (bars: Bar[], meta: HistoryMetadata) => void,
    onError: (reason: string) => void,
  ) => void;
  searchSymbols: (
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: (result: SearchSymbolResultItem[]) => void,
  ) => void;
  subscribeBars: (
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onRealtimeCallback: (bar: Bar) => void,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void,
  ) => void;
  unsubscribeBars: (subscriberUID: string) => void;
}

export interface WidgetOptions extends ChartingLibraryWidgetOptions {
  symbol: string;
  interval: ResolutionString;
  datafeed: CustomDatafeed;
  locale: LanguageCode;
  enabled_features: string[];
  disabled_features: string[];
  fullscreen: boolean;
  autosize: boolean;
  theme: 'Light' | 'Dark';
  loading_screen: { backgroundColor: string; foregroundColor: string };
  timezone: 'exchange' | Timezone;
}

export type ProcessedDrawing = {
  id: string;
  name: string;
  properties: any;
  points: { price: number; time: number }[];
  symbol: string;
};
