/**
 * Analytics Service
 * 
 * Track marketplace metrics and monitoring
 */

export interface Analytics {
  totalAgents: number
  totalCalls: number
  totalRevenue: number
  totalMinutes: number
  averageRating: number
  topAgents: { id: string; name: string; calls: number }[]
  hourlyCalls: { hour: string; count: number }[]
}

class AnalyticsService {
  private metrics = {
    callsStarted: 0,
    callsCompleted: 0,
    totalRevenue: 0,
    totalMinutes: 0,
    ratingsSubmitted: 0,
    ratingsSum: 0
  }

  // Track call started
  trackCallStarted() {
    this.metrics.callsStarted++
  }

  // Track call completed
  trackCallCompleted(durationSeconds: number, cost: number) {
    this.metrics.callsCompleted++
    this.metrics.totalMinutes += durationSeconds / 60
    this.metrics.totalRevenue += cost
  }

  // Track rating submitted
  trackRating(score: number) {
    this.metrics.ratingsSubmitted++
    this.metrics.ratingsSum += score
  }

  // Get analytics
  getAnalytics(agents: any[], calls: any[]): Analytics {
    const topAgents = agents
      .map(a => ({ id: a.id, name: a.name, calls: a.callsCompleted || 0 }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 5)

    // Hourly breakdown (last 24 hours)
    const hourlyCalls: { hour: string; count: number }[] = []
    const now = new Date()
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourStr = hour.toISOString().slice(0, 13)
      const count = calls.filter(c => 
        c.startTime && c.startTime.slice(0, 13) === hourStr
      ).length
      hourlyCalls.push({ hour: hourStr, count })
    }

    const averageRating = this.metrics.ratingsSubmitted > 0
      ? this.metrics.ratingsSum / this.metrics.ratingsSubmitted
      : 0

    return {
      totalAgents: agents.length,
      totalCalls: this.metrics.callsCompleted,
      totalRevenue: this.metrics.totalRevenue,
      totalMinutes: this.metrics.totalMinutes,
      averageRating,
      topAgents,
      hourlyCalls
    }
  }

  // Health check
  getHealth() {
    return {
      status: 'healthy',
      uptime: process.uptime?.() || 0,
      memory: process.memoryUsage?.() || {},
      timestamp: new Date().toISOString()
    }
  }
}

export const analyticsService = new AnalyticsService()
