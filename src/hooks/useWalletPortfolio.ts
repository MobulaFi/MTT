'use client';

import { useEffect, useCallback, useRef } from 'react';
import { sdk } from '@/lib/sdkClient';
import { useWalletPortfolioStore } from '@/store/useWalletPortfolioStore';

export function useWalletPortfolio(walletAddress?: string, blockchain?: string) {
  const {
    setData,
    setError,
    setLoading,
    setActivePositionData,
    setWalletActivity,
    setWalletHistory,
    setHistoryLoading,
    setActivityLoading,
    setActivityError,
    reset,
    data,
    activePositionData,
    walletActivity,
    walletHistory,
    isLoading,
    error,
  } = useWalletPortfolioStore();

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!walletAddress || !blockchain) return;

    const fetchWalletData = async () => {
      try {
        setLoading(true);

        const [portfolioRes, positionsRes, walletActivityRes] = await Promise.all([
          sdk.fetchWalletPortfolio({
            wallet: walletAddress,
            blockchains: blockchain,
          }),
          sdk.fetchWalletPositions({
            wallet: walletAddress,
            blockchain,
          }),
          sdk.fetchWalletActivity({
            wallet: walletAddress,
            blockchains: blockchain,
            limit: 100
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
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
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

  const fetchWalletHistoryData = useCallback(async (days: number, fromTimestamp?: number, toTimestamp?: number) => {
    if (!walletAddress || !blockchain) return;
    
    try {
      setHistoryLoading(true);
      const response = await sdk.fetchWalletHistory({
        wallet: walletAddress,
        blockchains: blockchain,
        from: fromTimestamp?.toString(),
        to: toTimestamp?.toString(),
      });
      
      if (response?.data?.balance_history) {
        const historyData = response.data.balance_history.map(([timestamp, value]) => ({
          date: new Date(timestamp).toISOString(),
          value,
        }));
        setWalletHistory(historyData);
      }
    } catch (err) {
      console.error('Error fetching wallet history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [walletAddress, blockchain, setHistoryLoading, setWalletHistory]);

  const refetchActivity = useCallback(async (filters?: { from?: number; to?: number; order?: 'asc' | 'desc' }) => {
    if (!walletAddress || !blockchain) return;
    
    try {
      setActivityLoading(true);
      const response = await sdk.fetchWalletActivity({
        wallet: walletAddress,
        blockchains: blockchain,
        limit: 100,
        ...filters,
      });
      setWalletActivity(response);
    } catch (err) {
      console.error('Error refetching activity:', err);
      setActivityError(err instanceof Error ? err.message : 'Failed to refetch activity');
    } finally {
      setActivityLoading(false);
    }
  }, [walletAddress, blockchain, setActivityLoading, setWalletActivity, setActivityError]);

  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  return { 
    data, 
    activePositionData, 
    walletActivity,
    walletHistory,
    isLoading, 
    error,
    fetchWalletHistoryData,
    refetchActivity,
    closeWebSocket,
  };
}
