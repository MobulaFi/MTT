'use client';

import { useState, useEffect } from 'react';
import { FiArrowUp, FiChevronDown } from 'react-icons/fi';
import { useTokenAccounts, type TokenAccount } from '@/hooks/wallet/useTokenAccounts';
import { useWithdraw } from '@/hooks/wallet/useWithdraw';

const SOL_LOGO =
  'https://assets.coingecko.com/coins/images/4128/standard/solana.png';

function formatBalance(balance: number): string {
  if (balance === 0) return '0';
  if (balance < 0.0001) return '<0.0001';
  if (balance < 1) return balance.toFixed(4);
  if (balance < 1000) return balance.toFixed(2);
  return balance.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function shortenMint(mint: string): string {
  if (mint === 'SOL') return 'SOL';
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

function isValidSolanaAddress(addr: string): boolean {
  if (addr.length < 32 || addr.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr);
}

export function WithdrawModal({
  onClose,
  solanaAddress,
}: {
  onClose: () => void;
  solanaAddress: string | null;
}) {
  const { accounts, isLoading: isLoadingAccounts, refresh } = useTokenAccounts(solanaAddress);
  const { withdraw, isLoading: isWithdrawing } = useWithdraw();

  const [selectedToken, setSelectedToken] = useState<TokenAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [showTokenSelect, setShowTokenSelect] = useState(false);

  useEffect(() => {
    if (accounts.length > 0 && !selectedToken) {
      setSelectedToken(accounts[0]);
    }
  }, [accounts, selectedToken]);

  const addressError =
    destination.length > 0 && !isValidSolanaAddress(destination)
      ? 'Invalid Solana address'
      : destination === solanaAddress
        ? 'Cannot withdraw to your own wallet'
        : null;

  const numericAmount = Number.parseFloat(amount) || 0;
  const maxBalance = selectedToken?.balance ?? 0;
  const isSOL = selectedToken?.isNative ?? false;
  // Reserve 0.005 SOL for fees when withdrawing SOL
  const effectiveMax = isSOL ? Math.max(0, maxBalance - 0.005) : maxBalance;
  const amountError =
    numericAmount > 0 && numericAmount > effectiveMax
      ? isSOL
        ? 'Insufficient balance (0.005 SOL reserved for fees)'
        : 'Insufficient balance'
      : null;

  const canSubmit =
    !isWithdrawing &&
    destination.length > 0 &&
    !addressError &&
    numericAmount > 0 &&
    !amountError &&
    selectedToken !== null;

  const handleMax = () => {
    if (effectiveMax > 0) {
      setAmount(String(effectiveMax));
    }
  };

  const handleWithdraw = async () => {
    if (!canSubmit || !selectedToken) return;

    const hash = await withdraw({
      destination,
      amount: numericAmount,
      mint: selectedToken.mint,
      decimals: selectedToken.decimals,
      isNative: selectedToken.isNative,
      isToken2022: selectedToken.isToken2022,
    });

    if (hash) {
      setAmount('');
      setDestination('');
      refresh();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-bgBackdrop backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-bgPrimary border border-borderDefault rounded-xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-borderDefault">
          <div className="flex items-center gap-2">
            <FiArrowUp size={16} className="text-textPrimary" />
            <h2 className="text-base font-semibold text-textPrimary">Withdraw</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-textTertiary hover:text-textPrimary hover:bg-bgTertiary transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Token Selector */}
          <div>
            <label className="text-[11px] text-textTertiary uppercase tracking-wide mb-1 block">
              Token
            </label>
            <div className="relative">
              <button
                onClick={() => setShowTokenSelect(!showTokenSelect)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-bgTertiary border border-borderDefault rounded-lg hover:bg-bgContainer transition-colors"
              >
                <div className="flex items-center gap-2">
                  {selectedToken?.isNative && (
                    <img src={SOL_LOGO} alt="SOL" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-sm text-textPrimary font-medium">
                    {selectedToken ? shortenMint(selectedToken.mint) : 'Select token'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-textSecondary">
                    {selectedToken ? formatBalance(selectedToken.balance) : ''}
                  </span>
                  <FiChevronDown
                    size={14}
                    className={`text-textTertiary transition-transform ${showTokenSelect ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {showTokenSelect && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bgPrimary border border-borderDefault rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {isLoadingAccounts ? (
                    <div className="px-3 py-4 text-center text-xs text-textTertiary">
                      Loading tokens...
                    </div>
                  ) : accounts.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-textTertiary">
                      No tokens found
                    </div>
                  ) : (
                    accounts.map((account) => (
                      <button
                        key={account.mint}
                        onClick={() => {
                          setSelectedToken(account);
                          setShowTokenSelect(false);
                          setAmount('');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 hover:bg-bgTertiary transition-colors ${
                          selectedToken?.mint === account.mint ? 'bg-bgTertiary' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {account.isNative && (
                            <img src={SOL_LOGO} alt="SOL" className="w-4 h-4 rounded-full" />
                          )}
                          <span className="text-xs text-textPrimary font-medium">
                            {shortenMint(account.mint)}
                          </span>
                          {account.isToken2022 && (
                            <span className="text-[9px] px-1 py-px bg-accentPurple/20 text-accentPurple rounded">
                              2022
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-textSecondary">
                          {formatBalance(account.balance)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-textTertiary uppercase tracking-wide">
                Amount
              </label>
              <button
                onClick={handleMax}
                className="text-[10px] text-success hover:text-success/80 font-medium transition-colors"
              >
                MAX
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
              }}
              placeholder="0.00"
              className={`w-full px-3 py-2.5 bg-bgTertiary border rounded-lg text-sm text-textPrimary placeholder:text-textTertiary/50 outline-none transition-colors ${
                amountError ? 'border-red-500/50' : 'border-borderDefault focus:border-success/50'
              }`}
            />
            {amountError && (
              <p className="text-[10px] text-red-400 mt-1">{amountError}</p>
            )}
          </div>

          {/* Destination Address */}
          <div>
            <label className="text-[11px] text-textTertiary uppercase tracking-wide mb-1 block">
              Destination wallet
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value.trim())}
              placeholder="Solana address..."
              className={`w-full px-3 py-2.5 bg-bgTertiary border rounded-lg text-sm text-textPrimary placeholder:text-textTertiary/50 outline-none font-mono transition-colors ${
                addressError ? 'border-red-500/50' : 'border-borderDefault focus:border-success/50'
              }`}
            />
            {addressError && (
              <p className="text-[10px] text-red-400 mt-1">{addressError}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleWithdraw}
            disabled={!canSubmit}
            className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-success hover:bg-success/90 text-white cursor-pointer'
                : 'bg-bgTertiary text-textTertiary cursor-not-allowed'
            }`}
          >
            {isWithdrawing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <FiArrowUp size={14} />
                Withdraw
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
