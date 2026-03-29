'use client';

import { type ReactNode, useEffect, lazy, Suspense } from 'react';
import { useNavigationStore } from '@/store/useNavigationStore';
import { prefetchAllTokenData, prefetchAllPairData, prefetchOhlcvData } from '@/lib/prefetch';
import { normalizeResolution } from '@/utils/normalizeResolution';
import { useTokenStore } from '@/features/token/store/useTokenStore';
import { usePairStore } from '@/features/pair/store/pairStore';
import { usePairTradeStore } from '@/features/pair/store/usePairTradeStore';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import { useTopTradersStore } from '@/store/useTopTraderStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { useWalletAnalysisStore } from '@/store/useWalletAnalysisStore';
import { useChartStore } from '@/store/useChartStore';

// Preload page modules at module scope so they're ready when the user clicks.
const preload = typeof window !== 'undefined';

// Defer TradingView warmup well past initial page load to avoid freezing
// list pages (trending, surge, pulse) that don't need a chart at all.
// The warmup downloads ~500KB+ and creates a hidden widget iframe.
if (preload) {
  const startWarmup = () => {
    import('@/components/charts').then(({ warmupTradingView }) => {
      warmupTradingView();
    }).catch(() => {});
  };
  // Wait 10s — by then the user has interacted with the landing page and
  // the browser is much more likely to have a free main-thread window.
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(startWarmup, { timeout: 10000 });
  } else {
    setTimeout(startWarmup, 8000);
  }
}

const assetPageP = preload ? import('@/features/asset/components/AssetPageClient') : null;
const trendingPageP = preload ? import('@/features/trending/components/TrendingPageClient') : null;
const surgePageP = preload ? import('@/features/surge/components/SurgePageClient') : null;
const pulsePageP = preload ? import('@/features/pulse/components/PulsePageClient') : null;
const portfolioPageP = preload ? import('@/features/portfolio/components/PortfolioPageClient') : null;

const AssetPageClient = lazy(() => assetPageP || import('@/features/asset/components/AssetPageClient'));
const TrendingPageClient = lazy(() => trendingPageP || import('@/features/trending/components/TrendingPageClient'));
const SurgePageClient = lazy(() => surgePageP || import('@/features/surge/components/SurgePageClient'));
const PulsePageClient = lazy(() => pulsePageP || import('@/features/pulse/components/PulsePageClient'));
const PortfolioPageClient = lazy(() => portfolioPageP || import('@/features/portfolio/components/PortfolioPageClient'));

// Embed & X-Tracker — lazy-loaded on demand (no preload/prefetch)
const EmbedPage = lazy(() => import('@/app/embed/page'));
const XTrackerPage = lazy(() => import('@/app/x-tracker/page'));

/** Reset all per-token/per-pair stores */
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

export default function AppShell({ children }: { children: ReactNode }) {
  const view = useNavigationStore((s) => s.view);
  const clearView = useNavigationStore((s) => s.clearView);

  // Handle browser back/forward — reset stores when navigating to different token/pair
  useEffect(() => {
    const handlePopstate = (event: PopStateEvent) => {
      if (event.state?.spa) {
        const s = event.state;
        if (s.type === 'token' || s.type === 'pair') {
          resetEntityStores();
          // Prefetch data for the back/forward target so it loads fast
          const period = normalizeResolution(useChartStore.getState().timeframe || '1S');
          if (s.type === 'token') {
            prefetchAllTokenData(s.address, s.blockchain);
            prefetchOhlcvData({ isPair: false, address: s.address, chainId: s.blockchain, period });
          } else {
            prefetchAllPairData(s.address, s.blockchain);
            prefetchOhlcvData({ isPair: true, address: s.address, chainId: s.blockchain, period });
          }
        }
        if (s.type === 'page') {
          useNavigationStore.setState({ view: { type: 'page', path: s.path } });
        } else {
          useNavigationStore.setState({
            view: { type: s.type, address: s.address, blockchain: s.blockchain },
          });
        }
      } else {
        resetEntityStores();
        clearView();
      }
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [clearView]);

  const renderView = () => {
    if (!view) return null;

    if (view.type === 'token' || view.type === 'pair') {
      return (
        <AssetPageClient
          key={`${view.blockchain}-${view.address}`}
          address={view.address}
          blockchain={view.blockchain}
          isPair={view.type === 'pair'}
        />
      );
    }
    // List pages
    switch (view.path) {
      case '/trendings': return <TrendingPageClient key="trendings" />;
      case '/surge': return <SurgePageClient key="surge" />;
      case '/pulse': return <PulsePageClient key="pulse" />;
      case '/portfolio': return <PortfolioPageClient key="portfolio" />;
      case '/embed': return <EmbedPage key="embed" />;
      case '/x-tracker': return <XTrackerPage key="x-tracker" />;
      default: return null;
    }
  };

  return (
    <>
      {/* Original Next.js route — unmounted when SPA view is active.
          Keeping it mounted (display:none) caused the hidden page's chart to
          react to store changes and steal the persistent TradingView widget
          from the active SPA page → crash. Unmounting is the safe path. */}
      {!view && (
        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      )}

      {/* SPA view — rendered instantly without Next.js router */}
      {view && (
        <div className="flex-1 min-h-0 flex flex-col">
          <Suspense fallback={null}>
            {renderView()}
          </Suspense>
        </div>
      )}
    </>
  );
}
