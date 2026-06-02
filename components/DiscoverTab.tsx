'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Search, PhoneCall, ChevronDown, Loader2, Radio, Flame, X, Volume2 } from 'lucide-react';
import { AgentCardSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { PullToRefresh, RefreshButton, showSuccess, showInfo } from '@/components/ui';
import { AgentCard, getPersona } from '@/app/page-components';
import { playDialTone, playPop } from '@/lib/sounds';
import { useStreak } from '@/lib/useStreak';
import type { Agent } from '@/lib/types';
import type { UseCase } from '@/lib/useOnboarding';
import { USE_CASES } from '@/lib/useOnboarding';

// ─── Compact line data for the switchboard ─────────────────────────────────
const LINES: { id: string; emoji: string; label: string; desk: string }[] = [
  { id: 'general_helper', emoji: '🤖', label: 'General Helper', desk: 'Anything' },
  { id: 'medical_advisor', emoji: '⚕️', label: 'Dr. Maya', desk: 'Health' },
  { id: 'web_researcher', emoji: '🔍', label: 'Web Researcher', desk: 'Research' },
  { id: 'code_reviewer', emoji: '👨‍💻', label: 'Code Reviewer', desk: 'Tech' },
  { id: 'solana_sage', emoji: '🔮', label: 'Solana Sage', desk: 'Crypto' },
  { id: 'tour_master', emoji: '🌍', label: 'Tour Master', desk: 'Travel' },
];

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
  /** Whether to show the inline use-case selection banner */
  showUseCaseBanner?: boolean;
  /** Currently selected use-case for personalization */
  selectedUseCase?: UseCase | null;
  /** Callback when a use-case chip is tapped */
  onSetUseCase?: (useCase: UseCase) => void;
  /** Callback when the banner is dismissed */
  onDismissUseCaseBanner?: () => void;
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
  showUseCaseBanner = false,
  selectedUseCase = null,
  onSetUseCase,
  onDismissUseCaseBanner,
}: DiscoverTabProps) {
  const [showBoard, setShowBoard] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const streak = useStreak();

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

  const handleLineClick = useCallback((lineId: string) => {
    const agent = agents.find(a => a.id === lineId);
    if (agent) {
      try { navigator.vibrate?.(30); } catch { /* unsupported */ }
      onSelect(agent);
    }
  }, [agents, onSelect]);

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

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasNoResults = agents.length === 0 && !hasSearchQuery && !isLoading;
  const hasNoSearchResults = agents.length === 0 && hasSearchQuery && !isLoading;

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
      <div className="py-6">
        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 1 — THE HOOK
            Full-viewport hero. One action: pick up the line.
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center px-4 text-center lg:min-h-[35vh]">
          {/* Ring animation circles */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="absolute h-56 w-56 animate-ping rounded-full border border-red-500/10 [animation-duration:3s]" />
            <div className="absolute h-72 w-72 animate-ping rounded-full border border-amber-200/8 [animation-duration:4s] [animation-delay:0.5s]" />
            <div className="absolute h-96 w-96 animate-ping rounded-full border border-amber-100/5 [animation-duration:5s] [animation-delay:1s]" />
          </div>

          {/* The Dial */}
          <button
            id="coachmark-dial"
            onClick={handleDialClick}
            disabled={!concierge || isConnecting}
            className="rotary-dial relative z-10 flex h-40 w-40 animate-scaleIn items-center justify-center rounded-full transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 sm:h-48 sm:w-48"
            aria-label="Pick up the line — start a voice call"
          >
            <span className="absolute inset-5 rounded-full border border-amber-100/20" />
            <span className="absolute inset-10 rounded-full border border-black/40 bg-black/20" />
            {isConnecting ? (
              <Loader2 className="relative z-10 h-12 w-12 animate-spin text-amber-50" />
            ) : (
              <PhoneCall className="relative z-10 h-12 w-12 text-amber-50 drop-shadow-lg" />
            )}
          </button>

          {/* Copy */}
          <h1 className="relative z-10 mt-8 animate-fadeIn text-3xl font-bold text-amber-50 sm:text-4xl [animation-delay:200ms]" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.5)' }}>
            {isConnecting ? 'Connecting...' : 'Pick up the line.'}
          </h1>
          <p className="relative z-10 mt-3 max-w-xs animate-fadeIn text-base text-amber-100/60 [animation-delay:400ms]">
            {isConnecting
              ? 'Patching you through to the AI concierge'
              : 'Tap the dial to talk. No typing, no forms — just speak.'}
          </p>
          <p className="relative z-10 mt-2 animate-fadeIn text-sm text-amber-100/40 [animation-delay:600ms]">
            {agents.length} specialist{agents.length !== 1 ? 's' : ''} standing by
          </p>

          {/* First call free badge */}
          <div
            id="coachmark-free-badge"
            className="relative z-10 mt-4 animate-fadeIn [animation-delay:800ms] inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5"
          >
            <span className="text-xs font-semibold text-emerald-300">⚡ First call free — no wallet needed</span>
          </div>

          {/* Streak indicator */}
          {streak.currentStreak > 0 && (
            <div className="relative z-10 mt-2 animate-fadeIn [animation-delay:900ms] inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold text-orange-300">
                {streak.streakAtRisk
                  ? `${streak.currentStreak}-day streak at risk — call today!`
                  : `${streak.currentStreak}-day streak 🔥`}
              </span>
            </div>
          )}

          {/* Scroll hint */}
          <button
            onClick={() => document.getElementById('switchboard')?.scrollIntoView({ behavior: 'smooth' })}
            className="relative z-10 mt-8 flex flex-col items-center gap-1 text-amber-100/40 transition-colors hover:text-amber-100/70"
            aria-label="Scroll to the switchboard"
          >
            <span className="text-xs font-medium uppercase tracking-widest">Browse the board</span>
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </button>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 1.5 — USE-CASE BANNER (inline onboarding)
            Shown on first visit — no modal, no blocking.
        ═══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showUseCaseBanner && (
            <>
              {/* Backdrop dim + blur — separates onboarding from the page */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
                onClick={() => {
                  playPop();
                  onDismissUseCaseBanner?.();
                }}
              />
              <motion.section
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="fixed inset-x-0 top-[20%] z-50 mx-auto max-w-lg px-4"
              >
              <div className="relative rounded-2xl border border-amber-100/15 bg-gradient-to-br from-[#17100d] to-[#1f1611] p-5 shadow-lg shadow-black/40">
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => {
                    playPop();
                    onDismissUseCaseBanner?.();
                  }}
                  className="absolute right-3 top-3 rounded-full p-1.5 text-amber-100/30 transition-colors hover:bg-amber-100/10 hover:text-amber-100/60"
                  aria-label="Dismiss recommendations"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-amber-500/20 text-lg">
                    🎯
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-50">What brings you here?</h3>
                    <p className="text-xs text-amber-100/45">
                      Pick a focus and I'll match you with the best voices. No sign-up needed.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {USE_CASES.map((uc, i) => {
                    const isSelected = selectedUseCase === uc.id;
                    return (
                      <motion.button
                        key={uc.id}
                        type="button"
                        onClick={() => {
                          playPop();
                          onSetUseCase?.(uc.id);
                        }}
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          borderColor: isSelected ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 237, 213, 0.1)',
                          backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 237, 213, 0.03)',
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 260,
                          damping: 22,
                          delay: 0.06 * i,
                        }}
                        whileHover={{
                          scale: 1.03,
                          borderColor: 'rgba(255, 237, 213, 0.25)',
                          transition: { type: 'spring', stiffness: 400, damping: 15 },
                        }}
                        whileTap={{ scale: 0.95 }}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left shadow-sm ${
                          isSelected
                            ? 'shadow-red-500/10'
                            : 'shadow-black/10 hover:shadow-amber-500/5'
                        }`}
                      >
                        <motion.span
                          className="text-lg"
                          animate={isSelected ? { scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] } : {}}
                          transition={{ duration: 0.4 }}
                        >
                          {uc.emoji}
                        </motion.span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-amber-50 truncate">{uc.label}</p>
                          <p className="text-[10px] text-amber-100/40 truncate">{uc.description}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <p className="mt-3 text-center text-[11px] text-amber-100/30">
                  Your picks are saved locally. Change them anytime.
                </p>
              </div>
            </motion.section>
          </>
        )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 2 — THE BOARD
            Compact switchboard lines. One tap per agent.
        ═══════════════════════════════════════════════════════════════════ */}
        <section
          id="switchboard"
          className={`mx-auto mt-12 max-w-2xl transition-all duration-500 ${
            showBoard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
          }`}
          aria-hidden={!showBoard}
        >
          <div id="coachmark-switchboard" className="mb-6 text-center">
            <h2 className="text-xl font-bold text-amber-50">The Switchboard</h2>
            <p className="mt-1 text-sm text-amber-100/50">Tap a line to connect</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {LINES.map((line) => {
              const agent = agents.find(a => a.id === line.id);
              const isOnline = agent?.online !== false;
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => handleLineClick(line.id)}
                  disabled={!agent}
                  className="group operator-panel relative flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-red-300/40 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {/* Line lamp */}
                  <div className={`line-lamp absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${
                    isOnline ? 'bg-emerald-300 text-emerald-300' : 'bg-red-400/60 text-red-400/60'
                  }`} />

                  <span className="text-3xl">{line.emoji}</span>
                  <span className="text-sm font-bold text-amber-50">{line.label}</span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-100/15 bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100/60">
                    <Radio className="h-2.5 w-2.5" />
                    {line.desk}
                  </span>

                  {/* Hover call indicator */}
                  <div className="absolute inset-x-4 bottom-3 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-red-500/20 px-3 py-1 text-[10px] font-bold text-red-100">
                      <PhoneCall className="mr-1 inline h-3 w-3" />
                      Connect
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Transition to full browse */}
          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setShowBoard(true);
                // Scroll to layer 3
                document.getElementById('full-directory')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-amber-100/15 bg-black/20 px-5 py-2.5 text-sm font-semibold text-amber-100/60 transition-colors hover:border-amber-100/30 hover:text-amber-50"
            >
              <Search className="h-4 w-4" />
              Browse full directory
            </button>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            LAYER 3 — THE DIRECTORY
            Full search, categories, detailed agent cards.
            Always rendered but visually below the fold.
        ═══════════════════════════════════════════════════════════════════ */}
        <section id="full-directory" className="mx-auto mt-16 max-w-5xl">
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
                  onFocus={() => setShowBoard(true)}
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
        </section>
      </div>
    </PullToRefresh>
  );
}
