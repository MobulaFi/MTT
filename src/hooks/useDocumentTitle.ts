'use client';
import { useEffect, useRef } from 'react';

/**
 * Reactive document title hook.
 * Updates the title whenever the input changes.
 * Automatically restores the previous title on unmount.
 */
export function useDocumentTitle(title?: string) {
  const previousTitle = useRef<string>('');

  useEffect(() => {
    if (!previousTitle.current) {
      previousTitle.current = document.title;
    }

    if (!title) return;
    document.title = title;

    return () => {
      // restore previous title (not hardcoded)
      document.title = previousTitle.current || 'Mobula';
    };
  }, [title]);
}