import { redis } from './redis';
import { elevenLabsService } from './elevenlabs';
import { composioService } from './composio';

export interface AgentSeed {
  id: string;
  name: string;
  description: string;
  voice: string;
  voiceId: string;
  elevenlabs_agent_id: string; // The real ID from ElevenLabs
  wallet_address?: string;     // Agent's own execution wallet
  erc8004_id?: string;         // Agent's Identity NFT Token ID
  rate: number;
  avatar: string;
  category: string;
  skills: string[];
  system_prompt?: string;
  active: boolean;
  rating: number;
  totalCalls: number;
}

export const SEED_AGENTS: AgentSeed[] = [
  {
    id: "agent_2101khgsy8aqfxv8yr3r9548bqrx",
    name: "Solana Sage",
    description: "Expert blockchain analyst for Solana network queries, wallet balances, NFT lookups, and token price tracking",
    voice: "Roger",
    voiceId: "CwhRBWXzGAHq8TQ4Fs17",
    elevenlabs_agent_id: "",
    rate: 0.10,
    avatar: "🪙",
    category: "blockchain",
    skills: ["research"], // Map to native research/search_web
    system_prompt: "You are Solana Sage, a laid-back but highly knowledgeable blockchain analyst. You help users check Solana balances, NFT details, and token prices. Use the available tools to provide real-time data.",
    active: true,
    rating: 0,
    totalCalls: 0
  },
  {
    id: "agent_0201khgsya1dfcgv6p5ch10995b9",
    name: "Code Reviewer",
    description: "Senior software engineer for GitHub operations, code reviews, repository analysis, and development workflows",
    voice: "Sarah",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    elevenlabs_agent_id: "",
    rate: 0.15,
    avatar: "💻",
    category: "code",
    skills: ["research"],
    system_prompt: "You are Sarah, a confident and professional Senior Software Engineer. You help users review code, browse GitHub repositories, and manage issues. You are precise, helpful, and always look for best practices.",
    active: true,
    rating: 0,
    totalCalls: 0
  },
  {
    id: "agent_diversifi_prod_001",
    name: "Diversifi",
    description: "Professional advisor specializing in stablecoins (cUSD, USDC, USDT) and wealth diversification strategies on Celo and Base.",
    voice: "Rachel",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    elevenlabs_agent_id: "",
    wallet_address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Placeholder agent wallet
    erc8004_id: "8004001", // Placeholder Identity ID
    rate: 0.12,
    avatar: "🛡️",
    category: "finance",
    skills: ["research", "schedule"],
    system_prompt: "You are Diversifi, a sophisticated financial advisor focused on risk management, stablecoins, and asset diversification. You specialize in the Celo and Base ecosystems. You help users understand how to protect their wealth using diversified stablecoin portfolios. You are calm, data-driven, and highly professional.",
    active: true,
    rating: 5.0,
    totalCalls: 0
  },
  {
    id: "agent_clawdy_prod_001",
    name: "Clawdy",
    description: "Specialist in agentic infrastructure, including OpenClaw, Kilocode Cloud Agents, ERC-8004, and decentralized inference providers.",
    voice: "Adam",
    voiceId: "pNInz6obpgnuMvscWqt5",
    elevenlabs_agent_id: "",
    wallet_address: "0x321d35Cc6634C0532925a3b844Bc454e4438f44e", // Placeholder infrastructure wallet
    erc8004_id: "8004002", // Placeholder Identity ID
    rate: 0.15,
    avatar: "🏗️",
    category: "tech",
    skills: ["research", "schedule"],
    system_prompt: "You are Clawdy, an expert in AI Agent Infrastructure. You know everything about OpenClaw, Kilocode Cloud Agents, decentralized inference, and the ERC-8004 standard. You help developers build and deploy robust agentic systems. You are highly technical, direct, and efficient. Use your tools to research the latest infrastructure updates if needed.",
    active: true,
    rating: 4.9,
    totalCalls: 0
  }
];

export async function seedAgents() {
  console.log('🌱 Seeding agents and creating ElevenLabs instances...');

  const webhookUrl = `${process.env.NEXT_PUBLIC_WEBHOOK_URL}/api/webhooks/elevenlabs`;

  for (const agent of SEED_AGENTS) {
    let final_elevenlabs_id = agent.elevenlabs_agent_id;

    // Create ElevenLabs agent if API key is present and no ID exists
    if (!final_elevenlabs_id && process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_CONVERSATIONAL_ENABLED === 'true') {
      try {
        console.log(`  🛠️ Creating ElevenLabs instance for ${agent.name}...`);

        // Define tool schemas for ElevenLabs
        const tools = agent.skills.map(skill => {
          if (skill === 'research') return {
            name: 'search_web',
            description: 'Search the web for real-time information',
            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
          };
          if (skill === 'book') return {
            name: 'book_appointment',
            description: 'Book an appointment or service',
            parameters: {
              type: 'object',
              properties: {
                businessName: { type: 'string' },
                dateTime: { type: 'string' },
                serviceType: { type: 'string', enum: ['restaurant', 'appointment', 'other'] }
              },
              required: ['businessName', 'dateTime', 'serviceType']
            }
          };
          return null;
        }).filter(Boolean);

        const result = await elevenLabsService.createAgent({
          name: agent.name,
          system_prompt: agent.system_prompt || agent.description,
          voice_id: agent.voiceId,
          webhook_url: webhookUrl,
          tools: tools as any[]
        });

        final_elevenlabs_id = result.agent_id;
        console.log(`  ✅ ElevenLabs agent created: ${final_elevenlabs_id}`);
      } catch (error) {
        console.error(`  ❌ Failed to create ElevenLabs agent for ${agent.name}:`, error);
      }
    }

    const agentData = {
      ...agent,
      elevenlabs_agent_id: final_elevenlabs_id,
      skills: JSON.stringify(agent.skills)
    };

    await redis.hset(`agent:${agent.id}`, agentData as unknown as Record<string, string>);
    console.log(`  ✅ Seeded ${agent.name} to Redis`);
  }

  console.log(`🎉 Seeding complete! ${SEED_AGENTS.length} agents are ready.`);
}

export async function getAgent(agentId: string): Promise<AgentSeed | null> {
  const agent = await redis.hgetall(`agent:${agentId}`);
  if (!agent) return null;
  return {
    ...agent,
    skills: typeof agent.skills === 'string' ? JSON.parse(agent.skills) : agent.skills
  } as unknown as AgentSeed;
}

export async function getAllAgents(): Promise<AgentSeed[]> {
  const agentKeys = await redis.keys('agent:*');
  if (!agentKeys || agentKeys.length === 0) return [];

  const agents = await Promise.all(
    agentKeys.map(async (key) => {
      const agent = await redis.hgetall(key);
      if (!agent || Object.keys(agent).length === 0) return null;

      return {
        ...agent,
        skills: typeof agent.skills === 'string' ? JSON.parse(agent.skills) : (agent.skills || [])
      } as unknown as AgentSeed;
    })
  );

  return agents.filter((a): a is AgentSeed => a !== null);
}
