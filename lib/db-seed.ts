/**
 * Agent Seeding — Sources from AGENT_REGISTRY (single source of truth).
 *
 * This module NEVER creates new ElevenLabs agents. It only writes to Redis
 * using the pre-configured agent IDs from environment variables. If an agent
 * doesn't have an ElevenLabs ID configured, it's skipped (not shown to users).
 *
 * To add a new agent:
 *   1. Create it manually in the ElevenLabs dashboard
 *   2. Add its ID as ELEVENLABS_AGENT_<KEY> in the environment
 *   3. Add the entry to AGENT_REGISTRY in lib/agent-registry.ts
 *   4. Run the seed endpoint: POST /api/agents/seed
 */

import { redis } from './redis';
import { AGENT_REGISTRY, type AgentRegistryEntry } from './agent-registry';

export interface AgentSeed {
  id: string;
  name: string;
  specialty: string;
  description: string;
  voice: string;
  voiceId: string;
  elevenlabs_agent_id: string;
  wallet_address?: string;
  erc8004_id?: string;
  rate: number;
  avatar: string;
  category: string;
  skills: string[];
  system_prompt?: string;
  active: boolean;
  online?: boolean;
  rating: number;
  totalCalls: number;
}

/** Map registry categories to user-facing categories */
function primaryCategory(entry: AgentRegistryEntry): string {
  const specs = entry.specialties;
  if (specs.includes('health') || specs.includes('medical')) return 'healthcare';
  if (specs.includes('blockchain') || specs.includes('crypto')) return 'blockchain';
  if (specs.includes('code') || specs.includes('tech')) return 'tech';
  if (specs.includes('research') || specs.includes('web')) return 'research';
  if (specs.includes('travel')) return 'travel';
  return 'general';
}

/** Convert a registry entry to a Redis-storable agent record */
function registryToSeed(entry: AgentRegistryEntry): AgentSeed {
  return {
    id: entry.key, // Use the registry key as the agent ID
    name: entry.name,
    specialty: entry.tagline,
    description: entry.systemPrompt.slice(0, 200), // First 200 chars as description
    voice: entry.voiceId,
    voiceId: entry.voiceId,
    elevenlabs_agent_id: entry.elevenLabsAgentId || '',
    rate: 0.10,
    avatar: entry.emoji,
    category: primaryCategory(entry),
    skills: entry.allowedSkills,
    system_prompt: entry.systemPrompt,
    active: true,
    online: true,
    rating: 4.8,
    totalCalls: 0,
  };
}

export async function seedAgents() {
  console.log('🌱 Seeding agents from AGENT_REGISTRY...');

  // Clear existing agent index
  const existingIds = await redis.smembers('agent_index');
  if (existingIds && existingIds.length > 0) {
    // Remove old agent hashes
    const pipeline = redis.pipeline();
    for (const id of existingIds) {
      pipeline.del(`agent:${id}`);
    }
    pipeline.del('agent_index');
    await pipeline.exec();
    console.log(`  🧹 Cleared ${existingIds.length} old agents from Redis`);
  }

  // Also clear the online sorted set
  await redis.del('agents:online');

  let seeded = 0;
  let skipped = 0;

  for (const entry of Object.values(AGENT_REGISTRY)) {
    // Skip the voice router — it's not a user-facing agent
    if (entry.key === 'voice_router') continue;

    // Only seed agents that have a working ElevenLabs agent ID
    if (!entry.elevenLabsAgentId) {
      console.log(`  ⏭️  Skipping ${entry.name} — no ElevenLabs agent ID configured`);
      skipped++;
      continue;
    }

    const agent = registryToSeed(entry);
    const agentData: Record<string, string> = {
      id: agent.id,
      name: agent.name,
      specialty: agent.specialty,
      description: agent.description,
      voice: agent.voice,
      voiceId: agent.voiceId,
      elevenlabs_agent_id: agent.elevenlabs_agent_id,
      rate: String(agent.rate),
      avatar: agent.avatar,
      category: agent.category,
      skills: JSON.stringify(agent.skills),
      system_prompt: agent.system_prompt || '',
      active: 'true',
      online: 'true',
      rating: String(agent.rating),
      totalCalls: '0',
    };

    await redis.hset(`agent:${agent.id}`, agentData);
    await redis.sadd('agent_index', agent.id);
    await redis.zadd('agents:online', { score: Date.now(), member: agent.id });
    console.log(`  ✅ ${agent.name} (${agent.category}) → ${agent.elevenlabs_agent_id}`);
    seeded++;
  }

  console.log(`🎉 Done! ${seeded} agents seeded, ${skipped} skipped (no ElevenLabs ID).`);
}

export async function getAgent(agentId: string): Promise<AgentSeed | null> {
  const agent = await redis.hgetall(`agent:${agentId}`);
  if (!agent || Object.keys(agent).length === 0) return null;
  return {
    ...agent,
    skills: typeof agent.skills === 'string' ? JSON.parse(agent.skills as string) : agent.skills,
    rate: Number(agent.rate),
    rating: Number(agent.rating),
    totalCalls: Number(agent.totalCalls),
    active: agent.active === 'true',
    online: agent.online === 'true',
  } as unknown as AgentSeed;
}

export async function getAllAgents(): Promise<AgentSeed[]> {
  const agentIds = await redis.smembers('agent_index');
  if (!agentIds || agentIds.length === 0) return [];

  const agents = await Promise.all(
    agentIds.map(async (id) => {
      const agent = await redis.hgetall(`agent:${id}`);
      if (!agent || Object.keys(agent).length === 0) return null;
      return {
        ...agent,
        skills: typeof agent.skills === 'string' ? JSON.parse(agent.skills as string) : (agent.skills || []),
        rate: Number(agent.rate),
        rating: Number(agent.rating),
        totalCalls: Number(agent.totalCalls),
        active: agent.active === 'true',
        online: agent.online === 'true',
      } as unknown as AgentSeed;
    })
  );

  return agents.filter((a): a is AgentSeed => a !== null);
}
