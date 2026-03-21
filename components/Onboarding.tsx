'use client';

import { useState } from 'react';
import { X, ChevronRight, Wallet, Phone, Sparkles, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from './ui/Button';
import type { OnboardingStep } from '@/lib/useOnboarding';

interface OnboardingProps {
  isOpen: boolean;
  currentStep: OnboardingStep;
  walletConnected: boolean;
  walletBalance: number;
  onClose: () => void;
  onNext: () => void;
  onSkip: () => void;
  /** Pass the wallet connect function so the onboarding step can trigger it inline. */
  onConnect?: () => void;
}

export function Onboarding({
  isOpen,
  currentStep,
  walletConnected,
  walletBalance,
  onClose,
  onNext,
  onSkip,
  onConnect,
}: OnboardingProps) {
  if (!isOpen) return null;

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep onNext={onNext} onSkip={onSkip} />;
      case 'wallet-connect':
        return <WalletConnectStep 
          isConnected={walletConnected} 
          onNext={onNext} 
          onSkip={onSkip}
          onConnect={onConnect}
        />;
      case 'complete':
        return <CompleteStep onClose={onClose} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">Getting Started</span>
          </div>
          <button 
            onClick={onSkip}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {renderStep()}
        </div>

        {/* Progress */}
        <div className="px-6 pb-6">
          <div className="flex gap-1">
            {['welcome', 'wallet-connect', 'complete'].map((step, i) => {
              const steps: OnboardingStep[] = ['welcome', 'wallet-connect', 'complete'];
              const currentIndex = steps.indexOf(currentStep);
              const isActive = i <= currentIndex;
              return (
                <div 
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    isActive ? 'bg-cyan-500' : 'bg-gray-800'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
        <Phone className="w-10 h-10 text-white" />
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-3">
        Welcome to Voice Agent Hotline
      </h2>
      
      <p className="text-gray-400 mb-6">
        Talk to AI experts in real-time. Pay per second with crypto. 
        No subscriptions, no commitments.
      </p>

      <div className="space-y-3 mb-6">
        <Feature icon="🎙️" text="Real-time voice conversations" />
        <Feature icon="⚡" text="Pay only for what you use" />
        <Feature icon="🔒" text="Secure crypto payments on Celo" />
      </div>

      <div className="flex gap-3">
        <Button onClick={onNext} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500">
          Get Started
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button onClick={onSkip} variant="ghost">
          Skip
        </Button>
      </div>
    </div>
  );
}

function WalletIntroStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div>
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
        <Wallet className="w-8 h-8 text-white" />
      </div>
      
      <h2 className="text-xl font-bold text-white mb-3 text-center">
        Connect Your Wallet
      </h2>
      
      <p className="text-gray-400 mb-6 text-center">
        We use crypto wallets for payments. Don't worry - it's simpler than it sounds!
      </p>

      <div className="bg-gray-800/50 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔐</span>
          <div>
            <p className="font-medium text-white">Your wallet = Your account</p>
            <p className="text-sm text-gray-400">No passwords needed. Your wallet is your identity.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <p className="font-medium text-white">Pay as you go</p>
            <p className="text-sm text-gray-400">Only pay for the seconds you're on a call.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-2xl">🌐</span>
          <div>
            <p className="font-medium text-white">Works everywhere</p>
            <p className="text-sm text-gray-400">Use MetaMask, Rainbow, or any wallet you prefer.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onNext} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500">
          Connect Wallet
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button onClick={onSkip} variant="ghost">
          Skip
        </Button>
      </div>
    </div>
  );
}

function WalletConnectStep({ 
  isConnected, 
  onNext, 
  onSkip,
  onConnect,
}: { 
  isConnected: boolean; 
  onNext: () => void; 
  onSkip: () => void;
  onConnect?: () => void;
}) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!onConnect) return;
    setConnecting(true);
    try {
      await onConnect();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="text-center">
      {isConnected ? (
        <>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Wallet Connected! 🎉</h2>
          <p className="text-gray-400 mb-6">You're all set to make calls.</p>
          <Button onClick={onNext} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500">
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </>
      ) : (
        <>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <Wallet className={`w-8 h-8 text-cyan-400 ${connecting ? 'animate-pulse' : ''}`} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-6">
            A crypto wallet is your identity on Voice Agent Hotline — no username or password needed.
          </p>

          {/* Wallet logos */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {['🦊 MetaMask', '🌈 Rainbow', '💎 Coinbase'].map(w => (
              <span key={w} className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1.5 rounded-lg">{w}</span>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {onConnect ? (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                isLoading={connecting}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500"
              >
                {connecting ? 'Connecting…' : 'Connect Wallet'}
                {!connecting && <Wallet className="w-4 h-4 ml-2" />}
              </Button>
            ) : null}
            <Button onClick={onSkip} variant="ghost" className="w-full text-gray-500">
              Skip for now — I'll do this later
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FundWalletStep({ 
  isConnected, 
  balance, 
  onNext, 
  onSkip 
}: { 
  isConnected: boolean;
  balance: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const hasBalance = balance > 0;

  if (!isConnected) {
    return (
      <div className="text-center">
        <p className="text-gray-400">Please connect your wallet first.</p>
        <Button onClick={onSkip} variant="ghost" className="mt-4">
          Skip for now
        </Button>
      </div>
    );
  }

  if (hasBalance) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">You're Funded!</h2>
        <p className="text-gray-400 mb-2">Balance: ${(balance || 0).toFixed(2)}</p>
        <p className="text-sm text-gray-500 mb-6">Ready to make your first call.</p>
        <Button onClick={onNext} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-3 text-center">Add Funds</h2>
      <p className="text-gray-400 mb-6 text-center">
        Your wallet is empty. Add some cUSD to make calls.
      </p>

      <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
        <p className="text-sm text-gray-400 mb-3">Quick options:</p>
        <div className="space-y-2">
          <a 
            href="https://faucet.celo.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="text-white">🚰 Celo Faucet (Free)</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </a>
          <a 
            href="https://app.uniswap.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="text-white">💱 Buy cUSD</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </a>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onNext} variant="outline" className="flex-1">
          I have funds
        </Button>
        <Button onClick={onSkip} variant="ghost">
          Skip
        </Button>
      </div>
    </div>
  );
}

function FirstCallStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
        <Phone className="w-8 h-8 text-white" />
      </div>
      
      <h2 className="text-xl font-bold text-white mb-3">
        Make Your First Call
      </h2>
      
      <p className="text-gray-400 mb-6">
        We recommend starting with General Helper - it's the most affordable at just $0.05/minute.
      </p>

      <div className="bg-gray-800/50 rounded-xl p-4 mb-6 text-left">
        <p className="text-sm font-medium text-white mb-2">How it works:</p>
        <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
          <li>Browse agents and pick one</li>
          <li>Authorize payment (max $0.50)</li>
          <li>Talk in real-time</li>
          <li>Pay only for seconds used</li>
        </ol>
      </div>

      <Button onClick={onNext} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500">
        Start Exploring
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

function CompleteStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-3">
        You're All Set!
      </h2>
      
      <p className="text-gray-400 mb-6">
        Start exploring agents and make your first call. 
        The General Helper is great for beginners.
      </p>

      <Button onClick={onClose} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500">
        Start Using Voice Agent Hotline
      </Button>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <span className="text-xl">{icon}</span>
      <span className="text-gray-300">{text}</span>
    </div>
  );
}
