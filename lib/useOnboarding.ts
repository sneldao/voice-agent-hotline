'use client';

import { useState, useEffect, useCallback } from 'react';
import { track } from '@/lib/track';

export type OnboardingStep =
  | 'splash'
  | 'use-case'
  | 'how-it-works'
  | 'free-call'
  | 'complete';

export type UseCase = 'conservative' | 'research' | 'momentum' | 'macro' | 'risk' | 'general';

interface OnboardingState {
  isFirstTime: boolean;
  currentStep: OnboardingStep;
  hasSeenWelcome: boolean;
  hasConnectedWallet: boolean;
  hasFundedWallet: boolean;
  hasMadeFirstCall: boolean;
  isOpen: boolean;
  selectedUseCase: UseCase | null;
}

interface UseOnboardingReturn extends OnboardingState {
  startOnboarding: () => void;
  closeOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  setUseCase: (useCase: UseCase) => void;
  markStepComplete: (step: string) => void;
  resetOnboarding: () => void;
  totalSteps: number;
  currentStepIndex: number;
  /** Whether to show the unified onboarding flow */
  showOnboarding: boolean;
}

export const USE_CASES: { id: UseCase; emoji: string; label: string; description: string }[] = [
  { id: 'conservative', emoji: '🔔', label: 'Conservative', description: 'Tokenized stocks, confirmation-first' },
  { id: 'research', emoji: '🔍', label: 'Research', description: 'Fundamentals and valuation' },
  { id: 'momentum', emoji: '🚀', label: 'Momentum', description: 'Growth themes and catalysts' },
  { id: 'macro', emoji: '📰', label: 'Macro', description: 'Rates, markets, news' },
  { id: 'risk', emoji: '🛡️', label: 'Risk', description: 'Position sizing and health checks' },
  { id: 'general', emoji: '🤖', label: 'General Help', description: 'A bit of everything' },
];

const STORAGE_KEY = 'claflin-onboarding';
const PREFERENCES_KEY = 'claflin-preferences';

const STEPS: OnboardingStep[] = [
  'splash',
  'use-case',
  'how-it-works',
  'free-call',
  'complete',
];

export function useOnboarding(walletConnected: boolean, walletBalance: number): UseOnboardingReturn {
  const [state, setState] = useState<OnboardingState>({
    isFirstTime: false,
    currentStep: 'splash',
    hasSeenWelcome: false,
    hasConnectedWallet: false,
    hasFundedWallet: false,
    hasMadeFirstCall: false,
    isOpen: false,
    selectedUseCase: null,
  });

  // Load onboarding state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(STORAGE_KEY);
    const prefs = localStorage.getItem(PREFERENCES_KEY);
    const parsedPrefs = prefs ? JSON.parse(prefs) : {};

    if (stored) {
      const parsed = JSON.parse(stored);
      setState(prev => ({
        ...prev,
        ...parsed,
        selectedUseCase: parsedPrefs.useCase || null,
        isFirstTime: false,
        isOpen: false,
      }));
    } else {
      // First time user — show the unified onboarding flow
      setState(prev => ({
        ...prev,
        isFirstTime: true,
        isOpen: true,
        selectedUseCase: parsedPrefs.useCase || null,
      }));
    }
  }, []);

  // Sync wallet status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      hasConnectedWallet: walletConnected,
      hasFundedWallet: walletBalance > 0,
    }));
  }, [walletConnected, walletBalance]);

  // Persist state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      hasSeenWelcome: state.hasSeenWelcome,
      hasConnectedWallet: state.hasConnectedWallet,
      hasFundedWallet: state.hasFundedWallet,
      hasMadeFirstCall: state.hasMadeFirstCall,
    }));
  }, [state.hasSeenWelcome, state.hasConnectedWallet, state.hasFundedWallet, state.hasMadeFirstCall]);

  const startOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      currentStep: 'splash',
    }));
  }, []);

  const closeOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      hasSeenWelcome: true,
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      const currentIndex = STEPS.indexOf(prev.currentStep);
      const next = STEPS[currentIndex + 1] || 'complete';
      return {
        ...prev,
        currentStep: next,
        hasSeenWelcome: true,
      };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => {
      const currentIndex = STEPS.indexOf(prev.currentStep);
      if (currentIndex <= 0) return prev;
      return {
        ...prev,
        currentStep: STEPS[currentIndex - 1],
      };
    });
  }, []);

  const skipOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      hasSeenWelcome: true,
    }));
  }, []);

  const setUseCase = useCallback((useCase: UseCase) => {
    setState(prev => ({ ...prev, selectedUseCase: useCase }));
    if (typeof window !== 'undefined') {
      const prefs = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...prefs, useCase }));
    }
    track('use_case_selected', { useCase });
  }, []);

  const markStepComplete = useCallback((step: string) => {
    setState(prev => ({
      ...prev,
      [`has${step.charAt(0).toUpperCase() + step.slice(1).replace(/-/g, '')}`]: true,
    }));
  }, []);

  const resetOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PREFERENCES_KEY);
    }
    setState({
      isFirstTime: true,
      currentStep: 'splash',
      hasSeenWelcome: false,
      hasConnectedWallet: false,
      hasFundedWallet: false,
      hasMadeFirstCall: false,
      isOpen: true,
      selectedUseCase: null,
    });
  }, []);

  const showOnboarding = state.isOpen && state.isFirstTime;

  return {
    ...state,
    startOnboarding,
    closeOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
    setUseCase,
    markStepComplete,
    resetOnboarding,
    showOnboarding,
    totalSteps: STEPS.length,
    currentStepIndex: STEPS.indexOf(state.currentStep),
  };
}
