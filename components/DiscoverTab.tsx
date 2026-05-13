'use client';

import { useCallback, useState } from 'react';
import { Mic, Search, Star } from 'lucide-react';
import { AgentCardSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { PullToRefresh, RefreshButton, showError, showSuccess } from '@/components/ui';
import { AgentCard, FeaturedCard } from '@/app/page-components';
import type { Agent } from '@/lib/types';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'healthcare', name: 'Health', icon: '⚕️' },
  { id: 'research', name: 'Research', icon: '🔍' },
  { id: 'tech', name: 'Tech', icon: '💻' },
  { id: 'blockchain', name: 'Crypto', icon: '🪙' },
  { id: 'general', name: 'General', icon: '🤖' },
];

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { 0: { transcript: string } }[] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

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
  const [isListening, setIsListening] = useState(false);

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

  const handleVoiceSearch = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as typeof window & {
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      SpeechRecognition?: new () => BrowserSpeechRecognition;
    }).SpeechRecognition || (window as typeof window & {
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showError('Voice search is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) return;

      const lower = transcript.toLowerCase();
      const category = CATEGORIES.find((cat) => cat.id !== 'all' && lower.includes(cat.name.toLowerCase()));
      if (category) {
        onCategoryChange(category.id);
      }
      onSearchChange(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      showError('Could not start voice search');
    }
  }, [onCategoryChange, onSearchChange]);

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
        <div className="rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Tap any agent to start talking</p>
              <p className="text-xs text-gray-400 mt-0.5">No signup needed. Just tap and speak.</p>
            </div>
          </div>
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
              className="w-full pl-10 pr-12 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
            <button
              type="button"
              onClick={handleVoiceSearch}
              className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 transition-colors ${
                isListening ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
              aria-label="Search by voice"
              title="Search by voice"
            >
              <Mic className="w-4 h-4" />
            </button>
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
          <div className="mt-2 flex flex-wrap gap-2">
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
                Show me {cat.name.toLowerCase()}
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
