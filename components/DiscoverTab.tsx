'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search, PhoneCall, Loader2 } from 'lucide-react';
import { AgentCardSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { PullToRefresh, RefreshButton, showSuccess, showInfo } from '@/components/ui';
import { AgentCard, getPersona } from '@/app/page-components';
import { playDialTone } from '@/lib/sounds';
import type { Agent } from '@/lib/types';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'healthcare', name: 'Health', icon: '⚕️' },
  { id: 'research', name: 'Research', icon: '🔍' },
  { id: 'tech', name: 'Tech', icon: '💻' },
  { id: 'blockchain', name: 'Crypto', icon: '🪙' },
  { id: 'general', name: 'General', icon: '🤖' },
];

interface DiscoverTabProps {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  onSelect: (a: Agent) => void;
  onVoiceCall: (a: Agent) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  onRefresh: () => Promise<void>;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Agent ID to use for the main dial button. Defaults to 'general_helper'. */
  preferredConciergeId?: string;
}

export function DiscoverTab({
  agents,
  isLoading,
  error,
  onSelect,
  onVoiceCall,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onRefresh,
  hasMore,
  onLoadMore,
  preferredConciergeId = 'general_helper',
}: DiscoverTabProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleRefresh = useCallback(async () => {
    try {
      await onRefresh();
      showSuccess('Agents refreshed');
    } catch { /* handled */ }
  }, [onRefresh]);

  const concierge = agents.find(a => a.id === preferredConciergeId) || agents.find(a => a.id === 'general_helper') || agents[0];

  const handleDialClick = useCallback(() => {
    if (!concierge || isConnecting) return;
    // Sound + haptic feedback
    playDialTone();
    try { navigator.vibrate?.(50); } catch { /* unsupported */ }
    setIsConnecting(true);
    onVoiceCall(concierge);
    setTimeout(() => setIsConnecting(false), 2000);
  }, [concierge, isConnecting, onVoiceCall]);

  /** Voice preview — plays a short description of the agent's voice */
  const handleVoicePreview = useCallback((agent: Agent) => {
    // Show a toast with voice info since we can't actually play audio inline
    const persona = getPersona(agent);
    showInfo(`${persona.voiceId} voice — ${persona.tone.toLowerCase()}, ${persona.desk.toLowerCase()}`);
    try { navigator.vibrate?.(15); } catch { /* unsupported */ }
  }, []);

  /** Search suggestions based on partial input */
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return agents
      .filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.specialty.toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map(a => ({ id: a.id, label: a.name, subtitle: a.specialty }));
  }, [agents, searchQuery]);

  const hasNoResults = agents.length === 0 && !isLoading && searchQuery.trim().length === 0;
  const hasNoSearchResults = agents.length === 0 && searchQuery.trim().length > 0 && !isLoading;

  // Compute per-category agent counts for filter badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: agents.length };
    for (const agent of agents) {
      const cat = agent.category?.toLowerCase() ?? 'general';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [agents]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => <AgentCardSkeleton key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        type="agents"
        title="Failed to load agents"
        description={error}
        actionLabel="Try Again"
        onAction={handleRefresh}
      />
    );
  }

  if (hasNoResults) {
    return (
      <EmptyState
        type="agents"
        title="No agents available"
        description="Check back later for new AI agents"
      />
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="py-4">
        {/* Search + filters */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5b2b1d]" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="paper-input w-full rounded-xl border py-3 pl-10 pr-12 text-sm font-medium transition-all focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-[#5b2b1d] transition-colors hover:bg-red-900/10"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
              {/* Search suggestions dropdown */}
              {searchSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-amber-100/15 bg-[#17100d]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
                  {searchSuggestions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onSearchChange(s.label);
                        const agent = agents.find(a => a.id === s.id);
                        if (agent) onSelect(agent);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-amber-100/5"
                    >
                      <Search className="h-4 w-4 flex-shrink-0 text-amber-100/40" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-100 truncate">{s.label}</p>
                        <p className="text-xs text-amber-100/45 truncate">{s.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <RefreshButton onRefresh={handleRefresh} />
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const count = categoryCounts[cat.id] ?? 0;
              const isAll = cat.id === 'all';
              return (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={`
                    rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200
                    ${selectedCategory === cat.id
                      ? 'border-red-400/50 bg-red-500/20 text-amber-50'
                      : count === 0 && !isAll
                        ? 'border-amber-100/5 bg-black/15 text-amber-100/25 cursor-default'
                        : 'border-amber-100/10 bg-black/25 text-amber-100/50 hover:border-amber-100/25 hover:text-amber-50'
                    }
                  `}
                  disabled={count === 0 && !isAll}
                >
                  <span className="mr-1.5">{cat.icon}</span>{cat.name}
                  {!isAll && <span className="ml-1 opacity-60">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Agent grid */}
        {hasNoSearchResults ? (
          <div className="min-h-[200px] rounded-[1.5rem] border border-amber-100/15 bg-[#17100d]/85 p-8 text-center">
            <p className="text-base font-semibold text-amber-50">No agents match that filter.</p>
            <p className="mt-2 text-sm text-amber-100/55">Try a different search or clear the filter.</p>
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="mt-5 rounded-xl border border-amber-100/20 bg-amber-100/10 px-4 py-2 text-sm font-bold text-amber-100 transition-colors hover:bg-amber-100/15"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => onSelect(agent)}
                onVoicePreview={handleVoicePreview}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <button
            onClick={onLoadMore}
            className="mt-4 w-full rounded-xl border border-amber-100/15 bg-[#17100d]/85 py-3 text-sm font-bold text-amber-100 transition-colors hover:bg-red-500/10"
          >
            Load More
          </button>
        )}
      </div>

      {/* FAB dial — floating action button for quick call */}
      <button
        onClick={handleDialClick}
        disabled={!concierge || isConnecting}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-amber-500 shadow-lg shadow-red-900/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Start a voice call"
      >
        {isConnecting ? (
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        ) : (
          <PhoneCall className="h-6 w-6 text-white" />
        )}
      </button>
    </PullToRefresh>
  );
}
