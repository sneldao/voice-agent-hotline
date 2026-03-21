// ============================================
// ERC-8004 Agent Delegation Protocol Integration
// ============================================
// Uses viem to interact with ERC-8004 contracts on Celo mainnet
// Reference: https://eips.ethereum.org/EIPS/eip-8004

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Hash
} from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

// ============================================
// Configuration
// ============================================
const CELO_MAINNET = {
  ...celo,
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
    public: { http: ['https://forno.celo.org'] },
  },
};

const CELO_TESTNET = {
  ...celoAlfajores,
  rpcUrls: {
    default: { http: ['https://alfajores-forno.celo-testnet.org'] },
    public: { http: ['https://alfajores-forno.celo-testnet.org'] },
  },
};

const ACTIVE_CHAIN = process.env.NODE_ENV === 'production' ? CELO_MAINNET : CELO_TESTNET;

// ERC-8004 Contract Addresses - MUST be configured for production
function getContractAddresses(): {
  identity: Address;
  reputation: Address;
  delegation: Address;
} {
  const identity = process.env.NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS as Address;
  const reputation = process.env.NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS as Address;
  const delegation = process.env.NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS as Address;

  if (!identity || identity === '0x0000000000000000000000000000000000000000') {
    throw new Error('NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS must be configured');
  }
  if (!reputation || reputation === '0x0000000000000000000000000000000000000000') {
    throw new Error('NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS must be configured');
  }
  if (!delegation || delegation === '0x0000000000000000000000000000000000000000') {
    throw new Error('NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS must be configured');
  }

  return { identity, reputation, delegation };
}

// Celo Token Addresses
const CELO_TOKENS = {
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  CELO: '0x471EcE3750Da237f93B8E339c536898b6AEDf5c7',
};

// ============================================
// Types
// ============================================

// Agent registration data
export interface AgentRegistration {
  tokenId: bigint;
  owner: string;
  agentURI: string;
  timestamp: bigint;
  isVerified: boolean;
  ratePerMinute: bigint;
  specialties: string[];
}

// Delegation scope
export interface DelegationScope {
  canBook: boolean;        // Book appointments/services
  canOrder: boolean;       // Place orders/purchases
  canSchedule: boolean;   // Schedule events/reminders
  canResearch: boolean;    // Perform research tasks
  maxSpend: bigint;        // Maximum spending limit per action
  expiresAt: bigint;       // Expiration timestamp
}

// Delegation record
export interface Delegation {
  delegationId: Hash;
  delegator: Address;
  delegate: Address;
  scope: DelegationScope;
  createdAt: bigint;
  revokedAt: bigint;
  isActive: boolean;
}

// Reputation data
export interface ReputationData {
  agentId: bigint;
  averageRating: number;
  totalRatings: bigint;
  ratingDistribution: [bigint, bigint, bigint, bigint, bigint]; // 1-5 stars
}

// ============================================
// ERC-8004 Contract ABIs (Minimal)
// ============================================

const ERC8004_IDENTITY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentURI', type: 'string' },
      { name: 'ratePerMinute', type: 'uint256' },
      { name: 'specialties', type: 'string[]' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'getAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'agentURI', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'isVerified', type: 'bool' },
      { name: 'ratePerMinute', type: 'uint256' },
    ],
  },
  {
    name: 'verifyAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'setRate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'ratePerMinute', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const;

const ERC8004_DELEGATION_ABI = [
  {
    name: 'createDelegation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'delegate', type: 'address' },
      { name: 'scope', type: 'tuple(bool canBook, bool canOrder, bool canSchedule, bool canResearch, uint256 maxSpend, uint256 expiresAt)' },
    ],
    outputs: [{ name: 'delegationId', type: 'bytes32' }],
  },
  {
    name: 'verifyDelegation',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'delegationId', type: 'bytes32' },
      { name: 'action', type: 'string' },
    ],
    outputs: [{ name: 'isValid', type: 'bool' }],
  },
  {
    name: 'revokeDelegation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'delegationId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getDelegation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'delegationId', type: 'bytes32' }],
    outputs: [
      { name: 'delegator', type: 'address' },
      { name: 'delegate', type: 'address' },
      { name: 'scope', type: 'tuple(bool canBook, bool canOrder, bool canSchedule, bool canResearch, uint256 maxSpend, uint256 expiresAt)' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'revokedAt', type: 'uint256' },
    ],
  },
  {
    name: 'getActiveDelegations',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'delegator', type: 'address' }],
    outputs: [{ name: 'delegationIds', type: 'bytes32[]' }],
  },
] as const;

const ERC8004_REPUTATION_ABI = [
  {
    name: 'submitFeedback',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'rating', type: 'uint8' },
      { name: 'tag', type: 'string' },
      { name: 'comment', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'getReputation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'averageRating', type: 'uint256' },
      { name: 'totalRatings', type: 'uint256' },
      { name: 'distribution', type: 'uint256[5]' },
    ],
  },
] as const;

// ============================================
// Public Client Factory
// ============================================
function getPublicClient() {
  return createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: http(),
  });
}

// ============================================
// ERC-8004 Service Class
// ============================================
export class ERC8004Service {
  private publicClient: any;
  private delegationAddress: Address;
  private identityAddress: Address;
  private reputationAddress: Address;
  private isConfigured: boolean;

  constructor() {
    this.publicClient = getPublicClient();
    this.isConfigured = false;

    try {
      const addresses = getContractAddresses();
      this.delegationAddress = addresses.delegation;
      this.identityAddress = addresses.identity;
      this.reputationAddress = addresses.reputation;
      this.isConfigured = true;
    } catch (error) {
      console.warn('[ERC-8004] Contracts not configured:', error);
      this.delegationAddress = '0x0000000000000000000000000000000000000000';
      this.identityAddress = '0x0000000000000000000000000000000000000000';
      this.reputationAddress = '0x0000000000000000000000000000000000000000';
    }
  }

  /**
   * Check if ERC-8004 contracts are properly configured
   */
  checkConfiguration(): { configured: boolean; missingContracts?: string[] } {
    if (this.isConfigured) {
      return { configured: true };
    }

    const missing: string[] = [];
    if (!process.env.NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS) {
      missing.push('IDENTITY');
    }
    if (!process.env.NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS) {
      missing.push('REPUTATION');
    }
    if (!process.env.NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS) {
      missing.push('DELEGATION');
    }

    return { configured: false, missingContracts: missing };
  }

  // ========================================
  // Agent Registration
  // ========================================

  /**
   * Register a new agent on ERC-8004 Identity contract
   */
  async registerAgent(
    walletClient: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> },
    agentURI: string,
    ratePerMinuteWei: bigint,
    specialties: string[]
  ): Promise<{ success: boolean; tokenId?: bigint; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: this.identityAddress,
        abi: ERC8004_IDENTITY_ABI,
        functionName: 'registerAgent',
        args: [agentURI, ratePerMinuteWei, specialties] as any[],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      // Parse logs to get tokenId (simplified - in production use proper log parsing)
      const tokenId = BigInt(receipt.logs.length); // Placeholder

      return { success: true, tokenId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  /**
   * Get agent details by token ID
   */
  async getAgent(tokenId: bigint): Promise<AgentRegistration | null> {
    try {
      const result = await this.publicClient.readContract({
        address: this.identityAddress,
        abi: ERC8004_IDENTITY_ABI,
        functionName: 'getAgent',
        args: [tokenId] as any[],
      });

      const [owner, agentURI, timestamp, isVerified, ratePerMinute] = result;

      return {
        tokenId,
        owner,
        agentURI,
        timestamp,
        isVerified,
        ratePerMinute,
        specialties: [], // Would need additional call to get specialties
      };
    } catch {
      return null;
    }
  }

  /**
   * Verify an agent (requires verification role)
   */
  async verifyAgent(
    walletClient: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> },
    tokenId: bigint
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: this.identityAddress,
        abi: ERC8004_IDENTITY_ABI,
        functionName: 'verifyAgent',
        args: [tokenId] as any[],
      });

      await this.publicClient.waitForTransactionReceipt({ hash });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  // ========================================
  // Delegation Management
  // ========================================

  /**
   * Create a new delegation for an agent
   */
  async createDelegation(
    walletClient: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> },
    delegate: Address,
    scope: DelegationScope
  ): Promise<{ success: boolean; delegationId?: Hash; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: this.delegationAddress,
        abi: ERC8004_DELEGATION_ABI,
        functionName: 'createDelegation',
        args: [delegate, scope] as any[],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      // Generate deterministic delegation ID
      const delegationId = receipt.transactionHash as Hash;

      return { success: true, delegationId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delegation creation failed'
      };
    }
  }

  /**
   * Verify if a delegation is valid for a specific action.
   *
   * Fix: the on-chain `verifyDelegation(bytes32, string)→bool` is the fast path.
   * We only call `getDelegation` when we need scope details (expiry check, scope return).
   */
  async verifyDelegation(
    delegationId: Hash,
    action: 'book' | 'order' | 'schedule' | 'research'
  ): Promise<{ valid: boolean; scope?: DelegationScope; error?: string }> {
    // Check if contracts are configured
    if (!this.isConfigured) {
      return {
        valid: false,
        error: 'ERC-8004 contracts not configured. Please set NEXT_PUBLIC_ERC8004_*_ADDRESS environment variables.',
      };
    }

    try {
      // Step 1 – fast boolean check via the contract's own verifyDelegation function
      const isPermitted = await this.publicClient.readContract({
        address: this.delegationAddress,
        abi: ERC8004_DELEGATION_ABI,
        functionName: 'verifyDelegation',
        args: [delegationId, action] as any[],
      }) as boolean;

      if (!isPermitted) {
        return { valid: false, error: `Action '${action}' not permitted by delegation` };
      }

      // Step 2 – fetch full scope to return to caller and check expiry
      const [, , scopeData] = await this.publicClient.readContract({
        address: this.delegationAddress,
        abi: ERC8004_DELEGATION_ABI,
        functionName: 'getDelegation',
        args: [delegationId] as any[],
      }) as [Address, Address, DelegationScope, bigint, bigint];

      const scope: DelegationScope = {
        canBook: scopeData.canBook,
        canOrder: scopeData.canOrder,
        canSchedule: scopeData.canSchedule,
        canResearch: scopeData.canResearch,
        maxSpend: scopeData.maxSpend,
        expiresAt: scopeData.expiresAt,
      };

      if (scope.expiresAt < BigInt(Math.floor(Date.now() / 1000))) {
        return { valid: false, scope, error: 'Delegation has expired' };
      }

      return { valid: true, scope };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Revoke a delegation
   */
  async revokeDelegation(
    walletClient: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> },
    delegationId: Hash
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: this.delegationAddress,
        abi: ERC8004_DELEGATION_ABI,
        functionName: 'revokeDelegation',
        args: [delegationId] as any[],
      });

      await this.publicClient.waitForTransactionReceipt({ hash });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Revocation failed'
      };
    }
  }

  /**
   * Get all active delegations for a delegator
   */
  async getActiveDelegations(delegator: Address): Promise<Hash[]> {
    try {
      const delegationIds = await this.publicClient.readContract({
        address: this.delegationAddress,
        abi: ERC8004_DELEGATION_ABI,
        functionName: 'getActiveDelegations',
        args: [delegator] as any[],
      });

      return delegationIds;
    } catch {
      return [];
    }
  }

  // ========================================
  // Reputation Management
  // ========================================

  /**
   * Submit feedback for an agent
   */
  async submitFeedback(
    walletClient: { account: { address: Address }; writeContract: (args: any) => Promise<Hash> },
    agentId: bigint,
    rating: number, // 1-5
    tag: string,
    comment?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: this.reputationAddress,
        abi: ERC8004_REPUTATION_ABI,
        functionName: 'submitFeedback',
        args: [agentId, BigInt(rating), tag, comment || ''] as any[],
      });

      await this.publicClient.waitForTransactionReceipt({ hash });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Feedback submission failed'
      };
    }
  }

  /**
   * Get reputation data for an agent
   */
  async getReputation(agentId: bigint): Promise<ReputationData | null> {
    try {
      const result = await this.publicClient.readContract({
        address: this.reputationAddress,
        abi: ERC8004_REPUTATION_ABI,
        functionName: 'getReputation',
        args: [agentId] as any[],
      });

      const [averageRating, totalRatings, distribution] = result;

      return {
        agentId,
        averageRating: Number(averageRating) / 10, // Assuming 1 decimal precision
        totalRatings,
        ratingDistribution: distribution,
      };
    } catch {
      return null;
    }
  }
}

// ============================================
// Singleton Instance
// ============================================
export const erc8004Service = new ERC8004Service();

// ============================================
// Helper Functions
// ============================================

/**
 * Create a wallet client for ERC-8004 operations
 */
export function createERC8004WalletClient(privateKey: Address) {
  return createWalletClient({
    chain: ACTIVE_CHAIN,
    transport: http(),
    account: privateKey,
  });
}

/**
 * Convert dollars to wei (for rate calculations)
 */
export function dollarsToWei(dollars: number): bigint {
  return parseEther(dollars.toString());
}

/**
 * Convert wei to dollars (for display)
 */
export function weiToDollars(wei: bigint): string {
  return formatEther(wei);
}

/**
 * Convert minutes to rate (wei per minute)
 */
export function ratePerMinuteToWei(rateCentsPerMinute: number): bigint {
  // rateCentsPerMinute * 1e16 = wei (assuming 2 decimals for cents, 18 for wei)
  return BigInt(Math.floor(rateCentsPerMinute * 1e14));
}

/**
 * Check if Celo network is available
 */
export async function checkCeloConnection(): Promise<boolean> {
  const client = getPublicClient();
  try {
    await client.getBlockNumber();
    return true;
  } catch {
    return false;
  }
}
