import { create } from 'zustand';
import type { SwapQuotingResponse } from '@mobula_labs/types';

interface SwapQuoteState {
  quote: SwapQuotingResponse | null;
  isLoading: boolean;
  error: string | null;
  isModalOpen: boolean;
  setQuote: (quote: SwapQuotingResponse | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  openModal: () => void;
  closeModal: () => void;
  reset: () => void;
}

export const useSwapQuoteStore = create<SwapQuoteState>((set) => ({
  quote: null,
  isLoading: false,
  error: null,
  isModalOpen: false,
  setQuote: (quote) => set({ quote, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  reset: () => set({ quote: null, isLoading: false, error: null, isModalOpen: false }),
}));


