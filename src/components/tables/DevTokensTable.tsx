import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useTradingStore } from "@/store/tradingStore";
import { getTokenAge } from "@/utils/Formatter";
import { PriceDisplay } from "../PriceDisplay";
import { shouldMaskLiquidity } from "@/utils/tokenMetrics";
import Link from "next/link";

interface DevTokensTableProps {
  wallet: string;
  blockchain: string;
}

export function DevTokensTable({
  wallet,
  blockchain,
}: DevTokensTableProps) {
  const {
    devTokens,
    devTokensLimit,
    isLoadingDevTokens,
    fetchDevTokens,
    loadMoreDevTokens,
  } = useTradingStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDevTokens(wallet, blockchain, 1, devTokensLimit);
  }, [wallet, blockchain, devTokensLimit]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || isLoadingDevTokens) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadMoreDevTokens(wallet, blockchain);
    }
  }, [wallet, blockchain, isLoadingDevTokens, loadMoreDevTokens]);

  const tokens = devTokens || [];

  if (isLoadingDevTokens && tokens.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-textPrimary animate-pulse">Loading tokens...</div>
      </div>
    );
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-grayGhost font-normal text-xs">No dev tokens found</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439] min-h-0"
      >
        <table className="min-w-[600px] w-full text-xs bg-bgPrimary border-collapse table-fixed">
          <thead className="sticky top-0 z-20 bg-bgPrimary border-b border-borderDefault shadow-sm">
            <tr className="text-grayGhost h-9">
              <th className="w-[10px] pl-5 font-normal text-xs text-left">#</th>
              <th className="w-[1px] px-2 font-normal text-xs text-left">/</th>
              <th className="w-[150px] font-normal text-xs text-left">Token</th>
              <th className="w-[100px] font-normal text-xs text-left">Age</th>
              <th className="w-[100px] font-normal text-xs text-left">Migrated</th>
              <th className="w-[100px] font-normal text-xs text-left">MarketCap</th>
              <th className="w-[120px] font-normal text-xs text-left">Liquidity</th>
              <th className="w-[120px] font-normal text-xs pr-5 text-right">1H Volume</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token, index) => (
              <tr
                key={`${token.address}-${token.poolAddress}-${index}`}
                className="cursor-default border-b border-borderDefault/50 text-xs transition-colors h-10 bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover"
              >
                <td className="text-center text-grayGhost">{index + 1}</td>
                <td></td>
                <td className="text-left">
                  <div className="flex items-center gap-2">
                    {token.logo ? (
                      <div className="w-5 h-5 relative flex-shrink-0">
                        <Image
                          src={token.logo}
                          alt={`${token.address}-${token.poolAddress}`}
                          fill
                          sizes="20px"
                          className="rounded-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-success flex-shrink-0" />
                    )}

                    <Link
                      href={`/pair/${token.chainId}/${token.poolAddress}`}
                      className="text-textPrimary font-medium text-xs truncate hover:underline"
                    >
                      {token.name}
                    </Link>
                  </div>
                </td>

                <td className="text-left text-grayGhost truncate min-w-[80px]">
                  {token.createdAt ? getTokenAge(token.createdAt) : "-"}
                </td>

                <td className="text-left min-w-[100px]">
                  <div className="flex items-center justify-start gap-1">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${token.migrated ? "bg-success" : "bg-error"
                        }`}
                    />
                    <span
                      className={`text-xs font-medium ${token.migrated ? "text-success" : "text-error"
                        }`}
                    >
                      {token.migrated ? "Yes" : "No"}
                    </span>
                  </div>
                </td>

                <td className="text-left text-grayGhost truncate min-w-[100px]">
                  <PriceDisplay usdAmount={token.marketCap} align="left" />
                </td>
                <td className="text-left text-grayGhost truncate min-w-[100px]">
                  {shouldMaskLiquidity(token.liquidityUSD) ? (
                    <span className="text-textSecondary font-menlo text-xs">N/A</span>
                  ) : (
                    <PriceDisplay usdAmount={token.liquidityUSD} align="left" />
                  )}
                </td>
                <td className="text-right pr-5 text-grayGhost truncate min-w-[100px]">
                  <PriceDisplay usdAmount={token.volume1hUSD} align="right" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}