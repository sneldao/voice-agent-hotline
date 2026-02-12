import { NextRequest, NextResponse } from 'next/server'
import { getRatingsService } from '../../../lib/ratings'

// GET /api/ratings?agentId=xxx - Get agent ratings
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')

  if (!agentId) {
    return NextResponse.json(
      { error: 'Missing agentId' },
      { status: 400 }
    )
  }

  const ratingsService = getRatingsService()
  const rating = await ratingsService.getAgentRating(agentId)

  return NextResponse.json(rating)
}

// POST /api/ratings - Submit a rating
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, userAddress, callId, score, comment } = body

    if (!agentId || !userAddress || !callId || score === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, userAddress, callId, score' },
        { status: 400 }
      )
    }

    if (score < 1 || score > 5) {
      return NextResponse.json(
        { error: 'Score must be between 1 and 5' },
        { status: 400 }
      )
    }

    const ratingsService = getRatingsService()
    const rating = await ratingsService.submitRating(
      agentId,
      userAddress,
      callId,
      score,
      comment || ''
    )

    return NextResponse.json({ rating }, { status: 201 })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Invalid request' },
      { status: 400 }
    )
  }
}
