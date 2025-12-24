'use client';

import { useEffect, useRef } from 'react';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { getMobulaClient } from '@/lib/mobulaClient';
import { usePathname } from 'next/navigation';

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
  const { isEvmConnected, evmAddress, isSolanaConnected, solanaAddress } = useWalletConnectionStore();
  const { baseToken, quoteToken } = useTradingDataStore();
  const { setSellBalance, setBuyBalance } = useTradingPanelStore();
  const pathname = usePathname();
  const sellSubscriptionIdRef = useRef<string | null>(null);
  const buySubscriptionIdRef = useRef<string | null>(null);

  // Native token addresses
  const EVM_NATIVE_TOKEN_ADDRESS = '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
  const SOLANA_NATIVE_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';

  // Determine which wallet is connected
  const isConnected = isEvmConnected || isSolanaConnected;
  const walletAddress = evmAddress || solanaAddress;
  const isSolana = isSolanaConnected && solanaAddress;

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      // Unsubscribe if wallet disconnects
      if (sellSubscriptionIdRef.current) {
        const client = getMobulaClient();
        try {
          client.streams.unsubscribe('position', sellSubscriptionIdRef.current);
        } catch (error) {
          console.error('Failed to unsubscribe from sell position:', error);
        }
        sellSubscriptionIdRef.current = null;
      }
      if (buySubscriptionIdRef.current) {
        const client = getMobulaClient();
        try {
          client.streams.unsubscribe('position', buySubscriptionIdRef.current);
        } catch (error) {
          console.error('Failed to unsubscribe from buy position:', error);
        }
        buySubscriptionIdRef.current = null;
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
      if (sellSubscriptionIdRef.current) {
        const client = getMobulaClient();
        try {
          client.streams.unsubscribe('position', sellSubscriptionIdRef.current);
        } catch (error) {
          console.error('Failed to unsubscribe from previous sell position:', error);
        }
        sellSubscriptionIdRef.current = null;
      }

      const client = getMobulaClient();
      const sellSubscriptionId = `position-sell-${walletAddress}-${sellTokenAddress}-${Date.now()}`;

      try {
        const actualSubscriptionId = client.streams.subscribe(
          'position',
          {
            wallet: walletAddress,
            token: sellTokenAddress,
            blockchain: sellBlockchain as never,
            subscriptionId: sellSubscriptionId,
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

        sellSubscriptionIdRef.current = actualSubscriptionId || sellSubscriptionId;
      } catch (error) {
        console.error('Failed to subscribe to sell position:', error);
      }
    }

    // Subscribe to buy balance (native token position)
    // Always use native token address
    const blockchain = baseToken?.blockchain || quoteToken?.blockchain;
    if (blockchain) {
      // Unsubscribe from previous buy subscription if exists
      if (buySubscriptionIdRef.current) {
        const client = getMobulaClient();
        try {
          client.streams.unsubscribe('position', buySubscriptionIdRef.current);
        } catch (error) {
          console.error('Failed to unsubscribe from previous buy position:', error);
        }
        buySubscriptionIdRef.current = null;
      }

      // Use appropriate native token address based on chain
      const nativeTokenAddress = isSolana ? SOLANA_NATIVE_TOKEN_ADDRESS : EVM_NATIVE_TOKEN_ADDRESS;

      const client = getMobulaClient();
      const buySubscriptionId = `position-buy-${walletAddress}-${nativeTokenAddress}-${Date.now()}`;

      try {
        const actualSubscriptionId = client.streams.subscribe(
          'position',
          {
            wallet: walletAddress,
            token: nativeTokenAddress,
            blockchain: blockchain as never,
            subscriptionId: buySubscriptionId,
            subscriptionTracking: true,
          },
          (data: unknown) => {
            const positionData = data as PositionData;
            if (positionData?.data?.balance !== undefined) {
              // Update buy balance with native token position balance
              setBuyBalance(positionData.data.balance.toString());
            }
          }
        );

        buySubscriptionIdRef.current = actualSubscriptionId || buySubscriptionId;
      } catch (error) {
        console.error('Failed to subscribe to buy position:', error);
      }
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (sellSubscriptionIdRef.current) {
        const client = getMobulaClient();
        try {
          client.streams.unsubscribe('position', sellSubscriptionIdRef.current);
        } catch (error) {
          console.error('Failed to unsubscribe from sell position on cleanup:', error);
        }
        sellSubscriptionIdRef.current = null;
      }
      if (buySubscriptionIdRef.current) {
        const client = getMobulaClient();
        try {
          client.streams.unsubscribe('position', buySubscriptionIdRef.current);
        } catch (error) {
          console.error('Failed to unsubscribe from buy position on cleanup:', error);
        }
        buySubscriptionIdRef.current = null;
      }
    };
  }, [isConnected, walletAddress, isSolana, baseToken, quoteToken, pathname, setSellBalance, setBuyBalance]);
}

