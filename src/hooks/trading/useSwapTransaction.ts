import { useCallback } from 'react';
import { createWalletClient, custom, type Chain } from 'viem';
import { toast } from 'sonner';
import { getMobulaClient } from '@/lib/mobulaClient';
import { ChainSwitcher } from '@/lib/wallet/utils';
import { useWalletConnectionStore } from '@/store/useWalletConnectionStore';
import type { SwapQuoteResponse, EvmTransaction, SolanaTransaction } from '@/types/swap';

interface UseSwapTransactionParams {
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

export function useSwapTransaction({ onSuccess, onError }: UseSwapTransactionParams = {}) {
  const { activeWalletType, evmAddress } = useWalletConnectionStore();

  const signAndSendTransaction = useCallback(async (
    quoteResponse: SwapQuoteResponse,
    chainId: string
  ): Promise<void> => {
    if (!quoteResponse.data) {
      throw new Error('Invalid quote response');
    }

    // Prioritize transaction type over active wallet type
    // If we have an EVM transaction, use EVM wallet (MetaMask)
    if (quoteResponse.data.evm?.transaction) {
      if (!evmAddress) {
        throw new Error('MetaMask wallet is not connected. Please connect MetaMask to proceed.');
      }
      return await signAndSendEvmTransaction(
        quoteResponse.data.evm.transaction,
        chainId,
        evmAddress
      );
    } 
    // If we have a Solana transaction, use Solana wallet (Phantom)
    else if (quoteResponse.data.solana?.transaction) {
      if (activeWalletType !== 'solana') {
        throw new Error('Phantom wallet is not connected. Please connect Phantom to proceed.');
      }
      console.log('quoteResponse.data.solana.transaction', quoteResponse.data.solana.transaction);
      console.log('chainId', chainId);
      console.log('quoteResponse.data.requestId', quoteResponse.data.requestId);
      return await signAndSendSolanaTransaction(
        quoteResponse.data.solana.transaction,
        chainId,
        quoteResponse.data.requestId
      );
    } else {
      throw new Error('Unsupported transaction type or wallet');
    }
  }, [activeWalletType, evmAddress]);

  const signAndSendEvmTransaction = async (
    evmTx: EvmTransaction,
    chainId: string,
    address: string | null
  ): Promise<void> => {
    if (!address) {
      throw new Error('MetaMask is not connected');
    }
  
    // Get MetaMask provider specifically (not Phantom)
    const getMetaMaskProvider = () => {
      if (typeof window.ethereum === 'undefined') {
        return null;
      }
      
      // If there are multiple providers, find MetaMask
      if ((window.ethereum as any).providers) {
        return (window.ethereum as any).providers.find((p: any) => p.isMetaMask);
      }
      
      // If only one provider and it's MetaMask
      if (window.ethereum.isMetaMask) {
        return window.ethereum;
      }
      
      return null;
    };
  
    const metaMaskProvider = getMetaMaskProvider();
    
    if (!metaMaskProvider) {
      throw new Error('MetaMask is not available');
    }
  
    let targetChain: Chain;
    try {
      targetChain = await ChainSwitcher.ensureCorrectChain(chainId);
    } catch (chainError) {
      const errorMessage = chainError instanceof Error ? chainError.message : 'Failed to switch chain';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  
    try {
      // Connect MetaMask and get authorized account using MetaMask provider specifically
      const accounts = await metaMaskProvider.request({
        method: 'eth_requestAccounts',
      }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts authorized. Please connect your wallet.');
      }
      
      // Use the first authorized account (currently selected in MetaMask)
      const authorizedAccount = accounts[0];
  
      // Serialize transaction data as message
      const txDataString = JSON.stringify({
        to: evmTx.to,
        data: evmTx.data,
        value: evmTx.value || '0',
        gas: evmTx.gasLimit,
        gasPrice: evmTx.gasPrice,
        maxFeePerGas: evmTx.maxFeePerGas,
        maxPriorityFeePerGas: evmTx.maxPriorityFeePerGas,
        nonce: evmTx.nonce,
        chainId: chainId,
      });
  
      // Convert message to hex
      const messageHex = '0x' + Buffer.from(txDataString, 'utf8').toString('hex');
  
      // Sign the message with MetaMask provider specifically
      const signature = await metaMaskProvider.request({
        method: 'personal_sign',
        params: [messageHex, authorizedAccount],
      }) as string;
  
      // Convert signature to base64
      const signatureBase64 = Buffer.from(signature.slice(2), 'hex').toString('base64');
  
      // Send to Mobula API
      const client = getMobulaClient();
      const sendResult = await client.fetchSwapTransaction({
        chainId: chainId as unknown as never,
        signedTransaction: signatureBase64 as unknown as never,
      });
  
      if (sendResult.data?.success && sendResult.data?.transactionHash) {
        const txHash = sendResult.data.transactionHash;
        const shortHash = txHash.length > 20 
          ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
          : txHash;
        
        const toastId = toast.success('Swap Successful!', {
          description: `Txn Hash: ${shortHash}`,
          duration: 10000,
          action: {
            label: '📋 Copy',
            onClick: () => {
              navigator.clipboard.writeText(txHash);
              toast.success('Hash copied!', { duration: 2000 });
            },
          },
        });
        
        if (onSuccess) {
          onSuccess(txHash);
        }
      } else {
        const errorMsg = sendResult.error || 'Transaction failed';
        
        toast.error('Swap Failed', {
          description: errorMsg,
          duration: 5000,
        });
        
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute swap';
      
      toast.error('Swap Error', {
        description: errorMessage,
        duration: 5000,
      });
      
      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
      throw error;
    }
  };
  const signAndSendSolanaTransaction = async (
    solanaTx: SolanaTransaction,
    chainId: string,
    requestId?: string
  ): Promise<void> => {
    if (!window.phantom?.solana) {
      throw new Error('Phantom wallet is not available');
    }

    try {
      const { VersionedTransaction, Transaction } = await import('@solana/web3.js');
      const txBuffer = Uint8Array.from(Buffer.from(solanaTx.serialized, 'base64'));
      
      interface PhantomSolanaProvider {
        signTransaction: (tx: typeof VersionedTransaction.prototype | typeof Transaction.prototype) => Promise<typeof VersionedTransaction.prototype | typeof Transaction.prototype>;
      }

      const phantomProvider = window.phantom.solana as unknown as PhantomSolanaProvider;
      
      // Deserialize and sign the transaction
      let signedTx: typeof VersionedTransaction.prototype | typeof Transaction.prototype;
      if (solanaTx.variant === 'versioned') {
        const tx = VersionedTransaction.deserialize(txBuffer);
        signedTx = await phantomProvider.signTransaction(tx);
      } else {
        const tx = Transaction.from(txBuffer);
        signedTx = await phantomProvider.signTransaction(tx);
      }
      
      // Serialize the signed transaction
      let signedTransaction: string;
      if (signedTx instanceof VersionedTransaction) {
        signedTransaction = Buffer.from(signedTx.serialize() as unknown as WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>).toString('base64');
      } else {
        signedTransaction = Buffer.from(signedTx.serialize({ requireAllSignatures: false }) as unknown as WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>).toString('base64');
      }

      console.log('signedTransaction', signedTransaction);

      const client = getMobulaClient();
      const sendResult = await client.fetchSwapTransaction({
        chainId: chainId as unknown as never,
        signedTransaction: signedTransaction as unknown as never,
      });

      if (sendResult.data?.success && sendResult.data?.transactionHash) {
        const txHash = sendResult.data.transactionHash;
        const shortHash = txHash.length > 20 
          ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
          : txHash;
        
        const toastId = toast.success('Swap Successful!', {
          description: `Txn Hash: ${shortHash}`,
          duration: 10000,
          action: {
            label: '📋 Copy',
            onClick: () => {
              navigator.clipboard.writeText(txHash);
              toast.success('Hash copied!', { duration: 2000 });
            },
          },
        });
        
        if (onSuccess) {
          onSuccess(txHash);
        }
      } else {
        const errorMsg = sendResult.error || 'Transaction failed';
        
        toast.error('Swap Failed', {
          description: errorMsg,
          duration: 5000,
        });
        
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute swap';
      
      toast.error('Swap Error', {
        description: errorMessage,
        duration: 5000,
      });
      
      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      }
      throw error;
    }
  };

  return {
    signAndSendTransaction,
  };
}
