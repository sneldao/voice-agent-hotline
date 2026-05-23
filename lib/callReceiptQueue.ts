'use client';

/**
 * Queue for call receipts that failed to POST to /api/calls.
 *
 * Local call history is the source of truth (already persisted in localStorage),
 * but we also want the server to learn about every completed call. If the
 * server is unreachable when the call ends, we stash the payload here and
 * replay it on the next app load.
 */

const STORAGE_KEY = 'pending_call_receipts';
const MAX_QUEUE_SIZE = 50;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface PendingReceipt {
  payload: Record<string, unknown>;
  enqueuedAt: number;
  attempts: number;
}

function readQueue(): PendingReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingReceipt[];
    if (!Array.isArray(parsed)) return [];
    // Drop receipts older than MAX_AGE_MS
    const now = Date.now();
    return parsed.filter(r => r && now - r.enqueuedAt < MAX_AGE_MS);
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingReceipt[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Cap queue size to avoid unbounded growth
    const capped = queue.slice(-MAX_QUEUE_SIZE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // localStorage full or disabled — drop silently
  }
}

/**
 * Add a receipt payload to the replay queue.
 */
export function enqueueReceipt(payload: Record<string, unknown>): void {
  const queue = readQueue();
  queue.push({ payload, enqueuedAt: Date.now(), attempts: 0 });
  writeQueue(queue);
}

/**
 * POST a single receipt with a short timeout. Returns true on 2xx.
 */
async function postReceipt(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Try to POST `payload` once. On failure, persist it for later replay.
 * Use this in place of fire-and-forget `fetch().catch(() => {})`.
 */
export async function postReceiptOrQueue(payload: Record<string, unknown>): Promise<void> {
  const ok = await postReceipt(payload);
  if (!ok) enqueueReceipt(payload);
}

/**
 * Replay every pending receipt. Call once on app start.
 * Receipts that still fail (e.g. server still down) stay in the queue with
 * an incremented attempt count.
 */
export async function replayPendingReceipts(): Promise<{ sent: number; remaining: number }> {
  const queue = readQueue();
  if (queue.length === 0) return { sent: 0, remaining: 0 };

  const remaining: PendingReceipt[] = [];
  let sent = 0;

  for (const entry of queue) {
    const ok = await postReceipt(entry.payload);
    if (ok) {
      sent++;
    } else {
      remaining.push({ ...entry, attempts: entry.attempts + 1 });
    }
  }

  writeQueue(remaining);
  return { sent, remaining: remaining.length };
}
