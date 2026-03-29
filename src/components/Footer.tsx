'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ThemeHoverCard } from '@/components/ThemeHoverCard';
import { useLighthouseStore } from '@/features/lighthouse/store/useLighthouseStore';
import { useXTrackerStore } from '@/features/x-tracker/store/useXTrackerStore';
import { useReclaimATAStore } from '@/store/useReclaimATAStore';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';

const LighthousePopover = dynamic(
  () => import('@/features/lighthouse/components/LighthousePopover').then((m) => ({ default: m.LighthousePopover })),
  { ssr: false },
);

const XTrackerPanel = dynamic(
  () => import('@/features/x-tracker/components/XTrackerPanel').then((m) => ({ default: m.XTrackerPanel })),
  { ssr: false },
);

const links = [
  { name: 'Support', href: 'https://t.me/mobuladevelopers' },
];

export function Footer() {
  const [isLighthouseOpen, setIsLighthouseOpen] = useState(false);
  const lighthouseContainerRef = useRef<HTMLDivElement>(null);

  const lighthouseIsFloating = useLighthouseStore((s) => s.isFloating);
  const setLighthouseFloating = useLighthouseStore((s) => s.setFloating);

  const xTrackerIsFloating = useXTrackerStore((s) => s.isFloating);
  const setXTrackerFloating = useXTrackerStore((s) => s.setFloating);

  const openReclaimATA = useReclaimATAStore((s) => s.open);
  const reclaimIsOpen = useReclaimATAStore((s) => s.isOpen);
  const isSolanaConnected = useWalletConnectionStore((s) => s.isSolanaConnected);

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
      <footer className="w-full border-t border-borderDefault bg-bgPrimary py-2 sm:py-2.5 px-4 sm:px-6 lg:px-8 flex items-center justify-between mt-auto">
        <div className="flex items-center space-x-4 sm:space-x-5">
          <Image src="/hawk.jpg" alt="Hawk Logo" width={28} height={28} priority className="rounded-full" />
          <ThemeHoverCard />
          <div ref={lighthouseContainerRef} className="relative">
            <button
              onClick={handleLighthouseToggle}
              className={`text-[12px] sm:text-[13px] tracking-wide transition-colors ${
                isLighthouseOpen || lighthouseIsFloating ? 'text-success font-semibold' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Lighthouse
            </button>
            <LighthousePopover isOpen={isLighthouseOpen || lighthouseIsFloating} onClose={() => { setIsLighthouseOpen(false); setLighthouseFloating(false); }} />
          </div>
          <button
            onClick={handleXTrackerToggle}
            className={`text-[12px] sm:text-[13px] tracking-wide transition-colors ${
              xTrackerIsFloating ? 'text-success font-semibold' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            Tracker
          </button>
          {isSolanaConnected && (
            <button
              onClick={openReclaimATA}
              className={`text-[12px] sm:text-[13px] tracking-wide transition-colors ${
                reclaimIsOpen ? 'text-success font-semibold' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Reclaim ATA
            </button>
          )}
        </div>
        <div className="flex items-center space-x-5 text-[12px] sm:text-[13px] font-normal text-textSecondary">
          {links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-textPrimary transition-colors tracking-wide"
            >
              {link.name}
            </Link>
          ))}
          <Link
            href="https://docs.mobula.io/introduction"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-textTertiary hover:text-textSecondary transition-colors"
          >
            <span className="text-[10px] sm:text-[11px] tracking-wider">Powered by</span>
            <Image src="/mobula.svg" alt="Mobula" width={13} height={13} className="opacity-40" />
            <span className="text-[10px] sm:text-[11px] tracking-wider">Mobula</span>
            <span className="text-[10px] sm:text-[11px] text-textTertiary/40 mx-0.5">|</span>
            <span className="text-[10px] sm:text-[11px] tracking-wider">Get Data</span>
          </Link>
        </div>
      </footer>
      {/* Floating panels rendered outside footer */}
      {xTrackerIsFloating && <XTrackerPanel />}
    </>
  );
}
