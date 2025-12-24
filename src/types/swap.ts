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

export type SolanaTransaction = Extract<
  SwapQuotingResponse['data'],
  { solana: { transaction: unknown } }
>['solana']['transaction'];

