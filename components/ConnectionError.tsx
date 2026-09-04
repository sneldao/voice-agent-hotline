'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, PhoneOutgoing, WifiOff } from 'lucide-react';
import { Mascot } from './Mascot';
import type { ApiErrorKind } from '@/lib/api-client';

/**
 * Delightful failure UX.
 *
 * The old experience was a dead-end: "Failed to load brokers / Failed to
 * fetch / Try Again". This component instead:
 * - speaks in the Claflin broker-desk voice (never raw browser errors),
 * - adapts to the failure mode (offline vs server snag vs slow line),
 * - retries automatically on a visible countdown with backoff,
 * - retries the instant the device comes back online,
 * - and keeps the user informed while a retry is in flight.
 */

interface ConnectionErrorProps {
  /** Friendly message (ApiError.friendlyMessage). */
  message?: string | null;
  /** Structured failure mode for adaptive copy. */
  kind?: ApiErrorKind | null;
  /** Retry handler — may return a promise; the button shows progress. */
  onRetry?: () => Promise<unknown> | void;
  /** Seconds before the first automatic retry. 0/undefined disables. */
  autoRetrySeconds?: number;
  className?: string;
}

const HEADLINES: Record<ApiErrorKind, string> = {
  offline: "The line's gone quiet",
  network: "Can't reach the broker desk",
  timeout: 'The line is ringing… and ringing',
  http: 'The broker desk is having a moment',
  parse: 'The broker desk answered with static',
};

const DEFAULT_MESSAGE = 'Our broker has been paged and is scrambling to reconnect.';

export function ConnectionError({
  message,
  kind = null,
  onRetry,
  autoRetrySeconds = 0,
  className = '',
}: ConnectionErrorProps) {
  const [attempt, setAttempt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(autoRetrySeconds);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryingRef = useRef(false);

  const isOffline = kind === 'offline';
  const headline = (kind && HEADLINES[kind]) || HEADLINES.http;

  // Back off across automatic attempts: 5s → 10s → 20s → 30s (cap).

  const fireRetry = useCallback(async () => {
    if (!onRetry || retryingRef.current) return;
    retryingRef.current = true;
    setIsRetrying(true);
    try {
      await onRetry();
    } catch { /* parent owns the error state */ } finally {
      retryingRef.current = false;
      setIsRetrying(false);
      setAttempt((a) => a + 1);
      setSecondsLeft(Math.min((autoRetrySeconds || 5) * 2 ** (attempt + 1), 30));
    }
  }, [onRetry, autoRetrySeconds, attempt]);

  // Visible countdown → automatic retry.
  useEffect(() => {
    if (!autoRetrySeconds || !onRetry || isRetrying) return;
    if (secondsLeft <= 0) {
      void fireRetry();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [autoRetrySeconds, onRetry, secondsLeft, isRetrying, fireRetry]);

  // The moment connectivity returns, ring again — no waiting for the timer.
  useEffect(() => {
    if (!onRetry || typeof window === 'undefined') return;
    const onOnline = () => void fireRetry();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [onRetry, fireRetry]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}
    >
      <div className="relative">
        <Mascot mood="thinking" size={110} />
        {isOffline && (
          <span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border border-amber-100/20 bg-stone-900">
            <WifiOff className="h-4 w-4 text-amber-200/80" />
          </span>
        )}
      </div>

      {/* role="alert" announces the failure once, on appearance. The
          countdown below is deliberately outside this region — per-second
          updates would spam screen readers. */}
      <div role="alert">
        <h3 className="mt-5 font-display text-xl font-bold text-amber-50">{headline}</h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-amber-100/60">
          {message || DEFAULT_MESSAGE}
        </p>
      </div>

      {onRetry && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void fireRetry()}
            disabled={isRetrying}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:from-red-500 hover:to-amber-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRetrying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Ringing the broker desk…
              </>
            ) : (
              <>
                <PhoneOutgoing className="h-4 w-4" />
                Ring again
              </>
            )}
          </button>

          {autoRetrySeconds > 0 && !isRetrying && secondsLeft > 0 && (
            <>
              <p aria-hidden="true" className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-100/45">
                Redialing in {secondsLeft}s
                {attempt > 0 && ` · attempt ${attempt + 1}`}
              </p>
              <span className="sr-only">We keep redialing automatically every few seconds.</span>
            </>
          )}
          {isOffline && (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-100/45">
              We'll redial the moment you're back online
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Inline banner for the best-case failure: we have stale data on screen and
 * are quietly reconnecting in the background. Far better than replacing a
 * perfectly usable directory with an error page.
 */
interface ReconnectingBannerProps {
  message?: string | null;
  isRetrying?: boolean;
  onRetry?: () => Promise<unknown> | void;
}

export function ReconnectingBanner({ message, isRetrying = false, onRetry }: ReconnectingBannerProps) {
  const [busy, setBusy] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || busy) return;
    setBusy(true);
    try {
      await onRetry();
    } catch { /* parent owns the error state */ } finally {
      setBusy(false);
    }
  };

  const spinning = busy || isRetrying;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
      </span>
      <p className="flex-1 text-left text-xs font-medium text-amber-100/80">
        {message || 'Having trouble reaching the broker desk — showing the last known lines.'}
        {spinning && <span className="text-amber-100/55"> Reconnecting…</span>}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={spinning}
          className="shrink-0 rounded-lg border border-amber-100/20 bg-amber-100/10 px-2.5 py-1 text-[11px] font-bold text-amber-100 transition-colors hover:bg-amber-100/15 disabled:opacity-60"
        >
          {spinning ? 'Ringing…' : 'Try now'}
        </button>
      )}
    </motion.div>
  );
}
