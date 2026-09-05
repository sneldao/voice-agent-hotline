'use client';

import type { useTradingDesk } from '@/lib/trading/useTradingDesk';
import { estimateUsable } from '@/lib/trading/workflow';
import styles from './WorkingDesk.module.css';

export function HettyStatus({ desk }: { desk: ReturnType<typeof useTradingDesk> }) {
  const { state, now } = desk;
  const quote = state.quote;
  const expired = quote ? !estimateUsable(quote, now) : false;
  const remaining = quote ? Math.max(0, Math.ceil((quote.expiresAt - now) / 1000)) : 0;

  let line: string;
  switch (state.stage) {
    case 'loading':
      line = 'Preparing your estimate…';
      break;
    case 'review':
      line = expired
        ? 'That estimate expired — refresh when you are ready.'
        : `For your review — ${remaining}s remaining on this estimate.`;
      break;
    case 'saved':
      line = 'Paper trade recorded in this browser. Nothing moved onchain.';
      break;
    default:
      line = state.draft.instrumentId
        ? 'Draft on the desk. Request an estimate when the amount is set.'
        : 'The desk is clear. Choose a stock to begin.';
  }

  return (
    <p className={styles.hettyStatus} role="status" aria-live="polite" data-stage={state.stage}>
      <span className={styles.hettyStatusLabel}>HETTY</span>
      {line}
    </p>
  );
}
