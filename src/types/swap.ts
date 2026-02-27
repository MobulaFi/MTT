import type { SwapQuotingResponse } from '@mobula_labs/types';

// Re-export SwapQuotingResponse from @mobula_labs/types as SwapQuoteResponse
// This keeps the codebase consistent while using the official type
export type { SwapQuotingResponse as SwapQuoteResponse } from '@mobula_labs/types';

// Extract transaction types directly from SwapQuotingResponse
// This ensures we use the exact same types as defined in @mobula_labs/types
export type EvmTransaction = Extract<
  SwapQuotingResponse['data'],
  { evm: { transaction: unknown } }
>['evm']['transaction'];

// Extract Solana transaction type directly from SwapQuotingResponse
export type SolanaTransaction = Extract<
  SwapQuotingResponse['data'],
  { solana: { transaction: unknown } }
>['solana']['transaction'];

export interface SwapInstructionAccount {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface SwapInstruction {
  programId: string;
  accounts: SwapInstructionAccount[];
  data: string;
}

export interface SwapInstructionsData {
  computeBudgetInstructions?: SwapInstruction[];
  setupInstructions?: SwapInstruction[];
  swapInstructions: SwapInstruction[];
  cleanupInstructions?: SwapInstruction[];
  addressLookupTableAddresses?: string[];
}

export interface SwapInstructionsResponse {
  data?: {
    amountOutTokens?: string;
    slippagePercentage?: number;
    tokenIn?: {
      address: string;
      name?: string;
      symbol?: string;
      decimals: number;
      logo?: string | null;
    };
    tokenOut?: {
      address: string;
      name?: string;
      symbol?: string;
      decimals: number;
      logo?: string | null;
    };
    requestId: string;
    solana: {
      instructions: SwapInstructionsData;
      lastValidBlockHeight: number;
      recentBlockhash: string;
    };
  };
  error?: string;
}

export interface SwapInstructionsParams {
  chainId: string;
  tokenIn: string;
  tokenOut: string;
  amount?: string;
  amountRaw?: string;
  walletAddress: string;
  slippage?: number;
  excludedProtocols?: string;
  onlyProtocols?: string;
  poolAddress?: string;
  priorityFee?: 'auto' | 'low' | 'medium' | 'high' | 'veryHigh' | number;
  computeUnitLimit?: boolean | number;
  jitoTipLamports?: number;
  feePercentage?: number;
  feeWallet?: string;
}

