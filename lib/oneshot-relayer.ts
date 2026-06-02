// ============================================
// 1Shot Permissionless Relayer Integration
// ============================================
// Gas abstraction for MetaMask Smart Account transactions.
//
// 1Shot provides a permissionless relayer for EIP-7710
// smart accounts — no signup, no business account, no
// tier-management overhead. Integrate directly over JSON-RPC.
//
// Docs: https://docs.1shotapi.com
// Relayer skill: install into agentic coding environment
// ============================================

import type { Address, Hex, Hash } from 'viem';
import { ACTIVE_CHAIN_ID } from './arbitrum-chain';

// ============================================
// Configuration
// ============================================

/** 1Shot relayer endpoint — permissionless, no API key required */
const ONESHOT_RELAYER_URL =
  process.env.ONESHOT_RELAYER_URL ||
  'https://relayer.1shotapi.com';

/** Optional: API key for higher rate limits */
const ONESHOT_API_KEY = process.env.ONESHOT_API_KEY || '';

// ============================================
// Types
// ============================================

export interface OneShotRelayRequest {
  /** The signed user operation (ERC-4337 UserOp or EIP-7710 delegation) */
  data: Hex;
  /** Target chain ID */
  chainId: number;
  /** Optional: gas limit override */
  gasLimit?: bigint;
}

export interface OneShotRelayResponse {
  success: boolean;
  txHash?: Hash;
  error?: string;
  /** Block explorer URL for the transaction */
  explorerUrl?: string;
}

export interface OneShotStatusResponse {
  status: 'pending' | 'confirmed' | 'failed';
  txHash: Hash;
  blockNumber?: bigint;
  gasUsed?: bigint;
}

// ============================================
// 1Shot Relayer Client
// ============================================

export class OneShotRelayer {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ONESHOT_API_KEY;
  }

  get isConfigured(): boolean {
    return true; // Permissionless — always available
  }

  /**
   * Relay a signed ERC-4337 UserOperation or EIP-7710 delegation
   * through 1Shot's permissionless relayer.
   *
   * The relayer pays gas, so the user doesn't need ETH for transactions.
   */
  async relay(params: OneShotRelayRequest): Promise<OneShotRelayResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(`${ONESHOT_RELAYER_URL}/relay`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_sendUserOperation',
          params: [params.data, params.chainId],
          id: 1,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return {
          success: false,
          error: `Relayer HTTP ${response.status}: ${err.slice(0, 300)}`,
        };
      }

      const result = await response.json() as {
        result?: string;
        error?: { message: string };
      };

      if (result.error) {
        return {
          success: false,
          error: result.error.message,
        };
      }

      const txHash = result.result as Hash | undefined;
      if (!txHash) {
        return {
          success: false,
          error: 'No transaction hash in relay response',
        };
      }

      return {
        success: true,
        txHash,
        explorerUrl: this.getExplorerUrl(txHash, params.chainId),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Relayer request failed',
      };
    }
  }

  /**
   * Relay a signed MetaMask Smart Account delegation redemption.
   * Wraps the delegation + signature into a UserOperation and
   * sends it through the 1Shot permissionless relayer.
   */
  async relayDelegation(params: {
    /** The signed delegation payload from MetaMask Smart Accounts Kit */
    delegationData: Hex;
    /** The delegation signature from the smart account */
    signature: Hex;
    /** Optional: target contract for the delegated call */
    target?: Address;
  }): Promise<OneShotRelayResponse> {
    // Encode the delegation as a UserOperation callData
    // EIP-7710: prefix 0xef0100 indicates a signed delegation
    const delegationPrefix = '0xef0100' as Hex;
    
    // Construct the calldata: delegation prefix + encoded delegation + signature
    const calldata = `${delegationPrefix}${params.delegationData.slice(2)}${params.signature.slice(2)}` as Hex;

    return this.relay({
      data: calldata,
      chainId: ACTIVE_CHAIN_ID,
    });
  }

  /**
   * Relay a user-signed payment transaction (transferWithAuthorization).
   * Uses 1Shot for gas abstraction — user signs, relayer submits.
   */
  async relayPayment(params: {
    /** The encoded transferWithAuthorization calldata */
    calldata: Hex;
    /** The token contract address */
    token: Address;
  }): Promise<OneShotRelayResponse> {
    // Encode as a regular transaction (not UserOp) for EOA relay
    const response = await fetch(`${ONESHOT_RELAYER_URL}/relay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendRawTransaction',
        params: [params.calldata],
        id: 1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        success: false,
        error: `Relayer HTTP ${response.status}: ${err.slice(0, 300)}`,
      };
    }

    const result = await response.json() as {
      result?: string;
      error?: { message: string };
    };

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    const txHash = result.result as Hash | undefined;
    return {
      success: !!txHash,
      txHash,
      explorerUrl: txHash ? this.getExplorerUrl(txHash, ACTIVE_CHAIN_ID) : undefined,
      error: txHash ? undefined : 'No transaction hash returned',
    };
  }

  /**
   * Check the status of a relayed transaction.
   */
  async getStatus(txHash: Hash): Promise<OneShotStatusResponse> {
    const response = await fetch(`${ONESHOT_RELAYER_URL}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      }),
    });

    if (!response.ok) {
      return { status: 'pending', txHash };
    }

    const result = await response.json() as {
      result?: {
        status: string;
        blockNumber: string;
        gasUsed: string;
      } | null;
    };

    if (!result.result) {
      return { status: 'pending', txHash };
    }

    return {
      status: result.result.status === '0x1' ? 'confirmed' : 'failed',
      txHash,
      blockNumber: result.result.blockNumber ? BigInt(result.result.blockNumber) : undefined,
      gasUsed: result.result.gasUsed ? BigInt(result.result.gasUsed) : undefined,
    };
  }

  /**
   * Build the explorer URL for a transaction.
   */
  private getExplorerUrl(txHash: Hash, chainId: number): string {
    const explorers: Record<number, string> = {
      42161: 'https://arbiscan.io',
      421614: 'https://sepolia.arbiscan.io',
      1: 'https://etherscan.io',
      11155111: 'https://sepolia.etherscan.io',
      8453: 'https://basescan.org',
      10: 'https://optimistic.etherscan.io',
      137: 'https://polygonscan.com',
    };
    const base = explorers[chainId] || 'https://arbiscan.io';
    return `${base}/tx/${txHash}`;
  }
}

// ============================================
// Singleton
// ============================================

export const oneshotRelayer = new OneShotRelayer();

// ============================================
// Convenience: Gasless Payment Settlement
// ============================================

/**
 * Settle a payment using 1Shot's permissionless relayer
 * instead of requiring the user to pay gas directly.
 *
 * The user signs the transferWithAuthorization EIP-712 message,
 * and 1Shot relays the transaction — no ETH needed for gas.
 */
export async function gaslessSettlePayment(params: {
  /** Encoded transferWithAuthorization calldata */
  calldata: Hex;
  /** Token contract address */
  token: Address;
}): Promise<OneShotRelayResponse> {
  console.log('[1Shot] Relaying gasless payment settlement...');
  
  const result = await oneshotRelayer.relayPayment({
    calldata: params.calldata,
    token: params.token,
  });

  if (result.success) {
    console.log(`[1Shot] ✅ Gasless payment settled: ${result.txHash}`);
  } else {
    console.error(`[1Shot] ❌ Relay failed: ${result.error}`);
  }

  return result;
}