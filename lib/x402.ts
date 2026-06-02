import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
import { ACTIVE_USDC, EXPLORER_URL } from './arbitrum-chain';

// Arbitrum USDC (native)
const USDC_TOKEN = ACTIVE_USDC;

export interface PaymentRequirements {
  scheme: 'exact' | 'upto';
  network: 'arbitrum';
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  description: string;
  mimeType: string;
}

export interface PaymentAuth {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
}

export class X402Payments {
  private rpcUrl: string;
  private receiver: string;

  constructor(rpcUrl: string, receiver: string) {
    this.rpcUrl = rpcUrl;
    this.receiver = receiver;
  }

  /**
   * Calculate cost for N minutes
   */
  cost(minutes: number, ratePerMinuteCents: number): bigint {
    return BigInt(minutes * ratePerMinuteCents * 100);
  }

  /**
   * Create payment requirements
   */
  requirements(
    callId: string,
    amount: bigint,
    description: string
  ): PaymentRequirements {
    return {
      scheme: 'exact',
      network: 'arbitrum',
      maxAmountRequired: amount.toString(),
      payTo: this.receiver,
      asset: USDC_TOKEN,
      description,
      mimeType: 'application/json',
    };
  }

  /**
   * Sign EIP-712 authorization
   */
  async sign(
    wallet: { address: string; signMessage: (msg: unknown) => Promise<string> },
    requirements: PaymentRequirements
  ): Promise<PaymentAuth> {
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
    
    const auth = {
      from: wallet.address,
      to: requirements.payTo,
      value: requirements.maxAmountRequired,
      validAfter: '0',
      validBefore: validBefore.toString(),
      nonce: this.nonce(),
    };

    // Sign as EIP-712 structured data
    const signature = await wallet.signMessage({
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: 42161,
        verifyingContract: requirements.asset as `0x${string}`,
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      message: auth,
    });

    return { ...auth, signature };
  }

  private nonce(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export function createX402(rpcUrl: string, receiver: string): X402Payments {
  return new X402Payments(rpcUrl, receiver);
}
