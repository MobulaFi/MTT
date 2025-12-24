'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MoveUpRight } from 'lucide-react';
import { getThemeFromBgColor } from '@/lib/embed/validateEmbedParams';

interface EmbedBrandingProps {
  bgColor?: string;
}

export function EmbedBranding({ bgColor }: EmbedBrandingProps) {
  const theme = getThemeFromBgColor(bgColor);
  const textColor = theme === 'light' ? '#000000' : '#FFFFFF';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '6px',
        backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(18, 19, 25, 0.95)',
        borderTop: `1px solid ${theme === 'light' ? '#E5E7EB' : '#374151'}`,
        zIndex: 1000,
      }}
    >
      <Image
        src="/mobula.svg"
        alt="Mobula"
        width={14}
        height={14}
        style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}
      />
      <span style={{ fontSize: '11px', color: textColor, fontWeight: 400, verticalAlign: 'middle' }}>
        Powered by
      </span>
      <Link
        href="https://mobula.io"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          textDecoration: 'none',
          color: '#18C722',
          fontSize: '11px',
          fontWeight: 600,
          transition: 'opacity 0.2s',
          verticalAlign: 'middle',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        <span>Mobula</span>
        <MoveUpRight size={11} style={{ flexShrink: 0 }} />
      </Link>
    </div>
  );
}

