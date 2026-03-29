'use client';

import dynamic from 'next/dynamic';

const PulsePageClient = dynamic(
  () => import('@/features/pulse/components/PulsePageClient'),
  { ssr: false }
);

export default function PulsePage() {
  return <PulsePageClient />;
}
