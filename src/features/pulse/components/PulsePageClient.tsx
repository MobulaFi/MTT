'use client';

import { UnifiedStreamProvider } from '@/features/pulse/context/UnifiedStreamContext';
import PulseHeader from './PulseHeader';
import TokenSection from './TokenSection';

export default function PulsePageClient() {
  return (
    <UnifiedStreamProvider>
      <div style={{ background: '#0E0E12', minHeight: 'calc(100vh - 200px)', width: '100%', overflow: 'hidden' }}>
        <PulseHeader />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0,
          borderTop: '1px solid #1A1A1E',
          width: '100%',
          overflow: 'hidden',
        }}>
          <div style={{ borderRight: '1px solid #111114', minWidth: 0, overflow: 'hidden' }}>
            <TokenSection title="New Pairs" viewName="new" />
          </div>
          <div style={{ borderRight: '1px solid #111114', minWidth: 0, overflow: 'hidden' }}>
            <TokenSection title="Final Stretch" viewName="bonding" />
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <TokenSection title="Migrated" viewName="bonded" shouldBonded />
          </div>
        </div>
      </div>
    </UnifiedStreamProvider>
  );
}
