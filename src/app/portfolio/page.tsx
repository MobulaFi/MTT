'use client';

import dynamic from 'next/dynamic';

const PortfolioPageClient = dynamic(
  () => import('@/features/portfolio/components/PortfolioPageClient'),
  { ssr: false }
);

export default function PortfolioPage() {
  return <PortfolioPageClient />;
}
