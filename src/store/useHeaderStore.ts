import { create } from 'zustand';

interface HeaderState {
  // Modal states
  isSearchOpen: boolean;
  isApiSelectorOpen: boolean;
  isNetworkDebuggerOpen: boolean;

  // Latency state
  latency: string;

  // Actions
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;

  openApiSelector: () => void;
  closeApiSelector: () => void;
  toggleApiSelector: () => void;

  openNetworkDebugger: () => void;
  closeNetworkDebugger: () => void;

  setLatency: (latency: string) => void;

  // Close all modals
  closeAllModals: () => void;
}

export const useHeaderStore = create<HeaderState>((set) => ({
  // Initial state
  isSearchOpen: false,
  isApiSelectorOpen: false,
  isNetworkDebuggerOpen: false,
  latency: '...',
  
  // Search modal actions
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
  
  // API selector actions
  openApiSelector: () => set({ isApiSelectorOpen: true }),
  closeApiSelector: () => set({ isApiSelectorOpen: false }),
  toggleApiSelector: () => set((state) => ({ isApiSelectorOpen: !state.isApiSelectorOpen })),
  
  // Network debugger actions
  openNetworkDebugger: () => set({ isNetworkDebuggerOpen: true }),
  closeNetworkDebugger: () => set({ isNetworkDebuggerOpen: false }),

  // Latency action
  setLatency: (latency: string) => set({ latency }),
  
  // Close all modals
  closeAllModals: () => set({
    isSearchOpen: false,
    isApiSelectorOpen: false,
    isNetworkDebuggerOpen: false,
  }),
}));

