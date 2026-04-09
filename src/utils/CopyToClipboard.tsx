'use client';

import { Check } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CopyIcon } from '@/assets/icons/copyIcon';

interface CopyToClipboardProps {
  text: string;
  resetDelay?: number;
  successMessage?: string;
}

const CopyToClipboard: React.FC<CopyToClipboardProps> = React.memo(
  ({ text, resetDelay = 800, successMessage = 'Address copied to clipboard' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            toast.success(successMessage, {
              duration: 2000,
              icon: <Check className="w-4 h-4 text-success" />,
            });
          })
          .catch((err) => {
            console.error('Failed to copy text: ', err);
            toast.error('Failed to copy to clipboard');
          });
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          toast.success(successMessage, {
            duration: 2000,
            icon: <Check className="w-4 h-4 text-success" />,
          });
        } catch (err) {
          console.error('Failed to copy text using execCommand: ', err);
          toast.error('Failed to copy to clipboard');
        }
        document.body.removeChild(textArea);
      }
    }, [text, successMessage]);

    useEffect(() => {
      if (copied) {
        const timer = setTimeout(() => {
          setCopied(false);
        }, resetDelay);
        return () => clearTimeout(timer);
      }
    }, [copied, resetDelay]);

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleCopy();
        }}
        className="ml-2 text-textPrimary hover:text-success cursor-pointer p-1 rounded transition-colors"
        aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? (
          <Check className="w-4 h-4 text-success" />
        ) : (
          <CopyIcon />
        )}
      </button>
    );
  },
);

CopyToClipboard.displayName = 'CopyToClipboard';
export default CopyToClipboard;
