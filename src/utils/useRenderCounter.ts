/**
 * Render counter hook for performance diagnostics
 * Logs render count and component name to console
 */
import { useRef, useEffect } from 'react';

export function useRenderCounter(name: string) {
  const ref = useRef(0);
  useEffect(() => {
    ref.current++;
    console.log(`[render:${name}]`, ref.current);
  });
  return ref.current;
}

