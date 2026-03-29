'use client';

import dynamic from 'next/dynamic';

const SurgePageClient = dynamic(
  () => import('@/features/surge/components/SurgePageClient'),
  { ssr: false }
);

export default function SurgePage() {
  return <SurgePageClient />;
}
