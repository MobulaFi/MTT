// adapters/statsCardAdapter.ts
import { StatsCardData } from '@/components/shared/StatsCard';
import { formatPercentage, formatPureNumber } from '@mobula_labs/sdk';
import {
  UserRoundCog, ChefHat, Crosshair, Ghost, Boxes,
  Flame, Users, TrendingUp
} from 'lucide-react';

type BuildTokenOptions = {
  quoteToken?: StatsCardData['quoteToken'];
};

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

const deriveBondingInfo = (p: any): StatsCardData['bondingInfo'] => {
  const percentageSources = [
    p?.bondingPercentage,
    p?.base?.bondingPercentage,
    p?.base?.bondingCurve?.bondingPercentage,
  ];

  const rawPercentage = percentageSources.find(
    (value) => typeof value === 'number' && Number.isFinite(value)
  );

  const normalizedPercentage =
    typeof rawPercentage === 'number' ? clampPercentage(rawPercentage) : null;

  const bondedState =
    p?.bonded ?? p?.base?.bonded ?? (normalizedPercentage !== null && normalizedPercentage >= 100);

  const hasBondingCurveMetadata =
    Boolean(p?.bondingCurveAddress) ||
    Boolean(p?.preBondingPoolAddress) ||
    Boolean(p?.base?.bondingCurveAddress) ||
    Boolean(p?.base?.preBondingFactory);

  if (
    bondedState ||
    normalizedPercentage === null ||
    Number.isNaN(normalizedPercentage) ||
    (!hasBondingCurveMetadata && normalizedPercentage === 0)
  ) {
    return undefined;
  }

  const factoryLabel =
    p?.base?.sourceFactory ||
    p?.base?.source ||
    p?.sourceFactory ||
    p?.source ||
    p?.exchange?.name ||
    'Bonding curve';

  return {
    percentage: normalizedPercentage,
    isBonded: Boolean(bondedState),
    label: factoryLabel,
  };
};

export const buildPair = (p: any): StatsCardData => ({
  baseToken: p.base,
  quoteToken: p.quote,
  headerImage: p.dexscreenerHeader ?? p.base?.logo,
  socials: p.socials,
  bondingInfo: deriveBondingInfo(p),

  timeframes: [
    { label: '5m', value: p.priceChange5minPercentage, key: '5min' },
    { label: '1h', value: p.priceChange1hPercentage, key: '1h' },
    { label: '6h', value: p.priceChange6hPercentage, key: '6h' },
    { label: '24h', value: p.priceChange24hPercentage, key: '24h' },
  ],

  getTimeframeStats: (tf) => ({
    trades: p[`trades${tf}`] ?? 0,
    buys: p[`buys${tf}`] ?? 0,
    sells: p[`sells${tf}`] ?? 0,
    volume: p[`volume${tf}USD`] ?? 0,
    buyVolume: p[`volumeBuy${tf}USD`] ?? 0,
    sellVolume: p[`volumeSell${tf}USD`] ?? 0,
    buyers: p[`buyers${tf}`] ?? 0,
    sellers: p[`sellers${tf}`] ?? 0,
    traders: p[`traders${tf}`] ?? 0,
  }),

  metrics: [
    { iconColor: p.top10HoldingsPercentage ? 'text-success' : 'text-grayMedium', value: formatPercentage(p.top10HoldingsPercentage), label: 'Top 10 H.', icon: UserRoundCog },
    { iconColor: p.devHoldingsPercentage ? 'text-success' : 'text-grayMedium', value: formatPercentage(p.devHoldingsPercentage), label: 'Dev H.', icon: ChefHat },
    { iconColor: p.snipersHoldingsPercentage ? 'text-success' : 'text-grayMedium', value: formatPercentage(p.snipersHoldingsPercentage), label: 'Snipers H.', icon: Crosshair, count: `${formatPureNumber(p.snipersCount, { minFractionDigits: 0, maxFractionDigits: 0 })}` },
    { iconColor: p.insidersHoldingsPercentage ? 'text-success' : 'text-grayMedium', value: formatPercentage(p.insidersHoldingsPercentage), label: 'Insiders', icon: Ghost, count: `${formatPureNumber(p.insidersCount, { minFractionDigits: 0, maxFractionDigits: 0 })}` },
    { textColor: p.bundlersHoldingsPercentage ? 'text-white' : 'text-grayMedium', iconColor: p.bundlersHoldingsPercentage ? 'text-success' : 'text-grayMedium', value: formatPercentage(p.bundlersHoldingsPercentage), label: 'Bundlers', icon: Boxes, count: `${formatPureNumber(p.bundlersCount, { minFractionDigits: 0, maxFractionDigits: 0 })}` },
    { iconColor: 'text-success', value: '100%', label: 'LP Burned', icon: Flame },
    { iconColor: p.holdersCount ? 'text-success' : 'text-grayMedium', value: formatPureNumber(p.holdersCount, { minFractionDigits: 0, maxFractionDigits: 0 }), label: 'Holders', icon: Users },
    { iconColor: p.proTradersCount ? 'text-success' : 'text-grayMedium', value: formatPureNumber(p.proTradersCount, { minFractionDigits: 0, maxFractionDigits: 0 }), label: 'Pro Traders', icon: TrendingUp },
    {
      iconColor: p.dexscreenerListed ? 'text-white' : 'text-grayMedium',
      textColor: p.dexscreenerListed ? 'text-white' : 'text-grayMedium', value: p.dexscreenerListed ? 'Yes' : 'No', label: 'Dev Paid'
    },
  ],

  deployer: p.deployer,
  poolAddress: p.address,

  createdAt: p.createdAt,
  contractAddress: p.address,
  explorerUrl: `https://etherscan.io/address/${p.address}`,
  additionalAddresses: [
    { label: 'Migrated', address: p.base.address, explorerUrl: `https://etherscan.io/address/${p.base.address}` }
  ],
});

export const buildToken = (t: any, options: BuildTokenOptions = {}): StatsCardData => ({
  baseToken: {
    symbol: t.symbol,
    address: t.address,
    logo: t.logo,
    approximateReserveToken: t.liquidityUSD,
  },
  quoteToken: options.quoteToken,
  headerImage: t.dexscreenerHeader ?? t.logo,
  socials: t.socials,

  timeframes: [
    { label: '5m', value: t.priceChange5minPercentage ?? 0, key: '5min' },
    { label: '1h', value: t.priceChange1hPercentage ?? 0, key: '1h' },
    { label: '6h', value: t.priceChange6hPercentage ?? 0, key: '6h' },
    { label: '24h', value: t.priceChange24hPercentage ?? 0, key: '24h' },
  ],

  getTimeframeStats: (tf) => ({
    trades: t[`trades${tf}`] ?? 0,
    buys: t[`buys${tf}`] ?? 0,
    sells: t[`sells${tf}`] ?? 0,
    volume: t[`volume${tf}USD`] ?? 0,
    buyVolume: t[`volumeBuy${tf}USD`] ?? 0,
    sellVolume: t[`volumeSell${tf}USD`] ?? 0,
    buyers: t[`buyers${tf}`] ?? 0,
    sellers: t[`sellers${tf}`] ?? 0,
    traders: t[`traders${tf}`] ?? 0,
  }),

  metrics: [
    { iconColor: t.top10HoldingsPercentage ? 'text-success' : 'text-grayMedium',value: formatPercentage(t.top10HoldingsPercentage), label: 'Top 10 H.', icon: UserRoundCog },
    { iconColor: t.devHoldingsPercentage ? 'text-success' : 'text-grayMedium',  value: formatPercentage(t.devHoldingsPercentage), label: 'Dev H.', icon: ChefHat },
    { iconColor: t.snipersHoldingsPercentage ? 'text-success' : 'text-grayMedium', value: formatPercentage(t.snipersHoldingsPercentage), label: 'Snipers H.', icon: Crosshair, count: t.snipersCount?.toString() },
    {  iconColor: t.insidersHoldingsPercentage ? 'text-success' : 'text-grayMedium', value: formatPercentage(t.insidersHoldingsPercentage), label: 'Insiders', icon: Ghost, count: t.insidersCount?.toString() },
    {textColor: t.bundlersHoldingsPercentage ? 'text-white' : 'text-grayMedium', iconColor: t.bundlersHoldingsPercentage ? 'text-success' : 'text-grayMedium', value: formatPercentage(t.bundlersHoldingsPercentage), label: 'Bundlers', icon: Boxes, count: t.bundlersCount?.toString() },
    { iconColor: 'text-success', value: t.security?.noMintAuthority ? '100%' : '0%', label: 'LP Burned', icon: Flame },
    {  iconColor: t.holdersCount ? 'text-success' : 'text-grayMedium', value: formatPureNumber(t.holdersCount, { minFractionDigits: 0, maxFractionDigits: 0 }), label: 'Holders', icon: Users },
    { iconColor: t.proTradersCount ? 'text-success' : 'text-grayMedium', value: formatPureNumber(t.proTradersCount, { minFractionDigits: 0, maxFractionDigits: 0 }), label: 'Pro Traders', icon: TrendingUp },
    { iconColor: t.dexscreenerListed ? 'text-white' : 'text-grayMedium',  textColor: t.dexscreenerListed ? 'text-white' : 'text-grayMedium', value: t.dexscreenerListed ? 'Yes' : 'No', label: 'DEX Listed' },
  ],


  poolAddress: t.poolAddress?? '',
  deployer: t.deployer ?? '',

  createdAt: t.createdAt,
  contractAddress: t.address,
  explorerUrl: `https://etherscan.io/address/${t.address}`,
});