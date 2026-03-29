'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useWalletTrackerStore } from '../store/useWalletTrackerStore';
import { useWalletTrackerStream } from '../hooks/useWalletTrackerStream';
import { useWalletNicknameStore } from '@/store/useWalletNicknameStore';
import AddWalletForm from './AddWalletForm';
import { AddWalletModal } from './AddWalletModal';
import TrackedWalletCard from './TrackedWalletCard';
import LiveTradesFeed from './LiveTradesFeed';
import MonitorView from './MonitorView';
import { Download, Upload } from 'lucide-react';
import { timeAgo } from '@/lib/format';

type Tab = 'all' | 'live-trades' | 'monitor';

export function WalletTrackerPanel() {
  const {
    trackedWallets,
    walletPositions,
    addWallet,
    removeWallet,
    updateWalletLabel,
    removeAllWallets,
  } = useWalletTrackerStore();

  const setWalletNickname = useWalletNicknameStore((s) => s.setWalletNickname);

  useWalletTrackerStream();

  useEffect(() => {
    for (const w of trackedWallets) {
      setWalletNickname(w.address, w.label);
    }
  }, [trackedWallets, setWalletNickname]);

  const [tab, setTab] = useState<Tab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRenameWallet = useCallback((address: string, label: string) => {
    updateWalletLabel(address, label);
    setWalletNickname(address, label);
  }, [updateWalletLabel, setWalletNickname]);

  const handleTrackWallet = useCallback((address: string, label?: string) => {
    addWallet(address, label);
  }, [addWallet]);

  const isAlreadyTracked = useCallback((address: string) => {
    return trackedWallets.some(
      (w) => w.address.toLowerCase() === address.toLowerCase(),
    );
  }, [trackedWallets]);

  const handleExport = () => {
    const data = JSON.stringify(trackedWallets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tracked-wallets.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wallets = JSON.parse(ev.target?.result as string) as Array<{ address: string; label?: string }>;
          for (const w of wallets) {
            if (w.address) addWallet(w.address, w.label);
          }
        } catch { /* invalid json */ }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const walletData = useMemo(() => {
    return trackedWallets.map((w) => {
      const positions = walletPositions[w.address.toLowerCase()] || [];
      const totalBalance = positions.reduce((sum, p) => sum + (p.amountUSD || 0), 0);
      const lastDate = positions.reduce((latest, p) => {
        const d = p.lastDate ? new Date(p.lastDate).getTime() : 0;
        return d > latest ? d : latest;
      }, 0);
      return {
        wallet: w,
        balance: totalBalance,
        lastActive: lastDate > 0 ? timeAgo(new Date(lastDate).toISOString()) : '',
        createdAt: w.addedAt,
      };
    });
  }, [trackedWallets, walletPositions]);

  // Filter wallets by search query (label or address)
  const filteredWalletData = useMemo(() => {
    if (!searchQuery.trim()) return walletData;
    const q = searchQuery.toLowerCase();
    return walletData.filter(({ wallet }) =>
      wallet.label.toLowerCase().includes(q) ||
      wallet.address.toLowerCase().includes(q)
    );
  }, [walletData, searchQuery]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'Wallet Manager' },
    { id: 'live-trades', label: 'Live Trades' },
    { id: 'monitor', label: 'Monitor' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-borderDefault flex-shrink-0">
        <div className="flex items-center gap-5">
          <span className="text-base font-semibold text-textPrimary">Wallet Manager</span>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-sm font-medium py-1 transition-colors ${
                tab === t.id
                  ? 'text-white border-b border-white'
                  : 'text-textTertiary hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleImport}
            className="text-textTertiary hover:text-white transition-colors p-2"
            title="Import"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleExport}
            className="text-textTertiary hover:text-white transition-colors p-2"
            title="Export"
          >
            <Upload size={16} />
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="ml-2 text-sm font-medium px-4 py-1.5 rounded border border-borderDefault bg-bgTertiary hover:bg-bgOverlay text-textPrimary transition-colors"
          >
            Add Wallet
          </button>
        </div>
      </div>

      {tab === 'live-trades' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <LiveTradesFeed />
        </div>
      ) : tab === 'monitor' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <MonitorView />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <AddWalletForm ref={inputRef} value={searchQuery} onChange={setSearchQuery} />

          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_1fr_0.7fr_1.2fr_auto] gap-4 px-5 py-2.5 text-sm text-textTertiary border-b border-borderDefault/40">
            <span className="pl-12">Name</span>
            <span>Balance</span>
            <span>Last Active</span>
            <span>Created</span>
            <span>Address</span>
            <span className="w-6" />
          </div>

          {/* Wallet list */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {trackedWallets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-base text-textTertiary">No wallets added yet.</p>
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="mt-3 text-sm text-white hover:underline"
                >
                  Add your first wallet
                </button>
              </div>
            ) : filteredWalletData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm text-textTertiary">No wallets match &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              filteredWalletData.map(({ wallet, balance, lastActive, createdAt }) => (
                <TrackedWalletCard
                  key={wallet.address}
                  wallet={wallet}
                  balance={balance}
                  lastActive={lastActive}
                  createdAt={createdAt}
                  onRemove={removeWallet}
                  onRename={handleRenameWallet}
                />
              ))
            )}
          </div>

          {trackedWallets.length > 0 && (
            <div className="flex justify-end px-5 py-2.5 border-t border-borderDefault/40">
              <button
                onClick={removeAllWallets}
                className="text-sm text-textTertiary hover:text-error transition-colors"
              >
                Remove All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Wallet Modal */}
      <AddWalletModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onTrack={handleTrackWallet}
        isAlreadyTracked={isAlreadyTracked}
      />
    </div>
  );
}
