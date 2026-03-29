'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalErrorBoundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ padding: 40, fontFamily: 'monospace', color: '#fff', background: '#1a1a2e', margin: 0 }}>
        <h2 style={{ color: '#ff6b6b', marginBottom: 16 }}>Global Error</h2>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 14, color: '#ffd93d', marginBottom: 16 }}>
          {error.message}
        </pre>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 11, color: '#999', marginBottom: 24 }}>
          {error.stack}
        </pre>
        <button
          onClick={reset}
          style={{ padding: '8px 24px', background: '#0ECB81', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}
