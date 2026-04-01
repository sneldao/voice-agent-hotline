// ============================================
// Agent SDK for External Developers
// ============================================
// Enables anyone to register their AI/expert agent on the marketplace
// and earn from voice calls

import { redis } from './redis';
import { CELO_TOKENS } from './payment-settlement';
import type { Address } from 'viem';

// ============================================
// Types
// ============================================
export interface AgentSDKConfig {
  name: string;
  description: string;
  category: AgentCategory;
  skills: string[];
  ratePerMinute: number; // in cents (e.g., 10 = $0.10/min)
  walletAddress: Address; // Where they receive payments
  webhookUrl: string; // Their server endpoint for voice requests
  credentials?: ExpertCredentials;
  voice?: {
    provider: 'elevenlabs' | 'custom';
    voiceId?: string;
    customEndpoint?: string;
  };
}

export interface ExpertCredentials {
  type: 'bar_license' | 'medical_license' | 'cfa' | 'cpa' | 'github' | 'portfolio' | 'other';
  value: string;
  proofUrl?: string;
  verified: boolean;
}

export type AgentCategory = 
  | 'legal'
  | 'medical'
  | 'finance'
  | 'tech'
  | 'creative'
  | 'education'
  | 'business'
  | 'general';

export interface RegisteredAgent {
  id: string;
  apiKey: string;
  config: AgentSDKConfig;
  status: 'pending' | 'active' | 'suspended';
  createdAt: number;
  totalCalls: number;
  totalRevenue: number;
  rating: number;
  totalRatings: number;
}

export interface VoiceRequest {
  callId: string;
  agentId: string;
  userMessage: string;
  conversationHistory: Array<{
    role: 'user' | 'agent';
    content: string;
  }>;
  payment: {
    authorized: boolean;
    amount: number;
  };
}

export interface VoiceResponse {
  message: string;
  audioUrl?: string; // If they host their own TTS
  endCall?: boolean;
  actions?: AgentAction[];
}

export interface AgentAction {
  type: 'book' | 'order' | 'schedule' | 'research';
  payload: Record<string, any>;
}

// ============================================
// Platform Configuration
// ============================================
const PLATFORM_FEE_PERCENT = 10; // Platform takes 10%, agent gets 90%
const MIN_RATE_CENTS = 5; // Minimum $0.05/min
const MAX_RATE_CENTS = 1000; // Maximum $10/min

// ============================================
// Agent SDK Service
// ============================================
export class AgentSDK {
  /**
   * Register a new external agent
   */
  async registerAgent(config: AgentSDKConfig): Promise<RegisteredAgent> {
    // Validate rate
    if (config.ratePerMinute < MIN_RATE_CENTS) {
      throw new Error(`Rate must be at least $${MIN_RATE_CENTS / 100}/min`);
    }
    if (config.ratePerMinute > MAX_RATE_CENTS) {
      throw new Error(`Rate must be at most $${MAX_RATE_CENTS / 100}/min`);
    }

    // Validate webhook URL
    try {
      new URL(config.webhookUrl);
    } catch {
      throw new Error('Invalid webhook URL');
    }

    // Generate unique IDs
    const agentId = `ext_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const apiKey = `ak_${Buffer.from(Math.random().toString()).toString('base64').slice(0, 32)}`;

    const agent: RegisteredAgent = {
      id: agentId,
      apiKey,
      config,
      status: 'pending', // Requires approval for certain categories
      createdAt: Date.now(),
      totalCalls: 0,
      totalRevenue: 0,
      rating: 0,
      totalRatings: 0,
    };

    // Store in Redis
    await redis.hset(`agent:${agentId}`, this.serializeAgent(agent));
    await redis.set(`apikey:${apiKey}`, agentId);
    // Add to index set for efficient listing
    await redis.sadd('agent_index:external', agentId);

    // Auto-approve general category, pending for sensitive categories
    if (config.category === 'legal' || config.category === 'medical') {
      // Requires credential verification
      await redis.set(`verification:${agentId}`, 'pending');
    } else {
      agent.status = 'active';
      await redis.hset(`agent:${agentId}`, this.serializeAgent(agent));
    }

    console.log('[AgentSDK] New agent registered:', {
      agentId,
      category: config.category,
      rate: config.ratePerMinute,
    });

    return agent;
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<RegisteredAgent | null> {
    const data = await redis.hgetall(`agent:${agentId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return this.deserializeAgent(data as Record<string, string>);
  }

  /**
   * Get agent by API key
   */
  async getAgentByApiKey(apiKey: string): Promise<RegisteredAgent | null> {
    const agentId = await redis.get(`apikey:${apiKey}`);
    if (!agentId) {
      return null;
    }
    return this.getAgent(agentId as string);
  }

  /**
   * List all active agents
   */
  async listAgents(filters?: {
    category?: AgentCategory;
    minRating?: number;
    maxRate?: number;
  }): Promise<RegisteredAgent[]> {
    // Use Set index instead of KEYS for O(1) lookup
    const agentIds = await redis.smembers('agent_index:external');
    if (agentIds.length === 0) return [];

    // Batch fetch with pipeline
    const pipeline = redis.pipeline();
    agentIds.forEach(id => pipeline.hgetall(`agent:${id}`));
    const results = await pipeline.exec();

    const agents: RegisteredAgent[] = [];
    for (const raw of results || []) {
      const data = (raw as [Error | null, Record<string, string>])[1];
      if (!data) continue;

      const agent = this.deserializeAgent(data);
      if (agent.status !== 'active') continue;

      // Apply filters
      if (filters?.category && agent.config.category !== filters.category) continue;
      if (filters?.minRating && agent.rating < filters.minRating) continue;
      if (filters?.maxRate && agent.config.ratePerMinute > filters.maxRate) continue;

      agents.push(agent);
    }

    // Sort by rating
    agents.sort((a, b) => b.rating - a.rating);

    return agents;
  }

  /**
   * Forward voice request to external agent's webhook
   */
  async handleVoiceRequest(
    agentId: string,
    request: VoiceRequest
  ): Promise<VoiceResponse> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    if (agent.status !== 'active') {
      throw new Error('Agent is not active');
    }

    console.log('[AgentSDK] Forwarding voice request:', {
      agentId,
      callId: request.callId,
      webhook: agent.config.webhookUrl,
    });

    // Forward to agent's webhook
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(agent.config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-API-Key': agent.apiKey,
        'X-Agent-ID': agentId,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Agent webhook failed: ${response.status}`);
    }

    const voiceResponse: VoiceResponse = await response.json();
    return voiceResponse;
  }

  /**
   * Calculate payment split between platform and agent
   */
  calculatePaymentSplit(amountCents: number): {
    platform: number;
    agent: number;
  } {
    const platform = Math.floor(amountCents * (PLATFORM_FEE_PERCENT / 100));
    const agent = amountCents - platform;
    return { platform, agent };
  }

  /**
   * Record a completed call and update agent stats
   */
  async recordCall(
    agentId: string,
    callData: {
      callId: string;
      durationSeconds: number;
      amountCents: number;
      rating?: number;
    }
  ): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    // Update stats
    agent.totalCalls++;
    
    const split = this.calculatePaymentSplit(callData.amountCents);
    agent.totalRevenue += split.agent / 100; // Convert cents to dollars

    // Update rating
    if (callData.rating) {
      const totalRating = agent.rating * agent.totalRatings + callData.rating;
      agent.totalRatings++;
      agent.rating = totalRating / agent.totalRatings;
    }

    await redis.hset(`agent:${agentId}`, this.serializeAgent(agent));

    // Store call record
    await redis.hset(`call:${callData.callId}`, {
      agentId,
      duration: callData.durationSeconds.toString(),
      amount: callData.amountCents.toString(),
      agentShare: split.agent.toString(),
      platformShare: split.platform.toString(),
      timestamp: Date.now().toString(),
    });

    console.log('[AgentSDK] Call recorded:', {
      agentId,
      callId: callData.callId,
      revenue: split.agent / 100,
    });
  }

  /**
   * Update agent configuration
   */
  async updateAgent(
    agentId: string,
    apiKey: string,
    updates: Partial<AgentSDKConfig>
  ): Promise<RegisteredAgent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    if (agent.apiKey !== apiKey) {
      throw new Error('Invalid API key');
    }

    // Apply updates
    agent.config = { ...agent.config, ...updates };
    await redis.hset(`agent:${agentId}`, this.serializeAgent(agent));

    return agent;
  }

  /**
   * Verify agent credentials (for legal/medical)
   */
  async verifyCredentials(
    agentId: string,
    verified: boolean,
    notes?: string
  ): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.config.credentials) {
      agent.config.credentials.verified = verified;
    }

    if (verified) {
      agent.status = 'active';
    }

    await redis.hset(`agent:${agentId}`, this.serializeAgent(agent));
    await redis.set(`verification:${agentId}`, verified ? 'verified' : 'rejected');

    console.log('[AgentSDK] Credentials verified:', { agentId, verified, notes });
  }

  // ============================================
  // Serialization Helpers
  // ============================================
  private serializeAgent(agent: RegisteredAgent): Record<string, string> {
    return {
      id: agent.id,
      apiKey: agent.apiKey,
      name: agent.config.name,
      description: agent.config.description,
      category: agent.config.category,
      skills: JSON.stringify(agent.config.skills),
      ratePerMinute: agent.config.ratePerMinute.toString(),
      walletAddress: agent.config.walletAddress,
      webhookUrl: agent.config.webhookUrl,
      credentials: JSON.stringify(agent.config.credentials),
      voice: JSON.stringify(agent.config.voice),
      status: agent.status,
      createdAt: agent.createdAt.toString(),
      totalCalls: agent.totalCalls.toString(),
      totalRevenue: agent.totalRevenue.toString(),
      rating: agent.rating.toString(),
      totalRatings: agent.totalRatings.toString(),
    };
  }

  private deserializeAgent(data: Record<string, string>): RegisteredAgent {
    return {
      id: data.id,
      apiKey: data.apiKey,
      config: {
        name: data.name,
        description: data.description,
        category: data.category as AgentCategory,
        skills: JSON.parse(data.skills || '[]'),
        ratePerMinute: parseInt(data.ratePerMinute),
        walletAddress: data.walletAddress as Address,
        webhookUrl: data.webhookUrl,
        credentials: data.credentials ? JSON.parse(data.credentials) : undefined,
        voice: data.voice ? JSON.parse(data.voice) : undefined,
      },
      status: data.status as 'pending' | 'active' | 'suspended',
      createdAt: parseInt(data.createdAt),
      totalCalls: parseInt(data.totalCalls),
      totalRevenue: parseFloat(data.totalRevenue),
      rating: parseFloat(data.rating),
      totalRatings: parseInt(data.totalRatings),
    };
  }
}

// ============================================
// SDK Client for External Developers
// ============================================
export class AgentSDKClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = '') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string; agentId?: string }> {
    const res = await fetch(`${this.baseUrl}/api/sdk/health`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    return res.json();
  }

  /**
   * Get agent stats
   */
  async getStats(): Promise<{
    totalCalls: number;
    totalRevenue: number;
    rating: number;
    totalRatings: number;
  }> {
    const res = await fetch(`${this.baseUrl}/api/sdk/stats`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    return res.json();
  }

  /**
   * Update agent configuration
   */
  async updateConfig(updates: Partial<AgentSDKConfig>): Promise<RegisteredAgent> {
    const res = await fetch(`${this.baseUrl}/api/sdk/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(updates),
    });
    return res.json();
  }
}

// ============================================
// Singleton Instance
// ============================================
export const agentSDK = new AgentSDK();
