import { NextRequest, NextResponse } from 'next/server'
import { getVoicePaymentService } from '@/lib/payments'
import { getRatingsService, completedCalls } from '@/lib/ratings'

// Store active calls in memory
const activeCalls = new Map()

// POST /api/calls/connect - Start a real voice call
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, userAddress, sessionId } = body

    if (!agentId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing agentId or userAddress' },
        { status: 400 }
      )
    }

    // Get agent info
    const agentsRes = await fetch(`${request.nextUrl.origin}/api/agents?capability=all`)
    const { agents } = await agentsRes.json()
    const agent = agents.find((a: any) => a.address === agentId)

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Create call session
    const callSession = {
      id: sessionId || `call_${Date.now()}`,
      agentId,
      agentName: agent.name,
      agentVoiceId: agent.voiceId,
      userAddress,
      ratePerMinute: agent.ratePerMinute,
      status: 'connecting',
      startTime: new Date().toISOString(),
      // WebRTC config for client
      rtcConfig: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      }
    }

    activeCalls.set(callSession.id, callSession)

    // Start billing (requires pre-authorized session from client)
    const paymentService = getVoicePaymentService()
    try {
      await paymentService.startBilling(callSession.id)
    } catch (err: any) {
      if (err.message?.includes('Session not found')) {
        // Client did not pre-authorize; continue without billing
        console.warn(`[Call] No pre-authorized session for ${callSession.id}; proceeding without billing`)
      } else {
        throw err
      }
    }

    callSession.status = 'active'
    activeCalls.set(callSession.id, callSession)

    console.log(`[Call] Started: ${callSession.id} with ${agent.name}`)

    return NextResponse.json({
      callId: callSession.id,
      agentName: agent.name,
      voiceId: agent.voiceId,
      ratePerMinute: agent.ratePerMinute,
      rtcConfig: callSession.rtcConfig
    })

  } catch (error) {
    console.error('[Call] Error starting call:', error)
    return NextResponse.json({ error: 'Failed to start call' }, { status: 500 })
  }
}

// GET /api/calls/[id] - Get call status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const call = activeCalls.get(id)

  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  return NextResponse.json({ call })
}

// DELETE /api/calls/[id] - End a call
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const call = activeCalls.get(id)

  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  // Stop billing and settle
  const paymentService = getVoicePaymentService()
  const session = await paymentService.endCall(id)

  call.status = 'ended'
  call.endTime = new Date().toISOString()
  call.totalCost = session.totalCost
  call.secondsBilled = session.secondsBilled

  // Register completed call for ratings (verified if user has wallet)
  const ratingsService = getRatingsService()
  ratingsService.registerCompletedCall(
    id,
    call.agentId,
    call.userAddress,
    !!call.userAddress // Verified if we have a wallet address
  )

  console.log(`[Call] Ended: ${id}, cost: $${(session.totalCost || 0).toFixed(4)}`)

  return NextResponse.json({ call })
}
