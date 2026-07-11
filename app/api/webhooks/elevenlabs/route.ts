import { NextRequest, NextResponse } from 'next/server';
import { composioService } from '@/lib/composio';
import { erc8004Service } from '@/lib/erc8004';
import { createSkillsFramework } from '@/lib/agent-skills';
import { searchAgents, rateAgent } from '@/lib/db';
import {
  AGENT_REGISTRY,
  findBySpecialty,
  findByElevenLabsId,
  agentCanUseSkill,
  type SkillType,
} from '@/lib/agent-registry';
import { firecrawlScrape } from '@/lib/firecrawl';
import { Address, Hash, createWalletClient, http } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ACTIVE_CHAIN_ID, RPC_URL } from '@/lib/arbitrum-chain';
import { veniceAI } from '@/lib/venice-ai';
import { oneshotRelayer } from '@/lib/oneshot-relayer';

/**
 * ElevenLabs Conversational AI Webhook Handler
 *
 * Implements the VOISSS Layer 2 Orchestrator:
 *  1. Identify which ConvAI agent is calling (via metadata.agent_key).
 *  2. Resolve the caller's wallet from metadata.user_address.
 *  3. Verify ERC-8004 delegation for the requested skill type.
 *  4. Guard: confirm the calling agent is allowed to use that skill.
 *  5. Execute via Composio (external) or native AgentSkillsFramework.
 *  6. Record task completion in the ERC-8004 Reputation Registry.
 *  7. Return a human-readable narration string for ElevenLabs to speak aloud.
 */

// ============================================
// Tool → Skill type map
// ============================================

/** Maps ElevenLabs tool_name → skill type used by AgentSkillsFramework */
const TOOL_SKILL: Record<string, SkillType> = {
  book_appointment:         'book',
  create_order:             'order',
  set_reminder:             'schedule',
  search_web:               'research',
  firecrawl_search:         'research',
  firecrawl_scrape:         'research',
  check_solana_balance:     'research',
  get_github_repos:         'research',
  get_github_repo_content:  'research',
  get_weather:              'research',
  compare_prices:           'research',
  venice_research:          'research',
  venice_code_review:       'research',
  gasless_settle:           'book',
};

/**
 * Tools that route to Composio instead of the native skills framework.
 * Key = tool_name, value = Composio action slug.
 *
 * NOTE: search_web is here as a fallback when Firecrawl is not configured.
 *       The handler checks FIRECRAWL_API_KEY first and routes through native
 *       ResearchSkill (Firecrawl) when available, otherwise falls back to Composio.
 */
const COMPOSIO_TOOLS: Record<string, string> = {
  check_solana_balance:     'SOLANA_GET_BALANCE',
  get_github_repos:         'GITHUB_LIST_REPOS',
  get_github_repo_content:  'GITHUB_GET_REPOSITORY_CONTENT',
  search_web:               'WEB_SEARCH',
};

// ============================================
// Response narration formatter
// ============================================
// ElevenLabs expects: { result: "<spoken string>" }
// The agent narrates this back to the caller.

function formatNarration(toolName: string, data: unknown): string {
  try {
    const d = data as Record<string, any>;

    switch (toolName) {
      case 'book_appointment': {
        const b = d?.booking;
        if (!b) return 'Your booking has been placed.';
        return `Your ${b.serviceType} with ${b.provider} has been confirmed for ${new Date(b.dateTime).toLocaleString()}. The booking reference is ${b.bookingId}.`;
      }
      case 'create_order': {
        const o = d?.order;
        if (!o) return 'Your order has been placed.';
        return `Order confirmed with ${o.vendor}. Total: $${o.total}. Estimated delivery: ${o.estimatedDelivery ? new Date(o.estimatedDelivery).toLocaleDateString() : 'TBD'}. Order ID: ${o.orderId}.`;
      }
      case 'set_reminder': {
        const s = d?.schedule;
        if (!s) return 'Your reminder has been set.';
        return `Got it! I've scheduled "${s.title}" for ${new Date(s.dateTime).toLocaleString()}. I'll remind you ${s.reminders[0] ? `${s.reminders[0]} minutes before.` : 'at the scheduled time.'}`;
      }
      case 'search_web':
      case 'firecrawl_search': {
        if (Array.isArray(d?.results)) {
          const top = d.results.slice(0, 2).map((r: any) => r.title ?? r.snippet).join('. ');
          return `Here's what I found: ${top}${d.results.length > 2 ? ` And ${d.results.length - 2} more results.` : ''}`;
        }
        if (d?.summary) return d.summary;
        return 'I found some results. Would you like me to go deeper on any of them?';
      }
      case 'firecrawl_scrape': {
        if (d?.title) return `I scraped the page "${d.title}". It has ${d.markdown ? (d.markdown as string).split('\n').length : 0} lines of content. Would you like me to summarize it?`;
        if (d?.markdown) return `I retrieved the page content. It's ${(d.markdown as string).split('\n').length} lines long. Want me to summarize?`;
        return 'I scraped the page. Would you like me to summarize the content?';
      }
      case 'check_solana_balance': {
        if (d?.balance !== undefined) return `The wallet balance is ${d.balance} ${d.token ?? 'SOL'}.`;
        return 'I was unable to retrieve the balance. Please verify the wallet address.';
      }
      case 'get_github_repos': {
        const repos = d?.repositories ?? d?.repos ?? [];
        if (repos.length === 0) return 'I could not find any repositories for that user.';
        return `Found ${repos.length} repositories. The most recent are: ${repos.slice(0, 3).map((r: any) => r.name ?? r).join(', ')}.`;
      }
      case 'get_github_repo_content': {
        if (d?.content) return `Here's the content of that file. It's ${(d.content as string).split('\n').length} lines long.`;
        return 'I retrieved the repository content. Would you like me to summarize it?';
      }
      case 'compare_prices': {
        if (d?.results?.length) {
          const cheapest = d.results[0];
          return `The best price I found for "${d.query ?? 'that item'}" is ${cheapest.price ?? cheapest.name}. Shall I book it?`;
        }
        return 'I compared prices and found some options. Would you like details?';
      }
      case 'venice_research': {
        const points = d?.keyPoints as string[] | undefined;
        if (points?.length) {
          return `${d.summary} Key points: ${points.join('. ')}.`;
        }
        return d?.summary || 'I completed the Venice AI research. Would you like me to go deeper?';
      }
      case 'venice_code_review': {
        const issues = d?.issues as Array<{ severity: string; description: string }> | undefined;
        const critical = issues?.filter(i => i.severity === 'high').length || 0;
        if (critical > 0) {
          return `${d.summary} I found ${critical} critical issues and ${issues!.length - critical} other concerns. Would you like me to go through them?`;
        }
        return d?.summary || 'I reviewed the code. Would you like me to elaborate on my findings?';
      }
      case 'gasless_settle': {
        if (d?.txHash) {
          return `Payment settled via 1Shot Permissionless Relayer. Transaction: ${(d.txHash as string).slice(0, 10)}... No gas fees were charged.`;
        }
        return 'Payment settlement was initiated via 1Shot. You can check the transaction on Arbiscan.';
      }
      default:
        return typeof data === 'string' ? data : 'Done! Is there anything else I can help with?';
    }
  } catch {
    return 'I completed the task. Is there anything else you need?';
  }
}

// ============================================
// Helpers
// ============================================

function getFacilitatorWallet() {
  const key = process.env.FACILITATOR_PRIVATE_KEY;
  if (!key || !key.startsWith('0x') || key.length !== 66) return null;
  const account = privateKeyToAccount(key as `0x${string}`);
  const chain = process.env.NODE_ENV === 'production' ? arbitrum : arbitrumSepolia;
  return createWalletClient({
    account,
    chain,
    transport: http(process.env.ARBITRUM_RPC_URL || RPC_URL),
  });
}

/**
 * Record task completion in both the local reputation store
 * and (if configured) the on-chain ERC-8004 Reputation Registry.
 */
async function recordTaskCompletion(
  agentId: string,
  tokenId: bigint | null,
  toolName: string
): Promise<void> {
  // 1. Local DB (always available)
  try {
    await rateAgent(agentId, 5);
  } catch (err) {
    console.warn('[Webhook] Local reputation update failed:', err);
  }

  // 2. On-chain ERC-8004 (requires FACILITATOR_PRIVATE_KEY + tokenId)
  if (!tokenId) {
    console.log(`[Webhook] Skipping on-chain reputation (no ERC8004_TOKEN_* set for ${agentId})`);
    return;
  }

  const wallet = getFacilitatorWallet();
  if (!wallet) {
    console.log('[Webhook] Skipping on-chain reputation (FACILITATOR_PRIVATE_KEY not set)');
    return;
  }

  try {
    await erc8004Service.submitFeedback(
      wallet as any,
      tokenId,
      5,
      'task_completed',
      `Task '${toolName}' completed successfully via VOISSS orchestrator`
    );
    console.log(`[Webhook] ✅ On-chain reputation recorded for tokenId ${tokenId}`);
  } catch (err) {
    console.warn('[Webhook] On-chain reputation update failed (non-fatal):', err);
  }
}

// ============================================
// Venice AI Tool Handlers
// ============================================

async function handleVeniceResearch(
  query: string,
  context?: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!veniceAI.isConfigured) {
    return { success: false, error: 'Venice AI is not configured. Set VENICE_API_KEY.' };
  }
  try {
    const result = await veniceAI.research(query, context);
    return {
      success: true,
      data: { summary: result.summary, keyPoints: result.keyPoints, confidence: result.confidence, model: result.model, source: 'Venice AI (privacy-first)' },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Venice research failed' };
  }
}

async function handleVeniceCodeReview(
  code: string,
  language?: string,
  focus?: string[]
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!veniceAI.isConfigured) {
    return { success: false, error: 'Venice AI is not configured. Set VENICE_API_KEY.' };
  }
  try {
    const result = await veniceAI.codeReview({ code, language, focus });
    return {
      success: true,
      data: { summary: result.summary, issues: result.issues, suggestions: result.suggestions, source: 'Venice AI (privacy-first code review)' },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Venice code review failed' };
  }
}

// ============================================
// 1Shot Gasless Settlement Handler
// ============================================

async function handleGaslessSettlement(
  calldata: string,
  token: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const result = await oneshotRelayer.relayPayment({
      calldata: calldata as `0x${string}`,
      token: token as `0x${string}`,
    });
    if (!result.success) return { success: false, error: result.error || '1Shot relay failed' };
    return { success: true, data: { txHash: result.txHash, explorerUrl: result.explorerUrl, settledVia: '1Shot Permissionless Relayer (gasless)' } };
  } catch (err: any) {
    return { success: false, error: err.message || '1Shot settlement failed' };
  }
}

// ============================================
// Handler
// ============================================

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret
    const { verifyElevenLabsWebhook } = await import('@/lib/api-auth');
    if (!verifyElevenLabsWebhook(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Handle conversation_ended events — persist transcripts
    if (body.type === 'conversation_ended' || body.event === 'conversation_ended') {
      const { conversation_id, transcript, agent_id, user_address, duration_seconds } = body;

      if (conversation_id && transcript) {
        const callId = `el_${conversation_id}`;
        const callData: Record<string, string> = {
          id: callId,
          agent_id: agent_id || '',
          agent_name: '',
          agent_specialty: '',
          caller_address: (user_address || 'anonymous').toLowerCase(),
          status: 'completed',
          duration_seconds: String(duration_seconds || 0),
          total_cost: '0',
          transcripts: JSON.stringify(
            Array.isArray(transcript)
              ? transcript
              : [{ text: String(transcript), speaker: 'agent', timestamp: Date.now(), isFinal: true }]
          ),
          ended_at: new Date().toISOString(),
          source: 'webhook',
        };

        const { redis } = await import('@/lib/redis');
        await redis.hset(`call:${callId}`, callData);
        if (callData.caller_address !== 'anonymous') {
          await redis.sadd(`call_index:${callData.caller_address}`, callId);
        }

        console.log(`[ElevenLabs Webhook] Saved transcript for conversation ${conversation_id}`);
      }

      return NextResponse.json({ received: true });
    }

    // Handle transcript events — stream in real-time via SSE
    if (body.type === 'transcript' || body.event === 'transcript') {
      const { conversation_id, text, speaker, is_final } = body;

      if (conversation_id && text) {
        const transcriptData = {
          text: String(text),
          speaker: speaker || 'agent',
          timestamp: Date.now(),
          isFinal: is_final !== false,
        };

        // Store in Redis for persistence
        const { redis } = await import('@/lib/redis');
        const key = `transcript:${conversation_id}`;
        await redis.lpush(key, JSON.stringify(transcriptData));
        // Keep last 100 transcript segments per conversation
        await redis.ltrim(key, 0, 99);

        // Publish to Redis pub/sub for real-time SSE streaming
        await redis.publish(`transcript:${conversation_id}`, JSON.stringify(transcriptData));

        console.log(`[ElevenLabs Webhook] Transcript event for ${conversation_id}: "${String(text).slice(0, 50)}..."`);
      }

      return NextResponse.json({ received: true });
    }

    // Handle tool calls (existing flow)
    const { tool_name, parameters, metadata = {} } = body;

    console.log('[ElevenLabs Webhook] Tool call:', {
      tool_name,
      agent_key: metadata.agent_key ?? '(not provided)',
      user_address: metadata.user_address ?? '(not provided)',
    });

    // ── 1. Resolve the skill type ────────────────────────────────────────────
    const skillType = TOOL_SKILL[tool_name];
    if (!skillType) {
      return NextResponse.json({ error: `Unknown tool: ${tool_name}` }, { status: 400 });
    }

    // ── 2. Identify calling agent from registry ──────────────────────────────
    // ElevenLabs passes the conversational agent ID in metadata.
    // We resolve it to our canonical registry entry.
    let registryEntry =
      metadata.agent_key
        ? AGENT_REGISTRY[metadata.agent_key] ?? null
        : metadata.agent_id
        ? findByElevenLabsId(metadata.agent_id)
        : null;

    // Fallback: discover by specialty if agent not identified
    if (!registryEntry) {
      registryEntry = findBySpecialty(skillType) ?? AGENT_REGISTRY['general_helper'];
    }

    console.log(`[Webhook] Agent: ${registryEntry.name} (${registryEntry.key})`);

    // ── 3. Guard: agent must be allowed to use this skill ────────────────────
    if (!agentCanUseSkill(registryEntry.key, skillType)) {
      console.error(`[Webhook] Skill guard denied: ${registryEntry.name} cannot '${skillType}'`);
      return NextResponse.json(
        { result: `I'm sorry, I'm not authorized to perform ${skillType} actions. Please try a different agent.` },
        { status: 200 } // Return 200 so ElevenLabs narrates the message
      );
    }

    // ── 4. Extract caller context ────────────────────────────────────────────
    const userAddress = (metadata.user_address || process.env.AGENT_WALLET) as Address;
    const delegationId = metadata.delegation_id as Hash | undefined;

    // ── 5. Verify ERC-8004 delegation ────────────────────────────────────────
    if (delegationId) {
      const verification = await erc8004Service.verifyDelegation(delegationId, skillType);
      if (!verification.valid) {
        console.error(`[Webhook] Delegation denied: ${verification.error}`);
        return NextResponse.json(
          { result: `I don't have permission to ${skillType} on your behalf. Please grant the required delegation first.` },
          { status: 200 }
        );
      }
      console.log(`[Webhook] ✅ Delegation verified for '${skillType}'`);
    } else if (['book', 'order', 'schedule'].includes(skillType)) {
      // Action skills require a real integration — never simulate success
      if (!COMPOSIO_TOOLS[tool_name] && !process.env.COMPOSIO_API_KEY) {
        return NextResponse.json(
          {
            result: `I can't ${skillType} for real yet — that integration isn't connected. I can help you plan the steps instead.`,
          },
          { status: 200 }
        );
      }
      if (!delegationId) {
        return NextResponse.json(
          {
            result: `To ${skillType} on your behalf, I need a delegation. Please grant VOISSS permission in your profile settings first.`,
          },
          { status: 200 }
        );
      }
    }

    // ── 6. Execute tool ──────────────────────────────────────────────────────
    let result: { success: boolean; data?: unknown; error?: string };

    if (tool_name === 'venice_research') {
      const query = parameters.query as string;
      const context = parameters.context as string | undefined;
      if (!query) {
        result = { success: false, error: 'Missing required parameter: query' };
      } else {
        console.log(`[Webhook] venice_research → Venice AI (privacy-first)`);
        result = await handleVeniceResearch(query, context);
      }
    } else if (tool_name === 'venice_code_review') {
      const code = parameters.code as string;
      const language = parameters.language as string | undefined;
      const focus = parameters.focus as string[] | undefined;
      if (!code) {
        result = { success: false, error: 'Missing required parameter: code' };
      } else {
        console.log(`[Webhook] venice_code_review → Venice AI (privacy-first)`);
        result = await handleVeniceCodeReview(code, language, focus);
      }
    } else if (tool_name === 'gasless_settle') {
      const calldata = parameters.calldata as string;
      const token = parameters.token as string;
      if (!calldata || !token) {
        result = { success: false, error: 'Missing required parameters: calldata, token' };
      } else {
        console.log(`[Webhook] gasless_settle → 1Shot Permissionless Relayer`);
        result = await handleGaslessSettlement(calldata, token);
      }
    } else if (tool_name === 'firecrawl_scrape') {
      // Direct Firecrawl scrape — bypass skills framework
      const url = parameters.url as string;
      if (!url) {
        result = { success: false, error: 'Missing required parameter: url' };
      } else {
        try {
          const scraped = await firecrawlScrape(url);
          result = { success: true, data: scraped };
        } catch (err: any) {
          result = { success: false, error: err.message ?? 'Firecrawl scrape failed' };
        }
      }
    } else if (tool_name === 'search_web' && process.env.FIRECRAWL_API_KEY) {
      // Prefer Firecrawl for search_web when configured
      console.log(`[Webhook] search_web → Firecrawl (native)`);
      const framework = createSkillsFramework(null);
      const skillResult = await framework.executeSkill(skillType, parameters, delegationId);
      result = { success: skillResult.success, data: skillResult.data, error: skillResult.error };
    } else if (COMPOSIO_TOOLS[tool_name]) {
      const slug = COMPOSIO_TOOLS[tool_name];
      console.log(`[Webhook] Composio → ${slug}`);
      result = await composioService.executeTool({ tool_slug: slug, arguments: parameters });
    } else if (['book', 'order', 'schedule'].includes(skillType)) {
      result = {
        success: false,
        error: `Real ${skillType} is not available — no connected integration for this tool.`,
      };
    } else {
      console.log(`[Webhook] Native skill → ${skillType}`);
      const framework = createSkillsFramework(null);
      const skillResult = await framework.executeSkill(skillType, parameters, delegationId);
      result = { success: skillResult.success, data: skillResult.data, error: skillResult.error };
    }

    if (!result.success) {
      const errorMsg = result.error ?? 'Something went wrong. Please try again.';
      console.error(`[Webhook] Tool execution failed: ${errorMsg}`);
      return NextResponse.json({ result: `I encountered an issue: ${errorMsg}` }, { status: 200 });
    }

    // ── 7. Record task completion (fire-and-forget) ──────────────────────────
    // Find the Redis agent record for local reputation update
    const dbAgent = await searchAgents({
      category: registryEntry.specialties[0],
      limit: 1,
    }).then(r => r[0]).catch(() => null);

    if (dbAgent) {
      recordTaskCompletion(dbAgent.id, registryEntry.tokenId, tool_name).catch(err =>
        console.error('[Webhook] Reputation update error:', err)
      );
    }

    // ── 8. Return narration string for ElevenLabs to speak ───────────────────
    const narration = formatNarration(tool_name, result.data);

    console.log(`[Webhook] ${tool_name} → narrating: "${narration.slice(0, 80)}…"`);

    return NextResponse.json({ result: narration });

  } catch (error: any) {
    console.error('[ElevenLabs Webhook] Unexpected error:', error);
    return NextResponse.json(
      { result: 'I ran into an unexpected issue. Please try again in a moment.' },
      { status: 200 } // 200 so ElevenLabs narrates the error
    );
  }
}
