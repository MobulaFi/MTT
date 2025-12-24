'use client';

/**
 * Extracts blockchain identifier from URL path
 * Supports formats like:
 * - /pair/evm:8453/0x...
 * - /token/evm:8453/0x...
 * - /pair/solana:solana/...
 */
export function getBlockchainFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const path = window.location.pathname;
  
  // Match patterns like /pair/evm:8453/... or /token/evm:8453/...
  const match = path.match(/\/(pair|token)\/([^/]+)/);
  
  if (match && match[2]) {
    return match[2];
  }
  
  return null;
}

