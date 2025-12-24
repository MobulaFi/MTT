'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  ChefHat,
  Crosshair,
  Crown,
  Ghost,
  Boxes,
  Globe,
  UserRoundCog,
  Users,
  UserRound,
  Send,
  Bot,
  Camera,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, memo, useCallback, useRef, useMemo, useEffect, type MouseEvent } from 'react';
import SafeImage from '@/components/SafeImage';
import { usePulseDisplayStore } from '@/features/pulse/store/usePulseDisplayStore';
import type { PulseToken } from '@/features/pulse/store/usePulseDataStore';
import {
  formatCryptoPrice,
  formatPercentage,
  formatPureNumber,
} from '@mobula_labs/sdk';
import { TradeTimeCell } from '@/components/ui/tradetimecell';
import { getBuyPercent } from '@/components/shared/StatsCard';
import Image from 'next/image';

interface TokenCardProps {
  pulseData: PulseToken | null;
  shouldBonded?: boolean;
  viewName?: 'new' | 'bonding' | 'bonded';
}

import type { DisplayState } from '@/features/pulse/store/usePulseDisplayStore';
import CopyToClipboard from '@/utils/CopyToClipboard';
import CopyAddress from '@/utils/CopyAddress';

type CustomizeRows = DisplayState['customizeRows'];
type CustomizeRowKey = keyof CustomizeRows;

type TokenStatKey =
  | 'holders_count'
  | 'top10Holdings'
  | 'devHoldingsPercentage'
  | 'snipersHoldings'
  | 'insidersHoldings'
  | 'bundlersHoldings';

interface TokenStatConfig {
  id: CustomizeRowKey;
  icon: LucideIcon;
  valueKey: TokenStatKey;
  suffix: string;
  round?: boolean;
  label: string;
}

interface TokenSocials {
  twitter?: string;
  website?: string;
  telegram?: string;
}

interface ExchangeDetails {
  logo?: string;
}

interface PulseTokenDetails extends PulseToken {
  symbol?: string;
  name?: string;
  logo?: string;
  exchange?: ExchangeDetails;
  socials?: TokenSocials;
  poolAddress?: string;
  holdersCount?: number;
  holders_count?: number;
  proTradersCount?: number;
  deployerMigrations?: number;
  createdAt?: string;
  created_at?: string;
  bonded_at?: string;
  marketCap?: number;
  organic_volume_sell_24h?: number;
  fees_paid_24h?: number;
  price_change_24h?: number;
  buys_24h?: number;
  sells_24h?: number;
  bondingPercentage?: number;
  ath?: number;
  athDate?: string | number;
  atl?: number;
  atlDate?: string | number;
  source?: string;
  [key: string]: unknown;
}

const TOKEN_STATS: ReadonlyArray<TokenStatConfig> = [
  { id: 'top10Holdings', icon: UserRoundCog, valueKey: 'top10Holdings', suffix: '%', round: true, label: 'Top 10 Holdings' },
  { id: 'devHoldings', icon: ChefHat, valueKey: 'devHoldingsPercentage', suffix: '%', round: true, label: 'Dev Holding' },
  { id: 'snipersHoldings', icon: Crosshair, valueKey: 'snipersHoldings', suffix: '%', round: true, label: 'Snipers' },
  { id: 'insidersHoldings', icon: Ghost, valueKey: 'insidersHoldings', suffix: '%', round: true, label: 'Insiders' },
  { id: 'bundlersHoldings', icon: Boxes, valueKey: 'bundlersHoldings', suffix: '%', round: true, label: 'Bundlers' },
];

interface StatBadgeProps {
  Icon: LucideIcon;
  value?: number | null;
  suffix: string;
  round?: boolean;
  label: string;
}

const StatBadge = memo(({ Icon, value, suffix, round, label }: StatBadgeProps) => {
  const resolvedValue = typeof value === 'number' ? value : Number(value ?? 0);
  const numericValue = Number.isFinite(resolvedValue) ? resolvedValue : 0;
  const formattedValue = `${round ? numericValue.toFixed(0) : numericValue}${suffix}`;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="bg-bgContainer px-1 py-[2px] text-[10px] flex items-center gap-1.5 border transition-colors cursor-pointer border-[#2A2D3880] hover:border-[#3A3D48]">
            <Icon size={12} className="text-success flex-shrink-0" />
            <span className="text-success font-medium text-[10px] lg:text-xs">{formattedValue}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <span>
            {label}: {formattedValue}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

StatBadge.displayName = 'StatBadge';

// Memoized social buttons
interface SocialButtonsProps {
  token: PulseTokenDetails;
  customizeRows: CustomizeRows;
}

const SocialButtons = memo(({ token, customizeRows }: SocialButtonsProps) => {
  const handleClick = useCallback((e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  if (!customizeRows.socials || !token.socials) return null;

  return (
    <div className="flex items-center justify-start space-x-1">
      {token.socials.twitter && (
        <button
          type="button"
          onClick={(e) => handleClick(e, token.socials?.twitter ?? '')}
          className="text-textTertiary hover:text-success transition-colors"
          aria-label="Twitter"
        >
          <Globe size={15} />
        </button>
      )}
      {token.socials.website && (
        <button
          type="button"
          onClick={(e) => handleClick(e, token.socials?.website ?? '')}
          className="text-textTertiary hover:text-success transition-colors"
          aria-label="Website"
        >
          <UserRound size={15} />
        </button>
      )}
      {token.socials.telegram && (
        <button
          type="button"
          onClick={(e) => handleClick(e, token.socials?.telegram ?? '')}
          className="text-textTertiary hover:text-success transition-colors"
          aria-label="Telegram"
        >
          <Send size={15} />
        </button>
      )}
    </div>
  );
});

SocialButtons.displayName = 'SocialButtons';

const isValidDate = (timestamp?: number | string) => {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  return date.getFullYear() !== 1970;
};

interface AtlStats {
  ath?: number;
  athDate?: string | number;
  atl?: number;
  atlDate?: string | number;
}

interface ImageHoverCardProps {
  logo: string;
  symbol?: string;
  name?: string;
  onImageClick: (event: MouseEvent<HTMLDivElement>) => void;
  exchangeLogo?: string | null;
  atlStats?: AtlStats | null;
  onImageError?: () => void;
}

const ImageHoverCard = memo(({ logo, symbol, name, onImageClick, exchangeLogo, atlStats }: ImageHoverCardProps) => {
  const [isImageLoading, setIsImageLoading] = useState(false);

  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          className="flex-shrink-0 relative w-16 h-16 group cursor-pointer"
          data-interactive="true"
          data-image-preview="true"
        >
          <div onClick={onImageClick} className="w-full h-full flex items-center justify-center overflow-hidden rounded bg-bgPrimary group-hover:ring-2 group-hover:ring-success/50 transition-all">
            <Image
              src={logo}
              alt={`${symbol} token`}
              width={64}
              height={64}
              className="object-cover w-full h-full"
              loading="lazy"
              quality={90}
              priority={false}
              unoptimized={false}
            />

            {/* Camera Icon on Hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded">
              <Camera size={24} className="text-success" />
            </div>
          </div>

          {/* DEX Badge */}
          {exchangeLogo && (
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded border border-gray-600 bg-bgSecondary flex items-center justify-center"
              data-interactive="true"
            >
              <SafeImage
                src={exchangeLogo}
                alt="DEX"
                width={16}
                height={16}
                className="rounded object-cover"
                quality={90}
              />
            </div>
          )}
        </div>
      </HoverCardTrigger>

      <HoverCardContent side="right" className="w-auto p-0 bg-bgPrimary border-borderDefault">
        {/* Image Container - CLICKABLE */}
        <div
          className="relative w-72 h-72 bg-bgPrimary flex items-center justify-center overflow-hidden rounded-t-lg cursor-pointer group"
          onClick={onImageClick}
        >
          {/* Loading State - Only show if actually loading */}
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="w-8 h-8 border-2 border-success/30 border-t-success rounded-full animate-spin" />
            </div>
          )}

          {/* Image - Display immediately, no opacity fade */}
          <SafeImage
            src={logo}
            alt={`${symbol} token logo`}
            fill
            className="object-contain p-4"
            quality={95}
            priority={false}
            sizes="288px"
            onLoad={() => setIsImageLoading(false)}
            onError={() => setIsImageLoading(false)}
          />

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-t-lg">
            <Camera size={40} className="text-success drop-shadow-lg" />
          </div>
        </div>

        <div className=" py-2 bg-bgSecondary border-t border-borderDefault rounded-b-lg space-y-2">
          {/* Name and Symbol */}
          <div className='px-3'>
            <h3 className="text-sm font-bold text-textPrimary truncate">{name}</h3>
            <p className="text-xs text-textTertiary font-mono">{symbol}</p>
          </div>
          {atlStats && atlStats && isValidDate(atlStats.athDate) && isValidDate(atlStats.atlDate) && (
            <div className="px-3 grid grid-cols-2 gap-3 pt-1 border-t border-borderDefault max-w-xs divide-x divide-borderDefault">
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className='flex items-center justify-start gap-2 min-w-0'>
                  <span className="text-xs text-textPrimary font-semibold whitespace-nowrap">ATH</span>
                  {atlStats.athDate && (
                    <span className="text-xs text-textTertiary leading-tight truncate">
                      (<TradeTimeCell timestamp={atlStats.athDate} showAbsolute={true} hash="" showSeconds={false} />)
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-success">
                  {atlStats.ath ? formatCryptoPrice(atlStats.ath) : '—'}
                </span>
              </div>

              <div className="flex flex-col gap-0.5 min-w-0 pl-3">
                <div className='flex items-center justify-start gap-2 min-w-0'>
                  <span className="text-xs text-textPrimary font-semibold whitespace-nowrap">ATL</span>
                  {atlStats.atlDate && (
                    <span className="text-xs text-textTertiary leading-tight truncate">
                      (<TradeTimeCell timestamp={atlStats.atlDate} showAbsolute={true} hash="" showSeconds={false} />)
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-error">
                  {atlStats.atl ? formatCryptoPrice(atlStats.atl) : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});

ImageHoverCard.displayName = 'ImageHoverCard';

const resolvePulseTokenDetails = (token: PulseToken | null): PulseTokenDetails | null => {
  if (!token) return null;
  if (token.token && typeof token.token === 'object') {
    const { token: nestedToken, ...rest } = token;
    return { ...rest, ...nestedToken } as PulseTokenDetails;
  }
  return token as PulseTokenDetails;
};

const formatAddressLabel = (address?: string): string => {
  if (!address) return 'Unknown';
  if (address.length <= 12) return address;
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
};



// Optimized main component
function TokenCard({ pulseData, shouldBonded = true, viewName }: TokenCardProps) {
  const { customizeRows } = usePulseDisplayStore();
  const router = useRouter();

  const tokenDetails = useMemo(() => resolvePulseTokenDetails(pulseData), [pulseData]);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [tokenDetails?.logo]);

  const linkHref = useMemo(() => {
    if (!tokenDetails?.chainId || !tokenDetails?.address) {
      return null;
    }
    return `/token/${tokenDetails.chainId}/${tokenDetails.address}`;
  }, [tokenDetails]);

  const handleImageClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();

      if (!tokenDetails?.logo) return;

      const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(tokenDetails.logo)}`;
      window.open(lensUrl, '_blank', 'noopener,noreferrer');
    },
    [tokenDetails?.logo]
  );

  const handleCardClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      if (
        target.closest('button') ||
        target.closest('[data-interactive]') ||
        target.closest('.stat-badge') ||
        target.closest('.social-link') ||
        target.closest('[data-bonding]') ||
        target.closest('[data-image-preview]')
      ) {
        return;
      }

      if (linkHref) {
        router.push(linkHref);
      }
    },
    [linkHref, router]
  );

  if (!tokenDetails) {
    return <div className="p-2 text-gray-500 text-xs">Invalid</div>;
  }

  const visibleStats = useMemo(() => TOKEN_STATS.filter((stat) => customizeRows[stat.id]), [customizeRows]);
  const holdersCount = useMemo(() => tokenDetails.holdersCount ?? tokenDetails.holders_count ?? 0, [tokenDetails.holdersCount, tokenDetails.holders_count]);
  const tokenSymbol = useMemo(() => tokenDetails.symbol ?? '', [tokenDetails.symbol]);
  const logoSrc = tokenDetails.logo;
  const exchangeLogo = useMemo(() => tokenDetails.exchange?.logo ?? null, [tokenDetails.exchange?.logo]);
  const hasLogo = Boolean(logoSrc) && !logoError;
  const formattedAddress = useMemo(() => formatAddressLabel(tokenDetails.address), [tokenDetails.address]);
  const buys = useMemo(() => Number(tokenDetails.buys_24h ?? 0), [tokenDetails.buys_24h]);
  const sells = useMemo(() => Number(tokenDetails.sells_24h ?? 0), [tokenDetails.sells_24h]);
  const buyPercent = useMemo(() => getBuyPercent(buys, sells), [buys, sells]);
  const migrations = useMemo(() => tokenDetails.deployerMigrations ?? 0, [tokenDetails.deployerMigrations]);
  const hasMigrations = migrations > 0;
  const priceChange = useMemo(() => tokenDetails.price_change_24h ?? 0, [tokenDetails.price_change_24h]);
  const bondingLabel = useMemo(() => formatPercentage(tokenDetails.bondingPercentage ?? 0), [tokenDetails.bondingPercentage]);
  const sourceLabel = useMemo(() => tokenDetails.source ?? 'Unknown', [tokenDetails.source]);

  const timestamp = useMemo(() => {
    if (viewName === 'bonded' && tokenDetails.bonded_at && typeof tokenDetails.bonded_at === 'string' && tokenDetails.bonded_at !== tokenDetails.created_at) {
      return tokenDetails.bonded_at;
    }
    return tokenDetails.createdAt ?? tokenDetails.created_at ?? '';
  }, [viewName, tokenDetails.bonded_at, tokenDetails.created_at, tokenDetails.createdAt]);

  // Memoize all formatted values to prevent recalculation on every render
  const formattedMarketCap = useMemo(
    () => formatCryptoPrice(tokenDetails.marketCap ?? 0),
    [tokenDetails.marketCap]
  );

  const formattedVolume = useMemo(
    () => formatCryptoPrice(tokenDetails.organic_volume_sell_24h ?? 0),
    [tokenDetails.organic_volume_sell_24h]
  );

  const formattedFees = useMemo(
    () => formatCryptoPrice(tokenDetails.fees_paid_24h ?? 0, {
      minFractionDigits: 1,
      maxFractionDigits: 1,
    }),
    [tokenDetails.fees_paid_24h]
  );

  const formattedPriceChange = useMemo(
    () => formatPercentage(priceChange, {
      maxFractionDigits: 2,
      minFractionDigits: 2,
    }),
    [priceChange]
  );


  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={handleCardClick}
            className="cursor-pointer bg-bgPrimary hover:bg-bgTableHover text-textPrimary transition-all duration-200 px-3 py-2 rounded-md"
          >
            {/* Header Section */}
            <div className="flex justify-between w-full items-start gap-4">
              {/* Left: Token Image + Details */}
              <div className="flex space-x-3 flex-1 min-w-0">
                {hasLogo && logoSrc ? (
                  <ImageHoverCard
                    logo={logoSrc}
                    symbol={tokenSymbol}
                    name={tokenDetails.name}
                    exchangeLogo={exchangeLogo}
                    onImageClick={handleImageClick}
                    onImageError={() => setLogoError(true)}
                    atlStats={{
                      ath: tokenDetails.ath,
                      athDate: tokenDetails.athDate,
                      atl: tokenDetails.atl,
                      atlDate: tokenDetails.atlDate,
                    }}
                  />
                ) : (
                  <div className="flex-shrink-0 relative w-16 h-16">
                    <div className="w-full h-full flex items-center justify-center bg-black rounded">
                      <span className="text-xs font-bold text-gray-300">
                        {tokenSymbol.slice(0, 1).toUpperCase() || '?'}
                      </span>
                    </div>
                    {exchangeLogo && (
                      <div
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded border border-gray-600 bg-bgSecondary flex items-center justify-center"
                        data-interactive="true"
                      >
                        <SafeImage src={exchangeLogo} alt="DEX" width={16} height={16} className="rounded object-cover" quality={90} />
                      </div>
                    )}
                  </div>
                )}

                {/* Token Details */}
                <div className="flex space-y-1 flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >

                      <CopyAddress display={tokenDetails.name ?? ''} value={tokenDetails.address ?? ''} />
                    </div>


                    {/* Social Buttons */}
                    <div className="social-link">
                      <SocialButtons token={tokenDetails} customizeRows={customizeRows} />
                    </div>
                  </div>

                  {/* Symbol + Holders + Pro Traders */}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-textTertiary">
                    <span className="font-semibold uppercase">{tokenSymbol}</span>

                    {customizeRows.holders && (
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-pointer">
                              <UserRound size={14} className="text-textTertiary flex-shrink-0" />
                              {formatPureNumber(holdersCount, {
                                maxFractionDigits: 0,
                                minFractionDigits: 0,
                              })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Holders
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {customizeRows.proTraders && (
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-pointer">
                              <Bot size={14} className="text-textTertiary flex-shrink-0" />
                              {tokenDetails.proTradersCount ?? 0}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Pro traders
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {customizeRows.devMigrations && (
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-pointer">
                              <Crown
                                size={14}
                                className={`flex-shrink-0 ${hasMigrations ? 'text-success' : 'text-textTertiary'}`}
                              />
                              <span className={hasMigrations ? 'text-success' : 'text-textTertiary'}>
                                {migrations}
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Deployer migrations
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>

                  {/* Creation Date + Address */}
                  <div className="flex items-center gap-2 text-xs text-textTertiary flex-wrap">
                    <TradeTimeCell
                      timestamp={timestamp}
                      showAbsolute={false}
                      hash=""
                    />

                    <span className="text-accentPurple font-mono">{formattedAddress}</span>
                  </div>
                </div>
              </div>

              {/* Right: Market Data */}
              <div className="flex flex-col items-end flex-shrink-0 min-w-[90px] gap-1">
                {customizeRows.marketCap && (
                  <div className="flex gap-1 justify-end text-xs">
                    <span className="text-textTertiary font-medium">Mcap</span>
                    <span className="text-white font-semibold">
                      {formattedMarketCap}
                    </span>
                  </div>
                )}
                {customizeRows.volume && (
                  <div className="flex gap-1 justify-end text-xs">
                    <span className="text-textTertiary font-medium">Vol</span>
                    <span className="text-white font-semibold">
                      {formattedVolume}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats / Bottom Section */}
            <div className="flex items-center justify-end mt-1">
              <div className="flex items-center ml-auto">
                {customizeRows.fees && (
                  <div className="flex items-center gap-1 text-xs font-normal text-right w-15">
                    <div className="text-textTertiary w-4">F</div>
                    <div className="text-success font-normal truncate">
                      {formattedFees}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 text-xs font-normal text-right w-15">
                  <div className="text-textTertiary w-4">N</div>
                  <div className={`${priceChange >= 0 ? 'text-success' : 'text-error'} font-normal truncate`}>
                    {priceChange >= 0 ? '+' : ''}
                    {formattedPriceChange}
                  </div>
                </div>

                {customizeRows.tx && (
                  <div className="flex items-center gap-1 text-xs font-normal text-right w-15">
                    <div className="text-textTertiary w-6">TX</div>
                    <div className="text-textPrimary font-normal truncate">
                      {formatPureNumber(buys + sells)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            {visibleStats.length > 0 && (
              <div className="flex items-center w-full">
                <div className="flex items-center gap-1 flex-wrap w-[70%]">
                  {visibleStats.map(({ icon: Icon, valueKey, suffix, round, label }) => {
                    const rawValue = tokenDetails[valueKey];
                    const numericValueCandidate = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);
                    const numericValue = Number.isFinite(numericValueCandidate) ? numericValueCandidate : 0;

                    return (
                      <div key={valueKey} className="stat-badge" data-interactive="true">
                        <StatBadge Icon={Icon} value={numericValue} suffix={suffix} round={round} label={label} />
                      </div>
                    );
                  })}
                </div>

                {customizeRows.tx && (
                  <div className="flex-1">
                    <div className="w-full h-1 bg-white rounded-full overflow-hidden relative mt-2">
                      <div
                        className="absolute top-0 left-0 h-full bg-success rounded-full transition-all duration-300"
                        style={{ width: `${buyPercent}%` }}
                      />
                      <div
                        className="absolute top-0 bg-black"
                        style={{ left: `${buyPercent}%`, width: '2px', height: '100%' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TooltipTrigger>

        <TooltipContent side="top" className="text-xs">
          <span className="text-success">
            {shouldBonded ? `Bonding: ${bondingLabel}` : `${sourceLabel}`}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Custom comparison function for React.memo to prevent unnecessary re-renders
export default memo(TokenCard, (prev, next) => {
  // Only re-render if relevant data changed
  const prevToken = resolvePulseTokenDetails(prev.pulseData);
  const nextToken = resolvePulseTokenDetails(next.pulseData);

  if (!prevToken || !nextToken) {
    return prevToken === nextToken;
  }

  // Compare only fields that affect rendering
  return (
    prevToken.price_change_24h === nextToken.price_change_24h &&
    prevToken.marketCap === nextToken.marketCap &&
    prevToken.organic_volume_sell_24h === nextToken.organic_volume_sell_24h &&
    prevToken.fees_paid_24h === nextToken.fees_paid_24h &&
    prevToken.bondingPercentage === nextToken.bondingPercentage &&
    prevToken.holders_count === nextToken.holders_count &&
    prevToken.holdersCount === nextToken.holdersCount &&
    prevToken.buys_24h === nextToken.buys_24h &&
    prevToken.sells_24h === nextToken.sells_24h &&
    prevToken.logo === nextToken.logo &&
    prev.shouldBonded === next.shouldBonded &&
    prev.viewName === next.viewName
  );
});