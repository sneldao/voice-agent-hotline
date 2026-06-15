'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ShieldCheck, Timer } from 'lucide-react';

interface CostPanelProps {
  pricePerMinute: number;
  /** Current elapsed cost (0 if not in call). */
  liveCost?: number;
  /** Cap in dollars — null means unlimited. */
  cap: number | null;
  onCapChange: (cap: number | null) => void;
  /** Whether the call is active. */
  isLive?: boolean;
}

const CAP_OPTIONS: Array<{ label: string; value: number | null; hint: string }> = [
  { label: '$0.50', value: 0.5, hint: '~5 min' },
  { label: '$1', value: 1, hint: '~10 min' },
  { label: '$2', value: 2, hint: '~20 min' },
  { label: '$5', value: 5, hint: '~50 min' },
  { label: 'Open', value: null, hint: 'no cap' },
];

const LOW_THRESHOLD_PCT = 0.20;
const CRITICAL_THRESHOLD_PCT = 0.10;

export function CostPanel({
  pricePerMinute,
  liveCost = 0,
  cap,
  onCapChange,
  isLive = false,
}: CostPanelProps) {
  const rate = Math.max(0, Number(pricePerMinute) || 0);

  const remainingPct = useMemo(() => {
    if (cap == null) return 1;
    if (cap <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - liveCost / cap));
  }, [cap, liveCost]);

  const secondsLeft = useMemo(() => {
    if (cap == null || rate <= 0) return null;
    const remaining = cap - liveCost;
    if (remaining <= 0) return 0;
    return Math.floor((remaining / rate) * 60);
  }, [cap, liveCost, rate]);

  const status = useMemo(() => {
    if (cap == null) return 'open';
    if (remainingPct <= 0) return 'empty';
    if (remainingPct <= CRITICAL_THRESHOLD_PCT) return 'critical';
    if (remainingPct <= LOW_THRESHOLD_PCT) return 'low';
    return 'ok';
  }, [cap, remainingPct]);

  return (
    <section className="cost-panel" aria-label="Call cost">
      <div className="cost-panel__top">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-amber-300/85" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100/55">
            Rate
          </span>
        </div>
        <div className="cost-panel__rate">
          <span className="text-[10px] font-medium opacity-60">$</span>
          {rate.toFixed(2)}
          <span className="text-[10px] font-medium opacity-60">/min</span>
        </div>
      </div>

      {!isLive && (
        <div className="cost-panel__cap-row">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100/55">
            Set a cap
          </span>
          <div className="cost-panel__caps">
            {CAP_OPTIONS.map(opt => {
              const isActive = (opt.value === null && cap === null) || opt.value === cap;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onCapChange(opt.value)}
                  aria-pressed={isActive}
                  className={`cost-cap ${isActive ? 'cost-cap--active' : ''}`}
                >
                  <span className="cost-cap__label">{opt.label}</span>
                  <span className="cost-cap__hint">{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLive && cap != null && (
        <div className="cost-panel__live" data-status={status}>
          <div className="cost-panel__live-header">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100/55">
              On the line
            </span>
            <span className="font-mono text-sm font-bold text-amber-50">
              ${liveCost.toFixed(2)}
              <span className="text-amber-100/35 text-[10px] font-medium"> / ${cap.toFixed(2)}</span>
            </span>
          </div>
          <div className="cost-panel__bar">
            <motion.div
              className="cost-panel__bar-fill"
              initial={false}
              animate={{ width: `${remainingPct * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <div className="cost-panel__live-foot">
            <AnimatePresence mode="wait">
              {status === 'critical' && secondsLeft != null ? (
                <motion.span
                  key="critical"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="cost-warn cost-warn--critical"
                >
                  <Timer className="h-3 w-3" />
                  {secondsLeft}s left on the line
                </motion.span>
              ) : status === 'low' && secondsLeft != null ? (
                <motion.span
                  key="low"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="cost-warn cost-warn--low"
                >
                  <Timer className="h-3 w-3" />
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} remaining
                </motion.span>
              ) : status === 'empty' ? (
                <motion.span
                  key="empty"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="cost-warn cost-warn--empty"
                >
                  Cap reached — line closes
                </motion.span>
              ) : (
                <motion.span
                  key="ok"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="cost-warn cost-warn--ok"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Cap honored
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {isLive && cap == null && (
        <div className="cost-panel__live cost-panel__live--open">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100/45">
            No cap · tracking
          </span>
          <span className="font-mono text-sm font-bold text-amber-50">
            ${liveCost.toFixed(2)}
          </span>
        </div>
      )}
    </section>
  );
}
