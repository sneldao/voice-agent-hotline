'use client';

/**
 * Lightweight client-side event tracker.
 *
 * Events are buffered in memory and flushed to the server every 10 seconds
 * or when the buffer reaches 20 events — whichever comes first.
 *
 * Usage:
 *   import { track } from '@/lib/track';
 *   track('onboarding_completed', { steps: 5 });
 */

export type TrackEvent =
  | 'onboarding_step_viewed'
  | 'onboarding_skipped'
  | 'onboarding_completed'
  | 'use_case_selected'
  | 'page_visited_first_time';

interface EventPayload {
  event: TrackEvent;
  data?: Record<string, unknown>;
  timestamp: number;
  url: string;
}

const BUFFER_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;

const buffer: EventPayload[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flush();
  }, FLUSH_INTERVAL_MS);
  // Don't let the timer keep the process alive if it's the only thing left
  if (flushTimer && typeof flushTimer === 'object' && 'unref' in flushTimer) {
    (flushTimer as NodeJS.Timeout).unref?.();
  }
}

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    const resp = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      // Use keepalive so events aren't lost during page unload
      keepalive: true,
    });
    if (!resp.ok) {
      console.warn('[Track] Failed to flush events:', resp.status);
    }
  } catch (err) {
    // Silently fail — analytics should never block the user experience
    console.warn('[Track] Flush error:', err);
  }
}

// Flush remaining events on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flush();
  }, { passive: true });
}

/**
 * Track an event with optional metadata.
 *
 * Events are batched and sent to the server asynchronously.
 * This function is safe to call from any component — it never throws.
 */
export function track(event: TrackEvent, data?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  buffer.push({
    event,
    data,
    timestamp: Date.now(),
    url: window.location.pathname,
  });

  startFlushTimer();

  if (buffer.length >= BUFFER_SIZE) {
    flush();
  }
}
