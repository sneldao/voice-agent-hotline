// ============================================
// Client-Submitted Payment Settlement
// ============================================
// NO SERVER-SIDE PRIVATE KEYS NEEDED
// 
// Architecture:
// 1. User signs EIP-712 authorization in their wallet
// 2. Server validates and stores the authorization
// 3. Server returns the raw transaction data to the client
// 4. Client submits directly to blockchain (or their preferred RPC)
// 5. Server monitors for confirmation
//
// Benefits:
// - Zero server-side keys
// - User controls their own transaction submission
// - Server can't censor or steal funds
// - Works with any wallet (MetaMask, Rainbow, etc.)

import { 
  createPublicClient, 
  http,
  formatEther,
  Address,
  Hash,
} from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

// ============================================
// Celo Token Addresses
// ============================================
export const CELO_TOKENS = {
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as Address,
  USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as Address,
};

// ============================================
// EIP-3009 ABI
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
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

// ============================================
// Types
// ============================================
export interface EIP712Signature {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

export interface SignedAuthorization {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
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

export interface PendingPayment {
  id: string;
  authorization: SignedAuthorization;
  token: Address;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  txHash?: Hash;
  submittedAt?: number;
  confirmedAt?: number;
}

// ============================================
// Configuration
// ============================================
const ACTIVE_CHAIN = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;
const RPC_URL = process.env.CELO_RPC_URL || 'https://forno.celo.org';

// ============================================
// Client-Submitted Payment Settlement
// ============================================
export class ClientSubmittedSettlement {
  private publicClient: any;
  private pendingPayments: Map<string, PendingPayment> = new Map();

  constructor() {
    this.publicClient = createPublicClient({
      chain: ACTIVE_CHAIN as any,
      transport: http(RPC_URL),
    });
  }

  /**
   * Always returns true - no private key needed!
   */
  isConfigured(): boolean {
    return true;
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
      console.error('[ClientSubmitted] Error checking authorization state:', error);
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
      console.error('[ClientSubmitted] Error getting balance:', error);
      return 0n;
    }
  }

  /**
   * Step 1: Validate and prepare payment
   * Returns transaction data for client to submit
   */
  async preparePayment(
    authorization: SignedAuthorization,
    token: Address = CELO_TOKENS.cUSD,
    callId?: string
  ): Promise<{
    success: boolean;
    paymentId?: string;
    txData?: {
      to: Address;
      data: `0x${string}`;
      value: string;
      gasLimit: string;
      chainId: number;
    };
    error?: string;
  }> {
    try {
      const paymentId = callId || `payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Check if authorization was already used
      const isUsed = await this.isAuthorizationUsed(
        authorization.from,
        authorization.nonce,
        token
      );

      if (isUsed) {
        return { success: false, error: 'Authorization already used (replay protection)' };
      }

      // Check current time against validity window
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now < authorization.validAfter) {
        return { success: false, error: 'Authorization not yet valid' };
      }
      if (now > authorization.validBefore) {
        return { success: false, error: 'Authorization expired' };
      }

      // Check payer has sufficient balance
      const balance = await this.getBalance(authorization.from, token);
      if (balance < authorization.value) {
        return {
          success: false,
          error: `Insufficient balance. Has: ${formatEther(balance)}, Needs: ${formatEther(authorization.value)}`,
        };
      }

      // Encode the transaction data
      const data = this.encodeTransferWithAuthorization(authorization);

      // Store pending payment
      const pendingPayment: PendingPayment = {
        id: paymentId,
        authorization,
        token,
        status: 'pending',
      };
      this.pendingPayments.set(paymentId, pendingPayment);

      console.log('[ClientSubmitted] Payment prepared:', {
        paymentId,
        from: authorization.from,
        to: authorization.to,
        value: formatEther(authorization.value),
        token,
      });

      // Return transaction data for client to submit
      return {
        success: true,
        paymentId,
        txData: {
          to: token,
          data,
          value: '0x0', // No native token value
          gasLimit: '0x493e0', // 300k gas (generous limit)
          chainId: ACTIVE_CHAIN.id,
        },
      };
    } catch (error: any) {
      console.error('[ClientSubmitted] Error preparing payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Step 2: Client submits transaction hash after broadcasting
   * Server monitors for confirmation
   */
  async submitTransaction(
    paymentId: string,
    txHash: Hash
  ): Promise<{
    success: boolean;
    status: 'submitted' | 'confirmed' | 'failed';
    error?: string;
  }> {
    const payment = this.pendingPayments.get(paymentId);
    if (!payment) {
      return { success: false, status: 'failed', error: 'Payment not found' };
    }

    payment.txHash = txHash;
    payment.status = 'submitted';
    payment.submittedAt = Date.now();

    console.log('[ClientSubmitted] Transaction submitted by client:', {
      paymentId,
      txHash,
    });

    // Start monitoring for confirmation (async)
    this.monitorTransaction(paymentId, txHash);

    return { success: true, status: 'submitted' };
  }

  /**
   * Monitor transaction for confirmation
   */
  private async monitorTransaction(paymentId: string, txHash: Hash): Promise<void> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000, // 2 minutes
        confirmations: 1,
      });

      const payment = this.pendingPayments.get(paymentId);
      if (!payment) return;

      if (receipt.status === 'success') {
        payment.status = 'confirmed';
        payment.confirmedAt = Date.now();
        console.log('[ClientSubmitted] ✅ Payment confirmed:', {
          paymentId,
          txHash,
          blockNumber: receipt.blockNumber,
        });
      } else {
        payment.status = 'failed';
        console.error('[ClientSubmitted] Payment failed on-chain:', {
          paymentId,
          txHash,
        });
      }
    } catch (error) {
      console.error('[ClientSubmitted] Error monitoring transaction:', error);
      const payment = this.pendingPayments.get(paymentId);
      if (payment) {
        payment.status = 'failed';
      }
    }
  }

  /**
   * Check payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PendingPayment | null> {
    const payment = this.pendingPayments.get(paymentId);
    if (!payment) return null;

    // If submitted but not confirmed, check on-chain
    if (payment.status === 'submitted' && payment.txHash) {
      try {
        const receipt = await this.publicClient.getTransactionReceipt({
          hash: payment.txHash,
        });
        if (receipt) {
          payment.status = receipt.status === 'success' ? 'confirmed' : 'failed';
          payment.confirmedAt = Date.now();
        }
      } catch {
        // Receipt not yet available
      }
    }

    return payment;
  }

  /**
   * Encode transferWithAuthorization call data
   */
  private encodeTransferWithAuthorization(
    authorization: SignedAuthorization
  ): `0x${string}` {
    return this.publicClient.encodeFunctionData({
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
  }

  /**
   * Get all pending payments for an address
   */
  getPendingPayments(address: Address): PendingPayment[] {
    return Array.from(this.pendingPayments.values()).filter(
      p => p.authorization.from.toLowerCase() === address.toLowerCase() &&
           (p.status === 'pending' || p.status === 'submitted')
    );
  }

  /**
   * Get payment statistics
   */
  getStats(): {
    total: number;
    pending: number;
    submitted: number;
    confirmed: number;
    failed: number;
  } {
    const payments = Array.from(this.pendingPayments.values());
    return {
      total: payments.length,
      pending: payments.filter(p => p.status === 'pending').length,
      submitted: payments.filter(p => p.status === 'submitted').length,
      confirmed: payments.filter(p => p.status === 'confirmed').length,
      failed: payments.filter(p => p.status === 'failed').length,
    };
  }
}

// ============================================
// Helper Functions
// ============================================
export function centsToTokenUnits(cents: number, decimals: number = 18): bigint {
  const factor = BigInt(10 ** (decimals - 2));
  return BigInt(cents) * factor;
}

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
export const clientSubmittedSettlement = new ClientSubmittedSettlement();
