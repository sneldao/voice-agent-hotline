// ============================================
// Agent SDK Stats API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { agentSDK } from '@/lib/agent-sdk';

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 401 }
      );
    }

    const agent = await agentSDK.getAgentByApiKey(apiKey);
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      agentId: agent.id,
      name: agent.config.name,
      status: agent.status,
      totalCalls: agent.totalCalls,
      totalRevenue: agent.totalRevenue,
      rating: agent.rating,
      totalRatings: agent.totalRatings,
      ratePerMinute: agent.config.ratePerMinute,
    });

  } catch (error: any) {
    console.error('[API:SDK:Stats] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
