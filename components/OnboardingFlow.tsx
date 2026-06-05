'use client';

import { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneCall, Mic, MessageSquare, Zap, X, ChevronRight } from 'lucide-react';
import { Mascot } from './Mascot';
import { playPop, playSuccess, playDialTone } from '@/lib/sounds';
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
}

const STEP_META: Record<string, { title: string; subtitle: string; mood: 'waving' | 'thinking' | 'talking' | 'happy' | 'celebrating' }> = {
  'splash': { title: 'Hey, I\'m Vox!', subtitle: 'Your voice-first AI concierge. Let me show you around.', mood: 'waving' },
  'use-case': { title: 'What brings you here?', subtitle: 'Pick a focus and I\'ll match you with the best voices.', mood: 'thinking' },
  'how-it-works': { title: 'How it works', subtitle: 'Three steps. No typing, no forms.', mood: 'talking' },
  'free-call': { title: 'Your first call is free', subtitle: 'No wallet, no sign-up — just tap and talk.', mood: 'happy' },
  'complete': { title: 'You\'re all set!', subtitle: 'Tap the dial below to start your first call.', mood: 'celebrating' },
};

const HOW_IT_WORKS_STEPS = [
  { icon: PhoneCall, label: 'Tap the dial', desc: 'Pick an agent or let me choose for you' },
  { icon: Mic, label: 'Speak naturally', desc: 'Your voice connects instantly' },
  { icon: MessageSquare, label: 'Get answers', desc: 'Real-time conversation, no waiting' },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.96,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
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
}: OnboardingFlowProps) {
  const meta = STEP_META[currentStep];
  const isLast = currentStep === 'complete';
  const isFirst = currentStep === 'splash';

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
      onComplete();
    } else {
      onNext();
    }
  }, [isLast, onNext, onComplete]);

  const handleSkip = useCallback(() => {
    track('onboarding_skipped', { step: currentStep });
    onSkip();
  }, [currentStep, onSkip]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[80] flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0b0806]/92 backdrop-blur-md" />

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

        {/* Mascot */}
        <motion.div
          key={`mascot-${currentStep}`}
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="mb-6"
        >
          <Mascot mood={meta.mood} size={140} />
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
            <h2 className="text-2xl font-bold text-amber-50 sm:text-3xl">
              {meta.title}
            </h2>
            <p className="mt-2 text-sm text-amber-100/60">
              {meta.subtitle}
            </p>

            {/* Screen-specific content */}
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
                          ? 'border-red-500/50 bg-red-500/15 shadow-sm shadow-red-500/10'
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

            {currentStep === 'how-it-works' && (
              <div className="mt-6 space-y-3">
                {HOW_IT_WORKS_STEPS.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.12 }}
                    className="flex items-center gap-4 rounded-xl border border-amber-100/10 bg-amber-100/[0.03] px-4 py-3 text-left"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-amber-500/20">
                      <step.icon className="h-5 w-5 text-amber-200" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-50">{step.label}</p>
                      <p className="text-xs text-amber-100/50">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {currentStep === 'free-call' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-5"
              >
                <Zap className="mx-auto h-8 w-8 text-emerald-300" />
                <p className="mt-3 text-lg font-bold text-emerald-100">First call is on us</p>
                <p className="mt-1 text-sm text-emerald-200/60">
                  No wallet needed. No credit card. Just pick up the line and see how it feels.
                </p>
              </motion.div>
            )}

            {currentStep === 'complete' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-100/15 bg-amber-100/5 px-4 py-2">
                  <PhoneCall className="h-4 w-4 text-amber-300" />
                  <span className="text-sm font-semibold text-amber-100/70">
                    The dial is waiting for you below
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-8 flex w-full items-center justify-between">
          {/* Back button */}
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

          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? 'w-6 bg-amber-400'
                    : i < stepIndex
                      ? 'w-2 bg-amber-400/40'
                      : 'w-2 bg-amber-100/15'
                }`}
              />
            ))}
          </div>

          {/* Next / Complete button */}
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:from-red-500 hover:to-amber-400 active:scale-95"
          >
            {isLast ? 'Let\'s go' : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
