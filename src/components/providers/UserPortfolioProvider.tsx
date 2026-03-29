'use client';

import { useUserPortfolioProvider } from '@/hooks/useUserPortfolioProvider';

/**
 * Invisible provider component — mount once in layout.
 * Manages portfolio fetching, polling, and WSS subscriptions.
 */
export function UserPortfolioProvider() {
  useUserPortfolioProvider();
  return null;
}
