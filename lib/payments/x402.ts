/**
 * x402 Payment Service - Voice Call Billing
 * 
 * Per-second micropayments for voice agent calls
 * Extends the existing X402PaymentService for voice call billing
 */

import { X402PaymentService, paymentService as x402PaymentService } from '../payment-service'

export interface PaymentConfig {
  platformFeePercent: number  // Platform takes X%
  settlementWindowMs: number  // How often to settle
}

export interface CallSession {
  id: string
  agentId: string
  userAddress: string
  ratePerMinute: number
  maxAuthorized: number
  startTime: Date
  secondsBilled: number
  totalCost: number
  status: 'pending' | 'active' | 'settled' | 'failed'
}

export interface PaymentAuthorization {
  sessionId: string
  authorizedAmount: number
  expiresAt: Date
}

/**
 * Voice Call Payment Service
 * Uses the existing X402PaymentService for core payment logic
 * Adds voice-specific billing features
 */
export class VoicePaymentService {
  private config: PaymentConfig
  private sessions: Map<string, CallSession> = new Map()
  private billingIntervals: Map<string, NodeJS.Timeout> = new Map()
  private x402Service: X402PaymentService

  constructor(config?: Partial<PaymentConfig>) {
    this.config = {
      platformFeePercent: config?.platformFeePercent ?? 10,
      settlementWindowMs: config?.settlementWindowMs ?? 60000
    }
    this.x402Service = x402PaymentService
  }

  /**
   * Pre-authorize a call with max cost
   */
  async authorizeCall(
    agentId: string,
    userAddress: string,
    ratePerMinute: number,
    estimatedMinutes: number = 10,
    maxMinutes: number = 60
  ): Promise<PaymentAuthorization> {
    const maxAuthorized = ratePerMinute * maxMinutes
    
    const session: CallSession = {
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      userAddress,
      ratePerMinute,
      maxAuthorized,
      startTime: new Date(),
      secondsBilled: 0,
      totalCost: 0,
      status: 'pending'
    }

    this.sessions.set(session.id, session)

    console.log(`[Payment] Authorized call ${session.id}: $${maxAuthorized.toFixed(2)} max`)

    return {
      sessionId: session.id,
      authorizedAmount: maxAuthorized,
      expiresAt: new Date(Date.now() + maxMinutes * 60 * 1000)
    }
  }

  /**
   * Start billing for an active call
   */
  async startBilling(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (session.status !== 'pending') {
      console.warn(`[Payment] Session ${sessionId} already active`)
      return
    }

    session.status = 'active'

    // Authorize with core X402 service
    const amountCents = session.maxAuthorized * 100
    await this.x402Service.authorizePayment(
      session.userAddress,
      session.agentId,
      amountCents,
      3600 // 1 hour max
    )

    const costPerSecond = session.ratePerMinute / 60

    console.log(`[Payment] Started billing for ${sessionId}: $${costPerSecond.toFixed(4)}/sec`)

    // Bill every second
    const interval = setInterval(() => {
      this.billSecond(sessionId)
    }, 1000)

    this.billingIntervals.set(sessionId, interval)
  }

  /**
   * Bill for one second of call time
   */
  private async billSecond(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== 'active') {
      this.stopBilling(sessionId)
      return
    }

    const costPerSecond = session.ratePerMinute / 60
    session.secondsBilled++
    session.totalCost += costPerSecond

    // Record with X402 service
    await this.x402Service.recordTime(1)

    if (session.totalCost >= session.maxAuthorized) {
      console.log(`[Payment] Max authorized reached for ${sessionId}`)
      this.endCall(sessionId)
    }
  }

  /**
   * Stop billing for a call
   */
  stopBilling(sessionId: string): void {
    const interval = this.billingIntervals.get(sessionId)
    if (interval) {
      clearInterval(interval)
      this.billingIntervals.delete(sessionId)
    }
  }

  /**
   * End a call and settle payment
   */
  async endCall(sessionId: string): Promise<CallSession> {
    this.stopBilling(sessionId)

    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (session.status === 'active') {
      // Settle with X402 service
      const result = await this.x402Service.endSession()

      // Calculate platform fee
      const platformFee = session.totalCost * (this.config.platformFeePercent / 100)
      const agentPayout = session.totalCost - platformFee

      session.status = 'settled'

      console.log(`[Payment] Call ended: ${sessionId}`)
      console.log(`  Total: $${session.totalCost.toFixed(4)}`)
      console.log(`  Platform fee (${this.config.platformFeePercent}%): $${platformFee.toFixed(4)}`)
      console.log(`  Agent payout: $${agentPayout.toFixed(4)}`)
    }

    return session
  }

  /**
   * Get current billing status
   */
  getBillingStatus(sessionId: string): CallSession | null {
    return this.sessions.get(sessionId) || null
  }

  /**
   * Get call history for an agent
   */
  getAgentHistory(agentId: string): CallSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.agentId === agentId && s.status === 'settled')
  }

  /**
   * Get call history for a user
   */
  getUserHistory(userAddress: string): CallSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.userAddress === userAddress && s.status === 'settled')
  }
}

// Singleton instance
let paymentService: VoicePaymentService | null = null

export function getVoicePaymentService(config?: Partial<PaymentConfig>): VoicePaymentService {
  if (!paymentService) {
    paymentService = new VoicePaymentService(config)
  }
  return paymentService
}

export function resetVoicePaymentService(): void {
  paymentService = null
}
