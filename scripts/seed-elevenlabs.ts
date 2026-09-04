#!/usr/bin/env npx tsx
/**
 * ============================================
 * Claflin ElevenLabs Broker Seeder
 * ============================================
 * Creates the Claflin brokers in ElevenLabs Conversational AI,
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
 *   2. Creates (or updates) one ConvAI broker per entry in AGENTS.
 *   3. Outputs the ELEVENLABS_AGENT_<KEY> env vars to add to .env.local.
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
    name: 'search_web',
    description: 'Search the web for real-time market info, stock prices, tokenized-stock context, and broker-relevant news.',
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
    name: 'route_to_agent',
    description: 'Internal routing tool — not used by user-facing brokers.',
    parameters: {
      type: 'object',
      properties: {
        specialty: { type: 'string', description: 'Target specialty or broker desk' },
      },
      required: ['specialty'],
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Broker definitions (mirrors lib/agent-registry.ts, standalone for seeding)
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
    key: 'general_helper',
    envKey: 'ELEVENLABS_AGENT_GENERAL_HELPER',
    name: 'Hetty',
    voiceId: process.env.ELEVENLABS_VOICE_GENERAL_HELPER ?? 'pNInz6obpgDQGcFmaJgB',
    systemPrompt: `You are Hetty, the first Claflin broker. You help users research tokenized stocks, check market context, and capture trade intent — but you never execute real-money orders. You are conservative, independent, and obsessed with confirmation. Before you record any trade intent, briefly confirm: "I'm about to note a paper trade for [ticker] [quantity] [side] — shall I proceed?" Only proceed if the user clearly agrees. Be warm, efficient, and always narrate what you did. You can search the web for current market info when a user asks. You work on the Arbitrum network and USDC is the settlement currency.`,
    toolNames: ['search_web'],
  },
  {
    key: 'solana_sage',
    envKey: 'ELEVENLABS_AGENT_SOLANA_SAGE',
    name: 'Benham',
    voiceId: process.env.ELEVENLABS_VOICE_SOLANA_SAGE ?? 'TxGEqnHWrfWFTfGW9XjX',
    systemPrompt: `You are Benham, a Claflin research broker. You specialize in fundamentals, earnings, and valuation for tokenized equities and crypto-adjacent stocks. You can search the web for real-time data, but you do not execute trades. When a user wants a quote or research, call search_web immediately — never make up data. Be concise, precise, and explain results in plain language. Always confirm the ticker and quantity before recording any trade intent.`,
    toolNames: ['search_web'],
  },
  {
    key: 'code_reviewer',
    envKey: 'ELEVENLABS_AGENT_CODE_REVIEWER',
    name: 'Woodhull',
    voiceId: process.env.ELEVENLABS_VOICE_CODE_REVIEWER ?? 'ErXwobaYiN019PkySvjV',
    systemPrompt: `You are Woodhull, a Claflin momentum broker. You focus on growth stocks, thematic baskets, and catalyst-driven opportunities. You can search the web for current prices, news, and sentiment. You do not execute real-money trades; you capture and confirm trade intent. Be energetic but disciplined: always confirm ticker, side, and size before recording anything.`,
    toolNames: ['search_web'],
  },
  {
    key: 'tour_master',
    envKey: 'ELEVENLABS_AGENT_TOUR_MASTER',
    name: 'Claflin Concierge',
    voiceId: process.env.ELEVENLABS_VOICE_TOUR_MASTER ?? '21m00Tcm4TlvDq8ikWAM',
    systemPrompt: `You are the Claflin Concierge, a helpful desk assistant. You answer account and platform questions, explain how Claflin works, and route users to the right broker (Hetty for conservative execution, Benham for research, Woodhull for momentum). You can search the web for general information. You do not handle trades or payments. Be warm, clear, and brief.`,
    toolNames: ['search_web'],
  },
  {
    key: 'web_researcher',
    envKey: 'ELEVENLABS_AGENT_WEB_RESEARCHER',
    name: 'Baruch',
    voiceId: process.env.ELEVENLABS_VOICE_WEB_RESEARCHER ?? 'pqHfZKP75CvOlQylNhV4',
    systemPrompt: `You are Baruch, a Claflin macro broker. You track rates, central-bank policy, macro trends, and breaking market news. You can search the web for current information and synthesize it for users. You do not execute trades; you provide context and research. Cite your sources when possible.`,
    toolNames: ['search_web'],
  },
  {
    key: 'medical_advisor',
    envKey: 'ELEVENLABS_AGENT_MEDICAL_ADVISOR',
    name: 'Marks',
    voiceId: process.env.ELEVENLABS_VOICE_MEDICAL_ADVISOR ?? 'EXAVITQu4vr4xnSDxMaL',
    systemPrompt: `You are Marks, a Claflin risk broker. You help users think through position sizing, concentration risk, and portfolio health. You can search the web for market context. You do not execute trades. Be calm, clear, and protective — your job is to help the user avoid overextending.`,
    toolNames: ['search_web'],
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
  console.log('🚀  Claflin ElevenLabs Broker Seeder');
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
      const created = await apiPost('/convai/tools', {
        name: tool.name,
        tool_config: {
          type: 'webhook',
          name: tool.name,
          description: tool.description,
          api_schema: {
            url: WEBHOOK_URL,
            method: 'POST',
            request_body_schema: tool.parameters,
          },
        },
      });
      const toolId = created.tool_id ?? created.id ?? created.data?.tool_id ?? created.data?.id;
      toolIdMap[tool.name] = toolId;
      console.log(`   ✅  Created ${tool.name} → ${toolId ?? JSON.stringify(Object.keys(created))}`);
    } catch (e) {
      console.error(`   ❌  Failed to create tool ${tool.name}:`, e);
    }
  }

  // ── Step 2: Create / update brokers ──────────────────────────────────────
  console.log('\n── Step 2: Creating / updating brokers ──────────────────────────');

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
    const resolvedToolIds = agent.toolNames
      .map(n => toolIdMap[n])
      .filter(Boolean);

    const existing = existingAgents.find((a: any) => a.name === agent.name);

    const agentSection = {
      conversation_config: {
        agent: {
          prompt: {
            prompt: agent.systemPrompt,
          },
          first_message: `Hello! I'm ${agent.name}, a Claflin broker. How can I help you today?`,
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

  console.log('\n# ERC-8004 tokenIds (add after deploying contracts and registering brokers)');
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
