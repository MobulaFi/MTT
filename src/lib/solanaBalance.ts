const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://twilight-restless-mountain.solana-mainnet.quiknode.pro/0f73d56b65264bbbb9ff2d17e64588d1c487ff93/';

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

/**
 * Fetch on-chain token balance for a given wallet + mint on Solana.
 * Returns human-readable balance (already divided by decimals).
 * Returns null if the account doesn't exist or RPC fails.
 */
export async function fetchSolanaTokenBalance(
  walletAddress: string,
  mintAddress: string,
): Promise<number | null> {
  try {
    const result = (await rpcCall('getTokenAccountsByOwner', [
      walletAddress,
      { mint: mintAddress },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ])) as {
      value: Array<{
        account: {
          data: {
            parsed: {
              info: { tokenAmount: { uiAmount: number; decimals: number } };
            };
          };
        };
      }>;
    };

    if (!result.value || result.value.length === 0) return 0;

    let totalBalance = 0;
    for (const item of result.value) {
      totalBalance += item.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
    }
    return totalBalance;
  } catch {
    return null;
  }
}
