import { useCallback } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/lib/sdkClient';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';
import { VersionedTransaction, Transaction } from '@solana/web3.js';
import type { SwapQuoteResponse, SolanaTransaction } from '@/types/swap';

interface UseSwapTransactionParams {
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

function getPhantomSolana() {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { phantom?: { solana?: { signTransaction: (tx: VersionedTransaction | Transaction) => Promise<VersionedTransaction | Transaction> } } };
  return w.phantom?.solana ?? null;
}

export function useSwapTransaction({ onSuccess, onError }: UseSwapTransactionParams = {}) {
  const evmAddress = useWalletConnectionStore((state) => state.evmAddress);
  const solanaAddress = useWalletConnectionStore((state) => state.solanaAddress);
  const { solanaSwapSettings } = useTradingPanelStore();

  const getSolanaWallet = useCallback(() => getPhantomSolana(), []);

  const getSolanaAddress = useCallback(() => solanaAddress ?? null, [solanaAddress]);

  const getEvmAddress = useCallback(() => evmAddress ?? null, [evmAddress]);

  // Sign Solana transaction and send via Mobula API
  // Following the working model: get quote -> sign from EOA -> swap/send
  const signAndSendSolanaTransaction = useCallback(async (
    solanaTx: SolanaTransaction
  ): Promise<string> => {
    const solanaWallet = getSolanaWallet();
    
    if (!solanaWallet) {
      throw new Error('Solana wallet is not available. Please connect your wallet.');
    }

    console.log('[Swap] Signing Solana transaction...', {
      variant: solanaTx.variant,
    });

    // Get serialized transaction and type from quote response
    // Following the working model: quote.data.solana.transaction.serialized and quote.data.solana.transaction.variant
    const getSerializedTx = solanaTx.serialized;
    const getSerializedTxType = solanaTx.variant;

    if (!getSerializedTx) {
      throw new Error('No serialized transaction found in quote response');
    }

    console.log('[Swap] Transaction serialized:', getSerializedTx.substring(0, 50) + '...');
    console.log('[Swap] Transaction variant:', getSerializedTxType);

    // Deserialize the transaction from base64 (same as working model)
    const txBytes = Uint8Array.from(Buffer.from(getSerializedTx, 'base64'));
    
    // Determine if versioned transaction (most Solana transactions are versioned)
    const isVersioned = getSerializedTxType === 'versioned';
    
    let signedTxBase64: string;
    
    if (isVersioned) {
      console.log('[Swap] Deserializing as VersionedTransaction');
      const tx = VersionedTransaction.deserialize(txBytes);
      
      // Sign with Phantom wallet (EOA) - same as working model: tx.sign([wallet])
      // Phantom's signTransaction handles the signing
      const signedTx = await solanaWallet.signTransaction(tx);
      
      // Verify transaction is signed (same check as working model)
      if (!signedTx.signatures || signedTx.signatures.length === 0) {
        throw new Error('Transaction not signed');
      }
      
      // Serialize the signed transaction (same as working model: Buffer.from(signedTxBytes).toString('base64'))
      const signedTxBytes = signedTx.serialize();
      signedTxBase64 = Buffer.from(signedTxBytes).toString('base64');
    } else {
      console.log('[Swap] Deserializing as Legacy Transaction');
      const tx = Transaction.from(txBytes);
      
      // Sign with Phantom wallet (EOA)
      const signedTx = await solanaWallet.signTransaction(tx);
      
      // Serialize the signed transaction
      const signedTxBytes = signedTx.serialize({ requireAllSignatures: false });
      signedTxBase64 = Buffer.from(signedTxBytes).toString('base64');
    }

    console.log('[Swap] Sending signed transaction to Mobula swap/send...');

    // Send the signed transaction via sdk.swapSend (proxied in server mode)
    const sendResult = await sdk.swapSend({
      chainId: 'solana:solana',
      signedTransaction: signedTxBase64,
    }) as { data?: { hash?: string; transactionHash?: string }; hash?: string; error?: string; message?: string };
    
    console.log('[Swap] Send result:', sendResult);

    // Check for transaction hash in response (same as working model)
    if (sendResult.data?.hash || sendResult.data?.transactionHash || sendResult.hash) {
      const txHash = sendResult.data?.hash || sendResult.data?.transactionHash || sendResult.hash;
      return txHash as string;
    } else {
      const errorMsg = sendResult.error || sendResult.message || 'Transaction failed';
      throw new Error(errorMsg);
    }
  }, [getSolanaWallet]);

  // Main function to sign and send swap transaction using Mobula quote
  const signAndSendTransaction = useCallback(async (
    quoteResponse: SwapQuoteResponse,
    chainId: string
  ): Promise<void> => {
    if (!quoteResponse.data) {
      throw new Error('Invalid quote response');
    }

    const isSolana = chainId.toLowerCase().includes('solana');

    try {
      // Handle Solana transaction
      if (isSolana && quoteResponse.data.solana?.transaction) {
        toast.info('Signing Solana transaction...', { duration: 3000 });
        
        const txHash = await signAndSendSolanaTransaction(quoteResponse.data.solana.transaction);
        
        const shortHash = txHash.length > 20 
          ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
          : txHash;
        
        toast.success('Swap Successful!', {
          description: `Signature: ${shortHash}`,
          duration: 10000,
          action: {
            label: 'View',
            onClick: () => {
              window.open(`https://solscan.io/tx/${txHash}`, '_blank');
            },
          },
        });
        
        if (onSuccess) {
          onSuccess(txHash);
        }
      } 
      // Handle EVM transaction
      else if (quoteResponse.data.evm?.transaction) {
        // EVM transactions can be signed by the connected EVM wallet
        // TODO: Implement EVM transaction signing
        throw new Error('EVM transaction execution not yet implemented.');
      } 
      else {
        throw new Error('No transaction data found in quote response');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute swap';
      console.error('[Swap] Error:', errorMessage);

      toast.error('Swap Error', {
        description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage,
        duration: 5000,
      });

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
      throw error;
    }
  }, [signAndSendSolanaTransaction, onSuccess, onError]);

  return {
    signAndSendTransaction,
    signAndSendSolanaTransaction,
    getSolanaAddress,
    getEvmAddress,
    solanaSwapSettings,
  };
}
