// ============================================
// Agent SDK Health Check API
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
      status: 'healthy',
      agentId: agent.id,
      name: agent.config.name,
      status: agent.status,
    });

  } catch (error: any) {
    console.error('[API:SDK:Health] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
