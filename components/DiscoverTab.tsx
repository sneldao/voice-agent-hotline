'use client';

import { useCallback } from 'react';
import { Search, Star } from 'lucide-react';
import { AgentCardSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { PullToRefresh, RefreshButton, showSuccess } from '@/components/ui';
import { AgentCard, FeaturedCard } from '@/app/page-components';
import type { Agent } from '@/lib/types';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'blockchain', name: 'Blockchain', icon: '🪙' },
  { id: 'tech', name: 'Tech', icon: '💻' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'general', name: 'General', icon: '🤖' },
];

interface DiscoverTabProps {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  onSelect: (a: Agent) => void;
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

  const onlineAgents = agents.filter(a => a.online);
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

  if (hasNoSearchResults) {
    return (
      <EmptyState
        type="search"
        title="No agents found"
        description={`No results for "${searchQuery}"`}
        actionLabel="Clear Search"
        onAction={() => onSearchChange('')}
      />
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="p-4 space-y-5">
        {/* Hero Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-4 text-center">
          <p className="text-sm font-medium text-cyan-300">🎙️ Tap an agent, then just talk — no keyboard needed</p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
          </div>
          <RefreshButton onRefresh={handleRefresh} />
        </div>

        {/* Categories */}
        <div className="w-full">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`
                  flex-shrink-0 px-3 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 border whitespace-nowrap
                  ${selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent shadow-lg shadow-cyan-500/25'
                    : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600'
                  }
                `}
              >
                <span className="mr-1">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Featured Agents — online only, max 10 */}
        {onlineAgents.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" /> Featured
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {onlineAgents.slice(0, 10).map(agent => (
                <FeaturedCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => onSelect(agent)}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Agents */}
        <section aria-label="Agent list">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">
            {selectedCategory === 'all' ? 'All Agents' : CATEGORIES.find(c => c.id === selectedCategory)?.name}
            <span className="ml-2 text-xs text-gray-500">({agents.length})</span>
          </h2>
          <div className="space-y-3 min-h-[400px]">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => onSelect(agent)}
              />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={onLoadMore}
              className="w-full mt-4 py-3 text-sm font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-xl transition-colors"
            >
              Load More
            </button>
          )}
        </section>
      </div>
    </PullToRefresh>
  );
}
