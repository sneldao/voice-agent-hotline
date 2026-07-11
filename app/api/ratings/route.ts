import { NextRequest, NextResponse } from 'next/server'
import { validateRatingInput } from '@/lib/security'
import { getRatingsService } from '@/lib/ratings'
import { RedisRateLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic';

// Redis-backed rate limiters (replaces in-memory rateLimit from security.ts)
const readLimiter = new RedisRateLimiter(
  { windowMs: 60_000, maxRequests: 60 },
  'ratelimit:ratings:read'
);
const writeLimiter = new RedisRateLimiter(
  { windowMs: 60_000, maxRequests: 10 },
  'ratelimit:ratings:write'
);

// GET /api/ratings?agentId=xxx - Get agent ratings
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const limited = await readLimiter.isRateLimited(ip)
  if (limited) {
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
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const limited = await writeLimiter.isRateLimited(ip)
  if (limited) {
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
