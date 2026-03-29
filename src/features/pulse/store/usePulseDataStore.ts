'use client';

import { create } from 'zustand';

export type ViewName = 'new' | 'bonding' | 'bonded';

export interface PulseToken {
  token?: {
    address: string;
    chainId?: string;
  };
  address?: string;
  chainId?: string;
  [key: string]: unknown;
}

export interface SectionDataState {
  tokens: PulseToken[];
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  isVisible: boolean;
  searchQuery: string;
}

export interface PulseDataStoreState {
  // State
  sections: Record<ViewName, SectionDataState>;

  // Actions
  setTokens(view: ViewName, tokens: PulseToken[]): void;
  setLoading(view: ViewName, loading: boolean): void;
  setError(view: ViewName, error: string | null): void;
  mergeToken(view: ViewName, token: PulseToken): void;
  mergeTokensBatch(updates: Array<{ view: ViewName; token: PulseToken }>): void;
  clearView(view: ViewName): void;
  setVisible(view: ViewName, visible: boolean): void;
  setSearchQuery(view: ViewName, query: string): void;
  getFilteredTokens(view: ViewName): PulseToken[];
}

const TOKEN_LIMIT = 50;

/**
 * Flatten nested token structure to top-level.
 * Top-level fields take priority over nested ones (updates are top-level).
 */
function normalizeToken(token: PulseToken): PulseToken {
  if (token.token && typeof token.token === 'object') {
    const { token: nested, ...rest } = token;
    return { ...nested, ...rest } as PulseToken;
  }
  return token;
}

function getTokenKey(token: PulseToken): string {
  const flatToken = token?.token?.address ? token.token : token;
  return `${flatToken?.address || ''}_${flatToken?.chainId || ''}`;
}

function getTokenSortValue(token: PulseToken, view: ViewName): number {
  const flatToken = token?.token?.address ? token.token : token;

  if (view === 'bonding') {
    const td = flatToken as { bondingPercentage?: number; bonding_percentage?: number };
    return Number(td.bondingPercentage ?? td.bonding_percentage ?? 0);
  }

  const td = flatToken as { bonded_at?: string; created_at?: string; createdAt?: string };
  const timestampStr = view === 'bonded'
    ? (td.bonded_at || td.created_at || td.createdAt)
    : (td.created_at || td.createdAt);

  if (!timestampStr) return 0;
  const timestamp = new Date(timestampStr).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Binary search for correct insertion index (descending order).
 */
function findInsertionIndex(tokens: PulseToken[], sortValue: number, view: ViewName): number {
  let left = 0;
  let right = tokens.length;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (getTokenSortValue(tokens[mid], view) < sortValue) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }
  return left;
}

function filterTokensBySearch(tokens: PulseToken[], query: string): PulseToken[] {
  if (!query.trim()) return tokens;
  const lq = query.toLowerCase();
  return tokens.filter((t) => {
    const ft = t?.token?.address ? t.token : t;
    const name = (ft && 'name' in ft && typeof ft.name === 'string' ? ft.name : '').toLowerCase();
    const symbol = (ft && 'symbol' in ft && typeof ft.symbol === 'string' ? ft.symbol : '').toLowerCase();
    const address = (ft?.address || '').toLowerCase();
    return name.includes(lq) || symbol.includes(lq) || address.includes(lq);
  });
}

const mkSection = (): SectionDataState => ({
  tokens: [],
  loading: false,
  error: null,
  lastUpdate: 0,
  isVisible: true,
  searchQuery: '',
});

/** Helper: shallow-clone sections with one view patched */
function patchView(
  sections: Record<ViewName, SectionDataState>,
  view: ViewName,
  patch: Partial<SectionDataState>,
): Record<ViewName, SectionDataState> {
  return { ...sections, [view]: { ...sections[view], ...patch } };
}

/**
 * usePulseDataStore
 *
 * Stripped of `persist` (no localStorage serialization on every WS message),
 * `immer` (no Proxy tree per set()), and `devtools` for minimal overhead
 * on high-frequency real-time updates.
 *
 * Key optimisation: `mergeTokensBatch` processes N token updates in a single
 * `set()` call, instead of N individual state transitions.
 */
export const usePulseDataStore = create<PulseDataStoreState>()((set, get) => ({
  sections: {
    new: mkSection(),
    bonding: mkSection(),
    bonded: mkSection(),
  },

  setTokens(view, tokens) {
    const normalized = tokens.map(normalizeToken);
    normalized.sort((a, b) => getTokenSortValue(b, view) - getTokenSortValue(a, view));
    if (normalized.length > TOKEN_LIMIT) normalized.length = TOKEN_LIMIT;
    set((state) => ({
      sections: patchView(state.sections, view, {
        tokens: normalized,
        lastUpdate: Date.now(),
        error: null,
        searchQuery: '',
      }),
    }));
  },

  setLoading(view, loading) {
    set((state) => ({ sections: patchView(state.sections, view, { loading }) }));
  },

  setError(view, error) {
    set((state) => ({ sections: patchView(state.sections, view, { error, loading: false }) }));
  },

  /** Single-token convenience wrapper – delegates to batch */
  mergeToken(view, token) {
    get().mergeTokensBatch([{ view, token }]);
  },

  /**
   * Batch-merge multiple token updates in ONE state transition.
   * Groups by view, clones each view's array once, applies all updates,
   * then commits everything in a single set().
   *
   * Uses a Map index per view for O(1) existing-token lookup instead of
   * O(n) findIndex per update.
   */
  mergeTokensBatch(updates) {
    if (updates.length === 0) return;

    set((state) => {
      // Group by view
      const byView = new Map<ViewName, PulseToken[]>();
      for (const { view, token } of updates) {
        let arr = byView.get(view);
        if (!arr) { arr = []; byView.set(view, arr); }
        arr.push(token);
      }

      const newSections = { ...state.sections };

      for (const [view, viewTokens] of byView) {
        // Clone once per view
        const tokens = [...newSections[view].tokens];

        // Build O(1) index: tokenKey → array position
        const idx = new Map<string, number>();
        for (let i = 0; i < tokens.length; i++) {
          idx.set(getTokenKey(tokens[i]), i);
        }

        const rebuildIndex = () => {
          idx.clear();
          for (let i = 0; i < tokens.length; i++) {
            idx.set(getTokenKey(tokens[i]), i);
          }
        };

        for (const rawToken of viewTokens) {
          const normalized = normalizeToken(rawToken);
          const tokenKey = getTokenKey(normalized);
          const existingIdx = idx.get(tokenKey);

          if (existingIdx !== undefined) {
            // Merge non-null fields
            const merged = { ...tokens[existingIdx] } as Record<string, unknown>;
            const src = normalized as Record<string, unknown>;
            for (const k in src) {
              if (src[k] != null) merged[k] = src[k];
            }
            tokens[existingIdx] = merged as PulseToken;

            // Check if sort position is still correct
            const sv = getTokenSortValue(merged as PulseToken, view);
            const prev = existingIdx > 0 ? getTokenSortValue(tokens[existingIdx - 1], view) : Infinity;
            const next = existingIdx < tokens.length - 1 ? getTokenSortValue(tokens[existingIdx + 1], view) : -Infinity;

            if (sv > prev || sv < next) {
              tokens.splice(existingIdx, 1);
              const ins = findInsertionIndex(tokens, sv, view);
              tokens.splice(ins, 0, merged as PulseToken);
              rebuildIndex();
            }
          } else {
            // New token — binary-search insert
            const sv = getTokenSortValue(normalized, view);
            const ins = findInsertionIndex(tokens, sv, view);
            tokens.splice(ins, 0, normalized);
            rebuildIndex();
          }
        }

        // Enforce limit
        if (tokens.length > TOKEN_LIMIT) tokens.length = TOKEN_LIMIT;

        newSections[view] = {
          ...newSections[view],
          tokens,
          lastUpdate: Date.now(),
        };
      }

      return { sections: newSections };
    });
  },

  clearView(view) {
    set((state) => ({ sections: patchView(state.sections, view, mkSection()) }));
  },

  setVisible(view, visible) {
    set((state) => ({ sections: patchView(state.sections, view, { isVisible: visible }) }));
  },

  setSearchQuery(view, query) {
    set((state) => ({ sections: patchView(state.sections, view, { searchQuery: query }) }));
  },

  getFilteredTokens(view) {
    const section = get().sections[view];
    return filterTokensBySearch(section.tokens, section.searchQuery);
  },
}));

export default usePulseDataStore;
