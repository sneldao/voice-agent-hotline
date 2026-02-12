import { NextRequest, NextResponse } from 'next/server'
import { getVoicePaymentService } from '../../../lib/payments'

// GET /api/calls - Get call history
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')
  const userAddress = searchParams.get('userAddress')

  const paymentService = getVoicePaymentService()

  if (agentId) {
    const history = paymentService.getAgentHistory(agentId)
    return NextResponse.json({ calls: history })
  }

  if (userAddress) {
    const history = paymentService.getUserHistory(userAddress)
    return NextResponse.json({ calls: history })
  }

  return NextResponse.json(
    { error: 'Missing agentId or userAddress' },
    { status: 400 }
  )
}

// POST /api/calls - Start a new call (pre-authorize)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, userAddress, ratePerMinute, estimatedMinutes, maxMinutes } = body

    if (!agentId || !userAddress || !ratePerMinute) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, userAddress, ratePerMinute' },
        { status: 400 }
      )
    }

    const paymentService = getVoicePaymentService()
    const authorization = await paymentService.authorizeCall(
      agentId,
      userAddress,
      parseFloat(ratePerMinute),
      estimatedMinutes,
      maxMinutes
    )

    return NextResponse.json({
      sessionId: authorization.sessionId,
      authorizedAmount: authorization.authorizedAmount,
      expiresAt: authorization.expiresAt
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
