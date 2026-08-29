'use client';

import { useEffect, useState } from 'react';

/* ─────────────────────────────────────────────────────────
 * CONNECTION STATE — switchboard-native loader
 *
 * Adapted from the pixel-grid loader ideal for a voice-first
 * product. A signal pulse (the "line patching in") pairs with
 * a shimmering label and a live elapsed timer in mono tabular
 * figures — cost transparency matters when every second on the
 * line is billed.
 *
 * Reduced motion freezes the pulse to its dim state; the timer
 * still ticks.
 * ───────────────────────────────────────────────────────── */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

function useElapsed() {
  const [ds, setDs] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);

  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

function SignalPulse({ reduced }: { reduced: boolean }) {
  return (
    <span aria-hidden className="relative flex size-11 items-center justify-center">
      <span className="cs-pulse-ring absolute inline-flex size-11 rounded-full border border-amber-200/25" />
      <span className="cs-pulse-ring cs-pulse-ring--delay absolute inline-flex size-11 rounded-full border border-amber-200/15" />
      <span className="relative flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-amber-500 shadow-lg shadow-red-950/40">
        <span
          className="cs-pulse-dot size-1.5 rounded-full bg-amber-50"
          style={reduced ? { animation: 'none' } : undefined}
        />
      </span>
    </span>
  );
}

export default function ConnectionState({
  label,
  sublabel,
  timerLabel = 'patching the line',
  showElapsed = true,
}: {
  /** Primary shimmering label, e.g. "Patching the line to Solana Sage…" */
  label: string;
  /** Mono uppercase sublabel, e.g. "chain desk · $0.20/min" */
  sublabel?: string;
  /** Short caption paired with the elapsed timer. */
  timerLabel?: string;
  showElapsed?: boolean;
}) {
  const reduced = useReducedMotion();
  const elapsed = useElapsed();

  return (
    <div role="status" aria-live="polite" className="flex w-fit flex-col items-center gap-3">
      <SignalPulse reduced={reduced} />
      <div className="text-center">
        <p
          className="bg-clip-text font-display text-[15px] font-semibold text-transparent"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(253,230,138,0.35) 35%, #fde68a 50%, rgba(253,230,138,0.35) 65%)',
            backgroundSize: '200% 100%',
            animation: reduced ? 'none' : 'shimmer-text 1.6s linear infinite',
          }}
        >
          {label}
        </p>
        {sublabel && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100/40">
            {sublabel}
          </p>
        )}
        {showElapsed && (
          <p className="mt-1.5 font-mono text-[12px] text-amber-100/55 tabular-nums">
            {timerLabel} · {elapsed}
          </p>
        )}
      </div>
    </div>
  );
}