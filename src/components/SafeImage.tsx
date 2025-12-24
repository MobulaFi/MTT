'use client';
import Image from 'next/image';
import { useState, useEffect } from 'react';

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
 * Safe Image component with automatic fallback handling
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
  quality ,
  priority = false,
  onLoad,
  onError: onExternalError,
}: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(() => {
    const validatedSrc = validateImageUrl(src);
    return validatedSrc || fallbackSrc;
  });
  const [hasError, setHasError] = useState(false);

  // Update imgSrc when src prop changes
  useEffect(() => {
    const validatedSrc = validateImageUrl(src);
    if (validatedSrc && validatedSrc !== imgSrc && !hasError) {
      setImgSrc(validatedSrc);
      setHasError(false);
    } else if (!validatedSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
  }, [src, fallbackSrc, imgSrc, hasError]);

  const handleError = () => {
    if (!hasError && imgSrc !== fallbackSrc) {
      console.warn(`Failed to load image: ${imgSrc}. Using fallback.`);
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
    onExternalError?.();
  };

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
      onLoad={onLoad}
      onError={handleError}
      priority={priority}
      unoptimized={hasError}
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
  const [imgSrc, setImgSrc] = useState<string | null>(() => validateImageUrl(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const validatedSrc = validateImageUrl(src);
    if (validatedSrc && validatedSrc !== imgSrc && !hasError) {
      setImgSrc(validatedSrc);
      setHasError(false);
    }
  }, [src, imgSrc, hasError]);

  const handleError = () => {
    if (!hasError) {
      console.warn(`Failed to load avatar: ${imgSrc}`);
      setHasError(true);
      setImgSrc(null);
    }
  };

  // Get initials from alt text
  const getInitials = (text: string): string => {
    const words = text.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  if (!imgSrc || hasError) {
    // Fallback to colored circle with initials
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {getInitials(alt)}
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
    />
  );
}