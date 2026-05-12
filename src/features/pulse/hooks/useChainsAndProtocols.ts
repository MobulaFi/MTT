'use client';

import { useEffect, useMemo } from 'react';
import { usePulseFilterStore, Section } from '@/features/pulse/store/usePulseModalFilterStore';
import {
  useSystemMetadataStore,
  type Chain,
  type Protocol,
} from '@/store/useSystemMetadataStore';

export type { Chain, Protocol };


export const useChainsAndProtocols = (section: Section) => {
  const chains = useSystemMetadataStore((state) => state.chains);
  const protocols = useSystemMetadataStore((state) => state.protocols);
  const chainProtocolMap = useSystemMetadataStore((state) => state.chainProtocolMap);
  const loading = useSystemMetadataStore((state) => state.loading);
  const error = useSystemMetadataStore((state) => state.error);
  const hasRequested = useSystemMetadataStore((state) => state.hasRequested);
  const refreshSystemMetadata = useSystemMetadataStore((state) => state.refreshSystemMetadata);

  const currentSection = usePulseFilterStore((state) => state.sections[section]);
  const chainIds = currentSection.chainIds;
  const selectedProtocols = currentSection.protocols;

  useEffect(() => {
    if (chains.length > 0 || loading || hasRequested) return;
    void refreshSystemMetadata();
  }, [chains.length, hasRequested, loading, refreshSystemMetadata]);

  const availableProtocolsForSelectedChains = useMemo(() => {
    if (chainIds.length === 0) return [];
    return chainIds.flatMap((id) => chainProtocolMap[id] || []);
  }, [chainIds, chainProtocolMap]);

  return {
    chains,
    protocols,
    chainProtocolMap,
    chainIds,
    selectedProtocols,
    availableProtocolsForSelectedChains,
    loading,
    error,
  };
};