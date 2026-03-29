/** Canonical native token address for EVM chains */
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

/** Canonical native SOL address (wrapped SOL) */
export const SOLANA_NATIVE_ADDRESS = 'So11111111111111111111111111111111111111112';

/** All known native addresses (lowercased for comparison) */
export const NATIVE_ADDRESSES = new Set([
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  'so11111111111111111111111111111111111111111',
  'so11111111111111111111111111111111111111112',
]);

/** Check whether an address represents a native token (SOL / ETH / etc.) */
export function isNativeAddress(addr: string): boolean {
  return NATIVE_ADDRESSES.has(addr.toLowerCase());
}

/** Get the correct native address for a chain family */
export function getNativeAddress(blockchain: string): string {
  return blockchain.startsWith('solana') || blockchain === 'solana'
    ? SOLANA_NATIVE_ADDRESS
    : NATIVE_TOKEN_ADDRESS;
}

/** Get the correct native symbol for a chain family */
export function getNativeSymbol(blockchain: string): string {
  return blockchain.startsWith('solana') || blockchain === 'solana' ? 'SOL' : 'ETH';
}

/** Get the correct native name for a chain family */
export function getNativeName(blockchain: string): string {
  return blockchain.startsWith('solana') || blockchain === 'solana' ? 'Solana' : 'Ethereum';
}

/** Wallet token from portfolio — shared across surge, trading panel, etc. */
export interface WalletToken {
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
  balance: number;
  balanceUSD: number;
  priceUSD: number;
  blockchain: string;
  isNative: boolean;
}

/**
 * Extract wallet tokens from a portfolio assets array.
 * Merges native tokens per chain family (SOL for Solana, ETH for EVM).
 */
export function extractWalletTokens(assets: Array<Record<string, unknown>>): WalletToken[] {
  const tokens: WalletToken[] = [];

  // Track native balances per chain family
  const nativeBuckets: Record<string, { balance: number; balanceUSD: number; logo: string | null; blockchain: string }> = {};

  for (const a of assets) {
    const assetObj = a.asset as Record<string, unknown> | undefined;
    const contracts = a.contracts_balances as Array<Record<string, unknown>> | undefined;
    const symbol = String(assetObj?.symbol || a.symbol || '???');
    const name = String(assetObj?.name || a.name || '');
    const logo = (assetObj?.logo as string) || (a.logo as string) || (a.image as string) || null;
    const price = Number(assetObj?.price || a.price || 0);

    if (contracts && contracts.length > 0) {
      for (const c of contracts) {
        const rawAddr = String(c.address || '');
        const bal = Number(c.balance || 0);
        if (bal <= 0) continue;
        const balUSD = Number(c.balanceUsd || c.balance_usd || 0) || (bal * price);
        const blockchain = String(c.blockchain || c.chainId || '');

        if (isNativeAddress(rawAddr)) {
          const family = blockchain.startsWith('evm') ? 'evm' : 'solana';
          if (!nativeBuckets[family]) {
            nativeBuckets[family] = { balance: 0, balanceUSD: 0, logo: null, blockchain };
          }
          nativeBuckets[family].balance += bal;
          nativeBuckets[family].balanceUSD += balUSD;
          if (!nativeBuckets[family].logo && logo) nativeBuckets[family].logo = logo;
        } else {
          tokens.push({
            address: rawAddr,
            symbol,
            name,
            logo,
            decimals: Number(c.decimals || 0),
            balance: bal,
            balanceUSD: balUSD,
            priceUSD: price || (bal > 0 ? balUSD / bal : 0),
            blockchain,
            isNative: false,
          });
        }
      }
    } else {
      const rawAddr = String(a.address || assetObj?.address || '');
      const bal = Number(a.token_balance ?? a.balance ?? 0);
      if (bal <= 0) continue;
      const estimatedBalance = Number(a.estimated_balance ?? a.balanceUSD ?? 0);
      const balUSD = estimatedBalance || (bal * price);
      const blockchain = String(a.blockchain || a.chainId || '');

      if (isNativeAddress(rawAddr)) {
        const family = blockchain.startsWith('evm') ? 'evm' : 'solana';
        if (!nativeBuckets[family]) {
          nativeBuckets[family] = { balance: 0, balanceUSD: 0, logo: null, blockchain };
        }
        nativeBuckets[family].balance += bal;
        nativeBuckets[family].balanceUSD += balUSD;
        if (!nativeBuckets[family].logo && logo) nativeBuckets[family].logo = logo;
      } else {
        tokens.push({
          address: rawAddr,
          symbol,
          name,
          logo,
          decimals: Number(a.decimals || 0),
          balance: bal,
          balanceUSD: balUSD,
          priceUSD: price || (bal > 0 ? balUSD / bal : 0),
          blockchain,
          isNative: false,
        });
      }
    }
  }

  // Add native tokens per chain family — distinct addresses to avoid confusion
  if (nativeBuckets.solana && nativeBuckets.solana.balance > 0) {
    const b = nativeBuckets.solana;
    tokens.unshift({
      address: SOLANA_NATIVE_ADDRESS,
      symbol: 'SOL',
      name: 'Solana',
      logo: b.logo,
      decimals: 9,
      balance: b.balance,
      balanceUSD: b.balanceUSD,
      priceUSD: b.balanceUSD / b.balance,
      blockchain: 'solana',
      isNative: true,
    });
  }
  if (nativeBuckets.evm && nativeBuckets.evm.balance > 0) {
    const b = nativeBuckets.evm;
    tokens.unshift({
      address: NATIVE_TOKEN_ADDRESS,
      symbol: 'ETH',
      name: 'Ethereum',
      logo: b.logo,
      decimals: 18,
      balance: b.balance,
      balanceUSD: b.balanceUSD,
      priceUSD: b.balanceUSD / b.balance,
      blockchain: b.blockchain,
      isNative: true,
    });
  }

  tokens.sort((a, b) => (b.isNative ? 1 : 0) - (a.isNative ? 1 : 0) || b.balanceUSD - a.balanceUSD);
  return tokens;
}
