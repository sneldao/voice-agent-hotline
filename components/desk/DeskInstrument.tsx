'use client';

import { useEffect, useRef, useState } from 'react';
import type { DeskInstrumentController, DeskInstrumentStage } from '@/lib/desk-instrument';
import styles from './DeskInstrument.module.css';

function stageCaption(stage: DeskInstrumentStage) {
  if (stage === 'confirmation') return 'REVIEW INSTRUCTION';
  if (stage === 'conversation') return 'CONVERSATION STUDY';
  return 'HETTY — AT THE DESK';
}

export function DeskInstrument({ stage, label = 'PAPER TRADING / NO LIVE ORDERS' }: { stage: DeskInstrumentStage; label?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<DeskInstrumentController | null>(null);
  const stageRef = useRef(stage);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    stageRef.current = stage;
    controllerRef.current?.setStage(stage);
  }, [stage]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    if (reducedMotion) {
      controllerRef.current?.dispose();
      controllerRef.current = null;
      setReady(false);
      return;
    }

    import('@/lib/desk-instrument').then(({ createDeskInstrument }) => {
      if (cancelled) return;
      controllerRef.current = createDeskInstrument(canvas, host, stageRef.current, () => setReady(false), label);
      setReady(true);
    }).catch(() => {
      if (!cancelled) setReady(false);
    });

    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [label, reducedMotion]);

  return (
    <div
      ref={hostRef}
      className={styles.instrument}
      data-ready={ready && !reducedMotion}
      data-stage={stage}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div className={styles.instrumentFallback}>
        <div className={styles.fallbackReceiver}><i /><i /></div>
        <div className={styles.fallbackBody}>
          <span className={styles.fallbackDisplay}>
            CLAFLIN
            <br />
            <strong>{stageCaption(stage)}</strong>
            <small>{label}</small>
          </span>
          <span className={styles.fallbackDial} />
          <span className={styles.fallbackEdge} />
        </div>
      </div>
      <canvas ref={canvasRef} className={styles.instrumentCanvas} aria-hidden="true" />
    </div>
  );
}
