'use client';

import dynamic from 'next/dynamic';

const ReclaimATAModal = dynamic(
  () =>
    import('./ReclaimATAModal').then((mod) => ({
      default: mod.ReclaimATAModal,
    })),
  { ssr: false },
);

export function ReclaimATAModalWrapper() {
  return <ReclaimATAModal />;
}
