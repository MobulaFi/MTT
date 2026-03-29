import { useCallback, useState } from 'react';
import {
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { toast } from 'sonner';
import { useSolanaSignerStore } from '@/store/useSolanaSignerStore';
import type { EmptyTokenAccount } from './useEmptyTokenAccounts';

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://twilight-restless-mountain.solana-mainnet.quiknode.pro/0f73d56b65264bbbb9ff2d17e64588d1c487ff93/';

/** Max close instructions per transaction to stay under size limit */
const MAX_CLOSE_PER_TX = 20;

export function useCloseAccounts() {
  const [isClosing, setIsClosing] = useState(false);
  const [closedCount, setClosedCount] = useState(0);
  const wallet = useSolanaSignerStore((s) => s.wallet);

  const closeAccounts = useCallback(
    async (accounts: EmptyTokenAccount[]): Promise<string[]> => {
      if (!wallet) {
        toast.error('Wallet not connected');
        return [];
      }
      if (accounts.length === 0) return [];

      setIsClosing(true);
      setClosedCount(0);
      const txHashes: string[] = [];

      try {
        const connection = new Connection(SOLANA_RPC, 'confirmed');
        const ownerPubkey = new PublicKey(wallet.address);

        // Batch into chunks
        const chunks: EmptyTokenAccount[][] = [];
        for (let i = 0; i < accounts.length; i += MAX_CLOSE_PER_TX) {
          chunks.push(accounts.slice(i, i + MAX_CLOSE_PER_TX));
        }

        for (const chunk of chunks) {
          const tx = new Transaction();

          for (const account of chunk) {
            const programId = account.isToken2022
              ? TOKEN_2022_PROGRAM_ID
              : TOKEN_PROGRAM_ID;

            tx.add(
              createCloseAccountInstruction(
                new PublicKey(account.pubkey),
                ownerPubkey, // destination for reclaimed rent
                ownerPubkey, // authority
                [],
                programId,
              ),
            );
          }

          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.feePayer = ownerPubkey;

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

          txHashes.push(hash);
          setClosedCount((prev) => prev + chunk.length);
        }

        const totalSol = (accounts.length * 2_039_280) / 1_000_000_000;
        toast.success(`Reclaimed ${totalSol.toFixed(4)} SOL`, {
          description: `Closed ${accounts.length} empty account${accounts.length > 1 ? 's' : ''}`,
          duration: 5000,
          action: txHashes.length === 1
            ? {
                label: 'Explorer',
                onClick: () =>
                  window.open(
                    `https://solscan.io/tx/${txHashes[0]}`,
                    '_blank',
                  ),
              }
            : undefined,
        });

        return txHashes;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Close failed';
        toast.error('Failed to close accounts', {
          description:
            message.length > 120 ? `${message.substring(0, 120)}...` : message,
        });
        return txHashes;
      } finally {
        setIsClosing(false);
      }
    },
    [wallet],
  );

  return { closeAccounts, isClosing, closedCount };
}
