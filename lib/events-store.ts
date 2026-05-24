/**
 * Redis-backed event store for onboarding analytics.
 *
 * Replaces the previous in-memory array so events survive server restarts.
 * Uses Upstash Redis via the existing lazy-init singleton from lib/redis.ts.
 *
 * Data model:
 *   - `events:list`  (List)  — LPUSH new events, LRANGE to query, LTRIM to cap
 *   - `events:summary` (Hash) — HINCRBY per event type for fast counts
 *
 * Max stored events: 10,000 (same as the previous in-memory cap).
 */

import { getRedis } from '@/lib/redis';

const EVENTS_LIST_KEY = 'events:list';
const EVENTS_SUMMARY_KEY = 'events:summary';
const MAX_STORED_EVENTS = 10_000;

export interface StoredEvent {
  event: string;
  data?: Record<string, unknown>;
  timestamp: number;
  url: string;
  receivedAt: string;
}

/**
 * Store a batch of client-side events in Redis.
 */
export async function storeEvents(
  batch: Array<{ event: string; data?: Record<string, unknown>; timestamp: number; url: string }>
): Promise<void> {
  const redis = getRedis();
  const receivedAt = new Date().toISOString();
  const pipeline = redis.pipeline();

  for (const ev of batch) {
    const serialized = JSON.stringify({ ...ev, receivedAt });
    pipeline.lpush(EVENTS_LIST_KEY, serialized);
    pipeline.hincrby(EVENTS_SUMMARY_KEY, ev.event, 1);
  }

  // Cap the list to prevent unbounded growth
  pipeline.ltrim(EVENTS_LIST_KEY, 0, MAX_STORED_EVENTS - 1);

  await pipeline.exec();
}

/**
 * Retrieve stored events with optional filtering and limiting.
 *
 * Returns the same shape as the previous in-memory GET endpoint so the
 * analytics dashboard remains fully compatible.
 */
export async function queryEvents(options: {
  limit?: number;
  eventFilter?: string | null;
}): Promise<{
  total: number;
  filter: string | null;
  summary: Record<string, number>;
  events: StoredEvent[];
  timestamp: string;
}> {
  const redis = getRedis();
  const { limit = 100, eventFilter = null } = options;
  const effectiveLimit = Math.min(Math.max(limit, 1), 1000);

  // Get total count via LLEN (O(1))
  const total = await redis.llen(EVENTS_LIST_KEY);

  // Fetch all stored event strings (newest-first from LPUSH order)
  const allRaw = await redis.lrange(EVENTS_LIST_KEY, 0, MAX_STORED_EVENTS - 1);

  // Parse into structured objects
  const allEvents: StoredEvent[] = [];
  for (const raw of allRaw) {
    try {
      allEvents.push(JSON.parse(raw) as StoredEvent);
    } catch {
      // Skip malformed entries
    }
  }

  // Apply optional event-type filter
  const filtered = eventFilter
    ? allEvents.filter((e) => e.event === eventFilter)
    : allEvents;

  // Return the most recent `effectiveLimit` events
  const recent = filtered.slice(0, effectiveLimit);

  // Build summary from the Redis hash
  const summaryRaw = await redis.hgetall(EVENTS_SUMMARY_KEY);
  const summary: Record<string, number> = {};
  if (summaryRaw) {
    for (const [key, value] of Object.entries(summaryRaw)) {
      summary[key] = Number(value);
    }
  }

  return {
    total,
    filter: eventFilter || null,
    summary,
    events: recent,
    timestamp: new Date().toISOString(),
  };
}
