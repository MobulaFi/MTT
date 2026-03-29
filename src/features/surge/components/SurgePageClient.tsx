'use client';

import { useSurgeData } from '../hooks/useSurgeData';
import { useSurgeStore } from '../store/useSurgeStore';
import SurgeHeader from './SurgeHeader';
import SurgeTokenCard from './SurgeTokenCard';

function SurgeCardSkeleton() {
  return (
    <div style={{ background: '#0A0A0D', border: '1px solid #141418', borderRadius: 2, overflow: 'hidden' }} className="animate-pulse">
      {/* Top row */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#111114', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 60, height: 14, borderRadius: 2, background: '#111114' }} />
            <div style={{ width: 40, height: 14, borderRadius: 2, background: '#111114' }} />
          </div>
          <div style={{ width: 100, height: 10, borderRadius: 2, background: '#111114' }} />
        </div>
        <div style={{ width: 80, height: 20, borderRadius: 2, background: '#111114' }} />
      </div>
      {/* Chart area */}
      <div style={{ height: 80, margin: '0 16px', borderRadius: 2, background: '#111114' }} />
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, padding: '10px 16px' }}>
        <div style={{ width: 60, height: 12, borderRadius: 2, background: '#111114' }} />
        <div style={{ width: 50, height: 12, borderRadius: 2, background: '#111114' }} />
        <div style={{ width: 40, height: 12, borderRadius: 2, background: '#111114' }} />
      </div>
      {/* Holdings */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 24, borderRadius: 2, background: '#111114' }} />
        ))}
      </div>
      {/* Bottom bar */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 16px', borderTop: '1px solid #141418' }}>
        <div style={{ flex: 1 }} />
        <div style={{ width: 70, height: 26, borderRadius: 2, background: '#111114' }} />
        <div style={{ width: 50, height: 26, borderRadius: 2, background: '#111114' }} />
      </div>
    </div>
  );
}

export default function SurgePageClient() {
  const { isConnected } = useSurgeData();
  const tokens = useSurgeStore((s) => s.tokens);
  const loading = useSurgeStore((s) => s.loading);
  const error = useSurgeStore((s) => s.error);

  const showSkeletons = loading && tokens.length === 0;

  if (error && tokens.length === 0) {
    return (
      <div style={{ background: '#08080A', minHeight: 'calc(100vh - 200px)' }}>
        <SurgeHeader />
        <div style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: '#FF4757', fontSize: 13 }}>Error loading surge data: {error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, color: '#4A4A52', fontSize: 12, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#08080A', minHeight: 'calc(100vh - 200px)' }}>
      <SurgeHeader />

      <div style={{
        padding: '0 24px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
      }}>
        {showSkeletons ? (
          Array.from({ length: 20 }).map((_, i) => (
            <SurgeCardSkeleton key={i} />
          ))
        ) : tokens.length > 0 ? (
          tokens.map((token, index) => (
            <SurgeTokenCard
              key={`${token.address}-${token.chainId}`}
              token={token}
              rank={index + 1}
            />
          ))
        ) : (
          <div style={{
            gridColumn: '1 / -1',
            padding: 48,
            textAlign: 'center',
            color: '#4A4A52',
            fontSize: 13,
            border: '1px solid #1A1A1E',
            borderRadius: 2,
          }}>
            No tokens found. Try adjusting your filters.
          </div>
        )}
      </div>
    </div>
  );
}
