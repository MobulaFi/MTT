'use client';

import { memo, useCallback } from 'react';
import { Loader2, Check, Zap } from 'lucide-react';
import { useQuickBuySwap } from '../hooks/useQuickBuySwap';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import type { ResolvedToken } from '../hooks/useTokenResolver';

interface QuickBuyButtonProps {
  token: ResolvedToken;
  amountSol: number;
  compact?: boolean;
}

function QuickBuyButton({ token, amountSol, compact = false }: QuickBuyButtonProps) {
  const { executeBuy, isLoading } = useQuickBuySwap();
  const loading = isLoading(token);
  const isConnected = useWalletConnectionStore((s) => !!s.solanaAddress || !!s.evmAddress);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      executeBuy(token, amountSol);
    },
    [executeBuy, token, amountSol],
  );

  if (!isConnected) return null;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1 rounded-md font-medium transition-all
        ${loading
          ? 'bg-bgContainer text-textTertiary cursor-wait'
          : 'bg-success/15 text-success hover:bg-success/25 active:scale-95 cursor-pointer'
        }
        ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}
      `}
      title={`Buy ${amountSol} SOL of ${token.symbol}`}
    >
      {loading ? (
        <Loader2 size={10} className="animate-spin" />
      ) : (
        <Zap size={10} />
      )}
      {amountSol}
    </button>
  );
}

export default memo(QuickBuyButton);
