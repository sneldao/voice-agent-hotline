// ============================================
// Agent SDK Config Update API
// ============================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { agentSDK, AgentSDKConfig } from '@/lib/agent-sdk';

export async function POST(req: NextRequest) {
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

    const updates: Partial<AgentSDKConfig> = await req.json();
    
    const updatedAgent = await agentSDK.updateAgent(
      agent.id,
      apiKey,
      updates
    );

    return NextResponse.json({
      success: true,
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.config.name,
        description: updatedAgent.config.description,
        ratePerMinute: updatedAgent.config.ratePerMinute,
        status: updatedAgent.status,
      },
    });

  } catch (error: any) {
    console.error('[API:SDK:Config] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

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
      id: agent.id,
      name: agent.config.name,
      description: agent.config.description,
      category: agent.config.category,
      skills: agent.config.skills,
      ratePerMinute: agent.config.ratePerMinute,
      walletAddress: agent.config.walletAddress,
      webhookUrl: agent.config.webhookUrl,
      voice: agent.config.voice,
      status: agent.status,
    });

  } catch (error: any) {
    console.error('[API:SDK:Config:GET] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
