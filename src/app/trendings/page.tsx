'use client';

import dynamic from 'next/dynamic';

const TrendingPageClient = dynamic(
  () => import('@/features/trending/components/TrendingPageClient'),
  { ssr: false }
);

export default function TrendingsPage() {
  return <TrendingPageClient />;
}
