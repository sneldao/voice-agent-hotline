'use client';

import { useEffect, useState } from 'react';

/**
 * Shared singleton polling for /api/activity/live.
 *
 * LiveActivity and DiscoverTab both need the same data. Previously each ran
 * its own 30s interval — two requests per 30s per tab. This module guarantees
 * at most ONE in-flight poll and ONE interval no matter how many components
 * subscribe, and pauses entirely while the tab is hidden (no wasted requests
 * in background tabs, instant refresh on return).
 */

export interface AgentActivity {
  id: string;
  /** Calls started in the last hour. */
  calls: number;
  /** Broker currently has an active call. */
  active: boolean;
}

export interface LiveActivityData {
  active: number;
  lastHour: number;
  activeAgentIds: string[];
  /** Per-agent call counts for the live ticker wire (optional for back-compat). */
  agentActivity?: AgentActivity[];
}

const POLL_INTERVAL_MS = 30_000;

let data: LiveActivityData | null = null;
const subscribers = new Set<(d: LiveActivityData | null) => void>();
let interval: ReturnType<typeof setInterval> | null = null;
let inflight = false;
let dirtySinceHidden = false;

function notify() {
  for (const fn of subscribers) fn(data);
}

async function poll() {
  if (inflight) return;
  inflight = true;
  try {
    const res = await fetch('/api/activity/live', { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as LiveActivityData;
      if (Array.isArray(json.activeAgentIds)) {
        data = json;
        notify();
      }
    }
  } catch {
    // Fail soft — subscribers just keep the last good data
  } finally {
    inflight = false;
  }
}

function startPolling() {
  if (typeof window === 'undefined') return;
  if (!interval) {
    interval = setInterval(() => {
      // Skip polls while hidden; remember to refresh on visible
      if (document.visibilityState === 'hidden') {
        dirtySinceHidden = true;
        return;
      }
      void poll();
    }, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibility);
  }
  void poll();
}

function stopPolling() {
  if (subscribers.size > 0) return;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility);
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible' && dirtySinceHidden) {
    dirtySinceHidden = false;
    void poll();
  }
}

export function useLiveActivity(): LiveActivityData | null {
  const [snapshot, setSnapshot] = useState(data);

  useEffect(() => {
    subscribers.add(setSnapshot);
    startPolling();
    // Immediately sync any data fetched before this component mounted
    if (data) setSnapshot(data);
    return () => {
      subscribers.delete(setSnapshot);
      stopPolling();
    };
  }, []);

  return snapshot;
}


