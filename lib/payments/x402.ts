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
  CELO_TOKENS,
  calculateCallCost,
  SettlementResult,
} from '../payment-settlement';
import { Address } from 'viem';

// ============================================
// Types
// ============================================

export interface PaymentConfig {
  /** Percentage taken by the platform (default 10). */
  platformFeePercent: number;
  /** How often (ms) the billing tick runs (default 1 000 = every second). */
  billingIntervalMs: number;
  /** Which ERC-20 token to settle in ('cUSD' | 'USDC'). */
  settlementToken: 'cUSD' | 'USDC';
}

export interface CallSession {
  id: string;
  agentId: string;
  userAddress: Address;
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
  private sessions: Map<string, CallSession> = new Map();
  private billingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<PaymentConfig>) {
    this.config = {
      platformFeePercent: config?.platformFeePercent ?? 10,
      billingIntervalMs: config?.billingIntervalMs ?? 1_000,
      settlementToken: config?.settlementToken ?? 'cUSD',
    };
  }

  // --------------------------------------------------
  // Authorise
  // --------------------------------------------------

  /**
   * Pre-register a call session.
   * The SignedAuthorization must already be signed by the user's wallet.
   * maxMinutes determines how long the authorization covers.
   */
  async authorizeCall(
    agentId: string,
    userAddress: Address,
    ratePerMinute: number,        // cents/min
    maxMinutes: number,
    authorization: SignedAuthorization
  ): Promise<PaymentAuthorization> {
    const maxAuthorized = ratePerMinute * maxMinutes;

    const session: CallSession = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agentId,
      userAddress,
      ratePerMinute,
      maxAuthorized,
      authorization,
      startTime: new Date(),
      secondsBilled: 0,
      totalCost: 0,
      status: 'pending',
    };

    this.sessions.set(session.id, session);
    console.log(`[x402] Call authorized: ${session.id} | max $${(maxAuthorized / 100).toFixed(2)}`);

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
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'pending') {
      console.warn(`[x402] Session ${sessionId} already ${session.status}`);
      return;
    }

    session.status = 'active';
    const costPerSecondCents = (session.ratePerMinute || 0) / 60;

    console.log(`[x402] Billing started: ${sessionId} @ $${costPerSecondCents.toFixed(4)}/s`);

    const interval = setInterval(() => {
      this._billSecond(sessionId, costPerSecondCents);
    }, this.config.billingIntervalMs);

    this.billingIntervals.set(sessionId, interval);
  }

  private _billSecond(sessionId: string, costPerSecondCents: number): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      this._stopInterval(sessionId);
      return;
    }

    session.secondsBilled++;
    session.totalCost += costPerSecondCents;

    if (session.totalCost >= session.maxAuthorized) {
      console.log(`[x402] Max authorized reached for ${sessionId} – ending call`);
      this.endCall(sessionId);
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
   */
  async endCall(sessionId: string): Promise<CallSession> {
    this._stopInterval(sessionId);

    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== 'active' && session.status !== 'pending') return session;

    const tokenAddress =
      this.config.settlementToken === 'USDC' ? CELO_TOKENS.USDC : CELO_TOKENS.cUSD;

    // Build a partial authorization for the actual amount billed
    // (we don't modify the signature – just adjust the value before settlement).
    const actualCostWei = calculateCallCost(session.secondsBilled, session.ratePerMinute);
    const adjustedAuth: SignedAuthorization = {
      ...session.authorization,
      value: actualCostWei,
    };

    console.log(`[x402] Settling ${sessionId}: ${session.secondsBilled}s → $${(session.totalCost / 100).toFixed(4)}`);

    const result = await paymentSettlement.settlePayment(adjustedAuth, tokenAddress, sessionId);

    session.status = result.success ? 'settled' : 'failed';
    session.settlementResult = result;

    if (result.success) {
      const platformFee = session.totalCost * (this.config.platformFeePercent / 100);
      const agentPayout = session.totalCost - platformFee;
      console.log(
        `[x402] Settled ${sessionId} | tx: ${result.txHash} | agent: $${(agentPayout / 100).toFixed(4)}`
      );
    } else {
      console.error(`[x402] Settlement failed for ${sessionId}:`, result.error);
    }

    return session;
  }

  // --------------------------------------------------
  // Accessors
  // --------------------------------------------------

  getSession(sessionId: string): CallSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getAgentHistory(agentId: string): CallSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.agentId === agentId && s.status === 'settled'
    );
  }

  getUserHistory(userAddress: Address): CallSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.userAddress.toLowerCase() === userAddress.toLowerCase() && s.status === 'settled'
    );
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
