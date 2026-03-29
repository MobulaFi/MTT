import { type Address, type Chain } from 'viem';

export type WalletType = 'evm' | 'solana' | null;
export type WalletProvider = 'privy' | null;

export interface WalletConnectionResult {
  address: Address | string;
  chain?: Chain;
}
