'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { sdk } from '@/lib/sdkClient';
import type { SystemMetadataResponse } from '@mobula_labs/types';

export interface Chain {
  id: string;
  name: string;
  label: string;
}

export interface Protocol {
  id: string;
  name: string;
  icon: string;
  chainId?: string;
}

interface SystemMetadataStoreState {
  chains: Chain[];
  protocols: Protocol[];
  chainProtocolMap: Record<string, Protocol[]>;
  loading: boolean;
  error: string | null;
  hasRequested: boolean;
  refreshSystemMetadata: () => Promise<void>;
}

let refreshPromise: Promise<void> | null = null;

const processMetadata = (metadata: SystemMetadataResponse['data']) => {
  const chainMap = new Map<string, { name: string; label: string }>();
  const protocols: Protocol[] = [];
  const chainProtocolMap: Record<string, Protocol[]> = {};

  metadata.chains.forEach((chain) => {
    chainMap.set(chain.id, {
      name: chain.name,
      label: chain.name,
    });
  });

  metadata.factories.forEach((factory) => {
    const chainId = factory.chainId;

    if (!chainProtocolMap[chainId]) {
      chainProtocolMap[chainId] = [];
    }

    const protocol: Protocol = {
      id: factory.address,
      name: factory.name || factory.address,
      icon: factory.logo || '',
      chainId,
    };

    protocols.push(protocol);
    chainProtocolMap[chainId].push(protocol);
  });

  const chains: Chain[] = Array.from(chainMap).map(([id, data]) => ({
    id,
    name: data.name,
    label: data.label,
  }));

  return { chains, protocols, chainProtocolMap };
};

export const useSystemMetadataStore = create<SystemMetadataStoreState>()(
  devtools(
    (set) => ({
      chains: [],
      protocols: [],
      chainProtocolMap: {},
      loading: false,
      error: null,
      hasRequested: false,

      refreshSystemMetadata: async () => {
        if (refreshPromise) return refreshPromise;

        refreshPromise = (async () => {
          try {
            set({ loading: true, error: null, hasRequested: true });

            const response = await sdk.fetchSystemMetadata() as SystemMetadataResponse;

            if (!response?.data) {
              throw new Error('Invalid metadata response from SDK');
            }

            const { chains, protocols, chainProtocolMap } = processMetadata(response.data);

            set({
              chains,
              protocols,
              chainProtocolMap,
              loading: false,
              error: null,
            });
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch metadata';
            console.error('Error fetching metadata from SDK:', err);
            set({ loading: false, error: errorMessage });
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },
    }),
    { name: 'SystemMetadataStore' }
  )
);
