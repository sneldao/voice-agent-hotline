/**
 * Ratings Service
 * 
 * Agent reputation and rating system
 */

export interface Rating {
  id: string
  agentId: string
  userAddress: string
  callId: string
  score: number        // 1-5 stars
  comment: string
  createdAt: string
}

export interface AgentRating {
  agentId: string
  averageRating: number
  totalRatings: number
  ratingDistribution: Record<number, number>  // {1: count, 2: count, ...}
  recentReviews: Rating[]
}

class RatingsService {
  private ratings: Map<string, Rating> = new Map()

  /**
   * Submit a rating for an agent
   */
  async submitRating(
    agentId: string,
    userAddress: string,
    callId: string,
    score: number,
    comment: string = ''
  ): Promise<Rating> {
    // Validate score
    if (score < 1 || score > 5) {
      throw new Error('Score must be between 1 and 5')
    }

    // Check if already rated
    const existingKey = `${callId}_${userAddress}`
    if (this.ratings.has(existingKey)) {
      throw new Error('Already rated this call')
    }

    const rating: Rating = {
      id: `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      userAddress,
      callId,
      score,
      comment,
      createdAt: new Date().toISOString()
    }

    this.ratings.set(existingKey, rating)
    
    console.log(`[Ratings] New rating for agent ${agentId}: ${score} stars`)
    
    return rating
  }

  /**
   * Get agent's rating stats
   */
  async getAgentRating(agentId: string): Promise<AgentRating> {
    const agentRatings = Array.from(this.ratings.values())
      .filter(r => r.agentId === agentId)

    if (agentRatings.length === 0) {
      return {
        agentId,
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
        recentReviews: []
      }
    }

    // Calculate average
    const totalScore = agentRatings.reduce((sum, r) => sum + r.score, 0)
    const averageRating = totalScore / agentRatings.length

    // Calculate distribution
    const ratingDistribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    agentRatings.forEach(r => {
      ratingDistribution[r.score as keyof typeof ratingDistribution]++
    })

    // Get recent reviews (last 5)
    const recentReviews = agentRatings
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    return {
      agentId,
      averageRating,
      totalRatings: agentRatings.length,
      ratingDistribution,
      recentReviews
    }
  }

  /**
   * Get all ratings for an agent
   */
  async getAllRatings(agentId: string): Promise<Rating[]> {
    return Array.from(this.ratings.values())
      .filter(r => r.agentId === agentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
}

// Singleton
let ratingsService: RatingsService | null = null

export function getRatingsService(): RatingsService {
  if (!ratingsService) {
    ratingsService = new RatingsService()
  }
  return ratingsService
}
