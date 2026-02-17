// ============================================
// Agent Reputation & Economic Security System
// ============================================
// Staking, slashing, and reputation mechanism
// to ensure agent quality and user protection

import { redis } from './redis';
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
import { privateKeyToAccount } from 'viem/accounts';

// ============================================
// Configuration
// ============================================
const ACTIVE_CHAIN = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;
const RPC_URL = process.env.CELO_RPC_URL || 'https://forno.celo.org';

// Minimum stake required (in CELO)
const MIN_STAKE_AMOUNT = parseEther('100'); // 100 CELO
const MAX_STAKE_AMOUNT = parseEther('10000'); // 10,000 CELO

// Dispute settings
const DISPUTE_WINDOW_DAYS = 7;
const SLASH_PERCENTAGE = 50; // 50% of stake slashed on lost dispute
const PLATFORM_FEE_PERCENT = 10;

// Reputation weights
const WEIGHT_STAKE = 0.30;
const WEIGHT_RATING = 0.40;
const WEIGHT_COMPLETION = 0.20;
const WEIGHT_AGE = 0.10;

// ============================================
// Types
// ============================================
export interface StakeInfo {
  agentId: string;
  amount: bigint;
  stakedAt: number;
  unlockTime: number;
  status: 'active' | 'unstaking' | 'withdrawn';
}

export interface Dispute {
  id: string;
  callId: string;
  agentId: string;
  complainant: Address;
  reason: DisputeReason;
  description: string;
  evidence: string[];
  status: 'open' | 'under_review' | 'resolved_agent' | 'resolved_complainant';
  createdAt: number;
  resolvedAt?: number;
  resolution?: string;
  slashAmount?: bigint;
  refundAmount?: bigint;
}

export type DisputeReason = 
  | 'no_show'
  | 'wrong_info'
  | 'rude_behavior'
  | 'scam'
  | 'technical_issues'
  | 'other';

export interface ReputationScore {
  agentId: string;
  overall: number; // 0-100
  components: {
    stake: number;
    rating: number;
    completion: number;
    age: number;
  };
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  updatedAt: number;
}

export interface AgentStats {
  agentId: string;
  totalCalls: number;
  completedCalls: number;
  disputedCalls: number;
  averageRating: number;
  totalRevenue: bigint;
  totalStaked: bigint;
  joinedAt: number;
}

// ============================================
// Reputation & Staking Service
// ============================================
export class ReputationStakingService {
  private publicClient: any;
  private arbitratorWallet?: any;

  constructor() {
    this.publicClient = createPublicClient({
      chain: ACTIVE_CHAIN as any,
      transport: http(RPC_URL),
    });

    // Initialize arbitrator wallet
    const arbitratorKey = process.env.ARBITRATOR_PRIVATE_KEY;
    if (arbitratorKey) {
      const account = privateKeyToAccount(arbitratorKey as `0x${string}`);
      this.arbitratorWallet = createWalletClient({
        account,
        chain: ACTIVE_CHAIN as any,
        transport: http(RPC_URL),
      });
    }
  }

  /**
   * Stake CELO as an agent
   */
  async stake(
    agentId: string,
    walletAddress: Address,
    amount: bigint
  ): Promise<{ success: boolean; txHash?: Hash; error?: string }> {
    try {
      // Validate amount
      if (amount < MIN_STAKE_AMOUNT) {
        return {
          success: false,
          error: `Minimum stake is ${formatEther(MIN_STAKE_AMOUNT)} CELO`,
        };
      }
      if (amount > MAX_STAKE_AMOUNT) {
        return {
          success: false,
          error: `Maximum stake is ${formatEther(MAX_STAKE_AMOUNT)} CELO`,
        };
      }

      // In production, this would interact with a staking smart contract
      // For now, we record the stake in Redis
      const stake: StakeInfo = {
        agentId,
        amount,
        stakedAt: Date.now(),
        unlockTime: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 day lock
        status: 'active',
      };

      await redis.hset(`stake:${agentId}`, this.serializeStake(stake));

      // Update agent reputation
      await this.recalculateReputation(agentId);

      console.log('[Reputation] Stake recorded:', {
        agentId,
        amount: formatEther(amount),
        wallet: walletAddress,
      });

      return {
        success: true,
        txHash: ('0x' + '0'.repeat(64)) as `0x${string}`, // Would be real tx hash
      };

    } catch (error: any) {
      console.error('[Reputation] Stake error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Request unstake (starts cooldown period)
   */
  async requestUnstake(agentId: string): Promise<{ success: boolean; error?: string }> {
    const stake = await this.getStake(agentId);
    if (!stake) {
      return { success: false, error: 'No active stake found' };
    }

    if (stake.status !== 'active') {
      return { success: false, error: 'Stake is not active' };
    }

    // Check for open disputes
    const openDisputes = await this.getOpenDisputes(agentId);
    if (openDisputes.length > 0) {
      return { 
        success: false, 
        error: `Cannot unstake with ${openDisputes.length} open disputes` 
      };
    }

    stake.status = 'unstaking';
    stake.unlockTime = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 day cooldown

    await redis.hset(`stake:${agentId}`, this.serializeStake(stake));

    return { success: true };
  }

  /**
   * Withdraw stake after cooldown
   */
  async withdrawStake(agentId: string): Promise<{ success: boolean; error?: string }> {
    const stake = await this.getStake(agentId);
    if (!stake) {
      return { success: false, error: 'No stake found' };
    }

    if (stake.status !== 'unstaking') {
      return { success: false, error: 'Stake not in unstaking status' };
    }

    if (Date.now() < stake.unlockTime) {
      const daysLeft = Math.ceil((stake.unlockTime - Date.now()) / (24 * 60 * 60 * 1000));
      return { success: false, error: `${daysLeft} days remaining in cooldown` };
    }

    stake.status = 'withdrawn';
    await redis.hset(`stake:${agentId}`, this.serializeStake(stake));

    // Update reputation
    await this.recalculateReputation(agentId);

    return { success: true };
  }

  /**
   * Get stake info
   */
  async getStake(agentId: string): Promise<StakeInfo | null> {
    const data = await redis.hgetall(`stake:${agentId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return this.deserializeStake(data as Record<string, string>);
  }

  /**
   * File a dispute against an agent
   */
  async fileDispute(
    callId: string,
    agentId: string,
    complainant: Address,
    reason: DisputeReason,
    description: string,
    evidence: string[] = []
  ): Promise<{ success: boolean; disputeId?: string; error?: string }> {
    try {
      // Check if call exists and is recent
      const call = await redis.hgetall(`call:${callId}`);
      if (!call) {
        return { success: false, error: 'Call not found' };
      }

      const callTime = parseInt((call.timestamp as string) || '0');
      const disputeWindow = DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      
      if (Date.now() - callTime > disputeWindow) {
        return { 
          success: false, 
          error: `Dispute window closed (${DISPUTE_WINDOW_DAYS} days)` 
        };
      }

      // Check for existing dispute
      const existingDispute = await this.getDisputeByCall(callId);
      if (existingDispute) {
        return { success: false, error: 'Dispute already filed for this call' };
      }

      const disputeId = `disp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const dispute: Dispute = {
        id: disputeId,
        callId,
        agentId,
        complainant,
        reason,
        description,
        evidence,
        status: 'open',
        createdAt: Date.now(),
      };

      await redis.hset(`dispute:${disputeId}`, this.serializeDispute(dispute));
      await redis.set(`dispute:call:${callId}`, disputeId);

      // Add to agent's disputes
      await redis.sadd(`agent:${agentId}:disputes`, disputeId);

      console.log('[Reputation] Dispute filed:', {
        disputeId,
        agentId,
        reason,
        complainant,
      });

      return { success: true, disputeId };

    } catch (error: any) {
      console.error('[Reputation] File dispute error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resolve a dispute (arbitrator only)
   */
  async resolveDispute(
    disputeId: string,
    inFavorOfComplainant: boolean,
    resolution: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.arbitratorWallet) {
      return { success: false, error: 'Arbitrator not configured' };
    }

    const dispute = await this.getDispute(disputeId);
    if (!dispute) {
      return { success: false, error: 'Dispute not found' };
    }

    if (dispute.status !== 'open') {
      return { success: false, error: 'Dispute already resolved' };
    }

    const stake = await this.getStake(dispute.agentId);

    if (inFavorOfComplainant) {
      // Agent loses - slash stake
      const slashAmount = stake 
        ? (stake.amount * BigInt(SLASH_PERCENTAGE)) / BigInt(100)
        : 0n;

      // Get call details for refund
      const call = await redis.hgetall(`call:${dispute.callId}`);
      const refundAmount = call?.amount 
        ? BigInt(Math.floor(parseFloat(call.amount as string) * 1e18))
        : 0n;

      dispute.status = 'resolved_complainant';
      dispute.slashAmount = slashAmount;
      dispute.refundAmount = refundAmount;

      // In production: execute slash on-chain
      // Transfer refund to complainant
      // Transfer slash to platform or burn

      console.log('[Reputation] Dispute resolved for complainant:', {
        disputeId,
        slashAmount: formatEther(slashAmount),
        refundAmount: formatEther(refundAmount),
      });

    } else {
      // Agent wins - no slash
      dispute.status = 'resolved_agent';

      console.log('[Reputation] Dispute resolved for agent:', {
        disputeId,
        agentId: dispute.agentId,
      });
    }

    dispute.resolvedAt = Date.now();
    dispute.resolution = resolution;

    await redis.hset(`dispute:${disputeId}`, this.serializeDispute(dispute));

    // Recalculate reputation
    await this.recalculateReputation(dispute.agentId);

    return { success: true };
  }

  /**
   * Get dispute by ID
   */
  async getDispute(disputeId: string): Promise<Dispute | null> {
    const data = await redis.hgetall(`dispute:${disputeId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return this.deserializeDispute(data as Record<string, string>);
  }

  /**
   * Get dispute by call ID
   */
  async getDisputeByCall(callId: string): Promise<Dispute | null> {
    const disputeId = await redis.get(`dispute:call:${callId}`);
    if (!disputeId) return null;
    return this.getDispute(disputeId as string);
  }

  /**
   * Get open disputes for an agent
   */
  async getOpenDisputes(agentId: string): Promise<Dispute[]> {
    const disputeIds = await redis.smembers(`agent:${agentId}:disputes`);
    const disputes: Dispute[] = [];

    for (const id of disputeIds) {
      const dispute = await this.getDispute(id);
      if (dispute && dispute.status === 'open') {
        disputes.push(dispute);
      }
    }

    return disputes;
  }

  /**
   * Calculate and store reputation score
   */
  async recalculateReputation(agentId: string): Promise<ReputationScore> {
    const stats = await this.getAgentStats(agentId);
    const stake = await this.getStake(agentId);

    // Calculate component scores (0-100)
    
    // Stake score (more stake = higher score, capped)
    const stakeScore = stake?.status === 'active'
      ? Math.min(100, Number((stake.amount * BigInt(100)) / MAX_STAKE_AMOUNT))
      : 0;

    // Rating score (average rating * 20 to get 0-100)
    const ratingScore = stats.averageRating * 20;

    // Completion score (completed / total * 100)
    const completionScore = stats.totalCalls > 0
      ? (stats.completedCalls / stats.totalCalls) * 100
      : 0;

    // Age score (longer on platform = higher score, capped at 1 year)
    const ageDays = (Date.now() - stats.joinedAt) / (24 * 60 * 60 * 1000);
    const ageScore = Math.min(100, (ageDays / 365) * 100);

    // Weighted overall score
    const overall = Math.round(
      stakeScore * WEIGHT_STAKE +
      ratingScore * WEIGHT_RATING +
      completionScore * WEIGHT_COMPLETION +
      ageScore * WEIGHT_AGE
    );

    // Determine tier
    let tier: ReputationScore['tier'] = 'bronze';
    if (overall >= 90) tier = 'diamond';
    else if (overall >= 80) tier = 'platinum';
    else if (overall >= 65) tier = 'gold';
    else if (overall >= 50) tier = 'silver';

    const reputation: ReputationScore = {
      agentId,
      overall,
      components: {
        stake: Math.round(stakeScore),
        rating: Math.round(ratingScore),
        completion: Math.round(completionScore),
        age: Math.round(ageScore),
      },
      tier,
      updatedAt: Date.now(),
    };

    await redis.hset(`reputation:${agentId}`, this.serializeReputation(reputation));

    console.log('[Reputation] Score updated:', {
      agentId,
      overall,
      tier,
    });

    return reputation;
  }

  /**
   * Get reputation score
   */
  async getReputation(agentId: string): Promise<ReputationScore | null> {
    const data = await redis.hgetall(`reputation:${agentId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return this.deserializeReputation(data as Record<string, string>);
  }

  /**
   * Get agent stats
   */
  async getAgentStats(agentId: string): Promise<AgentStats> {
    const agent = await redis.hgetall(`agent:${agentId}`);
    
    const disputes = await this.getOpenDisputes(agentId);
    const stake = await this.getStake(agentId);

    return {
      agentId,
      totalCalls: parseInt((agent?.totalCalls as string) || '0'),
      completedCalls: parseInt((agent?.completedCalls as string) || '0'),
      disputedCalls: disputes.length,
      averageRating: parseFloat((agent?.rating as string) || '0'),
      totalRevenue: parseEther((agent?.totalRevenue as string) || '0'),
      totalStaked: stake?.amount || 0n,
      joinedAt: parseInt((agent?.createdAt as string) || Date.now().toString()),
    };
  }

  /**
   * Get leaderboard (top agents by reputation)
   */
  async getLeaderboard(limit: number = 10): Promise<ReputationScore[]> {
    const keys = await redis.keys('reputation:*');
    const scores: ReputationScore[] = [];

    for (const key of keys) {
      const data = await redis.hgetall(key);
      if (data) {
        scores.push(this.deserializeReputation(data as Record<string, string>));
      }
    }

    // Sort by overall score
    scores.sort((a, b) => b.overall - a.overall);

    return scores.slice(0, limit);
  }

  // ============================================
  // Serialization
  // ============================================
  private serializeStake(stake: StakeInfo): Record<string, string> {
    return {
      agentId: stake.agentId,
      amount: stake.amount.toString(),
      stakedAt: stake.stakedAt.toString(),
      unlockTime: stake.unlockTime.toString(),
      status: stake.status,
    };
  }

  private deserializeStake(data: Record<string, string>): StakeInfo {
    return {
      agentId: data.agentId,
      amount: BigInt(data.amount),
      stakedAt: parseInt(data.stakedAt),
      unlockTime: parseInt(data.unlockTime),
      status: data.status as StakeInfo['status'],
    };
  }

  private serializeDispute(dispute: Dispute): Record<string, string> {
    return {
      id: dispute.id,
      callId: dispute.callId,
      agentId: dispute.agentId,
      complainant: dispute.complainant,
      reason: dispute.reason,
      description: dispute.description,
      evidence: JSON.stringify(dispute.evidence),
      status: dispute.status,
      createdAt: dispute.createdAt.toString(),
      resolvedAt: dispute.resolvedAt?.toString() || '',
      resolution: dispute.resolution || '',
      slashAmount: dispute.slashAmount?.toString() || '',
      refundAmount: dispute.refundAmount?.toString() || '',
    };
  }

  private deserializeDispute(data: Record<string, string>): Dispute {
    return {
      id: data.id,
      callId: data.callId,
      agentId: data.agentId,
      complainant: data.complainant as Address,
      reason: data.reason as DisputeReason,
      description: data.description,
      evidence: JSON.parse(data.evidence || '[]'),
      status: data.status as Dispute['status'],
      createdAt: parseInt(data.createdAt),
      resolvedAt: data.resolvedAt ? parseInt(data.resolvedAt) : undefined,
      resolution: data.resolution || undefined,
      slashAmount: data.slashAmount ? BigInt(data.slashAmount) : undefined,
      refundAmount: data.refundAmount ? BigInt(data.refundAmount) : undefined,
    };
  }

  private serializeReputation(rep: ReputationScore): Record<string, string> {
    return {
      agentId: rep.agentId,
      overall: rep.overall.toString(),
      stake: rep.components.stake.toString(),
      rating: rep.components.rating.toString(),
      completion: rep.components.completion.toString(),
      age: rep.components.age.toString(),
      tier: rep.tier,
      updatedAt: rep.updatedAt.toString(),
    };
  }

  private deserializeReputation(data: Record<string, string>): ReputationScore {
    return {
      agentId: data.agentId,
      overall: parseInt(data.overall),
      components: {
        stake: parseInt(data.stake),
        rating: parseInt(data.rating),
        completion: parseInt(data.completion),
        age: parseInt(data.age),
      },
      tier: data.tier as ReputationScore['tier'],
      updatedAt: parseInt(data.updatedAt),
    };
  }
}

// ============================================
// Singleton
// ============================================
export const reputationStaking = new ReputationStakingService();

// ============================================
// Helper Functions
// ============================================
export function getTierBenefits(tier: ReputationScore['tier']): {
  platformFee: number;
  priority: number;
  features: string[];
} {
  const benefits = {
    bronze: {
      platformFee: 15,
      priority: 1,
      features: ['Basic listing'],
    },
    silver: {
      platformFee: 12,
      priority: 2,
      features: ['Basic listing', 'Featured badge'],
    },
    gold: {
      platformFee: 10,
      priority: 3,
      features: ['Basic listing', 'Featured badge', 'Priority support'],
    },
    platinum: {
      platformFee: 8,
      priority: 4,
      features: ['Basic listing', 'Featured badge', 'Priority support', 'Analytics dashboard'],
    },
    diamond: {
      platformFee: 5,
      priority: 5,
      features: ['Basic listing', 'Featured badge', 'Priority support', 'Analytics dashboard', 'Custom branding'],
    },
  };

  return benefits[tier];
}
