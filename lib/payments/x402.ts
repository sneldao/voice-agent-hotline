/**
 * x402 Voice Call Payment Service
 *
 * Per-second micropayment billing for voice agent calls.
 * On-chain settlement via EIP-3009 transferWithAuthorization
 * through lib/payment-settlement.ts (single source of truth).
 *
 * Flow:
 *  1. Client obtains a SignedAuthorization (user signs EIP-712 in their wallet).
 *  2. Client calls authorizeCall() passing the SignedAuthorization.
 *  3. startBilling() begins per-second cost accrual.
 *  4. endCall() submits the signed authorization on-chain for the actual amount.
 */

import {
  paymentSettlement,
  SignedAuthorization,
  ARB_TOKENS,
  calculateCallCost,
  SettlementResult,
} from '../payment-settlement';
import { Address } from 'viem';
import { getRedis } from '../redis';

// ============================================
// Types
// ============================================

export interface PaymentConfig {
  /** Percentage taken by the platform (default 10). */
  platformFeePercent: number;
  /** How often (ms) the billing tick runs (default 1 000 = every second). */
  billingIntervalMs: number;
  /** Which ERC-20 token to settle in ('USDC' | 'USDT'). */
  settlementToken: 'USDC' | 'USDT';
}

export interface CallSession {
  id: string;
  agentId: string;
  userAddress: Address;
  /** Agent's wallet address for payment (80% share) */
  agentWallet?: Address;
  ratePerMinute: number;        // human-readable cents per minute
  maxAuthorized: number;        // max cents authorized by user
  authorization: SignedAuthorization;
  startTime: Date;
  secondsBilled: number;
  /** Accumulated cost in the same unit as ratePerMinute (cents). */
  totalCost: number;
  status: 'pending' | 'active' | 'settled' | 'failed';
  settlementResult?: SettlementResult;
}

export interface PaymentAuthorization {
  sessionId: string;
  authorizedAmount: number;     // cents
  expiresAt: Date;
}

// ============================================
// Voice Call Payment Service
// ============================================

export class VoicePaymentService {
  private config: PaymentConfig;
  private billingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<PaymentConfig>) {
    this.config = {
      platformFeePercent: config?.platformFeePercent ?? 10,
      billingIntervalMs: config?.billingIntervalMs ?? 1_000,
      settlementToken: config?.settlementToken ?? 'USDC',
    };
  }

  private serializeSession(session: CallSession): Record<string, string> {
    return {
      id: session.id,
      agentId: session.agentId,
      userAddress: session.userAddress,
      agentWallet: session.agentWallet || '',
      ratePerMinute: session.ratePerMinute.toString(),
      maxAuthorized: session.maxAuthorized.toString(),
      authorization: JSON.stringify(session.authorization),
      startTime: session.startTime.toISOString(),
      secondsBilled: session.secondsBilled.toString(),
      totalCost: session.totalCost.toString(),
      status: session.status,
      settlementResult: session.settlementResult ? JSON.stringify(session.settlementResult) : '',
    };
  }

  private deserializeSession(data: Record<string, string>): CallSession | null {
    if (!data || !data.id) return null;
    return {
      id: data.id,
      agentId: data.agentId,
      userAddress: data.userAddress as Address,
      agentWallet: data.agentWallet as Address | undefined,
      ratePerMinute: parseFloat(data.ratePerMinute),
      maxAuthorized: parseFloat(data.maxAuthorized),
      authorization: JSON.parse(data.authorization) as SignedAuthorization,
      startTime: new Date(data.startTime),
      secondsBilled: parseInt(data.secondsBilled, 10),
      totalCost: parseFloat(data.totalCost),
      status: data.status as CallSession['status'],
      settlementResult: data.settlementResult ? JSON.parse(data.settlementResult) : undefined,
    };
  }

  // --------------------------------------------------
  // Authorise
  // --------------------------------------------------

  /**
   * Pre-register a call session.
   * The SignedAuthorization must already be signed by the user's wallet.
   * maxMinutes determines how long the authorization covers.
   * 
   * @param agentWallet - The agent's wallet address for 80% revenue share
   */
  async authorizeCall(
    agentId: string,
    userAddress: Address,
    ratePerMinute: number,        // cents/min
    maxMinutes: number,
    authorization: SignedAuthorization,
    agentWallet?: Address
  ): Promise<PaymentAuthorization> {
    const maxAuthorized = ratePerMinute * maxMinutes;

    const session: CallSession = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agentId,
      userAddress,
      agentWallet,
      ratePerMinute,
      maxAuthorized,
      authorization,
      startTime: new Date(),
      secondsBilled: 0,
      totalCost: 0,
      status: 'pending',
    };

    const redis = getRedis();
    await redis.hset(`payment-session:${session.id}`, this.serializeSession(session));
    // Add to index set for efficient listing
    await redis.sadd('payment_session_index', session.id);
    console.log(`[x402] Call authorized: ${session.id} | max ${(maxAuthorized / 100).toFixed(2)} | agent: ${agentWallet || 'default'}`);

    return {
      sessionId: session.id,
      authorizedAmount: maxAuthorized,
      expiresAt: new Date(Date.now() + maxMinutes * 60_000),
    };
  }

  // --------------------------------------------------
  // Billing lifecycle
  // --------------------------------------------------

  /** Begin per-second cost accrual for an already-authorised session. */
  async startBilling(sessionId: string): Promise<void> {
    const redis = getRedis();
    const data = await redis.hgetall(`payment-session:${sessionId}`);
    const session = this.deserializeSession(data as Record<string, string>);
    
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'pending') {
      console.warn(`[x402] Session ${sessionId} already ${session.status}`);
      return;
    }

    session.status = 'active';
    await redis.hset(`payment-session:${sessionId}`, { status: 'active' });
    
    const costPerSecondCents = (session.ratePerMinute || 0) / 60;

    console.log(`[x402] Billing started: ${sessionId} @ $${costPerSecondCents.toFixed(4)}/s`);

    const interval = setInterval(() => {
      this._billSecond(sessionId, costPerSecondCents);
    }, this.config.billingIntervalMs);

    this.billingIntervals.set(sessionId, interval);
  }

  private async _billSecond(sessionId: string, costPerSecondCents: number): Promise<void> {
    const redis = getRedis();
    const data = await redis.hgetall(`payment-session:${sessionId}`);
    const session = this.deserializeSession(data as Record<string, string>);
    
    if (!session || session.status !== 'active') {
      this._stopInterval(sessionId);
      return;
    }

    session.secondsBilled++;
    session.totalCost += costPerSecondCents;

    await redis.hset(`payment-session:${sessionId}`, {
      secondsBilled: session.secondsBilled.toString(),
      totalCost: session.totalCost.toString(),
    });

    if (session.totalCost >= session.maxAuthorized) {
      console.log(`[x402] Max authorized reached for ${sessionId} – ending call`);
      await this.endCall(sessionId);
    }
  }

  private _stopInterval(sessionId: string): void {
    const interval = this.billingIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.billingIntervals.delete(sessionId);
    }
  }

  // --------------------------------------------------
  // Settlement
  // --------------------------------------------------

  /**
   * End a call and settle the exact amount on-chain via EIP-3009.
   * Returns the completed CallSession.
   * 
   * If agentWallet is set, uses split payment (80% agent, 20% platform).
   * Otherwise, uses the authorization's original recipient.
   */
  async endCall(sessionId: string): Promise<CallSession> {
    this._stopInterval(sessionId);

    const redis = getRedis();
    const data = await redis.hgetall(`payment-session:${sessionId}`);
    const session = this.deserializeSession(data as Record<string, string>);
    
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'active' && session.status !== 'pending') return session;

    const tokenAddress =
      this.config.settlementToken === 'USDT' ? ARB_TOKENS.USDT : ARB_TOKENS.USDC;

    // Pass the ORIGINAL authorization to preserve the EIP-3009 signature.
    // Modifying the value would invalidate the signature.
    console.log(`[x402] Settling ${sessionId}: ${session.secondsBilled}s → ${(session.totalCost / 100).toFixed(4)}`);

    let result: SettlementResult;

    // Use split payment if agent wallet is provided
    if (session.agentWallet) {
      console.log(`[x402] Using split payment: 80% agent, 20% platform`);
      result = await paymentSettlement.settleSplitPayment(
        session.authorization,
        session.agentWallet,
        tokenAddress,
        sessionId
      );
    } else {
      // Standard single-recipient payment
      result = await paymentSettlement.settlePayment(session.authorization, tokenAddress, sessionId);
    }

    session.status = result.success ? 'settled' : 'failed';
    session.settlementResult = result;

    await redis.hset(`payment-session:${sessionId}`, {
      status: session.status,
      settlementResult: JSON.stringify(session.settlementResult),
    });

    if (result.success) {
      const platformFee = session.totalCost * (this.config.platformFeePercent / 100);
      const agentPayout = session.totalCost - platformFee;
      console.log(
        `[x402] Settled ${sessionId} | tx: ${result.txHash} | agent: ${(agentPayout / 100).toFixed(4)}`
      );
    } else {
      console.error(`[x402] Settlement failed for ${sessionId}:`, result.error);
    }

    return session;
  }

  // --------------------------------------------------
  // Accessors
  // --------------------------------------------------

  async getSession(sessionId: string): Promise<CallSession | null> {
    const redis = getRedis();
    const data = await redis.hgetall(`payment-session:${sessionId}`);
    return this.deserializeSession(data as Record<string, string>);
  }

  async getAgentHistory(agentId: string): Promise<CallSession[]> {
    const redis = getRedis();
    const sessionIds = await redis.smembers('payment_session_index');
    const sessions: CallSession[] = [];

    if (sessionIds.length === 0) return sessions;

    const pipeline = redis.pipeline();
    sessionIds.forEach(id => pipeline.hgetall(`payment-session:${id}`));
    const results = await pipeline.exec();

    for (const raw of (results || [])) {
      const data = (raw as [Error | null, any])[1];
      const session = data ? this.deserializeSession(data as Record<string, string>) : null;
      if (session && session.agentId === agentId && session.status === 'settled') {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  async getUserHistory(userAddress: Address): Promise<CallSession[]> {
    const redis = getRedis();
    // Use Set index instead of KEYS
    const sessionIds = await redis.smembers('payment_session_index');
    if (sessionIds.length === 0) return [];

    // Batch fetch with pipeline
    const pipeline = redis.pipeline();
    sessionIds.forEach(id => pipeline.hgetall(`payment-session:${id}`));
    const results = await pipeline.exec();

    const sessions: CallSession[] = [];
    for (const raw of results || []) {
      const data = (raw as [Error | null, Record<string, string>])[1];
      const session = data ? this.deserializeSession(data) : null;
      if (session && session.userAddress.toLowerCase() === userAddress.toLowerCase() && session.status === 'settled') {
        sessions.push(session);
      }
    }

    return sessions;
  }
}

// ============================================
// Singleton
// ============================================
let _instance: VoicePaymentService | null = null;

export function getVoicePaymentService(config?: Partial<PaymentConfig>): VoicePaymentService {
  if (!_instance) _instance = new VoicePaymentService(config);
  return _instance;
}

export function resetVoicePaymentService(): void {
  _instance = null;
}
