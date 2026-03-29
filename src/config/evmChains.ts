export interface EvmChainConfig {
  id: number;
  name: string;
  shortName: string;
  color: string;
  nativeSymbol: string;
}

export const EVM_CHAINS: EvmChainConfig[] = [
  { id: 8453, name: 'Base', shortName: 'BASE', color: '#0052FF', nativeSymbol: 'ETH' },
  { id: 1, name: 'Ethereum', shortName: 'ETH', color: '#627EEA', nativeSymbol: 'ETH' },
  { id: 56, name: 'BNB Chain', shortName: 'BSC', color: '#F0B90B', nativeSymbol: 'BNB' },
];

export const DEFAULT_EVM_CHAIN_ID = 8453; // Base
