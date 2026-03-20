'use client';

import { useEffect, useRef } from 'react';
import { getClientSdk, streams as streamWrapper } from '@/lib/sdkClient';
import { usePairHoldersStore } from '@/features/pair/store/usePairHolderStore';
import type { TokenPositionsOutputResponse } from '@mobula_labs/types';

/**
 * Subscribe to the holders WebSocket stream for a given token.
 *
 * 1. Immediately fetches holders via HTTP for fast first paint
 * 2. Subscribes to the WS stream for real-time updates
 * 3. Stream sends init (snapshot), update (per-holder delta), sync (DB resync every 30s)
 */
export const useCombinedHolders = (
  tokenAddress: string,
  blockchain: string,
  tokenPrice?: number,
  totalSupply?: number,
) => {
  const {
    setHolders,
    setHoldersCount,
    setBlockchain,
    clearHolders,
    setLoading,
    setTokenPrice,
    setTotalSupply,
    upsertHolder,
    removeHolder,
  } = usePairHoldersStore();

  // Batch holder updates per animation frame to avoid per-message re-renders
  const pendingUpdates = useRef(new Map<string, TokenPositionsOutputResponse>());
  const rafScheduled = useRef(false);

  useEffect(() => {
    if (!tokenAddress || !blockchain) return;

    clearHolders();
    setBlockchain(blockchain);
    if (tokenPrice) setTokenPrice(tokenPrice);
    if (totalSupply) setTotalSupply(totalSupply);
    setLoading(true);
    pendingUpdates.current.clear();
    rafScheduled.current = false;

    let cancelled = false;
    let httpLoaded = false;

    // 1. Fast HTTP fetch for immediate display
    fetch(
      `https://api.mobula.io/api/2/token/holder-positions?address=${encodeURIComponent(tokenAddress)}&blockchain=${encodeURIComponent(blockchain)}&limit=100`,
      {
        headers: {
          Authorization: getClientSdk().apiKey || '',
        },
      },
    )
      .then((res) => res.json())
      .then((json: { data?: TokenPositionsOutputResponse[]; totalCount?: number }) => {
        if (cancelled) return;
        const holders = json.data || [];
        if (holders.length > 0) {
          httpLoaded = true;
          setHoldersCount(json.totalCount ?? holders.length);
          setHolders(holders);
          setLoading(false);
        }
      })
      .catch(() => {
        // HTTP failed — stream will provide data
      });

    // 2. WS stream for real-time updates (will also send init snapshot)
    // Use the streams wrapper so it auto-routes to SSE in server mode
    const sub = streamWrapper.subscribe(
      'holders',
      { tokens: [{ address: tokenAddress, blockchain }] },
      (msg: unknown) => {
        if (cancelled) return;

        const message = msg as {
          type?: string;
          event?: string;
          data?: {
            tokenKey?: string;
            holders?: TokenPositionsOutputResponse[];
          } & TokenPositionsOutputResponse;
          subscriptionId?: string;
        };

        const type = message.type || message.event;

        switch (type) {
          case 'init': {
            const holders = message.data?.holders || [];
            // If HTTP already loaded, only use init if it has more/fresher data
            if (!httpLoaded || holders.length > 0) {
              setHoldersCount(holders.length);
              setHolders(holders);
            }
            setLoading(false);
            break;
          }

          case 'update': {
            const data = message.data;
            if (!data?.walletAddress) break;

            // Batch updates via rAF to avoid per-message re-renders
            pendingUpdates.current.set(data.walletAddress, data as TokenPositionsOutputResponse);
            if (!rafScheduled.current) {
              rafScheduled.current = true;
              requestAnimationFrame(() => {
                rafScheduled.current = false;
                const batch = pendingUpdates.current;
                if (batch.size === 0) return;
                const { holders } = usePairHoldersStore.getState();
                const updated = [...holders];
                for (const [wallet, pos] of batch) {
                  const balance = Number(pos.tokenAmount) || 0;
                  if (balance <= 0) {
                    const idx = updated.findIndex((h) => h.walletAddress.toLowerCase() === wallet.toLowerCase());
                    if (idx >= 0) updated.splice(idx, 1);
                  } else {
                    const idx = updated.findIndex((h) => h.walletAddress.toLowerCase() === wallet.toLowerCase());
                    if (idx >= 0) {
                      updated[idx] = pos;
                    } else {
                      updated.push(pos);
                    }
                  }
                }
                batch.clear();
                usePairHoldersStore.setState({ holders: updated });
              });
            }
            break;
          }

          case 'sync': {
            const holders = message.data?.holders || [];
            setHoldersCount(holders.length);
            setHolders(holders);
            break;
          }

          case 'subscribed':
          case 'error':
            if (type === 'error') setLoading(false);
            break;

          default:
            break;
        }
      },
    );

    return () => {
      cancelled = true;
      sub.unsubscribe();
      clearHolders();
      setLoading(false);
    };
    // Only re-subscribe when token/blockchain change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAddress, blockchain]);

  // Keep tokenPrice in sync with market data for real-time USD recalculation
  useEffect(() => {
    if (tokenPrice && tokenPrice > 0) {
      setTokenPrice(tokenPrice);
    }
  }, [tokenPrice, setTokenPrice]);

  // Keep totalSupply in sync
  useEffect(() => {
    if (totalSupply && totalSupply > 0) {
      setTotalSupply(totalSupply);
    }
  }, [totalSupply, setTotalSupply]);

  return usePairHoldersStore();
};
