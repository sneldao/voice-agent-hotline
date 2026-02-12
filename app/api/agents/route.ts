import { NextRequest, NextResponse } from 'next/server'

// In-memory agent registry (replace with database in production)
const agents: Map<string, AgentProfile> = new Map()

export interface AgentProfile {
  id: string
  address: string          // ERC-8004 identity
  name: string
  description: string
  voiceId: string          // ElevenLabs voice ID
  capabilities: string[]   // ['coding', 'legal', 'medical', 'therapy']
  ratePerMinute: number    // $/minute
  rating: number           // 0-5 stars
  ratingsCount: number
  callsCompleted: number
  createdAt: string
}

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const capability = searchParams.get('capability')
  const maxRate = searchParams.get('maxRate')
  const sortBy = searchParams.get('sortBy') || 'rating'

  let agentList = Array.from(agents.values())

  // Filter by capability
  if (capability) {
    agentList = agentList.filter(a => 
      a.capabilities.map(c => c.toLowerCase()).includes(capability.toLowerCase())
    )
  }

  // Filter by max rate
  if (maxRate) {
    agentList = agentList.filter(a => a.ratePerMinute <= parseFloat(maxRate))
  }

  // Sort
  switch (sortBy) {
    case 'rating':
      agentList.sort((a, b) => b.rating - a.rating)
      break
    case 'rate':
      agentList.sort((a, b) => a.ratePerMinute - b.ratePerMinute)
      break
    case 'popular':
      agentList.sort((a, b) => b.callsCompleted - a.callsCompleted)
      break
  }

  return NextResponse.json({
    agents: agentList,
    total: agentList.length
  })
}

// POST /api/agents - Register a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { address, name, description, voiceId, capabilities, ratePerMinute } = body

    // Validation
    if (!address || !name || !voiceId || !capabilities || !ratePerMinute) {
      return NextResponse.json(
        { error: 'Missing required fields: address, name, voiceId, capabilities, ratePerMinute' },
        { status: 400 }
      )
    }

    // Check if agent already exists
    if (agents.has(address)) {
      return NextResponse.json(
        { error: 'Agent already registered' },
        { status: 409 }
      )
    }

    // Create agent profile
    const agent: AgentProfile = {
      id: address, // Use address as ID
      address,
      name,
      description: description || '',
      voiceId,
      capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
      ratePerMinute: parseFloat(ratePerMinute),
      rating: 0,
      ratingsCount: 0,
      callsCompleted: 0,
      createdAt: new Date().toISOString()
    }

    agents.set(address, agent)

    return NextResponse.json({
      agent,
      message: 'Agent registered successfully'
    }, { status: 201 })

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
