'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { WalletPositionData } from '@mobula_labs/types';

export interface TrackedWallet {
  address: string;
  label: string;
  addedAt: number;
}

export interface LiveTrade {
  id: string;
  walletAddress: string;
  walletLabel: string;
  timestamp: number;
  type: 'buy' | 'sell';
  tokenSymbol: string;
  tokenName: string;
  tokenLogo: string | null;
  tokenAddress: string;
  chainId: string;
  amountUSD: number;
  tokenAmount: number;
  price: number;
  txHash?: string;
  pnlUSD: number | null;
  pnlPct: number | null;
  tokenDetails?: {
    marketCap: number | null;
  };
}

const TRADE_LIMIT = 500;

export interface WalletTrackerStoreState {
  trackedWallets: TrackedWallet[];
  liveTrades: LiveTrade[];
  walletPositions: Record<string, WalletPositionData[]>;
  isLoading: boolean;

  addWallet: (address: string, label?: string) => void;
  removeWallet: (address: string) => void;
  updateWalletLabel: (address: string, label: string) => void;
  removeAllWallets: () => void;

  addLiveTrade: (trade: LiveTrade) => void;
  clearTrades: () => void;

  setWalletPositions: (wallet: string, positions: WalletPositionData[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useWalletTrackerStore = create<WalletTrackerStoreState>()(
  devtools(
    persist(
      immer((set) => ({
        trackedWallets: [],
        liveTrades: [],
        walletPositions: {},
        isLoading: false,

        addWallet: (address, label) =>
          set((state) => {
            const exists = state.trackedWallets.some(
              (w) => w.address.toLowerCase() === address.toLowerCase(),
            );
            if (!exists) {
              state.trackedWallets.push({
                address,
                label: label || `${address.slice(0, 6)}...${address.slice(-4)}`,
                addedAt: Date.now(),
              });
            }
          }),

        removeWallet: (address) =>
          set((state) => {
            state.trackedWallets = state.trackedWallets.filter(
              (w) => w.address.toLowerCase() !== address.toLowerCase(),
            );
            delete state.walletPositions[address.toLowerCase()];
          }),

        updateWalletLabel: (address, label) =>
          set((state) => {
            const wallet = state.trackedWallets.find(
              (w) => w.address.toLowerCase() === address.toLowerCase(),
            );
            if (wallet) wallet.label = label;
          }),

        removeAllWallets: () =>
          set((state) => {
            state.trackedWallets = [];
            state.walletPositions = {};
            state.liveTrades = [];
          }),

        addLiveTrade: (trade) =>
          set((state) => {
            state.liveTrades.unshift(trade);
            if (state.liveTrades.length > TRADE_LIMIT) {
              state.liveTrades = state.liveTrades.slice(0, TRADE_LIMIT);
            }
          }),

        clearTrades: () =>
          set((state) => {
            state.liveTrades = [];
          }),

        setWalletPositions: (wallet, positions) =>
          set((state) => {
            state.walletPositions[wallet.toLowerCase()] = positions;
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading;
          }),
      })),
      {
        name: 'wallet-tracker-storage',
        partialize: (state) => ({
          trackedWallets: state.trackedWallets,
        }),
      },
    ),
    { name: 'WalletTrackerStore' },
  ),
);
