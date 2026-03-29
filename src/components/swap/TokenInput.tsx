'use client';

import { useMemo, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSwapPageStore } from '@/store/useSwapPageStore';
import SafeImage from '@/components/SafeImage';
import { formatCryptoPrice } from '@mobula_labs/sdk';

const SOL_NATIVE = 'So11111111111111111111111111111111111111111';
const WSOL_ADDRESS = 'So11111111111111111111111111111111111111112';
const SOL_LOGO = 'https://assets.coingecko.com/coins/images/4128/standard/solana.png';

interface TokenInputProps {
  mode: 'from' | 'to';
  balance?: string | null;
  usdValue?: number | null;
}

export function TokenInput({ mode, balance, usdValue }: TokenInputProps) {
  const {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    isQuoteLoading,
    setAmountIn,
    setTokenIn,
    setTokenOut,
    openTokenPicker,
  } = useSwapPageStore();

  const token = mode === 'from' ? tokenIn : tokenOut;
  const amount = mode === 'from' ? amountIn : amountOut;
  const isEditable = mode === 'from';

  const isSolOrWsol = token?.address === SOL_NATIVE || token?.address === WSOL_ADDRESS;
  const isNativeSol = token?.address === SOL_NATIVE;

  const handleSolWsolToggle = useCallback(() => {
    if (!token) return;
    const setToken = mode === 'from' ? setTokenIn : setTokenOut;
    if (isNativeSol) {
      setToken({ ...token, address: WSOL_ADDRESS, symbol: 'WSOL', name: 'Wrapped SOL', logo: SOL_LOGO });
    } else {
      setToken({ ...token, address: SOL_NATIVE, symbol: 'SOL', name: 'Solana', logo: SOL_LOGO });
    }
  }, [token, isNativeSol, mode, setTokenIn, setTokenOut]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setAmountIn(value);
    }
  };

  const handleHalf = () => {
    if (!balance) return;
    const half = parseFloat(balance) / 2;
    if (!isNaN(half)) setAmountIn(half.toString());
  };

  const handleMax = () => {
    if (!balance) return;
    const max = parseFloat(balance);
    if (!isNaN(max)) setAmountIn(max.toString());
  };

  const formattedBalance = useMemo(() => {
    if (!balance) return null;
    const num = parseFloat(balance);
    if (isNaN(num)) return null;
    if (num < 0.001 && num > 0) return '<0.001';
    return num.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }, [balance]);

  return (
    <div className="px-5 pb-1.5">
      <div className={`rounded-xl border transition-colors ${
        mode === 'from'
          ? 'bg-bgPrimary border-borderDefault'
          : 'bg-bgPrimary/70 border-borderDefault/60'
      }`}>
        {/* Inner content */}
        <div className="p-4">
          {/* Top: Label + Balance */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium text-textTertiary">
              {mode === 'from' ? "You're selling" : "You're buying"}
            </span>
            {mode === 'from' && token && formattedBalance !== null && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-textTertiary">
                  {formattedBalance}
                </span>
                <button
                  onClick={handleHalf}
                  className="text-[11px] font-bold text-success hover:text-success/80 transition-colors"
                >
                  HALF
                </button>
                <button
                  onClick={handleMax}
                  className="text-[11px] font-bold text-success hover:text-success/80 transition-colors"
                >
                  MAX
                </button>
              </div>
            )}
          </div>

          {/* Middle: Amount + Token Selector */}
          <div className="flex items-center gap-4">
            {/* Amount */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={isEditable ? handleAmountChange : undefined}
                readOnly={!isEditable}
                placeholder="0"
                className={`w-full bg-transparent text-[36px] font-bold outline-none placeholder:text-textTertiary/30 leading-none tracking-tight ${
                  isEditable ? 'text-textPrimary caret-success' : 'text-textSecondary'
                } ${!isEditable && isQuoteLoading ? 'animate-pulse' : ''}`}
              />
            </div>

            {/* SOL/WSOL Toggle + Token Selector Pill */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
            {isSolOrWsol && (
              <button
                onClick={handleSolWsolToggle}
                className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all bg-bgTertiary border border-borderDefault/60 hover:bg-bgHighlight"
              >
                <span className={isNativeSol ? 'text-success' : 'text-textTertiary'}>SOL</span>
                <span className="text-textTertiary/40 mx-0.5">/</span>
                <span className={!isNativeSol ? 'text-success' : 'text-textTertiary'}>WSOL</span>
              </button>
            )}
            <button
              onClick={() => openTokenPicker(mode === 'from' ? 'tokenIn' : 'tokenOut')}
              className={`flex items-center gap-2 transition-all duration-150 ${
                token
                  ? 'bg-bgTertiary hover:bg-bgHighlight border border-borderDefault/60 rounded-2xl pl-2 pr-3 py-2'
                  : 'bg-success hover:brightness-110 text-white rounded-2xl px-5 py-3 shadow-lg shadow-success/20 font-bold'
              }`}
            >
              {token ? (
                <>
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-bgHighlight">
                    {token.logo ? (
                      <SafeImage
                        src={token.logo}
                        alt={token.symbol}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 flex items-center justify-center text-sm font-bold text-textPrimary bg-bgHighlight rounded-full">
                        {token.symbol.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="text-base font-bold text-textPrimary">{token.symbol}</span>
                  <ChevronDown size={16} className="text-textTertiary" />
                </>
              ) : (
                <>
                  <span className="text-base whitespace-nowrap">Select token</span>
                  <ChevronDown size={16} />
                </>
              )}
            </button>
            </div>
          </div>

          {/* Bottom: USD value */}
          <div className="mt-2 h-5">
            {usdValue != null && usdValue > 0 ? (
              <span className="text-[13px] text-textTertiary">
                ~{formatCryptoPrice(usdValue)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
