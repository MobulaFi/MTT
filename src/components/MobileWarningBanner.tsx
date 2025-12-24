'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

import { useIsMobile } from '@/hooks/useIsMobile';

const STORAGE_KEY = 'mtt-mobile-warning-dismissed';

export const MobileWarningBanner = () => {
  const isMobile = useIsMobile();
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    setIsDismissed(storedValue === 'true');
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    window.localStorage.setItem(STORAGE_KEY, 'true');
  };

  if (!isMobile || isDismissed === null || isDismissed) {
    return null;
  }

  return (
    <div className="bg-amber-400 text-[#1f1f1f] text-xs sm:text-sm px-3 py-2 flex gap-2 items-start border-b border-amber-300">
      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <div className="flex-1 leading-snug">
        Mobula Trading Terminal is not optimized for mobile yet. Please use a desktop device for the best experience.
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 text-[#1f1f1f]/70 hover:text-[#1f1f1f] transition-colors"
        aria-label="Dismiss mobile warning banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
