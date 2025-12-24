'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

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
  searchQuery: string; // NEW: Search functionality
}

export interface PulseDataStoreState {
  // State
  sections: Record<ViewName, SectionDataState>;

  // Actions
  setTokens(view: ViewName, tokens: PulseToken[]): void;
  setLoading(view: ViewName, loading: boolean): void;
  setError(view: ViewName, error: string | null): void;
  mergeToken(view: ViewName, token: PulseToken): void;
  clearView(view: ViewName): void;
  setVisible(view: ViewName, visible: boolean): void;
  setSearchQuery(view: ViewName, query: string): void; // NEW
  getFilteredTokens(view: ViewName): PulseToken[]; // NEW
}

const TOKEN_LIMIT = 50; // Maximum tokens per view
const PULSE_DEBUG = process.env.NEXT_PUBLIC_PULSE_DEBUG === 'true';

/**
 * Helper to generate unique token identifier
 */
function getTokenKey(token: PulseToken): string {
  const flatToken = token?.token?.address ? token.token : token;
  const address = flatToken?.address || '';
  const chainId = flatToken?.chainId || '';
  return `${address}_${chainId}`;
}

/**
 * Helper to get token name for search
 */
function getTokenName(token: PulseToken): string {
  const flatToken = token?.token?.address ? token.token : token;
  if (flatToken && 'name' in flatToken && typeof flatToken.name === 'string') {
    return flatToken.name;
  }
  return '';
}

/**
 * Helper to get token symbol for search
 */
function getTokenSymbol(token: PulseToken): string {
  const flatToken = token?.token?.address ? token.token : token;
  if (flatToken && 'symbol' in flatToken && typeof flatToken.symbol === 'string') {
    return flatToken.symbol;
  }
  return '';
}

/**
 * Helper to get token address for search
 */
function getTokenAddress(token: PulseToken): string {
  const flatToken = token?.token?.address ? token.token : token;
  return flatToken?.address || '';
}

/**
 * Filter tokens based on search query
 */
function filterTokensBySearch(tokens: PulseToken[], query: string): PulseToken[] {
  if (!query.trim()) return tokens;

  const lowerQuery = query.toLowerCase();

  return tokens.filter((token) => {
    const name = getTokenName(token).toLowerCase();
    const symbol = getTokenSymbol(token).toLowerCase();
    const address = getTokenAddress(token).toLowerCase();

    return name.includes(lowerQuery) || symbol.includes(lowerQuery) || address.includes(lowerQuery);
  });
}


function getTokenTimestamp(token: PulseToken, view: ViewName): number {
  const flatToken = token?.token?.address ? token.token : token;
  const tokenData = flatToken as { bonded_at?: string; created_at?: string; createdAt?: string };
  
  let timestampStr: string | undefined;
  
  if (view === 'bonded') {
    timestampStr = tokenData.bonded_at || tokenData.created_at || tokenData.createdAt;
  } else {
    timestampStr = tokenData.created_at || tokenData.createdAt;
  }
  
  if (!timestampStr) return 0;
  const timestamp = new Date(timestampStr).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function findInsertionIndex(tokens: PulseToken[], tokenTimestamp: number, view: ViewName): number {
  let left = 0;
  let right = tokens.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = getTokenTimestamp(tokens[mid], view);
    
    if (midTimestamp < tokenTimestamp) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }

  return left;
}

/**
 * usePulseDataStore (Enhanced)
 *
 * Manages data and loading state independently for each pulse view:
 * - new: Newly created tokens
 * - bonding: Tokens in bonding curve
 * - bonded: Tokens that migrated
 *
 * Enhancements:
 * - Search functionality per section
 * - Token limit enforcement (max 50 per view)
 * - Automatic removal of oldest tokens when limit exceeded
 * - Filtered token retrieval
 *
 * Benefits:
 * - Each section can show independent loading states
 * - Skeleton loaders only appear for affected section
 * - Better error isolation
 * - Cleaner component code
 * - Search across tokens
 * - Prevents memory bloat
 */
export const usePulseDataStore = create<PulseDataStoreState>()(
  devtools(
    immer((set, get) => ({
      sections: {
        new: {
          tokens: [],
          loading: false,
          error: null,
          lastUpdate: 0,
          isVisible: true,
          searchQuery: '',
        },
        bonding: {
          tokens: [],
          loading: false,
          error: null,
          lastUpdate: 0,
          isVisible: true,
          searchQuery: '',
        },
        bonded: {
          tokens: [],
          loading: false,
          error: null,
          lastUpdate: 0,
          isVisible: true,
          searchQuery: '',
        },
      },

      /**
       * Replace all tokens for a view
       * Used when initial data loads or major filter changes
       * Also completely clears old tokens (not merging)
       * 
       * Sorts tokens by appropriate timestamp (bonded_at for bonded, created_at for new/bonding)
       */
      setTokens(view, tokens) {
        set((state) => {
          const sortedTokens = [...tokens].sort((a, b) => {
            const timeA = getTokenTimestamp(a, view);
            const timeB = getTokenTimestamp(b, view);
            return timeB - timeA; // Descending order (newest first)
          });

          // Ensure we don't exceed token limit
          let limitedTokens = sortedTokens;
          if (limitedTokens.length > TOKEN_LIMIT) {
            // Keep newest (first TOKEN_LIMIT items)
            limitedTokens = limitedTokens.slice(0, TOKEN_LIMIT);
          }

          // Immer allows direct mutation
          state.sections[view].tokens = limitedTokens;
          state.sections[view].lastUpdate = Date.now();
          state.sections[view].error = null;
          state.sections[view].searchQuery = ''; // Reset search when new data loads
        });
      },

      /**
       * Set loading state for a view
       */
      setLoading(view, loading) {
        set((state) => {
          state.sections[view].loading = loading;
        });
      },

      /**
       * Set error state for a view
       */
      setError(view, error) {
        set((state) => {
          state.sections[view].error = error;
          state.sections[view].loading = false;
        });
      },

      /**
       * Merge a single token update with optimized sorting
       *
       * Logic:
       * - If token exists: check if timestamp changed, only re-position if needed
       * - If token is new: use binary search to find correct position
       * - If limit exceeded: remove oldest token from end
       * - Uses bonded_at for bonded view, created_at for new/bonding views
       *
       * Performance:
       * - O(1) for updates without position change (most common case)
       * - O(log n) for new tokens or tokens with changed timestamp
       * - O(n) worst case when removing from middle, but rare
       * 
       * This prevents duplicate tokens and maintains proper ordering by the appropriate timestamp
       */
      mergeToken(view, token) {
        set((state) => {
          const currentTokens = state.sections[view].tokens;
          const tokenKey = getTokenKey(token);
          const tokenTimestamp = getTokenTimestamp(token, view);

          // Find existing token
          const existingIndex = currentTokens.findIndex((t) => getTokenKey(t) === tokenKey);

          if (existingIndex !== -1) {
            // Token exists: check if timestamp changed
            const existingToken = currentTokens[existingIndex];
            const existingTimestamp = getTokenTimestamp(existingToken, view);

            // If timestamp didn't change significantly (< 1 second), just update in place (O(1))
            if (Math.abs(existingTimestamp - tokenTimestamp) < 1000) {
              // Immer allows direct mutation
              Object.assign(currentTokens[existingIndex], token);
            } else {
              // Remove and re-insert
              currentTokens.splice(existingIndex, 1);
              const newIndex = findInsertionIndex(currentTokens, tokenTimestamp, view);
              currentTokens.splice(newIndex, 0, { ...existingToken, ...token });
            }
          } else {
            const insertIndex = findInsertionIndex(currentTokens, tokenTimestamp, view);
            currentTokens.splice(insertIndex, 0, token);
          }

          // Enforce token limit: if exceeded, remove oldest (last) token
          if (currentTokens.length > TOKEN_LIMIT) {
            currentTokens.splice(TOKEN_LIMIT);
          }

          state.sections[view].lastUpdate = Date.now();
        });
      },

      /**
       * Clear all tokens for a view (when filters change)
       * COMPLETELY removes all existing tokens
       */
      clearView(view) {
        set((state) => {
          state.sections[view].tokens = [];
          state.sections[view].loading = false;
          state.sections[view].error = null;
          state.sections[view].searchQuery = ''; // Reset search
        });
      },

      /**
       * Set visibility of a view (for conditional rendering)
       */
      setVisible(view, visible) {
        set((state) => {
          state.sections[view].isVisible = visible;
        });
      },

      /**
       * Set search query for a view
       * NEW: Filter tokens by name/symbol/address
       */
      setSearchQuery(view, query) {
        set((state) => {
          state.sections[view].searchQuery = query;
        });
      },

      /**
       * Get filtered tokens based on search query
       * NEW: Returns tokens matching search
       */
      getFilteredTokens(view) {
        const state = get();
        const section = state.sections[view];
        return filterTokensBySearch(section.tokens, section.searchQuery);
      },
    })),
    { name: 'PulseDataStore' }
  )
);

export default usePulseDataStore;