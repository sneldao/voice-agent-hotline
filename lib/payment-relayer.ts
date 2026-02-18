// ============================================
// Gelato Relay Integration (Gasless Transactions)
// ============================================
// No server-side private keys required!
// 
// How it works:
// 1. User signs EIP-712 authorization (gasless)
// 2. Server prepares the transaction
// 3. Gelato Relay broadcasts and pays for gas
// 4. User pays Gelato back in ERC-20 tokens (cUSD)
//
// Get started: https://docs.gelato.network/relay

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
  taskId?: string; // Gelato task ID
  error?: string;
}

// ============================================
// Configuration
// ============================================
const ACTIVE_CHAIN = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;
const RPC_URL = process.env.CELO_RPC_URL || 'https://forno.celo.org';

// Gelato Relay configuration
const GELATO_RELAY_URL = 'https://relay.gelato.digital';
const GELATO_API_KEY = process.env.GELATO_API_KEY; // Optional for sponsored calls

// ============================================
// Gelato Relay Payment Settlement
// ============================================
export class GelatoRelaySettlement {
  private publicClient: any;

  constructor() {
    this.publicClient = createPublicClient({
      chain: ACTIVE_CHAIN as any,
      transport: http(RPC_URL),
    });
  }

  /**
   * Check if Gelato Relay is configured
   */
  isConfigured(): boolean {
    // Gelato works without API key for ERC-2771 calls
    // API key only needed for sponsored calls
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
      console.error('[Gelato] Error checking authorization state:', error);
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
      console.error('[Gelato] Error getting balance:', error);
      return 0n;
    }
  }

  /**
   * Settle payment using Gelato Relay (gasless for user)
   * 
   * The user pays Gelato in cUSD (or we sponsor via API key)
   * No server-side private key needed!
   */
  async settlePayment(
    authorization: SignedAuthorization,
    token: Address = CELO_TOKENS.cUSD,
    callId?: string,
    options?: {
      sponsor?: boolean; // If true, use Gelato API key to sponsor gas
    }
  ): Promise<SettlementResult> {
    try {
      // Validate authorization
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

      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now < authorization.validAfter) {
        return { success: false, error: 'Authorization not yet valid' };
      }
      if (now > authorization.validBefore) {
        return { success: false, error: 'Authorization expired' };
      }

      const balance = await this.getBalance(authorization.from, token);
      if (balance < authorization.value) {
        return {
          success: false,
          error: `Insufficient balance. Has: ${formatEther(balance)}, Needs: ${formatEther(authorization.value)}`,
        };
      }

      console.log('[Gelato] Submitting relay request:', {
        from: authorization.from,
        to: authorization.to,
        value: formatEther(authorization.value),
        token,
      });

      // Encode the transaction data
      const data = this.encodeTransferWithAuthorization(authorization);

      // Submit to Gelato Relay
      const relayResponse = await this.submitToGelato({
        target: token,
        data,
        user: authorization.from,
        sponsor: options?.sponsor ?? false,
      });

      if (!relayResponse.success) {
        return {
          success: false,
          error: relayResponse.error,
        };
      }

      if (!relayResponse.taskId) {
        return {
          success: false,
          error: 'No task ID returned from Gelato',
        };
      }

      console.log('[Gelato] Relay task created:', relayResponse.taskId);

      // Wait for execution (optional - can return immediately)
      const execution = await this.waitForExecution(relayResponse.taskId);

      if (!execution.success) {
        return {
          success: false,
          error: execution.error,
          taskId: relayResponse.taskId,
        };
      }

      console.log('[Gelato] ✅ Payment settled!', {
        txHash: execution.txHash,
        taskId: relayResponse.taskId,
      });

      return {
        success: true,
        txHash: execution.txHash,
        taskId: relayResponse.taskId,
        actualAmount: formatEther(authorization.value),
      };
    } catch (error: any) {
      console.error('[Gelato] Error settling payment:', error);
      return {
        success: false,
        error: error.message || 'Unknown settlement error',
      };
    }
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
   * Submit transaction to Gelato Relay
   */
  private async submitToGelato(params: {
    target: Address;
    data: `0x${string}`;
    user: Address;
    sponsor: boolean;
  }): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
      // For ERC-2771 meta-transactions via Gelato
      const request = {
        chainId: ACTIVE_CHAIN.id,
        target: params.target,
        data: params.data,
        user: params.user,
        // If sponsoring, include API key
        ...(params.sponsor && GELATO_API_KEY && {
          sponsorApiKey: GELATO_API_KEY,
        }),
      };

      const response = await fetch(`${GELATO_RELAY_URL}/relays/v2/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(GELATO_API_KEY && { 'Authorization': `Bearer ${GELATO_API_KEY}` }),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Gelato API error: ${error}` };
      }

      const result = await response.json();
      return {
        success: true,
        taskId: result.taskId,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for Gelato task execution
   */
  private async waitForExecution(
    taskId: string,
    timeoutMs: number = 120_000
  ): Promise<{ success: boolean; txHash?: Hash; error?: string }> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(
          `${GELATO_RELAY_URL}/tasks/status/${taskId}`
        );

        if (!response.ok) {
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }

        const status = await response.json();

        if (status.taskState === 'ExecSuccess') {
          return {
            success: true,
            txHash: status.transactionHash as Hash,
          };
        }

        if (status.taskState === 'ExecReverted' || status.taskState === 'Cancelled') {
          return {
            success: false,
            error: `Task ${status.taskState}: ${status.lastCheckMessage || 'Unknown error'}`,
          };
        }

        // Still pending, wait and retry
        await new Promise(r => setTimeout(r, pollInterval));
      } catch (error) {
        await new Promise(r => setTimeout(r, pollInterval));
      }
    }

    return { success: false, error: 'Timeout waiting for execution' };
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
export const gelatoRelaySettlement = new GelatoRelaySettlement();
