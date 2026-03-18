import { createPublicClient, formatUnits, http, parseUnits, type Address } from 'viem';
import {
  ACTIVE_CHAIN,
  RPC_URL,
  SUPERFLUID_TOKEN,
  SUPERFLUID_TOKEN_SYMBOL,
} from './superfluid-streaming';

export const STREAMING_BALANCE_ESTIMATE_MINUTES = 5;

const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(RPC_URL),
});
const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

export interface StreamingPreflightResult {
  ok: boolean;
  code?: 'missing_payout_address' | 'wrong_chain' | 'missing_token_contract' | 'insufficient_balance' | 'rpc_error';
  message: string;
  requiredChainId: number;
  requiredChainName: string;
  tokenAddress: Address;
  tokenSymbol: string;
  availableBalance?: number;
  requiredBalance?: number;
}

export async function runStreamingPreflight({
  walletAddress,
  currentChainId,
  agentAddress,
  ratePerMinute,
}: {
  walletAddress: Address;
  currentChainId: number | null;
  agentAddress?: string;
  ratePerMinute: number;
}): Promise<StreamingPreflightResult> {
  const baseResult = {
    requiredChainId: ACTIVE_CHAIN.id,
    requiredChainName: ACTIVE_CHAIN.name,
    tokenAddress: SUPERFLUID_TOKEN,
    tokenSymbol: SUPERFLUID_TOKEN_SYMBOL,
  };

  if (!agentAddress) {
    return {
      ok: false,
      code: 'missing_payout_address',
      message: 'Streaming payment requires an agent payout address.',
      ...baseResult,
    };
  }

  if (currentChainId !== ACTIVE_CHAIN.id) {
    return {
      ok: false,
      code: 'wrong_chain',
      message: `Switch your wallet to ${ACTIVE_CHAIN.name} to start a streaming call.`,
      ...baseResult,
    };
  }

  try {
    const bytecode = await publicClient.getBytecode({ address: SUPERFLUID_TOKEN });
    if (!bytecode || bytecode === '0x') {
      return {
        ok: false,
        code: 'missing_token_contract',
        message: `${SUPERFLUID_TOKEN_SYMBOL} is not available on ${ACTIVE_CHAIN.name}.`,
        ...baseResult,
      };
    }

    const requiredBalance = Math.max(ratePerMinute * STREAMING_BALANCE_ESTIMATE_MINUTES, 0);
    const requiredUnits = parseUnits(requiredBalance.toFixed(6), 18);
    const balanceRaw = await publicClient.readContract({
      address: SUPERFLUID_TOKEN,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    });
    const availableBalance = Number(formatUnits(balanceRaw, 18));

    if (balanceRaw < requiredUnits) {
      return {
        ok: false,
        code: 'insufficient_balance',
        message: `Insufficient ${SUPERFLUID_TOKEN_SYMBOL} balance for the first ${STREAMING_BALANCE_ESTIMATE_MINUTES} minutes.`,
        availableBalance,
        requiredBalance,
        ...baseResult,
      };
    }

    return {
      ok: true,
      message: 'Streaming payment is ready.',
      availableBalance,
      requiredBalance,
      ...baseResult,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'rpc_error',
      message: error instanceof Error ? error.message : 'Unable to verify streaming balance.',
      ...baseResult,
    };
  }
}
