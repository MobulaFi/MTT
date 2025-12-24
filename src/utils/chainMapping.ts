'use client';

import type { Chain } from 'viem';
import {
  mainnet,
  base,
  arbitrum,
  polygon,
  optimism,
  bsc,
  avalanche,
  fantom,
  celo,
  gnosis,
  zkSync,
  linea,
  scroll,
  blast,
  mantle,
} from 'viem/chains';

export const CHAIN_MAP: Record<string, Chain> = {
  'evm:1': mainnet,
  'evm:8453': base,
  'evm:42161': arbitrum,
  'evm:137': polygon,
  'evm:10': optimism,
  'evm:56': bsc,
  'evm:43114': avalanche,
  'evm:250': fantom,
  'evm:42220': celo,
  'evm:100': gnosis,
  'evm:324': zkSync,
  'evm:59144': linea,
  'evm:534352': scroll,
  'evm:81457': blast,
  'evm:5000': mantle,
  // Chain 143 - Add proper chain import from viem/chains if available
  'evm:143': { id: 143, name: 'Chain 143', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [''] } }, blockExplorers: { default: { name: '', url: '' } } } as Chain,
};

export interface ChainConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  'evm:1': {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  'evm:8453': {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    blockExplorerUrls: ['https://basescan.org'],
  },
  'evm:42161': {
    chainId: '0xa4b1',
    chainName: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.publicnode.com'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  'evm:137': {
    chainId: '0x89',
    chainName: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com', 'https://rpc-mainnet.maticvigil.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  'evm:10': {
    chainId: '0xa',
    chainName: 'Optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io', 'https://optimism.publicnode.com'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
  },
  'evm:56': {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  'evm:43114': {
    chainId: '0xa86a',
    chainName: 'Avalanche',
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.public-rpc.com'],
    blockExplorerUrls: ['https://snowtrace.io'],
  },
  'evm:250': {
    chainId: '0xfa',
    chainName: 'Fantom',
    nativeCurrency: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
    rpcUrls: ['https://rpc.ftm.tools', 'https://fantom.publicnode.com'],
    blockExplorerUrls: ['https://ftmscan.com'],
  },
  'evm:42220': {
    chainId: '0xa4ec',
    chainName: 'Celo',
    nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
    rpcUrls: ['https://forno.celo.org', 'https://rpc.ankr.com/celo'],
    blockExplorerUrls: ['https://celoscan.io'],
  },
  'evm:100': {
    chainId: '0x64',
    chainName: 'Gnosis',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    rpcUrls: ['https://rpc.gnosischain.com', 'https://gnosis.publicnode.com'],
    blockExplorerUrls: ['https://gnosisscan.io'],
  },
  'evm:324': {
    chainId: '0x144',
    chainName: 'zkSync Era',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.era.zksync.io', 'https://zksync-era.publicnode.com'],
    blockExplorerUrls: ['https://explorer.zksync.io'],
  },
  'evm:59144': {
    chainId: '0xe708',
    chainName: 'Linea',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.linea.build', 'https://linea.publicnode.com'],
    blockExplorerUrls: ['https://lineascan.build'],
  },
  'evm:534352': {
    chainId: '0x82750',
    chainName: 'Scroll',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.scroll.io', 'https://scroll.publicnode.com'],
    blockExplorerUrls: ['https://scrollscan.com'],
  },
  'evm:81457': {
    chainId: '0x13e31',
    chainName: 'Blast',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.blast.io', 'https://blast.publicnode.com'],
    blockExplorerUrls: ['https://blastscan.io'],
  },
  'evm:5000': {
    chainId: '0x1388',
    chainName: 'Mantle',
    nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
    rpcUrls: ['https://rpc.mantle.xyz', 'https://mantle.publicnode.com'],
    blockExplorerUrls: ['https://explorer.mantle.xyz'],
  },
  // Chain 143 - TODO: Replace with actual chain details
  // You need to provide: chainName, nativeCurrency (name, symbol, decimals), rpcUrls, blockExplorerUrls
  'evm:143': {
    chainId: '0x8f',
    chainName: 'Chain 143', // TODO: Replace with actual chain name
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, // TODO: Replace with actual currency
    rpcUrls: ['https://rpc-url-here'], // TODO: Replace with actual RPC URLs
    blockExplorerUrls: ['https://explorer-url-here'], // TODO: Replace with actual explorer URL
  },
};

export function getChainFromBlockchain(blockchain: string): Chain | null {
  return CHAIN_MAP[blockchain] || null;
}

export function getChainConfig(blockchain: string): ChainConfig | null {
  return CHAIN_CONFIGS[blockchain] || null;
}
