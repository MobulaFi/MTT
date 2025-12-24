// hooks/useTopTradersData.ts
import { useEffect, useCallback, useRef } from 'react';
import { useTopTradersStore } from '@/store/useTopTraderStore';
import { getMobulaClient } from '@/lib/mobulaClient';
import type { TokenPositionsParams, TokenPositionsResponse } from '@mobula_labs/types';

interface UseTopTradersDataParams {
  tokenAddress: string;
  blockchain: string;
}

interface TopTradersFilters {
  label?: string;
  limit?: number;
  walletAddresses?: string[];
}

export function useTopTradersData({ tokenAddress, blockchain }: UseTopTradersDataParams) {
  const {
    data,
    filters,
    isLoading,
    error,
    setData,
    setLoading,
    setError,
    setTokenAddress,
    setBlockchain,
    setFilters,
    setFilter: setStoreFilter,
    clearFilters: clearStoreFilters,
    reset,
  } = useTopTradersStore();

  const isFetchingRef = useRef(false);
  const lastFetchParamsRef = useRef<string>('');


  const fetchTopTraders = useCallback(
    async (customFilters?: TopTradersFilters) => {
      if (!tokenAddress || !blockchain) {
        console.warn('[useTopTradersData] Missing required params:', { tokenAddress, blockchain });
        return;
      }

      const filtersToUse = customFilters !== undefined ? customFilters : filters;
      
      const fetchKey = JSON.stringify({ tokenAddress, blockchain, filters: filtersToUse });
      
      if (isFetchingRef.current && lastFetchParamsRef.current === fetchKey) {
        return;
      }

      isFetchingRef.current = true;
      lastFetchParamsRef.current = fetchKey;

      setLoading(true);
      setError(null);
      setTokenAddress(tokenAddress);
      setBlockchain(blockchain);
      setFilters(filtersToUse);

      try {
        const client = getMobulaClient();

        const requestParams: TokenPositionsParams = {
          address: tokenAddress,
          blockchain: blockchain,
        };

        if (filtersToUse.label) {
          requestParams.label = filtersToUse.label as TokenPositionsParams['label'];
        }
        if (filtersToUse.limit) {
          requestParams.limit = filtersToUse.limit;
        }
        if (filtersToUse.walletAddresses && filtersToUse.walletAddresses.length > 0) {
          requestParams.walletAddresses = filtersToUse.walletAddresses;
        }

        const response: TokenPositionsResponse = await client.fetchTokenTraderPositions(requestParams);

        if (response?.data) {
          setData(response);
          setLoading(false);
        } else {
          console.warn('[useTopTradersData] Empty response');
          setError('No data received from API');
          setLoading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch top traders';
        console.error('[useTopTradersData] Error:', {
          error: err,
          message: errorMessage,
        });
        setError(errorMessage);
        setLoading(false);
      } finally {
        isFetchingRef.current = false;
      }
    },
    [tokenAddress, blockchain, filters, setData, setLoading, setError, setTokenAddress, setBlockchain, setFilters]
  );

  const setFilter = useCallback(
    (key: keyof TopTradersFilters, value: any) => {
      const newFilters = { ...filters, [key]: value };
 
      setStoreFilter(key, value);

      fetchTopTraders(newFilters);
    },
    [filters, setStoreFilter, fetchTopTraders]
  );

  const clearFilters = useCallback(() => {
    clearStoreFilters();

    fetchTopTraders({});
  }, [filters, clearStoreFilters, fetchTopTraders]);

  useEffect(() => {
    if (!tokenAddress || !blockchain) {
      console.warn('[useTopTradersData] Skipping initial fetch - missing params');
      return;
    }    
    fetchTopTraders({});

    return () => {
      reset();
    };
  }, [tokenAddress, blockchain, reset]);

  return {
    data,
    filters,
    isLoading,
    error,
    setFilter,
    clearFilters,
    refetch: () => fetchTopTraders(filters),
  };
}