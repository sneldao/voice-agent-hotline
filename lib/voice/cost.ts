/**
 * Cost Tracking Module
 * 
 * Per-second and per-token billing for x402 micropayments
 * Integrates with existing payment infrastructure
 */

import { VoiceSession, CostTrackingConfig } from './types'

export interface CostBreakdown {
  audioSeconds: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  audioCost: number
  tokenCost: number
  totalCost: number
}

export interface UsageReport {
  period: 'daily' | 'weekly' | 'monthly'
  totalSessions: number
  totalAudioSeconds: number
  totalTokens: number
  totalCost: number
  averageCostPerSession: number
}

export class CostTracker {
  private config: CostTrackingConfig
  private sessions: VoiceSession[] = []

  constructor(config?: Partial<CostTrackingConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      perSecondRate: config?.perSecondRate ?? 0.01,
      perTokenRate: config?.perTokenRate ?? 0.0001
    }
  }

  /**
   * Calculate cost for a single session
   */
  calculateCost(session: VoiceSession): CostBreakdown {
    const audioSeconds = session.audioDuration
    const inputTokens = session.inputTokens
    const outputTokens = session.outputTokens
    const totalTokens = inputTokens + outputTokens

    const audioCost = audioSeconds * this.config.perSecondRate
    const tokenCost = totalTokens * this.config.perTokenRate
    const totalCost = audioCost + tokenCost

    return {
      audioSeconds,
      inputTokens,
      outputTokens,
      totalTokens,
      audioCost,
      tokenCost,
      totalCost
    }
  }

  /**
   * Track a completed session
   */
  trackSession(session: VoiceSession): CostBreakdown {
    const breakdown = this.calculateCost(session)
    this.sessions.push(session)
    return breakdown
  }

  /**
   * Get usage report for a time period
   */
  getUsageReport(period: 'daily' | 'weekly' | 'monthly'): UsageReport {
    const now = new Date()
    const cutoff = new Date()

    switch (period) {
      case 'daily':
        cutoff.setDate(now.getDate() - 1)
        break
      case 'weekly':
        cutoff.setDate(now.getDate() - 7)
        break
      case 'monthly':
        cutoff.setMonth(now.getMonth() - 1)
        break
    }

    const periodSessions = this.sessions.filter(
      s => s.startTime >= cutoff
    )

    const totalAudioSeconds = periodSessions.reduce(
      (sum, s) => sum + s.audioDuration, 0
    )
    const totalTokens = periodSessions.reduce(
      (sum, s) => sum + s.inputTokens + s.outputTokens, 0
    )
    const totalCost = periodSessions.reduce(
      (sum, s) => sum + s.cost, 0
    )

    return {
      period,
      totalSessions: periodSessions.length,
      totalAudioSeconds,
      totalTokens,
      totalCost,
      averageCostPerSession: periodSessions.length > 0
        ? totalCost / periodSessions.length
        : 0
    }
  }

  /**
   * Estimate cost for a preview
   */
  estimate(
    estimatedSeconds: number,
    estimatedTokens: number
  ): CostBreakdown {
    return {
      audioSeconds: estimatedSeconds,
      inputTokens: 0,
      outputTokens: estimatedTokens,
      totalTokens: estimatedTokens,
      audioCost: estimatedSeconds * this.config.perSecondRate,
      tokenCost: estimatedTokens * this.config.perTokenRate,
      totalCost: (estimatedSeconds * this.config.perSecondRate) +
                (estimatedTokens * this.config.perTokenRate)
    }
  }

  /**
   * Get current rates
   */
  getRates(): { perSecond: number; perToken: number } {
    return {
      perSecond: this.config.perSecondRate,
      perToken: this.config.perTokenRate
    }
  }

  /**
   * Export usage data for x402 payment
   */
  exportForPayment(sessionId: string): object {
    const session = this.sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const breakdown = this.calculateCost(session)

    return {
      sessionId,
      agentId: session.agent.id,
      timestamp: session.startTime.toISOString(),
      usage: {
        duration: breakdown.audioSeconds,
        tokens: breakdown.totalTokens,
        breakdown: {
          audio: breakdown.audioCost,
          tokens: breakdown.tokenCost
        }
      },
      totalCost: breakdown.totalCost,
      currency: 'USDC'
    }
  }

  /**
   * Clear session history
   */
  clearHistory(): void {
    this.sessions = []
  }
}

// Singleton for easy import
let costTrackerInstance: CostTracker | null = null

export function getCostTracker(config?: Partial<CostTrackingConfig>): CostTracker {
  if (!costTrackerInstance) {
    costTrackerInstance = new CostTracker(config)
  }
  return costTrackerInstance
}

export function resetCostTracker(): void {
  costTrackerInstance = null
}
