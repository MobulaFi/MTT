'use client';

import { useEffect, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  getAddress,
  type Address,
  type Chain,
} from 'viem';
import { erc20Abi } from 'viem';
import { base, mainnet, arbitrum, optimism, polygon } from 'viem/chains';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { getChainFromBlockchain, getChainConfig } from '@/utils/chainMapping';

const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const BALANCE_REFRESH_INTERVAL = 10000;

const WETH_ADDRESSES = [
  '0x4200000000000000000000000000000000000006',
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
  '0x74b23882a30290451A17c44f4F05243b6b58C76d',
];

interface UseWalletBalanceParams {
  tokenAddress?: string;
  blockchain?: string;
  enabled?: boolean;
}

interface BalanceResult {
  balance: string;
  isLoading: boolean;
  error: string | null;
}

class TokenIdentifier {
  static isWETH(address: string | undefined): boolean {
    if (!address) return false;
    return WETH_ADDRESSES.some(weth => weth.toLowerCase() === address.toLowerCase());
  }

  static isNative(address: string | undefined): boolean {
    return !address || address === NATIVE_TOKEN_ADDRESS;
  }
}

class ChainResolver {
  private static readonly CHAIN_MAP: Record<string, Chain> = {
    'ethereum': mainnet,
    'eth': mainnet,
    'base': base,
    'arbitrum': arbitrum,
    'optimism': optimism,
    'polygon': polygon,
  };

  static resolve(blockchain: string): Chain {
    if (blockchain.startsWith('evm:')) {
      const chain = getChainFromBlockchain(blockchain);
      if (chain) return chain;
      console.warn(`Chain not found for ${blockchain}, using mainnet`);
    }

    const chainId = blockchain.toLowerCase();
    return this.CHAIN_MAP[chainId] || mainnet;
  }
}

class ChainSwitcher {
  static async switchChain(chain: Chain): Promise<void> {
    if (!window.ethereum) return;

    const chainIdHex = `0x${chain.id.toString(16)}`;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (error: unknown) {
      if (this.isChainNotAddedError(error)) {
        await this.addChain(chain);
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
      } else {
        throw error;
      }
    }
  }

  private static async addChain(chain: Chain): Promise<void> {
    if (!window.ethereum) return;

    const chainIdHex = `0x${chain.id.toString(16)}`;
    const chainConfig = getChainConfig(`evm:${chain.id}`);

    if (chainConfig) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainConfig.chainId,
          chainName: chainConfig.chainName,
          nativeCurrency: chainConfig.nativeCurrency,
          rpcUrls: chainConfig.rpcUrls,
          blockExplorerUrls: chainConfig.blockExplorerUrls,
        }],
      });
    } else {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          blockExplorerUrls: chain.blockExplorers?.default.url ? [chain.blockExplorers.default.url] : [],
        }],
      });
    }
  }

  private static isChainNotAddedError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 4902 || error.code === -32603)
    );
  }
}

class EVMBalanceFetcher {
  static async fetchNativeBalance(
    address: Address,
    chain: Chain,
    publicClient: ReturnType<typeof createPublicClient>
  ): Promise<string> {
    const balanceValue = await publicClient.getBalance({ address });
    return formatEther(balanceValue);
  }

  static async fetchERC20Balance(
    address: Address,
    tokenAddress: string,
    chain: Chain,
    publicClient: ReturnType<typeof createPublicClient>
  ): Promise<string> {
    const balanceValue = await publicClient.readContract({
      address: getAddress(tokenAddress),
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });

    const decimals = await this.getTokenDecimals(tokenAddress, publicClient);
    const divisor = BigInt(10 ** decimals);
    const wholePart = balanceValue / divisor;
    const fractionalPart = balanceValue % divisor;

    return fractionalPart === BigInt(0)
      ? wholePart.toString()
      : (Number(balanceValue) / Number(divisor)).toFixed(6);
  }

  private static async getTokenDecimals(
    tokenAddress: string,
    publicClient: ReturnType<typeof createPublicClient>
  ): Promise<number> {
    try {
      return await publicClient.readContract({
        address: getAddress(tokenAddress),
        abi: erc20Abi,
        functionName: 'decimals',
      });
    } catch {
      return 18;
    }
  }
}

class SolanaBalanceFetcher {
  private static readonly RPC_URL = 'https://api.mainnet-beta.solana.com';

  static async fetchNativeBalance(address: string): Promise<string> {
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const connection = new Connection(this.RPC_URL, 'confirmed');
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return (balance / 1e9).toFixed(6);
  }

  static async fetchSPLBalance(address: string, tokenAddress: string): Promise<string> {
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const connection = new Connection(this.RPC_URL, 'confirmed');
    const publicKey = new PublicKey(address);
    const tokenMint = new PublicKey(tokenAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      mint: tokenMint,
    });

    if (tokenAccounts.value.length > 0) {
      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return balance?.toString() || '0';
    }

    return '0';
  }
}

class WalletBalanceService {
  static async fetchEVMBalance(
    address: Address,
    blockchain: string,
    tokenAddress?: string
  ): Promise<string> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Ethereum provider not available');
    }

    const chain = ChainResolver.resolve(blockchain);

    const walletClient = createWalletClient({
      chain,
      transport: custom(window.ethereum),
    });

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
      if (accounts.length === 0 || accounts[0].toLowerCase() !== address.toLowerCase()) {
        console.warn('Address mismatch - store:', address, 'wallet:', accounts[0]);
      }
    } catch {
      // Ignore verification errors
    }

    try {
      await ChainSwitcher.switchChain(chain);
    } catch {
      // Continue if chain switch fails
    }

    const publicClient = createPublicClient({
      chain,
      transport: custom(window.ethereum),
    });

    if (TokenIdentifier.isNative(tokenAddress) || TokenIdentifier.isWETH(tokenAddress)) {
      return await EVMBalanceFetcher.fetchNativeBalance(address, chain, publicClient);
    }

    return await EVMBalanceFetcher.fetchERC20Balance(
      address,
      tokenAddress!,
      chain,
      publicClient
    );
  }

  static async fetchSolanaBalance(
    address: string,
    tokenAddress?: string
  ): Promise<string> {
    if (!tokenAddress) {
      return await SolanaBalanceFetcher.fetchNativeBalance(address);
    }

    return await SolanaBalanceFetcher.fetchSPLBalance(address, tokenAddress);
  }
}

export function useWalletBalance({
  tokenAddress,
  blockchain,
  enabled = true,
}: UseWalletBalanceParams): BalanceResult {
  const { evmAddress, activeWalletType, solanaAddress } = useWalletConnectionStore();
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBalance('0');
      return;
    }

    const fetchBalance = async () => {
      if (activeWalletType === 'evm' && evmAddress && blockchain && typeof window !== 'undefined' && window.ethereum) {
        setIsLoading(true);
        setError(null);

        try {
          const balanceValue = await WalletBalanceService.fetchEVMBalance(
            evmAddress as Address,
            blockchain,
            tokenAddress
          );
          setBalance(balanceValue);
        } catch (err) {
          console.error('Error fetching wallet balance:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch balance');
          setBalance('0');
        } finally {
          setIsLoading(false);
        }
      } else if (activeWalletType === 'solana' && solanaAddress && blockchain?.includes('solana')) {
        setIsLoading(true);
        setError(null);

        try {
          const balanceValue = await WalletBalanceService.fetchSolanaBalance(
            solanaAddress,
            tokenAddress
          );
          setBalance(balanceValue);
        } catch (err) {
          console.error('Error fetching Solana balance:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch balance');
          setBalance('0');
        } finally {
          setIsLoading(false);
        }
      } else {
        setBalance('0');
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, BALANCE_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [evmAddress, solanaAddress, tokenAddress, blockchain, activeWalletType, enabled]);

  return { balance, isLoading, error };
}
