// ============================================
// VOISSS Canonical Agent Registry
// ============================================
// Single source of truth that bridges all 4 layers of the architecture:
//   Layer 1 (Voice)      → ElevenLabs ConvAI agent ID + voice ID + system prompt
//   Layer 2 (Orchestr.)  → allowed skill types + specialty tags for routing
//   Layer 3 (Execution)  → Composio tool slugs
//   Layer 4 (Settlement) → ERC-8004 tokenId on Celo
//
// How to use:
//   1. Run `npx tsx scripts/seed-elevenlabs.ts` to create agents in ElevenLabs.
//   2. Add the returned agent IDs as ELEVENLABS_AGENT_<KEY> env vars.
//   3. Deploy ERC-8004 contracts, register each agent, add ERC8004_TOKEN_<KEY> env vars.
//   4. The webhook, skills framework, and reputation service all read from here.

export type SkillType = 'book' | 'order' | 'schedule' | 'research';

export interface AgentRegistryEntry {
  /** Stable internal key */
  key: string;

  // ── Display ──────────────────────────────────────────────────────────────
  name: string;
  emoji: string;
  tagline: string;
  color: string; // Tailwind gradient classes

  // ── Layer 1: ElevenLabs Conversational AI ────────────────────────────────
  /** ElevenLabs ConvAI agent ID. Set via ELEVENLABS_AGENT_<KEY>. null = not seeded yet. */
  elevenLabsAgentId: string | null;
  /** ElevenLabs voice ID */
  voiceId: string;
  /** System prompt injected when creating/updating the ConvAI agent */
  systemPrompt: string;
  /** Tool names this agent declares in ElevenLabs (must match webhook's TOOL_CONFIG keys) */
  elevenLabsTools: string[];

  // ── Layer 2: Orchestrator routing ────────────────────────────────────────
  /** Specialty tags used by findAgentBySpecialty() in the webhook */
  specialties: string[];
  /** Skill types this agent is permitted to execute */
  allowedSkills: SkillType[];

  // ── Layer 3: Composio ────────────────────────────────────────────────────
  /** Composio action slugs this agent may call */
  composioTools: string[];

  // ── Layer 4: ERC-8004 on-chain identity ──────────────────────────────────
  /** tokenId in the ERC-8004 Identity Registry. Set via ERC8004_TOKEN_<KEY>. */
  tokenId: bigint | null;
}

// ============================================
// The 4 Canonical VOISSS Agents
// ============================================

export const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {

  solana_sage: {
    key: 'solana_sage',
    name: 'Solana Sage',
    emoji: '🔮',
    tagline: 'On-chain intelligence for Solana & DeFi',
    color: 'from-violet-500 to-purple-600',
    elevenLabsAgentId: process.env.ELEVENLABS_AGENT_SOLANA_SAGE ?? null,
    voiceId: process.env.ELEVENLABS_VOICE_SOLANA_SAGE ?? 'TxGEqnHWrfWFTfGW9XjX', // Josh
    systemPrompt: `You are Solana Sage, an expert AI agent specializing in Solana blockchain, DeFi protocols, and on-chain analytics on Celo. You can check wallet balances and look up transactions in real time. When a user wants a balance or transaction lookup, call the check_solana_balance or search_web tool immediately — never make up data. Be concise, precise, and explain technical results in plain language. Always confirm the wallet address before executing a lookup.`,
    elevenLabsTools: ['check_solana_balance', 'search_web'],
    specialties: ['blockchain', 'crypto', 'defi', 'solana'],
    allowedSkills: ['research'],
    composioTools: ['SOLANA_GET_BALANCE', 'SOLANA_GET_TRANSACTION', 'WEB_SEARCH'],
    tokenId: process.env.ERC8004_TOKEN_SOLANA_SAGE
      ? BigInt(process.env.ERC8004_TOKEN_SOLANA_SAGE)
      : null,
  },

  code_reviewer: {
    key: 'code_reviewer',
    name: 'Code Reviewer',
    emoji: '👨‍💻',
    tagline: 'Senior engineer in your ear',
    color: 'from-blue-500 to-cyan-600',
    elevenLabsAgentId: process.env.ELEVENLABS_AGENT_CODE_REVIEWER ?? null,
    voiceId: process.env.ELEVENLABS_VOICE_CODE_REVIEWER ?? 'ErXwobaYiN019PkySvjV', // Antoni
    systemPrompt: `You are a senior software engineer and code reviewer. You help developers with code quality, architecture decisions, debugging, and best practices. You can access GitHub repositories and file contents. When a user wants to review a repo or file, call get_github_repos or get_github_repo_content immediately. Be specific, actionable, and assume the user is a competent developer. When scheduling a follow-up review, use set_reminder.`,
    elevenLabsTools: ['get_github_repos', 'get_github_repo_content', 'search_web', 'set_reminder'],
    specialties: ['code', 'tech', 'github', 'programming', 'debugging'],
    allowedSkills: ['research', 'schedule'],
    composioTools: ['GITHUB_LIST_REPOS', 'GITHUB_GET_REPOSITORY_CONTENT', 'GITHUB_SEARCH_CODE', 'WEB_SEARCH'],
    tokenId: process.env.ERC8004_TOKEN_CODE_REVIEWER
      ? BigInt(process.env.ERC8004_TOKEN_CODE_REVIEWER)
      : null,
  },

  general_helper: {
    key: 'general_helper',
    name: 'General Helper',
    emoji: '🤖',
    tagline: 'Your everyday AI concierge',
    color: 'from-green-500 to-emerald-600',
    elevenLabsAgentId: process.env.ELEVENLABS_AGENT_GENERAL_HELPER ?? null,
    voiceId: process.env.ELEVENLABS_VOICE_GENERAL_HELPER ?? 'pNInz6obpgDQGcFmaJgB', // Adam
    systemPrompt: `You are a helpful, friendly AI concierge. You can book appointments, place orders, set reminders, and research almost anything. This is a delegated-action agent — before executing any book, order, or schedule action, briefly confirm: "I'm about to [action] on your behalf — shall I proceed?" Then call the tool. Be warm, efficient, and always narrate what you did after the tool returns. You work on the Celo network and accept MiniPay.`,
    elevenLabsTools: ['book_appointment', 'create_order', 'set_reminder', 'search_web'],
    specialties: ['general', 'booking', 'ordering', 'scheduling', 'research'],
    allowedSkills: ['book', 'order', 'schedule', 'research'],
    composioTools: ['WEB_SEARCH'],
    tokenId: process.env.ERC8004_TOKEN_GENERAL_HELPER
      ? BigInt(process.env.ERC8004_TOKEN_GENERAL_HELPER)
      : null,
  },

  tour_master: {
    key: 'tour_master',
    name: 'Tour Master',
    emoji: '🌍',
    tagline: 'Travel research & itinerary planning',
    color: 'from-orange-500 to-amber-600',
    elevenLabsAgentId: process.env.ELEVENLABS_AGENT_TOUR_MASTER ?? null,
    voiceId: process.env.ELEVENLABS_VOICE_TOUR_MASTER ?? '21m00Tcm4TlvDq8ikWAM', // Rachel
    systemPrompt: `You are Tour Master, a world-class travel planner and local guide. You help users plan trips, research destinations, find hotels, compare prices, and book travel. When a user asks about a destination or price comparison, call search_web or compare_prices immediately. For bookings, call book_appointment. Be enthusiastic, specific, and include cost estimates whenever possible. You work globally and accept crypto via Celo MiniPay.`,
    elevenLabsTools: ['search_web', 'compare_prices', 'book_appointment'],
    specialties: ['research', 'travel', 'booking', 'general'],
    allowedSkills: ['research', 'book', 'schedule'],
    composioTools: ['WEB_SEARCH'],
    tokenId: process.env.ERC8004_TOKEN_TOUR_MASTER
      ? BigInt(process.env.ERC8004_TOKEN_TOUR_MASTER)
      : null,
  },
};

// ============================================
// Registry Lookup Helpers
// ============================================

/** Find entry by ElevenLabs conversational agent ID */
export function findByElevenLabsId(agentId: string): AgentRegistryEntry | null {
  return Object.values(AGENT_REGISTRY).find(e => e.elevenLabsAgentId === agentId) ?? null;
}

/** Find entry by ERC-8004 tokenId */
export function findByTokenId(tokenId: bigint): AgentRegistryEntry | null {
  return Object.values(AGENT_REGISTRY).find(e => e.tokenId === tokenId) ?? null;
}

/**
 * Find entry by specialty string — exact then fuzzy.
 * Used in the webhook's Agent Discovery step.
 */
export function findBySpecialty(specialty: string): AgentRegistryEntry | null {
  const lower = specialty.toLowerCase();
  return (
    Object.values(AGENT_REGISTRY).find(e =>
      e.specialties.some(s => s.toLowerCase() === lower)
    ) ??
    Object.values(AGENT_REGISTRY).find(e =>
      e.specialties.some(s => lower.includes(s) || s.includes(lower))
    ) ??
    AGENT_REGISTRY['general_helper'] // ultimate fallback
  );
}

/** Check whether an agent is allowed to run a given skill type */
export function agentCanUseSkill(agentKey: string, skill: SkillType): boolean {
  return AGENT_REGISTRY[agentKey]?.allowedSkills.includes(skill) ?? false;
}

/**
 * Return a machine-readable status summary of the registry.
 * Surfaced at GET /api/sdk/health for diagnostics.
 */
export function getRegistryStatus() {
  return Object.values(AGENT_REGISTRY).map(e => ({
    key: e.key,
    name: e.name,
    emoji: e.emoji,
    elevenLabsConfigured: !!e.elevenLabsAgentId,
    elevenLabsAgentId: e.elevenLabsAgentId,
    onChainRegistered: e.tokenId !== null,
    tokenId: e.tokenId?.toString() ?? null,
    allowedSkills: e.allowedSkills,
    specialties: e.specialties,
  }));
}
