'use client';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';

const RETRY_DELAYS = [1500, 3000, 5000];
const MAX_RETRIES = RETRY_DELAYS.length;

interface SafeImageProps {
  src: string;
  sizes?: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  quality?: number;
  fallbackSrc?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Validates and normalizes an image URL
 * @param url - The URL to validate
 * @returns Normalized URL or null if invalid
 */
export function validateImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = url.trim();
  
  if (!trimmed) {
    return null;
  }

  // If it's already a valid absolute URL, return it
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }

  // If it starts with //, add https:
  if (trimmed.startsWith('//')) {
    try {
      const normalized = `https:${trimmed}`;
      new URL(normalized);
      return normalized;
    } catch {
      return null;
    }
  }

  // If it looks like a domain without protocol (e.g., "metadata.mobula.io/...")
  if (trimmed.includes('.') && !trimmed.startsWith('/')) {
    try {
      const normalized = `https://${trimmed}`;
      new URL(normalized);
      return normalized;
    } catch {
      return null;
    }
  }

  // If it's a relative path starting with /, return as-is for Next.js
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return null;
}

/**
 * Safe Image component with automatic fallback handling and retry logic.
 * When an image fails to load (e.g. CF CDN not yet indexed), it retries
 * with increasing delays before falling back to the placeholder.
 */
export default function SafeImage({
  src,
  alt,
  width = 40,
  height = 40,
  sizes,
  fill = false,
  className = '',
  fallbackSrc = '/mobula.svg',
  quality,
  priority = false,
  onLoad,
  onError: onExternalError,
}: SafeImageProps) {
  const validatedSrc = validateImageUrl(src);
  const [imgSrc, setImgSrc] = useState<string>(() => validatedSrc || fallbackSrc);
  const [hasError, setHasError] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalSrcRef = useRef(validatedSrc);

  // Update when src prop changes (e.g. WS update brings a logo)
  useEffect(() => {
    const newValidated = validateImageUrl(src);
    if (newValidated && newValidated !== originalSrcRef.current) {
      // New source URL — reset retry state
      originalSrcRef.current = newValidated;
      retryCountRef.current = 0;
      setHasError(false);
      setImgSrc(newValidated);
    } else if (!newValidated && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
  }, [src, fallbackSrc, imgSrc]);

  // Clean up pending retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const handleLoad = useCallback(() => {
    // Image loaded successfully — clear any pending retry
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    const original = originalSrcRef.current;

    if (retryCountRef.current < MAX_RETRIES && original) {
      // Schedule a retry with cache-busting query param
      const attempt = retryCountRef.current;
      const delay = RETRY_DELAYS[attempt] ?? 5000;
      retryCountRef.current = attempt + 1;

      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        const separator = original.includes('?') ? '&' : '?';
        setImgSrc(`${original}${separator}_r=${attempt + 1}&_t=${Date.now()}`);
      }, delay);
      return;
    }

    // All retries exhausted — fall back
    if (!hasError && imgSrc !== fallbackSrc) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
    onExternalError?.();
  }, [hasError, imgSrc, fallbackSrc, onExternalError]);

  const imageDimensions = fill
    ? { fill: true as const }
    : { width, height };

  return (
    <Image
      src={imgSrc}
      alt={alt}
      {...imageDimensions}
      sizes={sizes}
      quality={quality}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      priority={priority}
      unoptimized={hasError || retryCountRef.current > 0}
    />
  );
}

/**
 * Alternative: Avatar component with initials fallback
 */
export function SafeAvatar({
  src,
  alt,
  size = 40,
  className = '',
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  const validatedSrc = validateImageUrl(src);
  const [imgSrc, setImgSrc] = useState<string | null>(() => validatedSrc);
  const [hasError, setHasError] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalSrcRef = useRef(validatedSrc);

  useEffect(() => {
    const newValidated = validateImageUrl(src);
    if (newValidated && newValidated !== originalSrcRef.current) {
      originalSrcRef.current = newValidated;
      retryCountRef.current = 0;
      setImgSrc(newValidated);
      setHasError(false);
    }
  }, [src]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const handleError = useCallback(() => {
    const original = originalSrcRef.current;

    if (retryCountRef.current < MAX_RETRIES && original) {
      const attempt = retryCountRef.current;
      const delay = RETRY_DELAYS[attempt] ?? 5000;
      retryCountRef.current = attempt + 1;

      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        const separator = original.includes('?') ? '&' : '?';
        setImgSrc(`${original}${separator}_r=${attempt + 1}&_t=${Date.now()}`);
      }, delay);
      return;
    }

    if (!hasError) {
      setHasError(true);
      setImgSrc(null);
    }
  }, [hasError]);

  // Get initials from alt text
  const getInitials = (text: string): string => {
    const words = text.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  if (!imgSrc || hasError) {
    // Fallback to styled circle with initials and blue accent
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-[#0a0f1a] border border-blue-500/50 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        <span className="text-blue-400 font-semibold tracking-wide select-none">
          {getInitials(alt)}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={handleError}
      unoptimized={retryCountRef.current > 0}
    />
  );
}