'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from './api';

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
  walletAddress?: string;
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
    walletAddress: process.env.NEXT_PUBLIC_PLATFORM_ADDRESS,
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
    walletAddress: process.env.NEXT_PUBLIC_PLATFORM_ADDRESS,
  },
  {
    id: 'agent_diversifi_prod_001',
    name: 'Diversifi',
    specialty: 'Stablecoin Advisor',
    bio: 'Professional advisor specializing in stablecoins (cUSD, USDC, USDT) and wealth diversification strategies on Celo and Base.',
    rating: 5.0,
    totalRatings: 0,
    rate: 0.12,
    avatar: '🛡️',
    color: 'from-blue-600 to-cyan-500',
    online: true,
    tags: ['Finance', 'Stablecoins', 'Diversification'],
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    elevenlabsAgentId: '', // Set after seeding
    category: 'finance',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  },
  {
    id: 'agent_clawdy_prod_001',
    name: 'Clawdy',
    specialty: 'Infrastructure Expert',
    bio: 'Specialist in agentic infrastructure, including OpenClaw, Kilocode Cloud Agents, ERC-8004, and decentralized inference providers.',
    rating: 4.9,
    totalRatings: 12,
    rate: 0.15,
    avatar: '🏗️',
    color: 'from-gray-700 to-slate-900',
    online: true,
    tags: ['Infrastructure', 'DevOps', 'Cloud'],
    voiceId: 'pNInz6obpgnuMvscWqt5',
    elevenlabsAgentId: '', // Set after seeding
    category: 'tech',
    walletAddress: '0x321d35Cc6634C0532925a3b844Bc454e4438f44e',
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
      const response = await fetch(apiUrl('/api/agents'));

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
          rating: Number(agent.rating || 0),
          totalRatings: Number(agent.totalRatings || 0),
          rate: Number(agent.rate || agent.ratePerMinute || agent.price_per_minute || 0.1),
          avatar: agent.avatar || getDefaultAvatar(agent.category),
          color: agent.color || getDefaultColor(agent.category),
          online: agent.online !== false,
          tags: agent.tags || agent.skills || [],
          voiceId: agent.voiceId || agent.voice_id,
          elevenlabsAgentId: agent.elevenlabsAgentId || agent.elevenlabs_agent_id,
          category: agent.category,
          walletAddress: agent.walletAddress || agent.wallet_address,
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
      const response = await fetch(apiUrl(`/api/users/${address}/calls`));

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
