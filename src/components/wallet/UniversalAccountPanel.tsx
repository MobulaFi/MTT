'use client';

import React from 'react';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useCrossChainSwap } from '@/hooks/trading/useCrossChainSwap';

export function UniversalAccountPanel() {
  const { isConnected } = useWalletConnection();
  useCrossChainSwap();

  if (!isConnected) {
    return (
      <div className="p-4 bg-neutral-900 rounded-lg">
        <p className="text-neutral-400">Connect wallet to view account</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-neutral-900 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Wallet</h3>
      </div>
      <div className="p-3 bg-neutral-800 rounded-lg">
        <p className="text-sm text-neutral-400">Connected</p>
        <p className="text-sm text-green-400 mt-1">Use the header wallet button to manage your connection.</p>
      </div>
    </div>
  );
}

export default UniversalAccountPanel;
