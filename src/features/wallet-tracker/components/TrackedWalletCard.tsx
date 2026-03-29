'use client';

import { memo, useCallback, useState } from 'react';
import { X, Pencil, Check } from 'lucide-react';
import type { TrackedWallet } from '../store/useWalletTrackerStore';
import { fmtUsd } from '@/lib/format';
import { useWalletModalStore } from '@/store/useWalletModalStore';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

interface TrackedWalletCardProps {
  wallet: TrackedWallet;
  balance: number;
  lastActive: string;
  createdAt: number;
  onRemove: (address: string) => void;
  onRename: (address: string, label: string) => void;
}

function TrackedWalletCard({ wallet, balance, lastActive, createdAt, onRemove, onRename }: TrackedWalletCardProps) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(wallet.label);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(wallet.address);
    },
    [wallet.address, onRemove],
  );

  const handleSave = useCallback(() => {
    if (editLabel.trim()) {
      onRename(wallet.address, editLabel.trim());
    }
    setEditing(false);
  }, [wallet.address, editLabel, onRename]);

  const handleRowClick = useCallback(() => {
    if (editing) return;
    useWalletModalStore.getState().openWalletModal({
      walletAddress: wallet.address,
      txHash: wallet.address,
    });
  }, [wallet.address, editing]);

  return (
    <div
      onClick={handleRowClick}
      className="grid grid-cols-[auto_1fr_1fr_0.7fr_1.2fr_auto] gap-4 items-center px-5 py-3 hover:bg-bgTableHover transition-colors group text-base cursor-pointer"
    >
      {/* Name */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-full bg-bgTertiary flex items-center justify-center text-textTertiary text-sm font-bold flex-shrink-0">
          {wallet.label.charAt(0).toUpperCase()}
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="bg-bgOverlay border border-borderDefault rounded px-2 py-1 text-sm text-textPrimary w-28 focus:outline-none"
              autoFocus
            />
            <button onClick={handleSave} className="text-success p-1">
              <Check size={15} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-textPrimary font-medium truncate">{wallet.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setEditLabel(wallet.label); setEditing(true); }}
              className="text-textTertiary hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1"
            >
              <Pencil size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Balance */}
      <span className="text-textSecondary">{balance > 0 ? fmtUsd(balance) : '-'}</span>

      {/* Last Active */}
      <span className="text-textTertiary">{lastActive || '-'}</span>

      {/* Created */}
      <span className="text-textTertiary text-sm">{formatDate(createdAt)}</span>

      {/* Address */}
      <span className="text-textTertiary font-mono text-sm truncate">
        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
      </span>

      {/* Remove */}
      <button
        type="button"
        onClick={handleRemove}
        className="text-textTertiary hover:text-error transition-colors opacity-0 group-hover:opacity-100 p-1"
        aria-label="Remove wallet"
      >
        <X size={17} />
      </button>
    </div>
  );
}

export default memo(TrackedWalletCard);
