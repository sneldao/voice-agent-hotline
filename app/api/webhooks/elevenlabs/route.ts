import { NextRequest, NextResponse } from 'next/server';
import { composioService } from '@/lib/composio';
import { erc8004Service } from '@/lib/erc8004';
import { createSkillsFramework } from '@/lib/agent-skills';
import { Address, Hash } from 'viem';

/**
 * ElevenLabs Conversational AI Webhook Handler
 * 
 * Enhanced with ERC-8004 Delegation Verification
 * Receives tool call requests from ElevenLabs agents
 * and executes them via Composio or Native Skills Framework
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool_name, parameters, metadata } = body;

    console.log('[ElevenLabs Webhook] Tool call received:', {
      tool_name,
      parameters,
      metadata: metadata || 'none'
    });

    // 1. EXTRACT CONTEXT (User, Delegate, Delegation)
    // In production, these should be passed via metadata or session headers
    const userAddress = (metadata?.user_address || process.env.AGENT_WALLET) as Address;
    const delegationId = metadata?.delegation_id as Hash;

    // 2. VERIFY PERMISSION (ERC-8004)
    // If we have a delegation ID, we verify it against the requested action
    if (delegationId) {
      console.log(`[ElevenLabs Webhook] Verifying delegation: ${delegationId}`);
      
      // Map tool_name to ERC-8004 skill types
      const skillTypeMap: Record<string, 'book' | 'order' | 'schedule' | 'research'> = {
        'book_appointment': 'book',
        'create_order': 'order',
        'set_reminder': 'schedule',
        'search_web': 'research',
        'check_solana_balance': 'research', // Balance checks fall under research/query
      };

      const requestedSkill = skillTypeMap[tool_name];
      if (requestedSkill) {
        const verification = await erc8004Service.verifyDelegation(delegationId, requestedSkill);
        
        if (!verification.valid) {
          console.error(`[ElevenLabs Webhook] ERC-8004 Verification Failed: ${verification.error}`);
          return NextResponse.json({
            error: `Permission Denied: This agent is not authorized to ${requestedSkill} for this user. ${verification.error}`,
          }, { status: 403 });
        }
        console.log(`[ElevenLabs Webhook] ✅ Delegation Authorized for ${requestedSkill}`);
      }
    }

    // 3. EXECUTE TOOL
    
    // Map tool name to Composio or Native Skills
    const toolSlugMap: Record<string, string> = {
      'check_solana_balance': 'SOLANA_GET_BALANCE',
      'get_github_repos': 'GITHUB_LIST_REPOS',
      'search_web': 'WEB_SEARCH',
    };

    const nativeSkills = ['book_appointment', 'create_order', 'set_reminder'];

    // Handle Native Skill Execution
    if (nativeSkills.includes(tool_name)) {
      console.log(`[ElevenLabs Webhook] Executing native skill: ${tool_name}`);
      
      // Mock wallet for execution (in production, use the platform's execution wallet)
      const mockWallet = { 
        account: { address: process.env.AGENT_WALLET as Address || '0x0000000000000000000000000000000000000000' },
        writeContract: async () => '0xmockhash' as Hash
      };
      
      const skillsFramework = createSkillsFramework(mockWallet);
      const skillType = tool_name.replace('_appointment', '').replace('create_', '').replace('set_', '') as any;
      
      const result = await skillsFramework.executeSkill(skillType, parameters, delegationId);
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ result: result.data });
    }

    // Handle Composio Tool Execution
    const toolSlug = toolSlugMap[tool_name];
    if (toolSlug) {
      console.log(`[ElevenLabs Webhook] Executing Composio tool: ${toolSlug}`);
      const result = await composioService.executeTool({
        tool_slug: toolSlug,
        arguments: parameters,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ result: result.data });
    }

    // Unknown Tool
    console.error(`[ElevenLabs Webhook] Unknown tool requested: ${tool_name}`);
    return NextResponse.json({
      error: `Unknown tool: ${tool_name}`,
    }, { status: 400 });

  } catch (error: any) {
    console.error('[ElevenLabs Webhook] Unexpected Error:', error);
    return NextResponse.json({
      error: error.message || 'Internal Server Error',
    }, { status: 500 });
  }
}
