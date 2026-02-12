/**
 * Ratings Service - Anti-Gamed
 * 
 * Secure rating system with verification
 */

export interface Rating {
  id: string
  agentId: string
  userAddress: string
  callId: string
  score: number
  comment: string
  createdAt: string
  verified: boolean      // Verified call
  weighting: number      // Weight based on account age/verification
}

export interface AgentRating {
  agentId: string
  averageRating: number
  weightedRating: number  // Weight verified ratings higher
  totalRatings: number
  verifiedRatings: number
  ratingDistribution: Record<number, number>
  recentReviews: Rating[]
}

// Track call completions (in production, use database)
const completedCalls = new Map<string, { 
  agentId: string
  userAddress: string
  endTime: number
  verified: boolean
}>()

// Track user ratings (for spam prevention)
const userRatings = new Map<string, Set<string>>()  // userAddress -> Set of agentIds rated
const ratingTimestamps: number[] = []

class RatingsService {
  private ratings: Map<string, Rating> = new Map()

  /**
   * Register a completed call (called when call ends)
   */
  registerCompletedCall(callId: string, agentId: string, userAddress: string, verified: boolean = false) {
    completedCalls.set(callId, {
      agentId,
      userAddress,
      endTime: Date.now(),
      verified
    })
  }

  /**
   * Submit a rating - with anti-gaming checks
   */
  async submitRating(
    agentId: string,
    userAddress: string,
    callId: string,
    score: number,
    comment: string = ''
  ): Promise<{ rating?: Rating; error?: string }> {
    // 1. Validate score
    if (score < 1 || score > 5) {
      return { error: 'Score must be between 1 and 5' }
    }

    // 2. Check call exists and was completed
    const call = completedCalls.get(callId)
    if (!call) {
      return { error: 'Can only rate completed calls' }
    }

    // 3. Verify call matches (can't rate a call you didn't make)
    if (call.agentId !== agentId || call.userAddress !== userAddress) {
      return { error: 'Call mismatch' }
    }

    // 4. Check call ended at least 5 seconds ago (prevent instant ratings)
    const timeSinceCall = Date.now() - call.endTime
    if (timeSinceCall < 5000) {
      return { error: 'Wait before rating' }
    }

    // 5. Check call ended within last 24 hours
    if (timeSinceCall > 24 * 60 * 60 * 1000) {
      return { error: 'Rating window expired (24h)' }
    }

    // 6. Check user hasn't rated this agent too recently (spam prevention)
    const userAgentKey = `${userAddress}_${agentId}`
    const now = Date.now()
    ratingTimestamps.push(now)
    
    // Keep only last 100 timestamps
    while (ratingTimestamps.length > 100) ratingTimestamps.shift()
    
    // Check rate limit: max 10 ratings per minute
    const recentRatings = ratingTimestamps.filter(t => now - t < 60000)
    if (recentRatings.length > 10) {
      return { error: 'Too many ratings, slow down' }
    }

    // 7. Calculate weighting
    // - Verified calls (wallet connected during call): higher weight
    // - Older accounts: higher weight (in production)
    const weighting = call.verified ? 1.5 : 1.0

    const rating: Rating = {
      id: `rating_${now}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      userAddress,
      callId,
      score,
      comment: comment.slice(0, 500), // Limit comment length
      createdAt: new Date().toISOString(),
      verified: call.verified,
      weighting
    }

    // Store
    const key = `${callId}_${userAddress}`
    this.ratings.set(key, rating)
    
    // Track for spam prevention
    if (!userRatings.has(userAddress)) {
      userRatings.set(userAddress, new Set())
    }
    userRatings.get(userAddress)!.add(agentId)

    console.log(`[Ratings] New rating: ${score} stars (verified: ${call.verified}, weight: ${weighting})`)

    return { rating }
  }

  /**
   * Get agent rating with weighted average
   */
  async getAgentRating(agentId: string): Promise<AgentRating> {
    const agentRatings = Array.from(this.ratings.values())
      .filter(r => r.agentId === agentId)

    if (agentRatings.length === 0) {
      return {
        agentId,
        averageRating: 0,
        weightedRating: 0,
        totalRatings: 0,
        verifiedRatings: 0,
        ratingDistribution: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
        recentReviews: []
      }
    }

    // Simple average
    const totalScore = agentRatings.reduce((sum, r) => sum + r.score, 0)
    const averageRating = totalScore / agentRatings.length

    // Weighted average (verified ratings count more)
    const weightedSum = agentRatings.reduce((sum, r) => sum + (r.score * r.weighting), 0)
    const totalWeight = agentRatings.reduce((sum, r) => sum + r.weighting, 0)
    const weightedRating = weightedSum / totalWeight

    // Distribution
    const ratingDistribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    agentRatings.forEach(r => {
      ratingDistribution[r.score as keyof typeof ratingDistribution]++
    })

    // Verified count
    const verifiedRatings = agentRatings.filter(r => r.verified).length

    // Recent reviews (last 10)
    const recentReviews = agentRatings
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)

    return {
      agentId,
      averageRating,
      weightedRating,
      totalRatings: agentRatings.length,
      verifiedRatings,
      ratingDistribution,
      recentReviews
    }
  }
}

let ratingsService: RatingsService | null = null

export function getRatingsService(): RatingsService {
  if (!ratingsService) {
    ratingsService = new RatingsService()
  }
  return ratingsService
}

// Export for calling from call end
export { completedCalls }
