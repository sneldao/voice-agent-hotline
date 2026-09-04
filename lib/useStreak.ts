'use client';

import { useState, useEffect, useCallback } from 'react';

const STREAK_KEY = 'claflin-streak';

interface StreakData {
  /** Current consecutive days with at least one call */
  currentStreak: number;
  /** Longest streak ever achieved */
  longestStreak: number;
  /** ISO date string of the last call day (YYYY-MM-DD) */
  lastCallDate: string | null;
  /** Total calls made all-time */
  totalCalls: number;
  /** Map of agentId → number of calls with that agent */
  agentCallCounts: Record<string, number>;
  /** Whether the user has called today */
  calledToday: boolean;
  /** Whether the streak is at risk (last call was yesterday, none today) */
  streakAtRisk: boolean;
}

interface UseStreakReturn extends StreakData {
  /** Record a completed call */
  recordCall: (agentId: string) => void;
  /** Get the call count for a specific agent */
  getAgentCalls: (agentId: string) => number;
  /** Reset streak data (for testing) */
  resetStreak: () => void;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function loadStreakData(): StreakData {
  if (typeof window === 'undefined') {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastCallDate: null,
      totalCalls: 0,
      agentCallCounts: {},
      calledToday: false,
      streakAtRisk: false,
    };
  }

  try {
    const stored = localStorage.getItem(STREAK_KEY);
    if (!stored) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastCallDate: null,
        totalCalls: 0,
        agentCallCounts: {},
        calledToday: false,
        streakAtRisk: false,
      };
    }

    const parsed = JSON.parse(stored);
    const today = getToday();
    const yesterday = getYesterday();
    const lastCall = parsed.lastCallDate || null;

    // Determine if streak is still active
    let currentStreak = parsed.currentStreak || 0;
    const calledToday = lastCall === today;
    const calledYesterday = lastCall === yesterday;

    // If last call was before yesterday, streak is broken
    if (!calledToday && !calledYesterday && lastCall) {
      currentStreak = 0;
    }

    const streakAtRisk = !calledToday && calledYesterday && currentStreak > 0;

    return {
      currentStreak,
      longestStreak: parsed.longestStreak || 0,
      lastCallDate: lastCall,
      totalCalls: parsed.totalCalls || 0,
      agentCallCounts: parsed.agentCallCounts || {},
      calledToday,
      streakAtRisk,
    };
  } catch {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastCallDate: null,
      totalCalls: 0,
      agentCallCounts: {},
      calledToday: false,
      streakAtRisk: false,
    };
  }
}

function saveStreakData(data: Omit<StreakData, 'calledToday' | 'streakAtRisk'>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export function useStreak(): UseStreakReturn {
  const [data, setData] = useState<StreakData>(loadStreakData);

  // Re-check on mount (handles day rollover while tab is open)
  useEffect(() => {
    setData(loadStreakData());
  }, []);

  const recordCall = useCallback((agentId: string) => {
    setData(prev => {
      const today = getToday();
      const yesterday = getYesterday();

      let newStreak = prev.currentStreak;

      if (prev.lastCallDate === today) {
        // Already called today — streak doesn't change
      } else if (prev.lastCallDate === yesterday) {
        // Called yesterday, calling today — streak continues
        newStreak = prev.currentStreak + 1;
      } else {
        // Gap of 2+ days or first call ever — start fresh
        newStreak = 1;
      }

      const newLongest = Math.max(prev.longestStreak, newStreak);
      const newAgentCounts = {
        ...prev.agentCallCounts,
        [agentId]: (prev.agentCallCounts[agentId] || 0) + 1,
      };

      const updated = {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastCallDate: today,
        totalCalls: prev.totalCalls + 1,
        agentCallCounts: newAgentCounts,
      };

      saveStreakData(updated);

      return {
        ...updated,
        calledToday: true,
        streakAtRisk: false,
      };
    });
  }, []);

  const getAgentCalls = useCallback((agentId: string) => {
    return data.agentCallCounts[agentId] || 0;
  }, [data.agentCallCounts]);

  const resetStreak = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STREAK_KEY);
    }
    setData({
      currentStreak: 0,
      longestStreak: 0,
      lastCallDate: null,
      totalCalls: 0,
      agentCallCounts: {},
      calledToday: false,
      streakAtRisk: false,
    });
  }, []);

  return {
    ...data,
    recordCall,
    getAgentCalls,
    resetStreak,
  };
}
