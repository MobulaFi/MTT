'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useWalletTrackerStore } from '../store/useWalletTrackerStore';
import type { LiveTrade } from '../store/useWalletTrackerStore';
import { sdk, streams } from '@/lib/sdkClient';
import { showTradeToast } from '../components/TradeToast';

interface WssPosition {
  token: string;
  chainId: string;
  balance: number;
  amountUSD: number;
  volumeBuy: number;
  volumeSell: number;
  avgBuyPriceUSD: number;
  avgSellPriceUSD: number;
  realizedPnlUSD: number;
  unrealizedPnlUSD: number;
  totalPnlUSD: number;
  buys: number;
  sells: number;
  volumeBuyToken: number;
  volumeSellToken: number;
  lastDate: string | null;
  tokenDetails?: {
    address: string;
    chainId: string;
    name: string;
    symbol: string;
    decimals: number;
    logo: string | null;
    price: number;
    marketCap: number | null;
  };
}

interface PositionUpdate {
  wallet: string;
  chainId: string;
  positions: WssPosition[];
}

const QUOTE_SYMBOLS = new Set(['SOL', 'WSOL', 'USDC', 'USDT', 'ETH', 'WETH']);

export function useWalletTrackerStream() {
  const trackedWallets = useWalletTrackerStore((s) => s.trackedWallets);
  const addLiveTrade = useWalletTrackerStore((s) => s.addLiveTrade);
  const setWalletPositions = useWalletTrackerStore((s) => s.setWalletPositions);
  const setLoading = useWalletTrackerStore((s) => s.setLoading);

  const subscriptionsRef = useRef<Map<string, { unsubscribe: () => void }>>(new Map());
  const previousPositionsRef = useRef<Map<string, Map<string, { buys: number; sells: number }>>>(new Map());
  const fetchedWalletsRef = useRef<Set<string>>(new Set());

  const fetchInitialData = useCallback(
    async (walletAddress: string, walletLabel: string) => {
      try {
        // 1. Fetch positions → balance, last active, PNL per token, seed WSS baseline
        const positionsRes = (await sdk.fetchWalletPositions({ wallet: walletAddress, includeAllBalances: true })) as Record<string, unknown>;
        const rawPositions = ((positionsRes?.data ?? []) as Array<Record<string, unknown>>);

        // Build PNL lookup: tokenAddress → { realizedPnlUSD, unrealizedPnlUSD, totalPnlUSD }
        const pnlByToken = new Map<string, { realizedPnlUSD: number; totalPnlUSD: number; volumeBuy: number }>();

        if (rawPositions.length > 0) {
          const mapped = rawPositions.map((p) => {
            const tok = p.token as Record<string, unknown> | undefined;
            const tokenAddr = ((tok?.address as string) || '').toLowerCase();
            pnlByToken.set(tokenAddr, {
              realizedPnlUSD: (p.realizedPnlUSD as number) || 0,
              totalPnlUSD: (p.totalPnlUSD as number) || 0,
              volumeBuy: (p.volumeBuy as number) || 0,
            });
            return {
              wallet: walletAddress,
              token: (tok?.address as string) || '',
              chainId: (tok?.chainId as string) || '',
              balance: (p.balance as number) || 0,
              rawBalance: '0',
              amountUSD: (p.amountUSD as number) || 0,
              buys: (p.buys as number) || 0,
              sells: (p.sells as number) || 0,
              volumeBuy: (p.volumeBuy as number) || 0,
              volumeSell: (p.volumeSell as number) || 0,
              volumeBuyToken: (p.volumeBuyToken as number) || 0,
              volumeSellToken: (p.volumeSellToken as number) || 0,
              avgBuyPriceUSD: (p.avgBuyPriceUSD as number) || 0,
              avgSellPriceUSD: (p.avgSellPriceUSD as number) || 0,
              realizedPnlUSD: (p.realizedPnlUSD as number) || 0,
              unrealizedPnlUSD: (p.unrealizedPnlUSD as number) || 0,
              totalPnlUSD: (p.totalPnlUSD as number) || 0,
              firstDate: (p.firstDate as string) || null,
              lastDate: (p.lastDate as string) || null,
              tokenDetails: tok
                ? {
                    address: (tok.address as string) || '',
                    chainId: (tok.chainId as string) || '',
                    name: (tok.name as string) || '',
                    symbol: (tok.symbol as string) || '',
                    decimals: (tok.decimals as number) || 0,
                    logo: (tok.logo as string) || null,
                    price: (tok.price as number) || 0,
                    priceChange24h: (tok.priceChange24h as number) || null,
                    liquidity: (tok.liquidity as number) || null,
                    marketCap: (tok.marketCap as number) || null,
                  }
                : undefined,
            };
          });

          setWalletPositions(walletAddress, mapped as never[]);

          // Seed WSS baseline
          const prevMap = new Map<string, { buys: number; sells: number }>();
          for (const pos of mapped) {
            prevMap.set(`${pos.token}_${pos.chainId}`, { buys: pos.buys, sells: pos.sells });
          }
          previousPositionsRef.current.set(walletAddress.toLowerCase(), prevMap);
        }

        // 2. Fetch recent activity → historical trades
        // WalletActivityV2Response: { data: [{chainId, txDateMs, txHash, actions: [{model, swapAssetIn, swapAssetOut, swapAmountUsd, ...}]}] }
        const activityRes = (await sdk.fetchWalletActivity({ wallet: walletAddress, limit: 30 })) as Record<string, unknown>;
        const transactions = ((activityRes?.data ?? []) as Array<Record<string, unknown>>);

        for (const tx of transactions) {
          const actions = (tx.actions ?? []) as Array<Record<string, unknown>>;
          for (const action of actions) {
            if (action.model !== 'swap') continue;

            const assetIn = action.swapAssetIn as Record<string, unknown> | undefined;
            const assetOut = action.swapAssetOut as Record<string, unknown> | undefined;
            if (!assetIn || !assetOut) continue;

            const inSymbol = (assetIn.symbol as string) || '';
            const type: 'buy' | 'sell' = QUOTE_SYMBOLS.has(inSymbol) ? 'buy' : 'sell';
            const targetAsset = type === 'buy' ? assetOut : assetIn;

            const tokenAddr = ((targetAsset.contract as string) || '').toLowerCase();
            const positionPnl = pnlByToken.get(tokenAddr);
            const pnlUSD = positionPnl ? positionPnl.realizedPnlUSD : null;
            const pnlPct = positionPnl && positionPnl.volumeBuy > 0
              ? (positionPnl.realizedPnlUSD / positionPnl.volumeBuy) * 100
              : null;

            const trade: LiveTrade = {
              id: `${walletAddress}_${tx.txHash as string}_${targetAsset.contract as string}`,
              walletAddress,
              walletLabel,
              timestamp: (tx.txDateMs as number) || Date.now(),
              type,
              tokenSymbol: (targetAsset.symbol as string) || '???',
              tokenName: (targetAsset.name as string) || '',
              tokenLogo: (targetAsset.logo as string) || null,
              tokenAddress: (targetAsset.contract as string) || '',
              chainId: (tx.chainId as string) || '',
              txHash: (tx.txHash as string) || undefined,
              amountUSD: (action.swapAmountUsd as number) || 0,
              tokenAmount: type === 'buy' ? ((action.swapAmountOut as number) || 0) : ((action.swapAmountIn as number) || 0),
              price: (targetAsset.price as number) || 0,
              pnlUSD,
              pnlPct,
              tokenDetails: { marketCap: (targetAsset.marketCapUsd as number) || null },
            };
            addLiveTrade(trade);
          }
        }
      } catch (err) {
        console.error('[WalletTracker] Failed to fetch initial data for', walletAddress, err);
      }
    },
    [addLiveTrade, setWalletPositions],
  );

  const handlePositionUpdate = useCallback(
    (walletAddress: string, walletLabel: string, data: unknown) => {
      const update = data as PositionUpdate;
      if (!update?.positions) return;

      setWalletPositions(walletAddress, update.positions as never[]);

      const key = walletAddress.toLowerCase();
      const prevMap = previousPositionsRef.current.get(key) || new Map();
      const newMap = new Map<string, { buys: number; sells: number }>();

      for (const pos of update.positions) {
        const posKey = `${pos.token}_${pos.chainId}`;
        const prev = prevMap.get(posKey);
        newMap.set(posKey, { buys: pos.buys, sells: pos.sells });

        if (!prev) continue;
        const details = pos.tokenDetails;
        if (!details) continue;

        if (pos.buys > prev.buys) {
          const trade: LiveTrade = {
            id: `${walletAddress}_${pos.token}_${Date.now()}_buy`,
            walletAddress,
            walletLabel,
            timestamp: Date.now(),
            type: 'buy',
            tokenSymbol: details.symbol,
            tokenName: details.name,
            tokenLogo: details.logo,
            tokenAddress: details.address,
            chainId: pos.chainId,
            amountUSD: pos.volumeBuy,
            tokenAmount: pos.volumeBuyToken,
            price: details.price,
            pnlUSD: null,
            pnlPct: null,
            tokenDetails: { marketCap: details.marketCap },
          };
          addLiveTrade(trade);
          showTradeToast(trade);
        }

        if (pos.sells > prev.sells) {
          const pnlPct = pos.volumeBuy > 0 ? (pos.realizedPnlUSD / pos.volumeBuy) * 100 : null;
          const trade: LiveTrade = {
            id: `${walletAddress}_${pos.token}_${Date.now()}_sell`,
            walletAddress,
            walletLabel,
            timestamp: Date.now(),
            type: 'sell',
            tokenSymbol: details.symbol,
            tokenName: details.name,
            tokenLogo: details.logo,
            tokenAddress: details.address,
            chainId: pos.chainId,
            amountUSD: pos.volumeSell,
            tokenAmount: pos.volumeSellToken,
            price: details.price,
            pnlUSD: pos.realizedPnlUSD,
            pnlPct,
            tokenDetails: { marketCap: details.marketCap },
          };
          addLiveTrade(trade);
          showTradeToast(trade);
        }
      }

      previousPositionsRef.current.set(key, newMap);
    },
    [addLiveTrade, setWalletPositions],
  );

  useEffect(() => {
    const currentAddresses = new Set(trackedWallets.map((w) => w.address.toLowerCase()));
    const activeAddresses = new Set(subscriptionsRef.current.keys());

    for (const addr of activeAddresses) {
      if (!currentAddresses.has(addr)) {
        subscriptionsRef.current.get(addr)?.unsubscribe();
        subscriptionsRef.current.delete(addr);
        previousPositionsRef.current.delete(addr);
        fetchedWalletsRef.current.delete(addr);
      }
    }

    for (const wallet of trackedWallets) {
      const addr = wallet.address.toLowerCase();

      if (!fetchedWalletsRef.current.has(addr)) {
        fetchedWalletsRef.current.add(addr);
        setLoading(true);
        fetchInitialData(wallet.address, wallet.label).finally(() => setLoading(false));
      }

      if (!subscriptionsRef.current.has(addr)) {
        const sub = streams.subscribePositions(
          { wallet: wallet.address, blockchain: 'solana' },
          (data) => handlePositionUpdate(wallet.address, wallet.label, data),
        );
        subscriptionsRef.current.set(addr, sub);
      }
    }

    return () => {
      for (const sub of subscriptionsRef.current.values()) {
        sub.unsubscribe();
      }
      subscriptionsRef.current.clear();
    };
  }, [trackedWallets, handlePositionUpdate, fetchInitialData, setLoading]);
}
