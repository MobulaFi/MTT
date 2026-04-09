import type { TokenPositionsOutputResponse } from '@mobula_labs/types';
import type { StreamTradeEvent } from '@/features/pair/store/usePairHolderStore';

interface ApplyTradesOptions {
  /** Remove holders whose balance reaches 0 after a sell (used for holders view) */
  removeZeroBalance?: boolean;
}

interface ApplyTradesResult {
  positions: TokenPositionsOutputResponse[];
  countDelta: number;
}

/** Convert a timestamp that may be in seconds or milliseconds to a Date */
function toDate(ts: number): Date {
  return new Date(ts > 1e12 ? ts : ts * 1000);
}

/**
 * Convert a raw balance (bigint string) to human-readable number.
 * Uses tokenAmountRaw / tokenAmount ratio to derive the decimals factor.
 */
function rawToHuman(rawValue: string | null | undefined, trade: StreamTradeEvent): number | null {
  if (!rawValue) return null;

  const postBig = Number(rawValue);
  if (!Number.isFinite(postBig)) return null;

  // Derive decimals factor from raw vs human token amount
  const rawAmt = Number(trade.tokenAmountRaw);
  const humanAmt = trade.tokenAmount;
  if (rawAmt && humanAmt && humanAmt > 0) {
    const factor = rawAmt / humanAmt;
    if (factor >= 1) return postBig / factor;
  }

  // Fallback: if we can't derive decimals, return null (use incremental)
  return null;
}

/**
 * Get the authoritative post-balance for the wallet being updated.
 * - If wallet === sender: use postBalanceBaseToken (sender's balance)
 * - If wallet === swapRecipient (and !== sender): use postBalanceRecipientBaseToken
 */
function getPostBalanceForWallet(trade: StreamTradeEvent, wallet: string): number | null {
  const sender = trade.sender?.toLowerCase();
  const recipient = trade.swapRecipient?.toLowerCase();

  if (recipient && recipient !== sender && wallet === recipient) {
    // Wallet is the swap recipient (different from sender) — use recipient post-balance
    return rawToHuman(trade.postBalanceRecipientBaseToken, trade);
  }
  // Wallet is the sender (or sender === recipient) — use sender post-balance
  return rawToHuman(trade.postBalanceBaseToken, trade);
}

export function applyTradesToPositions(
  positions: TokenPositionsOutputResponse[],
  trades: StreamTradeEvent[],
  options: ApplyTradesOptions = {},
): ApplyTradesResult {
  const { removeZeroBalance = false } = options;

  const items = [...positions];
  const walletIndex = new Map<string, number>();
  items.forEach((h, i) => walletIndex.set(h.walletAddress.toLowerCase(), i));

  let countDelta = 0;

  // Find liquidity pool position to update its reserves
  let poolIdx = items.findIndex((p) => p.labels?.includes('liquidityPool'));

  for (const trade of trades) {
    const wallet = (trade.swapRecipient || trade.sender)?.toLowerCase();
    if (!wallet) continue;

    const idx = walletIndex.get(wallet);
    const isBuy = trade.type === 'buy';
    const tradeAmt = trade.tokenAmount || 0;

    if (idx !== undefined) {
      const h = { ...items[idx] };
      const prevBalance = Number(h.tokenAmount) || 0;
      const tradeUsd = trade.tokenAmountUsd || 0;

      // Use post-balance from stream when available (authoritative, no drift)
      const postBalanceHuman = getPostBalanceForWallet(trade, wallet);
      if (postBalanceHuman !== null) {
        h.tokenAmount = String(postBalanceHuman);
      } else {
        // Fallback: incremental calculation
        h.tokenAmount = String(
          isBuy ? prevBalance + tradeAmt : Math.max(0, prevBalance - tradeAmt),
        );
      }

      // Update counters & volumes
      if (isBuy) {
        h.buys = (h.buys || 0) + 1;
        h.volumeBuyUSD = String((Number(h.volumeBuyUSD) || 0) + tradeUsd);
        h.volumeBuyToken = String((Number(h.volumeBuyToken) || 0) + tradeAmt);
      } else {
        h.sells = (h.sells || 0) + 1;
        h.volumeSellUSD = String((Number(h.volumeSellUSD) || 0) + tradeUsd);
        h.volumeSellToken = String((Number(h.volumeSellToken) || 0) + tradeAmt);
      }

      // Recalculate avg prices
      const totalBuyTokens = Number(h.volumeBuyToken) || 0;
      const totalBuyUSD = Number(h.volumeBuyUSD) || 0;
      if (totalBuyTokens > 0) h.avgBuyPriceUSD = String(totalBuyUSD / totalBuyTokens);

      const totalSellTokens = Number(h.volumeSellToken) || 0;
      const totalSellUSD = Number(h.volumeSellUSD) || 0;
      if (totalSellTokens > 0) h.avgSellPriceUSD = String(totalSellUSD / totalSellTokens);

      // Recalculate realized PnL (unrealized done in global pass below)
      const avgBuy = Number(h.avgBuyPriceUSD) || 0;
      h.realizedPnlUSD = String(totalSellUSD - avgBuy * totalSellTokens);

      h.lastActivityAt = toDate(trade.timestamp);
      h.lastTradeAt = toDate(trade.timestamp);

      if (trade.labels?.length) h.labels = trade.labels;
      if (trade.walletMetadata) h.walletMetadata = trade.walletMetadata;

      items[idx] = h;

      // Remove if balance is 0 after a sell
      if (removeZeroBalance && !isBuy && Number(h.tokenAmount) <= 0) {
        items.splice(idx, 1);
        walletIndex.clear();
        items.forEach((ho, i) => walletIndex.set(ho.walletAddress.toLowerCase(), i));
        countDelta--;
        // Re-find pool index after splice
        poolIdx = items.findIndex((p) => p.labels?.includes('liquidityPool'));
      }
    } else if (isBuy) {
      // New wallet appeared with a buy — only add on buys
      const newEntry = createNewPosition(trade);
      walletIndex.set(wallet, items.length);
      items.push(newEntry);
      countDelta++;
    }

    // NOTE: LP balance is NOT updated from stream trades to avoid double-counting.
    // The periodic REST resync (every 30s) provides the authoritative LP balance.
    // Updating LP incrementally here caused drift > 100% because trades arriving
    // around resync time were counted both in REST data and stream processing.
  }

  // Global pass: recalculate price-dependent values for ALL positions
  // using the latest trade price so USD balances and uPnL stay fresh
  const latestPrice = trades[trades.length - 1]?.tokenPrice;
  if (latestPrice) {
    for (let i = 0; i < items.length; i++) {
      const h = { ...items[i] };
      const balance = Number(h.tokenAmount) || 0;

      h.tokenAmountUSD = String(balance * latestPrice);

      const avgBuy = Number(h.avgBuyPriceUSD) || 0;
      h.unrealizedPnlUSD = String((latestPrice - avgBuy) * balance);
      h.totalPnlUSD = String(Number(h.realizedPnlUSD) + Number(h.unrealizedPnlUSD));
      h.pnlUSD = h.totalPnlUSD;

      items[i] = h;
    }
  }

  return { positions: items, countDelta };
}

function createNewPosition(trade: StreamTradeEvent): TokenPositionsOutputResponse {
  const wallet = (trade.swapRecipient || trade.sender)?.toLowerCase() || '';
  const postBal = getPostBalanceForWallet(trade, wallet);
  const balance = postBal !== null ? postBal : (trade.tokenAmount || 0);
  return {
    chainId: trade.blockchain,
    walletAddress: trade.swapRecipient || trade.sender,
    tokenAddress: trade.token || '',
    tokenAmount: String(balance),
    tokenAmountRaw: '',
    tokenAmountUSD: String(trade.tokenAmountUsd || 0),
    percentageOfTotalSupply: '0',
    pnlUSD: '0',
    realizedPnlUSD: '0',
    unrealizedPnlUSD: '0',
    totalPnlUSD: '0',
    buys: 1,
    sells: 0,
    volumeBuyToken: String(trade.tokenAmount || 0),
    volumeSellToken: '0',
    volumeBuyUSD: String(trade.tokenAmountUsd || 0),
    volumeSellUSD: '0',
    avgBuyPriceUSD: String(trade.tokenPrice || 0),
    avgSellPriceUSD: '0',
    walletFundAt: null,
    lastActivityAt: toDate(trade.timestamp),
    firstTradeAt: toDate(trade.timestamp),
    lastTradeAt: toDate(trade.timestamp),
    labels: trade.labels || null,
    walletMetadata: trade.walletMetadata || null,
    platform: null,
    fundingInfo: {
      from: null, date: null, chainId: null, txHash: null,
      amount: null, formattedAmount: null, currency: null,
      fromWalletLogo: null, fromWalletTag: null,
    },
  } as TokenPositionsOutputResponse;
}
