'use client';

import { useEffect } from 'react';
import { getMobulaClient } from '@/lib/mobulaClient';
import { useWalletPortfolioStore } from '@/store/useWalletPortfolioStore';

export function useWalletPortfolio(walletAddress?: string, blockchain?: string) {
  const {
    setData,
    setError,
    setLoading,
    setActivePositionData,
    setWalletActivity,
    reset,
    data,
    activePositionData,
    walletActivity,
    isLoading,
    error,
  } = useWalletPortfolioStore();

  useEffect(() => {
    if (!walletAddress || !blockchain) return;

    const fetchWalletData = async () => {
      try {
        setLoading(true);
        const client = getMobulaClient();

        const [portfolioRes, positionsRes, walletActivityRes] = await Promise.all([
          client.fetchWalletPortfolio({
            wallet: walletAddress,
            blockchains: blockchain,
          }),
          client.fetchWalletPositions({
            wallet: walletAddress,
            blockchain,
          }),
          client.fetchWalletActivity({
            wallet: walletAddress,
            blockchains: blockchain,
            limit:100
          }),
        ]);

        setData(portfolioRes);
        setActivePositionData(positionsRes);
        setWalletActivity(walletActivityRes);
      } catch (err) {
        console.error('Error fetching wallet data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch wallet data');
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
    return () => {
      reset();
    };
  }, [
    walletAddress,
    blockchain,
    setData,
    setError,
    setLoading,
    setActivePositionData,
    setWalletActivity,
    reset,
  ]);

  return { data, activePositionData, walletActivity , isLoading, error };
}
