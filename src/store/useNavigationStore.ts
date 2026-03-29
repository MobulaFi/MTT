import { create } from 'zustand';
import { prefetchAllTokenData, prefetchAllPairData, prefetchOhlcvData, prefetchTokenDetails, prefetchHolders, prefetchTopTraders, prefetchMarkets } from '@/lib/prefetch';
import { normalizeResolution } from '@/utils/normalizeResolution';
import { useTokenStore } from '@/features/token/store/useTokenStore';
import { usePairStore } from '@/features/pair/store/pairStore';
import { usePairTradeStore } from '@/features/pair/store/usePairTradeStore';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import { useTopTradersStore } from '@/store/useTopTraderStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { useWalletAnalysisStore } from '@/store/useWalletAnalysisStore';
import { useChartStore } from '@/store/useChartStore';

type SpaView =
  | { type: 'token'; address: string; blockchain: string }
  | { type: 'pair'; address: string; blockchain: string }
  | { type: 'page'; path: string };

/** Known list pages that AppShell can render without Next.js routing */
export const SPA_PAGES = ['/trendings', '/surge', '/pulse', '/portfolio', '/embed', '/x-tracker'] as const;
export type SpaPagePath = (typeof SPA_PAGES)[number];

interface NavigationStore {
  /** When non-null, the SPA shell renders this view instead of Next.js children */
  view: SpaView | null;
  /** Navigate to a token page instantly (no router.push).
   *  Pass optional `initialData` (partial token fields from list pages)
   *  to hydrate the store immediately — avoids waiting for the REST call. */
  navigateToToken: (address: string, blockchain: string, initialData?: Record<string, unknown>) => void;
  /** Navigate to a pair page instantly (no router.push).
   *  Pass optional `initialData` (partial pair fields from list pages)
   *  to hydrate the store immediately. */
  navigateToPair: (address: string, blockchain: string, initialData?: Record<string, unknown>) => void;
  /** Navigate to a list page instantly (/trendings, /surge, /pulse, /portfolio) */
  navigateToPage: (path: SpaPagePath) => void;
  /** Clear the SPA view (show the underlying Next.js route) */
  clearView: () => void;
}

/** Reset all per-token/per-pair stores synchronously before mounting new page */
function resetEntityStores() {
  useTokenStore.getState().reset();
  usePairStore.getState().reset();
  usePairTradeStore.getState().reset();
  usePairHoldersStore.getState().clearHolders();
  useTopTradersStore.getState().reset();
  useTradingDataStore.getState().reset();
  useWalletAnalysisStore.getState().reset();
  useChartStore.getState().reset();
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  view: null,

  navigateToToken: (address: string, blockchain: string, initialData?: Record<string, unknown>) => {
    resetEntityStores();
    // Hydrate the token store immediately with whatever data the caller already has
    // (e.g. from Pulse/Trending/Surge list items). The REST call + WebSocket will
    // refine/replace this data once they resolve.
    if (initialData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useTokenStore.getState().setToken(initialData as any);
      // Hydrate store immediately with list-page data for instant display,
      // but ALWAYS fetch full token details — Pulse/list data may have different
      // field names (e.g. marketCap vs marketCapUSD) or missing fields (socials, FDV).
      prefetchTokenDetails(address, blockchain);
      prefetchHolders(address, blockchain);
      prefetchTopTraders(address, blockchain);
      prefetchMarkets(address, blockchain);
    } else {
      prefetchAllTokenData(address, blockchain);
    }
    // Use the persisted timeframe for the OHLCV prefetch so it matches the chart's initial resolution
    const period = normalizeResolution(useChartStore.getState().timeframe || '1S');
    prefetchOhlcvData({ isPair: false, address, chainId: blockchain, period });
    set({ view: { type: 'token', address, blockchain } });
    window.scrollTo(0, 0);
    window.history.pushState(
      { spa: true, type: 'token', address, blockchain },
      '',
      `/token/${blockchain}/${address}`,
    );
  },

  navigateToPair: (address: string, blockchain: string, initialData?: Record<string, unknown>) => {
    resetEntityStores();
    // Hydrate the pair store immediately with whatever data the caller already has
    if (initialData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      usePairStore.getState().setData(initialData as any);
      // Store has full pair data from list page — only prefetch supplementary data.
      // Extract base token address from the initial data for holders/traders/markets.
      const baseAddress = (initialData as Record<string, unknown>)?.baseAddress as string | undefined
        || ((initialData as Record<string, unknown>)?.base as Record<string, unknown>)?.address as string | undefined;
      if (baseAddress) {
        prefetchHolders(baseAddress, blockchain);
        prefetchTopTraders(baseAddress, blockchain);
        prefetchMarkets(baseAddress, blockchain);
      }
    } else {
      prefetchAllPairData(address, blockchain);
    }
    const pairPeriod = normalizeResolution(useChartStore.getState().timeframe || '1S');
    prefetchOhlcvData({ isPair: true, address, chainId: blockchain, period: pairPeriod });
    set({ view: { type: 'pair', address, blockchain } });
    window.scrollTo(0, 0);
    window.history.pushState(
      { spa: true, type: 'pair', address, blockchain },
      '',
      `/pair/${blockchain}/${address}`,
    );
  },

  navigateToPage: (path: SpaPagePath) => {
    set({ view: { type: 'page', path } });
    window.scrollTo(0, 0);
    window.history.pushState({ spa: true, type: 'page', path }, '', path);
  },

  clearView: () => set({ view: null }),
}));
