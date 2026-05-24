'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { playPop, playSuccess } from '@/lib/sounds';
import { track } from '@/lib/track';

const COACHMARK_KEY = 'voisss-coachmarks-done';
const COACHMARK_DELAY = 2400; // ms after mount before starting

interface Step {
  targetId: string;
  title: string;
  body: string;
  placement: 'bottom' | 'top' | 'right';
}

const STEPS: Step[] = [
  {
    targetId: 'coachmark-dial',
    title: 'Pick up the line',
    body: 'Tap the dial to start a voice call instantly. No typing, no forms — just speak.',
    placement: 'bottom',
  },
  {
    targetId: 'coachmark-free-badge',
    title: 'First call, on us',
    body: 'Your first call is completely free. No wallet, no sign-up — just tap and talk.',
    placement: 'bottom',
  },
  {
    targetId: 'coachmark-switchboard',
    title: 'Meet the operators',
    body: 'Browse specialist AI agents by desk. Tap one to see their profile, then connect.',
    placement: 'top',
  },
];

export function Coachmarks() {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [show, setShow] = useState(false);
  const mountedRef = useRef(true);

  // Determine whether to show coachmarks on mount
  useEffect(() => {
    mountedRef.current = true;
    if (typeof window === 'undefined') return;
    const done = localStorage.getItem(COACHMARK_KEY);
    if (done) return;

    // Delay so the page + welcome toast settle first
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      setStepIndex(0);
      setShow(true);
      track('coachmark_started', {});
    }, COACHMARK_DELAY);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  // Track the target element's rect
  const updateRect = useCallback((id: string) => {
    if (!mountedRef.current) return;
    const el = document.getElementById(id);
    if (el) {
      setRect(el.getBoundingClientRect());
    }
  }, []);

  // On step change: measure immediately, scroll, then re-measure after scroll settles
  useEffect(() => {
    if (stepIndex === null || stepIndex >= STEPS.length) return;
    const step = STEPS[stepIndex];

    // Track step view
    track('coachmark_step_viewed', { step: stepIndex + 1, targetId: step.targetId });

    // Measure immediately (element is already in DOM)
    updateRect(step.targetId);

    // Scroll target into view
    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Re-measure once scroll has likely settled
    const scrollTimer = setTimeout(() => updateRect(step.targetId), 450);
    return () => clearTimeout(scrollTimer);
  }, [stepIndex, updateRect]);

  // Re-measure on resize / scroll while a step is active
  useEffect(() => {
    if (stepIndex === null || stepIndex >= STEPS.length) return;
    const step = STEPS[stepIndex];
    const onRefresh = () => updateRect(step.targetId);
    window.addEventListener('scroll', onRefresh, { passive: true });
    window.addEventListener('resize', onRefresh, { passive: true });
    return () => {
      window.removeEventListener('scroll', onRefresh);
      window.removeEventListener('resize', onRefresh);
    };
  }, [stepIndex, updateRect]);

  const finish = useCallback(() => {
    if (!mountedRef.current) return;
    setShow(false);
    playSuccess();
    track('coachmark_completed', { totalSteps: STEPS.length });
    if (typeof window !== 'undefined') {
      localStorage.setItem(COACHMARK_KEY, 'true');
    }
    // Delay unmount to let the exit animation play
    setTimeout(() => {
      if (mountedRef.current) setStepIndex(null);
    }, 300);
  }, []);

  const skip = useCallback(() => {
    track('coachmark_skipped', { currentStep: stepIndex !== null ? stepIndex + 1 : 0 });
    finish();
  }, [finish, stepIndex]);

  const next = useCallback(() => {
    playPop();
    if (stepIndex === null || stepIndex >= STEPS.length - 1) {
      finish();
    } else {
      setStepIndex(stepIndex + 1);
    }
  }, [stepIndex, finish]);

  if (stepIndex === null || stepIndex >= STEPS.length) return null;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={`coachmark-${stepIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] pointer-events-none"
        >
          {/* Highlight ring around target element */}
          {rect && (
            <motion.div
              key={`ring-${stepIndex}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="pointer-events-none absolute rounded-xl border-2 border-amber-400/50 shadow-[0_0_20px_8px_rgba(251,191,36,0.12)]"
              style={{
                left: rect.left - 8,
                top: rect.top - 8,
                width: rect.width + 16,
                height: rect.height + 16,
              }}
            />
          )}

          {/* Tooltip card */}
          {rect && (
            <motion.div
              key={`tooltip-${stepIndex}`}
              initial={{ opacity: 0, y: step.placement === 'top' ? 12 : -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: step.placement === 'top' ? 8 : -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 26, delay: 0.1 }}
              className="absolute z-[61] w-72 pointer-events-auto"
              style={getTooltipPosition(rect, step.placement)}
            >
              {/* Arrow pointing toward target */}
              <div
                className="absolute left-6 h-3 w-3 rotate-45 bg-[#2a1a12] border-l border-t border-amber-100/20"
                style={getArrowStyle(step.placement)}
              />

              {/* Card body */}
              <div className="rounded-xl border border-amber-100/25 bg-[#2a1a12] shadow-2xl shadow-black/60 backdrop-blur-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-amber-100/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Tip {stepIndex + 1}/{STEPS.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={skip}
                    className="rounded-full p-1 text-amber-100/30 transition-colors hover:bg-amber-100/10 hover:text-amber-100/60"
                    aria-label="Skip tour"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-4 py-3">
                  <h4 className="text-sm font-bold text-amber-50">{step.title}</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-amber-100/65">{step.body}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-amber-100/10 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={skip}
                    className="text-[11px] font-medium text-amber-100/30 transition-colors hover:text-amber-100/60"
                  >
                    Skip all
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/80 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-400 active:scale-95"
                  >
                    {isLastStep ? 'Got it' : 'Next'}
                    {!isLastStep && <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step dots indicator */}
          <div className="fixed bottom-8 left-1/2 z-[61] flex -translate-x-1/2 items-center gap-2 pointer-events-auto">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  playPop();
                  setStepIndex(i);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? 'w-6 bg-amber-400'
                    : i < stepIndex
                      ? 'w-2 bg-amber-400/40'
                      : 'w-2 bg-amber-100/15 hover:bg-amber-100/30'
                }`}
                aria-label={`Go to tip ${i + 1}`}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Positioning helpers ──────────────────────────────────────────────────

function getTooltipPosition(
  rect: DOMRect,
  placement: 'bottom' | 'top' | 'right',
): React.CSSProperties {
  const gap = 16;
  const tooltipW = 288; // w-72
  const tooltipH = 160; // approximate tooltip height

  switch (placement) {
    case 'bottom': {
      let left = rect.left + rect.width / 2 - tooltipW / 2;
      left = clamp(left, 12, window.innerWidth - tooltipW - 12);
      // Clamp vertical so tooltip doesn't overflow viewport bottom
      const top = Math.min(rect.bottom + gap, window.innerHeight - tooltipH - 16);
      return { top, left };
    }
    case 'top': {
      let left = rect.left + rect.width / 2 - tooltipW / 2;
      left = clamp(left, 12, window.innerWidth - tooltipW - 12);
      // Clamp vertical so tooltip doesn't overflow viewport top
      const bottom = Math.min(window.innerHeight - rect.top + gap, window.innerHeight - 16);
      return { bottom: Math.max(bottom, 16), left };
    }
    case 'right': {
      const top = clamp(rect.top + rect.height / 2 - tooltipH / 2, 12, window.innerHeight - tooltipH - 12);
      return { top, left: rect.right + gap };
    }
  }
}

function getArrowStyle(placement: 'bottom' | 'top' | 'right'): React.CSSProperties {
  switch (placement) {
    case 'bottom':
      return { top: -6, left: 24, borderRight: 'none', borderBottom: 'none' };
    case 'top':
      return { bottom: -6, left: 24, borderLeft: 'none', borderTop: 'none' };
    case 'right':
      return { left: -6, top: 24, borderRight: 'none', borderTop: 'none' };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
