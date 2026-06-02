// ============================================
// MetaMask Smart Account Integration
// ============================================
// Integrates MetaMask Smart Accounts Kit for delegatable
// smart contract accounts on Arbitrum.
//
// This replaces the WDK wallet layer. Users get MetaMask
// DeleGator smart accounts with delegation-based permissions
// that map to your existing DelegationRegistry.sol.
// ============================================

'use client';

import {
  toMetaMaskSmartAccount,
  createDelegation,
  signDelegation,
  getSmartAccountsEnvironment,
  type MetaMaskSmartAccount,
  type Delegation,
  type Caveats,
  type CreateDelegationOptions,
  Implementation,
} from '@metamask/smart-accounts-kit';

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Account,
  custom,
} from 'viem';

import { ACTIVE_CHAIN, ACTIVE_CHAIN_ID, RPC_URL } from './arbitrum-chain';

// ============================================
// Types
// ============================================

export interface MetaMaskSmartAccountSession {
  /** The MetaMask smart account instance */
  smartAccount: MetaMaskSmartAccount;
  /** The smart account address */
  address: Address;
  /** The chain */
  chain: Chain;
  /** Public client for reads */
  publicClient: PublicClient;
  /** Sign a delegation for an agent */
  signAgentDelegation: (params: {
    agentAddress: Address;
    maxAmount: bigint;
    durationSeconds: number;
    allowedActions: string[];
  }) => Promise<{ delegation: Delegation; signature: Hex }>;
  /** Redeem a delegation (execute via agent) */
  redeemDelegation: (delegation: Delegation, signature: Hex) => Promise<Hex>;
  /** Dispose the session */
  dispose: () => void;
}

export interface AgentDelegationParams {
  /** The agent's address being delegated to */
  agentAddress: Address;
  /** Maximum spend amount in USDC (6 decimals) */
  maxAmount: bigint;
  /** Duration in seconds */
  durationSeconds: number;
  /** Action types the agent can perform */
  allowedActions: string[];
}

// ============================================
// MetaMask Smart Account Manager
// ============================================

/**
 * Create a MetaMask Smart Account session from an EOA signer.
 *
 * In production, this is called after the user connects their wallet
 * via Web3Modal/MetaMask. The connected EOA becomes the owner of the
 * smart account.
 *
 * Two paths:
 * 1. If user already has a smart account, use `address` param
 * 2. If deploying new, use `deploySalt` param (generates counterfactual address)
 */
export async function createSmartAccountSession(params: {
  /** The EOA wallet client (from connected wallet) */
  walletClient: WalletClient<Transport, Chain, Account>;
  /** Optional: existing smart account address */
  address?: Address;
  /** Optional: salt for new deployment */
  deploySalt?: Hex;
}): Promise<MetaMaskSmartAccountSession> {
  const publicClient = createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: http(RPC_URL),
  });

  // Get the pre-deployed MetaMask delegation environment for Arbitrum
  const environment = getSmartAccountsEnvironment(ACTIVE_CHAIN_ID);

  // Create the smart account
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid, // Hybrid: single-signer with delegation support
    signer: {
      walletClient: params.walletClient,
    },
    ...(params.address
      ? { address: params.address }
      : { deploySalt: params.deploySalt || ('0x' + '0'.repeat(64)) as Hex }),
    environment,
  });

  const session: MetaMaskSmartAccountSession = {
    smartAccount,
    address: smartAccount.address,
    chain: ACTIVE_CHAIN,
    publicClient,

    /**
     * Sign a delegation granting an agent permission to spend on the user's behalf.
     * This maps to your existing DelegationRegistry.sol scopes.
     */
    async signAgentDelegation(params) {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const validUntil = now + BigInt(params.durationSeconds);

      // Build caveats that constrain the delegation
      const caveats: Caveats = [];

      // Restrict to specific agent as beneficiary
      // (ANY_BENEFICIARY would allow anyone to redeem)
      caveats.push({
        type: 'allowedBeneficiary',
        value: params.agentAddress,
      } as any);

      // Limit spend amount
      caveats.push({
        type: 'erc20TransferAmount',
        value: {
          token: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
          amount: params.maxAmount,
        },
      } as any);

      // Limit time window
      caveats.push({
        type: 'transferWindow',
        value: {
          validFrom: now,
          validUntil,
        },
      } as any);

      // Create the delegation
      const delegation = createDelegation({
        environment,
        from: smartAccount.address,
        to: params.agentAddress,
        caveats,
      } as CreateDelegationOptions);

      // Sign the delegation with the smart account
      const signature = await smartAccount.signDelegation({
        delegation,
        chainId: ACTIVE_CHAIN_ID,
      });

      return { delegation, signature };
    },

    /**
     * Redeem a delegation — called by the agent to execute a transaction
     * on behalf of the user through the smart account.
     */
    async redeemDelegation(_delegation: Delegation, _signature: Hex): Promise<Hex> {
      // In production, this would use the erc7710RedeemDelegation action
      // from @metamask/smart-accounts-kit/actions
      throw new Error('redeemDelegation: use @metamask/smart-accounts-kit/actions erc7710RedeemDelegation');
    },

    dispose() {
      // Nothing to dispose — smart accounts are stateless on the client
    },
  };

  return session;
}

// ============================================
// Convenience: Create from browser wallet (MetaMask EIP-1193)
// ============================================

/**
 * Create a smart account session from the browser's injected wallet
 * (window.ethereum / MetaMask extension).
 */
export async function createSmartAccountFromBrowser(): Promise<MetaMaskSmartAccountSession | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    console.warn('[MetaMask SA] No browser wallet found');
    return null;
  }

  const eth = window.ethereum as unknown as {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
  };

  // Get the connected EOA
  const accounts: string[] = await eth.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    console.warn('[MetaMask SA] No connected account');
    return null;
  }

  // Create a wallet client from the browser provider
  // Note: the account is auto-derived from the connected wallet via eth_accounts
  const walletClient = createWalletClient({
    chain: ACTIVE_CHAIN,
    transport: custom(window.ethereum as any),
    account: accounts[0] as Address,
  });

  return createSmartAccountSession({ walletClient });
}

// ============================================
// x402 Payment Signer (MetaMask Smart Account)
// ============================================

/**
 * Sign an x402 payment authorization using the MetaMask smart account.
 * Replaces the WDKX402Client.signPayment() flow.
 */
export async function signX402PaymentWithSmartAccount(
  session: MetaMaskSmartAccountSession,
  params: {
    amount: bigint;
    payTo: Address;
    token: Address;
    description: string;
  }
): Promise<{
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
  signature: Hex;
}> {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const validAfter = now;
  const validBefore = now + BigInt(3600); // 1 hour
  const nonce = generateNonce();

  // Build the EIP-712 transferWithAuthorization message
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: ACTIVE_CHAIN_ID,
    verifyingContract: params.token,
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
    from: session.address,
    to: params.payTo,
    value: params.amount,
    validAfter,
    validBefore,
    nonce,
  };

  // Sign via the smart account
  const signature = await session.smartAccount.signTypedData({
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message,
  });

  return {
    from: session.address,
    to: params.payTo,
    value: params.amount.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
    signature,
  };
}

// ============================================
// Helpers
// ============================================

function generateNonce(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

// ============================================
// Agent Delegation Registry (maps to your existing system)
// ============================================

/**
 * Map your existing DelegationRegistry.sol scopes to
 * MetaMask Smart Account delegation caveats.
 *
 * The existing scopes are:
 *   canBook, canOrder, canSchedule, canResearch, maxSpend
 *
 * These map to MetaMask caveats:
 *   - allowedBeneficiary: restricts to the agent
 *   - erc20TransferAmount: limits spend
 *   - allowedTargets: restricts which contracts the agent can call
 *   - transferWindow: time-bound validity
 */
export function mapAgentScopeToCaveats(params: {
  agentAddress: Address;
  maxSpend: bigint;
  durationSeconds: number;
  allowedTargets?: Address[];
}): Caveats {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const validUntil = now + BigInt(params.durationSeconds);

  const caveats: Caveats = [
    {
      type: 'allowedBeneficiary',
      value: params.agentAddress,
    } as any,
    {
      type: 'erc20TransferAmount',
      value: {
        token: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
        amount: params.maxSpend,
      },
    } as any,
    {
      type: 'transferWindow',
      value: {
        validFrom: now,
        validUntil,
      },
    } as any,
  ];

  // If specific targets are specified, restrict which contracts
  // the agent can interact with
  if (params.allowedTargets && params.allowedTargets.length > 0) {
    caveats.push({
      type: 'allowedTargets',
      value: params.allowedTargets,
    } as any);
  }

  return caveats;
}