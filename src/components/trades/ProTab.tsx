import { useState, useMemo } from 'react';
import { Wallet, Edit2, Check } from 'lucide-react';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useHeaderStore } from '@/store/useHeaderStore';
import { useSwapQuoteStore } from '@/store/useSwapQuoteStore';
import { useTradingDataStore } from '@/store/useTradingDataStore';
import { sdk } from '@/lib/sdkClient';
import { useWalletPosition } from '@/hooks/useWalletPosition';
import { useSwapTransaction } from '@/hooks/trading/useSwapTransaction';
import { toast } from 'sonner';
import { formatPureNumber } from '@mobula_labs/sdk';
import { Skeleton } from '@/components/ui/skeleton';
import { MOBULA_TO_EVM_CHAIN_ID, extractChainFromPath } from '@/hooks/useAutoSwitchNetwork';
import { usePathname } from 'next/navigation';
import type { SwapQuoteResponse } from '@/types/swap';
import type { SwapQuotingResponse } from '@mobula_labs/types';

export const ProTab = () => {
  const {
    tradingMode,
    buyAmount,
    customBuyAmounts,
    customSellPercentages,
    slippage,
    prequote,
    buyBalance,
    sellBalance,
    setTradingMode,
    setBuyAmount,
    setCustomBuyAmounts,
    setCustomSellPercentages,
  } = useTradingPanelStore();

  const { address, isConnected, chainId, evmAddress, solanaAddress, switchChain } = useWalletConnection();
  const openWalletModal = useHeaderStore((state) => state.openWalletModal);
  const { setQuote, setLoading, setError, openModal } = useSwapQuoteStore();
  const { baseToken } = useTradingDataStore();
  const pathname = usePathname();
  
  
  const urlChain = useMemo(() => {
    return pathname ? extractChainFromPath(pathname) : null;
  }, [pathname]);

  const isPageOnEvm = urlChain?.startsWith('evm:') || false;
  const isPageOnSolana = urlChain?.startsWith('solana:') || false;

  // Get the appropriate wallet address based on chain type (custom wallet)
  const swapWalletAddress = useMemo(() => {
    if (isPageOnSolana) return solanaAddress || null;
    if (isPageOnEvm) return evmAddress || null;
    return address;
  }, [address, isPageOnSolana, isPageOnEvm, solanaAddress, evmAddress]);
  

  const requiredChainId = useMemo(() => {
    if (!urlChain) return null;
    return MOBULA_TO_EVM_CHAIN_ID[urlChain] || null;
  }, [urlChain]);

  const isWrongNetwork = useMemo(() => {
    if (!requiredChainId || !chainId) return false;
    return chainId !== requiredChainId;
  }, [requiredChainId, chainId]);

  // Check if the connected wallet type matches the page blockchain type
  const isWrongWalletType = useMemo(() => {
    if (!isConnected) return false;
    // If page is on Solana but EVM wallet is connected (or vice versa)
    if (isPageOnSolana && !solanaAddress && evmAddress) return true;
    if (isPageOnEvm && !evmAddress && solanaAddress) return true;
    return false;
  }, [isConnected, isPageOnSolana, isPageOnEvm, solanaAddress, evmAddress]);

  
  const { signAndSendTransaction } = useSwapTransaction();
  
  useWalletPosition();

  const walletBalance = tradingMode === 'buy' ? buyBalance : sellBalance;
  const isLoadingBalance = false;
  
  const [isEditingSize, setIsEditingSize] = useState(false);
  const [tempSizeValue, setTempSizeValue] = useState(buyAmount.replace('$', ''));
  const [isEditingAmounts, setIsEditingAmounts] = useState(false);
  const [tempAmountValues, setTempAmountValues] = useState<{ [key: number]: string }>({});

  const handleEditSize = () => {
    setIsEditingSize(true);
    setTempSizeValue(buyAmount.replace('$', ''));
  };

  const calculateSellAmount = (value: string): string => {
    if (tradingMode === 'sell' && value.includes('%')) {
      const percentage = parseFloat(value.replace('%', ''));
      if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
        const balance = parseFloat(walletBalance || '0');
        const calculatedAmount = (balance * percentage) / 100;
        return calculatedAmount.toString();
      }
    }
    return value;
  };

  const handleConfirmSize = () => {
    const calculatedValue = calculateSellAmount(tempSizeValue);
    
    // Validate balance for buy mode
    if (tradingMode === 'buy') {
      const amount = parseFloat(calculatedValue.replace('$', '').replace('%', ''));
      const balance = parseFloat(walletBalance || '0');
      if (!isNaN(amount) && amount > balance) {
        const nativeToken = isPageOnSolana ? 'SOL' : 'ETH';
        toast.error(`Insufficient balance. You have ${formatPureNumber(balance.toString())} ${nativeToken}`);
        setTempSizeValue(buyAmount.replace('$', ''));
        setIsEditingSize(false);
        return;
      }
    }
    
    setBuyAmount(calculatedValue);
    setIsEditingSize(false);
  };

  const handleStartEditAmounts = () => {
    setIsEditingAmounts(true);
    const initialValues: { [key: number]: string } = {};
    const values = tradingMode === 'sell' ? customSellPercentages : customBuyAmounts;
    values.forEach((value, index) => {
      initialValues[index] = value.toString();
    });
    setTempAmountValues(initialValues);
  };

  const handleConfirmAllAmounts = () => {
    const values = tradingMode === 'sell' ? customSellPercentages : customBuyAmounts;
    const newValues = values.map((_, index) => {
      const valueStr = tempAmountValues[index];
      if (valueStr === '' || valueStr === undefined) {
        return values[index];
      }
      const newValue = parseFloat(valueStr);
      return !isNaN(newValue) && newValue >= 0 ? newValue : values[index];
    });
    if (tradingMode === 'sell') {
      setCustomSellPercentages(newValues);
    } else {
      setCustomBuyAmounts(newValues);
    }
    setIsEditingAmounts(false);
    setTempAmountValues({});
  };

  const handleCancelAmountEdit = () => {
    setIsEditingAmounts(false);
    setTempAmountValues({});
  };

  const handleSwitchNetwork = async () => {
    if (!requiredChainId) return;
    try {
      await switchChain(requiredChainId);
    } catch (error) {
      console.error('Failed to switch network:', error);
      toast.error('Failed to switch network');
    }
  };

  const handleBuyOrSell = async () => {
    if (!isConnected || !address) {
      openWalletModal();
      return;
    }

    // Check if wallet type matches page blockchain type
    if (isWrongWalletType) {
      const requiredWallet = isPageOnSolana ? 'Solana' : 'EVM';
      const currentWallet = solanaAddress ? 'Solana' : 'EVM';
      toast.error(`Wrong wallet type. This is a ${isPageOnSolana ? 'Solana' : 'EVM'} token. Please connect a ${requiredWallet} wallet instead of ${currentWallet}.`);
      openWalletModal();
      return;
    }

    // Check if we have a valid swap address
    if (!swapWalletAddress) {
      toast.error('Wallet address not available. Please reconnect.');
      return;
    }

    if (isWrongNetwork && requiredChainId) {
      await handleSwitchNetwork();
      return;
    }

    if (!baseToken) {
      setError('Token data not available. Please refresh the page.');
      return;
    }


    const amountValue = buyAmount.replace('$', '').replace('%', '');
    if (!amountValue || parseFloat(amountValue) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(amountValue);
    const balance = parseFloat(walletBalance || '0');
    if (amount > balance) {
      const balanceUnit = tradingMode === 'buy' ? (isPageOnSolana ? 'SOL' : 'ETH') : (baseToken?.symbol || '');
      const balanceDisplay = formatPureNumber(balance.toString());
      toast.error(`Insufficient balance. You have ${balanceDisplay} ${balanceUnit}`);
      setError(`Insufficient balance. You have ${balanceDisplay}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tokenChainId = baseToken.blockchain;

      const nativeTokenAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
      
      const tokenIn = tradingMode === 'buy' ? nativeTokenAddress : baseToken.address;
      const tokenOut = tradingMode === 'buy' ? baseToken.address : nativeTokenAddress;
      
      // Always use swap/quoting endpoint (not swap/quoting-instructions)
      const quoteResponse = await sdk.fetchSwapQuote({
        chainId: tokenChainId,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amount: amountValue as unknown as number,
        walletAddress: swapWalletAddress,
        slippage: slippage as unknown as number,
      }) as SwapQuoteResponse;

      if (!quoteResponse.data) {
        throw new Error('No quote data received');
      }

      if (prequote) {
        setQuote(quoteResponse as SwapQuotingResponse);
        openModal();
      } else if (quoteResponse.data) {
        // Sign the Mobula transaction and send via swap/send endpoint
        await signAndSendTransaction(
          quoteResponse as SwapQuoteResponse & { data: NonNullable<SwapQuoteResponse['data']> }, 
          tokenChainId
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch swap quote';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="">
      {/* Buy/Sell Toggle */}
      <div className="px-3 py-2">
        <div className='flex gap-2 bg-bgPrimary rounded-md border border-borderDefault p-1'>
          <button
            onClick={() => setTradingMode('buy')}
            className={`flex-1 font-medium text-xs py-2 rounded transition ${tradingMode === 'buy'
              ? 'border border-success text-white'
              : 'text-grayGhost hover:bg-bgContainer hover:text-textPrimary'
              }`}
          >
            Buy
          </button>
          <button
            onClick={() => setTradingMode('sell')}
            className={`flex-1 font-medium py-2 text-xs rounded transition ${tradingMode === 'sell'
              ? 'border border-white text-white'
              : 'text-grayGhost hover:bg-bgContainer hover:text-textPrimary'
              }`}
          >
            Sell
          </button>
        </div>
      </div>

      {/* Size Input */}
      <div className='px-3 py-4'>
        <div className="bg-bgPrimary border border-borderDefault overflow-hidden">
          {/* Size Row - Five Column Grid */}
          <div className="grid grid-cols-5 items-center border-b border-borderDefault">
            <div className="border-r border-borderDefault px-3 py-2 flex items-center justify-between">
              <span className="text-grayGhost text-xs whitespace-nowrap">Size</span>
            </div>
            <div className="border-r border-borderDefault px-3 py-2 col-span-4 flex items-center gap-2 justify-between">
                {isLoadingBalance && !isEditingSize ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <input
                    type="text"
                    value={isEditingSize ? tempSizeValue : buyAmount.replace('$', '')}
                    onChange={(e) => {
                      if (isEditingSize) {
                        setTempSizeValue(e.target.value);
                      } else {
                        setBuyAmount(e.target.value);
                      }
                    }}
                    onFocus={() => {
                      if (!isEditingSize) {
                        setIsEditingSize(true);
                        setTempSizeValue(buyAmount.replace('$', ''));
                      }
                    }}
                    onBlur={() => {
                      if (isEditingSize) {
                        handleConfirmSize();
                      }
                    }}
                    className="flex-1 bg-transparent text-xs text-white placeholder-textTertiary 
                       focus:outline-none border-none"
                    placeholder={tradingMode === 'sell' ? '0.0 or 25%' : '0.0'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (isEditingSize) {
                          handleConfirmSize();
                        }
                      }
                      if (e.key === 'Escape') {
                        setTempSizeValue(buyAmount.replace('$', ''));
                        setIsEditingSize(false);
                      }
                    }}
                  />
              )}
            </div>
          </div>
          {/* Amount Buttons Row */}
          <div className="grid grid-cols-5">
            {(tradingMode === 'sell' ? customSellPercentages : customBuyAmounts).map((value, index) => {
              const displayValue = tradingMode === 'sell' ? `${value}%` : value;
              let isSelected = false;
              let calculatedAmount = 0;
              
              if (tradingMode === 'sell') {
                const balance = parseFloat(walletBalance || '0');
                calculatedAmount = (balance * value) / 100;
                const currentAmount = parseFloat(buyAmount.replace('$', '').replace('%', ''));
                isSelected = !isNaN(currentAmount) && !isNaN(calculatedAmount) && Math.abs(currentAmount - calculatedAmount) < 0.01;
              } else {
                const currentValue = buyAmount.replace('$', '');
                isSelected = currentValue === `${value}`;
              }
              
              return (
                <div key={index} className="border-r border-borderDefault last:border-r-0">
                  {isEditingAmounts ? (
                    <input
                      type="number"
                      step="any"
                      value={tempAmountValues[index] ?? ''}
                      onChange={(e) => setTempAmountValues({ ...tempAmountValues, [index]: e.target.value })}
                      className="w-full bg-transparent px-2 py-2 text-xs text-white text-center focus:outline-none border-none"
                      placeholder={value.toString()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmAllAmounts();
                        if (e.key === 'Escape') handleCancelAmountEdit();
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => {
                        if (tradingMode === 'sell') {
                          const balance = parseFloat(walletBalance || '0');
                          const calculatedValue = (balance * value) / 100;
                          setBuyAmount(calculatedValue.toString());
                          setTempSizeValue(calculatedValue.toString());
                        } else {
                          // Check if balance is sufficient for buy
                          const balance = parseFloat(walletBalance || '0');
                          if (balance < value) {
                            const nativeToken = isPageOnSolana ? 'SOL' : 'ETH';
                            toast.error(`Insufficient balance. You have ${formatPureNumber(balance.toString())} ${nativeToken}`);
                            return;
                          }
                          setBuyAmount(`${value}`);
                          setTempSizeValue(`${value}`);
                        }
                        setIsEditingSize(false);
                      }}
                      className={`w-full px-2 py-2 text-xs font-medium transition ${
                        tradingMode === 'buy' && parseFloat(walletBalance || '0') < value
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      } ${isSelected
                        ? 'bg-bgPrimary text-textPrimary hover:bg-bgContainer hover:text-textPrimary'
                        : 'bg-bgOverlay text-grayGhost hover:bg-bgContainer hover:text-textPrimary'
                        }`}
                      disabled={tradingMode === 'buy' && parseFloat(walletBalance || '0') < value}
                    >
                      {displayValue}
                    </button>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => {
                if (isEditingAmounts) {
                  handleConfirmAllAmounts();
                } else {
                  handleStartEditAmounts();
                }
              }}
              className={`px-2 py-2 text-xs font-medium transition ${isEditingAmounts
                ? 'bg-bgPrimary text-textPrimary hover:bg-bgContainer'
                : 'bg-bgOverlay text-grayGhost hover:bg-bgContainer hover:text-textPrimary'
                }`}
            >
              {isEditingAmounts ? (
                <Check size={14} className="mx-auto" />
              ) : (
                <Edit2 size={14} className="mx-auto" />
              )}
            </button>
          </div>
        </div>
        {isConnected && !isWrongNetwork && !isWrongWalletType && (
          <div className="flex items-start gap-2 px-1 mt-3">
            <Wallet size={14} color='#9094A6' />
            {isLoadingBalance ? (
              <Skeleton className="h-3 w-20" />
            ) : (
              <span className="text-grayGhost text-xs">
                {formatPureNumber(walletBalance)} {tradingMode === 'buy' ? (isPageOnSolana ? 'SOL' : 'ETH') : (baseToken?.symbol || '')}
              </span>
            )}
            {!isLoadingBalance && walletBalance && parseFloat(walletBalance) > 0 && (
              <span onClick={() => setBuyAmount(`${walletBalance}`)} className="text-white text-xs cursor-pointer">Max</span>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        {!isConnected ? (
          <button
            onClick={() => openWalletModal()}
            className="w-full px-3 py-2 hover:bg-bgContainer hover:text-textPrimary bg-bgPrimary border border-success text-textPrimary font-normal text-xs rounded transition flex flex-col items-center gap-1"
          >
            {isPageOnSolana ? 'Select Solana wallet' : isPageOnEvm ? 'Select EVM wallet' : 'Connect Wallet'}
          </button>
        ) : isWrongWalletType ? (
          <div className="flex flex-col gap-2">
            <div className="text-xs text-center text-warning px-2 py-2 bg-warning/10 rounded border border-warning/20">
              Wrong wallet type. This is a {isPageOnSolana ? 'Solana' : 'EVM'} token. Please connect a {isPageOnSolana ? 'Solana' : 'EVM'} wallet.
            </div>
            <button
              onClick={() => openWalletModal()}
              className="w-full px-3 py-2 hover:bg-bgContainer hover:text-textPrimary bg-bgPrimary border border-warning text-textPrimary font-normal text-xs rounded transition"
            >
              Connect {isPageOnSolana ? 'Solana' : 'EVM'} Wallet
            </button>
          </div>
        ) : isWrongNetwork && requiredChainId ? (
          <div className="flex flex-col gap-2">
            <div className="text-xs text-center text-warning px-2 py-2 bg-warning/10 rounded border border-warning/20">
              Wrong network. Please switch to continue.
            </div>
            <button
              onClick={handleSwitchNetwork}
              className="w-full px-3 py-2 hover:bg-bgContainer hover:text-textPrimary bg-bgPrimary border border-warning text-textPrimary font-normal text-xs rounded transition"
            >
              Switch Network
            </button>
          </div>
        ) : (
          <button
            onClick={handleBuyOrSell}
            className={`w-full px-3 py-2 hover:bg-bgContainer hover:text-textPrimary bg-bgPrimary border text-textPrimary font-normal text-xs rounded transition flex flex-col items-center gap-1 ${tradingMode === 'buy' ? 'border-success text-textPrimary' : 'border-white'}`}
          >
            {tradingMode === 'buy' ? 'Buy' : 'Sell'}
          </button>
        )}
      </div>
    </div>
  );
};