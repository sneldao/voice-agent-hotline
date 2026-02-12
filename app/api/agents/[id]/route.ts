import { NextRequest, NextResponse } from 'next/server'

// Export the agent type for use in other files
export interface AgentProfile {
  id: string
  address: string
  name: string
  description: string
  voiceId: string
  capabilities: string[]
  ratePerMinute: number
  rating: number
  ratingsCount: number
  callsCompleted: number
  createdAt: string
}

// In-memory store (shared with route.ts - in production, use database)
const getAgents = (): Map<string, AgentProfile> => {
  // @ts-ignore - accessing the global store from route.ts
  if (!global.__agents) {
    // @ts-ignore
    global.__agents = new Map()
  }
  // @ts-ignore
  return global.__agents
}

// GET /api/agents/[id] - Get agent profile
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agents = getAgents()
  const agent = agents.get(params.id)

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ agent })
}

// PUT /api/agents/[id] - Update agent profile
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agents = getAgents()
  const agent = agents.get(params.id)

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 }
    )
  }

  try {
    const body = await request.json()
    
    // Update allowed fields
    if (body.name) agent.name = body.name
    if (body.description !== undefined) agent.description = body.description
    if (body.voiceId) agent.voiceId = body.voiceId
    if (body.capabilities) agent.capabilities = body.capabilities
    if (body.ratePerMinute) agent.ratePerMinute = parseFloat(body.ratePerMinute)

    agents.set(params.id, agent)

    return NextResponse.json({ agent })

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
