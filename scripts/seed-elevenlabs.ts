#!/usr/bin/env npx tsx
/**
 * ============================================
 * VOISSS ElevenLabs Agent Seeder
 * ============================================
 * Creates the 4 canonical VOISSS agents in ElevenLabs Conversational AI,
 * registers their tools with the webhook endpoint, and prints the .env
 * variables you need to add to .env.local.
 *
 * Usage:
 *   npx tsx scripts/seed-elevenlabs.ts
 *
 * Required env vars (in .env.local before running):
 *   ELEVENLABS_API_KEY
 *   NEXT_PUBLIC_WEBHOOK_URL   (e.g. https://yourapp.vercel.app)
 *
 * What it does:
 *   1. Creates (or re-uses) webhook tools for all skill types.
 *   2. Creates (or updates) one ConvAI agent per registry entry.
 *   3. Outputs the ELEVENLABS_AGENT_* env vars to add to .env.local.
 * ============================================
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.ELEVENLABS_API_KEY ?? '';
const WEBHOOK_BASE = (process.env.NEXT_PUBLIC_WEBHOOK_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const WEBHOOK_URL = `${WEBHOOK_BASE}/api/webhooks/elevenlabs`;
const BASE = 'https://api.elevenlabs.io/v1';

if (!API_KEY) {
  console.error('❌  ELEVENLABS_API_KEY is not set in .env.local');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool definitions — each maps to a key in the webhook's TOOL_CONFIG
// ──────────────────────────────────────────────────────────────────────────────

interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

const TOOLS: ToolDef[] = [
  {
    name: 'book_appointment',
    description: 'Book an appointment or reservation on behalf of the user. Requires delegation.',
    parameters: {
      type: 'object',
      properties: {
        serviceType: { type: 'string', description: 'Type of service', enum: ['appointment', 'consultation', 'reservation'] },
        providerId: { type: 'string', description: 'Provider or vendor identifier' },
        providerName: { type: 'string', description: 'Human-readable provider name' },
        dateTime: { type: 'string', description: 'ISO 8601 datetime for the appointment' },
        duration: { type: 'number', description: 'Duration in minutes' },
        notes: { type: 'string', description: 'Optional notes or special requests' },
      },
      required: ['serviceType', 'providerName', 'dateTime', 'duration'],
    },
  },
  {
    name: 'create_order',
    description: 'Place an order (food, products, services) on behalf of the user. Requires delegation.',
    parameters: {
      type: 'object',
      properties: {
        vendorId: { type: 'string', description: 'Vendor identifier' },
        vendorName: { type: 'string', description: 'Vendor display name' },
        items: { type: 'string', description: 'JSON string of order items [{itemId, name, quantity, price}]' },
        specialInstructions: { type: 'string', description: 'Optional delivery or special instructions' },
      },
      required: ['vendorName', 'items'],
    },
  },
  {
    name: 'set_reminder',
    description: 'Schedule a reminder, meeting, or task for the user. Requires delegation.',
    parameters: {
      type: 'object',
      properties: {
        eventType: { type: 'string', description: 'Type of event', enum: ['reminder', 'meeting', 'call', 'task'] },
        title: { type: 'string', description: 'Title or description of the event' },
        dateTime: { type: 'string', description: 'ISO 8601 datetime' },
        duration: { type: 'number', description: 'Duration in minutes (optional)' },
        reminderBefore: { type: 'number', description: 'Minutes before to send reminder' },
      },
      required: ['eventType', 'title', 'dateTime'],
    },
  },
  {
    name: 'search_web',
    description: 'Search the web for real-time information on any topic.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        maxResults: { type: 'number', description: 'Maximum number of results (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'check_solana_balance',
    description: 'Check the SOL or token balance of a Solana wallet address.',
    parameters: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string', description: 'The Solana wallet address (base58)' },
        token: { type: 'string', description: 'Token symbol (SOL, USDC, etc.) — defaults to SOL' },
      },
      required: ['walletAddress'],
    },
  },
  {
    name: 'get_github_repos',
    description: 'List GitHub repositories for a user or organization.',
    parameters: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'GitHub username or org name' },
        limit: { type: 'number', description: 'Maximum number of repos to return' },
      },
      required: ['username'],
    },
  },
  {
    name: 'get_github_repo_content',
    description: 'Get the content of a file or directory in a GitHub repository.',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (username or org)' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File or directory path within the repo' },
      },
      required: ['owner', 'repo', 'path'],
    },
  },
  {
    name: 'compare_prices',
    description: 'Compare prices for a product or service across multiple vendors.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Product or service to compare' },
        category: { type: 'string', description: 'Category (flights, hotels, electronics, etc.)' },
        location: { type: 'string', description: 'Location or market (optional)' },
      },
      required: ['query'],
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Agent definitions (mirrors lib/agent-registry.ts, standalone for seeding)
// ──────────────────────────────────────────────────────────────────────────────

interface AgentDef {
  key: string;
  envKey: string;
  name: string;
  voiceId: string;
  systemPrompt: string;
  toolNames: string[];
}

const AGENTS: AgentDef[] = [
  {
    key: 'solana_sage',
    envKey: 'ELEVENLABS_AGENT_SOLANA_SAGE',
    name: 'Solana Sage',
    voiceId: process.env.ELEVENLABS_VOICE_SOLANA_SAGE ?? 'TxGEqnHWrfWFTfGW9XjX',
    systemPrompt: `You are Solana Sage, an expert AI agent specializing in Solana blockchain, DeFi protocols, and on-chain analytics. You can check wallet balances and look up transactions in real time. When a user wants a balance or transaction lookup, call the check_solana_balance or search_web tool immediately — never make up data. Be concise, precise, and explain technical results in plain language. Always confirm the wallet address before executing a lookup.`,
    toolNames: ['check_solana_balance', 'search_web'],
  },
  {
    key: 'code_reviewer',
    envKey: 'ELEVENLABS_AGENT_CODE_REVIEWER',
    name: 'Code Reviewer',
    voiceId: process.env.ELEVENLABS_VOICE_CODE_REVIEWER ?? 'ErXwobaYiN019PkySvjV',
    systemPrompt: `You are a senior software engineer and code reviewer. You help developers with code quality, architecture decisions, debugging, and best practices. When a user wants to review a repo or file, call get_github_repos or get_github_repo_content immediately. Be specific, actionable, and assume the user is a competent developer. When scheduling a follow-up review, use set_reminder.`,
    toolNames: ['get_github_repos', 'get_github_repo_content', 'search_web', 'set_reminder'],
  },
  {
    key: 'general_helper',
    envKey: 'ELEVENLABS_AGENT_GENERAL_HELPER',
    name: 'General Helper',
    voiceId: process.env.ELEVENLABS_VOICE_GENERAL_HELPER ?? 'pNInz6obpgDQGcFmaJgB',
    systemPrompt: `You are a helpful, friendly AI concierge. You can book appointments, place orders, set reminders, and research almost anything. Before executing any book, order, or schedule action, briefly confirm: "I'm about to [action] on your behalf — shall I proceed?" Then call the tool. Be warm, efficient, and always narrate what you did after the tool returns. You accept USDC on Arbitrum.`,
    toolNames: ['book_appointment', 'create_order', 'set_reminder', 'search_web'],
  },
  {
    key: 'tour_master',
    envKey: 'ELEVENLABS_AGENT_TOUR_MASTER',
    name: 'Tour Master',
    voiceId: process.env.ELEVENLABS_VOICE_TOUR_MASTER ?? '21m00Tcm4TlvDq8ikWAM',
    systemPrompt: `You are Tour Master, a world-class travel planner. You help users plan trips, research destinations, find hotels, compare prices, and book travel. When a user asks about a destination or price comparison, call search_web or compare_prices immediately. For bookings, call book_appointment. Be enthusiastic and always include cost estimates.`,
    toolNames: ['search_web', 'compare_prices', 'book_appointment'],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// ElevenLabs API helpers
// ──────────────────────────────────────────────────────────────────────────────

async function apiGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'xi-api-key': API_KEY },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPatch(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀  VOISSS ElevenLabs Agent Seeder');
  console.log(`📡  Webhook URL: ${WEBHOOK_URL}\n`);

  // ── Step 1: Upsert workspace tools ────────────────────────────────────────
  console.log('── Step 1: Upserting workspace tools ──────────────────────────');

  let existingTools: any[] = [];
  try {
    const data = await apiGet('/convai/tools');
    existingTools = data.tools ?? [];
    console.log(`   Found ${existingTools.length} existing tools`);
  } catch (e) {
    console.warn('   Could not list existing tools (workspace may be empty):', e);
  }

  const toolIdMap: Record<string, string> = {};

  for (const tool of TOOLS) {
    const existing = existingTools.find((t: any) => t.name === tool.name);
    if (existing) {
      toolIdMap[tool.name] = existing.tool_id;
      console.log(`   ✓  ${tool.name} already exists (${existing.tool_id})`);
      continue;
    }

    try {
      // ElevenLabs ConvAI tool schema (v1, 2025):
      // - tool_config is a discriminated union on "type"
      // - When type="webhook", tool_config has: name, description, api_schema
      // - api_schema is an object with: url, method, plus the request body JSON schema
      //   (url and method live INSIDE api_schema, not at the tool_config level)
      const created = await apiPost('/convai/tools', {
        name: tool.name,
        tool_config: {
          type: 'webhook',
          name: tool.name,
          description: tool.description,
          api_schema: {
            url: WEBHOOK_URL,
            method: 'POST',
            // POST method requires the JSON schema under "request_body_schema"
            request_body_schema: tool.parameters,
          },
        },
      });
      // The API may return id as "tool_id", "id", or nested in the response
      const toolId = created.tool_id ?? created.id ?? created.data?.tool_id ?? created.data?.id;
      toolIdMap[tool.name] = toolId;
      console.log(`   ✅  Created ${tool.name} → ${toolId ?? JSON.stringify(Object.keys(created))}`);
    } catch (e) {
      console.error(`   ❌  Failed to create tool ${tool.name}:`, e);
    }
  }

  // ── Step 2: Create / update agents ────────────────────────────────────────
  console.log('\n── Step 2: Creating / updating agents ─────────────────────────');

  let existingAgents: any[] = [];
  try {
    const data = await apiGet('/convai/agents');
    existingAgents = data.agents ?? [];
    console.log(`   Found ${existingAgents.length} existing agents`);
  } catch (e) {
    console.warn('   Could not list existing agents:', e);
  }

  const results: Record<string, string> = {};

  for (const agent of AGENTS) {
    // Resolve tool IDs for this agent
    const resolvedToolIds = agent.toolNames
      .map(n => toolIdMap[n])
      .filter(Boolean);

    const existing = existingAgents.find((a: any) => a.name === agent.name);

    // ⚠️  Send ONLY the agent section — omit tts/asr completely.
    //    ElevenLabs re-validates the FULL merged config on every PATCH, and any
    //    tts.model_id or asr override triggers "English Agents must use turbo or
    //    flash v2". Sending just the prompt + first_message + tool_ids is safe.
    //    Voice can be updated separately via the ElevenLabs dashboard if needed.
    const agentSection = {
      conversation_config: {
        agent: {
          prompt: {
            prompt: agent.systemPrompt,
          },
          first_message: `Hello! I'm ${agent.name}. How can I assist you today?`,
          language: 'en',
          tool_ids: resolvedToolIds,
        },
      },
    };

    try {
      if (existing) {
        await apiPatch(`/convai/agents/${existing.agent_id}`, agentSection);
        results[agent.envKey] = existing.agent_id;
        console.log(`   ✅  Updated ${agent.name} → ${existing.agent_id}`);
      } else {
        // ElevenLabs create endpoint is POST /convai/agents/create (not /convai/agents)
        const created = await apiPost('/convai/agents/create', {
          name: agent.name,
          ...agentSection,
        });
        results[agent.envKey] = created.agent_id;
        console.log(`   ✅  Created ${agent.name} → ${created.agent_id}`);
      }
    } catch (e) {
      console.error(`   ❌  Failed to create/update ${agent.name}:`, e);
    }
  }

  // ── Step 3: Print .env additions ──────────────────────────────────────────
  console.log('\n── Step 3: Add these to your .env.local ────────────────────────');
  console.log('\n# ElevenLabs Conversational AI Agent IDs (auto-generated by seed-elevenlabs.ts)');
  for (const [envKey, agentId] of Object.entries(results)) {
    console.log(`${envKey}=${agentId}`);
  }

  console.log('\n# ERC-8004 tokenIds (add after deploying contracts and registering agents)');
  for (const agent of AGENTS) {
    const tokenEnvKey = `ERC8004_TOKEN_${agent.key.toUpperCase()}`;
    console.log(`${tokenEnvKey}=   # Set after on-chain registration`);
  }

  console.log('\n✅  Done! Update your .env.local and redeploy.\n');
}

main().catch(err => {
  console.error('\n❌  Seeding failed:', err);
  process.exit(1);
});
