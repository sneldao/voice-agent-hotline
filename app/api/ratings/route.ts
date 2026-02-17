import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, validateRatingInput } from '@/lib/security'
import { getRatingsService } from '@/lib/ratings'

export const dynamic = 'force-dynamic';
// GET /api/ratings?agentId=xxx - Get agent ratings
export async function GET(request: NextRequest) {
  // Rate limit: 60 req/min
  const ip = request.headers.get('x-forwarded-for') || 'ip'
  const { allowed } = rateLimit(`ratings:${ip}`, { windowMs: 60000, maxRequests: 60 })
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')

  if (!agentId) {
    return NextResponse.json({ error: 'Missing agentId' }, { status: 400 })
  }

  const ratingsService = getRatingsService()
  const rating = await ratingsService.getAgentRating(agentId)

  return NextResponse.json(rating)
}

// POST /api/ratings - Submit a rating
export async function POST(request: NextRequest) {
  // Rate limit: 10 ratings/min
  const ip = request.headers.get('x-forwarded-for') || 'ip'
  const { allowed } = rateLimit(`rate:${ip}`, { windowMs: 60000, maxRequests: 10 })
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const body = await request.json()

    // Validate input
    const validation = validateRatingInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 })
    }

    const { agentId, userAddress, callId, score, comment } = body

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
    return NextResponse.json({ error: error.message || 'Invalid request' }, { status: 400 })
  }
}
