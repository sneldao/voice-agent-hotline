import { redis } from './upstash';

export interface AgentSeed {
  id: string;
  name: string;
  description: string;
  voice: string;
  voiceId: string;
  elevenlabs_agent_id: string;
  rate: number;
  avatar: string;
  category: string;
  skills: string[];
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
    elevenlabs_agent_id: "agent_2101khgsy8aqfxv8yr3r9548bqrx",
    rate: 0.10,
    avatar: "🪙",
    category: "blockchain",
    skills: ["solana_balance", "solana_nft", "token_price"],
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
    elevenlabs_agent_id: "agent_0201khgsya1dfcgv6p5ch10995b9",
    rate: 0.15,
    avatar: "💻",
    category: "code",
    skills: ["github_repos", "github_file", "github_search", "github_issue"],
    active: true,
    rating: 0,
    totalCalls: 0
  },
  {
    id: "agent_6701khgsyb70fdebb2ce36dfjs2m",
    name: "Tournament Master",
    description: "Enthusiastic esports analyst for gaming statistics, tournament information, player profiles, and match history",
    voice: "Charlie",
    voiceId: "IKne3meq5aSn9XLyUdCD",
    elevenlabs_agent_id: "agent_6701khgsyb70fdebb2ce36dfjs2m",
    rate: 0.08,
    avatar: "🎮",
    category: "gaming",
    skills: ["web_search", "wikipedia"],
    active: true,
    rating: 0,
    totalCalls: 0
  },
  {
    id: "agent_2101khgsyd02fnvshvr7rzb50qj6",
    name: "General Helper",
    description: "Versatile AI assistant for web research, fact-checking, calculations, weather info, and general queries",
    voice: "River",
    voiceId: "SAz9YHcvj6GT2YYXdXww",
    elevenlabs_agent_id: "agent_2101khgsyd02fnvshvr7rzb50qj6",
    rate: 0.05,
    avatar: "🤖",
    category: "general",
    skills: ["web_search", "web_scrape", "wikipedia", "get_time", "calculate", "weather"],
    active: true,
    rating: 0,
    totalCalls: 0
  }
];

export async function seedAgents() {
  console.log('🌱 Seeding agents...');
  
  for (const agent of SEED_AGENTS) {
    await redis.hset(`agent:${agent.id}`, agent);
    console.log(`  ✅ Seeded ${agent.name}`);
  }
  
  console.log(`✅ Seeded ${SEED_AGENTS.length} agents`);
}

export async function getAgent(agentId: string): Promise<AgentSeed | null> {
  const agent = await redis.hgetall(`agent:${agentId}`);
  return agent ? (agent as unknown as AgentSeed) : null;
}

export async function getAllAgents(): Promise<AgentSeed[]> {
  const agents: AgentSeed[] = [];
  
  for (const seed of SEED_AGENTS) {
    const agent = await redis.hgetall(`agent:${seed.id}`);
    if (agent) {
      agents.push(agent as unknown as AgentSeed);
    }
  }
  
  return agents;
}
