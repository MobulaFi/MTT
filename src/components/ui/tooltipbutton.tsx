'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TooltipButtonProps {
  tooltip?: string;
  children: React.ReactNode;
  copyText?: string;
  className?: string;
  successMessage?: string;
}

export function TooltipButton({ tooltip, children, copyText, className, successMessage = 'Address copied to clipboard' }: TooltipButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    if (copyText) {
      try {
        await navigator.clipboard.writeText(copyText);
        setCopied(true);
        toast.success(successMessage, {
          duration: 2000,
          icon: <Check className="w-4 h-4 text-success" />,
        });
      } catch (error) {
        toast.error('Failed to copy to clipboard');
      }
    }
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [copied]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn('p-1.5 text-textPrimary cursor-pointer hover:text-success rounded transition-colors', className)}
      aria-label={copied ? 'Copied!' : tooltip || 'Copy'}
    >
      {children}
    </button>
  );
}
