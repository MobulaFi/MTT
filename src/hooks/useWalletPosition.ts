'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { useTradingPanelStore, type PositionStats } from '@/store/useTradingPanelStore';
import { useUserPortfolioStore } from '@/store/useUserPortfolioStore';
import { streams } from '@/lib/sdkClient';
import { usePathname } from 'next/navigation';
import type { WalletToken } from '@/lib/tokens';
import { getNativeAddress, getNativeSymbol, getNativeName, isNativeAddress } from '@/lib/tokens';

// Stream subscription type
type StreamSubscription = { unsubscribe: () => void };

function extractStats(d: PositionData['data']): PositionStats {
  return {
    volumeBuy: d.volumeBuy ?? 0,
    volumeSell: d.volumeSell ?? 0,
    balance: d.balance ?? 0,
    amountUSD: d.amountUSD ?? 0,
    realizedPnlUSD: d.realizedPnlUSD ?? 0,
    unrealizedPnlUSD: d.unrealizedPnlUSD ?? 0,
    totalPnlUSD: d.totalPnlUSD ?? 0,
    avgBuyPriceUSD: d.avgBuyPriceUSD ?? 0,
    avgSellPriceUSD: d.avgSellPriceUSD ?? 0,
  };
}

interface PositionData {
  data: {
    wallet: string;
    token: string;
    chainId: string;
    balance: number;
    rawBalance: string;
    isEstimated?: boolean;
    amountUSD: number;
    buys: number;
    sells: number;
    volumeBuyToken: number;
    volumeSellToken: number;
    volumeBuy: number;
    volumeSell: number;
    avgBuyPriceUSD: number;
    avgSellPriceUSD: number;
    realizedPnlUSD: number;
    unrealizedPnlUSD: number;
    totalPnlUSD: number;
    firstDate: string;
    lastDate: string;
    tokenDetails: {
      address: string;
      chainId: string;
      name: string;
      symbol: string;
      decimals: number;
      logo: string;
      price: number;
      priceChange24h: number | null;
      liquidity: number;
      marketCap: number;
    };
  };
  subscriptionId: string;
}

export function useWalletPosition() {
  const evmAddress = useWalletConnectionStore((state) => state.evmAddress);
  const solanaAddress = useWalletConnectionStore((state) => state.solanaAddress);
  const isEvmConnected = useWalletConnectionStore((state) => state.isEvmConnected);
  const isSolanaConnected = useWalletConnectionStore((state) => state.isSolanaConnected);
  const isConnected = isEvmConnected || isSolanaConnected;
  // Extract only the fields needed for subscription — avoids re-subscribing on price changes
  const baseTokenAddress = useTradingDataStore((s) => s.baseToken?.address);
  const baseTokenBlockchain = useTradingDataStore((s) => s.baseToken?.blockchain);
  const quoteTokenBlockchain = useTradingDataStore((s) => s.quoteToken?.blockchain);
  const { setSellBalance, setBuyBalance, setOwnedTokens, setPositionStats } = useTradingPanelStore();
  const pathname = usePathname();
  const sellSubscriptionRef = useRef<StreamSubscription | null>(null);
  const buySubscriptionRef = useRef<StreamSubscription | null>(null);

  // Use the correct native address per chain family (So111… for Solana, 0xEEEE… for EVM)
  const nativeTokenAddr = useMemo(() => {
    const bc = baseTokenBlockchain?.toLowerCase() || quoteTokenBlockchain?.toLowerCase() || '';
    return getNativeAddress(bc);
  }, [baseTokenBlockchain, quoteTokenBlockchain]);

  // Check if blockchain is Solana (handles both "solana:solana" and "Solana" formats)
  const isSolana = useMemo(() => {
    const blockchain = baseTokenBlockchain?.toLowerCase() || '';
    return blockchain.startsWith('solana') || blockchain === 'solana';
  }, [baseTokenBlockchain]);

  // Use custom wallet address based on chain type
  const walletAddress = useMemo(() => {
    if (isSolana) return solanaAddress || null;
    return evmAddress || null;
  }, [isSolana, evmAddress, solanaAddress]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      // Unsubscribe if wallet disconnects
      if (sellSubscriptionRef.current) {
        sellSubscriptionRef.current.unsubscribe();
        sellSubscriptionRef.current = null;
      }
      if (buySubscriptionRef.current) {
        buySubscriptionRef.current.unsubscribe();
        buySubscriptionRef.current = null;
      }
      return;
    }

    // Determine token address and blockchain for sell balance (baseToken)
    let sellTokenAddress: string | null = null;
    let sellBlockchain: string | null = null;

    if (pathname?.includes('/pair/')) {
      // Pair page: use baseToken
      if (baseTokenAddress && baseTokenBlockchain) {
        sellTokenAddress = baseTokenAddress;
        sellBlockchain = baseTokenBlockchain;
      }
    } else if (pathname?.includes('/token/')) {
      // Token page: use baseToken if available, otherwise extract from URL
      if (baseTokenAddress && baseTokenBlockchain) {
        sellTokenAddress = baseTokenAddress;
        sellBlockchain = baseTokenBlockchain;
      } else {
        // Fallback: extract from URL
        const match = pathname.match(/\/token\/([^/]+)\/([^/]+)/);
        if (match) {
          sellBlockchain = match[1];
          sellTokenAddress = match[2];
        }
      }
    }

    // Subscribe to sell balance (baseToken position)
    if (sellTokenAddress && sellBlockchain) {
      // Unsubscribe from previous sell subscription if exists
      if (sellSubscriptionRef.current) {
        sellSubscriptionRef.current.unsubscribe();
        sellSubscriptionRef.current = null;
      }

      try {
        sellSubscriptionRef.current = streams.subscribePosition(
          {
            wallet: walletAddress,
            token: sellTokenAddress,
            blockchain: sellBlockchain,
            subscriptionTracking: true,
            useSwapRecipient: true,
            includeFees: true,
          },
          (data: unknown) => {
            const positionData = data as PositionData;
            if (positionData?.data?.balance !== undefined) {
              // After a trade, skip WSS updates that carry stale (pre-trade) balances
              // for 5s. But always accept balance=0 — it means the position was fully
              // sold and should reflect immediately.
              const { lastTradeAt, sellBalance } = useTradingPanelStore.getState();
              const isTradeLocked = lastTradeAt > 0 && Date.now() - lastTradeAt < 5_000;
              const currentBalance = Number.parseFloat(sellBalance) || 0;
              const isFullSell = positionData.data.balance <= 0;
              if (!isTradeLocked || isFullSell || positionData.data.balance < currentBalance) {
                setSellBalance(positionData.data.balance.toString(), positionData.data.isEstimated);
              }
              // Always update positionStats (PnL data is always useful)
              setPositionStats(extractStats(positionData.data));
            }
          }
        );
      } catch (error) {
        console.error('Failed to subscribe to sell position:', error);
      }
    }

    // Initialize ownedTokens from portfolio store immediately (no stream wait)
    const portfolioTokens = useUserPortfolioStore.getState().walletTokens;
    if (portfolioTokens.length > 0) {
      const nativeFromPortfolio = portfolioTokens.find((t) => isNativeAddress(t.address));
      if (nativeFromPortfolio && nativeFromPortfolio.balance > 0) {
        setBuyBalance(nativeFromPortfolio.balance.toString());
        setOwnedTokens([nativeFromPortfolio]);
      }
    }

    // Subscribe to buy balance (native token: SOL for Solana, ETH for EVM)
    // Uses UA address from Account Abstraction
    const blockchain = baseTokenBlockchain || quoteTokenBlockchain;
    if (blockchain && walletAddress) {
      // Unsubscribe from previous buy subscription if exists
      if (buySubscriptionRef.current) {
        buySubscriptionRef.current.unsubscribe();
        buySubscriptionRef.current = null;
      }

      const nativeTokenAddress = nativeTokenAddr;

      console.log('[WalletPosition] Subscribing to buy balance with UA address:', {
        wallet: walletAddress,
        token: nativeTokenAddress,
        blockchain,
        isSolana,
      });

      try {
        buySubscriptionRef.current = streams.subscribePosition(
          {
            wallet: walletAddress,
            token: nativeTokenAddress,
            blockchain: blockchain,
            subscriptionTracking: true,
            useSwapRecipient: true,
            includeFees: true,
          },
          (data: unknown) => {
            const positionData = data as PositionData;
            if (positionData?.data?.balance !== undefined) {
              const d = positionData.data;
              setBuyBalance(d.balance.toString());

              const bc = blockchain || '';
              const nativeToken: WalletToken = {
                address: getNativeAddress(bc),
                symbol: d.tokenDetails?.symbol || getNativeSymbol(bc),
                name: d.tokenDetails?.name || getNativeName(bc),
                logo: d.tokenDetails?.logo || null,
                decimals: d.tokenDetails?.decimals || 9,
                balance: d.balance,
                balanceUSD: d.amountUSD || d.balance * (d.tokenDetails?.price || 0),
                priceUSD: d.tokenDetails?.price || 0,
                blockchain: bc,
                isNative: true,
              };
              setOwnedTokens([nativeToken]);
            }
          }
        );
      } catch (error) {
        console.error('Failed to subscribe to buy position:', error);
      }
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (sellSubscriptionRef.current) {
        sellSubscriptionRef.current.unsubscribe();
        sellSubscriptionRef.current = null;
      }
      if (buySubscriptionRef.current) {
        buySubscriptionRef.current.unsubscribe();
        buySubscriptionRef.current = null;
      }
    };
  }, [isConnected, walletAddress, isSolana, nativeTokenAddr, baseTokenAddress, baseTokenBlockchain, quoteTokenBlockchain, pathname, setSellBalance, setBuyBalance, setOwnedTokens, setPositionStats]);

  // Sync sellBalance from portfolio after explicit refresh (trade) or token change.
  // Reads positions imperatively to avoid firing on every WSS-driven position update.
  const balanceRefreshTrigger = useTradingPanelStore((s) => s.balanceRefreshTrigger);
  useEffect(() => {
    if (!baseTokenAddress) return;
    // Small delay to let the portfolio API response arrive after triggerBalanceRefresh
    const timer = setTimeout(() => {
      const positions = useUserPortfolioStore.getState().positions;
      if (positions.length === 0) return;
      const pos = positions.find(
        (p) => p.address.toLowerCase() === baseTokenAddress.toLowerCase(),
      );
      if (pos) {
        setSellBalance(pos.balance.toString(), false);
      } else {
        setSellBalance('0', false);
      }
    }, balanceRefreshTrigger > 0 ? 1500 : 0);
    return () => clearTimeout(timer);
  }, [balanceRefreshTrigger, baseTokenAddress, setSellBalance]);
}

