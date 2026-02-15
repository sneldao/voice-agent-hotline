import { NextRequest, NextResponse } from 'next/server';
import { composioService } from '@/lib/composio';

/**
 * ElevenLabs Conversational AI Webhook Handler
 * 
 * Receives tool call requests from ElevenLabs agents
 * and executes them via Composio
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool_name, parameters, metadata } = body;

    console.log('[ElevenLabs Webhook] Tool call:', tool_name, parameters);

    // Map tool name to Composio tool slug
    const toolSlugMap: Record<string, string> = {
      'check_solana_balance': 'SOLANA_GET_BALANCE',
      'get_github_repos': 'GITHUB_LIST_REPOS',
      'search_web': 'WEB_SEARCH',
    };

    const toolSlug = toolSlugMap[tool_name];
    
    if (!toolSlug) {
      return NextResponse.json({
        error: `Unknown tool: ${tool_name}`,
      }, { status: 400 });
    }

    // Execute via Composio
    const result = await composioService.executeTool({
      tool_slug: toolSlug,
      arguments: parameters,
    });

    if (!result.success) {
      return NextResponse.json({
        error: result.error,
      }, { status: 500 });
    }

    // Return result to ElevenLabs
    return NextResponse.json({
      result: result.data,
    });

  } catch (error: any) {
    console.error('[ElevenLabs Webhook] Error:', error);
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}
