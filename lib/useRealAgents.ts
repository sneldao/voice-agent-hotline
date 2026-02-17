'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Agent {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  rating: number;
  totalRatings: number;
  rate: number;
  avatar: string;
  color: string;
  online: boolean;
  tags: string[];
  voiceId?: string;
  elevenlabsAgentId?: string;
  category?: string;
}

export interface CallHistory {
  id: string;
  agentName: string;
  agentId: string;
  duration: number;
  cost: number;
  date: string;
  rating: number;
  status: 'completed' | 'failed' | 'disputed';
  txHash?: string;
}

interface UseRealAgentsReturn {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseCallHistoryReturn {
  history: CallHistory[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Fallback agents if API fails
const FALLBACK_AGENTS: Agent[] = [
  {
    id: 'agent_2101khgsy8aqfxv8yr3r9548bqrx',
    name: 'Solana Sage',
    specialty: 'Blockchain Analyst',
    bio: 'Expert blockchain analyst specializing in Solana. Check wallet balances, explain transactions, and provide real-time blockchain data.',
    rating: 4.8,
    totalRatings: 156,
    rate: 0.10,
    avatar: '🪙',
    color: 'from-purple-500 to-indigo-500',
    online: true,
    tags: ['Solana', 'Blockchain', 'Crypto'],
    voiceId: 'CwhRBWXzGAHq8TQ4Fs17',
    elevenlabsAgentId: 'agent_2101khgsy8aqfxv8yr3r9548bqrx',
    category: 'blockchain',
  },
  {
    id: 'agent_0201khgsya1dfcgv6p5ch10995b9',
    name: 'Code Reviewer',
    specialty: 'Software Engineer',
    bio: 'Senior software engineer specializing in code analysis and GitHub workflows. Review repos, search code, create issues.',
    rating: 4.9,
    totalRatings: 234,
    rate: 0.15,
    avatar: '💻',
    color: 'from-cyan-500 to-blue-500',
    online: true,
    tags: ['Code Review', 'GitHub', 'Engineering'],
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    elevenlabsAgentId: 'agent_0201khgsya1dfcgv6p5ch10995b9',
    category: 'tech',
  },
  {
    id: 'agent_6701khgsyb70fdebb2ce36dfjs2m',
    name: 'Tournament Master',
    specialty: 'Esports Analyst',
    bio: 'Enthusiastic esports analyst for gaming statistics, tournament information, player profiles, and match history.',
    rating: 4.6,
    totalRatings: 89,
    rate: 0.08,
    avatar: '🎮',
    color: 'from-green-500 to-emerald-500',
    online: true,
    tags: ['Gaming', 'Esports', 'Tournaments'],
    voiceId: 'IKne3meq5aSn9XLyUdCD',
    elevenlabsAgentId: 'agent_6701khgsyb70fdebb2ce36dfjs2m',
    category: 'gaming',
  },
  {
    id: 'agent_2101khgsyd02fnvshvr7rzb50qj6',
    name: 'General Helper',
    specialty: 'AI Assistant',
    bio: 'Versatile AI assistant for web research, fact-checking, calculations, weather info, and general queries.',
    rating: 4.7,
    totalRatings: 412,
    rate: 0.05,
    avatar: '🤖',
    color: 'from-amber-500 to-orange-500',
    online: true,
    tags: ['General', 'Research', 'Help'],
    voiceId: 'SAz9YHcvj6GT2YYXdXww',
    elevenlabsAgentId: 'agent_2101khgsyd02fnvshvr7rzb50qj6',
    category: 'general',
  },
];

export function useRealAgents(): UseRealAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to fetch from API
      const response = await fetch('/api/agents');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different API response formats
      const agentsData = data.agents || data.data?.agents || [];
      
      if (agentsData.length > 0) {
        // Transform API data to Agent format
        const transformedAgents: Agent[] = agentsData.map((agent: any) => ({
          id: agent.id || agent.agentId,
          name: agent.name,
          specialty: agent.specialty || agent.category || 'General',
          bio: agent.bio || agent.description || '',
          rating: agent.rating || 0,
          totalRatings: agent.totalRatings || 0,
          rate: agent.rate || agent.ratePerMinute || agent.price_per_minute || 0.1,
          avatar: agent.avatar || getDefaultAvatar(agent.category),
          color: agent.color || getDefaultColor(agent.category),
          online: agent.online !== false,
          tags: agent.tags || agent.skills || [],
          voiceId: agent.voiceId || agent.voice_id,
          elevenlabsAgentId: agent.elevenlabsAgentId || agent.elevenlabs_agent_id,
          category: agent.category,
        }));
        
        setAgents(transformedAgents);
      } else {
        // Use fallback if API returns empty
        setAgents(FALLBACK_AGENTS);
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
      setError('Failed to load agents. Using fallback data.');
      setAgents(FALLBACK_AGENTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, isLoading, error, refetch: fetchAgents };
}

export function useCallHistory(address?: string): UseCallHistoryReturn {
  const [history, setHistory] = useState<CallHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!address) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${address}/calls`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status}`);
      }

      const data = await response.json();
      const callsData = data.calls || data.history || [];
      
      setHistory(callsData.map((call: any) => ({
        id: call.id || call.callId,
        agentName: call.agentName || call.agent?.name || 'Unknown Agent',
        agentId: call.agentId,
        duration: call.duration || 0,
        cost: call.cost || call.amount || 0,
        date: call.date || call.createdAt || new Date().toISOString(),
        rating: call.rating || 0,
        status: call.status || 'completed',
        txHash: call.txHash,
      })));
    } catch (err) {
      console.error('Error fetching call history:', err);
      setError('Failed to load call history');
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, isLoading, error, refetch: fetchHistory };
}

// Helper functions
function getDefaultAvatar(category?: string): string {
  const avatars: Record<string, string> = {
    blockchain: '🪙',
    tech: '💻',
    gaming: '🎮',
    general: '🤖',
    legal: '⚖️',
    medical: '🏥',
    finance: '💰',
    creative: '🎨',
    education: '📚',
    business: '💼',
  };
  return avatars[category || 'general'] || '🤖';
}

function getDefaultColor(category?: string): string {
  const colors: Record<string, string> = {
    blockchain: 'from-purple-500 to-indigo-500',
    tech: 'from-cyan-500 to-blue-500',
    gaming: 'from-green-500 to-emerald-500',
    general: 'from-amber-500 to-orange-500',
    legal: 'from-red-500 to-rose-500',
    medical: 'from-teal-500 to-cyan-500',
    finance: 'from-yellow-500 to-amber-500',
    creative: 'from-pink-500 to-rose-500',
    education: 'from-blue-500 to-indigo-500',
    business: 'from-gray-500 to-slate-500',
  };
  return colors[category || 'general'] || 'from-cyan-500 to-blue-500';
}
