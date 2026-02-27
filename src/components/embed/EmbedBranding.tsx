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
  const isLight = theme === 'light';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: isLight
          ? 'rgba(255, 255, 255, 0.95)'
          : 'rgba(18, 19, 25, 0.95)',
        borderTop: `1px solid ${isLight ? '#E5E7EB' : '#374151'}`,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
          fontSize: '11px',
          lineHeight: '1',
        }}
      >
        <span
          style={{
            color: isLight ? '#000' : '#FFF',
            fontWeight: 400,
          }}
        >
          Powered by
        </span>

        <Image
          src={isLight ? '/mobula-dark.svg' : '/mobula.svg'}
          alt="Mobula"
          width={14}
          height={14}
          style={{ flexShrink: 0 }}
        />

        <Link
          href="https://mobula.io"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: '#18C722',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <span>Mobula</span>
        </Link>
      </div>
    </div>
  );
}
