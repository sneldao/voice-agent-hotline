'use client';

// Force dynamic rendering to avoid SSR issues with client-only SDKs
export const revalidate = 0;

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContextNew';
import { apiUrl } from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
  active?: string | boolean;
  wallet_address?: string;
  elevenlabs_agent_id?: string;
  rate?: string;
  submitted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  erc8004_token_id?: string;
  totalCalls?: string;
  totalRevenue?: string;
  rating?: string;
}

const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').toLowerCase().split(',').filter(Boolean);

function isAdmin(address: string | null): boolean {
  if (!address) return false;
  if (ADMIN_WALLETS.length === 0) return false; // locked if not configured
  return ADMIN_WALLETS.includes(address.toLowerCase());
}

export default function AdminPage() {
  const { address, connected, connect } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/agents?status=all'));
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      showToast('Failed to load agents', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setActionLoading(id + action);
    try {
      const res = await fetch(apiUrl(`/api/agents/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      showToast(
        action === 'approve'
          ? `Agent approved${data.erc8004TokenId ? ` · ERC-8004 #${data.erc8004TokenId}` : ''}`
          : 'Agent rejected'
      );
      fetchAgents();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent permanently?')) return;
    setActionLoading(id + 'delete');
    try {
      const res = await fetch(apiUrl(`/api/agents/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Agent deleted');
      fetchAgents();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = agents.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'pending') return a.status === 'pending' || (!a.status && a.active !== 'true' && a.active !== true);
    if (filter === 'active') return a.status === 'active' || a.active === 'true' || a.active === true;
    if (filter === 'rejected') return a.status === 'rejected';
    return true;
  });

  const counts = {
    pending: agents.filter(a => a.status === 'pending').length,
    active: agents.filter(a => a.status === 'active' || a.active === 'true' || a.active === true).length,
    rejected: agents.filter(a => a.status === 'rejected').length,
    all: agents.length,
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl">🔐</div>
          <h1 className="text-xl font-semibold text-white">Admin Access</h1>
          <p className="text-slate-400 text-sm">Connect your wallet to access the admin panel</p>
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

  if (connected && !isAdmin(address)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl">🚫</div>
          <h1 className="text-xl font-semibold text-white">Access Denied</h1>
          <p className="text-slate-400 text-sm">This wallet is not authorised to access the admin panel.</p>
          <p className="text-slate-600 text-xs font-mono">{address}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Agent Admin</h1>
            <p className="text-slate-400 text-sm mt-1">Review and manage agent registrations</p>
          </div>
          <button
            onClick={fetchAgents}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(['pending', 'active', 'rejected', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1.5 text-xs opacity-70">({counts[f]})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading agents…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No {filter} agents</div>
        ) : (
          <div className="space-y-4">
            {filtered.map(agent => (
              <div key={agent.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{agent.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        agent.status === 'active' || agent.active === 'true' || agent.active === true
                          ? 'bg-emerald-900 text-emerald-300'
                          : agent.status === 'rejected'
                          ? 'bg-red-900 text-red-300'
                          : 'bg-amber-900 text-amber-300'
                      }`}>
                        {agent.status || 'pending'}
                      </span>
                      {agent.erc8004_token_id && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900 text-violet-300">
                          ERC-8004 #{agent.erc8004_token_id}
                        </span>
                      )}
                    </div>
                    {agent.description && (
                      <p className="text-slate-400 text-sm mt-1 line-clamp-2">{agent.description}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      {agent.category && <span>Category: <span className="text-slate-300">{agent.category}</span></span>}
                      {agent.rate && <span>Rate: <span className="text-slate-300">${agent.rate}/min</span></span>}
                      {agent.totalCalls && <span>Calls: <span className="text-slate-300">{agent.totalCalls}</span></span>}
                      {agent.totalRevenue && <span>Revenue: <span className="text-slate-300">{parseFloat(agent.totalRevenue).toFixed(4)} cUSD</span></span>}
                      {agent.wallet_address && (
                        <span>Wallet: <span className="text-slate-300 font-mono">{agent.wallet_address.slice(0, 8)}…{agent.wallet_address.slice(-4)}</span></span>
                      )}
                      {agent.elevenlabs_agent_id && (
                        <span>EL ID: <span className="text-slate-300 font-mono">{agent.elevenlabs_agent_id}</span></span>
                      )}
                      {agent.submitted_at && (
                        <span>Submitted: <span className="text-slate-300">{new Date(agent.submitted_at).toLocaleDateString()}</span></span>
                      )}
                    </div>
                    {agent.rejection_reason && (
                      <p className="text-red-400 text-xs mt-1">Reason: {agent.rejection_reason}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {(agent.status === 'pending' || !agent.status) && (
                      <>
                        {agent.erc8004_token_id && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900 text-violet-300">
                            ERC-8004 #{agent.erc8004_token_id}
                          </span>
                        )}
                        <button
                          onClick={() => handleAction(agent.id, 'approve')}
                          disabled={actionLoading === agent.id + 'approve'}
                          className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {actionLoading === agent.id + 'approve' ? '…' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Rejection reason (optional):') ?? '';
                            handleAction(agent.id, 'reject', reason);
                          }}
                          disabled={actionLoading === agent.id + 'reject'}
                          className="px-4 py-1.5 bg-red-900 hover:bg-red-800 disabled:opacity-50 text-red-200 rounded-lg text-sm font-medium transition-colors"
                        >
                          {actionLoading === agent.id + 'reject' ? '…' : '✗ Reject'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(agent.id)}
                      disabled={actionLoading === agent.id + 'delete'}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 rounded-lg text-sm transition-colors"
                    >
                      {actionLoading === agent.id + 'delete' ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
