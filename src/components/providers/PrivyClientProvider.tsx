'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { base, mainnet, bsc } from 'viem/chains';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { type ReactNode } from 'react';
import dynamic from 'next/dynamic';

const SolanaWalletBridge = dynamic(
  () =>
    import('./SolanaWalletBridge').then((m) => ({
      default: m.SolanaWalletBridge,
    })),
  { ssr: false },
);

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://api.mainnet-beta.solana.com';
const SOLANA_WSS =
  process.env.NEXT_PUBLIC_SOLANA_WSS_URL ||
  'wss://api.mainnet-beta.solana.com';

const solanaRpcs = {
  'solana:mainnet': {
    rpc: createSolanaRpc(SOLANA_RPC),
    rpcSubscriptions: createSolanaRpcSubscriptions(SOLANA_WSS),
  },
} as const;

export function PrivyClientProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        defaultChain: base,
        supportedChains: [base, mainnet, bsc],
        appearance: {
          theme: 'dark',
        },
        loginMethods: ['email', 'google', 'twitter'],
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
          requireUserPasswordOnCreate: false,
          noPromptOnSignature: true,
          showWalletUIs: false,
        },
        solana: {
          rpcs: solanaRpcs,
        },
      }}
    >
      <SolanaWalletBridge />
      {children}
    </PrivyProvider>
  );
}
