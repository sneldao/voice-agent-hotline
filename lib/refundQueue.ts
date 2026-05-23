'use client';

/**
 * Tracks Superfluid streams that we believed were stopped but whose
 * `deleteFlow` transaction never confirmed. The user is potentially
 * still being billed on-chain, so we surface a "we owe you a refund /
 * action required" banner and let them retry the stop.
 */

const STORAGE_KEY = 'pending_stream_refunds';

export interface PendingRefund {
  /** Local call id this refund is associated with (for cross-referencing call history). */
  callId: string;
  /** Recipient (agent) address that the orphaned stream is paying. */
  recipient: string;
  /** Optional platform recipient (when 80/20 split is active). */
  platformAddress?: string;
  /** Cost we already charged the user in our UI (USD). */
  estimatedCost: number;
  /** Reason / last error for diagnostics. */
  reason: string;
  /** When this entry was created. */
  createdAt: number;
}

function read(): PendingRefund[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingRefund[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(queue: PendingRefund[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    // Notify listeners (other tabs / components) that the queue changed.
    window.dispatchEvent(new CustomEvent('refund-queue-updated'));
  } catch {
    /* ignore */
  }
}

export function enqueueRefund(entry: Omit<PendingRefund, 'createdAt'>): void {
  const queue = read();
  // Dedupe by callId — most recent reason wins
  const filtered = queue.filter(r => r.callId !== entry.callId);
  filtered.push({ ...entry, createdAt: Date.now() });
  write(filtered);
}

export function clearRefund(callId: string): void {
  const queue = read().filter(r => r.callId !== callId);
  write(queue);
}

export function listRefunds(): PendingRefund[] {
  return read();
}
