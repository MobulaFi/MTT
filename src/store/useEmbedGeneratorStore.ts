'use client';

import { create } from 'zustand';
import type { EmbedResolution, EmbedTheme } from '@/lib/embed/validateEmbedParams';

export type EmbedType = 'token' | 'pool';

interface EmbedGeneratorState {
  // Form state
  embedType: EmbedType;
  chain: string;
  address: string;
  resolution: EmbedResolution;
  theme: EmbedTheme | '';
  candleUpColor: string;
  candleDownColor: string;
  bgColor: string;
  chartWidth: string;
  chartHeight: string;

  // Actions
  setEmbedType: (type: EmbedType) => void;
  setChain: (chain: string) => void;
  setAddress: (address: string) => void;
  setResolution: (resolution: EmbedResolution) => void;
  setTheme: (theme: EmbedTheme | '') => void;
  setCandleUpColor: (color: string) => void;
  setCandleDownColor: (color: string) => void;
  setBgColor: (color: string) => void;
  setChartWidth: (width: string) => void;
  setChartHeight: (height: string) => void;
  reset: () => void;
}

const defaultState = {
  embedType: 'token' as EmbedType,
  chain: 'evm:56', // BNB Smart Chain (BSC)
  address: '0x59264f02D301281f3393e1385c0aEFd446Eb0F00',
  resolution: '1minute' as EmbedResolution,
  theme: 'Navy' as EmbedTheme | '',
  candleUpColor: '#18C722',
  candleDownColor: '#EF4444',
  bgColor: '#121319', // Navy theme default
  chartWidth: '100%',
  chartHeight: '600',
};

export const useEmbedGeneratorStore = create<EmbedGeneratorState>((set) => ({
  ...defaultState,

  setEmbedType: (type) => set({ embedType: type }),
  setChain: (chain) => set({ chain }),
  setAddress: (address) => set({ address }),
  setResolution: (resolution) => set({ resolution }),
  setTheme: (theme) => set({ theme }),
  setCandleUpColor: (color) => set({ candleUpColor: color }),
  setCandleDownColor: (color) => set({ candleDownColor: color }),
  setBgColor: (color) => set({ bgColor: color }),
  setChartWidth: (width) => set({ chartWidth: width }),
  setChartHeight: (height) => set({ chartHeight: height }),
  reset: () => set(defaultState),
}));
