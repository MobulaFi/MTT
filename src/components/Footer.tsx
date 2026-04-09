'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ThemeHoverCard } from '@/components/ThemeHoverCard';
import { useLighthouseStore } from '@/features/lighthouse/store/useLighthouseStore';
import { useXTrackerStore } from '@/features/x-tracker/store/useXTrackerStore';

const LighthousePopover = dynamic(
  () => import('@/features/lighthouse/components/LighthousePopover').then((m) => ({ default: m.LighthousePopover })),
  { ssr: false },
);

const XTrackerPanel = dynamic(
  () => import('@/features/x-tracker/components/XTrackerPanel').then((m) => ({ default: m.XTrackerPanel })),
  { ssr: false },
);

const links = [
  { name: 'Docs', href: 'https://docs.mobula.io/introduction' },
  { name: 'Support', href: 'https://t.me/mobuladevelopers' },
];

export function Footer() {
  const [isLighthouseOpen, setIsLighthouseOpen] = useState(false);
  const lighthouseContainerRef = useRef<HTMLDivElement>(null);

  const lighthouseIsFloating = useLighthouseStore((s) => s.isFloating);
  const setLighthouseFloating = useLighthouseStore((s) => s.setFloating);

  const xTrackerIsFloating = useXTrackerStore((s) => s.isFloating);
  const setXTrackerFloating = useXTrackerStore((s) => s.setFloating);

  // Click-outside for non-floating lighthouse popover
  useEffect(() => {
    if (!isLighthouseOpen || lighthouseIsFloating) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (lighthouseContainerRef.current && !lighthouseContainerRef.current.contains(e.target as Node)) {
        setIsLighthouseOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLighthouseOpen, lighthouseIsFloating]);

  const handleLighthouseToggle = () => {
    if (lighthouseIsFloating) {
      // Close floating
      setLighthouseFloating(false);
      setIsLighthouseOpen(false);
    } else if (isLighthouseOpen) {
      // Close anchored
      setIsLighthouseOpen(false);
    } else {
      // Open floating
      setLighthouseFloating(true);
      setIsLighthouseOpen(true);
    }
  };

  const handleXTrackerToggle = () => {
    setXTrackerFloating(!xTrackerIsFloating);
  };

  return (
    <>
      <footer className="w-full border-y border-borderDefault bg-bgPrimary py-[6px] px-4 flex items-center justify-between mt-auto">
        <div className="flex items-center space-x-3">
          <Link href="https://mobula.io/" target="_blank" rel="noopener noreferrer">
            <Image src="/mobula.svg" alt="Mobula Logo" width={15} height={15} priority />
          </Link>
          <ThemeHoverCard />
          <div ref={lighthouseContainerRef} className="relative">
            <button
              onClick={handleLighthouseToggle}
              className={`text-xs transition-colors ${
                isLighthouseOpen || lighthouseIsFloating ? 'text-success font-semibold' : 'text-textPrimary hover:text-success'
              }`}
            >
              Lighthouse
            </button>
            <LighthousePopover isOpen={isLighthouseOpen || lighthouseIsFloating} onClose={() => { setIsLighthouseOpen(false); setLighthouseFloating(false); }} />
          </div>
          <button
            onClick={handleXTrackerToggle}
            className={`text-xs transition-colors ${
              xTrackerIsFloating ? 'text-success font-semibold' : 'text-textPrimary hover:text-success'
            }`}
          >
            X Tracker
          </button>
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
      {/* Floating panels rendered outside footer */}
      {xTrackerIsFloating && <XTrackerPanel />}
    </>
  );
}
