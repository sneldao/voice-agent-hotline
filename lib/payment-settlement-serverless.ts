// ============================================
// Serverless Payment Settlement (No Private Key Required)
// ============================================
// This version allows users to sign transactions themselves,
// and the server only broadcasts pre-signed transactions.
// 
// Alternative: User submits directly to mempool via their own RPC
//

import { 
  createPublicClient, 
  http,
  parseEther,
  formatEther,
  Address,
  Hash,
  serializeTransaction,
  parseTransaction,
} from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

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

// ============================================
// Configuration
// ============================================
const ACTIVE_CHAIN = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;
const RPC_URL = process.env.CELO_RPC_URL || 'https://forno.celo.org';

// ============================================
// Serverless Payment Settlement Service
// ============================================
export class ServerlessPaymentSettlement {
  private publicClient: any;

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
   * Validate a payment authorization without executing it
   * Returns the transaction data that can be executed by anyone
   */
  async validatePayment(
    authorization: SignedAuthorization,
    token: Address = CELO_TOKENS.cUSD,
    callId?: string
  ): Promise<{
    valid: boolean;
    error?: string;
    txData?: {
      to: Address;
      data: `0x${string}`;
      value: bigint;
    };
  }> {
    try {
      // Check if authorization was already used
      const isUsed = await this.isAuthorizationUsed(
        authorization.from,
        authorization.nonce,
        token
      );

      if (isUsed) {
        return { valid: false, error: 'Authorization already used (replay protection)' };
      }

      // Check current time against validity window
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now < authorization.validAfter) {
        return { valid: false, error: 'Authorization not yet valid' };
      }
      if (now > authorization.validBefore) {
        return { valid: false, error: 'Authorization expired' };
      }

      // Check payer has sufficient balance
      const balance = await this.getBalance(authorization.from, token);
      if (balance < authorization.value) {
        return {
          valid: false,
          error: `Insufficient balance. Has: ${formatEther(balance)}, Needs: ${formatEther(authorization.value)}`,
        };
      }

      // Build transaction data
      const data = this.encodeTransferWithAuthorization(authorization);

      return {
        valid: true,
        txData: {
          to: token,
          data,
          value: 0n,
        },
      };
    } catch (error: any) {
      console.error('[Settlement] Validation error:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Encode transferWithAuthorization call data
   */
  private encodeTransferWithAuthorization(
    authorization: SignedAuthorization
  ): `0x${string}` {
    // Function selector for transferWithAuthorization
    const selector = '0xe156a2f8';
    
    // Encode parameters
    const encoded = this.publicClient.encodeFunctionData({
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

    return encoded;
  }

  /**
   * Settle payment on-chain using transferWithAuthorization
   * 
   * OPTION 1: Server broadcasts (no private key needed, just an RPC)
   * OPTION 2: Return tx data for client to submit
   */
  async settlePayment(
    authorization: SignedAuthorization,
    token: Address = CELO_TOKENS.cUSD,
    callId?: string,
    options?: {
      broadcast?: boolean; // If true, server broadcasts. If false, just returns tx data
    }
  ): Promise<SettlementResult & {
    txData?: `0x${string}`;
    canBroadcast?: boolean;
  }> {
    const shouldBroadcast = options?.broadcast ?? true;

    // Validate first
    const validation = await this.validatePayment(authorization, token, callId);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    console.log('[Settlement] Payment validated:', {
      from: authorization.from,
      to: authorization.to,
      value: formatEther(authorization.value),
      token,
    });

    if (!shouldBroadcast) {
      // Return transaction data for client to submit
      return {
        success: true,
        txData: validation.txData!.data,
        canBroadcast: true,
        actualAmount: formatEther(authorization.value),
      };
    }

    try {
      // OPTION: Use a gasless relayer or paymaster
      // For now, we need SOME way to pay gas. Options:
      // 1. Use a relayer service (OpenZeppelin Defender, Gelato, etc.)
      // 2. Use a paymaster with ERC-4337
      // 3. Have a dedicated broadcaster wallet with minimal funds (still a key, but limited exposure)

      // For this implementation, we'll use a relayer pattern
      // The relayer can be a separate service with its own security model
      const txHash = await this.broadcastViaRelayer(validation.txData!, token);

      if (!txHash) {
        return {
          success: false,
          error: 'Failed to broadcast transaction via relayer',
          txData: validation.txData!.data,
          canBroadcast: true,
        };
      }

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000,
        confirmations: 1,
      });

      if (receipt.status !== 'success') {
        return {
          success: false,
          error: 'Transaction failed on-chain',
          txHash,
        };
      }

      console.log('[Settlement] ✅ Payment settled!', {
        txHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      });

      return {
        success: true,
        txHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        actualAmount: formatEther(authorization.value),
      };
    } catch (error: any) {
      console.error('[Settlement] Error settling payment:', error);
      return {
        success: false,
        error: error.message || 'Unknown settlement error',
        txData: validation.txData!.data,
        canBroadcast: true,
      };
    }
  }

  /**
   * Broadcast transaction via a relayer service
   * This abstracts away the private key management to a dedicated service
   * 
   * Options:
   * 1. OpenZeppelin Defender Relayer
   * 2. Gelato Relay
   * 3. Custom relayer with KMS
   * 4. Pimlico/Paymaster for ERC-4337
   */
  private async broadcastViaRelayer(
    txData: { to: Address; data: `0x${string}`; value: bigint },
    token: Address
  ): Promise<Hash | null> {
    // Option 1: Use OpenZeppelin Defender
    // const relayer = new Relayer({ apiKey: process.env.DEFENDER_API_KEY, ... });
    // return await relayer.sendTransaction(txData);

    // Option 2: Use Gelato Relay (gasless)
    // const relay = new GelatoRelay();
    // const response = await relay.sponsoredCall(...);

    // Option 3: Use Pimlico Paymaster for ERC-4337
    // const paymasterClient = createPimlicoPaymasterClient(...);
    // return await paymasterClient.sponsorUserOperation(...);

    // For now, return null to indicate relayer not configured
    // In production, implement your chosen relayer solution
    console.warn('[Settlement] No relayer configured. Transaction not broadcast.');
    return null;
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
export const serverlessPaymentSettlement = new ServerlessPaymentSettlement();
