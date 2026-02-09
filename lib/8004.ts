// ERC-8004 Agent Trust Protocol

export interface AgentProfile {
  id: string;
  name: string;
  bio: string;
  specialties: string[];
  ratePerMinuteCents: number;
  voiceId: string;
  rating: number;
  totalCalls: number;
  verified: boolean;
}

export interface Reputation {
  agentId: string;
  averageRating: number;
  totalRatings: number;
  distribution: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

export interface Feedback {
  agentId: string;
  rating: number; // 1-5
  tag: 'helpful' | 'knowledgeable' | 'slow' | 'unclear' | 'other';
  comment?: string;
}

export class ERC8004 {
  private agents: Map<string, AgentProfile> = new Map();
  private reputation: Map<string, Reputation> = new Map();

  /**
   * Register new agent
   */
  register(profile: Omit<AgentProfile, 'id' | 'rating' | 'totalCalls' | 'verified'>): AgentProfile {
    const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const agent: AgentProfile = {
      ...profile,
      id,
      rating: 0,
      totalCalls: 0,
      verified: false,
    };

    this.agents.set(id, agent);
    this.reputation.set(id, {
      agentId: id,
      averageRating: 0,
      totalRatings: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });

    return agent;
  }

  /**
   * Get agent profile
   */
  get(agentId: string): AgentProfile | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get reputation
   */
  reputationOf(agentId: string): Reputation | null {
    return this.reputation.get(agentId) || null;
  }

  /**
   * Submit feedback
   */
  feedback(agentId: string, feedback: Feedback): Reputation {
    const rep = this.reputation.get(agentId);
    if (!rep) throw new Error('Agent not found');

    // Update distribution
    const rating = Math.min(5, Math.max(1, feedback.rating));
    rep.distribution[rating as keyof typeof rep.distribution]++;
    rep.totalRatings++;

    // Calculate average
    const total = 
      rep.distribution[5] * 5 +
      rep.distribution[4] * 4 +
      rep.distribution[3] * 3 +
      rep.distribution[2] * 2 +
      rep.distribution[1];
    rep.averageRating = total / rep.totalRatings;

    // Update agent
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.rating = rep.averageRating;
      agent.totalCalls++;
    }

    return rep;
  }

  /**
   * Search agents
   */
  search(query: {
    specialty?: string;
    minRating?: number;
    maxRate?: number;
    available?: boolean;
  }): AgentProfile[] {
    let results = Array.from(this.agents.values());

    if (query.specialty) {
      results = results.filter(a =>
        a.specialties.some(s =>
          s.toLowerCase().includes(query.specialty!.toLowerCase())
        )
      );
    }

    if (query.minRating) {
      results = results.filter(a => a.rating >= query.minRating!);
    }

    if (query.maxRate) {
      results = results.filter(a => a.ratePerMinuteCents <= query.maxRate!);
    }

    // Sort by rating
    results.sort((a, b) => b.rating - a.rating);

    return results;
  }
}

export function createERC8004(): ERC8004 {
  return new ERC8004();
}
