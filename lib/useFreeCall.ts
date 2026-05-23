'use client';

import { useState, useEffect, useCallback } from 'react';

const FREE_CALL_KEY = 'voisss-free-call';

interface FreeCallState {
  /** Whether the user has a free call available */
  hasFreeCall: boolean;
  /** Whether the user has already used their free call */
  hasUsedFreeCall: boolean;
  /** Whether the current call should be treated as free (no wallet required) */
  isFreeCallActive: boolean;
}

interface UseFreeCallReturn extends FreeCallState {
  /** Start consuming the free call */
  startFreeCall: () => void;
  /** Mark the free call as completed */
  completeFreeCall: () => void;
  /** Reset free call state (for testing) */
  resetFreeCall: () => void;
}

/**
 * Manages the "first call free" experience.
 * First-time users get one free call without needing a wallet.
 * State is persisted in localStorage.
 */
export function useFreeCall(): UseFreeCallReturn {
  const [state, setState] = useState<FreeCallState>({
    hasFreeCall: false,
    hasUsedFreeCall: false,
    isFreeCallActive: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(FREE_CALL_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setState({
        hasFreeCall: !parsed.used,
        hasUsedFreeCall: !!parsed.used,
        isFreeCallActive: false,
      });
    } else {
      // First time — they get a free call
      setState({
        hasFreeCall: true,
        hasUsedFreeCall: false,
        isFreeCallActive: false,
      });
    }
  }, []);

  const startFreeCall = useCallback(() => {
    setState(prev => ({
      ...prev,
      isFreeCallActive: true,
    }));
  }, []);

  const completeFreeCall = useCallback(() => {
    setState({
      hasFreeCall: false,
      hasUsedFreeCall: true,
      isFreeCallActive: false,
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(FREE_CALL_KEY, JSON.stringify({ used: true, usedAt: Date.now() }));
    }
  }, []);

  const resetFreeCall = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FREE_CALL_KEY);
    }
    setState({
      hasFreeCall: true,
      hasUsedFreeCall: false,
      isFreeCallActive: false,
    });
  }, []);

  return {
    ...state,
    startFreeCall,
    completeFreeCall,
    resetFreeCall,
  };
}

/**
 * Check if user has a free call available (non-hook version for use outside components).
 */
export function checkFreeCallAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(FREE_CALL_KEY);
  if (!stored) return true; // Never used = free call available
  const parsed = JSON.parse(stored);
  return !parsed.used;
}
