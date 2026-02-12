import { NextRequest, NextResponse } from 'next/server'
import { analyticsService } from '@/lib/analytics'

// Store calls in memory
const calls: any[] = []

// GET /api/analytics - Get marketplace analytics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'full'

  if (type === 'health') {
    return NextResponse.json(analyticsService.getHealth())
  }

  // Get agents
  let agents: any[] = []
  try {
    const res = await fetch(`${request.nextUrl.origin}/api/agents`)
    const data = await res.json()
    agents = data.agents || []
  } catch (e) {
    // Ignore
  }

  const analytics = analyticsService.getAnalytics(agents, calls)

  return NextResponse.json({
    ...analytics,
    timestamp: new Date().toISOString()
  })
}
