'use client';

import { useMemo } from 'react';
import type { Agent } from './types';
import type { UseCase } from './useOnboarding';

const PREFERENCES_KEY = 'voisss-preferences';

/**
 * Maps use-case selections to agent categories and IDs that should be prioritized.
 */
const USE_CASE_PRIORITY: Record<UseCase, { categories: string[]; agentIds: string[] }> = {
  coding: {
    categories: ['tech'],
    agentIds: ['code_reviewer', 'general_helper'],
  },
  health: {
    categories: ['healthcare'],
    agentIds: ['medical_advisor', 'general_helper'],
  },
  research: {
    categories: ['research'],
    agentIds: ['web_researcher', 'general_helper'],
  },
  crypto: {
    categories: ['blockchain'],
    agentIds: ['solana_sage', 'code_reviewer'],
  },
  travel: {
    categories: ['general'],
    agentIds: ['tour_master', 'web_researcher'],
  },
  general: {
    categories: ['general'],
    agentIds: ['general_helper', 'web_researcher'],
  },
};

/**
 * Returns the stored use-case preference from localStorage.
 */
export function getStoredUseCase(): UseCase | null {
  if (typeof window === 'undefined') return null;
  try {
    const prefs = localStorage.getItem(PREFERENCES_KEY);
    if (!prefs) return null;
    const parsed = JSON.parse(prefs);
    return parsed.useCase || null;
  } catch {
    return null;
  }
}

/**
 * Returns the preferred concierge agent ID based on use-case.
 * Falls back to 'general_helper'.
 */
export function getPreferredConcierge(useCase: UseCase | null): string {
  if (!useCase) return 'general_helper';
  return USE_CASE_PRIORITY[useCase]?.agentIds[0] || 'general_helper';
}

/**
 * Sorts agents so that those matching the user's use-case preference appear first.
 * Agents are scored: exact ID match = 3, category match = 2, online bonus = 1.
 * Original order is preserved as a tiebreaker.
 */
export function personalizeAgents(agents: Agent[], useCase: UseCase | null): Agent[] {
  if (!useCase || agents.length === 0) return agents;

  const priority = USE_CASE_PRIORITY[useCase];
  if (!priority) return agents;

  const scored = agents.map((agent, originalIndex) => {
    let score = 0;

    // Exact agent ID match — highest priority
    if (priority.agentIds.includes(agent.id)) {
      score += 3 + (priority.agentIds.length - priority.agentIds.indexOf(agent.id));
    }

    // Category match
    if (agent.category && priority.categories.includes(agent.category.toLowerCase())) {
      score += 2;
    }

    // Online bonus
    if (agent.online) {
      score += 1;
    }

    return { agent, score, originalIndex };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.originalIndex - b.originalIndex;
  });

  return scored.map(s => s.agent);
}

/**
 * React hook that returns personalized agents based on stored use-case.
 */
export function usePersonalizedAgents(agents: Agent[], useCase: UseCase | null): Agent[] {
  return useMemo(() => personalizeAgents(agents, useCase), [agents, useCase]);
}
