'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ThemeHoverCard } from '@/components/ThemeHoverCard';

const LighthousePopover = dynamic(
  () => import('@/features/lighthouse/components/LighthousePopover').then((m) => ({ default: m.LighthousePopover })),
  { ssr: false },
);

const links = [
  { name: 'Docs', href: 'https://docs.mobula.io/introduction' },
  { name: 'Support', href: 'https://t.me/mobuladevelopers' },
];

export function Footer() {
  const [isLighthouseOpen, setIsLighthouseOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLighthouseOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsLighthouseOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLighthouseOpen]);

  return (
    <footer className="w-full border-y border-borderDefault bg-bgPrimary py-[6px] px-4 flex items-center justify-between mt-auto">
      <div className="flex items-center space-x-3">
        <Link href="https://mobula.io/" target="_blank" rel="noopener noreferrer">
          <Image src="/mobula.svg" alt="Mobula Logo" width={15} height={15} priority />
        </Link>
        <ThemeHoverCard />
        <div ref={containerRef} className="relative">
          <button
            onClick={() => setIsLighthouseOpen((prev) => !prev)}
            className={`text-xs transition-colors ${
              isLighthouseOpen ? 'text-success font-semibold' : 'text-textPrimary hover:text-success'
            }`}
          >
            Lighthouse
          </button>
          <LighthousePopover isOpen={isLighthouseOpen} onClose={() => setIsLighthouseOpen(false)} />
        </div>
      </div>
      <div className="flex space-x-6 text-xs font-normal text-textPrimary">
        {links.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-success transition-colors"
          >
            {link.name}
          </Link>
        ))}
      </div>
    </footer>
  );
}
