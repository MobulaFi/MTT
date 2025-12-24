import { create } from 'zustand';

interface PriceDisplayStore {
  displayCurrency: 'USD' | 'QUOTE';
  quoteCurrencySymbol: string;
  quotePriceUSD: number;
  quoteLogo?: string;
  setDisplayCurrency: (currency: 'USD' | 'QUOTE') => void;
  setQuoteInfo: (symbol: string, priceUSD: number, logo?: string) => void;
  toggleCurrency: () => void;
  convertToDisplay: (usdAmount: number) => number;
}

export const usePriceDisplayStore = create<PriceDisplayStore>((set, get) => ({
  displayCurrency: 'USD',
  quoteCurrencySymbol: '',
  quotePriceUSD: 1,
  quoteLogo: undefined,
  
  setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
  
  setQuoteInfo: (symbol, priceUSD, logo) => 
    set({ 
      quoteCurrencySymbol: symbol,
      quotePriceUSD: priceUSD,
      quoteLogo: logo
    }),
  
  toggleCurrency: () => {
    const current = get().displayCurrency;
    set({ displayCurrency: current === 'USD' ? 'QUOTE' : 'USD' });
  },
  
  convertToDisplay: (usdAmount: number) => {
    const state = get();
    if (state.displayCurrency === 'USD') {
      return usdAmount;
    }
    return usdAmount / state.quotePriceUSD;
  },
}));