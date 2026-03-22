'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContextNew';
import { apiUrl } from '@/lib/api';

interface AgentStat {
  id: string;
  name: string;
  category?: string;
  avatar?: string;
  rating: number;
  totalCalls: number;
  rate: number;
  online: boolean;
  totalRevenue?: string;
  platformRevenue?: string;
  erc8004_token_id?: string;
  status?: string;
  wallet_address?: string;
}

interface StatsSummary {
  totalAgents: number;
  totalCalls: number;
  avgRating: number;
  topAgent: { name: string; calls: number; category: string; avatar: string } | null;
  generatedAt: string;
}

export default function DashboardPage() {
  const { address, isConnected, connect } = useWallet();
  const [myAgents, setMyAgents] = useState<AgentStat[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      // Fetch all agents and filter by wallet_address
      const [agentsRes, statsRes] = await Promise.all([
        fetch(apiUrl('/api/agents?status=all')),
        fetch(apiUrl('/api/agents/stats')),
      ]);
      const agentsData = await agentsRes.json();
      const statsData = await statsRes.json();

      const all: AgentStat[] = agentsData.agents || [];
      const mine = all.filter(
        a => a.wallet_address?.toLowerCase() === address.toLowerCase()
      );
      setMyAgents(mine);
      setSummary(statsData.summary || null);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalEarnings = myAgents.reduce(
    (sum, a) => sum + parseFloat(a.totalRevenue || '0'),
    0
  );
  const totalCalls = myAgents.reduce((sum, a) => sum + (a.totalCalls || 0), 0);
  const avgRating =
    myAgents.length > 0
      ? myAgents.reduce((sum, a) => sum + (a.rating || 0), 0) / myAgents.length
      : 0;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl">🎙️</div>
          <h1 className="text-xl font-semibold text-white">Agent Developer Dashboard</h1>
          <p className="text-slate-400 text-sm">Connect the wallet you used to register your agents</p>
          <button
            onClick={connect}
            className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Developer Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1 font-mono">
              {address?.slice(0, 8)}…{address?.slice(-4)}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/list-your-agent"
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + List Agent
            </a>
            <button
              onClick={fetchData}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
              ↻
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading…</div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-violet-400">{totalCalls}</div>
                <div className="text-slate-400 text-xs mt-1">Total Calls</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">{totalEarnings.toFixed(4)}</div>
                <div className="text-slate-400 text-xs mt-1">Earnings (cUSD)</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
                <div className="text-slate-400 text-xs mt-1">Avg Rating</div>
              </div>
            </div>

            {/* My agents */}
            <h2 className="text-lg font-semibold mb-4">My Agents ({myAgents.length})</h2>

            {myAgents.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                <div className="text-3xl mb-3">🤖</div>
                <p className="text-slate-400 text-sm">No agents registered with this wallet yet.</p>
                <a
                  href="/list-your-agent"
                  className="inline-block mt-4 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Register your first agent
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {myAgents.map(agent => (
                  <div key={agent.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl shrink-0">
                          {agent.avatar || '🤖'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{agent.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              agent.status === 'active'
                                ? 'bg-emerald-900 text-emerald-300'
                                : agent.status === 'rejected'
                                ? 'bg-red-900 text-red-300'
                                : 'bg-amber-900 text-amber-300'
                            }`}>
                              {agent.status || 'pending'}
                            </span>
                            {agent.online && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">online</span>
                            )}
                            {agent.erc8004_token_id && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900 text-violet-300">
                                ERC-8004 #{agent.erc8004_token_id}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 text-xs mt-0.5">{agent.category} · ${agent.rate}/min</div>
                        </div>
                      </div>

                      {/* Per-agent stats */}
                      <div className="grid grid-cols-3 gap-3 text-center shrink-0">
                        <div>
                          <div className="text-lg font-bold text-white">{agent.totalCalls || 0}</div>
                          <div className="text-slate-500 text-xs">Calls</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-emerald-400">
                            {parseFloat(agent.totalRevenue || '0').toFixed(3)}
                          </div>
                          <div className="text-slate-500 text-xs">cUSD (80%)</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-amber-400">
                            {agent.rating > 0 ? agent.rating.toFixed(1) : '—'}
                          </div>
                          <div className="text-slate-500 text-xs">Rating</div>
                        </div>
                      </div>
                    </div>

                    {/* ERC-8004 reputation note */}
                    {agent.erc8004_token_id && (
                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-500">
                        <span>⛓️</span>
                        <span>
                          On-chain identity minted · Token #{agent.erc8004_token_id} on Celo Sepolia
                        </span>
                        <a
                          href={`https://alfajores.celoscan.io/token/${process.env.NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS}?a=${agent.erc8004_token_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:text-violet-300 underline"
                        >
                          View ↗
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Platform stats context */}
            {summary && (
              <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Platform Overview</h3>
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <div className="font-bold text-white">{summary.totalAgents}</div>
                    <div className="text-slate-500 text-xs">Active Agents</div>
                  </div>
                  <div>
                    <div className="font-bold text-white">{summary.totalCalls}</div>
                    <div className="text-slate-500 text-xs">Total Calls</div>
                  </div>
                  <div>
                    <div className="font-bold text-white">{summary.avgRating.toFixed(1)}</div>
                    <div className="text-slate-500 text-xs">Avg Rating</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
