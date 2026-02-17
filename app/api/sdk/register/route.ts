// ============================================
// Agent SDK Registration API
// ============================================
// External developers register their agents here

import { NextRequest, NextResponse } from 'next/server';
import { agentSDK, AgentSDKConfig } from '@/lib/agent-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: AgentSDKConfig = body;

    // Validate required fields
    if (!config.name || !config.description || !config.category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, description, category' },
        { status: 400 }
      );
    }

    if (!config.walletAddress) {
      return NextResponse.json(
        { error: 'Missing required field: walletAddress' },
        { status: 400 }
      );
    }

    if (!config.webhookUrl) {
      return NextResponse.json(
        { error: 'Missing required field: webhookUrl' },
        { status: 400 }
      );
    }

    // Register the agent
    const agent = await agentSDK.registerAgent(config);

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        apiKey: agent.apiKey,
        status: agent.status,
        createdAt: agent.createdAt,
      },
      message: agent.status === 'pending' 
        ? 'Agent registered and pending verification'
        : 'Agent registered and active',
    });

  } catch (error: any) {
    console.error('[API:SDK:Register] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 400 }
    );
  }
}

// List available categories
export async function GET() {
  const categories = [
    { id: 'legal', name: 'Legal', description: 'Lawyers, legal advisors, contract specialists', requiresVerification: true },
    { id: 'medical', name: 'Medical', description: 'Health coaches, nutritionists, wellness experts', requiresVerification: true },
    { id: 'finance', name: 'Finance', description: 'Financial advisors, accountants, tax specialists', requiresVerification: false },
    { id: 'tech', name: 'Technology', description: 'Developers, DevOps, AI specialists', requiresVerification: false },
    { id: 'creative', name: 'Creative', description: 'Designers, writers, brand strategists', requiresVerification: false },
    { id: 'education', name: 'Education', description: 'Tutors, teachers, course creators', requiresVerification: false },
    { id: 'business', name: 'Business', description: 'Consultants, coaches, strategists', requiresVerification: false },
    { id: 'general', name: 'General', description: 'General knowledge and assistance', requiresVerification: false },
  ];

  return NextResponse.json({ categories });
}
