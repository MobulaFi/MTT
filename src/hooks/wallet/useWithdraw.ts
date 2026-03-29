import { useCallback, useState } from 'react';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { toast } from 'sonner';
import { useSolanaSignerStore } from '@/store/useSolanaSignerStore';
import { useTradingPanelStore } from '@/store/useTradingPanelStore';

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://twilight-restless-mountain.solana-mainnet.quiknode.pro/0f73d56b65264bbbb9ff2d17e64588d1c487ff93/';

export function useWithdraw() {
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const wallet = useSolanaSignerStore((s) => s.wallet);
  const triggerBalanceRefresh = useTradingPanelStore((s) => s.triggerBalanceRefresh);

  const withdraw = useCallback(
    async (params: {
      destination: string;
      amount: number;
      mint: string;
      decimals: number;
      isNative: boolean;
      isToken2022: boolean;
    }) => {
      if (!wallet) {
        toast.error('Wallet not ready', { description: 'Please wait for wallet to load.' });
        return null;
      }

      const { destination, amount, mint, decimals, isNative, isToken2022 } = params;

      let destPubkey: PublicKey;
      try {
        destPubkey = new PublicKey(destination);
      } catch {
        toast.error('Invalid address', { description: 'Please enter a valid Solana address.' });
        return null;
      }

      setIsLoading(true);
      setTxHash(null);

      try {
        const connection = new Connection(SOLANA_RPC, 'confirmed');
        const fromPubkey = new PublicKey(wallet.address);
        const tx = new Transaction();

        if (isNative) {
          const lamports = Math.round(amount * LAMPORTS_PER_SOL);
          tx.add(
            SystemProgram.transfer({
              fromPubkey,
              toPubkey: destPubkey,
              lamports,
            }),
          );
        } else {
          const mintPubkey = new PublicKey(mint);
          const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

          const fromAta = await getAssociatedTokenAddress(
            mintPubkey,
            fromPubkey,
            false,
            programId,
          );
          const toAta = await getAssociatedTokenAddress(
            mintPubkey,
            destPubkey,
            true,
            programId,
          );

          // Create destination ATA if it doesn't exist
          const toAtaInfo = await connection.getAccountInfo(toAta);
          if (!toAtaInfo) {
            tx.add(
              createAssociatedTokenAccountInstruction(
                fromPubkey,
                toAta,
                destPubkey,
                mintPubkey,
                programId,
              ),
            );
          }

          const rawAmount = BigInt(Math.round(amount * 10 ** decimals));
          tx.add(
            createTransferInstruction(fromAta, toAta, fromPubkey, rawAmount, [], programId),
          );
        }

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;

        const serialized = tx.serialize({ requireAllSignatures: false });
        const { signedTransaction } = await wallet.signTransaction({
          transaction: serialized,
          chain: 'solana:mainnet',
        });

        const hash = await connection.sendRawTransaction(signedTransaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        await connection.confirmTransaction(
          { signature: hash, blockhash, lastValidBlockHeight },
          'confirmed',
        );

        setTxHash(hash);
        const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;
        toast('Withdrawn', {
          description: shortHash,
          duration: 3000,
          action: {
            label: 'Explorer',
            onClick: () => window.open(`https://solscan.io/tx/${hash}`, '_blank'),
          },
          style: { borderLeft: '3px solid #6366f1' },
        });

        setTimeout(triggerBalanceRefresh, 2000);
        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Withdraw failed';
        console.error('[Withdraw] Error:', message);
        toast.error('Withdraw failed', {
          description: message.length > 120 ? `${message.substring(0, 120)}...` : message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, triggerBalanceRefresh],
  );

  return { withdraw, isLoading, txHash };
}
