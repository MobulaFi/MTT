'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Wallet, X, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useReclaimATAStore } from '@/store/useReclaimATAStore';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { useEmptyTokenAccounts, ATA_RENT_SOL, type EmptyTokenAccount } from '@/hooks/wallet/useEmptyTokenAccounts';
import { useCloseAccounts } from '@/hooks/wallet/useCloseAccounts';
import { Skeleton } from '@/components/ui/skeleton';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function ReclaimATAModal() {
  const isOpen = useReclaimATAStore((s) => s.isOpen);
  const close = useReclaimATAStore((s) => s.close);
  const solanaAddress = useWalletConnectionStore((s) => s.solanaAddress);

  const { accounts, isLoading, error, refresh } = useEmptyTokenAccounts(
    isOpen ? solanaAddress : null,
  );
  const { closeAccounts, isClosing, closedCount } = useCloseAccounts();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const allSelected = accounts.length > 0 && selected.size === accounts.length;
  const visibleAccounts = showAll ? accounts : accounts.slice(0, 10);
  const hasMore = accounts.length > 10;

  const reclaimableSOL = useMemo(
    () => selected.size * ATA_RENT_SOL,
    [selected.size],
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(accounts.map((a) => a.pubkey)));
    }
  };

  const toggleOne = (pubkey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pubkey)) {
        next.delete(pubkey);
      } else {
        next.add(pubkey);
      }
      return next;
    });
  };

  const handleClose = async () => {
    const toClose = accounts.filter((a) => selected.has(a.pubkey));
    const hashes = await closeAccounts(toClose);
    if (hashes.length > 0) {
      setSelected(new Set());
      refresh();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      close();
      setSelected(new Set());
      setShowAll(false);
    }
  };

  if (!solanaAddress) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-bgPrimary border-borderDefault max-w-[480px] p-0 gap-0 rounded-md overflow-hidden"
      >
        <VisuallyHidden>
          <DialogTitle>Reclaim ATA</DialogTitle>
        </VisuallyHidden>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-borderDefault">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-bgContainer border border-borderDefault">
              <Wallet className="w-3.5 h-3.5 text-textSecondary" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-textPrimary">
                Reclaim ATA
              </h2>
              <p className="text-[11px] text-textTertiary">
                Close empty token accounts & recover SOL
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1 rounded-md text-textTertiary hover:text-textPrimary hover:bg-bgContainer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-borderDefault bg-bgContainer/50">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-textTertiary">
                Empty Accounts
              </span>
              <p className="text-sm font-medium text-textPrimary">
                {isLoading ? '...' : accounts.length}
              </p>
            </div>
            <div className="w-px h-6 bg-borderDefault" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-textTertiary">
                Reclaimable
              </span>
              <p className="text-sm font-medium text-success">
                {isLoading
                  ? '...'
                  : `${(accounts.length * ATA_RENT_SOL).toFixed(4)} SOL`}
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1.5 rounded-md text-textTertiary hover:text-textPrimary hover:bg-bgContainer transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-2 max-h-[340px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#161616] hover:scrollbar-thumb-[#222222]">
          {isLoading ? (
            <div className="flex flex-col gap-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-xs text-error">{error}</p>
              <button
                onClick={refresh}
                className="mt-2 text-xs text-textSecondary hover:text-textPrimary transition-colors"
              >
                Retry
              </button>
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-10 text-center">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 rounded-md bg-bgContainer border border-borderDefault">
                <Wallet className="w-5 h-5 text-textTertiary" />
              </div>
              <p className="text-sm text-textSecondary">No empty accounts</p>
              <p className="text-[11px] text-textTertiary mt-1">
                All your token accounts have balances
              </p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 w-full py-2 text-xs text-textSecondary hover:text-textPrimary transition-colors"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                    allSelected
                      ? 'bg-success border-success'
                      : 'border-textTertiary'
                  }`}
                >
                  {allSelected && (
                    <svg
                      width="8"
                      height="6"
                      viewBox="0 0 8 6"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1 3L3 5L7 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span>
                  {allSelected
                    ? 'Deselect all'
                    : `Select all (${accounts.length})`}
                </span>
              </button>

              {/* Account list */}
              <div className="flex flex-col gap-0.5">
                {visibleAccounts.map((account) => (
                  <AccountRow
                    key={account.pubkey}
                    account={account}
                    isSelected={selected.has(account.pubkey)}
                    onToggle={() => toggleOne(account.pubkey)}
                  />
                ))}
              </div>

              {/* Show more / less */}
              {hasMore && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="flex items-center justify-center gap-1 w-full py-2 text-[11px] text-textTertiary hover:text-textSecondary transition-colors"
                >
                  {showAll ? (
                    <>
                      Show less <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      Show {accounts.length - 10} more{' '}
                      <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer / Action */}
        {accounts.length > 0 && (
          <div className="px-4 py-3 border-t border-borderDefault">
            <button
              onClick={handleClose}
              disabled={selected.size === 0 || isClosing}
              className="w-full py-2.5 rounded-md text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-success/10 text-success hover:bg-success/20 active:bg-success/25"
            >
              {isClosing
                ? `Closing... (${closedCount}/${selected.size})`
                : selected.size > 0
                  ? `Close ${selected.size} account${selected.size > 1 ? 's' : ''} · Reclaim ${reclaimableSOL.toFixed(4)} SOL`
                  : 'Select accounts to reclaim'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccountRow({
  account,
  isSelected,
  onToggle,
}: {
  account: EmptyTokenAccount;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-3 w-full px-2.5 py-2 rounded-md transition-colors ${
        isSelected
          ? 'bg-bgContainer'
          : 'hover:bg-bgContainer/50'
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
          isSelected
            ? 'bg-success border-success'
            : 'border-textTertiary'
        }`}
      >
        {isSelected && (
          <svg
            width="8"
            height="6"
            viewBox="0 0 8 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 3L3 5L7 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Token info */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-textPrimary truncate">
            {truncateAddress(account.mint)}
          </span>
          {account.isToken2022 && (
            <span className="text-[9px] px-1 py-0.5 rounded-sm bg-accentPurple/10 text-accentPurple font-medium">
              T22
            </span>
          )}
        </div>
        <span className="text-[10px] text-textTertiary">
          {truncateAddress(account.pubkey)}
        </span>
      </div>

      {/* Rent value */}
      <div className="text-right shrink-0">
        <span className="text-xs text-success font-medium">
          {ATA_RENT_SOL.toFixed(4)}
        </span>
        <span className="text-[10px] text-textTertiary ml-0.5">SOL</span>
      </div>

      {/* Solscan link */}
      <a
        href={`https://solscan.io/account/${account.pubkey}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="p-1 text-textTertiary hover:text-textSecondary transition-colors shrink-0"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </button>
  );
}
