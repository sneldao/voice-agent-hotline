/**
 * Resilient API client.
 *
 * Every browser fetch goes through `apiFetch`, which turns the soup of
 * network failure modes (DNS, TLS, CORS blocks, proxy 502s, hung sockets)
 * into a small set of typed, retryable errors with human-friendly copy.
 *
 * Design goals:
 * - Fail fast and clearly when the device is offline.
 * - Time out hung requests instead of spinning forever.
 * - Retry idempotent requests with exponential backoff + jitter — a backend
 *   restart should look like a brief "reconnecting" state, not an error page.
 * - Never leak "Failed to fetch" to the UI; map everything to friendly copy.
 */

export type ApiErrorKind = 'offline' | 'network' | 'timeout' | 'http' | 'parse';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Whether another attempt has a reasonable chance of succeeding. */
  readonly retryable: boolean;
  /** Human copy safe to show end users (matches the Claflin broker-desk voice). */
  readonly friendlyMessage: string;

  constructor(kind: ApiErrorKind, message: string, options?: { status?: number; retryable?: boolean; friendlyMessage?: string }) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options?.status;
    this.retryable = options?.retryable ?? defaultRetryable(kind, options?.status);
    this.friendlyMessage = options?.friendlyMessage ?? friendlyMessageFor(kind, options?.status);
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRY_BASE_MS = 800;
const MAX_RETRY_DELAY_MS = 8_000;
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface ApiFetchOptions extends Omit<RequestInit, 'signal'> {
  /** Abort the request after this many ms. Default 12s. */
  timeoutMs?: number;
  /** Extra attempts after the first failure. Default 2 for GET/HEAD, 0 otherwise. */
  retries?: number;
  /** Base delay for backoff. Default 800ms. */
  retryBaseMs?: number;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  /** External abort signal — combined with the internal timeout signal. */
  signal?: AbortSignal;
}

/** Status codes worth retrying (transient by definition or convention). */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function defaultRetryable(kind: ApiErrorKind, status?: number): boolean {
  switch (kind) {
    case 'network':
    case 'timeout':
      return true;
    case 'http':
      return status !== undefined && isRetryableStatus(status);
    default:
      return false;
  }
}

/** Product-voice copy for each failure mode. */
export function friendlyMessageFor(kind: ApiErrorKind, status?: number): string {
  switch (kind) {
    case 'offline':
      return "You're offline. Check your connection and we'll pick the line back up.";
    case 'timeout':
      return 'The line is taking too long to answer. Give it another ring.';
    case 'network':
      return "Can't reach the broker desk right now. We'll keep trying.";
    case 'parse':
      return 'The broker desk answered with static. Please try again.';
    case 'http':
      if (status === 429) return 'Too many calls at once — give it a moment and redial.';
      if (status === 404) return 'That line has been disconnected.';
      if (status !== undefined && status >= 500) {
        return 'Our broker is scrambling — the desk hit a snag.';
      }
      return 'Something unexpected happened on the line.';
  }
}

/** Classify a rejected fetch() promise. CORS blocks surface as TypeError too. */
export function classifyFetchFailure(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError('timeout', 'Request aborted', { retryable: true });
  }

  // fetch() rejects with TypeError for DNS/TLS/CORS/connection-refused —
  // the browser deliberately hides which one, so treat them all as
  // "network" and retry: most are transient.
  if (error instanceof TypeError) {
    return new ApiError('network', error.message || 'Network request failed');
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ApiError('network', message || 'Network request failed');
}

/**
 * Exponential backoff with full jitter:
 *   delay = random(0, min(maxDelay, base * 2^attempt))
 * Jitter avoids thundering-herd retries when the backend comes back.
 */
export function computeBackoffDelay(
  attempt: number,
  baseMs: number = DEFAULT_RETRY_BASE_MS,
  maxMs: number = MAX_RETRY_DELAY_MS,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(random() * ceiling);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * fetch() with timeout, typed errors, and backoff retries.
 *
 * Retries apply to idempotent methods only (GET/HEAD/OPTIONS) unless
 * explicitly requested — never silently replay a payment or a POST.
 */
export async function apiFetch<T = unknown>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryBaseMs = DEFAULT_RETRY_BASE_MS,
    fetchImpl = fetch,
    signal: externalSignal,
    ...init
  } = options;

  const method = (init.method || 'GET').toUpperCase();
  const retries = options.retries ?? (IDEMPOTENT_METHODS.has(method) ? 2 : 0);

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(computeBackoffDelay(attempt - 1, retryBaseMs));
    }

    if (isOffline()) {
      lastError = new ApiError('offline', 'Device is offline', { retryable: true });
      // Offline won't fix itself in 800ms — don't burn attempts spinning.
      if (attempt < retries) continue;
      throw lastError;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });

      if (!response.ok) {
        // Best-effort server message; error bodies are often plain text/HTML.
        let serverMessage = '';
        try {
          const text = await response.text();
          try {
            const json = JSON.parse(text);
            serverMessage = json?.error || json?.message || text.slice(0, 200);
          } catch {
            serverMessage = text.slice(0, 200);
          }
        } catch { /* body unreadable — status is enough */ }

        throw new ApiError(
          'http',
          serverMessage || `Request failed with status ${response.status}`,
          { status: response.status },
        );
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new ApiError('parse', 'Response was not valid JSON', { status: response.status });
      }
    } catch (error) {
      const classified = classifyFetchFailure(error);
      lastError = classified;

      const canRetry = attempt < retries && classified.retryable;
      if (!canRetry) throw classified;
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }

  throw lastError ?? new ApiError('network', 'Request failed');
}
