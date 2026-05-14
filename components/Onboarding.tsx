'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Phone, ArrowRight, ArrowLeft, CheckCircle, Volume2, Users, Star, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { Mascot } from './Mascot';
import { playClick, playPop, playSuccess } from '@/lib/sounds';
import type { OnboardingStep, UseCase } from '@/lib/useOnboarding';

interface OnboardingProps {
  isOpen: boolean;
  currentStep: OnboardingStep;
  walletConnected: boolean;
  walletBalance: number;
  selectedUseCase: UseCase | null;
  currentStepIndex: number;
  totalSteps: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onSetUseCase: (useCase: UseCase) => void;
  onConnect?: () => void;
}

const pageVariants = {
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

const pageTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export function Onboarding({
  isOpen,
  currentStep,
  walletConnected,
  walletBalance,
  selectedUseCase,
  currentStepIndex,
  totalSteps,
  onClose,
  onNext,
  onPrev,
  onSkip,
  onSetUseCase,
  onConnect,
}: OnboardingProps) {
  const [direction, setDirection] = useState(1);

  const handleNext = useCallback(() => {
    playClick();
    setDirection(1);
    onNext();
  }, [onNext]);

  const handlePrev = useCallback(() => {
    playClick();
    setDirection(-1);
    onPrev();
  }, [onPrev]);

  if (!isOpen) return null;

  const renderStep = () => {
    switch (currentStep) {
      case 'splash':
        return <SplashStep onNext={handleNext} />;
      case 'use-case':
        return <UseCaseStep selected={selectedUseCase} onSelect={onSetUseCase} onNext={handleNext} />;
      case 'voice-demo':
        return <VoiceDemoStep onNext={handleNext} />;
      case 'meet-agents':
        return <MeetAgentsStep useCase={selectedUseCase} onNext={handleNext} />;
      case 'how-it-works':
        return <HowItWorksStep onNext={handleNext} />;
      case 'social-proof':
        return <SocialProofStep onNext={handleNext} />;
      case 'wallet-connect':
        return <WalletStep isConnected={walletConnected} onNext={handleNext} onSkip={onSkip} onConnect={onConnect} />;
      case 'complete':
        return <CompleteStep onClose={onClose} useCase={selectedUseCase} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex h-dvh items-center justify-center overflow-hidden bg-[#0b0806]/98 backdrop-blur-md">
      <div className="relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-amber-100/15 sm:shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          {currentStepIndex > 0 && currentStep !== 'complete' ? (
            <button onClick={handlePrev} className="p-2 text-amber-100/50 hover:text-amber-50 transition-colors" aria-label="Go back">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-9" />
          )}
          {currentStep !== 'complete' && (
            <button onClick={onSkip} className="p-2 text-amber-100/40 hover:text-amber-50 text-xs font-medium transition-colors">
              Skip
            </button>
          )}
        </div>

        {/* Progress bar */}
        {currentStep !== 'complete' && (
          <div className="px-5 pb-4">
            <div className="flex gap-1">
              {Array.from({ length: totalSteps - 1 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    i <= currentStepIndex ? 'bg-gradient-to-r from-red-500 to-amber-400' : 'bg-amber-100/10'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Content with page transitions */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={pageTransition}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}


// ─── Step 1: Splash ─────────────────────────────────────────────────────────

function SplashStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
      >
        <Mascot mood="waving" size={140} />
      </motion.div>

      <motion.h1
        className="mt-6 text-3xl font-bold text-amber-50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        Hey, I'm Vox!
      </motion.h1>

      <motion.p
        className="mt-3 text-base text-amber-100/60 max-w-xs leading-relaxed"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        I'm your operator on the VOISSS Hotline. I'll connect you to AI voices that actually get things done.
      </motion.p>

      <motion.p
        className="mt-2 text-sm text-amber-100/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        No typing. No forms. Just speak.
      </motion.p>

      <motion.div
        className="mt-8 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
      >
        <Button onClick={onNext} className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400" size="lg">
          Let's go
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Step 2: Use Case Selection ─────────────────────────────────────────────

const USE_CASES: { id: UseCase; emoji: string; label: string; description: string }[] = [
  { id: 'coding', emoji: '💻', label: 'Code & Tech', description: 'Debug, review, and build' },
  { id: 'health', emoji: '⚕️', label: 'Health', description: 'Prep for doctor visits' },
  { id: 'research', emoji: '🔍', label: 'Research', description: 'Find answers fast' },
  { id: 'crypto', emoji: '🪙', label: 'Crypto & Web3', description: 'Wallets, DeFi, chains' },
  { id: 'travel', emoji: '🌍', label: 'Travel', description: 'Plan trips by voice' },
  { id: 'general', emoji: '🤖', label: 'General Help', description: 'A bit of everything' },
];

function UseCaseStep({ selected, onSelect, onNext }: { selected: UseCase | null; onSelect: (u: UseCase) => void; onNext: () => void }) {
  const handleSelect = (id: UseCase) => {
    playPop();
    onSelect(id);
  };

  return (
    <div className="py-4">
      <div className="flex items-center gap-3 mb-2">
        <Mascot mood="thinking" size={48} />
        <div>
          <h2 className="text-xl font-bold text-amber-50">What brings you here?</h2>
          <p className="text-sm text-amber-100/50">I'll match you with the right voices</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-5">
        {USE_CASES.map((uc, i) => (
          <motion.button
            key={uc.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => handleSelect(uc.id)}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all active:scale-[0.97] ${
              selected === uc.id
                ? 'border-red-500/60 bg-red-500/15 shadow-lg shadow-red-500/10'
                : 'border-amber-100/10 bg-amber-100/5 hover:border-amber-100/25'
            }`}
          >
            <span className="text-2xl">{uc.emoji}</span>
            <span className="text-sm font-semibold text-amber-50">{uc.label}</span>
            <span className="text-xs text-amber-100/45">{uc.description}</span>
          </motion.button>
        ))}
      </div>

      <motion.div
        className="mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: selected ? 1 : 0.4 }}
      >
        <Button
          onClick={onNext}
          disabled={!selected}
          className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
}


// ─── Step 3: Voice Demo ─────────────────────────────────────────────────────

function VoiceDemoStep({ onNext }: { onNext: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
    // Simulate a short audio demo (in production, play an actual audio clip)
    setTimeout(() => setIsPlaying(false), 3000);
  };

  return (
    <div className="flex flex-col items-center text-center py-6">
      <Mascot mood={isPlaying ? 'talking' : 'happy'} size={100} />

      <h2 className="mt-5 text-xl font-bold text-amber-50">This is what it sounds like</h2>
      <p className="mt-2 text-sm text-amber-100/50 max-w-xs">
        Real AI voices. Not robotic text-to-speech — natural, expressive conversations.
      </p>

      {/* Audio waveform visualization */}
      <motion.div
        className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-100/15 bg-amber-100/5 px-6 py-4 w-full max-w-xs"
        animate={isPlaying ? { borderColor: 'rgba(239, 68, 68, 0.4)' } : {}}
      >
        <button
          onClick={handlePlay}
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-all ${
            isPlaying ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-amber-100/10 hover:bg-amber-100/20'
          }`}
        >
          {isPlaying ? (
            <Volume2 className="w-5 h-5 text-white animate-pulse" />
          ) : (
            <Volume2 className="w-5 h-5 text-amber-100/70" />
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-end gap-0.5 h-8">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-full bg-gradient-to-t from-red-500 to-amber-400"
                animate={isPlaying ? {
                  height: [4, Math.random() * 28 + 4, 4],
                } : { height: 4 }}
                transition={isPlaying ? {
                  repeat: Infinity,
                  duration: 0.4 + Math.random() * 0.3,
                  delay: i * 0.02,
                } : {}}
                style={{ height: 4 }}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-amber-100/40 text-left">
            {isPlaying ? 'Playing demo...' : 'Tap to hear a sample'}
          </p>
        </div>
      </motion.div>

      <div className="mt-6 space-y-2 w-full max-w-xs text-left">
        <Feature icon="🎧" text="Ultra-low latency — feels like a real call" />
        <Feature icon="🗣️" text="Multiple voice personalities to choose from" />
        <Feature icon="🧠" text="Agents remember context mid-conversation" />
      </div>

      <div className="mt-6 w-full">
        <Button onClick={onNext} className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400">
          That's cool, show me more
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Meet Your Agents ───────────────────────────────────────────────

const AGENT_PREVIEWS: Record<UseCase, { name: string; emoji: string; specialty: string; voiceNote: string }[]> = {
  coding: [
    { name: 'Code Reviewer', emoji: '👨‍💻', specialty: 'Debug & architecture', voiceNote: 'Direct senior engineer voice' },
    { name: 'General Helper', emoji: '🤖', specialty: 'Anything you need', voiceNote: 'Warm concierge voice' },
  ],
  health: [
    { name: 'Dr. Maya', emoji: '⚕️', specialty: 'Health prep & education', voiceNote: 'Calm, careful voice' },
    { name: 'General Helper', emoji: '🤖', specialty: 'Life admin', voiceNote: 'Warm concierge voice' },
  ],
  research: [
    { name: 'Web Researcher', emoji: '🔍', specialty: 'Live web search', voiceNote: 'Thorough analyst voice' },
    { name: 'General Helper', emoji: '🤖', specialty: 'Quick answers', voiceNote: 'Warm concierge voice' },
  ],
  crypto: [
    { name: 'Solana Sage', emoji: '🔮', specialty: 'Wallets & DeFi', voiceNote: 'Precise technical voice' },
    { name: 'Code Reviewer', emoji: '👨‍💻', specialty: 'Smart contracts', voiceNote: 'Direct engineer voice' },
  ],
  travel: [
    { name: 'Tour Master', emoji: '🌍', specialty: 'Trip planning', voiceNote: 'Upbeat local guide voice' },
    { name: 'Web Researcher', emoji: '🔍', specialty: 'Price comparison', voiceNote: 'Thorough analyst voice' },
  ],
  general: [
    { name: 'General Helper', emoji: '🤖', specialty: 'Anything you need', voiceNote: 'Warm concierge voice' },
    { name: 'Web Researcher', emoji: '🔍', specialty: 'Find anything', voiceNote: 'Thorough analyst voice' },
  ],
};

function MeetAgentsStep({ useCase, onNext }: { useCase: UseCase | null; onNext: () => void }) {
  const agents = AGENT_PREVIEWS[useCase || 'general'];

  return (
    <div className="py-4">
      <div className="flex items-center gap-3 mb-1">
        <Mascot mood="happy" size={48} />
        <div>
          <h2 className="text-xl font-bold text-amber-50">Your top matches</h2>
          <p className="text-sm text-amber-100/50">Based on what you told me</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {agents.map((agent, i) => (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex items-center gap-4 rounded-xl border border-amber-100/10 bg-amber-100/5 p-4"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-900/60 to-amber-900/40 text-2xl">
              {agent.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-50">{agent.name}</p>
              <p className="text-sm text-amber-100/50">{agent.specialty}</p>
              <p className="mt-1 text-xs text-amber-100/35 italic">🎙️ {agent.voiceNote}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.p
        className="mt-4 text-center text-sm text-amber-100/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        + 4 more specialists on the board
      </motion.p>

      <div className="mt-5">
        <Button onClick={onNext} className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400">
          How does it work?
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}


// ─── Step 5: How It Works ───────────────────────────────────────────────────

function HowItWorksStep({ onNext }: { onNext: () => void }) {
  const steps = [
    { icon: '👆', title: 'Tap an agent', description: 'Pick a specialist from the board' },
    { icon: '🎙️', title: 'Just talk', description: 'Speak naturally — no prompts needed' },
    { icon: '⚡', title: 'They act', description: 'Agents search, book, and research for you' },
    { icon: '💰', title: 'Pay per second', description: 'Only charged while the line is active' },
  ];

  return (
    <div className="py-4">
      <div className="text-center mb-6">
        <Mascot mood="idle" size={64} className="mx-auto" />
        <h2 className="mt-3 text-xl font-bold text-amber-50">Dead simple</h2>
        <p className="text-sm text-amber-100/50">Four steps. No learning curve.</p>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex items-center gap-4 rounded-xl border border-amber-100/10 bg-amber-100/5 p-3.5"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-amber-500/20 text-xl">
              {step.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-50">{step.title}</p>
              <p className="text-xs text-amber-100/45">{step.description}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="ml-auto text-amber-100/20">→</div>
            )}
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <p className="text-sm text-emerald-200">
          <Zap className="inline w-4 h-4 mr-1" />
          Your first call is free — no wallet needed
        </p>
      </motion.div>

      <div className="mt-5">
        <Button onClick={onNext} className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400">
          Almost there
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 6: Social Proof ───────────────────────────────────────────────────

function SocialProofStep({ onNext }: { onNext: () => void }) {
  const stats = [
    { value: '12,000+', label: 'Minutes of AI calls' },
    { value: '4.8', label: 'Average rating', icon: '⭐' },
    { value: '6', label: 'Specialist agents' },
  ];

  const reviews = [
    { text: 'Used it while cooking — asked about nutrition without touching my phone.', author: 'Sarah K.', rating: 5 },
    { text: 'The code reviewer caught a bug I missed. All by voice.', author: 'Dev M.', rating: 5 },
    { text: 'Way faster than typing prompts into ChatGPT.', author: 'Alex R.', rating: 4 },
  ];

  return (
    <div className="py-4">
      <div className="text-center mb-5">
        <Mascot mood="celebrating" size={64} className="mx-auto" />
        <h2 className="mt-3 text-xl font-bold text-amber-50">People love this</h2>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl border border-amber-100/10 bg-amber-100/5 p-3 text-center"
          >
            <p className="text-lg font-bold text-amber-50">{stat.value}</p>
            <p className="text-[10px] text-amber-100/45 leading-tight">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Reviews */}
      <div className="space-y-2.5">
        {reviews.map((review, i) => (
          <motion.div
            key={review.author}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.12 }}
            className="rounded-xl border border-amber-100/10 bg-amber-100/5 p-3"
          >
            <div className="flex items-center gap-1 mb-1">
              {Array.from({ length: review.rating }).map((_, j) => (
                <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-sm text-amber-100/70 leading-relaxed">"{review.text}"</p>
            <p className="mt-1 text-xs text-amber-100/35">— {review.author}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-5">
        <Button onClick={onNext} className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400">
          Get my Caller ID
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}


// ─── Step 7: Wallet Connect ─────────────────────────────────────────────────

function WalletStep({
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

  if (isConnected) {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
        </motion.div>
        <h2 className="mt-4 text-xl font-bold text-amber-50">Caller ID active! 🎉</h2>
        <p className="mt-2 text-sm text-amber-100/50">You're ready to make calls on the hotline.</p>
        <div className="mt-6 w-full">
          <Button onClick={onNext} className="w-full bg-gradient-to-r from-red-600 to-amber-500">
            Let's go
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-6">
      <Mascot mood="idle" size={80} />

      <h2 className="mt-4 text-xl font-bold text-amber-50">Grab your Caller ID</h2>
      <p className="mt-2 text-sm text-amber-100/50 max-w-xs">
        Your crypto wallet is your identity on the hotline. No email, no password — just connect and you're in.
      </p>

      {/* Wallet options */}
      <div className="flex items-center justify-center gap-3 mt-5">
        {['🦊 MetaMask', '🌈 Rainbow', '💎 Coinbase'].map(w => (
          <span key={w} className="text-xs text-amber-100/50 bg-amber-100/5 border border-amber-100/10 px-2.5 py-1.5 rounded-lg">{w}</span>
        ))}
      </div>

      <div className="mt-6 w-full space-y-3">
        {onConnect && (
          <Button
            onClick={handleConnect}
            disabled={connecting}
            isLoading={connecting}
            className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400"
            size="lg"
          >
            {connecting ? 'Connecting…' : 'Connect Wallet'}
            {!connecting && <Wallet className="w-4 h-4 ml-2" />}
          </Button>
        )}
        <button
          onClick={onSkip}
          className="w-full py-3 text-sm text-amber-100/40 hover:text-amber-100/60 transition-colors"
        >
          Skip — I'll try a free call first
        </button>
      </div>

      <p className="mt-4 text-xs text-amber-100/30 max-w-xs">
        You can always connect later. Your first call is free without a wallet.
      </p>
    </div>
  );
}

// ─── Step 8: Complete ───────────────────────────────────────────────────────

function CompleteStep({ onClose, useCase }: { onClose: () => void; useCase: UseCase | null }) {
  // Play success chime when this step mounts
  useEffect(() => { playSuccess(); }, []);

  const recommendation = useCase
    ? USE_CASES.find(u => u.id === useCase)
    : USE_CASES.find(u => u.id === 'general');

  return (
    <div className="flex flex-col items-center text-center py-8">
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
      >
        <Mascot mood="celebrating" size={120} />
      </motion.div>

      <motion.h2
        className="mt-5 text-2xl font-bold text-amber-50"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        You're on the board!
      </motion.h2>

      <motion.p
        className="mt-2 text-sm text-amber-100/50 max-w-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        The switchboard is live. Tap the dial or pick an agent to start your first conversation.
      </motion.p>

      {recommendation && (
        <motion.div
          className="mt-5 w-full rounded-xl border border-amber-100/15 bg-amber-100/5 p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <p className="text-xs text-amber-100/40 mb-2">Recommended for you</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{recommendation.emoji}</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-amber-50">{recommendation.label}</p>
              <p className="text-xs text-amber-100/45">{recommendation.description}</p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        className="mt-6 w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <Button onClick={onClose} className="w-full bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400" size="lg">
          <Phone className="w-4 h-4 mr-2" />
          Open the Hotline
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <span className="text-base">{icon}</span>
      <span className="text-sm text-amber-100/60">{text}</span>
    </div>
  );
}
