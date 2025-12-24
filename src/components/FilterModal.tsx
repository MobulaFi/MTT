"use client";

import { useFilterModalStore } from "@/store/useFilterModalStore";
import { X, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

type TransactionType = 'all' | 'buy' | 'sell';

const isTransactionType = (value: string): value is TransactionType =>
  value === 'all' || value === 'buy' || value === 'sell';

export function FilterModal() {
  const { isOpen, closeModal, setFilters, resetFilters, currentFilters } =
    useFilterModalStore();

  const [wallet, setWallet] = useState("");
  const [type, setType] = useState<TransactionType>("all");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  useEffect(() => {
    if (currentFilters) {
      setWallet(currentFilters.wallet ?? "");
      setType(currentFilters.type ?? "all");
      setMin(currentFilters.min?.toString() ?? "");
      setMax(currentFilters.max?.toString() ?? "");
    }
  }, [currentFilters]);

  if (!isOpen) return null;

  const hasChanges = wallet.trim() || type !== "all" || min || max;

  const apply = () => {
    setFilters({
      wallet: wallet.trim() || undefined,
      type,
      min: min ? Number(min) : undefined,
      max: max ? Number(max) : undefined,
    });
    closeModal();
  };

  const reset = () => {
    resetFilters();
    setWallet("");
    setType("all");
    setMin("");
    setMax("");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 sm:px-0">
      <div className="flex w-full max-w-md flex-col rounded-xl bg-bgPrimary shadow-xl border border-borderDefault sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderDefault px-4 py-3">
          <h2 className="text-base font-medium text-textPrimary">Wallet Filter</h2>
          <button
            onClick={closeModal}
            className="rounded p-1 text-textTertiary hover:text-textPrimary transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
          {/* Wallet */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-textPrimary">
              Wallet address
            </label>
            <input
              type="text"
              placeholder="0x…"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="mt-1 w-full rounded-md border border-borderDefault bg-bgSecondary px-3 py-2 text-sm text-white placeholder-textTertiary focus:border-success/50 focus:outline-none focus:ring-1 focus:ring-success/50"
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-textPrimary">
              Transaction type
            </label>
            <select
              value={type}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (isTransactionType(nextValue)) {
                  setType(nextValue);
                }
              }}
              className="mt-1 w-full rounded-md border-[1px] focus:border-success placeholder-textTertiary
               border-borderDefault bg-bgSecondary px-2 py-2 text-sm text-textPrimary focus:outline-none focus:ring-1 focus:ring-success"
            >
              <option value="all">All</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          {/* Price range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-textPrimary">
                Min price
              </label>
              <input
                type="number"
                placeholder="0"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                className="mt-1 w-full rounded-md border border-borderDefault bg-bgSecondary px-3 py-2 text-sm text-white placeholder-textTertiary focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-textPrimary">
                Max price
              </label>
              <input
                type="number"
                placeholder="∞"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                className="mt-1 w-full rounded-md border border-borderDefault bg-bgSecondary px-3 py-2 text-sm text-white placeholder-textTertiary focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-borderDefault px-4 py-3">
          <button
            onClick={reset}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-textTertiary hover:text-gray-200 disabled:opacity-50 disabled:hover:text-gray-400"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          <div className="flex gap-2">
            <button
              onClick={closeModal}
              className="rounded-md border border-borderDefault hover:bg-bgPrimary/50 hover:text-textPrimary/50 px-4 py-1.5 text-sm font-medium text-white"
            >
              Close
            </button>
            <button
              onClick={apply}
              disabled={!hasChanges}
              className="rounded-md bg-success/20 px-4 py-1.5 text-sm border border-success font-medium text-white disabled:opacity-50"
            >
              Apply All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
