'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { streams } from '@/lib/sdkClient';
import { usePathname } from 'next/navigation';

// Stream subscription type
type StreamSubscription = { unsubscribe: () => void };

interface PositionData {
  data: {
    wallet: string;
    token: string;
    chainId: string;
    balance: number;
    rawBalance: string;
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
  const { baseToken, quoteToken } = useTradingDataStore();
  const { setSellBalance, setBuyBalance } = useTradingPanelStore();
  const pathname = usePathname();
  const sellSubscriptionRef = useRef<StreamSubscription | null>(null);
  const buySubscriptionRef = useRef<StreamSubscription | null>(null);

  // Mobula uses the same native token address for all chains (including Solana)
  const NATIVE_TOKEN_ADDRESS = '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

  // Check if blockchain is Solana (handles both "solana:solana" and "Solana" formats)
  const isSolana = useMemo(() => {
    const blockchain = baseToken?.blockchain?.toLowerCase() || '';
    return blockchain.startsWith('solana') || blockchain === 'solana';
  }, [baseToken?.blockchain]);

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
      if (baseToken?.address && baseToken?.blockchain) {
        sellTokenAddress = baseToken.address;
        sellBlockchain = baseToken.blockchain;
      }
    } else if (pathname?.includes('/token/')) {
      // Token page: use baseToken if available, otherwise extract from URL
      if (baseToken?.address && baseToken?.blockchain) {
        sellTokenAddress = baseToken.address;
        sellBlockchain = baseToken.blockchain;
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
          },
          (data: unknown) => {
            const positionData = data as PositionData;
            if (positionData?.data?.balance !== undefined) {
              // Update sell balance with position balance
              setSellBalance(positionData.data.balance.toString());
            }
          }
        );
      } catch (error) {
        console.error('Failed to subscribe to sell position:', error);
      }
    }

    // Subscribe to buy balance (native token: SOL for Solana, ETH for EVM)
    // Uses UA address from Account Abstraction
    const blockchain = baseToken?.blockchain || quoteToken?.blockchain;
    if (blockchain && walletAddress) {
      // Unsubscribe from previous buy subscription if exists
      if (buySubscriptionRef.current) {
        buySubscriptionRef.current.unsubscribe();
        buySubscriptionRef.current = null;
      }

      // Use native token address (same for all chains in Mobula)
      const nativeTokenAddress = NATIVE_TOKEN_ADDRESS;

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
          },
          (data: unknown) => {
            const positionData = data as PositionData;
            if (positionData?.data?.balance !== undefined) {
              // Update buy balance with native token position balance
              setBuyBalance(positionData.data.balance.toString());
              console.log('[WalletPosition] Buy balance updated:', positionData.data.balance);
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
  }, [isConnected, walletAddress, isSolana, baseToken, quoteToken, pathname, setSellBalance, setBuyBalance]);
}

