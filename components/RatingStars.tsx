'use client'

import { useState, useEffect } from 'react'

interface Rating {
  id: string
  agentId: string
  userAddress: string
  callId: string
  score: number
  comment: string
  createdAt: string
}

interface AgentRating {
  agentId: string
  averageRating: number
  totalRatings: number
  ratingDistribution: Record<number, number>
  recentReviews: Rating[]
}

interface RatingStarsProps {
  agentId: string
}

export function RatingStars({ agentId }: RatingStarsProps) {
  const [rating, setRating] = useState<AgentRating | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRating, setUserRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchRating()
  }, [agentId])

  const fetchRating = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ratings?agentId=${agentId}`)
      const data = await res.json()
      setRating(data)
    } catch (error) {
      console.error('Failed to fetch rating:', error)
    } finally {
      setLoading(false)
    }
  }

  const submitRating = async () => {
    if (userRating === 0) return
    
    setSubmitting(true)
    try {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          userAddress: '0xUser...', // In production, from wallet
          callId: `call_${Date.now()}`,
          score: userRating,
          comment
        })
      })
      setUserRating(0)
      setComment('')
      fetchRating() // Refresh
    } catch (error) {
      console.error('Failed to submit rating:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading ratings...</div>
  }

  const avg = rating?.averageRating ?? 0
  const total = rating?.totalRatings ?? 0

  return (
    <div className="rating-section">
      {/* Current Rating */}
      <div className="current-rating">
        <span className="score">{avg.toFixed(1)}</span>
        <div className="stars">
          {[1,2,3,4,5].map(star => (
            <span key={star} className={star <= avg ? 'star filled' : 'star'}>
              ★
            </span>
          ))}
        </div>
        <span className="count">({total} reviews)</span>
      </div>

      {/* Rating Distribution */}
      {total > 0 && rating && (
        <div className="distribution">
          {[5,4,3,2,1].map(star => (
            <div key={star} className="dist-row">
              <span className="label">{star} ★</span>
              <div className="bar-container">
                <div 
                  className="bar" 
                  style={{ 
                    width: `${((rating.ratingDistribution[star] || 0) / total) * 100}%` 
                  }} 
                />
              </div>
              <span className="count">{rating.ratingDistribution[star] || 0}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent Reviews */}
      {rating && rating.recentReviews && rating.recentReviews.length > 0 && (
        <div className="reviews">
          <h4>Recent Reviews</h4>
          {rating.recentReviews.map(review => (
            <div key={review.id} className="review">
              <div className="review-header">
                <span className="stars">
                  {'★'.repeat(review.score)}{'☆'.repeat(5 - review.score)}
                </span>
                <span className="date">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              {review.comment && <p className="comment">{review.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Submit Rating */}
      <div className="submit-rating">
        <h4>Rate your call</h4>
        <div className="star-input">
          {[1,2,3,4,5].map(star => (
            <button
              key={star}
              className={star <= userRating ? 'star filled' : 'star'}
              onClick={() => setUserRating(star)}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          placeholder="Leave a comment (optional)"
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
        <button 
          onClick={submitRating}
          disabled={userRating === 0 || submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Rating'}
        </button>
      </div>

      <style jsx>{`
        .rating-section {
          padding: 1rem;
          background: #f9f9f9;
          border-radius: 8px;
        }
        .current-rating {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .score {
          font-size: 2rem;
          font-weight: bold;
        }
        .stars {
          font-size: 1.25rem;
        }
        .star.filled { color: #fbbf24; }
        .star { color: #d1d5db; }
        .count { color: #6b7280; }
        .distribution {
          margin: 1rem 0;
        }
        .dist-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0.25rem 0;
        }
        .label { width: 30px; }
        .bar-container {
          flex: 1;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }
        .bar {
          height: 100%;
          background: #fbbf24;
        }
        .reviews {
          margin: 1rem 0;
        }
        .review {
          padding: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .review-header {
          display: flex;
          justify-content: space-between;
        }
        .date { color: #6b7280; font-size: 0.875rem; }
        .comment { margin-top: 0.25rem; color: #374151; }
        .submit-rating {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }
        .star-input {
          display: flex;
          gap: 0.25rem;
          margin: 0.5rem 0;
        }
        .star-input button {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
        }
        textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          margin: 0.5rem 0;
        }
        button {
          background: #3b82f6;
          color: white;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        button:disabled {
          background: #9ca3af;
        }
        .loading { text-align: center; color: #6b7280; }
      `}</style>
    </div>
  )
}
