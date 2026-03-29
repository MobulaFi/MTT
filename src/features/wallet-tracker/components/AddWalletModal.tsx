'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Search, Loader2, Plus, Eye } from 'lucide-react';
import { useWalletModalStore } from '@/store/useWalletModalStore';

function looksLikeWallet(input: string): boolean {
  const trimmed = input.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return true;
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return true;
  return false;
}

interface AddWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrack: (address: string, label?: string) => void;
  isAlreadyTracked: (address: string) => boolean;
}

export function AddWalletModal({ isOpen, onClose, onTrack, isAlreadyTracked }: AddWalletModalProps) {
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAddress('');
      setLabel('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleTrack = useCallback(() => {
    const trimmed = address.trim();
    if (!trimmed) return;
    onTrack(trimmed, label.trim() || undefined);
    onClose();
  }, [address, label, onTrack, onClose]);

  const handlePreview = useCallback(() => {
    const trimmed = address.trim();
    if (!trimmed) return;
    // Open the existing full wallet analytics modal
    useWalletModalStore.getState().openWalletModal({
      walletAddress: trimmed,
      txHash: trimmed,
    });
  }, [address]);

  const trimmed = address.trim();
  const isValid = looksLikeWallet(trimmed);
  const alreadyTracked = isValid && isAlreadyTracked(trimmed);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-[480px] bg-[#0c0c0c] border-borderDefault p-0 gap-0 overflow-hidden"
        showCloseButton
      >
        <VisuallyHidden><DialogTitle>Add Wallet</DialogTitle></VisuallyHidden>

        <div className="px-5 pt-5 pb-5">
          <h2 className="text-base font-semibold text-white mb-4">Add Wallet</h2>

          {/* Address input */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textTertiary" />
            <input
              ref={inputRef}
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Wallet address..."
              className="w-full bg-bgOverlay border border-borderDefault rounded-md pl-9 pr-3 py-2.5 text-sm text-textPrimary placeholder-textTertiary focus:outline-none focus:border-borderSecondary transition"
              onKeyDown={(e) => { if (e.key === 'Enter' && isValid && !alreadyTracked) handleTrack(); }}
            />
          </div>

          {/* Name input */}
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name (optional)"
            className="w-full bg-bgOverlay border border-borderDefault rounded-md px-3 py-2.5 text-sm text-textPrimary placeholder-textTertiary focus:outline-none focus:border-borderSecondary transition mb-4"
            onKeyDown={(e) => { if (e.key === 'Enter' && isValid && !alreadyTracked) handleTrack(); }}
          />

          {/* Actions */}
          <div className="flex items-center gap-3">
            {isValid && (
              <button
                type="button"
                onClick={handlePreview}
                className="flex items-center gap-1.5 text-sm text-textTertiary hover:text-white transition-colors"
              >
                <Eye size={14} />
                Preview Analytics
              </button>
            )}

            <div className="ml-auto">
              <button
                onClick={handleTrack}
                disabled={!isValid || alreadyTracked}
                className={`flex items-center gap-1.5 text-sm font-medium px-5 py-2 rounded transition-colors ${
                  !isValid || alreadyTracked
                    ? 'bg-bgTertiary text-textTertiary cursor-not-allowed'
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                <Plus size={14} />
                {alreadyTracked ? 'Already Tracked' : 'Track Wallet'}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
