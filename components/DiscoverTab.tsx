'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Search, PhoneCall, Loader2 } from 'lucide-react';
import { showInfo, PullToRefresh, showSuccess } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ConnectionError, ReconnectingBanner } from '@/components/ConnectionError';
import type { ApiErrorKind } from '@/lib/api-client';
import { DirectoryRow } from '@/components/DirectoryRow';
import { LiveActivity } from '@/components/LiveActivity';
import { getPersona } from '@/lib/agent-personas';
import { playDialTone } from '@/lib/sounds';
import { useLiveActivity } from '@/lib/useLiveActivity';
import type { Agent } from '@/lib/types';

const CATEGORIES: Array<{ id: string; name: string; line: string; icon: string }> = [
  { id: 'all', name: 'All desks', line: 'broker desk', icon: '◉' },
  { id: 'conservative', name: 'Conservative', line: 'capital preservation', icon: '☎' },
  { id: 'research', name: 'Research', line: 'fundamentals, filings', icon: '⌬' },
  { id: 'momentum', name: 'Momentum', line: 'growth, themes, catalysts', icon: '⌖' },
  { id: 'macro', name: 'Macro', line: 'rates, markets, news', icon: '◐' },
  { id: 'risk', name: 'Risk', line: 'position sizing, health checks', icon: '✚' },
];

interface DiscoverTabProps {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  /** Structured failure mode so the error UI can adapt (offline vs snag). */
  errorKind?: ApiErrorKind | null;
  /** True while a background retry/revalidation is in flight after an error. */
  isRetrying?: boolean;
  onSelect: (a: Agent) => void;
  onVoiceCall: (a: Agent) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  onRefresh: () => Promise<unknown> | unknown;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Broker ID to use for the main dial button. Defaults to 'general_helper' (Hetty). */
  preferredConciergeId?: string;
}

export function DiscoverTab({
  agents,
  isLoading,
  error,
  errorKind = null,
  isRetrying = false,
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
  const activity = useLiveActivity();
  const liveCallAgentIds = useMemo(
    () => new Set(activity?.activeAgentIds ?? []),
    [activity]
  );

  // Live activity polling is shared (see lib/useLiveActivity.ts)

  const handleRefresh = async () => {
    try {
      const result = await onRefresh();
      // SWR's mutate() resolves to undefined when the fetcher threw — the
      // banner/error state will show it, so don't claim a success that
      // didn't happen.
      if (result !== undefined) showSuccess('Broker desk refreshed');
    } catch { /* error state handles it */ }
  };

  const concierge = agents.find(a => a.id === preferredConciergeId) || agents.find(a => a.id === 'general_helper') || agents[0];

  const handleDialClick = () => {
    if (!concierge || isConnecting) return;
    playDialTone();
    try { navigator.vibrate?.(50); } catch { /* unsupported */ }
    setIsConnecting(true);
    onVoiceCall(concierge);
    setTimeout(() => setIsConnecting(false), 2000);
  };

  /** Voice preview — pings a chip with the persona's voice name */
  const handleVoicePreview = (agent: Agent) => {
    const persona = getPersona(agent);
    showInfo(`${persona.voiceId} voice — ${persona.tone.toLowerCase()}, ${persona.desk.toLowerCase()}`);
    try { navigator.vibrate?.(15); } catch { /* unsupported */ }
  };

  const openCount = agents.filter(a => a.online).length;

  if (isLoading) {
    return (
      <div className="py-4">
        <DirectoryHeader
          openCount={0}
          totalCount={0}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
          agents={[]}
        />
        <div className="mt-3 space-y-px">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <DirectoryRowSkeleton key={i} />
          ))}
        </div>
        <SlowLoadHint />
      </div>
    );
  }

  if (error && agents.length === 0) {
    // Cold-start failure: nothing cached to fall back on, so make the
    // error state itself a good experience (auto-retry on a countdown).
    return (
      <div className="py-4">
        <ConnectionError
          message={error}
          kind={errorKind}
          onRetry={handleRefresh}
          autoRetrySeconds={5}
        />
      </div>
    );
  }

  if (agents.length === 0 && searchQuery.trim().length === 0) {
    return (
      <div className="py-4">
        <DirectoryHeader
          openCount={0}
          totalCount={0}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
          agents={[]}
        />
        <div className="mt-3">
          <EmptyState
            type="agents"
            title="The desk is quiet"
            description="No brokers are on the line right now. Check back soon."
          />
        </div>
      </div>
    );
  }

  const noSearchResults = agents.length === 0 && searchQuery.trim().length > 0;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="py-4">
        <DirectoryHeader
          openCount={openCount}
          totalCount={agents.length}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
          agents={agents}
        />

        {error && (
          <ReconnectingBanner
            message={error}
            isRetrying={isRetrying}
            onRetry={handleRefresh}
          />
        )}

        {noSearchResults ? (
          <div className="mt-3 rounded-xl border border-amber-100/10 bg-black/15 p-6 text-center">
            <p className="font-display text-base font-semibold text-amber-50">No brokers match that filter.</p>
            <p className="mt-1 text-sm text-amber-100/55">Try a different search or clear the filter.</p>
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="mt-4 rounded-lg border border-amber-100/20 bg-amber-100/10 px-3 py-1.5 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-100/15"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <ul className="directory-list mt-3" role="list">
            {agents.map((agent, idx) => (
              <DirectoryRow
                key={agent.id}
                agent={agent}
                onSelect={onSelect}
                onVoicePreview={handleVoicePreview}
                revealDelay={Math.min(idx, 8) * 70}
                isLiveCall={liveCallAgentIds.has(agent.id)}
              />
            ))}
          </ul>
        )}

        {hasMore && (
          <button
            onClick={onLoadMore}
            className="mt-3 w-full rounded-lg border border-amber-100/15 bg-black/20 py-2.5 text-sm font-bold text-amber-100 transition-colors hover:bg-red-500/10"
          >
            Load more brokers
          </button>
        )}
      </div>

      {/* FAB dial — direct line to concierge */}
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

function DirectoryHeader({
  openCount,
  totalCount,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  agents,
}: {
  openCount: number;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  agents: Agent[];
}) {
  return (
    <section className="directory-header atmospheric-grain">
      <div className="atmospheric-hero pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-amber-100/55">
          Claflin · Broker desk
        </p>
        <h2 className="mt-2 font-display text-[2.25rem] font-bold leading-[0.95] text-amber-50">
          Broker desk
        </h2>
        <p className="mt-1.5 text-sm text-amber-100/65 max-w-md">
          Pick up the line. Ask about tokenized stocks. The first broker is Hetty.
        </p>
        <div className="hero-glow-line mt-4" />
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100/55">
        <span>
          <span className="text-amber-100/85">{totalCount}</span> lines ·{' '}
          <span className="text-amber-100/85">{openCount}</span> open
        </span>
        <LiveActivity />
      </div>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-100/45" />
          <input
            type="text"
            placeholder="Search by name, line, or desk"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="directory-search w-full rounded-lg border border-amber-100/15 bg-black/35 py-2.5 pl-9 pr-10 text-sm text-amber-50 placeholder:text-amber-100/40 focus:border-amber-200/40 focus:outline-none focus:ring-1 focus:ring-amber-200/30"
            aria-label="Search brokers"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100/55 transition-colors hover:bg-amber-100/10"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 -mx-1 flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`
              directory-line-tag
              ${selectedCategory === cat.id
                ? 'directory-line-tag--active'
                : 'directory-line-tag--idle'}
            `}
            aria-pressed={selectedCategory === cat.id}
          >
            <span className="text-[12px] leading-none">{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DirectoryRowSkeleton(): ReactNode {
  return (
    <li className="directory-row directory-row--skeleton">
      <span className="directory-row__code skeleton-pulse" />
      <span className="directory-row__avatar skeleton-pulse" />
      <span className="directory-row__body">
        <span className="h-3.5 w-32 rounded bg-amber-100/10 skeleton-pulse" />
        <span className="mt-1.5 h-2.5 w-48 max-w-full rounded bg-amber-100/5 skeleton-pulse" />
      </span>
      <span className="directory-row__price skeleton-pulse" />
    </li>
  );
}

/** After a few seconds of skeletons, reassure the user we're still on it. */
function SlowLoadHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <p className="mt-4 animate-pulse text-center font-mono text-[11px] uppercase tracking-[0.18em] text-amber-100/45">
      Warming up the broker desk…
    </p>
  );
}
