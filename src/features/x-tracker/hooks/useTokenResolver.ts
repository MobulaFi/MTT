'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@/lib/sdkClient';

export interface ResolvedToken {
  name: string;
  symbol: string;
  chainId: string;
  address: string;
  poolAddress?: string;
  logo?: string;
}

// Module-level cache — shared across all tweets
const resolvedCache = new Map<string, ResolvedToken | null>();
const pendingLookups = new Set<string>();

// Regex patterns
const SYMBOL_RE = /\$([A-Za-z][A-Za-z0-9]{0,9})\b/g;
const EVM_ADDRESS_RE = /\b(0x[a-fA-F0-9]{40})\b/g;
const SOLANA_ADDRESS_RE = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;

// Common words that look like Solana addresses but aren't
const SOLANA_FALSE_POSITIVES = new Set([
  'https', 'http', 'twitter', 'status', 'photo', 'video',
]);

export function extractMatches(text: string): string[] {
  const matches = new Set<string>();

  // $SYMBOL
  let m: RegExpExecArray | null;
  SYMBOL_RE.lastIndex = 0;
  while ((m = SYMBOL_RE.exec(text)) !== null) {
    matches.add(`$${m[1].toUpperCase()}`);
  }

  // EVM addresses
  EVM_ADDRESS_RE.lastIndex = 0;
  while ((m = EVM_ADDRESS_RE.exec(text)) !== null) {
    matches.add(m[1].toLowerCase());
  }

  // Solana addresses (only standalone, not inside URLs)
  // Simple heuristic: skip if preceded by / or . (likely URL path)
  SOLANA_ADDRESS_RE.lastIndex = 0;
  while ((m = SOLANA_ADDRESS_RE.exec(text)) !== null) {
    const addr = m[1];
    if (addr.length < 32) continue;
    if (SOLANA_FALSE_POSITIVES.has(addr.toLowerCase())) continue;
    // Skip if this match is inside a URL
    const before = text.substring(Math.max(0, m.index - 10), m.index);
    if (/[\/\.]/.test(before.slice(-1))) continue;
    matches.add(addr);
  }

  return Array.from(matches);
}

async function resolveToken(query: string): Promise<ResolvedToken | null> {
  if (resolvedCache.has(query)) return resolvedCache.get(query)!;
  if (pendingLookups.has(query)) return null;

  pendingLookups.add(query);
  try {
    const input = query.startsWith('$') ? query.slice(1) : query;
    const response = await sdk.fetchSearchFast({ input } as any);
    const results = (response as { data?: any[] })?.data;

    if (!results || results.length === 0) {
      resolvedCache.set(query, null);
      return null;
    }

    const first = results[0];
    const resolved: ResolvedToken = {
      name: first.name || '',
      symbol: first.symbol || '',
      chainId: String(first.chainId || ''),
      address: first.address || '',
      poolAddress: first.poolAddress || undefined,
      logo: first.logo || undefined,
    };
    resolvedCache.set(query, resolved);
    return resolved;
  } catch {
    resolvedCache.set(query, null);
    return null;
  } finally {
    pendingLookups.delete(query);
  }
}

/**
 * Hook that extracts $SYMBOL and contract address mentions from tweet text
 * and resolves them to token data via fetchSearchFast.
 */
export function useTokenResolver(text: string): Map<string, ResolvedToken> {
  const [resolved, setResolved] = useState<Map<string, ResolvedToken>>(() => {
    // Initialize from cache
    const initial = new Map<string, ResolvedToken>();
    const matches = extractMatches(text);
    for (const match of matches) {
      const cached = resolvedCache.get(match);
      if (cached) initial.set(match, cached);
    }
    return initial;
  });

  useEffect(() => {
    const matches = extractMatches(text);
    if (matches.length === 0) return;

    let cancelled = false;

    const lookupAll = async () => {
      for (const match of matches) {
        if (cancelled) break;
        if (resolvedCache.has(match)) {
          const cached = resolvedCache.get(match);
          if (cached) {
            setResolved((prev) => {
              if (prev.has(match)) return prev;
              const next = new Map(prev);
              next.set(match, cached);
              return next;
            });
          }
          continue;
        }

        const result = await resolveToken(match);
        if (cancelled) break;
        if (result) {
          setResolved((prev) => {
            const next = new Map(prev);
            next.set(match, result);
            return next;
          });
        }
      }
    };

    lookupAll();
    return () => { cancelled = true; };
  }, [text]);

  return resolved;
}
