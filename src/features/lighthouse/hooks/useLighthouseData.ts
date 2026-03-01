import { useCallback, useEffect, useRef, useState } from 'react';
import { sdk } from '@/lib/sdkClient';

interface LighthouseData {
  data: {
    total: Record<string, Record<string, number | null>>;
    byChain: Array<Record<string, unknown>>;
    byDex: Array<Record<string, unknown>>;
    byLaunchpad: Array<Record<string, unknown>>;
    byPlatform: Array<Record<string, unknown>>;
  };
}

const POLL_INTERVAL = 60_000;

export function useLighthouseData(enabled: boolean) {
  const [data, setData] = useState<LighthouseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (isInitialLoad.current) setLoading(true);
    try {
      const response = await sdk.fetchMarketLighthouse({});
      setData(response as LighthouseData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lighthouse data');
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    fetchData();
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
