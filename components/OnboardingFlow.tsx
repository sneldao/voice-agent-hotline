'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, PhoneCall, ShieldCheck, X, Radio } from 'lucide-react';
import { Mascot } from './Mascot';
import { playPop, playSuccess, playDialTone, playClick } from '@/lib/sounds';
import { track } from '@/lib/track';
import { USE_CASES, type UseCase, type OnboardingStep } from '@/lib/useOnboarding';

interface OnboardingFlowProps {
  currentStep: OnboardingStep;
  selectedUseCase: UseCase | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
  onSetUseCase: (useCase: UseCase) => void;
  stepIndex: number;
  totalSteps: number;
  /** Called on the final step — starts a real call to the concierge. */
  onStartFirstCall?: () => void;
}

const STEP_META: Record<OnboardingStep, { title: string; subtitle: string; mood: 'waving' | 'thinking' | 'talking' | 'happy' | 'celebrating' }> = {
  'splash': {
    title: 'This is a phone.',
    subtitle: 'Pick it up. Talk. The right voice answers.',
    mood: 'waving',
  },
  'use-case': {
    title: 'Who do you want to reach?',
    subtitle: 'Pick a focus. We\'ll match the line for you.',
    mood: 'thinking',
  },
  'how-it-works': {
    title: 'How the line works',
    subtitle: 'Three things. Then you\'re talking.',
    mood: 'talking',
  },
  'free-call': {
    title: 'Your first call is free',
    subtitle: 'Allow the mic. We\'ll dial for you.',
    mood: 'happy',
  },
  'complete': {
    title: 'You\'re live.',
    subtitle: 'Connecting you to the broker desk.',
    mood: 'celebrating',
  },
};

const HOW_IT_WORKS_STEPS = [
  { icon: PhoneCall, label: 'Dial a line', desc: 'Pick from the directory' },
  { icon: Mic, label: 'Speak', desc: 'Say what you need' },
  { icon: Radio, label: 'Get answers', desc: 'Real-time, no typing' },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.96,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.96,
  }),
};

export function OnboardingFlow({
  currentStep,
  selectedUseCase,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  onSetUseCase,
  stepIndex,
  totalSteps,
  onStartFirstCall,
}: OnboardingFlowProps) {
  const meta = STEP_META[currentStep];
  const isLast = currentStep === 'complete';
  const isFirst = currentStep === 'splash';
  const isFreeCallStep = currentStep === 'free-call';

  // Mic permission state (only used on the free-call step)
  const [micState, setMicState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    track('onboarding_step_viewed', { step: currentStep, stepIndex: stepIndex + 1 });
  }, [currentStep, stepIndex]);

  useEffect(() => {
    if (currentStep === 'splash') {
      playDialTone();
    }
  }, [currentStep]);

  const handleNext = useCallback(() => {
    playPop();
    if (isLast) {
      playSuccess();
      track('onboarding_completed', { useCase: selectedUseCase || 'none' });
      // Mark the close; the app will start the call via onComplete or onStartFirstCall
      onComplete();
      // Defer the actual dial so the close transition can play first
      setTimeout(() => {
        onStartFirstCall?.();
      }, 320);
      return;
    }
    onNext();
  }, [isLast, onNext, onComplete, onStartFirstCall, selectedUseCase]);

  const handleSkip = useCallback(() => {
    track('onboarding_skipped', { step: currentStep });
    onSkip();
  }, [currentStep, onSkip]);

  // ── Tactile rotary dial (splash step) ─────────────────────────────────
  // The dial on the splash screen is not decorative: spin it clockwise one
  // full turn and the dial "picks up" — advancing to the next step. The
  // Next button still works for anyone who doesn't try it.
  const dialRef = useRef<HTMLDivElement>(null);
  const spinState = useRef<{ lastAngle: number | null; total: number }>({ lastAngle: null, total: 0 });
  const [dialRotation, setDialRotation] = useState(0);
  const hasSpunRef = useRef(false);

  const angleFromCenter = (e: React.PointerEvent): number | null => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return (Math.atan2(
      e.clientY - (rect.top + rect.height / 2),
      e.clientX - (rect.left + rect.width / 2)
    ) * 180) / Math.PI;
  };

  const handleDialDown = useCallback((e: React.PointerEvent) => {
    if (currentStep !== 'splash') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    spinState.current.lastAngle = angleFromCenter(e);
  }, [currentStep]);

  const handleDialMove = useCallback((e: React.PointerEvent) => {
    if (currentStep !== 'splash' || spinState.current.lastAngle === null) return;
    const angle = angleFromCenter(e);
    if (angle === null) return;
    let delta = angle - spinState.current.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    spinState.current.lastAngle = angle;
    spinState.current.total += delta;
    setDialRotation(spinState.current.total);
    if (spinState.current.total >= 360 && !hasSpunRef.current) {
      hasSpunRef.current = true;
      playClick();
      try { navigator.vibrate?.(30); } catch { /* unsupported */ }
      track('onboarding_dial_spun');
      handleNext();
    }
  }, [currentStep, handleNext]);

  const handleDialUp = useCallback(() => {
    spinState.current.lastAngle = null;
  }, []);

  const handleRequestMic = useCallback(async () => {
    setMicState('requesting');
    playClick();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicState('granted');
      // Hold the stream briefly so the user sees the live waveform, then release
      setTimeout(() => {
        stream.getTracks().forEach(t => t.stop());
      }, 1500);
    } catch {
      setMicState('denied');
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[80] flex items-center justify-center"
    >
      {/* Backdrop with grain */}
      <div className="absolute inset-0 bg-[#0b0806]/94 backdrop-blur-md" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center px-6">
        {/* Skip button */}
        {!isLast && (
          <button
            type="button"
            onClick={handleSkip}
            className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-amber-100/40 transition-colors hover:bg-amber-100/10 hover:text-amber-100/70"
          >
            Skip
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Mascot / phone visual */}
        <motion.div
          key={`mascot-${currentStep}`}
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="mb-6"
        >
          {currentStep === 'splash' ? (
            <div
              ref={dialRef}
              role="img"
              aria-label="Rotary dial — spin it clockwise to pick up the phone"
              onPointerDown={handleDialDown}
              onPointerMove={handleDialMove}
              onPointerUp={handleDialUp}
              onPointerCancel={handleDialUp}
              style={{ touchAction: 'none' }}
              className="rotary-dial h-40 w-40 cursor-grab rounded-full flex items-center justify-center relative active:cursor-grabbing"
            >
              <div className="absolute inset-6 rounded-full bg-gradient-to-br from-red-700 to-amber-700 flex items-center justify-center shadow-inner">
                <span className="font-display text-3xl text-amber-50 tracking-tight">C</span>
              </div>
              {/* 10 dial holes — rotate the ring with the pointer */}
              <div
                className="absolute inset-0"
                style={{
                  transform: `rotate(${dialRotation}deg)`,
                  transition: spinState.current.lastAngle === null ? 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
                }}
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const angle = (i * 36 - 90) * (Math.PI / 180);
                  const r = 60;
                  const x = Math.cos(angle) * r;
                  const y = Math.sin(angle) * r;
                  return (
                    <span
                      key={i}
                      className="absolute h-3 w-3 rounded-full bg-[#1a100c] border border-amber-200/30 shadow-inner"
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <Mascot mood={meta.mood} size={140} />
          )}
        </motion.div>

        {/* Step content with slide animation */}
        <AnimatePresence mode="wait" custom={stepIndex}>
          <motion.div
            key={currentStep}
            custom={stepIndex}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full text-center"
          >
            <h2 className="font-display text-3xl font-bold text-amber-50 sm:text-4xl">
              {meta.title}
            </h2>
            <p className="mt-2 text-sm text-amber-100/65">
              {meta.subtitle}
            </p>

            {currentStep === 'splash' && (
              <p className="mt-6 mx-auto max-w-xs text-xs font-mono uppercase tracking-[0.18em] text-amber-100/40">
                Spin the dial to pick up · No signup · No keyboard
              </p>
            )}

            {/* Step 2: pick a focus */}
            {currentStep === 'use-case' && (
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {USE_CASES.map((uc, i) => {
                  const isSelected = selectedUseCase === uc.id;
                  return (
                    <motion.button
                      key={uc.id}
                      type="button"
                      onClick={() => {
                        playPop();
                        onSetUseCase(uc.id);
                      }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        isSelected
                          ? 'border-amber-300/55 bg-amber-300/15 shadow-sm shadow-amber-300/15'
                          : 'border-amber-100/10 bg-amber-100/[0.03] hover:border-amber-100/25 hover:bg-amber-100/[0.06]'
                      }`}
                    >
                      <span className="text-lg">{uc.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-amber-50 truncate">{uc.label}</p>
                        <p className="text-[10px] text-amber-100/40 truncate">{uc.description}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Step 3: how it works, compact */}
            {currentStep === 'how-it-works' && (
              <div className="mt-6 space-y-2">
                {HOW_IT_WORKS_STEPS.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.1 }}
                    className="flex items-center gap-3 rounded-xl border border-amber-100/10 bg-amber-100/[0.03] px-4 py-2.5 text-left"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-amber-500/20">
                      <step.icon className="h-4 w-4 text-amber-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-50">{step.label}</p>
                      <p className="text-[11px] text-amber-100/55">{step.desc}</p>
                    </div>
                    <span className="font-mono text-[10px] text-amber-100/30">
                      0{i + 1}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Step 4: mic permission */}
            {isFreeCallStep && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-6"
              >
                <MicPermissionCard
                  state={micState}
                  onRequest={handleRequestMic}
                />
              </motion.div>
            )}

            {/* Step 5: live */}
            {currentStep === 'complete' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6"
              >
                <div className="mx-auto flex items-center justify-center gap-1.5 h-12">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className="block w-1 rounded-full bg-amber-300/85 waveform-bar"
                      style={{
                        height: `${20 + ((i * 7) % 24)}px`,
                        animationDelay: `${i * 90}ms`,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.32em] text-amber-100/40">
                  patching the line
                </p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-8 flex w-full items-center justify-between">
          {!isFirst ? (
            <button
              type="button"
              onClick={() => { playPop(); onPrev(); }}
              className="rounded-xl border border-amber-100/15 px-4 py-2.5 text-sm font-semibold text-amber-100/50 transition-colors hover:bg-amber-100/10 hover:text-amber-50"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {/* Rotary position indicator */}
          <RotaryDial
            stepIndex={stepIndex}
            totalSteps={totalSteps}
          />

          {/* Next / Complete button */}
          <button
            type="button"
            onClick={handleNext}
            disabled={isFreeCallStep && micState !== 'granted'}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:from-red-500 hover:to-amber-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLast ? 'Going live' : isFreeCallStep && micState !== 'granted' ? 'Allow mic first' : 'Next'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function MicPermissionCard({
  state,
  onRequest,
}: {
  state: 'idle' | 'requesting' | 'granted' | 'denied';
  onRequest: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-100/15 bg-black/40 p-5">
      {state === 'granted' ? (
        <>
          <div className="mx-auto flex items-center justify-center gap-1.5 h-10">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className="block w-1 rounded-full bg-emerald-300/85 waveform-bar"
                style={{
                  height: `${14 + ((i * 5) % 22)}px`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-base font-display font-bold text-emerald-100">Line is open</p>
          <p className="mt-1 text-xs text-amber-100/55">We can hear you. Press the dial to start.</p>
        </>
      ) : state === 'denied' ? (
        <>
          <ShieldCheck className="mx-auto h-8 w-8 text-amber-300/70" />
          <p className="mt-3 text-base font-display font-bold text-amber-50">Mic blocked</p>
          <p className="mt-1 text-xs text-amber-100/55">Allow microphone in browser settings, then retry.</p>
          <button
            type="button"
            onClick={onRequest}
            className="mt-3 w-full rounded-lg border border-amber-100/20 bg-amber-100/10 py-2 text-xs font-bold text-amber-100"
          >
            Try again
          </button>
        </>
      ) : state === 'requesting' ? (
        <>
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-amber-300/40 border-t-amber-300 animate-spin" />
          <p className="mt-3 text-sm font-display text-amber-50">Listening for your permission</p>
        </>
      ) : (
        <>
          <Mic className="mx-auto h-8 w-8 text-amber-300/80" />
          <p className="mt-3 text-base font-display font-bold text-amber-50">First call is on us</p>
          <p className="mt-1 text-xs text-amber-100/55">
            No wallet. No signup. Just press the button and talk.
          </p>
          <button
            type="button"
            onClick={onRequest}
            className="mt-4 w-full rounded-lg bg-gradient-to-r from-red-600 to-amber-500 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/20"
          >
            Allow microphone
          </button>
        </>
      )}
    </div>
  );
}

function RotaryDial({ stepIndex, totalSteps }: { stepIndex: number; totalSteps: number }) {
  // Each "step" gets one rotation notch. We rotate the dial by (stepIndex / totalSteps) * 270deg.
  const angle = (stepIndex / Math.max(totalSteps - 1, 1)) * 270 - 135;
  return (
    <div className="relative h-8 w-8 flex items-center justify-center" aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-amber-100/20 bg-black/30" />
      <div
        className="absolute h-3 w-0.5 rounded-full bg-gradient-to-b from-amber-300 to-red-500 origin-bottom"
        style={{
          transform: `translateY(-3px) rotate(${angle}deg)`,
          transformOrigin: '50% 100%',
          bottom: '50%',
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
      <span className="font-mono text-[8px] text-amber-100/45">
        {stepIndex + 1}/{totalSteps}
      </span>
    </div>
  );
}
