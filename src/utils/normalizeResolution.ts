/** Convert TradingView resolution strings to OHLCV API period format */
export const normalizeResolution = (resolution: string): string => {
  switch (resolution) {
    case '1S': case '1s': return '1s';
    case '5S': case '5s': return '5s';
    case '15S': case '15s': return '15s';
    case '30S': case '30s': return '30s';
    case '1': case '1m': return '1m';
    case '5': case '5m': return '5m';
    case '15': case '15m': return '15m';
    case '30': case '30m': return '30m';
    case '60': case '1h': return '1h';
    case '240': case '4h': return '4h';
    case '1D': case '1d': return '1d';
    case '1W': case '1w': return '1w';
    case '1M': case '1month': return '1M';
    default: return resolution;
  }
};
