import { SlidersHorizontal } from "lucide-react";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";

export function HoldersTableSkeleton() {
  const rowCount = 20;
  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]">
        <table className="w-full text-sm table-fixed bg-bgPrimary">
          <thead className="text-grayGhost bg-bgPrimary sticky top-0 z-20 border-b border-borderDefault shadow-sm">
            <tr>
              <th className="w-[10px] text-center py-3 px-2 font-normal text-xs">#</th>
              <th className="w-[1px] text-center py-3 px-2 font-normal text-xs">/</th>
              <th className="w-[150px] text-left py-3 px-2 font-normal text-xs">Wallet</th>
              <th className="w-[100px] text-center py-3 px-2 font-normal text-xs">Wallet Balance</th>
              {/* <th className="w-[100px] text-center py-3 px-2 font-normal text-xs">Bought</th> */}
              {/* <th className="w-[100px] text-center py-3 px-2 font-normal text-xs">Sold</th> */}
              <th className="w-[120px] text-center py-3 px-2 font-normal text-xs">Remaining</th>
              {/* <th className="w-[120px] text-center py-3 px-2 font-normal text-xs">Unrealized PNL</th> */}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: rowCount }).map((_, rowIdx) => (
              <tr
                key={rowIdx}
                className="cursor-default border-b border-borderDefault/50 transition-colors h-10 bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover"
              >
                <td className="py-3 px-2 text-center">
                  <Skeleton className="h-3 w-4 mx-auto" />
                </td>
                <td></td>
                <td className="py-3 px-2">
                  <Skeleton className="h-3 w-28 rounded animate-pulse" />
                </td>
                <td className="py-3 px-2 text-center">
                  <Skeleton className="h-3 w-12 rounded animate-pulse mx-auto" />
                </td>
                {/* <td className="py-3 px-2 text-center">
                  <Skeleton className="h-3 w-12 rounded animate-pulse mx-auto" />
                </td>
                <td className="py-3 px-2 text-center">
                  <Skeleton className="h-3 w-12 rounded animate-pulse mx-auto" />
                </td> */}
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-12" />
                    <div className="flex-1 h-3 bg-borderDefault rounded-full overflow-hidden">
                      <Skeleton className="h-full rounded-full" />
                    </div>
                  </div>
                </td>
                {/* <td className="py-3 px-2 text-center">
                  <Skeleton className="h-4 w-12 rounded mx-auto" />
                </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export function TradeCompactSkeleton() {
  const rowCount = 20;
  return (
    <div className="w-full h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]">
      <table className="w-full text-xs bg-bgPrimary border-collapse table-fixed">
        <thead className="text-grayGhost sticky top-0 border-b border-borderDefault z-20 h-8 bg-bgPrimary shadow-sm">
          <tr>
            <th className="w-[33.33%] text-left font-medium pl-3">Price</th>
            <th className="w-[33.33%] text-center font-medium">Size</th>
            <th className="w-[33.33%] text-right font-medium pr-3">Time</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <tr key={i} className="cursor-default border-b border-borderDefault/50 transition-colors h-10 bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover">
              <td className="w-[33.33%] pl-3">
                <Skeleton className="h-4 w-12 rounded mx-auto" />
              </td>
              <td className="w-[33.33%] text-center">
                <Skeleton className="h-4 w-12 rounded mx-auto" />
              </td>
              <td className="w-[33.33%] text-right pr-3">
                <Skeleton className="h-4 w-12 rounded mx-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}






export const TradeWithoutCompactSkeleton = () => {
  return (
    <div className="w-full h-full overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-[#22242D] scrollbar-track-transparent hover:scrollbar-thumb-[#343439]">
      <table className="min-w-[400px] w-full text-xs bg-bgPrimary border-collapse table-fixed">
        <thead className="text-grayGhost sticky top-0 z-20 h-8 bg-bgPrimary border-b border-borderDefault shadow-sm">
          <tr>
            <th className="w-[100px] text-left font-medium">Time</th>
            <th className="w-[80px] text-left font-medium">Type</th>
            <th className="w-[100px] text-left font-medium">Price</th>
            <th className="w-[100px] text-left font-medium">Size</th>
            <th className="w-[130px] text-left font-medium">Total USD</th>
            <th className="w-[120px] text-right pr-4 font-medium">Trader</th>
          </tr>
        </thead>

        <tbody>
          {Array.from({ length: 20 }).map((_, i) => (
            <tr
              key={i}
              className={`cursor-default border-b border-borderDefault/50 transition-colors h-10 bg-bgPrimary even:bg-bgTableAlt hover:bg-bgTableHover`}
            >
              <td className="px-2 sm:px-4 whitespace-nowrap text-left">
                <Skeleton className="h-3 w-12 rounded-md " />
              </td>

              <td className="text-left">
                <Skeleton className="h-3 w-10 rounded-md" />
              </td>

              <td className="text-left">
                <Skeleton className="h-3 w-10 rounded-md" />
              </td>

              <td className="text-left">
                <Skeleton className="h-3 w-10 rounded-md" />
              </td>

              <td className="text-left">
                <Skeleton className="h-3 w-10 rounded-md" />
              </td>

              <td className="pr-4 text-right">
                <div className="inline-flex items-center justify-end space-x-2">
                  <Skeleton className="h-3 w-10 rounded-md" />
                  <Skeleton className="h-3 w-4 rounded-full " />
                  <Skeleton className="h-3 w-4 rounded-full " />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="h-8" />
    </div>
  );
};


export function PairHeaderSkeleton() {
  return (
    <div className="flex w-full items-center justify-between py-3">


      <div className="flex items-center gap-x-6">
        <div className="flex items-center space-x-3 max-w-[250px]">
          {/* Token & Exchange Skeleton */}
          <div className="relative w-12 h-12">
            <div className="w-full h-full rounded-full shadow-lg border-[1px] border-borderDefault overflow-hidden animate-pulse flex items-center justify-center">
              <Skeleton className="w-full h-full rounded-full" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[1px] border-borderDefault shadow-md overflow-hidden flex items-center justify-center">
              <Skeleton className="w-full h-full rounded-full" />
            </div>
          </div>

          {/* Token Name & Symbol Skeleton */}
          <div className="flex flex-col gap-2 overflow-hidden min-w-[130px] max-w-[170px]">
            <div className="flex items-center gap-2 overflow-hidden">
              <Skeleton className="h-4 w-24 rounded " />
              <Skeleton className="size-5 rounded " /> {/* Copy icon skeleton */}
            </div>
            <div className="flex items-center gap-1 overflow-hidden">
              <Skeleton className="h-5 w-20 rounded " />
            </div>
          </div>

          {/* Separator */}
          <div className="flex flex-col h-12 justify-center">
            <Separator orientation="vertical" className="h-full w-px bg-borderPrimary" />
          </div>
        </div>
        <div className="flex gap-x-4">
          {Array(5)
            .fill(0)
            .map((_, i, arr) => (
              <div key={i} className="flex items-center gap-x-2">
                <Skeleton className="h-12 w-20" />
                {i !== arr.length - 1 && (
                  <div className="flex flex-col h-12 justify-center">
                    <Separator orientation="vertical" className="h-full w-px bg-borderPrimary" />
                  </div>
                )}
              </div>
            ))}
        </div>

      </div>

      <Separator orientation="vertical" className="h-12 w-px bg-borderPrimary" />

      <div className="flex gap-x-2 min-w-[200px] justify-end">
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="flex items-center gap-x-2">
              <Skeleton className="h-12 w-16" />
              {i !== 3 && ( // Only render separator if not the last item
                <div className="flex flex-col h-12 justify-center">
                  <Separator orientation="vertical" className="h-full w-px bg-borderPrimary" />
                </div>
              )}
            </div>
          ))}
      </div>

    </div>
  );
}


export function PairStatsCardSkeleton() {
  return (
    <div className="w-full h-full space-y-2">
      {/* Header Skeleton */}
      <div className="pl-4 py-3 space-y-3 border-b-[1px] border-borderDefault">
        <Skeleton className="h-[21px] w-40 animate-pulse rounded" />

        {/* Token image skeleton */}
        <Skeleton className="border border-borderDefault rounded-[4px] w-full h-[130px] animate-pulse" />

        {/* Links skeleton */}
        <div className="grid grid-cols-3 gap-2 w-full">
          <Skeleton className="h-8 bg-bgHover animate-pulse rounded" />
          <Skeleton className="h-8 bg-bgHover animate-pulse rounded" />
          <Skeleton className="h-8 bg-bgHover animate-pulse rounded" />
        </div>
      </div>

      {/* Timeframe Selector Skeleton */}
      <div className="border-y border-borderDefault w-full flex overflow-hidden">
        {Array(4)
          .fill(0)
          .map((_, idx) => (
            <Skeleton key={idx} className="flex-1 h-10 bg-bgHover animate-pulse mx-1 rounded" />
          ))}
      </div>

      {/* Stats Section Skeleton */}
      <div className="w-full pl-4 space-y-4">
        {Array(3)
          .fill(0)
          .map((_, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1.8fr] items-start py-4 gap-4">
              {/* Left Stat Skeleton */}
              <div className="pr-2 border-r border-borderDefault">
                <Skeleton className="h-10 w-20  animate-pulse rounded" />
              </div>

              {/* Right Stat Skeleton */}
              <div className="pl-4 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-5 w-full bg-bgHover animate-pulse rounded" />
                  <Skeleton className="h-5 w-full bg-bgHover animate-pulse rounded" />
                </div>

                {/* Progress bar skeleton */}
                <Skeleton className="w-full h-1 bg-bgHover rounded-full animate-pulse relative" />
              </div>
            </div>
          ))}
      </div>

      <div className="border-t w-full border-borderDefault flex flex-col">
        {/* Section Title */}
        <div className="px-4 py-2 border-b border-borderDefault">
          <Skeleton className="h-5 w-24" />
        </div>

        <div className="pb-3 space-y-2">
          {/* Metrics Grid Skeleton */}
          <div className="grid grid-cols-3 gap-3 text-xs my-4 px-4">
            {[...Array(9)].map((_, idx) => (
              <div key={idx} className="border border-borderDefault p-2 space-y-2">
                <Skeleton className="h-3 w-16 mx-auto" />
                <Skeleton className="h-5 w-12 mx-auto" />
              </div>
            ))}
          </div>

          {/* Info Rows Skeleton */}
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="border-y py-2 border-borderDefault px-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}



export function TokenSectionSkeleton({ title }: { title?: string }) {
  return (
    <div className="bg-bgPrimary max-h-[calc(100vh-20vh)] custom-scrollbar overflow-hidden overflow-y-auto">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-10 bg-bgOverlay flex justify-between items-center px-3 py-1.5 border-y border-borderDefault">
        <div className="flex items-center gap-2 min-w-0 flex-1 py-2">
          {title ? (
            <h2 className="text-sm font-medium text-white truncate">{title}</h2>
          ) : (
            <Skeleton className="w-24 h-4" />
          )}

          {/* Token Count Skeleton */}
          <Skeleton className="h-3 w-8 rounded" />

          {/* Status Badge Skeleton */}
          <div className="relative w-4 h-4 flex-shrink-0">
            <Skeleton className="w-full h-full rounded-full" />
          </div>
          <Skeleton className="h-3 w-12 rounded" />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <SlidersHorizontal
            className={`h-4 w-4 text-gray-400`}
          />
        </div>
      </div>

      {/* Token List - Multiple Skeletons */}
      <div className="space-y-0">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="border-b-[1px] border-borderDefault animate-in slide-in-from-top-2 duration-300"
          >
            <div className="cursor-pointer bg-bgPrimary hover:bg-bgTableHover text-textPrimary transition-all duration-200 px-3 py-2 rounded-md animate-pulse">
              {/* Header Section */}
              <div className="flex justify-between w-full items-start gap-4">
                {/* Left: Token Image + Details */}
                <div className="flex space-x-3 flex-1 min-w-0">
                  {/* Token Image Skeleton */}
                  <div className="flex-shrink-0 relative w-16 h-16">

                    <Skeleton className="w-full h-full relative" />
                    <Skeleton className="absolute -bottom-1 -right-1 w-4 h-4 rounded" />
                  </div>

                  {/* Token Details Skeleton */}
                  <div className="flex space-y-2 flex-col min-w-0 w-full">
                    {/* Token Name */}
                    <div className="flex items-center space-x-1 justify-start">

                      <Skeleton className="h-4 rounded w-24" />
                      <Skeleton className="size-4" />
                      <Skeleton className="size-4" />
                    </div>


                    {/* Symbol + Holders + Pro Traders */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <Skeleton className="h-4 rounded w-14" />
                      <Skeleton className="size-4" />
                      <Skeleton className="size-4" />
                    </div>

                    {/* Creation Date + Address */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Skeleton className="size-4 rounded " />
                      <Skeleton className="h-4 rounded w-24" />
                    </div>
                  </div>
                </div>

                {/* Right: Market Data */}
                <div className="flex flex-col items-end flex-shrink-0 min-w-[90px] gap-2">
                  <Skeleton className="h-4 rounded w-28" />
                  <Skeleton className="h-4 rounded w-24" />
                </div>
              </div>

              {/* Stats Section */}
              <div className="flex items-center w-full mt-3 gap-2">
                {/* Stats Badges Skeleton - 70% width */}
                <div className="flex items-center gap-1 flex-wrap w-[70%]">
                  {Array.from({ length: 4 }).map((_, statIndex) => (
                    <Skeleton
                      key={statIndex}
                      className="px-1 py-[2px] rounded h-4 w-12"
                    />
                  ))}
                </div>

                {/* Progress Bar Skeleton - 30% width */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-end gap-2">
                    <Skeleton className="h-4 rounded w-14" />
                    <Skeleton className="h-4 rounded w-14" />
                    <Skeleton className="h-4 rounded w-14" />
                  </div>
                  <Skeleton className="w-full h-1 rounded-full overflow-hidden" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}