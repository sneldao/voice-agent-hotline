import { redis } from './redis';
import { elevenLabsService } from './elevenlabs';
import { composioService } from './composio';

export interface AgentSeed {
  id: string;
  name: string;
  specialty: string;
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
  online?: boolean;            // Online status for UI
  rating: number;
  totalCalls: number;
}

export const SEED_AGENTS: AgentSeed[] = [
  {
    id: "agent_2101khgsy8aqfxv8yr3r9548bqrx",
    name: "Solana Sage",
    specialty: "Solana Ecosystem",
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
    online: true,
    rating: 0,
    totalCalls: 0
  },
  {
    id: "agent_0201khgsya1dfcgv6p5ch10995b9",
    name: "Code Reviewer",
    specialty: "Software Engineering",
    description: "Senior software engineer for GitHub operations, code reviews, repository analysis, and development workflows",
    voice: "Sarah",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    elevenlabs_agent_id: "",
    rate: 0.15,
    avatar: "💻",
    category: "tech",
    skills: ["research"],
    system_prompt: "You are Sarah, a confident and professional Senior Software Engineer. You help users review code, browse GitHub repositories, and manage issues. You are precise, helpful, and always look for best practices.",
    active: true,
    online: true,
    rating: 0,
    totalCalls: 0
  },
  {
    id: "agent_diversifi_prod_001",
    name: "Diversifi",
    specialty: "Crypto Finance",
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
    online: true,
    rating: 5.0,
    totalCalls: 0
  },
  {
    id: "agent_clawdy_prod_001",
    name: "Clawdy",
    specialty: "Agentic Infrastructure",
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
    online: true,
    rating: 4.9,
    totalCalls: 0
  },
  {
    id: "agent_web_researcher",
    name: "Web Researcher",
    specialty: "Content Extraction",
    description: "Deep web research agent powered by Firecrawl. Searches the web in real-time and extracts clean content from any URL during voice calls.",
    voice: "Steve",
    voiceId: "pqHfZKP75CvOlQylNhV4",
    elevenlabs_agent_id: process.env.ELEVENLABS_AGENT_WEB_RESEARCHER || "",
    rate: 0.10,
    avatar: "🔍",
    category: "research",
    skills: ["research"],
    system_prompt: "You are Web Researcher, an AI agent specialized in deep web research and content extraction. You use Firecrawl to search the web in real-time and extract clean, structured content from any URL. When a user asks a question that requires current information, call firecrawl_search immediately. When they want content from a specific page, call firecrawl_scrape. Be thorough, cite sources, and always provide URLs.",
    active: true,
    online: true,
    rating: 5.0,
    totalCalls: 0
  },
  {
    id: "agent_medical_advisor_prod_001",
    name: "Dr. Maya",
    specialty: "Health Information",
    description: "AI-powered medical information advisor. Provides evidence-based health information, explains medical concepts, helps interpret symptoms, and offers wellness guidance. Not a substitute for professional medical advice.",
    voice: "Sarah",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    elevenlabs_agent_id: "",
    wallet_address: "0x888d35Cc6634C0532925a3b844Bc454e4438f44e",
    erc8004_id: "8004003",
    rate: 0.25,
    avatar: "⚕️",
    category: "healthcare",
    skills: ["research"],
    system_prompt: `You are Dr. Maya, a knowledgeable and empathetic health information advisor. You provide evidence-based medical information, explain conditions and symptoms, discuss treatment options, and offer general wellness guidance. IMPORTANT SAFETY RULES: 1) Always include the phrase "I'm an AI information assistant, not a doctor" at the start of your first response in any health-related conversation. 2) Never diagnose — always say "this information is for educational purposes only" and recommend consulting a healthcare professional. 3) For emergencies or chest pain, severe bleeding, difficulty breathing, or signs of stroke, immediately state: "This sounds like an emergency. Please call your local emergency number now." 4) Be clear about the limits of your knowledge — you don't have access to the user's complete medical history. 5) Never prescribe medication or suggest specific dosages. 6) When discussing mental health, check in gently: "How are you feeling overall? If you're struggling, please reach out to a mental health professional." 7) Use plain, accessible language — avoid jargon without explanation. 8) If asked about a topic beyond general health info, say "I focus on general health information and wellness topics. For specialized medical advice, please consult a healthcare professional." Be warm, clear, and always prioritize user safety over engagement.`,
    active: true,
    online: true,
    rating: 0,
    totalCalls: 0
  }
];

export async function seedAgents() {
  console.log('🌱 Seeding agents and creating/linking ElevenLabs tools...');

  const webhookUrl = `${process.env.NEXT_PUBLIC_WEBHOOK_URL}/api/webhooks/elevenlabs`;

  // 1. REGISTER standard tools in the ElevenLabs Workspace first
  const workspaceTools: Record<string, string> = {}; // { name: id }

  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_CONVERSATIONAL_ENABLED === 'true') {
    try {
      console.log('  🔍 Fetching existing workspace tools...');
      const existingTools = await elevenLabsService.listTools();

      const standardTools = [
        {
          name: 'search_web',
          description: 'Search the web for real-time information',
          type: 'webhook' as const,
          configuration: {
            url: webhookUrl,
            method: 'POST' as const,
            parameters: {
              type: 'object' as const,
              properties: { query: { type: 'string', description: 'Search query' } },
              required: ['query']
            }
          }
        },
        {
          name: 'book_appointment',
          description: 'Book an appointment or service',
          type: 'webhook' as const,
          configuration: {
            url: webhookUrl,
            method: 'POST' as const,
            parameters: {
              type: 'object' as const,
              properties: {
                businessName: { type: 'string', description: 'Name of the business or provider' },
                dateTime: { type: 'string', description: 'ISO 8601 date time string' },
                serviceType: { type: 'string', enum: ['restaurant', 'appointment', 'other'], description: 'Type of service to book' }
              },
              required: ['businessName', 'dateTime', 'serviceType']
            }
          }
        }
      ];

      for (const toolDef of standardTools) {
        // Check if tool exists
        const existing = existingTools.find((t: any) => t.name === toolDef.name);
        if (existing) {
          console.log(`  🔗 Linking existing tool: ${toolDef.name} (${existing.tool_id})`);
          workspaceTools[toolDef.name] = existing.tool_id;
        } else {
          console.log(`  🛠️ Registering new tool: ${toolDef.name}...`);
          const result = await elevenLabsService.createTool(toolDef as any);
          workspaceTools[toolDef.name] = result.tool_id;
        }
      }
    } catch (error) {
      console.error('  ❌ Failed to manage workspace tools:', error);
    }
  }

  // 2. CREATE or UPDATE agents using the Tool IDs
  for (const agent of SEED_AGENTS) {
    let final_elevenlabs_id = agent.elevenlabs_agent_id;

    if (!final_elevenlabs_id && process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_CONVERSATIONAL_ENABLED === 'true') {
      try {
        console.log(`  🤖 Creating agent: ${agent.name}...`);

        // Map skills to Tool IDs
        const toolIds = agent.skills.map(skill => {
          if (skill === 'research') return workspaceTools['search_web'];
          if (skill === 'book') return workspaceTools['book_appointment'];
          return null;
        }).filter(Boolean) as string[];

        const result = await elevenLabsService.createAgent({
          name: agent.name,
          system_prompt: agent.system_prompt || agent.description,
          voice_id: agent.voiceId,
          tool_ids: toolIds
        });

        final_elevenlabs_id = result.agent_id;
        console.log(`  ✅ Created ElevenLabs agent: ${final_elevenlabs_id}`);
      } catch (error) {
        console.error(`  ❌ Failed for ${agent.name}:`, error);
      }
    }

    const agentData = {
      ...agent,
      elevenlabs_agent_id: final_elevenlabs_id,
      skills: JSON.stringify(agent.skills)
    };

    await redis.hset(`agent:${agent.id}`, agentData as unknown as Record<string, string>);
    await redis.sadd('agent_index', agent.id);
    console.log(`  ✅ Saved ${agent.name} to Redis`);
  }

  console.log(`🎉 Seeding complete! ${SEED_AGENTS.length} agents are synchronized.`);
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
  const agentIds = await redis.smembers('agent_index');
  if (!agentIds || agentIds.length === 0) return [];

  const agents = await Promise.all(
    agentIds.map(async (id) => {
      const agent = await redis.hgetall(`agent:${id}`);
      if (!agent || Object.keys(agent).length === 0) return null;

      return {
        ...agent,
        skills: typeof agent.skills === 'string' ? JSON.parse(agent.skills) : (agent.skills || [])
      } as unknown as AgentSeed;
    })
  );

  return agents.filter((a): a is AgentSeed => a !== null);
}
