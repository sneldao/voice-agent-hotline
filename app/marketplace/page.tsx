'use client';

import { useState, useEffect, useCallback } from 'react';
import { Phone, Search, Star, Clock, Loader2, AlertCircle, SlidersHorizontal, X, Wallet } from 'lucide-react';
import { ActiveCall } from '@/components/ActiveCall';
import { useWallet } from '@/lib/WalletContextNew';
import { apiUrl } from '@/lib/api';

interface Agent {
  id: string;
  address: string;
  name: string;
  description: string;
  voiceId: string;
  capabilities: string[];
  ratePerMinute: number;
  rating: number;
  ratingsCount: number;
  callsCompleted: number;
}

const CAPABILITY_ICONS: Record<string, string> = {
  blockchain: '🪙',
  crypto: '🔐',
  defi: '💹',
  nft: '🖼️',
  trading: '📈',
  legal: '⚖️',
  medical: '🏥',
  finance: '💰',
  tech: '💻',
  code: '👨‍💻',
  gaming: '🎮',
  general: '🤖',
  research: '🔬',
};

function capabilityIcon(cap: string): string {
  return CAPABILITY_ICONS[cap.toLowerCase()] ?? '✨';
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            className={`w-3.5 h-3.5 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-xs text-gray-400">{(Number(rating) || 0).toFixed(1)} ({count || 0})</span>
    </div>
  );
}

function AgentSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-800 flex-shrink-0" />
        <div className="flex-1">
          <div className="h-5 bg-gray-800 rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-800 rounded w-3/4" />
        </div>
        <div className="h-6 bg-gray-800 rounded w-16" />
      </div>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map(i => <div key={i} className="h-6 bg-gray-800 rounded-full w-16" />)}
      </div>
      <div className="h-10 bg-gray-800 rounded-xl" />
    </div>
  );
}

export default function Marketplace() {
  const { connected, address, connect, isConnecting, formatAddress } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCapability, setSelectedCapability] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [inCall, setInCall] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCapability) params.set('capability', selectedCapability);
      if (maxRate) params.set('maxRate', maxRate);
      const res = await fetch(apiUrl(`/api/agents?${params}`));
      if (!res.ok) throw new Error('Failed to load agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load agents');
    } finally {
      setLoading(false);
    }
  }, [selectedCapability, maxRate]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const capabilities = [...new Set(agents.flatMap(a => a.capabilities))].slice(0, 8);

  const filtered = agents.filter(a => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.capabilities.some(c => c.toLowerCase().includes(q))
    );
  });

  if (inCall && selectedAgent) {
    return (
      <div className="min-h-screen bg-gray-950">
        <ActiveCall
          agent={{
            id: selectedAgent.id,
            name: selectedAgent.name,
            specialty: selectedAgent.description,
            rate: selectedAgent.ratePerMinute,
            color: 'from-cyan-500 to-blue-600',
          }}
          callId={`call_${Date.now()}`}
          userId="user"
          onEnd={() => { setInCall(false); setSelectedAgent(null); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/25">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">Agent Marketplace</h1>
              <p className="text-xs text-gray-500">
                {filtered.length} agent{filtered.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Wallet */}
            {connected ? (
              <div className="px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs text-gray-400 font-mono">{formatAddress()}</span>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="px-3 py-1.5 rounded-full bg-cyan-500 text-white text-xs font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50"
              >
                {isConnecting ? 'Connecting…' : 'Connect'}
              </button>
            )}
            {/* Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                showFilters
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                  : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:border-gray-600'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, skill or topic…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-gray-900 border border-gray-800 text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all placeholder:text-gray-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
            {/* Capability pills */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Specialty</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCapability('')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    !selectedCapability
                      ? 'bg-cyan-500 border-transparent text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  All
                </button>
                {capabilities.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCapability(c === selectedCapability ? '' : c)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      selectedCapability === c
                        ? 'bg-cyan-500 border-transparent text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {capabilityIcon(c)} {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Max rate */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                Max rate: {maxRate ? `$${maxRate}/min` : 'Any'}
              </p>
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={maxRate || 5}
                onChange={e => setMaxRate(Number(e.target.value) >= 5 ? '' : e.target.value)}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Free</span><span>$5/min</span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400 flex-1">{error}</p>
            <button
              onClick={fetchAgents}
              className="text-xs text-red-300 underline hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <AgentSkeleton key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold mb-2">No agents found</h3>
            <p className="text-gray-500 text-sm mb-4">Try adjusting your filters or search term</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCapability(''); setMaxRate(''); }}
              className="px-4 py-2 bg-cyan-500 text-white rounded-xl text-sm font-medium hover:bg-cyan-400 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Agent Grid */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(agent => (
              <div
                key={agent.id}
                className="group bg-gray-900 border border-gray-800 hover:border-cyan-500/40 rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/5 flex flex-col"
              >
                {/* Agent header */}
                <div className="flex items-start gap-3 mb-3">
                  {/* Avatar with gradient */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl flex-shrink-0 shadow-lg shadow-cyan-500/20">
                    {agent.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold truncate">{agent.name}</h3>
                      <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" title="Online" />
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{agent.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-cyan-400">${(agent.ratePerMinute || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-gray-500">/min</div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 mb-3">
                  <StarRating rating={agent.rating} count={agent.ratingsCount} />
                  <span className="text-xs text-gray-600">•</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Phone className="w-3 h-3" /> {agent.callsCompleted.toLocaleString()} calls
                  </span>
                </div>

                {/* Capability pills */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {agent.capabilities.slice(0, 4).map(cap => (
                    <span
                      key={cap}
                      className="px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 text-xs border border-gray-700/50"
                    >
                      {capabilityIcon(cap)} {cap}
                    </span>
                  ))}
                  {agent.capabilities.length > 4 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-500 text-xs">
                      +{agent.capabilities.length - 4}
                    </span>
                  )}
                </div>

                {/* Call button */}
                <button
                  onClick={() => { setSelectedAgent(agent); setInCall(true); }}
                  className="mt-auto w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all active:scale-[0.98] shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Call Now
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
