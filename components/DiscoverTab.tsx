'use client';

import { useCallback } from 'react';
import { Mic, Search, Sparkles, ShieldCheck, WalletCards } from 'lucide-react';
import { AgentCardSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { PullToRefresh, RefreshButton, showSuccess } from '@/components/ui';
import { AgentCard } from '@/app/page-components';
import { VoiceRouter } from './VoiceRouter';
import type { Agent } from '@/lib/types';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'healthcare', name: 'Health', icon: '⚕️' },
  { id: 'research', name: 'Research', icon: '🔍' },
  { id: 'tech', name: 'Tech', icon: '💻' },
  { id: 'blockchain', name: 'Crypto', icon: '🪙' },
  { id: 'general', name: 'General', icon: '🤖' },
];

const SPOKEN_DEMOS = [
  { text: 'Find someone to debug this payment issue', category: 'all', filter: 'Code Reviewer' },
  { text: 'Help me prep for a doctor visit', category: 'healthcare', filter: '' },
  { text: 'Plan a fast weekend trip', category: 'all', filter: 'Tour' },
  { text: 'Explain this wallet transaction', category: 'blockchain', filter: '' },
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
}: DiscoverTabProps) {
  const handleRefresh = useCallback(async () => {
    try {
      await onRefresh();
      showSuccess('Agents refreshed');
    } catch {
      // PullToRefresh handles its own loading state via finally
    }
  }, [onRefresh]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasNoResults = agents.length === 0 && !hasSearchQuery && !isLoading;
  const hasNoSearchResults = agents.length === 0 && hasSearchQuery && !isLoading;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <AgentCardSkeleton key={i} />
        ))}
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

  const selectedLabel = selectedCategory === 'all'
    ? 'All Agents'
    : CATEGORIES.find(c => c.id === selectedCategory)?.name || 'Agents';

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="py-5 lg:grid lg:grid-cols-[320px_1fr] lg:gap-8 lg:py-8">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <VoiceRouter agents={agents} onCallAgent={onVoiceCall} />

          <div className="hotline-grid rounded-2xl border border-gray-800 bg-gray-900/80 p-5">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Live AI switchboard
            </div>
            <h2 className="text-2xl font-bold leading-tight text-white">Say what you need. VOISSS connects the right voice.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Built for the moments when typing is awkward, impossible, or just too slow. Speak a request, get routed, and talk it through.
            </p>
            <div className="mt-5 grid gap-2 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-cyan-300" />
                Hands-free intake and live calls
              </div>
              <div className="flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-emerald-300" />
                Pay only while the line is active
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-300" />
                Specialized voices for real tasks
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Try saying</p>
            <div className="space-y-2">
              {SPOKEN_DEMOS.map((demo) => (
                <button
                  key={demo.text}
                  type="button"
                  onClick={() => {
                    onCategoryChange(demo.category);
                    onSearchChange(demo.filter);
                  }}
                  className="w-full rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                >
                  "{demo.text}"
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Categories</p>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={`
                    flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200
                    ${selectedCategory === cat.id
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-white'
                      : 'border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                    }
                  `}
                >
                  <span><span className="mr-2">{cat.icon}</span>{cat.name}</span>
                  {selectedCategory === cat.id && <span className="h-2 w-2 rounded-full bg-cyan-300" />}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="mt-5 min-w-0 space-y-5 lg:mt-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Type or say what you need..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full rounded-xl border border-gray-700/50 bg-gray-800/50 py-3 pl-10 pr-12 text-sm transition-all focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
            </div>
            <RefreshButton onRefresh={handleRefresh} />
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter(cat => cat.id !== 'all').slice(0, 4).map(cat => (
              <button
                key={`voice-${cat.id}`}
                type="button"
                onClick={() => {
                  onCategoryChange(cat.id);
                  onSearchChange(`Show me ${cat.name.toLowerCase()}`);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-gray-700/50 bg-gray-900/70 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
              >
                <Mic className="h-3 w-3" />
                Route me to {cat.name.toLowerCase()}
              </button>
            ))}
          </div>

          <section aria-label="Agent list">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedLabel}</h2>
                <p className="text-sm text-gray-500">{agents.length} live lines available</p>
              </div>
            </div>
            {hasNoSearchResults ? (
              <div className="min-h-[300px] rounded-2xl border border-gray-800 bg-gray-900/50 p-8 text-center">
                <p className="text-base font-semibold text-white">No lines matched that filter.</p>
                <p className="mt-2 text-sm text-gray-400">Clear the filter or use the Voice Router to connect by intent.</p>
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="mt-5 rounded-xl bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <div className="grid min-h-[400px] gap-3 lg:grid-cols-2">
                {agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={() => onSelect(agent)}
                  />
                ))}
              </div>
            )}
            {hasMore && (
              <button
                onClick={onLoadMore}
                className="mt-4 w-full rounded-xl bg-cyan-500/10 py-3 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20 hover:text-cyan-300"
              >
                Load More
              </button>
            )}
          </section>
        </div>
      </div>
    </PullToRefresh>
  );
}
