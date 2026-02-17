'use client';

import { useState, useEffect, useCallback } from 'react';

export type OnboardingStep = 
  | 'welcome'
  | 'wallet-intro'
  | 'wallet-connect'
  | 'fund-wallet'
  | 'first-call-intro'
  | 'complete';

interface OnboardingState {
  isFirstTime: boolean;
  currentStep: OnboardingStep;
  hasSeenWelcome: boolean;
  hasConnectedWallet: boolean;
  hasFundedWallet: boolean;
  hasMadeFirstCall: boolean;
  isOpen: boolean;
}

interface UseOnboardingReturn extends OnboardingState {
  startOnboarding: () => void;
  closeOnboarding: () => void;
  nextStep: () => void;
  skipOnboarding: () => void;
  markStepComplete: (step: Exclude<OnboardingStep, 'welcome' | 'complete'>) => void;
  resetOnboarding: () => void;
}

const STORAGE_KEY = 'voisss-onboarding';

export function useOnboarding(walletConnected: boolean, walletBalance: number): UseOnboardingReturn {
  const [state, setState] = useState<OnboardingState>({
    isFirstTime: false,
    currentStep: 'welcome',
    hasSeenWelcome: false,
    hasConnectedWallet: false,
    hasFundedWallet: false,
    hasMadeFirstCall: false,
    isOpen: false,
  });

  // Load onboarding state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setState(prev => ({
        ...prev,
        ...parsed,
        isFirstTime: false, // Don't show automatically if stored
        isOpen: false,
      }));
    } else {
      // First time user
      setState(prev => ({
        ...prev,
        isFirstTime: true,
        isOpen: true,
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
      currentStep: 'welcome',
    }));
  }, []);

  const closeOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      const steps: OnboardingStep[] = ['welcome', 'wallet-intro', 'wallet-connect', 'fund-wallet', 'first-call-intro', 'complete'];
      const currentIndex = steps.indexOf(prev.currentStep);
      const nextStep = steps[currentIndex + 1] || 'complete';
      
      return {
        ...prev,
        currentStep: nextStep,
        hasSeenWelcome: true,
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

  const markStepComplete = useCallback((step: Exclude<OnboardingStep, 'welcome' | 'complete'>) => {
    setState(prev => ({
      ...prev,
      [`has${step.charAt(0).toUpperCase() + step.slice(1).replace(/-/g, '')}`]: true,
    }));
  }, []);

  const resetOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setState({
      isFirstTime: true,
      currentStep: 'welcome',
      hasSeenWelcome: false,
      hasConnectedWallet: false,
      hasFundedWallet: false,
      hasMadeFirstCall: false,
      isOpen: true,
    });
  }, []);

  return {
    ...state,
    startOnboarding,
    closeOnboarding,
    nextStep,
    skipOnboarding,
    markStepComplete,
    resetOnboarding,
  };
}
