'use client';

import { useEffect, useMemo, useState } from 'react';
import { REST_ENDPOINTS, DEFAULT_REST_ENDPOINT } from '@/config/endpoints';
import { useSurgeStore } from '../store/useSurgeStore';

export interface Chain {
  id: string;
  name: string;
  label: string;
  logo?: string;
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

const CACHE_KEY = 'mobula_surge_metadata_v4';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;


function getRestUrl(): string {
  const d = REST_ENDPOINTS[DEFAULT_REST_ENDPOINT];
  let u = process.env.NEXT_PUBLIC_MOBULA_API_URL || d;
  if (typeof document !== 'undefined') {
    const c = document.cookie.split('; ').find(c => c.trim().startsWith('customRestUrl='));
    if (c) { const v = decodeURIComponent(c.split('=')[1]).trim(); if (v) u = v; }
  }
  return u;
}

function getApiKey(): string {
  try {
    const r = localStorage.getItem('mobula-api-storage');
    if (r) { const p = JSON.parse(r) as { state?: { apiKey?: string } }; const k = p.state?.apiKey; if (k?.trim()) return k.trim(); }
  } catch { /* */ }
  return process.env.NEXT_PUBLIC_MOBULA_API_KEY || '';
}

export function useSurgeMetadata() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [chainProtocolMap, setChainProtocolMap] = useState<Record<string, Protocol[]>>({});
  const [loading, setLoading] = useState(true);

  const selectedChainIds = useSurgeStore((s) => s.selectedChainIds);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);

        // Check localStorage cache
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const parsed: CachedMetadata = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_EXPIRY) {
              setChains(parsed.chains);
              setChainProtocolMap(parsed.chainProtocolMap);
              setLoading(false);
              return;
            }
          } catch { /* invalid cache */ }
        }

        // Fetch from system-metadata v2
        const url = `${getRestUrl()}/api/2/system-metadata?chains=true&factories=true&indexed=true&status=APPROVED`;
        const res = await fetch(url, { headers: { Authorization: getApiKey() } });
        if (!res.ok) throw new Error(`system-metadata v2 failed: ${res.status}`);
        const json = await res.json();
        const data = json.data;

        // Process chains
        const newChains: Chain[] = (data.chains || []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          label: c.name as string,
          logo: (((c.branding as Record<string, string> | undefined)?.logo) || '').replace('https://metacore.mobula.io/', 'https://metadata.mobula.io/'),
        }));

        // Process factories into protocol map keyed by chainId (only those with a real name)
        const newMap: Record<string, Protocol[]> = {};
        (data.factories || []).forEach((f: Record<string, unknown>) => {
          const cid = f.chainId as string;
          const meta = f.metadata as Record<string, string> | undefined;
          const name = meta?.ui_name || (f.name as string) || '';
          // Skip factories that have no real name (only address or empty)
          if (!name || name === (f.address as string)) return;
          if (!newMap[cid]) newMap[cid] = [];
          newMap[cid].push({
            id: f.address as string,
            name,
            icon: meta?.logo || '',
            chainId: cid,
          });
        });

        // Cache in localStorage
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          chains: newChains,
          chainProtocolMap: newMap,
          timestamp: Date.now(),
        } satisfies CachedMetadata));

        setChains(newChains);
        setChainProtocolMap(newMap);
      } catch (err) {
        console.error('[SurgeMetadata] Failed to fetch system-metadata v2:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, []);

  // Protocols available for selected chains (or all if no chain selected)
  const availableProtocols = useMemo(() => {
    if (selectedChainIds.length === 0) {
      return Object.values(chainProtocolMap).flat();
    }
    return selectedChainIds.flatMap((id) => chainProtocolMap[id] || []);
  }, [selectedChainIds, chainProtocolMap]);

  return { chains, chainProtocolMap, availableProtocols, loading };
}
