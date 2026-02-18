// Agent Matching Engine - Intent-based discovery
// Users describe their problem, we match them to the right agent

export interface AgentMatch {
  agentId: string;
  score: number;
  reason: string;
  estimatedCost: string;
  estimatedDuration: string;
}

export interface UserIntent {
  rawInput: string;
  category?: string;
  taskType?: string;
  urgency?: 'low' | 'medium' | 'high';
  complexity?: 'simple' | 'moderate' | 'complex';
}

// Intent patterns for matching
const INTENT_PATTERNS: Record<string, {
  keywords: string[];
  categories: string[];
  taskTypes: string[];
}> = {
  'crypto_help': {
    keywords: ['solana', 'wallet', 'token', 'crypto', 'blockchain', 'nft', 'defi', 'staking', 'balance', 'transaction'],
    categories: ['blockchain'],
    taskTypes: ['analysis', 'troubleshooting', 'education'],
  },
  'coding_help': {
    keywords: ['code', 'bug', 'error', 'javascript', 'python', 'react', 'debug', 'programming', 'github', 'git'],
    categories: ['tech'],
    taskTypes: ['debugging', 'review', 'education'],
  },
  'gaming_help': {
    keywords: ['game', 'tournament', 'esports', 'dota', 'lol', 'valorant', 'stats', 'match', 'player'],
    categories: ['gaming'],
    taskTypes: ['research', 'analysis'],
  },
  'general_research': {
    keywords: ['research', 'find', 'search', 'information', 'learn', 'explain', 'how to', 'what is', 'help'],
    categories: ['general', 'tech', 'blockchain'],
    taskTypes: ['research', 'education'],
  },
  'learning_language': {
    keywords: ['spanish', 'french', 'language', 'learn', 'practice', 'conversation', 'speak'],
    categories: ['general'],
    taskTypes: ['education', 'practice'],
  },
  'cooking_help': {
    keywords: ['cook', 'recipe', 'food', 'italian', 'pasta', 'kitchen', 'meal', 'ingredients'],
    categories: ['general'],
    taskTypes: ['education', 'guidance'],
  },
  'travel_help': {
    keywords: ['travel', 'trip', 'visit', 'country', 'recommendation', 'hotel', 'flight', 'tour'],
    categories: ['general'],
    taskTypes: ['research', 'recommendations'],
  },
};

// Agent definitions for matching
const AGENT_PROFILES: Record<string, {
  name: string;
  specialties: string[];
  categories: string[];
  taskTypes: string[];
  ratePerMinute: number;
  bestFor: string[];
}> = {
  'agent_2101khgsy8aqfxv8yr3r9548bqrx': {
    name: 'Solana Sage',
    specialties: ['solana', 'blockchain', 'wallet', 'token', 'nft', 'defi', 'crypto analysis'],
    categories: ['blockchain'],
    taskTypes: ['analysis', 'troubleshooting', 'education'],
    ratePerMinute: 0.10,
    bestFor: ['crypto beginners', 'solana users', 'nft traders', 'defi explorers'],
  },
  'agent_0201khgsya1dfcgv6p5ch10995b9': {
    name: 'Code Reviewer',
    specialties: ['javascript', 'python', 'github', 'debugging', 'code review', 'best practices'],
    categories: ['tech'],
    taskTypes: ['debugging', 'review', 'education'],
    ratePerMinute: 0.15,
    bestFor: ['developers', 'students', 'code review', 'bug fixes'],
  },
  'agent_6701khgsyb70fdebb2ce36dfjs2m': {
    name: 'Tournament Master',
    specialties: ['esports', 'gaming stats', 'tournaments', 'player analysis', 'match history'],
    categories: ['gaming'],
    taskTypes: ['research', 'analysis'],
    ratePerMinute: 0.08,
    bestFor: ['gamers', 'esports fans', 'tournament tracking'],
  },
  'agent_2101khgsyd02fnvshvr7rzb50qj6': {
    name: 'General Helper',
    specialties: ['research', 'general knowledge', 'web search', 'calculations', 'weather', 'facts'],
    categories: ['general'],
    taskTypes: ['research', 'education'],
    ratePerMinute: 0.05,
    bestFor: ['quick questions', 'general research', 'first-time users', 'budget conscious'],
  },
};

export class AgentMatchingEngine {
  /**
   * Parse user input into structured intent
   */
  parseIntent(input: string): UserIntent {
    const lowerInput = input.toLowerCase();
    
    // Detect urgency
    let urgency: UserIntent['urgency'] = 'medium';
    if (/urgent|asap|quick|emergency|help now/i.test(lowerInput)) {
      urgency = 'high';
    } else if (/whenever|no rush|later|sometime/i.test(lowerInput)) {
      urgency = 'low';
    }
    
    // Detect complexity
    let complexity: UserIntent['complexity'] = 'simple';
    if (/complex|complicated|advanced|expert|detailed|in-depth/i.test(lowerInput)) {
      complexity = 'complex';
    } else if (/moderate|somewhat|kind of/i.test(lowerInput)) {
      complexity = 'moderate';
    }
    
    // Match to intent patterns
    let matchedCategory: string | undefined;
    let matchedTaskType: string | undefined;
    
    for (const [intentKey, pattern] of Object.entries(INTENT_PATTERNS)) {
      const hasMatch = pattern.keywords.some(keyword => lowerInput.includes(keyword));
      if (hasMatch) {
        matchedCategory = pattern.categories[0];
        matchedTaskType = pattern.taskTypes[0];
        break;
      }
    }
    
    return {
      rawInput: input,
      category: matchedCategory,
      taskType: matchedTaskType,
      urgency,
      complexity,
    };
  }
  
  /**
   * Find best matching agents for user intent
   */
  findMatches(intent: UserIntent, availableAgents: string[]): AgentMatch[] {
    const matches: AgentMatch[] = [];
    
    for (const agentId of availableAgents) {
      const profile = AGENT_PROFILES[agentId];
      if (!profile) continue;
      
      let score = 0;
      const reasons: string[] = [];
      
      // Category match (highest weight)
      if (intent.category && profile.categories.includes(intent.category)) {
        score += 40;
        reasons.push(`Specializes in ${intent.category}`);
      }
      
      // Task type match
      if (intent.taskType && profile.taskTypes.includes(intent.taskType)) {
        score += 25;
        reasons.push(`Great for ${intent.taskType}`);
      }
      
      // Keyword matching
      const inputWords = intent.rawInput.toLowerCase().split(/\s+/);
      const specialtyMatches = profile.specialties.filter(specialty => 
        inputWords.some(word => specialty.toLowerCase().includes(word) || word.includes(specialty.toLowerCase()))
      );
      score += specialtyMatches.length * 10;
      if (specialtyMatches.length > 0) {
        reasons.push(`Expert in ${specialtyMatches.slice(0, 2).join(', ')}`);
      }
      
      // Urgency adjustment
      if (intent.urgency === 'high' && profile.ratePerMinute <= 0.10) {
        score += 10; // Prefer affordable agents for quick help
        reasons.push('Quick response time');
      }
      
      // Complexity adjustment
      if (intent.complexity === 'complex' && profile.ratePerMinute >= 0.10) {
        score += 15; // Prefer premium agents for complex tasks
        reasons.push('Advanced expertise');
      }
      
      // Budget-friendly boost for simple questions
      if (intent.complexity === 'simple' && profile.ratePerMinute <= 0.05) {
        score += 20;
        reasons.push('Most affordable option');
      }
      
      // Calculate estimates
      const estimatedMinutes = this.estimateDuration(intent);
      const estimatedCost = estimatedMinutes * profile.ratePerMinute;
      
      if (score > 0) {
        matches.push({
          agentId,
          score: Math.min(score, 100),
          reason: reasons[0] || 'General purpose agent',
          estimatedCost: `$${(estimatedCost || 0).toFixed(2)}`,
          estimatedDuration: `${estimatedMinutes} min`,
        });
      }
    }
    
    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Estimate call duration based on intent
   */
  private estimateDuration(intent: UserIntent): number {
    const baseMinutes = 5;
    
    switch (intent.complexity) {
      case 'simple':
        return 3;
      case 'complex':
        return 10;
      default:
        return baseMinutes;
    }
  }
  
  /**
   * Get quick suggestions for common intents
   */
  getQuickSuggestions(): Array<{ label: string; intent: string }> {
    return [
      { label: '🔍 Check my Solana wallet', intent: 'Check my Solana wallet balance' },
      { label: '🐛 Debug my code', intent: 'Help me debug my JavaScript code' },
      { label: '🎮 Game stats', intent: 'Show me recent Dota 2 tournament results' },
      { label: '📚 Research topic', intent: 'Research and explain Web3 concepts' },
      { label: '💡 General help', intent: 'I have a general question' },
    ];
  }
  
  /**
   * Get agent by ID
   */
  getAgentProfile(agentId: string) {
    return AGENT_PROFILES[agentId];
  }
}

// Singleton instance
export const agentMatcher = new AgentMatchingEngine();

// React hook
export function useAgentMatching() {
  return {
    matcher: agentMatcher,
    parseIntent: (input: string) => agentMatcher.parseIntent(input),
    findMatches: (intent: UserIntent, agents: string[]) => agentMatcher.findMatches(intent, agents),
    getQuickSuggestions: () => agentMatcher.getQuickSuggestions(),
  };
}
