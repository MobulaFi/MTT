import { useState, useEffect, useCallback } from 'react';

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://twilight-restless-mountain.solana-mainnet.quiknode.pro/0f73d56b65264bbbb9ff2d17e64588d1c487ff93/';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export interface TokenAccount {
  mint: string;
  balance: number;
  decimals: number;
  isNative: boolean;
  isToken2022: boolean;
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'RPC error');
  return data.result;
}

async function fetchTokenAccounts(
  ownerAddress: string,
  programId: string,
): Promise<TokenAccount[]> {
  const result = (await rpcCall('getTokenAccountsByOwner', [
    ownerAddress,
    { programId },
    { encoding: 'jsonParsed', commitment: 'confirmed' },
  ])) as { value: Array<{ account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmount: number; decimals: number } } } } } }> };

  return result.value
    .map((item) => {
      const info = item.account.data.parsed.info;
      return {
        mint: info.mint,
        balance: info.tokenAmount.uiAmount ?? 0,
        decimals: info.tokenAmount.decimals,
        isNative: false,
        isToken2022: programId === TOKEN_2022_PROGRAM_ID,
      };
    })
    .filter((t) => t.balance > 0);
}

export function useTokenAccounts(address: string | null) {
  const [accounts, setAccounts] = useState<TokenAccount[]>([]);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setAccounts([]);
      setSolBalance(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [balanceResult, splAccounts, spl2022Accounts] = await Promise.all([
        rpcCall('getBalance', [address, { commitment: 'confirmed' }]) as Promise<{ value: number }>,
        fetchTokenAccounts(address, TOKEN_PROGRAM_ID),
        fetchTokenAccounts(address, TOKEN_2022_PROGRAM_ID),
      ]);

      const sol = (balanceResult.value ?? 0) / 1_000_000_000;
      setSolBalance(sol);

      const allTokens: TokenAccount[] = [
        { mint: 'SOL', balance: sol, decimals: 9, isNative: true, isToken2022: false },
        ...splAccounts,
        ...spl2022Accounts,
      ];

      setAccounts(allTokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token accounts');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { accounts, solBalance, isLoading, error, refresh };
}
