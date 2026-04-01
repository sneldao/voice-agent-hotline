// ============================================
// Real On-Chain Payment Settlement for Celo
// ============================================
// Implements actual x402 payment settlement on Celo mainnet
// Using transferWithAuthorization for gasless payments

import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther,
  formatEther,
  Address,
  Hash
} from 'viem';
import { erc20Abi } from './abis/erc20';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Celo Sepolia chain definition (viem doesn't export it yet)
const celoSepolia = {
  id: 11142220,
  name: 'Celo Sepolia',
  network: 'celo-sepolia',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] },
    public: { http: ['https://forno.celo-sepolia.celo-testnet.org'] },
  },
  blockExplorers: {
    default: { name: 'Celoscan', url: 'https://sepolia.celoscan.io' },
  },
  testnet: true,
};
import { getRedis } from './redis';

// ============================================
// Celo Token Addresses
// ============================================
export const CELO_TOKENS = {
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as Address,
  USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as Address,
  CELO: '0x471EcE3750Da237f93B8E339c536898b6AEDf5c7' as Address,
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
export interface PaymentAuthorization {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
}

export interface EIP712Signature {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

export interface SignedAuthorization extends PaymentAuthorization {
  signature: EIP712Signature;
}

export interface SettlementResult {
  success: boolean;
  txHash?: Hash;
  blockNumber?: bigint;
  gasUsed?: bigint;
  actualAmount?: string;
  error?: string;
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
const ACTIVE_CHAIN = process.env.NODE_ENV === 'production' ? celo : celoSepolia;

const RPC_URL = process.env.CELO_RPC_URL || 'https://forno.celo.org';

// ============================================
// Payment Settlement Service
// ============================================
export class PaymentSettlement {
  private publicClient: any;
  private facilitatorWallet?: any;

  constructor() {
    this.publicClient = createPublicClient({
      chain: ACTIVE_CHAIN as any,
      transport: http(RPC_URL),
    });

    // Initialize facilitator wallet lazily — only when a valid key is provided
    const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY;
    if (facilitatorKey && facilitatorKey.startsWith('0x') && facilitatorKey.length === 66) {
      try {
        const account = privateKeyToAccount(facilitatorKey as `0x${string}`);
        this.facilitatorWallet = createWalletClient({
          account,
          chain: ACTIVE_CHAIN as any,
          transport: http(RPC_URL),
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
   * Get token decimals (cUSD/USDC = 18)
   */
  async getTokenDecimals(token: Address = CELO_TOKENS.cUSD): Promise<number> {
    try {
      const decimals = await this.publicClient.readContract({
        address: token,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: 'decimals',
      });
      return decimals;
    } catch (error) {
      console.error('[Settlement] Error getting decimals:', error);
      return 18; // Default for cUSD/USDC
    }
  }

  /**
   * Check if authorization has been used
   */
  async isAuthorizationUsed(
    authorizer: Address,
    nonce: `0x${string}`,
    token: Address = CELO_TOKENS.cUSD
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
    token: Address = CELO_TOKENS.cUSD
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
    token: Address = CELO_TOKENS.cUSD,
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
          error: `Insufficient balance. Has: ${formatEther(balance)}, Needs: ${formatEther(authorization.value)}`,
        };
      }

      console.log('[Settlement] Executing transferWithAuthorization...', {
        from: authorization.from,
        to: authorization.to,
        value: formatEther(authorization.value),
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
        amount: formatEther(authorization.value),
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
        actualAmount: formatEther(authorization.value),
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
   * Settle a partial payment (for per-second billing)
   * Calculates actual amount based on duration and refunds the rest
   */
  async settlePartialPayment(
    authorization: SignedAuthorization,
    actualDurationSeconds: number,
    ratePerMinuteCents: number,
    token: Address = CELO_TOKENS.cUSD,
    callId?: string
  ): Promise<SettlementResult> {
    // Calculate actual cost
    const ratePerSecond = (ratePerMinuteCents * 100) / 60; // Convert to wei-like units
    const actualAmount = BigInt(Math.floor(actualDurationSeconds * ratePerSecond));

    // Ensure we don't exceed authorized amount
    if (actualAmount > authorization.value) {
      return this.settlePayment(authorization, token, callId);
    }

    // Create new authorization with actual amount
    // Note: In production, you'd use a more sophisticated partial settlement mechanism
    const adjustedAuth: SignedAuthorization = {
      ...authorization,
      value: actualAmount,
    };

    return this.settlePayment(adjustedAuth, token, callId);
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
export const EIP712_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: 42220, // Celo mainnet
  verifyingContract: CELO_TOKENS.cUSD,
};

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
 * Convert cents to token units (wei)
 */
export function centsToTokenUnits(cents: number, decimals: number = 18): bigint {
  // cents * 10^(decimals - 2) since cents is 10^-2
  const factor = BigInt(10 ** (decimals - 2));
  return BigInt(cents) * factor;
}

/**
 * Convert token units to cents
 */
export function tokenUnitsToCents(units: bigint, decimals: number = 18): number {
  const factor = BigInt(10 ** (decimals - 2));
  return Number(units / factor);
}

/**
 * Calculate call cost
 */
export function calculateCallCost(
  durationSeconds: number,
  ratePerMinuteCents: number
): bigint {
  const durationMinutes = durationSeconds / 60;
  const totalCents = durationMinutes * ratePerMinuteCents;
  return centsToTokenUnits(Math.ceil(totalCents));
}

// ============================================
// Singleton Instance
// ============================================
export const paymentSettlement = new PaymentSettlement();
