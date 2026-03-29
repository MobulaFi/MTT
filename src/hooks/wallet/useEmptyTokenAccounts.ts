import { useState, useEffect, useCallback } from 'react';

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://twilight-restless-mountain.solana-mainnet.quiknode.pro/0f73d56b65264bbbb9ff2d17e64588d1c487ff93/';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

/** Rent exemption for a standard SPL token account (165 bytes) */
export const ATA_RENT_LAMPORTS = 2_039_280;
export const ATA_RENT_SOL = ATA_RENT_LAMPORTS / 1_000_000_000;

export interface EmptyTokenAccount {
  pubkey: string;
  mint: string;
  isToken2022: boolean;
}

interface RpcTokenAccount {
  pubkey: string;
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          tokenAmount: { uiAmount: number; amount: string };
        };
      };
    };
    lamports: number;
  };
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

async function fetchEmptyAccounts(
  ownerAddress: string,
  programId: string,
): Promise<EmptyTokenAccount[]> {
  const result = (await rpcCall('getTokenAccountsByOwner', [
    ownerAddress,
    { programId },
    { encoding: 'jsonParsed', commitment: 'confirmed' },
  ])) as { value: RpcTokenAccount[] };

  return result.value
    .filter((item) => {
      const amount = item.account.data.parsed.info.tokenAmount.amount;
      return amount === '0';
    })
    .map((item) => ({
      pubkey: item.pubkey,
      mint: item.account.data.parsed.info.mint,
      isToken2022: programId === TOKEN_2022_PROGRAM_ID,
    }));
}

export function useEmptyTokenAccounts(address: string | null) {
  const [accounts, setAccounts] = useState<EmptyTokenAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setAccounts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [splEmpty, spl2022Empty] = await Promise.all([
        fetchEmptyAccounts(address, TOKEN_PROGRAM_ID),
        fetchEmptyAccounts(address, TOKEN_2022_PROGRAM_ID),
      ]);
      setAccounts([...splEmpty, ...spl2022Empty]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch empty accounts');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { accounts, isLoading, error, refresh };
}
