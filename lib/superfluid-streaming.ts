// ============================================
// Superfluid Streaming Integration (Celo)
// ============================================
// Continuous USDCx streaming payments for voice call billing.
// Uses CFAv1Forwarder – the same address on every EVM chain.
// Reference: https://docs.superfluid.finance/docs/protocol/advanced-topics/cfav1forwarder

import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  Address,
  Hash,
} from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

// ============================================
// Configuration
// ============================================

// CFAv1Forwarder is deployed at the same address on every Superfluid-enabled chain.
export const CFA_V1_FORWARDER = '0xcfA132E353cB4E3180835bd80aA1126F87b751Ee' as Address;

// Super-token used for voice-call streaming.
// Override with NEXT_PUBLIC_SUPERFLUID_TOKEN env var for testnet/custom tokens.
// Default: cUSDCx on Celo mainnet (Superfluid-wrapped USDC)
export const SUPERFLUID_TOKEN: Address = (
  process.env.NEXT_PUBLIC_SUPERFLUID_TOKEN ||
  '0x1BA8603DA702602A8657980e825A6DAa03Dee93a' // cUSDCx – Celo mainnet
) as Address;
export const SUPERFLUID_TOKEN_SYMBOL = process.env.NEXT_PUBLIC_SUPERFLUID_TOKEN_SYMBOL || 'cUSDCx';

export const ACTIVE_CHAIN = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;
export const RPC_URL = process.env.CELO_RPC_URL || 'https://forno.celo.org';

// ============================================
// CFAv1Forwarder ABI (minimal surface)
// ============================================
export const CFA_V1_FORWARDER_ABI = [
  {
    name: 'createFlow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'flowRate', type: 'int96' },
      { name: 'userData', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'updateFlow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'flowRate', type: 'int96' },
      { name: 'userData', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'deleteFlow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'userData', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'getFlowInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [
      { name: 'lastUpdated', type: 'uint256' },
      { name: 'flowRate', type: 'int96' },
      { name: 'deposit', type: 'uint256' },
      { name: 'owedDeposit', type: 'uint256' },
    ],
  },
  {
    name: 'getAccountFlowInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'account', type: 'address' },
    ],
    outputs: [
      { name: 'lastUpdated', type: 'uint256' },
      { name: 'flowRate', type: 'int96' },
      { name: 'deposit', type: 'uint256' },
      { name: 'owedDeposit', type: 'uint256' },
    ],
  },
] as const;

// ============================================
// Types
// ============================================

export interface StreamingPaymentState {
  status: 'idle' | 'pending' | 'streaming' | 'stopped' | 'error';
  streamId?: Hash;
  txHash?: Hash;
  flowRate?: string;
  startedAt?: Date;
  stoppedAt?: Date;
  error?: string;
}

export interface StreamInfo {
  exists: boolean;
  currentFlowRate: string;
  deposit: string;
  owedDeposit: string;
}

// ============================================
// Superfluid Streaming Service
// ============================================

export class SuperfluidStreamingService {
  // 'any' avoids the chain-specific generic mismatch from viem's overloads.
  private publicClient: any;
  private superToken: Address;

  constructor(superToken?: Address) {
    this.superToken = superToken ?? SUPERFLUID_TOKEN;

    this.publicClient = createPublicClient({
      chain: ACTIVE_CHAIN,
      transport: http(RPC_URL),
    });
  }

  // --------------------------------------------------
  // Static helpers
  // --------------------------------------------------

  /**
   * Convert a monthly USDC amount (18-decimal string) into a per-second flow rate (int96).
   * Formula: monthlyAmount / (30 × 24 × 60 × 60)
   */
  static calculateFlowRate(monthlyAmount: string): bigint {
    const SECONDS_PER_MONTH = BigInt(30 * 24 * 60 * 60);
    return BigInt(monthlyAmount) / SECONDS_PER_MONTH;
  }

  /** Return live flow info between sender and receiver. */
  async checkStream(sender: Address, receiver: Address): Promise<StreamInfo> {
    try {
      const [, flowRate, deposit, owedDeposit] =
        (await this.publicClient.readContract({
          address: CFA_V1_FORWARDER,
          abi: CFA_V1_FORWARDER_ABI,
          functionName: 'getFlowInfo',
          args: [this.superToken, sender, receiver],
        })) as [bigint, bigint, bigint, bigint];

      return {
        exists: flowRate > 0n,
        currentFlowRate: flowRate.toString(),
        deposit: formatUnits(deposit, 18),
        owedDeposit: formatUnits(owedDeposit, 18),
      };
    } catch {
      return { exists: false, currentFlowRate: '0', deposit: '0', owedDeposit: '0' };
    }
  }

  /** Return the net flow rate for an account across all streams. */
  async getNetFlowRate(account: Address): Promise<string> {
    try {
      const [, flowRate] = (await this.publicClient.readContract({
        address: CFA_V1_FORWARDER,
        abi: CFA_V1_FORWARDER_ABI,
        functionName: 'getAccountFlowInfo',
        args: [this.superToken, account],
      })) as [bigint, bigint, bigint, bigint];
      return flowRate.toString();
    } catch {
      return '0';
    }
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert a monthly USDC amount (human units, e.g. 10) into a 18-decimal string
 * suitable for passing to SuperfluidStreamingService.
 */
export function monthlyUsdcToTokenUnits(monthlyUsdc: number): string {
  return parseUnits(monthlyUsdc.toString(), 18).toString();
}

/**
 * Format a raw flow rate (int96 bigint string) into a human-readable label.
 */
export function formatFlowRate(flowRate: string): string {
  const rateWei = BigInt(flowRate);
  if (rateWei === 0n) return '0 USDC/s';
  const ratePerSecond = Number(formatUnits(rateWei, 18));
  if (ratePerSecond < 0.000001) {
    return `${((ratePerSecond || 0) * 1e6).toFixed(2)} µUSDC/s`;
  }
  return `${(ratePerSecond || 0).toFixed(6)} USDC/s`;
}

/**
 * Calculate total tokens streamed given a flow rate and elapsed seconds.
 */
export function calculateStreamedAmount(flowRate: string, durationSeconds: number): string {
  const rate = BigInt(flowRate);
  return (rate * BigInt(durationSeconds)).toString();
}

// ============================================
// Backward-compatible utility (used by StreamingPaymentModal)
// ============================================

/**
 * Calculate the cost per second from a monthly USDC amount (human units, e.g. 10 = $10/month).
 * Returns a fractional dollar value per second.
 */
export function calculatePerSecondCost(monthlyUSDC: number): number {
  const secondsPerMonth = 30 * 24 * 60 * 60;
  return monthlyUSDC / secondsPerMonth;
}

export function getExplorerTxUrl(txHash: string): string {
  const baseUrl = ACTIVE_CHAIN.blockExplorers?.default?.url || 'https://celoscan.io';
  return `${baseUrl}/tx/${txHash}`;
}
