import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, validateAgentInput, sanitizeInput } from '@/lib/security'

// In-memory agent store
const agents = new Map()

// Seed demo agents
const seedAgents = [
  {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
    name: 'Dr. Sarah Chen',
    description: 'Licensed therapist specializing in anxiety and stress management. Warm, empathetic, and evidence-based approaches.',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    capabilities: ['therapy', 'mental-health', 'support'],
    ratePerMinute: 2.50,
    rating: 4.8,
    ratingsCount: 127,
    callsCompleted: 543
  },
  {
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    name: 'Chef Mario',
    description: 'Italian cuisine expert. Can guide you through recipes, suggest wine pairings, and teach cooking techniques.',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    capabilities: ['cooking', 'recipes', 'wine', 'culinary'],
    ratePerMinute: 1.50,
    rating: 4.9,
    ratingsCount: 89,
    callsCompleted: 234
  },
  {
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    name: 'CodeWizard',
    description: 'Full-stack developer specializing in React, TypeScript, and Node.js. Debug, architect, and teach coding.',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    capabilities: ['coding', 'react', 'typescript', 'debugging', 'programming'],
    ratePerMinute: 3.00,
    rating: 4.7,
    ratingsCount: 203,
    callsCompleted: 891
  },
  {
    address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    name: 'Legal Eagle',
    description: 'Contract law specialist. Help with agreements, terms of service, and legal document review.',
    voiceId: 'AZnzlk1XvdvUe5bTIl8b',
    capabilities: ['legal', 'contracts', 'compliance', 'law'],
    ratePerMinute: 5.00,
    rating: 4.6,
    ratingsCount: 45,
    callsCompleted: 112
  },
  {
    address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
    name: 'FitCoach',
    description: 'Personal fitness coach. Workouts, nutrition advice, and motivation for your health journey.',
    voiceId: 'MF3mGyEYrkw8f8mmU3L0',
    capabilities: ['fitness', 'nutrition', 'wellness', 'health'],
    ratePerMinute: 1.50,
    rating: 4.9,
    ratingsCount: 167,
    callsCompleted: 456
  },
  {
    address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8',
    name: 'MathMentor',
    description: 'Math tutor from algebra to calculus. Patient explanations and step-by-step problem solving.',
    voiceId: 'onwK4e9ZLuTAKqWW03F9',
    capabilities: ['math', 'tutoring', 'education', 'calculus', 'algebra'],
    ratePerMinute: 1.00,
    rating: 4.8,
    ratingsCount: 312,
    callsCompleted: 789
  }
]

// Initialize seed data
function initializeAgents() {
  seedAgents.forEach(agent => {
    agents.set(agent.address, {
      ...agent,
      id: agent.address,
      createdAt: new Date().toISOString()
    })
  })
  console.log('[Seed] Initialized', seedAgents.length, 'demo agents')
}

// Initialize on module load
initializeAgents()

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  // Apply rate limiting (60 req/min for listing)
  const { allowed, remaining } = rateLimit(`list:${request.headers.get('x-forwarded-for') || 'ip'}`, {
    windowMs: 60000,
    maxRequests: 60
  })
  
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
    )
  }

  const { searchParams } = new URL(request.url)
  const capability = searchParams.get('capability')
  const maxRate = searchParams.get('maxRate')
  const sortBy = searchParams.get('sortBy') || 'rating'

  let agentList = Array.from(agents.values())

  if (capability) {
    agentList = agentList.filter(a => 
      a.capabilities.some(c => c.toLowerCase().includes(capability.toLowerCase()))
    )
  }

  if (maxRate) {
    agentList = agentList.filter(a => a.ratePerMinute <= parseFloat(maxRate))
  }

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

  return NextResponse.json({ agents: agentList, total: agentList.length })
}

// POST /api/agents - Register new agent
export async function POST(request: NextRequest) {
  // Apply rate limiting (10 req/min for registration)
  const ip = request.headers.get('x-forwarded-for') || 'ip'
  const { allowed } = rateLimit(`register:${ip}`, {
    windowMs: 60000,
    maxRequests: 10
  })
  
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()

    // Validate input
    const validation = validateAgentInput(body)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const { address, name, description, voiceId, capabilities, ratePerMinute } = body

    if (agents.has(address)) {
      return NextResponse.json({ error: 'Agent already registered' }, { status: 409 })
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name)
    const sanitizedDescription = description ? sanitizeInput(description) : ''

    const agent = {
      id: address,
      address,
      name: sanitizedName,
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
    return NextResponse.json({ agent }, { status: 201 })

  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
