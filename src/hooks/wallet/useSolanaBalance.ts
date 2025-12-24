import { useState, useEffect } from 'react';

export function useSolanaBalance(address: string | null) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      setIsLoading(true);
      setError(null);

      const rpcEndpoints = [
        "https://twilight-restless-mountain.solana-mainnet.quiknode.pro/0f73d56b65264bbbb9ff2d17e64588d1c487ff93/",
        'https://solana-devnet.gateway.tatum.io',
        "https://api.helius.xyz/?api-key=YOUR_KEY",  // optional but best reliability
      ];

      let lastError: Error | null = null;

      for (const endpoint of rpcEndpoints) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getBalance",
              params: [
                address,
                { commitment: "confirmed" } // FIX #1
              ],
            }),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }

          const data = await response.json();

          if (data.error) {
            throw new Error(data.error.message || "RPC error");
          }

          const lamports = data.result.value ?? 0;
          const sol = lamports / 1_000_000_000;

          setBalance(sol);
          setError(null);
          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          continue;
        }
      }

      setError(lastError?.message ?? "All RPC endpoints failed");
      setBalance(null);
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [address]);

  return { balance, isLoading, error };
}
