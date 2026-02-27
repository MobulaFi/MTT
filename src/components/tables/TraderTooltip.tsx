'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { formatPureNumber, formatUSD, truncate, MobulaError } from '@mobula_labs/sdk';
import { sdk } from '@/lib/sdkClient';
import type { TokenPositionType } from '@mobula_labs/types';
import type { WalletDisplay } from '@/hooks/useWalletDisplayName';
import { Loader2 } from 'lucide-react';

type FetchState = 'idle' | 'loading' | 'success' | 'error' | 'empty';

interface TraderTooltipProps {
  wallet: string;
  blockchain?: string;
  assetAddress?: string | null;
  walletDisplay: WalletDisplay;
  children: React.ReactNode;
}

type PositionWithOptionalTokenDetails = TokenPositionType & { tokenDetails?: TokenPositionType['token'] };

const positionCache = new Map<string, PositionWithOptionalTokenDetails | null>();

type RawTokenPosition = PositionWithOptionalTokenDetails & {
  firstDate?: string | Date | null;
  lastDate?: string | Date | null;
};

type WalletPositionResponse = {
  data: RawTokenPosition | null;
};

const normalizePosition = (raw?: RawTokenPosition | null): RawTokenPosition | null => {
  if (!raw) return null;
  return {
    ...raw,
    firstDate: raw.firstDate ? new Date(raw.firstDate) : null,
    lastDate: raw.lastDate ? new Date(raw.lastDate) : null,
  };
};

const formatRelativeDuration = (date: Date | null): string => {
  if (!date) return 'Unknown';
  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return 'now';
  const diffSeconds = Math.floor(diffMs / 1000);
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const month = day * 30;
  const year = month * 12;

  if (diffSeconds < minute) return `${diffSeconds}s`;
  if (diffSeconds < hour) return `${Math.floor(diffSeconds / minute)}m`;
  if (diffSeconds < day) return `${Math.floor(diffSeconds / hour)}h`;
  if (diffSeconds < month) return `${Math.floor(diffSeconds / day)}d`;
  if (diffSeconds < year) return `${Math.floor(diffSeconds / month)}mo`;
  return `${Math.floor(diffSeconds / year)}y`;
};

const StatCard = ({
  label,
  value,
  sublabel,
  accentClass = 'text-white',
}: {
  label: string;
  value: string;
  sublabel?: string;
  accentClass?: string;
}) => (
  <div className="rounded-md border border-borderDefault/60 bg-bgContainer/40 px-2.5 py-2">
    <p className="text-[10px] font-medium uppercase tracking-wide text-grayGhost">{label}</p>
    <p className={`text-sm font-semibold ${accentClass}`}>{value}</p>
    {sublabel ? <p className="text-[10px] text-grayGhost">{sublabel}</p> : null}
  </div>
);

const LoadingState = () => (
  <div className="flex h-24 items-center justify-center gap-2 text-xs text-grayGhost">
    <Loader2 className="h-4 w-4 animate-spin text-grayGhost" />
    Fetching wallet position...
  </div>
);

const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col gap-2 text-xs">
    <span className="text-red-400">Failed to load wallet position.</span>
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRetry();
      }}
      className="self-start text-[11px] font-medium text-accentPurple hover:underline"
    >
      Try again
    </button>
  </div>
);

const EmptyState = () => (
  <div className="text-xs text-grayGhost">
    No on-chain position recorded for this wallet yet.
  </div>
);

export function TraderTooltip({
  wallet,
  blockchain,
  assetAddress,
  walletDisplay,
  children,
}: TraderTooltipProps) {
  const [state, setState] = useState<FetchState>('idle');
  const [position, setPosition] = useState<RawTokenPosition | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [relativeNow, setRelativeNow] = useState(Date.now());

  const cacheKey = useMemo(() => {
    if (!wallet || !blockchain || !assetAddress) return null;
    return `${wallet.toLowerCase()}-${blockchain.toLowerCase()}-${assetAddress.toLowerCase()}`;
  }, [wallet, blockchain, assetAddress]);

  const loadPosition = useCallback(async () => {
    if (!cacheKey || !wallet || !blockchain || !assetAddress) return;

    const cached = positionCache.get(cacheKey);
    if (cached !== undefined) {
      setPosition(cached);
      setState(cached ? 'success' : 'empty');
      return;
    }

    setState('loading');
    try {
      const response = await sdk.fetchWalletPosition({
        wallet,
        blockchain,
        asset: assetAddress,
      }) as WalletPositionResponse;

      const normalized = normalizePosition(response.data);
      positionCache.set(cacheKey, normalized);
      setPosition(normalized);
      setState(normalized ? 'success' : 'empty');
    } catch (error: unknown) {
      if (error instanceof MobulaError && (error.status === 404 || error.status === 400)) {
        positionCache.set(cacheKey, null);
        setPosition(null);
        setState('empty');
        return;
      }
      console.error('Failed to fetch wallet position', {
        wallet,
        blockchain,
        assetAddress,
        error,
      });
      setState('error');
    }
  }, [assetAddress, blockchain, cacheKey, wallet]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open && state === 'idle') {
        void loadPosition();
      }
    },
    [loadPosition, state],
  );

  useEffect(() => {
    if (!isOpen || !position) return undefined;
    const intervalId = window.setInterval(() => {
      setRelativeNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen, position]);

  const tokenMeta = useMemo(() => {
    if (!position) return null;
    return position.token ?? position.tokenDetails ?? null;
  }, [position]);

  const holdingShare = useMemo(() => {
    if (!position || !tokenMeta) return null;
    const supply = tokenMeta.circulatingSupply || tokenMeta.totalSupply || 0;
    if (!supply) return null;
    const percent = (position.balance / supply) * 100;
    if (!Number.isFinite(percent)) return null;
    return percent;
  }, [position, tokenMeta]);

  const content = useMemo(() => {
    if (state === 'loading' || state === 'idle') {
      return <LoadingState />;
    }

    if (state === 'error') {
      return <ErrorState onRetry={loadPosition} />;
    }

    if (state === 'empty' || !position) {
      return <EmptyState />;
    }

    const buysText = `${formatPureNumber(position.buys, {
      minFractionDigits: 0,
      maxFractionDigits: 0,
    })} buys`;
    const sellsText = `${formatPureNumber(position.sells, {
      minFractionDigits: 0,
      maxFractionDigits: 0,
    })} sells`;
    const balanceText = `${formatPureNumber(position.balance, {
      minFractionDigits: 0,
      maxFractionDigits: 2,
    })} ${tokenMeta?.symbol ?? ''}`.trim();
    const sinceText = formatRelativeDuration(position.firstDate ?? null);
    const lastText = formatRelativeDuration(position.lastDate ?? null);

    return (
      <div className="w-full space-y-3 px-4 py-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-grayGhost">Trader</p>
            <p className="text-sm font-semibold text-white">
              {walletDisplay.displayName || truncate(wallet, { length: 6, mode: 'middle' })}
            </p>
            <p className="text-[10px] text-grayGhost">
              {truncate(wallet, { length: 6, mode: 'middle' })}
            </p>
          </div>
          {walletDisplay.emoji !== '👻' ? (
            <span className="text-lg">{walletDisplay.emoji}</span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Bought"
            value={formatUSD(position.volumeBuy)}
            sublabel={buysText}
            accentClass="text-success"
          />
          <StatCard
            label="Sold"
            value={formatUSD(position.volumeSell)}
            sublabel={sellsText}
            accentClass="text-red-400"
          />
          <StatCard
            label="PNL"
            value={formatUSD(position.totalPnlUSD)}
            sublabel={`Realized ${formatUSD(position.realizedPnlUSD)}`}
            accentClass={position.totalPnlUSD >= 0 ? 'text-success' : 'text-red-400'}
          />
          <StatCard
            label="Balance"
            value={formatUSD(position.amountUSD)}
            sublabel={
              holdingShare !== null
                ? `${balanceText} · ${holdingShare.toFixed(2)}% of supply`
                : balanceText
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md border border-borderDefault/60 bg-bgContainer/40 px-2.5 py-2 text-[11px] text-grayGhost">
          <span>
            Holder since <span className="font-semibold text-white">{sinceText}</span>
          </span>
          <span className="text-right">
            Last trade <span className="font-semibold text-white">{lastText}</span>
          </span>
        </div>
      </div>
    );
  }, [
    holdingShare,
    loadPosition,
    position,
    relativeNow,
    state,
    wallet,
    walletDisplay.displayName,
    walletDisplay.emoji,
  ]);

  if (!blockchain || !assetAddress) {
    return <>{children}</>;
  }

  return (
    <HoverCard openDelay={150} closeDelay={100} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-[300px] border-borderDefault bg-bgPrimary shadow-2xl p-0"
      >
        {content}
      </HoverCardContent>
    </HoverCard>
  );
}

