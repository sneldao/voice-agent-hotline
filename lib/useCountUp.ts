'use client';

import { useEffect, useState } from 'react';

/**
 * Counts up from 0 to `target` over `duration` ms using easeOutCubic.
 * Skips animation if the user prefers reduced motion.
 */
export function useCountUp(target: number, duration = 800, delay = 0): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    let raf = 0;
    let start = 0;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const elapsed = ts - start;
        const t = Math.min(elapsed / duration, 1);
        setValue(Math.round(target * easeOutCubic(t)));
        if (t < 1) raf = requestAnimationFrame(step);
        else setValue(target);
      };
      raf = requestAnimationFrame(step);
    }, delay);

    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);

  return value;
}
