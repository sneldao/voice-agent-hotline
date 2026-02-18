'use client';

import { useState, useCallback, useMemo } from 'react';
import { ArrowRight, Search, Sparkles, Star } from 'lucide-react';
import { AgentCardSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { SmartAgentFinder } from '@/components/SmartAgentFinder';
import { PullToRefresh, RefreshButton, EmptySearchState, showSuccess } from '@/components/ui';
import { AgentCard, FeaturedCard, AgentDetailModal } from '@/app/page-components';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'blockchain', name: 'Blockchain', icon: '🪙' },
  { id: 'tech', name: 'Tech', icon: '💻' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'general', name: 'General', icon: '🤖' },
];

interface DiscoverTabProps {
  agents: any[];
  isLoading: boolean;
  error: string | null;
  onSelect: (a: any) => void;
  selectedAgent: any | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  onCall: () => void;
  onRefresh: () => Promise<void>;
  showSmartFinder: boolean;
  onToggleSmartFinder: () => void;
}

export function DiscoverTab({
  agents,
  isLoading,
  error,
  onSelect,
  selectedAgent,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onCall,
  onRefresh,
  showSmartFinder,
  onToggleSmartFinder,
}: DiscoverTabProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
    showSuccess('Agents refreshed');
  }, [onRefresh]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasNoResults = agents.length === 0 && !hasSearchQuery && !isLoading;
  const hasNoSearchResults = agents.length === 0 && hasSearchQuery && !isLoading;

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = !searchQuery || 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.specialty.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || agent.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [agents, searchQuery, selectedCategory]);

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
        {/* Smart Agent Finder */}
        {showSmartFinder ? (
          <SmartAgentFinder
            availableAgents={agents.map(a => a.id)}
            onSelectAgent={(agentId) => {
              const agent = agents.find(a => a.id === agentId);
              if (agent) onSelect(agent);
            }}
            onMinimize={onToggleSmartFinder}
          />
        ) : (
          <button
            onClick={onToggleSmartFinder}
            className="w-full p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl text-left hover:border-cyan-500/50 transition-all group flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white group-hover:text-cyan-400 transition-colors">
                Smart Agent Finder
              </p>
              <p className="text-sm text-gray-400">AI-powered agent matching</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-cyan-400 transition-colors" />
          </button>
        )}

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Or search agents manually..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
          </div>
          <RefreshButton onRefresh={handleRefresh} />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`
                flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
                ${selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent shadow-lg shadow-cyan-500/25'
                  : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600'
                }
              `}
            >
              <span className="mr-1.5">{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Empty states */}
        {hasNoSearchResults && <EmptySearchState onClear={() => onSearchChange('')} />}
        {hasNoResults && <EmptySearchState onClear={() => onCategoryChange('all')} />}

        {/* Content */}
        {!hasNoResults && !hasNoSearchResults && (
          <>
            {/* Featured Agents */}
            {filteredAgents.filter(a => a.online).length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" /> Featured
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                  {filteredAgents.filter(a => a.online).map(agent => (
                    <FeaturedCard
                      key={agent.id}
                      agent={agent}
                      onClick={() => onSelect(agent)}
                      selected={selectedAgent?.id === agent.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All Agents */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 mb-3">
                {selectedCategory === 'all' ? 'All Agents' : CATEGORIES.find(c => c.id === selectedCategory)?.name}
              </h2>
              <div className="space-y-3">
                {filteredAgents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={() => onSelect(agent)}
                    selected={selectedAgent?.id === agent.id}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {/* Agent Detail Modal */}
        <AgentDetailModal
          agent={selectedAgent}
          onClose={() => onSelect(null)}
          onCall={onCall}
        />
      </div>
    </PullToRefresh>
  );
}
