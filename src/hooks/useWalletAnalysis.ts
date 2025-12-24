// src/hooks/useWalletAnalysis.ts
import { useEffect } from "react";
import { getMobulaClient } from "@/lib/mobulaClient";
import { useWalletAnalysisStore } from "@/store/useWalletAnalysisStore";
import { WalletAnalysisResponse } from "@mobula_labs/types";

export function useWalletAnalysis(walletAddress?: string, blockchain?: string) {
  const { timeframe, setData, setLoading } = useWalletAnalysisStore();

  useEffect(() => {
    if (!walletAddress || !blockchain) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const client = getMobulaClient();
        const res: WalletAnalysisResponse = await client.fetchWalletAnalysis({
          wallet: walletAddress,
          blockchain: blockchain,
          period:timeframe,
        });
        setData(res);
      } catch (err) {
        console.error("Wallet analysis fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [walletAddress, blockchain, timeframe]);
}
