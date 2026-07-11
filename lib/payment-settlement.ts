// ============================================
// Real On-Chain Payment Settlement for Arbitrum
// ============================================
// Implements x402 payment settlement on Arbitrum
// Using transferWithAuthorization for gasless payments

import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  formatUnits,
  Address,
  Hash
} from 'viem';
import { erc20Abi } from './abis/erc20';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ACTIVE_CHAIN,
  ACTIVE_CHAIN_ID,
  ACTIVE_USDC,
  EXPLORER_URL,
  ARB_USDC_EIP712_DOMAIN,
  ARB_USDC_EIP712_DOMAIN_SEPOLIA,
} from './arbitrum-chain';
import { AGENT_SHARE_BPS, FEE_BPS_DENOMINATOR } from './fees';
import { getRedis } from './redis';

// ============================================
// Arbitrum Token Addresses
// ============================================
export const ARB_TOKENS = {
  USDC: ACTIVE_USDC,
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address,
};

// ============================================
// EIP-3009 TransferWithAuthorization ABI
// ============================================
const TRANSFER_WITH_AUTHORIZATION_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'authorizationState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [{ name: 'state', type: 'bool' }],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'nonce', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'decimals', type: 'uint8' }],
  },
] as const;

// ============================================
// Types
// ============================================
import { EIP712Signature, SettlementResult } from './types';
export type { EIP712Signature, SettlementResult };

export interface PaymentAuthorization {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
}

export interface SignedAuthorization extends PaymentAuthorization {
  signature: EIP712Signature;
}

export interface PaymentReceipt {
  callId: string;
  payer: Address;
  payee: Address;
  amount: string;
  token: Address;
  txHash: Hash;
  blockNumber: bigint;
  timestamp: number;
  settled: boolean;
}

// ============================================
// Configuration
// ============================================
const PAYMENT_RPC_URL = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';

/** Platform wallet for revenue ledger destination (20% share). */
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET || process.env.PAYMENT_RECEIVER) as Address | undefined;

// Fee percentages live in lib/fees.ts — re-export for callers that imported from here.
export { AGENT_SHARE_PERCENT, PLATFORM_SHARE_PERCENT } from './fees';

// ============================================
// Payment Settlement Service
// ============================================
export class PaymentSettlement {
  private publicClient: any;
  private facilitatorWallet?: any;

  constructor() {
    this.publicClient = createPublicClient({
      chain: ACTIVE_CHAIN as any,
      transport: http(PAYMENT_RPC_URL),
    });

    // Initialize facilitator wallet lazily — only when a valid key is provided
    const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY;
    if (facilitatorKey && facilitatorKey.startsWith('0x') && facilitatorKey.length === 66) {
      try {
        const account = privateKeyToAccount(facilitatorKey as `0x${string}`);
        this.facilitatorWallet = createWalletClient({
          account,
          chain: ACTIVE_CHAIN as any,
          transport: http(PAYMENT_RPC_URL),
        });
      } catch (e) {
        console.warn('[Settlement] Invalid FACILITATOR_PRIVATE_KEY, settlement disabled');
      }
    }
  }

  private serializeReceipt(receipt: PaymentReceipt): Record<string, string> {
    return {
      callId: receipt.callId,
      payer: receipt.payer,
      payee: receipt.payee,
      amount: receipt.amount,
      token: receipt.token,
      txHash: receipt.txHash,
      blockNumber: receipt.blockNumber.toString(),
      timestamp: receipt.timestamp.toString(),
      settled: receipt.settled.toString(),
    };
  }

  private deserializeReceipt(data: Record<string, string>): PaymentReceipt | null {
    if (!data || !data.callId) return null;
    return {
      callId: data.callId,
      payer: data.payer as Address,
      payee: data.payee as Address,
      amount: data.amount,
      token: data.token as Address,
      txHash: data.txHash as Hash,
      blockNumber: BigInt(data.blockNumber),
      timestamp: parseInt(data.timestamp, 10),
      settled: data.settled === 'true',
    };
  }

  /**
   * Check if settlement service is properly configured
   */
  isConfigured(): boolean {
    return !!this.facilitatorWallet;
  }

  /**
   * Get token decimals (USDC = 6 on Arbitrum)
   */
  async getTokenDecimals(token: Address = ARB_TOKENS.USDC): Promise<number> {
    try {
      const decimals = await this.publicClient.readContract({
        address: token,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: 'decimals',
      });
      return decimals;
    } catch (error) {
      console.error('[Settlement] Error getting decimals:', error);
      return 6; // Default for USDC on Arbitrum
    }
  }

  /**
   * Check if authorization has been used
   */
  async isAuthorizationUsed(
    authorizer: Address,
    nonce: `0x${string}`,
    token: Address = ARB_TOKENS.USDC
  ): Promise<boolean> {
    try {
      const state = await this.publicClient.readContract({
        address: token,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: 'authorizationState',
        args: [authorizer, nonce],
      });
      return state;
    } catch (error) {
      console.error('[Settlement] Error checking authorization state:', error);
      return false;
    }
  }

  /**
   * Check payer token balance
   */
  async getBalance(
    address: Address,
    token: Address = ARB_TOKENS.USDC
  ): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: token,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      return balance;
    } catch (error) {
      console.error('[Settlement] Error getting balance:', error);
      return 0n;
    }
  }

  /**
   * Settle payment on-chain using transferWithAuthorization
   * This is the core function that actually moves money!
   */
  async settlePayment(
    authorization: SignedAuthorization,
    token: Address = ARB_TOKENS.USDC,
    callId?: string
  ): Promise<SettlementResult> {
    if (!this.facilitatorWallet) {
      return {
        success: false,
        error: 'Facilitator wallet not configured. Set FACILITATOR_PRIVATE_KEY env var.',
      };
    }

    try {
      // Check if authorization was already used
      const isUsed = await this.isAuthorizationUsed(
        authorization.from,
        authorization.nonce,
        token
      );

      if (isUsed) {
        return {
          success: false,
          error: 'Authorization already used (replay protection)',
        };
      }

      // Check current time against validity window
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now < authorization.validAfter) {
        return {
          success: false,
          error: 'Authorization not yet valid',
        };
      }
      if (now > authorization.validBefore) {
        return {
          success: false,
          error: 'Authorization expired',
        };
      }

      // Check payer has sufficient balance
      const balance = await this.getBalance(authorization.from, token);
      if (balance < authorization.value) {
        return {
          success: false,
          error: `Insufficient balance. Has: ${formatUnits(balance, 6)}, Needs: ${formatUnits(authorization.value, 6)}`,
        };
      }

      console.log('[Settlement] Executing transferWithAuthorization...', {
        from: authorization.from,
        to: authorization.to,
        value: formatUnits(authorization.value, 6),
        token,
      });

      // Execute the transfer!
      const hash = await this.facilitatorWallet.writeContract({
        address: token,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          authorization.from,
          authorization.to,
          authorization.value,
          authorization.validAfter,
          authorization.validBefore,
          authorization.nonce,
          authorization.signature.v,
          authorization.signature.r,
          authorization.signature.s,
        ],
      });

      console.log('[Settlement] Transaction submitted:', hash);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60_000, // 60 seconds
        confirmations: 1,
      });

      if (receipt.status !== 'success') {
        return {
          success: false,
          error: 'Transaction failed on-chain',
          txHash: hash,
        };
      }

      // Store receipt
      const paymentReceipt: PaymentReceipt = {
        callId: callId || `call_${Date.now()}`,
        payer: authorization.from,
        payee: authorization.to,
        amount: formatUnits(authorization.value, 6),
        token,
        txHash: hash,
        blockNumber: receipt.blockNumber,
        timestamp: Date.now(),
        settled: true,
      };

      const redis = getRedis();
      await redis.hset(`payment-receipt:${paymentReceipt.callId}`, this.serializeReceipt(paymentReceipt));
      await redis.sadd('payment_receipt_index', `payment-receipt:${paymentReceipt.callId}`);

      console.log('[Settlement] ✅ Payment settled!', {
        txHash: hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      });

      return {
        success: true,
        txHash: hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        actualAmount: formatUnits(authorization.value, 6),
      };
    } catch (error: any) {
      console.error('[Settlement] Error settling payment:', error);
      return {
        success: false,
        error: error.message || 'Unknown settlement error',
      };
    }
  }

  /**
   * Partial settlement of a pre-authorized max amount is not supported by
   * mutating the signed value. Callers must re-prompt the user to sign the
   * exact amount, then call settlePayment with that authorization.
   */
  async settlePartialPayment(
    _authorization: SignedAuthorization,
    _actualDurationSeconds: number,
    _ratePerMinuteCents: number,
    _token: Address = ARB_TOKENS.USDC,
    _callId?: string
  ): Promise<SettlementResult> {
    return {
      success: false,
      error:
        'Partial settlement requires a new user signature for the exact amount. Do not mutate EIP-3009 authorization fields.',
    };
  }

  /**
   * Settle a single on-chain transfer using the original signed authorization,
   * then ledger the 80/20 marketplace split for agent payout accounting.
   *
   * Atomic on-chain 80/20 requires a PaymentRouter contract (not yet deployed).
   * This method never mutates signed authorization fields.
   */
  async settleWithLedgerSplit(
    authorization: SignedAuthorization,
    agentWallet: Address | undefined,
    token: Address = ARB_TOKENS.USDC,
    callId?: string
  ): Promise<SettlementResult> {
    const result = await this.settlePayment(authorization, token, callId);
    if (!result.success || !result.txHash) return result;

    const total = authorization.value;
    const agentAmount = (total * BigInt(AGENT_SHARE_BPS)) / BigInt(FEE_BPS_DENOMINATOR);
    const platformAmount = total - agentAmount;

    const redis = getRedis();
    const id = callId || `call_${Date.now()}`;
    await redis.hset(`split-payment:${id}`, {
      callId: id,
      payer: authorization.from,
      payee: authorization.to,
      agentWallet: agentWallet || '',
      platformWallet: PLATFORM_WALLET || '',
      totalAmount: total.toString(),
      agentAmount: agentAmount.toString(),
      platformAmount: platformAmount.toString(),
      txHash: result.txHash,
      timestamp: Date.now().toString(),
      status: 'ledgered',
      splitMode: 'ledger',
      note: 'Single on-chain transfer; 80/20 is ledger-only until PaymentRouter',
    });

    return {
      ...result,
      actualAmount: formatUnits(total, 6),
    };
  }

  /**
   * Get payment receipt by call ID
   */
  async getReceipt(callId: string): Promise<PaymentReceipt | undefined> {
    const redis = getRedis();
    const data = await redis.hgetall(`payment-receipt:${callId}`);
    return this.deserializeReceipt(data as Record<string, string>) ?? undefined;
  }

  /**
   * Get all receipts for an address (payer or payee)
   */
  async getReceiptsForAddress(address: Address): Promise<PaymentReceipt[]> {
    const redis = getRedis();
    const keys = await redis.smembers('payment_receipt_index');
    const receipts: PaymentReceipt[] = [];

    if (keys.length === 0) return receipts;

    const pipeline = redis.pipeline();
    keys.forEach(k => pipeline.hgetall(k));
    const results = await pipeline.exec();

    for (const raw of (results || [])) {
      const data = (raw as [Error | null, any])[1];
      const receipt = data ? this.deserializeReceipt(data as Record<string, string>) : null;
      if (receipt && (
        receipt.payer.toLowerCase() === address.toLowerCase() ||
        receipt.payee.toLowerCase() === address.toLowerCase()
      )) {
        receipts.push(receipt);
      }
    }
    
    return receipts;
  }

  /**
   * Get settlement statistics
   */
  async getStats(): Promise<{
    totalSettled: number;
    totalVolume: string;
    averageGasUsed: string;
  }> {
    const redis = getRedis();
    const keys = await redis.smembers('payment_receipt_index');
    const receipts: PaymentReceipt[] = [];

    if (keys.length > 0) {
      const pipeline = redis.pipeline();
      keys.forEach(k => pipeline.hgetall(k));
      const results = await pipeline.exec();

      for (const raw of (results || [])) {
        const data = (raw as [Error | null, any])[1];
        const receipt = data ? this.deserializeReceipt(data as Record<string, string>) : null;
        if (receipt) {
          receipts.push(receipt);
        }
      }
    }
    
    const settled = receipts.filter(r => r.settled);

    const totalVolume = settled.reduce(
      (sum, r) => sum + (parseFloat(r.amount) || 0),
      0
    );

    return {
      totalSettled: settled.length,
      totalVolume: totalVolume.toFixed(6),
      averageGasUsed: '0', // Would track in production
    };
  }
}

// ============================================
// EIP-712 Domain and Types for Signing
// ============================================
// Domain is re-exported from arbitrum-chain.ts (SSOT) for callers that
// imported EIP712_DOMAIN from this module.
export const EIP712_DOMAIN = ACTIVE_CHAIN_ID === ARB_USDC_EIP712_DOMAIN.chainId
  ? ARB_USDC_EIP712_DOMAIN
  : ARB_USDC_EIP712_DOMAIN_SEPOLIA;

export const EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

// ============================================
// Helper Functions
// ============================================

/**
 * Convert cents (USD * 100) to USDC token units (default 6 decimals).
 */
export function centsToTokenUnits(cents: number, decimals: number = 6): bigint {
  // cents * 10^(decimals - 2) since cents is 10^-2
  const factor = BigInt(10 ** (decimals - 2));
  return BigInt(Math.ceil(cents)) * factor;
}

/**
 * Convert token units to cents (USDC 6 decimals by default).
 */
export function tokenUnitsToCents(units: bigint, decimals: number = 6): number {
  const factor = BigInt(10 ** (decimals - 2));
  return Number(units / factor);
}

/**
 * Calculate call cost in USDC token units (6 decimals).
 */
export function calculateCallCost(
  durationSeconds: number,
  ratePerMinuteCents: number
): bigint {
  const durationMinutes = durationSeconds / 60;
  const totalCents = durationMinutes * ratePerMinuteCents;
  return centsToTokenUnits(Math.ceil(totalCents), 6);
}

// ============================================
// Singleton Instance
// ============================================
export const paymentSettlement = new PaymentSettlement();
