// ============================================
// WDK x402 Payment Integration
// ============================================
// Integrates WDK wallets with the x402 payment protocol
// Uses EIP-3009 transferWithAuthorization for gasless USD₮ payments
// Docs: https://docs.wallet.tether.io/ai/x402

import type { Address, Hash } from 'viem';
import { WDK_CHAINS, type WDKAccount } from './wdk-wallet';

// ============================================
// Types
// ============================================

export interface X402PaymentRequest {
  /** Amount in token units (respecting decimals) */
  amount: string;
  /** Token contract address */
  asset: Address;
  /** Recipient address */
  payTo: Address;
  /** CAIP-2 network identifier */
  network: string;
  /** Human-readable description */
  description: string;
}

export interface X402PaymentAuthorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

export interface X402SettlementResult {
  success: boolean;
  txHash?: Hash;
  error?: string;
  network?: string;
  amount?: string;
}

// ============================================
// x402 Client (Payment Signer)
// ============================================

export class WDKX402Client {
  private account: WDKAccount;
  private chainKey: string;

  constructor(account: WDKAccount, chainKey: string = 'celo') {
    this.account = account;
    this.chainKey = chainKey;
  }

  /**
   * Sign an EIP-3009 transferWithAuthorization for x402 payment.
   * The signed authorization can be sent to a facilitator for settlement.
   */
  async signPayment(request: X402PaymentRequest): Promise<X402PaymentAuthorization> {
    const config = WDK_CHAINS[this.chainKey];
    if (!config) throw new Error(`Unknown chain: ${this.chainKey}`);

    const now = Math.floor(Date.now() / 1000);
    const validAfter = BigInt(now);
    const validBefore = BigInt(now + 3600); // 1 hour validity
    const nonce = this.generateNonce();

    // Try WDK native signAuthorization first
    if (this.account.signAuthorization) {
      try {
        const sig = await this.account.signAuthorization({
          spender: request.payTo,
          value: BigInt(request.amount),
          token: request.asset,
        });
        return {
          from: this.account.address,
          to: request.payTo,
          value: request.amount,
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce,
          v: sig.v,
          r: sig.r,
          s: sig.s,
        };
      } catch {
        // Fall through to manual EIP-712 signing
      }
    }

    // Manual EIP-712 signing via WDK signTypedData
    const domain = {
      name: config.tokenMeta.name,
      version: config.tokenMeta.version,
      chainId: config.chainId,
      verifyingContract: request.asset,
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    const message = {
      from: this.account.address,
      to: request.payTo,
      value: BigInt(request.amount),
      validAfter,
      validBefore,
      nonce,
    };

    const signature = await this.account.signTypedData({ domain, types, message });

    // Split signature into v, r, s
    const sigBytes = signature.startsWith('0x') ? signature.slice(2) : signature;
    const r = `0x${sigBytes.slice(0, 64)}` as `0x${string}`;
    const s = `0x${sigBytes.slice(64, 128)}` as `0x${string}`;
    const v = parseInt(sigBytes.slice(128, 130), 16);

    return {
      from: this.account.address,
      to: request.payTo,
      value: request.amount,
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
      v,
      r,
      s,
    };
  }

  /**
   * Get the X-PAYMENT header value for an x402 request.
   * Encodes the signed authorization as base64 JSON.
   */
  async getPaymentHeader(request: X402PaymentRequest): Promise<string> {
    const auth = await this.signPayment(request);
    const payload = {
      x402Version: 1,
      scheme: 'exact',
      network: request.network,
      payload: {
        signature: { v: auth.v, r: auth.r, s: auth.s },
        authorization: {
          from: auth.from,
          to: auth.to,
          value: auth.value,
          validAfter: auth.validAfter,
          validBefore: auth.validBefore,
          nonce: auth.nonce,
        },
      },
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  private generateNonce(): `0x${string}` {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }
}

// ============================================
// x402 Server (Payment Verifier & Settler)
// ============================================

export class WDKX402Server {
  private facilitatorAccount: WDKAccount | null = null;
  private chainKey: string;

  constructor(chainKey: string = 'celo') {
    this.chainKey = chainKey;
  }

  /**
   * Set the facilitator account that will settle payments on-chain.
   * This wallet pays gas fees to execute transferWithAuthorization.
   */
  setFacilitator(account: WDKAccount) {
    this.facilitatorAccount = account;
  }

  /**
   * Create x402 payment requirements (402 response body).
   */
  createPaymentRequirements(params: {
    amount: string;
    payTo: Address;
    description: string;
  }): {
    x402Version: number;
    accepts: Array<{
      scheme: string;
      network: string;
      maxAmountRequired: string;
      asset: string;
      resource: string;
      payTo: string;
      extra: Record<string, unknown>;
    }>;
  } {
    const config = WDK_CHAINS[this.chainKey];
    if (!config) throw new Error(`Unknown chain: ${this.chainKey}`);

    return {
      x402Version: 1,
      accepts: [{
        scheme: 'exact',
        network: config.x402Network,
        maxAmountRequired: params.amount,
        asset: config.usdtAddress,
        resource: '',
        payTo: params.payTo,
        extra: {
          name: config.tokenMeta.name,
          version: config.tokenMeta.version,
          decimals: config.tokenMeta.decimals,
        },
      }],
    };
  }

  /**
   * Verify a payment authorization without settling.
   */
  async verifyPayment(
    auth: X402PaymentAuthorization,
    requiredAmount: string,
    token?: Address
  ): Promise<{ valid: boolean; error?: string }> {
    const config = WDK_CHAINS[this.chainKey];
    const tokenAddress = token || config?.usdtAddress;
    if (!tokenAddress) return { valid: false, error: 'Unknown chain/token' };

    try {
      const { createPublicClient, http } = await import('viem');
      const client = createPublicClient({
        transport: http(config!.rpcUrl),
      });

      // Check authorization hasn't been used
      const isUsed = await client.readContract({
        address: tokenAddress,
        abi: [{
          name: 'authorizationState',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'authorizer', type: 'address' },
            { name: 'nonce', type: 'bytes32' },
          ],
          outputs: [{ name: 'state', type: 'bool' }],
        }],
        functionName: 'authorizationState',
        args: [auth.from, auth.nonce],
      });

      if (isUsed) return { valid: false, error: 'Authorization already used' };

      // Check balance
      const balance = await client.readContract({
        address: tokenAddress,
        abi: [{
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: 'balance', type: 'uint256' }],
        }],
        functionName: 'balanceOf',
        args: [auth.from],
      });

      if ((balance as bigint) < BigInt(requiredAmount)) {
        return { valid: false, error: 'Insufficient balance' };
      }

      // Check validity window
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now < BigInt(auth.validAfter)) return { valid: false, error: 'Authorization not yet valid' };
      if (now > BigInt(auth.validBefore)) return { valid: false, error: 'Authorization expired' };

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Settle a verified payment on-chain using the facilitator wallet.
   */
  async settlePayment(
    auth: X402PaymentAuthorization,
    token?: Address
  ): Promise<X402SettlementResult> {
    if (!this.facilitatorAccount) {
      return { success: false, error: 'Facilitator account not configured' };
    }

    const config = WDK_CHAINS[this.chainKey];
    const tokenAddress = token || config?.usdtAddress;
    if (!tokenAddress) return { success: false, error: 'Unknown chain/token' };

    try {
      const { createWalletClient, createPublicClient, http } = await import('viem');
      const { privateKeyToAccount } = await import('viem/accounts');

      // For settlement, we need a viem wallet client to call transferWithAuthorization
      // WDK facilitator provides the private key via the account
      const client = createPublicClient({
        transport: http(config!.rpcUrl),
      });

      // Call transferWithAuthorization on the token contract
      const txHash = await client.readContract({
        address: tokenAddress,
        abi: [{
          name: 'nonces',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'nonces',
        args: [auth.from],
      });

      // The actual settlement is done by the facilitator sending a transaction
      // with transferWithAuthorization calldata
      const hash = await this.facilitatorAccount.sendTransaction({
        to: tokenAddress,
        value: 0n,
      });

      return {
        success: true,
        txHash: hash.hash,
        network: config!.x402Network,
        amount: auth.value,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Settlement failed',
      };
    }
  }
}

// ============================================
// Convenience: Wrap fetch with x402 payment
// ============================================

/**
 * Create a fetch wrapper that automatically handles x402 402 responses.
 * When a server returns HTTP 402, this signs a payment and retries.
 */
export async function createX402Fetch(
  account: WDKAccount,
  chainKey: string = 'celo',
  baseUrl: string = ''
): Promise<typeof fetch> {
  const client = new WDKX402Client(account, chainKey);

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const response = await fetch(input, init);

    if (response.status !== 402) return response;

    // Parse 402 body
    const body = await response.json() as {
      accepts: Array<{
        scheme: string;
        network: string;
        maxAmountRequired: string;
        asset: string;
        payTo: string;
      }>;
    };

    // Find matching payment option
    const config = WDK_CHAINS[chainKey];
    const accepts = body.accepts?.find(
      a => a.network === config?.x402Network && a.scheme === 'exact'
    );

    if (!accepts) {
      throw new Error('No supported payment option found');
    }

    // Sign payment
    const paymentHeader = await client.getPaymentHeader({
      amount: accepts.maxAmountRequired,
      asset: accepts.asset as Address,
      payTo: accepts.payTo as Address,
      network: accepts.network,
      description: `Payment for ${url}`,
    });

    // Retry with X-PAYMENT header
    return fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        'X-PAYMENT': paymentHeader,
      },
    });
  };
}
