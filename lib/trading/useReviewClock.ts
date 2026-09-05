'use client';

import { useEffect, useState } from 'react';

/** Local 1Hz clock only while `active` — keeps review countdown off the desk tree. */
export function useReviewClock(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
