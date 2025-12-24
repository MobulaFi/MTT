'use client';

import dynamic from 'next/dynamic';

// Client component wrapper for lazy loading WalletPortfolioModal
const WalletPortfolioModal = dynamic(
  () => import('./WalletPortfolioModal').then(mod => ({ default: mod.WalletPortfolioModal })),
  { ssr: false }
);

export function WalletPortfolioModalWrapper() {
  return <WalletPortfolioModal />;
}
