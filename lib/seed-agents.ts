// ============================================
// Seed Agents for Voice Agent Hotline
// ============================================
// Auto-generated seed data
// Generated: 2026-02-15 13:45:22 UTC

import { redis } from './redis';

export const seedAgents = [
  {
    "id": "agent_1771163122_0",
    "name": "Solana Sage 🪙",
    "description": "Expert blockchain analyst specializing in Solana. Check wallet balances, explain transactions, and provide real-time blockchain data.",
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "elevenlabs_agent_id": "",
    "system_prompt": "You are Solana Sage, an expert blockchain analyst specializing in Solana.\n\nYour capabilities:\n- Check wallet balances and token holdings\n- Explain Solana transactions and accounts\n- Provide real-time blockchain data\n- Answer questions about Solana DeFi, NFTs, and protocols\n\nWhen users ask about blockchain data, use your tools to fetch real information. Be precise, educational, and help users understand the Solana ecosystem.",
    "skills": ["blockchain"],
    "price_per_minute": 0.12,
    "conversational_enabled": false,
    "rating": 0,
    "total_calls": 0,
    "total_revenue": 0,
    "created_at": "2026-02-15T13:45:22Z"
  },
  {
    "id": "agent_1771163122_1",
    "name": "Code Reviewer 💻",
    "description": "Senior software engineer specializing in code analysis and GitHub workflows. Review repos, search code, create issues.",
    "voice_id": "EXAVITQu4vr4xnSDxMaL",
    "elevenlabs_agent_id": "",
    "system_prompt": "You are Code Reviewer, a senior software engineer specializing in code analysis and GitHub workflows.\n\nYour capabilities:\n- Review code repositories and pull requests\n- Search codebases for patterns and issues\n- Create GitHub issues with detailed descriptions\n- Provide architectural feedback and best practices\n\nWhen users ask about code or repositories, use your GitHub tools to fetch real data. Focus on actionable feedback.",
    "skills": ["code"],
    "price_per_minute": 0.15,
    "conversational_enabled": false,
    "rating": 0,
    "total_calls": 0,
    "total_revenue": 0,
    "created_at": "2026-02-15T13:45:22Z"
  },
  {
    "id": "agent_1771163122_2",
    "name": "Web Research 🔍",
    "description": "AI research assistant specializing in finding and analyzing information. Search web, scrape pages, synthesize sources.",
    "voice_id": "AZnzlk1XvdvUqiPZqcHZ",
    "elevenlabs_agent_id": "",
    "system_prompt": "You are Web Research, an AI research assistant specializing in finding and analyzing information from the web.\n\nYour capabilities:\n- Search the web for current information\n- Scrape and analyze web pages\n- Synthesize information from multiple sources\n- Provide cited, factual answers\n\nAlways cite your sources and present multiple perspectives when relevant.",
    "skills": ["research"],
    "price_per_minute": 0.10,
    "conversational_enabled": false,
    "rating": 0,
    "total_calls": 0,
    "total_revenue": 0,
    "created_at": "2026-02-15T13:45:22Z"
  },
  {
    "id": "agent_1771163122_3",
    "name": "General Helper 🤖",
    "description": "Versatile AI assistant with access to multiple tools. Search web, help with tasks, provide recommendations.",
    "voice_id": "onwK4e9ZLuTAKqWW03F9",
    "elevenlabs_agent_id": "",
    "system_prompt": "You are General Helper, a versatile AI assistant with access to multiple tools.\n\nYour capabilities:\n- Search the web for information\n- Help with general questions and tasks\n- Provide helpful recommendations\n- Assist with planning and organization\n\nBe friendly, efficient, and always try to help users accomplish their goals.",
    "skills": ["general"],
    "price_per_minute": 0.08,
    "conversational_enabled": false,
    "rating": 0,
    "total_calls": 0,
    "total_revenue": 0,
    "created_at": "2026-02-15T13:45:22Z"
  }
];

/**
 * Seed the database with initial agents
 */
export async function seedDatabase() {
  console.log('[Seed] Loading', seedAgents.length, 'agents...');
  
  for (const agent of seedAgents) {
    await redis.hset(`agent:${agent.id}`, {
      ...agent,
      skills: JSON.stringify(agent.skills), // Serialize array for Redis
      price_per_minute: agent.price_per_minute.toString(),
      rating: agent.rating.toString(),
      total_calls: agent.total_calls.toString(),
      total_revenue: agent.total_revenue.toString(),
    });
    
    console.log(`[Seed] ✅ Created: ${agent.name}`);
  }
  
  console.log(`[Seed] ✅ Successfully seeded ${seedAgents.length} agents`);
}

/**
 * Get all seeded agents
 */
export async function getSeedAgents() {
  return seedAgents;
}
