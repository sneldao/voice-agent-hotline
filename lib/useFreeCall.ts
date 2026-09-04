'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from './api';

const FREE_CALL_KEY = 'claflin-free-call';
export const TRIAL_CALL_CAP_SECONDS = 120;

interface FreeCallState {
  /** Whether the user has a free call available (server-verified) */
  hasFreeCall: boolean;
  /** Whether the user has already used their free call */
  hasUsedFreeCall: boolean;
  /** Whether the current call should be treated as free (no wallet required) */
  isFreeCallActive: boolean;
  /** Whether the server check has completed */
  isLoading: boolean;
}

interface UseFreeCallReturn extends FreeCallState {
  /** Start consuming the free call */
  startFreeCall: () => void;
  /** Mark the free call as completed and claim it server-side */
  completeFreeCall: (agentId: string) => void;
  /** Reset free call state (for testing) */
  resetFreeCall: () => void;
}

/**
 * Manages the "trial call" experience.
 * First-time users get one trial call without needing a wallet.
 *
 * Honesty contract:
 * - The agent is NOT paid for trial calls.
 * - The platform absorbs the ElevenLabs cost as marketing.
 * - Trial calls are capped at 2 minutes.
 * - One trial per IP fingerprint (server-side, 30-day TTL).
 *
 * State is checked server-side via /api/free-call and cached in localStorage
 * for the UI to render synchronously before the server check completes.
 */
export function useFreeCall(): UseFreeCallReturn {
  const [state, setState] = useState<FreeCallState>({
    hasFreeCall: false,
    hasUsedFreeCall: false,
    isFreeCallActive: false,
    isLoading: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Optimistic read from localStorage for instant render
    const stored = localStorage.getItem(FREE_CALL_KEY);
    const localUsed = stored ? JSON.parse(stored).used : false;

    if (localUsed) {
      setState({
        hasFreeCall: false,
        hasUsedFreeCall: true,
        isFreeCallActive: false,
        isLoading: false,
      });
      return;
    }

    // Server-side check (authoritative)
    fetch(apiUrl('/api/free-call'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.available) {
          // Server says already used — update localStorage
          localStorage.setItem(FREE_CALL_KEY, JSON.stringify({
            used: true,
            usedAt: data.usedAt || Date.now(),
          }));
          setState({
            hasFreeCall: false,
            hasUsedFreeCall: true,
            isFreeCallActive: false,
            isLoading: false,
          });
        } else {
          setState({
            hasFreeCall: true,
            hasUsedFreeCall: false,
            isFreeCallActive: false,
            isLoading: false,
          });
        }
      })
      .catch(() => {
        // If server check fails, fall back to localStorage state
        setState({
          hasFreeCall: !localUsed,
          hasUsedFreeCall: localUsed,
          isFreeCallActive: false,
          isLoading: false,
        });
      });
  }, []);

  const startFreeCall = useCallback(() => {
    setState(prev => ({
      ...prev,
      isFreeCallActive: true,
    }));
  }, []);

  const completeFreeCall = useCallback((agentId: string) => {
    setState({
      hasFreeCall: false,
      hasUsedFreeCall: true,
      isFreeCallActive: false,
      isLoading: false,
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(FREE_CALL_KEY, JSON.stringify({
        used: true,
        usedAt: Date.now(),
      }));
    }
    // Claim server-side (authoritative — prevents clearing localStorage to retry)
    fetch(apiUrl('/api/free-call'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim', agentId }),
    }).catch(() => {
      // Non-fatal — localStorage + server check will catch it next time
    });
  }, []);

  const resetFreeCall = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FREE_CALL_KEY);
    }
    setState({
      hasFreeCall: true,
      hasUsedFreeCall: false,
      isFreeCallActive: false,
      isLoading: false,
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
 * Note: this only checks localStorage. For authoritative check, use the hook.
 */
export function checkFreeCallAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(FREE_CALL_KEY);
  if (!stored) return true;
  const parsed = JSON.parse(stored);
  return !parsed.used;
}
