'use client';

import { useSurgeStore, type SurgeToken } from '@/features/surge/store/useSurgeStore';
import { useTrendingStore, type TrendingToken } from '@/features/trending/store/useTrendingStore';
import usePulseDataStore, { type PulseToken, type ViewName } from '@/features/pulse/store/usePulseDataStore';
import { usePulseFilterStore } from '@/features/pulse/store/usePulseModalFilterStore';
import { prefetchTokenFilters } from '@/lib/prefetch';

function buildPulseFilters(section: { protocols: string[]; chainIds: string[] }) {
  const filters: Record<string, unknown> = {};
  if (section.protocols.length > 0) filters.source = { in: section.protocols };
  if (section.chainIds.length > 0) filters.chainId = { in: section.chainIds };
  return Object.keys(filters).length > 0 ? filters : undefined;
}

function buildSurgePayload() {
  const state = useSurgeStore.getState();
  return {
    mode: 'token',
    views: {
      [state.sortBy]: {
        model: state.sortBy,
        limit: 10,
        ohlcv: true,
        ohlcvTimeframe: '1s',
        ...(state.selectedChainIds.length > 0 && { filters: { chainId: { in: state.selectedChainIds } } }),
      },
    },
  };
}

function buildTrendingPayload() {
  const state = useTrendingStore.getState();
  const filterObj: Record<string, unknown> = {};
  if (state.selectedChainIds.length > 0) filterObj.chainId = { in: state.selectedChainIds };
  if (state.selectedProtocols.length > 0) filterObj.source = { in: state.selectedProtocols };
  for (const f of state.filters) {
    if (f.min !== undefined || f.max !== undefined) {
      const op: Record<string, number> = {};
      if (f.min !== undefined) op.gte = f.min;
      if (f.max !== undefined) op.lte = f.max;
      filterObj[f.field] = op;
    }
  }
  return {
    mode: 'token',
    views: {
      trending: {
        model: 'trending',
        sortBy: state.backendSortBy,
        sortOrder: state.backendSortOrder,
        limit: 50,
        ...(Object.keys(filterObj).length > 0 && { filters: filterObj }),
      },
    },
  };
}

function buildPulsePayload() {
  const { appliedSections } = usePulseFilterStore.getState();
  const { 'new-pairs': newS, 'final-stretch': bondingS, migrated: bondedS } = appliedSections;
  return {
    mode: 'token',
    views: {
      new: { model: 'new', limit: 50, ...(buildPulseFilters(newS) && { filters: buildPulseFilters(newS) }) },
      bonding: { model: 'bonding', limit: 50, ...(buildPulseFilters(bondingS) && { filters: buildPulseFilters(bondingS) }) },
      bonded: { model: 'bonded', limit: 50, ...(buildPulseFilters(bondedS) && { filters: buildPulseFilters(bondedS) }) },
    },
  };
}

function populateSurgeStore(data: Record<string, unknown>) {
  const surgeState = useSurgeStore.getState();
  const viewData = (data as Record<string, unknown>).views as Record<string, { data: Record<string, unknown>[] }> | undefined;
  const items = viewData?.[surgeState.sortBy]?.data;
  if (items) {
    const tokens: SurgeToken[] = items.map((t) => {
      const token = t.token && typeof t.token === 'object' ? { ...t, ...(t.token as Record<string, unknown>) } : t;
      return token as SurgeToken;
    });
    surgeState.setTokens(tokens);
  }
}

function populateTrendingStore(data: Record<string, unknown>) {
  const viewData = (data as Record<string, unknown>).views as Record<string, { data: Record<string, unknown>[] }> | undefined;
  const items = viewData?.trending?.data;
  if (items) {
    const tokens: TrendingToken[] = items.map((t) => {
      const merged = t.token && typeof t.token === 'object' ? { ...t, ...(t.token as Record<string, unknown>) } : { ...t };
      if (!merged.name && merged.tokenName) merged.name = merged.tokenName;
      if (!merged.symbol && merged.tokenSymbol) merged.symbol = merged.tokenSymbol;
      if (!merged.logo && merged.tokenLogo) merged.logo = merged.tokenLogo;
      return merged as TrendingToken;
    });
    useTrendingStore.getState().setTokens(tokens);
  }
}

function populatePulseStore(data: Record<string, unknown>) {
  const viewData = (data as Record<string, unknown>).views as Record<string, { data: PulseToken[] }> | undefined;
  if (viewData) {
    const validViews: ViewName[] = ['new', 'bonding', 'bonded'];
    const store = usePulseDataStore.getState();
    for (const [viewName, view] of Object.entries(viewData)) {
      if (validViews.includes(viewName as ViewName) && view?.data) {
        // Batch: single set() call per view instead of per-token mergeToken
        // (avoids 50× immer draft + persist write + devtools per view)
        store.setTokens(viewName as ViewName, view.data);
      }
    }
  }
}

// Module-level flag: fire REST prefetches once, deferred to idle
let preloadStarted = false;

function startDeferredPreload() {
  if (preloadStarted) return;
  preloadStarted = true;

  // Stagger fetches so they don't all compete for the same network slot.
  // Trending first (most likely landing page), then surge, then pulse.
  const fetchTrending = () =>
    prefetchTokenFilters(buildTrendingPayload()).then((data) => {
      if (data) populateTrendingStore(data as Record<string, unknown>);
    });
  const fetchSurge = () =>
    prefetchTokenFilters(buildSurgePayload()).then((data) => {
      if (data) populateSurgeStore(data as Record<string, unknown>);
    });
  const fetchPulse = () =>
    prefetchTokenFilters(buildPulsePayload()).then((data) => {
      if (data) populatePulseStore(data as Record<string, unknown>);
    });

  // Fire all three in parallel — no reason to wait for trending before starting the others
  Promise.all([fetchTrending(), fetchSurge(), fetchPulse()]);
}

/**
 * Preloads REST data for list pages (Trending, Surge, Pulse).
 * Deferred to browser idle to avoid blocking initial page render.
 */
export default function DataPreloader() {
  if (!preloadStarted && typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(startDeferredPreload, { timeout: 5000 });
    } else {
      setTimeout(startDeferredPreload, 3000);
    }
  }
  return null;
}
