import { NextRequest, NextResponse } from 'next/server';
import { composioService } from '@/lib/composio';
import { erc8004Service } from '@/lib/erc8004';
import { createSkillsFramework } from '@/lib/agent-skills';
import { searchAgents, rateAgent } from '@/lib/db';
import { Address, Hash, createWalletClient, http } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * ElevenLabs Conversational AI Webhook Handler
 *
 * Implements the VOISSS Layer 2 Orchestrator:
 *  1. Extract caller context from metadata.
 *  2. Verify ERC-8004 delegation for the requested action.
 *  3. Discover the best available specialized agent by skill specialty.
 *  4. Execute via Composio (external) or native AgentSkillsFramework.
 *  5. Record task completion in reputation registry (on-chain + local DB).
 */

// ============================================
// Constants
// ============================================

/**
 * Maps ElevenLabs tool_name → { skillType, specialty }
 *
 * skillType must match AgentSkillsFramework.executeSkill() SkillType union.
 * specialty must match the Agent.specialty[] values stored in the DB.
 */
const TOOL_CONFIG: Record<
  string,
  { skillType: 'book' | 'order' | 'schedule' | 'research'; specialty: string }
> = {
  book_appointment:         { skillType: 'book',     specialty: 'booking' },
  create_order:             { skillType: 'order',    specialty: 'ordering' },
  set_reminder:             { skillType: 'schedule', specialty: 'scheduling' },
  search_web:               { skillType: 'research', specialty: 'research' },
  check_solana_balance:     { skillType: 'research', specialty: 'blockchain' },
  get_github_repos:         { skillType: 'research', specialty: 'code' },
  get_github_repo_content:  { skillType: 'research', specialty: 'code' },
  get_weather:              { skillType: 'research', specialty: 'general' },
  compare_prices:           { skillType: 'research', specialty: 'research' },
};

/**
 * Tools that route to Composio instead of the native skills framework.
 * Key = tool_name, value = Composio action slug.
 */
const COMPOSIO_TOOLS: Record<string, string> = {
  check_solana_balance:     'SOLANA_GET_BALANCE',
  get_github_repos:         'GITHUB_LIST_REPOS',
  get_github_repo_content:  'GITHUB_GET_REPOSITORY_CONTENT',
  search_web:               'WEB_SEARCH',
};

// ============================================
// Helpers
// ============================================

/**
 * Build a viem walletClient backed by the platform facilitator key.
 * Used for on-chain reputation writes after task completion.
 */
function getFacilitatorWallet() {
  const key = process.env.FACILITATOR_PRIVATE_KEY;
  if (!key) return null;
  const account = privateKeyToAccount(key as `0x${string}`);
  const chain = process.env.NODE_ENV === 'production' ? celo : celoAlfajores;
  return createWalletClient({
    account,
    chain,
    transport: http(process.env.CELO_RPC_URL || 'https://forno.celo.org'),
  });
}

/**
 * Discover the best available specialized agent for a given specialty.
 *
 * Layer 2 "Agent Discovery" – queries the ERC-8004-backed local agent index
 * (Redis via lib/db.ts) for online agents matching the specialty, then
 * attempts an on-chain identity lookup for the top result.
 *
 * Returns the agent's DB record, or null if none is found.
 */
async function findAgentBySpecialty(specialty: string) {
  try {
    const matches = await searchAgents({ category: specialty, limit: 1 });
    if (matches.length > 0) {
      console.log(`[Webhook] Agent discovery: found '${matches[0].name}' for specialty '${specialty}'`);
      return matches[0];
    }
    // Fallback – any online agent
    const fallback = await searchAgents({ limit: 1 });
    if (fallback.length > 0) {
      console.log(`[Webhook] Agent discovery: using fallback agent '${fallback[0].name}'`);
      return fallback[0];
    }
  } catch (err) {
    console.warn('[Webhook] Agent discovery failed:', err);
  }
  return null;
}

/**
 * Record task completion in both the local Redis reputation store
 * and (if configured) the on-chain ERC-8004 Reputation Registry.
 *
 * Rating of 5 is used for successful task completion.
 */
async function recordTaskCompletion(agentId: string, toolName: string): Promise<void> {
  // 1. Local DB reputation update (always available)
  try {
    await rateAgent(agentId, 5);
    console.log(`[Webhook] ✅ Local reputation updated for agent ${agentId} (${toolName})`);
  } catch (err) {
    console.warn('[Webhook] Local reputation update failed:', err);
  }

  // 2. On-chain ERC-8004 Reputation Registry (best-effort, requires FACILITATOR_PRIVATE_KEY)
  const wallet = getFacilitatorWallet();
  if (!wallet) {
    console.log('[Webhook] Skipping on-chain reputation (FACILITATOR_PRIVATE_KEY not set)');
    return;
  }

  try {
    // agentId in the DB is a string; ERC-8004 uses uint256 tokenId.
    // If the agentId is a numeric tokenId, use it directly; otherwise skip.
    const tokenId = BigInt(agentId);
    await erc8004Service.submitFeedback(
      wallet as any,
      tokenId,
      5,           // rating: 5 stars for successful task
      'task_completed',
      `Task '${toolName}' completed successfully via VOISSS orchestrator`
    );
    console.log(`[Webhook] ✅ On-chain reputation recorded for tokenId ${tokenId}`);
  } catch {
    // agentId may not be a numeric tokenId – silently skip on-chain write
    console.log(`[Webhook] Skipping on-chain reputation (agentId '${agentId}' is not a tokenId)`);
  }
}

// ============================================
// Handler
// ============================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool_name, parameters, metadata } = body;

    console.log('[ElevenLabs Webhook] Tool call received:', {
      tool_name,
      metadata: metadata || 'none',
    });

    // --------------------------------------------------------
    // 1. Extract caller context
    // --------------------------------------------------------
    const userAddress = (metadata?.user_address || process.env.AGENT_WALLET) as Address;
    const delegationId = metadata?.delegation_id as Hash | undefined;

    // --------------------------------------------------------
    // 2. Resolve tool config
    // --------------------------------------------------------
    const toolConfig = TOOL_CONFIG[tool_name];
    if (!toolConfig) {
      console.error(`[ElevenLabs Webhook] Unknown tool: ${tool_name}`);
      return NextResponse.json({ error: `Unknown tool: ${tool_name}` }, { status: 400 });
    }

    // --------------------------------------------------------
    // 3. Verify ERC-8004 delegation
    // --------------------------------------------------------
    if (delegationId) {
      console.log(`[Webhook] Verifying delegation ${delegationId} for '${toolConfig.skillType}'`);
      const verification = await erc8004Service.verifyDelegation(delegationId, toolConfig.skillType);
      if (!verification.valid) {
        console.error(`[Webhook] Delegation denied: ${verification.error}`);
        return NextResponse.json(
          { error: `Permission Denied: ${verification.error}` },
          { status: 403 }
        );
      }
      console.log(`[Webhook] ✅ Delegation verified for '${toolConfig.skillType}'`);
    }

    // --------------------------------------------------------
    // 4. Agent discovery (Layer 2 routing)
    // --------------------------------------------------------
    const matchedAgent = await findAgentBySpecialty(toolConfig.specialty);
    if (matchedAgent) {
      console.log(`[Webhook] Routing to agent: ${matchedAgent.name} (${matchedAgent.id})`);
    }

    // --------------------------------------------------------
    // 5. Execute tool
    // --------------------------------------------------------
    let result: { success: boolean; data?: unknown; error?: string };

    if (COMPOSIO_TOOLS[tool_name]) {
      // --- Composio path ---
      const slug = COMPOSIO_TOOLS[tool_name];
      console.log(`[Webhook] Composio → ${slug}`);
      const composioResult = await composioService.executeTool({
        tool_slug: slug,
        arguments: parameters,
      });
      result = composioResult;
    } else {
      // --- Native skills path ---
      console.log(`[Webhook] Native skill → ${toolConfig.skillType}`);
      const executionWallet = {
        account: {
          address: (matchedAgent?.owner as Address) ||
            (process.env.AGENT_WALLET as Address) ||
            '0x0000000000000000000000000000000000000000',
        },
        writeContract: async () => '0xmockhash' as Hash,
      };

      const framework = createSkillsFramework(executionWallet);
      const skillResult = await framework.executeSkill(
        toolConfig.skillType,
        parameters,
        delegationId
      );
      result = { success: skillResult.success, data: skillResult.data, error: skillResult.error };
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // --------------------------------------------------------
    // 6. Record task completion in reputation registry
    // --------------------------------------------------------
    if (matchedAgent) {
      // Fire-and-forget – don't block the response
      recordTaskCompletion(matchedAgent.id, tool_name).catch(err =>
        console.error('[Webhook] Reputation update error:', err)
      );
    }

    return NextResponse.json({ result: result.data });

  } catch (error: any) {
    console.error('[ElevenLabs Webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
