'use client';

import { Component, useEffect, type ReactNode } from 'react';
import { useWallets } from '@privy-io/react-auth/solana';
import { useSolanaSignerStore } from '@/store/useSolanaSignerStore';

class SafeBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[SolanaWalletBridge] Non-blocking:', error.message);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function isPrivyEmbeddedWallet(
  w: ReturnType<typeof useWallets>['wallets'][number],
): boolean {
  if (w.standardWallet?.name === 'Privy') return true;
  const raw = w as unknown as Record<string, unknown>;
  if (raw.walletClientType === 'privy') return true;
  return false;
}

function BridgeInner() {
  const { wallets } = useWallets();
  const setWallet = useSolanaSignerStore((s) => s.setWallet);

  useEffect(() => {
    const privyWallet = wallets.find(isPrivyEmbeddedWallet) ?? null;

    if (privyWallet) {
      console.info(
        '[SolanaWalletBridge] Privy embedded wallet found:',
        privyWallet.address,
      );
      setWallet({
        address: privyWallet.address,
        signTransaction: async (input) => {
          const result = await privyWallet.signTransaction({
            transaction: input.transaction,
            chain: (input.chain || 'solana:mainnet') as `${string}:${string}`,
          });
          return { signedTransaction: result.signedTransaction };
        },
      });
    } else {
      if (wallets.length > 0) {
        console.warn(
          '[SolanaWalletBridge] Wallets available but none are Privy embedded:',
          wallets.map((w) => w.standardWallet?.name ?? 'unknown'),
        );
      }
      setWallet(null);
    }
  }, [wallets, setWallet]);

  return null;
}

export function SolanaWalletBridge() {
  return (
    <SafeBoundary>
      <BridgeInner />
    </SafeBoundary>
  );
}
