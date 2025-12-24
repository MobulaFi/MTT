// src/store/useChainsAndProtocols.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMobulaClient } from '@/lib/mobulaClient';
import { SystemMetadataResponse } from '@mobula_labs/types';
import { usePulseFilterStore, Section } from '@/features/pulse/store/usePulseModalFilterStore';


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

interface CachedMetadata {
  chains: Chain[];
  chainProtocolMap: Record<string, Protocol[]>;
  timestamp: number;
}

const CACHE_KEY = 'mobula_chains_protocols_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Process SDK metadata response into chains and protocol map
 */
const processMetadata = (metadata: SystemMetadataResponse['data']) => {

  const chainMap = new Map<string, { name: string; label: string }>();
  const chainProtocolMap: Record<string, Protocol[]> = {};

  // Build chains from SDK response
  metadata.chains.forEach((chain) => {
    chainMap.set(chain.id, {
      name: chain.name,
      label: chain.name
    });
  });

  // Build protocol map from factories
  metadata.factories.forEach((factory) => {
    const chainId = factory.chainId;

    if (!chainProtocolMap[chainId]) {
      chainProtocolMap[chainId] = [];
    }

    chainProtocolMap[chainId].push({
      id: factory.address,
      name: factory.name || factory.address,
      icon: factory.logo || '',
      chainId,
    });
  });

  // Build chains array
  const chains: Chain[] = Array.from(chainMap).map(([id, data]) => ({
    id,
    name: data.name,
    label: data.label,
  }));

  return { chains, chainProtocolMap };
};


export const useChainsAndProtocols = (section: Section) => {
  const [chains, setChains] = useState<Chain[]>([]);
  const [chainProtocolMap, setChainProtocolMap] = useState<Record<string, Protocol[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentSection = usePulseFilterStore((state) => state.sections[section]);
  const chainIds = currentSection.chainIds;
  const selectedProtocols = currentSection.protocols;

  // Fetch metadata from SDK and cache in localStorage
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check localStorage for valid cache
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const parsed: CachedMetadata = JSON.parse(cached);
            const now = Date.now();
            const isExpired = now - parsed.timestamp > CACHE_EXPIRY;

            if (!isExpired) {
              setChains(parsed.chains);
              setChainProtocolMap(parsed.chainProtocolMap);
              setLoading(false);
              return;
            }
          } catch (parseError) {
            console.warn('Failed to parse cached metadata:', parseError);
          }
        }

        // Fetch from SDK
        const client = getMobulaClient();
        const response = await client.fetchSystemMetadata();

        if (!response || !response.data) {
          throw new Error('Invalid metadata response from SDK');
        }

        // Process metadata
        const { chains: newChains, chainProtocolMap: newMap } = processMetadata(response.data);

        // Cache in localStorage
        const cacheData: CachedMetadata = {
          chains: newChains,
          chainProtocolMap: newMap,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

        setChains(newChains);
        setChainProtocolMap(newMap);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch metadata';
        console.error('Error fetching metadata from SDK:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, []);

  const availableProtocolsForSelectedChains = useMemo(() => {
    if (chainIds.length === 0) return [];
    return chainIds.flatMap((id) => chainProtocolMap[id] || []);
  }, [chainIds, chainProtocolMap]);

  return {
    chains,
    chainProtocolMap,
    chainIds,
    selectedProtocols,
    availableProtocolsForSelectedChains,
    loading,
    error,
  };
};